# Kaleidoscope: Project Context

Current behavior, architecture, and working standards. For rationale, see
[DECISIONS.md](./DECISIONS.md).

## App

A coloring toy: paint one tile and its symmetry group updates across the grid.
Includes preset palettes, six shapes, dark/light mode, undo/redo, autosave,
and PNG download/share.

Live: https://codewithcarrie.com/kaleidoscope/

The modern app lives in [src/](./src). Leave the original
[2020 DOM app](./old-dom-app-2020/) unchanged.

## Working agreements

- Work in small, logical steps. The user reviews and makes commits unless asked otherwise.
- Ask before decisions that change behavior or scope.
- Prefer reusable, modular code and clear boundaries; avoid speculative abstractions.
- Use focused tests during iteration. Batch full lint, formatting, tests, build,
  and browser verification when the user is ready to finalize.
- Do not use browser tools for small in-progress tweaks. After file moves or
  renames, restart the dev server before browser verification.
- Update these documents after review, not while a decision is still changing.
- README is a separate task, awaiting the user's examples and direction.

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

Font Awesome Pro packages require `FONT_AWESOME_AUTH_TOKEN` in the local
environment and as a **repository Actions secret** for CI.
[.npmrc](./.npmrc) reads that environment variable; never commit the token.

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
- Self-hosted fonts: Righteous 400; Roboto 400 and 900.
- Icon buttons use accessible labels and tooltips. Toggle labels/icons describe
  the destination. Standard boxes are 2.5rem; undo/redo use 1.875rem.
- Shared controls are **app-shared**, not provider-independent primitives:
  icon tinting intentionally reads app state.

## Architecture

| Location | Responsibility |
| --- | --- |
| [components/layout/](./src/components/layout/) | Header and footer |
| [components/grid/](./src/components/grid/) | Shape adapters, shared `GridView`, polygon/circle cells |
| [components/controls/](./src/components/controls/) | Toolbar, pickers, and modal content |
| [components/shared/](./src/components/shared/) | Buttons, native `Modal`, `ModalHeader`, `ConfirmDialog` |
| [shapeGeometry/](./src/shapeGeometry/) | Shape-specific generation and layout (`@geometry`) |
| [utils/](./src/utils/) | Shared math, symmetry, randomization, and geometry dispatch |
| [state/](./src/state/) | App reducer, history wrapper, and Context |
| [services/](./src/services/) | Persistence, confirmation preferences, PNG export |
| [hooks/](./src/hooks/) | React lifecycle and interaction logic |
| [data/](./src/data/) | Palettes and supported-shape definitions |
| [types/](./src/types/) | Domain types, imported from individual modules |

Shape adapters supply geometry to `GridView`; it owns numbering, painting,
highlighting, announcements, and SVG references. Helpers preserve generated
cell/group ordering. `averagePoint` is a vertex average, not an area-weighted centroid.

[gridShapes.ts](./src/data/gridShapes.ts) defines supported IDs, labels, order,
and picker visibility. All six are currently visible. Hidden entries remain
loadable; component/geometry mappings and previews enforce complete shape coverage.
React rendering remains separate from geometry and storage.

### Default grids

| Shape | Symmetry | Size | Cells | Clickable groups |
| --- | --- | --- | --- | --- |
| Hexagon | D6 | Radius 7 | 169 | 20 |
| Triangle | D3 | Size 10 | 100 | 22 |
| Diamond star | D6 | 4 x 4 per point | 96 | 10 |
| Hexagram | D6 | Size 4 | 192 | 20 |
| Circle rings | D6 | 6 rings + center | 127 | 16 |
| Pinwheel | C8, rotation only | 3 x 3 per spoke | 72 | 9 |

Hexagons use axial-coordinate symmetry; other shapes use the shared geometric
symmetry engine. One representative per group is clickable.

### State and persistence

- New designs start in dark mode with a random scheme and its first color selected.
- Painting toggles a group back to accent when its current color is selected again.
  Unpainted groups also display accent.
- Scheme changes remap painted palette colors by position and select the first
  new color. Shape changes clear the design.
- Undoable: paint, scheme, shape, randomize, reset. Current color, dark mode,
  and editable-area visibility are tool/view choices, not undo stops.
- History is unlimited, session-only. Unchanged designs preserve undo/redo;
  real design edits clear redo. Snapshot restoration reconciles unavailable
  selected palette colors by position, preserving available and neutral selections.
- Autosave writes version 1 to `kaleidoscope:design` on state changes. It saves
  scheme name, selected color, dark mode, shape, editable-area preference, and paint map.
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
- Help opens when the design storage key is absent at startup, checked before
  autosave. Key existence, not payload validity, determines this rule.
- Backgrounds are literal inline colors with no transitions: synchronous
  bootstrap on `html`, render on `.page`, `useLayoutEffect` on `html`/`body`.
  Descendants use `--base`/`--accent`. Button hover backgrounds also snap instantly.

### Export and randomization

- Export clones the SVG, inlines strokes, forces polygons/circles opaque, and
  rasterizes against theme base. Default longest PNG dimension: 1600px.
- The preview reserves the shape's aspect ratio. Generation failures show an
  error; share failures retain preview/download/retry. Share cancellation is quiet.
  Share appears only when file sharing is supported; download is enabled when ready.
- Randomization weights each scheme color 18 times and theme base 10 times
  (90% palette, 10% base). Accent is excluded. The pool is built once per design;
  duotone tint is computed once per hook invocation.

## Tests and deployment

Logic/component tests use Vitest + RTL/jsdom; hooks use `renderHook`.
[Test setup](./src/test/setup.ts) registers cleanup and polyfills dialog open/close.
Clear or seed storage and use deterministic state/randomness where needed.
jsdom does not verify real layout, native focus trapping, or PNG rasterization.
Browser checks are ad hoc; there is no maintained browser suite or coverage threshold.

[CI](./.github/workflows/ci-deploy.yml) runs lint, format checks, tests, and build
on pushes to `main` and PRs targeting `main`; successful pushes deploy to Pages.
Production base is `/kaleidoscope/`; development uses `/`.

## Deferred ideas

Larger optional grids, more presets/shapes, custom palettes, animation polish,
roving-tabindex/arrow-key navigation, and eventually puzzles. None is committed scope.
