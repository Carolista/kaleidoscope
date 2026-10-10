# Kaleidoscope: Decisions

Settled choices and their rationale, grouped by topic. Superseded experiments
are omitted unless they explain a constraint worth preserving. For current
implementation and working agreements, see [CONTEXT.md](./CONTEXT.md).

## Stack and boundaries

- Rebuilt the 2020 DOM app in React/Vite/TypeScript rather than extending its
  hand-authored markup. Preserve the legacy app as reference.
- Use computed SVG geometry, CSS Modules/plain CSS, and reducer + Context state.
  An external state library or feature-folder overhaul is unnecessary for one coloring app.
- Keep shape math in `shapeGeometry`, shared math in `utils`, non-React services
  in `services`, and React lifecycle logic in hooks.
- Share actual repeated behavior: `GridView` for grid interactions,
  `ModalHeader` for modal chrome, and narrow geometry helpers. Keep per-shape
  generation, unusual bounds, modal widths, and content layouts local.
- Shared controls intentionally depend on app state for icon tinting.
  Provider-independent wrappers or dependency injection would solve no current need.
- Use **scheme** in code and **palette** in UI; reserve **theme** for dark/light mode.
  This replaces the ambiguous `ColorThemeButton`/`ColorThemeModal` names.
  Folder aliases and geometry export names were not broadly renamed.

## Geometry and shape design

### Symmetry

Measurements of the original hexagon grid confirmed D6 symmetry. Axial
coordinates give exact hexagon orbits; the canonical representative makes one
contiguous editable wedge.

Other shapes use geometric transforms and rounded-coordinate lookup in
[symmetry.ts](./src/utils/symmetry.ts). Closed canonical-wedge boundaries include
cells centered on mirror axes; those smaller orbits are genuine, not rounding errors.
Pinwheel uses rotation-only C8 symmetry.

Shared group collection preserves first-seen group order, member order, and cell
references. Refactoring must not change IDs, clickable representatives, or geometry.
Hexagon padding and circle-radius bounds remain separate from polygon bounds.

### Chosen shapes and density

- **Hexagon:** radius 7 replaces the original radius 9 on every device.
  169 cells/20 groups are easier to paint on small screens; a larger option remains deferred.
- **Triangle:** equilateral size-10 lattice, 100 cells/22 groups, with D3 symmetry.
- **Diamond star:** whole rhombi, not half-diamond triangle slivers.
  Four subdivisions per axis give 96 cells/10 groups. Widening the point angle
  from 30 to 45 degrees improved touch targets without losing the star silhouette.
- **Hexagram:** a central hexagon plus six equilateral points, subdivided into
  equilateral triangles. Six triangles meeting only at the center would form a
  hexagon, not a star. Size 4 gives 192 cells/20 groups.
- **Circle rings:** ring `n` has `6n` circles. The center and first ring share a
  minimum diameter; later rings grow by `1/12` of it per step. Spacing factor
  `1.04` satisfies within-ring and between-ring non-overlap constraints.
  Six rings give 127 cells/16 groups. Seven forced overly subtle growth or tight spacing.
- **Pinwheel:** eight unequal-sided spokes with uniform 2:1 parallelogram cells,
  three steps per axis: 72 cells/9 groups. Equal-sided rhombi looked like a star.
  Gaps between blades are intentional; asymmetry comes from unequal side lengths,
  not unequal default step counts.

Circle sizing was reviewed at the 560px grid cap for roughly 30px minimum
diameters. This is not a minimum touch-target guarantee at narrower rendered sizes.
Correct orbit counts and non-overlap alone do not establish visual usability.

Shape-picker previews use each shape's real geometry at a small size, not
hand-drawn paths. Stroke width scales with preview width for consistent appearance.
Supported shapes and picker visibility are distinct so hiding an option does not
invalidate saved designs. Exhaustive mappings make missing implementations detectable.

## State, history, and storage

### Design edits versus tool choices

History wraps the app reducer with snapshots of scheme, shape, and paint map.
This keeps painting, palette changes, shape changes, randomization, and reset
undoable without restoring old tool/view settings.

- History is unlimited for the session and not persisted.
- No-op designs neither add snapshots nor clear redo. Scheme reselection still
  resets the selected paint color, but that tool-only change preserves history.
- If snapshot restoration makes a selected palette color unavailable, follow
  its position into the restored palette. Keep colors already available there
  and neutral base/accent selections.
- Changing shape clears paint because group IDs have shape-specific meanings;
  the previous shape/design remains recoverable through undo.
- **Accepted edge case:** dark-mode toggles remap present base/accent colors but
  not historical snapshots. Undo across a toggle can restore old neutral colors.
  Do not silently change this policy.

### Persistence

