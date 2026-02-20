This PR hardens the smoke test script `scripts/test_live_mode.sh`.

Summary of changes
- Adds `set -euo pipefail` and secure `mktemp` cleanup
- Adds optional `BEARER_TOKEN` support for `Authorization: Bearer <token>`
- Adds `curl` retry args for transient failures (`--retry 2 --retry-delay 2`)
- Fixes `shellcheck` warning SC2028 by using `printf` instead of `echo` for escapes
- Prevents duplicated HTTP code when `curl` fails by handling failures explicitly

Linting
- Ran `shellcheck` and addressed SC2028. No remaining critical SC warnings were found during the local check reported to me.

How to verify locally

```bash
# quick lint
shellcheck scripts/test_live_mode.sh

# quick traced run (won't hang)
BASE_URL=http://localhost:9 TIMEOUT=2 bash -x scripts/test_live_mode.sh

# full smoke test (use BEARER_TOKEN if needed)
BEARER_TOKEN=your_token BASE_URL=http://localhost:3000 TIMEOUT=10 bash scripts/test_live_mode.sh
```

Review notes
- The script prints `000` when `curl` fails (network/timeout). When you run against a live server you should see `200`/`201` codes and JSON bodies.

If you prefer a different branch name or PR title, edit the helper script `scripts/create_pr.sh` before running it.

---
Automated helper included: `scripts/create_pr.sh` will create the branch, commit, push and (if `gh` is available) open the PR using this body file.
