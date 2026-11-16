# 02 ouverture-impact — sub-plan (self-contained)

## Objective
Redesign of the Advent calendar page for the theme "un anime par jour" (for friends, funny and offbeat tone). The previous part turned the grid into a manga page (irregular panels, halftone). In this part: opening an open case plays an **impact** (flash, speed lines, onomatopoeia) then opens `#fenetre` styled as a manga page with the anime name in large type; a closed case **refuses** with a shaking paper talisman and a funny line giving its opening date. All graphics original CSS/SVG, no npm dependency, no framework.

## Scope
- In: `app/index.html` (dialog markup, impact layer), `app/style.css` (impact, dialog, quiz, talisman shake), `app/app.js` (`ouvrirCase`, closed-case click handler, quiz, sequencing), `tests/ouverture.test.mjs`.
- Out: the grid layout of the previous part (reuse its hooks, do not rewrite it); everything outside `app/` and `tests/`. Never touch `scripts/**`, `contenu/**`, `.cle`, `calendrier.json`, `package.json`, `.gitignore`, `.github/**`, `AGENTS.md`, `CLAUDE.md`, `LISEZ-MOI.md`, `brief.md`, `prompt-contenu.md`, `exemples-de-cases.md`, `skills/`, `.claude/`, `.to-do/`. Never open or quote `contenu/` files or `.cle` (secrets). A needed data field that `/donnees.json` lacks → STATUS BLOCKED. `tests/outils/navigateur.mjs` and `tests/planche.test.mjs` are frozen.

## Conventions & commands (copied)
- Stack: static page, vanilla browser JS (classic script, `defer`), plain CSS; Node 24 ES modules (`"type": "module"`, zero dependencies). Windows, Git Bash.
- Test: `node --test --test-concurrency=1 tests/` · single test `node --test --test-concurrency=1 --test-name-pattern "c13" tests/ouverture.test.mjs` · syntax `node --check app/app.js`.
- French everywhere (UI text, comments, identifiers: `creerCase`, `annoncer`, `$ = getElementById`) · case text set only through `textContent` / attributes; `innerHTML` only for the constant `ICONES` SVG strings · colours as CSS custom properties on `:root` · one aria-live `#message` for announcements · `<dialog>` + `showModal()` for an opened case.
- Motion contract (from the previous part): every animation and transition is cancelled under `@media (prefers-reduced-motion: reduce)` by one global rule in `style.css`; JS reads `matchMedia('(prefers-reduced-motion: reduce)')` before any timed sequence.

## Data contract (read-only) `GET /donnees.json`
`{ titre, sousTitre, annee, heureOuverture, fini, motDeFin?, version, genereLe, apercu?: { date }, cases: [{ jour: 1..24, etat: "ouverte"|"du-jour"|"fermee", ouverture: ISO, aEcrire?: true, contenu?: { anime?, titre?, texte?, lien?: { url, libelle }, quiz?: { question, choix[], reponse, explication? } } }] }`. Only opened cases (`ouverte`, `du-jour`) carry `contenu`; a closed case has only `jour`, `etat`, `ouverture` (and `aEcrire` in preview). Content lives in a gitignored file and changes: never hard-code case texts.

## Contracts (copied, exact)
- DOM hooks (kept from the previous part): `#grille` (`ol`) › `li` › `button.case.<etat>[data-jour]` with children `.numero`, `.etiquette`, `.icone`; `.a-ecrire` on a case without content; ids `#titre`, `#sous-titre`, `#bandeau-apercu`, `#mot-de-fin`, `#message`, `#pied`, `#fenetre`, `#fenetre-jour`, `#fenetre-titre`, `#fenetre-corps`, `#fermer`.
- Impact overlay element has class `impact` and exists only during the sequence (removed once the dialog is open).
- Anime name rendered in `.fenetre-anime` inside `#fenetre`.
- Closed-case lines live in one editable constant array `REPLIQUES_FERMEES` in `app/app.js`, each line built with the case's opening date (Paris time, `Intl` `fr-FR`), e.g. « Ton niveau de puissance est insuffisant. Reviens le 13 décembre. »; at least 5 lines; a line never contains case content.
- Opening state machine: impact → `showModal()`; a second click during the sequence or on an open dialog does nothing (no `InvalidStateError`); Escape / `#fermer` / backdrop click close it; focus returns to the originating `.case`; reduced motion opens the dialog immediately without waiting for `animationend` (which never fires when animations are cancelled) — sequencing uses timers guarded by `matchMedia`.

## Context pack (scout, after P1 commit)

