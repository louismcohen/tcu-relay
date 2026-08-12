import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Logger } from "pino";
import type { Config } from "./config.js";
import {
  clearSessionCookie,
  createSessionCookie,
  credentialsMatch,
  readSession,
} from "./session.js";
import type { StatusSnapshot } from "./types/status.js";

const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist/web",
);

const sseClients = new Set<ServerResponse>();

export function createHttpServer(
  config: Config,
  logger: Logger,
  getSnapshot: () => StatusSnapshot,
  reconnect: () => Promise<void>,
): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    void handleRequest(config, logger, getSnapshot, reconnect, req, res);
  });
}

export function broadcastSnapshot(snapshot: StatusSnapshot): void {
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
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

async function handleRequest(
  config: Config,
  logger: Logger,
  getSnapshot: () => StatusSnapshot,
  reconnect: () => Promise<void>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = req.url ?? "/";
  const pathName = url.split("?")[0] ?? "/";
  const method = req.method ?? "GET";

  try {
    if (method === "GET" && pathName === "/health") {
      writeHealth(res, getSnapshot());
      return;
    }

    if (method === "POST" && pathName === "/api/login") {
      await handleLogin(config, req, res);
      return;
    }

    if (method === "POST" && pathName === "/api/logout") {
      res.writeHead(204, { "set-cookie": clearSessionCookie() });
      res.end();
      return;
    }

    if (method === "GET" && pathName === "/api/me") {
      if (!requireSession(config, req, res)) {
        return;
      }
      writeJson(res, 200, { ok: true });
      return;
    }

    if (method === "GET" && pathName === "/api/status") {
      if (!requireSession(config, req, res)) {
        return;
      }
      writeJson(res, 200, getSnapshot());
      return;
    }

    if (method === "POST" && pathName === "/api/reconnect") {
      if (!requireSession(config, req, res)) {
        return;
      }
      await reconnect();
      writeJson(res, 200, getSnapshot());
      return;
    }

    if (method === "GET" && pathName === "/api/events") {
      if (!requireSession(config, req, res)) {
        return;
      }
      attachSse(req, res, getSnapshot());
      return;
    }

    if (method === "GET") {
      await serveStatic(pathName, res);
      return;
    }

    logger.debug({ method, url }, "unhandled request");
    writeJson(res, 404, { error: "not_found" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "request failed";
    logger.error({ err: message, method, url }, "http handler error");
    if (!res.headersSent) {
      writeJson(res, 500, { error: "internal_error" });
    }
  }
}

async function handleLogin(
  config: Config,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readBody(req);
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    writeJson(res, 400, { error: "invalid_json" });
    return;
  }

  const parsed = loginBodySchema.safeParse(json);
  if (!parsed.success) {
    writeJson(res, 400, { error: "invalid_body" });
    return;
  }

  if (
    !credentialsMatch(
      parsed.data.email,
      parsed.data.password,
      config.CTECH_EMAIL,
      config.CTECH_PASSWORD,
    )
  ) {
    writeJson(res, 401, { error: "invalid_credentials" });
    return;
  }

  res.writeHead(204, {
    "set-cookie": createSessionCookie(parsed.data.email, config.sessionSecret),
  });
  res.end();
}

function requireSession(
  config: Config,
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const session = readSession(req.headers.cookie, config.sessionSecret);
  if (session === undefined) {
    writeJson(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

function attachSse(
  req: IncomingMessage,
  res: ServerResponse,
  snapshot: StatusSnapshot,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
}

function writeHealth(res: ServerResponse, snapshot: StatusSnapshot): void {
  const ok =
    snapshot.ctech.wsState === "connected" ||
    snapshot.ctech.wsState === "connecting" ||
    snapshot.ctech.wsState === "authenticating" ||
    snapshot.ctech.wsState === "reconnecting";
  writeJson(res, ok ? 200 : 503, {
    ok,
    stale: snapshot.stale,
    startedAt: snapshot.startedAt,
    wsState: snapshot.ctech.wsState,
    lastMessageAt: snapshot.ctech.lastMessageAt,
    lastAbrpResult: snapshot.abrp.lastResult,
  });
}

async function serveStatic(urlPath: string, res: ServerResponse): Promise<void> {
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(webRoot, relative));
  if (!filePath.startsWith(webRoot)) {
    writeJson(res, 403, { error: "forbidden" });
    return;
  }

  try {
    await access(filePath);
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error("not a file");
    }
    const type = contentType(filePath);
    res.writeHead(200, { "content-type": type });
    createReadStream(filePath).pipe(res);
  } catch {
    try {
      const indexPath = path.join(webRoot, "index.html");
      await access(indexPath);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      createReadStream(indexPath).pipe(res);
    } catch {
      writeJson(res, 404, { error: "not_found" });
    }
  }
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 64_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}
