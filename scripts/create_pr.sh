#!/usr/bin/env bash
set -euo pipefail

# usage: scripts/create_pr.sh [branch-name]
BRANCH=${1:-fix/test-live-mode-script}

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Please commit or stash changes before running this script." >&2
  git status --short
  exit 1
fi

git fetch origin
git checkout -b "$BRANCH"
git add scripts/test_live_mode.sh PR_BODY.md
git commit -m "scripts: harden test_live_mode.sh; add auth, retries, and shellcheck fixes"
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  gh pr create --title "Harden test_live_mode.sh smoke test script" --body-file PR_BODY.md --base main
else
  echo """gh CLI not found. PR body written to PR_BODY.md.
Run the following to create the PR once `gh` is available:

gh pr create --title "Harden test_live_mode.sh smoke test script" --body-file PR_BODY.md --base main
"""
fi

echo "Done. Branch: $BRANCH pushed. PR_BODY.md created/used for the PR body."
