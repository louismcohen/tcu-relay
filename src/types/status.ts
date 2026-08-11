import { z } from "zod";
import { abrpTlmSchema } from "./abrp.js";

export const ctechWsStateSchema = z.enum([
	"disconnected",
	"connecting",
	"authenticating",
	"connected",
	"reconnecting",
]);

export const ctechSnapshotSchema = z.object({
	wsState: ctechWsStateSchema,
	tokenExpiry: z.string().optional(),
	lastMessageAt: z.string().optional(),
	lastParseError: z.string().optional(),
	vehicleStatus: z.string().optional(),
	soc: z.number().optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	parked: z.boolean().optional(),
	charging: z.boolean().optional(),
	hdLastUpdate: z.string().optional(),
	gpsTimestamp: z.string().optional(),
});

export const abrpSnapshotSchema = z.object({
	lastSentAt: z.string().optional(),
	lastResult: z.string().optional(),
	lastMissing: z.string().optional(),
	lastTlm: abrpTlmSchema.optional(),
	backoffMs: z.number().optional(),
});

export const statusSnapshotSchema = z.object({
	startedAt: z.string(),
	vehicleId: z.string(),
	vehicleName: z.string(),
	dryRun: z.boolean(),
	sendIntervalMs: z.number(),
	uptimeSeconds: z.number(),
	ctech: ctechSnapshotSchema,
	abrp: abrpSnapshotSchema,
});

export type CtechSnapshot = z.infer<typeof ctechSnapshotSchema>;
export type AbrpSnapshot = z.infer<typeof abrpSnapshotSchema>;
export type StatusSnapshot = z.infer<typeof statusSnapshotSchema>;
