export interface ListedVehicle {
  vehicleId: string;
  name: string;
}

export interface ResolvedVehicle {
  vehicleId: string;
  vehicleName?: string;
  source: "list" | "env";
}

export function resolveVehicle(
  vehicles: readonly ListedVehicle[],
  envVehicleId: string,
): ResolvedVehicle {
  const first = vehicles[0];
  if (first !== undefined) {
    return {
      vehicleId: first.vehicleId,
      vehicleName: first.name,
      source: "list",
    };
  }
  return {
    vehicleId: envVehicleId,
    source: "env",
  };
}
