# Kaleidoscope: Project Context

The current state of the app: what it is, the standards to follow, and
what's next. For _why_ things are the way they are, see
[DECISIONS.md](./DECISIONS.md). The original 2020 vanilla JS app is preserved
in [old-dom-app-2020/](./old-dom-app-2020) for reference only.

## What it is

A coloring toy. The user paints a small wedge of tiles and the app mirrors
the work across the full grid with D6 (or D3) symmetry (rotations plus
reflections) — or, for the pinwheel shape, rotation only, with no
mirroring — like a kaleidoscope. The default grid is a 169-cell hexagon;
other selectable grid shapes are also available (see Grid shapes below).
Includes preset color schemes, dark/light mode, undo/redo, autosave, and
PNG export/share/download.

Live at https://codewithcarrie.com/kaleidoscope/ (GitHub Pages).

## Working agreements

- Work proceeds in small, logical steps. The user reviews and makes every
  commit; do not commit unless asked.
- Ask the user before making design decisions that affect behavior or scope.
- Record significant decisions in DECISIONS.md and keep this file current
  when a standard changes.
- After renaming or moving files while the dev server is already running,
  stop and restart it (don't just reload the browser) before verifying in
  a browser tool. Vite's HMR can't hot-swap an import specifier that no
  longer resolves, so a running tab keeps requesting the old path and
  404s until the server restarts — repeatedly debugging around this burns
  time/credits for no reason.
- Don't reach for a Playwright/browser tool to verify small in-progress
  tweaks. Batch verification until the user says they're ready to test,
  since there's often back-and-forth on details first.
- Don't update CONTEXT.md/DECISIONS.md until the user confirms they're
  done reviewing/tweaking the current piece of work. The same
  back-and-forth that applies to Playwright verification applies here —
  updating docs for a design that's about to be reworked wastes effort.

## Tech stack & commands

React 19, Vite, TypeScript, CSS Modules, Vitest + React Testing Library
(jsdom), ESLint, Prettier. Node/npm.

| Command                | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Dev server                       |
| `npm run build`        | Typecheck + production build     |
| `npm run lint`         | ESLint                           |
| `npm run format`       | Prettier (write)                 |
| `npm run format:check` | Prettier (check)                 |
| `npm test`             | Vitest, single run               |

Before handing work off, lint, format:check, tests, and build should all
pass.

## Code standards

- **TypeScript** everywhere (`.ts`/`.tsx`).
- **Formatting**: Prettier, no semicolons, single quotes, tabs (width 4),
  trailing commas. `eslint-config-prettier` keeps ESLint out of style.
- **Comments**: code should speak for itself. Comment only non-obvious logic
  or a significant abstraction/workaround. Never restate what the code or
  its types already say. **No JSDoc** (use plain `//`).
- **Styling**: CSS Modules and plain CSS. No Tailwind or CSS-in-JS. Theme
  colors flow through `--base` / `--accent` CSS custom properties set
  inline on `.page` (`App.tsx`) for descendants to consume. `.page`,
  `<html>`, and `<body>` each get their `background-color` set as a
  **literal** color directly via inline style (not `var(--base)`, and with
  **no CSS transition**) — `.page` in render, `<html>`/`<body>` in a
  `useLayoutEffect` (not `useEffect` — must run before paint) in `App.tsx`,
  and `<html>` additionally in a synchronous bootstrap `<script>` in
  `index.html` (reads the persisted `darkMode` flag before React even
  mounts, so there's no flash on first paint/reload). See "Dark-mode
  flicker" in `DECISIONS.md` for why: animating/var-driving this property
  caused intermittent flicker and desync between elements, so background
  color changes are instant and literal everywhere, with no animation left
  to race or desync.
- **Icons**: Font Awesome (the user has a subscription; Kit loaded via
  `<script>` in `index.html`). Use plain
  `<i className="fa-solid fa-<name> fa-2x" aria-hidden="true">`. No icon
  npm packages or inline SVG icons.
- **Fonts**: self-hosted via `@fontsource` (Righteous for title/buttons,
  Roboto for body).
- **Controls**: icon-only buttons (square, 2.5rem) with an `aria-label` and
  matching `title`. A toggle's label and icon describe the _action/destination_
  (e.g. the sun icon and "Switch to light mode" while in dark mode). Undo/redo
  are a deliberate exception: a smaller 1.875rem box (`IconButton`'s
  `size="sm"`), to read as secondary actions next to the five primary
  buttons.
- **Shared components** (`src/components/shared/`): `IconButton` (icon-only,
  sized via `--icon-button-size`, drives both the box and the icon's
  `font-size` together so they can't drift out of sync — no Font Awesome
  `fa-2x`/`fa-xl` utility classes), `Button` (text button,
  `variant="solid"|"outline"`), `CloseButton` (a thin `IconButton` wrapper,
  `icon="xmark"`), `Modal` (native `<dialog>` wrapper), and `ConfirmDialog`
  (generic yes/no confirmation, built on `Modal` + `Button`). Hover
  feedback on `IconButton`/`Button` intentionally has no `transition`: a
  `background-color` transition whose target is a `color-mix()` value
  reliably gets stuck fully transparent and never animates in at least one
  current Chromium build, so the hover background snaps instantly instead.

## Architecture

- **Folder structure**: `src/components/` is organized into subfolders —
  `layout/` (page chrome, e.g. `Header`), `grid/` (`HexagonGrid`,
  `TriangleGrid`, `DiamondStarGrid`, `HexagramGrid`, `CircleRingsGrid`,
  `PolygonCell`, `CircleCell`), `controls/` (palette
  and everything below the grid), and `shared/` (generic, reusable pieces
  like `IconButton`/`Button`/`Modal`/`ConfirmDialog` used across the
  others). One parent folder, not split into top-level feature folders,
  since there's currently only one "epic" (coloring); revisit if a
  genuinely separate major feature is added later. `src/services/` holds
  non-React logic that's used outside a single component (`storageService`,
  `imageExportService`); `src/hooks/` holds reusable React hooks
  (`useImageExport`, `useIsTouchDevice`). `src/shapeGeometry/` (alias
  `@geometry`) holds each grid shape's cell-generation/geometry modules —
  split out from `src/utils/` (alias `@utils`) once it became clear that
  shape-specific math made up 12 of its 16 files; `src/utils/` now holds
  only truly shape-agnostic code (`symmetry.ts`, `svgPoints.ts`,
  `colorMath.ts`, `randomDesign.ts`) plus `gridShapeRegistry.ts`, a thin
  dispatch layer that's generic in *purpose* even though it necessarily
  imports every shape module.
- **State**: `useReducer` + Context, no external state library.
  - `appReducer` handles app actions.
  - `historyReducer` wraps it to provide undo/redo. Only painting, scheme
    changes, grid shape changes, randomizing, and reset are undoable
    (history is session-only, unlimited). Current color and dark mode are
    not.
  - `storageService.ts` autosaves to `localStorage` (versioned payload,
    scheme saved by name, defensive loading, all storage errors swallowed).
- **Grid shapes**: 6 selectable shapes share one `shapeGroupColors`
  paint-state map — painting/undo/
  redo only ever need a group id, never shape-specific geometry. 5 of the
  6 share `PolygonCell` for rendering; circle rings uses its own
  `CircleCell` (a `<circle>`, not a `<polygon>`).
  `GridShapeId` (`src/types/gridShape.ts`) identifies the current shape;
  `GridShapePicker`/`GridShapeModal` let the user switch (behind a
  `ConfirmDialog`, since switching discards the current design); each
  shape's cell-generation/geometry lives in its own pair of modules in
  `src/shapeGeometry/`, and `src/utils/gridShapeRegistry.ts` dispatches
  shape-agnostic callers (the design randomizer, the save-image aspect
  ratio) to the right one:
  - **Hexagon** (`src/shapeGeometry/hexagonGrid.ts`): axial `(q, r)` cells in a
    radius-7 hexagon (169 cells; reduced from the original 271/radius-9
    for small touchscreens, see DECISIONS.md), computed rather than
    hand-authored. Each cell's group id is the lexicographically smallest
    coordinate in its D6 orbit, using hexagon-specific cube-coordinate
    rotation. One cell per group (20 total) is `isClickable`; these form
    a single wedge at 11-12 o'clock.
  - **Triangle** (`src/shapeGeometry/triangleLayout.ts` + `triangleGrid.ts`): a
    big equilateral triangle subdivided into a 10x10 lattice (100 small
    triangles, 22 clickable groups), using the general-purpose symmetry
    engine below (D3, since a triangular lattice has no simple
    cube-coordinate trick like hexagons).
  - **Diamond star** (`src/shapeGeometry/diamondStarLayout.ts` +
    `diamondStarGrid.ts`): a 6-point star of elongated (45-degree point
    angle) diamonds, in the "Lone Star" quilt style. Each diamond point
    is itself a whole rhombus — not split into triangles — subdivided
    directly via a 2D affine lattice over its 4 vertices (center, tip,
    and 2 side vertices) into a 4x4 grid of smaller rhombi (16 per
    point); only the star's 6 rotations are needed to replicate this
    across all 6 points (each point is already symmetric about its own
    long axis), with the full D6 symmetry engine then used just to group
    the resulting 96 raw cells into 10 clickable orbits. Point angle was
    widened from an initial 30 degrees to 45 after testing showed 30 was
    too narrow to tap reliably on small touchscreens; the star's overall
    width:height ratio (sqrt(3)/2) turned out to be invariant to the
    point angle, so no other geometry needed to change.
  - **Hexagram** (`src/shapeGeometry/hexagramLayout.ts` + `hexagramGrid.ts`): a
    6-point star of equilateral triangles — a central hexagon with an
    equilateral triangle "point" attached outward on each of its 6 edges
    (a Star-of-David-style outline), the whole thing subdivided into
    small equilateral triangles. Each 60-degree "spoke" (one hexagon
    slice + its point, together a 60/120-degree rhombus) is subdivided
    into 2 x 4x4 lattices of small triangles (32 per spoke) using the
    same general 3-vertex affine lattice formula as the diamond star's,
    applied to 2 differently-oriented equilateral triangles; replicated
    across the shape's 6 rotations and grouped via the same D6 symmetry
    engine into 20 clickable orbits.
  - **Circle rings** (`src/shapeGeometry/circleRingsLayout.ts` +
    `circleRingsGrid.ts`): a lone center dot surrounded by 6 concentric
    rings of evenly-spaced circles (ring `n` has `6n` circles, so outer
    rings stay just as evenly spaced as inner ones instead of thinning
    out), fed directly into the general symmetry engine below (D6) on
    the full generated point set — unlike diamond star/hexagram, a
    single 60-degree spoke of ring circles isn't internally
    self-mirror-symmetric, so there's no cheaper rotate-and-replicate
    shortcut (same approach as triangle). The center dot and ring 1
    share a floor diameter (tuned, together with the grid's max on-screen
    width, to stay above a ~30px comfortable touch target); every ring
    beyond that grows the diameter by a fixed fraction per ring
    (`GROWTH_STEP_RATIO`), with each ring's radius computed to be just
    far enough out that neither its own same-ring neighbors nor the
    previous ring's circles overlap (`RING_GAP`, a multiplier just over
    1). 6 rings (127 cells, 16 clickable groups) was chosen over 7: more
    rings forces either a thinner safety margin on that 30px floor or a
    less visible size increase ring-to-ring, since each additional
    ring's growing circle count demands more circumference to stay
    non-overlapping.
  - **Pinwheel** (`src/shapeGeometry/pinwheelLayout.ts` + `pinwheelGrid.ts`): the
    app's only shape using rotation-only (C8) symmetry instead of
    mirrored (D_n) symmetry — 8 elongated-parallelogram spokes (same
    center/sideRight/sideLeft/tip construction as the diamond star, but
    with `sideRight`/`sideLeft` deliberately *unequal* distances from the
    center: `sideRight = size * rowSteps`, `sideLeft = size *
    PINWHEEL_COL_ASPECT_RATIO * colSteps`) replicated by 8 rotations with
    no mirror step at any point. Each spoke is subdivided into a 3x3
    lattice (`PINWHEEL_ROW_STEPS`/`PINWHEEL_COL_STEPS`) of uniform
    elongated cells (`size` wide, `size * PINWHEEL_COL_ASPECT_RATIO`
    long, a 2:1 ratio) rather than a uniform rhombus grid — this
    deliberately breaks edge-to-edge tiling, leaving small visible gaps
    between adjacent spokes that visually separate each blade from the
    next (confirmed as a desired look, not a bug), and avoids the sharp,
    star-like silhouette that an equal-sided rhombus spoke is always
    stuck with regardless of its internal subdivision. 72 cells, 9
    clickable groups (each orbit exactly size 8, since there's no mirror
    pairing to create degenerate on-axis cells like the diamond star/
    hexagram have).
  - **General symmetry engine** (`src/utils/symmetry.ts`): computes
    rotation/mirror orbits and clickable-wedge assignment via real
    geometric transforms applied to each cell's centroid (matched back to
    known cells by rounded-coordinate lookup), parametrized by `{ center,
    fold, mirror, mirrorAxisAngle }` and a caller-supplied `isCanonical`
    test — shared by any shape that isn't a simple hexagon grid.
