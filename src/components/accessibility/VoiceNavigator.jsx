import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccessibility } from "../../context/AccessibilityContext";

export function VoiceNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { voiceEnabled, speak, addHistory, randomLine } = useAccessibility();

  useEffect(() => {
    if (!voiceEnabled) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speak("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    const routes = {
      dashboard: "/dashboard",
      login: "/login",
      admin: "/admin/metrics",
    };

    const normalize = (text) => {
      return text
        .toLowerCase()
        .replace(/[.,!?]/g, "")
        .replace("take me to", "")
        .replace("go to", "")
        .replace("open", "")
        .replace("please", "")
        .trim();
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcriptRaw = result[0].transcript;
      const confidence = result[0].confidence;

      addHistory(transcriptRaw, confidence);

      const transcript = normalize(transcriptRaw);

      if (confidence < 0.5) {
        speak("Say that again clearly.");
        return;
      }

      if (transcript.includes("help")) {
        speak(
          "You can say things like: take me to dashboard, go to admin, where am I, read headings, click login, or fill email with your address."
        );
        return;
      }

      if (transcript.includes("where am i")) {
        const page = location.pathname.replace("/", "") || "home";
        speak(`You’re on ${page}.`);
        return;
      }

      if (transcript.includes("read headings")) {
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

      // Route matching
      for (let key in routes) {
        if (transcript.includes(key)) {
          navigate(routes[key]);
          speak(randomLine("navigation"));
          return;
        }
      }

      // Click button
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

        speak(found ? randomLine("navigation") : randomLine("error"));
        return;
      }

      // Fill form
      if (transcript.startsWith("fill")) {
        const parts = transcript.replace("fill", "").split("with");

        if (parts.length === 2) {
          const fieldName = parts[0].trim();
          const value = parts[1].trim();
          const inputs = document.querySelectorAll("input");

          let filled = false;

          inputs.forEach((input) => {
            if (
              input.name?.toLowerCase().includes(fieldName) ||
              input.placeholder?.toLowerCase().includes(fieldName)
            ) {
              input.value = value;
              input.dispatchEvent(new Event("input", { bubbles: true }));
              filled = true;
            }
          });

          speak(filled ? "Field filled." : "Field not found.");
          return;
        }
      }

      speak(randomLine("error"));
    };

    recognition.onerror = () => {
      recognition.stop();
      recognition.start();
    };

    recognition.start();

    return () => recognition.stop();
  }, [voiceEnabled, navigate, location, speak, addHistory, randomLine]);

  return null;
}