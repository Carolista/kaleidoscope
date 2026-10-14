# Kaleidoscope: Project Context

Current behavior, architecture, and working standards. For rationale, see
[DECISIONS.md](./DECISIONS.md).

## App

A coloring toy: paint one tile and its symmetry group updates across the grid.
Includes preset palettes, six shapes with three sizes each, dark/light mode, undo/redo, autosave,
and PNG download/share.

Live: https://codewithcarrie.com/kaleidoscope/

The modern app lives in [src/](./src). Leave the original
[2020 DOM app](./old-dom-app-2020/) unchanged.

## Working agreements

- Work in small, logical steps. The user reviews and makes commits unless asked otherwise.
- Ask before decisions that change behavior or scope.
- Prefer reusable, modular code and clear boundaries; avoid speculative abstractions.
- Use focused tests during iteration. Do not batch full lint, formatting, tests, build, and browser verification until the user is ready to finalize.
- Do not use browser tools for small in-progress tweaks. 
- After file moves or renames, restart the dev server before browser verification.
- Update CONTEXT, DECISIONS, & README documents only after review, not while a decision is still changing.

## Stack and commands

React 19, TypeScript, Vite, CSS Modules, Vitest, React Testing Library/jsdom,
ESLint, Prettier, Node/npm.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Typecheck and production build |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with automatic fixes |
| `npm run format` | Format files |
| `npm run format:check` | Check formatting |
| `npm test` | Run tests once |
| `npm run test:coverage` | Run tests once with V8 coverage reports in `coverage/` |

### Font Awesome authentication

Installing dependencies requires a Font Awesome token with access to the project's
private Pro packages. Set `FONT_AWESOME_AUTH_TOKEN` in your shell before running
`npm ci`; [.npmrc](./.npmrc) configures the registries and reads that environment
variable. Never commit the token.

For CI, add `FONT_AWESOME_AUTH_TOKEN` under **Settings > Secrets and variables >
Actions > Repository secrets**. A secret stored only in the `github-pages`
environment is not available to the test job. The workflow checks for a missing
token before installing dependencies without printing its value.

GitHub does not provide Actions secrets to pull requests from forks or Dependabot,
so those runs cannot install the private packages with this workflow.

## Branding

### Favicon

[public/favicon.svg](./public/favicon.svg) is a static version of the shape
picker's six-petal diamond star, with a transparent background and muted colors.
Each polygon has a position-based ID and its own fill color. To update the
palette, edit the six `fill` values, ordered clockwise from the top petal.

The stroke width is `0`, so no outline is visible; the white stroke and rounded
join settings remain available if an outline is wanted later. The square viewBox
includes padding to keep an outline from clipping.

### Logo

The header combines live Righteous 400 lettering (`KALEID` and `SCOPE`) with
the favicon replacing the first O. Letter color follows the app's theme accent;
the six petal colors stay fixed. The star's side tips align with the lettering's
upper/lower bounds, and spacing shifts it slightly toward the curved D for
optical balance. The combined mark has one accessible heading name.

[public/logo-black.svg](./public/logo-black.svg) and
[public/logo-white.svg](./public/logo-white.svg) are transparent, standalone
logos with Righteous lettering converted to paths so no font installation is
needed. [public/logo.svg](./public/logo.svg) retains a `currentColor` version
for inline SVG reuse; an external image does not inherit the page's text color.
These use the same taller star proportion, but the app uses live text instead
of their outlined lettering. Petal fills are copied from the favicon; palette
changes should be applied to all four SVG assets.

## Code standards

- TypeScript; Prettier tabs, single quotes, no semicolons, trailing commas.
- Short plain comments only for non-obvious logic. No JSDoc.
- CSS Modules for component styles; plain CSS for global rules. No Tailwind or CSS-in-JS.
- **Scheme** in code/file names; **palette** in user-facing text.
  **Theme** refers to dark/light mode, not palettes.
- Keep persisted shape IDs stable. Keep aliases aligned between
  [Vite](./vite.config.ts) and [TypeScript](./tsconfig.app.json).
- Import individual Font Awesome definitions and render `FontAwesomeIcon` SVGs.
  [main.tsx](./src/main.tsx) imports core CSS and disables automatic CSS injection.
  No Kit script or Kit dependency.
- Self-hosted fonts: Righteous 400 (header, buttons, modal titles); Mr Dafoe 400
  (intro Welcome/Congratulations headings); Urbanist 200, 400, 400 italic, and 700
  (body text and default bold headings).
