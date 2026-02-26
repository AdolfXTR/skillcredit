"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Skill = { id: string; name: string; category: string };

const FORMATS = [
  { id: "video", icon: "📹", label: "Video Call", desc: "Live 1-on-1 via Google Meet, Zoom, etc." },
  { id: "chat",  icon: "💬", label: "Chat",       desc: "Text-based teaching inside SkillCredit" },
  { id: "docs",  icon: "📄", label: "Docs",       desc: "Shared documents and written guides" },
  { id: "mixed", icon: "🎨", label: "Mixed",      desc: "Combination of formats" },
];

const DURATIONS = [
  { value: 30,  label: "30 min", desc: "Quick session" },
  { value: 60,  label: "1 hour", desc: "Standard session" },
  { value: 120, label: "2 hours", desc: "Deep dive" },
];

const STEPS = ["Basic Info", "Session Details", "Preview & Publish"];

const FORMAT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  video: { bg: "#e3f0fb", color: "#1d6fb8", border: "#1d6fb8" },
  chat:  { bg: "#e8f4e8", color: "#2d6a4f", border: "#2d6a4f" },
  docs:  { bg: "#f0ebff", color: "#7c3aed", border: "#7c3aed" },
  mixed: { bg: "#fff8e7", color: "#b45309", border: "#b45309" },
};