- **Grid hover**: the hover fill is computed per cell in JS
  (`src/utils/colorMath.ts`): neutral gray if the cell is base/accent,
  otherwise a brightened/saturated version of its own color. It is applied
  via a `--hover-fill` custom property.
- **Touch wedge discoverability**: touch devices have no hover, so
  `src/hooks/useIsTouchDevice.ts` (a `(hover: none), (pointer: coarse)`
  media query hook) gates a persistent alternative. `showEditableArea` in
  `AppState` (default `true`, persisted, not undoable) drives the same
  dimming the grid components already use for hover, but only applied
  when `isTouch && showEditableArea`; desktop/mouse ignores the flag
  entirely and keeps relying on hover. `EditableAreaToggle` (eye/eye-slash
  icon button) renders only on touch devices to flip it.
- **Controls modal** (`ControlsModal`, opened via `ControlsInfoButton`'s
  circle-info icon, last in the Settings and Actions row): lists every
  clickable control below the grid (color swatches, undo/redo, and each
  Settings and Actions icon button, listed in the same order as the
  toolbar) with its icon and a brief explanation,
  two columns (icon, then text) on larger screens collapsing to one
  stacked column at 480px. The eye/eye-slash editable-area row is filtered
  in via `useIsTouchDevice` — shown only on touch devices, since that's
  the only audience `EditableAreaToggle` itself renders for — otherwise
  the content is identical for everyone. It opens automatically once, for
  everyone, the first time they play on a device (no design already
  persisted at load, captured once before the autosave effect in
  `AppContext` can run, via `hasPersistedDesign()` in
  `storageService.ts`) and can be reopened any time afterward via its icon
  button.
