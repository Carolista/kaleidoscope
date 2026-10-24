# Kaleidoscope: Project Context

Current behavior, architecture, and working standards. For rationale, see
[DECISIONS.md](./DECISIONS.md). For where the project is going and what comes
next, see [ROADMAP.md](./ROADMAP.md).

For the UI consistency/reuse audit, implementation status, and reuse index, see
[UI_AUDIT.md](./UI_AUDIT.md). Its progress section distinguishes implemented
foundations from remaining recommendations.

## App

A coloring toy: paint one tile and its symmetry group updates across the grid.
Includes preset palettes, six shapes with three sizes each, dark/light mode, undo/redo, autosave,
and PNG download/share.

The app opens in Puzzle Mode, the primary feature; the header switches to Zen Mode. Before
either starts, the app loads what this player may use from Supabase as a guest (see
Player content below). Puzzle Mode lists the released core puzzle sets, then a set's
puzzles by difficulty, and plays one on the shared `PuzzlePlay` surface; solved puzzle IDs stay
on the device. Its independent local React state survives mode switches but not reloads; it never
persists over Zen designs.

The separate `#/admin` portal uses Supabase password Auth, generated database
types, and a database-backed singleton admin check. Its puzzle lab authors
puzzles in all six shapes with all six size/rotation recipes, visual Supabase palettes (including
drafts), and one-click randomization. Version-2 definitions use ordered palette
slots, with private seed/generator/solution data kept separate. Playtests are
memory-only, while named drafts save atomically to Supabase; a puzzle's purpose comes from its group.
No player progress writes or Zen autosaves occur.
See [Supabase instructions](./supabase/README.md) for current scope.

The shared New/Edit form uses two columns from 640px: palette refresh/picker on the
left; name, shape, recipe/wand randomizer, and save rows on the right. Creating a
puzzle inside a filtered group fixes its shape (unless the group is daily) and limits
the recipes to the group's track.
Shape, like recipe, applies at the next randomization; Edit shows it but fixed.
Puzzle-creator palette pickers (New, Edit, bulk) list palettes by palette group and
position, then unassigned palettes by name, falling back to names without group data.
Narrower screens stack the columns. New-puzzle fields are visible before generation;
saving requires a named preview. The preview omits repeated palette labels and the
seed. Save/load status sits below the form content so it never shifts the layout.
The compact header groups account, sign-out, and theme controls at the right,
with favicon navigation at the left. Admin defaults to dark mode using the shared
neutral charcoal/white theme helper, without initializing player state.

Admin navigation has peer sections: **Puzzles | Palettes | Shapes | Progression | Release**. Puzzles and
Palettes each offer **Groups** (default) | items; items filter by **Unassigned**
(default) | **Assigned** | **Scheduled** | **Published**. Everything stays a draft until
released; the first tab names the unassigned stage. Assigned lists sort by group name, then group position
([groupOrder](./src/features/admin/groups/groupOrder.ts)); puzzles without a group follow by name. The
Scheduled and Published item views list what has been released (palettes with Edit/View as before; puzzles through
[PreparedPuzzleLibrary](./src/features/admin/puzzles/PreparedPuzzleLibrary.tsx): scheduled puzzles open in
the regular editor until their release, live ones in a read-only view). They carry no release buttons: items are
released through their groups. Group lists filter by purpose (puzzle groups also by
shape and track); puzzle items filter by shape and track, and the Assigned view by purpose and group. Palette items (except Drafts) filter by purpose and group; choosing a purpose narrows the group choices to it and hides "No group". Section/view changes use the
navigation guard and reset lower choices to their defaults.

**Shapes** is a workbench for the grid sizes (n) and piece mixes behind both
player modes ([ShapesWorkspace](./src/features/admin/shapes/ShapesWorkspace.tsx)). Each shape's card has a
Grid sizes table (Size, n, Wedge, Total) and a Recipes table (Preview eye button, Difficulty (Size),
Pieces, Distribution) above a centered, playable sample with Restart and Randomize buttons. A shape that
already has puzzles (drafts included, counted by `loadShapePuzzleCounts`) is locked and read-only. For
other shapes n and each recipe's distribution can be edited to try values out: it checks that the pieces
add up to the wedge, marks every changed value ("Changed", with the shipped value shown), and builds
the sample with `generatePuzzle`'s `tuning` argument. Nothing is saved: settled values are copied into
the code ([sizes and piece mixes](./src/domain/puzzles/puzzleShapes.ts), the per-shape `*_GRID_SIZES`).
The pinwheel is the special case, edited as rows x columns of steps.

**Progression** has two views and opens on Puzzles and Rewards. **Order** is strictly the shape order: drag the six shapes, each
shown with the same preview icon as the Zen shape picker
([GridShapeIcon](./src/ui/components/GridShapeIcon.tsx)), into
unlock order (one **Save order**; read-only once any core group is published). **Puzzles and
Rewards** shows each shape as a box holding two nested boxes: the core groups (Basic, Rotation) and
the bonus groups (Bonus Basic, Bonus Rotation), which drops below on narrow screens. Each slot shows
its puzzle group, a small gridline-free thumbnail of the group's first puzzle, and the palette it
awards; its edit icon opens a dialog to pick the puzzle group for the slot (any unassigned group that
fits the shape and track, or Not assigned). Below that the dialog shows the current reward palette (with a
reset button) and one fieldset per reward palette group, so the palette is chosen visually from reward
palette groups only, with palettes another group already awards shown in greyscale (names kept) and
disabled. Published groups are not editable. The same page warns under each shape
about pattern problems (general warnings sit above the shapes) and lists palettes of grouped puzzles
that are in no core, reward, or pack palette group; warnings never block anything. The views share the `progression` catalog
([progression.ts](./src/features/admin/services/progression.ts)), and the pattern rules live in
[rewardPattern.ts](./src/features/admin/services/rewardPattern.ts).

