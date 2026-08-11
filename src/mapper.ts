import type { VehicleStatusData } from "./types/ctech.js";
import { LIVEWIRE_CAPACITY_KWH, type AbrpTlm } from "./types/abrp.js";

export interface MapperContext {
  readonly carModel: string;
  readonly capacityKwh: number;
}

export function isParked(status: VehicleStatusData): boolean {
  const hd = status.vehicle_status_hd;
  return (
    status.status === "PARK" ||
    hd?.hd_ignition_power_mode === 0 ||
    status.ignition_on === false
  );
}

/** HV pack SoC: prefer the source with the newest update timestamp. */
export function pickHvSoc(status: VehicleStatusData): number | undefined {
  const hd = status.vehicle_status_hd;
  return freshestNumber(
    { value: hd?.hd_hv_battery_soc_pct, updatedAt: hd?.hd_last_update },
    {
      value: status.state_of_charge_pct,
      updatedAt: status.last_update ?? status.timestamp,
    },
  );
}

export function mapVehicleStatusToTlm(
  status: VehicleStatusData,
  context: MapperContext,
): AbrpTlm | undefined {
  const hd = status.vehicle_status_hd ?? undefined;
  const soc = pickHvSoc(status);
  const utc = isoToEpochSeconds(status.timestamp) ?? isoToEpochSeconds(status.last_update);

  if (soc === undefined || utc === undefined) {
    return undefined;
  }

  const parked = isParked(status);
  const tlm: AbrpTlm = {
    utc,
    soc,
    car_model: context.carModel,
    capacity: context.capacityKwh,
  };

  if (isFiniteNumber(status.latitude)) {
    tlm.lat = status.latitude;
  }
  if (isFiniteNumber(status.longitude)) {
    tlm.lon = status.longitude;
  }
  if (isFiniteNumber(status.angle)) {
    tlm.heading = status.angle;
  }

  if (parked) {
    tlm.speed = 0;
    tlm.is_parked = 1;
  } else {
    const speed = firstNumber(hd?.hd_vehicle_speed_km_h, status.speed);
    if (speed !== undefined) {
      tlm.speed = speed;
    }
    tlm.is_parked = 0;
  }

  const odometerM = firstNumber(hd?.hd_odometer_m, status.total_odometer);
  if (odometerM !== undefined) {
    tlm.odometer = odometerM / 1000;
  }

  const rangeM = hd?.hd_range_remaining_lt_avg_m;
  if (isFiniteNumber(rangeM)) {
    tlm.est_battery_range = rangeM / 1000;
  }

  const battTemp = hd?.hd_hv_battery_temperature_avg_deg_c;
  if (isFiniteNumber(battTemp)) {
    tlm.batt_temp = battTemp;
  }

  const chargeStatus = hd?.hd_charge_status;
  if (isFiniteNumber(chargeStatus)) {
    tlm.is_charging = chargeStatus !== 0 ? 1 : 0;
  }

  return tlm;
}

export function defaultMapperContext(carModel: string): MapperContext {
  return { carModel, capacityKwh: LIVEWIRE_CAPACITY_KWH };
}

function isoToEpochSeconds(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return undefined;
  }
  return Math.floor(ms / 1000);
}

function firstNumber(
  ...values: ReadonlyArray<number | null | undefined>
): number | undefined {
  for (const value of values) {
    if (isFiniteNumber(value)) {
      return value;
    }
  }
  return undefined;
}

/** Prefer the candidate with the newest `updatedAt`; earlier candidates win ties / missing times. */
function freshestNumber(
  ...candidates: ReadonlyArray<{
    value: number | null | undefined;
    updatedAt: string | null | undefined;
  }>
): number | undefined {
  let bestValue: number | undefined;
  let bestMs = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (!isFiniteNumber(candidate.value)) {
      continue;
    }
    const ms = isoToEpochMs(candidate.updatedAt) ?? Number.NEGATIVE_INFINITY;
    if (bestValue === undefined || ms > bestMs) {
      bestValue = candidate.value;
      bestMs = ms;
    }
  }

  return bestValue;
}

function isoToEpochMs(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return undefined;
  }
  return ms;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}