- Icon buttons use accessible labels and tooltips. Toggle labels/icons describe
  the destination. Standard boxes are 2.5rem; undo/redo use 1.875rem.
- Shared controls are **app-shared**, not provider-independent primitives:
  icon tinting intentionally reads app state.
- kebab-case preferred over camelCase for directory naming convention.
- CSS Module class names are camelCase so they can be read as `styles.itemTitle`
  rather than `styles['item-title']`. Custom properties, element ids, and data
  attributes stay kebab-case.

## Architecture

| Location | Responsibility |
| --- | --- |
| [components/layout/](./src/components/layout/) | Header and footer |
| [components/grid/](./src/components/grid/) | Shape adapters, shared `GridView`, polygon/circle cells |
| [components/controls/](./src/components/controls/) | Toolbar, pickers, and modal content |
| [components/intro/](./src/components/intro/) | First-visit learn-by-doing sequence |
| [components/shared/](./src/components/shared/) | Buttons, native `Modal`, `ModalHeader`, `ConfirmDialog` |
| [shape-geometry/](./src/shape-geometry/) | Shape-specific generation and layout (`@geometry`) |
| [utils/](./src/utils/) | Shared math, symmetry, randomization, and geometry dispatch |
| [state/](./src/state/) | App reducer, history wrapper, and Context |
| [services/](./src/services/) | Persistence, confirmation preferences, PNG export |
| [hooks/](./src/hooks/) | React lifecycle and interaction logic |
| [data/](./src/data/) | Palettes and supported-shape definitions |
| [types/](./src/types/) | Domain types, imported from individual modules |

Shape adapters supply geometry to `GridView`; it owns numbering, painting,
highlighting, announcements, and SVG references. An optional `interaction`
prop (supported by `TriangleGrid`) replaces app-state paint colors, paint handling,
paintable groups, and highlighting; the intro uses it for its local design. Helpers preserve generated
cell/group ordering. `averagePoint` is a vertex average, not an area-weighted centroid.

[gridShapes.ts](./src/data/gridShapes.ts) defines supported IDs, labels, order,
and picker visibility. All six are currently visible. Hidden entries remain
loadable; component/geometry mappings and previews enforce complete shape coverage.
React rendering remains separate from geometry and storage.

### Grid sizes

Each shape offers small, medium, and large grids. Size choices are remembered
independently per shape in [gridSizes.ts](./src/data/gridSizes.ts).

| Shape | Small | Medium | Large | Default |
| --- | --- | --- | --- | --- |
| Hexagon | Radius 3 | Radius 4 | Radius 6 | Medium |
| Triangle | Size 4 (intro size) | Size 7 | Size 10 | Medium |
| Diamond star | 3 x 3 per point | 4 x 4 per point | 5 x 5 per point | Medium |
| Hexagram | Size 2 | Size 3 | Size 4 | Large |
| Circle rings | 3 rings + center | 4 rings + center | 6 rings + center | Large |
| Pinwheel | 2 x 2 per spoke | 2 x 3 per spoke | 3 x 3 per spoke | Large |

Default app grids:

| Shape | Symmetry | Size | Cells | Clickable groups |
| --- | --- | --- | --- | --- |
| Hexagon | D6 | Radius 4 | 61 | 9 |
| Triangle | D3 | Size 7 | 49 | 12 |
| Diamond star | D6 | 4 x 4 per point | 96 | 10 |
| Hexagram | D6 | Size 4 | 192 | 20 |
| Circle rings | D6 | 6 rings + center | 127 | 16 |
| Pinwheel | C8, rotation only | 3 x 3 per spoke | 72 | 9 |

Hexagons use axial-coordinate symmetry; other shapes use the shared geometric
symmetry engine. One representative per group is clickable.

### State and persistence

- New designs start in dark mode with the first scheme in
  [colorSchemes.ts](./src/data/colorSchemes.ts) and its first color selected.
- Painting toggles a group back to accent when its current color is selected again.
  Unpainted groups also display accent.
- Scheme changes remap painted palette colors by position and select the first
  new color. Shape changes clear the design.
- Resizing the active shape retains paint for shared group IDs and removes
  paint for groups absent at the new size. Switching shape and size is one undo step.
- Undoable: paint, scheme, shape, grid size, randomize, reset. Current color, dark mode,
  and editable-area visibility are tool/view choices, not undo stops.
