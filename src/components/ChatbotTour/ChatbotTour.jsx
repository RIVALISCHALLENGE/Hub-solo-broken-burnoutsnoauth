import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  addDoc, 
  Timestamp,
  query,
  orderBy,
  limit,
  getDocs,
  where,
} from 'firebase/firestore';
import ChatBubble from './ChatBubble.jsx';
import TourStep, { TOUR_STEPS } from './TourStep.jsx';
import LogsGraph from './LogsGraph.jsx';
import NutritionalCoach from './NutritionalCoach.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { DEFAULT_VOICE_MODEL, primeVoiceCoach, speakCoach } from '../../logic/voiceCoach.js';

const INTAKE_START_STEP = 3;
const COACH_VOICE_STORAGE_KEY = 'rivalis_coach_voice_model';

const TOUR_QUESTIONS = [
  { field: 'gender', question: "What is your gender? This helps calibrate your training baseline.", options: ['Male', 'Female', 'Non-Binary', 'Prefer not to say'] },
  { field: 'age', question: "What is your age?", type: 'number' },
  { field: 'heightFeet', question: "What is your height? Enter feet first. (e.g. 5)", type: 'number', unit: 'ft' },
  { field: 'heightInches', question: "Now enter the inches. (e.g. 10)", type: 'number', unit: 'in' },
  { field: 'weight', question: "What is your current weight in lbs? (e.g. 175)", type: 'number', unit: 'lbs' },
  { field: 'fitnessLevel', question: "What is your current fitness level?", options: ['Beginner', 'Intermediate', 'Advanced', 'Elite'] },
  { field: 'goals', question: "What is your primary fitness goal?", options: ['Mass Gain', 'Fat Loss', 'Endurance', 'General Health', 'Strength'] },
  { field: 'workoutFrequency', question: "How many days per week do you currently work out?", options: ['0-1', '2-3', '4-5', '6-7'] },
  { field: 'reason', question: "What brought you to Rivalis?", options: ['The Competition', 'Self Improvement', 'Data-Driven Fitness', 'Tactical Training', 'Community'] },
  { field: 'injuries', question: "Do you have any injuries or limitations we should know about? (Type 'none' if not)", type: 'text' }
];

const MOTIVATIONAL_QUOTES = [
  "Biological limits are meant to be shattered, Rival.",
  "Your neural link is primed. Time for a biometric upgrade.",
  "The mainframe is watching. Show them what a Rival is made of.",
  "Efficiency is the only currency in this sector. Earn it.",
  "Pain is just data leaving the system. Process it."
];

const MOOD_OPTIONS = ['Great', 'Good', 'Okay', 'Low', 'Struggling'];
const PHYSICAL_OPTIONS = ['Strong', 'Energized', 'Normal', 'Tired', 'Sore', 'Injured'];