**Release** ([ReleaseOverview](./src/features/admin/release/ReleaseOverview.tsx)) is where content goes out.
A shape's four core and bonus groups (basic and rotation core, basic and rotation bonus) are released as one
**package**: each shape gets one box in unlock order with its status ("4 of 4 groups", a dot, then "Draft"), the package
buttons (Schedule, Reschedule, Unschedule), a list of what blocks it slot by slot, and a table of the four slots
with group, puzzle count, reward palette, "Also unlocks", and state. Below are the palette groups (with
count problems) and every other puzzle group (daily, pack, undecided), each with its own buttons. Core and bonus
groups show their state elsewhere but never have release buttons there. A summary table above the shapes has a row each for
core and bonus groups, other puzzle groups, and palette groups with drafted, scheduled, and live counts; the reward
palettes row spans those columns with "N of M live".
**Reward palette groups** exist only to hold six palettes each; they are never released as groups. Their
status is how many palettes are live ("2 of 6 live"), they have no release buttons, and their palettes go out with
the shape package that awards them. Status marks (a shared
[ReleaseStatusIcon](./src/features/admin/release/ReleaseStatusIcon.tsx), colors `--admin-green`, `--admin-yellow`,
`--admin-orange` in [AdminPortal.module.css](./src/features/admin/shell/AdminPortal.module.css)) sit where the
buttons would: a green circle-check when live (in place of the buttons), a blue calendar-check beside the
Reschedule and Unschedule buttons when scheduled, an orange exclamation (hover for the reason) on a draft that
something blocks, and a yellow circle-check on a reward palette group while only some palettes are out, turning
green when all are live. Puzzle and palette group libraries list every group; scheduled and live ones show a blue
eye ("View group") instead of the pencil, are read-only, and cannot be deleted. Puzzles > Items offers only draft
groups when assigning puzzles. All release buttons open the shared
[ReleaseDialog](./src/features/admin/release/ReleaseDialog.tsx): a local-time date and time (or Release now, never
the default, with a stronger warning), a preview of everything that will change (palettes, palette groups, puzzle
groups, and a collapsed puzzle list, with notes such as "moves earlier, from …"), blockers that disable the button, and
warnings that need an "I have reviewed these warnings" checkbox. The preview comes from the database
(`preview_release`) and the button runs exactly that plan (`apply_release`), so the dialog and the result cannot
disagree. After a release the cached catalogs reload. The overview's own issue lists mirror the hard rules in
[releaseOverview.ts](./src/features/admin/services/releaseOverview.ts); the dialog has the authoritative check.

[AdminCatalogProvider](./src/features/admin/catalog/AdminCatalog.tsx) caches puzzle
groups, puzzle drafts, palettes, and palette groups for the signed-in session.
Views read them through [useCatalog](./src/features/admin/catalog/useAdminCatalog.ts),
so navigation shows cached data instantly. Data reloads only on explicit Refresh
or after the admin's own saves: local edits update the cache in place, and saves
affecting another catalog invalidate only catalogs already loaded. Changes made
elsewhere (another tab or the database) need Refresh. Group loaders batch member
and preview reads (`.in()` chunks of 100, paginated) rather than querying per group.

The Puzzles item view opens the draft gallery; New puzzle and Edit open dedicated views.
Saved definitions reopen without regeneration. Creation stays open after saving,
with name/palette/recipe choices available for the next generation without changing
the saved preview. A revised name carries forward; an exactly unchanged saved name
clears on successful randomization. Leaving with a revised name warns too.
Leaving unsaved work warns before discarding.
Application-owned navigation uses one shared admin discard modal: section/view tabs
(which also exit editors), Home, hash/history navigation, and sign-out keep the current view mounted until
the decision. Keep editing (including X/Escape/backdrop) preserves data and URL;
Discard changes executes the first requested destination once after the dialog
closes. Further attempts are ignored until that decision finishes.
In-flight operations are separate from unsaved edits: navigation is blocked
with an explanation, never offered as a way to cancel a request already sent.
Retry navigation after the operation finishes. Sign-out keeps the editor mounted
and inert while pending; failure restores editing without losing values/previews.
Token refreshes never unmount the workspace: the admin-role check is keyed to the
user ID, not the access token.
Unsaved edits in the new-puzzle, puzzle-draft, and palette editors are also
autosaved to localStorage (`features/admin/drafts`), scoped to the signed-in user and
expiring after 7 days. After a reload the editor offers Restore or Discard; nothing
is applied silently. Puzzle previews store only their seed (never the solution).
Saving, deleting, cancelling, confirming Discard changes, and signing out clear the
saved copy; an expired session keeps it. Other admin forms don't persist yet.

