"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];
  const [form, setForm] = useState({
    email: "", password: "", confirmPassword: "", username: "", full_name: "",
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none",
    background: "#fafaf8", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif",
  };

  const progress = (current: number) => (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{ height: 4, flex: 1, borderRadius: 999, background: s <= current ? "#2d6a4f" : "#e8e0d0", transition: "background 0.3s" }} />
      ))}
    </div>
  );

  // ── Step 1 → 2 ──
  async function handleStep1() {
    setError("");
    if (!form.full_name.trim()) { setError("Please enter your full name."); return; }
    if (form.username.length < 3) { setError("Username must be at least 3 characters."); return; }
    if (!/^[a-z0-9_]+$/.test(form.username)) { setError("Username can only contain letters, numbers, and underscores."); return; }
    if (!form.email.includes("@")) { setError("Please enter a valid email."); return; }
    setLoading(true);
    const { data: existing } = await supabase
      .from("profiles").select("id").eq("username", form.username).maybeSingle();
    if (existing) { setError("That username is already taken."); setLoading(false); return; }
    setLoading(false);
    setStep(2);
  }

  // ── Step 2 → send OTP ──
  async function handleStep2() {
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { username: form.username, full_name: form.full_name },
      },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (data.user) {
      setStep(3);
      startResendCooldown();
    }
    setLoading(false);
  }

  // ── Step 3 — verify OTP ──
  async function handleVerifyOtp() {
    const code = otp.join("");
    if (code.length < 6) { setError("Please enter the full 6-digit code."); return; }
    setLoading(true);
    setError("");
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: form.email, token: code, type: "signup",
    });
    if (verifyError) { setError("Invalid or expired code. Please try again."); setLoading(false); return; }
    // Signup bonus
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("credit_transactions").insert({
        user_id: user.id, amount: 20, type: "signup_bonus",
        description: "Welcome to SkillCredit! 🎁 20 free credits to get started.",
      });
    }
    setStep(4);
    setLoading(false);
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    const { error } = await supabase.auth.resend({ type: "signup", email: form.email });
    if (error) { setError("Failed to resend. Please wait a moment."); return; }
    startResendCooldown();
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => { if (prev <= 1) { clearInterval(interval); return 0; } return prev - 1; });
    }, 1000);
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) otpRefs[index + 1].current?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) otpRefs[index - 1].current?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) { setOtp(paste.split("")); otpRefs[5].current?.focus(); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fffdf7", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing: border-box }
        input:focus { border-color: #2d6a4f !important }
        .otp-box { width:48px; height:56px; border-radius:12px; border:1.5px solid #e8e0d0; font-size:22px; font-weight:800; text-align:center; background:#fafaf8; font-family:'DM Sans',sans-serif; transition:border-color .15s,box-shadow .15s; outline:none }
        .otp-box:focus { border-color:#2d6a4f !important; box-shadow:0 0 0 3px rgba(45,106,79,0.12) }
        .otp-box.filled { border-color:#2d6a4f; background:#f0faf4 }
        .btn { width:100%; padding:14px; background:#2d6a4f; color:white; border:none; border-radius:12px; font-size:15px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif; transition:background .2s }
        .btn:hover { background:#235c42 }
        .btn:disabled { background:#a8c5b5; cursor:not-allowed }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .fade { animation: fadeUp .25s ease }
      `}</style>

      <div style={{ position:"fixed", top:-100, right:-100, width:400, height:400, borderRadius:"50%", background:"#2d6a4f", opacity:0.04, pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-80, left:-80, width:300, height:300, borderRadius:"50%", background:"#b45309", opacity:0.04, pointerEvents:"none" }} />

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <a href="/" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>
            SkillCredit
          </a>
        </div>

        <div style={{ background: "white", borderRadius: 24, padding: "40px", boxShadow: "0 4px 40px rgba(0,0,0,0.08)", border: "1px solid #f0ece4" }}>

          {/* ── STEP 1 — Info ── */}
          {step === 1 && (
            <div className="fade">
              <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:800, color:"#1a1a1a", marginBottom:8 }}>Create your account</h1>
              <p style={{ fontSize:14, color:"#888", marginBottom:28 }}>Join SkillCredit and get <strong style={{ color:"#2d6a4f" }}>20 free credits</strong> to start learning 🎁</p>
              {progress(1)}

              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>Full Name</label>
                  <input style={inputStyle} type="text" placeholder="Juan dela Cruz"
                    value={form.full_name} onChange={e => update("full_name", e.target.value)}
                    onFocus={e => e.target.style.borderColor="#2d6a4f"}
                    onBlur={e => e.target.style.borderColor="#e8e0d0"} />
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>Username</label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#aaa", fontSize:14 }}>@</span>
                    <input style={{ ...inputStyle, paddingLeft:30 }} type="text" placeholder="juandelacruz"
                      value={form.username}
                      onChange={e => update("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      onFocus={e => e.target.style.borderColor="#2d6a4f"}
                      onBlur={e => e.target.style.borderColor="#e8e0d0"} />
                  </div>
                  <p style={{ fontSize:11, color:"#bbb", marginTop:4 }}>Letters, numbers, underscores only</p>
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>Email Address</label>
                  <input style={inputStyle} type="email" placeholder="juan@email.com"
                    value={form.email} onChange={e => update("email", e.target.value)}
                    onFocus={e => e.target.style.borderColor="#2d6a4f"}
                    onBlur={e => e.target.style.borderColor="#e8e0d0"} />
                </div>
              </div>

              {error && <p style={{ color:"#dc2626", fontSize:13, marginTop:12, textAlign:"center" }}>{error}</p>}
              <button className="btn" style={{ marginTop:24 }} onClick={handleStep1} disabled={loading}>
                {loading ? "Checking…" : "Continue →"}
              </button>
            </div>
          )}

          {/* ── STEP 2 — Password ── */}
          {step === 2 && (
            <div className="fade">
              <button onClick={() => { setStep(1); setError(""); }} style={{ background:"none", border:"none", color:"#888", fontSize:13, cursor:"pointer", marginBottom:16, padding:0 }}>← Back</button>
              <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:800, color:"#1a1a1a", marginBottom:8 }}>Set your password</h1>
              <p style={{ fontSize:14, color:"#888", marginBottom:28 }}>Almost there, <strong style={{ color:"#1a1a1a" }}>{form.full_name}</strong>! 👋</p>
              {progress(2)}

              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>Password</label>
                  <input style={inputStyle} type="password" placeholder="At least 8 characters"
                    value={form.password} onChange={e => update("password", e.target.value)}
                    onFocus={e => e.target.style.borderColor="#2d6a4f"}
                    onBlur={e => e.target.style.borderColor="#e8e0d0"} />
                  {form.password.length > 0 && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ display:"flex", gap:4, marginBottom:4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{ height:3, flex:1, borderRadius:999, background: form.password.length >= i*2 ? (form.password.length>=8?"#2d6a4f":"#f59e0b") : "#e8e0d0" }} />
                        ))}
                      </div>
                      <p style={{ fontSize:11, color:form.password.length>=8?"#2d6a4f":"#f59e0b" }}>
                        {form.password.length<4?"Too short":form.password.length<8?"Getting there...":"Strong password ✓"}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize:13, fontWeight:600, color:"#333", display:"block", marginBottom:6 }}>Confirm Password</label>
                  <input
                    style={{ ...inputStyle, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? "#dc2626" : "#e8e0d0" }}
                    type="password" placeholder="Repeat your password"
                    value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)}
                    onFocus={e => e.target.style.borderColor="#2d6a4f"}
                    onBlur={e => e.target.style.borderColor=form.confirmPassword!==form.password?"#dc2626":"#e8e0d0"} />
                  {form.confirmPassword && form.confirmPassword !== form.password && <p style={{ fontSize:11, color:"#dc2626", marginTop:4 }}>Passwords don't match</p>}
                  {form.confirmPassword && form.confirmPassword === form.password && <p style={{ fontSize:11, color:"#2d6a4f", marginTop:4 }}>✓ Passwords match</p>}
                </div>
                <p style={{ fontSize:12, color:"#999", lineHeight:1.5 }}>By creating an account you agree to our Terms of Service and Privacy Policy.</p>
              </div>

              {error && <p style={{ color:"#dc2626", fontSize:13, marginTop:12, textAlign:"center" }}>{error}</p>}
              <button className="btn" style={{ marginTop:24 }} onClick={handleStep2} disabled={loading}>
                {loading ? "Sending verification code…" : "Create account — get 20 credits 🎁"}
              </button>
            </div>
          )}

          {/* ── STEP 3 — OTP ── */}
          {step === 3 && (
            <div className="fade">
              <div style={{ width:52, height:52, borderRadius:14, background:"#e8f4e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, marginBottom:16 }}>📧</div>
              <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:800, color:"#1a1a1a", marginBottom:8 }}>Check your email</h1>
              <p style={{ fontSize:14, color:"#888", lineHeight:1.6, marginBottom:28 }}>
                We sent a 6-digit code to <strong style={{ color:"#1a1a1a" }}>{form.email}</strong>
              </p>
              {progress(3)}

              {/* OTP boxes */}
              <div style={{ display:"flex", gap:10, justifyContent:"center", marginBottom:24 }} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i} ref={otpRefs[i]}
                    className={`otp-box${digit ? " filled" : ""}`}
                    type="text" inputMode="numeric" maxLength={1} value={digit}
                    onChange={e => handleOtpInput(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                  />
                ))}
              </div>

              {error && <p style={{ color:"#dc2626", fontSize:13, marginBottom:12, textAlign:"center" }}>{error}</p>}

              <button className="btn" onClick={handleVerifyOtp} disabled={loading || otp.join("").length < 6}>
                {loading ? "Verifying…" : "Verify & finish →"}
              </button>

              <div style={{ textAlign:"center", marginTop:18 }}>
                <p style={{ fontSize:13, color:"#888" }}>
                  Didn't get it?{" "}
                  {resendCooldown > 0
                    ? <span style={{ color:"#bbb" }}>Resend in {resendCooldown}s</span>
                    : <button onClick={handleResendOtp} style={{ background:"none", border:"none", color:"#2d6a4f", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>Resend code</button>
                  }
                </p>
                <button onClick={() => { setStep(1); setOtp(["","","","","",""]); setError(""); }}
                  style={{ background:"none", border:"none", color:"#bbb", fontSize:12, cursor:"pointer", marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>
                  Wrong email? Start over
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4 — Success ── */}
          {step === 4 && (
            <div className="fade" style={{ textAlign:"center", padding:"20px 0" }}>
              <div style={{ fontSize:64, marginBottom:20 }}>🌱</div>
              <h1 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:28, fontWeight:800, color:"#1a1a1a", marginBottom:12 }}>Welcome to SkillCredit!</h1>
              <p style={{ fontSize:15, color:"#555", lineHeight:1.6, marginBottom:8 }}>Your account is verified and ready.</p>
              <div style={{ background:"#e8f4e8", borderRadius:12, padding:"16px 20px", marginBottom:28, display:"inline-block" }}>
                <p style={{ fontSize:14, color:"#2d6a4f", fontWeight:600, margin:0 }}>🎁 20 credits have been added to your wallet!</p>
              </div>
              <a href="/dashboard" style={{ display:"block", width:"100%", padding:"14px", background:"#2d6a4f", color:"white", borderRadius:12, fontSize:15, fontWeight:700, textDecoration:"none" }}>
                Go to Dashboard →
              </a>
            </div>
          )}
        </div>

        {step !== 4 && (
          <p style={{ textAlign:"center", marginTop:20, fontSize:14, color:"#888" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color:"#2d6a4f", fontWeight:600, textDecoration:"none" }}>Log in</a>
          </p>
        )}
      </div>
    </div>
  );
}