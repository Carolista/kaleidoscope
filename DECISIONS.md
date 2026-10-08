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

## Process

- Work proceeds one Phase 1 step at a time (see project plan); the user
  reviews and makes the commit at each step before moving to the next.
