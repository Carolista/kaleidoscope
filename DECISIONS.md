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
  An external state library is unnecessary.
- Organize by feature once the app grew past one coloring tool: `app` composes
  `features` (zen, puzzle, admin), which use shared `ui`, React-free `domain`,
  and `lib`. Layer folders (`components/`, `services/`, `hooks/`) scattered each
  feature's code and let shared code depend on Zen state.
- Enforce the structure with small local ESLint rules rather than a plugin
  dependency: they resolve imports against real paths, so they can tell a folder
  barrel (`@/domain/shapes/hexagon`) from a file (`@/domain/palettes/catalog`),
  which glob-based `no-restricted-imports` patterns cannot.
- Keep shape math in `domain/shapes` (one folder per shape plus a keyed registry)
  and shared geometry in `domain/geometry`. `domain/` never imports React.
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
- Use **palette** in code and UI; reserve **theme** for dark/light mode. Code
  originally said "scheme" and was renamed to match the UI and the database
  (`palettes`). Designs saved before palettes had IDs name their palette in a
  `schemeName` key, which is still read.
  Zen's state types are `ZenState`/`ZenStateProvider`/`useZenState`, so they are
  not mistaken for app-wide state.
  Geometry export names were not broadly renamed.
- Use one `@/` path alias instead of per-folder aliases. Per-folder aliases had
  to be kept in sync in two configs and never covered every folder, which left
  a mix of alias and `../../` imports.

## Puzzle Mode prototype

Decisions made for the first prototype. Players now get published puzzles instead (see "Player content" below);
the rules about generation, shared play, and keeping puzzle state out of Zen still hold.

- Keep puzzle placements separate from Zen reducer/history/storage. The puzzle
  stays mounted across mode switches, but progress is intentionally session-only.
- Start with the small hexagon's six representative cells and connected pieces
  of one, two, and three tiles. Use Cabo for this player POC; expanded recipes
  and rotation live in the separate admin lab first.
- Generate repeatable versioned definitions from explicit seeds. Publish full
  definitions rather than seeds alone; generator changes must not rewrite
  published puzzles. Generation guarantees a solution, not a unique solution
  or certified difficulty.
- Player Puzzle Mode and admin playtests share one `PuzzlePlay` surface. Callers
  add their own controls as slots (`trayAction`, `children`), react to `onSolve`,
  and restart through a ref handle (`reset()`), so play state stays inside
  `PuzzlePlay` and neither side needs a preview flag.
- Accept any non-overlapping placement inside the wedge. Match the completed
  colors to determine success, then remove interaction and piece/wedge outlines.
- Render the dragged piece at board scale with the grabbed tile centered on the
  pointer, not as an offset translucent copy or snapped preview (circle rings
  is the exception; see its entry below). Muted mirrored
  tiles reveal full color on completion; placed tray entries are disabled and
  desaturated until returned.
- Keep the goal image and uniformly scaled tray pieces together above the
  full-width board, without visible instructions or piece labels. Celebrate a
  solve with a brief "Congrats!" fade (Mr Dafoe, accent fill, base outline) over
  the board instead of a dialog, so players can appreciate the finished design.
  `PuzzlePlay` takes it as an opt-in `celebration` prop; it is hidden from
  assistive tech because the status message already announces the solve.
- Keep the Next puzzle button rendered whenever the set has another unsolved
  puzzle, disabled until solved and once clicked, so the icons beside it never
  jump. The "set complete" message of the old dialog was dropped; players use
  the back arrow.
- Puzzle boards and pieces follow Zen: neutral fill `var(--accent)`, stroke
  `var(--base)`. Placed pieces are told apart by one thicker base outline rather
  than a double outline; wedge hover uses a per-cell fill like Zen.
- Puzzle session icons take their tint from the puzzle's own palette (second
  color, since the first can be dark) via `DuotoneTintColorContext`, so
  `PlayerPuzzle` carries its palette. The dark/light toggle lives in the app
  header (classic solid, so untinted) rather than on each board, so it exists
  on views without a board; it may move into a settings modal later.
