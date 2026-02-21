import React, { useEffect, useRef } from "react";
import { useAccessibility } from "../../context/AccessibilityContext";

export function AccessibilityWrapper({ children }) {
  const { enableAccessibility } = useAccessibility();
  const tapCount = useRef(0);
  const lastTap = useRef(0);

  useEffect(() => {
    const handleTap = (e) => {
      const now = Date.now();
      const x = e.changedTouches
        ? e.changedTouches[0].clientX
        : e.clientX;
      const y = e.changedTouches
        ? e.changedTouches[0].clientY
        : e.clientY;

      // Top-left detection zone (bigger for reliability)
      if (x < 150 && y < 150) {
        if (now - lastTap.current < 800) {
          tapCount.current += 1;
        } else {
          tapCount.current = 1;
        }

        lastTap.current = now;

        console.log("Tap count:", tapCount.current);

        if (tapCount.current >= 5) {
          tapCount.current = 0;

          // Ensure speech works (user gesture requirement)
          window.speechSynthesis.cancel();

          enableAccessibility();
        }
      }
    };

    window.addEventListener("touchend", handleTap, { passive: true });
    window.addEventListener("mousedown", handleTap);

    return () => {
      window.removeEventListener("touchend", handleTap);
      window.removeEventListener("mousedown", handleTap);
    };
  }, [enableAccessibility]);

  return children;
}