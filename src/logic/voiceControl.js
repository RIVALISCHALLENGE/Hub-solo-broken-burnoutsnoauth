// Voice control: 5-tap activation/deactivation + SpeechRecognition wrapper
// Usage: call initializeVoiceControl() once at app startup.

const TAP_REQUIRED = 5;
const TAP_WINDOW_MS = 1500; // time window to count taps

let tapTimestamps = [];
let active = false;
let recognition = null;
let accessibilityActive = false;

function supportsRecognition() {
  return typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
}

function speak(text) {
  try {
    if (window && window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
      // reuse existing audio feedback system if present
      if (window?.__speakFeedback) {
        window.__speakFeedback(text);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  } catch (e) {
    console.debug('speak failed', e);
  }
}

function startRecognition() {
  if (!supportsRecognition()) {
    speak('Voice recognition not supported in this browser');
    return;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = (navigator.language || 'en-US');
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    active = true;
    window.dispatchEvent(new CustomEvent('voice-control-active', { detail: true }));
    speak('Voice control activated');
  };

  recognition.onend = () => {
    active = false;
    window.dispatchEvent(new CustomEvent('voice-control-active', { detail: false }));
    speak('Voice control stopped');
  };

  recognition.onerror = (evt) => {
    console.warn('Speech recognition error', evt);
    active = false;
    window.dispatchEvent(new CustomEvent('voice-control-error', { detail: evt }));
  };

  recognition.onresult = (evt) => {
    const transcript = evt.results[0][0].transcript.trim();
    window.dispatchEvent(new CustomEvent('voice-command', { detail: { text: transcript } }));
  };

  try {
    recognition.start();
  } catch (e) {
    console.warn('recognition start failed', e);
  }
}

function stopRecognition() {
  try {
    if (recognition && typeof recognition.stop === 'function') recognition.stop();
    recognition = null;
  } catch (e) {
    console.debug('stopRecognition failed', e);
  }
  active = false;
  window.dispatchEvent(new CustomEvent('voice-control-active', { detail: false }));
}

function toggleRecognition() {
  if (active) stopRecognition(); else startRecognition();
}

function recordTap() {
  const now = Date.now();
  tapTimestamps.push(now);
  // prune old taps
  tapTimestamps = tapTimestamps.filter((t) => now - t <= TAP_WINDOW_MS);
  if (tapTimestamps.length >= TAP_REQUIRED) {
    // reset
    tapTimestamps = [];
    // toggle accessibility mode (separate from speech recognition)
    accessibilityActive = !accessibilityActive;
    window.dispatchEvent(new CustomEvent('accessibility-mode', { detail: { active: accessibilityActive } }));
    try { speak(accessibilityActive ? 'Accessibility mode activated' : 'Accessibility mode deactivated'); } catch (e) {}
  }
}

function initializeVoiceControl() {
  if (typeof window === 'undefined') return;

  // expose speak hook for audioFeedback to reuse
  if (!window.__speakFeedback) {
    window.__speakFeedback = (text) => {
      try {
        if (window && window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance(text);
          u.rate = 0.9;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }
      } catch (e) {
        console.debug('fallback speak failed', e);
      }
    };
  }

  // listen for taps on body — count taps anywhere
  // Only count taps in the top-left corner for toggling accessibility mode.
  const handler = (evt) => {
    const tag = evt.target && evt.target.tagName && evt.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || evt.target.isContentEditable) return;
    const x = (evt.clientX != null) ? evt.clientX : (evt.touches && evt.touches[0] && evt.touches[0].clientX) || 0;
    const y = (evt.clientY != null) ? evt.clientY : (evt.touches && evt.touches[0] && evt.touches[0].clientY) || 0;
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    const h = window.innerHeight || document.documentElement.clientHeight || 0;
    // top-left 20% by width and 18% by height
    if (x <= Math.max(64, w * 0.2) && y <= Math.max(64, h * 0.18)) {
      recordTap();
    }
  };

  window.addEventListener('pointerdown', handler, { passive: true });

  // expose programmatic API
  window.VoiceControl = {
    start: startRecognition,
    stop: stopRecognition,
    toggle: toggleRecognition,
    isActive: () => active,
    recordTap,
  };

  // broadcast support flag
  window.dispatchEvent(new CustomEvent('voice-control-ready', { detail: { supported: supportsRecognition() } }));
}

export { initializeVoiceControl, startRecognition, stopRecognition, toggleRecognition };