- A new puzzle swipes in from the right while the previous one swipes out to the left,
  rather than reusing Zen's shrink-and-turn swap, because the target and tray change
  along with the board. Only the target/tray/board unit (`PuzzlePlay`'s `contentRef`)
  moves, so the controls beneath do not. The outgoing puzzle is an inert DOM copy
  captured on unmount, which keeps the solved design intact without keeping two live sessions.
- `size="sm"` remains a Modal variant but no player view uses it now.
- Generate new seeds with `crypto.getRandomValues`, which works over local
  network HTTP. `crypto.randomUUID` requires a secure context and can prevent
  even Zen Mode from mounting when the puzzle component initializes.

## Admin authoring lab

The admin lab supports six exact recipes for every puzzle shape: small without rotation (easy),
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
with one subtle selected/focus border. Players meet rotation through a first-use tutorial (see Puzzle tutorials).
The admin lab does not mount Zen state or write player progress. Named drafts
save public definitions and private authoring atomically, with idempotent retry
IDs. A puzzle has no intended use of its own: its purpose comes from the group it
joins (see "Groups, purposes, and progression"). Its palette stays on the puzzle.
Assigned galleries derive order from group membership (group name, then position)
rather than naming conventions, so reordering a group reorders the list.
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

Draft groups have a purpose chosen at creation and editable until publication
(see "Groups, purposes, and progression"). Puzzle groups hold 24 puzzles and
palette groups 6 palettes, but drafts do not enforce a count; whether publishing
enforces it is still open. Membership is exclusive; append eligible unassigned
drafts in selection order. Save removal immediately, but stage renames and member ordering locally: drag
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
Confirmed deletion removes only the draft group and its memberships, preserving
all puzzles/private solutions. Reject release and progression/reward/grant
dependencies instead of silently cascading meaningful configuration away.
Keep mutations atomic under caller RLS, explicit admin checks, READ COMMITTED
isolation, and the catalog lock. Progression, reward, and release tools follow.

### Groups, purposes, and progression

**Terminology.** A **group** is any collection of puzzles or palettes built for any
purpose; it is admin and database wording only and never appears in the player UI.
A group's **purpose** says how it is used:

- **core:** free groups. Puzzle groups are the free sets players progress through;
  the first shape's core groups are open from the start and later shapes unlock
  as described below. A core palette group is the palettes available in Zen from
  the beginning (replacing the old starter palette table).
- **reward:** free groups unlocked by completing other groups (a palette group, or a
  bonus puzzle group), never by advancing to the next shape.
- **daily:** puzzles only. Organized into groups in admin (for example by month) but
  scheduled one per day in a separate feature; players see only the last five
  days. A daily group may mix shapes, so it has no shape.
- **pack:** groups sold in the store. Pack means price. Combo deals bundle
  existing packs and are a store product (Phase 2B), not a group.
- **undecided:** a draft still choosing its purpose. It cannot be published, and its
  purpose, shape, and track stay editable while unpublished.

Palette groups have no daily purpose. Puzzles have no intended-use field: the group
they belong to decides. A puzzle's **palette is stored on the puzzle** (never
derived), so the store can later offer the palettes a player does not own. Playing a
puzzle does not grant its palette in Zen.

**Track.** Puzzle groups have a track: **basic** (no rotation; Easy/Moderate/Hard)
or **rotation** (Moderate/Hard/Challenging). Core and reward groups are basic or
rotation, packs may also be **mixed**, and undecided and daily groups have none.
The database rejects a member that does not match the group's shape (except daily
groups) or track, including when a puzzle's recipe is replaced while assigned.
Counts and the difficulty split inside a group are not enforced yet.

**Progression.** Each shape has two core groups, basic and rotation. Solving either
one unlocks the next shape and its two core groups. The unlock order lives in
`shape_progression` (default Hexagon, Triangle, Diamond Star, Hexagram, Circle
Rings, Pinwheel), editable by the admin; the first shape is the starter. A group
counts as completed when every puzzle in it is solved (`group_completions`);
the earlier per-set qualifying routes no longer exist. Shape menus in the app
(Zen picker, admin selects and filters) follow one order defined in the shape
catalog, `supportedGridShapes`, with Circle Rings last. It is not read from the
database, so update it when the unlock order changes.

**Rewards.** Completing the basic core group awards one palette plus the basic bonus
group; completing the rotation core group awards one palette plus both bonus groups
(basic and rotation), so a player who already has the basic bonus group only gains the
rotation one; completing each bonus group awards one palette. The basic core group
awards its bonus group directly so that players who never take on rotation puzzles
still get more to play, rather than having the extra basic puzzles locked behind the
hardest track. Rewards name exact
palettes, not a palette group. That is the intended pattern for all six shapes, but
reward rules stay flexible in the database (any group can award palettes and/or
bonus groups) so a later admin screen can check a shape against the pattern. A player who
solves all twelve core and twelve bonus groups earns the Zen randomizer. The database grants it (`feature_grants`, in `record_puzzle_completions`) so that it is permanent, and the app hides it entirely until then, in Zen's toolbar and the help modal alike, rather than showing it locked.

**Zen access.** Unlocked shapes and awarded palettes are usable in Zen at once, as are
purchased palette packs. A puzzle pack unlocks only puzzles: its palettes come
from a palette pack bought separately or in a discounted combo.

**Implementation.** Tables `puzzle_groups` and `palette_groups` (with members) replace
`puzzle_collections` and `palette_packs`; the routes, core-chain, `reward_shapes`,
and starter tables are gone. The admin RPCs are `manage_puzzle_group` and
`manage_palette_group`; deletion is an action of the former. Shape unlock, group
completion, and pack access are enforced by the same security-definer helpers that
gate puzzle reads.

