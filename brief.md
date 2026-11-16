# AI FIRST — Meetup 16/11 — Calendrier-de-l-Avent

**Le sujet : un calendrier de l'Avent qui s'ouvre tout seul. 24 cases sur ce qui vous passionne, un robot qui ouvre celle du jour, et des surprises que personne ne lit en avance.**

> Brief du meetup AI First du 16/11 : un calendrier de l'Avent en ligne dont un robot GitHub Actions ouvre la case du jour. Git, mise en ligne, tâche planifiée et première chaîne CI/CD.

- **Document** : Brief du meetup
- **Format** : Talk de 15 minutes, 2 heures de build, démos de 3 à 4 minutes. Quatre paliers attendus, plus un bonus.
- **Périmètre** : Un calendrier de l'Avent en ligne, sur le thème de votre choix : une grille de 24 cases, une tâche automatique qui publie la case du jour à l'heure de Paris, un mode accéléré pour la soirée, et des cases futures illisibles avant leur date.
- **Hors périmètre** : Comptes de visiteurs, paiement, application mobile, écran d'administration des contenus.
- **Imposé** : Git, GitHub et GitHub Actions. Le design, le thème, les formats de contenu et les technologies de l'application sont libres.
- **Prérequis** : Un compte GitHub, Git installé, un agent qui lance des commandes sur votre ordinateur. Voir § 00.
- **Livrables** : Une adresse publique, un dépôt GitHub avec son historique, un robot qui tourne.

---

## § 00 — Avant de commencer

La fiche envoyée avant la soirée demandait trois choses. Vérifiez-les maintenant : sans elles, le palier 2 s'arrête net. Si l'une manque, comptez dix minutes, et demandez de l'aide tout de suite plutôt qu'à 21 h.

