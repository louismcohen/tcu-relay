import { z } from "zod";

export const abrpTlmSchema = z.object({
  utc: z.number(),
  soc: z.number(),
  car_model: z.string(),
  capacity: z.number(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  odometer: z.number().optional(),
  est_battery_range: z.number().optional(),
  batt_temp: z.number().optional(),
  is_charging: z.union([z.literal(0), z.literal(1)]).optional(),
  is_parked: z.union([z.literal(0), z.literal(1)]).optional(),
});

export type AbrpTlm = z.infer<typeof abrpTlmSchema>;

export const LIVEWIRE_CAPACITY_KWH = 15.5;
