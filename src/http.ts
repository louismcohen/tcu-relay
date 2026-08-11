import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Logger } from "pino";
import type { StatusSnapshot } from "./types/status.js";

export function createHttpServer(
  logger: Logger,
  getSnapshot: () => StatusSnapshot,
): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0] ?? "/";
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/health") {
      const snapshot = getSnapshot();
      const ok =
        snapshot.ctech.lastMessageAt !== undefined ||
        snapshot.ctech.wsState === "connected" ||
        snapshot.ctech.wsState === "connecting" ||
        snapshot.ctech.wsState === "authenticating" ||
        snapshot.ctech.wsState === "reconnecting";
      const body = JSON.stringify({
        ok,
        startedAt: snapshot.startedAt,
        wsState: snapshot.ctech.wsState,
        lastMessageAt: snapshot.ctech.lastMessageAt,
        lastAbrpResult: snapshot.abrp.lastResult,
      });
      res.writeHead(ok ? 200 : 503, {
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
