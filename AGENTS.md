# Agent entry

1. Read [CLAUDE.md](CLAUDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
2. Then read the module you are changing.

## Repo map

| Path | What |
| --- | --- |
| `src/index.ts` | Process entry |
| `src/config.ts` | Env |
| `src/http.ts` | HTTP |
| `src/ctech/` | c.technology REST + WS |
| `src/mapper.ts` | CT → ABRP |
| `src/abrp/` | ABRP client |
| `src/relay.ts` | Loop + snapshot |
| `src/types/` | Zod schemas |
| `web/` | Dashboard UI |
| `tests/` | Vitest |

Single pnpm package. Node 22. No Docker.
