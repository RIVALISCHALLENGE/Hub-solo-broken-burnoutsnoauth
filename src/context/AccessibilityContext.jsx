import React, { createContext, useContext, useState } from "react";

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const toggleVoice = () => {
    setVoiceEnabled((prev) => !prev);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        voiceEnabled,
        toggleVoice,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within AccessibilityProvider");
  }
  return context;
};
