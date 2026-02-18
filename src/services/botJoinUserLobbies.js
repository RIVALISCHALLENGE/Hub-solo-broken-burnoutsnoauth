import { ensureBotsOnline, generateBotProfile } from "./botSim.js";
import { joinLobby, setReady } from "../live/lobby.js";
import { db } from "../firebase.js";
import { getDocs, collection } from "firebase/firestore";

// Find user-created lobbies that are waiting and not full
async function getJoinableUserLobbies() {
  const lobbiesSnap = await getDocs(collection(db, "lobbies"));
  const joinable = [];
  lobbiesSnap.forEach(doc => {
    const data = doc.data();
    if (
      data.status === "waiting" &&
      data.hostUid &&
      !data.hostUid.startsWith("bot_") &&
      data.maxPlayers &&
      data.minPlayers &&
      data.createdAt
    ) {
      joinable.push({ id: doc.id, ...data });
    }
  });
  return joinable;
}

// Main: Bots join user lobbies if not full
async function botsJoinUserLobbies() {
  const lobbies = await getJoinableUserLobbies();
  if (lobbies.length === 0) return;
  const botIds = await ensureBotsOnline(10); // Use up to 10 bots
  for (const lobby of lobbies) {
    // Get number of players in this lobby
    const playersSnap = await getDocs(collection(db, "lobbies", lobby.id, "players"));
    if (playersSnap.size < lobby.maxPlayers) {
      // Add a bot to this lobby
      const botId = botIds[Math.floor(Math.random() * botIds.length)];
      await joinLobby(lobby.id, botId, generateBotProfile().nickname);
      await setReady(lobby.id, botId, true);
    }
  }
}

// Entrypoint: Run every 30 seconds
setInterval(botsJoinUserLobbies, 30000);
botsJoinUserLobbies();
