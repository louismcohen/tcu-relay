import { AbrpClient } from "./abrp/client.js";
import { loadConfig } from "./config.js";
import { CtechAuth } from "./ctech/auth.js";
import { fetchVehicleStatus } from "./ctech/rest.js";
import { CtechWebSocket } from "./ctech/ws.js";
import { broadcastSnapshot, createHttpServer, listen } from "./http.js";
import { createLogger } from "./logger.js";
import { Relay } from "./relay.js";

const startedAt = new Date().toISOString();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const auth = new CtechAuth(config, logger);
  const socket = new CtechWebSocket(config, auth, logger);
  const abrp = new AbrpClient(config.ABRP_API_KEY, config.ABRP_TOKEN, logger);
  const relay = new Relay(config, logger, startedAt, auth, socket, abrp);

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
