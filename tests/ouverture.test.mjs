// Tests de l'ouverture des cases (partie P2) : clic, impact, fenêtre, refus d'une case fermée.
// Lancer : node --test --test-concurrency=1 tests/ouverture.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { navigateurPresent, demarrerApercu, ouvrirPage } from './outils/navigateur.mjs';

const PRESENT = navigateurPresent();
const TIMEOUT_TEST = 30000;
const TIMEOUT_HOOK = 60000;
const PORT = 8111;
const DATE = '2026-12-12';
const ETATS_OUVRABLES = ['ouverte', 'du-jour'];
const ETAT_OUVERT = `document.getElementById('fenetre')?.open === true`;

let serveur = null;
let url = null;
let d = null;

// Texte normalisé : espaces insécables → espace, espaces répétés réduits, trim.
const normaliser = (s) => String(s ?? '')
  .replace(/[  ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const egaux = (a, b) => normaliser(a) === normaliser(b);

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sonde installée dans la page avant le clic : chronomètres et compteurs d'ouverture.
const SONDE = `(() => {
  const s = window.__sonde = { clic: null, impact: null, ouvertures: 0, ouvertA: null, impactVu: false };
  let etaitOuverte = !!document.getElementById('fenetre')?.open;
  document.addEventListener('pointerdown', () => { if (s.clic === null) s.clic = performance.now(); }, true);
  new MutationObserver(() => {
    if (!s.impactVu && document.querySelector('.impact')) { s.impactVu = true; s.impact = performance.now(); }
    const ouverte = !!document.getElementById('fenetre')?.open;
    if (ouverte && !etaitOuverte) {
      s.ouvertures++;
      if (s.ouvertA === null) s.ouvertA = performance.now();
    }
    etaitOuverte = ouverte;
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open'] });
})()`;

// Source JS : vrai si l'animation touche la case, un élément dedans, ou son <li>.
const concerne = (selecteur) => `((a) => {
  const c = document.querySelector(${JSON.stringify(selecteur)});
  const li = c ? c.parentElement : null;
  const cible = a.effect && a.effect.target;
  return !!(cible && c && (cible === c || cible === li || c.contains(cible)));
})`;

async function lireDonnees(adresse) {
  const reponse = await fetch(new URL('donnees.json', adresse));
  if (!reponse.ok) throw new Error(`donnees.json : statut ${reponse.status}`);
  return reponse.json();
}

// Cases ouvertes (ouverte ou du-jour), sans « à écrire », avec un contenu, en ordre de jour.
const casesTriees = () => [...d.cases].sort((a, b) => a.jour - b.jour);
const estOuvrable = (c) => ETATS_OUVRABLES.includes(c.etat) && !c.aEcrire
  && c.contenu !== null && typeof c.contenu === 'object';
const premiereOuvrable = (condition = () => true) =>
  casesTriees().find((c) => estOuvrable(c) && condition(c)) ?? null;

const quizDe = (c) => (Array.isArray(c.contenu?.quiz?.choix) ? c.contenu.quiz : null);
const indexReponse = (quiz) => quiz.choix.findIndex((x) => egaux(x, quiz.reponse));
const indexMauvaise = (quiz) => quiz.choix.findIndex((x) => !egaux(x, quiz.reponse));
const lignes = (texte) => String(texte ?? '').split('\n').map(normaliser).filter((l) => l !== '');
const contientDate = (texte, jour) => new RegExp(`(^|\\D)${jour} décembre`).test(texte);

// Attend qu'un vérificateur renvoie une valeur vraie ; renvoie la dernière valeur à l'échéance.
async function attendreCondition(verifier, ms, pas = 50) {
  const fin = Date.now() + ms;
  for (;;) {
    const valeur = await verifier();
    if (valeur || Date.now() >= fin) return valeur;
    await pause(pas);
  }
}

// Ouvre une page neuve, attend les 24 cases, lance le test, ferme la page dans tous les cas.
async function avecPage(options, fn) {
  const page = await ouvrirPage(url, options);
  try {
    await attendrePrete(page);
    await fn(page);
    assert.deepEqual(page.erreurs, [], `erreurs JavaScript : ${page.erreurs.join(' | ')}`);
  } finally {
    await page.fermer().catch(() => {});
  }
}

async function attendrePrete(page) {
  const fin = Date.now() + 10000;
  let vues = 0;
  while (Date.now() < fin) {
    vues = await page.evaluer(`document.querySelectorAll('#grille .case').length`);
    if (vues === 24) return;
    await page.attendre(100);
  }
  throw new Error(`page non prête : 24 cases attendues après 10 s (${vues} trouvées)`);
}

async function ouvrirCase(page, jour) {
  await page.cliquer(`.case[data-jour="${jour}"]`);
  const ouverte = await attendreCondition(() => page.evaluer(ETAT_OUVERT), 2000);
  assert.ok(ouverte, `case ${jour} : #fenetre toujours fermée 2 s après le clic`);
}

async function premiereFermee(page) {
  return page.evaluer(`document.querySelector('.case.fermee')?.dataset.jour ?? null`);
}

const sonde = (page) => page.evaluer('window.__sonde');

// Marque chaque bouton de #fenetre dont le texte est un choix du quiz : data-sonde-choix = index du choix.
async function marquerChoix(page, quiz) {
  const textes = await page.evaluer(`[...document.querySelectorAll('#fenetre button')].map(b => b.textContent)`);
  const affectations = [];
  textes.forEach((texte, i) => {
    const k = quiz.choix.findIndex((x) => egaux(x, texte));
    if (k !== -1) affectations.push(`b[${i}].dataset.sondeChoix = '${k}'`);
  });
  if (affectations.length > 0) {
    await page.evaluer(`(() => { const b = document.querySelectorAll('#fenetre button'); ${affectations.join('; ')}; })()`);
  }
}

async function lireChoix(page, quiz) {
  await marquerChoix(page, quiz);
  return page.evaluer(`[...document.querySelectorAll('#fenetre [data-sonde-choix]')].map(b => ({
    k: Number(b.dataset.sondeChoix), classes: [...b.classList], disabled: b.disabled }))`);
}

async function etatChoix(page, quiz, k) {
  return (await lireChoix(page, quiz)).find((x) => x.k === k) ?? null;
}

async function cliquerChoix(page, quiz, k) {
  await marquerChoix(page, quiz);
  const trouve = await page.evaluer(`!!document.querySelector('#fenetre [data-sonde-choix="${k}"]')`);
  assert.ok(trouve, `bouton de choix « ${quiz.choix[k]} » introuvable dans #fenetre`);
  await page.cliquer(`#fenetre [data-sonde-choix="${k}"]`);
}

// Attend la fermeture de #fenetre, puis vérifie que le focus est revenu à la case d'origine.
async function verifierFermetureEtFocus(page, jour) {
  const fermee = await attendreCondition(async () => (await page.evaluer(ETAT_OUVERT)) === false, 1000);
  assert.ok(fermee, `#fenetre toujours ouverte 1 s après l'action`);
  const actif = await page.evaluer(`document.activeElement?.dataset.jour ?? null`);
  assert.equal(actif, String(jour), `focus rendu à la case « ${actif} » au lieu de la case ${jour}`);
}

function test(nom, fn) {
  it(nom, { timeout: TIMEOUT_TEST }, async (t) => {
    if (!PRESENT) return t.skip('navigateur absent');
    return fn(t);
  });
}

describe('ouverture et impact (P2)', () => {
  before(async () => {
    if (!PRESENT) return;
    serveur = await demarrerApercu({ date: DATE, port: PORT });
    url = serveur.url;
    d = await lireDonnees(url);
  }, { timeout: TIMEOUT_HOOK });

  after(async () => {
    await serveur?.arreter().catch(() => {});
    serveur = null;
  }, { timeout: TIMEOUT_HOOK });

  test('T1 c1 ouverture d\'une case ouverte', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await page.evaluer(SONDE);
      await page.cliquer(`.case[data-jour="${cas.jour}"]`);
      const ouverte = await attendreCondition(() => page.evaluer(ETAT_OUVERT), 1500);
      assert.ok(ouverte, `case ${cas.jour} : #fenetre toujours fermée 1,5 s après le clic`);
    });
  });

  test('T2 c2 impact visible au clic', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await page.evaluer(SONDE);
      await page.cliquer(`.case[data-jour="${cas.jour}"]`);
      await page.attendre(1500);
      const s = await sonde(page);
      assert.ok(s.clic !== null, 'clic non détecté par la page');
      assert.ok(s.impact !== null, 'aucun élément .impact après le clic');
      assert.ok(s.impact - s.clic <= 300,
        `impact ${(s.impact - s.clic).toFixed(0)} ms après le clic (maximum 300 ms)`);
    });
  });

  test('T3 contrat impact retiré après ouverture', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await page.attendre(1000);
      const impacts = await page.evaluer(`document.querySelectorAll('.impact').length`);
      const ouverte = await page.evaluer(ETAT_OUVERT);
      assert.equal(impacts, 0, `${impacts} élément(s) .impact encore présent(s) 1 s après l'ouverture`);
      assert.ok(ouverte, '#fenetre n\'est plus ouverte 1 s après l\'ouverture');
    });
  });

  test('T4 c3 nom de l\'anime', async (t) => {
    const cas = premiereOuvrable((c) => Boolean(c.contenu.anime));
    if (!cas) return t.skip('aucune case ouvrable avec contenu.anime');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const texte = await page.evaluer(`document.querySelector('#fenetre .fenetre-anime')?.textContent ?? null`);
      assert.notEqual(texte, null, '#fenetre .fenetre-anime introuvable');
      assert.equal(normaliser(texte), normaliser(cas.contenu.anime),
        `nom de l'anime affiché « ${normaliser(texte)} » au lieu de « ${cas.contenu.anime} »`);
    });
  });

  test('T5 c4 nom de l\'anime en grand', async (t) => {
    const cas = premiereOuvrable((c) => Boolean(c.contenu.anime));
    if (!cas) return t.skip('aucune case ouvrable avec contenu.anime');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const taille = await page.evaluer(`(() => {
        const el = document.querySelector('#fenetre .fenetre-anime');
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      })()`);
      assert.notEqual(taille, null, '#fenetre .fenetre-anime introuvable');
      assert.ok(taille >= 28, `taille du nom de l'anime : ${taille} px (minimum 28 px)`);
    });
  });

  test('T6 c5 titre de la case', async (t) => {
    const cas = premiereOuvrable((c) => Boolean(c.contenu.titre));
    if (!cas) return t.skip('aucune case ouvrable avec contenu.titre');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const texte = await page.evaluer(`document.getElementById('fenetre-titre')?.textContent ?? null`);
      assert.notEqual(texte, null, '#fenetre-titre introuvable');
      assert.equal(normaliser(texte), normaliser(cas.contenu.titre),
        `titre affiché « ${normaliser(texte)} » au lieu de « ${cas.contenu.titre} »`);
    });
  });

  test('T7 c6 un paragraphe par ligne', async (t) => {
    const cas = premiereOuvrable((c) => lignes(c.contenu.texte).length > 0 && !c.contenu.quiz)
      ?? premiereOuvrable((c) => lignes(c.contenu.texte).length > 0);
    if (!cas) return t.skip('aucune case ouvrable avec contenu.texte');
    const attendu = lignes(cas.contenu.texte);
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const paras = await page.evaluer(`[...document.querySelectorAll('#fenetre-corps p')].map(p => p.textContent)`);
      const textes = paras.map(normaliser);
      const suiteContigue = textes.some((_, i) => i + attendu.length <= textes.length
        && attendu.every((ligne, j) => textes[i + j] === ligne));
      assert.ok(suiteContigue,
        `#fenetre-corps : paragraphes « ${textes.join(' / ')} » ne contiennent pas les lignes attendues « ${attendu.join(' / ')} » dans l'ordre`);
      const correspondants = textes.filter((t) => attendu.includes(t)).length;
      assert.equal(correspondants, attendu.length,
        `${correspondants} paragraphe(s) correspondant aux lignes, ${attendu.length} attendu(s)`);
    });
  });

  test('T8 c7 mauvaise réponse marquée', async (t) => {
    const cas = premiereOuvrable((c) => {
      const q = quizDe(c);
      return q !== null && indexMauvaise(q) !== -1;
    });
    if (!cas) return t.skip('aucune case ouvrable avec un quiz');
    const quiz = cas.contenu.quiz;
    const k = indexMauvaise(quiz);
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await cliquerChoix(page, quiz, k);
      const marquee = await attendreCondition(
        async () => (await etatChoix(page, quiz, k))?.classes.includes('fausse') === true, 500);
      assert.ok(marquee, `choix « ${quiz.choix[k]} » sans classe « fausse » 500 ms après le clic`);
    });
  });

  test('T9 c8 bonne réponse révélée après une erreur', async (t) => {
    const cas = premiereOuvrable((c) => {
      const q = quizDe(c);
      return q !== null && indexMauvaise(q) !== -1;
    });
    if (!cas) return t.skip('aucune case ouvrable avec un quiz');
    const quiz = cas.contenu.quiz;
    const bonne = indexReponse(quiz);
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await cliquerChoix(page, quiz, indexMauvaise(quiz));
      assert.notEqual(bonne, -1, `la réponse « ${quiz.reponse} » ne figure pas parmi les choix`);
      const revelee = await attendreCondition(
        async () => (await etatChoix(page, quiz, bonne))?.classes.includes('bonne') === true, 500);
      assert.ok(revelee, `bonne réponse « ${quiz.choix[bonne]} » sans classe « bonne » après une erreur`);
    });
  });

  test('T10 c8 bonne réponse choisie', async (t) => {
    const cas = premiereOuvrable((c) => quizDe(c) !== null);
    if (!cas) return t.skip('aucune case ouvrable avec un quiz');
    const quiz = cas.contenu.quiz;
    const bonne = indexReponse(quiz);
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      assert.notEqual(bonne, -1, `la réponse « ${quiz.reponse} » ne figure pas parmi les choix`);
      await cliquerChoix(page, quiz, bonne);
      const etat = await attendreCondition(async () => {
        const e = await etatChoix(page, quiz, bonne);
        return e?.classes.includes('bonne') ? e : null;
      }, 500);
      assert.ok(etat, `bonne réponse « ${quiz.choix[bonne]} » sans classe « bonne » après le choix`);
      assert.ok(!etat.classes.includes('fausse'), `bonne réponse marquée « fausse »`);
    });
  });

  test('T11 c9 choix verrouillés', async (t) => {
    const cas = premiereOuvrable((c) => quizDe(c) !== null);
    if (!cas) return t.skip('aucune case ouvrable avec un quiz');
    const quiz = cas.contenu.quiz;
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await cliquerChoix(page, quiz, 0);
      const verrouilles = await attendreCondition(async () => {
        const etats = await lireChoix(page, quiz);
        return etats.length > 0 && etats.every((e) => e.disabled === true);
      }, 500);
      const etats = await lireChoix(page, quiz);
      assert.ok(etats.length > 0, 'aucun bouton de choix dans #fenetre');
      assert.ok(verrouilles,
        `boutons de choix non désactivés après un choix : ${etats.map((e) => `${e.k}=${e.disabled}`).join(', ')}`);
    });
  });

  test('T12 c10 lien sûr', async (t) => {
    const cas = premiereOuvrable((c) => Boolean(c.contenu.lien));
    if (!cas) return t.skip('aucune case ouvrable avec contenu.lien');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const liens = await page.evaluer(`[...document.querySelectorAll('#fenetre a')].map(a => ({
        href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }))`);
      const sur = liens.some((l) => l.href === cas.contenu.lien.url
        && l.target === '_blank'
        && (l.rel ?? '').includes('noopener'));
      assert.ok(sur,
        `aucun lien sûr vers « ${cas.contenu.lien.url} » (target _blank, rel noopener) ; liens trouvés : ${JSON.stringify(liens)}`);
    });
  });

  test('T13 c11 case fermée refusée', async (t) => {
    await avecPage({}, async (page) => {
      const jour = await premiereFermee(page);
      if (jour === null) return t.skip('aucune case fermée à la page');
      await page.cliquer(`.case[data-jour="${jour}"]`);
      await page.attendre(1500);
      const ouverte = await page.evaluer(ETAT_OUVERT);
      assert.ok(!ouverte, `#fenetre ouverte après un clic sur la case fermée ${jour}`);
    });
  });

  test('T14 c12 le talisman tremble', async (t) => {
    await avecPage({}, async (page) => {
      const jour = await premiereFermee(page);
      if (jour === null) return t.skip('aucune case fermée à la page');
      const selecteur = `.case[data-jour="${jour}"]`;
      await page.evaluer(`window.__avant = document.getAnimations().filter(${concerne(selecteur)})`);
      await page.cliquer(selecteur);
      const nouvelle = await attendreCondition(() => page.evaluer(
        `document.getAnimations().some(a => !window.__avant.includes(a) && ${concerne(selecteur)}(a))`),
      800, 30);
      assert.ok(nouvelle, `case ${jour} : aucune animation démarrée sur la case dans les 800 ms`);
    });
  });

  test('T15 c13 date dans la réplique', async (t) => {
    await avecPage({}, async (page) => {
      const jour = await premiereFermee(page);
      if (jour === null) return t.skip('aucune case fermée à la page');
      await page.cliquer(`.case[data-jour="${jour}"]`);
      await page.attendre(300);
      const message = normaliser(await page.evaluer(`document.getElementById('message')?.textContent ?? null`));
      assert.ok(contientDate(message, jour), `#message : « ${message} » ne contient pas « ${jour} décembre »`);
    });
  });

  test('T16 c14 répliques variées', async (t) => {
    await avecPage({}, async (page) => {
      const jour = await premiereFermee(page);
      if (jour === null) return t.skip('aucune case fermée à la page');
      const selecteur = `.case[data-jour="${jour}"]`;
      const textes = [];
      for (let i = 0; i < 5; i++) {
        await page.cliquer(selecteur);
        await page.attendre(400);
        textes.push(normaliser(await page.evaluer(`document.getElementById('message')?.textContent ?? null`)));
      }
      const distincts = new Set(textes).size;
      assert.ok(distincts >= 2, `${distincts} réplique(s) distincte(s) sur 5 clics (minimum 2) : ${JSON.stringify(textes)}`);
      const sansDate = textes.filter((x) => !contientDate(x, jour));
      assert.equal(sansDate.length, 0, `répliques sans « ${jour} décembre » : ${JSON.stringify(sansDate)}`);
    });
  });

  test('T17 c15 double clic sans double ouverture', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    const selecteur = `.case[data-jour="${cas.jour}"]`;
    await avecPage({}, async (page) => {
      await page.evaluer(SONDE);
      await page.cliquer(selecteur);
      await page.attendre(50);
      try {
        await page.cliquer(selecteur);
      } catch { /* case recouverte ou absente : le second clic est ignoré */ }
      await page.attendre(1500);
      const ouverte = await page.evaluer(ETAT_OUVERT);
      const s = await sonde(page);
      assert.ok(ouverte, '#fenetre fermée après le double clic');
      assert.equal(s.ouvertures, 1, `${s.ouvertures} ouverture(s) de #fenetre après le double clic (1 attendue)`);
      assert.deepEqual(page.erreurs, [], `erreurs JavaScript : ${page.erreurs.join(' | ')}`);
    });
  });

  test('T18 c15 clic sur la case pendant que la fenêtre est ouverte', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await page.evaluer(SONDE);
      await ouvrirCase(page, cas.jour);
      await page.evaluer('window.__sonde.ouvertures = 0');
      await page.evaluer(`document.querySelector('.case[data-jour="${cas.jour}"]').click()`);
      await page.attendre(1500);
      const ouverte = await page.evaluer(ETAT_OUVERT);
      const s = await sonde(page);
      assert.ok(ouverte, '#fenetre fermée après un clic sur la case pendant l\'ouverture');
      assert.equal(s.ouvertures, 0, `${s.ouvertures} nouvelle(s) ouverture(s) pendant que la fenêtre est ouverte (0 attendue)`);
      assert.deepEqual(page.erreurs, [], `erreurs JavaScript : ${page.erreurs.join(' | ')}`);
    });
  });

  test('T19 c16 Échap ferme et rend le focus', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await page.touche('Escape');
      await verifierFermetureEtFocus(page, cas.jour);
    });
  });

  test('T20 c16 bouton fermer', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      await page.cliquer('#fermer');
      await verifierFermetureEtFocus(page, cas.jour);
    });
  });

  test('T21 c16 clic sur le fond', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const coin = await page.evaluer(`(() => {
        const r = document.getElementById('fenetre')?.getBoundingClientRect();
        return !!r && 3 >= r.left && 3 <= r.right && 3 >= r.top && 3 <= r.bottom;
      })()`);
      if (coin) return t.skip('la fenêtre couvre le coin');
      await page.evaluer(`(() => {
        const d = document.createElement('div');
        d.id = 'sonde-fond';
        d.setAttribute('style', 'position:fixed;left:0;top:0;width:6px;height:6px;pointer-events:none');
        document.body.append(d);
      })()`);
      await page.cliquer('#sonde-fond');
      await verifierFermetureEtFocus(page, cas.jour);
    });
  });

  test('T22 c17 mouvement réduit : ouverture immédiate', async (t) => {
    const cas = premiereOuvrable();
    if (!cas) return t.skip('aucune case ouvrable dans les données');
    await avecPage({ mouvementReduit: true }, async (page) => {
      await page.evaluer(SONDE);
      await page.cliquer(`.case[data-jour="${cas.jour}"]`);
      await page.attendre(1000);
      const s = await sonde(page);
      assert.ok(s.clic !== null, 'clic non détecté par la page');
      assert.ok(s.ouvertA !== null, '#fenetre non ouverte 1 s après le clic (mouvement réduit)');
      assert.ok(s.ouvertA - s.clic <= 150,
        `ouverture ${(s.ouvertA - s.clic).toFixed(0)} ms après le clic (maximum 150 ms en mouvement réduit)`);
      assert.equal(s.impactVu, false, 'un élément .impact est apparu en mouvement réduit');
    });
  });

  test('T23 c18 case à écrire', async (t) => {
    const cas = casesTriees().find((c) => ETATS_OUVRABLES.includes(c.etat) && c.aEcrire === true);
    if (!cas) return t.skip('aucune case ouverte à écrire');
    await avecPage({}, async (page) => {
      await ouvrirCase(page, cas.jour);
      const texte = normaliser(await page.evaluer(`document.getElementById('fenetre')?.textContent ?? null`));
      assert.ok(texte.includes('pas encore de contenu'),
        `#fenetre ne contient pas « pas encore de contenu » : « ${texte} »`);
    });
  });
});
