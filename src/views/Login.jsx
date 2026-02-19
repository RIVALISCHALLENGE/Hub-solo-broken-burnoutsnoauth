import React, { useState } from "react";
import { auth } from "../firebase.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "firebase/auth";
import { UserService } from "../services/userService.js";
import { useNavigate } from "react-router-dom";

const styles = {
  rivalisTitle: {
    fontFamily: "'Press Start 2P', cursive",
    fontSize: "clamp(1.5rem, 6vw, 2.5rem)",
    fontWeight: "normal",
    color: "var(--logo-color)",
    textTransform: "uppercase",
    letterSpacing: "2px",
    margin: "0 0 1.5rem 0",
    textShadow: "none",
    animation: "slamIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards, pulse 2s ease-in-out 0.8s infinite",
    transformOrigin: "center center",
    lineHeight: "1.5",
    wordBreak: "keep-all",
    whiteSpace: "nowrap",
    overflow: "visible",
    textAlign: "center",
    cursor: "pointer"
  },
  tagline: {
    fontSize: "0.75rem",
    color: "var(--text-color)",
    margin: "0 0 1.5rem 0",
    opacity: 0,
    animation: "fadeIn 0.5s ease-in 0.6s forwards",
    fontFamily: "'Press Start 2P', cursive",
    lineHeight: "1.8",
    whiteSpace: "pre-line",
    textAlign: "center"
  },
  forgotPassword: {
    background: "none",
    border: "none",
    color: "var(--text-color)",
    fontSize: "0.7rem",
    marginTop: "0.5rem",
    cursor: "pointer",
    textDecoration: "underline",
    fontFamily: "'Press Start 2P', cursive",
  }
};

export default function Login({ isA11yEnabled }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (isA11yEnabled) {
      const msg = new SpeechSynthesisUtterance("Login page. Please enter your email and password.");
      window.speechSynthesis.speak(msg);
    }
  }, [isA11yEnabled]);

  const handleTitleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    if (newCount >= 5) {
      navigate("/admin-control");
    }
    // Reset click count after 3 seconds of inactivity
    setTimeout(() => setClickCount(0), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await setPersistence(auth, browserLocalPersistence);
      if (isSignup) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        const tempNickname = `User${userCredential.user.uid.slice(0, 6)}`;
        await UserService.createUserProfile(userCredential.user.uid, {
          nickname: tempNickname,
          avatarURL: ""
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent!");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="hero-background">
      <div className="overlay-card">
        <h1 style={styles.rivalisTitle} onClick={handleTitleClick}>RIVALIS</h1>
        <p style={styles.tagline}>GET HOOKED.{'\n'}OUT-TRAIN.{'\n'}OUT-RIVAL.</p>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={{ marginTop: "0.75rem" }}>{isSignup ? "Sign Up" : "Login"}</button>
        </form>
        {!isSignup && (
          <button onClick={handleForgotPassword} style={styles.forgotPassword}>
            Forgot Password?
          </button>
        )}
        {error && <p style={{color:"var(--text-color)", fontWeight: "bold", marginTop: "1rem"}}>{error}</p>}
        {message && <p style={{color:"var(--text-color)", fontWeight: "bold", marginTop: "1rem"}}>{message}</p>}
        <p style={{marginTop:"1rem", color: "var(--text-color)"}}>
          <button onClick={() => setIsSignup(!isSignup)} style={{color: "var(--text-color)"}}>
            {isSignup ? "Already have an account? Login" : "Don't have an account? Sign Up"}
          </button>
        </p>
      </div>
      <style>{`
        @keyframes slamIn {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          70% {
            transform: scale(1.2) rotate(10deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
