# 01 planche-manga — sub-plan (self-contained)

## Objective
Redesign of the Advent calendar page for the theme "un anime par jour" (for friends, funny and offbeat tone). In this part the grid becomes a **manga page**: 24 panels of irregular sizes and angles on a halftone / paper background, with header, legend, preview banner, end message and footer restyled; the three states stay readable without colour; mobile 360 px works without zoom; the motion contract is in place. All graphics are original CSS/SVG (no image copied from an anime), no npm dependency, no framework.

## Scope
- In: `app/index.html`, `app/style.css`, `app/app.js` (rendering of the grid and header only), `tests/outils/navigateur.mjs`, `tests/planche.test.mjs`.
- Out: everything else. Never touch `scripts/**`, `contenu/**`, `.cle`, `calendrier.json`, `package.json`, `.gitignore`, `.github/**`, `AGENTS.md`, `CLAUDE.md`, `LISEZ-MOI.md`, `brief.md`, `prompt-contenu.md`, `exemples-de-cases.md`, `skills/`, `.claude/`, `.to-do/`. Never open or quote `contenu/` files or `.cle` (secrets). A needed data field that `/donnees.json` lacks → STATUS BLOCKED.
- Opening a case (impact, dialog styling, closed-case refusal) is the NEXT part: do not build it here; keep the existing `ouvrirCase` / dialog behaviour working as it is.

## Conventions & commands (copied)
- Stack: static page, vanilla browser JS (classic script, `defer`), plain CSS; Node 24 ES modules for build and preview (`package.json` `"type": "module"`, zero dependencies). Windows, Git Bash.
- `app/index.html`, `app/style.css`, `app/app.js` = the page · `scripts/apercu.mjs` serves `app/` + computes `/donnees.json` on each request at a simulated date.
- Preview: `node scripts/apercu.mjs --date 2026-12-12 --port 8095` (port non-zero). Test: `node --test --test-concurrency=1 tests/` · single test `node --test --test-concurrency=1 --test-name-pattern "c5" tests/planche.test.mjs` · syntax `node --check app/app.js`.
- French everywhere (UI text, comments, identifiers: `creerCase`, `annoncer`, `$ = getElementById`) · case text set only through `textContent` / attributes; `innerHTML` only for the constant `ICONES` SVG strings · colours as CSS custom properties on `:root` · one aria-live `#message` for announcements · `<dialog>` + `showModal()` for an opened case.
- Imitate: `app/app.js` (`creerCase`, `ouvrirCase`, `creerQuiz`, `afficher`), `app/style.css` (tokens, states).

## Data contract (read-only) `GET /donnees.json`
`{ titre, sousTitre, annee, heureOuverture, fini, motDeFin? (only when fini), version, genereLe, apercu?: { date }, cases: [{ jour: 1..24, etat: "ouverte"|"du-jour"|"fermee", ouverture: ISO, aEcrire?: true, contenu?: { anime?, titre?, texte?, lien?: { url, libelle }, quiz?: { question, choix[], reponse, explication? } } }] }`. The page uses `apercu.date` as "now" when present. Content lives in a gitignored file and changes: never hard-code case texts.

## Contracts (copied, exact)
- DOM hooks kept: `#grille` (`ol`) › `li` › `button.case.<etat>[data-jour]` with children `.numero`, `.etiquette`, `.icone` (an `<svg>`); `.a-ecrire` on a case without content; ids `#titre`, `#sous-titre`, `#bandeau-apercu`, `#mot-de-fin`, `#message`, `#pied`, `#fenetre`, `#fenetre-jour`, `#fenetre-titre`, `#fenetre-corps`, `#fermer`.
- Panel order: DOM order 1→24 = visual order, left to right then top to bottom. No `grid-auto-flow: dense`.
- Motion contract: every animation and transition is cancelled under `@media (prefers-reduced-motion: reduce)` by one global rule in `style.css`; JS reads `matchMedia('(prefers-reduced-motion: reduce)')` before any timed sequence.
- Fonts: Google Fonts `<link>` only (display font for numbers/titles + a Japanese-capable font), with system fallbacks including `"Yu Gothic", "Meiryo", sans-serif` for kana. `app/` loads external resources only from `fonts.googleapis.com` and `fonts.gstatic.com`.
- Test helper `tests/outils/navigateur.mjs`: see the test list below (written once here, reused unchanged by later parts).

