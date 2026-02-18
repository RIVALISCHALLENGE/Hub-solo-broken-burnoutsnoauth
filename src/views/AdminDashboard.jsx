import { LiveService } from "../services/liveService.js";
  const [rooms, setRooms] = useState([]);
  // Fetch all live rooms/lobbies in real time
  useEffect(() => {
    if (tab === "rooms") {
      const unsub = LiveService.subscribeToRooms(setRooms);
      return () => unsub && unsub();
    }
  }, [tab]);

import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { UserService } from "../services/userService.js";
import { ChatService } from "../services/chatService.js";
import { LeaderboardService } from "../services/leaderboardService.js";

function AdminDashboard() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adminActions, setAdminActions] = useState([]);
  const [urgencies, setUrgencies] = useState([]);
  const [raffle, setRaffle] = useState({ leaderboard: [], drawHistory: [] });
  const [broadcastTab, setBroadcastTab] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const [impersonateUser, setImpersonateUser] = useState(null);

  useEffect(() => { Modal.setAppElement("body"); }, []);

  // Fetch users
  useEffect(() => {
    UserService.getAllUsers(20).then(res => {
      if (res.success) setUsers(res.users);
    });
  }, []);

  // Fetch chat messages
  useEffect(() => {
    const unsub = ChatService.subscribeToGlobalMessages(setChatMessages, 20);
    return () => unsub && unsub();
  }, []);

  // Fetch logs and admin actions from backend
  useEffect(() => {
    // Fetch logs
    fetch("/api/admin/system-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLogs(data.logs || []);
          // Filter urgencies
          setUrgencies((data.logs || []).filter(l => {
            const t = (l.type || "").toLowerCase();
            const msg = (l.message || l.text || "").toLowerCase();
            return (
              t.includes("profanity") || t.includes("cheat") || t.includes("stalk") || t.includes("abuse") ||
              msg.includes("profanity") || msg.includes("cheat") || msg.includes("stalk") || msg.includes("abuse")
            );
          }));
        }
      });
    // Fetch admin actions
    fetch("/api/admin/user-action", {
      method: "GET",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) setAdminActions(data.actions || []);
      });
  }, []);

  // Fetch raffle leaderboard (no mock draw history)
  useEffect(() => {
    LeaderboardService.getAllTopScores(10).then(res => {
      if (res.success) setRaffle(r => ({ ...r, leaderboard: res.scores }));
    });
    setRaffle(r => ({ ...r, drawHistory: [] }));
  }, []);

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="flex flex-wrap gap-4 mb-6">
        <button className={tab === "users" ? "font-bold underline" : ""} onClick={() => setTab("users")}>Users</button>
        <button className={tab === "chat" ? "font-bold underline" : ""} onClick={() => setTab("chat")}>Chat</button>
        <button className={tab === "logs" ? "font-bold underline" : ""} onClick={() => setTab("logs")}>Logs</button>
        <button className={tab === "raffle" ? "font-bold underline" : ""} onClick={() => setTab("raffle")}>Raffle</button>
        <button className={tab === "urgencies" ? "font-bold underline" : ""} onClick={() => setTab("urgencies")}>Urgencies</button>
        <button className={tab === "broadcast" ? "font-bold underline" : ""} onClick={() => setTab("broadcast")}>Broadcast</button>
        <button className={tab === "rooms" ? "font-bold underline" : ""} onClick={() => setTab("rooms")}>Rooms & Games</button>
        <button className={tab === "bots" ? "font-bold underline" : ""} onClick={() => setTab("bots")}>Bots</button>
        <button className={tab === "analytics" ? "font-bold underline" : ""} onClick={() => setTab("analytics")}>Analytics</button>
        <button className={tab === "system" ? "font-bold underline" : ""} onClick={() => setTab("system")}>System</button>
        <button className={tab === "extensibility" ? "font-bold underline" : ""} onClick={() => setTab("extensibility")}>Extensibility</button>
      </div>

      {tab === "broadcast" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Broadcast Message to All Users</h2>
          <textarea
            className="w-full p-2 rounded bg-zinc-800 text-white mb-2"
            rows={4}
            placeholder="Enter your message..."
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
          />
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded font-bold"
            onClick={async () => {
              setBroadcastStatus("");
              if (!broadcastMessage.trim()) {
                setBroadcastStatus("Message cannot be empty.");
                return;
              }
              try {
                const res = await fetch("/api/admin/broadcast", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                  body: JSON.stringify({ message: broadcastMessage })
                });
                const data = await res.json();
                if (data.success) {
                  setBroadcastStatus("Broadcast sent to all users.");
                  setBroadcastMessage("");
                } else {
                  setBroadcastStatus("Failed to send broadcast: " + (data.error || "Unknown error"));
                }
              } catch (e) {
                setBroadcastStatus("Failed to send broadcast: " + e.message);
              }
            }}
          >Send Broadcast</button>
          {broadcastStatus && <div className="mt-2 text-sm text-yellow-400">{broadcastStatus}</div>}
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Live Rooms & Game Management</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>Room Name</th><th>Status</th><th>Host</th><th>Players</th><th>Activity</th></tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b border-zinc-700">
                  <td>{room.roomName || room.showdown?.name || room.id}</td>
                  <td>{room.status}</td>
                  <td>{room.hostName}</td>
                  <td>{room.players?.map(p => p.userName).join(", ")}</td>
                  <td>{room.lastActivity ? (new Date(room.lastActivity.seconds ? room.lastActivity.seconds * 1000 : room.lastActivity)).toLocaleString() : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rooms.length === 0 && <div className="text-zinc-400">No active rooms.</div>}
        </div>
      )}

      {tab === "bots" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Bot Management</h2>
          {/* TODO: List, add, remove, configure bots, assign to rooms/games, override behavior, see bot logs */}
          <div className="text-zinc-400">Coming soon: Full bot control, assignment, and live override.</div>
        </div>
      )}

      {tab === "analytics" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Analytics & Usage Charts</h2>
          {/* TODO: DAU/MAU, retention, session length, top games/users, room/game heatmaps, export */}
          <div className="text-zinc-400">Coming soon: Usage charts, heatmaps, and export tools.</div>
        </div>
      )}

      {tab === "system" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">System & Scaling</h2>
          {/* TODO: Server health, error logs, performance, feature flags, deploy/rollback, API keys */}
          <div className="text-zinc-400">Coming soon: Server health, feature flags, and deployment tools.</div>
        </div>
      )}

      {tab === "extensibility" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Extensibility & Plugins</h2>
          {/* TODO: Plugin system, webhook/automation triggers */}
          <div className="text-zinc-400">Coming soon: Plugin system and automation triggers.</div>
        </div>
      )}

      {tab === "users" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>ID</th><th>Nickname</th><th>Email</th><th>Role</th><th>Impersonate</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.userId || u.id}>
                  <td>{u.userId || u.id}</td>
                  <td>{u.nickname}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td><button className="text-blue-400 underline" onClick={() => setImpersonateUser(u)}>Impersonate</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "chat" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Global Chat (last 20)</h2>
          <div className="bg-zinc-800 rounded p-2 max-h-64 overflow-y-auto">
            {chatMessages.map(m => (
              <div key={m.id} className="mb-2">
                <span className="font-bold">{m.nickname || m.userId}:</span> {m.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">System Logs</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>Type</th><th>User</th><th>Message</th><th>Time</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}><td>{l.type}</td><td>{l.userId || l.user || l.email}</td><td>{l.message || l.text || ""}</td><td>{l.timestamp ? (new Date(l.timestamp._seconds ? l.timestamp._seconds * 1000 : l.timestamp)).toLocaleString() : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "urgencies" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Urgencies (Profanity, Cheating, Stalking, Abuse)</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>Type</th><th>User</th><th>Message</th><th>Time</th></tr>
            </thead>
            <tbody>
              {urgencies.map(l => (
                <tr key={l.id}><td>{l.type}</td><td>{l.userId || l.user || l.email}</td><td>{l.message || l.text || ""}</td><td>{l.timestamp ? (new Date(l.timestamp._seconds ? l.timestamp._seconds * 1000 : l.timestamp)).toLocaleString() : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "raffle" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Raffle Leaderboard</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>User</th><th>Score</th><th>Game Mode</th></tr>
            </thead>
            <tbody>
              {raffle.leaderboard.map(r => (
                <tr key={r.id}><td>{r.userName}</td><td>{r.score}</td><td>{r.gameMode}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="text-lg font-semibold mt-4 mb-2">Draw History</h3>
          <ul className="list-disc pl-6">
            {raffle.drawHistory.map((d, i) => (
              <li key={i}>{d.timestamp}: <span className="font-bold">{d.userName}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* User impersonation/preview modal rendered at the root of AdminDashboard */}
      <Modal
        isOpen={!!impersonateUser}
        onRequestClose={() => setImpersonateUser(null)}
        className="fixed inset-0 flex items-center justify-center z-50"
        overlayClassName="fixed inset-0 bg-black/60 z-40"
        ariaHideApp={false}
      >
        {impersonateUser && (
          <div className="bg-zinc-900 p-8 rounded-2xl shadow-2xl border border-zinc-800 w-full max-w-md">
            <h2 className="text-xl font-black text-zinc-100 mb-4">Previewing User</h2>
            <p className="text-zinc-400 mb-2">ID: {impersonateUser.userId || impersonateUser.id}</p>
            <p className="text-zinc-400 mb-2">Email: {impersonateUser.email}</p>
            <p className="text-zinc-400 mb-2">Username: {impersonateUser.nickname}</p>
            <button onClick={() => setImpersonateUser(null)} className="mt-6 bg-red-600 text-white px-6 py-2 rounded font-black uppercase tracking-widest">Close</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AdminDashboard;
