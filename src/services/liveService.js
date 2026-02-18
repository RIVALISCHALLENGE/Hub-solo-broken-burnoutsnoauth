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
  getDocs,
  arrayUnion,
  runTransaction
} from "firebase/firestore";

const USE_LIVE_ENGINE_ROOMS = (import.meta.env.VITE_USE_LIVE_ENGINE_ROOMS || "false").toLowerCase() === "true";

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
      let discordVcLink = "";

      if (USE_LIVE_ENGINE_ROOMS) {
        const created = await callHubLiveEngineBridge("/api/live-engine/rooms/create", "POST", {
          gameMode: trickMode || "classic",
          exerciseName: showdown?.exercises?.[0] || showdown?.name || "pushups",
          showdown,
        });
        externalSessionId = created?.sessionId || null;

        if (externalSessionId) {
          try {
            const discord = await callHubLiveEngineBridge(`/api/live-engine/rooms/${externalSessionId}/discord-vc`, "POST", {});
            discordVcLink = discord?.inviteLink || "";
          } catch (error) {
            console.warn("Discord VC provisioning failed:", error.message);
          }
        }
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
        players: [{
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
        }],
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
        discordVcLink,
      };
      const docRef = await addDoc(collection(db, "liveRooms"), roomData);
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

  async joinRoom(roomId, userId, userName, avatar) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return { success: false, error: "Room not found" };

      const roomData = roomSnap.data();
      const players = roomData.players || [];

      if (players.find((p) => p.userId === userId)) return { success: true };
      if (players.length >= (roomData.maxPlayers || 6)) return { success: false, error: "Room is full" };
      if (roomData.status !== "waiting") return { success: false, error: "Match already started" };

      await updateDoc(roomRef, {
        players: [...players, {
          userId,
          userName,
          avatar: avatar || "",
          ready: false,
          score: 0,
          currentCardIndex: 0,
          completedCards: 0,
          totalReps: 0,
          activeEffects: [],
          ticketsEarned: 0,
        }],
        lastActivity: Timestamp.now(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async leaveRoom(roomId, userId) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return { success: true };

      const roomData = roomSnap.data();
      const players = (roomData.players || []).filter((p) => p.userId !== userId);

      if (players.length === 0) {
        await deleteDoc(roomRef);
      } else {
        const newHost = roomData.hostId === userId;
        await updateDoc(roomRef, {
          players,
          hostId: newHost ? players[0].userId : roomData.hostId,
          hostName: newHost ? players[0].userName : roomData.hostName,
          hostAvatar: newHost ? (players[0].avatar || "") : (roomData.hostAvatar || ""),
          lastActivity: Timestamp.now(),
        });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async setDiscordLink(roomId, link) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      await updateDoc(roomRef, { discordVcLink: link || "", lastActivity: Timestamp.now() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async toggleReady(roomId, userId, ready) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.data();
      const players = roomData.players.map((p) =>
        p.userId === userId ? { ...p, ready } : p
      );
      await updateDoc(roomRef, { players, lastActivity: Timestamp.now() });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async startMatch(roomId, deck) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.data();

      if (USE_LIVE_ENGINE_ROOMS && roomData?.externalSessionId) {
        await callHubLiveEngineBridge(`/api/live-engine/rooms/${roomData.externalSessionId}/start`, "POST", {});
      }

      const playOrder = roomData.players.map((p) => p.userId).sort(() => Math.random() - 0.5);
      const players = roomData.players.map((p) => ({
        ...p,
        score: 0,
        currentCardIndex: 0,
        completedCards: 0,
        totalReps: 0,
        activeEffects: [],
        ticketsEarned: 0,
      }));

      await updateDoc(roomRef, {
        status: "playing",
        currentPhase: "active",
        deck: deck,
        players,
        playOrder,
        currentTurnIndex: 0,
        currentCardIndex: 0,
        round: 1,
        totalRounds: deck.length,
        startTime: Timestamp.now(),
        lastActivity: Timestamp.now(),
        gameLog: [{
          type: "system",
          message: "Match started! Let's go!",
          timestamp: Date.now(),
        }],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async completeCard(roomId, userId, repsCompleted, pointsEarned, jokerEffect = null) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);

      const result = await runTransaction(db, async (transaction) => {
        const roomSnap = await transaction.get(roomRef);
        if (!roomSnap.exists()) throw new Error("Room not found");
        const roomData = roomSnap.data();

        let playOrder = [...(roomData.playOrder || [])];
        const currentTurnIndex = roomData.currentTurnIndex || 0;
        const currentCardIndex = roomData.currentCardIndex || 0;

        if (playOrder[currentTurnIndex] !== userId) {
          throw new Error("Not your turn");
        }

        let players = roomData.players.map((p) => {
          if (p.userId !== userId) return p;
          const newTotalReps = (p.totalReps || 0) + repsCompleted;
          const newTickets = Math.floor(newTotalReps / 30);
          return {
            ...p,
            score: (p.score || 0) + pointsEarned,
            completedCards: (p.completedCards || 0) + 1,
            totalReps: newTotalReps,
            ticketsEarned: newTickets,
            activeEffects: [],
          };
        });

        if (jokerEffect) {
          switch (jokerEffect) {
            case "double_points":
              players = players.map((p) =>
                p.userId === userId ? { ...p, activeEffects: [...(p.activeEffects || []), "double_points"] } : p
              );
              break;
            case "steal_points": {
              const leader = players.reduce((a, b) => ((a.score || 0) > (b.score || 0) ? a : b));
              if (leader.userId !== userId) {
                players = players.map((p) => {
                  if (p.userId === leader.userId) return { ...p, score: Math.max(0, (p.score || 0) - 10) };
                  if (p.userId === userId) return { ...p, score: (p.score || 0) + 10 };
                  return p;
                });
              }
              break;
            }
            case "half_reps":
              players = players.map((p) =>
                p.userId === userId ? { ...p, activeEffects: [...(p.activeEffects || []), "half_reps"] } : p
              );
              break;
            case "freeze_others":
              players = players.map((p) =>
                p.userId !== userId ? { ...p, activeEffects: [...(p.activeEffects || []), "frozen"] } : p
              );
              break;
            case "bonus_50":
              players = players.map((p) =>
                p.userId === userId ? { ...p, score: (p.score || 0) + 50 } : p
              );
              break;
            case "reverse_order":
              playOrder = [...playOrder].reverse();
              break;
          }
        }

        const nextCardIndex = currentCardIndex + 1;
        let nextTurnIndex;
        if (jokerEffect === "reverse_order") {
          const myNewIndex = playOrder.indexOf(userId);
          nextTurnIndex = (myNewIndex + 1) % playOrder.length;
        } else {
          nextTurnIndex = (currentTurnIndex + 1) % playOrder.length;
        }
        const allDone = nextCardIndex >= (roomData.deck?.length || 0);

        const updates = {
          players,
          playOrder,
          currentCardIndex: nextCardIndex,
          currentTurnIndex: nextTurnIndex,
          round: Math.floor(nextCardIndex / playOrder.length) + 1,
          lastActivity: Timestamp.now(),
        };

        if (allDone) {
          updates.status = "finished";
          updates.currentPhase = "results";
          updates.finishedAt = Timestamp.now();
        }

        transaction.update(roomRef, updates);
        return { finished: allDone };
      });

      return { success: true, finished: result.finished };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async applyEffect(roomId, userId, effect, targetUserId) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.data();

      let players = [...roomData.players];
      const logEntry = { type: "effect", userId, timestamp: Date.now() };

      switch (effect) {
        case "double_points":
          players = players.map((p) =>
            p.userId === userId ? { ...p, activeEffects: [...(p.activeEffects || []), "double_points"] } : p
          );
          logEntry.message = `activated DOUBLE DOWN!`;
          break;

        case "steal_points": {
          const leader = players.reduce((a, b) => ((a.score || 0) > (b.score || 0) ? a : b));
          if (leader.userId !== userId) {
            players = players.map((p) => {
              if (p.userId === leader.userId) return { ...p, score: Math.max(0, (p.score || 0) - 10) };
              if (p.userId === userId) return { ...p, score: (p.score || 0) + 10 };
              return p;
            });
            logEntry.message = `stole 10 points from ${leader.userName}!`;
          } else {
            logEntry.message = `tried to steal but they're already leading!`;
          }
          break;
        }

        case "half_reps":
          players = players.map((p) =>
            p.userId === userId ? { ...p, activeEffects: [...(p.activeEffects || []), "half_reps"] } : p
          );
          logEntry.message = `activated REP SHIELD! Half reps next card.`;
          break;

        case "freeze_others":
          players = players.map((p) =>
            p.userId !== userId ? { ...p, activeEffects: [...(p.activeEffects || []), "frozen"] } : p
          );
          logEntry.message = `froze all opponents! 0 points on their next card!`;
          break;

        case "bonus_50":
          players = players.map((p) =>
            p.userId === userId ? { ...p, score: (p.score || 0) + 50 } : p
          );
          logEntry.message = `hit the JACKPOT! +50 points!`;
          break;

        case "reverse_order": {
          const currentOrder = roomData.playOrder || [];
          const reversedOrder = [...currentOrder].reverse();
          await updateDoc(roomRef, { playOrder: reversedOrder });
          logEntry.message = `reversed the play order!`;
          break;
        }

        default:
          logEntry.message = `played a special card!`;
      }

      await updateDoc(roomRef, {
        players,
        gameLog: arrayUnion(logEntry),
        lastActivity: Timestamp.now(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async endMatch(roomId) {
    try {
      const roomRef = doc(db, "liveRooms", roomId);
      const roomSnap = await getDoc(roomRef);
      const roomData = roomSnap.exists() ? roomSnap.data() : null;

      if (USE_LIVE_ENGINE_ROOMS && roomData?.externalSessionId) {
        try {
          await callHubLiveEngineBridge(`/api/live-engine/rooms/${roomData.externalSessionId}/end`, "POST", {});
        } catch (error) {
          console.warn("External session end failed:", error.message);
        }
      }

      await updateDoc(roomRef, {
        status: "finished",
        currentPhase: "results",
        finishedAt: Timestamp.now(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteRoom(roomId) {
    try {
      if (USE_LIVE_ENGINE_ROOMS) {
        const roomRef = doc(db, "liveRooms", roomId);
        const roomSnap = await getDoc(roomRef);
        const roomData = roomSnap.exists() ? roomSnap.data() : null;

        if (roomData?.externalSessionId) {
          try {
            await callHubLiveEngineBridge(`/api/live-engine/rooms/${roomData.externalSessionId}/end`, "POST", {});
          } catch (error) {
            console.warn("External room cleanup failed:", error.message);
          }
        }
      }

      await deleteDoc(doc(db, "liveRooms", roomId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};
