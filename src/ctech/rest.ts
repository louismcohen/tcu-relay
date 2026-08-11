import type { Logger } from "pino";
import {
  vehicleStatusResponseSchema,
  type VehicleStatusData,
} from "../types/ctech.js";
import type { CtechAuth } from "./auth.js";
import { CTECH_API_BASE } from "./constants.js";

export class CtechRestError extends Error {
  override readonly name = "CtechRestError";

  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}

export async function fetchVehicleStatus(
  auth: CtechAuth,
  vehicleId: string,
  logger: Logger,
): Promise<VehicleStatusData> {
  const authorization = await auth.authorizationHeader();
  const response = await fetch(
    `${CTECH_API_BASE}/vehicle/${encodeURIComponent(vehicleId)}/status`,
    {
      headers: { Authorization: authorization },
    },
  );

  if (response.status === 401) {
    auth.invalidate();
    throw new CtechRestError("vehicle status unauthorized", 401);
  }

  const raw: unknown = await response.json();
  if (!response.ok) {
    throw new CtechRestError(
      `vehicle status HTTP ${String(response.status)}`,
      response.status,
    );
  }

  const parsed = vehicleStatusResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues },
      "vehicle status response failed validation",
    );
    throw new CtechRestError("vehicle status response failed validation");
  }

  if (parsed.data.header.status !== "SUCCESS") {
    throw new CtechRestError(
      parsed.data.header.message ?? "vehicle status header status was not SUCCESS",
    );
  }

  return parsed.data.data;
}
