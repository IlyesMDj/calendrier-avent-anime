// Fabrique le site à publier dans le dossier _site/.
// La page ne reçoit que le contenu des cases déjà ouvertes : une case future
// n'est jamais envoyée au navigateur, même cachée.
//
//   node scripts/construire.mjs                    -> le site tel qu'il doit être maintenant
//   node scripts/construire.mjs --date 2026-12-12  -> le site tel qu'il sera le 12 décembre (sur ton ordinateur seulement)

import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculerEtat, lireDate } from './temps.mjs';
import { FICHIER_CLAIR, FICHIER_CHIFFRE, lireCle, dechiffrer } from './chiffrer.mjs';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function lireJson(relatif) {
  return JSON.parse(await readFile(path.join(racine, relatif), 'utf8'));
}

/**
 * Les 24 textes. Sur ton ordinateur : contenu/cases.json, en clair, jamais sauvegardé.
 * Chez le robot : contenu/cases.chiffre.json, ouvert avec le secret CLE_CALENDRIER.
 */
async function lireContenus(problemes) {
  const clair = path.join(racine, FICHIER_CLAIR);
  const chiffre = path.join(racine, FICHIER_CHIFFRE);
  let texte;
  if (existsSync(clair)) {
    texte = await readFile(clair, 'utf8');
    if (existsSync(chiffre)) {
      const cle = lireCle(racine);
      let aJour = false;
      try {
        aJour = cle && dechiffrer(JSON.parse(await readFile(chiffre, 'utf8')), cle) === texte;
      } catch { /* clé différente ou fichier abîmé : signalé juste après */ }
      if (!aJour) problemes.push('les textes ont changé depuis le dernier chiffrement : lance « npm run chiffrer » avant de sauvegarder');
    }
  } else if (existsSync(chiffre)) {
    const cle = lireCle(racine);
    if (!cle) throw new Error('Clé absente : ni secret CLE_CALENDRIER, ni fichier .cle. Le site n\'est pas fabriqué.');
    texte = dechiffrer(JSON.parse(await readFile(chiffre, 'utf8')), cle);
  } else {
    return [];
  }
  let brut;
  try {
    brut = JSON.parse(texte);
  } catch {
    // Message volontairement vague : l'erreur de JSON citerait un morceau des textes dans le journal public.
    throw new Error('Les textes des cases sont illisibles (JSON invalide). Vérifie contenu/cases.json puis relance npm run chiffrer.');
  }
  return Array.isArray(brut) ? brut : brut.cases ?? [];
}

function aDuContenu(c) {
  return Boolean(c && (c.titre?.trim() || c.texte?.trim() || c.quiz || c.lien));
}

/** Ne garde que les champs connus, pour ne rien envoyer par accident. */
function nettoyer(c) {
  const propre = {};
  if (c.anime) propre.anime = String(c.anime);
  if (c.illustration) propre.illustration = String(c.illustration).slice(0, 24);
  if (c.titre) propre.titre = String(c.titre);
  if (c.texte) propre.texte = String(c.texte);
  if (c.lien?.url && /^https?:\/\//.test(c.lien.url)) {
    propre.lien = { url: String(c.lien.url), libelle: String(c.lien.libelle ?? c.lien.url) };
  }
  if (c.quiz?.question && Array.isArray(c.quiz.choix)) {
    propre.quiz = {
      question: String(c.quiz.question),
      choix: c.quiz.choix.map(String),
      reponse: String(c.quiz.reponse ?? ''),
      explication: c.quiz.explication ? String(c.quiz.explication) : undefined,
    };
  }
  return propre;
}

/**
 * Fiche de chaque case OUVERTE (épisodes, année, studio, note), demandée à l'API AniList
 * en une seule requête. Les cases fermées ne sont jamais demandées, et aucune image n'est prise.
 * Chez le robot seulement (ou avec FICHES=1 sur ton ordinateur).
 */
async function ajouterFiches(cases, parJour) {
  const ouvertes = cases.filter((c) => c.contenu && Number.isInteger(parJour.get(c.jour)?.mal));
  if (!ouvertes.length) return;
  const ids = ouvertes.map((c) => parJour.get(c.jour).mal);
  const query = 'query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal format status episodes seasonYear averageScore siteUrl studios(isMain:true){nodes{name}}}}}';
  try {
    const rep = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!rep.ok) return;
    const media = (await rep.json())?.data?.Page?.media ?? [];
    const parMal = new Map(media.map((m) => [m.idMal, m]));
    for (const c of ouvertes) {
      const m = parMal.get(parJour.get(c.jour).mal);
      if (!m) continue;
      const fiche = {};
      if (m.format === 'MOVIE') fiche.format = 'film';
      else if (Number.isInteger(m.episodes)) fiche.episodes = m.episodes;
      else if (m.status === 'RELEASING') fiche.format = 'en cours';
      if (Number.isInteger(m.seasonYear)) fiche.annee = m.seasonYear;
      if (m.studios?.nodes?.[0]?.name) fiche.studio = String(m.studios.nodes[0].name).slice(0, 60);
      if (Number.isInteger(m.averageScore)) fiche.note = m.averageScore;
      if (typeof m.siteUrl === 'string' && m.siteUrl.startsWith('https://anilist.co/anime/')) fiche.url = m.siteUrl;
      c.contenu.fiche = fiche;
    }
  } catch { /* AniList indisponible : la case s'affiche sans fiche */ }
}

