// hub-admin-bots.js
// Frontend-safe ES module version for Vite

const API_BASE = 'http://localhost:8080/api/bots';

// List all bots
export async function listBots() {
  const res = await fetch(`${API_BASE}`);
  return res.json();
}

// Update a bot's stats
export async function updateBotStats(botId, stats) {
  const res = await fetch(`${API_BASE}/${botId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats })
  });
  return res.json();
}

// Force a bot to join a session
export async function forceBotJoin(botId) {
  const res = await fetch(`${API_BASE}/${botId}/join`, { method: 'POST' });
  return res.json();
}

// Force a bot to leave a session
export async function forceBotLeave(botId) {
  const res = await fetch(`${API_BASE}/${botId}/leave`, { method: 'POST' });
  return res.json();
}

// Update bot config
export async function updateBotConfig(botId, config) {
  const res = await fetch(`${API_BASE}/${botId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  });
  return res.json();
}
