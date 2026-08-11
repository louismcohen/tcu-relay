import { loadConfig } from "./config.js";
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
  logger.info(
    { vehicleId: config.CTECH_VEHICLE_ID, dryRun: config.DRY_RUN },
    "tcu-relay started",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(message);
  process.exit(1);
});
