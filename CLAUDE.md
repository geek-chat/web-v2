@AGENTS.md
@.claude/RULES.md

# Quick reference for Claude

- This is **Next.js 16 + React 19 + Tailwind v4** — not v15/v18/v3. Confirm before writing code.
- Workspace root: `/Users/jsh14/Work/geek-chat/geek-chat-web-v2/.claude/worktrees/fervent-bell-35addf/` (worktree on branch `claude/fervent-bell-35addf`).
- Backend (Kotlin/Spring Boot v2): `~/Work/geek-chat/geek-chat-server-v2/`. 105+ tests, deployable to Docker Compose.
- Before declaring a task done, run the `refresh-context` skill — it updates HANDOFF/, syncs `.claude/` docs, and stages a clean handoff for the next session.
- Auto-trigger: a Stop hook in `.claude/settings.json` runs `refresh-context` when the session ends in a meaningful state.
