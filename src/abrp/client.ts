import type { Logger } from "pino";
import { z } from "zod";
import type { AbrpTlm } from "../types/abrp.js";

export const ABRP_SEND_URL = "https://api.iternio.com/1/tlm/send";

const abrpSendResponseSchema = z.looseObject({
  status: z.string(),
  missing: z.string().optional(),
});

export type AbrpSendResult = {
  readonly status: string;
  readonly missing?: string;
};

export class AbrpClientError extends Error {
  override readonly name = "AbrpClientError";

  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

export interface AbrpClient {
  send: (tlm: AbrpTlm) => Promise<AbrpSendResult>;
}

export function createAbrpClient(
  apiKey: string,
  token: string,
  logger: Logger,
): AbrpClient {
  return {
    async send(tlm) {
      const response = await fetch(ABRP_SEND_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `APIKEY ${apiKey}`,
        },
        body: JSON.stringify({ token, tlm }),
      });

      const raw: unknown = await readJson(response);
      if (!response.ok) {
        logger.warn({ status: response.status }, "ABRP send failed");
        throw new AbrpClientError(
          `ABRP HTTP ${String(response.status)}`,
          response.status,
        );
      }

      const parsed = abrpSendResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AbrpClientError("ABRP response failed validation");
      }

      const missing = normalizeMissing(parsed.data.missing);
      if (missing !== undefined) {
        return { status: parsed.data.status, missing };
      }
      return { status: parsed.data.status };
    },
  };
}

/** ABRP returns e.g. `"Missing telemetry: power, "` — keep field names only. */
function normalizeMissing(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const fields = raw
    .replace(/^Missing telemetry:\s*/i, "")
    .replace(/,\s*$/, "")
    .trim();
  return fields === "" ? undefined : fields;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return {};
  }
  return JSON.parse(text) as unknown;
}
