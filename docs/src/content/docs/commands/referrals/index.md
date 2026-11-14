---
title: Referrals
description: Create tracked invite links and measure organic group growth
---

# Referrals

The referral module helps group admins understand which bot-managed invite links bring new members into a group.

## Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/referral create [name]` | Create a tracked invite link. The optional name is limited to 32 characters. | Group admin; bot must be able to invite users |
| `/referral stats` | Show tracked invite links and their attributed unique joins. | Group admin |
| `/referral leaderboard` | Show the top inviters in this group. | Group admin |

## How attribution works

- Only invite links created and saved by Alita with `/referral create` are tracked.
- When Telegram reports a join through one of those links, Alita attributes the member to the link creator.
- A member is counted once per group. Duplicate updates and later re-joins do not inflate the total.
- Links created outside Alita, including links made manually by an administrator, are not included.
- If Alita cannot save a newly created link, it attempts to revoke that link rather than distribute an untracked link.

## Mini App dashboard

Group admins can also open the **Referrals** section in the Mini App dashboard to see attributed members, tracked links, and the inviter leaderboard. The endpoint is admin-only; regular members cannot view invite URLs or inviter statistics.

## Requirements and limitations

- Use the command in the group where the link should be created.
- Alita needs permission to invite users.
- Attribution starts when a member joins through a tracked link; historical joins and external invite links cannot be reconstructed.
