import React, { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebase.js";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Navbar({ user, userProfile, theme, cycleTheme }) {
  const [open, setOpen] = useState(false);
  const [profileSubmenuOpen, setProfileSubmenuOpen] = useState(false);
  const t = useTheme();

  const handleLogout = () => {
    auth.signOut();
  };

  const closeDropdown = () => {
    setOpen(false);
    setProfileSubmenuOpen(false);
  };

  const avatarURL = userProfile?.avatarURL || user?.photoURL || "";
  const nickname = userProfile?.nickname || user?.displayName || "User";
  const hasCompletedSetup = userProfile?.hasCompletedSetup || false;
  
  return (
    <nav className="navbar">
      <div className="logo">RIVALIS Hub</div>
      <div className="nav-right">
        <button 
          onClick={cycleTheme}
          className="theme-toggle-btn"
          style={{
            width: "40px",
            height: "40px",
            fontSize: "1.2rem",
          }}
          title="Cycle Theme"
        >
          {theme === "red-black" ? "🔴" : theme === "white-black" ? "⚪" : "⚫"}
        </button>
        {hasCompletedSetup && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {avatarURL && (
              <img 
                src={avatarURL} 
                alt={nickname} 
                style={{ 
                  width: "40px", 
                  height: "40px", 
                  borderRadius: "50%", 
                  background: "#fff",
                  border: `2px solid ${t.accent}`
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ color: "#fff", fontWeight: "600", fontSize: "13px" }}>{nickname}</span>
              <span style={{ color: t.accent, fontSize: "10px", marginTop: "2px" }}>🎟 {userProfile?.ticketBalance ?? 0}</span>
            </div>
          </div>
        )}
        <div className="menu">
          <button onClick={() => setOpen(!open)}>Menu</button>
          {open && (
            <div className="dropdown">
              <Link to="/dashboard" onClick={closeDropdown}>Home</Link>
              <div style={{ position: "relative" }}>
                <button 
                  onClick={() => setProfileSubmenuOpen(!profileSubmenuOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setProfileSubmenuOpen(!profileSubmenuOpen);
                    }
                  }}
                  style={{ 
                    color: "#fff",
                    padding: "0.5rem",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                    fontSize: "inherit",
                    fontFamily: "inherit"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = t.hoverBg;
                    e.currentTarget.style.borderRadius = "4px";
                    e.currentTarget.style.borderLeft = `3px solid ${t.accent}`;
                    e.currentTarget.style.paddingLeft = "0.7rem";
                    e.currentTarget.style.boxShadow = `0 0 10px ${t.shadowMd}, inset 0 0 10px ${t.shadowXs}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderRadius = "0";
                    e.currentTarget.style.borderLeft = "none";
                    e.currentTarget.style.paddingLeft = "0.5rem";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  Profile <span style={{ marginLeft: "0.5rem" }}>{profileSubmenuOpen ? "▼" : "▶"}</span>
                </button>
                {profileSubmenuOpen && (
                  <div style={{
                    position: "absolute",
                    left: "100%",
                    top: "0",
                    background: "#000000",
                    border: `1px solid ${t.accent}`,
                    borderRadius: "8px",
                    padding: "0.5rem",
                    marginLeft: "0.5rem",
                    minWidth: "150px",
                    boxShadow: `0 0 15px ${t.shadowMd}, 0 0 30px ${t.shadowSm}, inset 0 0 20px ${t.shadowXxs}`,
                    zIndex: 10000
                  }}>
                    <Link 
                      to="/profile" 
                      onClick={closeDropdown}
                      style={{
                        color: "#fff",
                        textDecoration: "none",
                        padding: "0.5rem",
                        display: "block",
                        transition: "all 0.3s ease",
                        textShadow: `0 0 8px ${t.shadowSm}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.hoverBg;
                        e.currentTarget.style.borderRadius = "4px";
                        e.currentTarget.style.borderLeft = `3px solid ${t.accent}`;
                        e.currentTarget.style.paddingLeft = "0.7rem";
                        e.currentTarget.style.boxShadow = `0 0 10px ${t.shadowMd}, inset 0 0 10px ${t.shadowXs}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderRadius = "0";
                        e.currentTarget.style.borderLeft = "none";
                        e.currentTarget.style.paddingLeft = "0.5rem";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      View Profile
                    </Link>
                    <Link 
                      to="/avatar-creator" 
                      onClick={closeDropdown}
                      style={{
                        color: "#fff",
                        textDecoration: "none",
                        padding: "0.5rem",
                        display: "block",
                        transition: "all 0.3s ease",
                        textShadow: `0 0 8px ${t.shadowSm}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.hoverBg;
                        e.currentTarget.style.borderRadius = "4px";
                        e.currentTarget.style.borderLeft = `3px solid ${t.accent}`;
                        e.currentTarget.style.paddingLeft = "0.7rem";
                        e.currentTarget.style.boxShadow = `0 0 10px ${t.shadowMd}, inset 0 0 10px ${t.shadowXs}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderRadius = "0";
                        e.currentTarget.style.borderLeft = "none";
                        e.currentTarget.style.paddingLeft = "0.5rem";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      Avatar Creator
                    </Link>
                    <Link 
                      to="/achievements" 
                      onClick={closeDropdown}
                      style={{
                        color: "#fff",
                        textDecoration: "none",
                        padding: "0.5rem",
                        display: "block",
                        transition: "all 0.3s ease",
                        textShadow: `0 0 8px ${t.shadowSm}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.hoverBg;
                        e.currentTarget.style.borderRadius = "4px";
                        e.currentTarget.style.borderLeft = `3px solid ${t.accent}`;
                        e.currentTarget.style.paddingLeft = "0.7rem";
                        e.currentTarget.style.boxShadow = `0 0 10px ${t.shadowMd}, inset 0 0 10px ${t.shadowXs}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderRadius = "0";
                        e.currentTarget.style.borderLeft = "none";
                        e.currentTarget.style.paddingLeft = "0.5rem";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      Achievements
                    </Link>
                  </div>
                )}
              </div>
              <Link to="/fitness" onClick={closeDropdown}>Fitness Dashboard</Link>
              <Link to="/chat" onClick={closeDropdown}>Chat</Link>
              <Link to="/dm" onClick={closeDropdown}>DM</Link>
              <Link to="/leaderboard" onClick={closeDropdown}>Leaderboard</Link>
              {(userProfile?.role === 'admin' || userProfile?.userId === "Socalturfexperts@gmail.com" || user?.email === "socalturfexperts@gmail.com") && (
                <Link 
                  to="/admin-control" 
                  onClick={closeDropdown}
                  style={{
                    color: t.accent,
                    fontWeight: "bold",
                    textShadow: `0 0 10px ${t.shadowSm}`
                  }}
                >
                  Admin Console
                </Link>
              )}
              <Link to="/shop" onClick={closeDropdown}>Shop</Link>
              <Link to="/settings" onClick={closeDropdown}>Settings</Link>
              <button onClick={() => { handleLogout(); closeDropdown(); }}>Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
