# Kaleidoscope: Roadmap

The single place to see where the project is going and what comes next.
Consolidated on 2026-10-19 from the earlier Copilot session plans. Those plans
are now historical; update this file instead.

- **Current behavior and standards:** [CONTEXT.md](./CONTEXT.md)
- **Why things are the way they are:** [DECISIONS.md](./DECISIONS.md)
- **Database setup, migrations, and SQL tests:** [supabase/README.md](./supabase/README.md)
- **Original phase descriptions:** [BACKLOG.md](./BACKLOG.md)

Status key: ✅ done · 👀 ready for review · 🔜 next · ⬜ not started · ❓ needs a decision


---

## Where we are now

**Phase 2A: connecting the player app to released content** (branch `62-admin-can-schedule-and-publish-assets` merged; player work in progress).

Supabase is set up and hosted, the admin can sign in, and the admin can generate,
save, organize, and release puzzles in all six shapes, and palettes. The 2A content is
authored and the Hexagon core and bonus puzzle groups and the two Zen core palette
groups are released. The player app now reads released content as a guest: the app opens on
a Home screen (greeting, then Puzzle and Zen cards), Puzzle Mode lists the released core sets and plays their puzzles, Zen offers
Hexagon and the released core palettes, and guests earn the Hexagon bonus sets and reward
palettes locally by completing sets. Players can create an account, sign in, and reset a password
and signed-in players' solves are saved to the account (which opens Triangle and later shapes), with an explicit guest import. The page frame appears before content loads.

**Next up, in order:**

1. Finish the Puzzle Mode gameplay tweaks from the POC (in progress).
2. #57, the rest of A4: cross-device sync and conflict handling (server-stored progress, the Triangle unlock, the guest prompt, and the explicit
   import are done; an end-to-end pass through all 96 core and bonus puzzles is still being tested).
3. Puzzle Mode resume (A5); the Zen randomizer stays visible but should be locked until all
   12 core and 12 bonus groups are solved.

---

## Phase 2 at a glance

### Phase 2A: admin complete, then players get Puzzle Mode and Zen Mode with limited access

| #   | Step                                                          | Status         |
| --- | ------------------------------------------------------------- | -------------- |
| A1  | Product and content rules                                     | ✅ mostly      |
| A2  | Supabase foundation: schema, RLS, Auth, admin role, types     | ✅             |
| A3  | Admin portal: everything needed for 2A content                | ✅ (daily groups and palette correction remain) |
| A4  | Player accounts, explicit guest import, offline/cloud sync    | 🔜 started: sign-up, sign-in, password reset, server-stored progress, guest import; cross-device conflict handling remains |
| A5  | Content access and puzzle-set progression in Puzzle and Zen   | 🔜 started: guest reads, set browsing, Zen limits |
| A6  | Harden, verify, and launch Puzzle Mode                        | ⬜             |

**2A is done when** the admin side is complete and players can use Puzzle Mode
and Zen Mode with limited access. Moving past the first shape requires an account.

### Phase 2B: store, then daily puzzles

| #   | Step                                                          | Status |
| --- | ------------------------------------------------------------- | ------ |
| B1  | Choose a payment approach that works with Phases 3 and 5      | ⬜     |
| B2  | Store UI, product listings, and combo deals                   | ⬜     |
| B3  | Checkout, verified fulfillment, and entitlements              | ⬜     |
| B4  | Daily puzzles: admin scheduling and player feature            | ⬜     |

**2B ends** with the daily puzzles feature. The admin groundwork for daily
puzzles already in the schema stays parked until then.

---

## Codebase reorganization (done)

Move from layer folders (`components/`, `services/`, `hooks/`, `utils/`) to
features plus shared layers, before 2A player work adds accounts and progression.
Each step changes no behavior, keeps tests green, and is reviewed and committed
separately.

Target layout:

