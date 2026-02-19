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
import AdBanner from "./components/AdBanner.jsx";
import ChatbotTour from "./components/ChatbotTour/ChatbotTour.jsx";
import BackgroundShell from "./components/BackgroundShell.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

// Lazy load views for better performance
const Login = lazy(() => import("./views/Login.jsx"));
const Dashboard = lazy(() => import("./views/Dashboard.jsx"));
const Profile = lazy(() => import("./views/Profile.jsx"));
const Achievements = lazy(() => import("./views/Achievements.jsx"));
const GlobalChat = lazy(() => import("./views/GlobalChat.jsx"));
const DMChat = lazy(() => import("./views/DMChat.jsx"));
const Leaderboard = lazy(() => import("./views/Leaderboard.jsx"));
const Solo = lazy(() => import("./views/Solo.jsx"));
const Burnouts = lazy(() => import("./views/Burnouts.jsx"));
const Live = lazy(() => import("./views/Live.jsx"));
const Run = lazy(() => import("./views/Run.jsx"));
const RaffleRoom = lazy(() => import("./views/RaffleRoom.jsx"));
const WaitingForUpload = lazy(() => import("./views/WaitingForUpload.jsx"));
const AdminDashboard = lazy(() => import("./views/AdminDashboard.jsx"));
const OtherApps = lazy(() => import("./views/OtherApps.jsx"));
const MerchShop = lazy(() => import("./views/MerchShop.jsx"));
const BoxingArena = lazy(() => import("./boxing/pages/Arena.tsx"));
const Subscription = lazy(() => import("./views/Subscription.jsx"));
const FitnessDashboard = lazy(() => import("./views/FitnessDashboard.jsx"));
const Settings = lazy(() => import("./views/Settings.jsx"));

const LEGACY_THEME_TO_MODE = {
  dark: "dark",
  light: "light",
  "red-black": "dark",
  "white-black": "light",
  "black-white": "dark",
};

