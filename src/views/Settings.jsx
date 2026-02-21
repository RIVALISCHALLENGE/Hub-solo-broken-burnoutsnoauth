import React, { useEffect, useState } from "react";
import ChangePasswordForm from "../components/ChangePasswordForm";
import { SubscriptionService } from "../services/subscriptionService";

const getVoices = () => {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
};

export default function Settings() {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('voiceName') || "");

  useEffect(() => {
    const populateVoices = () => {
      const v = getVoices();
      setVoices(v);
      if (!selectedVoice && v.length > 0) {
        setSelectedVoice(v[0].name);
      }
    };
    populateVoices();
    if (window.speechSynthesis.onvoiceschanged !== populateVoices) {
      window.speechSynthesis.onvoiceschanged = populateVoices;
    }
  }, [selectedVoice]);

  const handleVoiceChange = (e) => {
    setSelectedVoice(e.target.value);
    localStorage.setItem('voiceName', e.target.value);
  };

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  const openBillingPortal = async () => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const url = await SubscriptionService.openPortal();
      window.open(url, "_blank");
    } catch (err) {
      setBillingError(err.message || "Failed to open billing portal.");
    }
    setBillingLoading(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 500, margin: "0 auto" }}>
      <h2>Settings</h2>
      <div style={{ margin: "24px 0" }}>
        <label htmlFor="voice-select" style={{ fontWeight: 600 }}>Voice Model:</label>
        <select id="voice-select" value={selectedVoice} onChange={handleVoiceChange} style={{ marginLeft: 12, padding: 6 }}>
          {voices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {voice.name} ({voice.lang}){voice.default ? " [default]" : ""}
            </option>
          ))}
        </select>
        <button style={{ marginLeft: 16 }} onClick={() => {
          const v = voices.find(v => v.name === selectedVoice);
          if (v) {
            const u = new window.SpeechSynthesisUtterance("This is a test of the selected voice model.");
            u.voice = v;
            window.speechSynthesis.speak(u);
          }
        }}>Test Voice</button>
      </div>
      <ChangePasswordForm />
      <div style={{ marginTop: 40 }}>
        <h3>Billing & Subscription</h3>
        <button onClick={openBillingPortal} disabled={billingLoading} style={{ padding: "8px 20px", background: "#222", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {/* Stripe integration removed. Billing portal disabled. */}
        </button>
        {billingError && <div style={{ color: "#ff3050", marginTop: 8 }}>{billingError}</div>}
      </div>
    </div>
  );
}
