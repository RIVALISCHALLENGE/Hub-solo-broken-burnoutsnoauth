import { ensureBotsOnline, startBotPresenceLoop, simulateLobbyActivity, simulateBotChat, simulateBotGames } from "./botSim.js";

const lobbyId = process.env.BOT_LOBBY_ID || null;
const botCount = Number(process.env.BOT_COUNT) || 12;

export async function runBotSimulation() {
  try {
    console.log(`[runBotSim] starting: botCount=${botCount} lobbyId=${lobbyId}`);
    const botIds = await ensureBotsOnline(botCount);
    startBotPresenceLoop(botIds);

    if (lobbyId) {
      await simulateLobbyActivity(botIds, lobbyId);
      await simulateBotChat(botIds, lobbyId);
      await simulateBotGames(botIds, lobbyId);
    }
    console.log(`[runBotSim] finished initial startup`);
    return botIds;
  } catch (err) {
    console.error("[runBotSim] error:", err);
    throw err;
  }
}

// Auto-run when executed directly; can be disabled by setting RUN_AS_SCRIPT=false
if (process.env.RUN_AS_SCRIPT !== "false") {
  runBotSimulation().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
