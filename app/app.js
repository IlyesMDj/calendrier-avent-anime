// La page ne calcule rien de secret : elle affiche ce que le robot a publié dans donnees.json.
// Une case fermée n'y figure qu'avec son numéro et son heure d'ouverture.

const ICONES = {
  ouverte: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'du-jour': '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.4 3.8 13.8l1-4.6L1.3 6l4.7-.5z" fill="currentColor"/></svg>',
  fermee: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 015.6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

const MOTS = { ouverte: 'Ouverte', 'du-jour': 'Aujourd\'hui', fermee: 'Pas encore' };

const formatJour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const formatComplet = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const $ = (id) => document.getElementById(id);

const formatDate = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

function memeJourParis(a, b) {
  return formatDate.format(a) === formatDate.format(b);
}

/** « le 13 déc. » ou, si c'est aujourd'hui, « à 21:35 ». */
function quandCourt(ouverture, maintenant) {
  return memeJourParis(ouverture, maintenant) ? `à ${formatHeure.format(ouverture)}` : `le ${formatJour.format(ouverture)}`;
}

function quandLong(ouverture) {
  return `${formatComplet.format(ouverture)} (heure de Paris)`;
}

function annoncer(texte) {
  $('message').textContent = texte;
}

function creerCase(c, maintenant) {
  const li = document.createElement('li');
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = `case ${c.etat}${c.aEcrire ? ' a-ecrire' : ''}`;
  bouton.dataset.jour = c.jour;

  const icone = document.createElement('span');
  icone.className = 'icone';
  icone.innerHTML = ICONES[c.etat];

  const numero = document.createElement('span');
  numero.className = 'numero';
  numero.textContent = c.jour;

  const etiquette = document.createElement('span');
  etiquette.className = 'etiquette';
  const ouverture = new Date(c.ouverture);
  etiquette.textContent = c.etat === 'fermee' ? quandCourt(ouverture, maintenant) : MOTS[c.etat];

  bouton.append(icone, numero, etiquette);

  if (c.etat === 'fermee') {
    bouton.setAttribute('aria-disabled', 'true');
    bouton.setAttribute('aria-label', `Case ${c.jour}, pas encore disponible. Elle s'ouvrira ${quandLong(ouverture)}.`);
    bouton.addEventListener('click', () => annoncer(`La case ${c.jour} n'est pas encore disponible. Elle s'ouvrira ${quandLong(ouverture)}.`));
  } else {
    const mot = c.etat === 'du-jour' ? 'case du jour' : 'ouverte';
    bouton.setAttribute('aria-label', `Case ${c.jour}, ${mot}${c.aEcrire ? ', contenu à écrire' : ''}.`);
    bouton.addEventListener('click', () => ouvrirCase(c));
  }

  li.append(bouton);
  return li;
}

function ouvrirCase(c) {
  annoncer(c.aEcrire ? `La case ${c.jour} n'a pas encore de contenu.` : `Case ${c.jour} : ${c.contenu.titre ?? ''}`);
}

function afficher(d) {
  const maintenant = new Date(d.apercu?.date ?? Date.now());
  document.title = d.titre;
  $('titre').textContent = d.titre;
  $('sous-titre').textContent = d.sousTitre ?? '';

  if (d.apercu) {
    $('bandeau-apercu').hidden = false;
    $('bandeau-apercu').textContent = `Aperçu local, date simulée : ${quandLong(maintenant)}`;
  }

  $('grille').replaceChildren(...d.cases.map((c) => creerCase(c, maintenant)));

  const pied = [`Cases ouvertes chaque jour à ${d.heureOuverture}, heure de Paris`];
  pied.push(`version ${d.version}`);
  pied.push(`mis à jour le ${formatComplet.format(new Date(d.genereLe))}`);
  $('pied').textContent = pied.join(' · ');
}

// Les pictogrammes de la légende.
for (const el of document.querySelectorAll('[data-icone]')) el.innerHTML = ICONES[el.dataset.icone];

fetch('donnees.json', { cache: 'no-store' })
  .then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  })
  .then(afficher)
  .catch(() => annoncer('Le calendrier n\'a pas pu se charger. Rechargez la page dans un instant.'));
