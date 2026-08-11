import { createAbrpClient } from "./abrp/client.js";
import { loadConfig } from "./config.js";
import { createCtechAuth } from "./ctech/auth.js";
import { fetchOwnedVehicles, fetchVehicleStatus } from "./ctech/rest.js";
import { resolveVehicle, type ListedVehicle } from "./ctech/vehicles.js";
import { createCtechSocket } from "./ctech/ws.js";
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

  const server = createHttpServer(config, logger, () => relay.snapshot());
  await listen(server, config.PORT, logger);
  relay.onChange(() => {
    broadcastSnapshot(relay.snapshot());
  });

  const status = await fetchVehicleStatus(auth, vehicle.vehicleId, logger);
  logger.info(
    {
      vehicleId: status.vehicle_id ?? vehicle.vehicleId,
      vehicleStatus: status.status,
      soc: pickHvSoc(status),
      timestamp: status.timestamp,
      dryRun: config.DRY_RUN,
    },
    "bootstrapped vehicle status",
  );
  relay.ingest(status);

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
  socket.start();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(message);
  process.exit(1);
});
