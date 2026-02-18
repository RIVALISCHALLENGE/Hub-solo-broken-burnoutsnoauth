import { useState, useEffect, useRef, useCallback } from "react";
import SocialShareModal from "../SocialShareModal";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { shuffleDeck, updateUserStats, finalizeSession } from "../../logic/burnoutsHelpers";
import { processExercise, createStateRefs, resetStateRefs } from "../../logic/exerciseEngine";
import PoseVisualizer from "./PoseVisualizer";

// Enhanced speak function: picks best available voice
function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
        /Google US English/i,
        /Google UK English/i,
        /Microsoft Aria Online/i,
        /Microsoft Jenny/i,
        /Microsoft Guy/i,
        /Apple Siri/i,
        /en-US/i
    ];
    let best = null;
    for (const pattern of preferred) {
        best = voices.find(v => pattern.test(v.name));
        if (best) break;
    }
    if (!best) best = voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0] || null;
    if (best) utterance.voice = best;
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.speak(utterance);
        window.speechSynthesis.getVoices();
    } else {
        window.speechSynthesis.speak(utterance);
    }
}

export default function BurnoutsSession({ userId, muscleGroup, onSessionEnd }) {
    const [showShare, setShowShare] = useState(false);
    const [lastStats, setLastStats] = useState(null);
    const [deck, setDeck] = useState(shuffleDeck(muscleGroup));
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [totalReps, setTotalReps] = useState(0);
    const [currentReps, setCurrentReps] = useState(0);
    const [ticketsEarned, setTicketsEarned] = useState(0);
    const [sessionActive, setSessionActive] = useState(true);
    const [feedback, setFeedback] = useState("Get Ready");
    const [movementState, setMovementState] = useState('IDLE');
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const stateRefs = useRef(createStateRefs());
    const currentCard = deck[currentCardIndex];

    useEffect(() => {
        const fetchAvatar = async () => {
            const docSnap = await getDoc(doc(db, "users", userId));
            if (docSnap.exists()) setAvatarUrl(docSnap.data().avatarUrl);
        };
        fetchAvatar();
    }, [userId]);

    useEffect(() => {
        let interval;
        if (sessionActive) {
            interval = setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [sessionActive]);

    const lastAnnouncedCardIndex = useRef(-1);

    useEffect(() => {
        if (deck.length > 0 && sessionActive && cooldown === 0) {
            if (lastAnnouncedCardIndex.current !== currentCardIndex) {
                speak(`Start with ${deck[currentCardIndex].exercise}, ${deck[currentCardIndex].reps} reps.`);
                lastAnnouncedCardIndex.current = currentCardIndex;
            }
        }
    }, [currentCardIndex, cooldown, sessionActive, deck]);

    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    const next = prev - 1;
                    if (next <= 5 && !isMuted) {
                        speak(next.toString());
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const getSuitSymbol = (suit) => {
        const symbols = { 'Spades': '♠', 'Hearts': '♥', 'Clubs': '♣', 'Diamonds': '♦' };
        return symbols[suit] || '';
    };

    const completeCard = useCallback(() => {
        setFeedback("TARGET REACHED! 💪");
        if (!isMuted) speak("Target reached. 15 second cooldown starting.");
        setTimeout(() => {
            setCurrentCardIndex(prevIndex => {
                const nextIndex = prevIndex + 1;
                if (nextIndex < deck.length) {
                    setCooldown(15);
                    setCurrentReps(0);
                    resetStateRefs(stateRefs.current);
                    setFeedback(`Rest: 15s`);
                    setMovementState('IDLE');
                    return nextIndex;
                } else {
                    setSessionActive(false);
                    finalizeSession(userId, totalReps, ticketsEarned, muscleGroup);
                    setLastStats({ reps: totalReps, duration: timeElapsed, category: muscleGroup });
                    setShowShare(true);
                    if (onSessionEnd) {
                        onSessionEnd({ reps: totalReps, duration: timeElapsed, category: muscleGroup });
                    }
                    return prevIndex;
                }
            });
        }, 1500);
    }, [deck, isMuted, userId, totalReps, ticketsEarned, muscleGroup, onSessionEnd, timeElapsed]);

    const handleRep = useCallback((inc) => {
        const next = currentReps + inc;
        const target = currentCard.reps;
        if (next >= target) {
            setCurrentReps(target);
            completeCard();
        } else {
            setCurrentReps(next);
        }
        const newTotalReps = totalReps + inc;
        setTotalReps(newTotalReps);
        
        const newTickets = Math.floor(newTotalReps / 30);
        if (newTickets > ticketsEarned) {
            setTicketsEarned(newTickets);
            updateUserStats(userId, newTotalReps, newTickets, muscleGroup);
        }

        if (Math.floor(next) > Math.floor(currentReps) && !isMuted) {
            speak(Math.floor(next).toString());
        }
    }, [currentReps, currentCard, totalReps, ticketsEarned, isMuted, userId, muscleGroup, completeCard]);

    const processPose = useCallback((landmarks) => {
        if (!currentCard || !sessionActive || cooldown > 0 || !landmarks) return;

        stateRefs.current.currentReps = currentReps;

        const result = processExercise(currentCard.exerciseId || currentCard.exercise.toLowerCase(), landmarks, stateRefs.current);
        if (!result) return;

        if (result.repIncrement > 0) handleRep(result.repIncrement);
        if (result.feedback && result.feedback !== feedback) setFeedback(result.feedback);
        if (result.state && result.state !== movementState) setMovementState(result.state);
    }, [currentCard, sessionActive, feedback, movementState, currentReps, handleRep, cooldown]);

    const handleStopSession = useCallback(() => {
        setSessionActive(false);
        finalizeSession(userId, totalReps, ticketsEarned, muscleGroup);
        setLastStats({ reps: totalReps, duration: timeElapsed, category: muscleGroup });
        setShowShare(true);
        if (onSessionEnd) {
            onSessionEnd({ reps: totalReps, duration: timeElapsed, category: muscleGroup });
        }
    }, [userId, totalReps, ticketsEarned, muscleGroup, onSessionEnd, timeElapsed]);

    const handleShare = async () => {
        setShowShare(false);
        // Simulate social share and award tickets
        try {
            await fetch("/api/raffle/award", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, amount: 100, reason: "Social Share Bonus" })
            });
            alert("Shared! +100 raffle tickets awarded.");
        } catch (e) {
            alert("Shared! (Demo: 100 tickets awarded)");
        }
        window.location.href = "/dashboard";
    };

    const handleCloseShare = () => {
        setShowShare(false);
        window.location.href = "/dashboard";
    };

    return (
        <>
        <div className="burnouts-container">
            <div className="ui-layer">
                <div className="top-bar">
                    <div className="session-stats">
                        <button 
                            className="mute-toggle" 
                            onClick={() => setIsMuted(!isMuted)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 10px' }}
                        >
                            {isMuted ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            )}
                        </button>
                        <div className="stat-item">
                            <span className="stat-label">TOTAL REPS</span>
                            <span className="stat-value">{Math.floor(totalReps)}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">TICKETS</span>
                            <span className="stat-value">{ticketsEarned}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">TIME</span>
                            <span className="stat-value">{formatTime(timeElapsed)}</span>
                        </div>
                    </div>
                    <div className="status-badge active">LIVE</div>
                </div>

                <div className="burnouts-stats-container">
                    <div className="counter-box">
                        <span className="big-number">{Math.floor(currentReps)}</span>
                        <span className="label">REPS</span>
                    </div>
                    <div className="feedback-box">
                        <div className="state-indicator">{cooldown > 0 ? 'COOLDOWN' : movementState}</div>
                        <div className="sub-text">{cooldown > 0 ? `Get Ready: ${cooldown}s` : feedback}</div>
                    </div>
                </div>

                <div className="burnouts-controls">
                    <button className="burnouts-primary-btn" onClick={handleStopSession}>STOP SESSION</button>
                </div>

                {sessionActive && currentCard && (
                    <div className="burnouts-card-display">
                        <div className="video-feedback-container">
                            <PoseVisualizer 
                                onPoseResults={processPose} 
                                currentExercise={currentCard.exerciseId} 
                            />
                        </div>
                        <div className="card-content">
                            <div className="card-header">
                                <span>{getSuitSymbol(currentCard.suit)}</span>
                                <span>{currentCard.face}</span>
                            </div>
                            <div className="card-body">
                                <h2 className="card-exercise-name">{currentCard.exercise.toUpperCase()}</h2>
                                <div className="reps-countdown">
                                    <span className="reps-left">{Math.max(0, currentCard.reps - Math.floor(currentReps))}</span>
                                    <span className="reps-label">REPS LEFT</span>
                                </div>
                                <div className="burnouts-progress-container">
                                    <div 
                                        className="burnouts-progress-bar" 
                                        style={{ width: `${(currentReps / currentCard.reps) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="target-text">TARGET: {currentCard.reps}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
        <SocialShareModal
            open={showShare}
            onClose={handleCloseShare}
            onShare={handleShare}
            sessionStats={lastStats || { reps: 0, duration: 0, category: "-" }}
            userProfile={{ nickname: "User" }}
        />
        </>
    );
}