**Progression admin.** Progression is a top-level admin section (Puzzles and Rewards, the default view | Order).
Order is strictly the shape order. Each shape has four **slots**: a basic and a rotation core
group, and a basic and a rotation bonus (reward) group. A slot holds at most one group (core and
reward groups are unique per shape and track, with a trigger for a readable error and a unique
index behind it). Editing a slot picks the puzzle group that fills it and the one palette it
awards, in one atomic call (`manage_progression_slot`): the group takes the slot's purpose,
shape, and track; the group that held the slot becomes Undecided and loses its reward; an empty
slot is a null group. Candidates are unpublished groups outside every slot whose puzzles fit
the shape and track. Reward palettes must belong to a palette group with the reward purpose, and
the editor shows palettes another group already awards in greyscale, with their names, and
disables them. Slot cards show a gridline-free thumbnail of the group's first puzzle, read from
the puzzle group catalog, which lists every group, released or not).
The shape preview icon is a shared UI component because features cannot import each other. The pattern checks live on the Puzzles and Rewards page itself (a warning list
under each shape, general warnings above the shapes, and a list of grouped puzzles whose palette
no player can get), so there is no separate Checks view.

The bonus groups of a shape are exactly its reward groups, and the database links them to the
shape's core groups automatically (`reward_puzzle_groups`, kept in sync by a trigger and
rebuilt on every slot change): the basic core group links the basic bonus group, and the
rotation core group links both, so completing either core group grants its bonus groups. Grants
are idempotent, so the basic bonus group is granted once even though two rules name it. Nobody
picks those links by hand. A group with automatic links is changed through its slot, not by
deleting it or changing its purpose elsewhere. `manage_shape_progression` reorders the shapes
and, with a trigger on the table, refuses any change once a core group is published, because
the order decides who unlocks what. The Progression page only warns about the pattern (an empty
slot, a group awarding no palette or more than one, a palette awarded twice, and grouped puzzles
whose palette no player can get); the release tools turn the hard rules into blockers (see Releases).

### Releases

**The release summary is a table.** Rows for core and bonus groups, other puzzle groups, and palette groups
show drafted, scheduled, and live counts in columns; reward palettes are counted per palette, not per group,
so that row spans the state columns with "N of M live".

**Release means the content exists and is locked, not that players see it.** `published_at` approves content
and `release_at` is when it goes live; a scheduled item stays editable until its release instant, a live one never
changes (except a palette color correction). What a player is shown is a separate rule in the player app. The plan is
to start with owned content only and later add a way to see what could be unlocked or bought.

**Everything is released through groups.** Palettes and puzzles are never released or cancelled singly. Releasing a
group also releases what it depends on, in dependency order: palettes, puzzles, then the group. A dependency already
scheduled for later is pulled earlier, never later, so nothing that depends on it can break; live items stay as
they are. Pack palette groups are not dependencies: only the individual palettes a puzzle uses are released, so
pack groups stay editable drafts until the store exists.

**A shape's core and bonus groups release as one package.** In the database a core group's reward is its bonus
group, and rewards must be ready no later than what awards them, so the requirement points from the core group to
the bonus group, the opposite of how a player experiences it (finish core, unlock bonus). Rather than explain that
direction in the UI, the four groups of a shape (basic and rotation core, basic and rotation bonus) go out together:
scheduling, rescheduling, and cancelling always cover all four with their puzzles and palettes, a package needs all
four slots filled, and these groups are refused as standalone releases (`preview_release` blocks it and the UI
shows no buttons for them outside the Release section). Daily, pack, and undecided groups and palette groups are
still released one at a time. Players only ever see a progression that is complete for the shapes released.

**Blockers and warnings.** Blockers stop a release: an undecided purpose, a core or bonus group without exactly
24 puzzles, a core or reward palette group without exactly 6 palettes, a core or bonus group that awards no
palette, a puzzle without saved solution data, a shape that is not released, a time in the past, anything live, a
puzzle on the daily schedule (when cancelling), a missing slot in the package, and moving a group later than a
group that awards it. Warnings need an acknowledgement: a palette awarded twice, a group awarding more than one
palette, a palette players cannot get, a palette also used by daily puzzles (releasing it would make it public),
and the first core release locking the shape order. Daily groups are exempt from the size rules because they are
grouped by month or by collection.

**Cancelling.** Unscheduling a package or group returns it and its scheduled puzzles to draft, along with palettes
no other scheduled puzzle, reward, or palette group still uses, so palettes are never cancelled by hand (that
option was removed). Live content, and puzzles on the daily schedule, block it. Release times are entered in the
admin's time zone; Release now stamps the current time and is never the default.

**One plan for preview and apply.** `preview_release(action, kind, id, release_at)` computes the whole plan as JSON
(items in order with what happens to each, blockers, warnings) and `apply_release` runs the same plan in one
transaction under the catalog lock, rejecting it if any blocker remains. The browser never decides what to
release. Kinds are `shape_package` (id is the shape), `puzzle_group`, and `palette_group`.

**Pack groups in 2B (proposal, not decided).** Designating a group as a pack already exists (its purpose). In the
store, the product listing (price, description, contents, availability) is the natural thing to schedule, and
releasing it would release the groups it sells with the same dependency walk, so there is no separate publish step
for packs and nothing needs locking down early. Releasing a pack group before the store would only freeze its
contents and expose it to players early.

**Reward palette groups are never released as groups.** They exist only to hold six palettes each (the group
size rule) and a reward names exact palettes, not a group. A group that is released makes its palettes available to
acquire; a reward palette becomes available only when the shape package that awards it is released, as an individual
palette. So a reward palette group shows how many palettes are live ("2 of 6 live", yellow until all are, then green),
has no release buttons, and is left out of the palette-group release counts.

