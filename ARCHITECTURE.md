# Architecture

Single Node process: c.technology client + ABRP forwarder + HTTP (health, later dashboard).

```
LiveWire TCU → c.technology cloud
                    │
                    ├─ REST  POST /api/v2.2/account/login
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

| Path | Role |
| --- | --- |
| `src/config.ts` | Zod-validated env |
| `src/logger.ts` | Pino (redacts secrets) |
| `src/http.ts` | Health (and later login / status / SSE / static UI) |
| `src/ctech/auth.ts` | Login + token refresh (60s margin) |
| `src/ctech/rest.ts` | `GET /vehicle/{id}/status` |
| `src/ctech/ws.ts` | WSS connect, auth message, reconnect backoff |
| `src/types/ctech.ts` | Zod envelopes for login + status |
| `src/mapper.ts` | CT status → ABRP `tlm` |
| `src/abrp/client.ts` | `POST /1/tlm/send` |
| `src/relay.ts` | Coalesce + throttle + `StatusSnapshot` |
| `src/types/status.ts` | Dashboard/health snapshot schema |
| `web/` | Vite + React + shadcn dashboard |

## Standing decisions

- **One vehicle:** `veh_01kmzq0g8gf82bd0p48zkb3cqe` (LiveWire 2022). ABRP `car_model` = `harleydavidson:livewire:22:16:rwd:livewire`.
- **No Docker.** Local `pnpm`; Railway Nixpacks from `package.json`.
- **CT API login** with email/password. Dashboard login compares the same env credentials; it does **not** call CT `/account/login` (would mint a second token).
- **HV SoC** comes from `vehicle_status_hd.hd_hv_battery_soc_pct` (fallback `state_of_charge_pct`). Never use `battery_main_*` — that is the 12 V aux.
- **Parked speed is 0** when `status === "PARK"` or ignition is off.
- **No `power` / HV `voltage` / `current`** until those fields appear in the feed.
- **`hd_charge_status === 0`** means not charging until a charging snapshot confirms the enum.

## Field mapping

| ABRP | Source |
| --- | --- |
| `utc` | `timestamp` / `last_update` → epoch seconds |
| `soc` | `vehicle_status_hd.hd_hv_battery_soc_pct` → `state_of_charge_pct` |
| `lat` / `lon` | top-level `latitude` / `longitude` |
| `heading` | `angle` |
| `speed` | `hd_vehicle_speed_km_h` → `speed`; `0` when parked |
| `odometer` | `hd_odometer_m` / 1000 → `total_odometer` / 1000 (meters) |
| `est_battery_range` | `hd_range_remaining_lt_avg_m` / 1000 |
| `batt_temp` | `hd_hv_battery_temperature_avg_deg_c` |
| `is_charging` | `hd_charge_status !== 0` |
| `is_parked` | `status === "PARK"` or `hd_ignition_power_mode === 0` or `!ignition_on` |
| `car_model` | `ABRP_CAR_MODEL` |
| `capacity` | `15.5` |

## Auth

```
POST https://api.ctechnology.io/api/v2.2/account/login
Authorization: Token {token}
WSS wss://api.ctechnology.io  →  {"authorization":"Token …"} on auth
```

Refresh before `expiry` or on 401.

WebSocket: connect `wss://api.ctechnology.io`, immediately send `{"authorization":"Token …"}` (auth channel). Incoming frames are JSON `{ header, data }`; `header.channel === "vehicle/status"` is forwarded (other channels ignored). Reconnect with exponential backoff (1s → 60s) and a fresh token.

## Dashboard session

`POST /api/login` timing-safe compares email/password to `CTECH_EMAIL` / `CTECH_PASSWORD`. Signed httpOnly cookie via `SESSION_SECRET`. `/health` stays public.