Save scheme names rather than objects to relink to live palette data. Selected
and painted colors remain literal hex values; updating palette data does not
migrate them automatically.

Versioned loading rejects unusable payloads and falls back to a fresh design.
Arrays are not paint records; colors must be exact six-digit hex. Palette
membership and group-ID filtering are separate concerns and remain unrestricted.
Keep backward-compatible defaults for optional shape/editable-area fields.

Storage is best-effort: unavailable/full storage must not crash the toy.
No debounce is needed for deliberate user actions. The historical
`hexGroupColors` rename retained version 1; incompatible pre-rename payloads
fall back rather than migrate.

Help's first-visit rule uses **storage-key existence**, checked before autosave,
not successful restoration or a separate "seen help" preference. Autosave can
write a design without painting; help remains manually accessible.

## Interaction and accessibility

- Keep one column with the grid first and grouped controls beneath it.
  Undo/redo use smaller 1.875rem buttons as an accepted compactness/touch-target
  tradeoff; other icon buttons use 2.5rem.
- Use native `<dialog>` for modal focus/backdrop/cancel behavior, with parent-controlled
  opening/closing. Custom confirmation UI replaces `window.confirm`.
- Reset and shape-change opt-outs are independent. Only confirming with the
  checkbox checked saves the preference; canceling clears the checkbox.
  Pickers close after selection.
- Touch devices get an initially enabled, persisted editable-area toggle;
  desktop uses pointer hover. Both dim non-clickable cells.
- Brighten/saturate painted colors for hover; use neutral gray for base/accent.
  This avoids changing grout or adding overlay geometry.
- Interactive SVGs use `role="group"`, not `role="img"` that hides children.
  Sequential Tab plus Enter/Space is intentional; a full ARIA grid is deferred.
  Decorative cells/icons are hidden, paint is announced, labels use unique IDs,
  and focus indicators remain visible.
- General controls help replaced touch-only introductory help. Keep its content
  aligned with available toolbar actions.

## Styling and icons

Self-host fonts through `@fontsource` to avoid external font requests.
Keep Roboto 900: lack of explicit weight declarations does not prove that
browser-default bold headings never use it.

Render individually imported Font Awesome definitions through `FontAwesomeIcon`,
replacing the earlier Kit-script approach. Import core CSS once and disable
automatic injection. The unused Kit package and registry entry were removed.
Duotone secondary layers use the first scheme color normalized to lightness
50 in dark mode or 70 in light mode, fully opaque; single-tone icons skip tint.

**Background flicker constraint:** set literal background colors without transitions.
The synchronous `index.html` bootstrap handles pre-mount paint; `App` renders
`.page` and updates `html`/`body` in `useLayoutEffect`. CSS-only defaults arrive
too late in Vite development; independently animated surfaces previously flickered.
Keep `--base`/`--accent` for descendants.

Button hover backgrounds also have no transition after a Chromium `color-mix()`
animation issue. Modal header styles are shared, while layout-specific CSS stays
local. The app's flex-grow rule is class-scoped, not a global `main` selector.

## Export and randomization

Share images rather than design URLs. Offer PNG download plus file sharing when
supported, not a disabled Share button on unsupported browsers.

Clone the live SVG, bake in strokes, force all polygon/circle cells opaque, and
rasterize with theme base behind it. Editable-area dimming is a view aid, not
part of the exported design. Reserve preview dimensions before generation to
avoid modal resizing.

Generation errors must replace the spinner. Share failures must be visible
without losing preview, download, or retry; canceled shares stay quiet.
Ignore late generation results after closing/unmounting and manage object URLs.

Randomization favors the five palette colors (18 tickets each) over base (10).
Accent is excluded because it is also the unpainted fill. No confirmation:
generation is exploratory and undo is available. Build the pool once per design;
preserve weights, random-call count, and group order. Compute icon tint once per
hook invocation; no global caches are needed.

## Validation and deployment

Use Vitest logic/component tests, RTL/jsdom, deterministic fixtures, and targeted
cross-feature regression tests. Dialog visibility and label relationships matter
more than stale-text absence checks. Register cleanup and dialog polyfills explicitly.

A maintained browser suite and coverage threshold are not justified at this scale.
Use ad hoc browser checks for visual behavior and native interactions; jsdom
cannot certify layout or rasterization. Past tooling failed to expose blob-anchor
download events, so absence of an event alone does not prove a broken download.

GitHub Actions builds before Pages deployment; only successful `main` pushes
deploy. Production assets use `/kaleidoscope/`, inheriting the account site's
custom domain without a project `CNAME`.

Font Awesome authentication uses an environment variable read by project `.npmrc`.
A user-level npm token is insufficient when that project configuration overrides it.
CI requires a repository Actions secret: a deploy-environment secret is unavailable
to the test job. Rerunning an old job uses its old workflow commit.
