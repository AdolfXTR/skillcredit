"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  xp: number;
  level: string;
  role: string;
};

const quickActions = [
  { icon: "🔍", label: "Browse Skills", desc: "Find a teacher", href: "/listings", color: "#e8f4e8", accent: "#2d6a4f" },
  { icon: "🎯", label: "Post Bounty", desc: "Get help fast", href: "/bounties", color: "#fff8e7", accent: "#b45309" },
  { icon: "🎓", label: "Create Listing", desc: "Start teaching", href: "/listings/create", color: "#f0ebff", accent: "#7c3aed" },
  { icon: "💬", label: "Community", desc: "Join discussions", href: "/community", color: "#fdf0f8", accent: "#9d174d" },
  { icon: "📅", label: "My Sessions", desc: "Manage bookings", href: "/sessions", color: "#e0f2fe", accent: "#0369a1" },
  { icon: "✉️", label: "Messages", desc: "Chat with users", href: "/messages", color: "#fce7f3", accent: "#be185d" },
  { icon: "✅", label: "Get Verified", desc: "Earn skill badges", href: "/verify", color: "#dcfce7", accent: "#166534" },
  { icon: "🏆", label: "Leaderboard", desc: "See top users", href: "/leaderboard", color: "#fef3c7", accent: "#d97706" },
];

const dailyChallenges = [
  { icon: "📚", text: "Complete a learning session today", credits: 5, xp: 10 },
  { icon: "💬", text: "Answer 2 forum questions", credits: 3, xp: 10 },
  { icon: "🎯", text: "Submit a bounty answer", credits: 3, xp: 10 },
];

