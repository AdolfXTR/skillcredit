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

export default function SignupPage() {
  const [step, setStep]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({
    email: "", password: "", confirmPassword: "", username: "", full_name: "",
  });
  const [showPass, setShowPass]    = useState(false);
  const [showConf, setShowConf]    = useState(false);
  const [activityIdx, setActivityIdx]     = useState(0);
  const [activityVisible, setActivityVisible] = useState(true);

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

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

  const progress = (current: number) => (
    <div style={{ display:"flex", gap:5, marginBottom:26 }}>
      {[1,2].map(s => (
        <div key={s} style={{ height:3, flex:1, borderRadius:999, background:s<=current?"#2d6a4f":"#e8e0d0", transition:"background .3s ease" }} />
      ))}
    </div>
  );

  async function handleStep1() {
    setError("");
    if (!form.full_name.trim())   { setError("Please enter your full name."); return; }
    if (form.username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (!/^[a-z0-9_]+$/.test(form.username)) { setError("Username can only contain letters, numbers, and underscores."); return; }
    if (!form.email.includes("@")) { setError("Please enter a valid email."); return; }
    setLoading(true);
    const { data: existing } = await supabase.from("profiles").select("id").eq("username", form.username).maybeSingle();
    if (existing) { setError("That username is already taken."); setLoading(false); return; }
    setLoading(false);
    setStep(2);
  }

  async function handleStep2() {
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { username: form.username, full_name: form.full_name }, emailRedirectTo: undefined },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("credit_transactions").insert({
        user_id: data.user.id, amount: 20, type: "signup_bonus",
        description: "Welcome to SkillCredit! 🎁 20 free credits to get started.",
      });
      setStep(3);
    }
    setLoading(false);
  }

  const pwStrength = form.password.length === 0 ? 0 : form.password.length < 4 ? 1 : form.password.length < 8 ? 2 : form.password.length < 12 ? 3 : 4;
  const pwLabel    = ["", "Too short", "Getting there…", "Good password", "Strong ✓"][pwStrength];
  const pwColor    = ["#e8e0d0","#dc2626","#f59e0b","#2d6a4f","#16a34a"][pwStrength];

  return (
    <div style={{ minHeight:"100vh", background:"#f8f6f0", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        .sc-input{width:100%;padding:13px 16px 13px 44px;border-radius:12px;border:1.5px solid #e8e0d0;font-size:14px;outline:none;background:#fafaf8;font-family:'DM Sans',sans-serif;color:#1a1a1a;transition:border-color .18s,box-shadow .18s}
        .sc-input:focus{border-color:#2d6a4f;box-shadow:0 0 0 3px rgba(45,106,79,.12)}
        .sc-input::placeholder{color:#c4bdb1}
        .sc-input-plain{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid #e8e0d0;font-size:14px;outline:none;background:#fafaf8;font-family:'DM Sans',sans-serif;color:#1a1a1a;transition:border-color .18s,box-shadow .18s}
        .sc-input-plain:focus{border-color:#2d6a4f;box-shadow:0 0 0 3px rgba(45,106,79,.12)}
        .sc-input-plain::placeholder{color:#c4bdb1}

        .sc-btn{width:100%;padding:15px;background:#2d6a4f;color:#fff;border:none;border-radius:13px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .18s,transform .15s,box-shadow .18s;letter-spacing:.01em}
        .sc-btn:hover:not(:disabled){background:#1e5038;transform:translateY(-2px);box-shadow:0 12px 28px rgba(45,106,79,.28)}
        .sc-btn:active:not(:disabled){transform:translateY(0)}
        .sc-btn:disabled{background:#a8c5b5;cursor:not-allowed}

        .activity-pill{transition:opacity .35s ease,transform .35s ease}
        .activity-pill.hidden{opacity:0;transform:translateY(6px)}
        .activity-pill.visible{opacity:1;transform:translateY(0)}

        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .fade-card{animation:fadeUp .3s ease both}

        @keyframes float0{0%,100%{transform:translate(0,0)}50%{transform:translate(-12px,-18px)}}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,14px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-8px,20px)}}
        .blob-0{animation:float0 9s ease-in-out infinite}
        .blob-1{animation:float1 12s ease-in-out infinite}
        .blob-2{animation:float2 15s ease-in-out infinite}

        @keyframes popIn{0%{transform:scale(.7);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        .pop{animation:popIn .45s cubic-bezier(.34,1.56,.64,1) both}
      `}</style>

      {/* Background blobs */}
      <div className="blob-0" style={{ position:"fixed", top:"-120px", right:"-100px", width:460, height:460, borderRadius:"50%", background:"radial-gradient(circle,#c8e6d4,transparent 70%)", opacity:.6, pointerEvents:"none", filter:"blur(0)" }} />
      <div className="blob-1" style={{ position:"fixed", bottom:"-90px", left:"-70px", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,#e8d9c0,transparent 70%)", opacity:.5, pointerEvents:"none" }} />
      <div className="blob-2" style={{ position:"fixed", top:"40%", right:"65%", width:240, height:240, borderRadius:"50%", background:"radial-gradient(circle,#d4e9dc,transparent 70%)", opacity:.35, pointerEvents:"none" }} />

      <div style={{ width:"100%", maxWidth:step===3?420:480, position:"relative", zIndex:1, transition:"max-width .3s ease" }}>

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

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom:22 }}>
                <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:25, fontWeight:800, color:"#1a1a1a", marginBottom:6, letterSpacing:"-.3px" }}>Create your account</h1>
                <p style={{ fontSize:13.5, color:"#999" }}>Join and get <strong style={{ color:"#2d6a4f" }}>20 free credits</strong> to start learning 🎁</p>
              </div>
              {progress(1)}

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {/* Full name */}
                <div>
                  <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7 }}>Full Name</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>👤</span>
                    <input className="sc-input" type="text" placeholder="Juan dela Cruz"
                      value={form.full_name} onChange={e => update("full_name", e.target.value)} />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7 }}>Username</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#aaa", fontWeight:700, pointerEvents:"none" }}>@</span>
                    <input className="sc-input" type="text" placeholder="juandelacruz"
                      value={form.username}
                      onChange={e => update("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
                  </div>
                  <p style={{ fontSize:11, color:"#c4bdb1", marginTop:4 }}>Letters, numbers, underscores only</p>
                </div>

                {/* Email */}
                <div>
                  <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7 }}>Email Address</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>✉️</span>
                    <input className="sc-input" type="email" placeholder="juan@email.com"
                      value={form.email} onChange={e => update("email", e.target.value)} />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:11, padding:"10px 14px", marginTop:16 }}>
                  <p style={{ color:"#dc2626", fontSize:13, margin:0 }}>⚠️ {error}</p>
                </div>
              )}
              <button className="sc-btn" style={{ marginTop:22 }} onClick={handleStep1} disabled={loading}>
                {loading ? "Checking…" : "Continue →"}
              </button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <button onClick={() => { setStep(1); setError(""); }}
                style={{ background:"none", border:"none", color:"#999", fontSize:13, cursor:"pointer", marginBottom:18, padding:0, display:"flex", alignItems:"center", gap:5, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>
                ← Back
              </button>
              <div style={{ marginBottom:22 }}>
                <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:25, fontWeight:800, color:"#1a1a1a", marginBottom:6, letterSpacing:"-.3px" }}>Set your password</h1>
                <p style={{ fontSize:13.5, color:"#999" }}>Almost there, <strong style={{ color:"#1a1a1a" }}>{form.full_name}</strong>! 👋</p>
              </div>
              {progress(2)}

              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {/* Password */}
                <div>
                  <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7 }}>Password</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔒</span>
                    <input className="sc-input" type={showPass ? "text" : "password"} placeholder="At least 8 characters"
                      value={form.password} onChange={e => update("password", e.target.value)} />
                    <button onClick={() => setShowPass(s => !s)}
                      style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#bbb", fontFamily:"'DM Sans',sans-serif", padding:4 }}>
                      {showPass ? "Hide" : "Show"}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {form.password.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ height:3, flex:1, borderRadius:999, background:i<=pwStrength?pwColor:"#e8e0d0", transition:"background .25s" }} />
                        ))}
                      </div>
                      <p style={{ fontSize:11, color:pwColor, fontWeight:600, transition:"color .25s" }}>{pwLabel}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label style={{ fontSize:12.5, fontWeight:700, color:"#444", display:"block", marginBottom:7 }}>Confirm Password</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔑</span>
                    <input className="sc-input" type={showConf ? "text" : "password"} placeholder="Repeat your password"
                      value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)}
                      style={{ borderColor: form.confirmPassword && form.confirmPassword !== form.password ? "#dc2626" : undefined } as React.CSSProperties} />
                    <button onClick={() => setShowConf(s => !s)}
                      style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#bbb", fontFamily:"'DM Sans',sans-serif", padding:4 }}>
                      {showConf ? "Hide" : "Show"}
                    </button>
                  </div>
                  {form.confirmPassword && form.confirmPassword !== form.password && <p style={{ fontSize:11, color:"#dc2626", marginTop:4, fontWeight:600 }}>Passwords don't match</p>}
                  {form.confirmPassword && form.confirmPassword === form.password  && <p style={{ fontSize:11, color:"#2d6a4f", marginTop:4, fontWeight:600 }}>✓ Passwords match</p>}
                </div>

                <p style={{ fontSize:12, color:"#bbb", lineHeight:1.55 }}>By creating an account you agree to our Terms of Service and Privacy Policy.</p>
              </div>

              {error && (
                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:11, padding:"10px 14px", marginTop:16 }}>
                  <p style={{ color:"#dc2626", fontSize:13, margin:0 }}>⚠️ {error}</p>
                </div>
              )}
              <button className="sc-btn" style={{ marginTop:22 }} onClick={handleStep2} disabled={loading}>
                {loading ? "Creating account…" : "Create account — get 20 credits 🎁"}
              </button>
            </div>
          )}

          {/* ── STEP 3 — SUCCESS ── */}
          {step === 3 && (
            <div className="fade-card" style={{ textAlign:"center", padding:"12px 0 4px" }}>
              <div className="pop" style={{ fontSize:68, marginBottom:18, lineHeight:1 }}>🌱</div>
              <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:800, color:"#1a1a1a", marginBottom:10, letterSpacing:"-.3px" }}>
                Welcome to SkillCredit!
              </h1>
              <p style={{ fontSize:14, color:"#777", lineHeight:1.6, marginBottom:6 }}>Your account is ready and waiting.</p>
              <div style={{ background:"linear-gradient(135deg,#e8f4e8,#f0fdf4)", border:"1px solid #c6e8d4", borderRadius:14, padding:"14px 20px", marginBottom:26, display:"inline-block", width:"100%" }}>
                <p style={{ fontSize:14, color:"#2d6a4f", fontWeight:700, margin:0 }}>🎁 20 credits have been added to your wallet!</p>
              </div>
              <a href="/dashboard" style={{ display:"block", width:"100%", padding:"15px", background:"#2d6a4f", color:"white", borderRadius:13, fontSize:15, fontWeight:700, textDecoration:"none", transition:"background .18s,transform .15s,box-shadow .18s" }}
                onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.background="#1e5038"; el.style.transform="translateY(-2px)"; el.style.boxShadow="0 12px 28px rgba(45,106,79,.28)"; }}
                onMouseOut={e  => { const el = e.currentTarget as HTMLElement; el.style.background="#2d6a4f"; el.style.transform="none"; el.style.boxShadow="none"; }}>
                Go to Dashboard →
              </a>
            </div>
          )}

          {/* Activity ticker — steps 1 & 2 only */}
          {step !== 3 && (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:12, margin:"22px 0 0" }}>
                <div style={{ flex:1, height:"1px", background:"#ede9e1" }} />
                <span style={{ fontSize:12, color:"#c4bdb1", fontWeight:600 }}>live on SkillCredit</span>
                <div style={{ flex:1, height:"1px", background:"#ede9e1" }} />
              </div>
              <div style={{ marginTop:14, background:"#f5f2ec", borderRadius:12, padding:"10px 14px", minHeight:42, display:"flex", alignItems:"center" }}>
                <div className={`activity-pill ${activityVisible ? "visible" : "hidden"}`} style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>{ACTIVITY[activityIdx].icon}</span>
                  <span style={{ fontSize:12.5, color:"#666", fontWeight:500, lineHeight:1.4 }}>{ACTIVITY[activityIdx].text}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {step !== 3 && (
          <p style={{ textAlign:"center", marginTop:20, fontSize:13.5, color:"#999" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color:"#2d6a4f", fontWeight:700, textDecoration:"none" }}>Log in</a>
          </p>
        )}
      </div>
    </div>
  );
}