## Context pack (scout, 2026-11-16)

**Files and symbols to change**
- `app/index.html`: ids and tags: `#bandeau-apercu` p:11, `#titre` h1:14, `#sous-titre` p:15, `#mot-de-fin` p:23, `#grille` ol:26, `#message` p:27 (role=status), `#pied` footer:30, `#fenetre` dialog:32, `#fenetre-jour` p:34, `#fermer` button:35, `#fenetre-titre` h2:37, `#fenetre-corps` div:38. Legend `ul.legende` with `span.pastille[data-icone]` :16-20. `<meta viewport>` :5. No `<link>` to fonts (only `style.css` :8). Script `<script src="app.js" defer>` :41.
- `app/style.css:1-15` `:root` tokens: `--fond`, `--fond-2`, `--texte`, `--texte-doux`, `--accent`, `--accent-texte`, `--ouverte`, `--ouverte-texte`, `--fermee`, `--fermee-bord`, `--a-ecrire`, `--rayon`; `color-scheme: dark`.
- Grid: `.grille` :50 (4 cols, 6 cols at min-width 640px :55-57). `.case` :59-65 (aspect-ratio 1/0.9, 1 at 640px). `.case .numero/.etiquette/.icone` :67-70.
- States: `.case.ouverte` :72-73; `.case.du-jour` :75-80 (outline, radius 50%/46%); `.case.fermee` :82-85 (repeating-linear-gradient, `cursor:not-allowed`). `.case.a-ecrire` :87-92 (inset box-shadow + `::after` "à écrire" label). Focus :94. Reduced motion :95-96. `.mot-de-fin` :100-103. `.bandeau-apercu` :105-108. `.fenetre` :115-120. Quiz styles :132-142.
- `app/app.js`: `ICONES` :4-8; `MOTS` :10; `creerCase` :37-71; `creerQuiz` :80-102; `ouvrirCase` :104-126; `afficher` :133-155; `annoncer` :33-35; `$` :16.
- No `clip-path`, no `@keyframes`/`animation`. `transform` used at :73 (`.case.ouverte:hover`), :89 (`.a-ecrire::after`), :112 (`.case.du-jour .icone`). `transition` :95.

**Who calls what**
- `afficher(d)` is called by the fetch chain (`app.js:160-166`). `creerCase` is called by `afficher` (:149). `ouvrirCase` is called by the click handler of an open case (:66). `creerQuiz` is called by `ouvrirCase` (:116). `annoncer` is called by `creerCase` (closed-case click, :62) and the fetch catch (:166).

