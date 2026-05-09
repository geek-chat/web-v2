/**
 * crypto.randomUUID wrapper.
 *
 * Used as the backend idempotency key for `send_message` (clientMessageId).
 *
 * - Browsers since 2022 (Safari 15.4, Chrome 92, FF 95) ship crypto.randomUUID.
 * - On the server (SSR / Node 18+) `crypto.randomUUID` exists on globalThis.
 * - Throws on legacy environments rather than fall back to Math.random()
 *   because chat idempotency demands real entropy.
 */

export function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  throw new Error(
    "crypto.randomUUID is not available — refusing to fall back to insecure UUID"
  );
}