```
src/
  app/        entry, routing, navigation guard, global CSS
  features/   zen/, puzzle/, admin/{shell,catalog,common,groups,puzzles,puzzle-groups,palettes,palette-groups,services}/
              (later account/, store/, daily/)
  domain/     React-free: shapes/<shape>/ + registry, puzzles/, palettes/
  ui/         shared components and hooks, grid rendering, shared puzzle board
  lib/        Supabase client and generated types, math helpers
```

Rules:

- One `@/` alias for `src/`. Barrel `index.ts` for each feature, area, and shared folder.
- Every component gets its own colocated CSS Module. No shared stylesheet across
  unrelated components.
- "Palette" everywhere in code, not "scheme". Persisted localStorage keys and
  database names stay unchanged.
- Features never import other features. `ui`, `domain`, and `lib` never import
  features. `domain` has no React. Enforced by ESLint.

| #   | Step                                                                    | Status |
| --- | ----------------------------------------------------------------------- | ------ |
| R1  | One `@/` alias; convert all imports                                     | ✅     |
| R2  | Fix wrong-way dependencies and import cycles                            | ✅     |
| R3  | Shapes domain: one folder per shape plus a registry                     | ✅     |
| R4  | Puzzle engine to `domain/`; shared board/tray split from player shell   | ✅     |
| R5  | Admin into `features/admin/*` with its services and colocated CSS       | ✅     |
| R6  | Zen into `features/zen`; `app/`, `ui/`, `lib/` settled; barrels         | ✅     |
| R7  | Rename "scheme" to "palette" and `AppState` to `ZenState` across code  | ✅     |
| R8  | Split large files, share duplicated helpers                             | ✅     |
| R9  | ESLint boundary rules; update CONTEXT architecture                      | ✅     |

---

## Admin portal: done

- ✅ Admin sign-in, server-checked admin role, generated database types.
- ✅ Edit scheduled content until its release time, then lock it (migration `010000`).
- ✅ Hexagon engine with all six recipes (sizes S/M/L, with and without rotation) and an isolated playtest that never writes player progress.
- ✅ Shape-neutral puzzle engine, board, and authoring RPCs (migration `20261019030000`); puzzles and groups in all six shapes with the same six recipes.
- ✅ Puzzle-creator palette pickers ordered by palette group and position.
- ✅ Puzzle drafts: save, library, edit, delete, bulk palette and bulk delete, replace the design.
- ✅ Regenerate assigned or scheduled puzzles until they go live (migration `20261019020000`).
- ✅ Puzzle groups: create with a purpose (Undecided/Core/Reward/Daily/Pack), shape, and track, edit them while unpublished, add members, drag to reorder, remove, delete (migration `20261020000000`).
- ✅ Palettes: create, edit, duplicate, sandbox preview, usage details, single and bulk delete.
- ✅ Palette groups (`palette_groups` table, purposes Undecided/Core/Reward/Pack): create, assign, reorder, delete.
- ✅ Navigation: Puzzles | Palettes | Shapes | Progression | Release, then Groups | Items, then Unassigned | Assigned | Scheduled | Published. Group lists filter by purpose (and shape and track for puzzles); puzzle items filter by shape and track, and the Assigned view by purpose and group; palette items filter by purpose and group.
- ✅ Release tools (migrations `20261022020000`, `20261022030000`, `20261022040000`): `preview_release` and
  `apply_release` plan and run a release in one transaction; a shape's four core and bonus groups go out as a
  package from the **Release** section; daily, pack, and undecided groups and palette groups have buttons on
  their cards; the Scheduled and Published item views list what has been released; cancelling returns unneeded
  palettes to draft. Hard rules are blockers (24 puzzles, 6 palettes, a reward palette, all four slots),
  the rest are warnings. See DECISIONS.md, Releases.
