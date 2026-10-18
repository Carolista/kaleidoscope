# Supabase foundation

The admin sign-in entry point uses Supabase Auth and the generated database types.
The player app still uses its local catalogs and storage. No image bucket,
payment integration, or player progress/sync operations are included.

## Connect admin sign-in

1. Copy the root `.env.example` to `.env.local` (ignored by git).
2. In the Supabase Dashboard's project connection/API-key settings, find the
   project URL and **publishable** key (`sb_publishable_...`). Set:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

3. Restart Vite after changing environment variables.
4. Visit `/#/admin` on the local development server, or
   `/kaleidoscope/#/admin` on the deployed site. Hash routing avoids requiring
   a server-side SPA rewrite on GitHub Pages.
5. Sign in with the Auth email/password used to bootstrap your admin assignment.
   The page verifies the current account against the RLS-protected `admin_account`
   table before showing the hexagon puzzle lab. A normal account receives an
   explicit access-denied message.

Use only the publishable key. Vite embeds `VITE_` variables in browser assets;
they are not secrets, and authorization comes from RLS. Never put a secret/
service-role key, database password, or access token in these variables. The
client intentionally rejects secret keys and legacy JWT keys.

Admin login uses email/password only, with no signup, OAuth, password-reset,
guest-save import, or player progression writes. Existing sessions are restored,
and refreshed/replaced identities are rechecked. Auth storage is separate from
the design save. Sign-out affects this device, not all other sessions. Browser
storage holds a session token: sign out on shared devices.

### Admin hexagon puzzle lab

After sign-in, choose a palette from the visual Supabase swatch picker (including
drafts), choose an exact recipe, and press **Randomize puzzle** as often as you
like. Selecting another palette also recolors the current playtest without
changing its seed, layout, or placements.

| Difficulty | Board | Rotation |
| --- | --- | --- |
| Easy | Small (6 wedge tiles) | No |
| Moderate | Medium (9 wedge tiles) | No |
| Moderate | Small (6 wedge tiles) | Yes |
| Hard | Large (16 wedge tiles) | No |
| Hard | Medium (9 wedge tiles) | Yes |
| Super hard | Large (16 wedge tiles) | Yes |

Seeds are generated automatically using browser cryptographic randomness and are
not displayed or entered manually.
Already-previewed seeds are skipped per shape/exact recipe for this mounted lab
session, even when switching palettes or recipes and back. Leaving/reloading the
lab clears that history. Each randomization starts a fresh playtest.

The same seed/recipe produces the same connected pieces and target slots.
Different seeds can still produce identical designs; seed exclusion is not
visual deduplication. Size/rotation define these recipe labels; the lab does not
certify solve time, uniqueness, or human difficulty.

Use the existing drag controls or select a piece then activate a wedge tile.
In rotation recipes, click/tap a tray piece to rotate it 60 degrees (no reflection);
dragging moves it without rotating. Rotation happens only in the tray.
Double-click/double-tap an occupied board piece, or drag it back to the tray, to
return it without losing orientation. Keyboard users activate a tray piece with
Enter/Space to rotate/select, then activate a wedge tile to place; Delete/Backspace
on an occupied board tile returns its piece. There are no rotation/return buttons.
Invalid placements leave the board unchanged and show a message. **Restart**
clears only the playtest. Square tray containers keep all six orientations at
the same tile scale without changing size; selection has one subtle border.
The first-rotation player-set tutorial is planned for later.

**Refresh palettes** fetches current catalog colors. Active previews resolve
their stable palette ID and ordered color slots against that result, so corrections
update targets and pieces together without changing placement/layout. Failed reads
show an error instead of silently falling back to the local player catalog.

After generating, enter a **Puzzle name**, choose **Intended use** (Set/pack or
Daily), and press **Save draft**. Apply the draft-saving migration below first.
The save atomically creates an unpublished, unassigned puzzle and its private
authoring record; it does not save playtest placements. A successful save locks
intended use and saving until the next randomization. Name, palette, and recipe
stay available for the next generation without changing the saved puzzle. A revised
name carries into the next randomization; an unchanged saved name is cleared.
Leaving with a revised next-puzzle name warns before discarding it. Repeated clicks are
blocked while saving, and retrying an unchanged failed request reuses its ID.
Errors preserve the preview and form values.