**Files and symbols to change**
- `app/app.js:119-141` `ouvrirCase(c)`: fills `#fenetre-jour` (`${c.jour} décembre · anime · case du jour`, line 120), clears `#fenetre-corps` (122), then:
  - `c.aEcrire` → `#fenetre-titre` = `Case N`, one `p.a-ecrire-texte` with «Cette case n'a pas encore de contenu.» (124-126)
  - else destructures `{titre, texte, lien, quiz}` from `c.contenu` (128); title = `titre ?? "Case N"` (129); `texte` split on `/\n+/`, filtered, each line → `el('p', null, …)` (130); `quiz` → `creerQuiz` (131); `lien` → `a.lien` with `target=_blank`, `rel=noopener noreferrer` (132-138)
  - `$('fenetre').showModal()` (140). No focus handling, no `close` listener.
- `app/app.js:46-86` `creerCase(c, maintenant)`:
  - closed (`fermee`): `aria-disabled="true"` (not `disabled`), aria-label line 76, click → `annoncer(...)` line 77
  - else click → `ouvrirCase(c)` line 81
  - `a-ecrire` class added when `c.aEcrire` (50)
- `app/app.js:95-117` `creerQuiz(quiz)`: `.quiz`, `p.quiz-question`, `.quiz-choix`, `p.quiz-resultat[aria-live=polite]`, buttons `.quiz-bouton` with `type=button`. On answer: all buttons `disabled=true`, the one whose `textContent === quiz.reponse` gets `bonne`, the clicked wrong one gets `fausse` (104-110). Result text: «Bonne réponse !» / «Raté, la réponse était : X.» + `quiz.explication ?? ''` (111).
- `app/app.js:143-146`: `#fermer` click → `close()`; backdrop: `e.target === $('fenetre')` → `close()`.
- `app/app.js:23-25` `mouvementReduit()` returns `matchMedia('(prefers-reduced-motion: reduce)').matches`. **No call site exists** in app.js.
- `app/app.js:34-40` dates: `quandCourt(ouverture, maintenant)` → `"à HH:MM"` if same Paris day, else `"le 13 déc."`; `quandLong(ouverture)` → `"<weekday> <d> <month> HH:MM (heure de Paris)"`. `formatJour`, `formatHeure`, `formatComplet` (12-14, all `timeZone: 'Europe/Paris'`); `formatDate` (27) + `memeJourParis(a,b)` (29).
- `app/app.js:42-44` `annoncer(texte)` → `$('message').textContent`. `$` at line 16.
- `app/app.js:4-8` `ICONES` (keys `ouverte`, `du-jour`, `fermee`); `MOTS` line 10.
- `afficher(d)` line 148; `maintenant` = `d.apercu?.date ?? Date.now()` (149); passed to `creerCase` (164). `ouvrirCase` does not receive `maintenant`.
- `app/index.html:36-43`: `<dialog id="fenetre" class="fenetre" aria-labelledby="fenetre-titre">` containing `div.fenetre-haut` > `p#fenetre-jour.fenetre-jour`, `button.fermer#fermer` (text «Fermer», aria-label «Fermer la case»); then `h2#fenetre-titre`; then `div#fenetre-corps.fenetre-corps`.
- `app/index.html:31`: `<p id="message" class="message" role="status" aria-live="polite">`.

