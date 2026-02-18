# Live Engine Backend-Only Setup (Copy/Paste Ready)

Use this when you want your rivalis-live-engine repo to run only as backend services (Live Server + Discord Bot), while Hub remains the UI and gameplay owner.

---

## 1) Run this in rivalis-live-engine repo root

Copy/paste everything below into terminal:

```bash
set -e

git add -A
git commit -m "pre-backend-only snapshot" || true
git checkout -b backend-only

mkdir -p _archive_backend_only/root
shopt -s dotglob nullglob

keep=(
  .git .github
  live-server
  discord-bot
  package.json
  ecosystem.config.js
  .gitignore
  .editorconfig
  README.md
  DEPLOYMENT.md
)

is_keep() {
  local x="$1"
  for k in "${keep[@]}"; do [[ "$x" == "$k" ]] && return 0; done
  return 1
}

for item in * .*; do
  [[ "$item" == "." || "$item" == ".." ]] && continue
  if ! is_keep "$item"; then
    mv "$item" "_archive_backend_only/root/" || true
  fi
done

mkdir -p _archive_backend_only/live-server-public
if [ -d live-server/public ]; then
  find live-server/public -maxdepth 1 -type f \
    \( -name "*.html" -o -name "CLIENT_*" -o -name "*integration*" \) \
    -exec mv {} _archive_backend_only/live-server-public/ \; || true
fi

cat > live-server/.env.example << 'EOF'
PORT=8080
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", "...":"..."}
DISCORD_BOT_URL=http://localhost:5000
HUB_API_URL=https://your-hub-domain.vercel.app
HUB_API_SECRET=replace-with-strong-secret
EOF

cat > discord-bot/.env.example << 'EOF'
BOT_PORT=5000
NODE_ENV=production
DISCORD_TOKEN=replace-me
DISCORD_GUILD_ID=replace-me
EOF

(cd live-server && npm install)
(cd discord-bot && npm install)

echo "Backend-only conversion complete."
echo "Run these in separate terminals:"
echo "cd live-server && npm start"
echo "cd discord-bot && npm start"
echo "Health checks:"
echo "curl http://localhost:8080/health"
echo "curl http://localhost:5000/health"
```

---

## 2) Hub env values to connect to it

Set these in your Hub deployment:

```env
LIVE_ENGINE_URL=https://your-live-server-host
LIVE_ENGINE_DISCORD_BOT_URL=https://your-discord-bot-host
VITE_USE_LIVE_ENGINE_ROOMS=true
DISCORD_GUILD_ID=your_discord_guild_id
```

Also keep the same social image URL config from live repo in Hub:

- Source in live repo: `live-server/config/socialImages.js`
- Mirrored in this Hub repo: `replit_integrations/live-engine-sync/socialImages.js`

---

## 3) Verify end-to-end

1. Hit Hub bridge health endpoint:

```bash
curl https://your-hub-domain/api/live-engine/health
```

2. Create a room in Hub Live mode.
3. Confirm a Discord VC invite link appears in lobby.
4. Start match and confirm Hub gameplay still runs from Hub logic.

5. Test session archive payload (with social image support copied from your Live setup):

```bash
curl -X POST https://your-hub-domain/api/live-engine/sessions/ended \
  -H "Authorization: Bearer your_hub_api_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"test-session-123",
    "endedAt": 1769995644271,
    "winner":{"userId":"test-user","finalScore":4200},
    "finalLeaderboard":[{"userId":"test-user","finalScore":4200,"finalReps":42,"placement":1}],
    "sessionDurationMs":300000,
    "exerciseName":"pushups",
    "gameMode":"classic",
    "imageId":2
  }'
```

Then verify archive includes `socialImage`:

```bash
curl https://your-hub-domain/api/live-engine/session/test-session-123
```

6. Test social share bonus (+100 tickets by default):

```bash
curl -X POST https://your-hub-domain/api/live-engine/share-bonus \
  -H "Authorization: Bearer your_hub_api_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user",
    "sessionId":"test-session-123",
    "platform":"twitter",
    "bonusTickets":100,
    "postUrl":"https://x.com/example/status/123"
  }'
```

Expected response includes `"success": true` and `"awardedTickets": 100`.

Notes:
- Endpoint is idempotent per `sessionId + platform` (same share won’t double-award).
- If `bonusTickets` is omitted, Hub awards `100` by default.
- Session archive route accepts `socialImage`, `imageId`, or `imageUrl`; if omitted, Hub selects a random URL from your copied social image config.

---

## 4) Rollback if needed

In rivalis-live-engine repo:

```bash
git checkout main
git branch -D backend-only
```

(Or keep backend-only branch and merge only after validation.)
