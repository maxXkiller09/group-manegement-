# Telegram Mini App — Mobile QA

The admin panel is already a Telegram Mini App served from the bot at `/panel/`.
This checklist is for a real Telegram Android/iOS client; a desktop browser alone
does not validate Telegram's WebView, safe areas, native Back button or haptics.

## Before testing

1. Deploy a build with `PANEL_ENABLED=true` and a valid HTTPS `PANEL_PUBLIC_URL`.
2. Add the Mini App URL/short name in BotFather if using a direct Mini App link.
3. Add the bot to a private test group as an administrator with the permissions
   needed by the feature under test.
4. Open the panel from the bot's group settings button or its private-message
   panel link. Do not open the API URL directly: Telegram must provide signed
   `initData`.

## Phone viewport matrix

| Device profile | Viewport to check | Theme |
| --- | ---: | --- |
| Compact Android | 320 × 640 | Light + dark |
| Typical Android | 360 × 800 | Light + dark |
| Large Android | 412 × 915 | Light + dark |
| iPhone-sized | 390 × 844 | Light + dark |
| Landscape | 800 × 360 | Light |

## Functional pass

- [ ] Mini App opens from Telegram and reaches the chat list or requested chat.
- [ ] Header title and group context are readable; no horizontal page scrolling.
- [ ] Telegram native Back button and in-page fallback navigate to the correct parent.
- [ ] Closing/navigating with unsaved settings asks for confirmation.
- [ ] Overview, activity, members, referrals, warnings, timeline, lists and settings load.
- [ ] Settings controls and list actions are reachable with one-hand taps.
- [ ] Save bar, toast and bottom controls remain above the device safe area.
- [ ] Long group names, usernames, note text and error messages wrap without clipping.
- [ ] Empty, loading, expired-session, rate-limit and retry states are understandable.
- [ ] Dark/light Telegram theme changes update the panel without unreadable contrast.
- [ ] Rotation to landscape does not trap the user or hide actions behind the keyboard.
- [ ] Reopening the panel after closing it still authenticates; expired initData asks
  the user to reopen from Telegram.
- [ ] Regular members cannot see admin-only member identities or moderation details,
  and cannot perform writes that require admin permissions.

## Permission regression

Use two Telegram test accounts: one current group admin and one regular member.
Also demote the admin while their panel is open, then retry a write. The server
must reject stale permissions; hiding a button in the UI is not an authorization
control.

## Report format

Record phone model, OS version, Telegram version, viewport/orientation, theme,
screen, expected result, actual result and screenshot. Never include bot tokens,
raw `initData`, session headers or private group/member data in a report.

## Automated repository checks

The Go panel tests validate embedded asset references and API/auth/permission
behaviour. Run the repository's required suite with:

```sh
make test
make lint
make nilaway
CGO_ENABLED=0 go build ./...
```

A green CI run does not replace the real-device checklist above.
