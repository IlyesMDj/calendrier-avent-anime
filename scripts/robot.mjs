// Un passage du robot (lancé par GitHub Actions toutes les 5 minutes, à la main, ou après un envoi).
// 1. Fabrique le site tel qu'il doit être maintenant (cases dues seulement).
// 2. Compare avec ce qui est en ligne grâce à l'empreinte.
// 3. Décide : publier, ou rien à faire. Le résultat ne dépend que de l'heure :
//    deux passages de suite n'ouvrent rien de plus, un passage sauté est rattrapé au suivant.
// 4. Écrit le journal : heure, mode, cases ouvertes. Jamais le texte d'une case.

import { appendFileSync } from 'node:fs';
import { construire } from './construire.mjs';

const DECLENCHEURS = {
  schedule: 'passage planifié',
  workflow_dispatch: 'lancement à la main',
  push: 'envoi sur GitHub',
};

const maintenant = new Date();
const paris = maintenant.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'medium' });
const utc = maintenant.toISOString().slice(11, 19);
const declencheur = DECLENCHEURS[process.env.GITHUB_EVENT_NAME] ?? 'essai local';

const r = await construire({ maintenant });
const d = r.donnees;

// Ce qui est en ligne en ce moment (le paramètre évite une copie en cache).
let enLigne = null;
const adresse = (process.env.ADRESSE_SITE ?? '').replace(/\/$/, '');
if (adresse) {
  try {
    const rep = await fetch(`${adresse}/donnees.json?robot=${maintenant.getTime()}`, { cache: 'no-store' });
    if (rep.ok) enLigne = await rep.json();
  } catch { /* site absent ou injoignable : on publie */ }
}

const ouvertes = d.cases.filter((c) => c.etat !== 'fermee').map((c) => c.jour);
const avant = new Set((enLigne?.cases ?? []).filter((c) => c.etat !== 'fermee').map((c) => c.jour));
const nouvelles = ouvertes.filter((j) => !avant.has(j));
const refermees = [...avant].filter((j) => !ouvertes.includes(j));
const duJour = d.cases.find((c) => c.etat === 'du-jour')?.jour;
const publier = !enLigne || enLigne.empreinte !== d.empreinte;

const liste = (t) => (t.length ? t.join(', ') : 'aucune');
const journal = [
  ['Heure', `${paris} à Paris (${utc} UTC)`],
  ['Déclencheur', declencheur],
  ['Mode', d.rythme],
  ['Cases ouvertes', `${ouvertes.length}/24 : ${liste(ouvertes)}`],
  ['Case du jour', duJour ? String(duJour) : (d.fini ? 'aucune, calendrier terminé' : 'aucune')],
  ['Nouvelle(s) case(s) ouverte(s)', liste(nouvelles)],
  ...(refermees.length ? [['Case(s) refermée(s)', liste(refermees)]] : []),
  ['Affiches trouvées', `${d.cases.filter((c) => c.contenu?.affiche).length}/${ouvertes.length}`],
  ['Version du code', d.version],
  ['Décision', publier ? `publication (empreinte ${d.empreinte})` : 'rien à publier, le site en ligne est déjà à jour'],
];
const aEcrireOuvertes = d.cases.filter((c) => c.aEcrire).map((c) => c.jour);
if (aEcrireOuvertes.length) journal.push(['Attention', `case(s) ouverte(s) sans contenu : ${liste(aEcrireOuvertes)}`]);

for (const [cle, valeur] of journal) console.log(`${cle} : ${valeur}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const tableau = ['### Journal du robot', '', '| | |', '|---|---|', ...journal.map(([c, v]) => `| ${c} | ${v} |`), ''].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, tableau + '\n');
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `publier=${publier}\n`);
}
