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
type Activity = { id: string; type: string; title: string; body: string; created_at: string; is_read: boolean; link?: string };
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
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function getMultiplierTimeLeft(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}
function getWeekKey() {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().split("T")[0];
}
const ACTIVITY_ICONS: Record<string, string> = {
  achievement: "🏆", platform: "📢", session: "📅", payment: "💰",
  message: "💬", review: "⭐", credit: "💰", dispute: "⚠️", bounty: "🎯",
};
const QUICK_ACTIONS = [
  { icon: "🔍", label: "Browse Skills",  desc: "Find a teacher",    href: "/listings",        color: "#2d6a4f" },
  { icon: "🎯", label: "Post Bounty",    desc: "Get help fast",     href: "/bounties",        color: "#b45309" },
  { icon: "🎓", label: "Create Listing", desc: "Start teaching",    href: "/listings/create", color: "#7c3aed" },
  { icon: "💬", label: "Community",      desc: "Join discussions",  href: "/community",       color: "#0891b2" },
  { icon: "📅", label: "My Sessions",    desc: "Manage bookings",   href: "/sessions",        color: "#6366f1" },
  { icon: "✉️", label: "Messages",       desc: "Chat with users",   href: "/messages",        color: "#ec4899" },
  { icon: "✅", label: "Get Verified",   desc: "Earn skill badges", href: "/verify",          color: "#16a34a" },
  { icon: "⭐", label: "My Ratings",     desc: "See your reviews",  href: "/ratings",         color: "#f59e0b" },
];

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const colors = ["#e8a800","#2d6a4f","#c0392b","#3498db","#9b59b6","#e74c3c","#f39c12"];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9999, overflow:"hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:"absolute", top:-20, left:`${p.left}%`,
          width:p.size, height:p.size,
          background:p.color, borderRadius:p.size < 10 ? "50%" : "2px",
          transform:`rotate(${p.rotation}deg)`,
          animation:`confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
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
      {/* Backdrop */}
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", backdropFilter:"blur(6px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ background:"#fff", borderRadius:28, padding:"40px 36px", maxWidth:460, width:"100%", textAlign:"center", position:"relative", boxShadow:"0 32px 80px rgba(0,0,0,.3)", animation:"modalPop .4s cubic-bezier(.34,1.56,.64,1)" }}>

          {/* Glow ring */}
          <div style={{ position:"absolute", inset:-2, borderRadius:30, background:`linear-gradient(135deg,${color},${color}44,transparent)`, zIndex:-1 }} />

          {/* Crown / medal */}
          <div style={{ fontSize:72, marginBottom:8, animation:"crownBounce 1s ease infinite" }}>{rank === 1 ? "👑" : rankEmoji}</div>

          <div style={{ display:"inline-block", background:`${color}18`, border:`1.5px solid ${color}44`, borderRadius:99, padding:"4px 16px", marginBottom:16, fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:".1em" }}>
            {rank === 1 ? "🏆 Champion" : rank === 2 ? "🥈 Runner Up" : "🥉 Third Place"} — Week of {champion.week_start}
          </div>

          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:900, color:"#1a1a1a", marginBottom:8, lineHeight:1.2 }}>
            Congratulations,<br />{profile.full_name.split(" ")[0]}! 🎉
          </h2>
          <p style={{ fontSize:14, color:"#888", marginBottom:28 }}>
            You finished <strong style={{ color }}>#{rank} on the leaderboard</strong> this week. Here are your rewards:
          </p>

          {/* Rewards list */}
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
            {[
              { icon:"💰", label:`+${champion.credits_bonus} credits`, desc:"Added to your wallet", color:"#2d6a4f", bg:"#f0fdf4" },
              { icon:"⚡", label:`${multiplier}x XP Multiplier`, desc:"Active for 7 days", color:"#c0392b", bg:"#fdf0ee" },
              rank === 1 ? { icon:"📌", label:"Listing Featured on Browse", desc:"Your top listing is pinned", color:"#7c3aed", bg:"#f5f3ff" } : null,
              rank === 1 ? { icon:"🌟", label:"Community Shoutout", desc:"Auto-posted to the feed", color:"#b45309", bg:"#fffbeb" } : null,
              { icon:"🏅", label:`${rank === 1 ? "👑 Champion" : rank === 2 ? "🥈 Silver" : "🥉 Bronze"} Avatar Border`, desc:"Visible on your profile", color, bg:`${color}15` },
            ].filter(Boolean).map((r: any) => (
              <div key={r.label} style={{ display:"flex", alignItems:"center", gap:12, background:r.bg, borderRadius:14, padding:"12px 16px", textAlign:"left" }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{r.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:r.color }}>{r.label}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{r.desc}</div>
                </div>
                <span style={{ fontSize:16, color:r.color }}>✓</span>
              </div>
            ))}
          </div>

          <button onClick={onClaim} style={{ width:"100%", padding:"16px", borderRadius:16, border:"none", cursor:"pointer", fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#fff", background:`linear-gradient(135deg,${color},${color}bb)`, boxShadow:`0 8px 24px ${color}44`, marginBottom:10, transition:"transform .15s" }}
            onMouseOver={e=>(e.currentTarget.style.transform="scale(1.02)")}
            onMouseOut={e=>(e.currentTarget.style.transform="scale(1)")}>
            🎁 Claim My Rewards!
          </button>
          <button onClick={onLater} style={{ width:"100%", padding:"10px", borderRadius:12, border:"none", cursor:"pointer", background:"transparent", fontSize:13, color:"#aaa", fontWeight:600 }}>
            Remind me later
          </button>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [profile, setProfile]                   = useState<Profile | null>(null);
  const [activities, setActivities]             = useState<Activity[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [greeting, setGreeting]                 = useState("Good day");
  const [showMenu, setShowMenu]                 = useState(false);
  const [unread, setUnread]                     = useState(0);
  const [sessions, setSessions]                 = useState(0);
  const [pendingSessions, setPendingSessions]   = useState(0);
  const [bountiesWon, setBountiesWon]           = useState(0);
  const [avgRating, setAvgRating]               = useState<number | null>(null);
  const [ratingCount, setRatingCount]           = useState(0);
  const [repeatClients, setRepeatClients]       = useState(0);
  const [disputes, setDisputes]                 = useState(0);
  // ── Perks state ──
  const [championData, setChampionData]         = useState<ChampionData>(null);
  const [myRank, setMyRank]                     = useState<number>(0);
  const [showClaimModal, setShowClaimModal]     = useState(false);
  const [rewardClaimed, setRewardClaimed]       = useState(false);
  const [multiplierLeft, setMultiplierLeft]     = useState<string | null>(null);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      // Fetch profile WITH new perk columns (graceful fallback)
      const { data: p } = await supabase
        .from("profiles")
        .select("*,xp_multiplier,multiplier_ends_at,champion_title,champion_streak")
        .eq("id", user.id).single();
      if (p) setProfile(p);

      // XP multiplier countdown
      if (p?.multiplier_ends_at && p?.xp_multiplier > 1) {
        const left = getMultiplierTimeLeft(p.multiplier_ends_at);
        setMultiplierLeft(left);
      }

      // Check if this user is in the weekly_champions this week
      const weekStart = getWeekKey();
      try {
        const { data: champ } = await supabase
          .from("weekly_champions")
          .select("rank,credits_bonus,xp_earned,week_start")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .maybeSingle();

        if (champ) {
          setChampionData(champ as ChampionData);
          setMyRank(champ.rank);

          // Show modal only once per week per user (tracked in localStorage)
          const claimKey = `reward_claimed_${user.id}_${weekStart}`;
          const alreadyClaimed = localStorage.getItem(claimKey);
          if (!alreadyClaimed) setShowClaimModal(true);
          else setRewardClaimed(true);
        }
      } catch (e) {
        // weekly_champions table doesn't exist yet — skip silently
      }

      const { count: nCount } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      setUnread(nCount || 0);

      const { data: acts } = await supabase
        .from("notifications").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(6);
      setActivities((acts as Activity[]) || []);

      const { count: sCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status", "completed");
      setSessions(sCount || 0);

      const { count: pendingCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id).eq("status", "pending");
      setPendingSessions(pendingCount || 0);

      const { count: bCount } = await supabase
        .from("bounty_answers").select("*", { count: "exact", head: true })
        .eq("answerer_id", user.id).not("placement", "is", null);
      setBountiesWon(bCount || 0);

      const { data: ratingData } = await supabase
        .from("ratings").select("overall").eq("rated_id", user.id).eq("is_flagged", false);
      if (ratingData && ratingData.length > 0) {
        const rawRatings = ratingData.map((r: { overall: number }) => r.overall);
        setAvgRating(parseFloat(bayesianAvg(rawRatings).toFixed(2)));
        setRatingCount(rawRatings.length);
      }

      const { data: sessionData } = await supabase
        .from("sessions").select("learner_id")
        .eq("teacher_id", user.id).eq("status", "completed");
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => { counts[s.learner_id] = (counts[s.learner_id] || 0) + 1; });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }

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
    const weekStart = getWeekKey();
    localStorage.setItem(`reward_claimed_${profile.id}_${weekStart}`, "1");
    setShowClaimModal(false);
    setRewardClaimed(true);
  };

  const handleLater = () => setShowClaimModal(false);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = "/"; };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f8f7f4", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16, animation:"pulse 1.5s ease infinite" }}>🌱</div>
        <p style={{ color:"#aaa", fontSize:14 }}>Loading your dashboard…</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const levelInfo  = getLevelInfo(profile.xp);
  const badge      = getBadgeTier(profile.xp, sessions);
  const nextBadge  = getNextBadge(badge);
  const initials   = profile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const xpNext     = XP_TO_NEXT[levelInfo.name] || 100;
  const xpPct      = Math.min((profile.xp / xpNext) * 100, 100);
  const avatarUrl  = profile.avatar_url || null;
  const isChampion = myRank >= 1 && myRank <= 3;
  const hasMulti   = profile.xp_multiplier && profile.xp_multiplier > 1 && profile.multiplier_ends_at && new Date(profile.multiplier_ends_at) > new Date();

  // Avatar border colors for top 3
  const rankBorderColor = myRank === 1 ? "#e8a800" : myRank === 2 ? "#c0c0c0" : myRank === 3 ? "#cd7f32" : null;
  const rankGlow        = myRank === 1 ? "rgba(232,168,0,.6)" : myRank === 2 ? "rgba(160,160,160,.45)" : myRank === 3 ? "rgba(205,127,50,.45)" : null;
  const avatarBoxShadow = rankBorderColor
    ? `0 0 0 3px ${rankBorderColor}, 0 0 18px ${rankGlow}, 0 0 36px ${rankGlow}`
    : `0 8px 24px ${levelInfo.color}44`;

  const ratingPts  = avgRating ? Math.min(Math.round(avgRating * sessions * 4), 80) : 0;
  const sessionPts = Math.min(sessions * 2, 15);
  const repeatPts  = Math.min(repeatClients * 5, 10);
  const disputePts = disputes * -15;
  const rep        = Math.max(0, Math.min(ratingPts + sessionPts + repeatPts + disputePts, 100));
  const repLabel   = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";
  const ratingDisplay  = avgRating !== null ? avgRating.toFixed(2) : "—";
  const ratingSubLabel = avgRating !== null ? `${ratingCount} review${ratingCount !== 1 ? "s" : ""}` : "No ratings yet";

  return (
    <div style={{ minHeight:"100vh", background:"#f8f7f4", fontFamily:"'DM Sans',sans-serif" }} onClick={() => setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp    {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes shimmer   {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulse     {0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes goldSpin  {0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 18px rgba(232,168,0,.6),0 0 36px rgba(232,168,0,.3)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.8),0 0 50px rgba(255,215,0,.4)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 14px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e0e0e0,0 0 22px rgba(200,200,200,.6)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 22px rgba(232,160,80,.5)}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes modalPop  {from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes crownBounce{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-12px) rotate(5deg)}}
        @keyframes xpPulse   {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.02)}}
        @keyframes bannerSlide{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9;box-shadow:0 2px 12px rgba(0,0,0,.03)}
        .action-card{transition:all .15s;cursor:pointer;border-radius:16px;border:1.5px solid #e8e2d9;padding:14px;display:flex;flex-direction:column;gap:8px;background:#fafaf8}
        .action-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(0,0,0,.09);border-color:#d4cfc6}
        .stat-card{transition:all .15s}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.07)}
        .xp-bar{background:linear-gradient(90deg,#2d6a4f,#52b788);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:all .12s}
        .nav-a:hover{background:#eee9e0;color:#1a1a1a}
        .menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;transition:all .12s;cursor:pointer}
        .menu-item:hover{background:#f5f0e8;color:#1a1a1a}
        .rep-bar{border-radius:999px;height:5px}
        .gold-avatar{animation:goldSpin 2s ease infinite}
        .silver-avatar{animation:silverPulse 2s ease infinite}
        .bronze-avatar{animation:bronzePulse 2s ease infinite}
        .multi-badge{animation:xpPulse 1.5s ease infinite}
      `}</style>

      {/* ── CLAIM MODAL ── */}
      {showClaimModal && championData && (
        <ClaimModal rank={myRank} champion={championData} profile={profile} onClaim={handleClaim} onLater={handleLater} />
      )}

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.96)", backdropFilter:"blur(16px)", borderBottom:"1px solid #e8e2d9", padding:"0 32px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h]) => (
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <a href="/wallet" style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:999, background:"#f0fdf4", border:"1.5px solid #86efac", fontSize:13, fontWeight:800, color:"#2d6a4f" }}>
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" style={{ position:"relative", width:36, height:36, borderRadius:"50%", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
            🔔
            {unread > 0 && (
              <span style={{ position:"absolute", top:-2, right:-2, minWidth:16, height:16, borderRadius:"50%", background:"#ef4444", color:"#fff", fontSize:9, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", border:"2px solid white" }}>
                {unread}
              </span>
            )}
          </a>
          <div style={{ position:"relative" }} onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}>
            <div className={myRank === 1 ? "gold-avatar" : myRank === 2 ? "silver-avatar" : myRank === 3 ? "bronze-avatar" : ""}
              style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", cursor:"pointer",
                background: avatarUrl ? "transparent" : levelInfo.color,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: rankBorderColor ? undefined : `0 0 0 2px white, 0 0 0 3.5px ${levelInfo.color}` }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <span style={{ color:"#fff", fontSize:12, fontWeight:900 }}>{initials}</span>
              }
            </div>
            {showMenu && (
              <div style={{ position:"absolute", right:0, top:44, background:"#fff", border:"1.5px solid #e8e2d9", borderRadius:18, padding:8, width:210, boxShadow:"0 16px 48px rgba(0,0,0,.15)", zIndex:200 }}>
                <div style={{ padding:"10px 12px 12px", borderBottom:"1px solid #f0ece4", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", overflow:"hidden", flexShrink:0,
                      background: avatarUrl ? "transparent" : levelInfo.color,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>{initials}</span>}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:"#1a1a1a", lineHeight:1.2 }}>{profile.full_name}</div>
                      <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>@{profile.username} · <span style={{ color:badge.color, fontWeight:700 }}>{badge.emoji} {badge.name}</span></div>
                    </div>
                  </div>
                </div>
                {[["👤","My Profile","/profile"],["👥","People","/people"],["📋","Create Listing","/listings/create"],["✅","Get Verified","/verify"],["⭐","My Ratings","/ratings"],["💰","Wallet","/wallet"],["🏆","Leaderboard","/leaderboard"],["🔔","Notifications","/notifications"]].map(([icon,label,href]) => (
                  <a key={label} href={href} className="menu-item">{icon} {label}</a>
                ))}
                <div style={{ borderTop:"1px solid #f0ece4", marginTop:6, paddingTop:6 }}>
                  <button onClick={handleLogout} className="menu-item" style={{ width:"100%", background:"none", border:"none", color:"#ef4444", fontFamily:"'DM Sans',sans-serif" }}>🚪 Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"28px" }}>

        {/* ── CHAMPION CLAIM BANNER (persistent after modal closed) ── */}
        {isChampion && !showClaimModal && !rewardClaimed && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(90deg,#1a3d2e,#2d6a4f)", border:"none", borderRadius:16, padding:"14px 20px", marginBottom:14, gap:12, animation:"bannerSlide .4s ease", flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:28 }}>{myRank === 1 ? "👑" : myRank === 2 ? "🥈" : "🥉"}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>You finished #{myRank} this week! Your rewards are waiting.</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.6)" }}>Credits deposited · XP multiplier active · Avatar border unlocked</div>
              </div>
            </div>
            <button onClick={() => setShowClaimModal(true)} style={{ background:"#e8a800", color:"#1a1a1a", padding:"10px 22px", borderRadius:12, fontSize:13, fontWeight:900, border:"none", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
              🎁 Claim Rewards
            </button>
          </div>
        )}

        {/* ── CLAIMED BANNER ── */}
        {isChampion && rewardClaimed && (
          <div style={{ display:"flex", alignItems:"center", gap:12, background:"linear-gradient(90deg,#fffbeb,#fef3c7)", border:"1.5px solid #fde68a", borderRadius:16, padding:"12px 20px", marginBottom:14, animation:"bannerSlide .4s ease" }}>
            <span style={{ fontSize:22 }}>🏆</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#92400e" }}>You're this week's #{myRank} — {profile.champion_title || "Champion"}! {profile.champion_streak && profile.champion_streak > 1 ? `🔥 ${profile.champion_streak} week streak!` : ""}</div>
              <div style={{ fontSize:12, color:"#b45309" }}>Rewards claimed · Keep grinding to defend your rank!</div>
            </div>
            <a href="/leaderboard" style={{ fontSize:12, fontWeight:700, color:"#b45309", background:"#fff", padding:"6px 14px", borderRadius:99, border:"1px solid #fde68a", whiteSpace:"nowrap" }}>View Leaderboard →</a>
          </div>
        )}

        {/* ── XP MULTIPLIER BANNER ── */}
        {hasMulti && multiplierLeft && (
          <div className="multi-badge" style={{ display:"flex", alignItems:"center", gap:12, background:"linear-gradient(90deg,#fdf0ee,#fee8e4)", border:"1.5px solid #f0b8b0", borderRadius:16, padding:"12px 20px", marginBottom:14, animation:"bannerSlide .4s ease" }}>
            <span style={{ fontSize:22 }}>⚡</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#c0392b" }}>{profile.xp_multiplier}x XP Multiplier Active! Every XP you earn is boosted.</div>
              <div style={{ fontSize:12, color:"#e74c3c" }}>{multiplierLeft} remaining · Earned from leaderboard rank</div>
            </div>
            <div style={{ background:"#c0392b", color:"#fff", padding:"6px 14px", borderRadius:99, fontSize:13, fontWeight:900, whiteSpace:"nowrap" }}>
              ⚡ {profile.xp_multiplier}x ACTIVE
            </div>
          </div>
        )}

        {/* ── PENDING SESSIONS BANNER ── */}
        {pendingSessions > 0 && (
          <a href="/sessions" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(90deg,#fffbeb,#fef3c7)", border:"1.5px solid #fde68a", borderRadius:16, padding:"14px 20px", marginBottom:14, gap:12, animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>⏳</span>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color:"#92400e" }}>{pendingSessions} pending session request{pendingSessions > 1 ? "s" : ""} waiting!</div>
                <div style={{ fontSize:12, color:"#b45309" }}>Accept or decline in My Sessions</div>
              </div>
            </div>
            <div style={{ background:"#f59e0b", color:"#fff", padding:"8px 18px", borderRadius:10, fontSize:13, fontWeight:800, whiteSpace:"nowrap", flexShrink:0 }}>Review Now →</div>
          </a>
        )}

        {/* HERO CARD */}
        <div className="card" style={{ padding:"26px 30px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:20, animation:"fadeUp .4s ease", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: rankBorderColor ? `linear-gradient(90deg,${rankBorderColor},${rankBorderColor}66)` : `linear-gradient(90deg,${levelInfo.color},${levelInfo.color}66)`, borderRadius:"20px 20px 0 0" }} />
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              {/* Premium avatar border for top 3 */}
              <div className={myRank === 1 ? "gold-avatar" : myRank === 2 ? "silver-avatar" : myRank === 3 ? "bronze-avatar" : ""}
                style={{ width:64, height:64, borderRadius:"50%", overflow:"hidden",
                  background: avatarUrl ? "transparent" : `linear-gradient(135deg,${levelInfo.color},${levelInfo.color}88)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow: rankBorderColor ? undefined : avatarBoxShadow }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:22, fontWeight:900, color:"#fff" }}>{initials}</span>
                }
              </div>
              <div style={{ position:"absolute", bottom:-2, right:-2, background:"#fff", borderRadius:"50%", padding:2, fontSize:14, lineHeight:1 }}>
                {myRank === 1 ? "👑" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : LEVEL_ICONS[levelInfo.name]}
              </div>
            </div>

            <div>
              <div style={{ fontSize:11, color:"#aaa", fontWeight:700, letterSpacing:".07em", textTransform:"uppercase", marginBottom:3 }}>{greeting} {badge.emoji}</div>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#111", lineHeight:1.1, marginBottom:6 }}>{profile.full_name}</h1>
              <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, color:"#aaa" }}>@{profile.username}</span>
                <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:999, background:`${levelInfo.color}15`, color:levelInfo.color }}>{LEVEL_ICONS[levelInfo.name]} Lvl: {levelInfo.name}</span>
                <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:999, background:badge.bg, color:badge.color, border:`1px solid ${badge.color}22` }}>{badge.emoji} Badge: {badge.name}</span>
                {/* Champion title badge */}
                {profile.champion_title && (
                  <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:999, background:"#fffbeb", color:"#e8a800", border:"1px solid #f0d890" }}>
                    🏆 {profile.champion_title}{profile.champion_streak && profile.champion_streak > 1 ? ` ×${profile.champion_streak}` : ""}
                  </span>
                )}
                {hasMulti && (
                  <span className="multi-badge" style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:999, background:"#fdf0ee", color:"#c0392b", border:"1px solid #f0b8b0" }}>
                    ⚡ {profile.xp_multiplier}x XP
                  </span>
                )}
                {avgRating !== null && (
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"#fffbeb", color:"#b45309", border:"1px solid #fde68a" }}>
                    ⭐ {avgRating.toFixed(2)} · {ratingCount} review{ratingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ minWidth:240 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:".06em" }}>XP Progress{hasMulti ? ` (⚡${profile.xp_multiplier}x)` : ""}</span>
              <span style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, color:levelInfo.color }}>{profile.xp} / {xpNext} XP</span>
            </div>
            <div style={{ height:8, background:"#f0ece4", borderRadius:999, overflow:"hidden", marginBottom:6 }}>
              <div className="xp-bar" style={{ width:`${xpPct}%` }} />
            </div>
            <div style={{ fontSize:11, color:"#bbb", textAlign:"right" }}>{Math.max(0, xpNext - profile.xp)} XP to next level</div>
          </div>
        </div>

        {/* STATS ROW */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:16, animation:"fadeUp .4s .07s ease both" }}>
          {[
            { icon:"💰", label:"Credits",      value:profile.credits, sub:"in wallet",    color:"#2d6a4f", bg:"#f0fdf4", href:"/wallet"      },
            { icon:"⚡", label:"XP Earned",    value:profile.xp,      sub:levelInfo.name, color:"#7c3aed", bg:"#f5f3ff", href:"/leaderboard" },
            { icon:"📅", label:"Sessions",     value:sessions,         sub:"completed",    color:"#0891b2", bg:"#e0f2fe", href:"/sessions"    },
            { icon:"🏆", label:"Bounties Won", value:bountiesWon,      sub:"solved",       color:"#b45309", bg:"#fffbeb", href:"/bounties"    },
          ].map(s => (
            <a key={s.label} href={s.href} className="card stat-card" style={{ padding:"18px 20px", display:"block" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{ width:30, height:30, borderRadius:9, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{s.icon}</div>
                <span style={{ fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:".05em" }}>{s.label}</span>
              </div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:10, color:"#bbb", fontWeight:600, marginTop:4 }}>{s.sub}</div>
            </a>
          ))}
          <a href="/ratings" className="card stat-card" style={{ padding:"18px 20px", display:"block" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ width:30, height:30, borderRadius:9, background:"#fffbeb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⭐</div>
              <span style={{ fontSize:11, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:".05em" }}>Avg Rating</span>
            </div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:900, color:avgRating !== null ? "#f59e0b" : "#d1cec8", lineHeight:1 }}>{ratingDisplay}</div>
            <div style={{ fontSize:10, color:"#bbb", fontWeight:600, marginTop:4 }}>{ratingSubLabel}</div>
          </a>
        </div>

        {/* MAIN GRID */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:16, animation:"fadeUp .4s .13s ease both" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div className="card" style={{ padding:"22px 24px" }}>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:14 }}>Quick Actions</h2>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {QUICK_ACTIONS.map(a => (
                  <a key={a.label} href={a.href} className="action-card">
                    <div style={{ width:36, height:36, borderRadius:10, background:`${a.color}12`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{a.icon}</div>
                    <div style={{ fontSize:12, fontWeight:800, color:a.color, marginTop:2 }}>{a.label}</div>
                    <div style={{ fontSize:11, color:"#aaa" }}>{a.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:"22px 24px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>Recent Activity</h2>
                <a href="/notifications" style={{ fontSize:12, color:"#2d6a4f", fontWeight:700 }}>View all →</a>
              </div>
              {activities.length === 0 ? (
                <div style={{ textAlign:"center", padding:"28px 0" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🌱</div>
                  <p style={{ fontSize:13, color:"#aaa", marginBottom:16 }}>No activity yet — complete a session to get started!</p>
                  <a href="/listings" style={{ display:"inline-block", padding:"9px 22px", background:"#2d6a4f", color:"#fff", borderRadius:999, fontSize:13, fontWeight:700 }}>Browse Skills →</a>
                </div>
              ) : activities.map((act, idx) => (
                <a key={act.id} href={act.link || "/notifications"} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:idx < activities.length-1 ? "1px solid #f5f0e8" : "none", alignItems:"flex-start" }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:act.is_read ? "#f5f0e8" : "#e8f5ee", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>
                    {ACTIVITY_ICONS[act.type] || "📌"}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:act.is_read ? 600 : 800, color:"#1a1a1a", marginBottom:2 }}>{act.title}</div>
                    <div style={{ fontSize:12, color:"#aaa", lineHeight:1.5 }}>{act.body}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                    <div style={{ fontSize:11, color:"#ccc", fontWeight:600 }}>{timeAgo(act.created_at)}</div>
                    {!act.is_read && <div style={{ width:7, height:7, borderRadius:"50%", background:"#2d6a4f" }} />}
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Champion status card */}
            {isChampion && (
              <div style={{ background:`linear-gradient(135deg,${myRank===1?"#1a3d2e,#2d6a4f":myRank===2?"#2c3e50,#34495e":"#4a2c0a,#7a4a1a"})`, borderRadius:20, padding:"20px", color:"#fff", animation:"fadeUp .3s ease" }}>
                <div style={{ fontSize:10, fontWeight:800, opacity:.6, textTransform:"uppercase", letterSpacing:".1em", marginBottom:10 }}>🏆 Leaderboard Status</div>
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                  <span style={{ fontSize:44 }}>{myRank === 1 ? "👑" : myRank === 2 ? "🥈" : "🥉"}</span>
                  <div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900 }}>#{myRank} This Week</div>
                    {profile.champion_title && <div style={{ fontSize:12, opacity:.7, marginTop:2 }}>🏆 {profile.champion_title}{profile.champion_streak && profile.champion_streak > 1 ? ` ×${profile.champion_streak} weeks` : ""}</div>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[
                    { label:"Credits Bonus", val:`+${championData?.credits_bonus || 0} cr` },
                    { label:"XP Multiplier", val:`⚡ ${profile.xp_multiplier || 1}x` },
                  ].map(s => (
                    <div key={s.label} style={{ background:"rgba(255,255,255,.1)", borderRadius:10, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, opacity:.6, fontWeight:700, textTransform:"uppercase", marginBottom:2 }}>{s.label}</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900 }}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <a href="/leaderboard" style={{ display:"block", textAlign:"center", marginTop:12, background:"rgba(255,255,255,.15)", borderRadius:12, padding:"10px", fontSize:13, fontWeight:700, color:"#fff", border:"1px solid rgba(255,255,255,.2)" }}>
                  View Leaderboard →
                </a>
              </div>
            )}

            <div className="card" style={{ padding:"20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#bbb", letterSpacing:".1em", textTransform:"uppercase" }}>Your Badge & Level</div>
                <div style={{ display:"flex", gap:5 }}>
                  <span style={{ fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:999, background:`${levelInfo.color}15`, color:levelInfo.color }}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
                  <span style={{ fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:999, background:badge.bg, color:badge.color, border:`1px solid ${badge.color}22` }}>{badge.emoji} {badge.name}</span>
                </div>
              </div>
              <div style={{ background:badge.bg, borderRadius:14, padding:"14px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:32 }}>{badge.emoji}</span>
                <div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:badge.color }}>{badge.name}</div>
                  <div style={{ fontSize:12, color:badge.color, opacity:.75 }}>{badge.desc}</div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
                {[
                  { icon:"⚡", val:profile.xp,   label:"XP"       },
                  { icon:"📚", val:sessions,      label:"Sessions" },
                  { icon:"⭐", val:ratingDisplay, label:"Rating"   },
                ].map(s => (
                  <div key={s.label} style={{ background:"#f8f7f4", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:15, marginBottom:3 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:s.label==="Rating"&&avgRating===null?"#ccc":"#1a1a1a" }}>{s.val}</div>
                    <div style={{ fontSize:10, color:"#aaa", fontWeight:700, textTransform:"uppercase" }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {avgRating === null && (
                <a href="/sessions" style={{ display:"flex", alignItems:"center", gap:8, background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#b45309", fontWeight:700 }}>
                  <span>⭐</span><span>Complete a session to get your first review!</span><span style={{ marginLeft:"auto" }}>→</span>
                </a>
              )}
              {nextBadge && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, fontSize:12 }}>
                    <span style={{ fontWeight:700, color:"#555" }}>Next: {nextBadge.emoji} {nextBadge.name}</span>
                    <span style={{ color:"#aaa" }}>{nextBadge.desc}</span>
                  </div>
                  {[
                    { icon:"⚡", label:"XP",       current:profile.xp, req:nextBadge.xpReq       },
                    { icon:"📚", label:"Sessions", current:sessions,   req:nextBadge.sessionsReq },
                  ].filter(r => r.req > 0).map(r => {
                    const done = r.current >= r.req;
                    const pct  = Math.min((r.current / r.req) * 100, 100);
                    return (
                      <div key={r.label} style={{ marginBottom:9 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                          <span style={{ color:"#666", fontWeight:600 }}>{r.icon} {r.label}</span>
                          <span style={{ color:done?"#2d6a4f":"#aaa", fontWeight:700 }}>{done ? "✓ Done" : `${r.current} / ${r.req}`}</span>
                        </div>
                        <div style={{ height:5, background:"#f0ece4", borderRadius:999, overflow:"hidden" }}>
                          <div className="rep-bar" style={{ width:`${pct}%`, background:done?"#2d6a4f":"#d4cec7" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:12, paddingTop:12, borderTop:"1px solid #f0ece4" }}>
                <div style={{ fontSize:10, fontWeight:800, color:"#ccc", width:"100%", textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>All Tiers</div>
                {LEVELS.map(t => (
                  <span key={t.name} style={{ fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:999,
                    background: t.name===levelInfo.name ? `${t.color}18` : "#f5f0e8",
                    color: t.name===levelInfo.name ? t.color : "#bbb",
                    border: t.name===levelInfo.name ? `1px solid ${t.color}33` : "none" }}>
                    {LEVEL_ICONS[t.name]} {t.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding:"20px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#bbb", letterSpacing:".1em", textTransform:"uppercase", marginBottom:14 }}>Reputation Score</div>
              <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius:14, padding:"14px 16px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:24 }}>💫</span>
                  <div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:900, color:"#b45309", lineHeight:1 }}>{rep}<span style={{ fontSize:14, color:"#daa520" }}>/100</span></div>
                    <div style={{ fontSize:12, fontWeight:700, color:"#b45309" }}>{repLabel}</div>
                  </div>
                </div>
                <svg viewBox="0 0 52 52" style={{ width:52, height:52, transform:"rotate(-90deg)", flexShrink:0 }}>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep,100)/100)*131.9} 131.9`} strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ height:5, background:"#f0ece4", borderRadius:999, overflow:"hidden", marginBottom:14 }}>
                <div style={{ height:"100%", width:`${rep}%`, background:"linear-gradient(90deg,#f59e0b,#d97706)", borderRadius:999 }} />
              </div>
              {[
                { icon:"⭐", label:"Rating",   pts:ratingPts,  max:80, detail:avgRating!==null?`${avgRating.toFixed(2)} avg × ${sessions} sessions`:"No ratings yet", color:"#f59e0b" },
                { icon:"📚", label:"Sessions", pts:sessionPts, max:15, detail:`${sessions} sessions × 2 pts`,                                                           color:"#2d6a4f" },
                { icon:"🔄", label:"Repeats",  pts:repeatPts,  max:10, detail:`${repeatClients} repeat clients × 5`,                                                   color:"#6366f1" },
                { icon:"⚠️", label:"Disputes", pts:disputePts, max:0,  detail:disputes===0?"No disputes ✓":`${disputes} × -15 pts`,                                   color:disputes>0?"#dc2626":"#aaa" },
              ].map(r => (
                <div key={r.label} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#333" }}>{r.icon} {r.label}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:r.pts>0?"#2d6a4f":r.pts<0?"#dc2626":"#aaa" }}>
                      {r.pts>0?`+${r.pts}`:r.pts<0?`${r.pts}`:"✓"}{r.pts!==0?" pts":""}
                    </span>
                  </div>
                  <div style={{ fontSize:11, color:"#bbb", marginBottom:r.max>0?5:0 }}>{r.detail}</div>
                  {r.max > 0 && (
                    <div style={{ height:5, background:"#f0ece4", borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min((r.pts/r.max)*100,100)}%`, background:r.color, borderRadius:999 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <a href="/wallet" style={{ display:"block", background:"linear-gradient(135deg,#1a4a36,#2d6a4f 60%,#3a8a63)", borderRadius:20, padding:"22px", color:"#fff", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(255,255,255,.05)" }} />
              <p style={{ fontSize:10, fontWeight:700, opacity:.6, marginBottom:3, letterSpacing:".1em", textTransform:"uppercase" }}>Your Wallet</p>
              <p style={{ fontFamily:"'Fraunces',serif", fontSize:42, fontWeight:900, lineHeight:1, marginBottom:2 }}>{profile.credits}</p>
              <p style={{ fontSize:13, opacity:.6, marginBottom:18 }}>credits · ₱{profile.credits * 10} value</p>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, background:"#fff", color:"#2d6a4f", textAlign:"center", padding:"10px", borderRadius:12, fontSize:12, fontWeight:900 }}>+ Top Up</div>
                <div style={{ flex:1, background:"rgba(255,255,255,.1)", color:"#fff", textAlign:"center", padding:"10px", borderRadius:12, fontSize:12, fontWeight:700, border:"1px solid rgba(255,255,255,.2)" }}>History</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}