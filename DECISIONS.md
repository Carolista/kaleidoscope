# Decisions Log

A chronological record of decisions made while rewriting Kaleidoscope, and
why. Where an approach changed along the way, only the final outcome and the
reason for the change are kept. For current standards, architecture, and
what's next, see [CONTEXT.md](./CONTEXT.md).

## Phase 1: Rebuild with feature parity

**Goal**: rebuild the 2020 vanilla JS app (preserved in
[old-dom-app-2020/](./old-dom-app-2020)) in React/Vite with no new features:
color schemes, color picker, mirrored hex painting, scheme-switch recoloring,
dark mode, reset. Done and deployed as of Step 14.

### Stack

- **React + Vite + TypeScript** over patching the original DOM code.
- **CSS Modules + plain CSS**; no Tailwind or CSS-in-JS.
- **`useReducer` + Context**; an external state library wasn't warranted at
  this scale.
- **SVG polygons** for hexagons instead of the original's CSS
  `clip-path`/skew divs.
- **Prettier** (no semicolons, single quotes) plus `eslint-config-prettier`
  so the two tools don't fight. The user later switched to tabs (width 4).

### Grid symmetry (Step 2)

The original's hand-authored markup had 271 hexes in "type" groups repainted
together. Rendering the original in a headless browser and measuring every
hex's real pixel center confirmed true hex adjacency and orbit sizes of 1, 6,
or 12: **D6 dihedral symmetry** around the center hex.

So the grid is computed, not hand-coded (`src/utils/hexGrid.ts`): axial
coordinates in a radius-9 hexagon (`1 + 3N(N+1) = 271`), group id = smallest
`(q, r)` in the cell's D6 orbit, and one canonical cell per group is
clickable. Those 30 cells always form one contiguous 30° wedge, matching the
original's single "editable slice". Tests assert the measured structure
(271 cells, 30 groups, 1×1 / 13×6 / 16×12 orbits).

### Hover feedback on painted hexes

The hover effect went through four iterations:

1. `opacity: 0.7`: invisible when a hex matches the page background.
2. `filter: brightness()`: worked on fills but muddied the grout stroke too.
3. A second overlay polygon per hex: isolated the effect from the stroke
   but doubled the structure (`<g>` + two polygons).
4. **Final**: compute the hover color in JS per cell. A hex painted
   base/accent hovers neutral gray (`#808080`, since there's no hue to
   brighten); any other color is brightened and saturated via HSL (the user
   preferred this to darkening, which felt muddy). It's passed as
   `--hover-fill` and applied by one CSS rule, which overrides the SVG `fill`
   attribute without `!important`. This allowed a single `<polygon>` per hex
   again.

### Reset confirmation