- **Defaults**: starts in dark mode with a random color scheme (first
  visit).
- **Scheme/theme switching** remaps painted cells by palette position;
  toggling dark mode remaps cells painted exactly base/accent.
- **Image export** (`src/services/imageExportService.ts`, wrapped by the
  `useImageExport` hook for `SaveImageModal`'s generate/download/share
  flow): clones the live SVG, bakes computed stroke styles onto it, forces
  every polygon fully opaque (overriding the editable-wedge dimming, which
  is for on-screen display only), sets explicit width/height (max 1600px),
  and rasterizes to a PNG with the theme base color as background. Share
  is shown only when `navigator.share` supports files; Download is always
  available.
- **Randomizer** (`src/utils/randomDesign.ts`, `RANDOMIZE_DESIGN` in
  `appReducer.ts`, undoable): assigns every group id (for the current
  grid shape, via `gridShapeRegistry.ts`) a random color drawn from a
  weighted pool — the current scheme's 5 colors are heavily favored (18
  "tickets" each) over the theme's base (10), 90% vs. 10% overall, so a
  generated design still reads as a coherent pattern rather than a
  mostly-neutral one. Accent is excluded entirely: it doubles as the
  default fill for an unpainted group (`?? accent` in each grid
  component), so assigning it would look identical to leaving a cell
  unpainted. `RandomizeDesignButton` (fa-magic-wand-sparkles) sits right of
  the palette button; no confirmation dialog (unlike reset) since it's a
  generative action and undo is one click away.