**Release status marks.** Where release buttons are missing or need explaining, a small mark shows the state: green
circle-check (live), blue calendar-check (scheduled), orange exclamation (a draft blocked from release), yellow
circle-check (a reward palette group partly out). There is no "failed" mark: a database rule forces `published_at`
and `release_at` to be both set or both empty and a release is one transaction, so a failed attempt leaves the item
an untouched draft and reports its error in the release dialog. Group libraries list every group; a group that is
scheduled or live is read-only (it locks when scheduled, unlike an individual puzzle, which stays editable until its
release instant) and uses the eye icon.

### Player content

**Players see only what they have.** The player app loads one set of content before it starts: the palettes of released
core palette groups (these are Zen's palettes), the released core puzzle sets, and the unlocked shapes (for guests, the
first shape in the unlock order). A way to show what could be unlocked or bought comes later; for now locked content is
simply absent. The database stays the authority (guest reads are limited to released content and the first shape's
core groups); the app filters again by release state so drafts never appear even under elevated access.

**Players never read authoring data.** Seeds and known solutions stay admin-only, so the player reads a puzzle through its
stored definition and its own palette alone (`readPlayablePuzzle`); a puzzle's ID stands in for its seed.

**The player has its own Supabase clients.** Content reads use a client that stores no session, so they always read as a
guest, even where an admin is signed in. Accounts use a second client (`getPlayerClient`) with its own storage key, so a player's
session never mixes with the admin's or with content reads. Content will switch to the signed-in client once progress is stored per account.

**Offline and empty.** The last successful load is cached; with no network the cache is used, and with no cache the
player sees the error and can retry. Zen cannot start without a palette, so with nothing released the app says so
instead of opening. The bundled palette list was removed so a corrected palette cannot disagree with a stale copy;
designs are saved by palette ID.

**Home is the landing screen; Puzzle Mode is still the primary mode.** Now that Zen and both puzzle tracks teach themselves on first use
(see Puzzle tutorials), the app shows the full picture up front: a greeting, then a card each for Puzzle and Zen (in that order), and lets the
player choose. Every visit opens on Home; the title returns there from anywhere, and the Zen/Puzzle switch is unchanged. A third card joins in Phase 4,
and no placeholder is shown until then. Cards show a palette's colors as diagonal bands above a solid caption, so text never sits on the colors
and any palette stays legible; custom graphics may replace the bands later. The Zen intro still shows the first time Zen is opened.
Zen is limited to unlocked shapes, the released core palettes, and earned reward palettes.