const levelConfig: Record<string, { color: string; bg: string; icon: string; next: number }> = {
  Seedling:    { color: "#2d6a4f", bg: "#e8f4e8", icon: "🌱", next: 100 },
  Learner:     { color: "#0369a1", bg: "#e0f2fe", icon: "📚", next: 300 },
  Contributor: { color: "#7c3aed", bg: "#f0ebff", icon: "⚡", next: 600 },
  Skilled:     { color: "#b45309", bg: "#fff8e7", icon: "🔥", next: 1000 },
  Expert:      { color: "#dc2626", bg: "#fef2f2", icon: "💡", next: 2000 },
  Master:      { color: "#059669", bg: "#ecfdf5", icon: "🏆", next: 4000 },
  Legend:      { color: "#d97706", bg: "#fffbeb", icon: "💎", next: 9999 },
};

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good day");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);

      // Unread notifications
      const { count } = await supabase.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count || 0);
      setLoading(false);
    };
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
          <p style={{ color: "#888", fontSize: 15 }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const lvl = levelConfig[profile.level] || levelConfig["Seedling"];
  const xpProgress = Math.min((profile.xp / lvl.next) * 100, 100);
  const initials = profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }} onClick={() => setShowUserMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        .nav-link:hover { background: #f5f0e8 !important; }
        .action-card { transition: transform 0.18s, box-shadow 0.18s; }
        .action-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
        .challenge-card { transition: border-color 0.15s, background 0.15s; }
        .challenge-card:hover { border-color: #2d6a4f !important; background: #fafdf8 !important; }
        .dropdown-item:hover { background: #f5f0e8 !important; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        {/* Logo */}
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[
            { label: "Browse", href: "/listings" },
            { label: "Bounties", href: "/bounties" },
            { label: "Community", href: "/community" },
            { label: "Sessions", href: "/sessions" },
            { label: "Messages", href: "/messages" },
          ].map((nav) => (
            <a key={nav.label} href={nav.href} className="nav-link"
              style={{ padding: "7px 13px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, transition: "background 0.15s" }}>
              {nav.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Credits badge */}
          <a href="/wallet" style={{ background: "#e8f4e8", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span style={{ fontSize: 14 }}>💰</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>{profile.credits} cr</span>
          </a>

          {/* Notifications bell */}
          <a href="/notifications" style={{ position: "relative", width: 36, height: 36, borderRadius: 10, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none" }}>
            🔔
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                {unreadCount}
              </span>
            )}
          </a>

          {/* Avatar + dropdown */}
          <div style={{ position: "relative" }} onClick={e => { e.stopPropagation(); setShowUserMenu(p => !p); }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: lvl.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", border: `2px solid ${lvl.color}44` }}>
              {initials}
            </div>
            {showUserMenu && (
              <div style={{ position: "absolute", right: 0, top: 46, background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 16, padding: 8, minWidth: 200, boxShadow: "0 12px 40px rgba(0,0,0,0.12)", zIndex: 200 }}>
                {/* User info */}
                <div style={{ padding: "10px 14px 12px", borderBottom: "1px solid #f0ece4", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: lvl.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials}</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{profile.full_name}</p>
                      <p style={{ fontSize: 11, color: "#888" }}>@{profile.username} · {lvl.icon} {profile.level}</p>
                    </div>
                  </div>
                </div>
                {[
                  { icon: "👤", label: "My Profile", href: "/profile" },
                  { icon: "📋", label: "Create Listing", href: "/listings/create" },
                  { icon: "✅", label: "Get Verified", href: "/verify" },
                  { icon: "💰", label: "Wallet", href: "/wallet" },
                  { icon: "🏆", label: "Leaderboard", href: "/leaderboard" },
                  { icon: "🔔", label: "Notifications", href: "/notifications" },
                ].map(item => (
                  <a key={item.label} href={item.href} className="dropdown-item"
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 10, color: "#333", fontSize: 13, fontWeight: 600, transition: "background 0.12s" }}>
                    <span>{item.icon}</span> {item.label}
                  </a>
                ))}
                <div style={{ borderTop: "1px solid #f0ece4", marginTop: 4, paddingTop: 4 }}>
                  <button onClick={handleLogout}
                    style={{ width: "100%", textAlign: "left", padding: "9px 14px", borderRadius: 10, background: "none", border: "none", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    🚪 Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── WELCOME CARD ── */}
        <div style={{ background: "#fff", borderRadius: 24, padding: "28px 32px", marginBottom: 24, border: "1.5px solid #e8e2d9", position: "relative", overflow: "hidden" }}>
          {/* Top accent bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${lvl.color}, ${lvl.color}55)` }} />
          {/* Background decoration */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: `${lvl.color}08` }} />
          <div style={{ position: "absolute", bottom: -20, right: 80, width: 100, height: 100, borderRadius: "50%", background: `${lvl.color}05` }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, position: "relative" }}>
            {/* Left — user info */}
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: lvl.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: lvl.color, border: `2.5px solid ${lvl.color}33`, flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 13, color: "#999", marginBottom: 4 }}>{greeting} {lvl.icon}</p>
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#1a1a1a", marginBottom: 6 }}>
                  {profile.full_name}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "#999" }}>@{profile.username}</span>
                  <span style={{ background: lvl.bg, color: lvl.color, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>
                    {lvl.icon} {profile.level}
                  </span>
                </div>
              </div>
            </div>

            {/* Right — XP bar */}
            <div style={{ minWidth: 240 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#999", fontWeight: 600 }}>XP Progress</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: lvl.color }}>{profile.xp} / {lvl.next} XP</span>
              </div>
              <div style={{ background: "#f0ece4", borderRadius: 999, height: 10, overflow: "hidden" }}>
                <div style={{ width: `${xpProgress}%`, height: "100%", background: `linear-gradient(90deg, ${lvl.color}, ${lvl.color}bb)`, borderRadius: 999, transition: "width 0.6s ease" }} />
              </div>
              <p style={{ fontSize: 11, color: "#bbb", marginTop: 5, textAlign: "right" }}>
                {lvl.next - profile.xp} XP to next level
              </p>
            </div>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { icon: "💰", label: "Credits", value: profile.credits, color: "#2d6a4f", bg: "#e8f4e8", href: "/wallet" },
            { icon: "⚡", label: "XP Earned", value: profile.xp, color: "#7c3aed", bg: "#f0ebff", href: "/leaderboard" },
            { icon: "📅", label: "Sessions", value: 0, color: "#0369a1", bg: "#e0f2fe", href: "/sessions" },
            { icon: "🏆", label: "Bounties Won", value: 0, color: "#b45309", bg: "#fff8e7", href: "/bounties" },
          ].map((stat) => (
            <a key={stat.label} href={stat.href} style={{ background: "#fff", borderRadius: 18, padding: "20px", border: "1.5px solid #e8e2d9", textDecoration: "none", display: "block", transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {stat.icon}
                </div>
                <span style={{ fontSize: 12, color: "#999", fontWeight: 700 }}>{stat.label}</span>
              </div>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 900, color: stat.color }}>{stat.value}</p>
            </a>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Quick Actions */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "24px 26px", border: "1.5px solid #e8e2d9" }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a", marginBottom: 16 }}>Quick Actions</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {quickActions.map((action) => (
                  <a key={action.label} href={action.href} className="action-card"
                    style={{ background: action.color, borderRadius: 14, padding: "16px 14px", textDecoration: "none", display: "block", border: `1.5px solid ${action.accent}18` }}>
                    <span style={{ fontSize: 22 }}>{action.icon}</span>
                    <p style={{ fontWeight: 800, color: action.accent, fontSize: 13, margin: "8px 0 3px" }}>{action.label}</p>
                    <p style={{ fontSize: 11, color: "#999", margin: 0, lineHeight: 1.4 }}>{action.desc}</p>
                  </a>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "24px 26px", border: "1.5px solid #e8e2d9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a" }}>Recent Activity</h2>
                <a href="/notifications" style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 700 }}>View all →</a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px", background: "#e8f4e8", borderRadius: 14, marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>🎁</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>Welcome bonus credited</p>
                  <p style={{ fontSize: 12, color: "#888" }}>20 credits added to your wallet</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>Just now</span>
              </div>
              <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                <p style={{ color: "#bbb", fontSize: 13, marginBottom: 12 }}>Complete activities to see more here!</p>
                <a href="/listings" style={{ display: "inline-block", padding: "10px 22px", background: "#2d6a4f", color: "#fff", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
                  Browse Skills →
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Daily Challenges */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "22px", border: "1.5px solid #e8e2d9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a" }}>Daily Challenges 🎯</h2>
                <span style={{ fontSize: 10, color: "#aaa", background: "#f5f0e8", padding: "3px 9px", borderRadius: 20, fontWeight: 700 }}>Resets midnight</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dailyChallenges.map((c, i) => (
                  <div key={i} className="challenge-card"
                    style={{ background: "#fafaf8", borderRadius: 12, padding: "13px 14px", border: "1.5px solid #f0ece4", display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 2 }}>{c.text}</p>
                      <p style={{ fontSize: 11, color: "#aaa" }}>+{c.credits} cr · +{c.xp} XP</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet card */}
            <a href="/wallet" style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #1a4a35 100%)", borderRadius: 22, padding: "24px", color: "#fff", position: "relative", overflow: "hidden", textDecoration: "none", display: "block" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
              <div style={{ position: "absolute", bottom: -30, right: 20, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
              <p style={{ fontSize: 12, opacity: 0.65, marginBottom: 4, position: "relative", fontWeight: 600 }}>YOUR WALLET</p>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: 44, fontWeight: 900, margin: "0 0 2px", position: "relative", lineHeight: 1 }}>{profile.credits}</p>
              <p style={{ fontSize: 13, opacity: 0.65, marginBottom: 20, position: "relative" }}>credits · ₱{profile.credits * 10} value</p>
              <div style={{ display: "flex", gap: 8, position: "relative" }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.95)", color: "#2d6a4f", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 800, textAlign: "center" }}>
                  + Top Up
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 700, textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                  History
                </div>
              </div>
            </a>

            {/* Explore more */}
            <div style={{ background: "#fff", borderRadius: 22, padding: "22px", border: "1.5px solid #e8e2d9" }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a", marginBottom: 14 }}>Explore More</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "✅", label: "Get Skill Verified", desc: "Take a quiz, earn a badge", href: "/verify", color: "#166534" },
                  { icon: "🏆", label: "Leaderboard", desc: "See top earners this week", href: "/leaderboard", color: "#d97706" },
                  { icon: "⭐", label: "Ratings & Reviews", desc: "See what learners say", href: "/ratings", color: "#7c3aed" },
                ].map(item => (
                  <a key={item.label} href={item.href}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, background: "#fafaf8", border: "1.5px solid #f0ece4", textDecoration: "none", transition: "border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = item.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#f0ece4"}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: "#aaa" }}>{item.desc}</p>
                    </div>
                    <span style={{ marginLeft: "auto", fontSize: 14, color: "#ccc" }}>›</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}