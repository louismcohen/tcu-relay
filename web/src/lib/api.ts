import { statusSnapshotSchema, type StatusSnapshot } from "@shared/status";

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Invalid credentials" : "Login failed");
  }
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

export async function fetchMe(): Promise<boolean> {
  const response = await fetch("/api/me");
  return response.ok;
}

export async function fetchStatus(): Promise<StatusSnapshot> {
  const response = await fetch("/api/status");
  if (!response.ok) {
    throw new Error("status unauthorized");
  }
  const raw: unknown = await response.json();
  return statusSnapshotSchema.parse(raw);
}

export async function reconnectFeed(): Promise<void> {
  const response = await fetch("/api/reconnect", { method: "POST" });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? "unauthorized" : "reconnect failed",
    );
  }
}

export function parseSnapshot(raw: string): StatusSnapshot {
  return statusSnapshotSchema.parse(JSON.parse(raw) as unknown);
}
