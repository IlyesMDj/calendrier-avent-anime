// Tests de la planche manga (partie P1) : contrat DOM de la page et /donnees.json.
// Lancer : node --test --test-concurrency=1 tests/planche.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { navigateurPresent, demarrerApercu, ouvrirPage } from './outils/navigateur.mjs';

const PRESENT = navigateurPresent();
const TIMEOUT_TEST = 30000;
const TIMEOUT_HOOK = 60000;

const SERVEURS_SPEC = {
  decembre12: { date: '2026-12-12', port: 8101 },
  novembre16: { date: '2026-11-16', port: 8102 },
  decembre26: { date: '2026-12-26', port: 8103 },
};

const PAGES_SPEC = {
  A: { serveur: 'decembre12', largeur: 1200, hauteur: 900 },
  B: { serveur: 'decembre12', largeur: 360, hauteur: 740 },
  C: { serveur: 'novembre16', largeur: 1200, hauteur: 900 },
  D: { serveur: 'decembre26', largeur: 1200, hauteur: 900 },
  E: { serveur: 'decembre12', largeur: 1200, hauteur: 900, mouvementReduit: true },
};

const ETATS = ['ouverte', 'du-jour', 'fermee'];

// Texte normalisé : espaces insécables → espace, apostrophe typographique → ', trim.
const normaliser = (s) => String(s ?? '')
  .replace(/[  ]/g, ' ')
  .replace(/’/g, "'")
  .trim();

// Fonction JS (source) : vrai si l'élément est visible (voir la définition dans les tests).
const VISIBLE = `(el => {
  if (!el || el.hidden) return false;
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})`;

// Fonction JS (source) : instantané des indicateurs de focus d'une case et de sa chaîne d'ancêtres.
const SNAPSHOT_FOCUS = `(sel => {
  const btn = document.querySelector(sel);
  if (!btn) return null;
  const li = btn.parentElement;
  const cibles = [
    ['bouton', btn, null],
    ['bouton::before', btn, '::before'],
    ['bouton::after', btn, '::after'],
    ['li', li, null],
    ['li::before', li, '::before'],
    ['li::after', li, '::after'],
  ];
  const chaine = [];
  for (let el = btn; el; el = el.parentElement) {
    chaine.push(getComputedStyle(el).clipPath);
    if (el.id === 'grille') break;
  }
  return {
    chaine,
    cibles: cibles.map(([nom, el, p]) => {
      const s = getComputedStyle(el, p);
      return { nom, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow, clipPath: s.clipPath };
    }),
  };
})`;

const serveurs = {};
const pages = {};
const donnees = {};

async function lireDonnees(url) {
  const reponse = await fetch(new URL('donnees.json', url));
  if (!reponse.ok) throw new Error(`donnees.json : statut ${reponse.status}`);
  return reponse.json();
}

async function attendrePrete(page, nom) {
  const fin = Date.now() + 10000;
  let vues = 0;
  while (Date.now() < fin) {
    vues = await page.evaluer(`document.querySelectorAll('.case').length`);
    if (vues === 24) return;
    await page.attendre(100);
  }
  throw new Error(`page ${nom} non prête : 24 cases attendues après 10 s (${vues} trouvées)`);
}

const boites = (page) => page.evaluer(`[...document.querySelectorAll('.case')].map(c => {
  const r = c.getBoundingClientRect();
  return { jour: c.dataset.jour, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
})`);

function verifierOrdreVisuel(liste) {
  for (let i = 0; i < liste.length - 1; i++) {
    const a = liste[i];
    const b = liste[i + 1];
    const ok = b.left > a.left + 4 || b.top > a.top + 4;
    assert.ok(
      ok,
      `ordre visuel : la case ${b.jour} (x ${b.left.toFixed(0)}, y ${b.top.toFixed(0)}) devrait suivre la case ${a.jour} (x ${a.left.toFixed(0)}, y ${a.top.toFixed(0)})`,
    );
  }
}

function verifierPasDeChevauchement(liste) {
  for (let i = 0; i < liste.length; i++) {
    for (let j = i + 1; j < liste.length; j++) {
      const a = liste[i];
      const b = liste[j];
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      assert.ok(
        !(x > 1 && y > 1),
        `les cases ${a.jour} et ${b.jour} se chevauchent (${x.toFixed(1)} × ${y.toFixed(1)} px)`,
      );
    }
  }
}

