# Decisions Log

This file tracks the key technical and scope decisions made while rewriting
Kaleidoscope in React/Vite, so they persist across sessions and contributors.
The original vanilla JS/HTML/CSS app is preserved in [old-dom-app-2020/](/Users/CRJ/Coding/SideProjects/kaleidoscope/old-dom-app-2020) for reference.

## Stack & architecture

- **Language**: TypeScript (`.ts`/`.tsx`), not plain JavaScript.
- **Styling**: CSS Modules + plain CSS. No Tailwind, no CSS-in-JS library.
- **Hexagon rendering**: SVG polygons, not CSS `clip-path`/rotate-skew divs
  (the technique the original app used). Grid layout and the mirror
  ("type") symmetry groups are computed programmatically from hex
  coordinates rather than hand-authored as static markup.
- **State management**: React built-in `useReducer` + Context. No external
  state library (e.g. Zustand/Redux) — scope doesn't warrant it.
- **Testing**: Vitest for logic-heavy pieces (grid/symmetry generation,
  reducer), introduced in Phase 1 Step 2.
- **Formatting**: Prettier (no semicolons, single quotes), with
  `eslint-config-prettier` to disable stylistic ESLint rules so the two
  tools don't fight. `npm run format` / `npm run format:check` added
  alongside `npm run lint`.
- **Deployment**: GitHub Pages via GitHub Actions (same target as the
  original app), added in Phase 1 Step 14.
- **Comments**: minimal, on purpose. No JSDoc on TypeScript code (types
  already document params/returns — JSDoc on top is redundant clutter).
  Only comment non-obvious logic or a significant abstraction/workaround
  (e.g. the hex symmetry math, the CSS-variable-inheritance workaround for
  dark mode) — never restate what the code already makes obvious. Code
  should speak for itself as much as possible.

## Grid symmetry analysis & implementation (Step 2)

The original hand-authored markup was analyzed to confirm its mirroring
pattern: 271 hexagons total, with each hexagon belonging to a "type" group
that is repainted together. Orbit sizes are 1 (the dead-center hex), 6 (hexes
that lie on one of the 6 mirror axes), or 12 (all other hexes) — consistent
with **D6 dihedral symmetry** (6 rotations x optional reflection).

To verify this precisely (not just by class-name counting), the original app
was rendered in a headless browser (Playwright) and the real pixel center of
every hexagon was measured. That confirmed: constant hex-to-hex pitch in all
directions (true hex adjacency, not a rectangular approximation), and radius
+ angle per "type" group exactly matching a D6 orbit structure centered on
the middle hex.

This led to a clean, computed (not hand-coded) grid design, implemented in
`src/utils/hexGrid.ts`:
- Cells are enumerated as **axial coordinates** `(q, r)` filling a hexagon of
  **radius 9** — the centered-hexagonal-number formula `1 + 3N(N+1)` gives
  exactly 271 cells at N=9, matching the original.
- Each cell's mirror-symmetry **group id** is computed by generating its full
  D6 orbit (rotate 60° six times, with and without reflection) and taking the
  lexicographically-smallest `(q, r)` in that orbit as the canonical id.
- Exactly one cell per group — the canonical one — is flagged `isClickable`.
  Because of the symmetry, these canonical cells always land in the same
  contiguous 30° wedge of the grid (verified), matching the original's single
  "editable slice" design.
- `src/utils/hexGrid.test.ts` asserts the generated grid reproduces the
  original's measured structure: 271 cells, 30 groups, orbit-size
  distribution of 1×1 / 13×6 / 16×12, and exactly one clickable cell per
  group.

## Scope / versioning

- **Phase 1** = rebuild to full feature parity with the original app only
  (color schemes, color picker, mirrored hex painting, scheme-switch
  recoloring, dark mode, reset). No new features in this phase. **Done**
  as of Step 14 (deployed to GitHub Pages via Actions).
