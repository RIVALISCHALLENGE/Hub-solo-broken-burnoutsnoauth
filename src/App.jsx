import React, { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { auth, db, authReady } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { UserService } from "./services/userService.js";

import LoadingScreen from "./components/LoadingScreen.jsx";
import OnboardingSlides from "./components/OnboardingSlides.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Navbar from "./components/Navbar.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import BackgroundShell from "./components/BackgroundShell.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

// Lazy views
const Login = lazy(() => import("./views/Login.jsx"));
const Dashboard = lazy(() => import("./views/Dashboard.jsx"));
const Profile = lazy(() => import("./views/Profile.jsx"));
const AdminDashboard = lazy(() => import("./views/AdminDashboard.jsx"));

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // AUTH
  useEffect(() => {
    let unsubscribe = () => {};

    authReady.then(() => {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setUser(currentUser);

        if (currentUser) {
          const result = await UserService.getUserProfile(currentUser.uid);
          if (result.success) {
            setUserProfile(result.profile);
          }
        } else {
          setUserProfile(null);
        }

        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  // PROFILE REALTIME
  useEffect(() => {
    if (!user?.uid) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    });

    return () => unsub();
  }, [user?.uid]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <BackgroundShell>
      {user && <Navbar user={user} userProfile={userProfile} />}

      {!user && location.pathname === "/login" && (
        <ThemeToggle />
      )}

      <ThemeProvider theme="red-black">
        <Suspense fallback={<div style={{ color: "#ff3050", padding: 20 }}>LOADING...</div>}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute user={user} userProfile={userProfile}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute user={user} userProfile={userProfile}>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-control"
              element={
                <ProtectedRoute user={user} userProfile={userProfile}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </BackgroundShell>
  );
}
