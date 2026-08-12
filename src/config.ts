import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { deriveSessionSecret } from "./session.js";

loadDotenv();

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((value): boolean => {
    if (typeof value === "boolean") {
      return value;
    }
    return value === "true" || value === "1";
  });

const envSchema = z.object({
  CTECH_EMAIL: z.email(),
  CTECH_PASSWORD: z.string().min(1),
  CTECH_VEHICLE_ID: z.string().min(1),
  ABRP_API_KEY: z.string().min(1),
  ABRP_TOKEN: z.string().min(1),
  ABRP_CAR_MODEL: z.string().min(1),
  ABRP_SEND_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  DRY_RUN: booleanFromEnv.default(true),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Config = z.infer<typeof envSchema> & {
  readonly sessionSecret: string;
};

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): Config {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    sessionSecret: deriveSessionSecret(parsed.CTECH_EMAIL, parsed.CTECH_PASSWORD),
  };
}
