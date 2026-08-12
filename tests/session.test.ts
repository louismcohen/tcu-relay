import { describe, expect, it } from "vitest";
import {
  createSessionCookie,
  deriveSessionSecret,
  readSession,
  SESSION_COOKIE,
} from "../src/session.js";

describe("deriveSessionSecret", () => {
  it("is stable for the same credentials", () => {
    const a = deriveSessionSecret("user@example.com", "secret");
    const b = deriveSessionSecret("user@example.com", "secret");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("changes when the password changes", () => {
    const a = deriveSessionSecret("user@example.com", "secret");
    const b = deriveSessionSecret("user@example.com", "other");
    expect(a).not.toBe(b);
  });
});

describe("session cookie", () => {
  it("round-trips with a derived secret", () => {
    const secret = deriveSessionSecret("user@example.com", "secret");
    const header = createSessionCookie("user@example.com", secret);
    const session = readSession(header, secret);
    expect(session?.email).toBe("user@example.com");
  });

  it("rejects a cookie signed with a different secret", () => {
    const cookie = createSessionCookie(
      "user@example.com",
      deriveSessionSecret("user@example.com", "secret"),
    );
    const value = cookie.slice(`${SESSION_COOKIE}=`.length).split(";")[0];
    const session = readSession(
      `${SESSION_COOKIE}=${value ?? ""}`,
      deriveSessionSecret("user@example.com", "other"),
    );
    expect(session).toBeUndefined();
  });
});
