# Telegram group → supergroup chat-ID reference audit

Audited against the current Go model declarations and migration history on 2026-11-28.

## Scope rule

Telegram's basic-group migration changes the owning group ID. Every table column named `chat_id` is treated as a chat-scoped key/reference except `channels.chat_id`: migration history explicitly says that column stores the channel's own Telegram ID, and its former FK to `chats` was removed. The runtime migration discovers `chat_id` columns from the live schema so newly added chat-scoped tables are not silently omitted.

## Model-declared chat-scoped tables

The current model audit found these `chat_id` columns:

- Core/settings: `admin`, `ai_spam_settings`, `antiflood_settings`, `antiraid_settings`, `approved_users`, `blacklists`, `connection`, `connection_settings`, `disable`, `disable_chat_settings`, `filters`, `greetings`, `locks`, `notes`, `notes_settings`, `pins`, `rules`, `warns_settings`.
- Moderation and safety: `ban_records`, `captcha_settings`, `captcha_attempts`, `captcha_muted_users`, `join_request_captchas`, `moderation_events`, `probation_settings`, `probation_members`, `report_auto_mutes`, `report_chat_settings`, `reports`, `warns_users`, `warn_entries`.
- Activity and feature data: `chat_daily_stats`, `chat_hourly_stats`, `chat_member_daily_stats`, `chat_member_counts`, `digest_settings`, `ephemeral_settings`, `federation_chats`, `log_channels`, `night_mode_settings`, `reactions`, `recurring_messages`, `spam_db_settings`, `spam_filter_settings`, `spam_samples`, `chat_timezones`, `chat_invite_links`, `chat_invite_attributions`, `stored_messages`.

`chats.chat_id` is the owner row and is copied to the new ID. `channels.chat_id` is intentionally not remapped.

## Additional ID-valued references

The model audit also identified these non-owning chat/destination ID columns, which are reassigned when they equal the old group ID:

- `federations.log_chat_id`
- `log_channels.log_channel_id`
- `reports.admin_chat_id`
- `join_request_captchas.user_chat_id`

`channels.channel_id` is intentionally excluded. Migration history (20260117104821 and 20260117120000) removed its FK because it stores the channel's own Telegram ID, not a parent-group reference. `chat_users` is not current: migration 20250814100001 dropped that legacy table.

## Foreign-key history

The initial relation migration declared chat FKs for `admin`, `antiflood_settings`, `blacklists`, `channels`, `connection_settings`, `disable`, `filters`, `greetings`, `locks`, `notes`, `notes_settings`, `pins`, `report_chat_settings`, `rules`, `warns_settings`, `chat_users`, `connection`, and `warns_users`. Later migrations added chat FKs for `captcha_settings`, `captcha_attempts`, `approved_users`, `federation_chats`, `log_channels`, `warn_entries`, `moderation_events`, `reports`, `ban_records`, and `report_auto_mutes`. Some newer tables intentionally have no FK; this is why the migration enumerates live `chat_id` columns rather than relying only on FK cascades.

The historical initial migration also contains destructive orphan-cleanup DELETE statements. This PR does not edit or rerun that file; the new migration only creates the mapping ledger.

## Runtime migration behavior

- Copy the source `chats` row to the supergroup ID; retain the old row and mark it inactive.
- Reassign all live-schema `chat_id` columns except `chats`, `channels`, and the ledger itself.
- Reassign the explicitly audited destination/reference columns above.
- Use a unique old→new ledger for duplicate-update idempotency.
- If the new chat or any child table already has rows under the new ID, abort the transaction. No row is overwritten or deleted; both sides remain intact for safe reconciliation.
- All writes occur in one database transaction. No DROP, DELETE, destructive migration, or Telegram API request is used.
