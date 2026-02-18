const VOICE_MODEL_OPTIONS = [
  {
    id: "auto",
    label: "Auto Smooth",
    description: "Best available smooth voice",
    rate: 0.94,
    pitch: 1,
    preferred: ["aria", "samantha", "google us english", "zira", "alloy", "neural", "natural"],
  },
  {
    id: "coach_energetic",
    label: "Coach Energetic",
    description: "Fast, clear, high-energy voice",
    rate: 1,
    pitch: 1.03,
    preferred: ["aria", "google us english", "samantha", "zira", "neural", "natural"],
  },
  {
    id: "coach_grounded",
    label: "Coach Grounded",
    description: "Steady, confident voice",
    rate: 0.92,
    pitch: 0.95,
    preferred: ["daniel", "guy", "aaron", "oliver", "neural", "natural"],
  },
  {
    id: "coach_calm",
    label: "Coach Calm",
    description: "Clear and smooth pacing",
    rate: 0.88,
    pitch: 0.96,
    preferred: ["samantha", "aria", "zira", "google us english", "neural", "natural"],
  },
];

const DEFAULT_VOICE_MODEL = "auto";
const MOTIVATION_COOLDOWN_MS = 9000;

const MOTIVATION_LINES = [
  "You got this. Keep moving.",
  "Stay locked in. Keep going.",
  "Strong work. Keep the pressure on.",
  "You are building momentum. Keep pushing.",
  "One rep at a time. You are crushing it.",
  "Stay sharp. Finish strong.",
];

const channelMotivationState = {};

const ROBOTIC_VOICE_KEYWORDS = [
  "robot",
  "espeak",
  "mbrola",
  "festival",
  "synthetic",
];

const SMOOTH_VOICE_KEYWORDS = [
  "neural",
  "natural",
  "enhanced",
  "premium",
  "wavenet",
  "siri",
  "google",
  "aria",
  "samantha",
  "zira",
];

function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function getVoiceModelConfig(modelId) {
  return VOICE_MODEL_OPTIONS.find((option) => option.id === modelId) || VOICE_MODEL_OPTIONS[0];
}

function pickVoice(modelId) {
  if (!canSpeak()) return null;

  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const englishVoices = voices.filter((voice) => (voice.lang || "").toLowerCase().startsWith("en"));
  const candidateVoices = englishVoices.length ? englishVoices : voices;

  const model = getVoiceModelConfig(modelId || DEFAULT_VOICE_MODEL);
  const preferredNames = model.preferred || [];

  for (const preferredName of preferredNames) {
    const matched = candidateVoices.find((voice) =>
      `${voice.name} ${voice.voiceURI}`.toLowerCase().includes(preferredName.toLowerCase())
    );
    if (matched) return matched;
  }

  const scored = candidateVoices
    .map((voice) => {
      const label = `${voice.name} ${voice.voiceURI}`.toLowerCase();
      let score = 0;

      if (!ROBOTIC_VOICE_KEYWORDS.some((keyword) => label.includes(keyword))) {
        score += 3;
      }

      if (SMOOTH_VOICE_KEYWORDS.some((keyword) => label.includes(keyword))) {
        score += 4;
      }

      if ((voice.localService ?? true) === true) {
        score += 1;
      }

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || candidateVoices[0] || voices[0] || null;
}

export function primeVoiceCoach() {
  if (!canSpeak()) return;
  window.speechSynthesis.getVoices();
}

export function speakCoach(text, options = {}) {
  if (!text || !canSpeak()) return;

  const {
    voiceModel = DEFAULT_VOICE_MODEL,
    interrupt = false,
  } = options;

  if (interrupt) {
    window.speechSynthesis.cancel();
  }

  const model = getVoiceModelConfig(voiceModel);
  const utterance = new SpeechSynthesisUtterance(text);
  const selectedVoice = pickVoice(voiceModel);

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang || "en-US";
  } else {
    utterance.lang = "en-US";
  }

  utterance.rate = model.rate;
  utterance.pitch = model.pitch;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

export function announceRepProgress(previousReps, nextReps, options = {}) {
  const start = Math.floor(previousReps || 0);
  const end = Math.floor(nextReps || 0);

  if (end <= start) return;

  for (let rep = start + 1; rep <= end; rep += 1) {
    speakCoach(`${rep}`, options);
  }
}

export function maybeSpeakMotivation(totalReps, options = {}) {
  const reps = Math.floor(totalReps || 0);
  if (reps < 3 || reps % 5 !== 0) return;

  const channel = options.channel || "default";
  const now = Date.now();
  const state = channelMotivationState[channel] || { lastTime: 0, lastRep: 0 };

  if (state.lastRep === reps) return;
  if (now - state.lastTime < MOTIVATION_COOLDOWN_MS) return;

  const repsRemaining = Math.max(0, Math.floor(options.repsRemaining || 0));
  const exerciseName = options.exerciseName ? String(options.exerciseName).toLowerCase() : null;
  const progressLine = repsRemaining > 0
    ? `${reps} done. ${repsRemaining} left. Stay locked in.`
    : `Strong finish. ${reps} reps complete.`;

  const line = exerciseName
    ? `${exerciseName}. ${progressLine}`
    : MOTIVATION_LINES[Math.floor(Math.random() * MOTIVATION_LINES.length)];
  speakCoach(line, options);

  channelMotivationState[channel] = {
    lastTime: now,
    lastRep: reps,
  };
}

export { DEFAULT_VOICE_MODEL, VOICE_MODEL_OPTIONS };