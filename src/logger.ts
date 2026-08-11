import pino from "pino";
import type { Config } from "./config.js";

export function createLogger(config: Config): pino.Logger {
  const pretty = process.stdout.isTTY;
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        "password",
        "email",
        "token",
        "authorization",
        "apiKey",
        "api_key",
        "*.password",
        "*.token",
      ],
      remove: true,
    },
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        }
      : {}),
  });
}
