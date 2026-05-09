/**
 * JWT decoding (payload only, no signature verification).
 *
 * Frontend never validates JWTs cryptographically — the server is the only
 * party that can do that. We decode purely to read `exp` for proactive
 * refresh, so we don't wait for a 401 round-trip when we already know the
 * token expired.
 */

interface JwtPayload {
  sub?: string;
  exp?: number; // seconds since epoch
  iat?: number;
  [key: string]: unknown;
}

function base64UrlDecode(str: string): string {
  // JWT uses base64url, not base64. Convert and pad.
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  if (typeof atob !== "undefined") return atob(padded);
  // Node fallback (SSR / tests).
  return Buffer.from(padded, "base64").toString("binary");
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token expires within `marginSec` seconds (default 30s).
 *
 * 30s margin avoids edge cases where the request leaves a barely-valid token
 * but the server has already crossed the expiry boundary by the time it
 * processes the request.
 *
 * Returns true (i.e. "treat as expiring") for malformed tokens — safer to
 * trigger a refresh than to send a broken token.
 */
export function isExpiringSoon(token: string, marginSec = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSec + marginSec;
}
