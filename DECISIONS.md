# Kaleidoscope: Decisions

Settled choices and their rationale, grouped by topic. Superseded experiments
are omitted unless they explain a constraint worth preserving. For current
implementation and working agreements, see [CONTEXT.md](./CONTEXT.md).

For the UI audit, implementation status, and reuse inventory, see
[UI_AUDIT.md](./UI_AUDIT.md). Its progress section identifies implemented work;
remaining recommendations do not supersede the decisions below.

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
- Shared command/form controls are provider-independent so admin does not need
  player state. `PlayerIconButton` adds palette tinting to the generic icon
  renderer; `AdminIconButton` supplies compact sizing without duplicating markup.
  This supersedes the earlier player-only shared-control boundary.
- Keep global normalization and shared control styles truly shared. Admin
  overrides inherited control tokens for compact Urbanist controls and action
  colors; local modules retain feature layout and specialized choice/gameplay
  controls. Do not style every descendant button through a page selector or
  exclude whole playtest subtrees to compensate.
- Shared text/form controls forward native props and refs. Default command
  buttons to `type="button"`; use explicit native submit buttons for forms.
  Familiar compact actions reuse icons and accessible labels, while Save,
  Apply, Sign in, and confirmation choices retain explicit text.
- Share palette presentation, not palette ownership. `PaletteStrip` renders
  decorative ordered slots (including duplicate colors), while `PaletteChoices`
  takes stable IDs, selected ID, and a selection callback. The player wrapper
  adapts its existing name-based catalog without changing persistence, applies
  immediately, and closes its modal. Admin retains database IDs/loading and
  explicit bulk Apply. Interactive painting swatches remain distinct.
- Extract proven admin compositions through `AdminLayout`: heading/actions,
  error/success feedback, responsive gallery framing, and ordered member rows.
  Keep puzzle/palette/landscape-set card content, native color editing, empty
  messages, retry decisions, and asynchronous lifecycles local. No universal
  page template or generic CRUD abstraction; these domains have different
  eligibility, cancellation, refresh, and mutation semantics.
- Ordinary stacked fields use `FormField` for labels, consistent spacing, and
  optional help/error associations. Its render function supplies native control
  attributes without cloning children or changing native form semantics.
  Inline filter/assignment controls and paired color inputs remain specialized.
- Palette-choice and admin-layout CSS live with those shared presentations.
  Admin supplies inherited palette-choice tokens, not a copy of the player
  picker styles. Gallery framing owns common card borders/padding; local card
  classes own content layout and selection. Preserve square puzzle cards and
  responsive two-column landscape set cards rather than flattening them.
- Global `.visually-hidden` owns clipped accessible text, including admin
  playtest feedback; keep admin screens free of instructional prose. Painting cells share exact grout/hover/focus/dimming rules
  through `Cell.module.css`, with polygon-only joins local. Keep painting,
  puzzle-board, and tray-piece interactions separate rather than sharing rules
  merely because they all render SVG.
- Native mode/shape/color choices, interactive SVG cells, puzzle pieces, and the
  checkbox's hidden native input are intentional specialized controls. They do
  not need command-button styling. Retain compact admin icon sizing; this is
  not a touch-target redesign or an accessibility certification.
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
  of one, two, and three tiles. Use Cabo for this player POC; expanded recipes
  and rotation live in the separate admin lab first.
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

## Admin authoring lab

The admin lab supports six exact hexagon recipes: small without rotation (easy),
small with rotation or medium without (moderate), medium with rotation or large
without (hard), and large with rotation (challenging). Labels do not certify human
difficulty or uniqueness. Save complete version-2 palette-slot definitions, with
palette ID/recipe and private seed/generator/known solution metadata separate.
Resolve stable ordered slots against current palette colors, including duplicates.
Use Challenging as the displayed top-tier label; retain the existing
`super-hard-large` recipe ID and `super_hard` database value for compatibility.

Browse using visual palettes and one-click Randomize, not manual seed editing.
Palette changes recolor the existing layout without resetting placements.
Use one shared New/Edit form with palette refresh/picker on the left and name,
recipe/wand, and intended-use/save rows on the right from 640px, stacked below.
Show creation metadata before generation; require a named preview to save.
Avoid repeated palette labels and displayed seeds. Keep compact gesture help.
Admin defaults to dark mode using the player's neutral charcoal/white theme helper,
not separate tinted canvas colors or player state. Header account/sign-out/theme
controls stay together, with favicon navigation back to the player app.
Skip previewed seeds by shape/exact recipe for the mounted lab session. Current
persistent exclusions derive from saved puzzles, not a separate blacklist table;
deleting an unused draft frees its seed unless another saved row still uses it.
Different seeds can yield visually identical designs.

