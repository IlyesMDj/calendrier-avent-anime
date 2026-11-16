# Refonte « planche de manga » du calendrier (un anime par jour)

> Executed by an orchestrator agent: read `.to-do/_tools/protocol.md` first, then run it on this plan. Routing verified 2026-11-16 on Windows 11 / Git Bash 5.3 (MINGW64).

## 1. Goal
Redesign the Advent calendar page (palier 1 of `brief.md`) for the theme "un anime par jour", for friends, funny and offbeat tone: the page becomes an animated manga page (irregular panels, halftone, speed lines, onomatopoeia, impact on opening). Only the front end changes (`app/`). Non-goals: no change to date logic, build, encryption or content (`scripts/`, `contenu/`, `calendrier.json`), no deployment, no robot, no npm dependency, no framework, no image copied from an anime (all graphics original CSS/SVG).

**Overall success criteria** — judged by the final review (protocol §2 step 7); the plan is not done before they all pass.
- [ ] G1 — End-to-end at simulated date 2026-12-12 (`npm run apercu -- --date 2026-12-12 --port 8091`): the loading screen disappears, 24 panels show, clicking case 12 (case du jour) plays the impact then opens `#fenetre` showing that case's `contenu.anime` from `/donnees.json`, Escape closes it and focus returns to case 12, clicking case 13 writes a line containing "13 décembre" in `#message` and `#fenetre` stays closed.
- [ ] G2 — In the built site for 2026-12-12, every case with `etat: "fermee"` has exactly the keys `jour`, `etat`, `ouverture`: `node scripts/construire.mjs --date 2026-12-12 && node -e "const d=require('./_site/donnees.json');const b=d.cases.filter(c=>c.etat==='fermee'&&Object.keys(c).some(k=>!['jour','etat','ouverture'].includes(k)));if(b.length){console.error(b);process.exit(1)}console.log('ok')"`
- [ ] G3 — Full suite and syntax check pass: `node --check app/app.js && node --test --test-concurrency=1 tests/`
- [ ] G4 — Files changed on `BRANCH` vs its base are only under `app/`, `tests/`, `.to-do/`: `git diff --name-only <base>...HEAD`.
- [ ] G5 — Screenshots at 1200 px wide for 2026-11-16, 2026-12-12 and 2026-12-26 (saved in `W/captures/`) show irregular panel sizes and angles, a halftone texture and 24 legible numbers — checked by the arbiter reading the images.

## 2. Codebase brief
- **Stack**: static page, vanilla browser JS (classic script, `defer`), plain CSS; Node 24 ES modules for build and preview (`package.json` `"type": "module"`, zero dependencies). Windows, Git Bash.
- **Layout**: `app/index.html`, `app/style.css`, `app/app.js` = the page (copied as-is into `_site/`) · `scripts/construire.mjs` builds `_site/donnees.json` (only opened cases carry content) · `scripts/apercu.mjs` serves `app/` + computes `/donnees.json` on each request at a simulated date · `scripts/temps.mjs` Paris-time logic · `calendrier.json` settings · `contenu/` case texts (clear file gitignored, encrypted file + local `.cle` key).
- **Commands**: install none · build `node scripts/construire.mjs --date 2026-12-12` · preview `npm run apercu -- --date 2026-12-12 --port 8091` (port must be non-zero: `0` falls back to 8080) · test `node --test --test-concurrency=1 tests/` · single test `node --test --test-concurrency=1 --test-name-pattern "<nom>" tests/` · syntax `node --check app/app.js` · lint none · typecheck none.
- **Data contract (read-only)** `GET /donnees.json`: `{ titre, sousTitre, annee, heureOuverture, fini, motDeFin? (only when fini), version, genereLe, apercu?: { date }, cases: [{ jour: 1..24, etat: "ouverte"|"du-jour"|"fermee", ouverture: ISO, aEcrire?: true, contenu?: { anime?, titre?, texte?, lien?: { url, libelle }, quiz?: { question, choix[], reponse, explication? } } }] }`. The page uses `apercu.date` as "now" when present.
- **Conventions**: French everywhere (UI text, comments, identifiers: `creerCase`, `annoncer`, `$ = getElementById`) · case text set only through `textContent` / attributes; `innerHTML` only for the constant `ICONES` SVG strings · colours as CSS custom properties on `:root` · existing `prefers-reduced-motion` block in `style.css` · one aria-live `#message` for announcements · `<dialog>` + `showModal()` for an opened case.
- **Imitate**: `app/app.js` (`creerCase`, `ouvrirCase`, `creerQuiz`, `afficher`), `app/style.css` (tokens, states).
- **Do not touch**: `scripts/**`, `contenu/**`, `.cle`, `calendrier.json`, `package.json`, `.gitignore`, `.github/**`, kit files (`AGENTS.md`, `CLAUDE.md`, `LISEZ-MOI.md`, `brief.md`, `prompt-contenu.md`, `exemples-de-cases.md`, `skills/`, `.claude/`). A needed data field that `/donnees.json` lacks → STATUS BLOCKED, never edit `scripts/`.
- **Agent instructions**: `AGENTS.md` is the single source of project rules — `CLAUDE.md` imports it (`@AGENTS.md`); every worker here is a Claude worker.

