# PR1 — Group lifecycle and Mini App discovery (R2 + R3)

> Draft implementation tracker. **Local tests were not run.** CI status below is based only on GitHub Actions results.

## Scope
- Persist bot add/remove/re-add and group title changes asynchronously and idempotently.
- Track the user who added the bot in the existing chat-user list so they can discover the group in the Mini App.
- Refresh the current Telegram admin snapshot asynchronously using the existing bounded, in-flight-deduplicated loader.
- Keep Mini App discovery consistent with existing access/role checks and exclude inactive groups.
- Keep admin snapshot reads functional when Redis is unavailable; Redis is only a cache.
- Group-to-supergroup identity/settings linkage remains blocked until the FK/reference audit is complete.

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
old group -> supergroup -> blocked until complete FK/reference audit
```

## Schema audit findings (2026-11-26)
- The production chat registry is `chats`; its natural key is `chat_id`, and Mini App candidate discovery filters `is_inactive = false`.
- The existing admin-cache loader already deduplicates in-flight loads and bounds Telegram API requests. Lifecycle enrichment should reuse it rather than add a competing admin cache.
- The existing foreign-key migration declares `ON UPDATE CASCADE` for its listed chat references, but that is not proof that every table in the current migration chain has the same behavior.
- The migration runner reads ordered SQL migration files from the configured migrations directory and verifies checksums of already-applied migrations. Existing migration files must never be edited.
- Therefore, a group-to-supergroup ID migration is **blocked pending a complete current-schema FK/reference audit**. Do not implement it as a bare `UPDATE chats SET chat_id=...`; that could orphan or conflict with settings and related rows.
- Lifecycle persistence and group-ID migration must be separately testable. Until the FK audit is complete, preserve the old ID and record migration linkage additively; do not rewrite existing IDs.

## Required automated tests
- [x] bot add → remove → re-add state transition and single-row regression
- [ ] duplicate add update is idempotent (separate duplicate-delivery case)
- [x] bot removal, including a previously unseen chat
- [ ] dispatcher-level kick/removal status update regression
- [x] adder tracking in the existing chat-user list
- [x] async admin-cache refresh uses existing bounded/deduplicated loader
- [ ] focused welcome-path regression for Telegram API timeout/error
- [ ] legacy rows with NULL/default new fields
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
| `a7ca5a57388a7ea5d2e7c4331e616ba8e95158f7` | CI pending; workflow run 45842426233 |
| `2fe2cc8d2c717776844dd1071469d3ce48041656` | CI run 45842210402 was in progress at last check; not counted as passed |
| `02c64173f4589e615e0484ea11d4f1bc3a1bc6fb` | Feature CI passed for the first lifecycle slice only |
| Docs-only commits | Not counted as feature validation |

Update this ledger only from actual workflow results. Inspect failing logs before changing code.