export default function CreateListingPage() {
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    skill_id: "",
    title: "",
    description: "",
    prerequisites: "",
    outcomes: "",
    materials: "",
    format: "",
    duration: 60,
    credit_price: 10,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);
      const { data } = await supabase.from("skills").select("*").order("category");
      setSkills(data || []);
    };
    init();
  }, []);

  const selectedSkill = skills.find(s => s.id === form.skill_id);
  const selectedFormat = FORMATS.find(f => f.id === form.format);
  const selectedDuration = DURATIONS.find(d => d.value === form.duration);

  const canProceed = () => {
    if (step === 0) return form.skill_id && form.title.length >= 5 && form.description.length >= 20;
    if (step === 1) return form.format && form.duration && form.credit_price >= 5;
    return true;
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError("");

    const { error: err } = await supabase.from("listings").insert({
      teacher_id: userId,
      skill_id: form.skill_id,
      title: form.title,
      description: form.description,
      prerequisites: form.prerequisites,
      outcomes: form.outcomes,
      materials: form.materials,
      format: form.format,
      duration: form.duration,
      credit_price: form.credit_price,
      is_active: true,
    });

    if (err) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  };

  // Group skills by category
  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ background: "white", borderRadius: 24, padding: "48px", textAlign: "center", maxWidth: 440, border: "1px solid #e8e0d0", boxShadow: "0 8px 40px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>
            Listing Published!
          </h2>
          <p style={{ fontSize: 15, color: "#666", lineHeight: 1.6, marginBottom: 8 }}>
            <strong>{form.title}</strong> is now live on SkillCredit.
          </p>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>
            Learners can now find and book a session with you!
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/listings" style={{ flex: 1, padding: "12px", background: "#e8f4e8", color: "#2d6a4f", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
              Browse All →
            </a>
            <a href="/profile" style={{ flex: 1, padding: "12px", background: "#2d6a4f", color: "white", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
              My Profile →
            </a>
          </div>
          <button
            onClick={() => { setDone(false); setStep(0); setForm({ skill_id: "", title: "", description: "", prerequisites: "", outcomes: "", materials: "", format: "", duration: 60, credit_price: 10 }); }}
            style={{ marginTop: 12, width: "100%", padding: "12px", background: "transparent", color: "#888", border: "1px solid #e8e0d0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            + Create another listing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse Skills</a>
          <a href="/profile" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>My Profile</a>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
            Create a Skill Listing 🎓
          </h1>
          <p style={{ fontSize: 15, color: "#888" }}>Share your knowledge and earn credits when learners book sessions with you.</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "initial" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800,
                  background: i < step ? "#2d6a4f" : i === step ? "#2d6a4f" : "#e8e0d0",
                  color: i <= step ? "white" : "#aaa",
                  flexShrink: 0,
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: i === step ? "#1a1a1a" : "#aaa", whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? "#2d6a4f" : "#e8e0d0", margin: "0 12px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "white", borderRadius: 24, border: "1px solid #e8e0d0", padding: "36px", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>

          {/* ── STEP 1: Basic Info ── */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>Basic Information</h2>
                <p style={{ fontSize: 14, color: "#888" }}>Tell learners what you're offering and what they'll get out of it.</p>
              </div>

              {/* Skill picker */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>What skill are you teaching? *</label>
                <select
                  value={form.skill_id}
                  onChange={e => setForm(p => ({ ...p, skill_id: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${form.skill_id ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", boxSizing: "border-box" }}
                >
                  <option value="">Select a skill...</option>
                  {Object.entries(grouped).map(([cat, catSkills]) => (
                    <optgroup key={cat} label={cat}>
                      {catSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>
                  Listing Title *
                  <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>{form.title.length}/80</span>
                </label>
                <input
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Python for Complete Beginners — Zero to First Project"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${form.title.length >= 5 ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                />
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Be specific — great titles tell learners exactly what they'll get.</p>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>
                  Description *
                  <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>{form.description.length}/600</span>
                </label>
                <textarea
                  maxLength={600}
                  rows={4}
                  placeholder="Describe what the session covers, your teaching style, and who this is for..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${form.description.length >= 20 ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>

              {/* Prerequisites */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>Prerequisites <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. No experience needed / Basic math knowledge"
                  value={form.prerequisites}
                  onChange={e => setForm(p => ({ ...p, prerequisites: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                />
              </div>

              {/* Learning outcomes */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>What will learners walk away with? <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  placeholder="e.g. Understand variables and loops, build a simple calculator, know how to read Python errors..."
                  value={form.outcomes}
                  onChange={e => setForm(p => ({ ...p, outcomes: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", resize: "vertical", boxSizing: "border-box" }}
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: Session Details ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>Session Details</h2>
                <p style={{ fontSize: 14, color: "#888" }}>Set how you'll teach, how long, and what it costs.</p>
              </div>

              {/* Format */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 12 }}>Teaching Format *</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {FORMATS.map(f => {
                    const isSelected = form.format === f.id;
                    const fc = FORMAT_COLORS[f.id];
                    return (
                      <div
                        key={f.id}
                        onClick={() => setForm(p => ({ ...p, format: f.id }))}
                        style={{
                          padding: "16px", borderRadius: 14, cursor: "pointer",
                          border: `2px solid ${isSelected ? fc.border : "#e8e0d0"}`,
                          background: isSelected ? fc.bg : "white",
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{f.icon}</span>
                        <p style={{ fontWeight: 700, color: isSelected ? fc.color : "#333", fontSize: 14, margin: "8px 0 2px" }}>{f.label}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.4 }}>{f.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 12 }}>Session Duration *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {DURATIONS.map(d => {
                    const isSelected = form.duration === d.value;
                    return (
                      <div
                        key={d.value}
                        onClick={() => setForm(p => ({ ...p, duration: d.value }))}
                        style={{
                          flex: 1, padding: "16px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                          border: `2px solid ${isSelected ? "#2d6a4f" : "#e8e0d0"}`,
                          background: isSelected ? "#e8f4e8" : "white",
                          transition: "all 0.15s",
                        }}
                      >
                        <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: isSelected ? "#2d6a4f" : "#1a1a1a", margin: "0 0 4px" }}>{d.label}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{d.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Credit price */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>
                  Credit Price per Session *
                  <span style={{ fontSize: 12, color: "#aaa", fontWeight: 400, marginLeft: 8 }}>Min: 5 credits · Equals ₱{form.credit_price * 10}</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setForm(p => ({ ...p, credit_price: Math.max(5, p.credit_price - 5) }))}
                    style={{ width: 40, height: 40, borderRadius: 10, border: "1.5px solid #e8e0d0", background: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 40, fontWeight: 800, color: "#2d6a4f" }}>{form.credit_price}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>credits · ₱{form.credit_price * 10}</div>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, credit_price: p.credit_price + 5 }))}
                    style={{ width: 40, height: 40, borderRadius: 10, border: "1.5px solid #e8e0d0", background: "white", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                </div>
                <input
                  type="range" min={5} max={100} step={5}
                  value={form.credit_price}
                  onChange={e => setForm(p => ({ ...p, credit_price: parseInt(e.target.value) }))}
                  style={{ width: "100%", marginTop: 12, accentColor: "#2d6a4f" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  <span>5 cr (₱50)</span><span>50 cr (₱500)</span><span>100 cr (₱1,000)</span>
                </div>
              </div>

              {/* Materials */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>Materials you'll provide <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Slides, practice files, code templates, reading list"
                  value={form.materials}
                  onChange={e => setForm(p => ({ ...p, materials: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>Preview & Publish</h2>
              <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>This is how your listing will appear to learners. Looks good? Hit publish!</p>

              {/* Preview card */}
              <div style={{ background: "#f5f5f0", borderRadius: 20, padding: 4, marginBottom: 24 }}>
                <div style={{ background: "white", borderRadius: 16, padding: "24px", border: "1px solid #e8e0d0" }}>
                  {/* Tags */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    {selectedSkill && (
                      <span style={{ background: "#e8f4e8", color: "#2d6a4f", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                        {selectedSkill.category} · {selectedSkill.name}
                      </span>
                    )}
                    {selectedFormat && (
                      <span style={{ background: FORMAT_COLORS[form.format].bg, color: FORMAT_COLORS[form.format].color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                        {selectedFormat.icon} {selectedFormat.label}
                      </span>
                    )}
                    <span style={{ background: "#f5f0e8", color: "#b45309", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                      ⏱ {selectedDuration?.label}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 10, lineHeight: 1.3 }}>
                    {form.title || "Your listing title"}
                  </h3>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 16 }}>
                    {form.description || "Your description will appear here."}
                  </p>

                  {form.outcomes && (
                    <div style={{ background: "#e8f4e8", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", marginBottom: 4 }}>YOU'LL LEARN</p>
                      <p style={{ fontSize: 13, color: "#444", margin: 0, lineHeight: 1.5 }}>{form.outcomes}</p>
                    </div>
                  )}

                  {form.prerequisites && (
                    <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>📋 Prerequisites: {form.prerequisites}</p>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid #f0ece4" }}>
                    <div>
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#2d6a4f" }}>{form.credit_price} cr</span>
                      <span style={{ fontSize: 13, color: "#888", marginLeft: 6 }}>per session · ₱{form.credit_price * 10}</span>
                    </div>
                    <div style={{ padding: "9px 20px", background: "#2d6a4f", color: "white", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
                      Book session →
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Skill", value: selectedSkill?.name },
                  { label: "Format", value: selectedFormat?.label },
                  { label: "Duration", value: selectedDuration?.label },
                  { label: "Price", value: `${form.credit_price} credits (₱${form.credit_price * 10})` },
                  { label: "Prerequisites", value: form.prerequisites || "Not specified" },
                  { label: "Materials", value: form.materials || "Not specified" },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fafaf8", borderRadius: 10, fontSize: 13 }}>
                    <span style={{ color: "#888", fontWeight: 600 }}>{item.label}</span>
                    <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 16, background: "#fef2f2", padding: "10px 14px", borderRadius: 10 }}>{error}</p>}
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 32, paddingTop: 24, borderTop: "1px solid #f0ece4" }}>
            {step > 0 && (
              <button
                onClick={() => setStep(p => p - 1)}
                style={{ padding: "13px 24px", borderRadius: 12, background: "#f5f0e8", color: "#555", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {step < 2 ? (
              <button
                onClick={() => setStep(p => p + 1)}
                disabled={!canProceed()}
                style={{
                  padding: "13px 28px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, cursor: canProceed() ? "pointer" : "not-allowed",
                  background: canProceed() ? "#2d6a4f" : "#d0d0c8", color: "white",
                  fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s",
                }}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ padding: "13px 32px", borderRadius: 12, border: "none", fontSize: 14, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", background: submitting ? "#a8c5b5" : "#2d6a4f", color: "white", fontFamily: "'DM Sans', sans-serif" }}
              >
                {submitting ? "Publishing..." : "🚀 Publish Listing"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}