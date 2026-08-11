export const CTECH_API_BASE = "https://api.ctechnology.io/api/v2.2";
/** Official app connects here; host root is Django 400 HTML, not a WS upgrade. */
export const CTECH_WS_URL = "wss://api.ctechnology.io/api/v2.2/ws/ws-main";
/** Node `ws` omits Origin; Channels rejects the handshake with 403 without one. */
export const CTECH_WS_ORIGIN = "https://api.ctechnology.io";
export const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * Login POST must use a trailing slash (else 301 turns POST into GET).
 * Vehicle status GET must not (slashless `/status` exists; `/status/` is 404).
 * Owned-vehicle list GET uses a trailing slash (`vehicle-direct-access/?…`).
 */
export function ctechUrl(path: string, trailingSlash = true): string {
  const trimmed = path.replace(/^\/+/u, "").replace(/\/+$/u, "");
  return `${CTECH_API_BASE}/${trimmed}${trailingSlash ? "/" : ""}`;
}

export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