function buildOfflineCoachReply(input, userProfile, isPro) {
  const normalized = (input || '').toLowerCase();
  const goal = userProfile?.goals || userProfile?.fitnessGoals?.[0] || 'General Health';
  const level = userProfile?.fitnessLevel || 'Intermediate';

  if (!isPro) {
    if (normalized.includes('meal') || normalized.includes('nutrition') || normalized.includes('diet')) {
      return `OFFLINE COACH MODE ACTIVE.\n\nPREMIUM PREVIEW — Nutrition Protocol:\n- Meal timing around workouts\n- Macro targets by goal\n- Portion-level daily plan\n\nUnlock Rivalis Pro to activate your full personalized protocol.`;
    }

    if (normalized.includes('workout') || normalized.includes('plan') || normalized.includes('routine')) {
      return `OFFLINE COACH MODE ACTIVE.\n\nPREMIUM PREVIEW — Training Protocol:\n- Goal-based split\n- Progressive overload structure\n- Recovery and deload logic\n\nUnlock Rivalis Pro to activate your full personalized protocol.`;
    }

    return `OFFLINE COACH MODE ACTIVE.\n\nPREMIUM PREVIEW:\nYou can access tactical guidance here, and Pro unlocks full personalized plans, meal protocols, and advanced tracking.\n\nUnlock Rivalis Pro to activate your full personalized protocol.`;
  }

  if (normalized.includes('meal') || normalized.includes('nutrition') || normalized.includes('diet')) {
    return `OFFLINE COACH MODE ACTIVE.\n\nFueling Protocol (${goal}):\n- Protein each meal: palm-sized serving\n- Carbs around training: fruit, rice, oats, potatoes\n- Hydration target: 2-3L water daily\n- Build 3 meals + 1 high-protein snack\n\nWhen connection returns, I can generate your full macro-based plan.`;
  }

  if (normalized.includes('workout') || normalized.includes('plan') || normalized.includes('routine')) {
    return `OFFLINE COACH MODE ACTIVE.\n\nRapid Training Protocol (${level}):\n- Push-ups: 4 x 10-15\n- Squats: 4 x 15-20\n- Plank: 4 x 30-45 sec\n- Mountain Climbers: 4 x 20\n\nProgression: add 1-2 reps each round next session.`;
  }

  if (normalized.includes('motivat') || normalized.includes('tired') || normalized.includes('stuck')) {
    return `OFFLINE COACH MODE ACTIVE.\n\nMission Reminder: consistency beats intensity spikes.\n- Do a 12-minute session right now\n- Track completion, not perfection\n- Stack one win today, then scale tomorrow`;
  }

  return `OFFLINE COACH MODE ACTIVE.\n\nNetwork is unavailable, but I can still guide your basics:\n- Ask for: workout, nutrition, motivation, or recovery\n- I will return fast tactical protocols until connection is restored.`;
}

