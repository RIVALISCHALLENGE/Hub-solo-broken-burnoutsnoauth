// Audio feedback system using Web Speech API
let lastFeedbackTime = 0;
const FEEDBACK_THROTTLE = 3000; // Min time between same feedback (ms)
const feedbackCache = new Set();


// Try to select the most human-like voice available
function getBestVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  // Prioritize Google, Microsoft, Apple, or other neural voices
  const preferred = [
    /Google US English/i,
    /Google UK English/i,
    /Microsoft Aria Online/i,
    /Microsoft Jenny/i,
    /Microsoft Guy/i,
    /Apple Siri/i,
    /en-US/i
  ];
  for (const pattern of preferred) {
    const found = voices.find(v => pattern.test(v.name));
    if (found) return found;
  }
  // Fallback to first English voice
  return voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0] || null;
}

export function speakFeedback(text) {
  if (!('speechSynthesis' in window)) {
    console.log('Web Speech API not supported');
    return;
  }

  const now = Date.now();

  // Throttle repeated feedback
  if (feedbackCache.has(text) && now - lastFeedbackTime < FEEDBACK_THROTTLE) {
    return;
  }

  // Cancel previous speech
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92; // Slightly slower for clarity
  utterance.pitch = 1;
  utterance.volume = 1;

  // Set best available voice
  const setVoice = () => {
    const best = getBestVoice();
    if (best) utterance.voice = best;
    speechSynthesis.speak(utterance);
    feedbackCache.clear();
    feedbackCache.add(text);
  };
  utterance.onend = () => {
    lastFeedbackTime = now;
  };
  // Some browsers load voices asynchronously
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = setVoice;
    speechSynthesis.getVoices();
  } else {
    setVoice();
  }
}

export function speakNumber(num) {
  const text = num === 1 ? `${num} rep` : `${num} reps`;
  speakFeedback(text);
}

export const COACHING_MESSAGES = {
  chest_too_high: "Lower your chest",
  right_hip_high: "Lower your right hip",
  left_hip_high: "Lower your left hip",
  hips_uneven: "Keep your hips level",
  elbow_bent_too_much: "Keep your elbows straighter",
  elbow_not_bent_enough: "Bend your elbows more",
  good_form: "Great form!",
  rep_complete: "Rep complete",
  set_complete: "Set complete",
  push_harder: "Push harder",
  slow_down: "Control the movement"
};

export function getCoachingMessage(issue) {
  if (!issue) return null;
  
  switch (issue.type) {
    case 'uneven_hips':
      return issue.side === 'left' ? COACHING_MESSAGES.left_hip_high : COACHING_MESSAGES.right_hip_high;
    case 'uneven_shoulders':
      return COACHING_MESSAGES.push_harder;
    case 'chest_too_high':
      return COACHING_MESSAGES.chest_too_high;
    case 'elbow_angle':
      return issue.angle < 45 ? COACHING_MESSAGES.elbow_not_bent_enough : COACHING_MESSAGES.elbow_bent_too_much;
    default:
      return null;
  }
}
