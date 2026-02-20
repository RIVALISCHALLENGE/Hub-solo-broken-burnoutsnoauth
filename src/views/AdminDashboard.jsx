import React, { useState, useEffect, Suspense } from "react";
import Modal from "react-modal";

import { LiveService } from "../services/liveService.js";
import LogsGraph from "../components/ChatbotTour/LogsGraph.jsx";
import { UsageService } from "../services/usageService.js";
import { UserService } from "../services/userService.js";
import { ChatService } from "../services/chatService.js";
import { LeaderboardService } from "../services/leaderboardService.js";
import AdminBotsModule from "../components/Admin/AdminBotsModule.jsx";

function AdminDashboard() {
  const [tab, setTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adminActions, setAdminActions] = useState([]);
  const [urgencies, setUrgencies] = useState([]);
  const [raffle, setRaffle] = useState({ leaderboard: [], drawHistory: [] });
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState("");
  const [impersonateUser, setImpersonateUser] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [dau, setDau] = useState([]);
  const [mau, setMau] = useState([]);
  const [retention, setRetention] = useState([]);
  const [sessionLengths, setSessionLengths] = useState([]);
  const [topGames, setTopGames] = useState([]);
  const [topUsers, setTopUsers] = useState([]);

  useEffect(() => {
    Modal.setAppElement("body");
  }, []);

  useEffect(() => {
    UserService.getAllUsers(20).then(res => {
      if (res.success) setUsers(res.users);
    });
  }, []);

  useEffect(() => {
    const unsub = ChatService.subscribeToGlobalMessages(setChatMessages, 20);
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    if (tab === "rooms") {
      const unsub = LiveService.subscribeToRooms(setRooms);
      return () => unsub && unsub();
    }
  }, [tab]);

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

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        {[
          "users",
          "chat",
          "logs",
          "raffle",
          "urgencies",
          "broadcast",
          "rooms",
          "bots",
          "analytics",
          "system",
          "extensibility"
        ].map(t => (
          <button
            key={t}
            className={tab === t ? "font-bold underline" : ""}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "bots" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Bot Management</h2>
          <Suspense fallback={<div>Loading bot module...</div>}>
            <AdminBotsModule />
          </Suspense>
        </div>
      )}

      {tab === "analytics" && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Analytics</h2>
          <LogsGraph
            data={dau.map(d => ({
              date: d.date,
              mood: d.count >= 1 ? "Great" : "Struggling"
            }))}
            type="mood"
          />
        </div>
      )}

      {tab === "system" && <ServerHealth />}
    </div>
  );
}

export default AdminDashboard;

function ServerHealth() {
  const [status, setStatus] = useState("loading");
  const [details, setDetails] = useState(null);

  useEffect(() => {
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
      {status === "error" && <span className="text-red-400">Unreachable</span>}
      {details && (
        <pre className="bg-zinc-900 rounded p-2 mt-2 text-xs overflow-x-auto">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
