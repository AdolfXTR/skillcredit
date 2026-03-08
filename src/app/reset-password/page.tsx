"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [ready, setReady] = useState(false);

  // Supabase puts the token in the URL hash — we need to wait for the session
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
  }, []);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none",
    background: "#fafaf8", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
  };

  async function handleReset() {
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: form.password });
    if (error) { setError(error.message); setLoading(false); return; }

    setDone(true);
    setLoading(false);
    setTimeout(() => { window.location.href = "/dashboard"; }, 2500);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fffdf7", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing: border-box }
        input:focus { border-color: #2d6a4f !important }
        .btn { width:100%; padding:14px; background:#2d6a4f; color:white; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif; transition:background .2s }
        .btn:hover { background:#235c42 }
        .btn:disabled { background:#a8c5b5; cursor:not-allowed }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .fade { animation: fadeUp .25s ease }
      `}</style>

      <div style={{ position:"fixed", top:-100, right:-100, width:400, height:400, borderRadius:"50%", background:"#2d6a4f", opacity:0.04, pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-80, left:-80, width:300, height:300, borderRadius:"50%", background:"#b45309", opacity:0.04, pointerEvents:"none" }} />

      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <a href="/" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        </div>

        <div style={{ background: "white", borderRadius: 24, padding: "40px", boxShadow: "0 4px 40px rgba(0,0,0,0.08)", border: "1px solid #f0ece4" }}>

          {/* Success */}
          {done && (
            <div className="fade" style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>Password updated!</h1>
              <p style={{ fontSize: 14, color: "#888" }}>Redirecting you to your dashboard…</p>
            </div>
          )}

          {/* Waiting for token */}
          {!done && !ready && (
            <div className="fade" style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
              <p style={{ fontSize: 14, color: "#888" }}>Verifying your reset link…</p>
            </div>
          )}

          {/* Reset form */}
          {!done && ready && (
            <div className="fade">
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>🔑</div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Set a new password</h1>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>Choose a strong password for your account.</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>New Password</label>
                  <input style={inputStyle} type="password" placeholder="At least 8 characters"
                    value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e8e0d0"} />
                  {form.password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ height: 3, flex: 1, borderRadius: 999, background: form.password.length >= i*2 ? (form.password.length >= 8 ? "#2d6a4f" : "#f59e0b") : "#e8e0d0" }} />
                        ))}
                      </div>
                      <p style={{ fontSize: 11, color: form.password.length >= 8 ? "#2d6a4f" : "#f59e0b" }}>
                        {form.password.length < 4 ? "Too short" : form.password.length < 8 ? "Getting there..." : "Strong password ✓"}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Confirm Password</label>
                  <input
                    style={{ ...inputStyle, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? "#dc2626" : "#e8e0d0" }}
                    type="password" placeholder="Repeat your new password"
                    value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = form.confirmPassword !== form.password ? "#dc2626" : "#e8e0d0"} />
                  {form.confirmPassword && form.confirmPassword !== form.password && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>Passwords don't match</p>}
                  {form.confirmPassword && form.confirmPassword === form.password && <p style={{ fontSize: 11, color: "#2d6a4f", marginTop: 4 }}>✓ Passwords match</p>}
                </div>
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginTop: 16 }}>
                  <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>⚠️ {error}</p>
                </div>
              )}

              <button className="btn" style={{ marginTop: 24 }} onClick={handleReset} disabled={loading}>
                {loading ? "Updating password…" : "Update password →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}