## 3. Parts

| # | Part | Type | Major | Depends on | Parallel-safe with | Weight |
|---|---|---|---|---|---|---|
| P1 | planche-manga | complex-frontend | yes | — | — | 40 |
| P2 | ouverture-impact | complex-frontend | yes | P1 | — | 35 |
| P3 | ambiance-animee | frontend | no | P2 | — | 25 |

Major = sub-plan written first (protocol §2). Minor = one task, one self-contained brief. All three parts edit the same three files: strictly sequential.

### P1 — planche-manga
- **Objective**: the grid becomes a manga page: 24 panels of irregular sizes and angles on a halftone/paper background, with header, legend, preview banner, end message and footer restyled; the three states stay readable without colour; mobile 360 px works without zoom; the motion contract is in place.
- **Scope**: in `app/index.html`, `app/style.css`, `app/app.js` (rendering of the grid and header only), `tests/outils/navigateur.mjs`, `tests/planche.test.mjs` · out everything else.
- **Contracts** (P2, P3 and the tests rely on them):
  - DOM hooks kept: `#grille` (`ol`) › `li` › `button.case.<etat>[data-jour]` with children `.numero`, `.etiquette`, `.icone` (an `<svg>`); `.a-ecrire` on a case without content; ids `#titre`, `#sous-titre`, `#bandeau-apercu`, `#mot-de-fin`, `#message`, `#pied`, `#fenetre`, `#fenetre-jour`, `#fenetre-titre`, `#fenetre-corps`, `#fermer`.
  - Panel order: DOM order 1→24 = visual order, left to right then top to bottom. No `grid-auto-flow: dense`.
  - Motion contract: every animation and transition is cancelled under `@media (prefers-reduced-motion: reduce)` by one global rule in `style.css`; JS reads `matchMedia('(prefers-reduced-motion: reduce)')` before any timed sequence.
  - Fonts: Google Fonts `<link>` only (display font for numbers/titles + a Japanese-capable font), with system fallbacks including `"Yu Gothic", "Meiryo", sans-serif` for kana.
  - Test helper `tests/outils/navigateur.mjs` (zero dependency, Node 24 global `WebSocket`, `node:test`): `demarrerApercu({ date, port })` → spawns `node scripts/apercu.mjs --date <date> --port <port>`, resolves `{ url, arreter() }` once stdout prints the URL · `ouvrirPage(url, { largeur, hauteur, mouvementReduit, retenirDonnees, echecDonnees })` → launches the browser headless (`NAVIGATEUR` env, default `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) with `--remote-debugging-port=0` and a temp `--user-data-dir`, reads `DevToolsActivePort`, applies `Emulation.setDeviceMetricsOverride` (headless windows cannot go below ~496 px: width only through this call) and `Emulation.setEmulatedMedia` for `prefers-reduced-motion`; `retenirDonnees` / `echecDonnees` hold or fail `/donnees.json` through the `Fetch` domain; returns `{ evaluer(expr), cliquer(selecteur), touche(nom), attendre(ms), relacher(), erreurs, fermer() }` where `erreurs` collects `Runtime.exceptionThrown`. Browser missing → tests call `t.skip('navigateur absent')`. Each test file uses its own fixed ports (P1 8101–8109, P2 8111–8119, P3 8121–8129).
  - Tests read expectations from the page's `/donnees.json` (content lives in a gitignored file and changes): a test needing a case type that is absent (quiz, lien, anime, aEcrire) skips with the reason.
- **Hard pieces**: [lead] the irregular panel layout system: varied spans and angles on desktop (6-column base) and on 360 px (3–4 columns), rows filled without gaps or overlap, upright readable content inside skewed/clipped panels, focus indicator not cut by `clip-path` (draw it on a non-clipped element) · [lead] motion contract · [cont] state skins (open = inked panel, du-jour = highlighted panel, fermée = panel sealed by a paper talisman, static here), legend, header, banner, end message, footer, `à écrire` badge, test helper.
- **Success criteria** (at 2026-12-12 unless stated; "at 360" = 360×740 via the helper):
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
- **Tests first**: c1–c19 → `tests/planche.test.mjs` (+ helper `tests/outils/navigateur.mjs`), single test `node --test --test-concurrency=1 --test-name-pattern "c5" tests/planche.test.mjs` · c20, c21 by diff reading.
- **Verify**: `node --check app/app.js && node --test --test-concurrency=1 tests/planche.test.mjs`

### P2 — ouverture-impact
- **Objective**: opening an open case plays an impact (flash, speed lines, onomatopoeia) then opens `#fenetre` styled as a manga page with the anime name in large type; a closed case refuses with a shaking talisman and a funny line giving its opening date.
- **Scope**: in `app/index.html` (dialog markup, impact layer), `app/style.css` (impact, dialog, quiz, talisman shake), `app/app.js` (`ouvrirCase`, closed-case click handler, quiz, sequencing), `tests/ouverture.test.mjs` · out grid layout from P1 (reuse its hooks), everything outside `app/` and `tests/`.
- **Contracts**: impact overlay element has class `impact` and exists only during the sequence · anime name rendered in `.fenetre-anime` inside `#fenetre` · closed-case lines live in one editable constant array `REPLIQUES_FERMEES` in `app/app.js`, each line built with the case's opening date (Paris time, `Intl` `fr-FR`), e.g. « Ton niveau de puissance est insuffisant. Reviens le 13 décembre. »; at least 5 lines; a line never contains case content.
- **Hard pieces**: [lead] the opening state machine: impact → `showModal()`, a second click during the sequence or on an open dialog does nothing (no `InvalidStateError`), Escape / `#fermer` / backdrop click close it, focus returns to the originating `.case`, reduced motion opens the dialog immediately without waiting for `animationend` (which never fires when animations are cancelled) · [cont] manga-page dialog styling, `.fenetre-anime` typography, quiz and link styling, talisman shake, `REPLIQUES_FERMEES` writing (French, funny, offbeat, no copyrighted quote).
- **Success criteria** (2026-12-12, 1200×900 unless stated):
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
- **Tests first**: c1–c18 → `tests/ouverture.test.mjs`, single test `node --test --test-concurrency=1 --test-name-pattern "c13" tests/ouverture.test.mjs` · c19 by diff reading.
- **Verify**: `node --check app/app.js && node --test --test-concurrency=1 tests/ouverture.test.mjs tests/planche.test.mjs`

### P3 — ambiance-animee
- **Objective**: the page is alive: animated loading screen, moving speed lines in the background, floating onomatopoeia, an aura and floating « ゴゴゴ » around the case du jour, hover micro-animations on open panels — all decorative, all cancelled by reduced motion.
- **Scope**: in `app/index.html` (loading screen `#chargement`, decor layer), `app/style.css`, `app/app.js` (show/hide `#chargement`, decor creation), `tests/ambiance.test.mjs` · out P1 layout rules and P2 sequencing (reuse, do not rewrite).
- **Brief for the single task**: keep P1/P2 hooks and the motion contract; decor elements are `aria-hidden="true"` and `pointer-events: none`; animate only `transform`, `opacity`, `filter`, `background-position`; at most ~40 decor elements; `#chargement` is hidden on both success and failure of `/donnees.json` (error message still written to `#message`); funny loading text in French (e.g. « Chargement de l'épisode… (pas un filler, promis) »).
- **Success criteria** (2026-12-12, 1200×900):
  - c1 `#chargement` is visible while `/donnees.json` is held (`retenirDonnees`).
  - c2 `#chargement` is hidden within 1 s after `/donnees.json` is released.
  - c3 When `/donnees.json` fails (`echecDonnees`), `#chargement` is hidden and `#message` is non-empty.
  - c4 The `.case.du-jour` (or its `li`) has at least one running animation.
  - c5 A decorative element with text "ゴゴゴ" and `aria-hidden="true"` sits inside the `li` of the case du jour.
  - c6 Every element with `aria-hidden="true"` added for decor has computed `pointer-events: none`.
  - c7 With motion allowed, at least 6 animations are running 1 s after load.
  - c8 With reduced motion, `document.getAnimations()` is empty 1 s after load.
  - c9 Every `@keyframes` in `app/style.css` animates only `transform`, `opacity`, `filter` or `background-position` (diff read).
- **Tests first**: c1–c8 → `tests/ambiance.test.mjs`, single test `node --test --test-concurrency=1 --test-name-pattern "c3" tests/ambiance.test.mjs` · c9 by diff reading.
- **Verify**: `node --check app/app.js && node --test --test-concurrency=1 tests/`

## 4. Routing and variables (verified 2026-11-16)

| Task type / role | Worker model | Channel | Harness | Model argument |
|---|---|---|---|---|
| orchestrator | Claude Opus | subscription | claude | `opus` |
| complex-frontend [lead] | Claude Opus | subscription | claude | `opus` |
| complex-frontend [cont] | Claude Sonnet | subscription | claude | `sonnet` |
| frontend | Claude Sonnet | subscription | claude | `sonnet` |
| test-writer | Claude Haiku | subscription | claude | `haiku` |
| scout | Claude Haiku | subscription | claude | `haiku` |
| review reader (×2, gate off) | Claude Haiku | subscription | claude | `haiku` |
| review arbiter | Claude Fable | subscription | claude | `fable` |
| other | Claude Haiku | subscription | claude | `haiku` |

| Variable | Value |
|---|---|
| `PLAN` | `calendrier-manga` |
| `BRANCH` | `essai/calendrier-manga` (override of `feat/<plan>`: AGENTS.md calls a trial branch « un essai à part ») |
| `SHELL` | bash — flavour that ran preflight; use powershell if this machine lacks it |
| `ORCHESTRATOR` | Claude Opus in Claude Code — **required** (STRICT_HOST on) |
| `GATE` | `off` (Jev declined: no code sent to an external service) |
| `CODEGRAPH` | `off` |
| `AGENT_FILES` | none |

**Prompting notes**
- opus, sonnet, haiku, fable: a worker starts with zero history — name the files, the DOM/data contracts of §2–§3 and the criteria IDs in every brief; ask for a compact return.
- Reviewers (haiku readers, fable arbiter): report gaps against the criteria, not style; the visual criterion G5 is judged on screenshots, not taste.
- Headless Claude runs only allow-listed tools: allow the verify commands per dispatch (`SP_ALLOW`), i.e. `node *` (the tests start the preview server and the browser themselves) and `git diff *`.

**Substitutions**: none (sonnet, haiku, fable smoke-tested OK; opus = running model).

**Overrides**:
- Commit messages: French, one line ≤70 chars, starting with a present-tense verb, never "update", "fix", "wip" (AGENTS.md rule 3, skill `points-de-sauvegarde` §3) — replaces protocol §4's conventional format. Example: « Dessine la planche manga des 24 cases ».
- Never push; merging `BRANCH` into `main` happens only after the user says « adopter » (AGENTS.md rules 5 and 7).
- `contenu/cases.json` and `.cle` are gitignored secrets of the project: never stage them, never print their content in a brief, journal or review.
- Claude Code 2.1.325 installed vs snapshot 2.1.323: flags used by the scripts (`-p`, `--model`, `--permission-mode acceptEdits|dontAsk`, `--allowedTools`, `--output-format stream-json`) re-checked in `claude --help`; smoke OK. No correction.

## 5. Risks & open questions
- The main session was editing `app/` while this plan was written (commit 18250f7 adds the `anime` field and theme). Create `BRANCH` from the latest `main` at run start and re-scan `app/` before the P1 sub-plan; criteria already met are recorded as passing, not rebuilt.
- Case texts are in a gitignored file: in a clone without them, `/donnees.json` has no content and content-dependent tests skip. Tests must never hard-code case texts.
- Headless Edge/Chrome cannot open a window narrower than ~496 px: 360 px checks go only through `Emulation.setDeviceMetricsOverride` in the helper.
- Waiting for `animationend` deadlocks under reduced motion (animations cancelled) → sequencing uses timers guarded by `matchMedia`, covered by P2 c17.
- `clip-path` on panels cuts focus outlines → P1 c18.
- Google Fonts unreachable (offline demo) → system fallbacks; kana fall back to Yu Gothic / Meiryo.
- Meetup time box (demos ~21:45): P3 is the lowest-weight part and can be dropped without breaking P1/P2.
- Protocol "tests are frozen" applies; the helper `tests/outils/navigateur.mjs` is written once in P1 and reused unchanged by P2/P3 test-writers (a needed helper change → STATUS BLOCKED, the orchestrator decides).