1. **Un compte GitHub.** Gratuit, sur [github.com/signup](https://github.com/signup). L'adresse e-mail doit être confirmée.
2. **Git et l'outil GitHub en ligne de commande.** Git tient l'historique sur votre ordinateur. `gh` permet à votre agent de parler à votre compte GitHub sans mot de passe à recopier.
3. **Votre agent connecté à GitHub.** La commande de connexion ouvre le navigateur, vous validez, c'est fini.
4. **Le test.** Demandez à votre agent : « Vérifie que git et gh sont installés et que je suis connecté à mon compte GitHub. Sinon, guide-moi pas à pas. »
5. **Le Discord d'AI First**, sur [discord.gg/dwhBq7YXn](https://discord.gg/dwhBq7YXn), pour les questions pendant le build et l'envoi de votre adresse à la fin.

**macOS**

```bash
git --version      # s'il propose d'installer les outils de développement, acceptez
gh --version       # absent ? installeur sur cli.github.com, ou : brew install gh
gh auth status     # doit afficher votre nom de compte

# Pas connecté ?
gh auth login --web --git-protocol https --scopes workflow
```

**Windows (PowerShell)**

```powershell
git --version      # absent ? winget install --id Git.Git
gh --version       # absent ? winget install --id GitHub.cli
gh auth status     # doit afficher votre nom de compte
# Après une installation, fermez puis rouvrez PowerShell

# Pas connecté ?
gh auth login --web --git-protocol https --scopes workflow
```

**Linux**

```bash
git --version      # absent ? sudo apt install git
gh --version       # absent ? voir cli.github.com
gh auth status     # doit afficher votre nom de compte

# Pas connecté ?
gh auth login --web --git-protocol https --scopes workflow
```

`gh auth status` doit répondre « Logged in to github.com » avec votre nom de compte. L'option `--scopes workflow` donne à votre agent le droit d'installer le robot du palier 3 : sans elle, GitHub refusera l'envoi à ce moment-là.

### Ce qu'il faut savoir

| Point | Détail |
| --- | --- |
| Le compte gratuit suffit | Tout ce que demande ce brief tient dans un compte GitHub gratuit. Les limites qui comptent sont rassemblées dans la section « Les limites de GitHub ». |
| AI First ne fournit pas l'IA | Vous venez avec votre agent et votre abonnement. Claude Code, Codex et Cursor conviennent tous les trois. |
| Le kit | Il contient des consignes pour votre agent, une skill Git et un prompt pour écrire vos cases. Aucun code : l'application reste à construire. |

> **Le réflexe du soir** — Une clé d'API ou un mot de passe ne s'écrit jamais dans un fichier du projet. Git garde tout ce qui a été sauvegardé, et GitHub tout ce qui lui a été envoyé : **supprimer le fichier le lendemain ne retire rien de l'historique**.

---

## § 01 — Esprit de l'exercice

Une application construite en une soirée finit souvent sur l'ordinateur de la personne qui l'a faite, en un seul exemplaire, sans copie de la version qui marchait. Ce soir, la vôtre parcourt tout son cycle de vie : vous l'imaginez, vous la construisez avec votre agent, Git la sauvegarde, un robot la vérifie et la met en ligne, et des visiteurs la font vivre. Le prétexte est un calendrier de l'Avent, parce qu'il pose la question dans les bons termes : il doit changer tout seul, chaque jour, à une heure précise, sans que vous soyez devant votre écran.

La liste des six étapes, et qui porte chacune, figure dans la section « Le cycle de vie ». Les paliers vous les font toutes traverser au moins une fois.

### Parti pris #1 — Trois outils imposés, le reste libre

Git, GitHub et GitHub Actions sont le sujet de la soirée : ils sont imposés. Pour tout le reste (thème, design, langage, formats de contenu, hébergeur), ce brief dit ce que le calendrier doit faire, jamais comment. Partout où une décision se présente, elle vous appartient.

### Parti pris #2 — Vous demandez, votre agent exécute

Vous n'apprenez aucune commande Git ce soir. Vous apprenez à demander quatre choses : sauvegarder, comparer, revenir en arrière, essayer une idée à part. La skill du kit donne la même habitude à tous les agents, pour que la phrase « reviens à la version où la grille s'affichait » fonctionne à chaque table.

### Parti pris #3 — Chez le visiteur, rien ne se protège

C'est la règle de sécurité de la soirée. Un contenu envoyé au navigateur du visiteur lui appartient, même masqué, même derrière un rideau. Une case future ne se cache donc pas : elle n'est pas envoyée. À la fin du build, votre voisin vérifiera.

## § 02 — La mise en situation

*Mi-novembre. Clara prépare chaque année un calendrier de l'Avent pour ses trois neveux. L'an dernier, elle l'a fait en ligne.*

« Je l'avais construit en une soirée avec une IA, j'étais fière. Le 3 décembre, mon neveu de onze ans m'a envoyé une capture de la case 24. Clic droit, afficher le code source : les 24 surprises étaient là, juste cachées derrière un rideau. »

« Cette année, je veux qu'une case s'ouvre toute seule à minuit, même si je dors, même si je suis en vacances sans ordinateur. Et qu'avant sa date, une surprise ne se trouve nulle part où un enfant malin peut aller fouiller. »

« Dernier point. Le 10 décembre, j'ai voulu changer les couleurs et j'ai tout cassé. Je n'avais aucune copie de la version qui marchait. Je veux pouvoir essayer une idée, et revenir en arrière si elle est mauvaise. »

**C'est le besoin. À vous de le faire exister.**

## § 03 — Les paliers

Le besoin est celui de Clara. Le calendrier, lui, est le vôtre : il parle de ce qui vous passionne, pour qui vous voulez. Quatre paliers s'enchaînent dans l'ordre, chacun avec un critère qui se vérifie à l'écran. Le palier 3 est le cœur de la soirée.

1. **Construire et sauvegarder** — Attendu de tous
2. **Mettre en ligne** — Une adresse publique
3. **Le robot** — Le cœur de la soirée
4. **Les cadeaux bien cachés** — Rien ne se lit en avance
5. **Bonus** — Au choix, à montrer en démo

---

## Palier 1 — Construire et sauvegarder — Attendu de tous

Étapes 01 à 03 du cycle de vie : imaginer, construire, sauvegarder. À la fin de ce palier, votre calendrier fonctionne sur votre ordinateur, et son historique raconte comment il a été construit.

### Fonctionnalités

- **Choisir son thème.** Le fichier `prompt-contenu.md` du kit fait de votre agent un intervieweur : il vous questionne sur ce qui vous passionne, propose des thèmes et écrit les 24 cases avec vous. Vingt minutes au plus. Trois ou quatre cases suffisent pour démarrer.
- **Afficher la grille.** 24 cases, du 1er au 24 décembre.
- **Montrer trois états.** Une case est ouverte, ou c'est la case du jour, ou elle n'est pas encore disponible. Le visiteur le voit au premier regard.
- **Ouvrir une case.** Une case ouverte montre son contenu : un texte, et selon votre ambition une image, un lien, un quiz, une petite activité.
- **Sauvegarder à chaque étape.** Votre agent pose un point de sauvegarde après chaque étape qui fonctionne, avec une légende qui dit ce qui a changé.
- **Revenir en arrière.** Faites l'essai une fois, exprès : demandez un changement que vous ne garderez pas, puis demandez à revenir à la version d'avant.

### Règles de gestion — Palier 1

| Domaine | Règle |
| --- | --- |
| Grille | Les 24 cases sont visibles dès l'arrivée, numérotées de 1 à 24, y compris sur un écran de téléphone. |
| États | Chaque état se reconnaît sans la couleur : un mot, un pictogramme ou une forme le dit aussi. |
| Case du jour | Il y a au plus une case du jour. Avant le 1er décembre, il n'y en a aucune. |
| Case fermée | Une case pas encore disponible ne s'ouvre pas, et dit quand elle s'ouvrira. |
| Date | Le calendrier sait quel jour il est sans que personne le lui dise. Pendant la construction, vous avez un moyen de le voir tel qu'il sera le 12 décembre. |
| Contenu | Une case sans contenu se repère pendant la construction : elle ne s'affiche pas vide en silence. |
| Historique | L'historique contient au moins quatre points de sauvegarde. Chaque légende, en français, dit ce qui a changé. |
| Retour | Après un retour en arrière, le calendrier fonctionne comme au point choisi, et rien d'autre n'a disparu sans votre accord. |
| Secrets | Aucun mot de passe ni clé d'API ne figure dans un point de sauvegarde. |
| Après le 24 | **À TRANCHER (participant) :** que montre le calendrier le 25 décembre et après ? Tout laisser ouvert en fait un souvenir à relire. Le refermer ou afficher un mot de fin évite qu'un visiteur de janvier tombe sur un calendrier qui semble en panne. Choisissez, et faites-le voir. |

> **Note de cadrage** — Ce palier se vérifie en lisant l'historique : demandez à votre agent « montre-moi l'historique ». Plusieurs sauvegardes, des légendes claires, et vous avez réussi. Rien n'est en ligne à ce stade.

---

## Palier 2 — Mettre en ligne — Une adresse publique

Étape 05 du cycle de vie, une première fois à la main. À la fin de ce palier, votre projet est au coffre, sur GitHub, et votre calendrier s'ouvre à une adresse que vous pouvez envoyer à n'importe qui.

### Fonctionnalités

- **Envoyer au coffre.** Le projet et tout son historique arrivent sur votre compte GitHub.
- **Publier.** Le calendrier est accessible à une adresse publique. GitHub Pages est le chemin le plus court. Un autre hébergeur convient (Bailey, Netlify, Cloudflare Pages…) tant que la mise en ligne part de GitHub.
- **Mettre à jour.** Un changement sauvegardé puis envoyé à GitHub arrive en ligne sans autre geste de votre part.
- **Savoir ce qui est en ligne.** À tout moment, vous savez dire quel point de sauvegarde les visiteurs ont sous les yeux.

### Règles de gestion — Palier 2

| Domaine | Règle |
| --- | --- |
| Adresse | L'adresse s'ouvre sans compte ni mot de passe, depuis un autre appareil que le vôtre, hors du wifi de la salle. |
| Téléphone | La grille se lit et s'utilise sur un écran de téléphone, sans zoomer. |
| Mise à jour | Un changement envoyé à GitHub est visible en ligne en quelques minutes, sans commande ni clic supplémentaire. |
| Fidélité | Le calendrier en ligne se comporte comme celui de votre ordinateur : mêmes états, même case du jour. |
| Échec | Une mise en ligne qui échoue laisse la version précédente en place, et vous savez où lire ce qui s'est passé. |
| Envoi | Votre agent dit ce qu'il a envoyé : combien de points de sauvegarde, lesquels, et à quelle adresse les voir. |
| Secrets | Rien de confidentiel ne part vers GitHub. |

> **Note de cadrage** — Le critère : un voisin ouvre votre adresse sur son téléphone. Faites-le dès que la page répond, avant d'améliorer quoi que ce soit.

---

## Palier 3 — Le robot — Le cœur de la soirée

Étapes 05 et 06 du cycle de vie, sans vous. À la fin de ce palier, une tâche planifiée dans GitHub Actions publie la case du jour pendant que votre ordinateur est fermé.

### Fonctionnalités

- **Planifier.** Une tâche GitHub Actions se déclenche à heure fixe et publie la case du jour sur le site.
- **Lancer à la main.** Un bouton, dans GitHub, lance la même publication sans attendre l'heure prévue.
- **Accélérer.** Un mode soirée ouvre une case toutes les cinq minutes, pour voir le calendrier avancer pendant les démos.
- **Revenir au rythme normal.** Un seul réglage ramène le calendrier à une case par jour.
- **Lire le journal du robot.** Chaque passage laisse une trace : l'heure, le mode, la case ouverte.

### Règles de gestion — Palier 3

| Domaine | Règle |
| --- | --- |
| Sans vous | Une nouvelle case apparaît en ligne sans intervention humaine, votre ordinateur éteint. |
| Heure | Les dates du calendrier se comptent à l'heure de Paris. Vous savez dire à quelle heure UTC passe votre robot, et pourquoi. |
| Ouverture | L'heure à laquelle une case s'ouvre est choisie par vous et affichée au visiteur. |
| Retard | Un robot en retard ou un passage sauté ne décale rien : au passage suivant, toutes les cases dues sont ouvertes. |
| Deux fois | Lancer le robot deux fois de suite n'ouvre pas une case de plus et ne casse rien. |
| Manuel | Le lancement à la main fait exactement ce que fait le passage planifié. |
| Jamais trop tôt | Au rythme normal, aucune case n'est publiée avant sa date, même quand le robot est lancé à la main. |
| Accéléré | En mode accéléré, les cases s'ouvrent dans l'ordre, une par tranche de cinq minutes, à partir d'un instant de départ que vous fixez. |
| Bascule | Passer d'un mode à l'autre tient en un réglage, sans réécrire le robot. Le mode en cours se lit quelque part, sur la page ou dans le journal. |
| Échec | Quand le robot échoue, le site reste dans son dernier état correct et l'échec se voit dans GitHub. |
| Après la soirée | **À TRANCHER (participant) :** au retour à une case par jour, que deviennent les cases ouvertes ce soir ? Les laisser ouvertes donne quelque chose à lire aux visiteurs de demain, mais ces surprises sont éventées avant décembre. Les refermer rend un calendrier intact pour le 1er décembre, avec une page qui ne montre d'ici là que des cases fermées. |

> **Note de cadrage** — Le critère : une nouvelle case apparaît sans que personne touche à rien. GitHub ne garantit pas l'heure d'une tâche planifiée : un retard de 5 à 30 minutes est courant. Activez le mode accéléré au moins une demi-heure avant les démos, et gardez le bouton manuel sous la main.

---

## Palier 4 — Les cadeaux bien cachés — Rien ne se lit en avance

Des cadeaux posés sous le sapin dès le 1er décembre, tout le monde peut les secouer. À la fin de ce palier, le contenu d'une case future n'est lisible nulle part avant sa date. Première question à poser à votre agent : où sont rangés mes 24 contenus en ce moment, et qui peut y aller ?

### Fonctionnalités

- **Faire l'inventaire.** Listez chaque endroit où le contenu d'une case future existe : la page, les fichiers que le site sert, le dépôt sur GitHub, son historique, le journal du robot.
- **Vider la page.** Ce que reçoit le visiteur ne contient que les cases ouvertes.
- **Mettre les cadeaux à l'abri.** Trois parades existent, aucune n'est imposée : un dépôt privé qui publie vers un site public, des contenus confiés aux secrets de GitHub que seul le robot lit, ou un contenu fabriqué le jour même.
- **Le prouver.** Essayez vous-même de lire votre case 24, avant que votre voisin s'y mette.

### Règles de gestion — Palier 4

| Domaine | Règle |
| --- | --- |
| Page | Le contenu d'une case future est absent de ce que reçoit le visiteur, même masqué : ni dans la page, ni dans le code, ni dans un fichier de données, ni dans une image. |
| Adresses | Deviner une adresse ne donne rien : remplacer 3 par 24 dans le nom d'un fichier ou d'une image mène à une page absente. |
| Horloge | Changer la date de son appareil ou ajouter quelque chose à l'adresse n'ouvre aucune case. |
| Dépôt | Si le dépôt est public, aucun de ses fichiers ne contient une case future. |
| Historique | L'historique compte autant que les fichiers : un contenu supprimé aujourd'hui, mais présent dans un ancien point de sauvegarde public, se lit toujours. |
| Journal | Le journal du robot, public quand le dépôt l'est, n'affiche le contenu d'aucune case future. |
| Robot | Une fois la parade en place, le robot ouvre toujours la case du jour, seul. |
| Coût | Vous savez dire ce que votre parade coûte : en argent, en limites de GitHub, en confort pour modifier une case. |
| Parade | **À TRANCHER (participant) :** quelle parade ? Le dépôt privé se comprend vite, mais GitHub Pages n'y est plus gratuit et le robot y consomme un quota de minutes. Les secrets gardent le dépôt public et gratuit, mais vos textes se modifient alors dans les réglages de GitHub, sans historique. Le contenu fabriqué le jour même n'a rien à cacher, mais vous ne savez plus à l'avance ce que dira la case. Choisissez, et sachez dire ce que vous avez sacrifié. |

> **Note de cadrage** — Le critère : votre voisin n'arrive pas à lire la case 24. Si vos contenus sont déjà partis dans un dépôt public, dites-le en démo plutôt que de le taire : c'est le piège le plus courant de la soirée, et le réparer demande de traiter aussi l'historique.

---

## Palier 5 — Bonus — Au choix, à montrer en démo

Quatre pistes pour qui a fini les paliers. Une seule suffit, si elle se montre en démo.

**Une vérification avant mise en ligne.** C'est l'étape 04 du cycle de vie, celle que la soirée a sautée : le robot contrôle le travail avant de publier, et refuse si le contrôle échoue. Un bon premier contrôle : « la case de demain n'est pas dans ce qui part en ligne ».

**Une notification.** À l'ouverture d'une case, quelqu'un est prévenu : vous, ou vos visiteurs.

**Un contenu écrit le jour même.** Le robot demande la case du jour à un modèle d'IA. La clé d'API vit dans un secret de GitHub, nulle part ailleurs.

**Un essai à part.** Tentez une idée dont vous n'êtes pas sûr sur une branche, montrez-la, puis adoptez-la ou abandonnez-la. Le calendrier en ligne ne bouge pas pendant l'essai.

Une question à garder pour la discussion de fin : *le robot a publié une case fausse à minuit pendant que vous dormiez. Qu'est-ce qui aurait dû l'arrêter ?*

---

## § 04 — Le cycle de vie

Les six étapes du talk, qui porte chacune, et le palier où vous la traversez.

| Étape | Qui la porte, et quand |
| --- | --- |
| 01 · Imaginer | Vous. Palier 1, avec le prompt de contenu. |
| 02 · Construire | Vous et votre agent. Palier 1. |
| 03 · Sauvegarder | Git. Dès le palier 1, puis à chaque étape. |
| 04 · Vérifier | GitHub Actions. Ce soir en bonus, approfondi dans la suite du parcours. |
| 05 · Mettre en ligne | GitHub Actions. Palier 2 à votre demande, palier 3 tout seul. |
| 06 · Faire vivre | Vos visiteurs. Dès que l'adresse circule. |

---

## § 05 — Les limites de GitHub

Elles pèsent sur vos choix aux paliers 3 et 4. Mieux vaut les connaître avant qu'après.

| Sujet | Ce qu'il faut savoir |
| --- | --- |
| Heure | Une tâche planifiée s'exprime par défaut en heure UTC. En hiver, minuit à Paris correspond à 23 h UTC, la veille. Un fuseau horaire peut aussi être indiqué à côté de l'horaire. |
| Ponctualité | L'heure n'est pas garantie. Les retards de 5 à 30 minutes sont fréquents quand GitHub est chargé, surtout au début de chaque heure, et un passage est parfois sauté. |
| Fréquence | Une tâche planifiée ne tourne pas plus d'une fois toutes les 5 minutes. |
| Version principale | Une tâche planifiée ne tourne que depuis la version principale du projet. Un robot modifié dans un essai à part ne passe pas à l'heure. |
| Pause | Dans un dépôt public, les tâches planifiées sont mises en pause après 60 jours sans activité. Sans effet d'ici le 24 décembre. |
| Quota du robot | GitHub Actions est illimité sur un dépôt public. Sur un dépôt privé avec un compte gratuit : 2 000 minutes par mois. Un robot qui passe toutes les 5 minutes en consomme plusieurs centaines par jour : coupez le mode accéléré après la soirée. |
| GitHub Pages | Gratuit sur un dépôt public. Indisponible sur un dépôt privé avec un compte gratuit. |
| Dépôt public | Tout le monde peut y lire tous les fichiers, tout l'historique et le journal du robot. |

---

## § 06 — Le défi du voisin

**Dix minutes, à la fin du build.** Au signal, vous échangez vos adresses avec votre voisin. Chacun tente de lire une case de l'autre qui n'est pas encore ouverte.

- **Tout ce qu'un visiteur peut faire est permis** : afficher le code source, ouvrir les outils du navigateur, deviner des adresses, changer la date de son appareil, lire le dépôt GitHub s'il est public, son historique, le journal du robot. Votre agent peut vous aider.
- **Vous regardez, vous ne touchez pas.** Aucune modification chez l'autre, aucune connexion à son compte, aucune rafale de requêtes.
- **Notez ce que vous trouvez** : quelle case, par quel chemin, en combien de temps. Une phrase suffit.
- **Rien trouvé ?** Notez les chemins essayés. C'est ce que votre voisin montrera en démo.

Pas encore au palier 4 ? Jouez quand même. Voir sa case 24 lue en trente secondes apprend plus vite que n'importe quelle règle.

---

## § 07 — Les démos

Trois à quatre minutes par projet, sur votre calendrier en ligne. Quatre choses à montrer, dans cet ordre.

### La grille de démo

1. **Votre thème.** De quoi parle votre calendrier, et pour qui. Trente secondes.
2. **Une case ouverte par le robot.** La case à l'écran, puis la trace du passage du robot dans GitHub : personne n'a cliqué.
3. **Le résultat du défi.** Votre voisin dit en une phrase ce qu'il a réussi à lire chez vous, et par où. Vous dites ce que vous changeriez.
4. **Une chose apprise.** Une seule, que vous referez sur votre prochain projet.

Montrez aussi votre historique si vous en êtes content : des légendes claires se lisent comme le récit de la soirée. La section « Présenter votre projet » donne le prompt qui prépare votre slide ; postez-la sur le Discord avec l'adresse de votre calendrier.

**Partager votre dépôt, si vous le voulez.** Amine et Anthony aimeraient relire les dépôts de la soirée pour mesurer, d'une session à l'autre, les progrès en qualité et en sécurité. C'est facultatif. Si vous êtes d'accord, ajoutez l'adresse de votre dépôt à votre message sur le Discord. Rien ne sera publié avec votre nom sans vous le demander.

---

## § 08 — Le kit du soir

- `AGENTS.md` et `CLAUDE.md` : les consignes que votre agent lit en arrivant, avec les habitudes Git en version courte.
- `skills/points-de-sauvegarde/` : la skill Git complète, pour Claude Code, Codex, Cursor et les autres outils qui gèrent les skills.
- `prompt-contenu.md` : le prompt à coller pour écrire vos 24 cases en vingt minutes.
- `exemples-de-cases.md` : six cases d'exemple, six formats.
- `LISEZ-MOI.md` : par où commencer, et les phrases à dire à votre agent.

Le kit ne contient aucun code et n'impose aucune technologie. Décompressez-le, renommez le dossier, ouvrez votre agent dedans.

[Télécharger le kit](2026-11-16-calendrier-avent-kit.zip)

---

## § 09 — Pour aller plus loin

Ce soir, la chaîne est minimale : le robot publie, il ne vérifie presque rien. La suite du parcours porte sur ce qu'il peut contrôler avant chaque mise en ligne.

| Contrôle | Ce qu'il attrape |
| --- | --- |
| Des tests | Une case qui s'ouvre trop tôt, une grille à 23 cases, un lien cassé. |
| L'accessibilité | Un état qui ne se lit que par la couleur, une image sans description, un contraste trop faible. |
| Les secrets oubliés | Une clé d'API ou un mot de passe glissé dans un fichier ou dans l'historique. |
| Une relecture par un modèle d'IA | Une modification qui fait autre chose que ce que dit sa légende. |

**La vidéo de la semaine** reprend le robot de ce soir et lui branche un premier contrôle. Sa date est annoncée sur le [Discord](https://discord.gg/dwhBq7YXn).

D'ici là : laissez tourner votre calendrier, envoyez l'adresse à quelqu'un, et regardez le 1er décembre si la première case s'est ouverte sans vous.

---

AI First, édition 12, chez EVER-T · [aifirsthq.fr](https://aifirsthq.fr) · [discord.gg/dwhBq7YXn](https://discord.gg/dwhBq7YXn)

Références : documentation GitHub Actions, « Events that trigger workflows », section schedule · documentation GitHub Pages · tarifs GitHub Actions.
