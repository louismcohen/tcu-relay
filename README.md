# tcu-relay

Relays Harley-Davidson LiveWire TCU data from [c.technology](https://docs.ctechnology.io/api-reference/introduction) to [A Better Routeplanner](https://abetterrouteplanner.com/resources/api).

## Requirements

- Node 22+
- [pnpm](https://pnpm.io)

## Local

```bash
pnpm install
cp .env.example .env   # fill secrets
pnpm dev               # relay + (later) Vite dashboard
pnpm test
pnpm typecheck
pnpm lint
```

`DRY_RUN=true` logs mapped ABRP payloads without POSTing.

`GET /health` is unauthenticated (Railway healthcheck).

## Railway

Always-on service. Build: `pnpm build`. Start: `pnpm start`. Set the same env vars as `.env.example`. Healthcheck: `GET /health`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow and mapping.
