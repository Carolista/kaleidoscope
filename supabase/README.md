# Supabase foundation

This is the initial database foundation, not an app integration. The current app
still uses its local catalogs and storage. No Supabase client dependency, key,
remote connection, image bucket, or payment integration is included.

## Apply using the Dashboard

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

Published puzzles, collections, their configuration, and the core sequence
cannot be updated/deleted even by the app admin. Row locks on configuration
changes serialize against publication of their parent. RLS admin CRUD does not
override constraints/triggers. Prepare dates and membership before publication;
the initial design also freezes a prepared puzzle/set before its future release.
If rescheduling an already-prepared set is needed, agree a narrow scheduling-only
operation in a later migration; do not disable immutability triggers.

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

- Auth flows, protected admin UI, explicit guest import, and generated TypeScript
  database types; install `@supabase/supabase-js` when wiring those.
- Structurally and geometrically validated authoring plus the expanded generator,
  rotation controls, and slot-based save/render migration.
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