- **Phase 2+** = future feature branches, scoped individually later. Ideas
  raised during the original analysis, not yet committed to:
  - Persist current design (localStorage autosave)
  - Export design as PNG/SVG
  - Shareable URL encoding the current design/scheme
  - Undo/redo history
  - Custom color picker beyond the 11 preset schemes
  - Animation/transition polish
  - Releasing new color themes/schemes over time (the Settings modal's
    "Color Theme" list is structured as a simple data-driven list
    specifically so new schemes can be added later without UI changes).
  - A simplified/lower-density hex grid (fewer perimeter rings) for small
    screens, since the full 271-cell grid may be too visually complex on
    narrow viewports. Not implemented yet — current grid just scales down
    to fit via the SVG's responsive `viewBox`.
  - Supporting alternative shapes/tile maps beyond hexagons (e.g. square,
    triangular, or other tessellations) as a user-selectable grid style.
  - Mobile/touch refinements, specifically: a touch-friendly way to
    discover which hexagon "slice" is editable, since the hover-based
    emphasis effect (Step 7) has no equivalent on touch devices (same
    gap the original 2020 app had — not a regression, but worth solving
    properly). Options considered and deferred: a permanent subtle
    highlight on the editable wedge, a `(hover: none)` media-query
    fallback that shows the wedge highlighted by default on touch, or an
    explicit "Show editable area" toggle button. Tapping to paint already
    works functionally on touch today (click events fire independent of
    hover state); only the discoverability/affordance is deferred.
  - A robust README (replacing the default Vite scaffold one): what the
    app is/does, live demo link, screenshots, local dev setup, scripts,
    tech stack. User has example READMEs from other projects to use as a
    style reference, but wants to hold off until there's more built
    feature-wise to write about — keep "warm" on the list, not scheduled.
  - Cleaning out excessive/outdated comments across `src/` and settling
    on a going-forward comment-style guideline (left over from iterative
    dev sessions; much of it over-explains obvious code).

### Phase 2 priority order (as of Step 14 wrap-up)

User's chosen sequence for the above, most to least immediate:
1. **Comment cleanup** — also establishes the comment-style guideline to
   follow for everything after.
2. **localStorage persistence**
3. **Quick features**: export/download, shareable URL, undo/redo (no
   sub-order specified yet — will ask when we get there). Update: after
   building export/download, the user clarified they'd misread
   "shareable" as image-sharing, not URL-sharing, and were skeptical of
   the URL idea anyway ("people don't share links to images these days,
   they just share the images") — the shareable-URL item was dropped
   from the backlog entirely. Order became: export/download/share image,
   then undo/redo.
4. **Touchscreen/mobile wedge discoverability**

README stays on the backlog but deliberately unscheduled — revisit only
when the user asks, likely once more of the above has landed and there's
more to document.

## Hover feedback on painted hexagons

The hover-highlight effect on a clickable hex went through a few iterations:

1. `opacity: 0.7` on hover — blends with the page background, so it's
   invisible when the hex is painted the same color as the background
   (e.g. the Base swatch).
2. `filter: brightness()` on hover — fixes #1 (darkens actual pixels
   regardless of background), but filters apply to the whole rendered
   element, so it also muddied the stroke/grout line.
3. Two-polygon layering (base polygon + a `pointer-events: none` overlay
   polygon that fades in on hover) — isolated the darken effect to a
   layer on top of the fill only, leaving the stroke untouched. Worked,
   but added structural complexity (a `<g>` wrapping two polygons per
   cell).
4. **Current approach**: compute the hover fill color in JS per-cell
   (`src/utils/colorMath.ts`), comparing the cell's current fill to the
   active `base`/`accent` theme colors:
   - If it matches either, hover shows a fixed neutral gray (`#808080`),
     since there's no hue to brighten in that case.
   - Otherwise, hover brightens and saturates the cell's own color via
     HSL (preferred over darkening, since darkening felt "muddy").
   - The computed color is passed down as a `--hover-fill` CSS custom
     property on the polygon's inline `style`, and a single CSS rule
     (`.clickable:hover { fill: var(--hover-fill); }`) applies it. SVG
     presentation attributes (like `fill="..."`) have very low cascade
     priority, so this CSS rule overrides them without needing
     `!important`.
   - This let us revert to a single `<polygon>` per hex (no more
     `<g>`/overlay structure), since only `fill` changes on hover and
     `stroke` is a separate property the rule never touches.

## Reset confirmation

