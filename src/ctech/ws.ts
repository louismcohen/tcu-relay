import type { Logger } from "pino";
import WebSocket, { type RawData } from "ws";
import type { Config } from "../config.js";
import {
  wsVehicleStatusMessageSchema,
  type VehicleStatusData,
} from "../types/ctech.js";
import type { CtechAuth } from "./auth.js";
import { CTECH_WS_URL } from "./constants.js";

export type CtechWsState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

export type StatusListener = (status: VehicleStatusData) => void;

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

export class CtechWebSocket {
  private socket: WebSocket | undefined;
  private state: CtechWsState = "disconnected";
  private listeners = new Set<StatusListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private backoffMs = BACKOFF_INITIAL_MS;
  private stopped = true;
  private lastParseError: string | undefined;

  public constructor(
    private readonly config: Config,
    private readonly auth: CtechAuth,
    private readonly logger: Logger,
  ) {}

  public getState(): CtechWsState {
    return this.state;
  }

  public getLastParseError(): string | undefined {
    return this.lastParseError;
  }

  public onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public start(): void {
    this.stopped = false;
    void this.connect();
  }

  public stop(): void {
    this.stopped = true;
    this.clearReconnect();
    this.closeSocket();
    this.setState("disconnected");
  }

  private setState(state: CtechWsState): void {
    if (this.state === state) {
      return;
    }
    this.state = state;
    this.logger.info({ wsState: state }, "c.technology websocket state");
  }

  private async connect(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.setState(this.backoffMs === BACKOFF_INITIAL_MS ? "connecting" : "reconnecting");

    let authorization: string;
    try {
      authorization = await this.auth.authorizationHeader();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "auth failed";
      this.logger.warn({ err: message }, "websocket deferred until auth succeeds");
      this.scheduleReconnect();
      return;
    }

    const socket = new WebSocket(CTECH_WS_URL);
    this.socket = socket;

    socket.on("open", () => {
      this.setState("authenticating");
      const authMessage = { authorization };
      socket.send(JSON.stringify(authMessage));
      this.logger.debug("sent websocket auth");
      this.setState("connected");
      this.backoffMs = BACKOFF_INITIAL_MS;
    });

    socket.on("message", (data: RawData) => {
      this.handleMessage(data);
    });

    socket.on("error", (error: Error) => {
      this.logger.warn({ err: error.message }, "c.technology websocket error");
    });

    socket.on("close", (code: number, reason: Buffer) => {
      this.logger.warn(
        { code, reason: reason.toString("utf8") },
        "c.technology websocket closed",
      );
      if (this.socket === socket) {
        this.socket = undefined;
      }
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    });
  }

  private handleMessage(data: RawData): void {
    let text: string;
    try {
      text = rawDataToUtf8(data);
    } catch (error: unknown) {
      this.lastParseError = error instanceof Error ? error.message : "binary decode failed";
      this.logger.warn({ err: this.lastParseError }, "websocket frame was not utf-8 text");
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      this.lastParseError = "message was not valid JSON";
      this.logger.warn("websocket message was not valid JSON");
      return;
    }

    const parsed = wsVehicleStatusMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.debug({ preview: text.slice(0, 200) }, "ignored non-status websocket message");
      return;
    }

    const channel = parsed.data.header.channel;
    if (channel !== undefined && channel !== "vehicle/status") {
      this.logger.debug({ channel }, "ignored websocket channel");
      return;
    }

    const status = parsed.data.data;
    const vehicleId = status.vehicle_id;
    if (vehicleId !== undefined && vehicleId !== this.config.CTECH_VEHICLE_ID) {
      return;
    }

    this.lastParseError = undefined;
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.setState("reconnecting");
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    this.logger.info({ delayMs: delay }, "reconnecting c.technology websocket");
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private closeSocket(): void {
    if (this.socket === undefined) {
      return;
    }
    this.socket.removeAllListeners();
    if (
      this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING
    ) {
      this.socket.close();
    }
    this.socket = undefined;
  }
}

function rawDataToUtf8(data: RawData): string {
  if (typeof data === "string") {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return Buffer.from(data).toString("utf8");
}
