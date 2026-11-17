// La page ne calcule rien de secret : elle affiche ce que le robot a publié dans donnees.json.
// Une case fermée n'y figure qu'avec son numéro et son heure d'ouverture.

const ICONES = {
  ouverte: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'du-jour': '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.4 3.8 13.8l1-4.6L1.3 6l4.7-.5z" fill="currentColor"/></svg>',
  fermee: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 015.6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

const MOTS = { ouverte: 'Ouverte', 'du-jour': 'Aujourd\'hui', fermee: 'Pas encore' };

// Répliques d'une case fermée, tirées au hasard (jamais deux fois de suite la même).
// {date} est remplacé par la date d'ouverture de la case, par exemple « 13 décembre ».
// Ajoutez, retirez ou réécrivez des lignes librement : gardez {date} dans chacune.
const REPLIQUES_FERMEES = [
  'Ton niveau de puissance est insuffisant. Reviens le {date}.',
  'Ce sceau tient bon jusqu\'au {date}. Même hurler pendant trois épisodes n\'y changera rien.',
  'Le prochain épisode sort le {date}. Pas de fuite, pas de spoiler, pas de chance.',
  'Arc de remplissage en cours : il ne se passe rien. Le vrai épisode arrive le {date}.',
  'Le talisman refuse. Il a l\'air très sérieux. Reviens le {date}.',
  'Tu forces la case avant le {date} ? Il ne s\'est rien passé, comme dans un épisode récap.',
  'Cette case dort sous un sceau, et son réveil est prévu le {date}. Le héros, lui, se serait déjà réveillé en retard.',
  'Accès refusé. Il faut d\'abord un entraînement de montage en flashback, puis revenir le {date}.',
  'Un mystérieux inconnu murmure : « pas avant le {date} ». Il disparaît dans la fumée.',
];

// L'impact qui précède l'ouverture d'une case : une onomatopée tirée au hasard,
// et sa durée en millisecondes (le CSS la reçoit dans --duree).
const ONOMATOPEES = ['ドン！', 'バーン！', 'ズドン！', 'BAM !'];
const DUREE_IMPACT = 550;

const formatJour = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });
const formatJourLong = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' });
const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const formatComplet = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

const $ = (id) => document.getElementById(id);

/**
 * Contrat de mouvement : vrai si la personne a demandé moins d'animations
 * (réglage du système). Toute séquence minutée lit cette fonction avant de
 * démarrer ; le CSS, lui, coupe déjà toutes les animations et transitions.
 */
function mouvementReduit() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

let derniereReplique = -1;

/** Une réplique de refus pour une case fermée, avec sa date d'ouverture (heure de Paris). */
function repliqueFermee(ouverture, maintenant) {
  const n = REPLIQUES_FERMEES.length;
  // Tirage parmi les répliques autres que la précédente.
  let i = Math.floor(Math.random() * (derniereReplique >= 0 && n > 1 ? n - 1 : n));
  if (derniereReplique >= 0 && n > 1 && i >= derniereReplique) i += 1;
  derniereReplique = i;
  const date = formatJourLong.format(ouverture)
    + (memeJourParis(ouverture, maintenant) ? ` à ${formatHeure.format(ouverture)}` : '');
  const modele = REPLIQUES_FERMEES[i];
  return modele.includes('{date}') ? modele.replaceAll('{date}', date) : `${modele} Rendez-vous le ${date}.`;
}

/** La case fermée tremble : on relance l'animation CSS (coupée par la règle de mouvement réduit). */
function faireTrembler(bouton) {
  bouton.classList.remove('refus');
  void bouton.offsetWidth; // oblige le navigateur à repartir du début de l'animation
  bouton.classList.add('refus');
}