**Styles (`app/style.css`)**
- `:root` tokens: 4-29 (`--papier` 6, `--papier-2` 7, `--bulle` 8, `--encre` 9, `--encre-douce` 10, `--trame-legere/--trame/--trame-forte` 11-13, `--accent` 15, `--accent-texte` 16, `--jaune` 17, `--a-ecrire` 18, `--focus` 19, `--lien` 20, `--alerte` 21, `--juste` 22, `--police-*` 24-26, `--page` 28, `--marge` 29, `--trait` 30). Media override 34.
- `.case { pointer-events: none }` at 233-240; `.case > * { pointer-events: auto }` at 242; `.cadre` 244-260 (`.cadre::before` 250).
- `.cadre::after` base 300; `.case.ouverte` 302-312; `.case.du-jour` 314-320; `.case.fermee` 322-325 (`cursor: not-allowed`); talisman `.case.fermee .cadre::after` 327-335; desktop size 336-338; hover lift `.case:not(.fermee):hover .cadre` 339 (`translate` transition at 248).
- `.case.a-ecrire::after` 342-351; `.case:focus-visible` 354-357.
- Reduced motion: lines 360-364, `@media (prefers-reduced-motion: reduce) { *, *::before, *::after, ::backdrop { animation: none !important; transition: none !important; } }`.
- Dialog: `.fenetre` 394-398 (width `min(560px, …)`, `border-radius: 0`, hard `box-shadow: 8px 8px 0`); `.fenetre::backdrop` 399 (`rgb(10 10 10 / 0.65)`); `.fenetre-haut` 400; `.fenetre-jour` 401; `.fenetre h2` 402; `.fenetre-corps p` 403; `.fermer` 404-407; focus ring for `.fermer`/`.quiz-bouton`/`.lien` 408; `.lien` 409; `.a-ecrire-texte` 410.
- Quiz: `.quiz-question` 412, `.quiz-choix` 413, `.quiz-bouton` 414-417, `:disabled` 418, `.quiz-bouton.bonne` 419 (+ `::before` "✓ " 420), `.quiz-bouton.fausse` 421, `.quiz-resultat` 422.
- `.onomatopee` 108 (the title's ドン！, not the impact overlay).

**Contracts and texts already defined**
- Closed-case announcement (app.js:77): «La case N n'est pas encore disponible. Elle s'ouvrira <quandLong>.»
- Closed aria-label (76): «Case N, pas encore disponible. Elle s'ouvrira <quandLong>.»
- Page-level loading error (181): «Le calendrier n'a pas pu se charger…»
- `c.contenu` fields used: `titre`, `texte`, `lien{libelle,url}`, `quiz{question,choix,reponse,explication}`, `anime`. Cases: `jour`, `etat`, `aEcrire`, `ouverture`.

**Not found**
- `REPLIQUES_FERMEES`, any impact overlay (`.impact`, flash, speed lines), any `@keyframes`, any shake animation, any Escape/`keydown` handler, any `close` event listener, any focus-return code, any `mouvementReduit()` caller, any `opening date` line for the shake message beyond the existing `annoncer`.

**Traps**
- `.case` has `pointer-events: none` and children `auto`: a new overlay or shake on the button needs this rule respected, or clicks may fall through to the grid.
- Closed cases are not `disabled`; their click handler is the only one on them.
- Reduced-motion rule already covers `::backdrop`, but only CSS; JS must check `mouvementReduit()`, which is currently unused.
- Escape is native `<dialog>` behaviour; no custom handler exists to rely on or to replace.
- `ouvrirCase(c)` has no access to `maintenant`; a date for a closed-case message needs it passed or taken from `creerCase`'s scope.
- `--papier-2` is defined at style.css:7 (my earlier grep missed it because of the digit).
- Line 173 uses `el` as a loop variable, shadowing the `el()` helper in that loop only.


## Tasks
| ID | Task (goal, not method) | Type | [lead]/[cont] | Files | Success criteria | Verify |
|---|---|---|---|---|---|---|
| P2.T0 | P2 tests, coded from the test list below | test-writer | — | `tests/ouverture.test.mjs` | every test runs; fails only where the feature is missing | `node --test --test-concurrency=1 tests/ouverture.test.mjs` |
| P2.T1 | Opening state machine: impact overlay → dialog, guards, close paths, focus return, reduced motion; closed-case refusal (talisman shake + `REPLIQUES_FERMEES` line in `#message`) | complex-frontend | [lead] | `app/index.html`, `app/style.css`, `app/app.js` | c1–c4, c11–c17, c19 (the whole `tests/ouverture.test.mjs` passes) | `node --check app/app.js && node --test --test-concurrency=1 tests/ouverture.test.mjs tests/planche.test.mjs` |
| P2.T2 | Manga-page dialog styling, `.fenetre-anime` typography, quiz and link styling, talisman look, `REPLIQUES_FERMEES` writing (French, funny, offbeat, no copyrighted quote) | complex-frontend | [cont] | same | c5–c10, c18, c19, visual style, final `REPLIQUES_FERMEES` wording (keep the others passing) | same |

## Part success criteria (2026-12-12, 1200×900 unless stated)
- c1 Clicking a `.case.ouverte` without `aEcrire` sets `#fenetre[open]` within 1500 ms.
- c2 An element `.impact` is present within 300 ms after that click.
- c3 For a case whose `contenu.anime` exists, `#fenetre .fenetre-anime` text equals it.
- c4 That `.fenetre-anime` has a computed font-size of at least 28 px.
- c5 `#fenetre-titre` text equals `contenu.titre` when present.
- c6 `#fenetre-corps` holds one `<p>` per non-empty line of `contenu.texte`.
- c7 In a quiz, clicking a wrong choice gives it class `fausse`.
- c8 In a quiz, after any choice the button whose text equals `reponse` has class `bonne`.
- c9 In a quiz, after any choice every choice button is disabled.
- c10 A `lien` renders as an `<a>` with `href` = `lien.url`, `target="_blank"` and `rel` containing `noopener`.
- c11 Clicking a `.case.fermee` leaves `#fenetre` without `open` 1500 ms later.
- c12 Clicking a `.case.fermee` starts at least one animation on that case (motion allowed).
- c13 Clicking `.case.fermee` number N writes in `#message` a line containing "N décembre".
- c14 Five clicks on the same `.case.fermee` produce at least 2 distinct `#message` texts.
- c15 Two clicks 50 ms apart on the same open case open the dialog once and add nothing to `erreurs`.
- c16 Escape closes `#fenetre` and `document.activeElement.dataset.jour` equals the clicked case number.
- c17 With reduced motion, clicking an open case sets `#fenetre[open]` within 150 ms and no `.impact` appears.
- c18 Clicking a `.case.a-ecrire` that is open shows "pas encore de contenu" in `#fenetre`.
- c19 Case fields reach the DOM only through `textContent` or attributes (diff read: no `innerHTML`, `outerHTML`, `insertAdjacentHTML` with case data).

## Test list (written by the orchestrator, coded as-is by the test-writer) — `tests/ouverture.test.mjs`
Setup: `node:test` (`describe`, `it`, `before`, `after`), `node:assert/strict`, helper `tests/outils/navigateur.mjs` used as-is (`navigateurPresent`, `demarrerApercu`, `ouvrirPage` → `{ evaluer, cliquer, touche, attendre, relacher, capturer, erreurs, fermer }`; read it, do not change it). One server: `demarrerApercu({ date: '2026-12-12', port: 8111 })` in `before`, stopped in `after`. Data `d` = `await (await fetch(new URL('donnees.json', url))).json()` in `before`. **Each test opens its own fresh page** (`ouvrirPage(url)`, 1200×900, motion allowed unless stated) and closes it in a `finally`. "Ready" = poll with `evaluer` every 100 ms until `document.querySelectorAll('#grille .case').length === 24` (max 10 s). Browser missing → `t.skip('navigateur absent')`. A needed case type absent from `d` → `t.skip('<reason>')`. Per-test timeout 30 s, hooks 60 s. Normalise text: `textContent`, non-breaking spaces → space, collapse whitespace, trim. Every test ends by asserting `erreurs` is empty (message lists them).
Shared definitions:
- "openable case" = a data case with `etat` `ouverte` or `du-jour`, no `aEcrire`, and a `contenu` object; pick the first in `jour` order matching the extra condition of the test.
- "in-page probe" (install with `evaluer` before the click): `window.__sonde = { clic: null, impact: null, ouvertures: 0, ouvertA: null, impactVu: false }`; a capturing `pointerdown` listener on `document` sets `clic = performance.now()` (first time only); a `MutationObserver` on `document.documentElement` (`childList`, `subtree`, `attributes`, `attributeFilter: ['class', 'open']`) sets `impact = performance.now()` and `impactVu = true` the first time an element matching `.impact` exists, and counts in `ouvertures` every change of `#fenetre` from not-open to open (setting `ouvertA = performance.now()` the first time).
- "choice buttons" of a quiz = buttons inside `#fenetre` whose normalised text equals one of `quiz.choix` (normalised); to click one, set `data-sonde-choix="<index>"` on it with `evaluer`, then `cliquer('[data-sonde-choix="<index>"]')`.
- "open the case N" = ready, then `cliquer('.case[data-jour="N"]')`, then poll every 50 ms until `document.getElementById('fenetre').open` (max 2000 ms; fail if never).
- T1 [c1] ouverture d'une case ouverte — openable case (any) · probe installed · `cliquer` the case · poll every 50 ms up to 1500 ms after the click · `#fenetre.open` is true.
- T2 [c2] impact visible au clic — openable case · probe · click · `attendre(1500)` · `__sonde.impact` is set and `__sonde.impact - __sonde.clic <= 300`.
- T3 [contract] impact retiré après ouverture — openable case · open the case · `attendre(1000)` · `document.querySelectorAll('.impact').length === 0` and `#fenetre.open` is still true.
- T4 [c3] nom de l'anime — openable case with `contenu.anime` (else skip) · open it · normalised text of `#fenetre .fenetre-anime` equals normalised `contenu.anime`.
- T5 [c4] nom de l'anime en grand — same case · computed `font-size` of `#fenetre .fenetre-anime` ≥ 28 px.
- T6 [c5] titre de la case — openable case with `contenu.titre` (else skip) · open it · normalised `#fenetre-titre` text equals normalised `contenu.titre`.
- T7 [c6] un paragraphe par ligne — openable case with `contenu.texte` and without `quiz` (fallback: with `texte`, any; none → skip) · open it · lines = `texte.split('\n')` normalised, empty ones dropped · the list of normalised texts of `#fenetre-corps p` contains `lines` as a contiguous run in the same order, and the count of `#fenetre-corps p` whose text equals one of `lines` is `lines.length`.
- T8 [c7] mauvaise réponse marquée — openable case with `contenu.quiz` having at least one choice ≠ `reponse` (else skip) · open it · click the first wrong choice button · within 500 ms that button has class `fausse`.
- T9 [c8] bonne réponse révélée après une erreur — same case · open · click the first wrong choice · the choice button whose text equals `reponse` has class `bonne`.
- T10 [c8] bonne réponse choisie — openable case with `contenu.quiz` (else skip) · open · click the choice button equal to `reponse` · it has class `bonne` and not `fausse`.
- T11 [c9] choix verrouillés — openable case with `contenu.quiz` (else skip) · open · click any choice · every choice button has `disabled === true`.
- T12 [c10] lien sûr — openable case with `contenu.lien` (else skip) · open · an `<a>` inside `#fenetre` has `getAttribute('href')` equal to `lien.url`, `target` = `_blank`, `rel` containing `noopener`.
- T13 [c11] case fermée refusée — first `.case.fermee` in DOM order (none → skip) · ready · `cliquer` it · `attendre(1500)` · `#fenetre.open` is false.
- T14 [c12] le talisman tremble — first `.case.fermee` · ready · record (with `evaluer`) the animations whose `effect.target` is the case, inside the case, or its parent `li` (store them in `window.__avant`) · `cliquer` it · poll every 30 ms for 800 ms: at least one animation from `document.getAnimations()` targets the case, an element inside it, or its `li`, and is not in `window.__avant`.
- T15 [c13] date dans la réplique — first `.case.fermee`, N = its `data-jour` · ready · `cliquer` it · `attendre(300)` · normalised `#message` text contains `${N} décembre`.
- T16 [c14] répliques variées — same case · ready · 5 × (`cliquer` it, `attendre(400)`, read normalised `#message`) · at least 2 distinct texts, and every text contains `${N} décembre`.
- T17 [c15] double clic sans double ouverture — openable case · ready · probe · `cliquer` the case, `attendre(50)`, `cliquer` the same selector again (if the second `cliquer` throws because the element is covered or missing, ignore that error) · `attendre(1500)` · `#fenetre.open` is true, `__sonde.ouvertures === 1`, `erreurs` empty.
- T18 [c15] clic sur la case pendant que la fenêtre est ouverte — openable case · open it · probe counters reset (`__sonde.ouvertures = 0`) · `evaluer` `document.querySelector('.case[data-jour="N"]').click()` (must not throw) · `attendre(1500)` · `#fenetre.open` still true, `__sonde.ouvertures === 0`, `erreurs` empty.
- T19 [c16] Échap ferme et rend le focus — openable case N · open it · `touche('Escape')` · poll up to 1000 ms until `#fenetre.open` is false · `document.activeElement.dataset.jour === String(N)`.
- T20 [c16] bouton fermer — openable case N · open it · `cliquer('#fermer')` · poll up to 1000 ms until closed · `document.activeElement.dataset.jour === String(N)`.
- T21 [c16] clic sur le fond — openable case N · open it · if the `#fenetre` box contains the point (3, 3) → skip ('la fenêtre couvre le coin') · inject `<div id="sonde-fond" style="position:fixed;left:0;top:0;width:6px;height:6px;pointer-events:none">` into `body` · `cliquer('#sonde-fond')` (a real click at (3, 3), which lands on the backdrop) · poll up to 1000 ms until closed · `document.activeElement.dataset.jour === String(N)`.
- T22 [c17] mouvement réduit : ouverture immédiate — page opened with `mouvementReduit: true` · openable case · probe · click · `attendre(1000)` · `__sonde.ouvertA` is set, `__sonde.ouvertA - __sonde.clic <= 150`, `__sonde.impactVu === false`.
- T23 [c18] case à écrire — data case with `etat` `ouverte` or `du-jour` and `aEcrire: true` (else skip 'aucune case ouverte à écrire') · open it · normalised text of `#fenetre` contains "pas encore de contenu".
