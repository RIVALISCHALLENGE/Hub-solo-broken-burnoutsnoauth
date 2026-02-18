import React, { useState, useEffect, useCallback } from "react";
import { UserService } from "../services/userService.js";
import { BuddyService } from "../services/buddyService.js";
import { db, storage } from "../firebase.js";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import WaitingForUpload from "./WaitingForUpload.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { DEFAULT_VOICE_MODEL, VOICE_MODEL_OPTIONS, primeVoiceCoach, speakCoach } from "../logic/voiceCoach.js";

const COACH_VOICE_STORAGE_KEY = "rivalis_coach_voice_model";

const avatarStyles = [
  { id: "adventurer", name: "Adventurer" },
  { id: "avataaars", name: "Avataaars" },
  { id: "bottts", name: "Robots" },
  { id: "lorelei", name: "Lorelei" },
  { id: "micah", name: "Micah" },
  { id: "miniavs", name: "Miniavs" },
  { id: "notionists", name: "Notionists" },
  { id: "open-peeps", name: "Open Peeps" },
  { id: "personas", name: "Personas" },
  { id: "pixel-art", name: "Pixel Art" },
];

const parseDicebearURL = (url) => {
  if (!url || !url.includes('dicebear.com')) {
    return null;
  }
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const seed = urlObj.searchParams.get('seed');
    if (!seed) return null;
    const versionIndex = pathParts.findIndex(part => part.includes('.x'));
    if (versionIndex === -1) return null;
    const style = pathParts[versionIndex + 1];
    if (!style) return null;
    return { style, seed };
  } catch (e) {
    return null;
  }
};

