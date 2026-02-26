"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    full_name: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSignup = async () => {
    setError("");

    // Basic validation
    if (!form.email || !form.password || !form.username || !form.full_name) {
      setError("Please fill in all fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.username.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            username: form.username.toLowerCase().replace(/\s/g, "_"),
            full_name: form.full_name,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Add signup bonus credits transaction
        await supabase.from("credit_transactions").insert({
          user_id: data.user.id,
          amount: 20,
          type: "signup_bonus",
          description: "Welcome to SkillCredit! 🎁 20 free credits to get started.",
        });

        setStep(3); // Success step
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fffdf7", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>

      {/* Background decoration */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "#2d6a4f", opacity: 0.04, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: "#b45309", opacity: 0.04, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <a href="/" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>
            SkillCredit
          </a>
        </div>

        {/* Card */}
        <div style={{ background: "white", borderRadius: 24, padding: "40px", boxShadow: "0 4px 40px rgba(0,0,0,0.08)", border: "1px solid #f0ece4" }}>

          {/* Step 1 — Account details */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
                  Create your account
                </h1>
                <p style={{ fontSize: 14, color: "#888" }}>
                  Join SkillCredit and get <strong style={{ color: "#2d6a4f" }}>20 free credits</strong> to start learning 🎁
                </p>
              </div>

              {/* Progress */}
              <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
                {[1, 2].map((s) => (
                  <div key={s} style={{ height: 4, flex: 1, borderRadius: 999, background: s <= step ? "#2d6a4f" : "#e8e0d0", transition: "background 0.3s" }} />
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Juan dela Cruz"
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={(e) => e.target.style.borderColor = "#e8e0d0"}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Username</label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 14 }}>@</span>
                    <input
                      type="text"
                      placeholder="juandelacruz"
                      value={form.username}
                      onChange={(e) => update("username", e.target.value.toLowerCase().replace(/\s/g, "_"))}
                      style={{ width: "100%", padding: "12px 16px 12px 30px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                      onFocus={(e) => e.target.style.borderColor = "#2d6a4f"}
                      onBlur={(e) => e.target.style.borderColor = "#e8e0d0"}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Email Address</label>
                  <input
                    type="email"
                    placeholder="juan@email.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={(e) => e.target.style.borderColor = "#e8e0d0"}
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  if (!form.full_name || !form.username || !form.email) {
                    setError("Please fill in all fields.");
                    return;
                  }
                  setError("");
                  setStep(2);
                }}
                style={{ width: "100%", marginTop: 24, padding: "14px", background: "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Continue →
              </button>

              {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}
            </>
          )}

          {/* Step 2 — Password */}
          {step === 2 && (
            <>
              <div style={{ marginBottom: 28 }}>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0 }}>
                  ← Back
                </button>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
                  Set your password
                </h1>
                <p style={{ fontSize: 14, color: "#888" }}>Almost there, <strong style={{ color: "#1a1a1a" }}>{form.full_name}</strong>! 👋</p>
              </div>

              {/* Progress */}
              <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
                {[1, 2].map((s) => (
                  <div key={s} style={{ height: 4, flex: 1, borderRadius: 999, background: s <= step ? "#2d6a4f" : "#e8e0d0", transition: "background 0.3s" }} />
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Password</label>
                  <input
                    type="password"
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={(e) => e.target.style.borderColor = "#e8e0d0"}
                  />
                  {/* Password strength */}
                  {form.password.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} style={{ height: 3, flex: 1, borderRadius: 999, background: form.password.length >= i * 2 ? (form.password.length >= 8 ? "#2d6a4f" : "#f59e0b") : "#e8e0d0" }} />
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
                    type="password"
                    placeholder="Repeat your password"
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${form.confirmPassword && form.confirmPassword !== form.password ? "#dc2626" : "#e8e0d0"}`, fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={(e) => e.target.style.borderColor = form.confirmPassword !== form.password ? "#dc2626" : "#e8e0d0"}
                  />
                  {form.confirmPassword && form.confirmPassword !== form.password && (
                    <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>Passwords don't match</p>
                  )}
                  {form.confirmPassword && form.confirmPassword === form.password && (
                    <p style={{ fontSize: 11, color: "#2d6a4f", marginTop: 4 }}>✓ Passwords match</p>
                  )}
                </div>

                {/* Terms */}
                <p style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>
                  By creating an account you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>

              {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12, textAlign: "center" }}>{error}</p>}

              <button
                onClick={handleSignup}
                disabled={loading}
                style={{ width: "100%", marginTop: 24, padding: "14px", background: loading ? "#a8c5b5" : "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background 0.2s" }}
              >
                {loading ? "Creating your account..." : "Create account — get 20 credits 🎁"}
              </button>
            </>
          )}

          {/* Step 3 — Success */}
          {step === 3 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🌱</div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>
                Welcome to SkillCredit!
              </h1>
              <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>
                Your account has been created successfully.
              </p>
              <div style={{ background: "#e8f4e8", borderRadius: 12, padding: "16px", marginBottom: 28, display: "inline-block" }}>
                <p style={{ fontSize: 14, color: "#2d6a4f", fontWeight: 600, margin: 0 }}>
                  🎁 20 credits have been added to your wallet!
                </p>
              </div>
              <p style={{ fontSize: 13, color: "#999", marginBottom: 28 }}>
                Check your email to verify your account, then log in to get started.
              </p>
              <a
                href="/login"
                style={{ display: "block", width: "100%", padding: "14px", background: "#2d6a4f", color: "white", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none", boxSizing: "border-box" }}
              >
                Go to login →
              </a>
            </div>
          )}
        </div>

        {/* Login link */}
        {step !== 3 && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#888" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "#2d6a4f", fontWeight: 600, textDecoration: "none" }}>Log in</a>
          </p>
        )}
      </div>
    </div>
  );
}