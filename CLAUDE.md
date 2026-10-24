@AGENTS.md
@.claude/RULES.md

# Quick reference for Claude

- This is **Next.js 16 + React 19 + Tailwind v4** — not v15/v18/v3. Confirm before writing code.
- Work in the current checkout. Worktree paths change when worktrees are recycled, so never hardcode one; `git rev-parse --show-toplevel` tells you where you are.
- Backend (Kotlin/Spring Boot v2): `~/Work/geek-chat/geek-chat-server-v2/`. Read-only from this repo. Deploy target: Render + Supabase Postgres, not deployed yet.
- Project status: web-v2 feature work is paused until the backend cutover (decided 2026-10-24). Start from `HANDOFF/SESSION_PROGRESS.md`.
- Before declaring a task done, run the `refresh-context` skill — it updates HANDOFF/, syncs `.claude/` docs, and stages a clean handoff for the next session.
- Auto-trigger: a Stop hook in `.claude/settings.json` runs `refresh-context` when the session ends in a meaningful state.
