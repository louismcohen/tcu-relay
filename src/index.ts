import { createAbrpClient } from "./abrp/client.js";
import { loadConfig } from "./config.js";
import { createCtechAuth } from "./ctech/auth.js";
import { fetchOwnedVehicles, fetchVehicleStatus } from "./ctech/rest.js";
import { resolveVehicle, type ListedVehicle } from "./ctech/vehicles.js";
import { createCtechSocket } from "./ctech/ws.js";
import { REST_REFRESH_INTERVAL_MS } from "./freshness.js";
import { broadcastSnapshot, createHttpServer, listen } from "./http.js";
import { createLogger } from "./logger.js";
import { pickHvSoc } from "./mapper.js";
import { createRelay } from "./relay.js";

const startedAt = new Date().toISOString();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const auth = createCtechAuth(config, logger);

  let listed: ListedVehicle[] = [];
  try {
    listed = await fetchOwnedVehicles(auth, logger);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "owned vehicles failed";
    logger.warn({ err: message }, "owned vehicle list failed; falling back to CTECH_VEHICLE_ID");
  }

  const vehicle = resolveVehicle(listed, config.CTECH_VEHICLE_ID);
  logger.info(
    {
      vehicleId: vehicle.vehicleId,
      vehicleName: vehicle.vehicleName,
      source: vehicle.source,
      listedCount: listed.length,
    },
    "resolved relay vehicle",
  );

  const socket = createCtechSocket(vehicle.vehicleId, auth, logger);
  const abrp = createAbrpClient(config.ABRP_API_KEY, config.ABRP_TOKEN, logger);
  const relay = createRelay(config, logger, startedAt, auth, socket, abrp, vehicle);

  let refreshInFlight: Promise<void> | undefined;

  async function refreshFromRest(reason: string): Promise<void> {
    if (refreshInFlight !== undefined) {
      await refreshInFlight;
      return;
    }
    refreshInFlight = (async () => {
      const status = await fetchVehicleStatus(auth, vehicle.vehicleId, logger);
      logger.info(
        {
          reason,
          vehicleId: status.vehicle_id ?? vehicle.vehicleId,
          vehicleStatus: status.status,
          soc: pickHvSoc(status),
          timestamp: status.timestamp,
        },
        "refreshed vehicle status from REST",
      );
      relay.ingest(status);
    })();
    try {
      await refreshInFlight;
    } finally {
      refreshInFlight = undefined;
    }
  }

  async function reconnectFeed(): Promise<void> {
    socket.reconnect();
    broadcastSnapshot(relay.snapshot());
    try {
      await refreshFromRest("manual_reconnect");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "REST refresh failed";
      logger.warn({ err: message }, "REST refresh after reconnect failed");
    }
  }

  const server = createHttpServer(
    config,
    logger,
    () => relay.snapshot(),
    reconnectFeed,
  );
  await listen(server, config.PORT, logger);
  relay.onChange(() => {
    broadcastSnapshot(relay.snapshot());
  });

  try {
    await refreshFromRest("bootstrap");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "bootstrap status failed";
    logger.error({ err: message }, "failed to bootstrap vehicle status");
    throw error;
  }

  socket.onStatus((update) => {
    logger.info(
      {
        timestamp: update.timestamp,
        vehicleStatus: update.status,
        soc: pickHvSoc(update),
      },
      "vehicle status update",
    );
    relay.ingest(update);
  });

  socket.onState((state) => {
    broadcastSnapshot(relay.snapshot());
    if (state !== "connected") {
      return;
    }
    void refreshFromRest("ws_connected").catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "REST refresh failed";
      logger.warn({ err: message }, "REST refresh after websocket connected failed");
    });
  });

  setInterval(() => {
    void refreshFromRest("periodic").catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "REST refresh failed";
      logger.warn({ err: message }, "periodic REST status refresh failed");
    });
  }, REST_REFRESH_INTERVAL_MS);

  socket.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(message);
  process.exit(1);
});
