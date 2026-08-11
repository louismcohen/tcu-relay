import type { Logger } from "pino";
import type { AbrpClient } from "./abrp/client.js";
import type { Config } from "./config.js";
import type { CtechAuth } from "./ctech/auth.js";
import type { ResolvedVehicle } from "./ctech/vehicles.js";
import type { CtechSocket } from "./ctech/ws.js";
import { defaultMapperContext, isParked, mapVehicleStatusToTlm, pickHvSoc } from "./mapper.js";
import type { AbrpTlm } from "./types/abrp.js";
import type { VehicleStatusData } from "./types/ctech.js";
import type { AbrpSnapshot, CtechSnapshot, StatusSnapshot } from "./types/status.js";

const BACKOFF_INITIAL_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

export interface Relay {
  onChange: (listener: () => void) => () => void;
  ingest: (status: VehicleStatusData) => void;
  snapshot: () => StatusSnapshot;
}

export function createRelay(
  config: Config,
  logger: Logger,
  startedAt: string,
  auth: CtechAuth,
  socket: CtechSocket,
  abrp: AbrpClient,
  vehicle: ResolvedVehicle,
): Relay {
  let latest: VehicleStatusData | undefined;
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let backoffMs = 0;
  let lastSentAt: string | undefined;
  let lastResult: string | undefined;
  let lastMissing: string | undefined;
  let lastTlm: AbrpTlm | undefined;
  let lastMessageAt: string | undefined;
  const changeListeners = new Set<() => void>();

  function emitChange(): void {
    for (const listener of changeListeners) {
      listener();
    }
  }

  function ctechSnapshot(): CtechSnapshot {
    const status = latest;
    const hd = status?.vehicle_status_hd;
    const snapshot: CtechSnapshot = {
      wsState: socket.getState(),
    };

    const tokenExpiry = auth.tokenExpiryIso();
    if (tokenExpiry !== undefined) {
      snapshot.tokenExpiry = tokenExpiry;
    }
    if (lastMessageAt !== undefined) {
      snapshot.lastMessageAt = lastMessageAt;
    }
    const parseError = socket.getLastParseError();
    if (parseError !== undefined) {
      snapshot.lastParseError = parseError;
    }
    if (status?.status !== null && status?.status !== undefined) {
      snapshot.vehicleStatus = status.status;
    }
    const soc = status === undefined ? undefined : pickHvSoc(status);
    if (soc !== undefined) {
      snapshot.soc = soc;
    }
    if (status?.latitude !== null && status?.latitude !== undefined) {
      snapshot.latitude = status.latitude;
    }
    if (status?.longitude !== null && status?.longitude !== undefined) {
      snapshot.longitude = status.longitude;
    }
    if (status !== undefined) {
      snapshot.parked = isParked(status);
    }
    if (hd?.hd_charge_status !== null && hd?.hd_charge_status !== undefined) {
      snapshot.charging = hd.hd_charge_status !== 0;
    }
    if (hd?.hd_last_update !== null && hd?.hd_last_update !== undefined) {
      snapshot.hdLastUpdate = hd.hd_last_update;
    }
    if (status?.timestamp !== undefined) {
      snapshot.gpsTimestamp = status.timestamp;
    }
    return snapshot;
  }

  function abrpSnapshot(): AbrpSnapshot {
    const snapshot: AbrpSnapshot = {};
    if (lastSentAt !== undefined) {
      snapshot.lastSentAt = lastSentAt;
    }
    if (lastResult !== undefined) {
      snapshot.lastResult = lastResult;
    }
    if (lastMissing !== undefined) {
      snapshot.lastMissing = lastMissing;
    }
    if (lastTlm !== undefined) {
      snapshot.lastTlm = lastTlm;
    }
    if (backoffMs > 0) {
      snapshot.backoffMs = backoffMs;
    }
    return snapshot;
  }

  function snapshot(): StatusSnapshot {
    const result: StatusSnapshot = {
      startedAt,
      vehicleId: vehicle.vehicleId,
      dryRun: config.DRY_RUN,
      sendIntervalMs: config.ABRP_SEND_INTERVAL_MS,
      uptimeSeconds: Math.floor((Date.now() - Date.parse(startedAt)) / 1000),
      ctech: ctechSnapshot(),
      abrp: abrpSnapshot(),
    };
    if (vehicle.vehicleName !== undefined) {
      result.vehicleName = vehicle.vehicleName;
    }
    return result;
  }

  function schedule(delayMs: number): void {
    if (sendTimer !== undefined || inFlight) {
      return;
    }
    const delay = Math.max(delayMs, backoffMs);
    sendTimer = setTimeout(() => {
      sendTimer = undefined;
      void flush();
    }, delay);
  }

  async function flush(): Promise<void> {
    const status = latest;
    if (status === undefined) {
      return;
    }

    const tlm = mapVehicleStatusToTlm(
      status,
      defaultMapperContext(config.ABRP_CAR_MODEL),
    );
    if (tlm === undefined) {
      logger.warn("skipped ABRP send: mapper produced no telemetry");
      return;
    }

    inFlight = true;
    try {
      if (config.DRY_RUN) {
        lastTlm = tlm;
        lastSentAt = new Date().toISOString();
        lastResult = "dry_run";
        lastMissing = undefined;
        backoffMs = 0;
        logger.info({ tlm }, "DRY_RUN ABRP telemetry");
        emitChange();
        return;
      }

      const result = await abrp.send(tlm);
      lastTlm = tlm;
      lastSentAt = new Date().toISOString();
      lastResult = result.status;
      lastMissing = result.missing;
      backoffMs = 0;
      logger.info(
        { status: result.status, missing: result.missing },
        "sent ABRP telemetry",
      );
      emitChange();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "ABRP send failed";
      lastResult = "error";
      lastMissing = message;
      backoffMs =
        backoffMs === 0
          ? BACKOFF_INITIAL_MS
          : Math.min(backoffMs * 2, BACKOFF_MAX_MS);
      logger.warn({ err: message, backoffMs }, "ABRP send failed");
      emitChange();
    } finally {
      inFlight = false;
      schedule(config.ABRP_SEND_INTERVAL_MS);
    }
  }

  return {
    onChange(listener) {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
    ingest(status) {
      const immediate =
        lastSentAt === undefined && sendTimer === undefined && !inFlight;
      latest = status;
      lastMessageAt = new Date().toISOString();
      emitChange();
      schedule(immediate ? 0 : config.ABRP_SEND_INTERVAL_MS);
    },
    snapshot,
  };
}
