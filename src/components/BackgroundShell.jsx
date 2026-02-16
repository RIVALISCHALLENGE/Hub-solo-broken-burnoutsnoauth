import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const BG_URL = "/assets/images/background.png";

export default function BackgroundShell({ children }) {
  const location = useLocation();
  const isLoginPage = location.pathname === "/" || location.pathname === "/login";
  const bgRef = useRef(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [isTiny, setIsTiny] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 380px)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 380px)");
    const onChange = (e) => setIsTiny(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const onMove = (clientX, clientY) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (clientX / w) * 2 - 1;
      const ny = (clientY / h) * 2 - 1;
      setParallax({ x: clamp(nx * 6, -6, 6), y: clamp(ny * 4, -4, 4) });
    };
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (!e.touches?.[0]) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!bgRef.current) return;
    if (isMobile) {
      bgRef.current.style.transform = `scale(${isTiny ? "0.8" : "0.86"}) translate3d(0px, 0px, 0)`;
      return;
    }
    bgRef.current.style.transform = `scale(1.03) translate3d(${parallax.x}px, ${parallax.y}px, 0)`;
  }, [parallax, isMobile, isTiny]);

  const backgroundSize = isMobile ? (isTiny ? "88% auto" : "92% auto") : "contain";
  const backgroundPosition = isMobile ? "center top" : "center center";

  const abs = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

  return (
    <div style={{ position: "relative", minHeight: "100vh", width: "100%", color: "#fff", overflow: "hidden", backgroundColor: "#000" }}>
      {!isLoginPage && (
        <div
          ref={bgRef}
          style={{
            ...abs,
            zIndex: 0,
            backgroundImage: `url(${BG_URL})`,
            backgroundRepeat: "no-repeat",
            backgroundSize,
            backgroundPosition,
            backgroundColor: "#000",
            transformOrigin: isMobile ? "center top" : "center center",
            filter: "brightness(0.85) contrast(1.1) saturate(1.25)",
            transition: "transform 0.2s",
          }}
        />
      )}

      <div style={{ ...abs, zIndex: 1, background: "rgba(0,0,0,0.15)" }} />

      <div
        style={{
          ...abs,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(1200px 600px at 50% 25%, rgba(255,0,60,0.18), transparent 60%), radial-gradient(900px 500px at 20% 90%, rgba(255,0,60,0.10), transparent 65%), radial-gradient(900px 500px at 80% 90%, rgba(0,255,210,0.06), transparent 65%)",
        }}
      />

      <div
        style={{
          ...abs,
          zIndex: 2,
          pointerEvents: "none",
          opacity: 0.25,
          mixBlendMode: "soft-light",
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 1px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 6px)",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, minHeight: "100vh", background: "transparent" }}>{children}</div>
    </div>
  );
}
