# `.claude/` — Agent infrastructure for GeekChat Web v2

This folder is the entry point for any AI coding agent (Claude Code, Cursor, Codex, etc.) working in this repo.

## Layout

```
.claude/
├── README.md             ← this file
├── RULES.md              ← binding project rules (overrides training data)
├── settings.json         ← Claude Code settings (permissions + Stop hook)
├── hooks/
│   └── refresh-context-reminder.sh   ← Stop hook: remind to run refresh-context
├── skills/
│   └── refresh-context/
│       ├── SKILL.md      ← skill definition (frontmatter + body)
│       └── update.sh     ← helper that does the actual file updates
└── worktrees/
    └── fervent-bell-35addf/   ← active worktree (this directory tree lives inside it)
```

> Note: in the parent repo (`geek-chat-web-v2/.claude/`), only `worktrees/` exists. The `.claude/` you're reading right now is **inside the worktree** and gets merged to parent on PR. Don't double-define settings/skills in both — keep them in the worktree, merge to main once stabilized.

## Stack quick reference

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack default) |
| React | 19 (RSC stable) |
| Styling | Tailwind v4 (CSS-based config, NO `tailwind.config.ts`) |
| State | Zustand (slice files in `src/store/`) |
| Data | SWR (static data only — chat is WS-driven) |
| Forms | react-hook-form + zod + @hookform/resolvers |
| Toast | sonner |
| Icons | lucide-react |
| TS | 5.x strict, `@/*` → `src/*` |
| ESLint | v9 flat config |

## Folder structure (target — full layout in `HANDOFF/ARCHITECTURE.md`)

```
src/
├── app/             # App Router pages
│   ├── (public)/    # No auth required
│   └── (authed)/    # AuthGuard required
├── components/      # AppBoot, ui/, auth/, chat/, room/
├── lib/             # api/, ws/, auth/, env, uuid, time
├── store/           # auth, rooms, messages, ws (Zustand slices)
├── hooks/           # useAuth, useRooms, useMessages, useWebSocket, ...
├── types/           # api, ws, domain
└── i18n/            # ko.ts + index.ts
```

## How to start a session

1. Read `HANDOFF/SESSION_PROGRESS.md` — current state + last completed step.
2. Skim `RULES.md` — binding rules.
3. Skim `AGENTS.md` (one level up) — stack version warnings.
4. Run `npm install` if `node_modules/` is missing.
5. `npm run dev` to verify boot.
6. Continue from the "Next session" section of `SESSION_PROGRESS.md`.

## How to end a session

The Stop hook (`.claude/hooks/refresh-context-reminder.sh`) runs automatically and reminds you to invoke the **refresh-context skill** if you've made meaningful changes. The skill:

1. Updates `HANDOFF/SESSION_PROGRESS.md` with what was just done.
2. Syncs version numbers in `AGENTS.md` if `package.json` changed.
3. Writes a "Next session" continuation plan.
4. Stages relevant docs for commit.

If the hook didn't fire (e.g. you Ctrl+C'd), invoke the skill manually:
- In Claude Code: ask "run the refresh-context skill"
- Or directly: `bash .claude/skills/refresh-context/update.sh`

## Why minimal `.claude/`

Per advisor guidance: documentation of imagined patterns is premature abstraction. We start with `RULES.md` (real rules from HANDOFF), `settings.json` (permissions + hook), and the `refresh-context` skill (workflow that compounds value across sessions). `commands/`, `agents/`, additional `skills/` arrive when real patterns emerge from Phase 1.1+ implementation.
