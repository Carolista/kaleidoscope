# Kaleidoscope: Decisions

Settled choices and their rationale, grouped by topic. Superseded experiments
are omitted unless they explain a constraint worth preserving. For current
implementation and working agreements, see [CONTEXT.md](./CONTEXT.md).

## Stack and boundaries

- Rebuilt the 2020 DOM app in React/Vite/TypeScript rather than extending its
  hand-authored markup. Preserve the legacy app as-is for reference.
- Use computed SVG geometry, CSS Modules/plain CSS, and reducer + Context state.
  An external state library or feature-folder overhaul is unnecessary for one coloring app.
- Keep shape math in `shape-geometry`, shared math in `utils`, non-React services
  in `services`, and React lifecycle logic in hooks.
- Share actual repeated behavior: `GridView` for grid interactions,
  `ModalHeader` for modal chrome, and narrow geometry helpers. Keep per-shape
  generation, unusual bounds, modal widths, and content layouts local.
- Shared controls intentionally depend on app state for icon tinting.
  Provider-independent wrappers or dependency injection would solve no current need.
- Reuse the palette-aware custom `Checkbox` for confirmation preferences and
  export options. Keep its native input for labelling and keyboard interaction;
  the decorative checkmark uses the same duotone tint as other app icons.
  Call sites retain their own placement and text sizing.
- Use **scheme** in code and **palette** in UI; reserve **theme** for dark/light mode.
  This replaces the ambiguous `ColorThemeButton`/`ColorThemeModal` names.
  Folder aliases and geometry export names were not broadly renamed.

## Puzzle Mode prototype

- Keep puzzle placements separate from Zen reducer/history/storage. The puzzle
  stays mounted across mode switches, but progress is intentionally session-only.
- Start with the small hexagon's six representative cells and connected pieces
  of one, two, and three tiles. Use Cabo for this POC; defer rotation and
  set/pack authoring.
- Generate repeatable versioned definitions from explicit seeds. Publish full
  definitions rather than seeds alone; generator changes must not rewrite
  published puzzles. Generation guarantees a solution, not a unique solution
  or certified difficulty.
- Accept any non-overlapping placement inside the wedge. Match the completed
  colors to determine success, then remove interaction and piece/wedge outlines.
- Render the dragged piece at board scale with the grabbed tile centered on the
  pointer, not as an offset translucent copy or snapped preview. Muted mirrored
  tiles reveal full color on completion; placed tray entries are disabled and
  desaturated until returned.
- Keep the goal image and uniformly scaled tray pieces together above the
  full-width board, without visible instructions or piece labels. Celebrate a
  solve with the reusable small Modal variant: centered Mr Dafoe heading,
  compact corner close control, and Next Puzzle action. Dismissal preserves the
  solved board; the on-page next-puzzle action is available only after a solve.
- Keep existing Modal defaults unchanged. `size="sm"` supplies the simplified
  celebration layout, and CloseButton reuses IconButton's existing small size.
- Generate new seeds with `crypto.getRandomValues`, which works over local
  network HTTP. `crypto.randomUUID` requires a secure context and can prevent
  even Zen Mode from mounting when the puzzle component initializes.

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

- **Hexagon:** radii 3/4/6; medium is the default. Large uses radius 6
  rather than the former radius 7 to keep density more manageable.
- **Triangle:** equilateral size-4/7/10 lattices with D3 symmetry. Small matches
  the intro; large preserves the previous regular grid; medium is the default.
- **Diamond star:** whole rhombi, not half-diamond triangle slivers.
  Three/four/five subdivisions per axis are available; medium retains the
  previous 96 cells/10 groups. Widening the point angle
  from 30 to 45 degrees improved touch targets without losing the star silhouette.
- **Hexagram:** a central hexagon plus six equilateral points, subdivided into
  equilateral triangles. Six triangles meeting only at the center would form a
  hexagon, not a star. Sizes 2/3/4 are available; large remains the default
  with 192 cells/20 groups.
- **Circle rings:** ring `n` has `6n` circles. The center and first ring share a
  minimum diameter; later rings grow by `1/12` of it per step. Spacing factor
  `1.04` satisfies within-ring and between-ring non-overlap constraints.
  Three/four/six rings are available; large remains the default with
  127 cells/16 groups. Seven forced overly subtle growth or tight spacing.
