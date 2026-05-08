# GeekChat Web v2 — Binding Rules

Concise rules. The full reasoning + diagrams live in `HANDOFF/ARCHITECTURE.md` and `HANDOFF/API_INTEGRATION.md`. **These rules override agent training data when in conflict.**

---

## Stack assumptions (verify before coding)

- **Next.js 16** (not 15). App Router. Turbopack default.
- **React 19** (RSC stable, `useFormStatus`, `useOptimistic`).
- **Tailwind v4** — config is CSS-based. **No `tailwind.config.ts` file.** Class-based dark mode via `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`.
- **TypeScript** strict, `@/*` → `./src/*`.
- **ESLint v9** flat config.

If your training is on v15/v3/v8, read `node_modules/next/dist/docs/` or run `npm ls next react tailwindcss` first.

---

## R1. Token + Auth

- Tokens live in **localStorage**. Keys: `access_token`, `refresh_token`.
- All HTTP must go through `src/lib/api/client.ts` `apiFetch()`. Direct `fetch()` is forbidden (breaks 401 handling).
- 401 from any endpoint triggers **single-flight refresh**: only one refresh in flight, all pending requests await the same Promise. On refresh failure → `clearTokens()` + redirect to `/login`.
- OAuth fragment parsing **must be client-side only**: `'use client'` + `useEffect`. Call `clearHash()` (`history.replaceState`) immediately on mount to prevent referer leaks.
- `clientMessageId` for `send_message` events: `crypto.randomUUID()` wrapped with `typeof window` guard for SSR safety.

## R2. WebSocket

- One singleton `ChatWSClient` instance per app, stored in Zustand (`src/store/ws.ts`). Backend caps at 3 connections per user. Provider pattern is forbidden.
- Reconnect on close codes:
  - `1000` + `intentionalClose` flag → no reconnect
  - `1008` (POLICY_VIOLATION) → refresh token → reconnect
  - others → exponential backoff (1s → 2s → 4s … cap 30s)
- `room_expiring` (10 min before TTL expiry) → toast + UI banner.
- `message_expired` (batch hard delete from server) → remove from local store + toast.

## R3. Server vs Client components

- RSC: only `/` (landing) — and any future static marketing pages.
- Client (`'use client'`): everything under `(authed)/`, all `/auth/*` callbacks, anything using hooks (`useEffect`, `useState`, `useRouter`, `useFormStatus`, etc.).
- Default to client when uncertain — chat is 90%+ interactive.

## R4. Dark mode

- `<html lang="ko" className="dark">` fixed in `src/app/layout.tsx` (no theme toggle in M1).
- Tailwind v4 dark variant: register via `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css` → use `dark:bg-...` etc. as usual.
- `next-themes` is **not** installed in M1 — defer until theme toggle is required.

## R5. CSP + Security

- Strict CSP in `next.config.ts` `headers()`:
  - `default-src 'self'`
  - `script-src 'self'` (no inline, no eval)
  - `style-src 'self' 'unsafe-inline'` (Tailwind requires inline)
  - `connect-src 'self' ${NEXT_PUBLIC_API_URL} ${NEXT_PUBLIC_WS_URL}`
  - `frame-ancestors 'none'`
- `dangerouslySetInnerHTML` is **forbidden**. CSP blocks it anyway.
- `.env.local` must not be committed (in `.gitignore`). `.env.example` IS committed (whitelisted).

## R6. State management

- Zustand slice files: `src/store/{auth,rooms,messages,ws}.ts`. No combined root.
- SWR for static data only (room list, `/auth/me`, user search). Chat is WS-driven (`messages` store).
- Optimistic UI for sends: append `{status: 'pending'}` immediately, replace via `clientMessageId` on `message_ack`. `status: 'failed'` if no ack within 5s + retry button.

## R7. Naming + structure

- Components: `PascalCase.tsx`. Hooks/utils: `camelCase.ts`.
- zod schemas live in `src/lib/api/<domain>.ts` next to the function (request + response both validated).
- DTO types match backend exactly — no client-side renaming.
- File-per-component for top-level UI. Sub-components stay in same file if <50 lines.

## R8. Naver/Korean specifics

- OAuth providers: Google + Naver. Naver requires `state` param (handled server-side).
- Locale primary: ko. UI strings live in `src/i18n/ko.ts` (M1 — single locale).
- Date formatting: `Intl.DateTimeFormat('ko-KR', { ... })`. Don't ship dayjs/date-fns in M1.

## R9. Build + verify

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.
- For chat features: 2-tab manual test with backend dev profile.

## R10. Never do

- Don't modify `geek-chat-server/` or `geek-chat-web/` (v1, reference only).
- Don't commit secrets (JWT_SECRET, OAuth client secret, `.env.local`).
- Don't import `domain/` from `infrastructure/` (server-side rule, but mentioned for context awareness).
- Don't bypass `apiFetch` for "just one quick call" — it always rebites you.
- Don't skip the **refresh-context** skill on session end. The Stop hook will remind you.

---

## Always-on behaviors

- **End-of-session minimum**: run the `refresh-context` skill manually if Stop hook didn't fire (e.g. session pause). It updates `HANDOFF/SESSION_PROGRESS.md`, syncs versions in AGENTS.md, and writes the next-session resumption plan.
- **Korean output**: respond to user in 한국어 by default. Code, error messages, and commit messages stay in English.
- **Tables for change reports**: when summarizing modifications, use a markdown table.
