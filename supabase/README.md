# Supabase foundation

The admin sign-in entry point uses Supabase Auth and the generated database types.
The player app reads released content (core palettes, core puzzle sets, shape order) as a guest through a
separate client that keeps no session; see CONTEXT.md, Player content. Guests cannot read `puzzle_authoring`.
No image bucket, payment integration, or player progress/sync operations are included.

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
   table before showing the puzzle lab. A normal account receives an
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

### Admin puzzle lab

After sign-in, choose a palette from the visual Supabase swatch picker (including
drafts), choose any of the six shapes and an exact recipe, and press
**Randomize puzzle** as often as you like. A puzzle's shape is fixed once saved. Selecting another palette also recolors the current playtest without
changing its seed, layout, or placements.

| Difficulty | Board | Rotation |
| --- | --- | --- |
| Easy | Small | No |
| Moderate | Medium | No |
| Moderate | Small | Yes |
| Hard | Large | No |
| Hard | Medium | Yes |
| Challenging | Large | Yes |

| Shape | Small | Medium | Large | Rotation step |
| --- | --- | --- | --- | --- |
| Hexagon | 6 wedge tiles | 9 | 16 | 60° |
| Triangle | 5 wedge tiles | 12 | 22 | 60° (flips each tile up/down) |
| Diamond star | 6 | 10 | 15 | 180° |
| Hexagram | 6 | 12 | 20 | 60° (flips each tile up/down) |
| Circle rings | 6 | 9 | 16 | 60° |
| Pinwheel | 4 | 6 | 9 | 180° |

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
Invalid placements leave the board unchanged; playtest feedback is announced to
screen readers only. **Restart** (beside the pieces) clears only the playtest. Square tray containers keep all six orientations at
the same tile scale without changing size; selection has one subtle border.
The first-rotation player-set tutorial is planned for later.

**Refresh palettes** fetches current catalog colors. Active previews resolve
their stable palette ID and ordered color slots against that result, so corrections
update targets and pieces together without changing placement/layout. Failed reads
show an error instead of silently falling back to a bundled palette list (the player app no longer has one).

After generating, enter a **Puzzle name** and press **Save draft**. Apply the
draft-saving migration below first. The save atomically creates an unpublished,
unassigned puzzle and its private authoring record, with its palette stored on the
puzzle; it does not save playtest placements. A successful save locks saving until
the next randomization. Name, palette, and recipe
stay available for the next generation without changing the saved puzzle. A revised
name carries into the next randomization; an unchanged saved name is cleared.
Leaving with a revised next-puzzle name warns before discarding it. Repeated clicks are
blocked while saving, and retrying an unchanged failed request reuses its ID.
Errors preserve the preview and form values.

Every randomization checks saved puzzle/authoring rows for excluded seeds keyed
by shape and exact size/rotation recipe, independent of palette.
No separate blacklist table is used. Deleting the last unused saved puzzle for a
seed/recipe removes its persistent exclusion; mounted-session preview history
still applies until leaving/reloading the lab. A failed seed read blocks
randomization with an error rather than silently ignoring saved puzzles.

Saved drafts survive reload/sign-out, but unsaved previews and playtest placements
do not. The admin workspace opens in the **Puzzle drafts** library, showing
unpublished drafts of every shape with target thumbnails, shape/recipe labels, and
group assignment. Filter by shape and track (and, in the Assigned view, purpose and group);
refresh to pick up changes from another tab. **New puzzle** opens the creation workspace; choosing the **Drafts** tab
returns to browsing (with the usual unsaved-changes prompt).

Cards are not navigation links. Each shows a centered thumbnail and details,
with a bottom row holding the custom selection checkbox at left and square
icon-only actions at right: a blue classic Edit icon and, only for unassigned
drafts, a red classic Delete icon. Selected cards are highlighted blue. Use **Edit** to playtest the stored definition (not a regenerated seed).
Edit its name or visual palette selection and press **Save Changes**.
For an unassigned draft, the recipe selector and wand **Randomize puzzle** button
can preview a replacement without deleting the puzzle. Name and palette
are retained; each randomization resets playtest placements. **Save Changes**
atomically replaces the design, recipe, seed, and private solution under the same
puzzle ID, then returns to the library. Changing the recipe selector alone does
not change the preview. Leaving without saving keeps the original stored design.
Assigned drafts can also replace their design (including scheduled ones, until release),
but the new recipe must fit the group's track (basic or rotation). Apply the replacement migration below first.
Palette selection recolors without resetting playtest state. Changes remain local
until saved; leaving an unsaved workspace warns before discarding edits.
**Delete draft** requires explicit confirmation and is only available for unassigned drafts. The database rechecks these rules at write time,
including content that was assigned or scheduled after the library loaded.

