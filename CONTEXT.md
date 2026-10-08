# Kaleidoscope: Project Context

The current state of the app: what it is, the standards to follow, and
what's next. For _why_ things are the way they are, see
[DECISIONS.md](./DECISIONS.md). The original 2020 vanilla JS app is preserved
in [old-dom-app-2020/](./old-dom-app-2020) for reference only.

## What it is

A coloring toy. The user paints a small wedge of hexagons and the app
mirrors the work across a 169-cell hex grid with D6 symmetry (rotations plus
reflections), like a kaleidoscope. Includes preset color schemes, dark/light
mode, undo/redo, autosave, and PNG export/share/download.

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
  colors flow through `--base` / `--accent` CSS custom properties set on
  `<main>`; `document.body` background is set separately in `App.tsx`
  because custom properties don't cascade upward.
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
  `layout/` (page chrome, e.g. `Header`), `grid/` (`HexGrid`, `Hexagon`),
  `controls/` (palette and everything below the grid), and `shared/`
  (generic, reusable pieces like `IconButton`/`Button`/`Modal` used across
  the others). One parent folder, not split into top-level feature
  folders, since there's currently only one "epic" (coloring); revisit if
  a genuinely separate major feature is added later. `src/services/` holds
  non-React logic that's used outside a single component (`storageService`,
  `imageExportService`); `src/hooks/` holds reusable React hooks
  (`useImageExport`).
- **State**: `useReducer` + Context, no external state library.
  - `appReducer` handles app actions.
  - `historyReducer` wraps it to provide undo/redo. Only painting, scheme
    changes, and reset are undoable (history is session-only, unlimited).
    Current color and dark mode are not.
  - `storageService.ts` autosaves to `localStorage` (versioned payload,
    scheme saved by name, defensive loading, all storage errors swallowed).
- **Grid** (`src/utils/hexGrid.ts`): axial `(q, r)` cells in a radius-7
  hexagon (169 cells; reduced from the original 271/radius-9 for small
  touchscreens, see DECISIONS.md), computed rather than hand-authored. Each
  cell's group id is the lexicographically smallest coordinate in its D6
  orbit. One cell per group (20 total) is `isClickable`; these form a
  single wedge at 11-12 o'clock. Rendering is SVG polygons.
- **Hex hover**: the hover fill is computed per cell in JS
  (`src/utils/colorMath.ts`): neutral gray if the cell is base/accent,
  otherwise a brightened/saturated version of its own color. It is applied
  via a `--hover-fill` custom property.
- **Touch wedge discoverability**: touch devices have no hover, so
  `src/utils/useIsTouchDevice.ts` (a `(hover: none), (pointer: coarse)`
  media query hook) gates a persistent alternative. `showEditableArea` in
  `AppState` (default `true`, persisted, not undoable) drives the same
  dimming HexGrid already uses for hover, but only applied when
  `isTouch && showEditableArea`; desktop/mouse ignores the flag entirely and
  keeps relying on hover. `EditableAreaToggle` (eye/eye-slash icon button)
  renders only on touch devices to flip it. A one-time `TouchIntroModal`
  explains the toggle; it opens only when touch is detected **and** no
  design was already persisted at load (captured once, before the autosave
  effect in `AppContext` can run, via `hasPersistedDesign()` in
  `storageService.ts`) — so it reappears on reload until the user paints
  something, by design.
- **Defaults**: starts in dark mode with a random color scheme (first
  visit).
- **Scheme/theme switching** remaps painted hexes by palette position;
  toggling dark mode remaps hexes painted exactly base/accent.
- **Image export** (`src/services/imageExportService.ts`, wrapped by the
  `useImageExport` hook for `SaveImageModal`'s generate/download/share
  flow): clones the live SVG, bakes computed stroke styles onto it, forces
  every polygon fully opaque (overriding the editable-wedge dimming, which
  is for on-screen display only), sets explicit width/height (max 1600px),
  and rasterizes to a PNG with the theme base color as background. Share
  is shown only when `navigator.share` supports files; Download is always
  available.

## Layout

A `<header>` with the title, then `<main>`: hex grid, then a `"Controls"`
group holding, in order: current-color swatches (clamp-sized to stay on
one row), undo/redo, and a `"Settings and Actions"` row of icon buttons
(dark/light, color theme, show/hide editable area (touch devices only),
reset, save image). Single column at every width.

## Accessibility standards

- Clickable hexes are `role="button"`, `tabIndex={0}`, labeled
  "Paint hex tile N of 20", and paint on Enter/Space. The SVG is
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
discoverability (eye toggle + intro modal), reduced grid to radius 7/169
cells for all devices (was radius 9/271).

Next, in priority order:

1. **README** (replace current): what it is, live link,
   screenshots, setup, scripts, stack. Unscheduled until the user supplies
   examples and asks.

Ideas, unscheduled:

- Sticky footer, transparent background, simple copyright statement with current full year
- A larger grid (the original radius-9/271-cell size, or similar) offered
  as a secondary option on tablets/full-size screens, now that the default
  for all devices is the smaller radius-7/169-cell grid.
- Alternative shapes/tilings beyond hexagons (diamonds and/or triangles in a 6-point star, for example).
- New color themes released over time (the scheme list is data-driven in
  `src/data/colorSchemes.ts`).
- Custom color picker beyond the presets ("Create your own palette").
- Animation/transition polish.
- Full ARIA grid pattern (roving tabindex, arrow keys) for the grid.
- (Long-term goal) Preset puzzles to solve... needs more thought by user before discussing.
