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

The header switches between the existing Zen Mode and a session-only Puzzle Mode
prototype. Puzzle Mode uses the small hexagon, Cabo palette, and connected
1/2/3-tile pieces placed in the six-tile symmetry wedge. Its independent local
React state survives mode switches but not reloads; it never persists over Zen
designs. See [README.md](./README.md#puzzle-mode-prototype) for scope.

The separate `#/admin` portal uses Supabase password Auth, generated database
types, and a database-backed singleton admin check. Its temporary hexagon lab
supports all six size/rotation recipes, visual Supabase palettes (including
drafts), and one-click randomization. Version-2 definitions use ordered palette
slots, with private seed/generator/solution data kept separate. Playtests are
memory-only, while named Set/pack or Daily drafts save atomically to Supabase.
No player progress writes or Zen autosaves occur.
See [Supabase instructions](./supabase/README.md) for current scope.

The shared New/Edit form uses two columns from 640px: palette refresh/picker on the
left; name, recipe/wand randomizer, and intended-use/save rows on the right.
Narrower screens stack the columns. New-puzzle fields are visible before generation;
saving requires a named preview. The preview omits repeated palette labels and the
seed. Save/load status sits below the form content so it never shifts the layout.
The compact header groups account, sign-out, and theme controls at the right,
with favicon navigation at the left. Admin defaults to dark mode using the shared
neutral charcoal/white theme helper, without initializing player state.

Admin navigation has peer sections: **Puzzles | Palettes | Shapes**. Puzzles and
Palettes each offer **Sets** (default) | items; items filter by **Unassigned**
(default) | **Assigned** | **Scheduled** | **Published**. Shapes, Scheduled, and
Published are placeholders. Everything stays a draft until published; the first
tab names the unassigned stage. Assigned lists sort by set name, then set position
([setOrder](./src/features/admin/sets/setOrder.ts)); daily puzzles follow by name. A future top-level orchestration view will map how
sets, rewards, and packs connect and roll out. Section/view changes use the
navigation guard and reset lower choices to their defaults.

[AdminCatalogProvider](./src/features/admin/catalog/AdminCatalog.tsx) caches puzzle
sets, puzzle drafts, palettes, and palette sets for the signed-in session.
Views read them through [useCatalog](./src/features/admin/catalog/useAdminCatalog.ts),
so navigation shows cached data instantly. Data reloads only on explicit Refresh
or after the admin's own saves: local edits update the cache in place, and saves
affecting another catalog invalidate only catalogs already loaded. Changes made
elsewhere (another tab or the database) need Refresh. Set loaders batch member
and preview reads (`.in()` chunks of 100, paginated) rather than querying per set.

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

Drafts, including assigned and scheduled ones, can randomize replacement previews
and change recipe locally until release.
Saving atomically replaces public design/recipe and private provenance/solution
under the existing ID, then returns to the library. Discard keeps the original;
failed reads/saves preserve the preview. Changing the recipe alone does not generate.
Assigned drafts keep set/daily membership on replacement but cannot change intended
use or be deleted. Only live puzzles are frozen. The replacement RPC rechecks
existence, shape, release and references under the catalog lock.
Hosted replacement functionality has been confirmed by the user.

Gallery cards ([AdminItemCard](./src/features/admin/common/AdminLayout.tsx)) are not
links: a centered thumbnail and details sit above a bottom row with the custom
checkbox at left and square blue Edit/red Delete icons at right; selected cards
are highlighted blue. Delete appears only for unassigned drafts, and bulk Delete
only when every checked draft qualifies. Select all supports a mixed state; the
use and set filters and explicit refresh clear selection. Bulk palette changes require
swatch selection and Apply; card/bulk deletion confirms count and names.
Admin-only RPCs apply batches atomically under the catalog lock, rechecking release
and references. Assigned drafts cannot switch use or delete; scheduled/live rows
are excluded. Saved seed exclusions derive from surviving authoring records.
Puzzles > Sets creates/renames Core, Reward, or Paid hexagon draft sets with flexible
member counts. Gallery **Assign to set** appends unassigned Set/pack drafts;
membership is exclusive. Assigned cards show the set name and Core/Reward/Pack.
New puzzle sets and palette sets use the shared set-creation form in a modal over
their lists. Success closes the modal, refreshes the list, and focuses Add for
another creation; it does not enter the new set's editor. Failed saves retain
the name, role, and error in the modal, with retry-stable IDs. Existing set
metadata/member editing remains a separate workspace.
Set cards use two equal columns above 640px, one at/below, with left thumbnails,
details top right, and actions bottom right. The editor shows each member's stored-design
thumbnail in current Supabase palette colors beside a grip handle and square-minus
removal control. Pointer drag (or Up/Down/Home/End on a focused handle; Escape
cancels a drag) stages a local order. One blue **Save** beside the name writes
name and order together, and staged order is guarded like other unsaved edits.
Removal saves immediately. Keyboard instructions are visually hidden. Palette sets share the same staged drag ordering.
Confirmed set deletion unassigns members but preserves puzzles/private solutions.
Admin/invoker-RLS RPCs recheck release/reference state under the catalog lock;
scheduled/live sets, prepared members, and dependent progression/routes/rewards,
qualifications or grants block deletion. Membership reads paginate.
Publishing, starter, route/core progression, and reward tools remain deferred.

**Palettes** opens palette sets by default; its Palettes view is a database-backed
catalog sharing the puzzle card layout, selection bar, and blue selected state,
with swatches, release state, **Assign to set**, and Duplicate/Edit/Delete.
Bulk delete appears only when every checked palette is an unassigned draft;
the batch RPC rejects set members, references, and scheduled/live palettes. New palettes have blank names; Duplicate
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
thumbnails, sets, starters, rewards, grants, corrections), or "Not used anywhere."
No private solutions or account identities are shown. Library trash opens a named
deletion modal directly over the catalog.
Deletion requires verified usage and no blocking references; draft-only set
membership is removed on deletion. Failed usage reads offer retry and block
deletion. The database rechecks under the catalog lock.
Writes use loaded name/colors/revision conflict checks and retry-stable IDs.
Unsaved palette edits use the same admin navigation/sign-out/reload guards.
The initial migration already seeded all 19 original palettes as database drafts;
Zen still uses its local catalog unchanged. Palette distribution and release
tools remain deferred.