Scheduled/live puzzles are excluded from this draft library and cannot be edited
or deleted through its RPCs. Draft group assembly is available under **Puzzles > Groups**:
create a named group with a purpose (Undecided, Core, Reward, Daily, or Pack), a shape
(not for Daily, which mixes shapes), and a track (Basic or Rotation for Core and Reward; also
Mixed for Pack; none for Undecided and Daily), then use
**Puzzles > Puzzles** gallery selection and **Assign to group** to append unassigned drafts that
the group accepts (matching shape and track).
No puzzle count is enforced; 12, 18, or other counts remain possible. Cards show
the assigned group's purpose and name (unassigned puzzles show Unassigned). In the group workspace, edit
the name, purpose, shape, and track (the database rejects a change the members violate),
drag members into a new order, or remove them without deleting their saved designs.
Each member shows its saved target thumbnail beside its name and drag handle
(keyboard: Up/Down/Home/End on a focused handle); the square-minus icon removes it
from the group only. One blue **Save** beside the name writes the details and staged order together;
removal saves immediately. Unsaved edits and staged order are guarded on exit.
Group lists filter by purpose, shape, and track.
Draft groups use landscape cards: the first ordered member's saved-design thumbnail
spans the left column, with name, purpose, shape, track, and member count aligned
top right and square Edit/Delete icons at the bottom right. Empty groups show a placeholder. Thumbnails
resolve current Supabase palette colors without regenerating designs.
The large **New group** plus opens creation. Deleting a group requires confirmation
and unassigns its puzzles without deleting their designs or private solutions.
Pricing/shop products, selection rules, scheduling, and publishing tools follow
separately (shape order and rewards are under **Progression**).
No player attempts, completions, reward grants, guest imports,
or Zen autosaves are written.

Select card checkboxes for **Change palette** or **Delete selected** (shown only
when every selected draft is unassigned). **Show group** narrows the gallery to one
group's members. **Select all** affects the current filters only, with a mixed state for partial selection;
changing a filter or explicitly refreshing clears selection. Bulk palette changes
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

### Admin palette library

Open **Palettes > Palettes** in the admin navigation. The catalog reads all
Supabase palettes with pagination; the original 19 already exist as drafts from
the initial migration. Zen still uses its local array and is unchanged.

- **New palette** starts with a blank name and the first catalog palette's colors
  (white slots if empty). **Duplicate** starts with a blank name and the selected
  palette's ordered colors. It creates a new record, not a reference or copy of
  release state, rewards, pack membership, or grants.
- **Edit** changes a draft name and its five ordered six-digit hex colors using
  text fields or native color inputs. Duplicate colors are valid. The three
  field columns have equal widths.
- The **Sandbox** uses a medium hexagon and a local **Randomize** button: each
  palette slot has a 20% chance, with no base color. It is not puzzle generation
  and does not permit painting. Color/name/theme edits do not rerandomize it.
  Invalid hex text remains visible and blocks saving/preview until corrected.
- **Usage** reads stored puzzle target slots for thumbnails, group context,
  reward and palette group references, and grant/correction counts. It does not load
  private solutions or account identities. Refresh usage explicitly if needed.
- **Delete** requires confirmation naming the palette and no saved references.
  Failure to load usage disables deletion; write-time database checks remain
  authoritative if the view becomes stale.
