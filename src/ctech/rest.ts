import type { Logger } from "pino";
import {
  ownedVehiclesResponseSchema,
  vehicleStatusResponseSchema,
  type VehicleStatusData,
} from "../types/ctech.js";
import type { CtechAuth } from "./auth.js";
import type { ListedVehicle } from "./vehicles.js";
import { ctechUrl, readResponseBody } from "./constants.js";

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
    ctechUrl(`vehicle/${encodeURIComponent(vehicleId)}/status`, false),
    {
      headers: { Authorization: authorization },
    },
  );

  if (response.status === 401) {
    auth.invalidate();
    throw new CtechRestError("vehicle status unauthorized", 401);
  }

  const raw = await readResponseBody(response);
  if (!response.ok) {
    logger.warn({ status: response.status, body: raw }, "vehicle status failed");
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

export async function fetchOwnedVehicles(
  auth: CtechAuth,
  logger: Logger,
): Promise<ListedVehicle[]> {
  const authorization = await auth.authorizationHeader();
  const response = await fetch(
    `${ctechUrl("vehicle-direct-access")}?filter_permission=VEHICLE_IS_OWNER`,
    {
      headers: { Authorization: authorization },
    },
  );

  if (response.status === 401) {
    auth.invalidate();
    throw new CtechRestError("owned vehicles unauthorized", 401);
  }

  const raw = await readResponseBody(response);
  if (!response.ok) {
    logger.warn({ status: response.status, body: raw }, "owned vehicles failed");
    throw new CtechRestError(
      `owned vehicles HTTP ${String(response.status)}`,
      response.status,
    );
  }

  const parsed = ownedVehiclesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues },
      "owned vehicles response failed validation",
    );
    throw new CtechRestError("owned vehicles response failed validation");
  }

  if (parsed.data.header.status !== "SUCCESS") {
    throw new CtechRestError(
      parsed.data.header.message ??
        "owned vehicles header status was not SUCCESS",
    );
  }

  return parsed.data.data.vehicles.map((vehicle) => ({
    vehicleId: vehicle.vehicle_id,
    name: vehicle.name,
  }));
}