**The frame appears before content, and the loader lives in the page.** The big logo animation is the app's entrance, so it must not wait on the network:
a full-page spinner before it looked like a different loader, then a replacement. The frame is rendered at once (`PlayerApp` with a `gate`) with the
saved light/dark mode and no theme or mode controls, and the loading, failure, and nothing-released messages sit in the main area. When content is
ready the real app takes over, and a small handoff record lets the star continue its spin instead of restarting. The alternatives were a shared page frame above the
providers (it needs Zen's dark mode and the header controls, which live below them) and a provisional Zen state (it risks overwriting the saved design).
The cost is one remount, which is invisible unless it lands while the title is mid-move (it then snaps into place).

**Puzzle browsing is picture first.** Sets and puzzles are shown as solved images with minimal text: a set card shows
the first puzzle of each difficulty with its progress; a set shows its puzzles under difficulty subheadings, borderless,
four to a row, with a round check badge on solved ones. Sections come from each puzzle's own difficulty, not a fixed
count. Progress is the device's list of solved puzzle IDs and is never merged into an account automatically.

**Guests earn rewards on the device.** A guest has no account to hold grants, so the database lets anonymous readers
read released bonus (reward) groups of the first shape, the same as core groups (`can_play_puzzle_group`); signed-in players
still need a grant, and later shapes still need an account. The app derives what is earned from the solved puzzle IDs
instead of storing grants: a set is complete when all its puzzles are solved, completion grants its reward palettes and
bonus sets, and a bonus set can award more. Deriving keeps one source of truth and keeps the unmerged guest save
simple, and the later account import only has to carry solved IDs. The tradeoff is that a guest can read the first shape's
bonus puzzles by editing requests; that is accepted because guests are local-only anyway and later shapes stay gated.
Bonus sets stay hidden until earned (see "Players see only what they have"). Earned palettes are Zen palettes;
playing a puzzle in a palette still grants nothing.

**Rewards are announced in a dialog, not a line of text.** What a solve earns is a moment worth stopping for, so it opens a
modal ("Reward earned", "Hooray!") showing the palette strip and name and/or the new set's pictures, each with a link to
use it now (Zen Mode, or the set). The Zen link only switches mode; it does not change the player's current palette,
which would alter their design.

### Accounts

**Email is the credential; the first name is for greeting.** Signup is email and password with a first name, so the game can greet players. There is no
username. The name lives in the Supabase user metadata, not a `profiles` row, which needs no migration and nothing to keep in sync; the
`profiles` table stays for when a public identity is needed (Phase 4). Because the name is typed at signup, it never appears in an auth email: the address
might belong to someone else, so a user-supplied string in a message that looks official would be a phishing aid.

**Accounts are optional until the Hexagon sets are done.** Guests keep playing, and Settings (with sign-in) is always in the header. The forced step is later:
finishing every set open to a guest (all four Hexagon sets) opens a dialog, once per device, explaining that the next shape needs an account, which can be dismissed so the player can keep playing Hexagon and Zen as a guest. Under the normal rules an account unlocks the next shape by finishing either core set, so a guest who qualifies still sees nothing of Triangle until they have one.

**An account's progress is recorded by the database, through one function.** A signed-in player's solves go to `record_puzzle_completions`, a `security definer`
function; players have no insert rights on `puzzle_completions` or `group_completions`. One call records the puzzles the player may play, completes the groups they finish, grants the rewards, and repeats
until nothing changes, so whatever the content gates (the next shape via `has_shape`, bonus groups via grants) is decided by the same rules that already hide it, and a whole imported save settles in one call. Rewards are still
also derived in the app from the solved IDs, for the dialogs. The function checks access, not the solution; checking solutions server-side would need placements sent along and is deferred.

**A signed-in player reads with their own session; the app shows only what it has loaded.** Content is loaded again for the signed-in player, and again after a solve that finishes a set, because that is what can open a bonus
group or the next shape. Because of that, the solve that finishes a set waits for the server before announcing its rewards, so a bonus set is never missing from its own announcement. Other solves are sent in the background and kept
(per account, with a pending list) until the server takes them. Server solves are only ever added to the local set. An account's caches are never shared with the guest's.

**Unlocking a shape is announced, not silent.** When the reload shows a shape that was not open before, a second dialog after the reward dialog says so, names that it is available in Zen Mode, and lists the shape's core sets
with a way in. The randomizer, the last prize, is announced in its own dialog after the reward and shape dialogs, pointing at Zen Mode. The announcements run in a fixed order (reward, shape, randomizer, account prompt, sign-in reminder), one at a time, each after the last has finished closing.

**Only results sync between devices, so devices do not conflict.** Solved puzzles only ever accumulate and a solve is idempotent, so the account's progress is a union of what each device has solved: the app
adds whatever the server holds and never removes anything, and no conflict prompt is needed. Rewards, groups, and shape unlocks are derived from that union by the database. A device picks up another device's solves
when it loads, after a solve that finishes a set, when the browser comes back online, and when a tab becomes visible again (at most every 30 seconds, after sending any solves still pending). What a player has left unfinished
(Puzzle Mode placements and rotations) stays on the device and is never sent to the account, so two devices can hold different attempts at the same puzzle without anything to reconcile. The cost is that a
half-finished puzzle cannot be continued on another device; the alternative, one server-stored "current puzzle" with a last-write-wins rule or a keep-this-or-that prompt, was set aside as not worth the surface area. Revisit
for Zen designs when Phase 4 gives them cloud storage, since a design is one document edited in place and can truly conflict. Progress that arrives from another device is not announced: reward, shape, and randomizer
dialogs describe only what a solve on this device just earned.

**Unfinished puzzles resume per device, one attempt per puzzle, through a Continue card.** Each unfinished puzzle keeps its own placements and rotations until it is solved or restarted, rather than only the latest one, so
leaving a puzzle to try another costs nothing. Only positions are stored, never the puzzle, and they are replayed against the puzzle as published, so a corrected puzzle drops what no longer fits instead of showing an impossible
board. Home stays the landing screen; when something is unfinished its Puzzle card says "Continue" and opens the most recent unfinished puzzle directly (the set list is one Back away), in preference to marking progress on the set list or
only resuming after a reload. Attempts are kept per player, so signing in or out never shows someone else's.

**Progress made offline counts at once; the database confirms it later.** A player on a flight who finishes a set gets what it earns (bonus sets, reward palettes, the next shape, the randomizer) without waiting for the server, and the
dialogs announce it as usual. The app applies the same rules as the database to the player's own solves, and the pending solves are sent when the connection returns, which settles in one call because the database repeats until nothing changes.
Offline use needs the puzzles of the next tier on hand beforehand, but players only read what they have earned. Rather than loosening the read rule on `puzzles` (which would have widened what a forged request can read and rewritten several
tests), a separate `preview_puzzles()` function returns the bonus sets of shapes a player has and the core and bonus sets of the single next shape; recording solves still accepts only puzzles the player may play, so a preview earns nothing.
Packs and daily puzzles are never previewed. The cost is that free puzzles are readable one tier before they are earned, accepted for the same reason as guests reading the first shape's bonus sets. If previews cannot be loaded, the app still
loads and the player simply waits for a connection to open what they earn. A solve the server later declines is still shown locally, as before.

**Older saved designs on shapes or palettes that are now locked are not carried over.** Saves on a locked shape or an unavailable palette start fresh. Only a few early testers have older saves, so no migration or special treatment was
built; revisit if that ever stops being true.

**Guest progress moves only when the player says so, and a "no" is not final.** After signing in, an account that lacks puzzles solved as a guest on the device is offered an import, in a dialog that opens by itself until
answered. Answers are kept per account, device, and puzzle: IDs that were sent are never offered again (the server may have declined some, which should not nag), IDs that were turned down only stop opening the offer by themselves
and stay available through "Import progress from this device" in Settings, and solves made as a guest afterwards are offered afresh, so progress made while signed out is never silently stranded. The guest save is never deleted
or merged automatically, importing included.

**A guest who probably has an account is reminded once, not forced.** A forced sign-in would punish players on a new browser or device who do not want one. Instead, on a device that has had a signed-in player before, the first guest solve
of a browser session shows "Please sign in to continue saving your progress", unless the player signed out on purpose in that session, or the account prompt is already due. The device remembers a past sign-in with a flag that holds no identity.
Nothing is lost by ignoring it, since the guest save stays and can be imported after signing in.

**Passwords can be reset, and links fail gracefully.** A reset always answers the same way, whether or not the address has an account. A confirmation or reset link that
has expired or was already used (mail scanners often use it first) returns to the app with an error in the URL; the dialog says so and offers to start again. PKCE links must be
opened in the browser that asked for them. Closing the new-password dialog early leaves the player signed in with the old password; a signed-in player can change it later in Settings.

**Changing the email or password re-checks the current password, and the email change waits for a link.** Settings, not the sign-in dialog, owns a signed-in player's account: an unlocked device should not be enough to take over an account, so both forms ask for the current password, verified by signing in again with it before `updateUser` runs
(which also satisfies Supabase's recent-sign-in rule; the session's user id is unchanged, so nothing reloads). A wrong password changes nothing. The email change is not applied until the link is used, so the app shows the waiting address (`new_email`) rather than switching at once.
The confirmation goes to the new address only: with Supabase's "Secure email change" on, the old address also gets the message, but without a confirmation link, so the setting is off, and the old address is told afterwards by the "Email address changed" notification (which names both addresses, since that is its purpose; the other auth emails carry no player-supplied text). The password re-check, not a second confirmation, is what guards the change. The change-email message is branded like the others. Settings lives under `app/` rather than `features/`, because it composes account, import, and theme and features may not import each other. The account dialog is now only for signed-out players and email links, so there is one place for account details.

**Header simplified to a mode button and a Settings button.** Two mode icons plus a theme toggle plus an account button crowded the title (and overflowed under about 356px). A single "[icon] MODE" button that opens a mode dialog says where the player is, scales to Community Share and other modes later, and the
theme toggle moved into Settings' Game settings, where audio and a grid toggle can join it. The Settings button wears the same accent fill as the mode button so the two weigh the same. The footer is a single small line.

**Text is title case in the player app, by a utility rather than CSS.** `text-transform: capitalize` capitalizes every word ("Sign In Or Create An Account"), so a real `toTitleCase` (AP-style small-word list, first word and post-colon words capitalized, "Sign In"/"Log Out" kept as verbs, words with their own capitals untouched) is applied by `Button` and `Heading`, enabled for the player app through `TextCaseContext` so the admin portal keeps its own wording. Asset names are title-cased when player content loads, display only, so
what the admin types is not rewritten. A name that capitalizes a small word on purpose is evened out, and a Zen save that still names a palette by an old, non-title-case `schemeName` would start fresh (accepted, as with other older saves). Buttons and fields use one shared height, 2rem, and body-font text, instead of Righteous capitals, which overpowered everything else in the modals.

**Auth email goes through custom SMTP with branded templates.** Supabase's built-in sender is generic and rate-limited, and templates can only be edited with custom SMTP.
Microsoft 365 was tried and rejected: its SMTP AUTH is off by default (here for the whole tenant), port 465 is unsupported, and Microsoft is phasing out basic-auth SMTP.
A transactional service (Resend) sends from the project's domain; the mailboxes stay on Microsoft 365. Templates are kept in `supabase/email-templates/` and pasted into the dashboard.
The logo is a hosted PNG, since email clients strip inline SVG.

**The dialog is hosted by the page, and holds still while it closes.** Inside the header it inherited the header's title-sized font and button sizing. After a success,
the dialog keeps its content and stays disabled until the close animation ends, since the account state changes first and the content would otherwise swap mid-fade.
Results from requests finished after it was closed are ignored. A timed-out request is shown as a plain message because supabase-js reports the response body as `{}`.

**Modal scroll areas pad out focus outlines.** The shared Modal's scroller clips overflow, which cut off focus outlines at its edges (seen in the account dialog and the admin
progression modal). It has 6px of padding cancelled by an equal negative margin, so layout is unchanged.