The original used a native `window.confirm(...)`. For the rewrite, built a
custom `ConfirmDialog` component instead (user's preference), using the
native `<dialog>` element rather than a hand-rolled modal:
- Gives focus trapping, `::backdrop`, and Esc-to-cancel for free.
- `open` is a controlled prop; a `useEffect` imperatively calls
  `showModal()`/`close()` to match it, since `<dialog>` has no declarative
  attribute that also triggers modal (backdrop + focus trap) behavior.
- Backdrop click (clicking the `<dialog>` element itself, which fills the
  viewport when shown modally, rather than its content) also cancels.
- Reusable: `ResetButton` is the only current consumer, but the dialog
  component takes generic `title`/`message`/`confirmLabel`/`cancelLabel`
  props for future confirmations if needed.

## Styling / responsive pass (Step 11)

- **Fonts**: self-hosted via `@fontsource/righteous` and `@fontsource/roboto`
  (weights 400/900) rather than the original's Google Fonts CDN `<link>` —
  no external network request, works offline, matches the original's font
  choices exactly (Righteous for the title/buttons, Roboto for body text).
- **Layout**: kept the rewrite's simpler centered/stacked layout (rather
  than recreating the original's absolute-positioned two-column design) —
  polished its spacing, max-width, and typography instead. `App.module.css`
  now constrains overall width (`max-width: 1100px`, centered) and the
  controls/hex-grid area wraps responsively down to mobile widths with no
  horizontal overflow (verified at 1100px/390px/312px viewports).
- Added subtle modern touches not in the original (rounded corners on
  buttons/swatches/dialog, hover background tints, smoother transitions)
  while keeping all functional behavior identical to Phase 1 scope.

## Layout simplification (revision after Step 11)

Further simplified the layout to a single column that works at all widths
(no multi-column design needed, even on wide screens):
- **Current color options** (the 7 paintable swatches) moved to a
  horizontal row directly under the `<h1>`, always visible.
- **Color theme picker** (the 11 preset schemes) and the **dark/light mode
  toggle** were moved into a new Settings modal, opened via a cog icon next
  to the color options row. The page updates live as soon as a theme is
  picked — no need to close the modal first, though closing it is the
  natural way to return to painting.
- **Reset Design** moved below the hex grid.
- Built a generic `Modal` component (native `<dialog>`-based, same
  mechanics as the original `ConfirmDialog`) that `ConfirmDialog` and the
  new `SettingsModal` both use, instead of duplicating the show/close/
  cancel/backdrop-click logic.

## Icons

The user has a Font Awesome Kit subscription, loaded via a `<script>` tag
in `index.html` (`https://kit.fontawesome.com/...`). Icons are used as
plain `<i className="fa-solid fa-<name> fa-<size>">` elements (e.g. the
settings gear button) rather than an npm/React icon package — use this
same pattern for any future icons rather than inline SVGs or another icon
library.

## Accessibility pass (Step 12)

Audited every component; the single biggest gap was that the hex grid's
`<svg role="img">` wrapper told assistive tech to treat the whole grid as
a flat, non-interactive image, which suppresses *all* descendant
interactive elements from the accessibility tree — meaning none of the 30
paintable hex cells were reachable by keyboard or screen reader at all,
despite working fine with a mouse. Fixed by:

- Removing `role="img"` from the `<svg>`; it's now `role="group"` with
  `aria-describedby` pointing to a visually-hidden instructions paragraph
  ("Tab to move between hexagons. Press Enter or Space...").
- Each clickable hex `<polygon>` now gets `tabIndex={0}`, `role="button"`,
  an `aria-label` of the form "Paint hex tile N of 30" (cells are numbered
  in rendering order among only the 30 clickable mirror-group
  representatives — there's no other meaningful identity to expose, since
  `groupId` is an internal axial-coordinate string), and an `onKeyDown`
  handler so Enter/Space paints exactly like a click.
- Non-clickable mirror/reflection polygons get `aria-hidden="true"` (they
  were already non-interactive and only exist as visual decoration).
- Added a visually-hidden (`sr-only`-style clip, not `display: none`, so
  it's still in the accessibility tree) `role="status" aria-live="polite"`
  region in `HexGrid` that announces "Painted hex tile N of 30." after
  each paint, since there's otherwise no non-visual feedback that the
  action succeeded.
- Added a `:focus-visible` outline style to clickable hexagons (SVG shapes
  don't get a default browser focus ring the way HTML buttons do), and
  added matching `:focus-visible` rules (mirroring the existing `:hover`
  styles) to the Settings/Reset/Dark-mode buttons for consistent keyboard
  focus visibility across the app.
- Scope note: tab order visits all 30 cells sequentially (like a toolbar),
  not a full 2D roving-tabindex ARIA grid with arrow-key navigation — that
  richer widget pattern is logged below as a Phase 2 idea if ever needed.

Other smaller fixes made in this pass:
- `DarkModeToggle` had `aria-pressed={state.darkMode}` paired with a label
  that describes the *destination* mode ("Dark Mode" while currently
  light), which is a mismatch — `aria-pressed` conventionally describes
  the *current* state the label names, so a screen reader would announce
  something backwards-sounding. Removed `aria-pressed`; the changing label
  text alone already fully conveys the action (same pattern as a
  "Follow"/"Unfollow" button).
- The Font Awesome gear `<i>` icon in `SettingsButton` is now
  `aria-hidden="true"` — the button already has `aria-label="Open
  settings"`, so the icon itself is purely decorative.
- The `.topRow` wrapper div in `App.tsx` had an `aria-label` with no role,
  which is ignored by assistive tech on a plain `<div>`; added
  `role="group"` so the label is actually exposed.
- Confirmed already-good patterns needed no changes: `ColorOptions` and
  `SchemePicker` (real `<button>`s, `aria-pressed`, `aria-label`,
  `role="group"`, `aria-hidden` on decorative swatch spans), and `Modal`
  (native `<dialog>` + `showModal()` gives focus trapping, `aria-modal`,
  and Esc-to-cancel for free — used by both `ConfirmDialog` and
  `SettingsModal`). No `outline: none` anywhere suppressing focus rings.

### Phase 2 ideas (new, from this pass)

- Full ARIA grid pattern (roving tabindex + arrow-key navigation) for the
  hex grid, if sequential tab order through 30 cells ever feels tedious
  in practice.

## Small fixes (between Steps 12 and 13)

- Removed a stray empty, untracked `src/styles/` directory left over from
  earlier scaffolding.
- **Dark mode background bug**: `--base`/`--accent` are set inline on
  `<main>`, so they only cascade to descendants — they never reached
  `<body>`, leaving the viewport outside the centered content column
  white even in dark mode. Fixed with a small `useEffect` in `App.tsx`
  that mirrors `base` onto `document.body.style.backgroundColor`
  directly, so the whole page follows the theme, not just the content
  column.
- **Clickable wedge repositioned**: the single contiguous 30-degree wedge
  of clickable hexes (one representative per of the 30 mirror groups)
  sat at the 9-10 o'clock position, chosen by `groupIdFor` picking the
  lexicographically-smallest (q, r) coordinate per orbit. Rotated the
  selection by one more 60-degree step (`rotate60`) so the wedge now
  lands at 11-12 o'clock, directly under the controls row. Verified by
  temporarily highlighting all `isClickable` cells and confirming the
  wedge position; no persisted state references the old group-id scheme
  (state is in-memory only), so this was a safe, non-breaking change.
- **Formatting**: user switched `.prettierrc.json` to tabs (`useTabs:
  true`, `tabWidth: 4`) instead of spaces — already reflected across the
  codebase via `npm run format`.

## Testing & polish (Step 13)

Discussed two tiers of UI-level testing beyond the existing pure-logic
Vitest suite:
- **Component tests** (React Testing Library + jsdom, same Vitest
  runner): fast, no real browser, renders actual components and queries
  them the way a screen reader/keyboard user would (`getByRole`, etc.) —
  catches logic/wiring regressions but not real CSS/layout/paint issues.
- **True end-to-end tests** (Playwright, real browser): would catch real
  rendering bugs (like the dark-mode background and outline-clipping
  issues we fixed by hand this session) but is heavier to maintain.

**Decision**: component tests only (RTL + jsdom) for the committed suite.
Playwright remains a manual/ad-hoc verification tool (used throughout
this project to visually confirm changes) rather than a maintained test
suite — reasonable for a personal-scale app. Can revisit adding a small
Playwright smoke suite later, e.g. right before a Step 14 deploy, if
stronger pre-release confidence is ever wanted.

Implementation notes:
- Added `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, and `jsdom` as dev dependencies; switched
  Vitest's `environment` from `node` to `jsdom` and added a
  `src/test/setup.ts` setup file.
- `setup.ts` explicitly registers `afterEach(cleanup)` — Vitest doesn't
  expose a Jest-style global `afterEach` unless `test.globals` is
  enabled (we didn't enable it), so React Testing Library's usual
  auto-cleanup-on-import never registers without this. Skipping it causes
  leftover DOM from earlier tests in the same file to leak into later
  ones (a real bug we hit and fixed during this pass — tests were
  querying across multiple stacked, un-unmounted render trees).
- `setup.ts` also polyfills `HTMLDialogElement`'s `showModal`/`close`
  (jsdom doesn't implement them), since `Modal` depends on them.
- Added `src/test/renderWithProvider.tsx`, a small helper that wraps
  `render()` with the real `AppStateProvider`, since nearly every
  component reads from app state via context.
- New test files, one per component with non-trivial behavior:
  `ColorOptions`, `SchemePicker`, `DarkModeToggle`, `ResetButton` (covers
  the `ConfirmDialog`/`Modal` flow), `HexGrid` (covers `Hexagon`,
  including the keyboard-paint path added in the accessibility pass), and
  `SettingsButton` (covers `SettingsModal` + nested components). 12 new
  tests, 43 total.
- Since `createInitialAppState` picks a random starting color scheme,
  tests that need to select "a different scheme than the current one"
  pick dynamically (first button that isn't already pressed) rather than
  hardcoding a scheme name — otherwise the test is flaky roughly 1-in-11
  runs, whenever the random initial scheme happens to match the
  hardcoded target. Caught this via a 30-run repeat-test loop, not a
  single run.

### Step 14 — CI & deploy to GitHub Pages

Context: the legacy vanilla-JS app deployed directly from `main` (no build
step, GitHub Pages "legacy"/deploy-from-branch mode). React needs a build
step, so that mode no longer works as-is. The user wanted GitHub Actions
CI and assumed Pages deploy would have to stay a manual step — that
assumption turned out to be wrong.

Decision: use GitHub's modern Actions-native Pages deployment, which
fully automates build + deploy on every push to `main` with no manual
trigger required. This needed one one-time infrastructure change (not a
code change): switching the repo's Pages `build_type` from `"legacy"`
to `"workflow"`. Did this via `gh api -X PUT repos/.../pages -f
build_type=workflow` rather than the Settings UI — confirmed via a
follow-up GET that it took effect. (The classic `gh-pages` npm-package
CLI workflow, which the user may have been thinking of, *does* require a
manual `npm run deploy` — but that's not the only option, and not what
we used here.)

Investigated an initially-confusing detail: `gh api repos/.../pages`
showed `"cname": null` (no custom domain configured on this repo) but
`"html_url": "http://codewithcarrie.com/kaleidoscope/"` (a custom
domain, with a `/kaleidoscope/` subpath). Resolution: `codewithcarrie.com`
is the custom domain on the account's root user/org Pages site (e.g. a
`Carolista.github.io` repo with its own `CNAME` file); GitHub
automatically also serves *every other* project-page repo on the same
account under that custom domain at `<domain>/<repo-name>/`, with no
per-project `CNAME` file needed. So no `CNAME` file was added here.

Implementation:
- `vite.config.ts`: `base` is now `/kaleidoscope/` for production builds
  only (`command === 'build'`), left as `/` for `npm run dev` so the
  local dev server keeps serving from the site root as before.
- Added `.github/workflows/ci-deploy.yml`:
  - `test` job (runs on every push and PR targeting `main`): `npm ci`,
    lint, format:check, test, build; uploads `dist/` as a plain build
    artifact.
  - `deploy` job (runs only on `push` to `main`, after `test` passes):
    downloads that artifact, then `actions/configure-pages` →
    `actions/upload-pages-artifact` → `actions/deploy-pages` to publish
    it, using the `github-pages` environment and the
    `pages: write` / `id-token: write` permissions that deployment
    requires.
  - A `concurrency` group on the workflow prevents overlapping deploys if
    `main` gets pushed to again before a deploy finishes.
- No SPA routing/404-fallback trick needed — this is a single-page app
  with no client-side routes.

### Comment cleanup + comment style guideline (Phase 2)

Audited every comment in `src/` and trimmed anything that just restated
what a function/type/component name and its TypeScript signature already
made obvious (e.g. a component named `ResetButton` doesn't need a comment
saying it resets the design). Converted all remaining `/** */` JSDoc-style
comments to plain `//` — decided against JSDoc entirely, even for
exported functions, since TypeScript types already document
params/shapes and JSDoc on top is redundant clutter. Kept comments only
for non-obvious logic or a significant abstraction/workaround (hex
symmetry math, the CSS-variable-inheritance dark-mode workaround, native
`<dialog>` quirks, etc.) — this is now the standing guideline for all
future work, not just a one-time cleanup.

### localStorage persistence (Phase 2)

Autosaves the current design (scheme, current paint color, dark mode,
painted hex groups) to `localStorage` on every state change, and restores
it on load — so refreshing the page (or closing/reopening the tab) no
longer loses a design, which was the original app's behavior too (no
persistence at all).

Implementation (`src/state/persistence.ts`):
- The color **scheme is persisted by name**, not as the full scheme
  object, and re-linked to the live `colorSchemes` data on load. This
  means a saved design keeps working even if a scheme's colors are
  tweaked later — it just picks up the current colors for that name,
  consistent with how `SELECT_SCHEME` already remaps painted hexes by
  palette position rather than storing absolute colors long-term.
- The persisted payload includes a `version` number (currently `1`).
  There's no migration logic yet since this is the first version, but
  having it from the start means a future schema change can detect and
  migrate (or safely discard) old saved data instead of crashing on it.
- Loading is defensive end-to-end: missing key, corrupted JSON, an
  unrecognized version, a scheme name that no longer exists, or malformed
  `hexGroupColors` values all fall back to a fresh state (the same
  random-scheme default as a first-ever visit) rather than throwing.
  Both load and save also swallow any `localStorage` access error (e.g.
  disabled storage in a private-browsing mode) so a storage problem can
  never crash the app — it just means autosave silently doesn't work for
  that session.
- Wired in via `useReducer`'s lazy-init third argument
  (`loadInitialAppState`) in `AppContext.tsx`, plus a `useEffect` that
  calls `savePersistedState(state)` whenever `state` changes. No
  debouncing — state only changes on deliberate user actions (paint,
  pick scheme/color, toggle dark mode, reset), not at a rate where
  `localStorage` writes are a concern.
- Verified in-browser via Playwright: painted hexes, confirmed the save
  fired, reloaded and confirmed the scheme/color/painted-hex state all
  came back, then used Reset Design and confirmed the persisted
  `hexGroupColors` cleared along with it.

### Save design as image: PNG export, Share, and Download (Phase 2)

Added a "Save design as image" button next to Reset Design, which opens a
preview modal with Download (always) and Share (only when supported)
buttons. Decisions made with the user up front:
- **Format**: PNG only, no other formats offered.
- **Background**: baked in as the current theme's base color, so the
  exported image matches what's on screen (including unpainted hexes)
  rather than exporting a transparent background.
- **Flow**: a single icon button opens a modal that generates and
  previews the image, then offers Share and/or Download from there,
  rather than instant-downloading or separate Share/Download buttons on
  the main screen.
- **Share fallback**: the Share button is hidden entirely (not shown
  disabled, not shown and erroring) when `navigator.share`/
  `navigator.canShare` for files isn't supported — confirmed this path
  works correctly, since the Playwright/headless-Chromium test
  environment itself lacks `navigator.share` and correctly shows
  Download-only.
- Explicitly **not** doing a shareable-URL feature — the user felt
  that's not how people share images today ("they just share the
  images"), so this stays off the roadmap unless revisited later.

Implementation (`src/utils/exportImage.ts`, `src/components/SaveImageModal.tsx`):
- The hex grid's "grout" stroke lines are a CSS Module rule
  (`stroke: var(--base)` in `Hexagon.module.css`), not an inline SVG
  attribute. A naive clone-and-serialize of the live SVG would silently
  lose all stroke rendering, since a standalone serialized SVG has no
  access to the page's bundled stylesheet. Fixed by reading the computed
  stroke style once from a single live `<polygon>` and baking it onto
  every polygon in the detached clone as a plain attribute before
  serializing — robust to future CSS tweaks since it reads real computed
  values instead of hardcoding them.
- The live SVG only has a `viewBox` (no explicit `width`/`height`,
  for responsive on-screen sizing), which would otherwise rasterize to
  the default 300×150 "replaced element" size when loaded via `Image`.
  Fixed by setting explicit `width`/`height` on the cloned SVG (scaled
  from its `viewBox` aspect ratio up to a 1600px max dimension) before
  serializing, so the browser rasterizes directly at full resolution.
  The original on-screen SVG is never touched, only the clone.
- Verified end-to-end in-browser via Playwright: generated image
  visually matches the on-screen design (dark/light background, painted
  hex colors, crisp grout lines), confirmed actual output is a
  1399×1600 PNG (no blur from upscaling a low-res raster), confirmed the
  Download button triggers (anchor is appended to the document before
  `.click()`, since some browsers only honor synthetic clicks on
  attached anchors), and confirmed Share is correctly hidden in this
  test environment (no `navigator.share` support there).
- Note: the Playwright test harness doesn't surface a `download` event
  for blob-URL anchor downloads at all (confirmed with a minimal
  reproduction unrelated to this app's code), so the actual
  browser-level file-save couldn't be directly observed in this
  environment — this is a known harness limitation, not a sign of a bug.

### Undo/redo (Phase 2)

Added Undo/Redo icon buttons (next to Reset Design, in the bottom row)
plus Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z keyboard shortcuts. Decisions made
with the user up front:
- **Scope**: only painting, scheme changes, and Reset Design are
  undoable — these are the actual design content. Picking a new
  "current color" (the color about to be painted with, not yet applied
  to any hex) and toggling dark mode are left out of the undo stack,
  since they're tool/viewing choices rather than steps in the design
  itself.
- **History depth**: unlimited for the session (resets on reload, since
  it isn't persisted — only the current design is persisted, same as
  before).
- Reset Design's confirm-dialog copy was updated (it previously said
  "This cannot be undone," which stopped being true).

Implementation (`src/state/historyReducer.ts`):
- Rather than reworking `appReducer`/`AppState` itself, undo/redo is a
  wrapping reducer: `HistoryState` holds `{ present, past, future }`,
  where `past`/`future` are stacks of lightweight design snapshots
  (`{ currentScheme, hexGroupColors }` only — not full `AppState`, so a
  snapshot doesn't capture a stale `currentColor`/`darkMode`). Every
  action still flows through the real `appReducer` to compute the new
  `present`; only actions in an explicit undoable-type allowlist
  (`SELECT_SCHEME`, `PAINT_HEX_GROUP`, `RESET_DESIGN`) push the
  *previous* present onto `past` and clear `future`. `UNDO`/`REDO` pop
  between the stacks and splice the snapshot's fields onto the current
  `present`, leaving `currentColor`/`darkMode` as they currently are.
- This wrapping approach meant zero changes were needed to `appReducer`,
  `AppState`, or any component that just reads `state`/calls the
  existing action dispatchers — `AppContext.tsx` only needed to swap
  which reducer `useReducer` runs, and add `undo`/`redo`/`canUndo`/
  `canRedo` to the context value. All pre-existing tests passed
  unchanged, which served as a regression check that the public API
  surface didn't shift.
- Known edge case, left as-is: dark mode toggling remaps any hex
  painted exactly the old theme's base/accent color to the new theme's
  base/accent (pre-existing behavior, unrelated to this feature). Since
  that remap isn't itself undoable, undoing back across a dark-mode
  toggle can restore a snapshot whose hex colors were accurate for the
  *old* theme but are now stale relative to the current theme. This is
  a pre-existing rare/cosmetic edge case, not introduced by undo/redo,
  and wasn't worth blocking on.
- Verified in-browser via Playwright: painted a hex → undo → redo
  (confirmed via `localStorage`'s persisted `hexGroupColors`, not just
  button disabled-state), changed color scheme → undo → redo via
  keyboard shortcuts (confirmed via persisted `schemeName`), and
  confirmed Reset Design is now undoable too.

## Process

- Work proceeds one Phase 1 step at a time (see project plan); the user
  reviews and makes the commit at each step before moving to the next.
