"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

type Profile = {
  id: string; full_name: string; username: string; credits: number; xp: number;
  level: string; role: string; avatar_url?: string;
  xp_multiplier?: number; multiplier_ends_at?: string | null;
  champion_title?: string | null; champion_streak?: number;
};
type Activity = {
  id: string; type: string; title: string; body: string;
  created_at: string; is_read: boolean; link?: string;
};
type ChampionData = { rank: number; credits_bonus: number; xp_earned: number; week_start: string } | null;

const BADGE_TIERS = [
  { name: "Seedling", emoji: "🌱", color: "#2d6a4f", bg: "#dcfce7", desc: "Just getting started",  xpReq: 0,    sessionsReq: 0  },
  { name: "Rising",   emoji: "⭐", color: "#b45309", bg: "#fef3c7", desc: "Building momentum",     xpReq: 100,  sessionsReq: 0  },
  { name: "Pro",      emoji: "🔥", color: "#7c3aed", bg: "#ede9fe", desc: "Proven skill sharer",   xpReq: 500,  sessionsReq: 5  },
  { name: "Elite",    emoji: "💎", color: "#dc2626", bg: "#fee2e2", desc: "Top performer",          xpReq: 2000, sessionsReq: 20 },
  { name: "Legend",   emoji: "👑", color: "#d97706", bg: "#fffbeb", desc: "Community pillar",       xpReq: 5000, sessionsReq: 50 },
];
function getBadgeTier(xp: number, sessions: number) {
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const t = BADGE_TIERS[i];
    if (xp >= t.xpReq && sessions >= t.sessionsReq) return t;
  }
  return BADGE_TIERS[0];
}
function getNextBadge(current: typeof BADGE_TIERS[0]) {
  const idx = BADGE_TIERS.findIndex(b => b.name === current.name);
  return idx < BADGE_TIERS.length - 1 ? BADGE_TIERS[idx + 1] : null;
}
const LEVELS = [
  { name: "Seedling",    min: 0,    max: 99,       color: "#2d6a4f" },
  { name: "Learner",     min: 100,  max: 299,      color: "#1d4ed8" },
  { name: "Contributor", min: 300,  max: 599,      color: "#7c3aed" },
  { name: "Skilled",     min: 600,  max: 999,      color: "#b45309" },
  { name: "Expert",      min: 1000, max: 1999,     color: "#dc2626" },
  { name: "Master",      min: 2000, max: 3999,     color: "#0891b2" },
  { name: "Legend",      min: 4000, max: Infinity, color: "#d97706" },
];
const LEVEL_ICONS: Record<string, string> = {
  Seedling: "🌱", Learner: "📘", Contributor: "💡", Skilled: "⚡",
  Expert: "🔥", Master: "🌊", Legend: "👑",
};
const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600, Skilled: 1000,
  Expert: 2000, Master: 4000, Legend: 9999,
};
function getLevelInfo(xp: number) {
  return LEVELS.find(l => xp >= l.min && xp <= l.max) || LEVELS[0];
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const days = Math.floor(h / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}
function getMultiplierTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}
function getWeekResetCountdown() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  const diff = nextMonday.getTime() - now.getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return `${d}d ${h}h`;
}
function getWeekKey() {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().split("T")[0];
}

// ── Activity helpers ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  session:      { color:"#0891b2", bg:"#e0f2fe", border:"#bae6fd", label:"Session",     icon:"📅" },
  session_call: { color:"#6366f1", bg:"#e0e7ff", border:"#a5b4fc", label:"Call",         icon:"📹" },
  message:      { color:"#7c3aed", bg:"#ede9fe", border:"#c4b5fd", label:"Message",      icon:"💬" },
  credit:       { color:"#2d6a4f", bg:"#dcfce7", border:"#86efac", label:"Credits",      icon:"💰" },
  forum_earn:   { color:"#2d6a4f", bg:"#dcfce7", border:"#86efac", label:"Earned",       icon:"⭐" },
  achievement:  { color:"#b45309", bg:"#fef3c7", border:"#fde68a", label:"Achievement",  icon:"🏆" },
  platform:     { color:"#64748b", bg:"#f1f5f9", border:"#cbd5e1", label:"Platform",     icon:"📢" },
  rating:       { color:"#f59e0b", bg:"#fffbeb", border:"#fde68a", label:"Rating",       icon:"⭐" },
  review:       { color:"#f59e0b", bg:"#fffbeb", border:"#fde68a", label:"Review",       icon:"⭐" },
  dispute:      { color:"#dc2626", bg:"#fee2e2", border:"#fca5a5", label:"Dispute",      icon:"⚠️" },
  bounty:       { color:"#b45309", bg:"#fffbeb", border:"#fde68a", label:"Bounty",       icon:"🎯" },
};
function parseActivityBody(type: string, body: string): string {
  if (!body) return "";
  if (body.trim().startsWith("{")) {
    try {
      const p = JSON.parse(body);
      if (p.url) return "Sent a file";
      if (p.amount !== undefined && p.from_id) return `${p.amount} credits transferred`;
      if (p.content) return p.content;
      return Object.entries(p)
        .filter(([k]) => !k.endsWith("_id") && k !== "type" && k !== "url")
        .map(([, v]) => String(v))
        .join(" · ");
    } catch {}
  }
  // Truncate long raw URLs
  if (body.startsWith("http") || body.startsWith("{")) return "";
  return body.length > 120 ? body.slice(0, 120) + "…" : body;
}
function getActivityActions(act: Activity): { label: string; href: string; primary: boolean }[] {
  if (act.type === "message")
    return [{ label: "💬 Reply", href: "/messages", primary: true }];
  if (act.type === "session" && act.title?.toLowerCase().includes("complet"))
    return [{ label: "⭐ Rate Now", href: act.link || "/sessions", primary: true }];
  if (act.type === "session" && (act.title?.toLowerCase().includes("book") || act.title?.toLowerCase().includes("request")))
    return [{ label: "✓ Manage", href: "/sessions", primary: true }];
  if (act.type === "credit" || act.type === "forum_earn")
    return [{ label: "View Wallet", href: "/wallet", primary: false }];
  if (act.type === "achievement")
    return [{ label: "🏆 View", href: "/profile", primary: true }];
  if (act.link) return [{ label: "View →", href: act.link, primary: false }];
  return [];
}