function versionDuCode() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: racine, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const modifie = execSync('git status --porcelain', { cwd: racine, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return modifie ? `${sha} + modifications non sauvegardées` : sha;
  } catch {
    return 'inconnue';
  }
}

/**
 * Calcule ce que reçoit le visiteur à l'instant donné.
 * apercu = true : aperçu local, qui signale aussi les cases futures encore vides.
 */
export async function preparerDonnees({ maintenant = new Date(), apercu = false, mode = null } = {}) {
  const reglages = await lireJson('calendrier.json');
  if (mode) reglages.mode = mode; // aperçu local seulement (refusé chez le robot)
  const problemes = [];
  const contenus = await lireContenus(problemes);

  const parJour = new Map();
  for (const c of contenus) {
    if (!Number.isInteger(c.jour) || c.jour < 1 || c.jour > 24) {
      problemes.push(`une case a un jour invalide : ${JSON.stringify(c.jour)}`);
      continue;
    }
    if (parJour.has(c.jour)) problemes.push(`le jour ${c.jour} est en double`);
    parJour.set(c.jour, c);
  }

  const etat = calculerEtat(reglages, maintenant);
  const aEcrire = [];
  const cases = [];
  for (let n = 1; n <= 24; n++) {
    const source = parJour.get(n);
    const vide = !aDuContenu(source);
    if (vide) aEcrire.push(n);
    const ouverture = etat.ouvertures[n - 1].toISOString();

    if (etat.ouverte[n - 1]) {
      const c = { jour: n, etat: n === etat.duJour ? 'du-jour' : 'ouverte', ouverture };
      if (vide) c.aEcrire = true;
      else c.contenu = nettoyer(source);
      cases.push(c);
    } else {
      // Case fermée : seulement son numéro et son heure d'ouverture. Aucun texte.
      const c = { jour: n, etat: 'fermee', ouverture };
      if (apercu && vide) c.aEcrire = true;
      cases.push(c);
    }
  }

  if (process.env.GITHUB_ACTIONS === 'true' || process.env.FICHES === '1') await ajouterFiches(cases, parJour);

  const donnees = {
    titre: reglages.titre,
    sousTitre: reglages.sousTitre,
    annee: reglages.annee,
    heureOuverture: reglages.heureOuverture,
    mode: etat.mode,
    rythme: etat.mode === 'soiree'
      ? `Mode soirée : une case toutes les ${reglages.soiree.minutesEntreCases ?? 5} minutes`
      : `Une case par jour à ${reglages.heureOuverture ?? '00:00'}, heure de Paris`,
    fini: etat.fini,
    // Après le 24 : toutes les cases restent ouvertes, avec un mot de fin.
    ...(etat.fini ? { motDeFin: reglages.motDeFin } : {}),
    version: versionDuCode(),
    cases,
  };
  // L'empreinte résume ce que voit le visiteur (hors date de fabrication) :
  // si elle n'a pas changé, le robot n'a rien à republier.
  donnees.empreinte = createHash('sha256').update(JSON.stringify(donnees)).digest('hex').slice(0, 16);
  donnees.genereLe = maintenant.toISOString();
  if (apercu) donnees.apercu = { date: maintenant.toISOString() };

  return { donnees, aEcrire, problemes };
}

/** Écrit le site complet dans le dossier de sortie. */
export async function construire({ maintenant = new Date(), sortie = "_site", apercu = false, mode = null } = {}) {
  const resultat = await preparerDonnees({ maintenant, apercu, mode });
  const dossier = path.join(racine, sortie);
  await rm(dossier, { recursive: true, force: true });
  await mkdir(dossier, { recursive: true });
  await cp(path.join(racine, 'app'), dossier, { recursive: true });
  await writeFile(path.join(dossier, 'donnees.json'), JSON.stringify(resultat.donnees, null, 2));
  return { ...resultat, dossier };
}

export function lireArguments(argv) {
  const args = { date: null, apercu: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--date') args.date = argv[++i];
    else if (argv[i] === '--apercu') args.apercu = true;
    else if (argv[i] === '--port') args.port = Number(argv[++i]);
    else if (argv[i] === '--mode') args.mode = argv[++i];
  }
  if ((args.date || args.mode) && process.env.CI) {
    // Le robot ne choisit jamais sa date ni son mode : il prend l'heure réelle et calendrier.json.
    throw new Error('--date et --mode sont réservés à l\'aperçu sur ton ordinateur, pas au robot.');
  }
  return args;
}

export function resumer({ donnees, aEcrire, problemes }) {
  const ouvertes = donnees.cases.filter((c) => c.etat !== 'fermee').map((c) => c.jour);
  const duJour = donnees.cases.find((c) => c.etat === 'du-jour')?.jour ?? 'aucune';
  console.log(`Cases ouvertes : ${ouvertes.length ? ouvertes.join(', ') : 'aucune'} | case du jour : ${duJour}${donnees.fini ? ' | calendrier terminé' : ''}`);
  if (aEcrire.length) console.warn(`Attention, cases sans contenu : ${aEcrire.join(', ')}`);
  for (const p of problemes) console.warn(`Attention, ${p}`);
}

const lanceDirectement = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (lanceDirectement) {
  const args = lireArguments(process.argv.slice(2));
  const maintenant = args.date ? lireDate(args.date) : new Date();
  const r = await construire({ maintenant, apercu: args.apercu, mode: args.mode });
  console.log(`Site fabriqué dans ${path.relative(racine, r.dossier)}/ pour le ${maintenant.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (heure de Paris)`);
  resumer(r);
}
