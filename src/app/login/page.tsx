"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type View = "login" | "forgot" | "forgot_sent";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none",
    background: "#fafaf8", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
  };

  async function handleLogin() {
    setError("");
    if (!form.email || !form.password) { setError("Please fill in all fields."); return; }
    setLoading(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password,
    });

    if (loginError) { setError(loginError.message); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user!.id).single();

    const role = profile?.role;
    if (role === "admin")          window.location.href = "/admin";
    else if (role === "moderator") window.location.href = "/moderator";
    else if (role === "support")   window.location.href = "/support";
    else                           window.location.href = "/dashboard";
  }

  async function handleForgotPassword() {
    setError("");
    if (!form.email.includes("@")) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setLoading(false);
    setView("forgot_sent");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fffdf7", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
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

      <div style={{ position:"fixed", top:-100, left:-100, width:400, height:400, borderRadius:"50%", background:"#2d6a4f", opacity:0.04, pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-80, right:-80, width:300, height:300, borderRadius:"50%", background:"#b45309", opacity:0.04, pointerEvents:"none" }} />

      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <a href="/" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>
            SkillCredit
          </a>
        </div>

        <div style={{ background: "white", borderRadius: 24, padding: "40px", boxShadow: "0 4px 40px rgba(0,0,0,0.08)", border: "1px solid #f0ece4" }}>

          {/* ── LOGIN ── */}
          {view === "login" && (
            <div className="fade">
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
                  Welcome back! 👋
                </h1>
                <p style={{ fontSize: 14, color: "#888" }}>Log in to continue your skill journey</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Email Address</label>
                  <input style={inputStyle} type="email" placeholder="juan@email.com"
                    value={form.email} onChange={e => update("email", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e8e0d0"} />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>Password</label>
                    <button onClick={() => { setView("forgot"); setError(""); }}
                      style={{ background: "none", border: "none", color: "#2d6a4f", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Forgot password?
                    </button>
                  </div>
                  <input style={inputStyle} type="password" placeholder="Your password"
                    value={form.password} onChange={e => update("password", e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e8e0d0"} />
                </div>
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginTop: 16 }}>
                  <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>⚠️ {error}</p>
                </div>
              )}

              <button className="btn" style={{ marginTop: 24 }} onClick={handleLogin} disabled={loading}>
                {loading ? "Logging in…" : "Log in →"}
              </button>
            </div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot" && (
            <div className="fade">
              <button onClick={() => { setView("login"); setError(""); }}
                style={{ background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>
                ← Back
              </button>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 16 }}>🔐</div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
                Forgot your password?
              </h1>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 28, lineHeight: 1.6 }}>
                Enter your email and we'll send you a link to reset your password.
              </p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Email Address</label>
                <input style={inputStyle} type="email" placeholder="juan@email.com"
                  value={form.email} onChange={e => update("email", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleForgotPassword()}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                  onBlur={e => e.target.style.borderColor = "#e8e0d0"} />
              </div>

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginTop: 16 }}>
                  <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>⚠️ {error}</p>
                </div>
              )}

              <button className="btn" style={{ marginTop: 24 }} onClick={handleForgotPassword} disabled={loading}>
                {loading ? "Sending reset link…" : "Send reset link →"}
              </button>
            </div>
          )}

          {/* ── FORGOT SENT ── */}
          {view === "forgot_sent" && (
            <div className="fade" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📬</div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 8 }}>
                We sent a password reset link to
              </p>
              <div style={{ background: "#f0faf4", border: "1px solid #b7e4c7", borderRadius: 10, padding: "10px 16px", marginBottom: 24, display: "inline-block" }}>
                <strong style={{ color: "#2d6a4f", fontSize: 14 }}>{form.email}</strong>
              </div>
              <p style={{ fontSize: 13, color: "#aaa", marginBottom: 28, lineHeight: 1.6 }}>
                Click the link in the email to reset your password.<br />It expires in 1 hour.
              </p>
              <button className="btn" onClick={() => { setView("login"); setForm({ email: "", password: "" }); }}>
                Back to login
              </button>
              <button onClick={handleForgotPassword}
                style={{ background: "none", border: "none", color: "#2d6a4f", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 14, display: "block", width: "100%", fontFamily: "'DM Sans', sans-serif" }}>
                Resend email
              </button>
            </div>
          )}
        </div>

        {view === "login" && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888" }}>
            Don't have an account?{" "}
            <a href="/signup" style={{ color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>
              Sign up free — get 20 credits 🎁
            </a>
          </p>
        )}
      </div>
    </div>
  );
}