In rotation-enabled playtests, click/tap a tray piece to rotate 60 degrees;
dragging moves it without rotating. Double-click/double-tap a board piece or drag
it back to return it to the tray, preserving orientation. Keyboard: Enter/Space
rotates/selects in tray, board activation places, Delete/Backspace on an occupied
tile returns its piece. Rotation happens only in the tray. Containers stay square
across all orientations, with one subtle selected/focus border and normal disabled
cursor. A first-rotation player-set tutorial is planned, not implemented.

Live: https://codewithcarrie.com/kaleidoscope/

The modern app lives in [src/](./src). Leave the original
[2020 DOM app](./old-dom-app-2020/) unchanged.

## Working agreements

- Work in small, logical steps. The user reviews and makes commits unless asked otherwise.
- Ask before decisions that change behavior or scope.
- Prefer reusable, modular code and clear boundaries; avoid speculative abstractions.
- Use focused tests during iteration. Do not batch full lint, formatting, tests, build, and browser verification until the user is ready to finalize.
- Do not use browser tools for small in-progress tweaks. 
- After file moves or renames, restart the dev server before browser verification.
- Update CONTEXT, DECISIONS, & README documents only after review, not while a decision is still changing.

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
The header places the logo at the left and a compact icon-only mode switch at
the right. Solid paintbrush/puzzle-piece icons use square segments sized with
the logo lettering; accessible names and tooltips retain the mode names.

On each page load, the logo starts centered over the theme's base color.
The reusable `LogoStar` spins and scales in for 2 seconds; its animation-end
event starts a 1.4-second move into the header. The opening logo stays at header
size through 480px and starts larger above that width. Page content fades in
with an independent 2-second opacity transition, so the logo settling does not
cut the fade short. Reduced-motion users see the final layout immediately;
the entrance is also skipped when the Web Animations API is unavailable.
The animation measures its final bounds, including the left-aligned destination.