Tray clicks/taps rotate 60 degrees; dragging moves. Return board pieces via
double-click/double-tap or dragging back, preserving orientation; no board rotation
or separate rotate/return buttons. Keyboard equivalents remain available.
Stable square containers reserve all orientations at consistent tile scale,
with one subtle selected/focus border. The first-rotation set tutorial is deferred.
The admin lab does not mount Zen state or write player progress. Named drafts
save public definitions and private authoring atomically, with idempotent retry
IDs. Intended use can switch between Set/pack and Daily while unassigned.
Assigned galleries derive order from set membership (set name, then position)
rather than naming conventions, so reordering a set reorders the list.
Scheduled/live content is not managed through the draft-only editing/deletion RPCs.

Use a library-first flow with dedicated New/Edit workspaces. Saving a new puzzle
stays in creation; name/palette/recipe controls then configure the next generation,
not the saved preview. Preserve a revised next-puzzle name on generation; clear it
only when exactly unchanged from the last successful save. Warn when discarding
a revised next-puzzle name.

Editing opens stored definitions rather than regenerating from seed. Any puzzle
that is not yet live (unassigned, assigned, or scheduled) can preview replacements, including recipe changes, without deleting their
identity. Save Changes atomically updates public design/recipe and private
provenance/solution under the same ID and returns to the library. Discard keeps the
original; failed saves retain the preview for retry. Recipe selection alone never
changes the current design. Palette changes preserve placements; randomization
resets them. Replacement keeps set/daily assignments and release schedules; only
live puzzles are frozen, and assigned puzzles still cannot change intended use or be
deleted. Recheck all blockers under the catalog lock.
Creation and editing share saved-seed exclusion/generation logic; edit preview
history also excludes the original seed. Guard unsaved work when leaving.

Keep gallery cards non-clickable, with small square custom checkboxes and classic
blue pen-to-square/red trash-can icon buttons. Selection applies to the shown
filter; switching filters or explicitly refreshing clears it. Confirm palette
changes with Apply and deletions with count/names. Bulk changes are all-or-nothing
admin RPC transactions under the catalog lock, with write-time release/reference
rechecks. Assigned drafts cannot be deleted, but unpublished palette edits remain
allowed.

Draft sets have a Core, Reward, or Paid role chosen at creation, not an Undecided
state. Puzzle sets hold 24 puzzles and palette sets hold 6 palettes, but drafts
do not enforce a count; whether publishing enforces it is still open.
Membership is exclusive; append eligible unassigned Set/pack drafts in selection
order. Save removal immediately, but stage renames and member ordering locally: drag
(or keyboard-move) freely, then commit name and order with the set's single
**Save**, the whole order in one RPC. Per-move writes forced a round trip before each next move.
Staged order counts as unsaved work for navigation guards. Palette sets share
the same set card, editor, and staged ordering components.
Keep existing selection mode separate from catalog ordering; do not imply that
reordering enforces a player's completion sequence.

Use visual landscape cards with two equal desktop columns, collapsing at 640px.
Place the representative thumbnail on the left, actions top right, and details
bottom right. Show every member's saved design in the editor so ordering is
visual, not name-dependent. Square-minus means remove membership, distinct from
clearing gallery selection. Never regenerate stored designs for thumbnails.
Confirmed deletion removes only the draft set and its memberships, preserving
all puzzles/private solutions. Reject release and progression/route/reward/grant
dependencies instead of silently cascading meaningful configuration away.
Keep mutations atomic under caller RLS, explicit admin checks, READ COMMITTED
isolation, and the catalog lock. Starter/route/core/reward/release tools follow.

### Admin information hierarchy and catalog cache

Palettes are not subordinate to puzzles: they also serve Zen Mode later. Top-level
admin sections are peers (Puzzles | Palettes | Shapes, with a future orchestration
view for sets/rewards/packs/rollout). Within a content section, Sets is the default
view and items filter by release status (Drafts | Assigned | Scheduled |
Published), so both sections share one mental model.

The admin is a single user, so the catalog cache favors speed over freshness:
keep loaded catalogs for the session in a provider (not module state, which
leaks between tests/clients) and reload only after the admin's own writes or an
explicit Refresh. Apply known edits locally instead of refetching; invalidate
other affected catalogs only if already loaded. Database RPCs remain the
authority for stale-view conflicts. Batch set membership/preview reads instead
of one query per set, chunking `.in()` filters to keep URLs short.

Keep transient save/load status below form content so it never displaces the
controls the admin is using.

### Palette catalog and sandbox