The original used `window.confirm`. Replaced with a custom `ConfirmDialog`
(the user's preference) built on native `<dialog>` for free focus trapping,
`::backdrop`, and Esc-to-cancel. Later generalized into a shared `Modal`
component (see below).

### Styling and layout (Step 11 and revision)

- **Fonts self-hosted** via `@fontsource` instead of the original's Google
  Fonts CDN: no external request, works offline, same typefaces.
- **Simple centered layout** instead of recreating the original's
  absolutely positioned two-column design. After Step 11 the user simplified
  further to one column at all widths, with the swatches under the `<h1>`,
  reset below the grid, and the color theme picker and dark mode toggle in a
  Settings modal (this was reworked again in Phase 2).
- A generic **`Modal`** component (native `<dialog>`) now backs
  `ConfirmDialog` and the settings modal instead of duplicating its
  show/close/backdrop logic.
- **Font Awesome** (the user's subscription, loaded as a Kit script) for
  icons, as plain `<i>` elements rather than an npm/React icon package.
  Future icons follow the same pattern.

### Accessibility pass (Step 12)

The biggest gap: the hex grid's `<svg role="img">` hid all 30 clickable cells
from keyboard and screen-reader users. Fixed by making the SVG a
`role="group"` with a visually hidden instructions paragraph and giving each
clickable cell `role="button"`, `tabIndex`, an `aria-label`
("Paint hex tile N of 30"), and Enter/Space handling. Also added: an
`aria-live` status announcing each paint, `:focus-visible` styles
everywhere, and `aria-hidden` on decorative mirror polygons and icons.

Smaller decisions: tab order is a plain sequential pass through the 30 cells
rather than a full roving-tabindex ARIA grid (kept as a possible future
idea), and `aria-pressed` was dropped from the dark mode toggle because its
label names the destination mode, which made the pressed state sound
backwards.

### Fixes between Steps 12 and 13

- **Dark mode background**: `--base`/`--accent` are set on `<main>` and
  can't cascade up, so the viewport outside the content column stayed
  white. Fixed by mirroring `base` onto `document.body` in a `useEffect`.
- **Clickable wedge moved** from 9-10 o'clock to 11-12 o'clock (one extra
  `rotate60` in the group-id selection) so it sits directly under the
  controls. Safe because nothing was persisted yet.
- Removed a stray empty `src/styles/` directory.

### Testing (Step 13)

**Decision: component tests only** (React Testing Library + jsdom in the
existing Vitest runner). They're fast and catch logic/wiring regressions;
they can't catch real CSS/layout issues, but a maintained Playwright suite
was judged too heavy for a personal-scale app. Playwright stays an ad hoc
tool for manual verification and can be revisited as a pre-deploy smoke test.

Lessons that shaped the setup: Vitest doesn't expose global `afterEach`
unless `test.globals` is on, so `setup.ts` registers RTL's `cleanup`
explicitly (without it, DOM leaked between tests); jsdom lacks
`<dialog>.showModal`, so it's polyfilled; and because the starting scheme is
random, tests pick "a different scheme" dynamically (a hardcoded one was
flaky about 1 in 11 runs, found by repeat-running).

### CI and deploy (Step 14)

The legacy app deployed straight from `main`; React needs a build step. The
user assumed deploy would stay manual, but GitHub's Actions-native Pages
deployment fully automates it. The repo's Pages `build_type` was switched
from `legacy` to `workflow` (via `gh api`). The workflow runs lint, format
check, test, and build on every push/PR, and deploys on pushes to `main`.

`vite.config.ts` sets `base: '/kaleidoscope/'` for production only. The
`codewithcarrie.com/kaleidoscope/` URL works because `codewithcarrie.com` is
the custom domain on the account's root Pages site, which GitHub also uses
for every project page, so no `CNAME` file is needed here.

## Phase 2: New features and polish

The user chose this priority order: comment cleanup, localStorage, image
export/share/download, undo/redo, a layout rework, then touchscreen
discoverability. README stays unscheduled.

### Comment style

Trimmed comments that restated obvious code and converted all JSDoc to plain
`//`. The user finds JSDoc clutter, and TypeScript types already document
signatures. Comments are only for non-obvious logic or significant
abstractions.

### localStorage persistence

Autosaves the design (scheme, current color, dark mode, painted hexes) on
every state change and restores it on load. Decisions:

- The **scheme is saved by name** and re-linked to live data on load, so a
  saved design picks up later tweaks to a scheme's colors.
- The payload has a **`version`** field (currently 1), so a future format
  change can migrate or safely discard old data.
- **Loading is defensive**: missing key, bad JSON, unknown version, unknown
  scheme, or malformed colors all fall back to the default state, and
  storage errors (e.g. private browsing) are swallowed so storage can never
  crash the app.
- **No debouncing**; state changes only on deliberate user actions.

### Image export, share, and download

The user's first idea for "shareable" was sharing an image, not a URL. A
shareable-URL feature was **dropped**: "people don't share links to images
these days, they just share the images". Having both Share and Download
mirrors another of their apps, where Share alone had no "save to disk"
option on a laptop.

- **PNG only**, with the current theme's base color baked in as the
  background so the image matches the screen.
- A single icon button opens a **preview modal** offering Download (always)
  and Share (only if the browser can share files; otherwise hidden rather
  than disabled).
- The grout stroke comes from a CSS Module rule, so a plain serialized SVG
  would lose it. The exporter bakes computed stroke values onto a cloned SVG
  and sets explicit width/height (max 1600px) so the PNG rasterizes at full
  resolution instead of the 300×150 default. The on-screen SVG is never
  modified.
- The download anchor is appended to the document before `.click()`, since
  some browsers ignore clicks on detached anchors.
- Known tooling limit: Playwright in this environment never surfaces
  download events for blob-URL anchors (reproduced outside the app), so the
  final file save couldn't be observed directly.

### Undo/redo

Decided with the user: undo covers **painting, scheme changes, and reset
only** (not current-color picks or dark mode, which are tool/view choices);
history is **unlimited for the session and not persisted**; the UI is
**icon buttons plus Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z**.

Implemented as a **wrapping reducer** (`historyReducer`) around the existing
`appReducer` rather than reworking `AppState`. History holds lightweight
`{ currentScheme, hexGroupColors }` snapshots so undo never restores a stale
current color or dark mode. This needed no changes to `appReducer` or its
consumers, and the existing tests passing unchanged served as the regression
check. Reset's confirm copy no longer says "cannot be undone".

Accepted edge case: toggling dark mode remaps base/accent-painted hexes but
isn't itself undoable, so undoing across a toggle can restore slightly stale
colors. It's rare and cosmetic.

### Layout rework: grid-first, icon-only controls

With more features, the earlier arrangement felt cluttered:

- The **hex grid moved above the swatches**, directly under the title, as
  the main attraction.
- The **dark/light toggle left the Settings modal** and became a sun/moon
  icon button in the bottom row. The icon shows the mode a click leads to,
  matching its label.
- With dark mode gone, the Settings modal was narrowed to color schemes and
  renamed to **`ColorThemeButton`/`ColorThemeModal`** with a palette icon,
  also in the bottom row.
- **Reset became an icon button (eraser)**, with an `aria-label` and tooltip
  and no text. The eraser was chosen because it doesn't resemble the circular
  arrows of undo/redo.
- The user then reordered the bottom row so undo/redo sit in the middle for
  symmetry.

### Starting in dark mode

The user chose dark mode as the default (the original started in light) and
updated the three tests that assumed otherwise.

### Touchscreen wedge discoverability

Touch devices have no hover, so there was no way to discover which 30 hexes
are paintable without tapping around (the hover-driven dimming in `HexGrid`
is mouse-only). Three options were discussed: a permanent highlight for
everyone, a `(hover: none)` fallback shown by default, or a user-toggled
"show editable area" button. The user chose the toggle for a cleaner look,
with these refinements decided along the way:

- **Touch-only**: desktop/mouse keeps relying on hover, unchanged. The
  toggle button itself is only rendered on touch devices (detected via a
  `(hover: none), (pointer: coarse)` media query hook,
  `useIsTouchDevice`), and `showEditableArea` is ignored outside of touch
  even though it's always present in state.
- **Defaults on**: a touch user sees the highlight immediately on first
  visit, rather than needing to find the toggle first.
- **Persisted** like dark mode/scheme, so a user's choice carries across
  sessions.
- **Same visual treatment as hover**: reuses the existing dim-the-rest
  effect rather than a new outline/glow.
- **Icon**: `fa-eye`/`fa-eye-slash`, following the existing convention that
  a toggle's icon/label describe the destination of a click, not the
  current state.

A one-time `TouchIntroModal` was added on top of this, shown only when a
touch device is detected **and** no design has ever been saved on that
device (`hasPersistedDesign()` in `storageService.ts`, checked once at
startup before the autosave effect can write anything). The user explicitly
chose the simplest version of this rule over a separate "seen it" flag: if
a touch user dismisses the modal without painting and reloads, it reappears
until they actually paint something and a design gets saved.

Also decided: the export pipeline (`exportSvgAsPngBlob`) must always
produce a fully opaque image regardless of whether the editable-area
highlight is on, since that dimming is a view-only aid, not part of the
design. `buildExportClone` now forces every cloned polygon's opacity to `1`
before rasterizing.

### Smaller grid for all devices

The grid's radius-9 size (271 cells) felt too cramped to paint comfortably
on small touchscreens. Rather than a responsive/device-conditional grid
size (more complexity, and a separate set of visual proportions to
maintain), the user chose to permanently drop the radius to 7 (169 cells,
20 clickable tiles instead of 30) for every device, as a simpler first cut.
`HEX_GRID_RADIUS` in `hexGrid.ts` is the only production code change — the
symmetry/grouping math is already radius-agnostic. A secondary, larger grid
for tablets/desktop may be reconsidered later (tracked as an idea in
CONTEXT.md) once the smaller size has been lived with for a while.

### Control grouping and sizing for small touchscreens

With the shrunken grid freeing up vertical space (see "Smaller grid for all
devices" above), the controls below it were reorganized to fit comfortably
within a ~550px-tall viewport without scrolling, and to read as clearer
groups instead of one long wrapped row:

- The swatches, undo/redo, and the remaining action buttons
  (dark/light, color theme, show/hide editable area, reset, save image) are
  each their own flex group, stacked in that order inside one outer
  `role="group" aria-label="Controls"` wrapper. The two previously-separate
  action clusters (toggles vs. destructive/export actions) were merged into
  a single `"Settings and Actions"` group, since splitting them no longer
  added clarity once undo/redo had its own row.
- The color picker swatches use `clamp()` sizing so they can shrink on
  narrow screens without ever dropping below a usable minimum, and stay on
  one row instead of wrapping.
- **Undo/redo icons were intentionally sized down** (`fa-xl` instead of
  `fa-2x`) to de-emphasize them relative to the five primary action
  buttons. Their button boxes were shrunk from 2.5rem to 1.875rem to match
  — preserving the same ~0.67 icon-to-box fill ratio the other buttons
  use, rather than leaving the icon adrift in an oversized box. This pushes
  undo/redo's touch target below the usual 2.5rem used elsewhere; given
  they're secondary/occasional actions (not core painting or settings), the
  smaller target was judged an acceptable tradeoff for the tighter layout.
  (Superseded by `IconButton`'s `size="sm"` prop, below — the smaller
  box/icon ratio itself didn't change.)

### Reusable components, file organization, and services

The `components/` folder had six nearly-identical icon-button CSS modules
and three modals with duplicated text-button/close-button styles. Rather
than top-level feature folders (rejected: there's only one real "epic",
coloring, right now — revisit if a genuinely separate major feature like
puzzles is ever added), the user chose to keep `components/` as a single
parent folder with subfolders:

- `components/layout/` — page chrome (`Header`, holding the title in a
  proper `<header>` outside `<main>`; a future `Footer`/`NavMenu` would
  live here too).
- `components/grid/` — `HexGrid`, `Hexagon`.
- `components/controls/` — the palette and everything below the grid.
- `components/shared/` — generic, reusable pieces: `IconButton`, `Button`,
  `CloseButton`, `Modal`, `ConfirmDialog`. `ConfirmDialog` and `Modal`
  moved here after the fact, once it was clear they have no
  `controls`-specific dependencies and are plausible to reuse elsewhere.

`IconButton` is driven by a single `--icon-button-size` custom property
(`font-size: calc(var(--icon-button-size) * 0.667)` keeps the glyph
proportional to the box), replacing Font Awesome's `fa-2x`/`fa-xl` utility
classes entirely — undo/redo now just pass `size="sm"`. `CloseButton` is a
thin wrapper around `IconButton` (`icon="xmark"`). `ResetButton` was
renamed `ResetDesignButton` to be self-explanatory without reading the
code, matching the existing "design" terminology (`resetDesign()`, "Reset
design?").

While restyling `IconButton` to match `CloseButton`'s borderless/subtle-
hover look, discovered that a CSS rule combining
`transition: background-color` with a `color-mix()` hover target reliably
gets stuck fully transparent and never animates in at least one current
Chromium build — true even though `:hover` is confirmed matched and
applied. This bug predated the refactor (the original modal buttons had
the same pattern) but was directly in scope since it was being
consolidated into shared CSS. Fix: drop the `transition` so the hover
background snaps instantly instead of silently never appearing.

Two non-React modules used outside their original neighborhood moved into
a new `src/services/`: `state/persistence.ts` → `storageService.ts`
(already called directly from both `AppContext` and `App.tsx`, not just
internal to `state/`) and `utils/exportImage.ts` → `imageExportService.ts`.
Finally, `SaveImageModal`'s image-generation/download/share logic (previously
two `useEffect`s plus handler functions mixed into the component) was
extracted into `src/hooks/useImageExport.ts`, leaving the component as
pure markup driven by the hook's returned state/handlers.

### Dark-mode flicker and modal resize jump

Toggling dark mode, and reloading the page, both caused visible background
flicker/flash, most noticeable at the viewport edges outside the centered
`.page` column (and, on reload, the whole screen before React mounted).
This took several rounds to fully pin down, since multiple plausible causes
turned out to be partial or wrong:

- **Reload flash**: Vite's dev server injects CSS via JS at runtime rather
  than a blocking `<link rel="stylesheet">`, so a CSS-only default
  background can't reliably win the race against first paint in dev (only
  in production, where the built `index.html` has an actual blocking
  `<link>`). Fixed with a synchronous inline `<script>` in `index.html`'s
  `<head>` (before any other resource) that reads the persisted `darkMode`
  flag from `localStorage` and sets `document.documentElement`'s
  background directly to a literal color — independent of CSS/stylesheet
  loading, so it behaves identically in dev and production.
- **Toggle flicker/desync**: initially suspected to be a `useEffect`
  (fires after paint) vs. `.page`'s synchronous inline style, fixed by
  switching to `useLayoutEffect`. Then suspected to be `var(--base)` driving
  an animated `background-color` (a pattern already known to get "stuck" in
  one diagnostic, though that specific finding was later found to be a
  testing-tool artifact — the browser tab being tested was backgrounded,
  which pauses CSS transitions and made things look stuck that weren't).
  The actual remaining cause: toggling dark mode also repaints every
  hexagon's fill/stroke at the same instant (`TOGGLE_DARK_MODE` in the
  reducer), and animating a full-viewport `background-color` transition at
  the same moment as that large repaint caused an intermittent
  compositor-timing flicker — worse, three elements (`.page`, `body`,
  `html`) each had their own independent transition, so they could even
  desync from each other by a frame.

Final fix: background color is set as a **literal** value (not
`var(--base)`) directly via inline style on all three elements, with **no
CSS transition** anywhere — `.page` in render (`App.tsx`), `html`/`body` in
a `useLayoutEffect` (runs before paint, closing the dev-only
`useEffect`-after-paint gap) plus the `index.html` bootstrap script for the
pre-mount case. Removing the animation entirely, rather than trying to
keep multiple transitions in sync, is what actually made toggling
flicker-free and perfectly in sync, every time. `--base`/`--accent` custom
properties remain available for other descendants (buttons, modal, hex
grout) that don't have this full-viewport/large-repaint collision.



Separately, `SaveImageModal` visibly resized once its async-generated
image loaded (narrow/short while "Generating image…" showed, then jumped
wider/taller). Fixed by reserving the image's final layout space upfront:
`.dialog` got a fixed `width` (not just `max-width`), and `.preview` gets
an inline `aspect-ratio` computed from the grid's own shape (new
`computeGridAspectRatio()` in `hexGrid.ts`, using the same
`axialToPixel`/`boundingBox` math `HexGrid` and the export service rely
on) rather than a hardcoded or ref-measured value — so the placeholder
box is already the correct shape before the image exists, and the `<img>`
(`object-fit: contain`) just fills it once ready.

## Process

Work proceeds one logical step at a time. The user reviews and makes each
commit. Decisions and standards are tracked in these two files so they carry
across sessions.