Puzzle Mode places the goal image and equal-scale tray pieces in a compact row
above the full-width board. A small shared modal celebrates completion with a
centered Mr Dafoe heading and Next Puzzle action; dismissing it preserves the
solved design. The on-page Next puzzle button appears only after completion.
The rotate icon restarts the current puzzle. Placement feedback remains in a
nonvisual status region rather than visible instruction/status blocks.

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
- **Scheme** in code/file names; **palette** in user-facing text.
  **Theme** refers to dark/light mode, not palettes.
- Keep persisted shape IDs stable. Import across folders with the single `@/`
  alias for `src/` (kept aligned in [Vite](./vite.config.ts) and
  [TypeScript](./tsconfig.app.json)); use `./` only within the same folder.
- Import individual Font Awesome definitions and render `FontAwesomeIcon` SVGs.
  [main.tsx](./src/main.tsx) imports core CSS and disables automatic CSS injection.
  No Kit script or Kit dependency.
- Self-hosted fonts: Righteous 400 (player header, text buttons, modal titles); Mr Dafoe 400
  (intro Welcome/Congratulations headings); Urbanist 200, 400, 400 italic, and 700
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
  colors: square swatches for choices, continuous strips for catalog/set previews.
  [PaletteChoices](./src/ui/components/PaletteChoices.tsx) owns controlled,
  labelled palette buttons keyed/selected by ID, with optional visible names.
  Player SchemePicker adapts its local name-based catalog and applies/closes
  immediately; admin owns catalog IDs and bulk selection still requires Apply.
  Keep duplicate colors in their original slots. Interactive painting color
  buttons remain the separate ColorSwatches component.
- [AdminLayout](./src/features/admin/common/AdminLayout.tsx) supplies section
  headings/actions, feedback, gallery framing, and ordered member rows. Puzzle,
  palette, and landscape-set cards retain their domain content/layouts; don't
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
| Reorder / unassign | Staged `faGripVertical` drag handle + the set's single Save ([SortableSetMembers](./src/features/admin/sets/SortableSetMembers.tsx)), shared by puzzle and palette sets; `faSquareMinus` unassign preserves the member |
| Admin catalog data | [useCatalog](./src/features/admin/catalog/useAdminCatalog.ts) / `useCatalogInvalidation`; update locally after writes, invalidate other affected catalogs |
| Section / view tabs | [AdminNavigation](./src/features/admin/shell/AdminNavigation.tsx); wrap changes in `requestNavigation` |
| Pending feedback | [Loading](./src/ui/components/Loading.tsx); readable request-specific label, not a success spinner |
| Confirmation / rich action form | [ConfirmDialog](./src/ui/components/ConfirmDialog.tsx) on [Modal](./src/ui/components/Modal.tsx); errors/pending stay inside |
| Simple set creation | [SetCreationDialog](./src/features/admin/sets/SetCreationDialog.tsx); close/refresh/focus Add on success |
| Retain action content during exit | [useModalState](./src/ui/hooks/useModalState.ts); defer destructive view changes until after close |
| Guard edited/pending navigation | [useUnsavedDraft](./src/ui/navigation/useUnsavedDraft.ts) with [useNavigationGuard](./src/ui/navigation/useNavigationGuard.ts); first destination wins |
| Decorative palette / palette selection | [PaletteStrip](./src/ui/components/PaletteStrip.tsx) / [PaletteChoices](./src/ui/components/PaletteChoices.tsx); not painting buttons |
| Section / gallery / ordered members | [AdminLayout](./src/features/admin/common/AdminLayout.tsx); retain domain card layouts and local async ownership |

Native mode/shape/color choice buttons, painting SVG cells, puzzle pieces, and
the transparent native checkbox input are intentional specialized controls,
not missed command-button migrations.

## Architecture

`src/` holds the Vite entry [main.tsx](./src/main.tsx) and six folders. Dependencies
point downward: `app` → `features` → `ui` → `domain`/`lib`. Features never import
each other, and `domain` never imports React.

