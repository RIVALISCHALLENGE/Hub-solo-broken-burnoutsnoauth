import React, { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import "./index.css";
import { AccessibilityProvider } from "./context/AccessibilityContext";
import { AccessibilityWrapper } from "./components/accessibility/AccessibilityWrapper";
import { VoiceNavigator } from "./components/accessibility/VoiceNavigator";

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

  if (loading) return <div style={{color:"white", background: "#000", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center"}}>Loading...</div>;

  return (
    <AccessibilityProvider>
      <AccessibilityWrapper>
        <Suspense fallback={<div style={{color:"white"}}>Loading...</div>}>
          <VoiceNavigator />
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <AdBanner />
            <Routes>
              <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
            </Routes>
            <AdBanner />
          </div>
        </Suspense>
      </AccessibilityWrapper>
    </AccessibilityProvider>
  );
}
