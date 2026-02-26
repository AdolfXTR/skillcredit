"use client";
import { useState, useEffect } from "react";

const mockCards = [
  { type: "listing", title: "Python for Absolute Beginners", teacher: "Maria S.", skill: "Programming", credits: 15, rating: 4.9, reviews: 34, verified: true, color: "#e8f4e8", accent: "#2d6a4f", tag: "💻" },
  { type: "bounty", title: "Help me solve this calculus problem — due tonight!", credits: 20, answers: 3, deadline: "2h left", color: "#fff8e7", accent: "#b45309", tag: "🎯" },
  { type: "community", title: "How do I center a div in CSS? I've tried everything 😭", author: "jaypee_dev", upvotes: 47, answers: 12, skill: "Web Dev", color: "#f0f4ff", accent: "#3730a3", tag: "💬" },
  { type: "listing", title: "UI/UX Design Fundamentals with Figma", teacher: "Reina C.", skill: "Design", credits: 12, rating: 5.0, reviews: 18, verified: true, color: "#fdf0f8", accent: "#9d174d", tag: "🎨" },
  { type: "achievement", title: "🏆 Carlo just earned Top Teacher in JavaScript!", sub: "23 sessions · 4.9 stars", color: "#f0fdf4", accent: "#166534", tag: "⭐" },
  { type: "bounty", title: "Need someone to review my 5-page business plan", credits: 35, answers: 1, deadline: "1 day left", color: "#fff8e7", accent: "#b45309", tag: "🎯" },
  { type: "listing", title: "Guitar Basics — From zero to your first song", teacher: "Sam R.", skill: "Music", credits: 10, rating: 4.7, reviews: 52, verified: false, color: "#fef9f0", accent: "#92400e", tag: "🎵" },
  { type: "listing", title: "English Conversation Practice — Job-ready fluency", teacher: "Lisa M.", skill: "Language", credits: 8, rating: 4.8, reviews: 67, verified: true, color: "#f0fdf4", accent: "#166534", tag: "🌍" },
  { type: "bounty", title: "Translate this paragraph from Filipino to English", credits: 10, answers: 5, deadline: "3h left", color: "#fff8e7", accent: "#b45309", tag: "🎯" },
  { type: "community", title: "Best resources for learning React in 2025? Drop your recs 👇", author: "techie_anna", upvotes: 89, answers: 31, skill: "Programming", color: "#f0f4ff", accent: "#3730a3", tag: "💬" },
  { type: "listing", title: "Video Editing with CapCut — Reels, vlogs & transitions", teacher: "Kiko D.", skill: "Media", credits: 14, rating: 4.6, reviews: 29, verified: true, color: "#fdf0f8", accent: "#9d174d", tag: "🎬" },
  { type: "achievement", title: "🎯 Ana won 1st place on a Python bounty!", sub: "Earned 18 credits · Problem Solver badge", color: "#fffbf0", accent: "#92400e", tag: "⭐" },
];

const stats = [
  { num: "1,200+", label: "Active Users" },
  { num: "3,500+", label: "Sessions Done" },
  { num: "850+", label: "Bounties Solved" },
  { num: "₱0", label: "To Get Started" },
];

const features = [
  { icon: "🎓", title: "1-on-1 Sessions", desc: "Book private sessions with verified skill teachers. Credits held in escrow until you're satisfied." },
  { icon: "🎯", title: "Bounty Tasks", desc: "Post a problem, set a reward. The community competes to give you the best answer." },
  { icon: "💬", title: "Community Forum", desc: "Ask questions, share knowledge, earn credits just by helping others." },
  { icon: "✅", title: "Skill Verification", desc: "Teachers take quizzes to earn Verified badges — so you always know who's qualified." },
  { icon: "🔒", title: "Escrow Protection", desc: "Credits are locked until both parties confirm the session is complete. 100% safe." },
  { icon: "🏆", title: "XP & Levels", desc: "Earn XP, level up from Seedling to Legend, unlock badges and climb the leaderboard." },
];