- **Pinwheel:** eight unequal-sided spokes with uniform 2:1 parallelogram cells,
  2 x 2, 2 x 3, or 3 x 3 steps per spoke. Large remains the default with
  72 cells/9 groups. Equal-sided rhombi looked like a star.
  Gaps between blades are intentional; asymmetry comes from unequal side lengths,
  not unequal default step counts.

Circle sizing was reviewed at the 560px grid cap for roughly 30px minimum
diameters. This is not a minimum touch-target guarantee at narrower rendered sizes.
Correct orbit counts and non-overlap alone do not establish visual usability.
Large Diamond Star tiles can feel small on mobile; density tuning remains
deferred pending further hands-on testing.

Shape-picker previews use each shape's real geometry at a small size, not
hand-drawn paths. Stroke width scales with preview width for consistent appearance.
Supported shapes and picker visibility are distinct so hiding an option does not
invalidate saved designs. Exhaustive mappings make missing implementations detectable.

Use three scaled versions of the same preview icon rather than visible shape
names or size abbreviations. Equal square buttons keep touch targets consistent;
icon scale conveys size, while accessible names and tooltips retain identification.

## State, history, and storage

### Design edits versus tool choices

History wraps the app reducer with snapshots of scheme, shape, per-shape sizes,
and all board paint maps. This keeps painting, palette changes, shape/size changes, randomization, and reset
undoable without restoring old tool/view settings.

- History is one unlimited chronological timeline for the session, not a separate
  stack per board, and is not persisted. All restored boards form the initial
  baseline; undo follows subsequent edits and switches in order.
- No-op designs neither add snapshots nor clear redo. Scheme reselection still
  resets the selected paint color, but that tool-only change preserves history.
- If snapshot restoration makes a selected palette color unavailable, follow
  its position into the restored palette. Keep colors already available there
  and neutral base/accent selections.
- Each shape/size combination is an independent board, so returning to any of the
  18 boards resumes its pattern without partially matching group IDs or clearing
  another design. Unvisited boards start empty. A shape-and-size selection is
  one history step, and each shape remembers its size independently.
- Palette and theme remain global rather than being restored per board. Palette
  changes remap painted palette colors by position on active and inactive boards,
  preserving non-palette literal colors. Explicit theme toggles remap neutral
  base/accent paint on all boards; board switches and undo/redo leave the theme
  setting alone.
- Reset and randomize affect only the active board; snapshots preserve the
  inactive boards as well.
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
Persist per-shape sizes and migrate earlier effective sizes rather than
silently shrinking returning users' designs. Version 5 accepts versions 1-4:
old placeholder medium values for Hexagram, Circle Rings, and Pinwheel map
to large only in versions predating that shape's size choices.

Keep all boards and global settings in one versioned `kaleidoscope:design`
record so a save captures palette remapping and board switches together.
Board keys use stable shape and size IDs, not visible labels. Active paint stays
in `shapeGroupColors` for existing rendering consumers; `savedBoards` holds only
inactive boards, avoiding two copies of the active pattern. Validate board keys,
paint maps, and colors, and reject inactive entries duplicating the active board.
Older single-design records migrate paint only to their original effective
active board; do not invent patterns for other boards.

Storage is best-effort: unavailable/full storage must not crash the toy.
No debounce is needed for deliberate user actions. The historical
`hexGroupColors` rename retained version 1; incompatible pre-rename payloads
fall back rather than migrate.

The first-visit rule uses **storage-key existence**, checked before autosave,
not successful restoration or a separate "seen" preference. Autosave can
write a design without painting; help remains manually accessible.

A first visit always starts with the first scheme in the data rather than a
random one, so the intro is identical for everyone. Returning users get their
saved scheme, so random initial selection was removed.

## Interaction and accessibility

- Keep one column with the grid first and grouped controls beneath it.
  Undo/redo use smaller 1.875rem buttons as an accepted compactness/touch-target
  tradeoff; other icon buttons use 2.5rem.
- Use native `<dialog>` for modal focus/backdrop/cancel behavior, with parent-controlled
  opening/closing. Custom confirmation UI replaces `window.confirm`.
- Keep modal headers stationary and use one viewport-bounded scrolling body.
  Conditional edge fades and chevrons make hidden content discoverable without
  permanent instructions. Background scroll locking preserves page position;
  a shared lock count prevents a nested confirmation from unlocking its picker.