function creerCase(c, maintenant) {
  const li = document.createElement('li');
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = `case ${c.etat}${c.aEcrire ? ' a-ecrire' : ''}`;
  bouton.dataset.jour = c.jour;

  // Le cadre dessine la case de manga (bords penchés, encre, trame) derrière le contenu,
  // qui reste droit. Le bouton lui-même n'est jamais découpé : il porte l'anneau de focus.
  const cadre = document.createElement('span');
  cadre.className = 'cadre';
  cadre.setAttribute('aria-hidden', 'true');

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

  bouton.append(cadre, icone, numero, etiquette);
  if (c.contenu?.illustration) {
    const vignette = document.createElement('span');
    vignette.className = 'vignette';
    vignette.setAttribute('aria-hidden', 'true');
    vignette.textContent = c.contenu.illustration;
    bouton.append(vignette);
  }

  if (c.etat === 'fermee') {
    bouton.setAttribute('aria-disabled', 'true');
    bouton.setAttribute('aria-label', `Case ${c.jour}, pas encore disponible. Elle s'ouvrira ${quandLong(ouverture)}.`);
    bouton.addEventListener('click', () => {
      annoncer(repliqueFermee(ouverture, maintenant));
      faireTrembler(bouton);
    });
    bouton.addEventListener('animationend', (e) => {
      if (e.target === bouton && e.animationName === 'tremble') bouton.classList.remove('refus');
    });
  } else {
    const mot = c.etat === 'du-jour' ? 'case du jour' : 'ouverte';
    bouton.setAttribute('aria-label', `Case ${c.jour}, ${mot}${c.aEcrire ? ', contenu à écrire' : ''}.`);
    bouton.addEventListener('click', () => ouvrirCase(c, bouton));
  }

  li.append(bouton);
  return li;
}

