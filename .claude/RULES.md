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
- OAuth fragment parsing **must be client-side only**: `'use client'` + `useEffect`. Call `clearHash()` (`history.replaceState`) immediately on mount so tokens don't stay in the address bar or browser history. (Fragments are never sent in the `Referer` header; history and third-party scripts reading `location` are the real exposure.)
- Each OAuth callback page reads **only its own path's keys**: `/auth/success` → `access_token`, `refresh_token`; `/auth/oauth-link` → `link_token`, `existing_nickname`, `new_provider`; `/auth/oauth-complete` → `signup_token`, `suggested_nickname`. `link_token` and `signup_token` are one-time credentials and are **never** written to token storage. (v1 reused the `access_token` key for the link token; v2 separates paths and keys, keep it that way.)
- Token storage (`src/lib/auth/storage.ts`) is the only token source. The Zustand store holds `status` and `user`, never tokens. Every terminal auth failure goes through `clearSession()`, directly or via the `auth:logout` event, so storage and store never disagree.
- `/auth/me` failures are never swallowed. Auth expiry → `clearSession()`. A network or 5xx failure (e.g. a Render free-tier cold start) must not leave "logged-out UI with tokens still stored". This is an open item, see the carry-over table in `HANDOFF/SESSION_PROGRESS.md`.
- `clientMessageId` for `send_message` events: `crypto.randomUUID()` wrapped with `typeof window` guard for SSR safety.

## R2. WebSocket

**This section is the single source of truth for WS connection and reconnect handling.** Other docs summarize it and point here.

- One singleton `ChatWSClient` instance per app, stored in Zustand (`src/store/ws.ts`). Backend caps at 3 connections per user. Provider pattern is forbidden.
- Keep event listeners on the long-lived `ChatWSClient` wrapper and re-bind `onmessage`/`onclose` on every new `WebSocket` instance. A raw WebSocket is replaced on each reconnect, so listeners attached to the old instance are lost (root cause of a v1 regression).
- Read the access token from storage on every connect attempt, never from a value captured before a refresh.
- The server validates the JWT only while accepting the connection (`ChatWebSocketHandler.kt:43` is the websocket module's only `validateToken` call; there is no handshake interceptor). Optional: before connecting, if `isExpiringSoon(token)` is true, refresh first through the shared single-flight refresh. That saves the `TOKEN_EXPIRED` round trip and its reconnect wait.
- WS must refresh through the **same** single-flight refresh as `apiFetch` (export it from `src/lib/api/client.ts`). The server rotates refresh tokens, so a second refresh path racing the first invalidates one of them and logs the user out.

The server closes with `1008` (POLICY_VIOLATION) for five different causes (server-v2 `ChatWebSocketHandler.kt:36-65`; it uses no other close status). The cause arrives only in the `error` event sent just before the close, so branch on the **last `error.code`**, never on the close code alone:

| last `error.code` before close | client action |
|---|---|
| `TOKEN_EXPIRED` | shared single-flight refresh, then reconnect after the minimum interval |
| `INVALID_TOKEN`, `NO_TOKEN`, or no `error` event | refresh once; if the next attempt fails the same way, `clearSession()` + `/login` |
| `RATE_LIMITED` | no refresh; wait at least 2s plus jitter, then reconnect |
| `MAX_CONNECTIONS` | do not reconnect; toast asking to close another tab, offer a manual retry |

- `1000` with the `intentionalClose` flag set → no reconnect.
- Any other close (1006, 1011, …) → exponential backoff **starting at 2s** (2s → 4s → 8s … cap 30s) with jitter. The server rejects a reconnect within 2s per user (`MIN_CONNECTION_INTERVAL_MS = 2000`, `WebSocketSessionManager.kt:17`), so a 1s first retry always fails.
- Reset the backoff and the refresh-once guard only after the connection proves stable: it stayed open for 10s, or a message other than `error` arrived. **Never reset in `onopen`.** The server runs its checks after the handshake (`afterConnectionEstablished`, `ChatWebSocketHandler.kt:34-65`), so a rejected connection fires `onopen` first and then receives `error` + close 1008. Resetting there pins the backoff at 2s and re-arms the refresh-once guard on every attempt, which turns `INVALID_TOKEN` into an endless refresh loop. The server-v2 sample (`docs/WEBSOCKET.md:163`) resets in `onopen`; don't copy that line.
- After a reconnect is accepted, backfill every loaded room with `GET /api/rooms/:id/messages?direction=forward&cursor=<createdAt of the newest message held>` (cursor is ISO-8601, server `docs/API.md` §3.3), as the server doc recommends (`docs/WEBSOCKET.md` §6). Trigger it after acceptance, not in `onopen`, since rejected connections fire `onopen` too. `limit` caps at 100, so keep paging with `cursor` = the last item's `createdAt` until a page comes back shorter than `limit`. Dedupe by message id, because live `new_message` events can overlap the backfill. The server query is `createdAt > :cursor ORDER BY createdAt ASC` with no id tiebreaker (`SpringDataMessageRepository.kt:22-29`), so messages sharing one timestamp at a page boundary can be skipped (reported as S6, server side).
- If the server adopts distinct 4000-range close codes per cause, check the close code first and keep `error.code` as the fallback.
- The WS handshake Origin is allowlisted to a single `FRONTEND_URL` (`WebSocketConfig.kt:20`), unlike REST CORS which also accepts origin patterns. Vercel preview deploys cannot open WS. On Render even REST allows only `FRONTEND_URL`: `render.yaml` sets no patterns and the default is an empty list (`AppProperties.kt:11`), unless `APP_FRONTEND_ORIGIN_PATTERNS` is added in the dashboard.
- `room_expiring` (10 min before TTL expiry) → toast + UI banner.
- `room_expired` `{roomId, roomName}` → remove the room from the list; if it is the open room, toast and navigate to `/rooms`.
- `message_expired` (batch hard delete from server) → remove from local store + toast.
- `message_burned` `{roomId, messageId}` (M2 Burn-on-Read) → remove the message immediately. Any client can send `burnAfterRead: true` in `send_message` and the event also reaches the sender, so handle it even if web-v2 never sends such messages (server `docs/WEBSOCKET.md` §4.8).

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
- For chat features: 2-tab manual test against the backend `local` profile (steps in the header of server-v2 `docker-compose.dev.yml`; its README describes the local DB as MySQL, which is stale, see S4; dev-login is enabled only in the `dev` and `local` profiles).

## R10. Never do

- Don't modify `geek-chat-server/`, `geek-chat-web/`, or `geek-chat-server-v2/` from this repo's sessions. Other sessions own them; read them for contracts and report problems to the user.
- Don't commit secrets (JWT_SECRET, OAuth client secret, `.env.local`).
- Don't import `domain/` from `infrastructure/` (server-side rule, but mentioned for context awareness).
- Don't bypass `apiFetch` for "just one quick call" — it always rebites you.
- Don't skip the **refresh-context** skill on session end. The Stop hook will remind you.

---

## Always-on behaviors

- **End-of-session minimum**: run the `refresh-context` skill manually if Stop hook didn't fire (e.g. session pause). It updates `HANDOFF/SESSION_PROGRESS.md`, syncs versions in AGENTS.md, and writes the next-session resumption plan.
- **Korean output**: respond to user in 한국어 by default. Code, error messages, and commit messages stay in English.
- **Tables for change reports**: when summarizing modifications, use a markdown table.
