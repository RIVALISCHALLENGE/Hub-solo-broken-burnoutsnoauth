Release: Trigger redeploy and fix build issues

Summary
- Resolve merge-conflict markers introduced by commit 997c591 that caused build failures.
- Restore `VoiceNavigator` implementation and fix `ChatbotTour` merge issues.
- Gate Stripe initialization and endpoints behind `ENABLE_STRIPE` (disabled by default) to avoid runtime Stripe errors while reviewing.
- Deduplicate Stripe deps in `package.json` and add harmless 503 stubs when Stripe is disabled.
- Verified: `npm run build` completes locally and `vite preview` serves the site.

Notes for deploy
- Keep `ENABLE_STRIPE=false` in env for preview/staging to avoid Stripe init errors on servers without credentials.
- If you want Stripe active, set `ENABLE_STRIPE=true` and ensure `DATABASE_URL`/Stripe keys are configured.

Changes Included
- server.js: unified app init, Stripe gating, webhooks and API endpoints.
- src/components/accessibility/VoiceNavigator.jsx: fixed merge markers and restored functionality.
- src/components/ChatbotTour/ChatbotTour.jsx: removed leftover conflict markers.
- index.html: cleaned service-worker registration merge remnants.
- package.json: deduped Stripe dependencies.

How to create the release (run locally)

# create a tag and push it (this will create a GitHub tag)
git fetch origin
git checkout main
git pull origin main
git tag -a v0.2.0 -m "v0.2.0: Fix build, gate Stripe behind ENABLE_STRIPE, resolve merge conflicts"
git push origin v0.2.0

# OR create a GitHub release (requires gh CLI)
gh release create v0.2.0 \
  --title "v0.2.0: Fix build & gate Stripe" \
  --notes-file RELEASE_NOTES.md

If you prefer, open the Repo → Releases → Draft a new release, pick tag `v0.2.0`, paste these release notes, and publish.
