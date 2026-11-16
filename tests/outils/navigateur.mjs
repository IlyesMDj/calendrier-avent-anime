// Outils de test : lance le serveur d'aperçu et Edge en mode sans fenêtre (headless),
// puis pilote la page via le protocole DevTools (CDP). Aucune dépendance :
// Node 24 fournit fetch et WebSocket en global.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHEMIN_NAVIGATEUR = process.env.NAVIGATEUR
  || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function navigateurPresent() {
  return fs.existsSync(CHEMIN_NAVIGATEUR);
}

const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function avecDelai(promesse, ms) {
  let minuteur;
  const delai = new Promise((resolve) => { minuteur = setTimeout(resolve, ms); });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

async function attendreCondition(verifier, ms, messageErreur) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const valeur = await verifier();
    if (valeur) return valeur;
    await attendre(100);
  }
  throw new Error(messageErreur);
}

function tuerArbre(pid) {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 3000, windowsHide: true });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch { /* déjà arrêté */ }
}

function attendreSortie(enfant, ms) {
  return new Promise((resolve) => {
    if (enfant.exitCode !== null || enfant.signalCode !== null) return resolve();
    const minuteur = setTimeout(resolve, ms);
    enfant.once('exit', () => { clearTimeout(minuteur); resolve(); });
  });
}

