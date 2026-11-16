// Tout ce qui touche aux dates. Le calendrier compte en heure de Paris,
// quel que soit le fuseau de l'ordinateur (ou du robot GitHub, qui est en UTC).

const PARIS = 'Europe/Paris';

const lecteur = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Ce qu'affiche une horloge de Paris à cet instant. */
export function heureDeParis(instant) {
  const p = {};
  for (const morceau of lecteur.formatToParts(instant)) {
    if (morceau.type !== 'literal') p[morceau.type] = Number(morceau.value);
  }
  return { annee: p.year, mois: p.month, jour: p.day, heure: p.hour, minute: p.minute, seconde: p.second };
}

/** L'instant exact où une horloge de Paris affiche cette date et cette heure. */
export function instantDeParis(annee, mois, jour, heure = 0, minute = 0) {
  const voulu = Date.UTC(annee, mois - 1, jour, heure, minute);
  let t = voulu;
  for (let i = 0; i < 3; i++) {
    const p = heureDeParis(new Date(t));
    const vu = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
    if (vu === voulu) break;
    t -= vu - voulu;
  }
  return new Date(t);
}

/**
 * Lit une date donnée à la main pour l'aperçu :
 * "2026-12-12" (midi à Paris), "2026-12-12T08:30" (heure de Paris), ou une date ISO complète.
 */
export function lireDate(texte) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(texte.trim());
  if (m) {
    const [, a, mo, j, h, mi] = m.map(Number);
    return m[4] ? instantDeParis(a, mo, j, h, mi) : instantDeParis(a, mo, j, 12, 0);
  }
  const d = new Date(texte);
  if (Number.isNaN(d.getTime())) throw new Error(`Date illisible : « ${texte} ». Exemple : 2026-12-12`);
  return d;
}

/**
 * Le cœur du calendrier : à partir des réglages et de l'instant présent,
 * dit quelles cases sont ouvertes et laquelle est la case du jour.
 * Aucun état n'est gardé d'un passage à l'autre : le résultat ne dépend que de l'heure.
 */
export function calculerEtat(reglages, maintenant) {
  const mode = reglages.mode ?? 'normal';
  const annee = reglages.annee;
  let ouvertures;
  let fin;

  if (mode === 'soiree') {
    // Mode soirée : une case toutes les N minutes, dans l'ordre, à partir de l'instant de départ.
    const depart = new Date(reglages.soiree?.depart);
    const minutes = Number(reglages.soiree?.minutesEntreCases ?? 5);
    if (Number.isNaN(depart.getTime())) throw new Error('Mode soirée : « soiree.depart » est absent ou illisible dans calendrier.json.');
    if (!(minutes >= 1)) throw new Error('Mode soirée : « soiree.minutesEntreCases » doit valoir au moins 1.');
    ouvertures = Array.from({ length: 24 }, (_, i) => new Date(depart.getTime() + i * minutes * 60000));
    fin = new Date(depart.getTime() + 24 * minutes * 60000);
  } else if (mode === 'normal') {
    const [hh, mm] = (reglages.heureOuverture ?? '00:00').split(':').map(Number);
    ouvertures = Array.from({ length: 24 }, (_, i) => instantDeParis(annee, 12, i + 1, hh, mm));
    fin = instantDeParis(annee, 12, 25, hh, mm);
  } else {
    throw new Error(`Mode inconnu dans calendrier.json : « ${mode} » (attendu : normal ou soiree).`);
  }

  const ouverte = ouvertures.map((o) => maintenant >= o);
  const fini = maintenant >= fin;

  // Au plus une case du jour, et aucune avant la première ouverture ni après la dernière.
  let duJour = null;
  if (!fini) {
    if (mode === 'soiree') {
      const derniere = ouverte.lastIndexOf(true);
      if (derniere >= 0) duJour = derniere + 1;
    } else {
      const p = heureDeParis(maintenant);
      if (p.annee === annee && p.mois === 12 && p.jour >= 1 && p.jour <= 24 && ouverte[p.jour - 1]) {
        duJour = p.jour;
      }
    }
  }
  return { mode, ouvertures, ouverte, fini, fin, duJour };
}