Drafts, including assigned and scheduled ones, can randomize replacement previews
and change recipe locally until release.
Saving atomically replaces public design/recipe and private provenance/solution
under the existing ID, then returns to the library. Discard keeps the original;
failed reads/saves preserve the preview. Changing the recipe alone does not generate.
Assigned drafts keep group membership on replacement (the new recipe must fit the
group's track) but cannot be deleted. Only live puzzles are frozen. The replacement RPC rechecks
existence, shape, release and references under the catalog lock.
Hosted replacement functionality has been confirmed by the user.

Gallery cards ([AdminItemCard](./src/features/admin/common/AdminLayout.tsx)) are not
links: a centered thumbnail and details sit above a bottom row with the custom
checkbox at left and square blue Edit/red Delete icons at right; selected cards
are highlighted blue. Delete appears only for unassigned drafts, and bulk Delete
only when every checked draft qualifies. Select all supports a mixed state; the
shape, track, purpose, and group filters and explicit refresh clear selection. Bulk palette changes require
swatch selection and Apply; card/bulk deletion confirms count and names.
Admin-only RPCs apply batches atomically under the catalog lock, rechecking release
and references. Assigned drafts cannot be deleted; scheduled/live rows
are excluded. Saved seed exclusions derive from surviving authoring records.
Puzzles > Groups creates and edits draft groups with a purpose (Undecided, Core,
Reward, Daily, or Pack), a shape (not for Daily, which mixes shapes), and a track
(Basic or Rotation for Core and Reward; also Mixed for Pack; none otherwise), with
flexible member counts. Purpose, shape, and track stay editable until publication,
and the database rejects members that do not match. Gallery **Assign to group**
appends unassigned drafts to a group that accepts every selected puzzle (shape and
track); a daily group accepts any shape. Membership is exclusive. Puzzle and group
cards show purpose, shape, and track; assigned puzzle cards also show the group name.
New puzzle groups and palette groups use the shared group-creation form in a modal
over their lists. Success closes the modal, refreshes the list, and focuses Add for
another creation; it does not enter the new group's editor. Failed saves retain
the name, purpose, and error in the modal, with retry-stable IDs. Existing group
metadata/member editing remains a separate workspace. Palette groups have no Daily
purpose.
Group cards use two equal columns above 640px, one at/below, with left thumbnails,
details top right, and actions bottom right. The editor shows each member's stored-design
thumbnail in current Supabase palette colors beside a grip handle and square-minus
removal control. Pointer drag (or Up/Down/Home/End on a focused handle; Escape
cancels a drag) stages a local order. One blue **Save** beside the name writes
name and order together, and staged order is guarded like other unsaved edits.
Removal saves immediately. Keyboard instructions are visually hidden. Palette groups share the same staged drag ordering.
Confirmed group deletion unassigns members but preserves puzzles/private solutions.
Admin/invoker-RLS RPCs recheck release/reference state under the catalog lock;
scheduled/live groups, prepared members, and dependent rewards, completions or
grants block deletion. Membership reads paginate.
Shape order and rewards are managed under **Progression**, releases under **Release** (and, for
daily, pack, and undecided groups, from the group cards), and the database also holds
`group_completions` for later player progress.

**Palettes** opens palette groups by default; its Palettes view is a database-backed
catalog sharing the puzzle card layout, selection bar, and blue selected state,
with swatches, release state, **Assign to group**, and Duplicate/Edit/Delete.
Bulk delete appears only when every checked palette is an unassigned draft;
the batch RPC rejects group members, references, and scheduled/live palettes. New palettes have blank names; Duplicate
starts with the chosen palette's five ordered colors and creates a new ID on save.
The editor pairs hex text and native color inputs in three equal-width columns.
Its medium hexagon sandbox randomizes only palette slots, each with a 20% chance;
no base color, painting, puzzle generation, or player writes are involved.
Color edits recolor the same pattern, including when slots have duplicate colors;
invalid input blocks saving/preview until corrected without losing the pattern.

Only unpublished palette drafts can be edited/deleted here. Scheduled/live
palettes are read-only but can be duplicated. Save returns to the palette library;
saves also refresh the shared catalog used by puzzle authoring and set previews.
The editor's blue Save sits beside the palette name; deletion happens only from
the library. Usage loads once and lists only real references (linked stored-design
thumbnails, palette groups, rewards, grants, corrections), or "Not used anywhere."
No private solutions or account identities are shown. Library trash opens a named
deletion modal directly over the catalog.
Deletion requires verified usage and no blocking references; draft-only group
membership is removed on deletion. Failed usage reads offer retry and block
deletion. The database rechecks under the catalog lock.
Writes use loaded name/colors/revision conflict checks and retry-stable IDs.
Unsaved palette edits use the same admin navigation/sign-out/reload guards.
The initial migration seeded 19 original palettes as database drafts; Zen now reads
its palettes from the database (see Player content).
Palette distribution and release tools are described under Release.

In rotation-enabled playtests, click/tap a tray piece to rotate 60 degrees
(180 for diamond star and pinwheel, whose tiles only realign after a half turn;
triangle and hexagram tiles flip between pointing up and down);
dragging moves it without rotating. Double-click/double-tap a board piece or drag
it back to return it to the tray, preserving orientation. Keyboard: Enter/Space
rotates/selects in tray, board activation places, Delete/Backspace on an occupied
tile returns its piece. Rotation happens only in the tray. Containers stay square
across all orientations, with one subtle selected/focus border and normal disabled
cursor. Players get a short tutorial the first time they meet turning pieces (see Puzzle tutorials).

Live: https://codewithcarrie.com/kaleidoscope/

The modern app lives in [src/](./src). Leave the original
[2020 DOM app](./old-dom-app-2020/) unchanged.

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
The header places the logo at the left and a compact mode switch at the right. Its solid
spa/simple-puzzle-piece icons are scaled so both show the same visible height, with natural padding
around each; accessible names and tooltips retain the mode names. The active mode also shows its name
(ZEN or PUZZLE, Righteous capitals the same height as the icon) beside its icon, hidden at 420px and
narrower where the title leaves no room. The dark/light toggle (a classic solid sun/moon, so no palette
tint) sits just left of the mode switch in the header's `actions` slot, sized in the same `em`s so it
scales with the title; it is available on every view, board or not.

On each page load, the logo starts centered over the theme's base color.
The reusable `LogoStar` spins and scales in for 2 seconds; its animation-end
event starts a 1.4-second move into the header. The opening logo stays at header
size through 480px and starts larger above that width. Page content fades in
with an independent 2-second opacity transition, so the logo settling does not
cut the fade short. Reduced-motion users see the final layout immediately;
the entrance is also skipped when the Web Animations API is unavailable.
The animation measures its final bounds, including the left-aligned destination.

Puzzle Mode first shows **Puzzle Sets**: each released core set is a light-bordered card with
its name, track (Basic or Rotation), and "x of 24" at the left, and at the right the solved image of
the first puzzle of each difficulty with "x of 8" below it. A set opens to its puzzles under
difficulty subheadings, four to a row, as borderless solved images (no grid lines) with a round
check badge at the top right once solved. Choosing one plays it. On narrow screens the card's
text sits top left and the three images wrap to the bottom right.
Play places the goal image and equal-scale tray pieces in a compact row
above the full-width board. Boards and pieces use the Zen look: empty tiles are
`var(--accent)` with a `var(--base)` stroke, only the wedge is at full opacity until
solved, and each placed piece gets a single thicker `var(--base)` outline (the selected
piece adds a thin dashed accent line). Hovering a wedge tile uses a per-cell fill (brightened
painted color, or accent drifting toward base when empty). Solving briefly fades "Congrats!"
(Mr Dafoe, accent fill, base outline, about 85% of the board's width) over the board; there is
no dialog, so the solved design stays in view. The Next puzzle button (the next unsolved
puzzle in the set; absent when none) is always present so the icons beside it never shift,
disabled until the puzzle is solved and again once clicked.
Opening a puzzle, or choosing Next, swipes it in: the target, tray, and board (not the
icon row, which stays put) fly in from the right while the previous puzzle's painted copy flies off
to the left over 560ms (`usePuzzleSwipe`, same inert-clone technique as Zen's grid swap; skipped for
reduced motion; `body` hides horizontal overflow so the travel adds no scrollbar).
The icon row sits 2rem below the board (the board graphic itself has no bottom margin).
The reverse-rotate icon restarts the current puzzle and the left-from-bracket icon returns to the set. The icons under
the board are tinted with the second color of the puzzle's own palette (`PlayerPuzzle.palette`);
the back arrow on a set's puzzle grid is classic solid. Placement feedback remains in a
nonvisual status region rather than visible instruction/status blocks.

**Puzzle tutorials.** Puzzle Mode teaches each track once, in
[features/puzzle/intro/](./src/features/puzzle/intro/). The first time Puzzle Mode opens, a
**Welcome!** tutorial replaces the set list; the first time a rotation set is opened, a second one
replaces that set's puzzle grid. Both are a fixed small-hexagon puzzle (seed `intro-3`: pieces of
3, 2, and 1 tiles, five colors; rotation turns the two larger pieces) played on the shared
`PuzzlePlay`, built from the track's tutorial palette (Mindfulness for basic, Stillness for
rotation). Guidance sits just above the board and changes with progress (`PuzzlePlay`'s `onProgress`
reports pieces placed and whether any is turned; `aboveBoard` is the slot). The slot reserves three
lines and shows **Continue** in the same place after the solve, under a **Congratulations!** heading.
Completion is stored in `kaleidoscope:puzzle-intro` (`{ version: 1, seen: [...] }`) only on Continue,
so an unfinished tutorial repeats on reload. A device that has already solved a puzzle in a track
counts as having seen it. Nothing is shown when no puzzles or palettes are released.
Tutorial palettes are looked up by ID in [introPalettes.ts](./src/domain/palettes/introPalettes.ts) among
the released core palettes, falling back to the first palette; a palette that is not in a released
core group (so not readable by guests) is never found. Zen's intro uses Harmony.

