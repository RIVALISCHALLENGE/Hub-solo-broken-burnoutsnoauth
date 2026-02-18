import React, { useState } from "react";
import SocialShareModal from "../components/SocialShareModal";
import LoadingScreen from "../components/LoadingScreen";
import { LeaderboardService } from "../services/leaderboardService.js";
import { useNavigate } from "react-router-dom";
import SoloSession from "../components/Solo/SoloSession.jsx";
import "../styles/Solo.css";

export default function Solo({ user, userProfile }) {
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [lastStats, setLastStats] = useState(null);
  const navigate = useNavigate();

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
      <SoloSession
        userId={user.uid}
        onSessionEnd={handleSessionEnd}
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
