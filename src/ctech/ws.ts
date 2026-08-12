import type { Logger } from "pino";
import WebSocket, { type RawData } from "ws";
import { WS_PING_INTERVAL_MS } from "../freshness.js";
import {
  wsVehicleStatusMessageSchema,
  type VehicleStatusData,
} from "../types/ctech.js";
import type { CtechAuth } from "./auth.js";
import { CTECH_WS_ORIGIN, CTECH_WS_URL } from "./constants.js";

export type CtechWsState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

export type StatusListener = (status: VehicleStatusData) => void;

export interface CtechSocket {
  getState: () => CtechWsState;
  getLastParseError: () => string | undefined;
  onStatus: (listener: StatusListener) => () => void;
  start: () => void;
  stop: () => void;
  /** Close any open socket and connect immediately (resets backoff). */
  reconnect: () => void;
}

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

export function createCtechSocket(
  vehicleId: string,
  auth: CtechAuth,
  logger: Logger,
): CtechSocket {
  let socket: WebSocket | undefined;
  let state: CtechWsState = "disconnected";
  const listeners = new Set<StatusListener>();
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let backoffMs = BACKOFF_INITIAL_MS;
  let stopped = true;
  let lastParseError: string | undefined;

  function setState(next: CtechWsState): void {
    if (state === next) {
      return;
    }
    state = next;
    logger.info({ wsState: next }, "c.technology websocket state");
  }

  function clearReconnect(): void {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  function clearPing(): void {
    if (pingTimer !== undefined) {
      clearInterval(pingTimer);
      pingTimer = undefined;
    }
  }

  function startPing(target: WebSocket): void {
    clearPing();
    let alive = true;
    target.on("pong", () => {
      alive = true;
    });
    pingTimer = setInterval(() => {
      if (target.readyState !== WebSocket.OPEN) {
        return;
      }
      if (!alive) {
        logger.warn("c.technology websocket ping timeout; terminating");
        target.terminate();
        return;
      }
      alive = false;
      target.ping();
    }, WS_PING_INTERVAL_MS);
  }

  function closeSocket(): void {
    clearPing();
    if (socket === undefined) {
      return;
    }
    socket.removeAllListeners();
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
    socket = undefined;
  }

  function scheduleReconnect(): void {
    clearReconnect();
    setState("reconnecting");
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    logger.info({ delayMs: delay }, "reconnecting c.technology websocket");
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  }

  function handleMessage(data: RawData): void {
    let text: string;
    try {
      text = rawDataToUtf8(data);
    } catch (error: unknown) {
      lastParseError = error instanceof Error ? error.message : "binary decode failed";
      logger.warn({ err: lastParseError }, "websocket frame was not utf-8 text");
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      lastParseError = "message was not valid JSON";
      logger.warn("websocket message was not valid JSON");
      return;
    }

    const parsed = wsVehicleStatusMessageSchema.safeParse(raw);
    if (!parsed.success) {
      logger.debug({ preview: text.slice(0, 200) }, "ignored non-status websocket message");
      return;
    }

    const channel = parsed.data.header.channel;
    if (channel !== undefined && channel !== "vehicle/status") {
      logger.debug({ channel }, "ignored websocket channel");
      return;
    }

    const status = parsed.data.data;
    const frameVehicleId = status.vehicle_id;
    if (frameVehicleId !== undefined && frameVehicleId !== vehicleId) {
      return;
    }

    lastParseError = undefined;
    for (const listener of listeners) {
      listener(status);
    }
  }

  async function connect(): Promise<void> {
    if (stopped) {
      return;
    }
    setState(backoffMs === BACKOFF_INITIAL_MS ? "connecting" : "reconnecting");

    let authorization: string;
    try {
      authorization = await auth.authorizationHeader();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "auth failed";
      logger.warn({ err: message }, "websocket deferred until auth succeeds");
      scheduleReconnect();
      return;
    }

    const next = new WebSocket(CTECH_WS_URL, {
      headers: { Origin: CTECH_WS_ORIGIN },
    });
    socket = next;

    next.on("open", () => {
      setState("authenticating");
      next.send(JSON.stringify({ Authorization: authorization }));
      logger.debug("sent websocket auth");
      setState("connected");
      backoffMs = BACKOFF_INITIAL_MS;
      startPing(next);
    });

    next.on("message", (data: RawData) => {
      handleMessage(data);
    });

    next.on("error", (error: Error) => {
      logger.warn({ err: error.message }, "c.technology websocket error");
    });

    next.on("close", (code: number, reason: Buffer) => {
      clearPing();
      logger.warn(
        { code, reason: reason.toString("utf8") },
        "c.technology websocket closed",
      );
      if (socket === next) {
        socket = undefined;
      }
      if (!stopped) {
        scheduleReconnect();
      }
    });
  }

  return {
    getState: () => state,
    getLastParseError: () => lastParseError,
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      stopped = false;
      void connect();
    },
    stop() {
      stopped = true;
      clearReconnect();
      closeSocket();
      setState("disconnected");
    },
    reconnect() {
      stopped = false;
      clearReconnect();
      // removeAllListeners before close so the close handler does not schedule backoff
      closeSocket();
      backoffMs = BACKOFF_INITIAL_MS;
      logger.info("manual c.technology websocket reconnect");
      void connect();
    },
  };
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