### Puzzle tutorials

**Each track teaches itself the first time a player meets it.** Basic puzzles at the first Puzzle
Mode visit, turning at the first rotation set, so guests and (later) accounts get the same onboarding
before any rewards or unlocks. Like Zen's, each is learn-by-doing and has no skip or replay.

**A fixed mini puzzle, not coaching on a real one.** The small hexagon with one hard-coded seed keeps
the lesson identical for everyone and independent of released content or tuning. It runs on the shared
`PuzzlePlay`, with guidance in an `aboveBoard` slot just above the board (not below, as in Zen, where
the palette sits below) so phone players need not scroll to see the next step. Continue takes the same
slot after the solve for the same reason.

**Seen means completed, tracked separately.** Unlike Zen's key-exists rule, puzzles write nothing
until play, so completion has its own versioned key, written on Continue. Solved puzzles already on
the device in that track also count, so returning players are not taught again.

**Each tutorial has its own palette, chosen for distinct hues.** Soft gradations are hard to tell
apart on a first puzzle. Palettes are chosen by database ID from the released core palettes, since
guests cannot read others; a missing ID falls back to the first palette rather than failing.

### Puzzle shapes

**Grid sizes and piece mixes are tuned in the Shapes workbench, not stored.** Each shape's n per
size and piece mix per size are constants in code, shared by Zen and puzzle generation, and a
puzzle only reads back if its stored size matches them. Changing them under existing puzzles would
break those puzzles, so the workbench locks a shape that has any puzzle (drafts included). Shapes
without puzzles can try values freely (the pieces must add up to the wedge, grids stay within 30
cells to fill and pieces within 6 tiles, and generation gives up on a mix it cannot arrange
quickly), but nothing is saved: values that work are copied into the code. The workbench shows
a mix per recipe, though the code still keeps one per size, so two recipes of a size share a mix
until they are split. Tuning the first round moved triangle small to size 5 ([3, 2, 2]), circle
rings large to 5 rings, and pinwheel to 3 x 2, 3 x 3, and 4 x 3. The Zen intro now
uses the small hexagon, so tuning other shapes does not change it.

