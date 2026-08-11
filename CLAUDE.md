# Agent instructions

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing mapping, auth, or relay behavior.

## TypeScript

- `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`.
- No `any` — not as annotations, casts, or implicit inference.
- External JSON is `unknown`, then Zod `.parse` / `.safeParse`. No `as CtStatus` after `JSON.parse`.
- No `as any`, `@ts-expect-error`, or eslint-disable for `no-explicit-any` / `no-unsafe-*`.
- `pnpm typecheck` and `pnpm lint` must stay clean.

## Style (modules, not classes)

- Prefer **functions + closures**. Stateful services are `createX(...)` factories that close over `let` state and return a typed object of functions.
- Do **not** add `class` / `private` / `public` / `this` for app services (`CtechAuth`, socket, relay, ABRP client).
- Exception: `class FooError extends Error` is fine (`instanceof` needs it). Keep those thin — no `public`/`private` ceremony.
- Pure transforms stay as exported functions (`mapVehicleStatusToTlm`).
- React components stay function components.

## Git

- Conventional commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).
- Focused commits; never commit `.env` or secrets.
- Update ARCHITECTURE.md / CLAUDE.md in the same commit when a decision or mapping changes.

## Mapping invariants

- HD OEM block first (`vehicle_status_hd`). Generic CAN/Bosch/Novus are unused for this bike.
- `battery_main_*` is 12 V aux, not HV pack SoC/voltage.
- Send `speed: 0` when parked.
- Omit null ABRP fields. Omit `power`, HV `voltage`, `current` until present.
- `hd_charge_status === 0` is not charging until a charging sample exists.

## Runtime

- Dashboard login must not call CT `/account/login/`. Compare to env with `timingSafeEqual`.
- Always call c.technology REST with a trailing slash (`ctechUrl()`).
- `DRY_RUN=true` must not POST to ABRP.
- Do not add Docker or a second deployable service.
- Local UI: `pnpm dev` then Vite `:5173`. Production: `pnpm build` + `pnpm start` serves `dist/web`.
- Railway: build `pnpm build`, start `pnpm start`, health `GET /health`.
