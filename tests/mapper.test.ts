import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defaultMapperContext, mapVehicleStatusToTlm } from "../src/mapper.js";
import { vehicleStatusDataSchema, type VehicleStatusData } from "../src/types/ctech.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/parked-status.json",
);

const parkedStatus = vehicleStatusDataSchema.parse(
  JSON.parse(readFileSync(fixturePath, "utf8")) as unknown,
);

const context = defaultMapperContext("harleydavidson:livewire:22:16:rwd:livewire");

describe("mapVehicleStatusToTlm", () => {
  it("maps the parked LiveWire sample without using aux 12V SoC", () => {
    const tlm = mapVehicleStatusToTlm(parkedStatus, context);
    expect(tlm).toEqual({
      utc: Date.parse("2026-08-11T02:26:46Z") / 1000,
      soc: 80,
      car_model: "harleydavidson:livewire:22:16:rwd:livewire",
      capacity: 15.5,
      lat: 34.094656,
      lon: -118.353865,
      heading: 180,
      speed: 0,
      odometer: 28241.947,
      est_battery_range: 183.467,
      batt_temp: 39,
      is_charging: 0,
      is_parked: 1,
    });
    expect(tlm?.soc).not.toBe(100);
  });

  it("uses HD speed when the bike is not parked", () => {
    const parkedHd = parkedStatus.vehicle_status_hd;
    expect(parkedHd).toBeTruthy();
    if (parkedHd === null || parkedHd === undefined) {
      return;
    }

    const driving: VehicleStatusData = {
      ...parkedStatus,
      status: "DRIVE",
      ignition_on: true,
      vehicle_status_hd: {
        ...parkedHd,
        hd_ignition_power_mode: 1,
        hd_vehicle_speed_km_h: 48,
        hd_charge_status: 0,
      },
    };

    const tlm = mapVehicleStatusToTlm(driving, context);
    expect(tlm?.speed).toBe(48);
    expect(tlm?.is_parked).toBe(0);
    expect(tlm?.is_charging).toBe(0);
  });

  it("returns undefined when SoC and timestamp are missing", () => {
    const empty: VehicleStatusData = {
      timestamp: "not-a-date",
    };
    expect(mapVehicleStatusToTlm(empty, context)).toBeUndefined();
  });
});
