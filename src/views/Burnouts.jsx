import React, { useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import { LeaderboardService } from "../services/leaderboardService";
import { useNavigate } from "react-router-dom";
import BurnoutsSelection from "../components/Burnouts/BurnoutsSelection";
import BurnoutsSession from "../components/Burnouts/BurnoutsSession";
import { DEFAULT_VOICE_MODEL, VOICE_MODEL_OPTIONS } from "../logic/voiceCoach.js";
import "../styles/Burnouts.css";

const COACH_VOICE_STORAGE_KEY = "rivalis_coach_voice_model";

export default function Burnouts({ user, userProfile }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [voiceModel, setVoiceModel] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_MODEL;
    return window.localStorage.getItem(COACH_VOICE_STORAGE_KEY) || DEFAULT_VOICE_MODEL;
  });
  const navigate = useNavigate();

  const handleVoiceModelChange = (event) => {
    const selected = event.target.value;
    setVoiceModel(selected);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COACH_VOICE_STORAGE_KEY, selected);
    }
  };

  const handleSelectGroup = (group) => {
    setLoading(true);
    setSelectedGroup(group);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleSessionEnd = async (stats) => {
    if (!user || !stats) return;

    setLoading(true);
    try {
      const result = await LeaderboardService.submitScore({
        userId: user.uid,
        userName: userProfile?.nickname || user.email,
        gameMode: "burnouts",
        score: stats.reps || 0,
        duration: stats.duration || 0,
        metadata: {
          category: stats.category,
          type: stats.type || 'rep'
        }
      });

      if (!result?.success) {
        throw new Error(result?.error || "Failed to save burnout session");
      }

      alert(`Burnout Complete! ${stats.reps} reps submitted.`);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to save burnout session:", error);
      alert("Failed to save session stats.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", height: "calc(100vh - 64px)", position: "relative", overflow: "hidden", backgroundColor: "#000" }}>
      {loading && <LoadingScreen />}

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
        <label htmlFor="burnouts-coach-voice" style={{ color: "#fff", fontSize: 11, letterSpacing: 0.5 }}>
          AI Coach Voice
        </label>
        <select
          id="burnouts-coach-voice"
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
      
      {!selectedGroup ? (
        <BurnoutsSelection onSelect={handleSelectGroup} />
      ) : (
        <BurnoutsSession 
          userId={user.uid} 
          muscleGroup={selectedGroup} 
          onSessionEnd={handleSessionEnd}
          voiceModel={voiceModel}
        />
      )}
    </div>
  );
}