- ✅ Release view polish: a summary table of core and bonus groups, other puzzle groups, palette groups (drafted, scheduled, live counts), and reward palettes ("N of M live"); a Font Awesome dot replaces the `·` separator across admin labels; status marks (green live, blue scheduled, orange blocked, yellow partly released reward palettes); reward palette groups are never released as groups; puzzle and palette group libraries list released groups read-only with an eye icon.
- ✅ UI audit parts 1–6 (shared controls, loading, dialogs, unsaved-work guard, palette and layout components, CSS cleanup).
- ✅ Unsaved-work safety: a token refresh no longer remounts the workspace (the admin-role check is keyed to the user ID), and unsaved edits in the new-puzzle, puzzle-draft, and palette editors are autosaved to localStorage with an explicit Restore or Discard after a reload (`src/features/admin/drafts`, see CONTEXT.md). Other admin forms (group dialogs, progression slots, group edit forms) don't persist yet; reuse `useDraftRecovery` for them and for any new release-tool editors.

## Admin portal: what's left for 2A (suggested order)

1. ✅ **Scheduled and Published views** for puzzles and palettes, with scheduled puzzles opening in the
   regular editor until release and live ones read-only.
2. ✅ **Publish and schedule (release tools):** the **Release** section, shape packages, and release buttons on
   other groups, with a dialog that previews everything, lists blockers and warnings, and applies in one step.
3. ✅ **Progression section** (migrations `20261021000000`, `20261022000000`): Order (drag the shapes;
   locked once a core group is published), Puzzles and Rewards (four slots per shape: basic and rotation
   core and bonus groups, each with a puzzle group and one reward palette from reward palette groups;
   bonus groups link to the core groups automatically: basic core to the basic bonus group, rotation
   core to both; migration `20261022010000`) with pattern warnings and a list of
   grouped puzzles whose palette players cannot get. These stay warnings on the Progression page; the release tools block the hard rules.
4. ⬜ **Daily groups and scheduling.** Daily groups organize puzzles (for example by month); scheduling
   one per day moves to 2B.
5. ✅ **Shapes section** (first pass): a workbench to try grid sizes (n) and piece mixes per recipe with a
   playable sample, locked for shapes that already have puzzles; nothing is saved, and chosen values are copied
   into code. Still open: splitting piece mixes per recipe in code, and any stored shape settings.
6. ⬜ **Exceptional palette correction** for live palettes, keeping the revision and audit history.
7. ⬜ **End-to-end admin check** in the hosted project.

Moved to 2B: daily puzzle scheduling (part of B4) and pricing and merchandising
screens (part of B2).

Not planned: a manual target or piece editor and multiple admins.

**Content work (yours, alongside the tools):** ✅ the core and bonus puzzle groups for all six
shapes (24 puzzles each) with their reward palettes, and the 12 core palettes (Zen starters). The
remaining pack palette groups wait for the 2B store.

---

## 2A player work (after the admin portal)

**A4: Accounts and sync**

- ✅ Sign-up (email, password, first name), sign-in, sign-out, and password reset with branded auth emails through custom SMTP;
  expired-link handling; a signed-in player client (no migration was needed).
- ✅ A Home screen greets the player (by first name when signed in) and offers Puzzle and Zen; the title returns Home. The page frame and
  logo animation appear before content loads.
- The app stays usable without an account. Signup is available at any time.
- ✅ After all four Hexagon sets are solved, a dismissible once-per-device dialog explains that Triangle needs an account; guests can keep playing Hexagon and Zen.
- ✅ Never merge guest progress automatically: an explicit import is offered after sign-in or sign-up (and later from the account view), and the guest save is kept either way.
- ✅ Guest storage is separate from per-account caches.
- ✅ A once-a-session reminder for a guest on a device that has had an account ("Please sign in to continue saving your progress").
- ✅ Server-stored progress: `record_puzzle_completions` records solves, completes groups, and grants rewards; unsent solves are retried when the browser is back online.
- Still to do: merge completions from several devices as they change, and ask only when two devices changed the same unfinished puzzle.
- Small follow-ups: a "change password" action for signed-in players; the header is a few pixels too wide on screens narrower
  than about 356px since the account button was added.

