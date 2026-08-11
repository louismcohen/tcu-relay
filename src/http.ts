import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Logger } from "pino";
export interface HealthState {
  readonly startedAt: string;
  readonly ok: boolean;
}

export function createHttpServer(
  logger: Logger,
  getHealth: () => HealthState,
): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    if (method === "GET" && (url === "/health" || url.startsWith("/health?"))) {
      const health = getHealth();
      const body = JSON.stringify(health);
      res.writeHead(health.ok ? 200 : 503, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(body);
      return;
    }

    logger.debug({ method, url }, "unhandled request");
    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
}

export function listen(server: Server, port: number, logger: Logger): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      logger.info({ port }, "http server listening");
      resolve();
    });
  });
}
