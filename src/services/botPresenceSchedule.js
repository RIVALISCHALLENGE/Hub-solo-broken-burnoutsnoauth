import { ensureBotsOnline, startBotPresenceLoop } from "./botSim.js";

function getTargetBotCount() {
  const now = new Date();
  const hour = now.getHours();
  // 12am-5am: 2-4 bots, otherwise 10-15
  if (hour >= 0 && hour < 5) {
    return Math.floor(Math.random() * 3) + 2; // 2-4
  }
  return Math.floor(Math.random() * 6) + 10; // 10-15
}

async function runScheduledBotPresence() {
  const targetCount = getTargetBotCount();
  const botIds = await ensureBotsOnline(targetCount);
  startBotPresenceLoop(botIds);
  // Optionally, re-evaluate every 30 minutes
  setTimeout(runScheduledBotPresence, 30 * 60 * 1000);
}

runScheduledBotPresence();
