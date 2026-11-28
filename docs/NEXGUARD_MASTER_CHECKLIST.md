# NexGuard master checklist

GitHub Issues are disabled for this repository (API 410), so this file is the persistent project tracker. Update it in the PR that completes each phase. Resume from the first unchecked item.

## Ordered implementation

- [x] PR A: non-member ban/warn targets — merged as PR #64, commit `27efcae519cc9331fbd0e44c164fa2e426b8e7c6`; CI #405 green; Render deploy `dep-dc5hgo0473hc73aom940` LIVE. Telegram behavior not verified.
- [ ] Group → supergroup migration: complete chat-ID reference audit; additive-only migration; preserve settings, warns and filters; avoid duplicates; Go + PostgreSQL integrity tests.
- [ ] PR B: non-member mute/unmute/kick/restrict responses; no pending restrictions.
- [ ] PR C: Mini App direct actions use shared username/numeric resolver and live rights checks.
- [ ] Full moderation command test matrix and command audit table; fix failures; reduce unnecessary Telegram calls.
- [ ] Protection Setup presets, lazy group chooser, rights-aware apply, diff/Undo and BackButton.
- [ ] Custom security levels: per-user/per-group, max 3, additive schema/endpoints, declarations-based validation, live rights.
- [ ] Home screen: implemented destinations only.
- [ ] Welcome text editor and typed lock endpoint with exact rights checks; consider media only if file_id-only design adds no server storage/memory.
- [ ] Goodbye default OFF for new groups only; preserve existing group settings.
- [ ] Remaining Commands Guide modules in batches using locale extend_msg; do not invent commands.
- [ ] Mini App feature-parity gap table.

## Non-negotiable safeguards

- Every feature PR starts as DRAFT from current main; separate PRs in the requested order.
- Merge only when the latest commit passes every required CI check and the diff respects the user's file/permission restrictions.
- Render AutoDeploy only; no manual deploy. Verify deploy LIVE and startup logs. Do not claim Telegram verification; user performs it.
- Never edit env vars/secrets, Render settings, render.yaml, or protected PRs #49, #44, #31, #20, #21. Never force-push or weaken authorization/permissions.
- Never delete data or use destructive migrations. If an ID collision makes safe migration ambiguous, fail closed and preserve both sides.
- If one PR remains CI-red after three attempts, leave it DRAFT, record the blocker here, and continue to the next item.
- GitHub Issues are disabled in this repository; this file is the persistent checklist instead.