export function demarrerApercu({ date, port }) {
  return new Promise((resolve, reject) => {
    const enfant = spawn(
      process.execPath,
      [path.join(RACINE, 'scripts', 'apercu.mjs'), '--date', date, '--port', String(port)],
      { cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    enfant.stdout.setEncoding('utf8');
    enfant.stderr.setEncoding('utf8');
    let sortie = '';
    let erreurs = '';
    let termine = false;

    const arreter = async () => {
      if (enfant.exitCode === null && enfant.signalCode === null) tuerArbre(enfant.pid);
      await attendreSortie(enfant, 3000);
    };

    const minuteur = setTimeout(() => {
      if (termine) return;
      termine = true;
      arreter().then(() => reject(new Error(`apercu : aucune adresse affichée après 10 s\n${erreurs}`)));
    }, 10000);

    enfant.stdout.on('data', (morceau) => {
      sortie += morceau;
      if (termine) return;
      const trouve = /https?:\/\/\S+/.exec(sortie);
      if (trouve && sortie.indexOf('\n', trouve.index) !== -1) {
        termine = true;
        clearTimeout(minuteur);
        const url = trouve[0].replace('localhost', '127.0.0.1');
        resolve({ url: url.endsWith('/') ? url : `${url}/`, arreter });
      }
    });
    enfant.stderr.on('data', (morceau) => { erreurs += morceau; });
    enfant.on('error', (erreur) => {
      if (termine) return;
      termine = true;
      clearTimeout(minuteur);
      reject(erreur);
    });
    enfant.on('exit', (code) => {
      if (termine) return;
      termine = true;
      clearTimeout(minuteur);
      reject(new Error(`apercu arrêté (code ${code}) avant d'afficher son adresse\n${erreurs}`));
    });
  });
}

export async function ouvrirPage(url, {
  largeur = 1200,
  hauteur = 900,
  mouvementReduit = false,
  retenirDonnees = false,
  echecDonnees = false,
} = {}) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'navigateur-'));
  const navigateur = spawn(CHEMIN_NAVIGATEUR, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1280,1000',
    'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  navigateur.on('error', () => {});

  const erreurs = [];
  const retenus = [];
  const enAttente = new Map();
  let socket = null;
  let seq = 0;
  let ferme = false;
  let chargementFait = null;

  const annulerTout = (raison) => {
    for (const traiter of [...enAttente.values()]) traiter({ error: { message: raison } });
  };

  const envoyer = (method, params = {}) => new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== 1) {
      reject(new Error(`${method} : navigateur non connecté`));
      return;
    }
    const id = ++seq;
    const minuteur = setTimeout(() => {
      enAttente.delete(id);
      reject(new Error(`délai dépassé (10 s) : ${method}`));
    }, 10000);
    enAttente.set(id, (reponse) => {
      clearTimeout(minuteur);
      enAttente.delete(id);
      if (reponse.error) reject(new Error(`${method} : ${reponse.error.message}`));
      else resolve(reponse.result);
    });
    try {
      socket.send(JSON.stringify({ id, method, params }));
    } catch (erreur) {
      clearTimeout(minuteur);
      enAttente.delete(id);
      reject(erreur);
    }
  });

  const evenements = {
    'Runtime.exceptionThrown': ({ exceptionDetails: d }) => {
      erreurs.push(d.exception?.description || d.text);
    },
    'Page.loadEventFired': () => { chargementFait?.(); },
    'Fetch.requestPaused': ({ requestId }) => {
      if (echecDonnees) envoyer('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
      else if (retenirDonnees) retenus.push(requestId);
      else envoyer('Fetch.continueRequest', { requestId }).catch(() => {});
    },
  };

  const surMessage = (donnees) => {
    const msg = JSON.parse(donnees);
    if (msg.id !== undefined) {
      enAttente.get(msg.id)?.(msg);
    } else {
      evenements[msg.method]?.(msg.params ?? {});
    }
  };

  const evaluer = async (expression) => {
    const reponse = await envoyer('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (reponse.exceptionDetails) {
      const d = reponse.exceptionDetails;
      throw new Error(d.exception?.description || d.text);
    }
    return reponse.result.value;
  };

  const cliquer = async (selecteur) => {
    const point = await evaluer(`(() => {
      const el = document.querySelector(${JSON.stringify(selecteur)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error(`élément introuvable : ${selecteur}`);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await envoyer('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount: 1,
      });
    }
  };

  const TOUCHES = {
    Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
    Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  };

  const touche = async (nom) => {
    const t = TOUCHES[nom];
    if (!t) throw new Error(`touche inconnue : ${nom}`);
    await envoyer('Input.dispatchKeyEvent', { type: 'keyDown', ...t });
    await envoyer('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: t.key,
      code: t.code,
      windowsVirtualKeyCode: t.windowsVirtualKeyCode,
    });
  };

  const relacher = async () => {
    for (const requestId of retenus.splice(0)) {
      await envoyer('Fetch.continueRequest', { requestId }).catch(() => {});
    }
  };

  const capturer = async (chemin, { pleinePage = true } = {}) => {
    const params = { format: 'png' };
    if (pleinePage) {
      const metriques = await envoyer('Page.getLayoutMetrics');
      const taille = metriques.cssContentSize ?? metriques.contentSize;
      params.captureBeyondViewport = true;
      params.clip = { x: 0, y: 0, width: taille.width, height: taille.height, scale: 1 };
    }
    const { data } = await envoyer('Page.captureScreenshot', params);
    fs.mkdirSync(path.dirname(chemin), { recursive: true });
    fs.writeFileSync(chemin, Buffer.from(data, 'base64'));
    return chemin;
  };

  const fermer = async () => {
    if (ferme) return;
    ferme = true;
    try {
      if (socket?.readyState === 1) socket.send(JSON.stringify({ id: ++seq, method: 'Browser.close' }));
    } catch { /* socket déjà fermée */ }
    await attendreSortie(navigateur, 2000);
    try { socket?.close(); } catch { /* déjà fermée */ }
    annulerTout('navigateur fermé');
    if (navigateur.exitCode === null && navigateur.signalCode === null) {
      tuerArbre(navigateur.pid);
      await attendreSortie(navigateur, 2000);
    }
    try { fs.rmSync(profil, { recursive: true, force: true, maxRetries: 3 }); } catch { /* fichiers verrouillés */ }
  };

  try {
    const fichierPort = path.join(profil, 'DevToolsActivePort');
    const port = await attendreCondition(() => {
      try {
        const m = /^(\d+)\r?\n/.exec(fs.readFileSync(fichierPort, 'utf8'));
        return m ? m[1] : null;
      } catch {
        return null;
      }
    }, 15000, 'navigateur : fichier DevToolsActivePort absent après 15 s');

    const cible = await attendreCondition(async () => {
      try {
        const reponse = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) });
        return (await reponse.json()).find((c) => c.type === 'page') ?? null;
      } catch {
        return null;
      }
    }, 5000, 'navigateur : aucune page disponible après 5 s');

    socket = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const minuteur = setTimeout(() => reject(new Error('navigateur : connexion WebSocket impossible (10 s)')), 10000);
      socket.addEventListener('open', () => { clearTimeout(minuteur); resolve(); }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(minuteur);
        reject(new Error('navigateur : connexion WebSocket refusée'));
      }, { once: true });
    });
    socket.addEventListener('message', (e) => surMessage(e.data));
    socket.addEventListener('close', () => annulerTout('connexion au navigateur fermée'));

    await envoyer('Page.enable');
    await envoyer('Runtime.enable');
    await envoyer('Emulation.setDeviceMetricsOverride', {
      width: largeur,
      height: hauteur,
      deviceScaleFactor: 1,
      mobile: largeur < 600,
    });
    await envoyer('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: mouvementReduit ? 'reduce' : 'no-preference' }],
    });
    if (retenirDonnees || echecDonnees) {
      await envoyer('Fetch.enable', {
        patterns: [{ urlPattern: '*donnees.json*', requestStage: 'Request' }],
      });
    }

    const charge = new Promise((resolve) => { chargementFait = resolve; });
    await envoyer('Page.navigate', { url });
    await avecDelai(charge, 15000);
    chargementFait = null;

    return { evaluer, cliquer, touche, attendre, relacher, capturer, erreurs, fermer };
  } catch (erreur) {
    await fermer();
    throw erreur;
  }
}
