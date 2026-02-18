// Bot Simulation Script
// Simulates active bots: online presence, lobby join/leave, chat, and games

import { UserService } from "./userService.js";
import { db } from "../firebase.js";
import { collection, setDoc, doc, updateDoc, serverTimestamp, getDocs, addDoc } from "firebase/firestore";

// Example avatar URLs (replace with your real avatar assets)
const AVATAR_URLS = [
  "/assets/avatars/avatar1.png",
  "/assets/avatars/avatar2.png",
  "/assets/avatars/avatar3.png",
  "/assets/avatars/avatar4.png",
  "/assets/avatars/avatar5.png"
];

// Example names (expand as needed)
const NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Skyler", "Avery", "Quinn", "Peyton",
  "Jamie", "Drew", "Reese", "Rowan", "Sawyer", "Emerson", "Finley", "Hayden", "Jules", "Kai"
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomUsername(name) {
  return (
    name.toLowerCase() +
    Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  );
}

// Generate a bot profile
export function generateBotProfile() {
  const name = randomFrom(NAMES);
  return {
    nickname: name,
    username: randomUsername(name),
    avatarURL: randomFrom(AVATAR_URLS)
  };
}

// Ensure N bots exist in Firestore
export async function ensureBotsOnline(targetCount = 12) {
  const bots = [];
  for (let i = 0; i < targetCount; i++) {
    const userId = `bot_${i.toString().padStart(3, "0")}`;
    const profile = generateBotProfile();
    await UserService.createUserProfile(userId, profile);
    bots.push(userId);
  }
  return bots;
}

// Periodically update bot presence
export function startBotPresenceLoop(botIds, intervalMs = 30000) {
  setInterval(async () => {
    for (const userId of botIds) {
      await UserService.updateHeartbeat(userId, Math.random() > 0.5 ? "browsing" : "idle");
    }
  }, intervalMs);
}

// Simulate bots joining/leaving lobbies
export async function simulateLobbyActivity(botIds, lobbyId) {
  for (const userId of botIds) {
    if (Math.random() > 0.5) {
      // Join lobby
      await setDoc(doc(db, "lobbies", lobbyId, "players", userId), {
        uid: userId,
        displayName: randomFrom(NAMES),
        ready: Math.random() > 0.7,
        joinedAt: serverTimestamp()
      });
    } else {
      // Leave lobby
      await setDoc(doc(db, "lobbies", lobbyId, "players", userId), {});
    }
  }
}

// Simulate bots sending chat messages
export async function simulateBotChat(botIds, lobbyId) {
  // More human-like, natural, and taunting messages
  const MESSAGES = [
    // Friendly banter
    "Hey, who's ready to lose? 😏",
    "I hope you brought your A-game!",
    "Let's see what you've got!",
    "Don't go easy on me!",
    "Is it just me or is it getting competitive in here?",
    "I just had coffee, I'm unstoppable!",
    "Anyone else nervous?",
    "I bet I can beat you with one hand!",
    "You call that a move? Watch this!",
    "I almost feel bad for you... almost.",
    "You sure you want to challenge me?",
    "I hope you stretched, it's about to get real!",
    "I was born ready!",
    "You got lucky last time!",
    "Try not to cry when you lose!",
    "I’m just here for the snacks. 😅",
    "Let’s make this interesting!",
    "I’ll try not to embarrass you too much.",
    "You’re going down!",
    "I hope you’re better than the last player!",
    // More natural, less robotic
    "Lol, that was wild!",
    "Wait, what just happened?",
    "No way! Did you see that?",
    "I need a rematch after this.",
    "Haha, good one!",
    "I’m just warming up.",
    "That was close, nice!",
    "I almost had you!",
    "You got me this time!",
    "GG, let’s go again!"
  ];
  for (const userId of botIds) {
    if (Math.random() > 0.7) {
      await addDoc(collection(db, "lobbies", lobbyId, "chat"), {
        userId,
        message: randomFrom(MESSAGES),
        sentAt: serverTimestamp()
      });
    }
  }
}

// Simulate bots starting games if no real games are running
export async function simulateBotGames(botIds, lobbyId) {
  // Example: set lobby status to started if enough bots are ready
  // (You may want to expand this logic based on your game flow)
  await updateDoc(doc(db, "lobbies", lobbyId), {
    status: "started",
    startedAt: serverTimestamp()
  });
}
