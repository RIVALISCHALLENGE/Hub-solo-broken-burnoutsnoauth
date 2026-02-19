import { db } from "../firebase.js";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  where,
  Timestamp,
  arrayUnion,
  runTransaction
} from "firebase/firestore";

const USE_LIVE_ENGINE_ROOMS =
  (import.meta.env.VITE_USE_LIVE_ENGINE_ROOMS || "false").toLowerCase() === "true";

async function callHubLiveEngineBridge(path, method = "GET", body = null) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || `Bridge request failed (${response.status})`);
  }

  return data;
}

export const LiveService = {

  async createRoom(hostId, hostName, hostAvatar, showdown, trickMode) {
    try {
      let externalSessionId = null;
      let discordVcLink = ""; // declared once

      if (USE_LIVE_ENGINE_ROOMS) {
        const created = await callHubLiveEngineBridge(
          "/api/live-engine/rooms/create",
          "POST",
          {
            gameMode: trickMode || "classic",
            exerciseName:
              showdown?.exercises?.[0] || showdown?.name || "pushups",
            showdown,
          }
        );
        externalSessionId = created?.sessionId || null;
      }

      const roomData = {
        hostId,
        hostName,
        hostAvatar: hostAvatar || "",
        roomName: `${showdown.name} ${trickMode === "chaos" ? "Chaos " : ""}Arena`,
        showdown: {
          id: showdown.id,
          name: showdown.name,
          category: showdown.category,
        },
        trickMode: trickMode || "classic",
        status: "waiting",
        players: [
          {
            userId: hostId,
            userName: hostName,
            avatar: hostAvatar || "",
            ready: true,
            score: 0,
            currentCardIndex: 0,
            completedCards: 0,
            totalReps: 0,
            activeEffects: [],
            ticketsEarned: 0,
          },
        ],
        maxPlayers: 6,
        deck: [],
        currentPhase: "lobby",
        round: 0,
        totalRounds: 0,
        playOrder: [],
        currentTurnIndex: 0,
        activeEffects: [],
        gameLog: [],
        createdAt: Timestamp.now(),
        lastActivity: Timestamp.now(),
        finishedAt: null,
        externalSessionId,
        discordVcLink: "",
      };

      const docRef = await addDoc(collection(db, "liveRooms"), roomData);

      // Create Discord VC AFTER room exists
      try {
        const discordBotUrl =
          import.meta.env.VITE_DISCORD_BOT_URL || "http://localhost:5000";

        const discordRes = await fetch(`${discordBotUrl}/create-vc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: docRef.id }),
        });

        const discord = await discordRes.json();

        if (discord?.inviteLink) {
          discordVcLink = discord.inviteLink;

          await updateDoc(docRef, {
            discordVcLink,
            lastActivity: Timestamp.now(),
          });
        }
      } catch (error) {
        console.warn("Discord VC provisioning failed:", error.message);
      }

      return { success: true, roomId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  subscribeToRooms(callback) {
    const roomsRef = collection(db, "liveRooms");
    const q = query(roomsRef, where("status", "in", ["waiting", "playing"]));
    return onSnapshot(q, (snapshot) => {
      const rooms = [];
      snapshot.forEach((d) => rooms.push({ id: d.id, ...d.data() }));
      callback(rooms);
    });
  },

  subscribeToRoom(roomId, callback) {
    return onSnapshot(doc(db, "liveRooms", roomId), (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      } else {
        callback(null);
      }
    });
  },

  async deleteRoom(roomId) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.exists() ? roomSnap.data() : null;

      if (USE_LIVE_ENGINE_ROOMS && roomData?.externalSessionId) {
        try {
          await callHubLiveEngineBridge(
            `/api/live-engine/rooms/${roomData.externalSessionId}/end`,
            "POST",
            {}
          );
        } catch (error) {
          console.warn("External cleanup failed:", error.message);
        }
      }

      try {
        const discordBotUrl =
          import.meta.env.VITE_DISCORD_BOT_URL || "http://localhost:5000";
        await fetch(`${discordBotUrl}/delete-vc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: roomId }),
        });
      } catch (error) {
        console.warn("Discord VC destruction failed:", error.message);
      }

      await deleteDoc(roomRef);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
