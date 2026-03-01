"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string; credits: number; xp: number;
  level: string; role: string;
};
type Activity = { id: string; type: string; title: string; body: string; created_at: string; is_read: boolean; };

// ── Badge system (matching old BadgeSystem component logic) ──
const BADGE_TIERS = [
  { name: "Seedling", emoji: "🌱", color: "#2d6a4f", bg: "#dcfce7", desc: "Just getting started",  xpReq: 0,    sessionsReq: 0,   ratingReq: 0   },
  { name: "Rising",   emoji: "⭐", color: "#b45309", bg: "#fef3c7", desc: "Building momentum",     xpReq: 100,  sessionsReq: 3,   ratingReq: 3.5 },
  { name: "Pro",      emoji: "💎", color: "#7c3aed", bg: "#ede9fe", desc: "Proven skill sharer",   xpReq: 300,  sessionsReq: 15,  ratingReq: 4.0 },
  { name: "Elite",    emoji: "🔥", color: "#dc2626", bg: "#fee2e2", desc: "Top performer",          xpReq: 700,  sessionsReq: 40,  ratingReq: 4.5 },
  { name: "Legend",   emoji: "👑", color: "#d97706", bg: "#fffbeb", desc: "Community pillar",       xpReq: 2000, sessionsReq: 100, ratingReq: 4.8 },
];

function getBadgeTier(xp: number, sessions: number, rating: number) {
  let current = BADGE_TIERS[0];
  for (const t of BADGE_TIERS) {
    if (xp >= t.xpReq && sessions >= t.sessionsReq && rating >= t.ratingReq) current = t;
  }
  return current;
}
function getNextBadge(current: typeof BADGE_TIERS[0]) {
  const idx = BADGE_TIERS.findIndex(b => b.name === current.name);
  return idx < BADGE_TIERS.length - 1 ? BADGE_TIERS[idx + 1] : null;
}

// ── Level system ──
const LEVELS = [
  { name: "Seedling",    min: 0,    max: 99,   color: "#2d6a4f", next: "Learner" },
  { name: "Learner",     min: 100,  max: 299,  color: "#1d4ed8", next: "Contributor" },
  { name: "Contributor", min: 300,  max: 599,  color: "#7c3aed", next: "Skilled" },
  { name: "Skilled",     min: 600,  max: 999,  color: "#b45309", next: "Expert" },
  { name: "Expert",      min: 1000, max: 1999, color: "#dc2626", next: "Master" },
  { name: "Master",      min: 2000, max: 3999, color: "#0891b2", next: "Legend" },
  { name: "Legend",      min: 4000, max: Infinity, color: "#d97706", next: null },
];
const LEVEL_ICONS: Record<string, string> = {
  Seedling: "🌱", Learner: "📘", Contributor: "💎", Skilled: "⚡", Expert: "🔥", Master: "👑", Legend: "🌟",
};
const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600, Skilled: 1000, Expert: 2000, Master: 4000, Legend: 9999,
};

function getLevelInfo(xp: number) { return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0]; }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTIVITY_ICONS: Record<string, string> = {
  achievement: "🏆", platform: "📢", session: "📅", payment: "💰", message: "💬", review: "⭐",
};

const QUICK_ACTIONS = [
  { icon: "🔍", label: "Browse Skills",   desc: "Find a teacher",    href: "/listings",        color: "#2d6a4f" },
  { icon: "🎯", label: "Post Bounty",     desc: "Get help fast",     href: "/bounties",        color: "#b45309" },
  { icon: "🎓", label: "Create Listing",  desc: "Start teaching",    href: "/listings/create", color: "#7c3aed" },
  { icon: "💬", label: "Community",       desc: "Join discussions",  href: "/community",       color: "#0891b2" },
  { icon: "📅", label: "My Sessions",     desc: "Manage bookings",   href: "/sessions",        color: "#6366f1" },
  { icon: "✉️", label: "Messages",        desc: "Chat with users",   href: "/messages",        color: "#ec4899" },
  { icon: "✅", label: "Get Verified",    desc: "Earn skill badges", href: "/verify",          color: "#16a34a" },
  { icon: "🏆", label: "Leaderboard",     desc: "See top users",     href: "/leaderboard",     color: "#d97706" },
];

