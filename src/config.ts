import { config as loadDotenv } from "dotenv";
import { z } from "zod";

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
  CTECH_VEHICLE_ID: z.string().min(1).default("veh_01kmzq0g8gf82bd0p48zkb3cqe"),
  ABRP_API_KEY: z.string().min(1),
  ABRP_TOKEN: z.string().min(1),
  ABRP_CAR_MODEL: z
    .string()
    .min(1)
    .default("harleydavidson:livewire:22:16:rwd:livewire"),
  ABRP_SEND_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  DRY_RUN: booleanFromEnv.default(true),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SESSION_SECRET: z.string().min(16),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): Config {
  return envSchema.parse(env);
}
