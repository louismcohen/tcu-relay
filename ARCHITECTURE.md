# Architecture

Single Node process: c.technology client + ABRP forwarder + HTTP (health, later dashboard).

```
LiveWire TCU → c.technology cloud
                    │
                    ├─ REST  POST /api/v2.2/account/login
                    ├─ REST  GET  /api/v2.2/vehicle-direct-access/
                    ├─ REST  GET  /api/v2.2/vehicle/{id}/status
                    └─ WSS   vehicle/status
                              │
                         tcu-relay
                              │
                    POST https://api.iternio.com/1/tlm/send
                    Authorization: APIKEY {key}
                    body: { token, tlm }
                              │
                             ABRP
```

## Modules

| Path                    | Role                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `src/config.ts`         | Zod-validated env                                              |
| `src/logger.ts`         | Pino (redacts secrets)                                         |
| `src/http.ts`           | Health (and later login / status / SSE / static UI)            |
| `src/ctech/auth.ts`     | `createCtechAuth` — login + token refresh (60s margin)         |
| `src/ctech/rest.ts`     | `GET /vehicle-direct-access/` + `GET /vehicle/{id}/status`     |
| `src/ctech/vehicles.ts` | Resolve first owned vehicle, else env                          |
| `src/ctech/ws.ts`       | `createCtechSocket` — WSS auth + ping/pong + reconnect backoff |
| `src/types/ctech.ts`    | Zod envelopes for login, status, owned vehicles                |
| `src/freshness.ts`      | Stale threshold + WS ping interval                             |
| `src/mapper.ts`         | CT status → ABRP `tlm`                                         |
| `src/abrp/client.ts`    | `createAbrpClient` — `POST /1/tlm/send`                        |
| `src/relay.ts`          | `createRelay` — coalesce + throttle + `StatusSnapshot`         |
| `src/types/status.ts`   | Dashboard/health snapshot schema                               |
| `web/`                  | Vite + React + shadcn dashboard                                |

## Standing decisions

- **Active vehicle:** first entry from `GET /vehicle-direct-access/?filter_permission=VEHICLE_IS_OWNER`. If the list is empty or the call fails, `CTECH_VEHICLE_ID`. `ABRP_CAR_MODEL` is required env (no default).
- **No Docker.** Local `pnpm`; Railway Nixpacks from `package.json`.
- **CT API login** with email/password. Dashboard login compares the same env credentials; it does **not** call CT `/account/login` (would mint a second token).
- **HV SoC** picks the fresher of `vehicle_status_hd.hd_hv_battery_soc_pct` (`hd_last_update`) and `state_of_charge_pct` (`last_update` / `timestamp`). Never use `battery_main_*` — that is the 12 V aux.
- **Parked speed is 0** when `status === "PARK"` or ignition is off.
- **No `power` / HV `voltage` / `current`** until those fields appear in the feed.
- **`hd_charge_status === 0`** means not charging until a charging snapshot confirms the enum.
- **Factories over classes.** Stateful modules are `createX` closures; only `Error` subclasses use `class`.
- **WS liveness ≠ feed freshness.** Protocol ping/pong detects dead sockets. No status ingest for 10 minutes → `stale` (skip ABRP, dashboard badge). Parked bikes often stop pushing on WS while REST `last_update` keeps moving — poll `GET /vehicle/{id}/status` every 5 minutes and again whenever the socket reaches `connected` (auto or manual reconnect). Manual `POST /api/reconnect` also forces an immediate REST refresh. Health stays based on WS path only.

## Field mapping

| ABRP                | Source                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `utc`               | `timestamp` / `last_update` → epoch seconds                                                                  |
| `soc`               | fresher of `hd_hv_battery_soc_pct` (`hd_last_update`) vs `state_of_charge_pct` (`last_update` / `timestamp`) |
| `lat` / `lon`       | top-level `latitude` / `longitude`                                                                           |
| `heading`           | `angle`                                                                                                      |
| `speed`             | `hd_vehicle_speed_km_h` → `speed`; `0` when parked                                                           |
| `odometer`          | `hd_odometer_m` / 1000 → `total_odometer` / 1000 (meters)                                                    |
| `est_battery_range` | `hd_range_remaining_lt_avg_m` / 1000                                                                         |
| `batt_temp`         | `hd_hv_battery_temperature_avg_deg_c`                                                                        |
| `is_charging`       | `hd_charge_status !== 0`                                                                                     |
| `is_parked`         | `status === "PARK"` or `hd_ignition_power_mode === 0` or `!ignition_on`                                      |
| `car_model`         | `ABRP_CAR_MODEL`                                                                                             |
| `capacity`          | `13.4`                                                                                                       |

## Auth

```
POST https://api.ctechnology.io/api/v2.2/account/login/
Authorization: Token {token}
WSS wss://api.ctechnology.io/api/v2.2/ws/ws-main  →  {"Authorization":"Token …"} on open
```

POST `/account/login/` needs a trailing slash (a 301 would turn POST into GET).  
GET `/vehicle/{id}/status` must **not** have a trailing slash (`/status/` is 404).  
GET `/vehicle-direct-access/?filter_permission=VEHICLE_IS_OWNER` uses a trailing slash (official app).

`header.message` may be `null` (not only omitted or `""`). Schemas treat it as `string | null`.

Refresh before `expiry` or on 401.

WebSocket: connect `wss://api.ctechnology.io/api/v2.2/ws/ws-main` with `Origin: https://api.ctechnology.io` (host root is Django 400; Node `ws` 403s without Origin). Immediately send `{"Authorization":"Token …"}` (official client key; docs say `authorization`). Incoming frames are JSON `{ header, data }`; `header.channel === "vehicle/status"` is forwarded (other channels ignored). Protocol ping every 30s; miss one pong → `terminate` and reconnect. Reconnect with exponential backoff (1s → 60s) and a fresh token.

**Feed freshness:** if no status has been ingested for 10 minutes (`STALE_AFTER_MS`), the snapshot is `stale`, ABRP sends are skipped (`skipped_stale`), and the dashboard shows a stale badge with a Reconnect action. Ingest comes from WS `vehicle/status` **or** REST catch-up (`REST_REFRESH_INTERVAL_MS` = 5 min, plus on every WS `connected`). `/health` still reports `stale` but `ok` only reflects WS liveness (so Railway does not restart a quiet parked bike). `POST /api/reconnect` (session) closes/reopens the WS and re-fetches REST vehicle status.

## Dashboard session

`POST /api/login` timing-safe compares email/password to `CTECH_EMAIL` / `CTECH_PASSWORD`. Cookie HMAC key is HKDF-derived from those credentials (no separate `SESSION_SECRET`). `/health` stays public. `GET /api/status`, `GET /api/events` (SSE), and `POST /api/reconnect` require the session. Production serves `dist/web` from the same process.
