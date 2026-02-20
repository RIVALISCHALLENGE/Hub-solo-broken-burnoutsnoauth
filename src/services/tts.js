// Minimal TTS service using Web Speech API.
// Provides a polite API for speaking text and selecting a preferred voice.

function waitForVoices() {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) return resolve(voices);
    const onVoicesChanged = () => {
      const v = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(v);
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    // fallback timeout
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

export { waitForVoices };

async function findVoice(preferredName) {
  const voices = await waitForVoices();

  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }

  // Prefer `Karen` by name, then any en-AU voice, then default voice.
  const karen = voices.find((v) => /karen/i.test(v.name));
  if (karen) return karen;

  const enAu = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en-au'));
  if (enAu) return enAu;

  return voices[0] || null;
}

export async function speak(text, opts = {}) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();

  const { voiceName, rate = 1, pitch = 1, cancel = false } = opts;

  const voice = await findVoice(voiceName);

  return new Promise((resolve, reject) => {
    try {
      if (cancel) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      if (voice) u.voice = voice;
      if (rate) u.rate = rate;
      if (pitch) u.pitch = pitch;
      u.onend = () => resolve();
      u.onerror = (e) => reject(e);
      window.speechSynthesis.speak(u);
    } catch (err) {
      // swallow errors to avoid breaking app flows
      console.error('TTS speak failed', err);
      resolve();
    }
  });
}

export async function speakScreen(opts = {}) {
  if (typeof document === 'undefined') return;
  // gather visible text from body; keep it simple
  const body = document.body;
  if (!body) return;
  const text = body.innerText || body.textContent || '';
  // limit size to avoid extremely long reads
  const snippet = text.trim().slice(0, 20000);
  return speak(snippet, opts);
}

export async function speakCredentials(email, password, opts = {}) {
  // intentionally speak credentials as requested by the user
  const pwd = typeof password === 'string' ? password : String(password || '');
  const msg = `Email: ${email || 'blank'}. Password: ${pwd || 'blank'}.`;
  return speak(msg, opts);
}

export default {
  speak,
  speakScreen,
  speakCredentials,
};
