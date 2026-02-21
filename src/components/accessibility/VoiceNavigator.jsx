import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccessibility } from "../../context/AccessibilityContext";

export function VoiceNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { voiceEnabled, speak, addHistory, randomLine } = useAccessibility();

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!voiceEnabled) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speak("Voice recognition not supported.");
      return;
    }

    // Stop any previous instance
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    // Auto read page content when activated
    setTimeout(() => {
      const headings = document.querySelectorAll("h1, h2");
      if (headings.length) {
        const text = Array.from(headings)
          .map((h) => h.innerText)
          .join(". ");
        speak(`You are on ${location.pathname.replace("/", "")}. ${text}`);
      }
    }, 500);

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase();
      const confidence = result[0].confidence;

      console.log("Heard:", transcript, "Confidence:", confidence);

      addHistory(transcript, confidence);

      if (confidence < 0.4) {
        speak("Speak clearly.");
        return;
      }

      if (transcript.includes("help")) {
        speak(
          "You can say dashboard, admin, login, where am I, read page, click button name, or fill field with value."
        );
        return;
      }

      if (transcript.includes("where am i")) {
        speak(`You are on ${location.pathname.replace("/", "")}.`);
        return;
      }

      if (transcript.includes("read page")) {
        const headings = document.querySelectorAll("h1, h2, h3");
        if (!headings.length) {
          speak("No headings found.");
          return;
        }
        const text = Array.from(headings)
          .map((h) => h.innerText)
          .join(". ");
        speak(text);
        return;
      }

      if (transcript.includes("dashboard")) {
        navigate("/dashboard");
        speak(randomLine("navigation"));
        return;
      }

      if (transcript.includes("admin")) {
        navigate("/admin/metrics");
        speak(randomLine("navigation"));
        return;
      }

      if (transcript.includes("login")) {
        navigate("/login");
        speak(randomLine("navigation"));
        return;
      }

      if (transcript.startsWith("click")) {
        const target = transcript.replace("click", "").trim();
        const buttons = document.querySelectorAll("button");

        let found = false;

        buttons.forEach((btn) => {
          if (btn.innerText.toLowerCase().includes(target)) {
            btn.click();
            found = true;
          }
        });

        speak(found ? randomLine("navigation") : "Button not found.");
        return;
      }

      speak("Command not recognized.");
    };

    recognition.onerror = (err) => {
      console.log("Recognition error:", err);
      recognition.stop();
      recognition.start();
    };

    recognition.onend = () => {
      recognition.start();
    };

    recognition.start();

    return () => recognition.stop();
  }, [voiceEnabled, navigate, location, speak, addHistory, randomLine]);

  return null;
}