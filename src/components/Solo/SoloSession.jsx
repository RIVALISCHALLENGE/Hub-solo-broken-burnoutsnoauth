import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { shuffleSoloDeck, updateUserStats, finalizeSession } from '../../logic/burnoutsHelpers';
import { processExercise, createStateRefs, resetStateRefs } from '../../logic/exerciseEngine';
import PoseVisualizer from '../Burnouts/PoseVisualizer';
import {
    announceRepProgress,
    maybeSpeakMotivation,
    primeVoiceCoach,
    speakCoach,
    DEFAULT_VOICE_MODEL,
} from '../../logic/voiceCoach.js';

export default function SoloSession({ userId, onSessionEnd, voiceModel = DEFAULT_VOICE_MODEL }) {
    const [deck] = useState(() => shuffleSoloDeck());
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [totalReps, setTotalReps] = useState(0);
    const [currentReps, setCurrentReps] = useState(0);
    const [ticketsEarned, setTicketsEarned] = useState(0);
    const [sessionActive, setSessionActive] = useState(true);
    const [feedback, setFeedback] = useState("Get Ready");
    const [movementState, setMovementState] = useState('IDLE');
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const stateRefs = useRef(createStateRefs());
    const currentCard = deck[currentCardIndex];

    useEffect(() => {
        primeVoiceCoach();
    }, []);

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
                if (!isMuted) {
                    speakCoach(`${deck[currentCardIndex].exercise}. ${deck[currentCardIndex].reps} reps.`, {
                        voiceModel,
                        interrupt: true,
                    });
                }
                lastAnnouncedCardIndex.current = currentCardIndex;
            }
        }
    }, [currentCardIndex, cooldown, sessionActive, deck, isMuted, voiceModel]);

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
                        speakCoach(next.toString(), { voiceModel });
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown, isMuted, voiceModel]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const getSuitSymbol = (suit) => {
        const symbols = { 'Spades': '♠', 'Hearts': '♥', 'Clubs': '♣', 'Diamonds': '♦' };
        return symbols[suit] || '';
    };

    const getSuitColor = (suit) => {
        return suit === 'Hearts' || suit === 'Diamonds' ? '#ff4444' : '#ffffff';
    };

    const completeCard = useCallback(() => {
        setFeedback("CARD COMPLETE! 💪");
        if (!isMuted) {
            speakCoach("Card complete. 15 second rest.", {
                voiceModel,
                interrupt: true,
            });
        }
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
                    finalizeSession(userId, totalReps, ticketsEarned, "Solo");
                    if (onSessionEnd) {
                        onSessionEnd({ reps: totalReps, duration: timeElapsed, category: "Solo" });
                    }
                    return prevIndex;
                }
            });
        }, 1500);
    }, [deck, isMuted, userId, totalReps, ticketsEarned, onSessionEnd, timeElapsed, voiceModel]);

    const handleRep = useCallback((inc) => {
        const previousWholeReps = Math.floor(currentReps);
        const next = currentReps + inc;
        const target = currentCard.reps;
        const clampedNext = Math.min(next, target);
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
            updateUserStats(userId, newTotalReps, newTickets, "Solo");
        }

        if (!isMuted) {
            announceRepProgress(previousWholeReps, clampedNext, { voiceModel });
            maybeSpeakMotivation(newTotalReps, {
                voiceModel,
                channel: 'solo',
                exerciseName: currentCard?.exercise,
                repsRemaining: Math.max(0, target - Math.floor(clampedNext)),
            });
        }
    }, [currentReps, currentCard, totalReps, ticketsEarned, isMuted, userId, completeCard, voiceModel]);

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
        finalizeSession(userId, totalReps, ticketsEarned, "Solo");
        if (onSessionEnd) {
            onSessionEnd({ reps: totalReps, duration: timeElapsed, category: "Solo" });
        }
    }, [userId, totalReps, ticketsEarned, onSessionEnd, timeElapsed]);

    return (
        <div className="solo-session-container">
            <div className="solo-ui-layer">
                <div className="solo-top-bar">
                    <div className="solo-session-stats">
                        <button
                            className="solo-mute-toggle"
                            onClick={() => setIsMuted(!isMuted)}
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
                        <div className="solo-stat-item">
                            <span className="solo-stat-label">TOTAL REPS</span>
                            <span className="solo-stat-value">{Math.floor(totalReps)}</span>
                        </div>
                        <div className="solo-stat-item">
                            <span className="solo-stat-label">TICKETS</span>
                            <span className="solo-stat-value">{ticketsEarned}</span>
                        </div>
                        <div className="solo-stat-item">
                            <span className="solo-stat-label">TIME</span>
                            <span className="solo-stat-value">{formatTime(timeElapsed)}</span>
                        </div>
                        <div className="solo-stat-item">
                            <span className="solo-stat-label">CARDS</span>
                            <span className="solo-stat-value">{currentCardIndex + 1}/{deck.length}</span>
                        </div>
                    </div>
                    <div className="solo-status-badge">LIVE</div>
                </div>

                <div className="solo-card-display">
                    <div className="solo-video-area">
                        <PoseVisualizer
                            onPoseResults={processPose}
                            currentExercise={currentCard?.exerciseId}
                        />
                    </div>
                    {currentCard && (
                        <div className="solo-playing-card" style={{ borderColor: getSuitColor(currentCard.suit) }}>
                            <div className="solo-card-corner solo-card-corner-top" style={{ color: getSuitColor(currentCard.suit) }}>
                                <span className="solo-card-face">{currentCard.face}</span>
                                <span className="solo-card-suit-small">{getSuitSymbol(currentCard.suit)}</span>
                            </div>
                            <div className="solo-card-center">
                                <div className="solo-card-suit-large" style={{ color: getSuitColor(currentCard.suit) }}>
                                    {getSuitSymbol(currentCard.suit)}
                                </div>
                                <h2 className="solo-card-exercise-name">{currentCard.exercise.toUpperCase()}</h2>
                            </div>
                            <div className="solo-card-corner solo-card-corner-bottom" style={{ color: getSuitColor(currentCard.suit) }}>
                                <span className="solo-card-face">{currentCard.face}</span>
                                <span className="solo-card-suit-small">{getSuitSymbol(currentCard.suit)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="solo-bottom-panel">
                    <div className="solo-counter-box">
                        <span className="solo-big-reps">{Math.floor(currentReps)}</span>
                        <span className="solo-reps-label">REPS</span>
                    </div>
                    <div className="solo-feedback-box">
                        <div className="solo-feedback-state">{cooldown > 0 ? 'REST' : movementState}</div>
                        <div className="solo-feedback-msg">{cooldown > 0 ? `Get Ready: ${cooldown}s` : feedback}</div>
                    </div>
                    {currentCard && (
                        <div className="solo-progress-section">
                            <div className="solo-reps-countdown">
                                <span className="solo-reps-left">{Math.max(0, currentCard.reps - Math.floor(currentReps))}</span>
                                <span className="solo-reps-left-label">REPS LEFT</span>
                            </div>
                            <div className="solo-progress-container">
                                <div
                                    className="solo-progress-bar"
                                    style={{ width: `${(currentReps / currentCard.reps) * 100}%` }}
                                ></div>
                            </div>
                            <span className="solo-target-text">TARGET: {currentCard.reps}</span>
                        </div>
                    )}
                    <button className="solo-stop-btn" onClick={handleStopSession}>
                        STOP SESSION
                    </button>
                </div>
            </div>
        </div>
    );
}
