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
- The settings gear icon is adapted from the open-source Feather Icons
  "settings" glyph (MIT licensed).

## Process

- Work proceeds one Phase 1 step at a time (see project plan); the user
  reviews and makes the commit at each step before moving to the next.
