// hub-admin-bots.js
// Example: Admin module for bot management in your hub (Node.js/Express frontend)
// Adjust API_BASE as needed for your deployment

const API_BASE = 'http://localhost:8080/api/bots';

// List all bots
async function listBots() {
  const res = await fetch(`${API_BASE}`);
  return res.json();
}

// Update a bot's stats
async function updateBotStats(botId, stats) {
  const res = await fetch(`${API_BASE}/${botId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats })
  });
  return res.json();
}

// Force a bot to join a session
async function forceBotJoin(botId) {
  const res = await fetch(`${API_BASE}/${botId}/join`, { method: 'POST' });
  return res.json();
}

// Force a bot to leave a session (placeholder)
async function forceBotLeave(botId) {
  const res = await fetch(`${API_BASE}/${botId}/leave`, { method: 'POST' });
  return res.json();
}

// Update bot config (difficulty, taunt frequency, etc.)
async function updateBotConfig(botId, config) {
  const res = await fetch(`${API_BASE}/${botId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config })
  });
  return res.json();
}

module.exports = {
  listBots,
  updateBotStats,
  forceBotJoin,
  forceBotLeave,
  updateBotConfig,
};
