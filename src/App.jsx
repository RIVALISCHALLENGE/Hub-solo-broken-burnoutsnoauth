import React, { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "./index.css";

const Login = lazy(() => import("./views/Login.jsx"));
const Dashboard = lazy(() => import("./views/Dashboard.jsx"));

const AdBanner = () => (
  <div className="ad-banner">
    ADVERTISEMENT BANNER (728x90)
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [accClickCount, setAccClickCount] = useState(0);
  const [isA11yEnabled, setIsA11yEnabled] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleAccClick = () => {
    setAccClickCount(prev => {
      const next = prev + 1;
      if (next === 5) {
        setIsA11yEnabled(true);
        const msg = new SpeechSynthesisUtterance("Accessibility mode enabled. Voice control active.");
        window.speechSynthesis.speak(msg);
        return 0;
      }
      return next;
    });
    setTimeout(() => setAccClickCount(0), 2000);
  };

  if (loading) return <div style={{color:"white", background: "#000", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center"}}>Loading...</div>;

  return (
    <Suspense fallback={<div style={{color:"white"}}>Loading...</div>}>
      <div className="accessibility-trigger" onClick={handleAccClick} />
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AdBanner />
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login isA11yEnabled={isA11yEnabled} />} />
          <Route path="/dashboard" element={user ? <Dashboard isA11yEnabled={isA11yEnabled} /> : <Navigate to="/login" />} />
        </Routes>
        <AdBanner />
      </div>
    </Suspense>
  );
}