Every randomization checks saved puzzle/authoring rows for excluded seeds keyed
by shape and exact size/rotation recipe, independent of palette or intended use.
No separate blacklist table is used. Deleting the last unused saved puzzle for a
seed/recipe removes its persistent exclusion; mounted-session preview history
still applies until leaving/reloading the lab. A failed seed read blocks
randomization with an error rather than silently ignoring saved puzzles.

Saved drafts survive reload/sign-out, but unsaved previews and playtest placements
do not. The admin workspace opens in the **Puzzle drafts** library, showing
unpublished hexagon drafts with target thumbnails, recipe/use labels, and
assignment status. Filter by Set/pack or Daily; refresh to pick up changes from
another tab. **New puzzle** opens the creation workspace; **Back to library**
returns to browsing.

Cards are not navigation links. Their square, icon-only controls provide the
shared custom selection checkbox, a blue classic Edit icon, and a red classic
Delete icon. Use **Edit** to playtest the stored definition (not a regenerated seed).
Edit its name, visual palette selection, or intended use and press **Save Changes**.
For an unassigned draft, the recipe selector and wand **Randomize puzzle** button
can preview a replacement without deleting the puzzle. Name, palette, and intended
use are retained; each randomization resets playtest placements. **Save Changes**
atomically replaces the design, recipe, seed, and private solution under the same
puzzle ID, then returns to the library. Changing the recipe selector alone does
not change the preview. Leaving without saving keeps the original stored design.
Assigned drafts must be unassigned before replacing their design; their existing
name/palette editing remains available. Apply the replacement migration below first.
Palette selection recolors without resetting playtest state. Changes remain local
until saved; leaving an unsaved workspace warns before discarding edits. Unassigned
unpublished drafts can switch intended use; assigned drafts must first be
unassigned elsewhere. **Delete draft** requires explicit confirmation and is only
available for unused drafts. The database rechecks these rules at write time,
including content that was assigned or scheduled after the library loaded.

Scheduled/live puzzles are excluded from this draft library and cannot be edited
or deleted through its RPCs. Assignment, scheduling, rewards, and publishing tools
follow separately. No player attempts, completions, reward grants, guest imports,
or Zen autosaves are written.

Select card checkboxes for **Change palette** or **Delete selected**. **Select all
shown** affects the current filter only, with a mixed state for partial selection;
changing the filter or explicitly refreshing clears selection. Bulk palette changes
use visual swatches and an explicit **Apply palette** action. Card and bulk deletion
require a confirmation listing the count and names. Assigned drafts cannot be
deleted, but can receive a palette change while unpublished. Apply the bulk-action
migration below before using gallery deletion or bulk actions.

Each bulk operation is one all-or-nothing database transaction. Missing, assigned
(for deletion), or scheduled/live puzzles reject the batch. The database rechecks
these rules even if the library view has become stale. Errors preserve selection
and the pending action; successful operations clear selection and reload the list.

The authoring model separates the version-2 slot-based public definition
(`version`, `geometry`, `target`, `pieces`) from palette/recipe metadata and private
seed, generator version, and known solution. Saving persists the full definition,
not just its seed. The legacy player POC's default easy recipe
and rendering adapter remain compatible; it is not switched to live content yet.

The lazy-loaded admin route does not initialize Supabase for normal player
visits. Missing configuration shows a setup error on the admin page without
breaking the existing Zen/Puzzle app. The UI check is not a replacement for RLS.

### Database TypeScript types

`src/types/database.ts` is generated from the hosted database using the Dashboard's
TypeScript type export, then formatted with the project's Prettier settings.
It is used by `createClient<Database>`; do not hand-edit generated table shapes.
Regenerate it after migrations that change public tables, columns, or RPCs.
Extra generated schema/type helpers
may appear in the export; application queries default to `public`.