Manage the Supabase palette catalog independently of the local Zen catalog.
Keep starter availability, reward mappings, and palette-pack membership as separate
relationships rather than an exclusive palette category; their management follows.
Existing IDs stay permanent. New/Duplicate starts unnamed and saves under a new,
retry-stable ID; Duplicate copies only the selected palette's ordered colors, not
its publication, references, or ownership.

Draft palettes support name/color edits and confirmed deletion only when unused.
Scheduled/live rows are read-only in this workspace, with duplication still
available. Exceptional published-color correction and release controls remain
separate future work. Recheck draft state and every dependency under the catalog
lock using invoker RLS/admin authorization; compare loaded name, ordered colors,
and revision so name-only concurrent edits are also detected. Preserve inputs on
errors/conflicts rather than silently overwriting changes. Delete palettes from the
library rather than the editor, keeping Save away from the color pickers.
Bulk palette deletion mirrors puzzle drafts: offer it only when every selected
palette is an unassigned draft, and apply it as one all-or-nothing RPC. Unlike
single deletion, it rejects palette-set members rather than detaching them.

Use five numbered color slots with hex text and native color inputs, arranged in
three equal-width columns. Preview in one medium hexagon with Randomize, without
painting, shape selection, or generated puzzle pieces. Each slot has an equal
20% chance; exclude base/accent colors from this sandbox without changing Zen's
weighted randomizer. Keep random assignments as slot indices, not literal colors,
so edits and duplicate colors recolor consistently without rerandomizing.

Show saved puzzle targets and reference names/counts without fetching private
solutions or account identities. Invalid text remains editable, blocks save and
preview, and resumes the same preview pattern when valid. Saving returns to the
palette catalog; palette saves refresh the shared admin catalog so authoring and
set previews use current colors. Sandbox changes
are transient and never affect player state. Reuse the admin dirty-navigation
guards for palette edits.

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
- Reuse `ConfirmDialog` for admin action confirmations and rich forms rather
  than inline panels or another overlay implementation. Keep affected records
  and consequences explicit; destructive confirmations use the shared red
  button variant. Pending writes disable every dismissal path and duplicate
  submission; failures remain open and retryable. Do not offer admin opt-outs.
- Create both kinds of set over their lists with `SetCreationDialog`, preserving
  role choices, native required-field validation, and retry-stable IDs. Close,
  refresh, and focus Add after success, without entering the new editor.
  Keep existing metadata/member editing in its separate workspace.
- Palette trash must not navigate to the editor. Share one usage-gated deletion
  dialog between gallery and editor, retaining the editor's independent usage
  details. Unverified, used, and released records remain protected by existing
  service/database checks; presentation changes do not relax those checks.
- Request initial form focus after native opening, not React mount-time
  autofocus on a closed dialog. Retain action data with `useModalState` until
  `onAfterClose`, so conditional admin flows honor exit motion, focus return,
  and scroll locking. Defer editor removal/refresh when necessary.
- Use one asynchronous, application-owned discard decision for admin navigation,
  not independent synchronous `window.confirm` callers. Register local dirty
  state and pending operations separately in a shared provider; do not propagate
  aggregate dirty booleans through the admin tree.
  Section/view tabs (which replace editor Back links), Home, hash/history
  navigation, and sign-out share the guard.
  The current workspace stays mounted until the modal exit completes.
- **First destination wins:** while a navigation decision is open or closing,
  ignore later attempts rather than replacing callbacks or opening more discard
  dialogs. Cancellation preserves data/URL; confirming runs the captured intent
  once. Failed sign-out retains edits and requires a fresh navigation decision.
- In-flight operations cannot be discarded. Block navigation with an explanation
  and require retry after completion; never automatically navigate when the
  operation finishes. Recheck pending state before executing a confirmed intent.
  Make the editor inert during sign-out to prevent starting competing writes.
- Guard Home before mutating the hash. Track same-document history entry indices
  so blocked Back/Forward restores the accepted entry without overwriting the
  target; confirmation resumes the traversal once. Reconcile untracked hashes
  by restoring the accepted URL in place. Keep the native `beforeunload` warning
  for reload/tab close/cross-document exits, where browsers own the prompt.
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
`LogoStar`; `Spinner` stays decorative. Feature callers use provider-independent
`Loading` with a required label and one live status, not hand-built spinner/text
pairs. Use compact placement for admin reads/writes and section placement for
image generation and lazy admin entry. Import entry styling eagerly so pending
feedback is readable before the admin chunk loads. Label initial reads, refreshes,
and mutations distinctly, including refreshes of empty catalogs. Keep retries,
disabled-action guards, and existing previews; failures end pending feedback and
show errors rather than empty success. Success/gameplay announcements remain plain
status text. Keep wordmark alignment in `Header` so loading indicators do not
inherit optical offsets. Reduced motion disables animation without hiding labels.

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
