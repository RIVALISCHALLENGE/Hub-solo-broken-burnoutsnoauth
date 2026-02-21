import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccessibility } from "../../context/AccessibilityContext";

export function VoiceNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    voiceEnabled,
    speak,
    addHistory,
    randomLine
  } = useAccessibility();

  useEffect(() => {
    if (!voiceEnabled) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speak("Voice not supported here.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase();
      const confidence = result[0].confidence;

      addHistory(transcript, confidence);

      if (confidence < 0.6) {
        speak("Speak with confidence.");
        return;
      }

      if (transcript.includes("help")) {
        speak(
          "Say things like: take me to dashboard. Read headings. Click login. Fill email with your address."
        );
        return;
      }

      if (transcript.includes("where am i")) {
        const page = location.pathname.replace("/", "") || "home";
        speak(`You’re on ${page}. Stay locked in.`);
        return;
      }

      if (transcript.includes("dashboard")) {
        navigate("/dashboard");
        speak(randomLine("navigation"));
        return;
      }

      if (transcript.includes("admin")) {
        navigate("/admin/metrics");
        speak("Admin console loaded. Stay sharp.");
        return;
      }

      if (transcript.includes("login")) {
        navigate("/login");
        speak(randomLine("navigation"));
        return;
      }

      if (transcript.includes("click")) {
        const target = transcript.replace("click", "").trim();
        const buttons = document.querySelectorAll("button");

        let clicked = false;

        buttons.forEach((btn) => {
          if (btn.innerText.toLowerCase().includes(target)) {
            btn.click();
            clicked = true;
          }
        });

        speak(clicked ? randomLine("navigation") : randomLine("error"));
        return;
      }

      speak(randomLine("error"));
    };

    recognition.start();

    return () => recognition.stop();
  }, [voiceEnabled, navigate, location, speak, addHistory, randomLine]);

  return null;
}