git checkout -b fix/test-live-mode-script
git add scripts/test_live_mode.sh
git commit -m "scripts: harden test_live_mode.sh; add auth, retries, and shellcheck fixes"
git push -u origin fix/test-live-mode-script

# Create PR (requires `gh` CLI authenticated)
gh pr create --title "Harden test_live_mode.sh smoke test script" --body $'This PR hardens the smoke test script `scripts/test_live_mode.sh`:\n\n- Adds `set -euo pipefail` and secure `mktemp` cleanup\n- Adds optional `BEARER_TOKEN` support for Authorization header\n- Adds curl retry args for transient failures\n- Fixes shellcheck SC2028 by using `printf`\n- Prevents duplicated HTTP code when `curl` fails\n\nLinting:\n- Ran `shellcheck` and fixed SC2028\n\nRun locally to verify:\n\n```\n# quick lint\nshellcheck scripts/test_live_mode.sh\n\n# quick traced run\nBASE_URL=http://localhost:9 TIMEOUT=2 bash -x scripts/test_live_mode.sh\n\n# full smoke test\nBEARER_TOKEN=your_token BASE_URL=http://localhost:3000 TIMEOUT=10 bash scripts/test_live_mode.sh\n```\n' --base main