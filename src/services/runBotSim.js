import { ensureBotsOnline, startBotPresenceLoop, simulateLobbyActivity, simulateBotChat, simulateBotGames } from "./botSim.js";

// TODO: Replace with a real lobby ID from your Firestore if you want bots to join a lobby
const lobbyId = null; // e.g., "abc123lobbyid"

async function runBotSimulation() {
  // 1. Ensure bots exist and are online
  const botIds = await ensureBotsOnline(12);

  // 2. Start presence loop (keeps bots online)
  startBotPresenceLoop(botIds);

  // 3. Simulate lobby activity, chat, and games if a lobbyId is provided
  if (lobbyId) {
    await simulateLobbyActivity(botIds, lobbyId);
    await simulateBotChat(botIds, lobbyId);
    await simulateBotGames(botIds, lobbyId);
  }
}

runBotSimulation();