Puzzle Mode was always meant to offer the Zen shapes, so the engine, board, and
authoring RPCs are shape-neutral. Each shape supplies one adapter in
[puzzleShapes.ts](./src/domain/puzzles/puzzleShapes.ts): grid sizes, piece sizes,
cells, edge neighbours, piece anchor, tile corners, and center. The database
accepts any catalog shape, so a new puzzle shape needs app code, not a migration.
Hexagon generation is unchanged (verified byte-identical across all recipes), and
its definitions keep `geometry.radius` and `hexagon-v2`.

- **Triangle coordinates:** a tile is 3x its centroid in axial coordinates of the
  triangle lattice's vertices. Pieces anchor on a vertex, so the hexagon's 60-degree
  axial rotation applies unchanged and swaps up/down tiles. A piece dropped with
  tiles facing the wrong way simply fails the wedge check. Definitions store
  `geometry.size` with generator `triangle-v1`.
- **Triangle rotation is 60 degrees (6 orientations),** like hexagon. Up and down
  tiles are 60 degrees apart, so pieces must turn in 60-degree steps to reach both;
  120 degrees would keep every tile's direction, and 30 degrees fits no lattice spot.
- **Triangle pieces allow four tiles:** S [3, 2, 2], M [4, 3, 3, 2], L
  [4, 4, 4, 3, 3, 2, 1, 1] for 7/12/22-tile wedges (small is size 5). Three connected triangles are
  always a straight strip, so four-tile pieces add more varied shapes.
- **Diamond star and pinwheel turn 180 degrees (2 orientations).** Their
  parallelogram tiles only realign after a half turn. Each shape declares its
  rotation step in 60-degree units, and the tray, validation, and reader use it.
  They share one (row, col) parallelogram adapter base; wedges are the top point's
  right half (6/10/15) and the whole top spoke (6/9/12). Pieces: diamond star
  S [3, 2, 1], M [4, 3, 2, 1], L [4, 4, 3, 2, 1, 1]; pinwheel S [3, 2, 1],
  M [3, 3, 2, 1], L [3, 3, 3, 2, 1] on 3 x 2, 3 x 3, and 4 x 3 steps (rows x
  columns). Pinwheel's grid is two numbers, so its puzzle grid size is
  rows * 10 + columns (32, 33, 43), with 1 to 9 steps each way.
- **Hexagram shares the triangle lattice** (centered on a vertex), so it reuses the
  triangle adapter with its own cells. Wedges 6/12/20; pieces S [3, 2, 1],
  M [4, 3, 3, 2], L [4, 4, 4, 3, 2, 2, 1].
- **Circle rings is a hexagon grid drawn as circles.** Ring k has 6k circles, like
  a hex ring, so each circle maps to the hex cell at the same ring position; hex
  neighbours are the touching circles and 60-degree rotation maps rings onto
  themselves. It reuses the hexagon adapter and small and medium piece sizes (wedges 6/9/12; large is
  5 rings with [4, 3, 2, 2, 1]). Pieces are hex offsets, but the board bends the
  hex lattice into rings, so offsets are not board positions. Off the board (tray
  and free dragging) a piece is drawn on an even hex lattice of equal circles
  (`pieceCorners`/`pieceCenter` on the puzzle shape). Over a wedge tile the dragged
  piece snaps and draws at its exact board position, so what shows is what lands.
  The bend between that and the tray drawing is accepted. Puzzles are unaffected by
  layout changes, since they depend only on the hex topology.