`LogoStar` lives in `components/shared` with `arrive` (default) and `pulse`
animation modes; wordmark sizing and optical spacing stay in `Header`.
Use shared `Loading` for pending feedback: a required readable label and one
live status compose the decorative `Spinner`. Compact is the default for admin
reads/writes; section is used for Save Image generation and lazy admin entry.
It works without player state; entry styles load before the admin chunk.
Success messages and gameplay announcements remain plain status text.
The star alternates a half-turn and scale from 0.05 to 1 over 1.2 seconds per
direction. Reduced-motion users see a static star with the same readable label.

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
  Each component imports only its own `X.module.css`, next to `X.tsx`. When several
  components need the same styling, make it a small component (for example
  `AdminForm`, `PaletteFieldset`, `AdminIconButton tone`) rather than sharing a
  stylesheet. Admin theme tokens live on the portal page in
  [AdminPortal.module.css](./src/features/admin/shell/AdminPortal.module.css).
- Import across folders through barrels (`@/features/admin/common`,
  `@/domain/shapes`); inside a folder use `./`. Test mocks target the exact
  module file (`vi.mock('@/features/admin/services/puzzleSets')`). The admin
  barrel's default export is the portal, which `AppEntry` lazy-loads.
- **Palette** in code, file names, and user-facing text. Older saves may still name a palette
  by `schemeName`; current saves use `paletteId`.
  **Theme** refers to dark/light mode, not palettes.
- Keep persisted shape IDs stable. Import across folders with the single `@/`
  alias for `src/` (kept aligned in [Vite](./vite.config.ts) and
  [TypeScript](./tsconfig.app.json)); use `./` only within the same folder.
- Import individual Font Awesome definitions and render `FontAwesomeIcon` SVGs.
  [main.tsx](./src/main.tsx) imports core CSS and disables automatic CSS injection.
  No Kit script or Kit dependency.
- Self-hosted fonts: Righteous 400 (player header, text buttons, modal titles); Mr Dafoe 400
  (intro Welcome/Congratulations headings; the Puzzle Mode solve "Congrats!"); Urbanist 200, 400, 400 italic, and 700
  (body text and default bold headings).
- Icon buttons use accessible labels and tooltips. Toggle labels/icons describe
  the destination. Player boxes are 2.5rem; undo/redo and admin use 1.875rem.
- Reuse shared `Button`, `Input`, `Select`, and `IconButton` for ordinary controls.
  They forward native props/refs; `Button` defaults to `type="button"` and forms
  explicitly request `type="submit"`. Keep visual swatches and gameplay pieces
  specialized rather than applying command-button styling to them.
- Use [FormField](./src/ui/components/FormField.tsx) for ordinary stacked
  label/control rows. Its render function supplies the control ID and optional
  help/error associations; spread those onto the native Input/Select, retaining
  native required, disabled, ref, and submit behavior. Specialized paired
  hex/native-color inputs and inline filter controls keep their own layouts.
- [PaletteStrip](./src/ui/components/PaletteStrip.tsx) owns decorative ordered
  colors: square swatches for choices, continuous strips for catalog/group previews.
  [PaletteChoices](./src/ui/components/PaletteChoices.tsx) owns controlled,
  labelled palette buttons keyed/selected by ID, with optional visible names.
  Player PalettePicker adapts its local name-based catalog and applies/closes
  immediately; admin owns catalog IDs and bulk selection still requires Apply.
  Keep duplicate colors in their original slots. Interactive painting color
  buttons remain the separate ColorSwatches component.