const lum = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contraste = (a, b) => {
  const [clair, sombre] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (clair + 0.05) / (sombre + 0.05);
};

const CIBLES_FOCUS = [
  { nom: 'première case ouverte', selecteur: '.case.ouverte' },
  { nom: 'case du jour', selecteur: '.case.du-jour' },
  { nom: 'première case fermée', selecteur: '.case.fermee' },
];

// Lance un test ; sans navigateur, le test est sauté avec un message clair.
function test(nom, fn) {
  it(nom, { timeout: TIMEOUT_TEST }, async (t) => {
    if (!PRESENT) return t.skip('navigateur absent');
    return fn(t);
  });
}

describe('planche manga (P1)', () => {
  before(async () => {
    if (!PRESENT) return;
    for (const [cle, { date, port }] of Object.entries(SERVEURS_SPEC)) {
      serveurs[cle] = await demarrerApercu({ date, port });
    }
    for (const cle of Object.keys(serveurs)) {
      donnees[cle] = await lireDonnees(serveurs[cle].url);
    }
    // Une page à la fois : plusieurs démarrages d'Edge en parallèle dépassent le délai de l'helper.
    for (const [cle, spec] of Object.entries(PAGES_SPEC)) {
      const { serveur, ...options } = spec;
      pages[cle] = await ouvrirPage(serveurs[serveur].url, options);
      await attendrePrete(pages[cle], cle);
    }
  }, { timeout: TIMEOUT_HOOK });

  after(async () => {
    for (const page of Object.values(pages)) await page.fermer().catch(() => {});
    for (const serveur of Object.values(serveurs)) await serveur.arreter().catch(() => {});
  }, { timeout: TIMEOUT_HOOK });

  test('T1 c1 numéros dans l\'ordre', async () => {
    const r = await pages.A.evaluer(`(() => {
      const grille = document.getElementById('grille');
      const cases = grille ? [...grille.querySelectorAll('.case')] : [];
      return {
        tag: grille ? grille.tagName : null,
        nombre: cases.length,
        dansLi: cases.every(c => c.parentElement?.tagName === 'LI' && c.parentElement.parentElement === grille),
        numeros: cases.map(c => c.querySelector('.numero')?.textContent ?? null),
      };
    })()`);
    assert.equal(r.tag, 'OL', '#grille doit être une liste ol');
    assert.equal(r.nombre, 24, 'il doit y avoir 24 .case dans #grille');
    assert.ok(r.dansLi, 'chaque .case doit être dans un li enfant direct de #grille');
    assert.deepEqual(
      r.numeros.map(normaliser),
      Array.from({ length: 24 }, (_, i) => String(i + 1)),
      'les numéros doivent être 1 à 24 dans l\'ordre du DOM',
    );
  });

  test('T2 c1 ordre visuel = ordre DOM', async () => {
    verifierOrdreVisuel(await boites(pages.A));
  });

  test('T3 c1 ordre visuel à 360', async () => {
    verifierOrdreVisuel(await boites(pages.B));
  });

  test('T4 c2 pas de défilement horizontal à 360', async () => {
    const largeur = await pages.B.evaluer('document.documentElement.scrollWidth');
    assert.ok(largeur <= 360, `défilement horizontal : largeur de page ${largeur} px (maximum 360)`);
  });

  test('T5 c3 cases dans l\'écran à 360', async () => {
    for (const b of await boites(pages.B)) {
      assert.ok(b.left >= -0.5 && b.right <= 360.5,
        `case ${b.jour} hors de l'écran : x de ${b.left.toFixed(1)} à ${b.right.toFixed(1)} px`);
    }
  });

  test('T6 c4 cases assez grandes à 360', async () => {
    for (const b of await boites(pages.B)) {
      assert.ok(b.width >= 44 && b.height >= 44,
        `case ${b.jour} trop petite : ${b.width.toFixed(1)} × ${b.height.toFixed(1)} px (minimum 44 × 44)`);
    }
  });

  test('T7 c5 numéros lisibles à 360', async () => {
    const tailles = await pages.B.evaluer(`[...document.querySelectorAll('.numero')].map(n => ({
      jour: n.closest('.case')?.dataset.jour ?? null,
      taille: parseFloat(getComputedStyle(n).fontSize),
    }))`);
    for (const x of tailles) {
      assert.ok(x.taille >= 16, `case ${x.jour} : numéro à ${x.taille} px (minimum 16)`);
    }
  });

  test('T8 c6 pas de chevauchement à 1200', async () => {
    verifierPasDeChevauchement(await boites(pages.A));
  });

  test('T9 c6 pas de chevauchement à 360', async () => {
    verifierPasDeChevauchement(await boites(pages.B));
  });

  test('T10 obj tailles irrégulières', async () => {
    const arrondi = (v) => Math.round(v / 2) * 2;
    const a = await boites(pages.A);
    const largeursA = new Set(a.map((b) => arrondi(b.width)));
    const hauteursA = new Set(a.map((b) => arrondi(b.height)));
    assert.ok(largeursA.size >= 3,
      `à 1200 : ${largeursA.size} largeur(s) distincte(s) (minimum 3, arrondi 2 px)`);
    assert.ok(hauteursA.size >= 2,
      `à 1200 : ${hauteursA.size} hauteur(s) distincte(s) (minimum 2, arrondi 2 px)`);
    const largeursB = new Set((await boites(pages.B)).map((b) => arrondi(b.width)));
    assert.ok(largeursB.size >= 2,
      `à 360 : ${largeursB.size} largeur(s) distincte(s) (minimum 2, arrondi 2 px)`);
  });

  test('T11 c7 étiquette « Ouverte »', async () => {
    const textes = await pages.A.evaluer(`[...document.querySelectorAll('.case.ouverte')]
      .map(c => c.querySelector('.etiquette')?.textContent ?? null)`);
    assert.ok(textes.length >= 1, 'aucune .case.ouverte à 12 décembre');
    textes.forEach((texte, i) => {
      assert.equal(normaliser(texte), 'Ouverte', `case ouverte n°${i + 1} : étiquette « ${normaliser(texte)} » au lieu de « Ouverte »`);
    });
  });

  test('T12 c7 c11 états conformes aux données', async () => {
    const dom = await pages.A.evaluer(`[...document.querySelectorAll('.case')]
      .map(c => ({ jour: c.dataset.jour, classes: [...c.classList] }))`);
    for (const c of donnees.decembre12.cases) {
      const trouvee = dom.find((x) => x.jour === String(c.jour));
      assert.ok(trouvee, `case ${c.jour} introuvable dans la page`);
      assert.ok(trouvee.classes.includes(c.etat),
        `case ${c.jour} : classe « ${c.etat} » attendue, classes trouvées : ${trouvee.classes.join(' ')}`);
      for (const autre of ETATS.filter((e) => e !== c.etat)) {
        assert.ok(!trouvee.classes.includes(autre),
          `case ${c.jour} : classe « ${autre} » en trop (état attendu « ${c.etat} »)`);
      }
    }
  });

  test('T13 c8 étiquette « Aujourd\'hui »', async () => {
    const textes = await pages.A.evaluer(`[...document.querySelectorAll('.case.du-jour .etiquette')]
      .map(e => e.textContent)`);
    assert.ok(textes.length > 0, 'aucune étiquette dans la case du jour');
    for (const texte of textes) {
      assert.equal(normaliser(texte), "Aujourd'hui", `étiquette de la case du jour : « ${normaliser(texte)} »`);
    }
  });

  test('T14 c9 étiquette des cases fermées', async () => {
    const textes = await pages.A.evaluer(`[...document.querySelectorAll('.case.fermee')]
      .map(c => c.querySelector('.etiquette')?.textContent ?? null)`);
    assert.ok(textes.length >= 1, 'aucune .case.fermee à 12 décembre');
    for (const texte of textes) {
      assert.match(normaliser(texte), /^(le \d{1,2} déc\.|à \d{2}:\d{2})$/,
        `étiquette de case fermée « ${normaliser(texte)} » non conforme`);
    }
  });

  test('T15 c10 pictogramme par état', async () => {
    const icones = await pages.A.evaluer(`[...document.querySelectorAll('.case')].map(c => {
      const icone = c.querySelector('.icone');
      const svg = icone ? (icone.matches('svg') ? icone : icone.querySelector('svg')) : null;
      return {
        jour: c.dataset.jour,
        etat: ['ouverte', 'du-jour', 'fermee'].find(e => c.classList.contains(e)) ?? null,
        svg: svg ? svg.outerHTML : null,
      };
    })`);
    for (const x of icones) {
      assert.ok(x.svg, `case ${x.jour} : pas de <svg> dans .icone`);
      assert.ok(x.etat, `case ${x.jour} : aucun état reconnu`);
    }
    const groupes = {};
    for (const etat of ETATS) {
      const valeurs = icones.filter((x) => x.etat === etat).map((x) => x.svg);
      assert.ok(valeurs.length > 0, `aucune case « ${etat} » pour comparer les pictogrammes`);
      groupes[etat] = new Set(valeurs);
      assert.equal(groupes[etat].size, 1, `pictogrammes différents à l'intérieur de l'état « ${etat} »`);
    }
    const parEtat = ETATS.map((etat) => [...groupes[etat]][0]);
    for (let i = 0; i < ETATS.length; i++) {
      for (let j = i + 1; j < ETATS.length; j++) {
        assert.notEqual(parEtat[i], parEtat[j],
          `pictogramme identique pour les états « ${ETATS[i]} » et « ${ETATS[j]} »`);
      }
    }
  });

  test('T16 c11 une seule case du jour le 12', async () => {
    const du = donnees.decembre12.cases.find((c) => c.etat === 'du-jour');
    assert.ok(du, 'aucune case « du-jour » dans les données du 12 décembre');
    const dom = await pages.A.evaluer(`[...document.querySelectorAll('.case.du-jour')].map(c => c.dataset.jour)`);
    assert.equal(dom.length, 1, `${dom.length} case(s) du jour à la page, 1 attendue`);
    assert.equal(dom[0], String(du.jour), `case du jour affichée : ${dom[0]}, attendue : ${du.jour}`);
  });

  test('T17 c12 aucune case du jour le 16 novembre', async () => {
    const r = await pages.C.evaluer(`({
      duJour: document.querySelectorAll('.case.du-jour').length,
      fermees: document.querySelectorAll('.case.fermee').length,
    })`);
    assert.equal(r.duJour, 0, `${r.duJour} case(s) du jour le 16 novembre, 0 attendue`);
    assert.equal(r.fermees, 24, `${r.fermees} case(s) fermée(s) le 16 novembre, 24 attendues`);
  });

  test('T18 c13 cases fermées annoncées', async () => {
    const fermees = await pages.A.evaluer(`[...document.querySelectorAll('.case.fermee')].map(c => ({
      jour: c.dataset.jour,
      ariaDisabled: c.getAttribute('aria-disabled'),
      label: c.getAttribute('aria-label'),
    }))`);
    for (const f of fermees) {
      assert.equal(f.ariaDisabled, 'true', `case ${f.jour} : aria-disabled="true" attendu`);
      assert.match(f.label ?? '', /s['’]ouvrira/, `case ${f.jour} : aria-label sans « s'ouvrira » : « ${f.label} »`);
    }
  });

  test('T19 c14 badge « à écrire »', async (t) => {
    const attendus = donnees.decembre12.cases.filter((c) => c.aEcrire === true).map((c) => String(c.jour));
    if (attendus.length === 0) return t.skip('aucune case à écrire dans les données');
    const badges = await pages.A.evaluer(`[...document.querySelectorAll('.case.a-ecrire')].map(c => ({
      jour: c.dataset.jour,
      texte: c.textContent,
      apres: getComputedStyle(c, '::after').content,
      avant: getComputedStyle(c, '::before').content,
    }))`);
    assert.deepEqual(
      badges.map((b) => b.jour).sort(),
      [...attendus].sort(),
      'les cases marquées .a-ecrire ne correspondent pas aux cases aEcrire des données',
    );
    for (const b of badges) {
      const visible = [b.texte, b.apres, b.avant].some((s) => normaliser(s).includes('à écrire'));
      assert.ok(visible, `case ${b.jour} : badge « à écrire » absent du texte visible`);
    }
  });

  test('T20 c15 mot de fin le 26', async (t) => {
    const d = donnees.decembre26;
    if (!d.fini || !d.motDeFin) return t.skip('pas de mot de fin dans les données');
    const r = await pages.D.evaluer(`(() => {
      const el = document.getElementById('mot-de-fin');
      return { visible: ${VISIBLE}(el), texte: el ? el.textContent : null };
    })()`);
    assert.ok(r.visible, '#mot-de-fin doit être visible le 26 décembre');
    assert.equal(normaliser(r.texte), normaliser(d.motDeFin), '#mot-de-fin doit afficher motDeFin');
  });

  test('T21 c15 pas de mot de fin le 12', async () => {
    const visible = await pages.A.evaluer(`(() => ${VISIBLE}(document.getElementById('mot-de-fin')))()`);
    assert.equal(visible, false, '#mot-de-fin ne doit pas être visible le 12 décembre');
  });

  test('T22 c16 bandeau d\'aperçu', async () => {
    const r = await pages.A.evaluer(`(() => {
      const el = document.getElementById('bandeau-apercu');
      return { visible: ${VISIBLE}(el), texte: el ? el.textContent : null };
    })()`);
    assert.ok(r.visible, '#bandeau-apercu doit être visible');
    assert.ok(normaliser(r.texte).includes('date simulée'),
      `#bandeau-apercu doit contenir « date simulée » : « ${normaliser(r.texte)} »`);
  });

  test('T23 c17 contraste des numéros', async () => {
    const resultats = await pages.A.evaluer(`(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgba = (c) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      return [...document.querySelectorAll('.numero')].map(n => {
        let fond = null;
        for (let el = n; el; el = el.parentElement) {
          const p = rgba(getComputedStyle(el).backgroundColor);
          if (p[3] === 255) { fond = p.slice(0, 3); break; }
        }
        return {
          jour: n.closest('.case')?.dataset.jour ?? null,
          fg: rgba(getComputedStyle(n).color).slice(0, 3),
          bg: fond,
        };
      });
    })()`);
    for (const n of resultats) {
      assert.ok(n.bg, `case ${n.jour} : aucun fond opaque trouvé pour le numéro`);
      const ratio = contraste(n.fg, n.bg);
      assert.ok(ratio >= 4.5, `case ${n.jour} : contraste ${ratio.toFixed(2)}:1 (minimum 4.5)`);
    }
  });

  test('T24 c18 indicateur de focus non découpé', async () => {
    await pages.A.touche('Tab');
    for (const { nom, selecteur } of CIBLES_FOCUS) {
      const avant = await pages.A.evaluer(`(() => {
        document.activeElement?.blur();
        return (${SNAPSHOT_FOCUS})(${JSON.stringify(selecteur)});
      })()`);
      assert.ok(avant, `${nom} : élément introuvable (${selecteur})`);
      const focusOk = await pages.A.evaluer(`(() => {
        const b = document.querySelector(${JSON.stringify(selecteur)});
        b.focus();
        return document.activeElement === b;
      })()`);
      assert.ok(focusOk, `${nom} : impossible de donner le focus`);
      await pages.A.attendre(300);
      const apres = await pages.A.evaluer(`(${SNAPSHOT_FOCUS})(${JSON.stringify(selecteur)})`);

      const indique = (s) => (s.outlineStyle !== 'none' && s.outlineWidth !== '0px') || s.boxShadow !== 'none';
      const change = (a, b) => a.outlineStyle !== b.outlineStyle
        || a.outlineWidth !== b.outlineWidth
        || a.boxShadow !== b.boxShadow;
      const candidats = apres.cibles
        .map((c, i) => ({ c, a: avant.cibles[i] }))
        .filter(({ c, a }) => indique(c) && change(c, a));
      assert.ok(candidats.length > 0,
        `${nom} : aucun élément ne montre d'indicateur de focus au focus (outline ou box-shadow)`);

      const propres = candidats.filter(({ c }) => c.clipPath === 'none' && apres.chaine.every((cp) => cp === 'none'));
      assert.ok(propres.length > 0,
        `${nom} : indicateur de focus découpé par clip-path : ${candidats.map(({ c }) => `${c.nom}=${c.clipPath}`).join(', ')} ; chaîne des ancêtres : ${apres.chaine.join(' > ')}`);
    }
  });

  test('T25 c19 mouvement réduit : aucune animation', async () => {
    await pages.E.attendre(1000);
    const animations = await pages.E.evaluer(`document.getAnimations().map(a => {
      const cible = a.effect && a.effect.target;
      return {
        nom: a.animationName || a.transitionProperty || '?',
        cible: cible ? cible.tagName + (cible.id ? '#' + cible.id : '') + (cible.getAttribute && cible.getAttribute('class') ? '.' + cible.getAttribute('class') : '') : '?',
      };
    })`);
    assert.equal(animations.length, 0,
      `animations encore actives en mouvement réduit : ${JSON.stringify(animations)}`);
  });

  test('T26 — aucune erreur JavaScript', async () => {
    for (const [cle, page] of Object.entries(pages)) {
      assert.deepEqual(page.erreurs, [], `page ${cle} : erreur JavaScript`);
    }
  });
});
