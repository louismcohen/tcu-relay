export const CTECH_API_BASE = "https://api.ctechnology.io/api/v2.2";
export const CTECH_WS_URL = "wss://api.ctechnology.io";
export const TOKEN_REFRESH_MARGIN_MS = 60_000;

/** Django-style API: no trailing slash → 301, and fetch then retries POST as GET. */
export function ctechUrl(path: string): string {
  const trimmed = path.replace(/^\/+/u, "").replace(/\/+$/u, "");
  return `${CTECH_API_BASE}/${trimmed}/`;
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
