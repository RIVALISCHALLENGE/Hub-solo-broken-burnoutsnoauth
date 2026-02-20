import React, { useEffect, useState } from 'react';
import { useTTS } from '../context/TTSContext.jsx';
import { waitForVoices } from '../services/tts.js';

export default function TTSSettings() {
  const { enabled, setEnabled, voiceName, setVoiceName } = useTTS();
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const v = await waitForVoices();
        if (mounted) setVoices(v || []);
      } catch (e) {
        console.warn('Could not load voices', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Voice / Accessibility</h2>
      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Voice Enabled</label>
        <button onClick={() => setEnabled(!enabled)}>{enabled ? 'Disable Voice' : 'Enable Voice'}</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: 'block', marginBottom: 6 }}>Voice Model</label>
        <select value={voiceName} onChange={(e) => setVoiceName(e.target.value)}>
          <option value={voiceName}>{voiceName} (current)</option>
          {voices.map((v) => (
            <option key={`${v.name}-${v.lang}`} value={v.name}>{v.name} — {v.lang}</option>
          ))}
        </select>
      </div>

      <p style={{ marginTop: 12, color: '#bbb' }}>Tip: Tap the top-left of the screen 5× to toggle accessibility mode (reads the screen).</p>
    </div>
  );
}
