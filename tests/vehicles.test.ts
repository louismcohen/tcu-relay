import { describe, expect, it } from "vitest";
import { resolveVehicle } from "../src/ctech/vehicles.js";
import { ownedVehiclesResponseSchema } from "../src/types/ctech.js";

const listEnvelope = {
  header: {
    api_version: "v2.2",
    status: "SUCCESS",
    message: null,
  },
  data: {
    vehicles: [
      {
        vehicle_id: "veh_01kmzq0g8gf82bd0p48zkb3cqe",
        name: "Your LiveWire ONE",
      },
      {
        vehicle_id: "veh_other",
        name: "Spare",
      },
    ],
  },
};

describe("ownedVehiclesResponseSchema", () => {
  it("parses the owned-vehicle list envelope", () => {
    const parsed = ownedVehiclesResponseSchema.parse(listEnvelope);
    expect(parsed.data.vehicles).toHaveLength(2);
    expect(parsed.data.vehicles[0]?.vehicle_id).toBe(
      "veh_01kmzq0g8gf82bd0p48zkb3cqe",
    );
  });
});

describe("resolveVehicle", () => {
  it("uses the first listed vehicle", () => {
    expect(
      resolveVehicle(
        [
          { vehicleId: "veh_first", name: "One" },
          { vehicleId: "veh_second", name: "Two" },
        ],
        "veh_env",
      ),
    ).toEqual({
      vehicleId: "veh_first",
      vehicleName: "One",
      source: "list",
    });
  });

  it("falls back to env when the list is empty", () => {
    expect(resolveVehicle([], "veh_env")).toEqual({
      vehicleId: "veh_env",
      source: "env",
    });
  });
});
