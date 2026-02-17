#!/usr/bin/env bash
set -euo pipefail

HUB_URL="${HUB_URL:-http://localhost:3000}"
LIVE_URL="${LIVE_URL:-http://localhost:8080}"
BOT_URL="${BOT_URL:-http://localhost:5000}"
HUB_API_SECRET="${HUB_API_SECRET:-}"
USER_ID="${USER_ID:-smoke-user}"
PLATFORM="${PLATFORM:-twitter}"
SESSION_ID="smoke-$(date +%s)"

for env_file in .env .env.local .env.development .env.production; do
  if [[ -z "$HUB_API_SECRET" && -f "$env_file" ]]; then
    loaded_secret="$(grep -E '^HUB_API_SECRET=' "$env_file" | tail -n1 | sed 's/^HUB_API_SECRET=//')"
    loaded_secret="${loaded_secret%\"}"
    loaded_secret="${loaded_secret#\"}"
    if [[ -n "$loaded_secret" ]]; then
      HUB_API_SECRET="$loaded_secret"
    fi
  fi
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: required command missing: $1"
    exit 1
  fi
}

need_cmd curl
need_cmd python3

print_step() {
  echo
  echo "==> $1"
}

api_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local auth="${4:-}"

  local headers=("-H" "Content-Type: application/json")
  if [[ -n "$auth" ]]; then
    headers+=("-H" "Authorization: Bearer $auth")
  fi

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" "${headers[@]}" -d "$data"
  else
    curl -sS -X "$method" "$url" "${headers[@]}"
  fi
}

assert_json() {
  local json="$1"
  local expr="$2"
  local fail_msg="$3"
  JSON_INPUT="$json" python3 - "$expr" "$fail_msg" << 'PY'
import json
import os
import sys

expr = sys.argv[1]
fail_msg = sys.argv[2]
payload = json.loads(os.environ.get("JSON_INPUT", "{}"))

try:
    ok = bool(eval(expr, {"__builtins__": {}}, {"d": payload}))
except Exception:
    ok = False

if not ok:
    print("ASSERTION FAILED:", fail_msg)
    print("Response:")
    print(json.dumps(payload, indent=2))
    sys.exit(1)
PY
}

print_step "1) Hub bridge health"
HEALTH_JSON="$(api_json GET "$HUB_URL/api/live-engine/health")"
echo "$HEALTH_JSON"
assert_json "$HEALTH_JSON" 'd.get("success") is True' "Hub bridge health failed"

print_step "2) Live server + bot direct health"
LIVE_HEALTH_JSON="$(api_json GET "$LIVE_URL/health")"
echo "live-server: $LIVE_HEALTH_JSON"
BOT_HEALTH_JSON="$(api_json GET "$BOT_URL/health")"
echo "discord-bot: $BOT_HEALTH_JSON"

print_step "3) Create session"
CREATE_BODY='{"gameMode":"classic","exerciseName":"pushups","showdown":"hub"}'
CREATE_JSON="$(api_json POST "$LIVE_URL/sessions" "$CREATE_BODY")"
echo "$CREATE_JSON"

LIVE_SESSION_ID="$(JSON_INPUT="$CREATE_JSON" python3 - << 'PY'
import json
import os
d = json.loads(os.environ["JSON_INPUT"])
print(d.get("sessionId") or d.get("id") or "")
PY
)"
if [[ -n "$LIVE_SESSION_ID" ]]; then
  SESSION_ID="$LIVE_SESSION_ID"
fi
if [[ -z "$SESSION_ID" ]]; then
  echo "ERROR: sessionId not found in create response"
  exit 1
fi
echo "Using sessionId: $SESSION_ID"

print_step "4) Read + start + end session"
READ_JSON="$(api_json GET "$LIVE_URL/sessions/$SESSION_ID")"
echo "read: $READ_JSON"

START_JSON="$(api_json POST "$LIVE_URL/sessions/$SESSION_ID/start" '{}')"
echo "start: $START_JSON"

END_JSON="$(api_json POST "$LIVE_URL/sessions/$SESSION_ID/end" '{}')"
echo "end: $END_JSON"

print_step "5) Push archive payload to Hub"
if [[ -n "$HUB_API_SECRET" ]]; then
  ARCHIVE_BODY="$(cat <<JSON
{
  \"sessionId\": \"$SESSION_ID\",
  \"endedAt\": $(date +%s%3N),
  \"winner\": {\"userId\": \"$USER_ID\", \"finalScore\": 4200},
  \"finalLeaderboard\": [
    {\"userId\": \"$USER_ID\", \"finalScore\": 4200, \"finalReps\": 42, \"placement\": 1}
  ],
  \"sessionDurationMs\": 300000,
  \"exerciseName\": \"pushups\",
  \"gameMode\": \"classic\",
  \"imageId\": 2
}
JSON
  )"
  ARCHIVE_JSON="$(api_json POST "$HUB_URL/api/live-engine/sessions/ended" "$ARCHIVE_BODY" "$HUB_API_SECRET")"
  echo "$ARCHIVE_JSON"
  assert_json "$ARCHIVE_JSON" 'd.get("success") is True' "Hub archive write failed"

  print_step "6) Verify archive readback"
  READBACK_JSON="$(api_json GET "$HUB_URL/api/live-engine/session/$SESSION_ID")"
  echo "$READBACK_JSON"
  assert_json "$READBACK_JSON" 'd.get("success") is True and d.get("sessionId") and d.get("winner") and d.get("finalLeaderboard") and d.get("gameMode") and d.get("socialImage")' "Archive readback missing required fields"

  print_step "7) Verify share-bonus idempotency"
  BONUS_BODY="$(cat <<JSON
{
  \"userId\": \"$USER_ID\",
  \"sessionId\": \"$SESSION_ID\",
  \"platform\": \"$PLATFORM\",
  \"bonusTickets\": 100,
  \"postUrl\": \"https://x.com/example/status/123\"
}
JSON
  )"
  BONUS_FIRST_JSON="$(api_json POST "$HUB_URL/api/live-engine/share-bonus" "$BONUS_BODY" "$HUB_API_SECRET")"
  echo "first: $BONUS_FIRST_JSON"
  assert_json "$BONUS_FIRST_JSON" 'd.get("success") is True and (d.get("alreadyAwarded") is False or d.get("awardedTickets") == 100)' "First share bonus call failed"

  BONUS_SECOND_JSON="$(api_json POST "$HUB_URL/api/live-engine/share-bonus" "$BONUS_BODY" "$HUB_API_SECRET")"
  echo "second: $BONUS_SECOND_JSON"
  assert_json "$BONUS_SECOND_JSON" 'd.get("success") is True and d.get("alreadyAwarded") is True' "Second share bonus call should be idempotent"
else
  echo "SKIP: HUB_API_SECRET not set or found in .env*; skipping steps 5-7 (archive + share bonus)."
fi

echo
echo "✅ Smoke test passed"
echo "sessionId=$SESSION_ID"