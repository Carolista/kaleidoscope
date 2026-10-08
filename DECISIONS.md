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
  recoloring, dark mode, reset). No new features in this phase.
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

## Process

- Work proceeds one Phase 1 step at a time (see project plan); the user
  reviews and makes the commit at each step before moving to the next.
