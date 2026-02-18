## Responsibility Split (Current Hybrid Setup)

### Live Server + Discord VC Bot are in charge of:
- Creating and hosting live session rooms.
- Room/session lifecycle API:
  - `POST /sessions`
  - `GET /sessions/:sessionId`
  - `POST /sessions/:sessionId/start`
  - `POST /sessions/:sessionId/end`
- Discord VC management:
  - `POST /create-vc` (create voice channel + invite link)
  - Optional VC cleanup endpoint (if implemented in bot)

### Hub Server is in charge of:
- Game logic authority (cards, turn flow, scoring, winner calculation).
- Rep validation authority (Hub validates reps in current setup).
- Persisting Hub-owned room/game state.
- Session archive sync endpoint:
  - `POST /api/live-engine/sessions/ended`
  - stores `winner`, `finalLeaderboard`, `gameMode`, and `socialImage`
- Session archive read endpoint:
  - `GET /api/live-engine/session/:sessionId`
- Social-share raffle bonus:
  - `POST /api/live-engine/share-bonus` (idempotent by `sessionId + platform`)

### Not handled by Hub (by design):
- Live rep-processing/anti-cheat engine from live-server repo.
- Discord winner-announcement / temporary role automation (handled in live-session repo).
