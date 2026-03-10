"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const ACTIVITY = [
  { icon: "🔥", text: "Maria earned 12 credits teaching Python" },
  { icon: "🏆", text: "Alex became this week's champion" },
  { icon: "🎸", text: "Guitar lesson just completed" },
  { icon: "🌍", text: "Spanish session booked for tomorrow" },
  { icon: "💡", text: "Kevin unlocked the Expert level" },
  { icon: "📚", text: "Calculus session rated 5 stars ⭐" },
  { icon: "🎨", text: "UI Design bounty was just answered" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({ email: "", password: "" });
  const [activityIdx, setActivityIdx] = useState(0);
  const [activityVisible, setActivityVisible] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Cycle activity feed
  useEffect(() => {
    const interval = setInterval(() => {
      setActivityVisible(false);
      setTimeout(() => {
        setActivityIdx(i => (i + 1) % ACTIVITY.length);
        setActivityVisible(true);
      }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

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
    <div style={{ minHeight:"100vh", background:"#f8f6f0", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        /* Blobs */
        .blob{position:fixed;border-radius:50%;pointer-events:none;filter:blur(0px)}

        /* Inputs */
        .sc-input{width:100%;padding:13px 16px 13px 44px;border-radius:12px;border:1.5px solid #e8e0d0;font-size:14px;outline:none;background:#fafaf8;font-family:'DM Sans',sans-serif;color:#1a1a1a;transition:border-color .18s,box-shadow .18s}
        .sc-input:focus{border-color:#2d6a4f;box-shadow:0 0 0 3px rgba(45,106,79,.12)}
        .sc-input::placeholder{color:#c4bdb1}

        /* Button */
        .sc-btn{width:100%;padding:15px;background:#2d6a4f;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .18s,transform .15s,box-shadow .18s;letter-spacing:.01em}
        .sc-btn:hover:not(:disabled){background:#1e5038;transform:translateY(-2px);box-shadow:0 12px 28px rgba(45,106,79,.28)}
        .sc-btn:active:not(:disabled){transform:translateY(0)}
        .sc-btn:disabled{background:#a8c5b5;cursor:not-allowed}

        /* Activity ticker */
        .activity-pill{transition:opacity .35s ease,transform .35s ease}
        .activity-pill.hidden{opacity:0;transform:translateY(6px)}
        .activity-pill.visible{opacity:1;transform:translateY(0)}

        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .fade-card{animation:fadeUp .3s ease both}

        @keyframes float0{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-18px)}}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(-10px,14px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(8px,20px)}}
        .blob-0{animation:float0 9s ease-in-out infinite}
        .blob-1{animation:float1 12s ease-in-out infinite}
        .blob-2{animation:float2 15s ease-in-out infinite}
      `}</style>

      {/* Background blobs */}
      <div className="blob blob-0" style={{ top:"-140px", left:"-120px", width:480, height:480, background:"radial-gradient(circle,#c8e6d4,transparent 70%)", opacity:.65 }} />
      <div className="blob blob-1" style={{ bottom:"-100px", right:"-80px", width:400, height:400, background:"radial-gradient(circle,#e8d9c0,transparent 70%)", opacity:.55 }} />
      <div className="blob blob-2" style={{ top:"55%", left:"60%", width:260, height:260, background:"radial-gradient(circle,#d4e9dc,transparent 70%)", opacity:.4 }} />

      <div style={{ width:"100%", maxWidth:440, position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <a href="/" style={{ display:"inline-block", textDecoration:"none" }}>
            <span style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:30, fontWeight:900, color:"#2d6a4f", letterSpacing:"-.5px" }}>Skill</span>
            <span style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:30, fontWeight:900, color:"#1a1a1a", letterSpacing:"-.5px" }}>Credit</span>
          </a>
          <p style={{ fontSize:12, color:"#b0a898", marginTop:5, fontWeight:500 }}>Share skills · Earn credits · Keep learning</p>
        </div>

        {/* Card */}
        <div className="fade-card" style={{ background:"rgba(255,255,255,.92)", backdropFilter:"blur(16px)", borderRadius:24, padding:"38px 40px 32px", boxShadow:"0 8px 48px rgba(0,0,0,.09),0 2px 8px rgba(0,0,0,.04)", border:"1px solid rgba(240,236,228,.9)" }}>

          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:800, color:"#1a1a1a", marginBottom:6, letterSpacing:"-.3px" }}>
              Welcome back 👋
            </h1>
            <p style={{ fontSize:13.5, color:"#999", lineHeight:1.5 }}>Continue learning and earning credits.</p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7, letterSpacing:".01em" }}>Email address</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none", lineHeight:1 }}>✉️</span>
                <input className="sc-input" type="email" placeholder="juan@email.com"
                  value={form.email} onChange={e => update("email", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <label style={{ fontSize:12.5, fontWeight:700, color:"#444", letterSpacing:".01em" }}>Password</label>
                <a href="/forgot-password" style={{ fontSize:12, color:"#2d6a4f", fontWeight:600, textDecoration:"none", opacity:.85 }}>Forgot?</a>
              </div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, pointerEvents:"none", lineHeight:1 }}>🔒</span>
                <input className="sc-input" type={showPassword ? "text" : "password"} placeholder="Your password"
                  value={form.password} onChange={e => update("password", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
                <button onClick={() => setShowPassword(s => !s)}
                  style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#bbb", padding:4, lineHeight:1 }}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:11, padding:"10px 14px", marginTop:16 }}>
              <p style={{ color:"#dc2626", fontSize:13, margin:0 }}>⚠️ {error}</p>
            </div>
          )}

          <button className="sc-btn" style={{ marginTop:22 }} onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in…" : "Log in →"}
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"22px 0 0" }}>
            <div style={{ flex:1, height:"1px", background:"#ede9e1" }} />
            <span style={{ fontSize:12, color:"#c4bdb1", fontWeight:600 }}>live on SkillCredit</span>
            <div style={{ flex:1, height:"1px", background:"#ede9e1" }} />
          </div>

          {/* Live activity ticker */}
          <div style={{ marginTop:14, background:"#f5f2ec", borderRadius:12, padding:"10px 14px", minHeight:42, display:"flex", alignItems:"center" }}>
            <div className={`activity-pill ${activityVisible ? "visible" : "hidden"}`} style={{ display:"flex", alignItems:"center", gap:9 }}>
              <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>{ACTIVITY[activityIdx].icon}</span>
              <span style={{ fontSize:12.5, color:"#666", fontWeight:500, lineHeight:1.4 }}>{ACTIVITY[activityIdx].text}</span>
            </div>
          </div>
        </div>

        {/* Footer link */}
        <p style={{ textAlign:"center", marginTop:20, fontSize:13.5, color:"#999" }}>
          Don't have an account?{" "}
          <a href="/signup" style={{ color:"#2d6a4f", fontWeight:700, textDecoration:"none" }}>
            Sign up free — get 20 credits 🎁
          </a>
        </p>
      </div>
    </div>
  );
}