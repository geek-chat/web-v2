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
| Node types | `@types/node@24` | Matches the Node 24 runtime; vitest 5 requires `^22 || >=24`. |
| Tests | Vitest 5 + jsdom + React Testing Library | `npm test` runs once (`vitest run`); config in `vitest.config.mts`. |

When in doubt about an API, check `node_modules/next/dist/docs/` or run `npm ls next react tailwindcss`.

## Project rules (binding)

1. **OAuth fragments go through `useOAuthHash()` only.** It reads the fragment once on the client, and only when this tab started the flow with `startOAuthFlow()` (`src/lib/auth/oauthFlow.ts`), then clears it from the URL (history.replaceState). One-time `link_token` and `signup_token` stay in component state, never in storage.
2. **WebSocket = global singleton.** Stored in Zustand (`src/store/ws.ts`). Backend caps at 3 connections per user. Never instantiate per-component.
3. **fetch() must go through `src/lib/api/client.ts`.** Direct `fetch()` calls bypass the single-flight refresh and break 401 handling.
4. **`clientMessageId` = `crypto.randomUUID()`** (client only — wrap in `typeof window !== 'undefined'` for SSR safety). Used as backend idempotency key.
5. **Refresh failure → immediate logout + redirect.** Never silently retry beyond once. Clear localStorage + push to `/login`.
6. **CSP comes from `src/proxy.ts` with a per-request nonce** (`src/lib/csp.ts`). No `'unsafe-inline'` scripts, no eval outside development, `connect-src` allowlists API + WS URLs only. Every page renders per request so Next can stamp the nonce (root layout awaits `connection()`).
7. **Dark mode**: `<html className="dark">` fixed in `layout.tsx`. Use Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css` for class-based dark mode.
8. **Server vs Client**: landing (`/`) is RSC; everything under `(authed)/`, `(public)/auth/*`, and any page using hooks is `'use client'`.
9. **Naming**: PascalCase for components, camelCase for utils/hooks. zod schemas live in `src/lib/api/<domain>.ts` next to the functions.
10. **No `dangerouslySetInnerHTML`** — React auto-escapes; CSP blocks inline anyway.

## Backend contract anchors

- REST: `~/Work/geek-chat/geek-chat-server-v2/docs/API.md`
- WebSocket: `~/Work/geek-chat/geek-chat-server-v2/docs/WEBSOCKET.md`
- Domain rules: `~/Work/geek-chat/geek-chat-server-v2/.claude/RULES.md`
- Server side is a multi-module Gradle build (e.g. `auth/`, `websocket/`, `app/`) with `presentation/`, `application/`, `domain/`, `infrastructure/` packages per module. When server docs and code disagree, **code wins**: server phases 3-8 landed after the last docs drift check.
- Deployment: Render free tier (Docker) + Supabase Postgres, not deployed yet (server-v2 `docs/MIGRATION.md` Phase 8). The WS handshake Origin and the OAuth redirect target are both tied to a single `FRONTEND_URL`.
- This repo never edits `geek-chat-server-v2/`, `geek-chat-web/`, or `geek-chat-server/`. Read them for contracts and report problems to the user.

Frontend OAuth callbacks must match backend hash format exactly:
- `/auth/success#access_token=...&refresh_token=...`
- `/auth/oauth-link#link_token=...&existing_nickname=...&new_provider=...`
- `/auth/oauth-complete#signup_token=...&suggested_nickname=...`
- `/auth/error?error=<code>` (query, NOT hash), where code is `oauth_cancelled`, `missing_params`, `invalid_state`, or `oauth_failed` (`AuthController.kt:100-112`)

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
- Verification: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, one at a time through `memguard -- <command>`.
- Push-time quick check for agent hooks: the comment below. The hook reads it only when it sits on a line of its own.

<!-- repo-verify: npx tsc --noEmit -->
- Commit policy: atomic per logical unit. Use HEREDOC for messages. Never amend (always new commit on hook failure).
