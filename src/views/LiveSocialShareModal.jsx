
import React, { useState } from "react";

export default function LiveSocialShareModal({ open, onClose, onShare, results }) {
  const [sharing, setSharing] = useState(false);
  if (!open) return null;

  async function handleShare() {
    setSharing(true);
    let shared = false;
    try {
      shared = await animateAndShareRivalisVS(results);
      if (shared) await onShare();
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white text-black rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-3 right-4 text-2xl font-black text-zinc-400 hover:text-red-500">×</button>
        <h2 className="text-xl font-black mb-4 text-red-600">Share Your Live Results!</h2>
        <p className="mb-4">Post your animated VS results to your socials and show off your victory!</p>
        <button
          onClick={handleShare}
          className="w-full bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-500 transition-all text-lg mb-2 disabled:opacity-60"
          disabled={sharing}
        >
          {sharing ? "Sharing..." : "Share Animated Results"}
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

// --- Animated VS Share Engine ---
export async function animateAndShareRivalisVS(results) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  canvas.style.position = "fixed";
  canvas.style.top = 0;
  canvas.style.left = 0;
  canvas.style.zIndex = 9999;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const players = [...results.players].sort((a, b) => b.reps - a.reps);
  const winner = players[0];

  let start = null;
  const duration = 1800;

  function drawFrame(progress) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Pulse
    const pulse = Math.sin(progress * 8) * 40 + 40;
    ctx.fillStyle = `rgb(${pulse},0,0)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";

    // Header Flicker
    ctx.font = "bold 110px Arial";
    ctx.fillStyle = progress % 0.2 < 0.1 ? "#ff0000" : "#ffffff";
    ctx.fillText("RIVALIS", canvas.width / 2, 150);

    // VS Shake
    const shake = (Math.random() - 0.5) * 20 * progress;
    ctx.font = "bold 220px Arial";
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("VS", canvas.width / 2 + shake, 450);
    ctx.shadowBlur = 0;

    // Leaderboard Fade In
    ctx.textAlign = "left";
    let startY = 650;

    players.forEach((player, index) => {
      ctx.globalAlpha = Math.min(progress * 2, 1);
      ctx.font = "bold 65px Arial";
      ctx.fillStyle = index === 0 ? "#ff0000" : "#ffffff";

      ctx.fillText(
        `#${index + 1} ${player.username.toUpperCase()}`,
        180,
        startY + index * 120
      );

      ctx.textAlign = "right";
      ctx.fillText(player.reps, 900, startY + index * 120);
      ctx.textAlign = "left";
    });

    ctx.globalAlpha = 1;

    // Winner Glow Pulse
    ctx.textAlign = "center";
    ctx.font = "bold 75px Arial";
    ctx.fillStyle = "#ff0000";
    ctx.shadowColor = "#ff0000";
    ctx.shadowBlur = 30 + pulse;
    ctx.fillText(
      `${winner.username.toUpperCase()} DOMINATED`,
      canvas.width / 2,
      1120
    );
    ctx.shadowBlur = 0;
  }

  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = (timestamp - start) / duration;

    drawFrame(progress);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      playExplosionSound();
      burstConfetti(canvas);
      setTimeout(async () => {
        const shared = await captureAndShare(canvas, winner, results.mode);
        resolveShare(shared);
      }, 700);
    }
  }

  let resolveShare;
  const sharePromise = new Promise(res => { resolveShare = res; });
  requestAnimationFrame(animate);
  return sharePromise;

  requestAnimationFrame(animate);
}

function playExplosionSound() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const duration = 0.8;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] =
      (Math.random() * 2 - 1) *
      Math.pow(1 - i / bufferSize, 2);
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.01,
    audioCtx.currentTime + duration
  );

  noise.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}

function burstConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const pieces = 40;

  for (let i = 0; i < pieces; i++) {
    const x = canvas.width / 2;
    const y = 500;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 10 + 5;

    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    ctx.fillStyle = i % 2 === 0 ? "#ff0000" : "#ffffff";
    ctx.fillRect(x + dx * 5, y + dy * 5, 8, 8);
  }
}

async function captureAndShare(canvas, winner, mode) {
  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/png")
  );

  const file = new File([blob], "rivalis-vs.png", {
    type: "image/png"
  });

  const shareData = {
    title: "Rivalis Live Results",
    text: `🔥 ${winner.username} dominated ${mode} mode.\nThink you can outlast them?`,
    url: "https://rivalislife.vercel.app/"
  };

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        ...shareData,
        files: [file]
      });
      canvas.remove();
      return true;
    } else {
      await navigator.share(shareData);
      canvas.remove();
      return true;
    }
  } catch (err) {
    console.log("Share cancelled");
    canvas.remove();
    return false;
  }
}