- [AdminLayout](./src/features/admin/common/AdminLayout.tsx) supplies section
  headings/actions, feedback, gallery framing, and ordered member rows. Puzzle,
  palette, and landscape-group cards retain their domain content/layouts; don't
  create another generic gallery or member-action shell for the same pattern.
  Loading, empty-data decisions, retries, and writes stay with their owners.
- `IconButton`, `CloseButton`, and `ModalHeader` do not require player state.
  Player palette-aware actions use `PlayerIconButton`; admin's `AdminIconButton`
  supplies the compact size to the same renderer.
- Global CSS owns basic normalization and `--font-body`. Shared component styles
  own control behavior, with inherited `--control-*`, `--button-*`, and
  `--icon-glyph-size` overrides scoped to admin. Admin retains Urbanist text,
  compact controls, and blue/red actions; do not restore blanket page button rules.
  `Button` variants are `solid`, `outline`, `primary`, `danger`, and `link`.
  Palette-choice sizing and selected/hover colors similarly inherit scoped
  `--palette-choice-*` tokens; admin must not import the player picker's CSS.
- Shared `Checkbox` keeps a native, labelled input beneath a custom box, with
  visible keyboard focus and a checked duotone icon tinted by the active palette.
  Confirmation preferences and the save-image grid-line option use it.
- kebab-case preferred over camelCase for directory naming convention.
- CSS Module class names are camelCase so they can be read as `styles.itemTitle`
  rather than `styles['item-title']`. Custom properties, element ids, and data
  attributes stay kebab-case.
- Use global `.visually-hidden` from [index.css](./src/app/index.css) for accessible
  instructions/live announcements that should not occupy visual layout.
  Do not replace it with `display: none`, `hidden`, or `aria-hidden`.
  Admin playtest status is also visually hidden; the board shows the solved state.
- Polygon and circle painting cells share grout, transitions, dimming, hover,
  and focus rules in [Cell.module.css](./src/features/zen/grid/Cell.module.css).
  Polygon-only joins stay local. Puzzle board/piece interaction is different;
  do not merge it with painting-cell styles.

### UI reuse quick reference

| Need | Use / precedent |
| --- | --- |
| Ordinary command / submit | [Button](./src/ui/components/Button.tsx); explicit `type="submit"` for forms |
| Labelled native field | [FormField](./src/ui/components/FormField.tsx) with [Input/Select](./src/ui/components/FormControl.tsx), including admin sign-in |
| Player / admin icon action | [PlayerIconButton](./src/ui/components/PlayerIconButton.tsx) / [AdminIconButton](./src/features/admin/common/AdminIconButton.tsx); generic renderer is [IconButton](./src/ui/components/IconButton.tsx) |
| Edit / delete / new / refresh | Admin icon action with `faPenToSquare` / `faTrashCan` / `faPlusLarge` / `faRotate`; item-specific label and title; `tone="edit"` (blue) or `tone="delete"` (red) for edit and removal actions |
| Reorder / unassign | Staged `faGripVertical` drag handle + the group's single Save ([SortableGroupMembers](./src/features/admin/groups/SortableGroupMembers.tsx)), shared by puzzle and palette groups; `faSquareMinus` unassign preserves the member |
| Admin catalog data | [useCatalog](./src/features/admin/catalog/useAdminCatalog.ts) / `useCatalogInvalidation`; update locally after writes, invalidate other affected catalogs |
| Section / view tabs | [AdminNavigation](./src/features/admin/shell/AdminNavigation.tsx); wrap changes in `requestNavigation` |
| Pending feedback | [Loading](./src/ui/components/Loading.tsx); readable request-specific label, not a success spinner |
| Confirmation / rich action form | [ConfirmDialog](./src/ui/components/ConfirmDialog.tsx) on [Modal](./src/ui/components/Modal.tsx); errors/pending stay inside |
| Group creation | [GroupCreationDialog](./src/features/admin/groups/GroupCreationDialog.tsx) with [GroupDetailsFields](./src/features/admin/groups/GroupDetailsFields.tsx) (purpose, shape, track; shared with group editing); close/refresh/focus Add on success |
| Retain action content during exit | [useModalState](./src/ui/hooks/useModalState.ts); defer destructive view changes until after close |
| Guard edited/pending navigation | [useUnsavedDraft](./src/ui/navigation/useUnsavedDraft.ts) with [useNavigationGuard](./src/ui/navigation/useNavigationGuard.ts); first destination wins |
| Decorative palette / palette selection | [PaletteStrip](./src/ui/components/PaletteStrip.tsx) / [PaletteChoices](./src/ui/components/PaletteChoices.tsx); not painting buttons |
| Section / gallery / ordered members | [AdminLayout](./src/features/admin/common/AdminLayout.tsx); retain domain card layouts and local async ownership |
| Inline separator between label parts | [SeparatorDot](./src/features/admin/common/SeparatorDot.tsx) (decorative `faDot`), never a `·` character; services return label parts and the component places the dot |
| Error text from a caught value | [errorMessage](./src/features/admin/common/errorMessage.ts)`(cause, fallback)`; one `fallbackError` constant per library |
| Admin editor vs library | Editors live in their own files (`PuzzleDraftEditor`, `PaletteEditor`) next to the library that opens them |

Native mode/shape/color choice buttons, painting SVG cells, puzzle pieces, and
the transparent native checkbox input are intentional specialized controls,
not missed command-button migrations.

## Architecture

`src/` holds the Vite entry [main.tsx](./src/main.tsx) and six folders. Dependencies
point downward: `app` → `features` → `ui` → `domain`/`lib`. Features never import
each other, and `domain` never imports React.

`npm run lint` enforces this with the local rules in
[eslint-rules/architecture.js](./eslint-rules/architecture.js) (tested alongside it):

- `architecture/layers`: the dependency direction above.
- `architecture/no-react-in-domain`: no React or stylesheets in `domain/`.
- `architecture/use-barrels`: import a folder's `index.ts`, not a file inside it,
  unless the importer is inside that folder.