const SignupPromptModal = ({ onClose }: { onClose: () => void }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(8px)" }}>
    <div style={{ background: "#fffdf7", borderRadius: 28, padding: "44px 40px", maxWidth: 440, width: "90%", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", border: "1.5px solid #e8e2d9" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>🌱</div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#1a1a1a", marginBottom: 10 }}>Join SkillCredit</h2>
      <p style={{ color: "#777", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
        Sign up free and get <strong style={{ color: "#2d6a4f" }}>20 credits</strong> instantly — enough to book your first session today.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a href="/signup" style={{ background: "#2d6a4f", color: "#fff", padding: "14px 24px", borderRadius: 14, fontWeight: 800, fontSize: 15, textDecoration: "none", display: "block" }}>
          Create free account 🎁
        </a>
        <a href="/login" style={{ background: "#f5f0e8", color: "#555", padding: "14px 24px", borderRadius: 14, fontWeight: 600, fontSize: 14, textDecoration: "none", display: "block" }}>
          I already have an account
        </a>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#bbb", fontSize: 13, cursor: "pointer", marginTop: 4 }}>
          Continue browsing
        </button>
      </div>
    </div>
  </div>
);

const MiniCard = ({ card, onClick }: { card: typeof mockCards[0]; onClick: () => void }) => (
  <div onClick={onClick}
    style={{ background: card.color, borderRadius: 16, padding: "16px 18px", marginBottom: 12, breakInside: "avoid", border: "1px solid rgba(0,0,0,0.06)", cursor: "pointer", transition: "transform 0.2s", display: "block" }}
    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform = "none"}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 14 }}>{card.tag}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: card.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {card.type === "listing" ? "Skill" : card.type === "bounty" ? "Bounty" : card.type === "achievement" ? "Achievement" : "Forum"}
      </span>
    </div>
    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.35, marginBottom: 6 }}>{card.title}</p>
    {card.type === "listing" && <p style={{ fontSize: 11, color: "#888" }}>by {card.teacher} · <strong style={{ color: card.accent }}>{card.credits} cr</strong> · ⭐{card.rating}</p>}
    {card.type === "bounty" && <p style={{ fontSize: 11, color: "#888" }}>🏆 <strong style={{ color: card.accent }}>{card.credits} cr</strong> reward · ⏱ {card.deadline}</p>}
    {card.type === "community" && <p style={{ fontSize: 11, color: "#888" }}>▲ {card.upvotes} · 💬 {card.answers} answers</p>}
    {card.type === "achievement" && <p style={{ fontSize: 11, color: "#888" }}>{card.sub}</p>}
  </div>
);

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visibleStats, setVisibleStats] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      if (window.scrollY > 300) setVisibleStats(true);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── GUEST MODE ──
  if (guestMode) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        {showModal && <SignupPromptModal onClose={() => setShowModal(false)} />}

        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,248,244,0.95)", backdropFilter: "blur(12px)", borderBottom: "1.5px solid #e8e2d9", padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>SkillCredit</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#aaa", background: "#f5f0e8", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>👀 Guest mode</span>
            <a href="/login" style={{ padding: "7px 16px", borderRadius: 10, border: "1.5px solid #2d6a4f", color: "#2d6a4f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Log in</a>
            <a href="/signup" style={{ padding: "7px 16px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Sign up free</a>
          </div>
        </nav>

        <div style={{ background: "linear-gradient(90deg, #2d6a4f, #1a4a35)", color: "#fff", textAlign: "center", padding: "10px", fontSize: 13, fontWeight: 600 }}>
          🎁 Sign up now and get <strong>20 free credits</strong> instantly!
          <a href="/signup" style={{ color: "#b7e4c7", marginLeft: 10, textDecoration: "underline", fontWeight: 800 }}>Create account →</a>
        </div>

        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a" }}>What's happening on SkillCredit ✨</h2>
              <p style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Browse listings, bounties, and community posts — sign up to participate</p>
            </div>
          </div>
          <div style={{ columns: "260px 4", gap: 16 }}>
            {mockCards.map((card, i) => <MiniCard key={i} card={card} onClick={() => setShowModal(true)} />)}
          </div>
        </div>

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1.5px solid #e8e2d9", padding: "14px 24px", display: "flex", justifyContent: "center", alignItems: "center", gap: 16, boxShadow: "0 -4px 24px rgba(0,0,0,0.07)" }}>
          <p style={{ fontSize: 14, color: "#555", margin: 0, fontWeight: 500 }}>Join thousands of Filipinos teaching and learning on SkillCredit</p>
          <a href="/signup" style={{ background: "#2d6a4f", color: "#fff", padding: "10px 22px", borderRadius: 12, fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Get started free →
          </a>
        </div>
        <div style={{ height: 70 }} />
      </div>
    );
  }

  // ── MAIN LANDING ──
  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .hero-tag { animation: fadeUp 0.6s ease both; }
        .hero-h1 { animation: fadeUp 0.6s 0.1s ease both; }
        .hero-p { animation: fadeUp 0.6s 0.2s ease both; }
        .hero-btns { animation: fadeUp 0.6s 0.3s ease both; }
        .hero-stats { animation: fadeUp 0.6s 0.4s ease both; }
        .preview-col { animation: fadeUp 0.7s 0.2s ease both; }
        .cta-btn { transition: transform 0.2s, box-shadow 0.2s; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(45,106,79,0.35) !important; }
        .ghost-btn { transition: all 0.2s; }
        .ghost-btn:hover { background: #ede8de !important; }
        .feature-card { transition: transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 36px rgba(0,0,0,0.09) !important; }
        .nav-link { transition: color 0.15s, background 0.15s; }
        .nav-link:hover { color: #2d6a4f !important; background: #f0f8f0 !important; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        background: scrolled ? "rgba(250,248,244,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1.5px solid #e8e2d9" : "1.5px solid transparent",
        padding: "0 48px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.3s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {["How it works", "Features", "Community"].map(label => (
            <a key={label} href={`#${label.toLowerCase().replace(/ /g, "-")}`} className="nav-link"
              style={{ padding: "7px 14px", borderRadius: 8, color: "#666", fontSize: 13, fontWeight: 600 }}>
              {label}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setGuestMode(true)} className="ghost-btn"
            style={{ padding: "8px 16px", borderRadius: 10, background: "#f5f0e8", color: "#666", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer" }}>
            Browse first
          </button>
          <a href="/login" style={{ padding: "8px 16px", borderRadius: 10, border: "1.5px solid #d4cfc6", color: "#555", fontWeight: 600, fontSize: 13 }}>Log in</a>
          <a href="/signup" className="cta-btn"
            style={{ padding: "8px 18px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontWeight: 800, fontSize: 13, boxShadow: "0 4px 14px rgba(45,106,79,0.25)" }}>
            Sign up free
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 48px 60px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>

        {/* Left */}
        <div>
          <div className="hero-tag" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#e8f4e8", border: "1.5px solid #b7e4c7", padding: "6px 16px", borderRadius: 999, marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2d6a4f", animation: "pulse 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 700 }}>🌱 Free to join — 20 credits on signup</span>
          </div>

          <h1 className="hero-h1" style={{ fontFamily: "'Fraunces', serif", fontSize: 56, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.08, marginBottom: 24, letterSpacing: "-0.02em" }}>
            Share skills.<br />
            <em style={{ color: "#2d6a4f", fontStyle: "italic" }}>Earn credits.</em><br />
            Keep learning.
          </h1>

          <p className="hero-p" style={{ fontSize: 17, color: "#666", lineHeight: 1.75, marginBottom: 36, maxWidth: 460 }}>
            A community where Filipinos teach what they know and learn what they don't — powered by a fair credit economy. No cash needed to start.
          </p>

          <div className="hero-btns" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 44 }}>
            <a href="/signup" className="cta-btn"
              style={{ background: "#2d6a4f", color: "#fff", padding: "16px 32px", borderRadius: 14, fontWeight: 800, fontSize: 16, boxShadow: "0 6px 24px rgba(45,106,79,0.28)", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start free — get 20 credits 🎁
            </a>
            <button onClick={() => setGuestMode(true)} className="ghost-btn"
              style={{ background: "#f5f0e8", color: "#555", padding: "16px 28px", borderRadius: 14, fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
              👀 Browse first
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stats" style={{ display: "flex", gap: 28 }}>
            {stats.map(s => (
              <div key={s.label}>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#2d6a4f", lineHeight: 1 }}>{s.num}</p>
                <p style={{ fontSize: 12, color: "#aaa", fontWeight: 600, marginTop: 3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — live preview */}
        <div className="preview-col" style={{ position: "relative" }}>
          {/* Glow blob */}
          <div style={{ position: "absolute", top: "10%", left: "10%", width: "80%", height: "80%", background: "radial-gradient(ellipse, rgba(45,106,79,0.12) 0%, transparent 70%)", pointerEvents: "none", borderRadius: "50%" }} />

          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.14), 0 0 0 1.5px #e8e2d9", background: "#fff" }}>
            {/* Mini browser chrome */}
            <div style={{ background: "#f5f0e8", padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1.5px solid #e8e2d9" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#fc605b", "#fdbc40", "#34c84a"].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />)}
              </div>
              <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "4px 12px", fontSize: 11, color: "#aaa", fontWeight: 600 }}>
                skillcredit.ph
              </div>
            </div>

            {/* Card preview */}
            <div style={{ padding: "16px", maxHeight: 460, overflowY: "hidden", maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)" }}>
              <div style={{ columns: "2", gap: 10 }}>
                {mockCards.slice(0, 8).map((card, i) => (
                  <div key={i} style={{ background: card.color, borderRadius: 14, padding: "14px", marginBottom: 10, breakInside: "avoid", border: "1px solid rgba(0,0,0,0.05)", animation: `fadeUp 0.5s ${i * 0.07}s ease both` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      <span style={{ fontSize: 12 }}>{card.tag}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: card.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {card.type === "listing" ? "Skill" : card.type === "bounty" ? "Bounty" : card.type === "achievement" ? "Win" : "Forum"}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 12, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.3, marginBottom: 4 }}>{card.title}</p>
                    {card.type === "listing" && <p style={{ fontSize: 10, color: "#999" }}>{card.teacher} · <strong style={{ color: card.accent }}>{card.credits} cr</strong></p>}
                    {card.type === "bounty" && <p style={{ fontSize: 10, color: "#999" }}>🏆 <strong style={{ color: card.accent }}>{card.credits} cr</strong> · {card.deadline}</p>}
                    {card.type === "community" && <p style={{ fontSize: 10, color: "#999" }}>▲ {card.upvotes} · 💬 {card.answers}</p>}
                    {card.type === "achievement" && <p style={{ fontSize: 10, color: "#999" }}>{card.sub}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ background: "#fff", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f", letterSpacing: "0.12em", textTransform: "uppercase" }}>How it works</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 900, color: "#1a1a1a", marginTop: 10, letterSpacing: "-0.02em" }}>Simple. Fair. Powerful.</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { icon: "🌱", num: "01", title: "Sign up & get 20 credits", desc: "Create your profile, list skills you can teach and skills you want to learn. 20 free credits land in your wallet instantly." },
              { icon: "📚", num: "02", title: "Book sessions or post bounties", desc: "Find a teacher and book a 1-on-1 session, or post a task bounty and let the community race to help you." },
              { icon: "⭐", num: "03", title: "Teach, earn, grow", desc: "Every session you teach earns credits. Every bounty you solve earns credits. Spend them to keep learning — forever." },
            ].map(item => (
              <div key={item.num} style={{ background: "#faf8f4", borderRadius: 20, padding: "32px 28px", border: "1.5px solid #e8e2d9", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, borderRadius: "50%", background: "#e8f4e8", opacity: 0.6 }} />
                <span style={{ fontSize: 36, display: "block", marginBottom: 16 }}>{item.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#2d6a4f", letterSpacing: "0.1em" }}>STEP {item.num}</span>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 900, color: "#1a1a1a", margin: "10px 0 12px" }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "#777", lineHeight: 1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "80px 48px", background: "#faf8f4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f", letterSpacing: "0.12em", textTransform: "uppercase" }}>Features</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 900, color: "#1a1a1a", marginTop: 10, letterSpacing: "-0.02em" }}>Everything you need to learn and earn</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {features.map((f, i) => (
              <div key={i} className="feature-card"
                style={{ background: "#fff", borderRadius: 18, padding: "28px", border: "1.5px solid #e8e2d9", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMUNITY PREVIEW ── */}
      <section id="community" style={{ background: "#fff", padding: "80px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f", letterSpacing: "0.12em", textTransform: "uppercase" }}>Community</span>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 900, color: "#1a1a1a", margin: "12px 0 18px", lineHeight: 1.15 }}>
                A living, breathing knowledge community
              </h2>
              <p style={{ fontSize: 15, color: "#666", lineHeight: 1.75, marginBottom: 28 }}>
                Ask questions in the forum, answer bounties, join skill groups, and watch your reputation grow. Every contribution earns you credits and XP.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {[
                  { icon: "💬", text: "Forum Q&A — ask anything, earn by answering" },
                  { icon: "🎯", text: "Bounty tasks — post problems with credit rewards" },
                  { icon: "👥", text: "Skill groups — find your learning community" },
                  { icon: "🏆", text: "Leaderboard — compete to be the top contributor" },
                ].map(item => (
                  <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 14, color: "#444", fontWeight: 500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <a href="/signup" className="cta-btn"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#2d6a4f", color: "#fff", padding: "13px 26px", borderRadius: 12, fontWeight: 800, fontSize: 14, boxShadow: "0 4px 16px rgba(45,106,79,0.25)" }}>
                Join the community →
              </a>
            </div>

            {/* Mini feed */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mockCards.filter(c => c.type === "community" || c.type === "achievement" || c.type === "bounty").slice(0, 5).map((card, i) => (
                <div key={i} style={{ background: card.color, borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(0,0,0,0.05)", animation: `slideIn 0.4s ${i * 0.1}s ease both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{card.tag}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: card.accent, textTransform: "uppercase" }}>
                      {card.type === "bounty" ? "Bounty" : card.type === "achievement" ? "Achievement" : "Forum"}
                    </span>
                  </div>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.3 }}>{card.title}</p>
                  {card.type === "bounty" && <p style={{ fontSize: 12, color: "#888" }}>🏆 {card.credits} credits · {card.deadline} · {card.answers} answers</p>}
                  {card.type === "achievement" && <p style={{ fontSize: 12, color: "#888" }}>{card.sub}</p>}
                  {card.type === "community" && <p style={{ fontSize: 12, color: "#888" }}>▲ {card.upvotes} upvotes · 💬 {card.answers} answers</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: "linear-gradient(135deg, #1a3d2e 0%, #2d6a4f 50%, #1a4a35 100%)", padding: "96px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, left: "10%", width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -80, right: "15%", width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 900, color: "#fff", marginBottom: 16, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Ready to start your<br /><em style={{ fontStyle: "italic", color: "#b7e4c7" }}>skill journey?</em>
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
            Join thousands of Filipino learners and teachers. It's free, it's fair, and it starts today.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/signup" className="cta-btn"
              style={{ background: "#fff", color: "#2d6a4f", padding: "18px 40px", borderRadius: 14, fontWeight: 900, fontSize: 17, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Create free account 🎁
            </a>
            <button onClick={() => setGuestMode(true)} className="ghost-btn"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff", padding: "18px 32px", borderRadius: 14, fontWeight: 700, fontSize: 16, border: "1.5px solid rgba(255,255,255,0.2)", cursor: "pointer" }}>
              Browse as guest →
            </button>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 20 }}>No credit card required · 20 free credits on signup · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#1a1a1a", padding: "28px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Credit</span>
        </div>
        <p style={{ fontSize: 13, color: "#555" }}>Built with ❤️ for Filipino learners and teachers</p>
        <div style={{ display: "flex", gap: 16 }}>
          {["Privacy", "Terms", "Contact"].map(l => (
            <a key={l} href="#" style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>{l}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}