## Layout

A `<header>` with the title, then `<main>`: the grid, then a `"Controls"`
group holding, in order: current-color swatches (clamp-sized to stay on
one row), undo/redo, and a `"Settings and Actions"` row of icon buttons
(show/hide editable area (touch devices only), color theme, randomize
design, reset, grid shape, create image (fa-hexagon-image, a nod to the
app's hexagon origins), dark/light, controls help). The order is
deliberate, chosen for likely thumb reach on mobile. Single column at
every width.

## Accessibility standards

- Clickable tiles are `role="button"`, `tabIndex={0}`, labeled
  "Paint tile N of {group count}", and paint on Enter/Space. The SVG is
  `role="group"` (never `role="img"`, which hides interactive children).
- Non-clickable mirror polygons are `aria-hidden`.
- A visually hidden `role="status"` live region announces each paint.
- `:focus-visible` styles on every interactive element; never remove
  outlines.
- Icons are `aria-hidden`; buttons carry the accessible name.

## Testing

- Component and logic tests only (Vitest + RTL + jsdom); one test file per
  component with meaningful behavior, plus logic tests for state,
  utilities, services, and hooks. Hooks use `@testing-library/react`'s
  `renderHook`. Playwright is used ad hoc for manual verification, not as
  a maintained suite (see Working agreements for when to reach for it).
- `src/test/setup.ts` registers `cleanup` after each test and polyfills
  `<dialog>`'s `showModal`/`close`. `renderWithProvider` wraps components
  in `AppStateProvider`.
- The initial scheme is random and `localStorage` persists across tests in a
  file, so tests must not assume a specific starting scheme or empty
  design. Pick dynamically and/or `localStorage.clear()` in `beforeEach`.

## Deployment

GitHub Actions (`.github/workflows/ci-deploy.yml`): every push/PR runs lint,
format:check, test, and build; pushes to `main` then deploy to GitHub Pages
automatically (Pages source is "GitHub Actions"). Vite `base` is
`/kaleidoscope/` for production builds only.

## Roadmap

Done: Phase 1 (feature-parity rebuild), comment cleanup, localStorage,
image export/share/download, undo/redo, layout rework, touchscreen wedge
discoverability (eye toggle), reduced grid to radius 7/169 cells for all
devices (was radius 9/271), design randomizer (weighted toward the 5
scheme colors over base; accent excluded), alternative grid shapes
(triangle, 6-point diamond star, hexagram, circle rings, pinwheel)
alongside the original hexagon, selectable via a shape picker with SVG
icon previews (one real piece of each shape's own geometry, rendered
rather than hand-drawn), a codebase-wide rename clearing up "hex"
ambiguity once hexagon and hexagram coexisted (`HexGrid`→`HexagonGrid`,
`hexGroupColors`→ `shapeGroupColors`, etc.), a controls modal with
instructions on every clickable control (reworked from the earlier
touch-only intro modal), a footer.

Next, in priority order:
- README (replace current): what it is, live link,
   screenshots, setup, scripts, stack. Unscheduled until the user supplies
   examples and asks.

Other future possibilities:
- A larger grid (the original radius-9/271-cell size, or similar) offered
  as a secondary option on tablets/full-size screens, now that the default
  for all devices is the smaller radius-7/169-cell grid.
- New color themes released over time (the scheme list is data-driven in
  `src/data/colorSchemes.ts`).
- Custom color picker beyond the presets ("Create your own palette").
- Animation/transition polish.
- Full ARIA grid pattern (roving tabindex, arrow keys) for the grid.
- More alternative shapes/tilings. Anything designable as a wedge, then
  mirrored/copied around, or just copied around without mirroring (like
  the pinwheel).
- (Long-term goal) Preset puzzles to solve... needs more thought by user before discussing.
