import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { LiveService } from "../services/liveService";
import { UserService } from "../services/userService";
import { generateLiveDeck, getCardPoints, getCardReps, TRICK_MODES } from "../logic/liveDeck";
import { processExercise, createStateRefs, resetStateRefs } from "../logic/exerciseEngine";
import PoseVisualizer from "../components/Burnouts/PoseVisualizer";
import GlobalChat from "./GlobalChat";
import { useTheme } from "../context/ThemeContext.jsx";

const SHOWDOWNS = [
  { id: "arms", name: "Arms", category: "Arms", icon: "💪", exercises: ["Push-ups", "Plank Up-Downs", "Pike Push-ups", "Shoulder Taps"] },
  { id: "legs", name: "Legs", category: "Legs", icon: "🦵", exercises: ["Squats", "Lunges", "Glute Bridges", "Calf Raises"] },
  { id: "core", name: "Core", category: "Core", icon: "🔥", exercises: ["Crunches", "Plank", "Russian Twists", "Leg Raises"] },
  { id: "full", name: "Full Body", category: "Full Body", icon: "⚡", exercises: ["Jumping Jacks", "High Knees", "Burpees", "Mountain Climbers"] },
];

export default function Live({ user, userProfile }) {
  const t = useTheme();
  const [phase, setPhase] = useState("select");
  const [selectedShowdown, setSelectedShowdown] = useState(null);
  const [selectedTrickMode, setSelectedTrickMode] = useState("classic");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [myCardIndex, setMyCardIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [cardCompleting, setCardCompleting] = useState(false);
  const [showEffectBanner, setShowEffectBanner] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [matchTime, setMatchTime] = useState(0);
  const [currentReps, setCurrentReps] = useState(0);
  const [poseFeedback, setPoseFeedback] = useState("");
  const [poseState, setPoseState] = useState("IDLE");
  const [cameraActive, setCameraActive] = useState(false);
  const [discordLinkInput, setDiscordLinkInput] = useState("");
  const timerRef = useRef(null);
  const stateRefsRef = useRef(createStateRefs());
  const autoCompleteTriggered = useRef(false);
  const currentRepsRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    const heartbeat = setInterval(() => UserService.updateHeartbeat(user.uid), 60000);
    UserService.updateHeartbeat(user.uid);

    const unsubOnline = UserService.subscribeToOnlineUsers((users) => {
      setOnlineUsers(users.filter((u) => u.userId !== user.uid));
    });

    const unsubRooms = LiveService.subscribeToRooms((rooms) => {
      setActiveRooms(rooms);
    });

    return () => {
      clearInterval(heartbeat);
      unsubOnline();
      unsubRooms();
    };
  }, [user]);

  useEffect(() => {
    if (!currentRoomId) return;
    const unsub = LiveService.subscribeToRoom(currentRoomId, (data) => {
      if (!data) {
        handleQuit();
        return;
      }
      setRoomData(data);
      if (data.currentPhase === "active" && phase !== "match" && phase !== "results") {
        setPhase("match");
        startMatchTimer();
      }
      if (data.currentPhase === "results" && phase !== "results") {
        setPhase("results");
        stopMatchTimer();
      }
      setMyCardIndex(data.currentCardIndex || 0);
    });
    return () => unsub();
  }, [currentRoomId]);

  useEffect(() => {
    if (roomData?.discordVcLink !== undefined && discordLinkInput !== roomData.discordVcLink && !document.activeElement?.placeholder?.includes("Discord")) {
      setDiscordLinkInput(roomData.discordVcLink || "");
    }
  }, [roomData?.discordVcLink]);

  useEffect(() => {
    setCurrentReps(0);
    currentRepsRef.current = 0;
    setPoseFeedback("");
    setPoseState("IDLE");
    resetStateRefs(stateRefsRef.current);
    autoCompleteTriggered.current = false;
  }, [myCardIndex]);

  const startMatchTimer = () => {
    setMatchTime(0);
    timerRef.current = setInterval(() => setMatchTime((t) => t + 1), 1000);
  };
  const stopMatchTimer = () => clearInterval(timerRef.current);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const handleCreateRoom = async () => {
    if (!selectedShowdown) return;
    const res = await LiveService.createRoom(
      user.uid,
      userProfile?.nickname || "Rival",
      userProfile?.avatarURL || "",
      selectedShowdown,
      selectedTrickMode
    );
    if (res.success) {
      setCurrentRoomId(res.roomId);
      setPhase("lobby");
    }
  };

  const handleJoinRoom = async (room) => {
    if (room.players?.length >= (room.maxPlayers || 6)) return;
    const res = await LiveService.joinRoom(room.id, user.uid, userProfile?.nickname || "Rival", userProfile?.avatarURL || "");
    if (res.success) {
      setCurrentRoomId(room.id);
      const showdown = SHOWDOWNS.find((s) => s.category === room.showdown?.category) || SHOWDOWNS[0];
      setSelectedShowdown(showdown);
      setSelectedTrickMode(room.trickMode || "classic");
      setPhase("lobby");
    }
  };

  const handleToggleReady = () => {
    if (!roomData) return;
    const me = roomData.players?.find((p) => p.userId === user.uid);
    LiveService.toggleReady(currentRoomId, user.uid, !me?.ready);
  };

  const handleStartMatch = async () => {
    if (!roomData || roomData.hostId !== user.uid) return;
    const deck = generateLiveDeck(selectedShowdown.category, selectedTrickMode);
    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countInterval);
          LiveService.startMatch(currentRoomId, deck);
          return null;
        }
        return c - 1;
      });
    }, 1000);
  };

  const isMyTurn = () => {
    if (!roomData?.playOrder) return false;
    const currentTurnIndex = roomData.currentTurnIndex || 0;
    return roomData.playOrder[currentTurnIndex] === user.uid;
  };

  const getCurrentTurnPlayer = () => {
    if (!roomData?.playOrder || !roomData?.players) return null;
    const currentTurnIndex = roomData.currentTurnIndex || 0;
    const turnUserId = roomData.playOrder[currentTurnIndex];
    return roomData.players.find((p) => p.userId === turnUserId);
  };

  const processPose = useCallback((landmarks) => {
    if (!roomData?.deck || !isMyTurn() || cardCompleting) return;
    const cardIndex = roomData.currentCardIndex || 0;
    const card = roomData.deck[cardIndex];
    if (!card || !card.exercise || !landmarks) return;

    const me = roomData.players?.find((p) => p.userId === user.uid);
    const targetReps = getCardReps(card, me?.activeEffects || []);

    stateRefsRef.current.currentReps = currentRepsRef.current;
    const exerciseId = card.exercise.toLowerCase().replace(/[\s_-]/g, '');
    const result = processExercise(exerciseId, landmarks, stateRefsRef.current);
    if (!result) return;

    if (result.feedback) setPoseFeedback(result.feedback);
    if (result.state) setPoseState(result.state);

    if (result.repIncrement > 0) {
      setCurrentReps((prev) => {
        const next = prev + result.repIncrement;
        currentRepsRef.current = Math.min(next, targetReps);
        if (next >= targetReps && !autoCompleteTriggered.current) {
          autoCompleteTriggered.current = true;
          setTimeout(() => submitCard(next), 500);
        }
        return Math.min(next, targetReps);
      });
    }
  }, [roomData, cardCompleting, user]);

  const submitCard = async (repsCompleted) => {
    if (cardCompleting || !roomData?.deck || !isMyTurn()) return;
    setCardCompleting(true);

    const cardIndex = roomData.currentCardIndex || 0;
    const card = roomData.deck[cardIndex];
    if (!card) { setCardCompleting(false); return; }

    const me = roomData.players?.find((p) => p.userId === user.uid);
    const targetReps = getCardReps(card, me?.activeEffects || []);
    const actualReps = repsCompleted != null ? repsCompleted : targetReps;
    const points = getCardPoints(card, me?.activeEffects || []);

    let finalPoints = points;
    let jokerEffect = null;

    if (card.type === "joker") {
      jokerEffect = card.effect;
      setShowEffectBanner(card);
      setTimeout(() => setShowEffectBanner(null), 3000);
    } else if (card.type === "trick") {
      if (card.effect === "double_or_nothing") {
        const won = Math.random() > 0.5;
        finalPoints = won ? points : (actualReps * 2);
        const resultCard = { ...card, description: won ? `DOUBLED! +${finalPoints} pts for ${card.displayName}!` : `BUSTED! Base pts only for ${card.displayName}!` };
        setShowEffectBanner(resultCard);
      } else {
        setShowEffectBanner(card);
      }
      setTimeout(() => setShowEffectBanner(null), 3000);
    }

    setIsFlipping(true);
    setTimeout(() => setIsFlipping(false), 600);

    const result = await LiveService.completeCard(currentRoomId, user.uid, actualReps, finalPoints, jokerEffect);
    if (!result.success) {
      console.warn("Card completion failed:", result.error);
    }

    setCardCompleting(false);
  };

  const handleCompleteCard = async () => {
    await submitCard(currentReps);
  };

  const handleQuit = async () => {
    stopMatchTimer();
    if (currentRoomId) await LiveService.leaveRoom(currentRoomId, user.uid);
    setCurrentRoomId(null);
    setRoomData(null);
    setSelectedShowdown(null);
    setPhase("select");
    setMyCardIndex(0);
    setMatchTime(0);
  };

  const handlePlayAgain = () => {
    if (currentRoomId) LiveService.deleteRoom(currentRoomId);
    setCurrentRoomId(null);
    setRoomData(null);
    setPhase("select");
    setMyCardIndex(0);
    setMatchTime(0);
  };

  if (phase === "results" && roomData) return <ResultsScreen roomData={roomData} user={user} t={t} onPlayAgain={handlePlayAgain} onQuit={handleQuit} matchTime={matchTime} formatTime={formatTime} />;

  if (phase === "match" && roomData) {
    const sharedCardIndex = roomData.currentCardIndex || 0;
    const currentCard = roomData.deck?.[sharedCardIndex];
    const me = roomData.players?.find((p) => p.userId === user.uid);
    const isFinished = sharedCardIndex >= (roomData.deck?.length || 0);
    const progress = roomData.deck?.length ? Math.round((sharedCardIndex / roomData.deck.length) * 100) : 0;
    const myTurn = isMyTurn();
    const turnPlayer = getCurrentTurnPlayer();

    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)", color: "#fff", display: "flex", flexDirection: "column" }}>
        {showEffectBanner && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
            background: showEffectBanner.color || t.accent, color: "#000",
            padding: "16px", textAlign: "center", fontFamily: "'Press Start 2P', cursive",
            fontSize: "12px", animation: "slideDown 0.3s ease-out",
            boxShadow: `0 4px 30px ${showEffectBanner.color || t.accent}80`
          }}>
            {showEffectBanner.icon} {showEffectBanner.name} — {showEffectBanner.description}
          </div>
        )}

        {countdown && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "80px", color: t.accent, textShadow: `0 0 40px ${t.accent}`, animation: "pulse 1s infinite" }}>
              {countdown}
            </div>
          </div>
        )}

        <div style={{
          padding: "12px 20px", background: "rgba(0,0,0,0.8)",
          borderBottom: `1px solid ${t.accent}22`,
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ background: t.accent, color: "#fff", padding: "4px 12px", borderRadius: "4px", fontFamily: "'Press Start 2P', cursive", fontSize: "9px" }}>
              {roomData.showdown?.name?.toUpperCase()}
            </span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>{formatTime(matchTime)}</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px" }}>Card {sharedCardIndex + 1}/{roomData.deck?.length}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {roomData.discordVcLink && (
              <a href={roomData.discordVcLink} target="_blank" rel="noopener noreferrer" style={{
                background: "#5865F2", color: "#fff", padding: "6px 12px", borderRadius: "6px",
                fontFamily: "'Press Start 2P', cursive", fontSize: "7px", cursor: "pointer",
                textDecoration: "none", display: "flex", alignItems: "center", gap: "4px"
              }}>
                🎙️ VC
              </a>
            )}
            <button onClick={handleQuit} style={{ background: "transparent", border: `1px solid ${t.accent}`, color: t.accent, padding: "6px 16px", borderRadius: "6px", fontFamily: "'Press Start 2P', cursive", fontSize: "8px", cursor: "pointer" }}>
              EXIT
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: "3px", background: "rgba(255,255,255,0.05)" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${t.accent}, #FFD700)`, transition: "width 0.5s" }} />
        </div>

        <div style={{
          padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
          background: myTurn ? `${t.accent}15` : "rgba(255,255,255,0.03)",
          borderBottom: `1px solid ${myTurn ? t.accent + "30" : "rgba(255,255,255,0.05)"}`,
        }}>
          {!isFinished && (
            myTurn ? (
              <>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 10px #00ff88", animation: "pulse 1s infinite" }} />
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: "#00ff88" }}>YOUR TURN</span>
              </>
            ) : (
              <>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFD700", animation: "pulse 1s infinite" }} />
                {turnPlayer?.avatar && (
                  <img src={turnPlayer.avatar} alt="" style={{ width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #FFD700" }} />
                )}
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>
                  {turnPlayer?.userName || "Rival"}'s turn
                </span>
              </>
            )
          )}
        </div>

        <div style={{ flex: 1, display: "flex", padding: "16px", gap: "16px", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              display: (isFinished || !myTurn) ? "none" : "block",
              pointerEvents: (isFinished || !myTurn) ? "none" : "auto"
            }}>
              <div style={{
                position: "relative", width: "100%", maxWidth: "600px", margin: "0 auto",
                aspectRatio: "4/3", borderRadius: "16px", overflow: "hidden",
                border: `2px solid ${t.accent}40`, background: "#000"
              }}>
                <PoseVisualizer onPoseResults={processPose} currentExercise={currentCard?.exercise} />
                {currentCard && (
                  <>
                    <div style={{
                      position: "absolute", top: "10px", left: "10px", right: "10px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start", zIndex: 20
                    }}>
                      <div style={{
                        background: "rgba(0,0,0,0.75)", borderRadius: "10px", padding: "8px 12px",
                        backdropFilter: "blur(8px)"
                      }}>
                        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "8px", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>
                          {currentCard.displayName}
                        </div>
                        <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "22px", color: "#fff" }}>
                          {currentReps}/{getCardReps(currentCard, me?.activeEffects || [])}
                        </div>
                      </div>
                      {(currentCard.type === "joker" || currentCard.type === "trick") && (
                        <div style={{
                          background: `${currentCard.color}dd`, borderRadius: "8px", padding: "6px 10px",
                          display: "flex", alignItems: "center", gap: "6px"
                        }}>
                          <span style={{ fontSize: "14px" }}>{currentCard.icon}</span>
                          <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "7px", color: "#fff" }}>{currentCard.name}</span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      position: "absolute", bottom: "10px", left: "10px", right: "10px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 20
                    }}>
                      <div style={{
                        background: "rgba(0,0,0,0.75)", borderRadius: "8px", padding: "6px 10px",
                        backdropFilter: "blur(8px)"
                      }}>
                        <div style={{
                          fontFamily: "'Press Start 2P', cursive", fontSize: "8px",
                          color: poseState === "UP" || poseState === "STAND" || poseState === "OPEN" ? "#00ff88" : poseState === "DOWN" || poseState === "PLANK" || poseState === "CLOSED" ? "#ff4444" : "rgba(255,255,255,0.6)"
                        }}>
                          {poseFeedback || "Position yourself"}
                        </div>
                      </div>
                      {currentCard.type === "exercise" && currentCard.suit && (
                        <div style={{
                          background: "rgba(0,0,0,0.75)", borderRadius: "8px", padding: "6px 10px",
                          backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: "4px"
                        }}>
                          <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "12px", color: currentCard.suitColor || "#fff" }}>
                            {currentCard.face}{currentCard.suit}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: "rgba(0,0,0,0.5)", zIndex: 20
                    }}>
                      <div style={{
                        width: `${Math.min(100, (currentReps / Math.max(1, getCardReps(currentCard, me?.activeEffects || []))) * 100)}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${t.accent}, #00ff88)`,
                        transition: "width 0.3s",
                        boxShadow: `0 0 10px ${t.accent}`
                      }} />
                    </div>
                  </>
                )}
              </div>
              {currentCard && (
                <div style={{ width: "100%", maxWidth: "600px", margin: "12px auto 0" }}>
                  <button
                    onClick={handleCompleteCard}
                    disabled={cardCompleting}
                    style={{
                      width: "100%", padding: "14px",
                      background: currentReps >= getCardReps(currentCard, me?.activeEffects || [])
                        ? "linear-gradient(135deg, #00ff88, #00cc6a)"
                        : `linear-gradient(135deg, ${t.accent}80, ${t.accent}50)`,
                      color: "#fff", border: "none", borderRadius: "12px",
                      fontFamily: "'Press Start 2P', cursive", fontSize: "9px",
                      cursor: cardCompleting ? "wait" : "pointer",
                      opacity: cardCompleting ? 0.6 : 1,
                      transition: "all 0.2s"
                    }}
                  >
                    {cardCompleting ? "SUBMITTING..." : currentReps >= getCardReps(currentCard, me?.activeEffects || []) ? "REPS DONE! NEXT CARD ✓" : `SKIP (${currentReps}/${getCardReps(currentCard, me?.activeEffects || [])} reps)`}
                  </button>
                </div>
              )}
            </div>

            {isFinished ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏁</div>
                <h2 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "20px", marginBottom: "8px", color: t.accent }}>DECK COMPLETE!</h2>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>Match is over!</p>
                <div style={{ marginTop: "16px", fontFamily: "'Press Start 2P', cursive", fontSize: "24px", color: "#FFD700" }}>{me?.score || 0} PTS</div>
              </div>
            ) : !myTurn && currentCard ? (
              <div style={{
                width: "100%", maxWidth: "600px", padding: "40px 20px",
                background: "rgba(255,255,255,0.03)", borderRadius: "16px",
                border: "1px solid rgba(255,255,255,0.06)", textAlign: "center"
              }}>
                {turnPlayer?.avatar && (
                  <img src={turnPlayer.avatar} alt="" style={{
                    width: "56px", height: "56px", borderRadius: "50%",
                    border: `2px solid ${t.accent}`, margin: "0 auto 12px",
                    display: "block", boxShadow: `0 0 15px ${t.accent}30`
                  }} />
                )}
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>
                  {currentCard.type === "exercise" ? currentCard.suit : currentCard.icon}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "12px", color: "#fff", marginBottom: "6px" }}>
                  {currentCard.displayName}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "28px", color: t.accent, marginBottom: "6px" }}>
                  {getCardReps(currentCard, me?.activeEffects || [])} REPS
                </div>
                {(currentCard.type === "joker" || currentCard.type === "trick") && (
                  <div style={{ fontSize: "9px", color: currentCard.color, marginTop: "8px" }}>
                    {currentCard.icon} {currentCard.name}
                  </div>
                )}
                <div style={{
                  marginTop: "20px", padding: "14px",
                  background: "rgba(255,255,255,0.05)", borderRadius: "12px",
                  fontFamily: "'Press Start 2P', cursive", fontSize: "9px",
                  color: "#FFD700", border: "1px solid rgba(255,215,0,0.15)"
                }}>
                  ⏳ {turnPlayer?.userName || "Rival"} is performing...
                </div>
              </div>
            ) : null}
          </div>

          <div style={{
            width: "260px", background: "rgba(0,0,0,0.5)", borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px", color: t.accent, margin: 0 }}>SCOREBOARD</h3>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {[...(roomData.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p, i) => (
                <div key={p.userId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px", marginBottom: "6px",
                  background: p.userId === user.uid ? `${t.accent}15` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${p.userId === user.uid ? t.accent + "30" : "transparent"}`
                }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "6px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.1)",
                    color: i < 3 ? "#000" : "#fff",
                    fontFamily: "'Press Start 2P', cursive", fontSize: "9px", fontWeight: "bold"
                  }}>{i + 1}</div>
                  {p.avatar ? (
                    <img src={p.avatar} alt="" style={{ width: "28px", height: "28px", borderRadius: "6px" }} />
                  ) : (
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "#333" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                      {p.userName}{p.userId === user.uid ? " (You)" : ""}
                      {turnPlayer?.userId === p.userId && !isFinished && (
                        <span style={{ fontSize: "7px", background: "#00ff88", color: "#000", padding: "1px 4px", borderRadius: "3px", fontFamily: "'Press Start 2P', cursive" }}>TURN</span>
                      )}
                    </div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>
                      {p.completedCards || 0} cards · {p.totalReps || 0} reps
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "11px", color: i === 0 ? "#FFD700" : "#fff" }}>
                    {p.score || 0}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>YOUR REPS</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: t.accent }}>{me?.totalReps || 0}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}>TICKETS</span>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "#FFD700" }}>🎟️ {me?.ticketsEarned || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
          @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        `}</style>
      </div>
    );
  }

  if (phase === "lobby" && roomData) {
    const me = roomData.players?.find((p) => p.userId === user.uid);
    const allReady = roomData.players?.every((p) => p.ready);
    const isHost = roomData.hostId === user.uid;
    const modeInfo = TRICK_MODES.find((m) => m.id === roomData.trickMode) || TRICK_MODES[0];

    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)", color: "#fff", display: "flex", flexDirection: "column" }}>
        {countdown && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.95)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "14px", color: "rgba(255,255,255,0.5)", marginBottom: "24px" }}>MATCH STARTING IN</div>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "80px", color: t.accent, textShadow: `0 0 60px ${t.accent}`, animation: "pulse 1s infinite" }}>
              {countdown}
            </div>
          </div>
        )}

        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <h1 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "16px", color: t.accent, margin: 0 }}>ARENA LOBBY</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", margin: "4px 0 0", fontFamily: "'Press Start 2P', cursive" }}>{roomData.roomName}</p>
          </div>
          <button onClick={handleQuit} style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.2)`, color: "rgba(255,255,255,0.6)", padding: "8px 20px", borderRadius: "8px", fontFamily: "'Press Start 2P', cursive", fontSize: "9px", cursor: "pointer" }}>
            LEAVE
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", padding: "24px", gap: "24px", overflow: "auto" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <div style={{ flex: 1, padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive", marginBottom: "8px" }}>SHOWDOWN</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>{SHOWDOWNS.find((s) => s.category === roomData.showdown?.category)?.icon || "⚔️"}</span>
                  <div>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "14px", color: "#fff" }}>{roomData.showdown?.name}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{roomData.showdown?.category}</div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive", marginBottom: "8px" }}>GAME MODE</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>{modeInfo.icon}</span>
                  <div>
                    <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "12px", color: "#fff" }}>{modeInfo.name}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{modeInfo.description}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive", marginBottom: "16px" }}>
                CONTENDERS ({roomData.players?.length || 0}/{roomData.maxPlayers || 6})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                {roomData.players?.map((p) => (
                  <div key={p.userId} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "14px 16px", borderRadius: "12px",
                    background: p.ready ? `${t.accent}10` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${p.ready ? t.accent + "40" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.3s"
                  }}>
                    {p.avatar ? (
                      <img src={p.avatar} alt="" style={{ width: "40px", height: "40px", borderRadius: "10px", border: `2px solid ${p.ready ? t.accent : "#333"}` }} />
                    ) : (
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#222", border: `2px solid ${p.ready ? t.accent : "#333"}` }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: "#fff" }}>
                        {p.userName}{p.userId === user.uid ? " (You)" : ""}
                      </div>
                      <div style={{ fontSize: "10px", color: p.ready ? "#0f0" : "#ff0", marginTop: "4px" }}>
                        {p.ready ? "✅ READY" : "⏳ NOT READY"}
                      </div>
                    </div>
                    {p.userId === roomData.hostId && (
                      <span style={{ fontSize: "8px", color: "#FFD700", fontFamily: "'Press Start 2P', cursive", background: "rgba(255,215,0,0.1)", padding: "4px 8px", borderRadius: "4px" }}>HOST</span>
                    )}
                  </div>
                ))}
                {Array.from({ length: (roomData.maxPlayers || 6) - (roomData.players?.length || 0) }).map((_, i) => (
                  <div key={`empty-${i}`} style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "14px 16px", borderRadius: "12px",
                    border: "2px dashed rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.15)", fontSize: "11px"
                  }}>
                    Waiting for rival...
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px" }}>🎙️</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive" }}>DISCORD VOICE CHAT</span>
              </div>
              {isHost ? (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Paste Discord invite link..."
                    value={discordLinkInput}
                    onChange={(e) => setDiscordLinkInput(e.target.value)}
                    onBlur={() => LiveService.setDiscordLink(currentRoomId, discordLinkInput)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); } }}
                    style={{
                      flex: 1, padding: "10px 14px", background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                      color: "#fff", fontSize: "10px", outline: "none"
                    }}
                  />
                </div>
              ) : roomData.discordVcLink ? (
                <a
                  href={roomData.discordVcLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "12px 20px", background: "linear-gradient(135deg, #5865F2, #4752C4)",
                    color: "#fff", border: "none", borderRadius: "10px",
                    fontFamily: "'Press Start 2P', cursive", fontSize: "9px",
                    textDecoration: "none", cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(88,101,242,0.3)"
                  }}
                >
                  🎙️ JOIN DISCORD VC
                </a>
              ) : (
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                  Waiting for host to share Discord link...
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button onClick={handleToggleReady} style={{
                flex: 1, padding: "16px 24px",
                background: me?.ready ? "linear-gradient(135deg, #0f0 0%, #0a0 100%)" : `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
                color: me?.ready ? "#000" : "#fff",
                border: "none", borderRadius: "12px",
                fontFamily: "'Press Start 2P', cursive", fontSize: "11px", cursor: "pointer",
                boxShadow: me?.ready ? "0 0 20px rgba(0,255,0,0.2)" : `0 0 20px ${t.accent}30`
              }}>
                {me?.ready ? "✓ READY!" : "READY UP"}
              </button>
              {isHost && (
                <button onClick={handleStartMatch} disabled={!allReady || (roomData.players?.length || 0) < 2} style={{
                  flex: 1, padding: "16px 24px",
                  background: allReady && (roomData.players?.length || 0) >= 2 ? "#fff" : "rgba(255,255,255,0.05)",
                  color: allReady && (roomData.players?.length || 0) >= 2 ? "#000" : "rgba(255,255,255,0.3)",
                  border: "none", borderRadius: "12px",
                  fontFamily: "'Press Start 2P', cursive", fontSize: "11px",
                  cursor: allReady && (roomData.players?.length || 0) >= 2 ? "pointer" : "not-allowed"
                }}>
                  START MATCH
                </button>
              )}
            </div>

            <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'Press Start 2P', cursive", marginBottom: "8px" }}>ROOM CODE</div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <code style={{ flex: 1, fontSize: "11px", color: t.accent, background: "rgba(0,0,0,0.4)", padding: "10px 14px", borderRadius: "8px", letterSpacing: "1px", wordBreak: "break-all" }}>
                  {currentRoomId}
                </code>
                <button onClick={() => navigator.clipboard.writeText(currentRoomId)} style={{
                  padding: "10px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px", color: "#fff", fontSize: "10px", cursor: "pointer"
                }}>
                  COPY
                </button>
              </div>
            </div>
          </div>

          <div style={{
            width: "300px", background: "rgba(0,0,0,0.4)", borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", display: "flex", flexDirection: "column"
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "6px", height: "6px", background: t.accent, borderRadius: "50%", boxShadow: `0 0 8px ${t.accent}` }} />
              <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "9px", color: "#fff" }}>LOBBY CHAT</span>
            </div>
            <div style={{ flex: 1 }}>
              <GlobalChat user={user} userProfile={userProfile} hideNavbar={true} roomId={currentRoomId || "live-lobby"} />
            </div>
          </div>
        </div>

        <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)", color: "#fff" }}>
      <div style={{ padding: "32px 24px 16px" }}>
        <h1 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "22px", color: t.accent, marginBottom: "6px", textShadow: `0 0 20px ${t.accent}40` }}>LIVE ARENA</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Challenge rivals in real-time showdowns. Pick your battle, set the rules, dominate.</p>
      </div>

      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: "'Press Start 2P', cursive", marginBottom: "16px" }}>1. CHOOSE YOUR SHOWDOWN</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          {SHOWDOWNS.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedShowdown(s)}
              style={{
                padding: "24px", borderRadius: "16px",
                background: selectedShowdown?.id === s.id ? `${t.accent}15` : "rgba(255,255,255,0.03)",
                border: `2px solid ${selectedShowdown?.id === s.id ? t.accent : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer", transition: "all 0.3s",
                boxShadow: selectedShowdown?.id === s.id ? `0 0 30px ${t.accent}15` : "none"
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>{s.icon}</div>
              <h3 style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "14px", color: selectedShowdown?.id === s.id ? t.accent : "#fff", marginBottom: "8px" }}>{s.name}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {s.exercises.map((ex) => (
                  <span key={ex} style={{ background: "rgba(255,255,255,0.05)", padding: "3px 8px", borderRadius: "12px", fontSize: "10px", color: "rgba(255,255,255,0.5)" }}>{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: "'Press Start 2P', cursive", marginBottom: "16px" }}>2. SELECT GAME MODE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {TRICK_MODES.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelectedTrickMode(m.id)}
              style={{
                padding: "16px 20px", borderRadius: "12px",
                background: selectedTrickMode === m.id ? `${t.accent}15` : "rgba(255,255,255,0.02)",
                border: `2px solid ${selectedTrickMode === m.id ? t.accent : "rgba(255,255,255,0.04)"}`,
                cursor: "pointer", transition: "all 0.3s"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px" }}>{m.icon}</span>
                <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: selectedTrickMode === m.id ? t.accent : "#fff" }}>{m.name}</span>
              </div>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: "1.5" }}>{m.description}</p>
              {m.jokerCount > 0 && (
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <span style={{ fontSize: "9px", color: "#FFD700", background: "rgba(255,215,0,0.1)", padding: "2px 6px", borderRadius: "4px" }}>🃏 {m.jokerCount}</span>
                  <span style={{ fontSize: "9px", color: "#9b59b6", background: "rgba(155,89,182,0.1)", padding: "2px 6px", borderRadius: "4px" }}>⚡ {m.trickCount}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleCreateRoom}
          disabled={!selectedShowdown}
          style={{
            width: "100%", maxWidth: "400px", padding: "18px",
            background: selectedShowdown ? `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)` : "rgba(255,255,255,0.05)",
            color: selectedShowdown ? "#fff" : "rgba(255,255,255,0.3)",
            border: "none", borderRadius: "14px",
            fontFamily: "'Press Start 2P', cursive", fontSize: "13px",
            cursor: selectedShowdown ? "pointer" : "not-allowed",
            boxShadow: selectedShowdown ? `0 8px 30px ${t.accent}40` : "none",
            display: "block", margin: "0 auto 40px",
            transition: "all 0.3s"
          }}
        >
          CREATE MATCH
        </button>

        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: "'Press Start 2P', cursive", marginBottom: "16px" }}>
          OPEN ARENAS ({activeRooms.length})
        </div>
        {activeRooms.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", border: "2px dashed rgba(255,255,255,0.05)", borderRadius: "16px" }}>
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", fontFamily: "'Press Start 2P', cursive" }}>NO OPEN MATCHES. BE THE FIRST.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {activeRooms.map((room) => {
              const mInfo = TRICK_MODES.find((m) => m.id === room.trickMode) || TRICK_MODES[0];
              return (
                <div key={room.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: "14px",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ position: "relative" }}>
                      {room.hostAvatar ? (
                        <img src={room.hostAvatar} alt="" style={{ width: "44px", height: "44px", borderRadius: "10px", border: `2px solid ${t.accent}40` }} />
                      ) : (
                        <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
                          {SHOWDOWNS.find((s) => s.category === room.showdown?.category)?.icon || "⚔️"}
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: "-2px", right: "-2px",
                        width: "16px", height: "16px", borderRadius: "4px",
                        background: "#FFD700", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "8px", border: "1px solid #000"
                      }}>👑</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: "#fff", marginBottom: "4px" }}>{room.roomName}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                        {room.hostName} · {mInfo.icon} {mInfo.name} · {room.players?.length || 0}/{room.maxPlayers || 6} players
                      </div>
                      <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
                        {room.players?.slice(0, 6).map((p) => (
                          p.avatar ? (
                            <img key={p.userId} src={p.avatar} alt="" style={{ width: "18px", height: "18px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }} />
                          ) : (
                            <div key={p.userId} style={{ width: "18px", height: "18px", borderRadius: "4px", background: "#333" }} />
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room)}
                    disabled={room.players?.length >= (room.maxPlayers || 6)}
                    style={{
                      padding: "10px 20px",
                      background: room.players?.length >= (room.maxPlayers || 6) ? "rgba(255,255,255,0.05)" : t.accent,
                      color: room.players?.length >= (room.maxPlayers || 6) ? "rgba(255,255,255,0.3)" : "#fff",
                      border: "none", borderRadius: "8px",
                      fontFamily: "'Press Start 2P', cursive", fontSize: "9px",
                      cursor: room.players?.length >= (room.maxPlayers || 6) ? "not-allowed" : "pointer"
                    }}
                  >
                    {room.players?.length >= (room.maxPlayers || 6) ? "FULL" : "JOIN"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "32px" }}>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontFamily: "'Press Start 2P', cursive", marginBottom: "16px" }}>
            RIVALS ONLINE ({onlineUsers.length})
          </div>
          <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
            {onlineUsers.length === 0 ? (
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", fontFamily: "'Press Start 2P', cursive" }}>No rivals active</span>
            ) : onlineUsers.map((u) => (
              <div key={u.userId} style={{ textAlign: "center", flexShrink: 0 }}>
                {u.avatarURL ? (
                  <img src={u.avatarURL} alt="" style={{ width: "44px", height: "44px", borderRadius: "10px", border: `2px solid ${t.accent}30` }} />
                ) : (
                  <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#222" }} />
                )}
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)", marginTop: "4px", maxWidth: "50px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.nickname || u.userName || "Rival"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import LiveSocialShareModal, { animateAndShareRivalisVS } from "./LiveSocialShareModal";

function ResultsScreen({ roomData, user, t, onPlayAgain, onQuit, matchTime, formatTime }) {
  const sortedPlayers = [...(roomData.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
  const winner = sortedPlayers[0];
  const me = sortedPlayers.find((p) => p.userId === user.uid);
  const myRank = sortedPlayers.findIndex((p) => p.userId === user.uid) + 1;
  const isWinner = winner?.userId === user.uid;
  const [showShare, setShowShare] = React.useState(false);
  const [shared, setShared] = React.useState(false);

  // Prepare VS results for animation
  const vsResults = React.useMemo(() => ({
    players: sortedPlayers.map(p => ({
      username: p.userName || "Player",
      reps: p.totalReps || 0
    })),
    mode: roomData.showdown?.name || "Live"
  }), [sortedPlayers, roomData]);

  const handleShare = async () => {
    setShowShare(false);
    const shared = await animateAndShareRivalisVS(vsResults);
    if (shared) {
      setShared(true);
      try {
        await fetch("/api/raffle/award", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.uid, amount: 100, reason: "Live Mode Social Share Bonus" })
        });
        alert("Shared! +100 raffle tickets awarded.");
      } catch (e) {
        alert("Shared! (Demo: 100 tickets awarded)");
      }
    } else {
      alert("Share cancelled. No tickets awarded.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: isWinner
        ? "radial-gradient(circle at 50% 30%, rgba(255,215,0,0.08) 0%, #050505 60%)"
        : "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)",
      color: "#fff", display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 24px"
    }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>
          {isWinner ? "👑" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "💪"}
        </div>
        <h1 style={{
          fontFamily: "'Press Start 2P', cursive", fontSize: "24px",
          color: isWinner ? "#FFD700" : t.accent,
          textShadow: isWinner ? "0 0 30px rgba(255,215,0,0.5)" : `0 0 20px ${t.accent}40`,
          marginBottom: "8px"
        }}>
          {isWinner ? "VICTORY!" : "MATCH OVER"}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
          {roomData.showdown?.name} · {formatTime(matchTime)}
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: "500px", marginBottom: "32px" }}>
        {sortedPlayers.map((p, i) => (
          <div key={p.userId} style={{
            display: "flex", alignItems: "center", gap: "16px",
            padding: "16px 20px", marginBottom: "8px", borderRadius: "14px",
            background: i === 0 ? "rgba(255,215,0,0.08)" : p.userId === user.uid ? `${t.accent}10` : "rgba(255,255,255,0.03)",
            border: `1px solid ${i === 0 ? "rgba(255,215,0,0.3)" : p.userId === user.uid ? t.accent + "30" : "rgba(255,255,255,0.06)"}`,
            transform: i === 0 ? "scale(1.02)" : "scale(1)"
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.1)",
              color: i < 3 ? "#000" : "#fff",
              fontFamily: "'Press Start 2P', cursive", fontSize: "14px", fontWeight: "bold"
            }}>{i === 0 ? "👑" : i + 1}</div>
            {p.avatar ? (
              <img src={p.avatar} alt="" style={{ width: "40px", height: "40px", borderRadius: "10px" }} />
            ) : (
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#222" }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "11px", color: i === 0 ? "#FFD700" : "#fff" }}>
                {p.userName}{p.userId === user.uid ? " (You)" : ""}
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{p.totalReps || 0} reps</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{p.completedCards || 0} cards</span>
                <span style={{ fontSize: "10px", color: "#FFD700" }}>🎟️ {p.ticketsEarned || 0}</span>
              </div>
            </div>
            <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "16px", color: i === 0 ? "#FFD700" : t.accent }}>
              {p.score || 0}
            </div>
          </div>
        ))}
      </div>

      {me && (
        <>
        <div style={{
          width: "100%", maxWidth: "500px", padding: "20px",
          background: "rgba(255,255,255,0.03)", borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: "32px"
        }}>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive", marginBottom: "12px" }}>YOUR STATS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", textAlign: "center" }}>
            {[
              { label: "RANK", value: `#${myRank}", color: myRank === 1 ? "#FFD700" : "#fff" },
              { label: "SCORE", value: me.score || 0, color: t.accent },
              { label: "REPS", value: me.totalReps || 0, color: "#0f0" },
              { label: "TICKETS", value: `🎟️ ${me.ticketsEarned || 0}", color: "#FFD700" },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "16px", color: stat.color, marginBottom: "4px" }}>{stat.value}</div>
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontFamily: "'Press Start 2P', cursive" }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              onClick={() => setShowShare(true)}
              style={{
                padding: "14px 32px",
                background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontFamily: "'Press Start 2P', cursive",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: `0 8px 25px ${t.accent}40`,
                marginBottom: 8
              }}
            >
              Share Results to Socials
            </button>
            {shared && <div style={{ color: "#FFD700", fontSize: 12, marginTop: 8 }}>Thanks for sharing!</div>}
          </div>
        </div>
        <LiveSocialShareModal
          open={showShare}
          onClose={() => setShowShare(false)}
          onShare={handleShare}
          results={vsResults}
        />
        </>
      )}

      {me && (
        <div style={{
          width: "100%", maxWidth: "500px", padding: "20px",
          background: "rgba(255,255,255,0.03)", borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: "32px"
        }}>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontFamily: "'Press Start 2P', cursive", marginBottom: "12px" }}>YOUR STATS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", textAlign: "center" }}>
            {[
              { label: "RANK", value: `#${myRank}`, color: myRank === 1 ? "#FFD700" : "#fff" },
              { label: "SCORE", value: me.score || 0, color: t.accent },
              { label: "REPS", value: me.totalReps || 0, color: "#0f0" },
              { label: "TICKETS", value: `🎟️ ${me.ticketsEarned || 0}`, color: "#FFD700" },
            ].map((stat) => (
              <div key={stat.label}>
                <div style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "16px", color: stat.color, marginBottom: "4px" }}>{stat.value}</div>
                <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", fontFamily: "'Press Start 2P', cursive" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "16px" }}>
        <button onClick={onPlayAgain} style={{
          padding: "14px 32px", background: `linear-gradient(135deg, ${t.accent}, ${t.accent}cc)`,
          color: "#fff", border: "none", borderRadius: "12px",
          fontFamily: "'Press Start 2P', cursive", fontSize: "11px", cursor: "pointer",
          boxShadow: `0 8px 25px ${t.accent}40`
        }}>
          PLAY AGAIN
        </button>
        <button onClick={onQuit} style={{
          padding: "14px 32px", background: "transparent",
          color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "12px", fontFamily: "'Press Start 2P', cursive",
          fontSize: "11px", cursor: "pointer"
        }}>
          BACK TO HUB
        </button>
      </div>
    </div>
  );
}
