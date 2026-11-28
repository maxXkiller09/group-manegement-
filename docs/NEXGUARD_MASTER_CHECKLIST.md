# NexGuard master checklist

GitHub Issues are disabled for this repository (GitHub API 410). This file is the persistent checklist; continue from the first pending item.

## Ordered implementation

- [x] PR A — non-member ban/warn targets: PR #64, commit `27efcae519cc9331fbd0e44c164fa2e426b8e7c6`; CI #405 green; Render deploy `dep-dc5hgo0473hc73aom940` LIVE. Telegram behavior not verified.
- [!] Group → supergroup migration: PR #65 DRAFT, unmerged, undeployed after 3 CI attempts. Latest run #417 failed complexity guard in `MigrateChatID` (36 > 20). No test weakened; refactor blocker recorded in PR #65.
- [x] PR B — non-member mute/unmute/restrict responses: PR #66, commit `bff63ef51e70f8812c19c398709ad8c319080ae4`; CI #434 green; Render deploy `dep-dc5i3lmtlv9c739e54pg` LIVE. Telegram behavior not verified.
- [ ] PR C — Mini App direct actions use shared username/numeric resolver and live rights checks.
- [ ] Full moderation command test matrix and command audit table; fix failures; reduce unnecessary Telegram calls.
- [ ] Protection Setup presets, lazy group chooser, rights-aware apply, diff/Undo and BackButton.
- [ ] Custom security levels: per-user/per-group, max 3, additive schema/endpoints, declarations-based validation, live rights.
- [ ] Home screen: implemented destinations only.
- [ ] Welcome text editor and typed lock endpoint with exact rights checks; consider media only if file_id-only design adds no server storage/memory.
- [ ] Goodbye default OFF for new groups only; preserve existing group settings.
- [ ] Remaining Commands Guide modules in batches using locale extend_msg; do not invent commands.
- [ ] Mini App feature-parity gap table.

## Safeguards

- Each feature PR starts as DRAFT from current main; separate PRs in requested order.
- Merge only latest commit after every required check is green and diff respects restrictions.
- Render AutoDeploy only; no manual deploy. Verify LIVE and startup logs. Telegram behavior is never marked verified; user tests it.
- Never change env vars/secrets, Render settings, render.yaml, or protected PRs #49, #44, #31, #20, #21. Never force-push or weaken auth/permissions.
- No destructive migrations or data deletion. On ambiguous migration collision, fail closed.
- After three failed CI attempts, leave that PR DRAFT, record blocker, and continue.
- Never send message content or private information to the log group.
