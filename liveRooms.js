// backend/liveRooms.js
// Complete backend logic for Firestore + Discord VC integration

const admin = require('firebase-admin');
const fetch = require('node-fetch'); // If Node 18+, you can use global fetch
const serviceAccount = require('../firebase-adminsdk.json'); // Adjust path as needed

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const { addDoc, updateDoc, deleteDoc, collection, doc } = require('firebase-admin/firestore');

// Create a live room and Discord VC
async function createLiveRoomWithDiscordVC(roomData) {
  // 1. Create the room in Firestore
  const docRef = await addDoc(collection(db, 'liveRooms'), roomData);
  const roomId = docRef.id;

  // 2. Create the Discord VC using the roomId as sessionId
  const discordBotUrl = process.env.DISCORD_BOT_URL || 'http://localhost:5000';
  const createVcRes = await fetch(`${discordBotUrl}/create-vc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: roomId })
  });
  const vcData = await createVcRes.json();

  // 3. Store the inviteLink in the room document
  if (vcData.inviteLink) {
    await updateDoc(docRef, { discordVcLink: vcData.inviteLink });
  }

  return { roomId, discordVcLink: vcData.inviteLink || null };
}

// Delete a live room and its Discord VC
async function deleteLiveRoomAndDiscordVC(roomId) {
  const discordBotUrl = process.env.DISCORD_BOT_URL || 'http://localhost:5000';
  // 1. Delete the Discord VC
  await fetch(`${discordBotUrl}/delete-vc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: roomId })
  });
  // 2. Delete the Firestore room document
  await deleteDoc(doc(db, 'liveRooms', roomId));
}

module.exports = {
  createLiveRoomWithDiscordVC,
  deleteLiveRoomAndDiscordVC,
  db // Exported in case you need it elsewhere
};