- `architecture/colocated-styles`: CSS Modules only from the importer's own folder;
  no `../` imports.

Test files and `src/test/` are exempt so tests can reach internals and mock exact files.

| Location | Responsibility |
| --- | --- |
| [app/](./src/app/) | `AppEntry` (player/admin routing, navigation guard), `PlayerApp` (page, entrance animation, header, mode switch, footer), `useAdminRoute`, [layout/](./src/app/layout/) (Header, Footer), global [index.css](./src/app/index.css) |
| [features/zen/](./src/features/zen/) | Zen Mode: `ZenMode`, [state/](./src/features/zen/state/) (reducer, history, Context, localStorage persistence, design randomization), [controls/](./src/features/zen/controls/) (toolbar, palette and shape pickers), [grid/](./src/features/zen/grid/) (shape adapters, `ShapeGrid`, `GridView`, cells), [export/](./src/features/zen/export/) (Save Image), [intro/](./src/features/zen/intro/) |
| [features/puzzle/](./src/features/puzzle/) | Player Puzzle Mode: set list, difficulty grid of solved images, play session with the Congrats overlay and Next, the first-use tutorials (`intro/`), and the device's solved-puzzle (`puzzleProgress.ts`) and completed-tutorial (`introProgress.ts`) records |
| [features/admin/](./src/features/admin/) | Lazy-loaded admin portal. `shell/` (portal, workspace, navigation), `catalog/` (session cache), `common/` (layout, icon button, form), `groups/` (shared group editing), one folder per content area (`puzzles/`, `puzzle-groups/`, `palettes/`, `palette-groups/`), `services/` (Supabase reads/writes), `testing/` |
| [ui/components/](./src/ui/components/) | Shared controls: buttons, `DarkModeToggle`, palette-tinted `Checkbox`, native `Modal`, `ModalHeader`, `ConfirmDialog` and its dismissal preferences, form fields, loading, palette strips/choices |
| [ui/content/](./src/ui/content/) | Player content: `loadPlayerContent` (released core palettes, core puzzle sets, shape order), `PlayerContentProvider` (loads before the app starts), `usePlayerContent`, and the offline cache |
| [ui/theme/](./src/ui/theme/) | `PlayerThemeContext` (dark mode, active palette, toggle), `useDuotoneIconTint`, and `DuotoneTintColorContext` (lets a mode, such as a puzzle session, tint icons from its own color) |
| [ui/hooks/](./src/ui/hooks/) | `useModalState`, `useIsTouchDevice` |
| [ui/navigation/](./src/ui/navigation/) | App-wide unsaved-work navigation guard |
| [ui/puzzle/](./src/ui/puzzle/) | Shared `PuzzlePlay` (target, tray, board, optional `celebration` text, `onProgress`, `aboveBoard` slot, pointer/keyboard interaction) and shape-neutral `PuzzleBoard` |
| [domain/shapes/](./src/domain/shapes/) | React-free shape catalog, sizes, registry, and one folder per shape (grid, layout, types). The catalog's `supportedGridShapes` order is the single shape order (unlock order, Circle Rings last); `PUZZLE_SHAPE_IDS`, `PUZZLE_SHAPE_LABELS`, and every shape menu derive from it |
| [domain/geometry/](./src/domain/geometry/) | `Point`, shared geometry math, symmetry engine, cell grouping, SVG points |
| [domain/puzzles/](./src/domain/puzzles/) | Pure seeded puzzle generation, authoring, stored-definition readers (`readAuthoredPuzzle` for admins, `readPlayablePuzzle` for players, which never sees seeds or solutions), placement validation, and completion; per-shape adapters in `puzzleShapes.ts` |
| [domain/palettes/](./src/domain/palettes/) | Palette types (`Palette`, `PlayerPalette` with an ID), color math, light/dark theme colors, tutorial palette IDs (`introPalettes.ts`); no bundled palette list |
| [lib/supabase/](./src/lib/supabase/) | Supabase browser clients (`getSupabaseClient` for the admin's session, `getGuestClient` for players, with no stored session) and generated database types |
| [test/](./src/test/) | Vitest setup, shared render/interaction helpers, and `playerContent.ts` (sample palettes and content for tests) |

Shape adapters supply geometry to `GridView`; it owns numbering, painting,
highlighting, announcements, and SVG references. An optional `interaction`
prop (supported by `TriangleGrid` and `HexagonGrid`) replaces app-state paint colors, paint handling,
paintable groups, and highlighting; the Zen intro uses it on `HexagonGrid` for its local design. Helpers preserve generated
cell/group ordering. `averagePoint` is a vertex average, not an area-weighted centroid.

[catalog.ts](./src/domain/shapes/catalog.ts) defines supported IDs, labels, order,
and picker visibility. All six are currently visible. Hidden entries remain
loadable. The [registry](./src/domain/shapes/registry.ts), `ShapeGrid`, and icon
previews are keyed by every shape ID, so an unregistered shape fails to compile.
Import a shape through its folder barrel (`@/domain/shapes/hexagon`) and shared
shape data through `@/domain/shapes`. Files inside `domain/shapes` import siblings
directly, never their own barrel, to avoid cycles.
React rendering remains separate from geometry and storage.

### Player content

Before the player app starts, [PlayerContentProvider](./src/ui/content/PlayerContentProvider.tsx) loads one
[PlayerContent](./src/ui/content/playerContent.ts) with the guest client, which keeps no session (so an admin
signed in on the same browser still reads exactly what a guest can). Reads rely on the database's own rules
(released content only; guests play only the first shape's core groups) and are filtered again for release state
in [loadPlayerContent](./src/ui/content/loadPlayerContent.ts):
- **palettes:** members of released core palette groups, by group name then position (these are Zen's palettes);
- **puzzle sets:** released core puzzle groups of a basic or rotation track, each puzzle rendered with its own
  palette through `readPlayablePuzzle` (a puzzle that fails to read is skipped and logged); sets with none are dropped;
  ordered by shape unlock order, basic before rotation;
- **unlocked shapes:** only the first shape in `shape_progression` for guests (a Zen design on a locked shape
  starts fresh).
The load is network first. A success is cached in `kaleidoscope:content`; if the network fails the last cache is
used, and with no cache the player sees the error with Try again. With no released palettes it shows "Nothing has been
released yet" with Check again, since Zen needs a palette. Content does not change during a visit.
Solved puzzles are stored on the device as `{ version: 1, solved: [puzzle IDs] }` in `kaleidoscope:puzzle-progress`
and are never merged into an account automatically. Bonus (reward) groups, reward palettes, later shapes, resume, and
accounts are not built yet.

### Grid sizes

Each shape offers small, medium, and large grids. Size choices are remembered
independently per shape in [sizes.ts](./src/domain/shapes/sizes.ts).

| Shape | Small | Medium | Large | Default |
| --- | --- | --- | --- | --- |
| Hexagon | Radius 3 | Radius 4 | Radius 6 | Medium |
| Triangle | Size 5 | Size 7 | Size 10 | Medium |
| Diamond star | 3 x 3 per point | 4 x 4 per point | 5 x 5 per point | Medium |
| Hexagram | Size 2 | Size 3 | Size 4 | Large |
| Circle rings | 3 rings + center | 4 rings + center | 5 rings + center | Large |
| Pinwheel | 3 x 2 per spoke | 3 x 3 per spoke | 4 x 3 per spoke | Large |

Default app grids:

| Shape | Symmetry | Size | Cells | Clickable groups |
| --- | --- | --- | --- | --- |
| Hexagon | D6 | Radius 4 | 61 | 9 |
| Triangle | D3 | Size 7 | 49 | 12 |
| Diamond star | D6 | 4 x 4 per point | 96 | 10 |
| Hexagram | D6 | Size 4 | 192 | 20 |
| Circle rings | D6 | 5 rings + center | 91 | 12 |
| Pinwheel | C8, rotation only | 4 x 3 per spoke (rows x columns) | 96 | 12 |

The Zen intro uses the small hexagon (radius 3, six groups), so tuning another
shape does not change it.

Hexagons use axial-coordinate symmetry; other shapes use the shared geometric
symmetry engine. One representative per group is clickable.

### State and persistence

- New designs start in dark mode with the Zen tutorial palette (Harmony, by ID in
  [introPalettes.ts](./src/domain/palettes/introPalettes.ts); the first loaded palette if it is
  unavailable) and its first color selected.
- Painting toggles a group back to accent when its current color is selected again.
  Unpainted groups also display accent.
- Each of the 18 shape/size combinations has an independent paint map. Switching
  boards saves the outgoing pattern and restores the incoming one; unvisited
  boards start empty. Paint is never copied between sizes or shapes.
- Palette and theme are global, not board-specific. Palette changes remap painted
  palette colors by position on all boards and select the first new color.
  Explicit dark/light toggles remap neutral base/accent paint on all boards;
  switching boards and undo/redo never change the theme.
- Reset and randomize affect only the active board. Switching shape and size
  together is one undo step.
- Undoable: paint, palette, shape, grid size, randomize, reset. Current color, dark mode,
  and editable-area visibility are tool/view choices, not undo stops.
- History is one unlimited, session-only chronological timeline across all boards,
  including switches. Restored boards form the session's starting baseline;
  history itself is not restored. Snapshots include active and inactive paint.
  Unchanged designs preserve undo/redo; real design edits clear redo.
  Snapshot restoration reconciles unavailable
  selected palette colors by position, preserving available and neutral selections.
- Theme toggles do not remap historical snapshots, so undo across a toggle can
  restore older literal neutral colors without changing the current theme.
- Autosave writes version 6 to `kaleidoscope:design` on state changes. It saves
  the palette ID (`paletteId`), selected color, dark mode, shape, per-shape sizes,
  editable-area preference, and all board paint maps in one record.
  `shapeGroupColors` holds active paint; `savedBoards` holds inactive paint keyed
  by stable `shape:size` IDs (for example, `triangle:sm`), never duplicating the
  active board.
- Versions 1-5 remain loadable, naming their palette by `schemeName`, which is matched to a
  current palette by name. Their single paint map belongs only to the original
  effective active board; other boards start empty. Missing size data restores the active shape's
  legacy size. Earlier placeholder medium values for Hexagram (v1), Circle Rings
  (v1-2), and Pinwheel (v1-3) migrate to large to preserve their previous grids.
- Loading rejects malformed records, arrays, invalid six-digit hex colors,
  unknown versions/shapes, invalid board keys, and duplicate active-board
  entries; fallback is a fresh design. A saved palette that is no longer available, or a
  shape the player has not unlocked, also starts fresh. Missing historical
  shape/visibility fields default to hexagon/true. Storage failures never crash the app.
- Colors retain case and need not belong to the current palette. Unknown group IDs
  are retained; no palette-color migration is implemented.

### UX and accessibility

- Single column: header, grid, swatches, undo/redo, settings/actions, footer.
  Action order: editable area (touch only), palette, randomize, reset, shape,
  image, help. (The dark/light toggle moved to the app header.) Keep help descriptions aligned with the toolbar. The help modal's first item (Paint Colors) shows the current palette as a compact `PaletteStrip` instead of an icon.
- Pointer hover dims non-clickable cells. Touch uses a persisted editable-area
  toggle, initially on. The grid is capped at 560px with a 226px viewport allowance.
- SVGs use `role="group"` with instructions; clickable cells are labeled buttons
  with sequential Tab navigation and Enter/Space painting. Decorative cells/icons
  are hidden from assistive technology; a live region announces painting.
- Retain visible focus indicators and unique dialog/instruction label IDs.
- Native dialogs provide modal focus behavior. Reset confirmation has a
  persistent opt-out, saved only on confirmation. Board switches are immediate
  and non-destructive, so no shape-change confirmation is needed.
- Admin palette/puzzle/group deletion, bulk palette changes, and group assignment
  use the shared rich `ConfirmDialog`, preserving the originating list/editor,
  affected names/counts, and explicit consequences. Admin confirmations have no
  opt-out. Errors and pending `Loading` stay in the dialog; writes disable
  confirm, Cancel, X, Escape, and backdrop dismissal. Cancel makes no write.
  Shared controls supply the red destructive confirmation variant.
- `Modal.initialFocusRef` focuses form fields after native opening.
  `useModalState` retains action content through the shared exit animation and
  can defer editor navigation/catalog refresh until closing finishes.
- Admin [NavigationGuardProvider](./src/ui/navigation/NavigationGuard.tsx)
  owns discard decisions and the native `beforeunload` safety net. Each editable
  or mutating view registers its own `{ dirty, pending }` through
  [useUnsavedDraft](./src/ui/navigation/useUnsavedDraft.ts); do not merge these
  into one parent dirty boolean or add `window.confirm` at new navigation sites.
  [useAdminRoute](./src/app/useAdminRoute.ts) guards Home before changing the
  hash and reconciles already-triggered hashes. Indexed Back/Forward traversals
  return to the accepted entry while deciding, preserving their destination
  entries for retry; untracked hashes restore the accepted URL in place.
  Reload, tab close, and cross-document exit retain the browser-owned warning:
  a custom modal cannot replace `beforeunload`.
- The shape picker uses three scaled versions of each icon (32/48/64px) in
  equal 88px square buttons, without visible shape or size text. Accessible
  names and tooltips identify shape and size as S/M/L. Rows wrap at narrow widths.
- All modals have stationary headers and one scrolling body, bounded by the
  dynamic viewport height. Fades and chevrons indicate more content above/below;
  overflowing bodies are keyboard-focusable. Scroll containment and shared
  background locking prevent page scrolling, including while confirmations
  are nested over pickers. Closing the last modal restores page scroll position.
- Shared modals fade in while clearing an 8px blur and rising 200px over 1 second;
  closing reverses the effect over 500ms. There is no scaling or bounce. The
  backdrop fades with the panel. Native focus trapping and page scroll locking
  remain active until the exit finishes; clicks during closing are ignored.
  Interrupted animations resume from the current appearance. Reduced motion or
  missing Web Animations API support skips the panel animation. Save Image keeps
  its export session and preview URLs alive until the exit completes.
- When the design storage key is absent at startup (checked before autosave; key
  existence, not payload validity), `App` shows the first-visit intro instead of the
  grid, controls, and footer. Intro state is local: the small hexagon (radius 3) whose
  center tile is already the theme's base color, leaving 5 paintable tiles, and the starting
  palette's five colors. Choosing a swatch and a tile
  permanently paints that tile and disables that swatch; after five, dimming is
  released and **Continue** replaces the swatches. Continue shows the regular app
  with a fresh design and the help modal open. Nothing is saved until then. The
  help modal itself stays available through its toolbar button.
- Backgrounds are literal inline colors with no transitions: synchronous
  bootstrap on `html`, render on `.page`, `useLayoutEffect` on `html`/`body`.
  Descendants use `--base`/`--accent`. Button hover backgrounds also snap instantly.
- Grid swaps animate via `GridTransition` (keyed on shape + size): the old grid
  shrinks to its center with a slight turn, then the new one grows from center with a
  soft overshoot. The old grid is an inert, `aria-hidden` DOM clone; timings and
  easing are constants at the top of the component. Skipped on first render and
  under `prefers-reduced-motion`. The stage reserves the tallest supported
  shape/size's height (within the existing width and viewport limits), with every
  grid centered vertically and horizontally so controls stay stationary.

### Export and randomization

- Export clones the SVG, inlines strokes, forces polygons/circles opaque, and
  rasterizes against theme base. Default longest PNG dimension: 1600px.
- **Include grid lines** defaults to checked. Changes are immediately remembered
  in `kaleidoscope:export:includeGridLines`, independently of the design, and
  restored on future visits. Unchecking removes cell strokes, not geometric gaps.
- Opening Save Image generates the selected version. Each lined/line-free PNG
  is generated at most once per opening, including while requests are in flight;
  toggling back reuses its preview. Download/share use the selected version.
  Closing discards both previews and revokes their URLs; reopening generates
  from the current design and theme.
- The preview reserves the selected shape and size's geometry-derived aspect ratio. Generation failures show an
  error; share failures retain preview/download/retry. Share cancellation is quiet.
  Share appears only when file sharing is supported; download is enabled when ready.
- Randomization weights each palette color 18 times and theme base 10 times
  (90% palette, 10% base). Accent is excluded. The pool is built once per design;
  only groups present at the selected grid size are randomized.
  Duotone tint is computed once per hook invocation.

## Tests and deployment

Logic/component tests use Vitest + RTL/jsdom; hooks use `renderHook`.
[Test setup](./src/test/setup.ts) registers cleanup, polyfills dialog open/close,
and stubs page scrolling and `ResizeObserver` for jsdom. It also raises the RTL async timeout
(`findBy*`/`waitFor`, 5s) and Vitest's test timeout (15s) so a busy machine does not fail slow admin
screens; only a condition that was never reached should fail. Assert on the result you are waiting for
(use `waitFor`), not on an element that also exists beforehand.
Clear or seed storage and use deterministic state/randomness where needed.
jsdom does not verify real layout, native focus trapping, or PNG rasterization.
Browser checks are ad hoc; there is no maintained browser suite or coverage threshold.

Admin catalogs load asynchronously, and many actions render disabled until they
finish; a click on a disabled button is silently ignored. Wait for a button to be
enabled before clicking it (admin [clickWhenEnabled](./src/features/admin/testing/clickWhenEnabled.ts)),
and wait for the resulting state (for example the generated playtest) rather than
for fields that render before it. To check a test for this kind of race, temporarily
delay its mocked catalog read by ~50 ms; it should still pass.

[CI](./.github/workflows/ci-deploy.yml) runs lint, format checks, tests, and build
on pushes to `main` and PRs targeting `main`; successful pushes deploy to Pages.
Production base is `/kaleidoscope/`; development uses `/`.
