import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";

function SafeImg({ src, alt, className, style }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err ? "/assets/images/fallback.png" : src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setErr(true)}
      loading="lazy"
      draggable={false}
    />
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const t = useTheme();

  const MERCH_URL = "https://rivalis.printful.me";

  const [showComingSoon, setShowComingSoon] = useState(false);

  const modes = useMemo(
    () => [
      { id: "solo", name: "Solo", image: "/assets/images/solo.png.png", link: "/solo", external: false },
      { id: "burnouts", name: "Burnouts", image: "/assets/images/burnouts.png.png", link: "/burnouts", external: false },
      { id: "live", name: "Live", image: "/assets/images/live.png.png", link: "/live", external: false },
      { id: "run", name: "Run", image: "/assets/images/run.png.png", link: "/run", external: false },
      { id: "raffle", name: "Raffle", image: "/assets/images/raffle.png.png", link: "/raffle", external: false },
      { id: "shop", name: "Merch", image: "/assets/images/shop.png.png", link: "/shop", external: false },
    ],
    []
  );

  const handleClick = (mode) => {
    if (mode.external) {
      if (typeof window.launchGame === 'function') {
        window.launchGame(mode.link);
      } else {
        window.open(mode.link, "_blank", "noopener,noreferrer");
      }
      return;
    }
    navigate(mode.link);
  };

  const gap = 10;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: `${gap}px`,
    width: "100%",
    padding: "0 4px",
  };

  const tileStyle = {
    position: "relative",
    aspectRatio: "1 / 1",
    borderRadius: "12px",
    overflow: "hidden",
    border: `1px solid ${t.tileBorder}`,
    background: "rgba(10,10,10,0.25)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  };

  const imgWrapStyle = {
    width: "50%",
    aspectRatio: "1 / 1",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.4)",
    flexShrink: 0,
  };

  const imgStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    filter: t.imgFilter,
  };

  const labelStyle = {
    fontSize: "10px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.9)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: "5px",
    lineHeight: 1,
  };

  return (
    <div style={{ padding: "16px 12px", minHeight: "100vh" }}>
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: t.dot, boxShadow: `0 0 18px ${t.dotShadow}` }} />
          <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", margin: 0 }}>Rivalis</h1>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", marginTop: "4px" }}>Pick a mode.</p>
      </div>

      <div style={gridStyle}>
        {modes.map((mode, idx) => {
          const isLast = idx === modes.length - 1 && modes.length % 3 === 1;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleClick(mode)}
              style={{
                ...tileStyle,
                ...(isLast ? { gridColumn: "2 / 3" } : {}),
              }}
            >
              <div style={imgWrapStyle}>
                <SafeImg src={mode.image} alt={mode.name} style={imgStyle} className="" />
              </div>
              <div style={labelStyle}>{mode.name}</div>
            </button>
          );
        })}
      </div>

      {/* Removed Coming Soon modal. All modes shown are fully functional. */}
    </div>
  );
}
