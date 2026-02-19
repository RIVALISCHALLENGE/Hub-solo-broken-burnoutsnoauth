import { LiveService } from "../services/liveService.js";
import LogsGraph from "../components/ChatbotTour/LogsGraph.jsx";
import { UsageService } from "../services/usageService.js";
  const [rooms, setRooms] = useState([]);
  const [dau, setDau] = useState([]);
  const [mau, setMau] = useState([]);
  const [retention, setRetention] = useState([]);
  const [sessionLengths, setSessionLengths] = useState([]);
  const [topGames, setTopGames] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
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

  // Fetch DAU and mock analytics for usage charts
  useEffect(() => {
    if (tab === "analytics") {
      UsageService.getDAU(14).then(setDau);
      UsageService.getMAU(6).then(setMau);
      UsageService.getRetention().then(setRetention);
      UsageService.getSessionLengths().then(setSessionLengths);
      UsageService.getTopGamesAndUsers().then(({ topGames, topUsers }) => {
        setTopGames(topGames);
        setTopUsers(topUsers);
      });
    }
  }, [tab]);

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
          <div className="mb-2 flex gap-4">
            <div>
              <label className="block text-xs mb-1">Schedule (optional)</label>
              <input type="datetime-local" className="bg-zinc-800 text-white rounded p-1" style={{minWidth:180}} disabled />
            </div>
            <div>
              <label className="block text-xs mb-1">Target Segment (optional)</label>
              <select className="bg-zinc-800 text-white rounded p-1" disabled>
                <option>All Users</option>
                <option>Admins Only</option>
                <option>Pro Subscribers</option>
                <option>Free Users</option>
              </select>
            </div>
          </div>
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
          <div className="text-zinc-400 mt-2">Scheduling and targeting coming soon.</div>
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Live Rooms & Game Management</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>Room Name</th><th>Status</th><th>Host</th><th>Players</th><th>Activity</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b border-zinc-700">
                  <td>
                    <input
                      className="bg-zinc-800 text-white rounded px-2 py-1 w-32"
                      value={room.roomName || room.showdown?.name || room.id}
                      onChange={async e => {
                        await fetch(`/api/admin/live-room-edit`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                          body: JSON.stringify({ roomId: room.id, roomName: e.target.value })
                        });
                      }}
                    />
                  </td>
                  <td>{room.status}</td>
                  <td>{room.hostName}</td>
                  <td>
                    {room.players?.map(p => (
                      <span key={p.userId} className="inline-block mr-2">
                        {p.userName}
                        <button className="ml-1 bg-red-600 text-white px-1 py-0 rounded text-xs font-bold" onClick={async () => {
                          await fetch(`/api/admin/live-room-kick`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                            body: JSON.stringify({ roomId: room.id, userId: p.userId })
                          });
                          alert(`Kicked ${p.userName}`);
                        }}>Kick</button>
                      </span>
                    ))}
                  </td>
                  <td>{room.lastActivity ? (new Date(room.lastActivity.seconds ? room.lastActivity.seconds * 1000 : room.lastActivity)).toLocaleString() : ""}</td>
                  <td className="space-x-2">
                    <button className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      await fetch(`/api/admin/live-room-end`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                        body: JSON.stringify({ roomId: room.id })
                      });
                      alert("Room ended.");
                    }}>End Room</button>
                    <button className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      const link = prompt("Enter Discord VC link:", room.discordVcLink || "");
                      if (link !== null) {
                        await fetch(`/api/admin/live-room-discord`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                          body: JSON.stringify({ roomId: room.id, link })
                        });
                        alert("Discord VC link updated.");
                      }
                    }}>Set Discord VC</button>
                  </td>
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
            <React.Suspense fallback={<div>Loading bot module...</div>}>
              <AdminBotsModule />
            </React.Suspense>
          </div>
        )}