- **Shape is chosen at creation and fixed.** Puzzles pick it in the New form; groups
  pick it in the group-creation dialog. Assign to group offers only groups that
  accept every selected puzzle (shape and track), except daily groups, which mix shapes.
- **Puzzle-creator palettes follow palette-group order,** like assigned lists, because
  an alphabetical list stopped scaling. Unassigned palettes follow by name.

### Admin information hierarchy and catalog cache

Palettes are not subordinate to puzzles: they also serve Zen Mode later. Top-level
admin sections are peers (Puzzles | Palettes | Shapes, with a future orchestration
view for groups/rewards/packs/rollout). Within a content section, Groups is the
default view and items filter by release status (Unassigned | Assigned | Scheduled |
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
[symmetry.ts](./src/domain/geometry/symmetry.ts). Closed canonical-wedge boundaries include
cells centered on mirror axes; those smaller orbits are genuine, not rounding errors.
Pinwheel uses rotation-only C8 symmetry.

Shared group collection preserves first-seen group order, member order, and cell
references. Refactoring must not change IDs, clickable representatives, or geometry.
Hexagon padding and circle-radius bounds remain separate from polygon bounds.

### Chosen shapes and density

- **Hexagon:** radii 3/4/6; medium is the default. Large uses radius 6
  rather than the former radius 7 to keep density more manageable.
- **Triangle:** equilateral size-5/7/10 lattices with D3 symmetry. Large preserves the previous regular grid; medium is the default.
- **Diamond star:** whole rhombi, not half-diamond triangle slivers.
  Three/four/five subdivisions per axis are available; medium retains the
  previous 96 cells/10 groups. Widening the point angle
  from 30 to 45 degrees improved touch targets without losing the star silhouette.
- **Hexagram:** a central hexagon plus six equilateral points, subdivided into
  equilateral triangles. Six triangles meeting only at the center would form a
  hexagon, not a star. Sizes 2/3/4 are available; large remains the default
  with 192 cells/20 groups.
- **Circle rings:** ring `n` has `6n` circles. The center and first ring share a
  minimum diameter. Each later ring's circle size is solved so its circles just
  fit, around the ring and against the previous ring along the spokes, with
  spacing factor `1.04` (see `ringMetrics` in `circleRingsLayout.ts`). Diameters
  grow about 1.00, 1.05, 1.07, 1.09, 1.10 times the minimum for rings 1 to 5.
  An earlier fixed growth step of `1/12` per ring (33% by ring 5) widened the gap
  between rings from 4% of a diameter at ring 1 to 27% at ring 5 and lowered
  packing density from 0.73 to 0.64. Tight sizing was chosen over faster growth:
  at the same canvas size circles render about 21% larger and every gap is even.
  This is the densest fit for 6n rings at D6 symmetry; skipping a +6 step in the
  ring counts grows faster but breaks hex adjacency and makes growth lumpy, and a
  true hex lattice cannot grow in size. Three/four/five rings are available; large
  remains the default with 91 cells/12 groups. Six was the first large size; more
  rings made the outer rings too crowded.
- **Pinwheel:** eight unequal-sided spokes with uniform 2:1 parallelogram cells,
  3 x 2, 3 x 3, or 4 x 3 steps per spoke (rows x columns). Large remains the default with
  96 cells/12 groups. Equal-sided rhombi looked like a star.
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

### Player theme versus Zen state

Dark mode and the active palette still live in Zen's reducer, because toggling
the theme remaps painted neutrals and palette changes are undoable. Shared player
UI (tinted icons, `Checkbox`, `DarkModeToggle`) and Puzzle Mode read them through
the narrow `PlayerThemeContext` in `ui/theme`, which Zen's provider supplies. Only
Zen depends on that context, not the other way around. When accounts arrive,
the theme and palette can become player preferences with their own provider
without changing those consumers.

### Design edits versus tool choices

History wraps the Zen reducer with snapshots of palette, shape, per-shape sizes,
and all board paint maps. This keeps painting, palette changes, shape/size changes, randomization, and reset
undoable without restoring old tool/view settings.

- History is one unlimited chronological timeline for the session, not a separate
  stack per board, and is not persisted. All restored boards form the initial
  baseline; undo follows subsequent edits and switches in order.
- No-op designs neither add snapshots nor clear redo. Palette reselection still
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

Save palette names rather than objects to relink to live palette data. Selected
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

A first visit always starts with the Zen tutorial palette (Harmony, falling back to the first
palette in the data) rather than a random one, so the intro is identical for everyone. Returning users get their
saved palette, so random initial selection was removed.

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
  on the smallest hexagon, whose center tile is already base color so the six-tile grid
  needs only the palette's five colors (the grid was a size-4 triangle while Zen offered every
  shape; hexagon is the first unlocked shape), then Continue reveals the app with help open. The intro
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
Duotone secondary layers use the first palette color normalized to lightness
50 in dark mode or 70 in light mode, fully opaque; single-tone icons skip tint.

**Separator dots:** the `·` character was too small to read, so admin labels separate parts
with the decorative `faDot` icon through a shared `SeparatorDot`. Because an icon cannot sit
inside a string, services such as palette usage return label parts rather than joined text, and
the screen reader hears the parts without a separator.

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
