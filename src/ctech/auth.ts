import type { Logger } from "pino";
import type { Config } from "../config.js";
import { ctechLoginResponseSchema } from "../types/ctech.js";
import { ctechUrl, readResponseBody, TOKEN_REFRESH_MARGIN_MS } from "./constants.js";

export class CtechAuthError extends Error {
  override readonly name = "CtechAuthError";

  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

export interface CtechAuth {
  getToken: () => Promise<string>;
  authorizationHeader: () => Promise<string>;
  tokenExpiryIso: () => string | undefined;
  invalidate: () => void;
}

export function createCtechAuth(config: Config, logger: Logger): CtechAuth {
  let token: string | undefined;
  let expiryMs: number | undefined;

  function isFresh(): boolean {
    return (
      token !== undefined &&
      expiryMs !== undefined &&
      expiryMs - Date.now() > TOKEN_REFRESH_MARGIN_MS
    );
  }

  async function login(): Promise<void> {
    const response = await fetch(ctechUrl("account/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: config.CTECH_EMAIL,
        password: config.CTECH_PASSWORD,
      }),
    });

    const raw = await readResponseBody(response);
    if (!response.ok) {
      logger.warn({ status: response.status, body: raw }, "c.technology login failed");
      throw new CtechAuthError(
        `login HTTP ${String(response.status)}`,
        response.status,
      );
    }

    const parsed = ctechLoginResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error(
        { issues: parsed.error.issues },
        "c.technology login response failed validation",
      );
      throw new CtechAuthError("login response failed validation");
    }

    if (parsed.data.header.status !== "SUCCESS") {
      throw new CtechAuthError(
        parsed.data.header.message ?? "login header status was not SUCCESS",
      );
    }

    token = parsed.data.data.token;
    expiryMs = Date.parse(parsed.data.data.expiry);
    if (Number.isNaN(expiryMs)) {
      throw new CtechAuthError("login expiry was not a valid datetime");
    }

    logger.info(
      { expiry: parsed.data.data.expiry },
      "c.technology login succeeded",
    );
  }

  async function getToken(): Promise<string> {
    if (isFresh()) {
      if (token === undefined) {
        throw new CtechAuthError("token missing despite fresh session");
      }
      return token;
    }
    await login();
    if (token === undefined) {
      throw new CtechAuthError("login succeeded without a token");
    }
    return token;
  }

  return {
    getToken,
    async authorizationHeader() {
      return `Token ${await getToken()}`;
    },
    tokenExpiryIso() {
      if (expiryMs === undefined) {
        return undefined;
      }
      return new Date(expiryMs).toISOString();
    },
    invalidate() {
      token = undefined;
      expiryMs = undefined;
    },
  };
}