const DAILY_CHALLENGES = [
  { icon: "📚", text: "Complete a learning session today", credits: 5, xp: 10, href: "/sessions" },
  { icon: "💬", text: "Answer 2 forum questions",          credits: 3, xp: 10, href: "/community" },
  { icon: "🎯", text: "Submit a bounty answer",            credits: 3, xp: 10, href: "/bounties" },
];

export default function Dashboard() {
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [activities, setActivities]       = useState<Activity[]>([]);
  const [loading, setLoading]             = useState(true);
  const [greeting, setGreeting]           = useState("Good day");
  const [showMenu, setShowMenu]           = useState(false);
  const [unread, setUnread]               = useState(0);
  const [sessions, setSessions]           = useState(0);
  const [bountiesWon, setBountiesWon]     = useState(0);
  const [avgRating, setAvgRating]         = useState(0);
  const [repeatClients, setRepeatClients] = useState(0);
  const [disputes, setDisputes]           = useState(0);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // Profile
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);

      // Unread notifications
      const { count: nCount } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      setUnread(nCount || 0);

      // Recent notifications as activity feed
      const { data: acts } = await supabase
        .from("notifications").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(6);
      setActivities((acts as Activity[]) || []);

      // Completed sessions (as teacher OR learner)
      const { count: sCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status", "completed");
      setSessions(sCount || 0);

      // Bounties won (has placement)
      const { count: bCount } = await supabase
        .from("bounty_answers").select("*", { count: "exact", head: true })
        .eq("answerer_id", user.id)
        .not("placement", "is", null);
      setBountiesWon(bCount || 0);

      // Average rating from ratings table
      const { data: ratingData } = await supabase
        .from("ratings").select("overall").eq("rated_id", user.id);
      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }

      // Repeat clients (learners who booked more than once)
      const { data: sessionData } = await supabase
        .from("sessions").select("learner_id")
        .eq("teacher_id", user.id).eq("status", "completed");
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => { counts[s.learner_id] = (counts[s.learner_id] || 0) + 1; });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }

      // Disputes
      const { count: dCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id).eq("status", "disputed");
      setDisputes(dCount || 0);

      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
        <p style={{ color: "#aaa", fontSize: 14, fontWeight: 500 }}>Loading your dashboard…</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const levelInfo = getLevelInfo(profile.xp);
  const badge = getBadgeTier(profile.xp, sessions, avgRating);
  const nextBadge = getNextBadge(badge);
  const initials = profile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const xpNext = XP_TO_NEXT[profile.level] || 100;
  const xpPct = Math.min((profile.xp / xpNext) * 100, 100);

  // Reputation calc (matching old ReputationCard logic)
  const ratingPts = Math.min(Math.round(avgRating * sessions * 4), 80);
  const sessionPts = Math.min(sessions * 2, 15);
  const repeatPts = Math.min(repeatClients * 5, 10);
  const disputePts = disputes * -15;
  const rep = Math.max(0, Math.min(ratingPts + sessionPts + repeatPts + disputePts, 100));
  const repLabel = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'DM Sans', sans-serif" }} onClick={() => setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; color: inherit; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .card { background: #fff; border-radius: 20px; border: 1.5px solid #e8e2d9; box-shadow: 0 2px 12px rgba(0,0,0,0.03); }
        .action-card { transition: all 0.15s; cursor: pointer; border-radius: 16px; border: 1.5px solid #e8e2d9; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #fafaf8; }
        .action-card:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(0,0,0,0.09); }
        .stat-card { transition: all 0.15s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.07); }
        .xp-bar { background: linear-gradient(90deg, #2d6a4f, #52b788); background-size: 200%; animation: shimmer 2.5s infinite; border-radius: 999px; height: 100%; }
        .challenge-row { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 12px; border: 1.5px solid #e8e2d9; background: #fafaf8; cursor: pointer; transition: all 0.13s; }
        .challenge-row:hover { background: #f0fdf4; border-color: #86efac; transform: translateX(2px); }
        .nav-a { padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #666; transition: all 0.12s; display: inline-block; }
        .nav-a:hover { background: #eee9e0; color: #1a1a1a; }
        .rep-bar { border-radius: 999px; height: 5px; transition: width 1s; }
        .menu-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; transition: all 0.12s; cursor: pointer; }
        .menu-item:hover { background: #f5f0e8; color: #1a1a1a; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid #e8e2d9", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"], ["People", "/people"]].map(([l, h]) => (
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/wallet" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999, background: "#f0fdf4", border: "1.5px solid #86efac", fontSize: 13, fontWeight: 800, color: "#2d6a4f" }}>
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
            🔔
            {unread > 0 && <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid white" }}>{unread}</span>}
          </a>
          {/* Avatar + dropdown */}
          <div style={{ position: "relative" }} onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: levelInfo.color, color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${levelInfo.color}` }}>{initials}</div>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: 44, background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 18, padding: 8, width: 210, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", zIndex: 200 }}>
                {/* User info */}
                <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid #f0ece4", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: levelInfo.color, color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.2 }}>{profile.full_name}</div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>@{profile.username} · <span style={{ color: badge.color, fontWeight: 700 }}>{badge.emoji} {badge.name}</span></div>
                    </div>
                  </div>
                </div>
                {[
                  ["👤", "My Profile", "/profile"],
                  ["👥", "People", "/people"],
                  ["📋", "Create Listing", "/listings/create"],
                  ["✅", "Get Verified", "/verify"],
                  ["💰", "Wallet", "/wallet"],
                  ["🏆", "Leaderboard", "/leaderboard"],
                  ["🔔", "Notifications", "/notifications"],
                ].map(([icon, label, href]) => (
                  <a key={label} href={href} className="menu-item">{icon} {label}</a>
                ))}
                <div style={{ borderTop: "1px solid #f0ece4", marginTop: 6, paddingTop: 6 }}>
                  <button onClick={handleLogout} className="menu-item" style={{ width: "100%", background: "none", border: "none", color: "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>🚪 Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 28px" }}>

        {/* HERO WELCOME CARD */}
        <div className="card" style={{ padding: "26px 30px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, animation: "fadeUp 0.4s ease", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${levelInfo.color}, ${levelInfo.color}66)`, borderRadius: "20px 20px 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${levelInfo.color}, ${levelInfo.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", boxShadow: `0 8px 24px ${levelInfo.color}44` }}>{initials}</div>
              <div style={{ position: "absolute", bottom: -2, right: -2, background: "#fff", borderRadius: "50%", padding: 2, fontSize: 14, lineHeight: 1 }}>{LEVEL_ICONS[profile.level] || "🌱"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 3 }}>{greeting} {badge.emoji}</div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#111", lineHeight: 1.1, marginBottom: 6 }}>{profile.full_name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>@{profile.username}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: `${levelInfo.color}15`, color: levelInfo.color }}>{LEVEL_ICONS[profile.level]} {profile.level}</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.emoji} {badge.name}</span>
              </div>
            </div>
          </div>
          <div style={{ minWidth: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>XP Progress</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 900, color: levelInfo.color }}>{profile.xp} / {xpNext} XP</span>
            </div>
            <div style={{ height: 8, background: "#f0ece4", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
              <div className="xp-bar" style={{ width: `${xpPct}%` }} />
            </div>
            <div style={{ fontSize: 11, color: "#bbb", textAlign: "right" }}>{xpNext - profile.xp} XP to next level</div>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16, animation: "fadeUp 0.4s 0.07s ease both" }}>
          {[
            { icon: "💰", label: "Credits",      value: profile.credits, color: "#2d6a4f", bg: "#f0fdf4", href: "/wallet" },
            { icon: "⚡", label: "XP Earned",    value: profile.xp,      color: "#7c3aed", bg: "#f5f3ff", href: "/leaderboard" },
            { icon: "📅", label: "Sessions",     value: sessions,         color: "#0891b2", bg: "#e0f2fe", href: "/sessions" },
            { icon: "🏆", label: "Bounties Won", value: bountiesWon,      color: "#b45309", bg: "#fffbeb", href: "/bounties" },
          ].map(s => (
            <a key={s.label} href={s.href} className="card stat-card" style={{ padding: "18px 20px", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{s.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </a>
          ))}
        </div>

        {/* MAIN GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, animation: "fadeUp 0.4s 0.13s ease both" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* QUICK ACTIONS — 4 columns like old code */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a", marginBottom: 14 }}>Quick Actions</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {QUICK_ACTIONS.map(a => (
                  <a key={a.label} href={a.href} className="action-card">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${a.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{a.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: a.color, marginTop: 2 }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{a.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a" }}>Recent Activity</h2>
                <a href="/notifications" style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 700 }}>View all →</a>
              </div>
              {activities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
                  <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>Complete activities to see more here!</p>
                  <a href="/listings" style={{ display: "inline-block", padding: "9px 22px", background: "#2d6a4f", color: "#fff", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>Browse Skills →</a>
                </div>
              ) : activities.map((act, idx) => (
                <div key={act.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: idx < activities.length - 1 ? "1px solid #f5f0e8" : "none", alignItems: "flex-start" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {ACTIVITY_ICONS[act.type] || "📌"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{act.title}</div>
                    <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.5 }}>{act.body}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#ccc", fontWeight: 600, flexShrink: 0 }}>{timeAgo(act.created_at)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* BADGE CARD */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: "0.1em", textTransform: "uppercase" }}>Your Badge</div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 999, background: badge.bg, color: badge.color }}>{badge.emoji} {badge.name}</span>
              </div>
              <div style={{ background: badge.bg, borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{badge.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: badge.color }}>{badge.name}</div>
                  <div style={{ fontSize: 12, color: badge.color, opacity: 0.8 }}>{badge.desc}</div>
                </div>
              </div>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                {[{ icon: "⚡", val: profile.xp, label: "XP" }, { icon: "📚", val: sessions, label: "Sessions" }, { icon: "⭐", val: avgRating.toFixed(1), label: "Rating" }].map(s => (
                  <div key={s.label} style={{ background: "#f8f7f4", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, marginBottom: 3 }}>{s.icon}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a" }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Progress to next */}
              {nextBadge && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "#555" }}>Next: {nextBadge.emoji} {nextBadge.name}</span>
                    <span style={{ color: "#aaa" }}>{nextBadge.desc}</span>
                  </div>
                  {[
                    { icon: "⚡", label: "XP",       current: profile.xp,  req: nextBadge.xpReq },
                    { icon: "📚", label: "Sessions",  current: sessions,    req: nextBadge.sessionsReq },
                    { icon: "⭐", label: "Avg Rating", current: avgRating,  req: nextBadge.ratingReq },
                  ].map(r => {
                    const done = r.current >= r.req;
                    const pct = Math.min((r.current / r.req) * 100, 100);
                    return (
                      <div key={r.label} style={{ marginBottom: 9 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "#666", fontWeight: 600 }}>{r.icon} {r.label}</span>
                          <span style={{ color: done ? "#2d6a4f" : "#aaa", fontWeight: 700 }}>
                            {done ? "✓ Done" : `${typeof r.current === "number" && r.current % 1 !== 0 ? r.current.toFixed(1) : r.current} / ${r.req}`}
                          </span>
                        </div>
                        <div style={{ height: 5, background: "#f0ece4", borderRadius: 999, overflow: "hidden" }}>
                          <div className="rep-bar" style={{ width: `${pct}%`, background: done ? "#2d6a4f" : "#d4cec7" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* All tiers */}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0ece4" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#ccc", width: "100%", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>ALL TIERS</div>
                {BADGE_TIERS.map(t => (
                  <span key={t.name} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: t.name === badge.name ? t.bg : "#f5f0e8", color: t.name === badge.name ? t.color : "#bbb", border: t.name === badge.name ? `1px solid ${t.color}33` : "none" }}>
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            </div>

            {/* REPUTATION SCORE */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Reputation Score</div>
              <div style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>💫</span>
                  <div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#b45309", lineHeight: 1 }}>{rep}<span style={{ fontSize: 14, color: "#daa520" }}>/100</span></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>{repLabel}</div>
                  </div>
                </div>
                <div style={{ position: "relative", width: 52, height: 52 }}>
                  <svg viewBox="0 0 52 52" style={{ width: 52, height: 52, transform: "rotate(-90deg)" }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5"
                      strokeDasharray={`${(Math.min(rep, 100) / 100) * 131.9} 131.9`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces', serif", fontSize: 12, fontWeight: 900, color: "#f59e0b" }}>{rep}</div>
                </div>
              </div>
              <div style={{ height: 5, background: "#f0ece4", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${rep}%`, background: "linear-gradient(90deg, #f59e0b, #d97706)", borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Score Breakdown</div>
              {[
                { icon: "⭐", label: "Rating",   detail: `${avgRating.toFixed(1)} avg × ${sessions}`,         pts: ratingPts,  color: "#f59e0b", max: 80 },
                { icon: "📚", label: "Sessions", detail: `${sessions} sessions × 2`,                           pts: sessionPts, color: "#2d6a4f", max: 15 },
                { icon: "🔄", label: "Repeats",  detail: `${repeatClients} repeat clients × 5`,               pts: repeatPts,  color: "#6366f1", max: 10 },
                { icon: "⚠️", label: "Disputes", detail: disputes === 0 ? "No disputes ✓" : `${disputes} × -15`, pts: disputePts, color: disputes > 0 ? "#dc2626" : "#aaa", max: 0 },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{r.icon} {r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.pts > 0 ? "#2d6a4f" : r.pts < 0 ? "#dc2626" : "#aaa" }}>
                      {r.pts > 0 ? `+${r.pts}` : r.pts < 0 ? `${r.pts}` : "No disputes ✓"} {r.pts !== 0 ? "pts" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#bbb", marginBottom: r.max > 0 ? 5 : 0 }}>{r.detail}</div>
                  {r.max > 0 && (
                    <div style={{ height: 5, background: "#f0ece4", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((r.pts / r.max) * 100, 100)}%`, background: r.color, borderRadius: 999 }} />
                    </div>
                  )}
                </div>
              ))}
              {rep >= 80 && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#b45309", fontWeight: 600 }}>💫 {repLabel} reputation! You're in the top tier of SkillCredit</div>}
            </div>

            {/* DAILY CHALLENGES */}
            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 900, color: "#1a1a1a" }}>Daily Challenges 🎯</h2>
                <span style={{ fontSize: 10, color: "#aaa", background: "#f5f0e8", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>Resets midnight</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {DAILY_CHALLENGES.map((c, i) => (
                  <a key={i} href={c.href} className="challenge-row">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{c.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>{c.text}</div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>+{c.credits} cr · +{c.xp} XP</div>
                    </div>
                    <span style={{ color: "#ccc", fontSize: 14 }}>›</span>
                  </a>
                ))}
              </div>
            </div>

            {/* WALLET CTA */}
            <a href="/wallet" style={{ display: "block", background: "linear-gradient(135deg, #1a4a36, #2d6a4f 60%, #3a8a63)", borderRadius: 20, padding: "22px", color: "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, marginBottom: 3, letterSpacing: "0.1em", textTransform: "uppercase" }}>YOUR WALLET</p>
              <p style={{ fontFamily: "'Fraunces', serif", fontSize: 42, fontWeight: 900, lineHeight: 1, marginBottom: 2 }}>{profile.credits}</p>
              <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 18 }}>credits · ₱{profile.credits * 10} value</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#fff", color: "#2d6a4f", textAlign: "center", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 900 }}>+ Top Up</div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.1)", color: "#fff", textAlign: "center", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.2)" }}>History</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}