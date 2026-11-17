# L'Avent-ure Anime

Un calendrier de l'Avent en ligne : **24 cases, 24 animes**, du 1er au 24 décembre.
Chaque jour, une case s'ouvre et révèle un anime culte avec son quiz, son défi ou son anecdote.

**[Ouvrir le calendrier](https://ilyesmdj.github.io/calendrier-avent-anime/)**

---

## Comment ça marche

| Composant | Rôle |
|---|---|
| `app/` | La page web : HTML, CSS et JS, sans framework. Le style imite une planche de manga (encre, trames, bulles). |
| `contenu/cases.json` | Les 24 textes, quiz et liens (chiffré sur GitHub, en clair sur l'ordinateur). |
| `scripts/construire.mjs` | Fabrique le site dans `_site/` : ne publie que les cases ouvertes à l'heure de Paris. |
| `scripts/robot.mjs` | Le robot GitHub Actions : il passe toutes les 5 minutes, compare, et publie si une case a changé. |
| `.github/workflows/publier.yml` | Le workflow qui orchestre le robot et déploie sur GitHub Pages. |

## Les cases

Chaque case contient :

- le nom d'un anime et une illustration en emoji
- une image de couverture tirée de l'API [AniList](https://anilist.co)
- une fiche (nombre d'épisodes, année, studio, note)
- un texte : quiz, défi, recette, anecdote ou mini-activité
- un lien vers Wikipédia

Les textes sont chiffrés avec un secret (`CLE_CALENDRIER`) pour ne pas gâcher la surprise.

## Lancer en local

```bash
npm run apercu                              # aujourd'hui
npm run apercu -- --date 2026-12-12         # simuler le 12 décembre
FICHES=1 npm run apercu -- --date 2026-12-15  # avec les images AniList
```

Le serveur d'aperçu recalcule les données à chaque rechargement : un texte modifié dans `contenu/cases.json` apparaît tout de suite.

## Fabriquer le site

```bash
npm run construire                          # site dans _site/
npm run construire -- --date 2026-12-24     # simuler Noël
```

## Mode soirée

Le calendrier peut ouvrir une case toutes les quelques minutes au lieu d'une par jour, pour une démo en direct. Le rythme se règle dans `calendrier.json` :

```json
{
  "mode": "soiree",
  "soiree": {
    "depart": "2026-11-16T20:30:00+01:00",
    "minutesEntreCases": 5
  }
}
```

## Technologies

- **Zéro dépendance** : Node.js natif, pas de npm install
- **API AniList** (GraphQL) pour les fiches et les images de couverture
- **GitHub Actions** pour le robot qui ouvre les cases à l'heure
- **GitHub Pages** pour l'hébergement
- **CSS pur** pour le style manga (trames, encre, lignes de vitesse)

## Licence

Projet personnel.