- History is unlimited, session-only. Unchanged designs preserve undo/redo;
  real design edits clear redo. Snapshot restoration reconciles unavailable
  selected palette colors by position, preserving available and neutral selections.
- Autosave writes version 4 to `kaleidoscope:design` on state changes. It saves
  scheme name, selected color, dark mode, shape, per-shape sizes,
  editable-area preference, and paint map.
- Versions 1-3 remain loadable. Missing size data restores the active shape's
  legacy size. Earlier placeholder medium values for Hexagram (v1), Circle Rings
  (v1-2), and Pinwheel (v1-3) migrate to large to preserve their previous grids.
- Loading rejects malformed records, arrays, invalid six-digit hex colors,
  unknown versions/shapes/schemes; fallback is a fresh design. Missing historical
  shape/visibility fields default to hexagon/true. Storage failures never crash the app.
- Colors retain case and need not belong to the current palette. Unknown group IDs
  are retained; no palette-color migration is implemented.

### UX and accessibility

- Single column: header, grid, swatches, undo/redo, settings/actions, footer.
  Action order: editable area (touch only), palette, randomize, reset, shape,
  image, dark/light mode, help. Keep help descriptions aligned with the toolbar.
- Pointer hover dims non-clickable cells. Touch uses a persisted editable-area
  toggle, initially on. The grid is capped at 560px with a 226px viewport allowance.
- SVGs use `role="group"` with instructions; clickable cells are labeled buttons
  with sequential Tab navigation and Enter/Space painting. Decorative cells/icons
  are hidden from assistive technology; a live region announces painting.
- Retain visible focus indicators and unique dialog/instruction label IDs.
- Native dialogs provide modal focus behavior. Reset/shape confirmations have
  independent persistent opt-outs, saved only on confirmation.
- The shape picker uses three scaled versions of each icon (32/48/64px) in
  equal 88px square buttons, without visible shape or size text. Accessible
  names and tooltips identify shape and size as S/M/L. Rows wrap at narrow widths.
- All modals have stationary headers and one scrolling body, bounded by the
  dynamic viewport height. Fades and chevrons indicate more content above/below;
  overflowing bodies are keyboard-focusable. Scroll containment and shared
  background locking prevent page scrolling, including while confirmations
  are nested over pickers. Closing the last modal restores page scroll position.
- When the design storage key is absent at startup (checked before autosave; key
  existence, not payload validity), `App` shows the first-visit intro instead of the
  grid, controls, and footer. Intro state is local: a size-4 triangle grid with its
  5 paintable tiles, and the first scheme's five colors. Choosing a swatch and a tile
  permanently paints that tile and disables that swatch; after five, dimming is
  released and **Continue** replaces the swatches. Continue shows the regular app
  with a fresh design and the help modal open. Nothing is saved until then. The
  help modal itself stays available through its toolbar button.
- Backgrounds are literal inline colors with no transitions: synchronous
  bootstrap on `html`, render on `.page`, `useLayoutEffect` on `html`/`body`.
  Descendants use `--base`/`--accent`. Button hover backgrounds also snap instantly.

### Export and randomization

- Export clones the SVG, inlines strokes, forces polygons/circles opaque, and
  rasterizes against theme base. Default longest PNG dimension: 1600px.
- The preview reserves the selected shape and size's geometry-derived aspect ratio. Generation failures show an
  error; share failures retain preview/download/retry. Share cancellation is quiet.
  Share appears only when file sharing is supported; download is enabled when ready.
- Randomization weights each scheme color 18 times and theme base 10 times
  (90% palette, 10% base). Accent is excluded. The pool is built once per design;
  only groups present at the selected grid size are randomized.
  Duotone tint is computed once per hook invocation.

## Tests and deployment

Logic/component tests use Vitest + RTL/jsdom; hooks use `renderHook`.
[Test setup](./src/test/setup.ts) registers cleanup, polyfills dialog open/close,
and stubs page scrolling and `ResizeObserver` for jsdom.
Clear or seed storage and use deterministic state/randomness where needed.
jsdom does not verify real layout, native focus trapping, or PNG rasterization.
Browser checks are ad hoc; there is no maintained browser suite or coverage threshold.

[CI](./.github/workflows/ci-deploy.yml) runs lint, format checks, tests, and build
on pushes to `main` and PRs targeting `main`; successful pushes deploy to Pages.
Production base is `/kaleidoscope/`; development uses `/`.
