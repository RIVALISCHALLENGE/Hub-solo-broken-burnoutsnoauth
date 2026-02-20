import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import TTS from '../services/tts.js';

const TTSContext = createContext(null);

export function useTTS() {
  return useContext(TTSContext);
}

export function TTSProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('tts.enabled');
      return v === null ? true : v === '1';
    } catch (e) {
      return true;
    }
  });

  const [voiceName, setVoiceName] = useState(() => {
    try {
      return localStorage.getItem('tts.voice') || 'Karen (en-AU)';
    } catch (e) {
      return 'Karen (en-AU)';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('tts.enabled', enabled ? '1' : '0'); } catch {}
  }, [enabled]);

  useEffect(() => {
    try { localStorage.setItem('tts.voice', voiceName); } catch {}
  }, [voiceName]);

  const [accessibilityActive, setAccessibilityActive] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      const next = !!(e && e.detail && e.detail.active);
      setAccessibilityActive(next);
      // when accessibility is activated, read the screen immediately
      if (next) {
        // give time for focus changes
        setTimeout(() => {
          TTS.speakScreen({ voiceName });
        }, 250);
      }
    };
    window.addEventListener('accessibility-mode', handler);
    return () => window.removeEventListener('accessibility-mode', handler);
  }, [voiceName]);

  const speak = useCallback(async (text, opts = {}) => {
    if (!enabled) return;
    const { bypassLock = false } = opts || {};
    if (!bypassLock && !accessibilityActive) return;
    return TTS.speak(text, { ...opts, voiceName });
  }, [enabled, voiceName]);

  const speakScreen = useCallback((opts = {}) => {
    if (!enabled) return;
    return TTS.speakScreen({ ...opts, voiceName });
  }, [enabled, voiceName]);

  const speakCredentials = useCallback((email, password, opts = {}) => {
    if (!enabled) return;
    return TTS.speakCredentials(email, password, { ...opts, voiceName });
  }, [enabled, voiceName]);

  const value = {
    enabled,
    setEnabled,
    voiceName,
    setVoiceName,
    accessibilityActive,
    setAccessibilityActive,
    speak,
    speakScreen,
    speakCredentials,
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

export default TTSContext;
