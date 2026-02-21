import React, { createContext, useContext, useState } from "react";

const AccessibilityContext = createContext();

const hypeResponses = {
  activate: [
    "Rivalis mode engaged. Let’s work.",
    "Voice control activated. Stay sharp.",
    "Assistant online. What’s the move?",
    "We’re live. Command me."
  ],
  navigation: [
    "Moving.",
    "Done.",
    "On it.",
    "Let’s go."
  ],
  error: [
    "Didn’t catch that. Stay focused.",
    "Say that again with intent.",
    "Command unclear. Try again.",
    "Not locked in. Repeat that."
  ]
};

export function AccessibilityProvider({ children }) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [history, setHistory] = useState([]);

  const randomLine = (category) =>
    hypeResponses[category][
      Math.floor(Math.random() * hypeResponses[category].length)
    ];

  const speak = (text, force = false) => {
    if (!ttsEnabled && !force) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    window.speechSynthesis.speak(utterance);
  };

  const enableAccessibility = () => {
    setTtsEnabled(true);
    setVoiceEnabled(true);

    speak(randomLine("activate"), true);
  };

  const addHistory = (command, confidence) => {
    setHistory((prev) => [
      { command, confidence, timestamp: Date.now() },
      ...prev.slice(0, 19),
    ]);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        ttsEnabled,
        voiceEnabled,
        history,
        enableAccessibility,
        speak,
        addHistory,
        randomLine
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);