import type { Logger } from "pino";
import type { AbrpClient } from "./abrp/client.js";
import type { Config } from "./config.js";
import type { CtechAuth } from "./ctech/auth.js";
import type { CtechWebSocket } from "./ctech/ws.js";
import { defaultMapperContext, isParked, mapVehicleStatusToTlm } from "./mapper.js";
import type { AbrpTlm } from "./types/abrp.js";
import type { VehicleStatusData } from "./types/ctech.js";
import type { AbrpSnapshot, CtechSnapshot, StatusSnapshot } from "./types/status.js";

const BACKOFF_INITIAL_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

export class Relay {
  private latest: VehicleStatusData | undefined;
  private sendTimer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private backoffMs = 0;
  private lastSentAt: string | undefined;
  private lastResult: string | undefined;
  private lastMissing: string | undefined;
  private lastTlm: AbrpTlm | undefined;
  private lastMessageAt: string | undefined;

  public constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    private readonly startedAt: string,
    private readonly auth: CtechAuth,
    private readonly socket: CtechWebSocket,
    private readonly abrp: AbrpClient,
  ) {}

  public ingest(status: VehicleStatusData): void {
    const immediate =
      this.lastSentAt === undefined &&
      this.sendTimer === undefined &&
      !this.inFlight;
    this.latest = status;
    this.lastMessageAt = new Date().toISOString();
    this.schedule(immediate ? 0 : this.config.ABRP_SEND_INTERVAL_MS);
  }

  public snapshot(): StatusSnapshot {
    return {
      startedAt: this.startedAt,
      vehicleId: this.config.CTECH_VEHICLE_ID,
      dryRun: this.config.DRY_RUN,
      sendIntervalMs: this.config.ABRP_SEND_INTERVAL_MS,
      uptimeSeconds: Math.floor(
        (Date.now() - Date.parse(this.startedAt)) / 1000,
      ),
      ctech: this.ctechSnapshot(),
      abrp: this.abrpSnapshot(),
    };
  }

  private ctechSnapshot(): CtechSnapshot {
    const status = this.latest;
    const hd = status?.vehicle_status_hd;
    const snapshot: CtechSnapshot = {
      wsState: this.socket.getState(),
    };

    const tokenExpiry = this.auth.tokenExpiryIso();
    if (tokenExpiry !== undefined) {
      snapshot.tokenExpiry = tokenExpiry;
    }
    if (this.lastMessageAt !== undefined) {
      snapshot.lastMessageAt = this.lastMessageAt;
    }
    const parseError = this.socket.getLastParseError();
    if (parseError !== undefined) {
      snapshot.lastParseError = parseError;
    }
    if (status?.status !== null && status?.status !== undefined) {
      snapshot.vehicleStatus = status.status;
    }
    const soc = hd?.hd_hv_battery_soc_pct ?? status?.state_of_charge_pct;
    if (soc !== null && soc !== undefined) {
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

  private abrpSnapshot(): AbrpSnapshot {
    const snapshot: AbrpSnapshot = {};
    if (this.lastSentAt !== undefined) {
      snapshot.lastSentAt = this.lastSentAt;
    }
    if (this.lastResult !== undefined) {
      snapshot.lastResult = this.lastResult;
    }
    if (this.lastMissing !== undefined) {
      snapshot.lastMissing = this.lastMissing;
    }
    if (this.lastTlm !== undefined) {
      snapshot.lastTlm = this.lastTlm;
    }
    if (this.backoffMs > 0) {
      snapshot.backoffMs = this.backoffMs;
    }
    return snapshot;
  }

  private schedule(delayMs: number): void {
    if (this.sendTimer !== undefined || this.inFlight) {
      return;
    }
    const delay = Math.max(delayMs, this.backoffMs);
    this.sendTimer = setTimeout(() => {
      this.sendTimer = undefined;
      void this.flush();
    }, delay);
  }

  private async flush(): Promise<void> {
    const status = this.latest;
    if (status === undefined) {
      return;
    }

    const tlm = mapVehicleStatusToTlm(
      status,
      defaultMapperContext(this.config.ABRP_CAR_MODEL),
    );
    if (tlm === undefined) {
      this.logger.warn("skipped ABRP send: mapper produced no telemetry");
      return;
    }

    this.inFlight = true;
    try {
      if (this.config.DRY_RUN) {
        this.lastTlm = tlm;
        this.lastSentAt = new Date().toISOString();
        this.lastResult = "dry_run";
        this.lastMissing = undefined;
        this.backoffMs = 0;
        this.logger.info({ tlm }, "DRY_RUN ABRP telemetry");
        return;
      }

      const result = await this.abrp.send(tlm);
      this.lastTlm = tlm;
      this.lastSentAt = new Date().toISOString();
      this.lastResult = result.status;
      this.lastMissing = result.missing;
      this.backoffMs = 0;
      this.logger.info(
        { status: result.status, missing: result.missing },
        "sent ABRP telemetry",
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "ABRP send failed";
      this.lastResult = "error";
      this.lastMissing = message;
      this.backoffMs =
        this.backoffMs === 0
          ? BACKOFF_INITIAL_MS
          : Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
      this.logger.warn({ err: message, backoffMs: this.backoffMs }, "ABRP send failed");
    } finally {
      this.inFlight = false;
      this.schedule(this.config.ABRP_SEND_INTERVAL_MS);
    }
  }
}