This step needs no CLI or schema change. Deployment environment configuration is
separate from local `.env.local`; add these same public build variables to the
deployment build when admin access is ready to deploy.

## Apply using the Dashboard

For a project that already has the initial schema, use the follow-up instructions
below. Do not rerun the initial migration.

Use the new, empty **development** project, not a project containing existing
application data. No package installation is needed for these steps.

1. Open the project in the Supabase Dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy the entire contents of
   [the initial migration](./migrations/20261018000000_initial_schema.sql),
   including `begin;` and `commit;`, into the query.
4. Run it with the Dashboard's database-owner role (normally `postgres`).
   Review any error before proceeding. If the editor leaves a failed transaction
   open, run `rollback;`. Do not try to repair a failed migration by running
   individual fragments.
5. On success, verify that the 31 application tables appear in **Table Editor**.
   RLS should be enabled on every table.
6. In a separate SQL Editor query, run the complete contents of
   [the schema/RLS assertions](./tests/initial_schema.sql). They create fixtures,
   switch between simulated guest/player/admin roles, and finish with `rollback;`.
   Every assertion must report `PASS`; any failure aborts the test transaction.
   Run `rollback;` after a failed test if necessary.
7. Bootstrap your actual admin account as described below.

Run the migration **once**. It intentionally fails rather than silently skipping
objects if the schema already exists. Keep this migration unchanged after it is
applied; future database changes belong in new migration files.

The Dashboard does not automatically record this file in the Supabase CLI's
migration history. When adopting the CLI, first verify the remote schema and
mark this migration as applied through the CLI migration-history workflow.
Do not blindly push or rerun it.

The assertions are intended for this initial schema in a development project.
They insert temporary test identities into `auth.users` inside a transaction,
temporarily replace the admin assignment, and restore everything by rolling
back. They do not call Auth endpoints or test real JWT issuance, signup emails,
PostgREST schema exposure, or browser sessions. Test those during integration.

## Follow-up: edit scheduled content until release

After applying the initial migration, run
[20261018010000_prerelease_editing.sql](./migrations/20261018010000_prerelease_editing.sql)
once in a new SQL Editor query using the database-owner role. Copy the entire
file, including `begin;` and `commit;`. No credentials or application configuration
changes are needed.

Then run the entire
[pre-release lifecycle test file](./tests/prerelease_editing.sql) in a separate
query. Its fixtures and temporary admin replacement are rolled back. It should
finish with `All pre-release lifecycle assertions passed; fixtures will be rolled
back.` If a query errors, stop and run `rollback;` before continuing.

The original `initial_schema.sql` test is a historical regression test for the
initial migration **before** this follow-up. It backdates seeded catalog releases
as part of fixture setup, which the new live-release guards intentionally block.
Do not rerun that historical fixture script against an upgraded project; use the
follow-up tests instead. Local migration validation runs the original suite before
upgrading and then the lifecycle suite afterward.

The follow-up adds no tables, columns, public RPCs, or RLS permissions, so existing
generated database types remain valid. It does not add admin authoring UI or
player progress/save operations.

### Lifecycle after the follow-up

| State | Admin operations |
| --- | --- |
| Draft | Edit, assign/unassign, delete subject to references |
| Scheduled (`published_at` set, `release_at` in future) | Edit content/configuration, reschedule, cancel back to draft, or delete subject to references |
| Live (release instant reached) | Puzzle/set/core definitions and configuration are fixed; cannot reschedule, cancel, or delete |

The guards inspect the **old** release state using database wall-clock time.
Clearing publication fields or moving a live release into the future cannot
reopen it. Moving membership between collections checks both old and new parents.
Live palette color corrections remain allowed with revision/audit updates;
live palette/shape/pack release metadata cannot be reset. Palette pack membership
also freezes at release. Future daily assignments can be moved/cancelled, but
released daily assignments stay fixed.

Dependency checks cover both forward and reverse edits: a scheduled set cannot
retain a cancelled/later puzzle, a prepared puzzle cannot lose its palette,
shape, or authoring data, a prepared core cannot lose/reclassify its steps, and
prepared rewards/palette packs need their contents ready by release.