- **Delete selected** appears in the selection bar only when every checked palette
  is an unassigned draft (in no palette group and unreferenced). It confirms the
  names and deletes them in one all-or-nothing request; apply the
  [bulk palette deletion migration](#apply-bulk-palette-deletion) first.
- Scheduled/live palettes are read-only here, but can be duplicated. Palettes are
  released and returned to draft with the groups that use them (see
  [Apply the release tools](#apply-the-release-tools)); exceptional published color
  corrections are a separate later tool.

Save returns to the palette library and refreshes it, along with the cached
catalog used by puzzle authoring selectors and group previews; saved puzzle
definitions, seeds, and solutions do not change. Unsaved edits are guarded on tab changes, sign-out, route exit, and reload.
Failed writes preserve inputs; a conflict requires refreshing/reviewing the
catalog rather than silently replacing newer data.

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

## Palette draft management migration

After applying the preceding migrations through
[draft-set deletion](./migrations/20261018070000_delete_draft_set.sql), run
[20261018080000_manage_palette_drafts.sql](./migrations/20261018080000_manage_palette_drafts.sql)
once in the Dashboard SQL Editor as database owner, including its transaction.
Then run [the palette assertions](./tests/manage_palette_drafts.sql) separately.
All 54 assertions must pass; fixtures roll back. On error, stop and run
`rollback;` before continuing. Do not rerun migrations already applied.

This adds `manage_palette_draft` for create/update/delete only, with caller RLS,
an explicit admin check, READ COMMITTED isolation, and the shared catalog lock.
Updates/deletes compare the loaded name, colors, and revision; name-only edits
are protected even though only color changes increment revision. Identical
create/update retries confirm the expected result without duplicating records or
incrementing revisions again. Missing records and stale content fail explicitly.
Scheduled/live palettes are rejected by this draft-only RPC.

Deletion rejects references from puzzles, starters, reward mappings, palette packs,
grants, or correction history; nothing is silently detached. Existing constraints
validate names and exactly five ordered hex colors. The RPC never accepts release
metadata or a new revision from the client. It adds no player write permissions.
The hosted migration and rollback-only assertions have been confirmed successful
by the owner.

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

## Apply draft set assembly

After the design-replacement migration:

1. Run the complete
   [20261018060000_assemble_puzzle_sets.sql](./migrations/20261018060000_assemble_puzzle_sets.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [assemble_puzzle_sets.sql](./tests/assemble_puzzle_sets.sql) as `postgres`,
   without an automatic RLS wrapper. Expect **36 PASS results**; fixtures roll back.
3. Open **Puzzles > Sets**, create a set, switch to **Puzzles > Puzzles**, select
   unassigned Set/pack drafts, and use **Assign to set**. Open the set to check
   membership, rename and drag to reorder, then **Save**, and remove a puzzle. Confirm removal leaves the puzzle in the
   gallery and restores its unassigned edit/replacement/deletion controls.

The `manage_draft_set` RPC creates/renames draft hexagon sets or atomically appends,
removes, and reorders memberships under caller RLS, explicit admin authorization,
READ COMMITTED isolation, and the catalog lock. Set roles use the existing
Core/Reward/Paid schema; no tables or fixed-size constraints are added. Selection
mode retains its existing `any` default; catalog ordering does not enforce a player
completion order. Price/product and route configuration are not changed here.

Only unpublished sets are managed. Appending requires unassigned, unpublished,
same-shape Set/pack puzzles; daily drafts are ineligible. Puzzle membership remains
exclusive across sets. Stale or invalid IDs and write failures reject the whole
batch. Removal refuses prepared puzzles or qualifying-route dependencies rather
than silently deleting references. Reordering preserves existing routes and
requires the exact current membership; removals compact positions without deleting
puzzles or authoring records. Set and membership reads paginate rather than
silently truncating after 1000 rows.

## Apply draft set deletion

After the set-assembly migration:

1. Run the complete
   [20261018070000_delete_draft_set.sql](./migrations/20261018070000_delete_draft_set.sql)
   once as `postgres`. Do not rerun earlier migrations.
2. Run [delete_draft_set.sql](./tests/delete_draft_set.sql) as `postgres`, without
   an automatic RLS wrapper. Expect **15 PASS results**; fixtures roll back.
3. In **Puzzles > Sets**, use a card's trash icon. Cancel first to verify no change;
   then confirm deletion of an expendable set. The cached puzzle drafts reload
   assignments: all former members remain available as unassigned puzzles.

`delete_draft_set` requires admin authorization and caller RLS, READ COMMITTED
isolation, and the catalog lock. It atomically removes memberships and the set
only; all puzzle/authoring rows remain intact. Scheduled/live sets, prepared member
puzzles, progression steps, qualifying routes, reward rules/targets, qualifications,
and grants block deletion. Meaningful dependent configuration is not silently
cascaded away. Failures retain the UI confirmation for retry.

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

## Apply bulk palette deletion

After the palette draft management migration:

1. Run
   [20261019010000_bulk_delete_palette_drafts.sql](./migrations/20261019010000_bulk_delete_palette_drafts.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [bulk_delete_palette_drafts.sql](./tests/bulk_delete_palette_drafts.sql) as
   `postgres`, without an automatic RLS wrapper. Expect **14 PASS results**;
   fixtures roll back.

`bulk_delete_palette_drafts(p_ids)` uses caller RLS, an explicit admin check,
READ COMMITTED isolation, and the shared catalog lock. It accepts distinct,
nonempty IDs and locks rows in ID order. Missing palettes, scheduled/live
palettes, palette-set membership, or references from puzzles, starters, reward
mappings, grants, or correction history reject the whole batch. Unlike single
draft deletion, set membership is never removed silently. It returns the deleted
IDs, which the client verifies. The hosted migration and assertions have been
confirmed successful by the owner.

## Apply pre-release puzzle editing

After the bulk palette deletion migration:

1. Run
   [20261019020000_edit_prerelease_puzzles.sql](./migrations/20261019020000_edit_prerelease_puzzles.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [edit_prerelease_puzzles.sql](./tests/edit_prerelease_puzzles.sql) as
   `postgres`, without an automatic RLS wrapper. Expect **13 PASS results**;
   fixtures roll back.

`replace_hex_puzzle_draft` and `edit_puzzle_draft` now reject only live puzzles
(published with `release_at` passed), so assigned and scheduled puzzles can be
renamed, repaletted, and regenerated until release. Set membership, daily
assignments, and release schedules are preserved; assigned puzzles still cannot
change intended use, and deletion remains limited to unassigned drafts. Deferred
release-dependency checks still apply. After this migration, the older
[replace_puzzle_draft.sql](./tests/replace_puzzle_draft.sql) cases for assigned and
scheduled replacement, and the scheduled-edit case in
[manage_puzzle_drafts.sql](./tests/manage_puzzle_drafts.sql), are superseded and
expected to fail. The hosted migration and assertions have been confirmed
successful by the owner.

## Apply shape-neutral puzzle authoring

After the pre-release puzzle editing migration:

1. Run
   [20261019030000_shape_neutral_puzzle_authoring.sql](./migrations/20261019030000_shape_neutral_puzzle_authoring.sql)
   once in SQL Editor as `postgres`. Do not rerun earlier migrations.
2. Run [shape_neutral_puzzle_authoring.sql](./tests/shape_neutral_puzzle_authoring.sql)
   as `postgres`, without an automatic RLS wrapper. Expect **23 PASS results**;
   fixtures (including their own draft palette) roll back.
3. Regenerate the database types, then deploy the app. The previously deployed
   admin cannot save or replace puzzles between steps 1 and 3.

`save_hex_puzzle_draft` and `replace_hex_puzzle_draft` are replaced by
`save_puzzle_draft` and `replace_puzzle_draft`, which take `p_shape_id`.
`manage_draft_set` gains `p_shape_id`, required on create and rejected for other
actions. Any shape in the `shapes` table is accepted, so later puzzle shapes need
no migration; the app decides which shapes it can author. Replacement rejects a
shape change, and set assembly still requires members to match the set's shape.
Generator versions are `hexagon-v2` and `<shape>-v1` for the other five shapes
(`triangle`, `diamondStar`, `hexagram`, `circleRings`, `pinwheel`).

The earlier suites that call the removed function names
([save_puzzle_draft.sql](./tests/save_puzzle_draft.sql),
[replace_puzzle_draft.sql](./tests/replace_puzzle_draft.sql),
[manage_puzzle_drafts.sql](./tests/manage_puzzle_drafts.sql),
[bulk_puzzle_drafts.sql](./tests/bulk_puzzle_drafts.sql),
[assemble_puzzle_sets.sql](./tests/assemble_puzzle_sets.sql),
[delete_draft_set.sql](./tests/delete_draft_set.sql), and
[edit_prerelease_puzzles.sql](./tests/edit_prerelease_puzzles.sql)) are superseded
after this migration. Before release, they were also run against it with local
wrappers for the old names and kept their original pass counts. The hosted
migration and assertions have been confirmed successful by the owner.

## Apply groups and purposes

After the shape-neutral puzzle authoring migration:

1. Run
   [20261020000000_groups_and_purpose.sql](./migrations/20261020000000_groups_and_purpose.sql)
   once in SQL Editor as `postgres`. It runs in one transaction and preserves data.
   Do not rerun earlier migrations.
2. Run [groups_and_purpose.sql](./tests/groups_and_purpose.sql) as `postgres`, without
   an automatic RLS wrapper. Expect **76 PASS results**; fixtures roll back.
3. Regenerate the database types (`src/lib/supabase/database.ts`), then deploy the app.
   The previously deployed admin cannot manage groups between steps 1 and 3. The types
   currently in the repository were updated by hand to match this migration, so
   regenerating should produce no functional change.

A **group** is any ordered collection of puzzles or palettes; its **purpose** says how it
is used (core, reward, daily, pack, or undecided). The migration:

- Renames `puzzle_collections` to `puzzle_groups` (`kind` becomes `purpose`, `paid`
  becomes `pack`, plus `undecided`, `daily`, and a new `track`), `collection_puzzles`
  to `puzzle_group_members`, `palette_packs` to `palette_groups`,
  `palette_pack_palettes` to `palette_group_members`, `reward_sets` to
  `reward_puzzle_groups`, and `collection_grants` to `puzzle_group_grants`.
- Derives each existing core/reward group's track from its puzzles (all without rotation:
  basic; all with rotation: rotation). Groups that were empty or mixed become undecided;
  pack groups become basic, rotation, or mixed.
- Drops `puzzles.usage`. Puzzles that were meant for the daily feature move into a new
  "Daily drafts" daily group. `puzzles.palette_id` is unchanged and stays required.
- Drops the routes, route puzzles, set qualifications, core progression and steps,
  `reward_shapes`, and the starter tables. It adds `shape_progression` (default order
  Hexagon, Triangle, Diamond Star, Hexagram, Circle Rings, Pinwheel) and
  `group_completions`.
- Replaces `manage_draft_set`/`delete_draft_set` with `manage_puzzle_group` (create, update,
  delete, append, remove, reorder), `manage_palette_set` with `manage_palette_group`, and
  drops the intended-use argument from `save_puzzle_draft`, `replace_puzzle_draft`, and
  `edit_puzzle_draft`.

Rules enforced by the database:

- Puzzle group `purpose` is `undecided`, `core`, `reward`, `daily`, or `pack`; palette
  groups have no `daily`. Only daily groups have no shape. Core and reward groups have a
  `basic` or `rotation` track, packs may also be `mixed`, and undecided and daily groups
  have none. Members must match the shape (except daily) and track, including when a
  member's recipe is replaced. Undecided groups cannot be published.
- Shape access: the first `shape_progression` shape is open to everyone; a later shape
  opens once the account has a `group_completions` row for a core group of the previous
  shape (or an admin grant). Core groups are playable with the shape; reward and pack
  groups also need a group grant.
- A daily assignment requires a published puzzle that belongs to a daily group.

Older SQL suites target the schema at the time of their migration; run each one right
after its own migration, not after this one. A local harness that applies the
migrations to PGlite and then runs the new suite is a convenient pre-flight check.

## Apply progression tools

After the groups and purposes migration:

1. Run
   [20261021000000_progression_tools.sql](./migrations/20261021000000_progression_tools.sql)
   once in SQL Editor as `postgres`. It stops with a clear message, changing nothing, if a
   shape already has two core groups on the same track; change all but one to another
   purpose (Puzzles > Groups) and run it again.
2. Run [progression_tools.sql](./tests/progression_tools.sql) as `postgres`, without an
   automatic RLS wrapper. Expect **43 PASS results**; fixtures roll back.
3. Regenerate the database types, then deploy the app. The types in the repository were
   updated by hand to match, so regenerating should change nothing functional.

This adds a unique rule of one `core` puzzle group per shape and track (with a friendlier
error from a trigger), one reward rule per group, `manage_shape_progression` (reorder all
shapes in one transaction), and `manage_group_reward` (replaced by the slots migration below; it replaced a group's palettes and bonus
groups in one transaction; palettes must be in a palette group with the reward purpose, and
bonus groups must be reward groups). A trigger on `shape_progression` rejects any change once a
core group is published.

The previous suite ([groups_and_purpose.sql](./tests/groups_and_purpose.sql)) belongs to the
migration before this one: run it before applying this migration, not after, because its
fixtures create core groups that the new rule rejects.

## Apply progression slots

After the progression tools migration:

1. Run
   [20261022000000_progression_slots.sql](./migrations/20261022000000_progression_slots.sql)
   once in SQL Editor as `postgres`. It stops with a clear message, changing nothing, if a shape
   already has two reward groups on the same track; change all but one to another purpose
   (Puzzles > Groups) and run it again.
2. Run [progression_slots.sql](./tests/progression_slots.sql) as `postgres`, without an automatic RLS
   wrapper. Expect **35 PASS results**; fixtures roll back (existing core and reward groups are set aside
   inside the test transaction only).
3. Regenerate the database types, then deploy the app.

Each shape has four slots: a basic and a rotation core group, and a basic and a rotation bonus
(reward) group. This migration:

- Allows at most one `reward` puzzle group per shape and track, like core groups (the friendlier
  error comes from the same trigger).
- Links the bonus groups of a shape to its rotation core group automatically: a trigger on
  `puzzle_groups` keeps `reward_puzzle_groups` equal to the shape's reward groups, and the
  migration rebuilds those links once for existing data (hand-picked links are replaced). The
  [basic bonus unlock](#apply-the-basic-bonus-unlock) below also links the basic bonus group to the
  basic core group.
- Replaces `manage_group_reward` with `manage_progression_slot(shape, purpose, track, group, palettes)`,
  which atomically fills a slot with a group (setting its purpose, shape, and track), turns the
  previous occupant into an Undecided group with no reward, and sets the one reward palette
  (which must be in a reward palette group). A null group empties the slot. Published groups are
  rejected, and a group that already fills another slot must be emptied there first.
- A group with automatic links (a core group with bonus links, or a bonus group) is changed through its
  slot; deleting it or changing its purpose in Puzzles > Groups is refused until the slot is emptied.

The earlier suites belong to their own migrations: run
[groups_and_purpose.sql](./tests/groups_and_purpose.sql) and
[progression_tools.sql](./tests/progression_tools.sql) right after their migrations, not after
this one (`progression_tools.sql` calls the removed `manage_group_reward`).

## Apply the basic bonus unlock

After the progression slots migration:

1. Run
   [20261022010000_basic_bonus_unlock.sql](./migrations/20261022010000_basic_bonus_unlock.sql)
   once in SQL Editor as `postgres`.
2. Run [basic_bonus_unlock.sql](./tests/basic_bonus_unlock.sql) as `postgres`, without an
   automatic RLS wrapper. Expect **8 PASS results**; fixtures roll back.
   [progression_slots.sql](./tests/progression_slots.sql) still passes (35) after this migration.

No types change. The bonus links now follow both core groups: the basic core group links the
shape's basic bonus group, and the rotation core group still links both bonus groups. The
migration replaces `private.sync_bonus_groups` (the trigger keeps calling it) and rebuilds the
links once for existing data, so unpublished basic core groups gain their link right away.
Published or scheduled core groups keep the links they had.

## Apply the release tools

After the basic bonus unlock, run these three migrations in order, each once in SQL Editor as `postgres`,
then the test:

1. [20261022020000_release_tools.sql](./migrations/20261022020000_release_tools.sql) adds
   `preview_release(action, kind, id, release_at)` and `apply_release(...)`.
2. [20261022030000_release_packages.sql](./migrations/20261022030000_release_packages.sql) adds the
   `shape_package` kind and refuses core and bonus groups as standalone releases.
3. [20261022040000_release_palette_cleanup.sql](./migrations/20261022040000_release_palette_cleanup.sql)
   makes cancelling return unneeded palettes to draft and removes the single-palette cancel.
4. Run [release_tools.sql](./tests/release_tools.sql) as `postgres`, without an automatic RLS wrapper. It tests
   the final behavior, so run it after all three migrations. Expect **37 PASS results**; fixtures roll back.
   [progression_slots.sql](./tests/progression_slots.sql) (35) and
   [basic_bonus_unlock.sql](./tests/basic_bonus_unlock.sql) (8) still pass afterward.

No tables or columns change. Both functions are admin-only (`security invoker`, rechecked with `is_admin()`);
`apply_release` also needs READ COMMITTED and takes the catalog lock. The generated types gain the two functions
(hand-added in the repository; regenerating should change nothing functional).

- **Kinds.** `shape_package` (id is the shape id: its four core and bonus groups), `puzzle_group` (daily, pack, and
  undecided groups; core and bonus groups in a slot are blocked), and `palette_group`. Actions are `schedule`
  (a null time means now) and `cancel`.
- **Plan.** The result is JSON: the request, the main item's state, the release time, `items` (each palette,
  puzzle, group, or palette group with its state, what happens to it: `release`, `earlier`, `reschedule`, `keep`,
  `live`, or `cancel`, and its previous and new times), `blockers`, and `warnings`. `apply_release` raises if any
  blocker remains and otherwise updates the items in dependency order (palettes, puzzles, bonus groups, groups).
- **Scheduling** sets every item that is not live to the release time, except a dependency already scheduled
  earlier, which keeps its time (one scheduled later is pulled earlier). Palettes come from the group's puzzles and
  reward rules, never from pack palette groups.
- **Cancelling** returns the group, its scheduled puzzles, and palettes nothing else scheduled uses to draft; a
  package cancels all four groups. Live items and puzzles on the daily schedule block it.
- The hard rules are 24 puzzles per core and bonus puzzle group, 6 palettes per core and reward palette group,
  a reward palette for each core and bonus group, and all four slots filled for a package.

## Apply guest bonus groups

After the release tools:

1. Run [20261023000000_guest_bonus_groups.sql](./migrations/20261023000000_guest_bonus_groups.sql) once in SQL
   Editor as `postgres`.
2. Run [guest_bonus_groups.sql](./tests/guest_bonus_groups.sql) as `postgres`, without an automatic RLS wrapper.
   Expect **6 PASS results**; fixtures roll back. Released content already fills the bonus slots, so the test inserts its
   own groups with the slot index and guard triggers set aside inside the transaction.

No tables, columns, or types change. The migration replaces `private.can_play_puzzle_group` so a guest (no signed-in
user) can read a released reward (bonus) group of the first shape, as they already could a core group. Signed-in players
still need a `puzzle_group_grants` row, packs are unchanged, and `has_shape` still limits guests to the first shape.
The app derives the guest's earned rewards from solved puzzles on the device.

## Player accounts and auth email

Players create accounts in the app (email, password, first name); no database change is involved. Supabase Auth owns the users, the first
name is stored as `first_name` in the user metadata, and no `profiles` row is created yet. The player client uses the PKCE flow and its own storage key
(`kaleidoscope-player-auth`), separate from the admin's.

Dashboard settings:

1. **Authentication > URL Configuration:** add the site URL (`http://localhost:5173/` for development and the deployed
   `/kaleidoscope/` address) to the redirect allow-list. Confirmation and reset links return there.
2. **Authentication > Sign In / Providers > Email:** "Confirm email" may be on or off; the app handles both. Password length minimum should not be above 8.
3. **Authentication > SMTP Settings:** set custom SMTP (sender `noreply@` on your domain, name "Kaleidoscope"). Templates cannot be edited without it. The
   project uses Resend: verify the domain, then use the host, port (465 or 587), and credentials it gives. Never commit the SMTP password.
   If signup then takes about 30 seconds and returns a 504, Supabase cannot reach the SMTP server; check **Logs > Auth**, the host and port, and the credentials.
   Microsoft 365 SMTP is not suitable (see DECISIONS.md, Accounts).
4. **Authentication > Emails > Templates:** paste in [confirm-signup.html](./email-templates/confirm-signup.html) (subject
   `Confirm your Kaleidoscope account`) and [reset-password.html](./email-templates/reset-password.html) (subject `Reset your Kaleidoscope password`).
   The logo is loaded from the deployed site. They deliberately contain no player-supplied text.
5. **Authentication > Rate Limits:** with custom SMTP the email limit is adjustable; keep a sensible limit.

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
| `puzzle_groups` | Catalog read | Catalog read |
| `puzzles` | Initial core set and current daily definitions only | Authorized definitions only |
| `puzzle_authoring` | None | None |
| `puzzle_group_members` | Released group memberships | Same |
| `shape_progression` | Order of released shapes | Same |
| `reward_rules` | Released group reward rules | Same |
| `reward_palettes` | Released rules and released target palettes | Same |
| `reward_puzzle_groups` | Released rules and released target groups | Same |
| `palette_groups` | Catalog read | Catalog read |
| `palette_group_members` | Released groups and palettes | Same |
| `daily_schedule` | Global rollover time | Same |
| `daily_puzzles` | Current five-day assignments | Same |
| `puzzle_completions` | None | Read own rows only |
| `group_completions` | None | Read own rows only |
| `palette_grants` | None | Read own rows only |
| `shape_grants` | None | Read own rows only |
| `puzzle_group_grants` | None | Read own rows only |
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
  `q`/`r` offsets and `color_slot`. Hexagon definitions use `geometry.radius` and
  axial cell coordinates; the other shapes use `geometry.size` (pinwheel: tiles
  per spoke). Triangle and hexagram tiles use 3x-scaled axial centroid
  coordinates, circle rings use the hex cell at the same ring position, and
  diamond star and pinwheel use (row, col) within the top point or spoke. This format is **not**
  a conversion of the current version-1 POC. Structural checks are not a solver,
  geometry validator, difficulty certification, or uniqueness guarantee.
- **Groups:** `puzzle_groups.purpose` distinguishes `undecided`, `core`, `reward`, `daily`, and
  `pack`; `track` is `basic`, `rotation`, or `mixed`. Membership enforces one group
  per puzzle, distinct positive positions, and the group's shape (except daily) and
  track. A daily group has no shape, so it can mix shapes. `selection_mode` records fixed
  versus freely selectable order. For unauthenticated guest play the intro
  sequence is necessarily enforced locally; guests have no server progress
  identity. Do not describe that UX ordering as proof of completion.
  A puzzle stores its own `palette_id`; the store will look up which palette
  groups sell it, and puzzle completion never grants a palette.
- **Progression:** `shape_progression` orders the shapes (position 1 is the starter).
  Each shape has two core groups, basic and rotation; completing either (every
  puzzle solved, recorded in `group_completions`) opens the next shape.
- **Rewards:** a `reward_rules` row applies when its group is completed. Child tables
  award exact palettes and/or bonus puzzle groups (which must have the `reward`
  purpose). The intended pattern per shape is: basic core awards one palette plus
  the basic bonus group, rotation core awards one palette plus both bonus groups
  (basic and rotation), and each bonus awards one palette. The rules stay flexible; a later admin screen
  will check them. The final randomizer is a `feature_grants` row with source
  `progression`, earned after all core and bonus groups; no hint economy is included.
- **Access:** palette/shape/group grants preserve distinct rule sources.
  Current grant sources are `reward` and `admin`; payment-origin grants and
  revocation references will arrive with commerce, not unverified purchase flags.
  Reward and pack puzzle definitions require both a group grant and shape
  ownership. Puzzle palette ownership is never required.
- **Starters:** the first progression shape is the starter. Starter palettes are
  the members of core palette groups; no palette is silently made free.
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

1. Save puzzle drafts with their authoring provenance and known solutions, and palettes.
2. Assemble group membership, reward rules, and the progression slots.
3. Release each shape's package (or other groups) with the release tools; they release the palettes and
   puzzles a group needs along with it (see [Apply the release tools](#apply-the-release-tools)).
4. Set the global UTC rollover time, then schedule puzzles from daily groups using `daily_puzzles`.

Puzzle and group publication checks dependency release dates, and groups need a purpose other than undecided.
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
- The default shape progression, with Hexagon first (the only starter shape).
- All 19 current palettes copied exactly from the app catalog, as **drafts**.
- No starter palettes, puzzles, groups, daily schedule setting, purchases, admin assignment,
  or player data.

The app continues behaving exactly as before until intentionally integrated.

## Still required before player integration

- Explicit guest import and storing progress per account, and the rest of the admin
  authoring workspace. Player sign-up, sign-in, and password reset are built (see
  [Player accounts and auth email](#player-accounts-and-auth-email)). Admin sign-in, generated types, and six-recipe isolated
  playtesting, atomic draft saving/library, draft group assembly/deletion,
  draft palette management, and the progression and reward screens are available; the
  release tools remain pending.
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