**A5: Access and progression**

- ✅ One access layer for palettes, shapes, and puzzle sets in Zen and Puzzle Mode (`ui/content`); guests see only
  released core content and Hexagon. Locked content is simply hidden for now.
- ✅ Puzzle Mode teaches itself on first use, as does Zen (the Zen tutorial shows the first time Zen is opened, and Puzzle Mode teaches basic and rotation puzzles the first time each is used). The app opens on Home, from which either is one tap.
- ✅ Player-side random puzzle generation is replaced by published puzzles.
- The first introductory sequence is fixed. After that, every puzzle in an unlocked set is selectable (selectable today; the fixed sequence is not built).
- ✅ Guests earn rewards locally (migration `20261023000000`): completing the basic core group unlocks the basic bonus
  set and its palette, the rotation core group unlocks both bonus sets and its palette, and each bonus set awards a
  palette. Earned state is derived from the solved puzzle IDs, bonus sets stay hidden until earned, reward palettes
  join Zen's palette picker, and a "Reward earned" dialog announces what a solve just earned.
- ✅ Solving either core group of a shape (basic or rotation) unlocks the next shape and its two core groups (accounts only; guests stay on the first shape), announced in a "New shape unlocked" dialog after the reward dialog. Reward palettes come from completing groups, without duplicate rewards.
- Grant the Zen randomizer permanently after all 12 core and 12 bonus groups are solved.
- ✅ Grant rewards and unlock shapes on the server, idempotently (`record_puzzle_completions`). Validating the solution itself on the server is still open.
- ✅ Zen saves use palette IDs (older saves still load by palette name).
- Puzzle Mode has no resume: the current puzzle, placements, and rotations
  live in React state, and a reload returns to the set list (solved puzzles are kept).
  Save the puzzle ID plus placements and rotations so a
  reload resumes the same puzzle (rebuild from the stored definition rather than storing
  solutions). Build this on the A4 guest-storage format so it isn't done twice.

**A6: Launch impact and release**

- ✅ Zen offers Hexagon plus whatever has been unlocked, the released core palettes, and earned reward palettes. Saves on a locked shape or an unavailable palette simply start fresh (superseding old saves is fine).
- Existing visitors' saved designs may use shapes or palettes that become locked.
  Decide how that looks before launch (see "Open decisions").
- Test RLS against forged requests, the critical player journeys, offline use and
  reconnecting, and palette corrections.
- Cover privacy, account deletion, monitoring, and a rollback plan.

## 2B work

**B1: Payment approach**

- Choose with Phases 3 and 5 in mind. Apple and Google generally require their
  own in-app purchases for digital content in their apps. Purchases on the web
  should still unlock content on mobile under the same account.
- Options to compare: Stripe for the web plus native in-app purchases later, or
  a cross-platform purchase service that sits over all three. Entitlements stay
  in Supabase, provider-neutral.

**B2–B3: Store**

- Store UI, listings for puzzle packs and palette packs, and combo deals (bundles).
- Purchases require an account. A paid puzzle pack requires owning its shape and grants only its puzzles.
- Verified server-side fulfillment and idempotent grants. Never trust the
  browser's return URL. Handle refunds and chargebacks.

**B4: Daily puzzles (ends 2B)**

- Admin: set the global rollover time and schedule daily puzzles.
- A rolling five-day window with one global rollover time, free for guests.
- A puzzle being actively played can be finished after it expires. Once the player exits, it's gone.
- A daily puzzle bypasses shape ownership for that puzzle only.

---

## Key product rules (settled)

- **Terminology:** admin and database data structures are **groups**, each with a **purpose** (core, reward, daily, pack, or undecided). Players see free **puzzle sets** (core) versus paid **puzzle packs**; "group" never appears in the player UI. Difficulty
  labels are Easy, Moderate, Hard, and Challenging (stored as `super_hard`).
