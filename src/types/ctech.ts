import { z } from "zod";

const headerSchema = z.looseObject({
  api_version: z.string().optional(),
  status: z.string(),
  message: z.string().nullable().optional(),
});

export function apiEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    header: headerSchema,
    data: dataSchema,
  });
}

export const ctechLoginDataSchema = z.looseObject({
  token: z.string().min(1),
  expiry: z.string().min(1),
  user: z.unknown().optional(),
});

export const ctechLoginResponseSchema = apiEnvelopeSchema(ctechLoginDataSchema);

export type CtechLoginResponse = z.infer<typeof ctechLoginResponseSchema>;

const nullableNumber = z.number().nullable();
const nullableString = z.string().nullable();
const nullableBoolean = z.boolean().nullable();

export const vehicleStatusHdSchema = z.looseObject({
  hd_last_update: nullableString.optional(),
  hd_hv_battery_soc_pct: nullableNumber.optional(),
  hd_hv_battery_temperature_avg_deg_c: nullableNumber.optional(),
  hd_estimated_charge_time_to_full_s: nullableNumber.optional(),
  hd_range_remaining_lt_avg_m: nullableNumber.optional(),
  hd_range_remaining_min_m: nullableNumber.optional(),
  hd_range_remaining_max_m: nullableNumber.optional(),
  hd_aux_battery_voltage_v: nullableNumber.optional(),
  hd_odometer_m: nullableNumber.optional(),
  hd_motor_rpm: nullableNumber.optional(),
  hd_vehicle_speed_km_h: nullableNumber.optional(),
  hd_motor_temperature_deg_c: nullableNumber.optional(),
  hd_inverter_temperature_deg_c: nullableNumber.optional(),
  hd_charge_status: nullableNumber.optional(),
  hd_lock_status: nullableNumber.optional(),
  hd_charge_plug_status: nullableNumber.optional(),
  hd_ignition_power_mode: nullableNumber.optional(),
  hd_canbus_last_update_timestamp: nullableString.optional(),
});

export type VehicleStatusHd = z.infer<typeof vehicleStatusHdSchema>;

export const vehicleStatusDataSchema = z.looseObject({
  vehicle_id: z.string().optional(),
  timestamp: z.string(),
  last_update: z.string().optional(),
  status: nullableString.optional(),
  state_of_charge_pct: nullableNumber.optional(),
  speed: nullableNumber.optional(),
  total_odometer: nullableNumber.optional(),
  latitude: nullableNumber.optional(),
  longitude: nullableNumber.optional(),
  altitude: nullableNumber.optional(),
  angle: nullableNumber.optional(),
  ignition_on: nullableBoolean.optional(),
  current_power_w: nullableNumber.optional(),
  vehicle_status_hd: vehicleStatusHdSchema.nullable().optional(),
});

export type VehicleStatusData = z.infer<typeof vehicleStatusDataSchema>;

export const vehicleStatusResponseSchema = apiEnvelopeSchema(vehicleStatusDataSchema);

export type VehicleStatusResponse = z.infer<typeof vehicleStatusResponseSchema>;

export const wsVehicleStatusMessageSchema = z.looseObject({
  header: z.looseObject({
    type: z.string().optional(),
    api_version: z.string().optional(),
    channel: z.string().optional(),
    uri: z.string().optional(),
  }),
  data: vehicleStatusDataSchema,
});

export type WsVehicleStatusMessage = z.infer<typeof wsVehicleStatusMessageSchema>;
