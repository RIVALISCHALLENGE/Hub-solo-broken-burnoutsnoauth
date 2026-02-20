TTS Integration
================

Summary
- Added a minimal Web Speech API-based TTS service and React context.
- Accessibility mode toggles when the top-left of the screen is tapped 5× (within ~1.5s).
- Accessibility mode reads the visible screen text when activated and remains active until toggled off the same way.
- Exercises (Live view) will announce exercise instructions and rep counts by default.
- Settings page available at `/tts-settings` to change voice model or disable voice for the user.

How to use from components
- Import the hook: `import { useTTS } from '../context/TTSContext.jsx'`
- API available from the hook:
  - `enabled` (boolean) — whether voice is enabled for the user
  - `setEnabled(bool)` — turn voice on/off
  - `voiceName` / `setVoiceName(name)` — preferred voice name
  - `accessibilityActive` — whether accessibility mode is active
  - `speak(text, opts)` — speak short text
  - `speakScreen(opts)` — read screen content
  - `speakCredentials(email, password, opts)` — speak credentials (explicitly supported)

Files added/modified
- `src/services/tts.js` — TTS service (speak, speakScreen, speakCredentials, waitForVoices)
- `src/context/TTSContext.jsx` — React context/provider exposing the API
- `src/logic/voiceControl.js` — updated to toggle accessibility mode by 5× top-left taps
- `src/views/TTSSettings.jsx` — simple settings UI for voice and accessibility
- `src/App.jsx` — route added for `/tts-settings`
- `src/components/Navbar.jsx` — added menu link to settings
- `src/views/Live.jsx` — announces exercise instructions and rep counts

Notes & next steps
- Chatbot voice (`ChatbotTour`) uses its own voiceCoach subsystem; if you want the chatbot to use the same `Karen (en-AU)` TTS, I can update `logic/voiceCoach.js` to consult `TTSContext` or the same voices.
- If you want the accessibility toggle area or thresholds adjusted, I can change the top-left area size.