import AdminBotsModule from "../components/Admin/AdminBotsModule.jsx";

      {tab === "analytics" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Analytics & Usage Charts</h2>
          <div className="mb-6">
            <LogsGraph data={dau.map(d => ({ date: d.date, mood: d.count >= 1 ? "Great" : d.count === 0 ? "Struggling" : "Okay" }))} type="mood" />
            <div className="text-xs text-zinc-400 mt-2">Daily Active Users (last 14 days)</div>
          </div>
          <div className="mb-6">
            <h4 className="font-semibold mb-1">Monthly Active Users (MAU)</h4>
            <div className="flex gap-4">
              {mau.map((m, i) => (
                <div key={i} className="bg-zinc-800 rounded p-2 text-center min-w-[80px]">
                  <div className="text-lg font-bold">{m.count}</div>
                  <div className="text-xs text-zinc-400">{m.month}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h4 className="font-semibold mb-1">Retention</h4>
            <div className="flex gap-4">
              {retention.map((r, i) => (
                <div key={i} className="bg-zinc-800 rounded p-2 text-center min-w-[80px]">
                  <div className="text-lg font-bold">{r.value}%</div>
                  <div className="text-xs text-zinc-400">{r.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h4 className="font-semibold mb-1">Session Lengths</h4>
            <div className="flex gap-4">
              {sessionLengths.map((s, i) => (
                <div key={i} className="bg-zinc-800 rounded p-2 text-center min-w-[80px]">
                  <div className="text-lg font-bold">{s.value} min</div>
                  <div className="text-xs text-zinc-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h4 className="font-semibold mb-1">Top Games</h4>
            <div className="flex gap-4">
              {topGames.map((g, i) => (
                <div key={i} className="bg-zinc-800 rounded p-2 text-center min-w-[80px]">
                  <div className="text-lg font-bold">{g.count}</div>
                  <div className="text-xs text-zinc-400">{g.name}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h4 className="font-semibold mb-1">Top Users</h4>
            <div className="flex gap-4">
              {topUsers.map((u, i) => (
                <div key={i} className="bg-zinc-800 rounded p-2 text-center min-w-[80px]">
                  <div className="text-lg font-bold">{u.score}</div>
                  <div className="text-xs text-zinc-400">{u.name}</div>
                </div>
              ))}
            </div>
          </div>
          {/* TODO: Add heatmaps, export, and real data integration */}
        </div>
      )}

      {tab === "system" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">System & Scaling</h2>
          <ServerHealth />
          <div className="mt-4">
            <h3 className="font-semibold mb-1">Recent Error Logs</h3>
            <div className="overflow-x-auto max-h-64 bg-zinc-900 rounded p-2">
              <table className="w-full text-xs">
                <thead><tr><th>Type</th><th>Message</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.filter(l => (l.type||"").toLowerCase().includes("error")).slice(0, 20).map(l => (
                    <tr key={l.id}><td>{l.type}</td><td>{l.message || l.text || ""}</td><td>{l.timestamp ? (new Date(l.timestamp._seconds ? l.timestamp._seconds * 1000 : l.timestamp)).toLocaleString() : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-zinc-400 mt-4">Coming soon: Performance, feature flags, deploy/rollback, API keys.</div>
        </div>
      )}

      {tab === "extensibility" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Extensibility & Plugins</h2>
          <div className="mb-4">
            <h3 className="font-semibold mb-1">Plugins</h3>
            <div className="text-zinc-400">Coming soon: List, enable/disable, install/remove plugins.</div>
          </div>
          <div>
            <h3 className="font-semibold mb-1">Webhooks & Automation</h3>
            <div className="text-zinc-400">Coming soon: List, add, and remove webhook/automation triggers.</div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>ID</th><th>Nickname</th><th>Email</th><th>Role</th><th>Impersonate</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.userId || u.id}>
                  <td>{u.userId || u.id}</td>
                  <td>{u.nickname}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td><button className="text-blue-400 underline" onClick={() => setImpersonateUser(u)}>Impersonate</button></td>
                  <td className="space-x-2">
                    <button className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      if (window.confirm(`Ban user ${u.nickname || u.userId || u.id}?`)) {
                        await fetch("/api/admin/user-action", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                          body: JSON.stringify({ action: "ban", userId: u.userId || u.id })
                        });
                        alert("User banned.");
                      }
                    }}>Ban</button>
                    <button className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      await fetch("/api/admin/user-action", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                        body: JSON.stringify({ action: "promote", userId: u.userId || u.id })
                      });
                      alert("User promoted to admin.");
                    }}>Promote</button>
                    <button className="bg-gray-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      await fetch("/api/admin/user-action", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                        body: JSON.stringify({ action: "demote", userId: u.userId || u.id })
                      });
                      alert("User demoted from admin.");
                    }}>Demote</button>
                    <button className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      await fetch("/api/admin/user-action", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                        body: JSON.stringify({ action: "kick", userId: u.userId || u.id })
                      });
                      alert("User kicked (forced logout).");
                    }}>Kick</button>
                  </td>
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
          <h2 className="text-xl font-semibold mb-2">Urgencies (Flagged Content & Abuse)</h2>
          <table className="w-full text-left mb-4">
            <thead>
              <tr><th>Type</th><th>User</th><th>Message</th><th>Time</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {urgencies.length === 0 && (
                <tr><td colSpan={5} className="text-zinc-400">No urgent logs found.</td></tr>
              )}
              {urgencies.map((log, i) => (
                <tr key={log.id || i} className="border-b border-zinc-700">
                  <td>{log.type}</td>
                  <td>{log.userId || log.user || log.email || "-"}</td>
                  <td className="max-w-xs truncate" title={log.message || log.text}>{log.message || log.text}</td>
                  <td>{log.timestamp ? (new Date(log.timestamp.seconds ? log.timestamp.seconds * 1000 : log.timestamp._seconds ? log.timestamp._seconds * 1000 : log.timestamp)).toLocaleString() : ""}</td>
                  <td className="space-x-2">
                    <button className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      if (window.confirm(`Ban user ${log.userId || log.user || log.email}?`)) {
                        await fetch("/api/admin/user-action", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_ADMIN_SECRET}` },
                          body: JSON.stringify({ action: "ban", userId: log.userId || log.user || log.email })
                        });
                        alert("User banned.");
                      }
                    }}>Ban</button>
                    <button className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold" onClick={async () => {
                      await navigator.clipboard.writeText(log.message || log.text || "");
                      alert("Message copied to clipboard.");
                    }}>Copy</button>
                  </td>
                </tr>
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

// --- ServerHealth component for System tab ---
import React, { useState as useStateReact, useEffect as useEffectReact } from "react";
function ServerHealth() {
  const [status, setStatus] = useStateReact("loading");
  const [details, setDetails] = useStateReact(null);
  useEffectReact(() => {
    fetch("/api/live-engine/health")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStatus("ok");
          setDetails(data.health);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);
  return (
    <div className="mb-4">
      <h3 className="font-semibold mb-1">Server Health</h3>
      {status === "loading" && <span className="text-yellow-400">Checking...</span>}
      {status === "ok" && <span className="text-green-400">Healthy</span>}
      {status === "error" && <span className="text-red-400">Unreachable or unhealthy</span>}
      {details && <pre className="bg-zinc-900 rounded p-2 mt-2 text-xs overflow-x-auto">{JSON.stringify(details, null, 2)}</pre>}
    </div>
  );
}
