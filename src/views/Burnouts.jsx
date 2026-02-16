import React, { useState } from "react";
import LoadingScreen from "../components/LoadingScreen";
import { LeaderboardService } from "../services/leaderboardService";
import { useNavigate } from "react-router-dom";
import BurnoutsSelection from "../components/Burnouts/BurnoutsSelection";
import BurnoutsSession from "../components/Burnouts/BurnoutsSession";
import "../styles/Burnouts.css";

export default function Burnouts({ user, userProfile }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
      
      {!selectedGroup ? (
        <BurnoutsSelection onSelect={handleSelectGroup} />
      ) : (
        <BurnoutsSession 
          userId={user.uid} 
          muscleGroup={selectedGroup} 
          onSessionEnd={handleSessionEnd}
        />
      )}
    </div>
  );
}
