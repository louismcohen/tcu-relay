/** No c.technology status for this long → feed is stale (dashboard + ABRP skip). */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Poll REST vehicle status on this cadence so parked / quiet WS does not look
 * stale while c.technology cloud still has fresh `last_update` values.
 * Keep below `STALE_AFTER_MS`.
 */
export const REST_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** WebSocket protocol ping interval; miss one pong → terminate and reconnect. */
export const WS_PING_INTERVAL_MS = 30_000;

export function isFeedStale(
  lastMessageAt: string | undefined,
  nowMs: number,
  startedAtMs: number,
  staleAfterMs: number = STALE_AFTER_MS,
): boolean {
  if (lastMessageAt === undefined) {
    return nowMs - startedAtMs >= staleAfterMs;
  }
  const lastMs = Date.parse(lastMessageAt);
  if (Number.isNaN(lastMs)) {
    return true;
  }
  return nowMs - lastMs >= staleAfterMs;
}