// Star rating display
function StarRating({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "#ddd" }}>☆☆☆☆☆</span>;
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ color: i <= Math.round(value) ? "#f59e0b" : "#e5e7eb", fontSize: 13 }}>
          {i <= Math.floor(value) ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

// PRIMARY actions (large cards)
const PRIMARY_ACTIONS = [
  { icon: "🔍", label: "Browse Skills",  desc: "Find a teacher",    href: "/listings",        color: "#2d6a4f", bg: "#f0fdf4" },
  { icon: "🎯", label: "Post a Bounty",  desc: "Get help fast",     href: "/bounties",        color: "#b45309", bg: "#fffbeb" },
  { icon: "🎓", label: "Create Listing", desc: "Start teaching",    href: "/listings/create", color: "#7c3aed", bg: "#f5f3ff" },
];
const SECONDARY_ACTIONS = [
  { icon: "💬", label: "Community",    href: "/community", color: "#0891b2" },
  { icon: "📅", label: "Sessions",     href: "/sessions",  color: "#6366f1" },
  { icon: "✉️", label: "Messages",     href: "/messages",  color: "#ec4899" },
  { icon: "✅", label: "Get Verified", href: "/verify",    color: "#16a34a" },
  { icon: "⭐", label: "My Ratings",   href: "/ratings",   color: "#f59e0b" },
];

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const colors = ["#e8a800","#2d6a4f","#c0392b","#3498db","#9b59b6","#e74c3c","#f39c12"];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i, color: colors[i % colors.length], left: Math.random() * 100,
    delay: Math.random() * 1.5, duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8, rotation: Math.random() * 360,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", top: -20, left: `${p.left}%`,
          width: p.size, height: p.size, background: p.color,
          borderRadius: p.size < 10 ? "50%" : "2px", transform: `rotate(${p.rotation}deg)`,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Claim Rewards Modal ───────────────────────────────────────────────────────
function ClaimModal({ rank, champion, profile, onClaim, onLater }: {
  rank: number; champion: NonNullable<ChampionData>; profile: Profile;
  onClaim: () => void; onLater: () => void;
}) {
  const rankColors = { 1: "#e8a800", 2: "#94a3b8", 3: "#cd7f32" };
  const rankEmoji  = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const multiplier = rank === 1 ? 1.25 : rank === 2 ? 1.15 : 1.10;
  const color      = rankColors[rank as keyof typeof rankColors] || "#e8a800";
  return (
    <>
      <Confetti />
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#fff", borderRadius: 28, padding: "40px 36px", maxWidth: 460, width: "100%", textAlign: "center", position: "relative", boxShadow: "0 32px 80px rgba(0,0,0,.3)", animation: "modalPop .4s cubic-bezier(.34,1.56,.64,1)" }}>
          <div style={{ fontSize: 72, marginBottom: 8, animation: "crownBounce 1s ease infinite" }}>{rank === 1 ? "👑" : rankEmoji}</div>
          <div style={{ display: "inline-block", background: `${color}18`, border: `1.5px solid ${color}44`, borderRadius: 99, padding: "4px 16px", marginBottom: 16, fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".1em" }}>
            {rank === 1 ? "🏆 Champion" : rank === 2 ? "🥈 Runner Up" : "🥉 Third Place"} — Week of {champion.week_start}
          </div>
          <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 900, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.2 }}>
            Congratulations,<br />{profile.full_name.split(" ")[0]}! 🎉
          </h2>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>
            You finished <strong style={{ color }}>#{rank} on the leaderboard</strong> this week. Here are your rewards:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {[
              { icon: "💰", label: `+${champion.credits_bonus} credits`, desc: "Added to your wallet", color: "#2d6a4f", bg: "#f0fdf4" },
              { icon: "⚡", label: `${multiplier}x XP Multiplier`, desc: "Active for 7 days", color: "#c0392b", bg: "#fdf0ee" },
              rank === 1 ? { icon: "📌", label: "Listing Featured on Browse", desc: "Your top listing is pinned", color: "#7c3aed", bg: "#f5f3ff" } : null,
              { icon: "🏅", label: `${rank === 1 ? "👑 Champion" : rank === 2 ? "🥈 Silver" : "🥉 Bronze"} Avatar Border`, desc: "Visible on your profile", color, bg: `${color}15` },
            ].filter(Boolean).map((r: any) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, background: r.bg, borderRadius: 14, padding: "12px 16px", textAlign: "left" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>{r.desc}</div>
                </div>
                <span style={{ fontSize: 16, color: r.color }}>✓</span>
              </div>
            ))}
          </div>
          <button onClick={onClaim} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: "#fff", background: `linear-gradient(135deg,${color},${color}bb)`, boxShadow: `0 8px 24px ${color}44`, marginBottom: 10 }}>
            🎁 Claim My Rewards!
          </button>
          <button onClick={onLater} style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", cursor: "pointer", background: "transparent", fontSize: 13, color: "#aaa", fontWeight: 600 }}>
            Remind me later
          </button>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [profile, setProfile]                 = useState<Profile | null>(null);
  const [activities, setActivities]           = useState<Activity[]>([]);
  const [activityAvatars, setActivityAvatars] = useState<Record<string, string | null>>({});
  const [loading, setLoading]                 = useState(true);
  const [greeting, setGreeting]               = useState("Good day");
  const [greetingEmoji, setGreetingEmoji]     = useState("☀️");
  const [showMenu, setShowMenu]               = useState(false);
  const [unread, setUnread]                   = useState(0);
  const [sessions, setSessions]               = useState(0);
  const [pendingSessions, setPendingSessions] = useState(0);
  const [bountiesWon, setBountiesWon]         = useState(0);
  const [avgRating, setAvgRating]             = useState<number | null>(null);
  const [ratingCount, setRatingCount]         = useState(0);
  const [repeatClients, setRepeatClients]     = useState(0);
  const [disputes, setDisputes]               = useState(0);
  const [championData, setChampionData]       = useState<ChampionData>(null);
  const [myRank, setMyRank]                   = useState<number>(0);
  const [showClaimModal, setShowClaimModal]   = useState(false);
  const [rewardClaimed, setRewardClaimed]     = useState(false);
  const [multiplierLeft, setMultiplierLeft]   = useState<string | null>(null);
  const [weekReset, setWeekReset]             = useState("");
  // Day streak / today's goal
  const [todaySession, setTodaySession]       = useState(false);
  const [dayStreak, setDayStreak]             = useState(0);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) { setGreeting("Good morning"); setGreetingEmoji("☀️"); }
    else if (h < 18) { setGreeting("Good afternoon"); setGreetingEmoji("⛅"); }
    else { setGreeting("Good evening"); setGreetingEmoji("🌙"); }
    setWeekReset(getWeekResetCountdown());

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("*,xp_multiplier,multiplier_ends_at,champion_title,champion_streak")
        .eq("id", user.id).single();
      if (p) setProfile(p);

      if (p?.multiplier_ends_at && p?.xp_multiplier > 1) {
        setMultiplierLeft(getMultiplierTimeLeft(p.multiplier_ends_at));
      }

      // ── Week champion ────────────────────────────────────────────────────
      const weekStart = getWeekKey();
      try {
        const { data: champ } = await supabase
          .from("weekly_champions").select("rank,credits_bonus,xp_earned,week_start")
          .eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();
        if (champ) {
          setChampionData(champ as ChampionData);
          setMyRank(champ.rank);
          const claimKey = `reward_claimed_${user.id}_${weekStart}`;
          if (!localStorage.getItem(claimKey)) setShowClaimModal(true);
          else setRewardClaimed(true);
        }
      } catch {}

      // ── Unread count ─────────────────────────────────────────────────────
      const { count: nCount } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      setUnread(nCount || 0);

      // ── Recent activity (last 8) ─────────────────────────────────────────
      const { data: acts } = await supabase
        .from("notifications").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(8);
      const actList = (acts as Activity[]) || [];
      setActivities(actList);

      // Fetch sender avatars for activity items
      const senderNames: string[] = actList
        .map(a => {
          const m = a.title.match(/from\s+(.+)/i);
          return m ? m[1].trim() : null;
        })
        .filter(Boolean) as string[];
      const uniqueNames = [...new Set(senderNames)];
      if (uniqueNames.length > 0) {
        const { data: senderProfiles } = await supabase
          .from("profiles")
          .select("id,full_name,avatar_url")
          .in("full_name", uniqueNames);
        const avatarMap: Record<string, string | null> = {};
        (senderProfiles || []).forEach((sp: any) => {
          avatarMap[sp.full_name] = sp.avatar_url || null;
        });
        setActivityAvatars(avatarMap);
      }

      // ── Sessions ─────────────────────────────────────────────────────────
      const { count: sCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status", "completed");
      setSessions(sCount || 0);

      const { count: pendingCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id).eq("status", "pending");
      setPendingSessions(pendingCount || 0);

      // ── TODAY'S GOAL: session completed today ────────────────────────────
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status", "completed")
        .gte("updated_at", todayMidnight.toISOString());
      setTodaySession((todayCount || 0) > 0);

      // ── DAY STREAK: consecutive days with ≥1 completed session ──────────
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: recentSessions } = await supabase
        .from("sessions").select("updated_at")
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status", "completed")
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .order("updated_at", { ascending: false });

      if (recentSessions && recentSessions.length > 0) {
        // Build set of date strings (YYYY-MM-DD) where sessions occurred
        const datesWithSession = new Set(
          recentSessions.map((s: any) => new Date(s.updated_at).toISOString().split("T")[0])
        );
        let streak = 0;
        const check = new Date();
        // If today already has a session, count today; otherwise start from yesterday
        const todayStr = check.toISOString().split("T")[0];
        if (!datesWithSession.has(todayStr)) {
          check.setDate(check.getDate() - 1);
        }
        while (true) {
          const dateStr = check.toISOString().split("T")[0];
          if (!datesWithSession.has(dateStr)) break;
          streak++;
          check.setDate(check.getDate() - 1);
          if (streak > 30) break;
        }
        setDayStreak(streak);
      }

      // ── Bounties won ─────────────────────────────────────────────────────
      const { count: bCount } = await supabase
        .from("bounty_answers").select("*", { count: "exact", head: true })
        .eq("answerer_id", user.id).not("placement", "is", null);
      setBountiesWon(bCount || 0);

      // ── Ratings ──────────────────────────────────────────────────────────
      const { data: ratingData } = await supabase
        .from("ratings").select("overall").eq("rated_id", user.id).eq("is_flagged", false);
      if (ratingData && ratingData.length > 0) {
        const rawRatings = ratingData.map((r: { overall: number }) => r.overall);
        setAvgRating(parseFloat(bayesianAvg(rawRatings).toFixed(2)));
        setRatingCount(rawRatings.length);
      }

      // ── Repeat clients ───────────────────────────────────────────────────
      const { data: sessionData } = await supabase
        .from("sessions").select("learner_id").eq("teacher_id", user.id).eq("status", "completed");
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => { counts[s.learner_id] = (counts[s.learner_id] || 0) + 1; });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }

      // ── Disputes ─────────────────────────────────────────────────────────
      const { count: dCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id).eq("status", "disputed");
      setDisputes(dCount || 0);

      setLoading(false);
    };
    load();
  }, []);

  const handleClaim = () => {
    if (!profile) return;
    localStorage.setItem(`reward_claimed_${profile.id}_${getWeekKey()}`, "1");
    setShowClaimModal(false);
    setRewardClaimed(true);
  };
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s ease infinite" }}>🌱</div>
        <p style={{ color: "#aaa", fontSize: 14 }}>Loading your dashboard…</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const levelInfo = getLevelInfo(profile.xp);
  const badge     = getBadgeTier(profile.xp, sessions);
  const nextBadge = getNextBadge(badge);
  const initials  = profile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const xpNext    = XP_TO_NEXT[levelInfo.name] || 100;
  const xpPct     = Math.min((profile.xp / xpNext) * 100, 100);
  const xpToGo    = Math.max(0, xpNext - profile.xp);
  const avatarUrl = profile.avatar_url || null;
  const isChampion = myRank >= 1 && myRank <= 3;
  const hasMulti  = profile.xp_multiplier && profile.xp_multiplier > 1
    && profile.multiplier_ends_at && new Date(profile.multiplier_ends_at) > new Date();

  const rankBorderColor = myRank === 1 ? "#e8a800" : myRank === 2 ? "#c0c0c0" : myRank === 3 ? "#cd7f32" : null;

  const ratingPts  = avgRating ? Math.min(Math.round(avgRating * sessions * 4), 80) : 0;
  const sessionPts = Math.min(sessions * 2, 15);
  const repeatPts  = Math.min(repeatClients * 5, 10);
  const disputePts = disputes * -15;
  const rep        = Math.max(0, Math.min(ratingPts + sessionPts + repeatPts + disputePts, 100));
  const repLabel   = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";
  const ratingDisplay  = avgRating !== null ? avgRating.toFixed(2) : "—";
  const ratingSubLabel = avgRating !== null ? `${ratingCount} review${ratingCount !== 1 ? "s" : ""}` : "No ratings yet";
  const ratingPercentile = avgRating !== null
    ? avgRating >= 4.8 ? "Top 5%" : avgRating >= 4.5 ? "Top 15%" : avgRating >= 4.0 ? "Top 35%" : "Top 60%"
    : null;
  const subGreeting = isChampion
    ? `Ready to defend your #${myRank} spot today? 🔥`
    : sessions === 0
    ? "Complete your first session to start earning XP!"
    : `Keep it up — ${xpToGo} XP until your next level!`;
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#f8f7f4", fontFamily: "'DM Sans',sans-serif" }} onClick={() => setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp    {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes shimmer   {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulse     {0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes goldSpin  {0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 18px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.8)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 14px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e0e0e0,0 0 22px rgba(200,200,200,.6)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 22px rgba(232,160,80,.5)}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes modalPop  {from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes crownBounce{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-12px) rotate(5deg)}}
        @keyframes xpPulse   {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.02)}}
        @keyframes countUp   {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9;box-shadow:0 2px 12px rgba(0,0,0,.03)}
        .action-card-primary{transition:all .2s cubic-bezier(.34,1.2,.64,1);cursor:pointer;border-radius:18px;border:1.5px solid #e8e2d9;padding:20px;display:flex;flex-direction:column;gap:10px;background:#fafaf8}
        .action-card-primary:hover{transform:translateY(-4px) scale(1.01);box-shadow:0 14px 40px rgba(0,0,0,.1)}
        .action-card-secondary{transition:all .15s;cursor:pointer;border-radius:14px;border:1.5px solid #e8e2d9;padding:12px 14px;display:flex;align-items:center;gap:10px;background:#fafaf8}
        .action-card-secondary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.07)}
        .stat-card{transition:all .15s}
        .stat-card:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.08)}
        .activity-row{transition:background .12s;border-radius:12px}
        .activity-row:hover{background:#f9f8f6}
        .xp-bar{background:linear-gradient(90deg,#2d6a4f,#52b788,#84cc9e);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:all .12s}
        .nav-a:hover{background:#eee9e0;color:#1a1a1a}
        .menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;transition:all .12s;cursor:pointer}
        .menu-item:hover{background:#f5f0e8;color:#1a1a1a}
        .rep-bar{border-radius:999px;height:5px}
        .gold-avatar{animation:goldSpin 2s ease infinite}
        .silver-avatar{animation:silverPulse 2s ease infinite}
        .bronze-avatar{animation:bronzePulse 2s ease infinite}
        .multi-badge{animation:xpPulse 1.5s ease infinite}
        .pending-badge{animation:xpPulse 1.2s ease infinite}
        @media(max-width:900px){
          .main-grid{grid-template-columns:1fr!important}
          .stats-row{grid-template-columns:repeat(3,1fr)!important}
          .quick-primary{grid-template-columns:1fr!important}
          .sidebar{display:none!important}
        }
        @media(max-width:600px){
          .stats-row{grid-template-columns:repeat(2,1fr)!important}
          .nav-links{display:none!important}
        }
      `}</style>

      {showClaimModal && championData && (
        <ClaimModal rank={myRank} champion={championData} profile={profile} onClaim={handleClaim} onLater={() => setShowClaimModal(false)} />
      )}

      {/* ── NAVBAR ── */}
      <nav style={{ background: "rgba(255,255,255,.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid #e8e2d9", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div className="nav-links" style={{ display: "flex", gap: 2 }}>
          {[["Explore","/listings"],["Bounties","/bounties"],["Teach","/listings/create"],["Messages","/messages"],["Community","/community"]].map(([l,h]) => (
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/wallet" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 999, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1.5px solid #86efac", fontSize: 13, fontWeight: 800, color: "#2d6a4f" }}>
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" style={{ position: "relative", width: 36, height: 36, borderRadius: "50%", background: "#f5f0e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
            🔔
            {unread > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid white" }}>
                {unread}
              </span>
            )}
          </a>
          <div style={{ position: "relative" }} onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}>
            <div className={myRank === 1 ? "gold-avatar" : myRank === 2 ? "silver-avatar" : myRank === 3 ? "bronze-avatar" : ""}
              style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", cursor: "pointer", background: avatarUrl ? "transparent" : levelInfo.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: rankBorderColor ? undefined : `0 0 0 2px white, 0 0 0 3.5px ${levelInfo.color}` }}>
              {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>{initials}</span>}
            </div>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: 44, background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 18, padding: 8, width: 210, boxShadow: "0 16px 48px rgba(0,0,0,.15)", zIndex: 200 }}>
                <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid #f0ece4", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: avatarUrl ? "transparent" : levelInfo.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>{initials}</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a" }}>{profile.full_name}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>@{profile.username} · <span style={{ color: badge.color, fontWeight: 700 }}>{badge.emoji} {badge.name}</span></div>
                    </div>
                  </div>
                </div>
                {[["👤","My Profile","/profile"],["📋","Create Listing","/listings/create"],["✅","Get Verified","/verify"],["⭐","My Ratings","/ratings"],["💰","Wallet","/wallet"],["🏆","Leaderboard","/leaderboard"],["🔔","Notifications","/notifications"],["👥","People","/people"]].map(([icon,label,href]) => (
                  <a key={label} href={href} className="menu-item">{icon} {label}</a>
                ))}
                <div style={{ borderTop: "1px solid #f0ece4", marginTop: 6, paddingTop: 6 }}>
                  <button onClick={handleLogout} className="menu-item" style={{ width: "100%", background: "none", border: "none", color: "#ef4444", fontFamily: "'DM Sans',sans-serif" }}>🚪 Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px" }}>

        {/* Pending alert */}
        {pendingSessions > 0 && (
          <a href="/sessions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(90deg,#fffbeb,#fef3c7)", border: "1.5px solid #fde68a", borderRadius: 14, padding: "12px 18px", marginBottom: 12, gap: 12, animation: "fadeUp .3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pending-badge" style={{ fontSize: 18 }}>⏳</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>{pendingSessions} pending session request{pendingSessions > 1 ? "s" : ""} awaiting your response</span>
            </div>
            <div style={{ background: "#f59e0b", color: "#fff", padding: "6px 16px", borderRadius: 99, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>Review →</div>
          </a>
        )}

        {/* ── HERO PROFILE CARD ── */}
        <div className="card" style={{ padding: "24px 28px", marginBottom: 14, animation: "fadeUp .4s ease", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: rankBorderColor ? `linear-gradient(90deg,${rankBorderColor},${rankBorderColor}66)` : `linear-gradient(90deg,${levelInfo.color},${levelInfo.color}66)`, borderRadius: "20px 20px 0 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div className={myRank === 1 ? "gold-avatar" : myRank === 2 ? "silver-avatar" : myRank === 3 ? "bronze-avatar" : ""}
                  style={{ width: 62, height: 62, borderRadius: "50%", overflow: "hidden", background: avatarUrl ? "transparent" : `linear-gradient(135deg,${levelInfo.color},${levelInfo.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: rankBorderColor ? undefined : `0 8px 24px ${levelInfo.color}44` }}>
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{initials}</span>}
                </div>
                <div style={{ position: "absolute", bottom: -2, right: -2, background: "#fff", borderRadius: "50%", padding: 2, fontSize: 14, lineHeight: 1 }}>
                  {myRank === 1 ? "👑" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : LEVEL_ICONS[levelInfo.name]}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 3 }}>{greeting}, {firstName} {greetingEmoji}</div>
                <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1.1, marginBottom: 6 }}>{profile.full_name}</h1>
                <p style={{ fontSize: 12, color: "#888", marginBottom: 8, fontStyle: "italic" }}>{subGreeting}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#aaa" }}>@{profile.username}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: `${levelInfo.color}15`, color: levelInfo.color }}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.color}22` }}>{badge.emoji} {badge.name}</span>
                  {profile.champion_title && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "#fffbeb", color: "#e8a800", border: "1px solid #f0d890" }}>🏆 {profile.champion_title}{profile.champion_streak && profile.champion_streak > 1 ? ` ×${profile.champion_streak}` : ""}</span>}
                  {hasMulti && <span className="multi-badge" style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "#fdf0ee", color: "#c0392b", border: "1px solid #f0b8b0" }}>⚡ {profile.xp_multiplier}x XP{multiplierLeft ? ` · ${multiplierLeft}` : ""}</span>}
                  {avgRating !== null && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>⭐ {avgRating.toFixed(2)}</span>}
                </div>
              </div>
            </div>
            <div style={{ minWidth: 250, flex: "0 0 250px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>XP{hasMulti ? ` ⚡${profile.xp_multiplier}x` : ""}</span>
                <span style={{ fontFamily: "'Fraunces',serif", fontSize: 15, fontWeight: 900, color: levelInfo.color }}>{profile.xp} / {xpNext}</span>
              </div>
              <div style={{ height: 8, background: "#f0ece4", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                <div className="xp-bar" style={{ width: `${xpPct}%`, transition: "width 1s ease" }} />
              </div>
              {xpToGo > 0
                ? <div style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>🔥 {xpToGo} XP to <span style={{ color: levelInfo.color }}>{LEVELS[(LEVELS.findIndex(l => l.name === levelInfo.name) + 1) % LEVELS.length]?.name || "Max"}</span></div>
                : <div style={{ fontSize: 11, color: "#2d6a4f", fontWeight: 700 }}>🎉 Max level reached!</div>
              }
              {isChampion && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", background: myRank === 1 ? "linear-gradient(90deg,#1a3d2e,#2d6a4f)" : myRank === 2 ? "linear-gradient(90deg,#2c3e50,#34495e)" : "linear-gradient(90deg,#4a2c0a,#7a4a1a)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{myRank === 1 ? "👑" : myRank === 2 ? "🥈" : "🥉"}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#fff" }}>#{myRank} This Week</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.55)", fontWeight: 600 }}>Resets in {weekReset}</div>
                    </div>
                  </div>
                  {!rewardClaimed
                    ? <button onClick={() => setShowClaimModal(true)} style={{ background: "#e8a800", color: "#1a1a1a", padding: "6px 14px", borderRadius: 99, fontSize: 11, fontWeight: 900, border: "none", cursor: "pointer" }}>🎁 Claim</button>
                    : <a href="/leaderboard" style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.8)", background: "rgba(255,255,255,.1)", padding: "6px 14px", borderRadius: 99, border: "1px solid rgba(255,255,255,.2)" }}>Leaderboard →</a>
                  }
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── STATS ROW ── */}
        <div className="stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 14, animation: "fadeUp .4s .07s ease both" }}>
          {[
            { icon: "💰", label: "Credits",      value: profile.credits, sub: "in wallet",    color: "#2d6a4f", bg: "#f0fdf4", href: "/wallet"      },
            { icon: "⚡", label: "XP Earned",    value: profile.xp,      sub: levelInfo.name, color: "#7c3aed", bg: "#f5f3ff", href: "/leaderboard" },
            { icon: "📅", label: "Sessions",     value: sessions,         sub: "completed",    color: "#0891b2", bg: "#e0f2fe", href: "/sessions"    },
            { icon: "🏆", label: "Bounties Won", value: bountiesWon,      sub: "solved",       color: "#b45309", bg: "#fffbeb", href: "/bounties"    },
          ].map(s => (
            <a key={s.label} href={s.href} className="card stat-card" style={{ padding: "18px 20px", display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{s.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em" }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#bbb", fontWeight: 600, marginTop: 4 }}>{s.sub}</div>
            </a>
          ))}
          <a href="/ratings" className="card stat-card" style={{ padding: "18px 20px", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⭐</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: ".05em" }}>Rating</span>
            </div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 900, color: avgRating !== null ? "#f59e0b" : "#d1cec8", lineHeight: 1 }}>{ratingDisplay}</div>
            <div style={{ marginTop: 4, marginBottom: 2 }}><StarRating value={avgRating} /></div>
            <div style={{ fontSize: 10, color: "#bbb", fontWeight: 600 }}>{ratingSubLabel}</div>
            {ratingPercentile && <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 800, marginTop: 3 }}>{ratingPercentile} of teachers</div>}
          </a>
        </div>

        {/* ── TODAY'S GOAL STRIP ── */}
        <div style={{ marginBottom: 14, animation: "fadeUp .4s .1s ease both" }}>
          <div style={{ background: todaySession ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "linear-gradient(135deg,#fff7ed,#fef3c7)", border: `1.5px solid ${todaySession ? "#86efac" : "#fed7aa"}`, borderRadius: 16, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: todaySession ? "#2d6a4f22" : "#fb923c22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
              {todaySession ? "✅" : "🎯"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: todaySession ? "#166534" : "#92400e", marginBottom: 3 }}>
                Today's Goal
                {!todaySession && <span style={{ marginLeft: 10, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: "#fb923c22", color: "#ea580c" }}>Reward: +15 XP · +2 Rep</span>}
              </div>
              <div style={{ fontSize: 12, color: todaySession ? "#2d6a4f" : "#b45309", marginBottom: 7, fontWeight: 600 }}>
                {todaySession ? "Session complete! +15 XP bonus earned today 🎉" : "Complete 1 session today for +15 XP bonus"}
              </div>
              <div style={{ height: 5, background: todaySession ? "#bbf7d0" : "#fde68a", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: todaySession ? "100%" : "0%", background: todaySession ? "linear-gradient(90deg,#2d6a4f,#52b788)" : "linear-gradient(90deg,#f59e0b,#d97706)", borderRadius: 99, transition: "width 1s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: todaySession ? "#2d6a4f" : "#b45309", marginTop: 4, fontWeight: 700 }}>
                {todaySession ? "1 / 1 complete" : "0 / 1 sessions"}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0, minWidth: 64 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 900, color: dayStreak > 0 ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}>
                🔥 {dayStreak}
              </div>
              <div style={{ fontSize: 9, color: "#b45309", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>Day Streak</div>
              {dayStreak > 0 && <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>Keep it up!</div>}
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, animation: "fadeUp .4s .13s ease both" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Quick Actions */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a" }}>Quick Actions</h2>
                <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600 }}>Primary</span>
              </div>
              <div className="quick-primary" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
                {PRIMARY_ACTIONS.map(a => (
                  <a key={a.label} href={a.href} className="action-card-primary" style={{ background: a.bg, borderColor: `${a.color}22` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${a.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{a.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: a.color, marginTop: 4 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{a.desc}</div>
                  </a>
                ))}
              </div>
              <div style={{ borderTop: "1px dashed #e8e2d9", paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: "#ccc", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Also available</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                  {SECONDARY_ACTIONS.map(a => (
                    <a key={a.label} href={a.href} className="action-card-secondary" style={{ flexDirection: "column", gap: 5, textAlign: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18 }}>{a.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RECENT ACTIVITY — notifications style ── */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 900, color: "#1a1a1a" }}>Recent Activity</h2>
                  {unread > 0 && <span style={{ fontSize: 11, color: "#2d6a4f", fontWeight: 700 }}>{unread} unread</span>}
                </div>
                <a href="/notifications" style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 700 }}>View all →</a>
              </div>
              {activities.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
                  <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16 }}>No activity yet — complete a session to get started!</p>
                  <a href="/listings" style={{ display: "inline-block", padding: "9px 22px", background: "#2d6a4f", color: "#fff", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>Browse Skills →</a>
                </div>
              ) : activities.map((act, idx) => {
                const cfg = TYPE_CONFIG[act.type] || { color:"#555", bg:"#f5f0e8", border:"#e8e2d9", label:"Activity", icon:"📌" };
                const cleanBody = parseActivityBody(act.type, act.body);
                const actions = getActivityActions(act);
                // Extract sender name for avatar
                const senderMatch = act.title.match(/from\s+(.+)/i);
                const senderName = senderMatch ? senderMatch[1].trim() : null;
                const senderAvatar = senderName ? activityAvatars[senderName] : null;
                const senderInitials = senderName ? senderName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : cfg.icon;

                return (
                  <div key={act.id} className="activity-row"
                    style={{ display: "flex", gap: 12, padding: "14px 10px", borderBottom: idx < activities.length - 1 ? "1px solid #f5f0e8" : "none", alignItems: "flex-start", borderLeft: act.is_read ? "none" : "3px solid #2d6a4f", paddingLeft: act.is_read ? 10 : 13, marginLeft: act.is_read ? 0 : -3 }}>
                    {/* Avatar or icon */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {senderName && (senderAvatar || true) ? (
                        <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: senderAvatar ? "transparent" : cfg.bg, border: `2px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {senderAvatar
                            ? <img src={senderAvatar} alt={senderName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{senderInitials}</span>
                          }
                        </div>
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                          {cfg.icon}
                        </div>
                      )}
                      {/* Type badge overlay on avatar */}
                      <div style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%", background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>
                        {cfg.icon}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: act.is_read ? 600 : 800, color: "#1a1a1a", lineHeight: 1.35 }}>{act.title}</div>
                        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: "#ccc", fontWeight: 600, whiteSpace: "nowrap" as const }}>{timeAgo(act.created_at)}</span>
                          {!act.is_read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2d6a4f" }} />}
                        </div>
                      </div>
                      {cleanBody && <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 8 }}>{cleanBody}</div>}
                      {/* Badges + actions row */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                        {!act.is_read && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 999, background: "#e8f4e8", color: "#2d6a4f" }}>New</span>}
                        {actions.map((a, ai) => (
                          <a key={ai} href={a.href}
                            style={{ fontSize: 11, fontWeight: 800, padding: "4px 11px", borderRadius: 8, background: a.primary ? "#2d6a4f" : "#f5f0e8", color: a.primary ? "#fff" : "#555", border: a.primary ? "none" : "1.5px solid #e8e2d9", cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {a.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="sidebar" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <a href="/wallet" style={{ display: "block", background: "linear-gradient(135deg,#1a4a36,#2d6a4f 60%,#3a8a63)", borderRadius: 20, padding: "22px", color: "#fff", position: "relative", overflow: "hidden", transition: "transform .15s", boxShadow: "0 8px 28px rgba(45,106,79,.3)" }}
              onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
              <p style={{ fontSize: 10, fontWeight: 700, opacity: .6, marginBottom: 3, letterSpacing: ".1em", textTransform: "uppercase" }}>💰 Your Wallet</p>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: 42, fontWeight: 900, lineHeight: 1, marginBottom: 2 }}>{profile.credits}</p>
              <p style={{ fontSize: 13, opacity: .6, marginBottom: 4 }}>credits available</p>
              <p style={{ fontSize: 11, opacity: .5, marginBottom: 18 }}>≈ ₱{profile.credits * 10} value</p>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "#fff", color: "#2d6a4f", textAlign: "center", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 900 }}>+ Top Up</div>
                <div style={{ flex: 1, background: "rgba(255,255,255,.1)", color: "#fff", textAlign: "center", padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,.2)" }}>Withdraw</div>
              </div>
            </a>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: ".1em", textTransform: "uppercase" }}>Badge & Level</div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: `${levelInfo.color}15`, color: levelInfo.color }}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
              </div>
              <div style={{ background: badge.bg, borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{badge.emoji}</span>
                <div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: badge.color }}>{badge.name}</div>
                  <div style={{ fontSize: 12, color: badge.color, opacity: .75 }}>{badge.desc}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
                {[
                  { icon: "⚡", val: profile.xp,   label: "XP"       },
                  { icon: "📚", val: sessions,      label: "Sessions" },
                  { icon: "⭐", val: ratingDisplay, label: "Rating"   },
                ].map(s => (
                  <div key={s.label} style={{ background: "#f8f7f4", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 15, marginBottom: 3 }}>{s.icon}</div>
                    <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: s.label === "Rating" && avgRating === null ? "#ccc" : "#1a1a1a" }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {avgRating === null && (
                <a href="/sessions" style={{ display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                  <span>⭐</span><span>Complete a session to get your first review!</span><span style={{ marginLeft: "auto" }}>→</span>
                </a>
              )}
              {nextBadge && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: "#555" }}>Next: {nextBadge.emoji} {nextBadge.name}</span>
                    <span style={{ color: "#aaa" }}>{nextBadge.desc}</span>
                  </div>
                  {[
                    { icon: "⚡", label: "XP",       current: profile.xp, req: nextBadge.xpReq       },
                    { icon: "📚", label: "Sessions", current: sessions,   req: nextBadge.sessionsReq },
                  ].filter(r => r.req > 0).map(r => {
                    const done = r.current >= r.req;
                    const pct  = Math.min((r.current / r.req) * 100, 100);
                    return (
                      <div key={r.label} style={{ marginBottom: 9 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "#666", fontWeight: 600 }}>{r.icon} {r.label}</span>
                          <span style={{ color: done ? "#2d6a4f" : "#aaa", fontWeight: 700 }}>{done ? "✓ Done" : `${r.current} / ${r.req}`}</span>
                        </div>
                        <div style={{ height: 5, background: "#f0ece4", borderRadius: 999, overflow: "hidden" }}>
                          <div className="rep-bar" style={{ width: `${pct}%`, background: done ? "#2d6a4f" : "#d4cec7" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: ".1em", textTransform: "uppercase" }}>Reputation</div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#b45309", background: "#fffbeb", padding: "3px 10px", borderRadius: 99, border: "1px solid #fde68a" }}>{repLabel}</span>
              </div>
              <div style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>💫</span>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 26, fontWeight: 900, color: "#b45309", lineHeight: 1 }}>{rep}<span style={{ fontSize: 14, color: "#daa520" }}>/100</span></div>
                </div>
                <svg viewBox="0 0 52 52" style={{ width: 52, height: 52, transform: "rotate(-90deg)", flexShrink: 0 }}>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep,100)/100)*131.9} 131.9`} strokeLinecap="round" />
                </svg>
              </div>
              {[
                { icon: "⭐", label: "Rating",   pts: ratingPts,  max: 80, detail: avgRating !== null ? `${avgRating.toFixed(2)} avg × ${sessions} sessions` : "No ratings yet", color: "#f59e0b" },
                { icon: "📚", label: "Sessions", pts: sessionPts, max: 15, detail: `${sessions} × 2 pts`, color: "#2d6a4f" },
                { icon: "🔄", label: "Repeats",  pts: repeatPts,  max: 10, detail: `${repeatClients} repeat clients × 5`, color: "#6366f1" },
                { icon: "⚠️", label: "Disputes", pts: disputePts, max: 0,  detail: disputes === 0 ? "No disputes ✓" : `${disputes} × -15 pts`, color: disputes > 0 ? "#dc2626" : "#aaa" },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{r.icon} {r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.pts > 0 ? "#2d6a4f" : r.pts < 0 ? "#dc2626" : "#aaa" }}>
                      {r.pts > 0 ? `+${r.pts}` : r.pts < 0 ? `${r.pts}` : "✓"}{r.pts !== 0 ? " pts" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#bbb", marginBottom: r.max > 0 ? 4 : 0 }}>{r.detail}</div>
                  {r.max > 0 && (
                    <div style={{ height: 4, background: "#f0ece4", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min((r.pts / r.max) * 100, 100)}%`, background: r.color, borderRadius: 999 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isChampion && (
              <a href="/leaderboard" style={{ display: "block", background: "linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)", borderRadius: 20, padding: "20px", color: "#fff", transition: "transform .15s", boxShadow: "0 8px 28px rgba(67,56,202,.3)" }}
                onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}>
                <div style={{ fontSize: 10, fontWeight: 800, opacity: .5, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>🏆 Leaderboard</div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Compete for #1 👑</div>
                <div style={{ fontSize: 12, opacity: .6, marginBottom: 14 }}>Top 3 earn credits, XP boosts + featured listings every week.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    { emoji: "🥇", label: "#1", reward: "+50 cr · 1.25x XP" },
                    { emoji: "🥈", label: "#2", reward: "+30 cr · 1.15x XP" },
                  ].map(r => (
                    <div key={r.label} style={{ background: "rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 14 }}>{r.emoji} <span style={{ fontWeight: 900 }}>{r.label}</span></div>
                      <div style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>{r.reward}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, opacity: .6 }}>Week resets in</div>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: "#fbbf24" }}>{weekReset}</div>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}