| Location | Responsibility |
| --- | --- |
| [app/](./src/app/) | `AppEntry` (player/admin routing, navigation guard), `PlayerApp` (page, entrance animation, header, mode switch, footer), `useAdminRoute`, [layout/](./src/app/layout/) (Header, Footer), global [index.css](./src/app/index.css) |
| [features/zen/](./src/features/zen/) | Zen Mode: `ZenMode`, [state/](./src/features/zen/state/) (reducer, history, Context, localStorage persistence, design randomization), [controls/](./src/features/zen/controls/) (toolbar, palette and shape pickers), [grid/](./src/features/zen/grid/) (shape adapters, `ShapeGrid`, `GridView`, cells), [export/](./src/features/zen/export/) (Save Image), [intro/](./src/features/zen/intro/) |
| [features/puzzle/](./src/features/puzzle/) | Player Puzzle Mode: seeded puzzles, Restart/Next, congratulations |
| [features/admin/](./src/features/admin/) | Lazy-loaded admin portal. `shell/` (portal, workspace, navigation), `catalog/` (session cache), `common/` (layout, icon button, form), `sets/` (shared set editing), one folder per content area (`puzzles/`, `puzzle-sets/`, `palettes/`, `palette-sets/`), `services/` (Supabase reads/writes), `testing/` |
| [ui/components/](./src/ui/components/) | Shared controls: buttons, `DarkModeToggle`, palette-tinted `Checkbox`, native `Modal`, `ModalHeader`, `ConfirmDialog` and its dismissal preferences, form fields, loading, palette strips/choices |
| [ui/theme/](./src/ui/theme/) | `PlayerThemeContext` (dark mode, active palette, toggle) and `useDuotoneIconTint` |
| [ui/hooks/](./src/ui/hooks/) | `useModalState`, `useIsTouchDevice` |
| [ui/navigation/](./src/ui/navigation/) | App-wide unsaved-work navigation guard |
| [ui/puzzle/](./src/ui/puzzle/) | Shared `PuzzlePlay` (target, tray, board, pointer/keyboard interaction) and `HexPuzzleBoard` |
| [domain/shapes/](./src/domain/shapes/) | React-free shape catalog, sizes, registry, and one folder per shape (grid, layout, types) |
| [domain/geometry/](./src/domain/geometry/) | `Point`, shared geometry math, symmetry engine, cell grouping, SVG points |
| [domain/puzzles/](./src/domain/puzzles/) | Pure seeded puzzle generation, authoring, stored-definition readers, placement validation, and completion |
| [domain/palettes/](./src/domain/palettes/) | Local palette catalog, palette type, color math, light/dark theme colors |
| [lib/supabase/](./src/lib/supabase/) | Supabase browser client and generated database types |
| [test/](./src/test/) | Vitest setup and shared render/interaction helpers |

Shape adapters supply geometry to `GridView`; it owns numbering, painting,
highlighting, announcements, and SVG references. An optional `interaction`
prop (supported by `TriangleGrid`) replaces app-state paint colors, paint handling,
paintable groups, and highlighting; the intro uses it for its local design. Helpers preserve generated
cell/group ordering. `averagePoint` is a vertex average, not an area-weighted centroid.

[catalog.ts](./src/domain/shapes/catalog.ts) defines supported IDs, labels, order,
and picker visibility. All six are currently visible. Hidden entries remain
loadable. The [registry](./src/domain/shapes/registry.ts), `ShapeGrid`, and icon
previews are keyed by every shape ID, so an unregistered shape fails to compile.
Import a shape through its folder barrel (`@/domain/shapes/hexagon`) and shared
shape data through `@/domain/shapes`. Files inside `domain/shapes` import siblings
directly, never their own barrel, to avoid cycles.
React rendering remains separate from geometry and storage.

### Grid sizes

Each shape offers small, medium, and large grids. Size choices are remembered
independently per shape in [sizes.ts](./src/domain/shapes/sizes.ts).

| Shape | Small | Medium | Large | Default |
| --- | --- | --- | --- | --- |
| Hexagon | Radius 3 | Radius 4 | Radius 6 | Medium |
| Triangle | Size 4 (intro size) | Size 7 | Size 10 | Medium |
| Diamond star | 3 x 3 per point | 4 x 4 per point | 5 x 5 per point | Medium |
| Hexagram | Size 2 | Size 3 | Size 4 | Large |
| Circle rings | 3 rings + center | 4 rings + center | 6 rings + center | Large |
| Pinwheel | 2 x 2 per spoke | 2 x 3 per spoke | 3 x 3 per spoke | Large |

Default app grids:

