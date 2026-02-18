import React, { useState } from "react";
import SocialShareModal from "../components/SocialShareModal";
import LoadingScreen from "../components/LoadingScreen";
import { LeaderboardService } from "../services/leaderboardService.js";
import { useNavigate } from "react-router-dom";
import SoloSession from "../components/Solo/SoloSession.jsx";
import { DEFAULT_VOICE_MODEL, VOICE_MODEL_OPTIONS } from "../logic/voiceCoach.js";
import "../styles/Solo.css";

const COACH_VOICE_STORAGE_KEY = "rivalis_coach_voice_model";

export default function Solo({ user, userProfile }) {
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
  const [showShare, setShowShare] = useState(false);
  const [lastStats, setLastStats] = useState(null);
=======
  const [voiceModel, setVoiceModel] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_MODEL;
    return window.localStorage.getItem(COACH_VOICE_STORAGE_KEY) || DEFAULT_VOICE_MODEL;
  });
>>>>>>> fd3c5c77fd87dbbad7751416d155ae74eae282b0
  const navigate = useNavigate();

  const handleVoiceModelChange = (event) => {
    const selected = event.target.value;
    setVoiceModel(selected);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COACH_VOICE_STORAGE_KEY, selected);
    }
  };

  useState(() => {
    setTimeout(() => setLoading(false), 2000);
  });

  const handleSessionEnd = async (stats) => {
    if (!user || !stats) return;
    setLoading(true);
    try {
      await LeaderboardService.submitScore({
        userId: user.uid,
        userName: userProfile?.nickname || user.email,
        gameMode: "solo",
        score: stats.reps || 0,
        duration: stats.duration || 0,
        metadata: {
          category: stats.category,
          type: 'solo'
        }
      });
      setLastStats(stats);
      setShowShare(true);
    } catch (error) {
      console.error("Failed to save solo session:", error);
      alert("Failed to save session stats.");
      setLoading(false);
    }
  };

  const handleShare = async () => {
    // Simulate social share and award tickets
    setShowShare(false);
    setLoading(true);
    try {
      // TODO: Integrate real social share API if available
      // Award 100 raffle tickets
      await fetch("/api/raffle/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, amount: 100, reason: "Social Share Bonus" })
      });
      alert("Shared! +100 raffle tickets awarded.");
    } catch (e) {
      alert("Shared! (Demo: 100 tickets awarded)");
    }
    setLoading(false);
    navigate("/dashboard");
  };

  const handleCloseShare = () => {
    setShowShare(false);
    navigate("/dashboard");
  };

  return (
    <div style={{ width: "100%", height: "calc(100vh - 64px)", position: "relative", overflow: "hidden", backgroundColor: "#000" }}>
      {loading && <LoadingScreen />}
<<<<<<< HEAD
=======

      <div style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 10,
        padding: "8px 10px",
      }}>
        <label htmlFor="solo-coach-voice" style={{ color: "#fff", fontSize: 11, letterSpacing: 0.5 }}>
          AI Coach Voice
        </label>
        <select
          id="solo-coach-voice"
          value={voiceModel}
          onChange={handleVoiceModelChange}
          style={{
            background: "#0f0f10",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: 12,
          }}
        >
          {VOICE_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

>>>>>>> fd3c5c77fd87dbbad7751416d155ae74eae282b0
      <SoloSession
        userId={user.uid}
        onSessionEnd={handleSessionEnd}
        voiceModel={voiceModel}
      />
      <SocialShareModal
        open={showShare}
        onClose={handleCloseShare}
        onShare={handleShare}
        sessionStats={lastStats || { reps: 0, duration: 0, category: "-" }}
        userProfile={userProfile}
      />
    </div>
  );
}