function el(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

function creerQuiz(quiz) {
  const bloc = el('div', 'quiz');
  bloc.append(el('p', 'quiz-question', quiz.question));
  const choix = el('div', 'quiz-choix');
  const resultat = el('p', 'quiz-resultat');
  resultat.setAttribute('aria-live', 'polite');
  for (const texte of quiz.choix) {
    const b = el('button', 'quiz-bouton', texte);
    b.type = 'button';
    b.addEventListener('click', () => {
      for (const autre of choix.children) {
        autre.disabled = true;
        if (autre.textContent === quiz.reponse) autre.classList.add('bonne');
      }
      const juste = texte === quiz.reponse;
      if (!juste) b.classList.add('fausse');
      resultat.textContent = `${juste ? 'Bonne réponse !' : `Raté, la réponse était : ${quiz.reponse}.`} ${quiz.explication ?? ''}`;
    });
    choix.append(b);
  }
  bloc.append(choix, resultat);
  return bloc;
}

/* ---------- Ouverture d'une case ----------
   Trois états : « repos » → « impact » (l'animation joue) → « fenetre » (dialogue ouvert) → « repos ».
   Un clic qui arrive hors de l'état « repos » est ignoré. En mouvement réduit, pas d'impact :
   la fenêtre s'ouvre tout de suite. L'enchaînement repose sur un minuteur, jamais sur
   animationend, qui n'arrive pas quand les animations sont coupées. */
let etatOuverture = 'repos';
let caseOrigine = null; // le bouton qui a lancé l'ouverture : il reprend le focus à la fermeture

function ouvrirCase(c, bouton) {
  if (etatOuverture !== 'repos' || $('fenetre').open) return;
  caseOrigine = bouton;
  remplirFenetre(c);
  if (mouvementReduit()) {
    montrerFenetre();
    return;
  }
  etatOuverture = 'impact';
  const impact = creerImpact(bouton);
  document.body.append(impact);
  setTimeout(() => {
    montrerFenetre();
    impact.remove();
  }, DUREE_IMPACT);
}

function montrerFenetre() {
  etatOuverture = 'fenetre';
  if (!$('fenetre').open) $('fenetre').showModal();
}

/** L'impact (flash, lignes de vitesse, onomatopée), centré sur la case cliquée. */
function creerImpact(bouton) {
  const impact = $('modele-impact').content.firstElementChild.cloneNode(true);
  const r = bouton.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  impact.style.setProperty('--x', `${Math.round(x)}px`);
  impact.style.setProperty('--y', `${Math.round(y)}px`);
  // L'onomatopée suit la hauteur de la case sans sortir de l'écran.
  impact.style.setProperty('--mot-y', `${Math.round(Math.min(Math.max(y, innerHeight * 0.25), innerHeight * 0.75))}px`);
  impact.style.setProperty('--duree', `${DUREE_IMPACT}ms`);
  const mot = impact.querySelector('.impact-mot');
  mot.textContent = ONOMATOPEES[Math.floor(Math.random() * ONOMATOPEES.length)];
  mot.lang = /[぀-ヿ]/.test(mot.textContent) ? 'ja' : 'fr';
  return impact;
}

/** La fiche AniList : épisodes, année, studio, note, en pastilles séparées. */
function remplirFiche(fiche) {
  const zone = $('fenetre-fiche');
  zone.replaceChildren();
  if (!fiche) return;
  const morceaux = [];
  if (fiche.format) morceaux.push(fiche.format === 'film' ? 'Film' : 'En cours');
  else if (fiche.episodes) morceaux.push(`${fiche.episodes} ep.`);
  if (fiche.annee) morceaux.push(String(fiche.annee));
  if (fiche.studio) morceaux.push(fiche.studio);
  if (fiche.note) morceaux.push(`${fiche.note} / 100`);
  for (const texte of morceaux) zone.append(el('span', 'fiche-tag', texte));
  if (typeof fiche.url === 'string' && fiche.url.startsWith('https://anilist.co/anime/')) {
    const a = el('a', 'fiche-lien', 'AniList ↗');
    a.href = fiche.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    zone.append(a);
  }
}

function remplirFenetre(c) {
  $('fenetre-jour').textContent = [`${c.jour} décembre`, c.etat === 'du-jour' ? 'case du jour' : null].filter(Boolean).join(' · ');
  $('fenetre-anime').textContent = c.contenu?.anime ?? '';
  $('fenetre-illustration').textContent = c.contenu?.illustration ?? '';
  const vitrine = $('fenetre-vitrine');
  const imageZone = $('fenetre-image');
  imageZone.replaceChildren();
  imageZone.hidden = true;
  vitrine.classList.remove('a-image');
  const src = c.contenu?.fiche?.image;
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = c.contenu?.anime ?? '';
    img.loading = 'lazy';
    imageZone.append(img);
    imageZone.hidden = false;
    vitrine.classList.add('a-image');
  }
  remplirFiche(c.contenu?.fiche);
  const corps = $('fenetre-corps');
  corps.replaceChildren();

  if (c.aEcrire) {
    $('fenetre-titre').textContent = `Case ${c.jour}`;
    corps.append(el('p', 'a-ecrire-texte', 'Cette case n\'a pas encore de contenu.'));
  } else {
    const { titre, texte, lien, quiz } = c.contenu;
    $('fenetre-titre').textContent = titre ?? `Case ${c.jour}`;
    for (const paragraphe of (texte ?? '').split(/\n+/).filter(Boolean)) corps.append(el('p', null, paragraphe));
    if (quiz) corps.append(creerQuiz(quiz));
    if (lien) {
      const a = el('a', 'lien', lien.libelle);
      a.href = lien.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      corps.append(a);
    }
  }
}

// Trois façons de fermer : Échap (natif), le bouton « Fermer », un clic sur le fond.
$('fermer').addEventListener('click', () => $('fenetre').close());
$('fenetre').addEventListener('click', (e) => {
  // Le fond compte comme la fenêtre elle-même : on vérifie que le clic tombe hors de son cadre.
  if (e.target !== $('fenetre')) return;
  const r = $('fenetre').getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('fenetre').close();
});
$('fenetre').addEventListener('close', () => {
  etatOuverture = 'repos';
  caseOrigine?.focus();
  caseOrigine = null;
});

function afficher(d) {
  const maintenant = new Date(d.apercu?.date ?? Date.now());
  document.title = d.titre;
  $('titre').textContent = d.titre;
  $('sous-titre').textContent = d.sousTitre ?? '';

  if (d.apercu) {
    $('bandeau-apercu').hidden = false;
    $('bandeau-apercu').textContent = `Aperçu local, date simulée : ${quandLong(maintenant)}`;
  }

  if (d.fini && d.motDeFin) {
    $('mot-de-fin').hidden = false;
    $('mot-de-fin').textContent = d.motDeFin;
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
