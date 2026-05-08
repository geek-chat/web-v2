#!/usr/bin/env bash
# refresh-context skill helper — emits inventory snapshots for Claude to digest.
# Pure observation: prints to stdout, never modifies files.
#
# Usage: bash .claude/skills/refresh-context/update.sh

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || cd "$(dirname "$0")/../../.."

echo "=== git status ==="
git status -s 2>/dev/null || echo "(not a git repo)"
echo

echo "=== current branch ==="
git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(unknown)"
echo

echo "=== last commit ==="
git log -1 --oneline 2>/dev/null || echo "(no commits)"
echo

echo "=== commits since previous HEAD ==="
git rev-list --count HEAD@{1}..HEAD 2>/dev/null || echo "0"
echo

echo "=== package.json diff (last commit) ==="
git diff HEAD@{1} -- package.json 2>/dev/null | head -40 || echo "(no change)"
echo

echo "=== installed major versions ==="
if [[ -f package.json ]]; then
  for pkg in next react tailwindcss zustand swr react-hook-form zod sonner lucide-react; do
    ver=$(node -e "try { console.log(require('./node_modules/' + '$pkg' + '/package.json').version) } catch(e) { console.log('not installed') }" 2>/dev/null)
    printf "  %-20s %s\n" "$pkg" "$ver"
  done
fi
echo

echo "=== HANDOFF/ files ==="
ls HANDOFF/ 2>/dev/null || echo "(no HANDOFF dir)"
echo

echo "=== src/ overview ==="
if [[ -d src ]]; then
  find src -type f -name '*.ts*' | head -30
else
  echo "(no src yet)"
fi
echo

echo "=== node_modules present ==="
[[ -d node_modules ]] && echo "yes ($(du -sh node_modules 2>/dev/null | cut -f1))" || echo "no"
echo

echo "=== .env.local present ==="
[[ -f .env.local ]] && echo "yes" || echo "no"
echo

echo "=== Next steps Claude should take ==="
cat <<'EOF'
1. Read HANDOFF/SESSION_PROGRESS.md (or create if missing)
2. Cross-reference git status above with progress doc
3. Update SESSION_PROGRESS.md sections:
   - "Current state" (one-liner)
   - "Done this session"
   - "In-flight" (if anything paused)
   - "Next session — start here" (concrete commands)
4. Sync AGENTS.md version markers if package.json changed
5. Stage updated docs (do NOT commit — leave for user approval)
6. Report a short markdown table summary
EOF