Checks run against the final transaction state. For example, to cancel a puzzle
already used by a scheduled set, also return the dependent set (and scheduled core,
if applicable) to draft **in the same transaction**. Leave the transaction
consistent and commit. An error aborts the transaction; do not treat earlier
successful statements as saved. Existing immediate publication checks still
require preparing dependencies before preparing their parents.

Catalog mutations acquire one database advisory transaction lock before row
locks. This is deliberately a simple single-editor workflow: catalog writers
serialize, but player data saves do not take this lock. Catalog edits require
the default `READ COMMITTED` isolation so checks after waiting see current
committed dependencies; stale-snapshot isolation modes are explicitly rejected.
Keep authoring transactions short and surface database failures in the portal.
The deferred global dependency checks prioritize consistency over bulk-write
throughput; revisit only if real catalog size makes authoring slow.

## Apply atomic draft saving

For projects that already applied both existing migrations:

1. Open a new Supabase **SQL Editor** query.
2. Paste the complete contents of
   [20261018020000_save_puzzle_draft.sql](./migrations/20261018020000_save_puzzle_draft.sql)
   and run once as the database owner (`postgres`). Do not rerun the initial
   schema or pre-release editing migration.
3. In another query, run
   [save_puzzle_draft.sql](./tests/save_puzzle_draft.sql) as the database owner,
   without an automatic RLS-role wrapper. It creates rollback-only fixtures and
   explicitly switches to `anon`/`authenticated` to check access. All 12 assertions
   should return `PASS`; the final `rollback` removes the fixtures.
4. In the admin lab, randomize, name a puzzle, select its intended use, and save.
   Confirm the unpublished-draft success message. Saved rows appear in the draft
   library and Dashboard Table Editor under `puzzles` and `puzzle_authoring`.

This migration adds one `save_hex_puzzle_draft` RPC, no tables or player write
permissions. It uses caller RLS plus an explicit admin check, the existing catalog
transaction lock, and one transaction for both rows. Identical retries return the
same ID; a different payload cannot overwrite an existing ID. Updated TypeScript
types include the RPC signature.

## Apply draft library editing/deletion

After the atomic draft-saving migration:

1. Run the complete
   [20261018030000_manage_puzzle_drafts.sql](./migrations/20261018030000_manage_puzzle_drafts.sql)
   once in SQL Editor as `postgres`. Do not rerun the earlier migrations.
2. Run [manage_puzzle_drafts.sql](./tests/manage_puzzle_drafts.sql) in another query
   as `postgres`, without an automatic RLS wrapper. Expect **21 PASS results**;
   its fixtures roll back.
3. Refresh the admin draft library, open a saved puzzle, change its name/palette
   or intended use, save, and reopen to verify. Use an unwanted draft to test
   deletion and its confirmation.

The migration adds `edit_puzzle_draft` and `delete_puzzle_draft` RPCs with caller
RLS, explicit admin checks, and the existing catalog lock. Metadata edits do not
rewrite definitions or private provenance. Assigned drafts cannot switch use or
be deleted, and scheduled/live content is rejected. Deletion cascades to the
private authoring row, removing that row's persistent saved-seed exclusion.
Other saved uses of the same seed/recipe and current session preview history
still exclude it.

## Apply draft design replacement

After the bulk-action migration:

1. Run the complete
   [20261018050000_replace_puzzle_draft.sql](./migrations/20261018050000_replace_puzzle_draft.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [replace_puzzle_draft.sql](./tests/replace_puzzle_draft.sql) as `postgres`,
   without an automatic RLS wrapper. Expect **18 PASS results**; fixtures roll back.
3. Open an unassigned draft, randomize a replacement, and save. Reopen it to verify
   the saved design. Also try leaving a replacement without saving to verify that
   the original remains unchanged.

The new `replace_hex_puzzle_draft` RPC uses caller RLS, an explicit admin check,
READ COMMITTED isolation, and the existing catalog lock. It rechecks existence,
hexagon shape, unpublished status, and collection/daily references at write time.
Public metadata/definition and private provenance/solution update in one transaction;
failure in either write rolls back both. The puzzle ID is never deleted/recreated.
Identical retries reapply the same content without creating a second puzzle.
Metadata-only edits still use the existing RPC, preserving assigned-draft behavior.
Replacement uses the same saved-seed exclusions as creation; its mounted editor also
excludes the original seed and any replacement seeds already previewed per recipe.
Replacing a design removes its old persistent seed exclusion unless another saved
puzzle still uses it; mounted preview history continues to exclude it until leaving.

## Apply gallery bulk actions

After the draft-library migration:

1. Run
   [20261018040000_bulk_puzzle_drafts.sql](./migrations/20261018040000_bulk_puzzle_drafts.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [bulk_puzzle_drafts.sql](./tests/bulk_puzzle_drafts.sql) as `postgres`,
   without an automatic RLS wrapper. Expect **26 PASS results**; fixtures roll back.
3. Refresh the gallery, select a few drafts, apply a palette, and verify their
   thumbnails. Test card deletion and bulk deletion only on unwanted drafts.

The `bulk_puzzle_drafts` RPC uses caller RLS, an explicit admin check, the existing
catalog lock, and per-row release/reference validation. It accepts distinct,
nonempty IDs and either `palette` (requiring a palette ID) or `delete`. Definitions,
recipes, intended uses, and private provenance are unchanged by palette updates.
Deletion cascades to private authoring, as with individual draft deletion. No
player permissions are added.

## Bootstrap the one admin

An ordinary app user cannot make themselves an admin. There is no public
bootstrap endpoint, email-based RLS exception, or editable `is_admin` metadata.

1. In **Authentication > Users**, create your own Auth user using the Dashboard's
   add/create-user action. Store the password privately; do not put it in a query,
   repository file, or chat. Use your own email and follow the Dashboard's
   confirmation options.
2. Copy that user's **UUID**, not an API key or password.
3. In SQL Editor, replace the placeholder below with that UUID and run:

   ```sql
   begin;

   insert into public.admin_account (user_id)
   values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid);

   insert into public.profiles (user_id)
   values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid)
   on conflict (user_id) do nothing;

   commit;
   ```

4. Verify from SQL Editor:

   ```sql
   select a.user_id, u.email
   from public.admin_account a
   join auth.users u on u.id = a.user_id;
   ```

There must be exactly one row, identifying your account. `admin_account` has a
singleton constraint: a second admin assignment is rejected. Admin authorization
looks up `auth.uid()` in that table, not user-editable JWT metadata.

The database owner and trusted Supabase service infrastructure can bypass RLS.
“Only my admin” means only your assigned **application account** receives full
CRUD policies. Never distribute a service-role/secret key to the browser.
Recover or transfer the admin assignment through trusted SQL Editor access.
Deleting the admin Auth user is blocked until the assignment is removed or
transferred deliberately.

## Tables and exact application access

Every table has an `admin_crud` policy for the assigned admin, allowing SELECT,
INSERT, UPDATE, and DELETE. SQL privileges alone do not authorize other signed-in
users: the additional policies below determine their access. Neither application
role receives TRUNCATE or schema-creation privileges.

“Catalog read” exposes only published, released rows and relevant memberships,
not ownership. Palette values and locked collection metadata are previewable;
knowing those values does not grant access to gated puzzle definitions.

| Table | Guest | Regular signed-in user |
| --- | --- | --- |
| `admin_account` | None | None |
| `profiles` | None | Read, create, update own row only; no delete |
| `palettes` | Catalog read | Catalog read |
| `palette_corrections` | None | None |
| `shapes` | Catalog read | Catalog read |
| `puzzle_collections` | Catalog read | Catalog read |
| `puzzles` | Initial core set and current daily definitions only | Authorized definitions only |
| `puzzle_authoring` | None | None |
| `collection_puzzles` | Released collection memberships | Same |
| `completion_routes` | Released collection routes | Same |
| `route_puzzles` | Released collection route memberships | Same |
| `core_progression` | Released core metadata | Same |
| `core_steps` | Released steps of the released core | Same |
| `reward_rules` | Released collection reward rules | Same |
| `reward_palettes` | Released rules and released target palettes | Same |
| `reward_sets` | Released rules and released target sets | Same |
| `reward_shapes` | Released rules and released target shapes | Same |
| `starter_palettes` | Released starter palette IDs | Same |
| `starter_shapes` | Released starter shape IDs | Same |
| `palette_packs` | Catalog read | Catalog read |
| `palette_pack_palettes` | Released packs and palettes | Same |
| `daily_schedule` | Global rollover time | Same |
| `daily_puzzles` | Current five-day assignments | Same |
| `puzzle_completions` | None | Read own rows only |
| `set_qualifications` | None | Read own rows only |
| `palette_grants` | None | Read own rows only |
| `shape_grants` | None | Read own rows only |
| `collection_grants` | None | Read own rows only |
| `feature_grants` | None | Read own rows only |
| `puzzle_attempts` | None | Read own rows only |
| `daily_play_sessions` | None | Read own rows only |

There are no ordinary-user write policies on progress, access grants, daily
sessions, or attempts. Those writes will use narrow server operations, not
client-supplied completion flags or direct table updates. RLS denial of an
UPDATE/DELETE can mean zero affected rows rather than an exception; callers must
check the result rather than assuming a successful HTTP response changed data.

The `private` schema holds policy helpers and triggers. Keep it out of the
Dashboard's **exposed API schemas**. Helpers use fully qualified names and fixed
search paths; privileged helpers answer access questions about the current
identity and do not accept an arbitrary user ID.

## Relationships and constraints

- **Identity:** `profiles.user_id` references Supabase `auth.users`. Passwords and
  email stay with Auth. Profiles are private for now; a public community view is
  Phase 4 work. Usernames are optional, trimmed, nonempty when present, and unique
  case-insensitively. No level/XP field exists.
- **Palettes:** stable text IDs and five ordered hex strings. Puzzle definitions
  reference zero-based color slots `0..4`, not hex values. Supabase SQL arrays are
  one-based; the first SQL element becomes JSON/TypeScript slot `0`. Exceptional
  corrections increment `revision` and record old/new values. This cannot detect
  whether a person intended a small correction or a reordering: preserve ordering
  in the authoring UI and review corrections.
- **Shapes:** IDs match the six existing geometry implementations. Database rows
  configure offerings, not new executable geometry.
- **Puzzles:** full format-version-2 definitions, separate metadata for size,
  rotation, difficulty, palette, and shape. All six agreed size/rotation recipes
  are constrained. Seeds and known solutions live in admin-only `puzzle_authoring`.
- **Definitions:** the initial format uses `geometry`, a `target` map from cell key
  to color slot, and `pieces` containing unique IDs and `tiles` with integer
  `q`/`r` offsets and `color_slot`. This prepares hexagon authoring; it is **not**
  a conversion of the current version-1 POC. Structural checks are not a solver,
  geometry validator, difficulty certification, or uniqueness guarantee.
- **Collections:** `kind` distinguishes `core`, `reward`, and `paid`. Membership
  enforces one collection per puzzle, matching shapes, and distinct positive
  positions. Daily puzzles cannot be members. `selection_mode` records fixed
  versus freely selectable order. For unauthenticated guest play the intro
  sequence is necessarily enforced locally; guests have no server progress
  identity. Do not describe that UX ordering as proof of completion.
- **Core:** one `core_progression` row and contiguous `core_steps` established
  before launch. Publishing locks the sequence. Step 1 is the guest offering.
  Later core definitions require a registered identity, the shape, and recorded
  qualification in all preceding core steps.
- **Routes:** each route requires its listed member puzzles; any completed route
  can qualify a core set. A qualification records one successful route, while
  individual completions preserve evidence for later harder-route rewards.
- **Rewards:** a rule applies to any qualifying route when `route_id` is null,
  or to that specific route otherwise. Child tables award one/multiple palettes,
  optional reward sets, or shapes. The final randomizer is represented by a
  `feature_grants` row with source `core_progression`; no hint economy is included.
- **Access:** palette/shape/collection grants preserve distinct rule sources.
  Current grant sources are `reward` and `admin`; payment-origin grants and
  revocation references will arrive with commerce, not unverified purchase flags.
  Reward and paid puzzle definitions require both a collection grant and shape
  ownership. Puzzle palette ownership is never required.
- **Starters:** initial shape availability is seeded as Hexagon only. Choose
  starter palettes explicitly; no palette is silently made free.
- **Daily:** an assignment lasts exactly 120 hours, at global absolute timestamps.
  Choose `daily_schedule.rollover_time_utc` before scheduling entries; no hour is
  silently selected. Assignments must match that time, and distinct release
  timestamps allow only one per day, so at most five are available simultaneously.
  Schedule each day to keep all five slots populated. The rollover setting is
  fixed once assignments exist.
  An authenticated session opened during availability can keep its definition
  readable after expiry until closed. Users cannot create/extend those sessions
  themselves. The server open/close operations, guest local active-session
  behavior, reload/background semantics, and late completion checks remain work.
- **Attempts:** one resumable row per account/puzzle, with a revision for future
  optimistic-concurrency saves. Completions and grants remain separate. There is
  no implemented sync RPC or conflict-selection UI yet.

## Publishing and scheduling

`published_at` means “prepared and approved,” while `release_at` is the absolute
instant it becomes publicly available. Both are null for a draft and both must
be present for prepared content. Future releases are hidden by database policies.

Author in this order:

1. Prepare/publish palettes and supported shapes.
2. Save a puzzle draft and its authoring provenance/known solution, then publish.
3. Assemble collection membership, routes, and reward rules, then publish the set.
4. Fill the complete core sequence, then publish the core progression for launch.
5. Set the global UTC rollover time, then schedule published daily definitions
   using `daily_puzzles`.

Puzzle and collection publication checks dependency release dates. Core
publication checks contiguous steps and that its sets are published by launch.
The migration does not publish incomplete example puzzles or invent content
choices.

The initial migration freezes prepared content immediately. After applying the
follow-up above, scheduled puzzles, collections, configuration, and the core
sequence remain editable until their release instant. Once live they cannot be
updated/deleted even by the app admin. RLS admin CRUD does not override database
constraints/triggers; never disable the guards to work around a dependency error.

Palette corrections are the deliberate exception: all rendering resolves the
latest synchronized palette using stable slots. Already exported raster files
cannot update retrospectively. Palette cache invalidation, slot-based POC/save
migration, and rendering consistency are application work, not performed here.

## Seeded data

- Six supported shapes, with released catalog metadata.
- Hexagon as the sole starter shape.
- All 19 current palettes copied exactly from the app catalog, as **drafts**.
- No starter palettes, puzzles, sets, daily schedule setting, purchases, admin assignment,
  or player data.

The app continues behaving exactly as before until intentionally integrated.

## Still required before player integration

- Player Auth/registration flows, explicit guest import, and the rest of the admin
  authoring workspace. Admin sign-in, generated types, and six-recipe isolated
  playtesting are available; atomic draft saving/library, starter selection,
  set/routes/core/reward/release tools are still pending.
- Server-side structural/geometric authoring validation and slot-based saved-content
  integration into player mode. The admin engine and palette-slot rendering adapter
  exist; the player POC remains local. Regenerate types when public schema changes.
- Atomic completion validation, route evaluation, and idempotent grants; never
  accept a client assertion of qualification as sufficient evidence.
- Concurrency-safe attempt save/conflict resolution, plus daily session
  open/close/complete operations. Do not simply add owner-write table policies.
- Offline unlock policy, active daily-session lifecycle/expiry verification, and
  shared-device import/sync flows.
- Account deletion/export handling, production Auth configuration, and API-level
  integration tests in the hosted development project.
- Commerce, provider-specific prices and transaction records, and verified
  payment fulfillment later. Cloud image/design collections wait until Phase 4.
