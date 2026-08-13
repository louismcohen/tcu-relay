import { describe, expect, it } from "vitest";
import {
  isFeedStale,
  REST_REFRESH_INTERVAL_MS,
  STALE_AFTER_MS,
} from "../src/freshness.js";

describe("freshness constants", () => {
  it("polls REST before the stale threshold", () => {
    expect(REST_REFRESH_INTERVAL_MS).toBeLessThan(STALE_AFTER_MS);
  });
});

describe("isFeedStale", () => {
  const startedAtMs = Date.parse("2026-08-11T03:33:21.000Z");

  it("is fresh when a recent message exists", () => {
    const nowMs = startedAtMs + 60_000;
    expect(
      isFeedStale("2026-08-11T03:34:00.000Z", nowMs, startedAtMs),
    ).toBe(false);
  });

  it("is stale when last message exceeds the threshold", () => {
    const lastMessageAt = "2026-08-11T03:33:22.000Z";
    const lastMs = Date.parse(lastMessageAt);
    const nowMs = lastMs + STALE_AFTER_MS;
    expect(isFeedStale(lastMessageAt, nowMs, startedAtMs)).toBe(true);
  });

  it("is fresh before the threshold when no message has arrived yet", () => {
    const nowMs = startedAtMs + STALE_AFTER_MS - 1;
    expect(isFeedStale(undefined, nowMs, startedAtMs)).toBe(false);
  });

  it("is stale after the threshold when no message has arrived", () => {
    const nowMs = startedAtMs + STALE_AFTER_MS;
    expect(isFeedStale(undefined, nowMs, startedAtMs)).toBe(true);
  });

  it("treats an unparseable timestamp as stale", () => {
    expect(isFeedStale("not-a-date", startedAtMs + 1, startedAtMs)).toBe(true);
  });
});
