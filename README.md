# tcu-relay

Relays Harley-Davidson LiveWire TCU data from [c.technology](https://docs.ctechnology.io/api-reference/introduction) to the [ABRP Telemetry API](https://documenter.getpostman.com/view/7396339/SWTK5a8w).

A status dashboard (Vite + React + shadcn) is served from the same process.

## Requirements

- Node 22+
- [pnpm](https://pnpm.io)

## Local

```bash
pnpm install
cp .env.example .env   # fill secrets
pnpm dev               # relay on :3000 + Vite on :5173 (proxies /api)
```

Open http://127.0.0.1:5173 and sign in with `CTECH_EMAIL` / `CTECH_PASSWORD`.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build             # writes dist/web
pnpm start             # serves API + built dashboard on PORT
```

`DRY_RUN=true` logs mapped ABRP payloads and does not POST.

`GET /health` is unauthenticated (Railway healthcheck).

## Environment

See [.env.example](.env.example). Required: `CTECH_EMAIL`, `CTECH_PASSWORD`, `CTECH_VEHICLE_ID` (fallback if the owned-vehicle list is empty), `ABRP_API_KEY`, `ABRP_TOKEN`, `ABRP_CAR_MODEL`, `SESSION_SECRET` (at least 16 characters).

Defaults:

- `ABRP_SEND_INTERVAL_MS=5000`
- `DRY_RUN=true`
- `PORT=3000`

## Railway

Always-on Node service (not a cron). Nixpacks/Railpack from `package.json` — no Docker.

| Setting | Value |
| --- | --- |
| Node | 22 (`.nvmrc` / `engines`) |
| Build | `pnpm build` |
| Start | `pnpm start` |
| Healthcheck | `GET /health` |

Set the same env vars as `.env.example` in the Railway dashboard, including a long random `SESSION_SECRET`. No volume or database.

After deploy, open the public URL and log in with the c.technology email/password.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — data flow, mapping, auth
- [CLAUDE.md](CLAUDE.md) — agent conventions
- [AGENTS.md](AGENTS.md) — repo map
