import { ensureBotsOnline, startBotPresenceLoop, generateBotProfile } from "./botSim.js";
import { createLobby, joinLobby, setReady, startLobby } from "../live/lobby.js";
import { db } from "../firebase.js";
import { getDocs, collection } from "firebase/firestore";

// Utility: Find active lobbies (status: waiting or started)
async function getActiveLobbies() {
  const lobbiesSnap = await getDocs(collection(db, "lobbies"));
  const lobbies = [];
  lobbiesSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === "waiting" || data.status === "started") {
      lobbies.push({ id: doc.id, ...data });
    }
  });
  return lobbies;
}

// Main: Ensure at least one bot-hosted lobby exists if none are active
async function ensureBotHostedLobby(minPlayers = 2, maxPlayers = 6) {
  const lobbies = await getActiveLobbies();
  if (lobbies.length === 0) {
    // Create a bot host
    const botIds = await ensureBotsOnline(1);
    const hostId = botIds[0];
    const profile = generateBotProfile();
    const lobbyId = await createLobby(hostId, profile.nickname);
    // Add more bots to fill the lobby
    const moreBots = await ensureBotsOnline(maxPlayers - 1);
    for (const botId of moreBots) {
      if (botId !== hostId) {
        await joinLobby(lobbyId, botId, generateBotProfile().nickname);
        await setReady(lobbyId, botId, true);
      }
    }
    // Set host ready and start lobby
    await setReady(lobbyId, hostId, true);
    await startLobby(lobbyId, hostId);
    return lobbyId;
  }
  return null;
}

// Entrypoint: Run this to ensure bots always host a joinable game
async function runBotAutoHost() {
  await ensureBotHostedLobby();
  // Optionally, repeat every X seconds to keep lobbies alive
  setInterval(ensureBotHostedLobby, 60000);
}

runBotAutoHost();
