import React from "react";

import { useState } from "react";

export default function SocialShareModal({ open, onClose, onShare, sessionStats, userProfile }) {
  const [sharing, setSharing] = useState(false);
  if (!open) return null;

  async function handleShare() {
    setSharing(true);
    try {
      await shareRivalisResults({
        username: userProfile?.nickname || userProfile?.email || "User",
        reps: sessionStats.reps,
        tickets: 100,
        mode: sessionStats.category || "solo"
      });
      await onShare();
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white text-black rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl font-black text-zinc-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-black mb-4 text-red-600">Share Your Results!</h2>
        <p className="mb-4">Post your session results to your socials and earn <span className="font-bold text-green-600">+100 raffle tickets</span>!</p>
        <div className="mb-4 p-4 bg-zinc-100 rounded-xl text-sm">
          <div><span className="font-bold">Reps:</span> {sessionStats.reps}</div>
          <div><span className="font-bold">Duration:</span> {sessionStats.duration} sec</div>
          <div><span className="font-bold">Category:</span> {sessionStats.category}</div>
        </div>
        <button
          onClick={handleShare}
          className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-500 transition-all text-lg mb-2 disabled:opacity-60"
          disabled={sharing}
        >
          {sharing ? "Sharing..." : "Share to Socials"}
        </button>
        <button
          onClick={onClose}
          className="w-full bg-zinc-200 text-zinc-700 font-bold py-2 rounded-xl hover:bg-zinc-300 transition-all text-xs"
        >
          No Thanks
        </button>
      </div>
    </div>
  );
}

// --- Social share logic ---
async function shareRivalisResults(results) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(
    canvas.width / 2,
    600,
    100,
    canvas.width / 2,
    600,
    900
  );
  glow.addColorStop(0, "#ff0000");
  glow.addColorStop(1, "#000000");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  // Header
  ctx.font = "bold 110px Arial";
  ctx.fillStyle = "#ff0000";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 40;
  ctx.fillText("RIVALIS", canvas.width / 2, 150);
  ctx.shadowBlur = 0;

  // Username
  ctx.font = "bold 75px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(results.username.toUpperCase(), canvas.width / 2, 260);

  // CTA
  ctx.font = "bold 50px Arial";
  ctx.fillStyle = "#ff0000";
  ctx.fillText("THINK YOU CAN OUTLAST ME?", canvas.width / 2, 330);

  // Massive reps
  ctx.font = "bold 220px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 50;
  ctx.fillText(results.reps, canvas.width / 2, 650);
  ctx.shadowBlur = 0;

  ctx.font = "bold 70px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("REPS", canvas.width / 2, 740);

  // Tickets
  ctx.font = "bold 90px Arial";
  ctx.fillStyle = "#ff0000";
  ctx.fillText(`${results.tickets} TICKETS EARNED`, canvas.width / 2, 880);

  // Mode
  ctx.font = "60px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${results.mode.toUpperCase()} MODE`, canvas.width / 2, 960);

  // Tagline
  ctx.font = "bold 50px Arial";
  ctx.fillStyle = "#ff0000";
  ctx.fillText("OUTLASTED. OUTTRAINED. OUTRIVALED.", canvas.width / 2, 1080);

  // Link on card
  ctx.font = "40px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("rivalislife.vercel.app", canvas.width / 2, 1180);

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/png")
  );

  const file = new File([blob], "rivalis-results.png", {
    type: "image/png"
  });

  const shareData = {
    title: "Rivalis Live Competition",
    text: `🔥 ${results.username} just crushed ${results.reps} reps\n🎟 ${results.tickets} tickets earned\n\nThink you can outlast them?`,
    url: "https://rivalislife.vercel.app/"
  };

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        ...shareData,
        files: [file]
      });
    } else if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(
        `${shareData.text}\n${shareData.url}`
      );
      alert("Copied to clipboard.");
    }
  } catch (err) {
    console.log("Share cancelled:", err);
  }
// removed extraneous closing brace
}
