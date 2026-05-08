#!/usr/bin/env bash
# Stop hook: reminds Claude to run the refresh-context skill when the session
# ends in a meaningful state (uncommitted source changes, untracked files, or
# > N commits ahead of HEAD@{1}).
#
# Output goes to stderr so the user / Claude both see it. Exits 0 either way —
# this is informational, never blocking.

set -uo pipefail

# Cheap "is this a meaningful change session" heuristic.
# Skip if the working tree is fully clean and last commit hasn't changed.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# Anything dirty?
if git rev-parse --git-dir >/dev/null 2>&1; then
  dirty=$(git status --porcelain 2>/dev/null | head -1)
else
  dirty=""
fi

if [[ -z "$dirty" ]]; then
  # Clean tree — no reminder needed.
  exit 0
fi

cat >&2 <<'EOF'
[refresh-context reminder]

Working tree has uncommitted changes. Before ending the session, run the
refresh-context skill so the next session can pick up cleanly:

  • Updates HANDOFF/SESSION_PROGRESS.md with what was just done
  • Syncs version markers in AGENTS.md (if package.json changed)
  • Writes a "Next session" continuation plan
  • Optionally stages docs for commit

To invoke (one of):
  - Tell Claude: "run the refresh-context skill"
  - Or shell:    bash .claude/skills/refresh-context/update.sh
EOF

exit 0
