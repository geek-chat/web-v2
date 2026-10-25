/**
 * Content-Security-Policy for every page (RULES.md R5), built per request by
 * src/proxy.ts.
 *
 * App Router pages carry inline bootstrap scripts, so `script-src 'self'`
 * alone blocks hydration. A per-request nonce lets exactly Next's own scripts
 * run: Next reads the nonce from this header while rendering and stamps it on
 * every script it emits, which is why every page renders per request (see the
 * root layout). 'strict-dynamic' then trusts the chunks those scripts load.
 * Guide: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 *
 * style-src keeps 'unsafe-inline' and gets no nonce: once a nonce is listed,
 * browsers ignore 'unsafe-inline', which would block React's style attributes.
 */
export interface CspOptions {
  nonce: string;
  isDev: boolean;
  apiUrl: string;
  wsUrl: string;
}

export function buildCsp({ nonce, isDev, apiUrl, wsUrl }: CspOptions): string {
  return [
    "default-src 'self'",
    // React uses eval in development only, to rebuild server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `connect-src 'self' ${apiUrl} ${wsUrl}`,
    "img-src 'self' data: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** A fresh, unguessable nonce for one response. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}
