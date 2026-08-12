# Agent entry

1. Read [CLAUDE.md](CLAUDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
2. Then read the module you are changing.

## Repo map

| Path | What |
| --- | --- |
| `src/index.ts` | Process entry |
| `src/config.ts` | Env |
| `src/http.ts` | HTTP |
| `src/ctech/` | c.technology REST + WS + vehicle resolve |
| `src/mapper.ts` | CT → ABRP |
| `src/abrp/` | ABRP client |
| `src/freshness.ts` | Stale + WS ping constants |
| `src/relay.ts` | Loop + snapshot |
| `src/types/` | Zod schemas |
| `web/` | Dashboard UI (Vite + React + shadcn) |
| `src/session.ts` | Signed dashboard cookie |
| `tests/` | Vitest |

Single pnpm package. Node 22. No Docker.

Style: `createX` factories + functions. No service classes / `this` / `private`. See [CLAUDE.md](CLAUDE.md).
