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

## Grid symmetry analysis (informs Step 2's design)

The original hand-authored markup was analyzed to confirm its mirroring
pattern: 271 hexagons total, with each hexagon belonging to a "type" group
that is repainted together. Orbit sizes are 1 (the dead-center hex), 6 (hexes
that lie on one of the 6 mirror axes), or 12 (all other hexes) — consistent
with **D6 dihedral symmetry**. The rewrite computes this from axial/offset hex
coordinates instead of encoding 271 cells by hand.

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
  - Mobile/touch refinements

## Process

- Work proceeds one Phase 1 step at a time (see project plan); the user
  reviews and makes the commit at each step before moving to the next.