export default function Profile({ user, userProfile }) {
  const t = useTheme();
  const [bio, setBio] = useState(userProfile?.bio || "");
  const [nickname, setNickname] = useState(userProfile?.nickname || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [seed, setSeed] = useState("");
  const [isDicebearAvatar, setIsDicebearAvatar] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [streaks, setStreaks] = useState({ current: 0, longest: 0 });
  const [achievements, setAchievements] = useState([]);
  const [fitnessGoals, setFitnessGoals] = useState(userProfile?.fitnessGoals || []);
  const [appSeeking, setAppSeeking] = useState(
    Array.isArray(userProfile?.appSeeking) ? userProfile.appSeeking : (userProfile?.appSeeking ? [userProfile.appSeeking] : [])
  );
  const [age, setAge] = useState(userProfile?.age || "");
  const [heightFeet, setHeightFeet] = useState(userProfile?.heightFeet || "");
  const [heightInches, setHeightInches] = useState(userProfile?.heightInches || "");
  const [profileWeight, setProfileWeight] = useState(userProfile?.weight || "");
  const [gender, setGender] = useState(userProfile?.gender || "");
  const [fitnessLevel, setFitnessLevel] = useState(userProfile?.fitnessLevel || "");
  const [workoutFrequency, setWorkoutFrequency] = useState(userProfile?.workoutFrequency || "");
  const [profileInjuries, setProfileInjuries] = useState(userProfile?.injuries || "");
  const [profileGoalsText, setProfileGoalsText] = useState(
    userProfile?.goals || (Array.isArray(userProfile?.fitnessGoals) ? userProfile.fitnessGoals.join(", ") : "")
  );
  const [profileReasonText, setProfileReasonText] = useState(
    userProfile?.reason || (Array.isArray(userProfile?.appSeeking) ? userProfile.appSeeking.join(", ") : (userProfile?.appSeeking || ""))
  );
  const [aiPlan, setAiPlan] = useState(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [isTinyViewport, setIsTinyViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(max-width: 380px)").matches;
  });
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [lookingForBuddy, setLookingForBuddy] = useState(userProfile?.lookingForBuddy || false);
  const [potentialBuddies, setPotentialBuddies] = useState([]);
  const [coachVoiceModel, setCoachVoiceModel] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_VOICE_MODEL;
    return window.localStorage.getItem(COACH_VOICE_STORAGE_KEY) || DEFAULT_VOICE_MODEL;
  });

  useEffect(() => {
    if (userProfile) {
      setLookingForBuddy(userProfile.lookingForBuddy || false);
    }
  }, [userProfile]);

  useEffect(() => {
    if (user) {
      loadBuddyData();
      UserService.getUsersLookingForBuddy().then(setPotentialBuddies);
    }
  }, [user]);

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

  const handleToggleLooking = async () => {
    const newValue = !lookingForBuddy;
    setLookingForBuddy(newValue);
    await UserService.updateUserProfile(user.uid, { lookingForBuddy: newValue });
  };

  const loadBuddyData = async () => {
    try {
      const friendIds = await BuddyService.getFriends(user.uid);
      const friendProfiles = await Promise.all(friendIds.map(id => UserService.getUserProfile(id)));
      setFriends(friendProfiles.filter(p => p.success).map(p => p.profile));
      
      const requests = await BuddyService.getPendingRequests(user.uid);
      setPendingRequests(requests);

      const challenges = await BuddyService.getActiveChallenges(user.uid);
      setActiveChallenges(challenges);
    } catch (error) {
      console.error("Error loading buddy data:", error);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!searchEmail) return;
    const q = query(collection(db, "users"), where("email", "==", searchEmail));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const targetUserId = snapshot.docs[0].id;
      await BuddyService.sendFriendRequest(user.uid, targetUserId);
      alert("Request sent!");
      setSearchEmail("");
    } else {
      alert("User not found.");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    await BuddyService.respondToRequest(requestId, "accepted");
    loadBuddyData();
  };

  const fitnessGoalOptions = [
    "Build Muscle",
    "Lose Weight",
    "Improve Endurance",
    "General Fitness",
    "Mental Health"
  ];

  const appSeekingOptions = [
    "Gamification",
    "Social Connection",
    "Structured Plans",
    "Progress Tracking",
    "Accountability",
    "Competition",
    "Weight Loss",
    "Muscle Building",
    "Community Support",
    "Motivation",
    "Fun Workouts",
    "Stress Relief",
    "Health Improvement",
    "Athletic Performance"
  ];

  useEffect(() => {
    if (userProfile) {
      setBio(userProfile.bio || "");
      setNickname(userProfile.nickname || "");
      setStreaks({
        current: userProfile.currentStreak || 0,
        longest: userProfile.longestStreak || 0
      });
      setAchievements(userProfile.achievements || []);
      setFitnessGoals(userProfile.fitnessGoals || []);
      setAppSeeking(Array.isArray(userProfile.appSeeking) ? userProfile.appSeeking : (userProfile.appSeeking ? [userProfile.appSeeking] : []));
      setAge(userProfile.age || "");
      setHeightFeet(userProfile.heightFeet || "");
      setHeightInches(userProfile.heightInches || "");
      setProfileWeight(userProfile.weight || "");
      setGender(userProfile.gender || "");
      setFitnessLevel(userProfile.fitnessLevel || "");
      setWorkoutFrequency(userProfile.workoutFrequency || "");
      setProfileInjuries(userProfile.injuries || "");
      setProfileGoalsText(userProfile.goals || (Array.isArray(userProfile.fitnessGoals) ? userProfile.fitnessGoals.join(", ") : ""));
      setProfileReasonText(userProfile.reason || (Array.isArray(userProfile.appSeeking) ? userProfile.appSeeking.join(", ") : (userProfile.appSeeking || "")));
    }
  }, [userProfile]);

  useEffect(() => {
    if (isEditingAvatar) {
      setCurrentAvatar("");
      setSelectedStyle("");
      setIsDicebearAvatar(false);
      setSeed(user?.email?.split('@')[0] || Math.random().toString(36).substring(7));
    }
  }, [isEditingAvatar, user]);

  const saveBio = async () => {
    if (!user) return;
    
    const feet = parseFloat(heightFeet) || 0;
    const inches = parseFloat(heightInches) || 0;
    const totalInches = (feet * 12) + inches;
    const weightNum = parseFloat(profileWeight) || 0;
    const calculatedBmi = totalInches > 0 && weightNum > 0 ? parseFloat(((weightNum / (totalInches * totalInches)) * 703).toFixed(1)) : null;
    const heightStr = feet > 0 ? `${Math.floor(feet)}'${Math.floor(inches)}"` : "";
    const normalizedGoals = profileGoalsText.trim();
    const normalizedReason = profileReasonText.trim();
    const normalizedFitnessGoals = normalizedGoals ? [normalizedGoals] : [];
    const normalizedAppSeeking = normalizedReason ? [normalizedReason] : [];

    const result = await UserService.updateUserProfile(user.uid, { 
      bio,
      nickname,
      fitnessGoals: normalizedFitnessGoals,
      appSeeking: normalizedAppSeeking,
      age, gender, fitnessLevel, workoutFrequency,
      heightFeet: String(Math.floor(feet)),
      heightInches: String(Math.floor(inches)),
      height: heightStr,
      weight: profileWeight,
      bmi: calculatedBmi,
      injuries: profileInjuries,
      goals: normalizedGoals,
      reason: normalizedReason
    });
    if (result.success) {
      setIsEditing(false);
      if (normalizedGoals || normalizedReason) {
        generateAiPlan();
      }
    }
  };

  const isPro = userProfile?.subscriptionStatus === "active";

  const generateAiPlan = useCallback(async () => {
    if (!user) return;
    setAiPlanLoading(true);
    setAiPlan(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fitnessGoals: profileGoalsText.trim() ? [profileGoalsText.trim()] : (fitnessGoals.length > 0 ? fitnessGoals : (userProfile?.fitnessGoals || [])),
          appSeeking: profileReasonText.trim() ? [profileReasonText.trim()] : (appSeeking || userProfile?.appSeeking || ""),
          age: age || userProfile?.age || "",
          gender: gender || userProfile?.gender || "",
          fitnessLevel: fitnessLevel || userProfile?.fitnessLevel || "",
          workoutFrequency: workoutFrequency || userProfile?.workoutFrequency || "",
          injuries: profileInjuries || userProfile?.injuries || ""
        })
      });
      const data = await res.json();
      if (data.plan) {
        setAiPlan(data.plan);
        setShowFullPlan(true);
      }
    } catch (err) {
      console.error("Plan generation failed:", err);
    } finally {
      setAiPlanLoading(false);
    }
  }, [user, profileGoalsText, profileReasonText, fitnessGoals, appSeeking, age, gender, fitnessLevel, workoutFrequency, profileInjuries, userProfile]);

  const toggleFitnessGoal = (goal) => {
    setFitnessGoals(prev => 
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
  };

  const toggleAppSeeking = (option) => {
    setAppSeeking(prev =>
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  const handleCoachVoiceModelChange = (event) => {
    const selected = event.target.value;
    setCoachVoiceModel(selected);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COACH_VOICE_STORAGE_KEY, selected);
    }
  };

  const previewCoachVoice = () => {
    const userName = nickname?.trim() || userProfile?.nickname || user?.displayName || "Rival";
    primeVoiceCoach();
    speakCoach(`Ready when you are, ${userName}. Your AI coach voice is active.`, {
      voiceModel: coachVoiceModel,
      interrupt: true,
    });
  };

  const saveAvatar = async () => {
    if (!user) return;
    setIsSavingAvatar(true);
    
    try {
      const avatarURL = isDicebearAvatar 
        ? `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${seed}`
        : currentAvatar;
      
      console.log("Saving Avatar URL:", avatarURL);
      
      await updateProfile(user, { photoURL: avatarURL });
      
      const result = await UserService.updateUserProfile(user.uid, { avatarURL });
      
      if (result.success) {
        alert("Avatar saved successfully!");
        setIsEditingAvatar(false);
        window.location.reload(); 
      } else {
        throw new Error(result.error || "Database update failed");
      }
    } catch (error) {
      console.error("Error saving avatar:", error);
      alert("Failed to save avatar: " + error.message);
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid image (JPG, PNG, GIF, or WebP)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    try {
      setIsSavingAvatar(true);
      
      const objectUrl = URL.createObjectURL(file);
      setCurrentAvatar(objectUrl);
      setIsDicebearAvatar(false);

      const timestamp = Date.now();
      const fileRef = ref(storage, `avatars/${user.uid}/${timestamp}-${file.name}`);
      const metadata = { contentType: file.type };
      
      console.log("Uploading to Storage...");
      await uploadBytes(fileRef, file, metadata);
      const downloadURL = await getDownloadURL(fileRef);
      
      setCurrentAvatar(downloadURL);
      console.log("Uploading to Firestore...");
      const updateResult = await UserService.updateUserProfile(user.uid, { avatarURL: downloadURL });
      
      if (updateResult.success) {
        await updateProfile(user, { photoURL: downloadURL });
        alert("Photo uploaded successfully!");
        setIsEditingAvatar(false);
        window.location.reload();
      } else {
        throw new Error(updateResult.error || "Firestore update failed");
      }
    } catch (error) {
      console.error("Critical upload error:", error);
      alert("Upload failed: " + error.message);
    } finally {
      setIsSavingAvatar(false);
      if (event.target) event.target.value = "";
    }
  };

  const avatarURL = userProfile?.avatarURL || user?.photoURL || "";
  const displayNicknameValue = userProfile?.nickname || user?.displayName || "User";
  const totalReps = userProfile?.totalReps || 0;
  const totalMiles = userProfile?.totalMiles || 0;
  const ticketBalance = userProfile?.ticketBalance || 0;

  const defaultAchievements = [
    { id: 1, name: "First Steps", description: "Complete your first workout", unlocked: totalReps > 0, icon: "🏃" },
    { id: 2, name: "Century Club", description: "Complete 100 total reps", unlocked: totalReps >= 100, icon: "💯" },
    { id: 3, name: "Rep Master", description: "Complete 500 total reps", unlocked: totalReps >= 500, icon: "🏆" },
    { id: 7, name: "First Blood", description: "Complete your first run", unlocked: totalMiles > 0, icon: "🏁" },
    { id: 8, name: "Breaking Stride", description: "Run 1 mile total", unlocked: totalMiles >= 1, icon: "⚡" },
    { id: 9, name: "Road Warrior", description: "Run 50 total miles", unlocked: totalMiles >= 50, icon: "🛣️" },
    { id: 4, name: "Ticket Collector", description: "Earn 10 raffle tickets", unlocked: ticketBalance >= 10, icon: "🎟️" },
    { id: 5, name: "Streak Keeper", description: "Maintain a 7-day login streak", unlocked: (userProfile?.loginStreak || 0) >= 7, icon: "🔥" },
    { id: 6, name: "Elite Athlete", description: "Complete 1000 total reps", unlocked: totalReps >= 1000, icon: "⭐" }
  ];

  return (
    <div className="hero-background">
      <div style={{ 
        width: isMobileViewport ? "100%" : "95%", 
        maxWidth: isMobileViewport ? "100%" : "900px",
        minHeight: isMobileViewport ? "auto" : "80vh",
        background: "#000000",
        border: `2px solid ${t.accent}`,
        borderRadius: isTinyViewport ? "8px" : (isMobileViewport ? "10px" : "12px"),
        padding: isTinyViewport ? "0.75rem" : (isMobileViewport ? "1rem" : "2rem"),
        boxShadow: `0 0 30px ${t.shadowMd}, inset 0 0 20px ${t.shadowXxs}`
      }}>
        <div style={{
          display: "flex",
          gap: isTinyViewport ? "0.75rem" : (isMobileViewport ? "1rem" : "2rem"),
          marginBottom: isTinyViewport ? "0.75rem" : (isMobileViewport ? "1rem" : "2rem"),
          flexWrap: "wrap"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem"
          }}>
            {isEditingAvatar ? (
              <div style={{ textAlign: "center", width: "100%", maxWidth: "400px" }}>
                <WaitingForUpload 
                  user={user} 
                  isUpdating={true} 
                  onSetupComplete={() => setIsEditingAvatar(false)} 
                />
              </div>
            ) : (
              <div className="avatar-edit-section">
                {avatarURL && (
                  <img 
                    src={avatarURL} 
                    alt={nickname} 
                    className="avatar-image"
                    style={{ 
                      width: isTinyViewport ? "90px" : "120px", 
                      height: isTinyViewport ? "90px" : "120px", 
                      borderRadius: "50%", 
                      background: "#fff",
                      border: `4px solid ${t.accent}`,
                      boxShadow: `0 0 20px ${t.shadowMd}`
                    }}
                  />
                )}
                <h2 style={{ 
                  color: t.accent,
                  textShadow: `0 0 15px ${t.shadow}`,
                  margin: "10px 0"
                }}>
                  {displayNicknameValue}
                </h2>
                <button
                  onClick={() => setIsEditingAvatar(true)}
                  className="avatar-edit-button"
                  style={{
                    padding: "6px 12px",
                    background: "#000000",
                    border: `2px solid ${t.accent}`,
                    borderRadius: "6px",
                    color: t.accent,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "block",
                    margin: "0 auto"
                  }}
                >
                  Edit Avatar
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: isMobileViewport ? "100%" : "300px" }}>
            <h3 style={{ 
              color: t.accent,
              textShadow: `0 0 15px ${t.shadow}`,
              marginBottom: "1rem"
            }}>
              Identity Details
            </h3>
            <div className="profile-bio-section">
            <div style={{
              marginBottom: "1rem",
              padding: "10px",
              background: t.hoverBg,
              border: `1px solid ${t.shadowXs}`,
              borderRadius: "8px"
            }}>
              <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>
                AI COACH VOICE
              </label>
              <select
                value={coachVoiceModel}
                onChange={handleCoachVoiceModelChange}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  background: "#000",
                  border: `2px solid ${t.accent}`,
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "14px",
                  boxShadow: `0 0 10px ${t.shadowXs}`
                }}
              >
                {VOICE_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={previewCoachVoice}
                style={{
                  marginTop: "0.6rem",
                  width: "100%",
                  padding: "0.5rem 0.7rem",
                  background: "#000000",
                  border: `2px solid ${t.accent}`,
                  borderRadius: "8px",
                  color: t.accent,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "12px"
                }}
              >
                Preview Voice
              </button>
            </div>
            {isEditing ? (
              <div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontFamily: "'Press Start 2P', cursive" }}>NICKNAME</label>
                  <input 
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      background: "#000000",
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                      boxShadow: `0 0 15px ${t.shadowSm}`
                    }}
                  />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.8rem", fontFamily: "'Press Start 2P', cursive" }}>BIO</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    style={{
                      width: "100%",
                      minHeight: "100px",
                      padding: "0.75rem",
                      background: "#000000",
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                      resize: "vertical",
                      boxShadow: `0 0 15px ${t.shadowSm}, inset 0 0 10px ${t.shadowXxs}`
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobileViewport ? "1fr" : "1fr 1fr", gap: isTinyViewport ? "0.5rem" : "0.75rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>AGE</label>
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }} />
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>GENDER</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }}>
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-Binary">Non-Binary</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>HEIGHT (FT)</label>
                    <input type="number" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} placeholder="5" style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }} />
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>HEIGHT (IN)</label>
                    <input type="number" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} placeholder="10" style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }} />
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>WEIGHT (LBS)</label>
                    <input type="number" value={profileWeight} onChange={(e) => setProfileWeight(e.target.value)} placeholder="175" style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }} />
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>FITNESS LEVEL</label>
                    <select value={fitnessLevel} onChange={(e) => setFitnessLevel(e.target.value)} style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }}>
                      <option value="">Select...</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Elite">Elite</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>DAYS/WEEK</label>
                    <select value={workoutFrequency} onChange={(e) => setWorkoutFrequency(e.target.value)} style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }}>
                      <option value="">Select...</option>
                      <option value="0-1">0-1</option>
                      <option value="2-3">2-3</option>
                      <option value="4-5">4-5</option>
                      <option value="6-7">6-7</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>INJURIES / LIMITATIONS</label>
                    <input type="text" value={profileInjuries} onChange={(e) => setProfileInjuries(e.target.value)} placeholder="None" style={{ width: "100%", padding: "0.6rem", background: "#000", border: `2px solid ${t.accent}`, borderRadius: "8px", color: "#fff", fontSize: "14px", boxShadow: `0 0 10px ${t.shadowXs}` }} />
                  </div>
                  {(() => {
                    const ft = parseFloat(heightFeet) || 0;
                    const inc = parseFloat(heightInches) || 0;
                    const ti = (ft * 12) + inc;
                    const wt = parseFloat(profileWeight) || 0;
                    if (ti > 0 && wt > 0) {
                      const liveBmi = ((wt / (ti * ti)) * 703).toFixed(1);
                      const bmiVal = parseFloat(liveBmi);
                      let cat = "Normal"; let col = "#22c55e";
                      if (bmiVal < 18.5) { cat = "Underweight"; col = "#3b82f6"; }
                      else if (bmiVal >= 25 && bmiVal < 30) { cat = "Overweight"; col = "#f59e0b"; }
                      else if (bmiVal >= 30) { cat = "Obese"; col = "#ef4444"; }
                      return (
                        <div style={{ gridColumn: "1 / -1", background: t.shadowXxs, border: `1px solid ${t.shadowXs}`, borderRadius: "8px", padding: "10px", textAlign: "center" }}>
                          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "1px" }}>LIVE BMI: </span>
                          <span style={{ color: col, fontSize: "1.1rem", fontWeight: "bold", fontFamily: "'Press Start 2P', cursive" }}>{liveBmi}</span>
                          <span style={{ color: col, fontSize: "0.7rem", marginLeft: "8px" }}>({cat})</span>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.55rem", marginTop: "4px", fontStyle: "italic" }}>BMI does not account for muscle mass or body composition</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>FITNESS GOALS</label>
                  <textarea
                    value={profileGoalsText}
                    onChange={(e) => setProfileGoalsText(e.target.value)}
                    placeholder="Ex: Build lean muscle, improve endurance"
                    style={{
                      width: "100%",
                      minHeight: "72px",
                      padding: "0.6rem",
                      background: "#000",
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                      resize: "vertical",
                      boxShadow: `0 0 10px ${t.shadowXs}`
                    }}
                  />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ color: t.accent, display: "block", marginBottom: "0.5rem", fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>REASON FOR JOINING RIVALIS</label>
                  <textarea
                    value={profileReasonText}
                    onChange={(e) => setProfileReasonText(e.target.value)}
                    placeholder="Ex: I want structured training and accountability"
                    style={{
                      width: "100%",
                      minHeight: "72px",
                      padding: "0.6rem",
                      background: "#000",
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "14px",
                      resize: "vertical",
                      boxShadow: `0 0 10px ${t.shadowXs}`
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={saveBio}
                    style={{
                      padding: "0.5rem 1rem",
                      background: t.accent,
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: "#fff",
                      fontWeight: "bold",
                      cursor: "pointer",
                      boxShadow: `0 0 15px ${t.shadowMd}`
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setBio(userProfile?.bio || "");
                      setNickname(userProfile?.nickname || "");
                      setAge(userProfile?.age || "");
                      setGender(userProfile?.gender || "");
                      setHeightFeet(userProfile?.heightFeet || "");
                      setHeightInches(userProfile?.heightInches || "");
                      setProfileWeight(userProfile?.weight || "");
                      setFitnessLevel(userProfile?.fitnessLevel || "");
                      setWorkoutFrequency(userProfile?.workoutFrequency || "");
                      setProfileInjuries(userProfile?.injuries || "");
                      setProfileGoalsText(userProfile?.goals || (Array.isArray(userProfile?.fitnessGoals) ? userProfile.fitnessGoals.join(", ") : ""));
                      setProfileReasonText(userProfile?.reason || (Array.isArray(userProfile?.appSeeking) ? userProfile.appSeeking.join(", ") : (userProfile?.appSeeking || "")));
                      setIsEditing(false);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#000000",
                      border: `2px solid ${t.accent}`,
                      borderRadius: "8px",
                      color: t.accent,
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ 
                  color: "#fff", 
                  lineHeight: "1.6",
                  marginBottom: "1rem"
                }}>
                  {bio || "No bio yet. Click Edit to add one!"}
                </p>


                {/* Always show all identity fields, never collapsed */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  marginBottom: "1.5rem",
                  background: t.shadowXxs,
                  padding: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${t.shadowXs}`
                }}>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>AGE</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.age || "-"}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>GENDER</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.gender || "-"}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>HEIGHT</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{(userProfile?.heightFeet || "-") + "' " + (userProfile?.heightInches || "-") + '"'}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>WEIGHT (LBS)</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.weight || "-"}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>FITNESS LEVEL</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.fitnessLevel || "-"}</span>
                  </div>
                  <div>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>DAYS/WEEK</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.workoutFrequency || "-"}</span>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>INJURIES / LIMITATIONS</span><br />
                    <span style={{ color: "#fff", fontSize: "1rem", fontWeight: "bold" }}>{userProfile?.injuries || "-"}</span>
                  </div>
                </div>

                {(userProfile?.goals || (Array.isArray(userProfile?.fitnessGoals) && userProfile.fitnessGoals.length > 0)) && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ color: t.accent, fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive", marginBottom: "0.5rem" }}>GOALS</div>
                    <div style={{ background: t.hoverBg, padding: "10px", borderRadius: "8px", border: `1px solid ${t.shadowXs}`, color: "#fff", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {userProfile?.goals || (Array.isArray(userProfile?.fitnessGoals) ? userProfile.fitnessGoals.join(", ") : "")}
                    </div>
                  </div>
                )}
                {(userProfile?.reason || (Array.isArray(userProfile?.appSeeking) && userProfile.appSeeking.length > 0) || userProfile?.appSeeking) && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ color: t.accent, fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive", marginBottom: "0.5rem" }}>REASON FOR JOINING RIVALIS</div>
                    <div style={{ background: t.hoverBg, padding: "10px", borderRadius: "8px", border: `1px solid ${t.shadowXs}`, color: "#fff", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      {userProfile?.reason || (Array.isArray(userProfile?.appSeeking) ? userProfile.appSeeking.join(", ") : (userProfile?.appSeeking || ""))}
                    </div>
                  </div>
                )}

                {(Boolean(userProfile?.goals) || Boolean(userProfile?.reason) || fitnessGoals.length > 0 || appSeeking.length > 0) && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))",
                    border: `1px solid ${t.accent}`,
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "1.5rem",
                    position: "relative",
                    overflow: "hidden"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ color: t.accent, fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive" }}>AI TRAINING PLAN</div>
                      {isPro && <span style={{
                        background: `linear-gradient(135deg, ${t.accent}, ${t.shadowMd || t.accent})`,
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "7px",
                        fontWeight: "bold",
                        fontFamily: "'Press Start 2P', cursive",
                        letterSpacing: "1px"
                      }}>PRO</span>}
                    </div>

                    {aiPlanLoading ? (
                      <div style={{ textAlign: "center", padding: "20px" }}>
                        <div style={{ color: t.accent, fontSize: "0.7rem", fontFamily: "'Press Start 2P', cursive", marginBottom: "8px" }}>GENERATING PLAN...</div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>Analyzing your goals and building your protocol</div>
                      </div>
                    ) : aiPlan ? (
                      <div>
                        <div style={{
                          position: "relative",
                          maxHeight: showFullPlan ? "none" : (isPro ? "none" : "200px"),
                          overflow: "hidden"
                        }}>
                          <div style={{
                            color: "rgba(255,255,255,0.85)",
                            fontSize: "13px",
                            lineHeight: "1.7",
                            whiteSpace: "pre-wrap"
                          }}>
                            {aiPlan.split(/\*\*(.*?)\*\*/).map((part, i) =>
                              i % 2 === 1
                                ? <strong key={i} style={{ color: t.accent, display: "block", marginTop: "10px", marginBottom: "4px", fontSize: "12px" }}>{part}</strong>
                                : <span key={i}>{part}</span>
                            )}
                          </div>
                          {!isPro && !showFullPlan && (
                            <div style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              height: "80px",
                              background: "linear-gradient(transparent, rgba(0,0,0,0.95))"
                            }} />
                          )}
                        </div>
                        {!isPro && (
                          <div style={{
                            marginTop: "16px",
                            background: "linear-gradient(135deg, rgba(255,0,0,0.08), rgba(255,50,50,0.04))",
                            border: `1px solid ${t.accent}44`,
                            borderRadius: "12px",
                            padding: "16px",
                            textAlign: "center"
                          }}>
                            <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚡</div>
                            <div style={{
                              color: t.accent,
                              fontSize: "9px",
                              fontFamily: "'Press Start 2P', cursive",
                              marginBottom: "8px",
                              lineHeight: "1.6"
                            }}>
                              THIS IS JUST A PREVIEW
                            </div>
                            <p style={{
                              color: "rgba(255,255,255,0.7)",
                              fontSize: "12px",
                              lineHeight: "1.6",
                              marginBottom: "12px"
                            }}>
                              Your ultimate AI fitness coach, personalized nutrition guide, wellness protocol, and 12-week milestone tracker are waiting for you.
                            </p>
                            <a href="/subscription" style={{
                              display: "inline-block",
                              padding: "10px 24px",
                              background: `linear-gradient(135deg, ${t.accent}, ${t.shadowMd || t.accent})`,
                              border: "none",
                              borderRadius: "8px",
                              color: "#fff",
                              fontSize: "9px",
                              fontFamily: "'Press Start 2P', cursive",
                              textDecoration: "none",
                              cursor: "pointer",
                              boxShadow: `0 0 20px ${t.accent}40`
                            }}>
                              UNLOCK MY FULL PLAN
                            </a>
                          </div>
                        )}
                        <button
                          onClick={generateAiPlan}
                          style={{
                            marginTop: "10px",
                            padding: "6px 12px",
                            background: "transparent",
                            border: `1px solid ${t.accent}`,
                            borderRadius: "6px",
                            color: t.accent,
                            fontSize: "10px",
                            fontFamily: "'Press Start 2P', cursive",
                            cursor: "pointer",
                            width: "100%"
                          }}
                        >
                          REGENERATE PLAN
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "12px" }}>
                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", marginBottom: "12px" }}>
                          Generate a personalized training plan based on your goals{isPro ? "" : " — preview available for free"}
                        </p>
                        <button
                          onClick={generateAiPlan}
                          style={{
                            padding: "8px 20px",
                            background: `linear-gradient(135deg, ${t.accent}, ${t.shadowMd || t.accent})`,
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "10px",
                            fontFamily: "'Press Start 2P', cursive",
                            cursor: "pointer"
                          }}
                        >
                          GENERATE MY PLAN
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#000000",
                    border: `2px solid ${t.accent}`,
                    borderRadius: "8px",
                    color: t.accent,
                    fontWeight: "bold",
                    cursor: "pointer"
                  }}
                >
                  Edit Identity
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${isTinyViewport ? "120px" : (isMobileViewport ? "140px" : "200px")}, 1fr))`,
          gap: isTinyViewport ? "0.6rem" : "1rem",
          marginBottom: "2rem"
        }}>
          <div style={{
            background: t.shadowXs,
            border: `2px solid ${t.accent}`,
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: `0 0 20px ${t.shadowSm}`
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔥</div>
            <div style={{ color: t.accent, fontSize: "2rem", fontWeight: "bold", textShadow: `0 0 10px ${t.shadow}` }}>
              {userProfile?.loginStreak || 0}
            </div>
            <div style={{ color: "#fff", fontSize: "0.9rem" }}>Login Streak</div>
          </div>

          <div style={{
            background: t.shadowXs,
            border: `2px solid ${t.accent}`,
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: `0 0 20px ${t.shadowSm}`
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⭐</div>
            <div style={{ color: t.accent, fontSize: "2rem", fontWeight: "bold", textShadow: `0 0 10px ${t.shadow}` }}>
              {userProfile?.longestLoginStreak || 0}
            </div>
            <div style={{ color: "#fff", fontSize: "0.9rem" }}>Best Login Streak</div>
          </div>

          <div style={{
            background: t.shadowXs,
            border: `2px solid ${t.accent}`,
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: `0 0 20px ${t.shadowSm}`
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💪</div>
            <div style={{ color: t.accent, fontSize: "2rem", fontWeight: "bold", textShadow: `0 0 10px ${t.shadow}` }}>
              {totalReps}
            </div>
            <div style={{ color: "#fff", fontSize: "0.9rem" }}>Total Reps</div>
          </div>

          <div style={{
            background: t.shadowXs,
            border: `2px solid ${t.accent}`,
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: `0 0 20px ${t.shadowSm}`
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🏃</div>
            <div style={{ color: t.accent, fontSize: "2rem", fontWeight: "bold", textShadow: `0 0 10px ${t.shadow}` }}>
              {totalMiles.toFixed(1)}
            </div>
            <div style={{ color: "#fff", fontSize: "0.9rem" }}>Total Miles</div>
          </div>

          <div style={{
            background: t.shadowXs,
            border: `2px solid ${t.accent}`,
            borderRadius: "12px",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: `0 0 20px ${t.shadowSm}`
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎟️</div>
            <div style={{ color: t.accent, fontSize: "2rem", fontWeight: "bold", textShadow: `0 0 10px ${t.shadow}` }}>
              {ticketBalance}
            </div>
            <div style={{ color: "#fff", fontSize: "0.9rem" }}>Ticket Balance</div>
          </div>
        </div>

        {userProfile?.activeTicketRefs?.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ color: t.accent, marginBottom: "1rem" }}>🎟️ Active Ticket References</h3>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: `repeat(auto-fill, minmax(${isTinyViewport ? "120px" : "150px"}, 1fr))`, 
              gap: "0.5rem",
              maxHeight: "200px",
              overflowY: "auto",
              padding: "1rem",
              background: t.shadowXxs,
              borderRadius: "8px",
              border: `1px solid ${t.shadowXs}`
            }}>
              {userProfile.activeTicketRefs.map((ref, idx) => (
                <div key={idx} style={{ 
                  color: "#fff", 
                  fontSize: "0.8rem", 
                  fontFamily: "monospace",
                  background: "rgba(0,0,0,0.5)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  textAlign: "center",
                  border: `1px solid ${t.shadowSm}`
                }}>
                  {ref}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{
          marginTop: "2rem",
          padding: "1.5rem",
          background: t.shadowXxs,
          border: `1px solid ${t.accent}`,
          borderRadius: "12px",
          marginBottom: "2rem"
        }}>
          <h3 style={{ color: t.accent, marginBottom: "1rem", fontFamily: "'Press Start 2P', cursive", fontSize: "0.8rem" }}>WORKOUT BUDDIES</h3>
          
          <div style={{ display: "flex", gap: "10px", marginBottom: "1.5rem" }}>
            <input 
              type="text" 
              placeholder="Enter friend's email..." 
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              style={{ flex: 1, padding: "8px", background: "#000", border: `1px solid ${t.accent}`, color: "#fff", borderRadius: "4px" }}
            />
            <button onClick={handleSendFriendRequest} style={{ background: t.accent, color: "#fff", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}>Add Buddy</button>
          </div>

          <div style={{ marginBottom: "1.5rem", padding: "10px", background: t.shadowXs, borderRadius: "8px", border: `1px dashed ${t.accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "#fff" }}>LOOKING FOR BUDDY?</span>
              <button 
                onClick={handleToggleLooking}
                style={{ 
                  background: lookingForBuddy ? "#4CAF50" : "#333", 
                  color: "#fff", 
                  border: "none", 
                  padding: "4px 12px", 
                  borderRadius: "20px",
                  fontSize: "0.6rem",
                  cursor: "pointer"
                }}
              >
                {lookingForBuddy ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          {potentialBuddies.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <h4 style={{ color: t.accent, fontSize: "0.7rem", marginBottom: "0.5rem" }}>DISCOVER BUDDIES</h4>
              <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "10px" }}>
                {potentialBuddies.filter(b => b.userId !== user.uid).map(buddy => (
                  <div key={buddy.userId} style={{ minWidth: "80px", textAlign: "center", background: "#111", padding: "8px", borderRadius: "8px" }}>
                    <img src={buddy.avatarURL} style={{ width: "40px", height: "40px", borderRadius: "50%" }} />
                    <div style={{ fontSize: "0.5rem", color: "#fff", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden" }}>{buddy.nickname}</div>
                    <button 
                      onClick={() => { setSearchEmail(buddy.email); handleSendFriendRequest(); }}
                      style={{ background: t.accent, border: "none", color: "#fff", fontSize: "0.5rem", padding: "2px 6px", borderRadius: "4px", marginTop: "4px" }}
                    >Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingRequests.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h4 style={{ color: t.accent, fontSize: "0.7rem", marginBottom: "0.5rem" }}>PENDING REQUESTS</h4>
              {pendingRequests.map(req => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", background: "#111", padding: "10px", marginBottom: "5px", borderRadius: "4px" }}>
                  <span>Request from {req.from}</span>
                  <button onClick={() => handleAcceptRequest(req.id)} style={{ background: "#4CAF50", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "4px" }}>Accept</button>
                </div>
              ))}
            </div>
          )}

          <h4 style={{ color: t.accent, fontSize: "0.7rem", marginBottom: "0.5rem" }}>YOUR BUDDIES</h4>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isTinyViewport ? "84px" : "100px"}, 1fr))`, gap: isTinyViewport ? "0.6rem" : "1rem" }}>
            {friends.map(friend => (
              <div key={friend.userId} style={{ textAlign: "center" }}>
                <img src={friend.avatarURL} alt={friend.nickname} style={{ width: "50px", height: "50px", borderRadius: "50%", border: `2px solid ${t.accent}` }} />
                <div style={{ fontSize: "0.7rem", marginTop: "5px" }}>{friend.nickname}</div>
              </div>
            ))}
            {friends.length === 0 && <div style={{ fontSize: "0.8rem", color: "#666" }}>No buddies yet.</div>}
          </div>
        </div>

        <div>
          <h3 style={{ 
            color: t.accent,
            textShadow: `0 0 15px ${t.shadow}`,
            marginBottom: "1rem"
          }}>
            🏆 Achievements
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: `repeat(auto-fill, minmax(${isTinyViewport ? "150px" : (isMobileViewport ? "170px" : "250px")}, 1fr))`, 
            gap: isTinyViewport ? "0.8rem" : "1.5rem" 
          }}>
            {defaultAchievements.map(achievement => (
              <div 
                key={achievement.id}
                className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                style={{
                  background: achievement.unlocked ? t.shadowXs : "rgba(255, 255, 255, 0.05)",
                  border: `2px solid ${achievement.unlocked ? t.accent : "#333"}`,
                  borderRadius: "12px",
                  padding: "1.5rem",
                  textAlign: "center",
                  opacity: achievement.unlocked ? 1 : 0.6,
                  transition: "all 0.3s ease",
                  boxShadow: achievement.unlocked ? `0 0 15px ${t.shadowSm}` : "none",
                  filter: achievement.unlocked ? "none" : "grayscale(100%)"
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>{achievement.icon}</div>
                <h4 style={{ color: achievement.unlocked ? t.accent : "#999", marginBottom: "0.5rem", fontSize: "1rem" }}>{achievement.name}</h4>
                <p style={{ fontSize: "0.8rem", color: "#ccc" }}>{achievement.description}</p>
                {!achievement.unlocked && (
                  <div style={{ 
                    marginTop: "1rem", 
                    fontSize: "0.7rem", 
                    color: t.accent,
                    fontFamily: "'Press Start 2P', cursive"
                  }}>
                    LOCKED
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
