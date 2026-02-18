// Bulk moderation state and helpers
const [selectedUserIds, setSelectedUserIds] = useState([]);
const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.includes(u.id));
const toggleSelectAll = () => {
  if (allSelected) setSelectedUserIds([]);
  else setSelectedUserIds(filteredUsers.map(u => u.id));
};
const toggleSelectUser = (id) => {
  setSelectedUserIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]);
};
const bulkBan = () => {
  selectedUserIds.forEach(id => handleUserAction(id, "ban", true));
  setSelectedUserIds([]);
};
const bulkUnban = () => {
  selectedUserIds.forEach(id => handleUserAction(id, "ban", false));
  setSelectedUserIds([]);
};
const bulkMute = () => {
  selectedUserIds.forEach(id => handleUserAction(id, "mute", true));
  setSelectedUserIds([]);
};
const bulkUnmute = () => {
  selectedUserIds.forEach(id => handleUserAction(id, "mute", false));
  setSelectedUserIds([]);
};
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, doc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const AdminDashboard = ({ userProfile }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [raffleWinners, setRaffleWinners] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminKey, setAdminKey] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(true);

  const globalStats = {
    totalUsers: users.length,
    totalReps: users.reduce((acc, u) => acc + (u.totalReps || 0), 0),
    totalMiles: users.reduce((acc, u) => acc + (u.totalMiles || 0), 0)
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    
    const savedKey = localStorage.getItem("rivalis_admin_key");
    if (savedKey) {
      setAdminKey(savedKey);
    }
    
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      // Real-time listener for ALL users
      const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(allUsers.sort((a, b) => {
          const aLive = isUserLive(a);
          const bLive = isUserLive(b);
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;
          return 0;
        }));
      }, (error) => {
        console.error("Users listener failed:", error);
      });

      // Real-time listener for Chat
      const qChat = query(collection(db, "globalChat"), orderBy("timestamp", "desc"), limit(100));
      const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Chat listener failed:", error);
      });

      // Real-time listener for Raffle Winners
      const unsubscribeWinners = onSnapshot(collection(db, "raffle_winners"), (snapshot) => {
        setRaffleWinners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      // Real-time listener for Admin Notifications
      const unsubscribeNotifications = onSnapshot(collection(db, "admin_notifications"), (snapshot) => {
        const newNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotifications(newNotes.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds));
        
        // Push notification simulation (browser alert for priority items)
        const latest = newNotes[0];
        if (latest && latest.status === 'pending' && latest.timestamp?.seconds > Date.now()/1000 - 10) {
          if (!("Notification" in window)) {
            alert(`PRIORITY ALERT: ${latest.message}`);
          } else if (Notification.permission === "granted") {
            new Notification("RIVALIS COMMAND", { body: latest.message });
          }
        }
      });

      if (activeTab === "logs") {
        fetchSystemLogs();
      }

      return () => {
        unsubscribeUsers();
        unsubscribeChat();
        unsubscribeWinners();
        unsubscribeNotifications();
      };
    }
  }, [isAuthorized, activeTab]);

  const fetchSystemLogs = async () => {
    try {
      const response = await fetch("/api/admin/system-logs", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${adminKey}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  const adminAction = async (endpoint, body) => {
    try {
      const response = await fetch(`/api/admin/${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${adminKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error("Invalid server response: " + text.substring(0, 50));
      }

      if (data.success) {
        alert("Action successful");
      } else {
        alert("Failed: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleDrawRaffle = () => adminAction("raffle-draw", {});
  const handleUserAction = (userId, action, value, message) => adminAction("user-action", { userId, action, data: { value, message } });
  const handleDeleteMessage = (messageId) => adminAction("delete-message", { messageId, collection: "globalChat" });
  const handleSetLivePerk = (perk) => adminAction("live-perk", { perk });
  const handleSetArenaEvent = (event) => adminAction("arena-event", { event });
  const handleBroadcastMessage = (message) => adminAction("broadcast", { message });
  
  const handleResolveNotification = async (id) => {
    try {
      const { db } = await import("../firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "admin_notifications", id), { status: 'resolved' });
    } catch (err) {
      console.error("Failed to resolve note:", err);
    }
  };

  const isUserLive = (user) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return (user.lastSeen?.toMillis() || 0) >= fiveMinutesAgo;
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-mono">LOADING SYSTEM...</div>;
  }

  if (userProfile?.role !== 'admin' && userProfile?.userId !== "Socalturfexperts@gmail.com" && user?.email !== "socalturfexperts@gmail.com") {
    return <div className="min-h-screen bg-black flex items-center justify-center text-red-600 font-mono">ACCESS DENIED: UNAUTHORIZED PERSONNEL ONLY</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 relative z-[9999]">
        <div className="bg-zinc-900 p-8 border-2 border-red-600 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(220,38,38,0.3)]">
          <div className="text-center mb-8">
            <h2 className="text-red-600 text-3xl font-black uppercase italic tracking-tighter">System Access</h2>
            <div className="h-1 w-20 bg-red-600 mx-auto mt-2" />
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-2 block">Operator Credentials</label>
              <input 
                type="password" 
                placeholder="ENTER ADMIN SECRET" 
                className="w-full bg-black border border-zinc-700 text-white p-4 rounded-xl focus:border-red-600 outline-none text-center font-mono font-bold tracking-[0.3em] transition-all"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                autoFocus
              />
            </div>

            <button 
              className="w-full bg-red-600 text-white font-black py-5 rounded-xl hover:bg-red-500 transition-all shadow-[0_0_30px_rgba(220,38,38,0.5)] uppercase tracking-widest text-sm border-b-4 border-red-900 active:border-b-0 active:translate-y-1"
              onClick={() => {
                localStorage.setItem("rivalis_admin_key", adminKey);
                setIsAuthorized(true);
              }}
            >
              Initialize Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 border-b border-zinc-800 pb-6 gap-6">
          <div>
            <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase italic">Command Center</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">System Link Active: {user?.email || "EXTERNAL"}</p>
              </div>
              <div className="h-4 w-[1px] bg-zinc-800" />
              <div className="flex gap-4">
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                  <span className="text-red-500">Users:</span> {globalStats.totalUsers}
                </p>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                  <span className="text-red-500">Reps:</span> {globalStats.totalReps}
                </p>
                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">
                  <span className="text-red-500">Miles:</span> {globalStats.totalMiles.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar w-full md:w-auto">
            {["users", "chat", "logs", "live", "raffle", "alerts"].map((tab) => (
              <button 
                key={tab}
                type="button" 
                onClick={() => setActiveTab(tab)} 
                className={`px-6 py-2.5 rounded-md flex-shrink-0 transition-all font-black text-[10px] uppercase tracking-widest border ${activeTab === tab ? "bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(255,48,80,0.3)]" : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"}`}
              >
                {tab === "users" ? "Arena Roster" : tab === "chat" ? "Comms Log" : tab === "logs" ? "System Core" : tab === "live" ? "Live Rules" : tab === "alerts" ? "Tactical Alerts" : "Raffle Protocol"}
              </button>
            ))}
          </div>
        </div>

    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white font-sans flex">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col py-8 px-4 shadow-2xl z-10">
        <div className="mb-10 flex flex-col items-center">
          <h1 className="text-3xl font-black text-red-600 tracking-tighter uppercase italic mb-2">Admin</h1>
          <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Command Console</span>
        </div>
        <nav className="flex flex-col gap-2 mt-4">
          {[
            { key: "users", label: "Arena Roster", icon: "👥" },
            { key: "chat", label: "Comms Log", icon: "💬" },
            { key: "logs", label: "System Core", icon: "🖥️" },
            { key: "live", label: "Live Rules", icon: "⚡" },
            { key: "games", label: "Live Games", icon: "🎮" },
            { key: "analytics", label: "Analytics", icon: "📊" },
            { key: "raffle", label: "Raffle Protocol", icon: "🎟️" },
            { key: "alerts", label: "Tactical Alerts", icon: "🚨" }
          // --- Analytics & Insights Tab ---
          import { useRef } from "react";
          import { Chart, Bar, Line } from "react-chartjs-2";
          import {
            CategoryScale,
            LinearScale,
            BarElement,
            PointElement,
            LineElement,
            Title,
            Tooltip,
            Legend
          } from "chart.js";
          Chart.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

          function AnalyticsTab() {
            const [userStats, setUserStats] = useState({ dates: [], counts: [] });
            const [flaggedStats, setFlaggedStats] = useState({ dates: [], counts: [] });
            const chartRef = useRef();

            useEffect(() => {
              // Fetch user growth data (example: users created per day)
              (async () => {
                // Replace with your Firestore query for real data
                const fakeDates = Array.from({ length: 14 }, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (13 - i));
                  return d.toLocaleDateString();
                });
                setUserStats({ dates: fakeDates, counts: fakeDates.map(() => Math.floor(Math.random() * 10 + 5)) });
                setFlaggedStats({ dates: fakeDates, counts: fakeDates.map(() => Math.floor(Math.random() * 3)) });
              })();
            }, []);

            return (
              <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 max-h-[75vh] overflow-y-auto custom-scrollbar backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                <h2 className="text-red-600 text-[10px] font-black tracking-[0.2em] mb-6 px-2 uppercase border-l-2 border-red-600 pl-4">Analytics & Insights</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <div className="font-bold mb-2 text-zinc-300">User Growth (Last 2 Weeks)</div>
                    <Bar
                      ref={chartRef}
                      data={{
                        labels: userStats.dates,
                        datasets: [
                          {
                            label: "New Users",
                            data: userStats.counts,
                            backgroundColor: "#ef4444",
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { color: "#222" } }, y: { grid: { color: "#222" } } },
                      }}
                    />
                  </div>
                  <div>
                    <div className="font-bold mb-2 text-zinc-300">Flagged Content (Last 2 Weeks)</div>
                    <Line
                      data={{
                        labels: flaggedStats.dates,
                        datasets: [
                          {
                            label: "Flagged Messages",
                            data: flaggedStats.counts,
                            borderColor: "#f59e42",
                            backgroundColor: "#f59e4280",
                            tension: 0.3,
                            fill: true,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { color: "#222" } }, y: { grid: { color: "#222" } } },
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }
                  {activeTab === "analytics" && (
                    <AnalyticsTab />
                  )}
          // --- Live Game Monitoring Tab ---
          import { useEffect, useState } from "react";
          import { db } from "../firebase";
          import { collection, query, where, onSnapshot } from "firebase/firestore";

                  {activeTab === "games" && (
                    <LiveGamesMonitor />
                  )}

          // --- LiveGamesMonitor component ---
          function LiveGamesMonitor() {
            const [rooms, setRooms] = useState([]);
            useEffect(() => {
              const q = query(collection(db, "liveRooms"), where("status", "in", ["waiting", "playing"]));
              const unsub = onSnapshot(q, (snap) => {
                setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
              });
              return () => unsub();
            }, []);
            return (
              <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 max-h-[75vh] overflow-y-auto custom-scrollbar backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
                <h2 className="text-red-600 text-[10px] font-black tracking-[0.2em] mb-6 px-2 uppercase border-l-2 border-red-600 pl-4">Active Live Games</h2>
                <div className="space-y-4">
                  {rooms.length === 0 && <div className="text-center py-20 text-zinc-700 font-mono italic uppercase tracking-widest">No active games.</div>}
                  {rooms.map(room => (
                    <div key={room.id} className="bg-black/50 p-5 rounded-2xl border border-zinc-800/50 flex flex-col md:flex-row md:items-center md:justify-between group hover:border-red-600/50 transition-all">
                      <div>
                        <div className="font-black text-lg text-red-500 uppercase tracking-tight">{room.roomName || room.id}</div>
                        <div className="text-xs text-zinc-400 mb-2">Host: {room.hostName} ({room.hostId})</div>
                        <div className="text-xs text-zinc-400 mb-2">Status: <span className="font-bold text-white">{room.status}</span> | Mode: {room.trickMode}</div>
                        <div className="text-xs text-zinc-400 mb-2">Created: {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleString() : "-"}</div>
                        <div className="text-xs text-zinc-400 mb-2">Players: {room.players?.length || 0} / {room.maxPlayers || 6}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {room.players?.map(p => (
                            <span key={p.userId} className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full text-xs font-mono">{p.userName} ({p.userId})</span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 md:mt-0 flex flex-col gap-2 items-end">
                        <span className="text-xs text-zinc-500">Room ID: {room.id}</span>
                        {/* Future: Add admin controls for force-end, observe, etc. */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all border-l-4 ${activeTab === tab.key ? "bg-red-600/90 text-white border-red-600 shadow-lg" : "bg-zinc-900 text-zinc-400 border-transparent hover:bg-zinc-800 hover:text-zinc-200"}`}
            >
              <span className="text-lg">{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-10 text-center text-zinc-700 text-xs font-mono opacity-60">
          <div className="mb-2">System Link: <span className="text-green-400">{user?.email || "EXTERNAL"}</span></div>
          <div>© {new Date().getFullYear()} Rivalis Admin</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="bg-zinc-900 border-l-4 border-red-600 rounded-xl p-6 shadow-lg flex flex-col items-start">
            <span className="text-xs text-zinc-400 uppercase mb-2">Total Users</span>
            <span className="text-3xl font-black text-red-500">{globalStats.totalUsers}</span>
          </div>
          <div className="bg-zinc-900 border-l-4 border-red-600 rounded-xl p-6 shadow-lg flex flex-col items-start">
            <span className="text-xs text-zinc-400 uppercase mb-2">Total Reps</span>
            <span className="text-3xl font-black text-red-500">{globalStats.totalReps}</span>
          </div>
          <div className="bg-zinc-900 border-l-4 border-red-600 rounded-xl p-6 shadow-lg flex flex-col items-start">
            <span className="text-xs text-zinc-400 uppercase mb-2">Total Miles</span>
            <span className="text-3xl font-black text-red-500">{globalStats.totalMiles.toFixed(1)}</span>
          </div>
        </div>

        {/* Tab Content */}
        {/* ...existing code... */}
      </main>

        {activeTab === "live" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-zinc-900/40 p-10 rounded-3xl border border-zinc-800/60 backdrop-blur-xl">
              <h2 className="text-red-600 text-[10px] font-black tracking-[0.3em] mb-8 uppercase italic">Live Arena Directives</h2>
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4 block">Active Perk / Event</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["Standard", "Double XP", "Infinite Jokers", "High Stakes", "Nightmare Mode"].map(perk => (
                      <button 
                        key={perk}
                        onClick={() => handleSetLivePerk(perk)}
                        className="bg-black border border-zinc-800 p-4 rounded-xl text-[10px] font-mono hover:border-red-600 transition-all uppercase tracking-widest"
                      >
                        {perk}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4 block">Arena Directives</label>
                    <div className="space-y-3">
                      {[
                        { id: "low_grav", name: "Low Gravity Reps", icon: "🚀" },
                        { id: "turbo", name: "Turbo Mode", icon: "⚡" },
                        { id: "zen", name: "Zen Focus", icon: "🧘" },
                        { id: "chaos", name: "Chaos Theory", icon: "🌀" }
                      ].map(event => (
                        <button 
                          key={event.id}
                          onClick={() => handleSetArenaEvent(event.id)}
                          className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-[11px] font-bold hover:border-red-600 transition-all group"
                        >
                          <span className="flex items-center gap-3">
                            <span className="text-lg">{event.icon}</span>
                            <span className="uppercase tracking-widest">{event.name}</span>
                          </span>
                          <span className="text-[8px] text-zinc-600 group-hover:text-red-600 uppercase">Deploy</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mb-4 block">System Broadcast</label>
                    <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
                      <textarea 
                        id="broadcast-input"
                        placeholder="ENTER MESSAGE TO ALL ARENAS..."
                        className="flex-1 bg-transparent border-none text-zinc-300 text-xs font-mono resize-none focus:ring-0 outline-none"
                      />
                      <button 
                        onClick={() => {
                          const msg = document.getElementById('broadcast-input').value;
                          if (msg) {
                            handleBroadcastMessage(msg);
                            document.getElementById('broadcast-input').value = '';
                          }
                        }}
                        className="bg-red-600 text-white font-black py-3 rounded-lg text-[9px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all"
                      >
                        Transmit Globally
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-red-950/10 border border-red-900/30 rounded-2xl">
                  <p className="text-[10px] text-red-500 font-black uppercase mb-2 tracking-widest">Administrator Notice:</p>
                  <p className="text-[11px] text-red-400 italic">Directive changes are broadcasted globally to all active arenas and take effect immediately on next match initialization.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "alerts" && (
          <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 max-h-[75vh] overflow-y-auto custom-scrollbar backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-red-600 text-[10px] font-black tracking-[0.2em] mb-6 px-2 uppercase border-l-2 border-red-600 pl-4">Tactical Alerts & Escalations</h2>
            <ModerationRulesPanel />
            <div className="space-y-3 mt-8">
              {notifications.map(n => (
                <div key={n.id} className={`p-5 rounded-xl border flex justify-between items-center transition-all ${n.status === 'pending' ? 'bg-red-950/20 border-red-600/50' : 'bg-zinc-900/40 border-zinc-800'}`}>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${n.type === 'CHATBOT_ERROR' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                        {n.type}
                      </span>
                      <p className="text-[9px] text-zinc-500 font-mono">{new Date(n.timestamp?.seconds * 1000).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-bold text-zinc-200">{n.message}</p>
                    {n.error && <p className="text-[10px] text-red-400 mt-1 font-mono italic">Trace: {n.error}</p>}
                  </div>
                  {n.status === 'pending' && (
                    <button 
                      onClick={() => handleResolveNotification(n.id)}
                      className="bg-zinc-800 hover:bg-green-600 text-white text-[9px] px-4 py-2 rounded font-black uppercase tracking-widest transition-all"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
              {notifications.length === 0 && <p className="text-center text-zinc-700 py-20 font-mono italic uppercase tracking-widest">Scanning... System Clear.</p>}
            </div>
          </div>
        )}
// --- ModerationRulesPanel component ---
function ModerationRulesPanel() {
  const [rules, setRules] = useState(["badword1", "badword2"]); // Replace with Firestore fetch in production
  const [newRule, setNewRule] = useState("");
  const addRule = () => {
    if (newRule && !rules.includes(newRule)) setRules([...rules, newRule]);
    setNewRule("");
  };
  const removeRule = (r) => setRules(rules.filter(x => x !== r));
  return (
    <div className="mb-6 p-4 bg-zinc-800 rounded-xl border border-zinc-700">
      <div className="font-bold text-zinc-300 mb-2">Moderation Rules (Flagged Words/Phrases)</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {rules.map(r => (
          <span key={r} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2">
            {r}
            <button onClick={() => removeRule(r)} className="ml-1 text-xs text-white hover:text-black">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newRule}
          onChange={e => setNewRule(e.target.value)}
          placeholder="Add new word/phrase..."
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1 text-xs text-white font-mono"
        />
        <button onClick={addRule} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Add</button>
      </div>
      <div className="text-xs text-zinc-400 mt-2">(Changes take effect immediately for new messages. For demo: rules are local, connect to Firestore for production.)</div>
    </div>
  );
}

        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 px-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-white font-mono"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                <select
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-white font-mono"
                  value={userRoleFilter}
                  onChange={e => setUserRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
                <select
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-white font-mono"
                  value={userBanFilter}
                  onChange={e => setUserBanFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="banned">Banned</option>
                  <option value="muted">Muted</option>
                  <option value="active">Active</option>
                </select>
                <select
                  className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-white font-mono"
                  value={userLiveFilter}
                  onChange={e => setUserLiveFilter(e.target.value)}
                >
                  <option value="">All Activity</option>
                  <option value="live">Live</option>
                  <option value="idle">Idle</option>
                </select>
              </div>
              <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Warrior Registry / Status</span>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4" />
              <span className="text-xs text-zinc-400">Select All</span>
              <button onClick={bulkBan} disabled={selectedUserIds.length === 0} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-40">Ban</button>
              <button onClick={bulkUnban} disabled={selectedUserIds.length === 0} className="bg-zinc-800 text-red-600 px-3 py-1 rounded text-xs font-bold border border-red-600 disabled:opacity-40">Unban</button>
              <button onClick={bulkMute} disabled={selectedUserIds.length === 0} className="bg-yellow-500 text-black px-3 py-1 rounded text-xs font-bold disabled:opacity-40">Mute</button>
              <button onClick={bulkUnmute} disabled={selectedUserIds.length === 0} className="bg-zinc-800 text-yellow-500 px-3 py-1 rounded text-xs font-bold border border-yellow-500 disabled:opacity-40">Unmute</button>
              <span className="text-xs text-zinc-400">{selectedUserIds.length} selected</span>
            </div>
            <div className="grid gap-3">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800/60 flex justify-between items-center backdrop-blur-md transition-all hover:border-red-900/30 hover:bg-zinc-900/60">
                  <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleSelectUser(u.id)} className="w-4 h-4 mr-4" />
                  <div className="flex items-center gap-5 flex-1">
                    <div className="relative">
                      {u.avatarURL ? (
                        <img 
                          src={u.avatarURL} 
                          alt={u.nickname} 
                          className="w-12 h-12 rounded-full border-2 border-red-600/50 object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-zinc-600 text-xs">
                          NO AV
                        </div>
                      )}
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-900 ${isUserLive(u) ? "bg-green-500" : "bg-zinc-800"}`} />
                    </div>
                    <div>
                      <h3 className="font-black text-xl flex items-center gap-3 tracking-tight">
                        {u.nickname || "Anonymous"}
                        {u.role === 'admin' && <span className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">System Admin</span>}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isUserLive(u) ? "text-green-400" : "text-zinc-600"}`}>
                          {u.currentActivity ? `Status: ${u.currentActivity}` : "Idle"}
                        </p>
                        <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                          💪 {u.totalReps || 0} Reps | 🏃 {u.totalMiles?.toFixed(1) || 0} mi | 🎟️ {u.ticketBalance || 0}
                        </span>
                        {u.isBanned && <span className="text-[9px] text-red-500 font-black uppercase tracking-widest">[ Banned ]</span>}
                        {u.isMuted && <span className="text-[9px] text-yellow-500 font-black uppercase tracking-widest">[ Muted ]</span>}
                      </div>
                      <p className="text-[9px] text-zinc-700 mt-2 font-mono tracking-tighter uppercase">{u.id} {u.email && `// ${u.email}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUserAction(u.id, "ban", !u.isBanned)} className={`text-[9px] px-4 py-2 rounded font-black transition-all border uppercase tracking-widest ${u.isBanned ? "bg-red-600 text-white border-red-600 shadow-lg" : "bg-transparent text-red-600 border-red-900/30 hover:bg-red-900/10"}`}>
                      {u.isBanned ? "Pardon" : "Banish"}
                    </button>
                    <button onClick={() => handleUserAction(u.id, "mute", !u.isMuted)} className={`text-[9px] px-4 py-2 rounded font-black transition-all border uppercase tracking-widest ${u.isMuted ? "bg-yellow-600 text-black border-yellow-600 shadow-lg" : "bg-transparent text-yellow-600 border-yellow-900/30 hover:bg-yellow-900/10"}`}>
                      {u.isMuted ? "Unsilence" : "Silence"}
                    </button>
                    <button onClick={() => setImpersonateUser(u)} className="text-[9px] px-4 py-2 rounded font-black border bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 transition-all uppercase tracking-widest">Preview</button>
                  </div>
                // --- User impersonation/preview modal ---
                import Modal from "react-modal";
                const [impersonateUser, setImpersonateUser] = useState(null);
                Modal.setAppElement("body");

                <Modal
                  isOpen={!!impersonateUser}
                  onRequestClose={() => setImpersonateUser(null)}
                  className="fixed inset-0 flex items-center justify-center z-50"
                  overlayClassName="fixed inset-0 bg-black/80 z-40"
                >
                  <div className="bg-zinc-900 rounded-2xl p-8 max-w-2xl w-full shadow-2xl border border-zinc-800 relative">
                    <button onClick={() => setImpersonateUser(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-red-500 text-xl font-black">×</button>
                    <h2 className="text-red-600 text-xl font-black mb-4">Preview: {impersonateUser?.nickname || impersonateUser?.email || impersonateUser?.id}</h2>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {/* Render a read-only summary of the user's profile */}
                      <div className="flex gap-6 items-center mb-6">
                        {impersonateUser?.avatarURL ? (
                          <img src={impersonateUser.avatarURL} alt="avatar" className="w-20 h-20 rounded-full border-2 border-red-600 object-cover" />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-zinc-600 text-lg">NO AV</div>
                        )}
                        <div>
                          <div className="font-black text-lg">{impersonateUser?.nickname || "Anonymous"}</div>
                          <div className="text-xs text-zinc-400">{impersonateUser?.email}</div>
                          <div className="text-xs text-zinc-400">ID: {impersonateUser?.id}</div>
                          <div className="text-xs text-zinc-400">Role: {impersonateUser?.role}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <span className="text-zinc-500 text-xs">Age</span>
                          <div className="font-bold">{impersonateUser?.age || "-"}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Gender</span>
                          <div className="font-bold">{impersonateUser?.gender || "-"}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Height</span>
                          <div className="font-bold">{(impersonateUser?.heightFeet || "-") + "' " + (impersonateUser?.heightInches || "-") + '"'}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Weight</span>
                          <div className="font-bold">{impersonateUser?.weight || "-"}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Fitness Level</span>
                          <div className="font-bold">{impersonateUser?.fitnessLevel || "-"}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500 text-xs">Days/Week</span>
                          <div className="font-bold">{impersonateUser?.workoutFrequency || "-"}</div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-500 text-xs">Injuries / Limitations</span>
                          <div className="font-bold">{impersonateUser?.injuries || "-"}</div>
                        </div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Bio</span>
                        <div className="font-mono text-sm text-zinc-300 bg-zinc-800 rounded p-2 mt-1">{impersonateUser?.bio || "No bio."}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Current Activity</span>
                        <div className="font-bold">{impersonateUser?.currentActivity || "Idle"}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Total Reps</span>
                        <div className="font-bold">{impersonateUser?.totalReps || 0}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Total Miles</span>
                        <div className="font-bold">{impersonateUser?.totalMiles?.toFixed(1) || 0}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Ticket Balance</span>
                        <div className="font-bold">{impersonateUser?.ticketBalance || 0}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Fitness Goals</span>
                        <div className="font-mono text-xs text-zinc-300 bg-zinc-800 rounded p-2 mt-1">{(impersonateUser?.fitnessGoals || []).join(", ") || "-"}</div>
                      </div>
                      <div className="mb-2">
                        <span className="text-zinc-500 text-xs">Seeking</span>
                        <div className="font-mono text-xs text-zinc-300 bg-zinc-800 rounded p-2 mt-1">{(impersonateUser?.appSeeking || []).join(", ") || "-"}</div>
                      </div>
                    </div>
                  </div>
                </Modal>
                </div>
              ))}
              {filteredUsers.length === 0 && <div className="text-center py-20 text-zinc-700 font-mono italic uppercase tracking-widest animate-pulse">No users found.</div>}
            </div>
          </div>
        )}
// --- User search/filter state and logic ---
import { useMemo } from "react";
const [userSearch, setUserSearch] = useState("");
const [userRoleFilter, setUserRoleFilter] = useState("");
const [userBanFilter, setUserBanFilter] = useState("");
const [userLiveFilter, setUserLiveFilter] = useState("");
const filteredUsers = useMemo(() => {
  return users.filter(u => {
    const search = userSearch.toLowerCase();
    if (search && !(
      (u.nickname || "").toLowerCase().includes(search) ||
      (u.email || "").toLowerCase().includes(search) ||
      (u.id || "").toLowerCase().includes(search)
    )) return false;
    if (userRoleFilter && u.role !== userRoleFilter) return false;
    if (userBanFilter === "banned" && !u.isBanned) return false;
    if (userBanFilter === "muted" && !u.isMuted) return false;
    if (userBanFilter === "active" && (u.isBanned || u.isMuted)) return false;
    if (userLiveFilter === "live" && !isUserLive(u)) return false;
    if (userLiveFilter === "idle" && isUserLive(u)) return false;
    return true;
  });
}, [users, userSearch, userRoleFilter, userBanFilter, userLiveFilter]);

        {activeTab === "chat" && (
          <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 max-h-[75vh] overflow-y-auto custom-scrollbar backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-zinc-600 text-[10px] font-black tracking-[0.2em] mb-6 px-2 uppercase border-l-2 border-red-600 pl-4">Arena Comms History</h2>
            <div className="space-y-1">
              {messages.map(m => (
                <div key={m.id} className="group border-b border-zinc-800/30 py-4 flex justify-between items-start hover:bg-white/5 px-4 rounded-xl transition-all">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-red-500 font-black text-xs uppercase tracking-widest italic">{m.nickname || m.userName}</p>
                      <p className="text-[9px] text-zinc-600 font-mono font-bold">{new Date(m.timestamp?.seconds * 1000).toLocaleString()}</p>
                    </div>
                    <p className="text-zinc-200 text-sm leading-relaxed font-medium">{m.text}</p>
                  </div>
                  <button onClick={() => handleDeleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 bg-red-950/20 text-red-500 border border-red-900/40 hover:bg-red-600 hover:text-white transition-all font-black text-[9px] px-3 py-1.5 rounded uppercase tracking-widest">Purge</button>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-zinc-700 py-20 font-mono italic uppercase tracking-widest">Comms Silent. No Data Intercepted.</p>}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="bg-zinc-900/30 p-6 rounded-2xl border border-zinc-800/50 max-h-[75vh] overflow-y-auto custom-scrollbar backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8 px-2 border-l-2 border-red-600 pl-4">
              <h2 className="text-zinc-600 text-[10px] font-black tracking-[0.2em] uppercase">Anomaly & Event Core</h2>
              <button onClick={fetchSystemLogs} className="bg-zinc-800 hover:bg-red-600 text-white text-[9px] px-4 py-2 rounded border border-zinc-700 font-black transition-all uppercase tracking-widest shadow-lg">Refresh Sync</button>
            </div>
            <div className="space-y-3">
              {logs.map(l => (
                <div key={l.id} className={`p-4 rounded-xl border transition-all hover:scale-[1.01] ${l.type === 'error' ? 'bg-red-950/10 border-red-900/40' : 'bg-zinc-900/60 border-zinc-800'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest ${l.type === 'error' ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'}`}>{l.type}</span>
                    <span className="text-[9px] text-zinc-600 font-mono font-bold">{l.timestamp ? new Date(l.timestamp._seconds * 1000).toLocaleString() : 'N/A'}</span>
                  </div>
                  <p className="text-zinc-300 font-mono text-xs break-all leading-relaxed font-bold">{l.message || JSON.stringify(l)}</p>
                </div>
              ))}
              {logs.length === 0 && <p className="text-center text-zinc-700 py-20 font-mono italic uppercase tracking-widest">Registry Clear. System Stable.</p>}
            </div>
          </div>
        )}

        {activeTab === "raffle" && (
          <div className="grid md:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="bg-zinc-900/40 p-10 rounded-3xl border border-zinc-800/60 text-center backdrop-blur-xl flex flex-col justify-center min-h-[400px]">
              <h2 className="text-zinc-600 text-[10px] font-black tracking-[0.3em] mb-10 uppercase italic">Weekly Raffle Protocol</h2>
              <button onClick={handleDrawRaffle} className="w-full bg-red-600 p-8 rounded-2xl font-black hover:bg-red-500 shadow-[0_0_35px_rgba(220,38,38,0.5)] transition-all text-2xl tracking-tighter uppercase italic border-b-4 border-red-900 active:border-b-0 active:translate-y-1">
                Execute Draw
              </button>
              <div className="mt-10 p-5 rounded-2xl bg-red-950/10 border border-red-900/30 text-[10px] text-red-400 leading-relaxed text-left italic">
                <p className="font-black not-italic mb-2 uppercase tracking-[0.2em] text-red-500">Critical Warning:</p>
                Execution will finalize all tickets for the current window. Records are immutable and permanent.
              </div>
            </div>
            <div className="bg-zinc-900/40 p-8 rounded-3xl border border-zinc-800/60 backdrop-blur-xl flex flex-col">
              <h2 className="text-zinc-600 text-[10px] font-black tracking-[0.3em] mb-8 uppercase border-b border-zinc-800/50 pb-4 italic">Champion Registry</h2>
              <div className="space-y-4 overflow-y-auto max-h-[350px] custom-scrollbar pr-2">
                {raffleWinners.map(w => (
                  <div key={w.id} className="bg-black/50 p-5 rounded-2xl border border-zinc-800/50 flex justify-between items-center group hover:border-red-600/50 transition-all">
                    <div>
                      <p className="text-red-500 font-black text-base uppercase italic tracking-tighter">{w.userName}</p>
                      <p className="text-[9px] text-zinc-600 font-mono mt-1 font-bold">TX_PROTOCOL: {w.ticket}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 font-mono font-bold">{new Date(w.drawDate?.seconds * 1000).toLocaleDateString()}</p>
                      <div className="mt-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e] ml-auto" />
                    </div>
                  </div>
                ))}
                {raffleWinners.length === 0 && <div className="text-center py-20 text-zinc-800 font-mono italic uppercase tracking-widest">Registry Empty</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--accent-color, #ff3050); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
