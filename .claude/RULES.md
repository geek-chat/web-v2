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
- OAuth fragments are read **only through `useOAuthHash()`** (`src/lib/auth/useOAuthHash.ts`). It captures the fragment once on the first client render and clears it with `history.replaceState`, so tokens don't stay in the address bar or browser history. (Fragments are never sent in the `Referer` header; history and third-party scripts reading `location` are the real exposure.) Don't parse in an effect and `setState`: `react-hooks/set-state-in-effect` is an error here.
- A callback fragment counts only when this tab started the OAuth flow: `OAuthButtons` calls `startOAuthFlow()` (`src/lib/auth/oauthFlow.ts`, a 10-minute mark in sessionStorage) before leaving for the provider, and `useOAuthHash` ignores fragments without a pending mark, then uses the mark up. Any new entry point into OAuth must go through `startOAuthFlow()`.
- An invite link opened while signed out survives sign-in: when `AuthGuard` sends the visitor to `/login` it remembers an `/invite/<code>` path (`src/lib/auth/returnPath.ts`: invite paths only, letters and digits, one use, 10 minutes), and the first time it sees the user signed in it goes back there. Every sign-in path (form, signup, OAuth callback) ends on `/rooms` inside the guard, so the guard is the one place to do it. Don't widen it to other paths without the same checks: it is a redirect target.
- Each OAuth callback page reads **only its own path's keys**: `/auth/success` → `access_token`, `refresh_token`; `/auth/oauth-link` → `link_token`, `existing_nickname`, `new_provider`; `/auth/oauth-complete` → `signup_token`, `suggested_nickname`. `link_token` and `signup_token` are one-time credentials and are **never** written to token storage. (v1 reused the `access_token` key for the link token; v2 separates paths and keys, keep it that way.)
- Token storage (`src/lib/auth/storage.ts`) is the only token source. The Zustand store holds `status` and `user`, never tokens. Every terminal auth failure goes through `clearSession()`, directly or via the `auth:logout` event, so storage and store never disagree.
- Tokens live in localStorage shared by every tab. `AppBoot` listens for `storage` and calls `verifySession()` when another tab removes the tokens or stores another account's (`sub` differs from the current user). A refresh by another tab keeps the same `sub` and is ignored.
- Session state comes from `src/lib/auth/session.ts`: `startSession(tokens)` after login, signup or an OAuth callback; `verifySession()` on boot, on retry and on the browser `online` event. Only 401 (after the refresh), 403 and 404 end the session. Any other `/auth/me` failure (network, 5xx, a Render free-tier cold start) keeps the tokens and sets `offline`, which AuthGuard shows as a retry screen.
- User-facing API error text comes from `describeApiError(err, context)` (`src/lib/api/errorMessage.ts`). The server's `error` field is the HTTP reason phrase ("Conflict"), not a domain code, so never look it up directly.
- `clientMessageId` for `send_message` events: `crypto.randomUUID()` wrapped with `typeof window` guard for SSR safety.

## R2. WebSocket

**This section is the single source of truth for WS connection and reconnect handling.** Other docs summarize it and point here.