| Shape | Symmetry | Size | Cells | Clickable groups |
| --- | --- | --- | --- | --- |
| Hexagon | D6 | Radius 4 | 61 | 9 |
| Triangle | D3 | Size 7 | 49 | 12 |
| Diamond star | D6 | 4 x 4 per point | 96 | 10 |
| Hexagram | D6 | Size 4 | 192 | 20 |
| Circle rings | D6 | 6 rings + center | 127 | 16 |
| Pinwheel | C8, rotation only | 3 x 3 per spoke | 72 | 9 |

Hexagons use axial-coordinate symmetry; other shapes use the shared geometric
symmetry engine. One representative per group is clickable.

### State and persistence

- New designs start in dark mode with the first scheme in
  [colorSchemes.ts](./src/domain/palettes/colorSchemes.ts) and its first color selected.
- Painting toggles a group back to accent when its current color is selected again.
  Unpainted groups also display accent.
- Each of the 18 shape/size combinations has an independent paint map. Switching
  boards saves the outgoing pattern and restores the incoming one; unvisited
  boards start empty. Paint is never copied between sizes or shapes.
- Palette and theme are global, not board-specific. Scheme changes remap painted
  palette colors by position on all boards and select the first new color.
  Explicit dark/light toggles remap neutral base/accent paint on all boards;
  switching boards and undo/redo never change the theme.
- Reset and randomize affect only the active board. Switching shape and size
  together is one undo step.
- Undoable: paint, scheme, shape, grid size, randomize, reset. Current color, dark mode,
  and editable-area visibility are tool/view choices, not undo stops.
- History is one unlimited, session-only chronological timeline across all boards,
  including switches. Restored boards form the session's starting baseline;
  history itself is not restored. Snapshots include active and inactive paint.
  Unchanged designs preserve undo/redo; real design edits clear redo.
  Snapshot restoration reconciles unavailable
  selected palette colors by position, preserving available and neutral selections.
- Theme toggles do not remap historical snapshots, so undo across a toggle can
  restore older literal neutral colors without changing the current theme.
- Autosave writes version 5 to `kaleidoscope:design` on state changes. It saves
  scheme name, selected color, dark mode, shape, per-shape sizes,
  editable-area preference, and all board paint maps in one record.
  `shapeGroupColors` holds active paint; `savedBoards` holds inactive paint keyed
  by stable `shape:size` IDs (for example, `triangle:sm`), never duplicating the
  active board.
- Versions 1-4 remain loadable. Their single paint map belongs only to the original
  effective active board; other boards start empty. Missing size data restores the active shape's
  legacy size. Earlier placeholder medium values for Hexagram (v1), Circle Rings
  (v1-2), and Pinwheel (v1-3) migrate to large to preserve their previous grids.
- Loading rejects malformed records, arrays, invalid six-digit hex colors,
  unknown versions/shapes/schemes, invalid board keys, and duplicate active-board
  entries; fallback is a fresh design. Missing historical
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
- Native dialogs provide modal focus behavior. Reset confirmation has a
  persistent opt-out, saved only on confirmation. Board switches are immediate
  and non-destructive, so no shape-change confirmation is needed.
- Admin palette/puzzle/set deletion, bulk palette changes, and set assignment
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
  grid, controls, and footer. Intro state is local: a size-4 triangle grid with its
  5 paintable tiles, and the first scheme's five colors. Choosing a swatch and a tile
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
- Randomization weights each scheme color 18 times and theme base 10 times
  (90% palette, 10% base). Accent is excluded. The pool is built once per design;
  only groups present at the selected grid size are randomized.
  Duotone tint is computed once per hook invocation.

## Tests and deployment

Logic/component tests use Vitest + RTL/jsdom; hooks use `renderHook`.
[Test setup](./src/test/setup.ts) registers cleanup, polyfills dialog open/close,
and stubs page scrolling and `ResizeObserver` for jsdom.
Clear or seed storage and use deterministic state/randomness where needed.
jsdom does not verify real layout, native focus trapping, or PNG rasterization.
Browser checks are ad hoc; there is no maintained browser suite or coverage threshold.

[CI](./.github/workflows/ci-deploy.yml) runs lint, format checks, tests, and build
on pushes to `main` and PRs targeting `main`; successful pushes deploy to Pages.
Production base is `/kaleidoscope/`; development uses `/`.
