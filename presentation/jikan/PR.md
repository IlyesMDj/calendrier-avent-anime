# Proposer le calendrier à la vitrine de Jikan (pas encore envoyé)

Fichier visé : https://github.com/jikan-me/website/blob/master/src/data/showcase.js
Entrée à ajouter en fin de liste : `entree.js` (fichier complet modifié : `showcase.js`).
Image d'aperçu : `app/apercu.png`, servie à https://ilyesmdj.github.io/calendrier-avent-anime/apercu.png
(elle doit être en ligne avant d'envoyer).

À vérifier avant : une affiche s'affiche bien quand on ouvre une case (depuis un réseau où api.jikan.moe répond).

Titre de la PR : Add L'Avent-ure Anime to showcase

Texte de la PR :
> Adds L'Avent-ure Anime, an anime advent calendar (in French). A GitHub Actions robot opens one box per day until Christmas; when a box opens, the page fetches the anime's poster from Jikan API v4 (`/v4/anime/{id}`), with credit to MyAnimeList.
> Live: https://ilyesmdj.github.io/calendrier-avent-anime/

Pour l'envoyer plus tard, dis à Claude : « envoie la PR Jikan ».