- One singleton `ChatWSClient` instance per app, stored in Zustand (`src/store/ws.ts`). Backend caps at 3 connections per user. Provider pattern is forbidden.
- Implementation: `src/lib/ws/client.ts` follows the rules below. `src/lib/chat/connection.ts` owns the lifetime: `ChatConnection` (inside `AuthGuard` in the `(authed)` layout) holds the client while an authed screen is shown. The last release closes it on the next task, so Strict Mode's mount → unmount → mount keeps one socket instead of tripping the 2s limit, and closing empties the chat stores.
- Keep event listeners on the long-lived `ChatWSClient` wrapper and re-bind `onmessage`/`onclose` on every new `WebSocket` instance. A raw WebSocket is replaced on each reconnect, so listeners attached to the old instance are lost (root cause of a v1 regression).
- Read the access token from storage on every connect attempt, never from a value captured before a refresh.
- The client is pinned to the signed-in user (`userId`, the JWT `sub`). If storage holds another account's token (another tab logged in as someone else), it closes without connecting, and `connection.ts` calls `verifySession()`; the new user gets a new client and empty stores. Never stream another account's events into this tab's stores.
- The server validates the JWT only while accepting the connection (`ChatWebSocketHandler.afterConnectionEstablished` holds the websocket module's only `validateToken` call; there is no handshake interceptor). Optional: before connecting, if `isExpiringSoon(token)` is true, refresh first through the shared single-flight refresh. That saves the `TOKEN_EXPIRED` round trip and its reconnect wait.
- WS must refresh through the **same** single-flight refresh as `apiFetch` (export it from `src/lib/api/client.ts`). The server rotates refresh tokens, so a second refresh path racing the first invalidates one of them and logs the user out.

The server closes with `1008` (POLICY_VIOLATION) for five different causes (server-v2 `ChatWebSocketHandler.reject`, the only place it closes; it uses no other close status). The cause arrives only in the `error` event sent just before the close, so branch on the **last `error.code`**, never on the close code alone. `error` events also arrive on a healthy connection (send failures, see R6); only the one right before a 1008 close decides the reconnect:

| last `error.code` before close | client action |
|---|---|
| `TOKEN_EXPIRED` | shared single-flight refresh, then reconnect after the minimum interval (not a backoff grown by earlier drops). It counts toward the refresh-once guard, so a token the server keeps refusing ends the session instead of looping |
| `INVALID_TOKEN`, `NO_TOKEN`, or no `error` event | refresh once; if the next attempt fails the same way, `clearSession()` + `/login` |
| `RATE_LIMITED` | no refresh; wait at least 2s plus jitter, then reconnect |
| `MAX_CONNECTIONS` | do not reconnect; toast asking to close another tab, offer a manual retry |

- An intentional close (`ChatWSClient.close()`, sent as `1000`) → no reconnect. Cancel the pending reconnect timer, and re-check after every `await`, so an in-flight refresh never opens a socket after logout.
- Any other close (1006, 1011, …) → exponential backoff **starting at 2s** (2s → 4s → 8s … cap 30s) with jitter. The server rejects a reconnect within 2s per user (`WebSocketSessionManager.MIN_CONNECTION_INTERVAL_MS = 2000`), so a 1s first retry always fails.
- Reset the backoff and the refresh-once guard only after the connection proves stable: it stayed open for 10s, or a message other than `error` arrived. **Never reset in `onopen`.** The server runs its checks after the handshake (`ChatWebSocketHandler.afterConnectionEstablished`), so a rejected connection fires `onopen` first and then receives `error` + close 1008. Resetting there pins the backoff at 2s and re-arms the refresh-once guard on every attempt, which turns `INVALID_TOKEN` into an endless refresh loop. The server-v2 sample (`docs/WEBSOCKET.md` §6) resets in `onopen`; don't copy that line.
- The server sends nothing when it accepts a connection, so **accepted** means 1s (`ACCEPT_WINDOW_MS`) after `onopen` without a rejection `error`, or the first frame other than `error`. A rejection lands right after `onopen`, because the server rejects inside its handshake callback. Acceptance only triggers the backfill; the 10s stable rule above alone resets the backoff and the refresh-once guard.
- "Loaded" means a REST page brought the room's history in (`useMessagesStore.loaded`); a live `new_message` or a pending row does not load a room. A loaded room with no server rows yet takes its latest page. A room view's first page goes through `loadRoomMessages()`, which backfills once more when the page lands after the connection was accepted (the page may predate the server joining this connection to the room).
- After every acceptance (the first one too, which covers the gap between a room's first REST page and the connection), backfill every loaded room with `GET /api/rooms/:id/messages?direction=forward&cursor=<createdAt of the newest message held>` (cursor is ISO-8601, server `docs/API.md` §3.3), as the server doc recommends (`docs/WEBSOCKET.md` §6). Trigger it after acceptance, not in `onopen`, since rejected connections fire `onopen` too. The first cursor is the newest `createdAt` that came from the server minus 5s (`CURSOR_OVERLAP_MS`): two messages sent to one room at once can commit in the reverse order of their `createdAt`, and a cursor at the newest row held would skip the one that committed later. Later pages pass the last row's `createdAt` back as the exact string. A pending row's client clock never counts. `limit` caps at 100, so keep paging with `cursor` = the last item's `createdAt` until a page comes back shorter than `limit`; a room more than 5 pages behind jumps to its latest page instead, dropping only the server rows older than that page (newer ones arrived live while it loaded). Dedupe by message id, because live `new_message` events can overlap the backfill. The server query is `createdAt > :cursor ORDER BY createdAt ASC` with no id tiebreaker (`SpringDataMessageRepository.findByRoomIdAfter`), so messages sharing one timestamp at a page boundary can be skipped (reported as S6, server side).
- If the server adopts distinct 4000-range close codes per cause, check the close code first and keep `error.code` as the fallback.
- The WS handshake Origin is allowlisted to a single `FRONTEND_URL` (`WebSocketConfig`: `setAllowedOrigins(appProperties.frontendUrl)`), unlike REST CORS which also accepts origin patterns. Vercel preview deploys cannot open WS. On Render even REST allows only `FRONTEND_URL`: `render.yaml` sets no patterns and the default is an empty list (`AppProperties.frontendOriginPatterns`), unless `APP_FRONTEND_ORIGIN_PATTERNS` is added in the dashboard.
- The server has no event for being added to a room (`ChatEventListener.onRoomMemberJoined` only registers the live sessions). A `new_message` for a room missing from the loaded list sets `useRoomsStore.stale`, and the list owner refetches.
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

- Strict CSP built per request by `src/proxy.ts` (policy in `src/lib/csp.ts`), never as a static header in `next.config.ts`:
  - `default-src 'self'`
  - `script-src 'self' 'nonce-<per request>' 'strict-dynamic'`: no `'unsafe-inline'`, and `'unsafe-eval'` in development only (React needs it there). App Router pages carry inline bootstrap scripts, so `script-src 'self'` alone blocks hydration (it shipped that way from Phase 1.1 until 2026-10-25).
  - Next reads the nonce from the request's CSP header and stamps it on its scripts, so every page must render per request: the root layout awaits `connection()`. Keep it.
  - `style-src 'self' 'unsafe-inline'` with no nonce: a nonce would make browsers ignore `'unsafe-inline'` and block React's `style` attributes.
  - `connect-src 'self' ${NEXT_PUBLIC_API_URL} ${NEXT_PUBLIC_WS_URL}`
  - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`
- Verify CSP changes in a real browser (`.claude/launch.json` has a dev and a prod config for the browser pane): no console CSP errors, and the login form shows its client-side validation on an empty submit. Unit tests and `next build` cannot see a blocked script.
- `dangerouslySetInnerHTML` is **forbidden**. CSP blocks it anyway.
- `.env.local` must not be committed (in `.gitignore`). `.env.example` IS committed (whitelisted).

## R6. State management

- Zustand slice files: `src/store/{auth,rooms,messages,ws}.ts`. No combined root.
- SWR for static data only (room list, `/auth/me`, user search). Chat is WS-driven (`messages` store).
- SWR keys carry the user id (`["/api/rooms", userId]`), so two accounts in one tab never share a cache. A fetch that writes into a store checks that the session is still the one it started for (`useRooms` compares the user id, `loadRoomMessages` the messages store epoch).
- The room list lives in `useRoomsStore`; `useRooms` fetches it there. Creating a room merges the response into the held list (`upsertRoom`): an existing DM keeps its `lastMessageAt` and avatars, which the create response lacks.
- Optimistic UI for sends: append `{status: 'pending'}` immediately, replace via `clientMessageId` on `message_ack`. An `error` event carrying `clientMessageId` (`SEND_FAILED` always, `INVALID_DATA` when the request had one; server-v2 `docs/WEBSOCKET.md` §4.9) marks that pending message `failed` right away. Keep `status: 'failed'` after 5s without an ack as the fallback for silent losses, with a retry button. With no open socket, fail at once instead of waiting 5s.
- One `clientMessageId` per message, reused by every retry: the server's idempotency then returns the stored message (an ack, and no `new_message`). `message_ack` goes out on the handler thread and `new_message` after commit on an async listener, so either can arrive first. Reconcile both orders, and confirm from the ack alone. Use `clientMessageId ?? id` as the React key so a row keeps it across the ack. Implementation: `src/store/messages.ts`, `src/lib/chat/connection.ts`.
- Sort server rows by parsed time, then by the fraction's microsecond digits, then id. `Instant.toString()` prints a varying number of fraction digits, so string order is wrong. Rows with only a client time (pending, failed, acked but unseen) stay at the tail.
- Ids removed by `message_expired` or `message_burned` stay as tombstones for the session and are never merged back: a REST page read before the removal can land after it, and the server may send `message_expired` before its delete commits (S11). Don't filter by `expiresAt` against the client clock instead: a clock running ahead would hide a fresh 30s message.
- `mark_read` goes out only from a mounted room view, on an accepted socket (`status === "open"`), while the page is visible (checked again when the 500ms delay ends), once per message id, for the newest server row someone else sent (`src/hooks/useMarkRead.ts`). The server deletes the target when it is someone else's burn-after-read message, so a hidden tab or a background store update must never send it. For the same reason `useRoomMessages` hands out a room's rows only once its list shows them, and a room the view loads itself counts as loaded only after `loadRoomMessages` answers (it merges the first page before its backfill).
- Read receipts come only from `read_update` frames received after connecting (`useRoomsStore.reads`, forward only). REST has no member read point (S15), so a freshly opened room shows none until the other side reads again.
- Invite links: offer them in GROUP rooms only (the server would also link a DIRECT room, S18), and make one only on an explicit click (every request creates another link). `/invite/[code]` joins only when the user presses the button, never on mount. After a join, `upsertRoom` the response and `markStale()` the list.
- The server tells nobody that someone joined, and `new_message` carries no nickname. `touchRoom(roomId, createdAt, senderId)` therefore flags the list stale for a sender the room does not list, once per room and sender, so a list that still lacks them cannot refetch in a loop.
- Countdowns (`useNow`, `src/lib/time.ts`) only change what is shown. Past the deadline they say "곧 사라짐" or "곧 만료"; `message_expired` and `room_expired` are what remove a message or a room (the server deletes messages every minute and rooms every 10 minutes).

## R7. Naming + structure

- Components: `PascalCase.tsx`. Hooks/utils: `camelCase.ts`.
- zod schemas live in `src/lib/api/<domain>.ts` next to the function (request + response both validated).
- DTO types match backend exactly — no client-side renaming.
- File-per-component for top-level UI. Sub-components stay in same file if <50 lines.
- Buttons and form controls come from `src/components/ui/` only. `eslint.config.mjs` (`no-restricted-syntax`) errors on a raw `<button>`, `<input>`, `<select>` or `<textarea>` anywhere else under `src/` (test files excepted). A shape Button's variants don't fit (a list row, a chip, an inline link) uses `ButtonBase` with its own classes; a new kind of control goes into `ui/` first.
- Primitives merge classes with `cn()` (`src/lib/cn.ts`, tailwind-merge), so a caller's class that sets the same property replaces the variant's. Don't use the `!` modifier to beat a variant. On `Input` and `Select`, `className` sets the layout of the outer box (width, flex), not the control's look; on `Button`, `ButtonBase` and `Textarea` it goes on the element.
- Single-line controls (`Input`, `Select`) are `h-10`, level with a md `Button`; keep a row of them at md. See every primitive at `/dev/ui` (`npm run dev`; production answers 404).

## R8. Naver/Korean specifics

- OAuth providers: Google + Naver. Naver requires `state` param (handled server-side).
- Locale primary: ko. UI strings live in `src/i18n/ko.ts` (M1 — single locale).
- Date formatting: `Intl.DateTimeFormat('ko-KR', { ... })`. Don't ship dayjs/date-fns in M1.
- Enter sends and Shift+Enter breaks the line. Ignore Enter while `event.nativeEvent.isComposing` is true or `keyCode === 229`: the Enter that finishes a Hangul syllable must not send, and Safari fires one more Enter right after `compositionend` that only keyCode 229 flags (`src/components/chat/MessageInput.tsx`).

## R9. Build + verify

- `npm test` passes (Vitest, `vitest.config.mts`). New features add at least one test.
- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Run the four one at a time through `memguard -- <command>`.
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