- Animate all modals through the shared `Modal`: a slow fade, blur clearing, and
  upward drift (1 second in, 500ms out; 8px blur and 200px travel). Keep the motion
  distinct from the grid's scaling/rotation, without bounce. The Web Animations
  API allows interrupted transitions to continue from their current appearance;
  the backdrop uses a CSS opacity transition. Defer native close and scroll
  unlocking until the exit finishes, and ignore dismissal/actions during closing.
  The optional `onAfterClose` callback lets Save Image retain its export session
  through the exit rather than flash a loading state or revoke the visible preview.
  Skip panel animation for reduced motion or missing Web Animations API support;
  reduced motion also disables backdrop transitions.
  Contain scroll gestures at the body's boundaries and make overflow keyboard-focusable.
- Reset retains its confirmation and opt-out. Only confirming with the checkbox
  checked saves the preference; canceling clears the checkbox. Board switches
  no longer need destructive-action confirmation because every pattern is
  retained; any old shape-change opt-out is no longer consulted.
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
- First visits get a learn-by-doing intro before the help modal: place five colors
  on a small triangle grid (one more tile than the hexagon prototype's four, for
  more visual interest), then Continue reveals the app with help open. The intro
  paints locally rather than through app state, so it never touches the saved
  design or undo history, and Continue starts a fresh full-size design. Used
  swatches are disabled so every tile gets a distinct color.

## Styling and icons

Self-host fonts through `@fontsource` to avoid external font requests.
Urbanist replaced Roboto for body text; Mr Dafoe is reserved for the intro's
Welcome/Congratulations headings, with Righteous staying for the brand and UI chrome.

Use a six-petal diamond star in place of the first O in the Righteous wordmark.
Keep standalone logos as outlined SVGs for portability, but render live Righteous
text around the favicon in the app header: outlined letters appeared rough at
header sizes, and rendering hints or a thin stroke did not visibly improve them.
Align the four side-petal tips with the lettering's upper/lower bounds and favor
optical spacing toward the curved D over equal numeric gaps.

**Opening logo:** animate the existing heading rather than duplicate the mark.
Wait for the star's actual animation-end event instead of duplicating its CSS
duration in a timer. Measure the centered and final header bounds, then animate
the heading's translation and scale back to its normal layout (FLIP). Keep the
content's 2-second opacity transition independent of the 1.4-second logo move;
removing a reveal-animation class when the logo lands would truncate the fade.
Skip the entrance for reduced motion or missing Web Animations API support.

**Loading star:** share the favicon rendering and named CSS animation modes in
`LogoStar`, with a small `Spinner` wrapper for loading placement. Keep wordmark
alignment in `Header` so loading indicators do not inherit optical offsets.
The Save Image modal pairs the decorative, pulsing star with its existing live
status text; reduced motion disables the animation without hiding that status.

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

**Grid swap animation:** the app is meant to feel relaxing, so the transition is
slow and soft (about 420ms out, 760ms in, a few percent of overshoot, ±24° turn)
rather than snappy. The outgoing grid is cloned from the DOM in a React ref
cleanup, because the grid components read live state and would otherwise repaint
with the new design while shrinking. Animations use the Web Animations API, so no
transition state lives in React or the reducer. The stage reserves a stable height
using the smallest aspect ratio across all supported shapes and sizes (currently
Diamond Star and Hexagram, width/height = sqrt(3)/2), subject to the same 560px
width cap and viewport allowance as the grids. Each grid is centered in this area;
the controls never move during swaps. Reduced-motion users get an instant swap.

## Export and randomization

Share images rather than design URLs. Offer PNG download plus file sharing when
supported, not a disabled Share button on unsupported browsers.

Clone the live SVG, bake in strokes, force all polygon/circle cells opaque, and
rasterize with theme base behind it. Editable-area dimming is a view aid, not
part of the exported design. Reserve preview dimensions before generation to
avoid modal resizing.

Let users compare PNG previews with and without grid lines before downloading
or sharing. Keep lines on for the initial default to preserve existing exports,
then remember changes immediately in a separate browser preference across all
designs and visits. This is an export choice, not a design edit or undo step.
Removing strokes leaves intentional spacing between cells/blades intact.

Generate each version lazily and cache both for one modal opening, including
in-flight requests, so repeated toggles never duplicate rasterization. Do not
cache across openings: the design or theme may have changed. Download and share
always use the selected preview, and completion of the closing animation releases
every cached object URL.

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
