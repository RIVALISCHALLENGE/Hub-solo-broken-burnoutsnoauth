import React, { useState, useEffect, useCallback } from 'react';
import { useAccessibility } from '../../context/AccessibilityContext';

export const VoiceNavigator = () => {
  const { isEnabled, isVoiceActive, setIsVoiceActive, speak } = useAccessibility();
  const [isListening, setIsListening] = useState(false);

  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      speak("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      speak("Listening");
    };

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      handleCommand(command);
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [speak]);

  const handleCommand = (command) => {
    if (command.includes('go to') || command.includes('navigate to')) {
      const destination = command.replace('go to', '').replace('navigate to', '').trim();
      speak(`Navigating to ${destination}`);
      const elements = document.querySelectorAll('a, button');
      for (const el of elements) {
        if (el.innerText.toLowerCase().includes(destination)) {
          el.click();
          return;
        }
      }
      speak(`Could not find ${destination}`);
    } else if (command.includes('read screen')) {
      const text = document.body.innerText;
      speak(text);
    } else {
      speak(`I heard ${command}, but I don't know how to handle that yet.`);
    }
  };

  if (!isEnabled) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 10000,
        background: isListening ? 'red' : 'blue',
        color: 'white',
        padding: '10px',
        borderRadius: '50%',
        cursor: 'pointer',
        width: '60px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}
      onClick={startListening}
      aria-label="Voice Navigation"
    >
      {isListening ? '🎤' : '🗣️'}
    </div>
  );
};