- **Tracks:** core and reward puzzle groups are **basic** (no rotation: Easy/Moderate/Hard) or **rotation** (Moderate/Hard/Challenging). Packs may also be mixed; daily groups have no track.
- **Progression:** each of the six shapes has two core groups (basic, rotation). Solving either unlocks the next shape. Completing the basic core group awards one palette plus the basic bonus group; completing the rotation core group awards one palette plus both bonus groups (the basic one only if not already earned); each bonus group awards one palette. Players who never solve rotation puzzles still reach every basic group. The Zen randomizer needs all 12 core and 12 bonus groups.
- **Palettes:** a puzzle stores its palette. Bought puzzle packs do not grant palettes; palette packs (or a discounted combo) do.
- **Sizes:** puzzle groups have **24 puzzles**. Palette groups have **6 palettes**.
- **Six recipes for every puzzle shape:** Easy = S; Moderate = M, or S + rotation; Hard = L, or M + rotation; Challenging = L + rotation.
  The admin picks the shape and exact recipe.
- **Guests:** Hexagon Zen with the core palettes, all four Hexagon groups (basic and rotation core, and both bonus groups)
  with their palettes earned locally (plus daily puzzles once 2B adds them). Triangle and later shapes require
  an earned unlock AND an account.
- **No levels or XP.** Show completed sets and the specific unlock requirements instead.
- **Release is not visibility.** Releasing locks content; what a player sees is a separate rule. Players start by seeing only
  what they own, with a way to see what they could unlock or buy added later.
- **A shape's core and bonus groups release together** as one package, only from the Release section; everything else
  is released through groups, never as single puzzles or palettes. Cancelling returns palettes nothing else uses to draft.
- **Live content never changes.** New offerings are additions. Scheduled content
  stays editable until its release instant. The one exception is a palette
  color correction, which updates all rendering through stable palette IDs and color slots.
- **Admin is not a player.** Previews and playtests never record progress or rewards.
- **Each puzzle group uses one shape, except daily groups, which can mix shapes.** Palettes can vary from puzzle to puzzle.
  A puzzle belongs to one group at most.
- **Playing a puzzle in a palette doesn't grant that palette in Zen.**
- **No hints or cloud design collections yet.** Cloud design collections wait for Phase 4.

---

## Open decisions ❓

- Difficulty split inside a 24-puzzle core or bonus group (the size is enforced at release; the split is not).
- 2B: whether releasing a pack happens as part of scheduling its store product (proposed, so packs need no
  separate publish step) and whether anything should lock a pack down earlier.
- Player-side visibility: how, and when, players see content they do not own yet.
- Pack palette group lineups for the store (2B).
- What happens to existing visitors' saved designs that use shapes or palettes
  that become locked, and how to migrate legacy hex saves with duplicate colors.
- Offline unlock policy: how long cached access lasts, and whether unlocks can be used before the server confirms them.
- Conflict wording for two devices that changed the same unfinished puzzle.
- Emergency withdrawal of live content.
- UI wording for "qualified" versus "solved every puzzle."
- Whether a separate player test account is enough for progression testing.
- 2B: payment provider, product IDs, pricing, combo deals, refunds, currency, and tax.
- 2B: daily rollover hour, replay within the window, and what counts as
  "active" (reload, background, tab close, offline).

---

## Later phases

- **Phase 3:** React Native app for iOS/iPadOS with haptics. Reuse accounts, content IDs, and entitlements.
- **Phase 4:** Community sharing: collections, feed, likes, follows, posting limits.
- **Phase 5:** Android release.
- **Phase 6 (maybe):** Community-made puzzles.

---

## How to keep this current

- After a feature is reviewed and committed, tick it off here. Put details in
  CONTEXT/DECISIONS, not here.
- New decisions go in "Key product rules" or come out of "Open decisions."
- Copilot session plans are scratch space for one task. This file is the long-term plan.