export default function App() {
      // Accessibility: Voice control (speech recognition)
      useEffect(() => {
        if (!accessibilityEnabled) return;
        let recognition;
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript.trim().toLowerCase();
                // Simple navigation commands
                if (transcript.includes('go to')) {
                  const page = transcript.replace('go to', '').trim();
                  // Map spoken page names to routes
                  const routeMap = {
                    'dashboard': '/dashboard',
                    'profile': '/profile',
                    'chat': '/global-chat',
                    'leaderboard': '/leaderboard',
                    'solo': '/solo',
                    'burnouts': '/burnouts',
                    'live': '/live',
                    'settings': '/settings',
                    'subscription': '/subscription',
                    'shop': '/merch-shop',
                    'admin': '/admin-dashboard',
                    'home': '/',
                  };
                  const route = routeMap[page];
                  if (route) {
                    navigate(route);
                    speakText(`Navigating to ${page}`);
                  } else {
                    speakText(`Page ${page} not found.`);
                  }
                } else if (transcript.includes('read page')) {
                  handleReadContent();
                } else {
                  speakText('Command not recognized.');
                }
              }
            }
          };
          recognition.onerror = (e) => {
            speakText('Voice recognition error.');
          };
          recognition.onend = () => {
            // Restart for continuous listening
            if (accessibilityEnabled) recognition.start();
          };
          recognition.start();
        } else {
          speakText('Speech recognition not supported in this browser.');
        }
        return () => {
          if (recognition) recognition.stop();
        };
      }, [accessibilityEnabled]);
    // Accessibility: Hidden activation state
    const [accessibilityEnabled, setAccessibilityEnabled] = useState(false);
    const [tapCount, setTapCount] = useState(0);

    // Handler for hidden activation (top-left corner tap)
    useEffect(() => {
      const handleTap = (e) => {
        // Only count taps in top-left 80x80px
        if (e.clientX < 80 && e.clientY < 80) {
          setTapCount((prev) => {
            const next = prev + 1;
            if (next >= 5) {
              setAccessibilityEnabled(true);
              speakText('Accessibility features enabled.');
              return 0;
            }
            return next;
          });
        } else {
          setTapCount(0);
        }
      };
      window.addEventListener('mousedown', handleTap);
      window.addEventListener('touchstart', handleTap);
      return () => {
        window.removeEventListener('mousedown', handleTap);
        window.removeEventListener('touchstart', handleTap);
      };
    }, []);
  const navigate = useNavigate();
  const location = useLocation();

  // Accessibility: Text-to-Speech utility
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = 'en-AU'; // Australian English
      // Try to select 'Karen' voice
      const voices = window.speechSynthesis.getVoices();
      const karenVoice = voices.find(v => v.name.toLowerCase().includes('karen'));
      if (karenVoice) {
        utterance.voice = karenVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  // Example: Speak current page name on mount
  useEffect(() => {
    const page = location.pathname.replace('/', '') || 'home';
    speakText(`You are on the ${page} page.`);
  }, [location.pathname]);

  // Accessibility: Button to read main content
  const handleReadContent = () => {
    const main = document.querySelector('main');
    if (main) {
      speakText(main.innerText);
    } else {
      speakText('Main content not found.');
    }
  };

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadingStartTime] = useState(Date.now());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [initialHype, setInitialHype] = useState(false);
  const [showBot, setShowBot] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [isTinyViewport, setIsTinyViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 380px)").matches;
  });
  const [activeGame, setActiveGame] = useState(null);

  const [themeMode, setThemeMode] = useState(() => {
    const savedMode = localStorage.getItem("themeMode");
    const legacyTheme = localStorage.getItem("theme");
    return LEGACY_THEME_TO_MODE[savedMode] || LEGACY_THEME_TO_MODE[legacyTheme] || "dark";
  });

  const theme = themeMode === "light" ? "white-black" : "red-black";

  const launchGame = (url) => {
    setActiveGame(url);
  };

  const closeGame = () => {
    setActiveGame(null);
  };

  useEffect(() => {
    window.launchGame = launchGame;
    return () => { delete window.launchGame; };
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.remove("theme-red-black", "theme-white-black", "theme-black-white");
    body.classList.add(`theme-${theme}`);
    localStorage.setItem("themeMode", themeMode);
    localStorage.setItem("theme", theme);
  }, [theme, themeMode]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const onChange = (event) => setIsMobileViewport(event.matches);

    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);

    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 380px)");
    const onChange = (event) => setIsTinyViewport(event.matches);

    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);

    return () => {
      if (media.removeEventListener) media.removeEventListener("change", onChange);
      else media.removeListener(onChange);
    };
  }, []);

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const botStyles = {
    botTrigger: {
      position: "fixed",
      bottom: isTinyViewport ? "74px" : (isMobileViewport ? "78px" : "85px"),
      right: isTinyViewport ? "10px" : (isMobileViewport ? "14px" : "20px"),
      background: "var(--accent-color, #FF0000)",
      color: "#FFF",
      border: "none",
      borderRadius: "50%",
      width: isTinyViewport ? "42px" : (isMobileViewport ? "46px" : "50px"),
      height: isTinyViewport ? "42px" : (isMobileViewport ? "46px" : "50px"),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      cursor: "pointer",
      boxShadow: "0 0 15px var(--accent-color, #FF0000)",
      zIndex: 10001,
      fontSize: isTinyViewport ? "16px" : (isMobileViewport ? "18px" : "20px"),
      transition: "all 0.3s ease",
    },
    botContainer: {
      position: "fixed",
      bottom: isTinyViewport ? "124px" : (isMobileViewport ? "132px" : "145px"),
      right: isTinyViewport ? "8px" : (isMobileViewport ? "12px" : "20px"),
      width: isTinyViewport ? "calc(100vw - 16px)" : (isMobileViewport ? "calc(100vw - 24px)" : "350px"),
      maxWidth: isMobileViewport ? "420px" : "350px",
      height: isTinyViewport ? "min(62vh, 500px)" : (isMobileViewport ? "min(66vh, 520px)" : "500px"),
      zIndex: 10001,
      boxShadow: "0 0 30px rgba(0,0,0,0.5)",
    },
  };

  // Activity tracking
  useEffect(() => {
    if (!user) return;

    const path = location.pathname.split("/")[1] || "dashboard";
    UserService.updateHeartbeat(user.uid, path);

    const interval = setInterval(() => {
      UserService.updateHeartbeat(user.uid, path);
    }, 30000);

    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // Force a minimum loading time for the hype screen even if auth is fast
  useEffect(() => {
    const timer = setTimeout(() => setInitialHype(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const refreshUserProfile = async (userId) => {
    try {
      const result = await UserService.getUserProfile(userId);
      if (result.success && result.profile) {
        setUserProfile(result.profile);
        return result.profile;
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
    return null;
  };

  useEffect(() => {
    const MINIMUM_LOADING_TIME = 3000;
    const MAX_AUTH_WAIT = 8000;
    let authResolved = false;

    setLoading(true);
    setCheckingSetup(true);
    setProfileLoaded(false);
    setInitialHype(true);

    const maxTimeout = setTimeout(() => {
      if (!authResolved) {
        console.log("Auth max timeout reached - forcing end of loading state");
        authResolved = true;
        setLoading(false);
        setCheckingSetup(false);
        setProfileLoaded(true);
      }
    }, MAX_AUTH_WAIT);

    let unsubscribe = () => {};

    authReady.then(() => {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser ? "User logged in" : "No user");
      authResolved = true;
      setUser(currentUser);

      if (currentUser) {
        try {
          const result = await UserService.getUserProfile(currentUser.uid);

          if (result.success && result.profile) {
            setUserProfile(result.profile);

            UserService.updateLoginStreak(currentUser.uid).then((streakResult) => {
              if (streakResult.success) {
                refreshUserProfile(currentUser.uid);
              }
            }).catch(err => 
              console.error("Login streak update failed:", err)
            );

            if (result.profile.hasCompletedSetup) {
              setShowOnboarding(false);
              setOnboardingComplete(true);
              setIsNewSignup(false);
              setShowBot(true);
            } else {
              setShowOnboarding(true);
              setIsNewSignup(true);
            }
          } else {
            setUserProfile(null);
            setShowOnboarding(true);
            setIsNewSignup(true);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          setUserProfile(null);
          setShowOnboarding(true);
          setIsNewSignup(true);
        }

        setProfileLoaded(true);

        const elapsedTime = Date.now() - loadingStartTime;
        const remainingTime = Math.max(0, MINIMUM_LOADING_TIME - elapsedTime);

        setTimeout(() => {
          clearTimeout(maxTimeout);
          setLoading(false);
          setCheckingSetup(false);
        }, remainingTime);
      } else {
        setUserProfile(null);
        setProfileLoaded(true);
        setShowOnboarding(false);
        setOnboardingComplete(false);
        setIsNewSignup(false);
        clearTimeout(maxTimeout);
        setLoading(false);
        setCheckingSetup(false);
      }
    });
    });

    return () => {
      unsubscribe();
      clearTimeout(maxTimeout);
    };
  }, [loadingStartTime]);

  useEffect(() => {
    if (!user?.uid) {
      setUserProfile(null);
      return;
    }
    const userDocRef = doc(db, "users", user.uid);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        setUserProfile(null);
      }
    }, (error) => {
      console.error("Profile listener error:", error);
      setUserProfile(null);
    });
    return () => unsubProfile();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    let canceled = false;

    const syncSubscriptionStatus = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/stripe/subscription", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok || canceled) return;

        const data = await res.json();
        if (canceled) return;

        const isActive = Boolean(
          data?.subscription &&
          (data.subscription.status === "active" || data.subscription.status === "trialing")
        );

        setUserProfile((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            subscriptionStatus: isActive ? "active" : "inactive",
            subscriptionId: data?.subscription?.id || prev.subscriptionId,
          };
        });
      } catch (error) {
        console.error("Subscription sync failed:", error);
      }
    };

    syncSubscriptionStatus();
  }, [user?.uid, location.pathname, location.search]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingComplete(true);
  };

  const handleSetupComplete = async () => {
    const updatedProfile = await refreshUserProfile(user.uid);
    if (updatedProfile && updatedProfile.hasCompletedSetup) {
      setOnboardingComplete(true);
      setTimeout(() => navigate("/dashboard"), 100);
    }
  };

  const skipLoading = () => {
    setInitialHype(false);
    setLoading(false);
    setCheckingSetup(false);
    setProfileLoaded(true);
  };

  // Loading / onboarding gates
  if (loading || checkingSetup || !profileLoaded || initialHype) {
    return <LoadingScreen onSkip={skipLoading} />;
  }

  if (user && showOnboarding && !onboardingComplete) {
    return <OnboardingSlides onComplete={handleOnboardingComplete} />;
  }

  if (user && isNewSignup && (!userProfile || !userProfile.hasCompletedSetup)) {
    return <WaitingForUpload user={user} onSetupComplete={handleSetupComplete} />;
  }

  return (
    <BackgroundShell>
      {(!userProfile || userProfile.subscriptionStatus !== 'active') && <AdBanner />}

      {/* PERSISTENT OVERLAY FOR GAMES */}
      {activeGame && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 20000,
          background: "#000",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Overlay Header */}
          <div style={{
            height: "60px",
            background: "rgba(0,0,0,0.8)",
            borderBottom: "1px solid var(--accent-color, #ff3050)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 15px",
            backdropFilter: "blur(10px)",
            zIndex: 1
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {userProfile?.avatarURL && (
                <img 
                  src={userProfile.avatarURL} 
                  alt="avatar" 
                  style={{ width: "35px", height: "35px", borderRadius: "50%", border: "1px solid var(--accent-color, #ff3050)" }} 
                />
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{userProfile?.nickname}</span>
                <span style={{ color: "var(--accent-color, #ff3050)", fontSize: "10px" }}>🎟️ {userProfile?.tickets || 0}</span>
              </div>
            </div>
            <button 
              onClick={closeGame}
              style={{
                background: "var(--accent-color, #ff3050)",
                color: "#fff",
                border: "none",
                borderRadius: "5px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: "bold",
                boxShadow: "0 0 10px var(--accent-shadow-md, rgba(255, 48, 80, 0.5))"
              }}
            >
              EXIT
            </button>
          </div>
          
          <iframe 
            src={activeGame}
            style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            title="Rivalis Game Instance"
          />
        </div>
      )}

      {user && (
        <Navbar user={user} userProfile={userProfile} themeMode={themeMode} toggleThemeMode={toggleThemeMode} />
      )}

      {/* Theme toggle only on login route */}
      {!user && location.pathname === "/login" && (
        <ThemeToggle
          mode={themeMode}
          onToggle={toggleThemeMode}
          className="theme-toggle-login"
        />
      )}

      {/* Bot trigger only when logged in */}
      {user && (
        <>
          <button
            onClick={() => setShowBot(!showBot)}
            style={botStyles.botTrigger}
            aria-label="Rivalis Coach"
          >
            {showBot ? "✕" : "🦾"}
          </button>

          {showBot && (
            <div style={botStyles.botContainer}>
              <ChatbotTour
                user={user}
                userProfile={userProfile}
                onTourComplete={() => console.log("Tour finished")}
                initialMessage="Hey Rival! I'm Rivalis Coach. Ready to optimize? Let's take the tour!"
              />
            </div>
          )}
        </>
      )}

      <ThemeProvider theme={theme}>
      <Suspense
        fallback={<div style={{ color: "var(--accent-color, #ff3050)", padding: "20px", textAlign: "center" }}>LOADING…</div>}
      >
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />

          <Route
            path="/burnouts"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Burnouts user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Dashboard user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Profile user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatar-creator"
            element={
              user ? (isNewSignup ? <WaitingForUpload /> : <Profile user={user} userProfile={userProfile} />) : <Login />
            }
          />
          <Route
            path="/solo"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Solo user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Live user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/run"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Run user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/raffle"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <RaffleRoom user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shop"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <MerchShop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/fitness"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <FitnessDashboard user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/achievements"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Achievements user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <GlobalChat user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dm"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <DMChat user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Leaderboard user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-control"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Suspense fallback={<div>LOADING...</div>}>
                  <AdminDashboard userProfile={userProfile} />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/other-apps"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <OtherApps />
              </ProtectedRoute>
            }
          />
          <Route
            path="/boxing"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <BoxingArena />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription"
            element={
              <ProtectedRoute user={user} userProfile={userProfile}>
                <Subscription user={user} userProfile={userProfile} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      </ThemeProvider>
    </BackgroundShell>
  );
}
