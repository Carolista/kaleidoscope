# Kaleidoscope: Roadmap

The single place to see where the project is going and what comes next.
Consolidated on 2026-10-19 from the earlier Copilot session plans. Those plans
are now historical; update this file instead.

- **Current behavior and standards:** [CONTEXT.md](./CONTEXT.md)
- **Why things are the way they are:** [DECISIONS.md](./DECISIONS.md)
- **Database setup, migrations, and SQL tests:** [supabase/README.md](./supabase/README.md)
- **Original phase descriptions:** [BACKLOG.md](./BACKLOG.md)

Status key: ✅ done · 🔜 next · ⬜ not started · ❓ needs a decision


---

## Where we are now

**Phase 2A: building the admin portal** (branch `54-create-admin-portal`, issue #54).

Supabase is set up and hosted, the admin can sign in, and the admin can generate,
save, and organize hexagon puzzles and palettes. Nothing is released to players
yet.

The live app currently has **Zen Mode only**, with every shape and a limited set
of palettes. Launching Puzzle Mode makes it the primary feature and makes access
more restrictive (see "Launch impact" below).

**Next up:** the Scheduled and Published catalog views, then the remaining
admin tools.

---

## Phase 2 at a glance

### Phase 2A: admin complete, then players get Puzzle Mode and Zen Mode with limited access

| #   | Step                                                          | Status         |
| --- | ------------------------------------------------------------- | -------------- |
| A1  | Product and content rules                                     | ✅ mostly      |
| A2  | Supabase foundation: schema, RLS, Auth, admin role, types     | ✅             |
| A3  | Admin portal: everything needed for 2A content                | 🔜 in progress |
| A4  | Player accounts, explicit guest import, offline/cloud sync    | ⬜             |
| A5  | Content access and puzzle-set progression in Puzzle and Zen   | ⬜             |
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

## Admin portal: done

- ✅ Admin sign-in, server-checked admin role, generated database types.
- ✅ Edit scheduled content until its release time, then lock it (migration `010000`).
- ✅ Hexagon engine with all six recipes (sizes S/M/L, with and without rotation) and an isolated playtest that never writes player progress.
- ✅ Puzzle drafts: save, library, edit, delete, bulk palette and bulk delete, replace the design.
- ✅ Regenerate assigned or scheduled puzzles until they go live (migration `20261019020000`).
- ✅ Puzzle sets: create (Core/Reward/Paid), add members, drag to reorder, remove, delete.
- ✅ Palettes: create, edit, duplicate, sandbox preview, usage details, single and bulk delete.
- ✅ Palette sets (`palette_packs` table, kinds Undecided/Core/Reward/Paid): create, assign, reorder, delete.
- ✅ Navigation: Puzzles | Palettes | Shapes, then Sets | Items, then Unassigned | Assigned | Scheduled | Published.
- ✅ UI audit parts 1–6 (shared controls, loading, dialogs, unsaved-work guard, palette and layout components, CSS cleanup).

## Admin portal: what's left for 2A (suggested order)

1. 🔜 **Scheduled and Published views.** These are placeholders in
   [AdminWorkspace.tsx](./src/components/admin/AdminWorkspace.tsx).
   Scheduled puzzles can already be regenerated in the database but can't be opened in the UI yet.
2. ⬜ **Publish and schedule (release tools).** Approve content with a release
   date, reschedule or cancel before release, and show missing dependencies.
   Live content stays locked.
3. ⬜ **Starter offerings.** Choose starter palettes and palette sets.
   Hexagon is already the only starter shape.
4. ⬜ **Qualifying routes inside sets.** Define which puzzles in a 24-puzzle set
   make up each route, such as an easier route and a harder route.
5. ⬜ **Core sequence.** The linear order of core sets, and which milestones unlock new shapes.
6. ⬜ **Rewards.** Palettes, palette sets, or reward puzzle sets, tied to any route or to a specific harder route.
7. ⬜ **Shapes section.** Catalog settings only. New shape geometry still needs app code.
8. ⬜ **Exceptional palette correction** for live palettes, keeping the revision and audit history.
9. ⬜ **End-to-end admin check** in the hosted project.

Moved to 2B: daily puzzle scheduling (part of B4) and pricing and merchandising
screens (part of B2).

Not planned: a manual target or piece editor, other shapes' puzzle recipes, and multiple admins.

**Content work (yours, alongside the tools):** finish the paid palette sets,
then choose palette sets for rewards and the starter. Author 24-puzzle sets for
the core sequence and rewards.

---

## 2A player work (after the admin portal)

**A4: Accounts and sync**

- The app stays usable without an account. Signup is available at any time.
- Never merge guest progress automatically. Offer an explicit import on both
  signup and sign-in, and keep the guest save if the player declines.
- Keep guest storage separate from per-account caches.
- Sync automatically when the player is back online. Merge completions, and
  ask only when two devices changed the same unfinished puzzle.

**A5: Access and progression**

- One access layer used by the palette picker, shape picker, and puzzle catalog,
  in both Puzzle Mode and Zen Mode.
- Replace player-side random puzzle generation with published puzzles.
- The first introductory sequence is fixed. After that, every puzzle in an unlocked set is selectable.
- Finishing either route unlocks the next set. Harder-route rewards can be earned later, without duplicate rewards.
- Grant the Zen randomizer permanently after one route in every core set.
- Validate completions and grant rewards on the server, idempotently.
- Migrate existing Zen saves from hex colors to palette slots.

**A6: Launch impact and release**

- Today's Zen Mode offers every shape. After launch, Zen offers Hexagon plus
  whatever has been unlocked, and a limited starter palette list.
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

- Store UI, listings for puzzle packs and palette sets, and combo deals (bundles).
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

- **Terminology:** free **puzzle sets** versus paid **puzzle packs**. Difficulty
  labels are Easy, Moderate, Hard, and Challenging (stored as `super_hard`).
- **Sizes:** puzzle sets have **24 puzzles**. Palette sets have **6 palettes**.
- **Six hexagon recipes:** Easy = S; Moderate = M, or S + rotation; Hard = L, or M + rotation; Challenging = L + rotation.
  The admin picks the exact recipe.
- **Guests:** Hexagon Zen, the initial set, and locally earned palettes (plus daily puzzles once 2B adds them).
  Anything beyond the initial set, and the second shape, requires an earned unlock AND an account.
- **No levels or XP.** Show completed sets and the specific unlock requirements instead.
- **Live content never changes.** New offerings are additions. Scheduled content
  stays editable until its release instant. The one exception is a palette
  color correction, which updates all rendering through stable palette IDs and color slots.
- **Admin is not a player.** Previews and playtests never record progress or rewards.
- **Each set or pack uses one shape.** Palettes can vary from puzzle to puzzle.
  A puzzle belongs to one collection at most.
- **Playing a puzzle in a palette doesn't grant that palette in Zen.**
- **No hints or cloud design collections yet.** Cloud design collections wait for Phase 4.

---

## Open decisions ❓

- Route makeup inside a 24-puzzle set: how many puzzles of each difficulty, and
  which puzzles each route requires.
- Whether publishing should enforce exactly 24 puzzles and 6 palettes, or only warn.
- Starter and reward palette-set lineups (after the paid palette sets are done).
- What happens to existing visitors' saved designs that use shapes or palettes
  that become locked, and how to migrate legacy hex saves with duplicate colors.
- Offline unlock policy: how long cached access lasts, and whether unlocks can be used before the server confirms them.
- Guest-import UX details and conflict wording.
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
