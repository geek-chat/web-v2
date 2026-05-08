<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# GeekChat Web v2 — Agent Guidance

## Stack (verify before writing code)

| Tool | Version | Notes |
|---|---|---|
| Next.js | **16.x** | Not 15. App Router. Turbopack is default (no `--no-turbopack` flag). |
| React | **19.x** | RSC stable. `useFormStatus`, `useOptimistic`, `useActionState` available. |
| Tailwind | **v4** | **No `tailwind.config.ts`** — config is CSS-based via `@theme` in `globals.css`. |
| TypeScript | 5.x | Strict mode. `@/*` → `./src/*`. |
| ESLint | v9 | Flat config (`eslint.config.mjs`). |
| Node types | `@types/node@20` |  |

When in doubt about an API, check `node_modules/next/dist/docs/` or run `npm ls next react tailwindcss`.

## Project rules (binding)

1. **OAuth fragment parsing — client-side only.** `'use client'` + `useEffect` on mount. Call `clearHash()` (history.replaceState) immediately to prevent referer leaks.
2. **WebSocket = global singleton.** Stored in Zustand (`src/store/ws.ts`). Backend caps at 3 connections per user. Never instantiate per-component.
3. **fetch() must go through `src/lib/api/client.ts`.** Direct `fetch()` calls bypass the single-flight refresh and break 401 handling.
4. **`clientMessageId` = `crypto.randomUUID()`** (client only — wrap in `typeof window !== 'undefined'` for SSR safety). Used as backend idempotency key.
5. **Refresh failure → immediate logout + redirect.** Never silently retry beyond once. Clear localStorage + push to `/login`.
6. **CSP headers in `next.config.ts`** — strict policy. No inline scripts, no eval, `connect-src` allowlists API + WS URLs only.
7. **Dark mode**: `<html className="dark">` fixed in `layout.tsx`. Use Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css` for class-based dark mode.
8. **Server vs Client**: landing (`/`) is RSC; everything under `(authed)/`, `(public)/auth/*`, and any page using hooks is `'use client'`.
9. **Naming**: PascalCase for components, camelCase for utils/hooks. zod schemas live in `src/lib/api/<domain>.ts` next to the functions.
10. **No `dangerouslySetInnerHTML`** — React auto-escapes; CSP blocks inline anyway.

## Backend contract anchors

- REST: `~/Work/geek-chat/geek-chat-server-v2/docs/API.md`
- WebSocket: `~/Work/geek-chat/geek-chat-server-v2/docs/WEBSOCKET.md`
- Domain rules: `~/Work/geek-chat/geek-chat-server-v2/.claude/RULES.md`
- Hexagonal architecture (server side): `domain/`, `application/`, `infrastructure/`, `adapter/`. Server tests: 105+ passing.

Frontend OAuth callbacks must match backend hash format exactly:
- `/auth/success#access_token=...&refresh_token=...`
- `/auth/oauth-link#link_token=...&existing_nickname=...&new_provider=...`
- `/auth/oauth-complete#signup_token=...&suggested_nickname=...`
- `/auth/error?error=oauth_failed` (query, NOT hash)

## Where to read first

1. `HANDOFF/SESSION_PROGRESS.md` — what state the repo is in right now
2. `HANDOFF/GETTING_STARTED.md` — onboarding (note: written for Next.js 15 — see "Stack" above for v16/v4 diffs)
3. `HANDOFF/ARCHITECTURE.md` — folder structure, data flow
4. `HANDOFF/API_INTEGRATION.md` — REST + WS contract + code snippets
5. `HANDOFF/AUTH_UX.md` — auth flow + wireframes
6. `HANDOFF/MOBILE_STRATEGY.md` — webview vs native vs RN analysis
7. `.claude/RULES.md` — concise binding rules (mirror of section above)

## Always-on behaviors

- Before completing a session: run the **refresh-context** skill (auto-triggered by Stop hook). It updates HANDOFF/, regenerates progress markers, and prepares the next session for context-fresh resumption.
- Test policy: existing tests are spec — fix production code, not tests. New features require ≥1 test.
- Commit policy: atomic per logical unit. Use HEREDOC for messages. Never amend (always new commit on hook failure).
