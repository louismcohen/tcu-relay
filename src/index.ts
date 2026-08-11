import { loadConfig } from "./config.js";
import { CtechAuth } from "./ctech/auth.js";
import { fetchVehicleStatus } from "./ctech/rest.js";
import { createHttpServer, listen } from "./http.js";
import { createLogger } from "./logger.js";

const startedAt = new Date().toISOString();

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const server = createHttpServer(logger, () => ({
    startedAt,
    ok: true,
  }));

  await listen(server, config.PORT, logger);

  const auth = new CtechAuth(config, logger);
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
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(message);
  process.exit(1);
});