**Existing texts and contracts**
- `.etiquette` text: `fermee` → `à HH:MM` if same Paris day, else `le 13 déc.` (`quandCourt` :25-27). `ouverte` → "Ouverte". `du-jour` → "Aujourd'hui" (:10, :55).
- `aria-label`: closed → `Case N, pas encore disponible. Elle s'ouvrira <quandLong>.` plus `aria-disabled="true"` (:60-61). Open → `Case N, ouverte.` or `Case N, case du jour.`, with `, contenu à écrire` appended when `aEcrire` (:64-65).
- Closed-case click message: `La case N n'est pas encore disponible. Elle s'ouvrira <quandLong>.` (:62). Load-error message: "Le calendrier n'a pas pu se charger. Rechargez la page dans un instant." (:166).
- `ICONES` is injected via `innerHTML` at :46 (each case's icon) and :158 (`[data-icone]` legend pastilles).
- `#bandeau-apercu` is filled only if `d.apercu` (:139-142), text "Aperçu local, date simulée : …".
- `#mot-de-fin` is filled only if `d.fini && d.motDeFin` (:144-147).
- `#titre` at :136, `document.title` at :135, `#sous-titre` at :137.
- `#pied` at :151-154: "Cases ouvertes chaque jour à <heureOuverture>, heure de Paris · version … · mis à jour le …".
- `matchMedia`: not found (none in `app/`).
- Data fetch: `fetch('donnees.json', { cache: 'no-store' })` :160. Non-OK status throws, and any error goes to `annoncer` (:161-166).
- Data shape read by the page: `ouvrirCase` reads `c.contenu.{titre,texte,lien{libelle,url},quiz{question,choix,reponse,explication}}` and `c.contenu.anime` (:105, :113). `construire.mjs` builds `{jour, etat, ouverture}` plus `aEcrire` or `contenu` (`construire.mjs:115-123`); `nettoyer` at :56 (not read).

**Apercu server**
- `scripts/apercu.mjs:16-17`: `lireArguments` (in `construire.mjs:155-161`) parses `--date <valeur>`, `--apercu`, `--port`; default port 8080, bound to 127.0.0.1.
- Output on stdout (:53-55): `Aperçu au <date fr-FR> (date simulée) : http://localhost:<port>`, or `Aperçu à la date d'aujourd'hui : http://localhost:<port>`.
- `/donnees.json` always runs with `apercu: true` (:35). `construire.mjs:139` then adds `apercu.date` (ISO). Confirmed.
- Serves `app/` files with a path-prefix guard (:41-42); the 404 body is "Page absente".

**package.json:7-9** scripts: `apercu`, `construire`, `chiffrer`. No `test` script.
**calendrier.json**: top-level keys matched: `titre`, `sousTitre`, `annee`, `heureOuverture`, `motDeFin` (lines 2-6). Other keys not matched by my pattern: not found.

**Tests**: `tests/` does not exist (Glob empty). `tests/outils/navigateur.mjs`: not found. No test runner configured.

**Traps**
- `style.css:96` reduced-motion resets `.case:hover` (specificity 0,2,0), but `.case.ouverte:hover` (:73, 0,3,0) keeps its `translateY` under reduced motion.
- Contract says `.icone` is an `<svg>`; the actual `.icone` is a `<span>` (`app.js:44-46`) that wraps the svg.
- `.a-ecrire` on a closed case happens only in apercu mode (`construire.mjs:122`). Only open cases carry it in production.
- `.a-ecrire` is a colour-only signal apart from the `::after` label (:87-92), which is `position:absolute` at bottom: 4px. It will collide with a manga-style layout if the case is changed.
- Closed cases stay clickable (`button` with `aria-disabled`, not `disabled`); the click only announces (:62).
- `.case.du-jour .icone` (:112) and `.a-ecrire::after` (:89) use `transform` for centring; a change to `.case` layout can break them.
- `app.js:158` uses `el` as a loop variable, shadowing the `el()` helper (:73) inside that loop only.
- `maintenant` falls back to `Date.now()` when `d.apercu` is absent (:134), so production uses the real clock.
- Closed-case `.etiquette` text depends on the Paris timezone via `Intl` (:12-14, :18).

## Tasks
| ID | Task (goal, not method) | Type | [lead]/[cont] | Files | Success criteria | Verify |
|---|---|---|---|---|---|---|
| P1.T0 | Test helper + P1 tests, coded from the test list below | test-writer | — | `tests/outils/navigateur.mjs`, `tests/planche.test.mjs` | every test runs; fails only where the feature is missing | `node --test --test-concurrency=1 tests/planche.test.mjs` |
| P1.T1 | Irregular panel layout system + motion contract + fonts + halftone/paper page base | complex-frontend | [lead] | `app/index.html`, `app/style.css`, `app/app.js` | c1–c6, c18–c21, obj (and keep c7–c17 passing) | `node --check app/app.js && node --test --test-concurrency=1 tests/planche.test.mjs` |
| P1.T2 | State skins (open = inked panel, du-jour = highlighted panel, fermée = panel sealed by a paper talisman, static), legend, header, preview banner, end message, footer, `à écrire` badge in manga style | complex-frontend | [cont] | `app/index.html`, `app/style.css`, `app/app.js` | c7–c17 (and keep c1–c6, c18–c21 passing) | same |

Hard pieces of T1 (lead): varied spans and angles on desktop (6-column base) and on 360 px (3–4 columns), rows filled without gaps or overlap, upright readable content inside skewed/clipped panels, focus indicator not cut by `clip-path` (draw it on a non-clipped element); the motion contract (one global reduced-motion rule; a JS function reading `matchMedia('(prefers-reduced-motion: reduce)')` ready for later timed sequences).

## Part success criteria (at 2026-12-12 unless stated; "at 360" = 360×740 viewport via the helper)
- c1 At 1200×900, `#grille` contains 24 `.case` whose `.numero` texts are 1…24 in DOM order.
- c2 At 360, `document.documentElement.scrollWidth` ≤ 360.
- c3 At 360, every `.case` bounding box lies within x ∈ [0, 360].
- c4 At 360, every `.case` bounding box is at least 44×44 px.
- c5 At 360, the computed font-size of every `.numero` is at least 16 px.
- c6 At 1200 and at 360, no two `.case` bounding boxes intersect by more than 1 px.
- c7 Every `.case.ouverte` has `.etiquette` text "Ouverte".
- c8 The `.case.du-jour` has `.etiquette` text "Aujourd'hui".
- c9 Every `.case.fermee` has `.etiquette` text matching `/^(le \d{1,2} déc\.|à \d{2}:\d{2})$/`.
- c10 The `.icone svg` markup is identical within a state and different between the three states.
- c11 Exactly one `.case.du-jour` exists at 2026-12-12.
- c12 No `.case.du-jour` exists at 2026-11-16.
- c13 Every `.case.fermee` has `aria-disabled="true"` and an `aria-label` containing "s'ouvrira".
- c14 Every `.case.a-ecrire` shows the visible text "à écrire" (element text or computed `::after` content).
- c15 At 2026-12-26, `#mot-de-fin` is visible and its text equals `motDeFin` from `/donnees.json`.
- c16 `#bandeau-apercu` is visible and contains "date simulée".
- c17 Each `.numero` colour has a contrast ratio of at least 4.5:1 against the nearest ancestor-or-self with an opaque `background-color`.
- c18 After `element.focus()` on a `.case` with keyboard modality, the element drawing the focus indicator has a non-`none` outline or box-shadow and no `clip-path`.
- c19 With reduced motion emulated, `document.getAnimations()` is empty 1 s after load.
- c20 `app/` loads external resources only from `fonts.googleapis.com` and `fonts.gstatic.com` (diff read).
- c21 In `app/app.js`, `innerHTML` is assigned only from the `ICONES` constant (diff read).
- obj The panels have irregular sizes: at 1200 at least 3 distinct widths and 2 distinct heights; at 360 at least 2 distinct widths.

## Test helper spec — `tests/outils/navigateur.mjs` (written by the test-writer, frozen afterwards)
Zero dependency, ES module, Node 24 (global `fetch`, global `WebSocket`), `node:child_process`, `node:fs`, `node:os`, `node:path`. Every wait has a timeout: nothing may hang.
- `export const CHEMIN_NAVIGATEUR` = `process.env.NAVIGATEUR` or `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- `export function navigateurPresent()` → `true` when that file exists.
- `export async function demarrerApercu({ date, port })` → spawns `process.execPath` with `scripts/apercu.mjs --date <date> --port <port>`, cwd = repository root (resolved from `import.meta.url`, two levels up). Resolves `{ url, arreter }` when stdout prints a line containing a URL (`/https?:\/\/\S+/`; the server prints `… : http://localhost:<port>`): `url` = that URL with `localhost` replaced by `127.0.0.1` and a trailing `/`. Rejects after 10 s, or if the process exits first (message includes stderr). `arreter()` kills the process and resolves when it exited (at most 3 s, never throws).
- `export async function ouvrirPage(url, { largeur = 1200, hauteur = 900, mouvementReduit = false, retenirDonnees = false, echecDonnees = false } = {})`:
  1. temp dir via `fs.mkdtempSync(path.join(os.tmpdir(), 'navigateur-'))`; spawn the browser with `--headless=new --remote-debugging-port=0 --user-data-dir=<tmp> --no-first-run --no-default-browser-check --disable-extensions --window-size=1280,1000 about:blank`;
  2. poll `<tmp>/DevToolsActivePort` every 100 ms (max 15 s), first line = port; poll `http://127.0.0.1:<port>/json/list` (max 5 s) for a target of `type: "page"`, connect a `WebSocket` to its `webSocketDebuggerUrl`;
  3. `envoyer(method, params)` sends `{ id, method, params }` and resolves the matching reply's `result` (rejects on `error`, rejects after 10 s with the method name);
  4. `Page.enable`, `Runtime.enable`; `Runtime.exceptionThrown` → push `exceptionDetails.exception?.description || exceptionDetails.text` to `erreurs`;
  5. `Emulation.setDeviceMetricsOverride({ width: largeur, height: hauteur, deviceScaleFactor: 1, mobile: largeur < 600 })` (headless windows cannot go below ~496 px: width only through this call) and `Emulation.setEmulatedMedia({ features: [{ name: 'prefers-reduced-motion', value: mouvementReduit ? 'reduce' : 'no-preference' }] })`;
  6. when `retenirDonnees` or `echecDonnees`: `Fetch.enable({ patterns: [{ urlPattern: '*donnees.json*', requestStage: 'Request' }] })`; on `Fetch.requestPaused`: `echecDonnees` → `Fetch.failRequest({ requestId, errorReason: 'Failed' })`; `retenirDonnees` → keep the `requestId` until `relacher()`;
  7. `Page.navigate({ url })`, then wait for `Page.loadEventFired` at most 15 s (on timeout continue, do not throw).
  Returns `{ evaluer, cliquer, touche, attendre, relacher, capturer, erreurs, fermer }`:
  - `evaluer(expr)` → `Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true })`; throws an `Error` with the exception description when `exceptionDetails` is set; returns `result.value`.
  - `cliquer(selecteur)` → scrolls the first matching element into view (`block: 'center'`), reads its bounding box (throws `élément introuvable : <selecteur>` if none), sends `Input.dispatchMouseEvent` `mouseMoved`, `mousePressed`, `mouseReleased` (button `left`, `clickCount: 1`) at the box centre.
  - `touche(nom)` → `Input.dispatchKeyEvent` `keyDown` then `keyUp` with `key`, `code`, `windowsVirtualKeyCode` for at least `Tab` (9), `Escape` (27), `Enter` (13, keyDown carries `text: '\r'`), `Space` (key `' '`, 32, keyDown carries `text: ' '`).
  - `attendre(ms)` → promise resolved after `ms`.
  - `relacher()` → `Fetch.continueRequest` for every held request.
  - `capturer(chemin, { pleinePage = true } = {})` → PNG via `Page.captureScreenshot` (`pleinePage`: `captureBeyondViewport: true` with a clip of `Page.getLayoutMetrics().cssContentSize`, scale 1); creates the parent folder; writes the file.
  - `erreurs` → the live array of exceptions.
  - `fermer()` → `Browser.close` (2 s max), close the socket, kill the process tree if still alive (`taskkill /pid <pid> /T /F` on win32), remove the temp dir (`{ recursive: true, force: true, maxRetries: 3 }`); never throws, returns within ~8 s.

## Test list (written by the orchestrator, coded as-is by the test-writer) — `tests/planche.test.mjs`
Setup: `node:test` (`describe`, `it`, `before`, `after`), `node:assert/strict`. Servers: `demarrerApercu` for 2026-12-12 on port 8101, 2026-11-16 on 8102, 2026-12-26 on 8103 (stopped in `after`). Pages are opened once per viewport/date in `before` hooks and closed in `after` (pages: A = 12-12 at 1200×900 · B = 12-12 at 360×740 · C = 11-16 at 1200×900 · D = 12-26 at 1200×900 · E = 12-12 at 1200×900 with `mouvementReduit: true`). "Ready" = poll with `evaluer` every 100 ms until `document.querySelectorAll('#grille .case').length === 24` (max 10 s; fail with a clear message). The data `d` of a date = `await (await fetch(new URL('donnees.json', url))).json()`. Browser missing → every test calls `t.skip('navigateur absent')`. Per-test timeout 30 s, hooks 60 s. Normalise text: `textContent`, non-breaking spaces → space, trim. Apostrophes: accept `'` and `’`. Never hard-code case texts.
- T1 [c1] numéros dans l'ordre — given page A ready · then `#grille` is an `OL`, it has 24 `.case` each inside an `li` child of `#grille`, and their `.numero` texts in DOM order are "1"…"24".
- T2 [c1] ordre visuel = ordre DOM — given page A ready · then for every consecutive pair (n, n+1) of `.case` bounding boxes, box n+1 has `left` greater than box n's `left` + 4 OR `top` greater than box n's `top` + 4.
- T3 [c1] ordre visuel à 360 — same as T2 on page B.
- T4 [c2] pas de défilement horizontal à 360 — given page B ready · then `document.documentElement.scrollWidth <= 360`.
- T5 [c3] cases dans l'écran à 360 — page B · every `.case` box has `left >= -0.5` and `right <= 360.5`.
- T6 [c4] cases assez grandes à 360 — page B · every `.case` box has `width >= 44` and `height >= 44`.
- T7 [c5] numéros lisibles à 360 — page B · every `.numero` computed `font-size` ≥ 16 px.
- T8 [c6] pas de chevauchement à 1200 — page A · for every pair of `.case` boxes, NOT (overlapX > 1 AND overlapY > 1), where overlapX = min(right) − max(left), overlapY = min(bottom) − max(top); the failure message names the pair.
- T9 [c6] pas de chevauchement à 360 — same as T8 on page B.
- T10 [obj] tailles irrégulières — page A: the `.case` box widths rounded to the nearest 2 px take ≥ 3 distinct values and the heights ≥ 2 distinct values · page B: widths take ≥ 2 distinct values.
- T11 [c7] étiquette « Ouverte » — page A · at least one `.case.ouverte` exists and every `.case.ouverte .etiquette` text is exactly "Ouverte".
- T12 [c7, c11] états conformes aux données — page A + data of 2026-12-12 · for each data case, the `.case[data-jour="<jour>"]` has the class equal to its `etat` and not the two other state classes.
- T13 [c8] étiquette « Aujourd'hui » — page A · the `.case.du-jour .etiquette` text equals "Aujourd'hui" (either apostrophe).
- T14 [c9] étiquette des cases fermées — page A · at least one `.case.fermee` exists and every `.case.fermee .etiquette` text matches `/^(le \d{1,2} déc\.|à \d{2}:\d{2})$/`.
- T15 [c10] pictogramme par état — page A · each `.case` has an `.icone` that is, or contains, an `<svg>`; group the svg `outerHTML` by state class (`ouverte`, `du-jour`, `fermee`): inside each group all values are identical; the three groups' values are pairwise different.
- T16 [c11] une seule case du jour le 12 — page A + data · exactly one `.case.du-jour`, and its `data-jour` equals the `jour` of the data case with `etat: "du-jour"`.
- T17 [c12] aucune case du jour le 16 novembre — page C ready · zero `.case.du-jour`; 24 `.case.fermee`.
- T18 [c13] cases fermées annoncées — page A · every `.case.fermee` has `aria-disabled` = "true" and an `aria-label` matching `/s['’]ouvrira/`.
- T19 [c14] badge « à écrire » — page A + data · the set of `data-jour` with class `.a-ecrire` equals the set of data cases with `aEcrire: true`; if that set is empty → `t.skip('aucune case à écrire dans les données')`; else every `.case.a-ecrire` has "à écrire" in its normalised text, or in the computed `content` of its `::after` or `::before`.
- T20 [c15] mot de fin le 26 — page D + data of 2026-12-26 · if `!d.fini || !d.motDeFin` → `t.skip('pas de mot de fin dans les données')`; else `#mot-de-fin` is visible and its normalised text equals the normalised `motDeFin`. Visible = exists, no `hidden` attribute, computed `display` ≠ `none`, `visibility` ≠ `hidden`, box width > 0 and height > 0.
- T21 [c15] pas de mot de fin le 12 — page A · `#mot-de-fin` is not visible.
- T22 [c16] bandeau d'aperçu — page A · `#bandeau-apercu` is visible and its text contains "date simulée".
- T23 [c17] contraste des numéros — page A · for every `.numero`: convert colours to RGBA through a 1×1 canvas in the page (`ctx.fillStyle = c; ctx.fillRect(0,0,1,1); getImageData`) so any CSS colour syntax works; foreground = computed `color`; background = the first element, from the `.numero` itself up through its ancestors, whose computed `background-color` has alpha 255 (none found → fail with the case number); WCAG relative-luminance contrast ratio ≥ 4.5 (message names the case and the ratio).
- T24 [c18] indicateur de focus non découpé — page A · `touche('Tab')` once (keyboard modality); for the first `.case.ouverte`, the `.case.du-jour` and the first `.case.fermee`: candidates = the button, its `::before`, `::after`, its parent `li`, the `li`'s `::before`, `::after`; record each candidate's computed `outline-style`, `outline-width`, `box-shadow` with the button blurred (`document.activeElement.blur()`), then call `button.focus()` and record again; then at least one candidate changed so that it now has (`outline-style` ≠ `none` and `outline-width` ≠ `0px`) or `box-shadow` ≠ `none`; and for one such candidate, its computed `clip-path` is `none` and the computed `clip-path` of its host element (for a pseudo-element) and of every ancestor up to `#grille` is `none`.
- T25 [c19] mouvement réduit : aucune animation — page E ready · `attendre(1000)` · `document.getAnimations().length === 0` (message lists the animation names / targets found).
- T26 [—] aucune erreur JavaScript — pages A, B, C, D, E · after ready, `erreurs` is empty.
