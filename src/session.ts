import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "tcu_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionPayload {
  readonly email: string;
  readonly exp: number;
}

export function createSessionCookie(email: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  const signature = sign(payload, secret);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${payload}.${signature}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${String(maxAge)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function readSession(
  cookieHeader: string | undefined,
  secret: string,
): SessionPayload | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }
  const token = cookieValue(cookieHeader, SESSION_COOKIE);
  if (token === undefined) {
    return undefined;
  }
  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return undefined;
  }
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(payload, secret);
  if (!safeEqual(signature, expected)) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  );
  if (!isSessionPayload(parsed) || parsed.exp < Date.now()) {
    return undefined;
  }
  return parsed;
}

export function credentialsMatch(
  email: string,
  password: string,
  expectedEmail: string,
  expectedPassword: string,
): boolean {
  return safeEqual(email, expectedEmail) && safeEqual(password, expectedPassword);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function cookieValue(header: string, name: string): string | undefined {
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    if (trimmed.slice(0, eq) === name) {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("email" in value) || !("exp" in value)) {
    return false;
  }
  return typeof value.email === "string" && typeof value.exp === "number";
}

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    timingSafeEqual(leftBuf, leftBuf);
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}
