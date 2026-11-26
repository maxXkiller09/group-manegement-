# PR1 — Group lifecycle and Mini App discovery (R2 + R3)

> Draft implementation tracker. **Locally tested नहीं, CI के नतीजे pending.** No checks are represented as passing until GitHub Actions reports them.

## Scope
- Persist bot add/remove/re-add and group title changes immediately.
- Track the adding user and current administrators asynchronously.
- Bound Telegram calls with timeouts; deduplicate repeated lifecycle events.
- Preserve old group identity/settings through group-to-supergroup migration without duplicate active records.
- Keep Mini App discovery consistent with existing access/role checks and exclude groups after bot removal.
- Operate without Redis.

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
                    -> timed async adder/admin snapshot
                    -> group-list cache invalidation (if present)
                 -> Mini App applies existing access/role verification
bot-removed update -> mark inactive -> exclude from Mini App list
```

## Schema audit findings (2026-11-26)
- The production chat registry is `chats`; its natural key is `chat_id`, and Mini App candidate discovery filters `is_inactive = false`.
- The existing admin-cache loader already deduplicates in-flight loads and bounds Telegram API requests. Lifecycle enrichment should reuse it rather than add a competing admin cache.
- The existing foreign-key migration declares `ON UPDATE CASCADE` for its listed chat references, but that is not proof that every table in the current migration chain has the same behavior.
- The migration runner reads ordered SQL migration files from the configured migrations directory and verifies checksums of already-applied migrations. Existing migration files must never be edited.
- Therefore, a group-to-supergroup ID migration is **blocked pending a complete current-schema FK/reference audit**. Do not implement it as a bare `UPDATE chats SET chat_id=...`; that could orphan or conflict with settings and related rows.
- Lifecycle persistence and group-ID migration must be separately testable. Until the FK audit is complete, preserve the old ID and record migration linkage additively; do not rewrite existing IDs.

## Required automated tests
- [ ] bot add
- [ ] duplicate add update is idempotent
- [ ] bot removal
- [ ] kick/removal status update
- [ ] re-add
- [ ] group-to-supergroup migration and duplicate prevention (blocked on FK audit)
- [ ] adder tracking
- [ ] admin tracking
- [ ] Telegram API error and timeout; welcome still sent
- [ ] legacy rows with NULL/default new fields
- [ ] migration contains only additive DDL
- [ ] Redis unavailable

## Manual test checklist — user's test group
- [ ] Create a new group and add the bot.
- [ ] Confirm welcome message appears.
- [ ] Confirm group appears immediately in Mini App list.
- [ ] Remove the bot; confirm group disappears from list.
- [ ] Add bot again; confirm it reappears exactly once.
- [ ] Convert/migrate group to supergroup; confirm identity/settings carry over.

## CI result ledger
| Check | Result |
|---|---|
| Go test shards | Pending for implementation |
| Build | Pending for implementation |
| Lint | Pending for implementation |
| Migration checks | Pending for implementation |
| Docs-only CI (commit ea04b380) | Passed; does not validate feature code |

Update this ledger only from the actual workflow run and inspect failing logs before changing code.
