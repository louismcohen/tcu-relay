import type { Logger } from "pino";
import type { Config } from "../config.js";
import { ctechLoginResponseSchema } from "../types/ctech.js";
import { CTECH_API_BASE, TOKEN_REFRESH_MARGIN_MS } from "./constants.js";

export class CtechAuthError extends Error {
  public override readonly name = "CtechAuthError";

  public constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class CtechAuth {
  private token: string | undefined;
  private expiryMs: number | undefined;

  public constructor(
    private readonly config: Config,
    private readonly logger: Logger,
  ) {}

  public async getToken(): Promise<string> {
    if (this.isFresh()) {
      if (this.token === undefined) {
        throw new CtechAuthError("token missing despite fresh session");
      }
      return this.token;
    }
    await this.login();
    if (this.token === undefined) {
      throw new CtechAuthError("login succeeded without a token");
    }
    return this.token;
  }

  public async authorizationHeader(): Promise<string> {
    const token = await this.getToken();
    return `Token ${token}`;
  }

  public tokenExpiryIso(): string | undefined {
    if (this.expiryMs === undefined) {
      return undefined;
    }
    return new Date(this.expiryMs).toISOString();
  }

  public invalidate(): void {
    this.token = undefined;
    this.expiryMs = undefined;
  }

  private isFresh(): boolean {
    return (
      this.token !== undefined &&
      this.expiryMs !== undefined &&
      this.expiryMs - Date.now() > TOKEN_REFRESH_MARGIN_MS
    );
  }

  private async login(): Promise<void> {
    const response = await fetch(`${CTECH_API_BASE}/account/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: this.config.CTECH_EMAIL,
        password: this.config.CTECH_PASSWORD,
      }),
    });

    const raw: unknown = await response.json();
    if (!response.ok) {
      this.logger.warn({ status: response.status }, "c.technology login failed");
      throw new CtechAuthError(
        `login HTTP ${String(response.status)}`,
        response.status,
      );
    }

    const parsed = ctechLoginResponseSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error(
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

    this.token = parsed.data.data.token;
    this.expiryMs = Date.parse(parsed.data.data.expiry);
    if (Number.isNaN(this.expiryMs)) {
      throw new CtechAuthError("login expiry was not a valid datetime");
    }

    this.logger.info(
      { expiry: parsed.data.data.expiry },
      "c.technology login succeeded",
    );
  }
}
