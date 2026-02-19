// backend/liveRooms.routes.js
// Express routes for live room + Discord VC API

const express = require('express');
const router = express.Router();
const { createLiveRoomWithDiscordVC, deleteLiveRoomAndDiscordVC } = require('./liveRooms');

// Create room endpoint
router.post('/api/live-rooms', async (req, res) => {
  try {
    const { roomData } = req.body;
    const result = await createLiveRoomWithDiscordVC(roomData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete room endpoint
router.delete('/api/live-rooms/:roomId', async (req, res) => {
  try {
    await deleteLiveRoomAndDiscordVC(req.params.roomId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
