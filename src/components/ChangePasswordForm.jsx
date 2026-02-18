import React, { useState } from "react";
import { auth } from "../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Not authenticated");
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to update password.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleChangePassword} style={{ marginTop: 32, maxWidth: 400 }}>
      <h3>Change Password</h3>
      <div style={{ marginBottom: 12 }}>
        <label>Current Password</label>
        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={{ width: "100%", padding: 6 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>New Password</label>
        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={{ width: "100%", padding: 6 }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Confirm New Password</label>
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={{ width: "100%", padding: 6 }} />
      </div>
      {error && <div style={{ color: "#ff3050", marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: "#00c853", marginBottom: 8 }}>{success}</div>}
      <button type="submit" disabled={loading} style={{ padding: "8px 20px", background: "#ff3050", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
        {loading ? "Updating..." : "Change Password"}
      </button>
    </form>
  );
}
