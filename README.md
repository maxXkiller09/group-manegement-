# NexGuard 🛡️

<p align='center'>
  <a href="https://github.com/maxXkiller09/group-manegement-/actions/workflows/ci.yml"><img src="https://github.com/maxXkiller09/group-manegement-/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

**NexGuard** is a Telegram group-management bot for **[@NexGuardd_Bot](https://t.me/NexGuardd_Bot)**, built with Go and gotgbot. It helps communities stay safer and better organized with moderation tools, filters, notes, greetings, anti-spam protection, CAPTCHA verification, backups, group analytics, and a Telegram Mini App dashboard.

**Tagline:** Smart Protection. Better Communities.

## Quick Start

Prerequisites: Docker, Docker Compose, a Telegram bot token from
[@BotFather](https://t.me/BotFather), and a Telegram user ID plus log-channel ID.

```bash
git clone https://github.com/maxXkiller09/group-manegement-.git
cd group-manegement-
cp sample.env .env
# Set BOT_TOKEN, OWNER_ID, MESSAGE_DUMP, WEBHOOK_DOMAIN, and WEBHOOK_SECRET in .env.
docker compose up -d
docker compose logs -f alita
```

PostgreSQL and Redis are included in the Compose stack.

## Documentation

For setup, configuration, deployment, and command references, see
[the project documentation](docs/). For contributor and architecture guidance, see
[AGENTS.md](AGENTS.md).

## Development

```bash
make run
make lint
make test
```

## Upstream and License

NexGuard is maintained in this repository and builds on the upstream Alita Robot project. The upstream project and its contributors retain their original attribution.

[MIT](LICENSE) © 2020-2026 Divkix and contributors.

<p align="center">
  <a href="https://t.me/NexGuardd_Bot">Open NexGuard</a>
</p>
