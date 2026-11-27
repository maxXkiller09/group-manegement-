# PR1 — Group lifecycle and Mini App discovery (R2 + R3)

> Draft implementation tracker. **Local tests were not run.** CI status below is based only on GitHub Actions results.

## Scope
- Persist bot add/remove/re-add and group title changes asynchronously and idempotently.
- Track the user who added the bot in the existing chat-user list so they can discover the group in the Mini App.
- Refresh the current Telegram admin snapshot asynchronously using the existing bounded, in-flight-deduplicated loader.
- Keep Mini App discovery consistent with existing access/role checks and exclude inactive groups.
- Keep admin snapshot reads functional when Redis is unavailable; Redis is only a cache.
- Group-to-supergroup identity/settings linkage is a separate follow-up: preserve both Telegram IDs and add an explicit mapping only after the migration-update path and every chat_id reference are audited. PR1 does not rewrite chat IDs.

## Safety invariants
1. The welcome message is independent of DB/Telegram enrichment. Log errors and continue; enrichment failure must not suppress welcome.
2. No slow Telegram admin lookup runs inline in the update handler. Use bounded background work and idempotent event keys.
3. Migration is additive only (new tables/columns). No DROP, destructive rewrite, or mandatory backfill. Legacy rows remain readable when new fields are NULL/default.
4. Do not modify auth, permissions policy, panel.go, render.yaml, environment variables, or deployment configuration.
5. No merge or manual deploy. Require green CI and user's manual **Verified** confirmation.

## Before / after
```text
BEFORE
bot-added update -> welcome handler -> welcome message
                 -> no immediate lifecycle persistence
                 -> Mini App may wait for later group activity

AFTER (target)
bot-added update -> welcome path (never waits for enrichment)
                 -> deduplicated background lifecycle job
                    -> additive DB upsert + migration link
                    -> record adder in tracked chat-user list
                    -> async admin snapshot refresh (when bot has admin rights)
                 -> Mini App applies existing access/role verification
bot-removed update -> mark inactive -> exclude from Mini App list
old group -> supergroup -> follow-up mapping feature; no ID rewrite in PR1
```

## Schema audit findings (2026-11-26)
- The production chat registry is `chats`; its natural key is `chat_id`, and Mini App candidate discovery filters `is_inactive = false`.
- The existing admin-cache loader already deduplicates in-flight loads and bounds Telegram API requests. Lifecycle enrichment should reuse it rather than add a competing admin cache.
- The initial FK migration attaches many legacy settings tables to `chats(chat_id)` with `ON UPDATE CASCADE`, but two later migrations explicitly drop both `channels` chat FKs because channel IDs are not group IDs.
- Newer tables do not all share the same FK behavior: `moderation_events`, `federation_chats`, and `log_channels` have chat FKs; `chat_daily_stats`, `chat_hourly_stats`, `chat_member_daily_stats`, `chat_member_counts`, `chat_invite_links`, and `chat_invite_attributions` store `chat_id` without a chat FK.
- Therefore `ON UPDATE CASCADE` is not a complete migration strategy. Rewriting `chats.chat_id` would leave at least the no-FK tables pointing at the old ID. No ID rewrite or migration has been made.
- The migration runner verifies checksums for already-applied migration files. Existing migration files must never be edited.
- Group-to-supergroup identity linkage needs a separate additive mapping design and a complete audit of all current migrations, models, raw SQL, and migration-update handling. PR1 keeps existing IDs unchanged; do not add a speculative FK or backfill.

## Required automated tests
- [x] bot add → remove → re-add state transition and single-row regression
- [x] duplicate add update is idempotent (dispatcher duplicate-delivery case)
- [x] bot removal, including a previously unseen chat
- [x] dispatcher-level kick/removal status update regression
- [x] adder tracking in the existing chat-user list
- [x] async admin-cache refresh uses existing bounded/deduplicated loader
- [x] welcome path uses the membership update's bot status and does not make a synchronous Telegram admin lookup
- [x] legacy rows with NULL/default new fields
- [ ] additive migration for group migration linkage (blocked on FK audit)
- [x] Redis-unavailable admin snapshot returns the live Telegram result

## Manual test checklist — user's test group
- [ ] Create a new group and add the bot.
- [ ] Confirm welcome message appears.
- [ ] Confirm group appears immediately in Mini App list.
- [ ] Remove the bot; confirm group disappears from list.
- [ ] Add bot again; confirm it reappears exactly once.
- [ ] Convert/migrate group to supergroup; confirm identity/settings carry over after the FK audit and additive-link design.

## CI result ledger

| Commit | Result |
|---|---|
| `66ef3bff42ef64028ad0c341e89ed252b12d6827` | CI pending; workflow run 45842890571 (feature-code validation) |
| `3af5d7e581a01fc109bd57c12aad4153f2c5eca1` | CI run 45842764259 did not complete; some jobs were cancelled; not counted as passed |
| `02c64173f4589e615e0484ea11d4f1bc3a1bc6fb` | Feature CI passed for the first lifecycle slice only |
| Docs-only commits | Not counted as feature validation |

Update this ledger only from actual workflow results. Inspect failing logs before changing code.
