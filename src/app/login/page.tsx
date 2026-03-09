"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
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
                <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Password</label>
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
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888" }}>
          Don't have an account?{" "}
          <a href="/signup" style={{ color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>
            Sign up free — get 20 credits 🎁
          </a>
        </p>
      </div>
    </div>
  );
}