function extractRivalisPlanJson(messageText) {
  if (!messageText) return null;
  const blockMatch = messageText.match(/```RIVALIS_PLAN_JSON\s*([\s\S]*?)```/i);
  if (!blockMatch || !blockMatch[1]) return null;

  try {
    const parsed = JSON.parse(blockMatch[1].trim());
    if (!parsed || !Array.isArray(parsed.days)) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

function cleanTextForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function personalizeCoachMessage(text, userName) {
  const safeText = String(text || '').trim();
  const safeName = String(userName || '').trim();
  if (!safeText || !safeName) return safeText;

  const lowerText = safeText.toLowerCase();
  const lowerName = safeName.toLowerCase();

  if (lowerText.includes(lowerName)) return safeText;
  if (safeText.startsWith(`${safeName},`) || safeText.startsWith(`${safeName} `) || safeText.startsWith(`${safeName}:`)) {
    return safeText;
  }

  return `${safeName}, ${safeText}`;
}

const ChatbotTour = ({ user, userProfile, onTourComplete, initialMessage }) => {
  const t = useTheme();
  const [messages, setMessages] = useState([]);
  const [tourStep, setTourStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkInPhase, setCheckInPhase] = useState(null);
  const [checkInData, setCheckInData] = useState({});
  const [trendData, setTrendData] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  const [isTinyViewport, setIsTinyViewport] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(max-width: 380px)').matches;
  });
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastSpokenMessageIdRef = useRef(null);
  const lastNarratedTourStepRef = useRef(-1);
  const lastSpeechTimeRef = useRef(0);

  const isPro = userProfile?.subscriptionStatus === 'active';
  const userName = userProfile?.nickname || user?.displayName || 'Rival';

  const getCoachVoiceModel = useCallback(() => {
    // Use user-selected voice model from localStorage if available
    if (typeof window !== "undefined") {
      return window.localStorage.getItem("voiceName") || DEFAULT_VOICE_MODEL;
    }
    return DEFAULT_VOICE_MODEL;
  }, []);

  const narrateCoachText = useCallback((text, options = {}) => {
    const spokenText = cleanTextForSpeech(text);
    if (!spokenText) return;

    const now = Date.now();
    if (!options.force && now - lastSpeechTimeRef.current < 220) return;
    lastSpeechTimeRef.current = now;

    primeVoiceCoach();
    speakCoach(spokenText, {
      voiceModel: getCoachVoiceModel(),
      interrupt: Boolean(options.interrupt),
    });
  }, [getCoachVoiceModel]);

  const addBotMessage = useCallback((text, delay = 0) => {
    const personalizedText = personalizeCoachMessage(text, userName);

    if (delay > 0) {
      setIsLoading(true);
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: `bot-${Date.now()}-${Math.random()}`, 
          text: personalizedText, 
          isBot: true, 
          timestamp: new Date() 
        }]);
        setIsLoading(false);
      }, delay);
    } else {
      setMessages(prev => [...prev, { 
        id: `bot-${Date.now()}-${Math.random()}`, 
        text: personalizedText, 
        isBot: true, 
        timestamp: new Date() 
      }]);
    }
  }, [userName]);

  const logCheckIn = useCallback(async (mood, physical, note) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'checkInLogs'), {
        mood,
        physical,
        note: note || '',
        timestamp: Timestamp.now(),
        date: new Date().toISOString().split('T')[0]
      });
    } catch (err) {
      console.error("Failed to log check-in:", err);
    }
  }, [user]);

  const fetchTrends = useCallback(async () => {
    if (!user) return null;
    try {
      const logsRef = collection(db, 'users', user.uid, 'checkInLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(14));
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setTrendData(logs);
      return logs;
    } catch (err) {
      console.error("Failed to fetch trends:", err);
      return null;
    }
  }, [user]);

  const checkFirestoreForTodayCheckin = useCallback(async () => {
    if (!user) return false;
    try {
      const today = new Date().toISOString().split('T')[0];
      const logsRef = collection(db, 'users', user.uid, 'checkInLogs');
      const q = query(logsRef, where('date', '==', today), limit(1));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (err) {
      console.error("Failed to check Firestore for today's check-in:", err);
      return false;
    }
  }, [user]);

  useEffect(() => {
    const localTourDone = window.localStorage.getItem('rivalis_tour_completed');
    const firestoreTourDone = userProfile?.tourCompleted;
    const nickname = userProfile?.nickname || 'Rival';

    if (!localTourDone && !firestoreTourDone) {
      setShowTour(true);
      addBotMessage("INITIALIZING NEURAL LINK... Welcome to the sector, Rival. I am your AI Fitness Coach. Let me show you around the hub.");
    } else {
      const today = new Date().toISOString().split('T')[0];
      const localChecked = window.localStorage.getItem(`rivalis_checkin_${today}`) === 'true';

      if (localChecked) {
        const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
        addBotMessage(`${quote} Ready when you are, ${nickname}.`);
      } else {
        checkFirestoreForTodayCheckin().then(alreadyDone => {
          if (alreadyDone) {
            window.localStorage.setItem(`rivalis_checkin_${today}`, 'true');
            const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
            addBotMessage(`${quote} Ready when you are, ${nickname}.`);
          } else {
            addBotMessage(`Hey ${nickname}, welcome back. How are you feeling today?\n\nOptions: ${MOOD_OPTIONS.join(' / ')}`, 300);
            setCheckInPhase('mood');
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!messages.length) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.isBot) return;

    const shouldNarrate = showTour || checkInPhase !== null;
    if (!shouldNarrate) return;

    if (lastSpokenMessageIdRef.current === latestMessage.id) return;
    lastSpokenMessageIdRef.current = latestMessage.id;

    narrateCoachText(latestMessage.text, { interrupt: false });
  }, [messages, showTour, checkInPhase, narrateCoachText]);

  useEffect(() => {
    if (!showTour) return;
    if (lastNarratedTourStepRef.current === tourStep) return;

    const currentStep = TOUR_STEPS[tourStep];
    if (!currentStep) return;

    lastNarratedTourStepRef.current = tourStep;
    narrateCoachText(`${currentStep.title}. ${currentStep.description}`, { interrupt: true, force: true });
  }, [showTour, tourStep, narrateCoachText]);

  useEffect(() => {
    if (!showTour) {
      lastNarratedTourStepRef.current = -1;
    }
  }, [showTour]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener(onChange);

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 380px)');
    const onChange = (event) => setIsTinyViewport(event.matches);
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener(onChange);

    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, []);

  const [profileData, setProfileData] = useState({
    gender: '',
    age: '',
    heightFeet: '',
    heightInches: '',
    weight: '',
    fitnessLevel: '',
    goals: '',
    workoutFrequency: '',
    reason: '',
    injuries: ''
  });

  const isInIntake = showTour && tourStep >= INTAKE_START_STEP && tourStep < INTAKE_START_STEP + TOUR_QUESTIONS.length;
  const intakeIndex = tourStep - INTAKE_START_STEP;

  const getAuthHeaders = useCallback(async () => {
    if (!user) return { 'Content-Type': 'application/json' };
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg = { id: `user-${Date.now()}`, text: inputText, isBot: false, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputText;
    setInputText('');

    if (checkInPhase) {
      const nickname = userProfile?.nickname || 'Rival';
      if (checkInPhase === 'mood') {
        const matched = MOOD_OPTIONS.find(o => o.toLowerCase() === currentInput.trim().toLowerCase());
        const mood = matched || currentInput.trim();
        setCheckInData(prev => ({ ...prev, mood }));
        addBotMessage(`Got it. And physically — how does your body feel?\n\nOptions: ${PHYSICAL_OPTIONS.join(' / ')}`, 400);
        setCheckInPhase('physical');
      } else if (checkInPhase === 'physical') {
        const matched = PHYSICAL_OPTIONS.find(o => o.toLowerCase() === currentInput.trim().toLowerCase());
        const physical = matched || currentInput.trim();
        const finalData = { ...checkInData, physical };
        setCheckInData(finalData);

        const today = new Date().toISOString().split('T')[0];
        window.localStorage.setItem(`rivalis_checkin_${today}`, 'true');
        await logCheckIn(finalData.mood, physical, '');

        const moodEmoji = { 'Great': '🔥', 'Good': '💪', 'Okay': '👊', 'Low': '🫡', 'Struggling': '❤️' };
        const physEmoji = { 'Strong': '💪', 'Energized': '⚡', 'Normal': '👍', 'Tired': '😴', 'Sore': '🩹', 'Injured': '🏥' };

        addBotMessage(`Check-in logged ${moodEmoji[finalData.mood] || '✅'} ${physEmoji[physical] || ''}. Mood: ${finalData.mood} | Body: ${physical}.\n\nType /trends to see your wellness history. Ready when you are, ${nickname}.`, 500);
        setCheckInPhase(null);
      }
      return;
    }

    if (isInIntake) {
      const currentQ = TOUR_QUESTIONS[intakeIndex];
      const newProfile = { ...profileData, [currentQ.field]: currentInput };
      setProfileData(newProfile);

      if (intakeIndex < TOUR_QUESTIONS.length - 1) {
        const nextQ = TOUR_QUESTIONS[intakeIndex + 1];
        const questionText = nextQ.question + (nextQ.options ? `\n\nOptions: ${nextQ.options.join(' / ')}` : '');
        addBotMessage(questionText, 500);
        setTourStep(prev => prev + 1);
      } else {
        const feet = parseFloat(newProfile.heightFeet) || 0;
        const inches = parseFloat(newProfile.heightInches) || 0;
        const totalInches = (feet * 12) + inches;
        const weightLbs = parseFloat(newProfile.weight) || 0;
        const bmi = totalInches > 0 && weightLbs > 0 ? ((weightLbs / (totalInches * totalInches)) * 703).toFixed(1) : null;
        const height = `${Math.floor(feet)}'${Math.floor(inches)}"`;

        const profileToSave = {
          gender: newProfile.gender,
          age: newProfile.age,
          height,
          heightFeet: String(Math.floor(feet)),
          heightInches: String(Math.floor(inches)),
          weight: newProfile.weight,
          bmi: bmi ? parseFloat(bmi) : null,
          fitnessLevel: newProfile.fitnessLevel,
          goals: newProfile.goals,
          fitnessGoals: newProfile.goals ? [newProfile.goals] : [],
          workoutFrequency: newProfile.workoutFrequency,
          reason: newProfile.reason,
          appSeeking: newProfile.reason ? [newProfile.reason] : [],
          injuries: newProfile.injuries
        };

        let bmiMessage = "";
        if (bmi) {
          const bmiVal = parseFloat(bmi);
          let category = "Normal";
          if (bmiVal < 18.5) category = "Underweight";
          else if (bmiVal < 25) category = "Normal";
          else if (bmiVal < 30) category = "Overweight";
          else category = "Obese";
          bmiMessage = `\n\nBMI calculated: ${bmi} (${category}). `;
        }

        addBotMessage(`Profile data recorded. Syncing your biometrics...${bmiMessage}You're all set. Check your Fitness Dashboard for your full overview. Define your personal mission in your BIO to complete initialization.`, 600);
        
        if (user) {
          try {
            const { UserService } = await import('../../services/userService.js');
            await UserService.updateUserProfile(user.uid, profileToSave);
          } catch (err) {
            console.error("Failed to sync biometrics:", err);
          }
        }
        setTourStep(prev => prev + 1);
      }
      return;
    }

    if (currentInput.toLowerCase().includes('/tour') || currentInput.toLowerCase().includes('/reboot')) {
      setTourStep(0);
      setShowTour(true);
      addBotMessage("Reinitializing tour protocol...", 400);
      return;
    }

    if (currentInput.toLowerCase().includes('/trends')) {
      addBotMessage("Fetching your wellness trends...", 200);
      const logs = await fetchTrends();
      if (logs && logs.length > 0) {
        const summary = logs.slice(-7).map(l => `${l.date}: ${l.mood} / ${l.physical}`).join('\n');
        addBotMessage(`📊 Recent check-ins:\n\n${summary}\n\nTrend graphs loaded below. Keep logging daily to build your data.`, 600);
      } else {
        setTrendData(null);
        addBotMessage("No check-in data yet. Complete your daily check-in to start tracking trends.", 500);
      }
      return;
    }

    if (currentInput.toLowerCase().includes('/checkin')) {
      const nickname = userProfile?.nickname || 'Rival';
      addBotMessage(`Starting check-in. How are you feeling today, ${nickname}?\n\nOptions: ${MOOD_OPTIONS.join(' / ')}`, 300);
      setCheckInPhase('mood');
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addBotMessage(buildOfflineCoachReply(currentInput, userProfile, isPro), 250);
      return;
    }

    setIsLoading(true);

    try {
      let convId = window.localStorage.getItem('rivalis_conv_id');
      const authHeaders = await getAuthHeaders();
      
      const userContext = [
        `Preferred name: ${userName}`,
        `Address the user as ${userName} in every response`,
        userProfile?.goals && `Goal: ${userProfile.goals}`,
        userProfile?.reason && `Reason: ${userProfile.reason}`,
        userProfile?.fitnessLevel && `Fitness level: ${userProfile.fitnessLevel}`,
        userProfile?.workoutFrequency && `Workout frequency: ${userProfile.workoutFrequency}`,
        userProfile?.weight && `Weight: ${userProfile.weight}`,
        userProfile?.height && `Height: ${userProfile.height}`,
        userProfile?.age && `Age: ${userProfile.age}`,
      ].filter(Boolean).join(', ');

      const sendRequest = async (cid) => {
        return await fetch(`/api/conversations/${cid}/messages`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ content: currentInput, userContext })
        });
      };

      let response;
      if (!convId) {
        const convRes = await fetch('/api/conversations', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ title: `Chat with ${userProfile?.nickname || 'Rival'}` })
        });
        
        if (!convRes.ok) {
          const errData = await convRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create conversation');
        }
        
        const convData = await convRes.json();
        convId = convData.id;
        window.localStorage.setItem('rivalis_conv_id', convId);
        response = await sendRequest(convId);
      } else {
        response = await sendRequest(convId);
        if (response.status === 404 || response.status === 500) {
          window.localStorage.removeItem('rivalis_conv_id');
          const convRes = await fetch('/api/conversations', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ title: `Chat with ${userProfile?.nickname || 'Rival'}` })
          });
          
          if (!convRes.ok) throw new Error('Failed to reset conversation');
          
          const convData = await convRes.json();
          convId = convData.id;
          window.localStorage.setItem('rivalis_conv_id', convId);
          response = await sendRequest(convId);
        }
      }

      if (!response || !response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        console.error("Server responded with error:", response.status, errText);
        throw new Error(`AI connection failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const assistantMsgId = `ai-${Date.now()}`;
      let fullText = "";

      setIsLoading(false);
      setMessages(prev => [...prev, { id: assistantMsgId, text: "", isBot: true, timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullText += data.content;
                const personalized = personalizeCoachMessage(fullText, userName);
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, text: personalized } : m
                ));
              }
            } catch (e) {
            }
          }
        }
      }

      if (fullText.includes("TRANSFERRING TO HUMAN AGENT")) {
        try {
          await addDoc(collection(db, 'admin_notifications'), {
            type: 'CHAT_ESCALATION',
            userId: user.uid,
            userName: userProfile?.nickname || user.email,
            timestamp: Timestamp.now(),
            status: 'pending',
            message: `User ${userProfile?.nickname || user.email} requested assistance that the AI could not provide.`
          });
        } catch (error) {
          console.error("Failed to notify admins:", error);
        }
      }

      const integratedPlan = extractRivalisPlanJson(fullText);
      if (integratedPlan && user) {
        try {
          const { UserService } = await import('../../services/userService.js');
          await UserService.updateUserProfile(user.uid, {
            integratedWorkoutPlan: integratedPlan,
            integratedWorkoutPlanSource: 'chatbot_coach',
            integratedWorkoutPlanUpdatedAt: new Date().toISOString(),
          });
        } catch (planSaveError) {
          console.error("Failed to save integrated Rivalis plan:", planSaveError);
        }
      }

    } catch (error) {
      console.error("AI Error:", error);
      setIsLoading(false);
      
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          type: 'CHATBOT_ERROR',
          userId: user.uid,
          userName: userProfile?.nickname || user.email,
          error: error.message,
          timestamp: Timestamp.now(),
          status: 'pending',
          message: `Internal error in Rivalis Coach for user ${userProfile?.nickname || user.email}.`
        });
      } catch (notifyErr) {
        console.error("Failed to notify admin of error:", notifyErr);
      }

      addBotMessage(buildOfflineCoachReply(currentInput, userProfile, isPro), 200);
    }
  };

  const nextTourStep = () => {
    setIsMinimized(true);
    const totalSteps = TOUR_STEPS.length;

    if (tourStep < totalSteps - 1) {
      setTourStep(prev => prev + 1);
      
      if (tourStep + 1 === INTAKE_START_STEP) {
        const firstQ = TOUR_QUESTIONS[0];
        addBotMessage(firstQ.question + `\n\nOptions: ${firstQ.options.join(' / ')}`, 400);
      }
    } else {
      completeTour();
    }
  };

  const completeTour = () => {
    setShowTour(false);
    window.localStorage.setItem('rivalis_tour_completed', 'true');
    
    if (user) {
      (async () => {
        try {
          const { UserService } = await import('../../services/userService.js');
          await UserService.updateUserProfile(user.uid, { tourCompleted: true });
        } catch (error) {
          console.error("Failed to sync tour status:", error);
        }
      })();
    }
    
    if (onTourComplete) onTourComplete();
    window.location.href = '/';
  };

  const skipTour = () => {
    setShowTour(false);
    window.localStorage.setItem('rivalis_tour_completed', 'true');
    
    if (user) {
      (async () => {
        try {
          const { UserService } = await import('../../services/userService.js');
          await UserService.updateUserProfile(user.uid, { tourCompleted: true });
        } catch (error) {
          console.error("Failed to sync tour status:", error);
        }
      })();
    }

    if (onTourComplete) onTourComplete();
    addBotMessage(`Tour skipped. No worries — you can restart it anytime by typing /tour. Ready when you are, ${userProfile?.nickname || 'Rival'}.`, 300);
  };

  const exportConversation = async () => {
    const convId = window.localStorage.getItem('rivalis_conv_id');
    if (convId) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/conversations/${convId}/export`, { headers });
        if (!response.ok) {
          throw new Error('Export request failed');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rivalis_Plan_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export failed:", error);
        const text = messages.map(m => `${m.isBot ? 'COACH' : 'RIVAL'}: ${m.text}`).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rivalis_Plan_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    }
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#000',
      border: '1px solid rgba(51,51,51,0.6)',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative',
      transition: 'all 0.3s ease',
    },
    header: {
      padding: isTinyViewport ? '7px 8px' : (isMobileViewport ? '8px 10px' : '10px 15px'),
      background: 'linear-gradient(180deg, #111 0%, #0a0a0a 100%)',
      borderBottom: `1px solid ${t.shadowXs}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isTinyViewport ? '6px' : '10px',
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#00ff44',
      boxShadow: '0 0 8px #00ff44',
      animation: 'pulse 2s infinite',
    },
    headerTitle: {
      color: t.accent,
      fontSize: isTinyViewport ? '8px' : (isMobileViewport ? '9px' : '11px'),
      fontWeight: 'bold',
      letterSpacing: '1px',
      textShadow: `0 0 6px ${t.shadowSm}`,
      fontFamily: "'Press Start 2P', cursive",
    },
    proBadge: {
      background: t.accent,
      color: '#fff',
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '8px',
      fontWeight: 'bold',
      fontFamily: "'Press Start 2P', cursive",
      letterSpacing: '1px',
    },
    exportBtn: {
      background: 'transparent',
      border: `1px solid ${t.shadowSm}`,
      color: t.shadowMd,
      padding: isTinyViewport ? '2px 6px' : (isMobileViewport ? '3px 8px' : '4px 10px'),
      borderRadius: '6px',
      fontSize: isTinyViewport ? '7px' : (isMobileViewport ? '8px' : '9px'),
      cursor: 'pointer',
      fontFamily: "'Press Start 2P', cursive",
      transition: 'all 0.2s ease',
    },
    chatArea: {
      flex: 1,
      padding: isTinyViewport ? '6px 6px' : (isMobileViewport ? '8px 8px' : '12px 10px'),
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      WebkitOverflowScrolling: 'touch',
    },
    inputArea: {
      padding: isTinyViewport ? '6px' : (isMobileViewport ? '8px' : '10px'),
      background: 'linear-gradient(180deg, #0a0a0a 0%, #111 100%)',
      borderTop: `1px solid ${t.shadowXs}`,
      display: 'flex',
      gap: '8px',
    },
    input: {
      flex: 1,
      background: '#000',
      border: '1px solid rgba(51,51,51,0.6)',
      borderRadius: '10px',
      padding: isTinyViewport ? '9px 10px' : (isMobileViewport ? '10px 12px' : '12px 15px'),
      color: '#FFF',
      outline: 'none',
      fontSize: isTinyViewport ? '15px' : '16px',
      transition: 'border-color 0.2s ease',
    },
    sendButton: {
      background: t.accent,
      border: 'none',
      borderRadius: '10px',
      width: isTinyViewport ? '36px' : (isMobileViewport ? '40px' : '44px'),
      color: '#FFF',
      cursor: 'pointer',
      fontSize: isTinyViewport ? '15px' : (isMobileViewport ? '16px' : '18px'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
      boxShadow: `0 2px 8px ${t.shadowXs}`,
    },
    tourOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      padding: isTinyViewport ? '8px' : (isMobileViewport ? '10px' : '20px'),
    },
    resumeTab: {
      background: t.accent,
      padding: isTinyViewport ? '7px 10px' : (isMobileViewport ? '8px 14px' : '10px 20px'),
      borderRadius: '20px 20px 0 0',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: `0 -4px 20px ${t.shadowSm}`,
      pointerEvents: 'auto',
      position: 'absolute',
      bottom: 0,
      right: isTinyViewport ? '8px' : (isMobileViewport ? '12px' : '20px'),
      animation: 'slideUp 0.3s ease-out',
    },
    resumeText: {
      color: '#FFF',
      fontSize: isTinyViewport ? '7px' : (isMobileViewport ? '8px' : '9px'),
      fontFamily: "'Press Start 2P', cursive",
      letterSpacing: '0.5px',
    },
    resumePulse: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#FFF',
      animation: 'pulse 1.5s infinite',
    },
    proActions: {
      display: 'flex',
      gap: '6px',
      padding: isTinyViewport ? '5px 6px' : '6px 10px',
      background: '#0a0a0a',
      borderTop: `1px solid ${t.shadowXs}`,
      overflowX: 'auto',
    },
    proActionBtn: {
      background: t.shadowXxs,
      border: `1px solid ${t.shadowSm}`,
      color: '#fff',
      padding: isTinyViewport ? '5px 8px' : '6px 10px',
      borderRadius: '8px',
      fontSize: isTinyViewport ? '10px' : '11px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'all 0.2s ease',
    },
    upgradeBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      padding: isTinyViewport ? '5px 6px' : '6px 10px',
      background: t.shadowXxs,
      borderTop: `1px solid ${t.shadowXs}`,
    },
    upgradeLink: {
      color: t.accent,
      fontSize: isTinyViewport ? '9px' : '10px',
      fontWeight: 'bold',
      fontFamily: "'Press Start 2P', cursive",
      textDecoration: 'none',
      textShadow: `0 0 5px ${t.shadowMd}`,
      flexShrink: 0,
    },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0) translateX(-50%); }
          50% { transform: translateY(-8px) translateX(-50%); }
        }
        .chatbot-scrollbar::-webkit-scrollbar { width: 4px; }
        .chatbot-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .chatbot-scrollbar::-webkit-scrollbar-thumb { background: ${t.shadowSm}; border-radius: 4px; }
      `}</style>

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={styles.statusDot} />
          <span style={styles.headerTitle}>RIVALIS COACH</span>
          {isPro && (
            <span style={styles.proBadge}>PRO</span>
          )}
        </div>
        <button onClick={exportConversation} style={styles.exportBtn}>
          EXPORT
        </button>
      </div>

      {showTour && !isMinimized && (
        <div style={styles.tourOverlay} onClick={(e) => e.stopPropagation()}>
          <TourStep 
            step={tourStep} 
            onNext={nextTourStep} 
            onSkip={skipTour} 
          />
        </div>
      )}

      {showTour && isMinimized && (
        <div style={styles.resumeTab} onClick={() => setIsMinimized(false)}>
          <div style={styles.resumePulse} />
          <span style={styles.resumeText}>RESUME TOUR</span>
        </div>
      )}

      {(!showTour || isMinimized) && (
        <>
          <div style={styles.chatArea} className="chatbot-scrollbar">
            {messages.map(msg => (
              <ChatBubble key={msg.id} message={msg.text} isBot={msg.isBot} />
            ))}
            
            {trendData && trendData.length > 0 && (
              <>
                <LogsGraph data={trendData} type="mood" />
                <LogsGraph data={trendData} type="physical" />
              </>
            )}
            {messages.some(m => m.text.includes('Nutritional')) && (
              <NutritionalCoach />
            )}

            {isLoading && (
              <ChatBubble isBot={true} isTyping={true} message="" animate={false} />
            )}
            
            <div ref={chatEndRef} />
          </div>

          {!showTour && isPro && (
            <div style={styles.proActions}>
              {[
                { label: '🥗 Meal Plan', prompt: 'Create a personalized meal plan for my goals' },
                { label: '💪 Workout', prompt: 'Build me a custom workout program' },
                { label: '🎯 Goals', prompt: 'Help me set and track my fitness goals' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(action.prompt);
                    inputRef.current?.focus();
                  }}
                  style={styles.proActionBtn}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {!showTour && !isPro && (
            <div style={styles.upgradeBar}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                Unlock meal plans, workouts & goals
              </span>
              <a href="/subscription" style={styles.upgradeLink}>GO PRO</a>
            </div>
          )}
          <form onSubmit={handleSendMessage} style={styles.inputArea} data-chatbot-form>
            <input 
              ref={inputRef}
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isLoading ? "Coach is thinking..." : (isPro ? "Ask your personal trainer..." : "Ask me anything...")}
              style={{
                ...styles.input,
                ...(isLoading ? { opacity: 0.5, pointerEvents: 'none' } : {})
              }}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              style={{
                ...styles.sendButton,
                ...(isLoading || !inputText.trim() ? { opacity: 0.4, cursor: 'default' } : {})
              }}
              disabled={isLoading || !inputText.trim()}
            >
              ➤
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatbotTour;
