import { createAbrpClient } from "./abrp/client.js";
import { loadConfig } from "./config.js";
import { createCtechAuth } from "./ctech/auth.js";
import { fetchVehicleStatus } from "./ctech/rest.js";
import { createCtechSocket } from "./ctech/ws.js";
import { broadcastSnapshot, createHttpServer, listen } from "./http.js";
import { createLogger } from "./logger.js";
import { createRelay } from "./relay.js";

const startedAt = new Date().toISOString();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const auth = createCtechAuth(config, logger);
  const socket = createCtechSocket(config, auth, logger);
  const abrp = createAbrpClient(config.ABRP_API_KEY, config.ABRP_TOKEN, logger);
  const relay = createRelay(config, logger, startedAt, auth, socket, abrp);

  const server = createHttpServer(config, logger, () => relay.snapshot());
  await listen(server, config.PORT, logger);
  relay.onChange(() => {
    broadcastSnapshot(relay.snapshot());
  });

  const status = await fetchVehicleStatus(
    auth,
    config.CTECH_VEHICLE_ID,
    logger,
  );
  logger.info(
    {
      vehicleId: status.vehicle_id ?? config.CTECH_VEHICLE_ID,
      vehicleStatus: status.status,
      soc: status.vehicle_status_hd?.hd_hv_battery_soc_pct ?? status.state_of_charge_pct,
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
        soc:
          update.vehicle_status_hd?.hd_hv_battery_soc_pct ??
          update.state_of_charge_pct,
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
