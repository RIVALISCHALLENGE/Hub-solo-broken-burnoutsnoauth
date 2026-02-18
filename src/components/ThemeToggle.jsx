import React from "react";

export default function ThemeToggle({ mode = "dark", onToggle, className = "" }) {
  const isLight = mode === "light";

  return (
    <div className={`theme-switch-wrap ${className}`.trim()}>
      <span className="theme-switch-label">Theme</span>
      <button
        type="button"
        className={`theme-switch ${isLight ? "is-light" : ""}`.trim()}
        onClick={onToggle}
        role="switch"
        aria-checked={isLight}
        aria-label="Toggle light and dark mode"
      >
        <span className="theme-switch-text theme-switch-text-dark">Dark</span>
        <span className="theme-switch-text theme-switch-text-light">Light</span>
        <span className="theme-switch-thumb" />
      </button>
    </div>
  );
}
