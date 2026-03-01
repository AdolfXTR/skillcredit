"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── REMOVED broken imports ────────────────────────────────────────────────────
// OLD (BROKEN): import { BadgeChip, BadgeProgressCard, getBadgeTier } from "@/components/BadgeSystem";
// OLD (BROKEN): import { ReputationCard, ReputationChip, calcReputation } from "@/components/ReputationScore";
// These files don't exist → always fell back to Seedling / crashed silently
// ── FIXED: everything is inlined below ───────────────────────────────────────

type Profile = {
  id: string; full_name: string; username: string; bio: string;
  location: string; credits: number; xp: number; level: string;
  role: string; avatar_url: string; created_at: string; is_verified?: boolean;
};
type Badge       = { id: string; badge_type: string; badge_name: string; description: string; earned_at: string };
type Listing     = { id: string; title: string; format: string; duration: number; credit_price: number; is_active: boolean; skills: { name: string; category: string } };
type Transaction = { id: string; amount: number; type: string; description: string; created_at: string };
type UserSkill   = { id: string; skill_id: string; is_verified: boolean; verified_at: string | null; skills: { name: string; category: string } };

// ── FIXED getBadgeTier ────────────────────────────────────────────────────────
// OLD BUG: all tiers required xp && sessions && rating simultaneously
// FIX: walk from top tier downward, return first match
const BADGE_TIERS = [
  { name: "Seedling", emoji: "🌱", color: "#2d6a4f", bg: "#dcfce7", desc: "Just getting started",  xpReq: 0,    sessionsReq: 0,  ratingReq: 0   },
  { name: "Rising",   emoji: "⭐", color: "#b45309", bg: "#fef3c7", desc: "Building momentum",     xpReq: 100,  sessionsReq: 0,  ratingReq: 0   },
  { name: "Pro",      emoji: "🔥", color: "#7c3aed", bg: "#ede9fe", desc: "Proven skill sharer",   xpReq: 500,  sessionsReq: 5,  ratingReq: 0   },
  { name: "Elite",    emoji: "💎", color: "#dc2626", bg: "#fee2e2", desc: "Top performer",          xpReq: 2000, sessionsReq: 20, ratingReq: 4.0 },
  { name: "Legend",   emoji: "👑", color: "#d97706", bg: "#fffbeb", desc: "Community pillar",       xpReq: 5000, sessionsReq: 50, ratingReq: 4.5 },
];

function getBadgeTier(xp: number, sessions: number, rating: number) {
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const t = BADGE_TIERS[i];
    if (xp >= t.xpReq && sessions >= t.sessionsReq && rating >= t.ratingReq) return t;
  }
  return BADGE_TIERS[0];
}

function getNextBadge(current: typeof BADGE_TIERS[0]) {
  const idx = BADGE_TIERS.findIndex(b => b.name === current.name);
  return idx < BADGE_TIERS.length - 1 ? BADGE_TIERS[idx + 1] : null;
}

// ── Level helpers ─────────────────────────────────────────────────────────────
function getLevelFromXP(xp: number) {
  if (xp >= 4000) return "Legend";
  if (xp >= 2000) return "Master";
  if (xp >= 1000) return "Expert";
  if (xp >= 600)  return "Skilled";
  if (xp >= 300)  return "Contributor";
  if (xp >= 100)  return "Learner";
  return "Seedling";
}
const LEVEL_COLOR: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};
const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600, Skilled: 1000,
  Expert: 2000, Master: 4000, Legend: 9999,
};

// ── Reputation calc ───────────────────────────────────────────────────────────
function calcRep(avgRating: number, sessions: number, repeatClients: number, disputes: number) {
  const r = Math.min(Math.round(avgRating * sessions * 4), 80);
  const s = Math.min(sessions * 2, 15);
  const c = Math.min(repeatClients * 5, 10);
  const d = disputes * -15;
  return Math.max(0, Math.min(r + s + c + d, 100));
}

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
}

const FORMAT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  video: { label: "📹 Video", color: "#0369a1", bg: "#e0f2fe" },
  chat:  { label: "💬 Chat",  color: "#065f46", bg: "#d1fae5" },
  docs:  { label: "📄 Docs",  color: "#5b21b6", bg: "#ede9fe" },
  mixed: { label: "🎨 Mixed", color: "#92400e", bg: "#fef3c7" },
};
const TX_ICONS: Record<string, string> = {
  signup_bonus: "🎁", session_earn: "📚", session_spend: "💳",
  bounty_earn: "🏆", topup: "💳", challenge: "⚡",
};
const BADGE_ICONS: Record<string, string> = {
  early_adopter: "🌟", rising_teacher: "🥉", skilled_teacher: "🥈",
  top_teacher: "🥇", expert_teacher: "💎", first_session: "📚",
  curious_learner: "📖", first_bounty: "🎯", helpful_voice: "💬",
};

export default function ProfilePage() {
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [badges, setBadges]               = useState<Badge[]>([]);
  const [listings, setListings]           = useState<Listing[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [userSkills, setUserSkills]       = useState<UserSkill[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<"listings"|"badges"|"activity">("listings");
  const [editing, setEditing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [editForm, setEditForm]           = useState({ full_name: "", bio: "", location: "" });
  const [sessions, setSessions]           = useState(0);
  const [avgRating, setAvgRating]         = useState(0);
  const [repeatClients, setRepeatClients] = useState(0);
  const [disputes, setDisputes]           = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) { setProfile(prof); setEditForm({ full_name: prof.full_name || "", bio: prof.bio || "", location: prof.location || "" }); }

      const [
        { data: b }, { data: l }, { data: tx },
        { count: sCount }, { data: ratingData }, { data: sessionData },
        { count: dCount }, { data: skillsData },
      ] = await Promise.all([
        supabase.from("badges").select("*").eq("user_id", user.id).order("earned_at", { ascending: false }),
        supabase.from("listings").select("*, skills(name,category)").eq("teacher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("sessions").select("*", { count: "exact", head: true }).or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", user.id),
        supabase.from("sessions").select("learner_id").eq("teacher_id", user.id).eq("status", "completed"),
        supabase.from("sessions").select("*", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "disputed"),
        supabase.from("user_skills").select("*, skills(name,category)").eq("user_id", user.id).order("is_verified", { ascending: false }),
      ]);

      setBadges(b || []);
      setListings((l as Listing[]) || []);
      setTransactions(tx || []);
      setSessions(sCount || 0);
      setUserSkills((skillsData as UserSkill[]) || []);

      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => { counts[s.learner_id] = (counts[s.learner_id] || 0) + 1; });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }
      setDisputes(dCount || 0);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { data } = await supabase.from("profiles").update(editForm).eq("id", profile.id).select().single();
    if (data) setProfile(data);
    setSaving(false); setEditing(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14, animation: "pulse 1.5s ease infinite" }}>👤</div>
        <p style={{ color: "#aaa", fontSize: 14 }}>Loading your profile…</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const verifiedSkills   = userSkills.filter(s => s.is_verified);
  const unverifiedSkills = userSkills.filter(s => !s.is_verified);

  // ✅ FIXED: derive everything from XP directly
  const displayLevel = getLevelFromXP(profile.xp);
  const lvlColor     = LEVEL_COLOR[displayLevel] || "#2d6a4f";
  const badge        = getBadgeTier(profile.xp, sessions, avgRating);
  const nextBadge    = getNextBadge(badge);
  const rep          = calcRep(avgRating, sessions, repeatClients, disputes);
  const repLabel     = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";
  const initials     = getInitials(profile.full_name || "");
  const xpNext       = XP_TO_NEXT[displayLevel] || 100;
  const xpPct        = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate     = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        a { text-decoration:none; color:inherit; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .card { background:#fff; border-radius:20px; border:1.5px solid #e8e2d9; }
        .tab-btn { padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all .12s; }
        .nav-a { padding:6px 12px; border-radius:8px; font-size:13px; font-weight:600; color:#666; transition:all .12s; }
        .nav-a:hover { background:#eee9e0; color:#1a1a1a; }
        .skill-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:999px; border:1.5px solid #e8e2d9; font-size:12px; font-weight:700; }
        .listing-row { background:#fff; border-radius:16px; border:1.5px solid #e8e2d9; padding:18px 20px; display:flex; align-items:center; gap:16px; justify-content:space-between; flex-wrap:wrap; transition:box-shadow .12s; }
        .listing-row:hover { box-shadow:0 4px 20px rgba(0,0,0,0.07); }
        .tx-row { display:flex; align-items:center; gap:12px; padding:14px 20px; justify-content:space-between; transition:background .1s; }
        .tx-row:hover { background:#faf8f4; }
        .progress-bar { height:5px; background:#f0ece4; border-radius:999px; overflow:hidden; }
        .progress-fill { height:100%; border-radius:999px; transition:width .6s; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background:"#fff", borderBottom:"1.5px solid #e8e2d9", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", position:"sticky", top:0, zIndex:50 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:900, fontSize:20, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:900, fontSize:20, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h])=>(
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <a href="/wallet" style={{ fontSize:13, fontWeight:700, color:"#2d6a4f", background:"#e8f5ee", padding:"5px 14px", borderRadius:999, border:"1.5px solid #b7e4c7" }}>💰 {profile.credits} cr</a>
          <button onClick={async()=>{ await supabase.auth.signOut(); window.location.href="/"; }}
            style={{ padding:"5px 14px", borderRadius:10, background:"#fef2f2", color:"#dc2626", fontSize:13, fontWeight:600, border:"1.5px solid #fca5a5", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            🚪 Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth:1020, margin:"0 auto", padding:"28px 20px 80px" }}>

        {/* PROFILE HERO */}
        <div className="card" style={{ marginBottom:16, overflow:"hidden", animation:"fadeUp 0.4s ease" }}>
          <div style={{ height:4, background:`linear-gradient(90deg,${lvlColor},${lvlColor}66)` }} />
          <div style={{ padding:"26px 28px" }}>
            {editing ? (
              <div style={{ maxWidth:440 }}>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a", marginBottom:20 }}>Edit Profile</h2>
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {[
                    { key:"full_name", label:"Full Name",  placeholder:"Your full name",                     type:"input"    },
                    { key:"location",  label:"Location",   placeholder:"e.g. Cebu City, Philippines",        type:"input"    },
                    { key:"bio",       label:"Bio",        placeholder:"Tell the community about yourself…", type:"textarea" },
                  ].map(f=>(
                    <div key={f.key}>
                      <label style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase", letterSpacing:1.5, display:"block", marginBottom:6 }}>{f.label}</label>
                      {f.type==="textarea" ? (
                        <textarea value={editForm[f.key as keyof typeof editForm]} rows={3} placeholder={f.placeholder}
                          onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}
                          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", background:"#faf8f4", fontSize:13, fontFamily:"'DM Sans',sans-serif", resize:"none", outline:"none" }} />
                      ) : (
                        <input value={editForm[f.key as keyof typeof editForm]} placeholder={f.placeholder}
                          onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}
                          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", background:"#faf8f4", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none" }} />
                      )}
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:10, marginTop:4 }}>
                    <button onClick={()=>setEditing(false)} style={{ flex:1, padding:"11px", background:"#f5f0e8", color:"#555", borderRadius:12, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"11px", background:"#2d6a4f", color:"#fff", borderRadius:12, border:"none", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", opacity:saving?0.7:1 }}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"flex-start", gap:20, flexWrap:"wrap" }}>
                {/* Avatar */}
                <div style={{ width:72, height:72, borderRadius:20, background:`linear-gradient(135deg,${lvlColor},${lvlColor}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#fff", flexShrink:0, boxShadow:`0 6px 24px ${lvlColor}44` }}>
                  {initials}
                </div>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                    <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#1a1a1a" }}>{profile.full_name || "Unnamed User"}</h1>
                    {/* ✅ FIXED: badge tier shown correctly, pulled from fixed getBadgeTier */}
                    <span style={{ fontSize:11, fontWeight:800, padding:"3px 10px", borderRadius:999, background:badge.bg, color:badge.color, border:`1px solid ${badge.color}22` }}>{badge.emoji} {badge.name}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:`${lvlColor}12`, color:lvlColor }}>Lvl: {displayLevel}</span>
                    {profile.is_verified && <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"#e8f5ee", color:"#2d6a4f", border:"1px solid #b7e4c7" }}>✅ Verified</span>}
                  </div>
                  <div style={{ fontSize:13, color:"#aaa", marginBottom:10 }}>@{profile.username}</div>
                  {profile.bio
                    ? <p style={{ fontSize:13, color:"#555", lineHeight:1.7, marginBottom:12, maxWidth:520 }}>{profile.bio}</p>
                    : <p style={{ fontSize:13, color:"#ccc", fontStyle:"italic", marginBottom:12 }}>No bio yet — add one to stand out!</p>}
                  {verifiedSkills.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                      <span style={{ fontSize:10, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1 }}>Verified in:</span>
                      {verifiedSkills.slice(0,4).map(s=>(
                        <span key={s.id} className="skill-pill" style={{ background:"#e8f5ee", color:"#2d6a4f", borderColor:"#b7e4c7" }}>✅ {s.skills?.name}</span>
                      ))}
                      {verifiedSkills.length > 4 && <span style={{ fontSize:11, color:"#aaa" }}>+{verifiedSkills.length-4} more</span>}
                    </div>
                  )}
                  <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                    {profile.location && <span style={{ fontSize:12, color:"#bbb" }}>📍 {profile.location}</span>}
                    <span style={{ fontSize:12, color:"#bbb" }}>📅 Joined {joinDate}</span>
                    {avgRating > 0 && <span style={{ fontSize:12, color:"#bbb" }}>⭐ {avgRating.toFixed(1)} avg</span>}
                    <span style={{ fontSize:12, color:"#bbb" }}>🏅 {badges.length} badge{badges.length!==1?"s":""}</span>
                  </div>
                </div>
                <button onClick={()=>setEditing(true)} style={{ padding:"8px 18px", background:"#f5f0e8", color:"#555", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", flexShrink:0 }}>
                  ✏️ Edit Profile
                </button>
              </div>
            )}

            {/* XP Bar */}
            {!editing && (
              <div style={{ marginTop:20, paddingTop:20, borderTop:"1px solid #f0ece4" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#888" }}>⚡ {profile.xp} XP — {displayLevel}</span>
                  <span style={{ fontSize:12, color:"#ccc" }}>{xpNext-profile.xp>0?`${xpNext-profile.xp} XP to next level`:"Max level!"}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width:`${xpPct}%`, background:`linear-gradient(90deg,${lvlColor},${lvlColor}88)` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS ROW */}
        {!editing && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16, animation:"fadeUp 0.4s 0.07s ease both" }}>
            {[
              { label:"Credits",  value:profile.credits, icon:"💰", color:"#2d6a4f", bg:"#e8f5ee", href:"/wallet"          },
              { label:"XP",       value:profile.xp,      icon:"⚡", color:"#7c3aed", bg:"#f5f3ff", href:"/leaderboard"     },
              { label:"Sessions", value:sessions,         icon:"📚", color:"#0891b2", bg:"#e0f2fe", href:"/sessions"        },
              { label:"Listings", value:listings.length,  icon:"📋", color:"#b45309", bg:"#fef3c7", href:"/listings/create" },
              { label:"Badges",   value:badges.length,    icon:"🏅", color:"#dc2626", bg:"#fee2e2", href:"#badges"          },
            ].map(s=>(
              <a key={s.label} href={s.href}
                onClick={s.href==="badges"?e=>{e.preventDefault();setActiveTab("badges");}:undefined}
                className="card" style={{ padding:"16px 14px", display:"block", textAlign:"center", transition:"all .12s" }}
                onMouseOver={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.07)"}}
                onMouseOut={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
                <div style={{ width:38, height:38, borderRadius:11, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, margin:"0 auto 8px" }}>{s.icon}</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:10, color:"#bbb", fontWeight:700, marginTop:4, textTransform:"uppercase" }}>{s.label}</div>
              </a>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        {!editing && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:14, animation:"fadeUp 0.4s 0.12s ease both" }}>
            <div>

              {/* SKILLS */}
              <div className="card" style={{ padding:"20px 22px", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a" }}>Skills & Verifications</div>
                    <div style={{ fontSize:11, color:"#bbb", marginTop:2 }}>Skills you've listed or been verified in</div>
                  </div>
                  <a href="/verify" style={{ fontSize:12, fontWeight:700, color:"#2d6a4f", background:"#e8f5ee", padding:"6px 14px", borderRadius:10, border:"1.5px solid #b7e4c7" }}>+ Get Verified</a>
                </div>
                {verifiedSkills.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>✅ Verified</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                      {verifiedSkills.map(s=>(
                        <span key={s.id} className="skill-pill" style={{ background:"#e8f5ee", color:"#2d6a4f", borderColor:"#b7e4c7" }}>✅ {s.skills?.name} <span style={{ color:"#aaa", fontWeight:500 }}>· {s.skills?.category}</span></span>
                      ))}
                    </div>
                  </div>
                )}
                {unverifiedSkills.length > 0 && (
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:9, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>🔓 Unverified</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                      {unverifiedSkills.map(s=>(
                        <span key={s.id} className="skill-pill" style={{ background:"#faf8f4", color:"#888" }}>○ {s.skills?.name} <a href="/verify" style={{ color:"#2d6a4f", fontWeight:700, marginLeft:4 }}>verify →</a></span>
                      ))}
                    </div>
                  </div>
                )}
                {userSkills.length === 0 && (
                  <div style={{ background:"linear-gradient(135deg,#e8f5fe,#e8f5ee)", borderRadius:14, padding:"16px", display:"flex", alignItems:"center", gap:14, border:"1.5px solid #b7e4c7" }}>
                    <span style={{ fontSize:32 }}>✅</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#1a1a1a", marginBottom:3 }}>Get your skills verified!</div>
                      <div style={{ fontSize:12, color:"#555" }}>Verified teachers get <strong>2x more bookings</strong>.</div>
                    </div>
                    <a href="/verify" style={{ background:"#2d6a4f", color:"#fff", fontSize:12, fontWeight:800, padding:"8px 14px", borderRadius:10, whiteSpace:"nowrap" }}>Verify Now →</a>
                  </div>
                )}
              </div>

              {/* TABS */}
              <div style={{ display:"flex", gap:4, background:"#f0ece4", borderRadius:12, padding:4, width:"fit-content", marginBottom:14 }}>
                {[{k:"listings",l:"📋 Listings"},{k:"badges",l:"🏅 Badges"},{k:"activity",l:"📊 Activity"}].map(t=>(
                  <button key={t.k} className="tab-btn" onClick={()=>setActiveTab(t.k as any)}
                    style={{ background:activeTab===t.k?"#fff":"transparent", color:activeTab===t.k?"#1a1a1a":"#888", boxShadow:activeTab===t.k?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* LISTINGS */}
              {activeTab==="listings" && (
                <div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>My Skill Listings</div>
                    <a href="/listings/create" style={{ background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700, padding:"8px 18px", borderRadius:12 }}>+ Create Listing</a>
                  </div>
                  {listings.length===0 ? (
                    <div className="card" style={{ padding:"48px", textAlign:"center" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:6 }}>No listings yet</div>
                      <p style={{ fontSize:13, color:"#aaa", marginBottom:18 }}>Create a skill listing to start teaching!</p>
                      <a href="/listings/create" style={{ display:"inline-block", background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700, padding:"10px 22px", borderRadius:12 }}>Create your first listing →</a>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {listings.map(listing=>{
                        const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                        return (
                          <div key={listing.id} className="listing-row">
                            <div style={{ flex:1, minWidth:180 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:7 }}>
                                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:fmt.bg, color:fmt.color }}>{fmt.label}</span>
                                {listing.skills && <span style={{ fontSize:11, color:"#bbb" }}>{listing.skills.name}</span>}
                                <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:listing.is_active?"#e8f5ee":"#f5f0e8", color:listing.is_active?"#2d6a4f":"#bbb" }}>
                                  {listing.is_active?"● Active":"○ Paused"}
                                </span>
                              </div>
                              <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:2 }}>{listing.title}</div>
                              <div style={{ fontSize:11, color:"#bbb" }}>{listing.duration} min session</div>
                            </div>
                            <div style={{ textAlign:"right", flexShrink:0 }}>
                              <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>{listing.credit_price} cr</div>
                              <div style={{ fontSize:11, color:"#bbb" }}>per session</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* BADGES */}
              {activeTab==="badges" && (
                <div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:14 }}>Earned Badges</div>
                  {badges.length===0 ? (
                    <div className="card" style={{ padding:"48px", textAlign:"center" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>🏅</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:6 }}>No badges yet</div>
                      <p style={{ fontSize:13, color:"#aaa" }}>Complete sessions, answer bounties, and participate!</p>
                    </div>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {badges.map(b=>(
                        <div key={b.id} className="card" style={{ padding:"18px", textAlign:"center" }}>
                          <div style={{ fontSize:36, marginBottom:8 }}>{BADGE_ICONS[b.badge_type]||"🏅"}</div>
                          <div style={{ fontFamily:"'Fraunces',serif", fontSize:14, fontWeight:800, color:"#1a1a1a", marginBottom:4 }}>{b.badge_name}</div>
                          <div style={{ fontSize:11, color:"#aaa", lineHeight:1.5, marginBottom:6 }}>{b.description}</div>
                          <div style={{ fontSize:10, color:"#ccc" }}>{new Date(b.earned_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY */}
              {activeTab==="activity" && (
                <div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:14 }}>Credit Activity</div>
                  {transactions.length===0 ? (
                    <div className="card" style={{ padding:"48px", textAlign:"center" }}>
                      <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a", marginBottom:6 }}>No transactions yet</div>
                      <p style={{ fontSize:13, color:"#aaa" }}>Your credit history will appear here.</p>
                    </div>
                  ) : (
                    <div className="card" style={{ overflow:"hidden" }}>
                      {transactions.map((tx,i)=>(
                        <div key={tx.id} className="tx-row" style={{ borderBottom:i<transactions.length-1?"1px solid #f5f0e8":"none" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <div style={{ width:36, height:36, borderRadius:10, background:tx.amount>0?"#e8f5ee":"#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                              {TX_ICONS[tx.type]||"💳"}
                            </div>
                            <div>
                              <div style={{ fontSize:13, fontWeight:600, color:"#333" }}>{tx.description||tx.type.replace(/_/g," ")}</div>
                              <div style={{ fontSize:11, color:"#ccc" }}>{new Date(tx.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                            </div>
                          </div>
                          <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:tx.amount>0?"#2d6a4f":"#dc2626", flexShrink:0 }}>
                            {tx.amount>0?"+":""}{tx.amount} cr
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

              {/* BADGE PROGRESS CARD */}
              <div className="card" style={{ padding:"18px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5 }}>Your Badge</div>
                  {/* ✅ FIXED: one badge pill only */}
                  <span style={{ fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:999, background:badge.bg, color:badge.color, border:`1px solid ${badge.color}22` }}>{badge.emoji} {badge.name}</span>
                </div>
                <div style={{ background:badge.bg, borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10, border:`1px solid ${badge.color}22` }}>
                  <span style={{ fontSize:28 }}>{badge.emoji}</span>
                  <div>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, color:badge.color }}>{badge.name}</div>
                    <div style={{ fontSize:11, color:badge.color, opacity:0.75 }}>{badge.desc}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:nextBadge?12:0 }}>
                  {[{icon:"⚡",val:profile.xp,label:"XP"},{icon:"📚",val:sessions,label:"Sessions"},{icon:"⭐",val:avgRating.toFixed(1),label:"Rating"}].map(s=>(
                    <div key={s.label} style={{ background:"#faf8f4", borderRadius:10, padding:"9px 6px", textAlign:"center" }}>
                      <div style={{ fontSize:13, marginBottom:2 }}>{s.icon}</div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a" }}>{s.val}</div>
                      <div style={{ fontSize:9, color:"#bbb", fontWeight:700, textTransform:"uppercase" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {nextBadge && (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:11 }}>
                      <span style={{ fontWeight:700, color:"#555" }}>Next: {nextBadge.emoji} {nextBadge.name}</span>
                      <span style={{ color:"#aaa" }}>{nextBadge.desc}</span>
                    </div>
                    {[
                      {icon:"⚡",label:"XP",current:profile.xp,req:nextBadge.xpReq},
                      {icon:"📚",label:"Sessions",current:sessions,req:nextBadge.sessionsReq},
                      {icon:"⭐",label:"Rating",current:avgRating,req:nextBadge.ratingReq},
                    ].filter(r=>r.req>0).map(r=>{
                      const done = r.current>=r.req;
                      const pct  = Math.min((r.current/r.req)*100,100);
                      return (
                        <div key={r.label} style={{ marginBottom:8 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:11 }}>
                            <span style={{ color:"#666", fontWeight:600 }}>{r.icon} {r.label}</span>
                            <span style={{ color:done?"#2d6a4f":"#aaa", fontWeight:700 }}>
                              {done?"✓ Done":`${typeof r.current==="number"&&r.current%1!==0?r.current.toFixed(1):r.current} / ${r.req}`}
                            </span>
                          </div>
                          <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%`, background:done?"#2d6a4f":"#d4cec7" }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* All tiers */}
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:12, paddingTop:12, borderTop:"1px solid #f0ece4" }}>
                  <div style={{ fontSize:9, fontWeight:800, color:"#ccc", width:"100%", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>All Tiers</div>
                  {BADGE_TIERS.map(t=>(
                    <span key={t.name} style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:999, background:t.name===badge.name?t.bg:"#f5f0e8", color:t.name===badge.name?t.color:"#bbb", border:t.name===badge.name?`1px solid ${t.color}33`:"none" }}>
                      {t.emoji} {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* REPUTATION */}
              <div className="card" style={{ padding:"18px" }}>
                <div style={{ fontSize:10, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 }}>Reputation Score</div>
                <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderRadius:12, padding:"12px 14px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid #fde68a" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:22 }}>💫</span>
                    <div>
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#b45309", lineHeight:1 }}>{rep}<span style={{ fontSize:12, color:"#daa520" }}>/100</span></div>
                      <div style={{ fontSize:11, fontWeight:700, color:"#b45309" }}>{repLabel}</div>
                    </div>
                  </div>
                  <svg viewBox="0 0 52 52" style={{ width:48, height:48, transform:"rotate(-90deg)", flexShrink:0 }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep,100)/100)*131.9} 131.9`} strokeLinecap="round" />
                  </svg>
                </div>
                {[
                  {icon:"⭐",label:"Rating",  pts:Math.min(Math.round(avgRating*sessions*4),80), max:80,  detail:`${avgRating.toFixed(1)} avg × ${sessions} sessions`, color:"#f59e0b"},
                  {icon:"📚",label:"Sessions",pts:Math.min(sessions*2,15),                        max:15,  detail:`${sessions} × 2 pts`,                               color:"#2d6a4f"},
                  {icon:"🔄",label:"Repeats", pts:Math.min(repeatClients*5,10),                   max:10,  detail:`${repeatClients} repeat clients × 5`,               color:"#6366f1"},
                  {icon:"⚠️",label:"Disputes",pts:disputes*-15,                                   max:0,   detail:disputes===0?"No disputes ✓":`${disputes} × -15`,   color:disputes>0?"#dc2626":"#aaa"},
                ].map(r=>(
                  <div key={r.label} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:12 }}>
                      <span style={{ fontWeight:700, color:"#333" }}>{r.icon} {r.label}</span>
                      <span style={{ fontWeight:800, color:r.pts>0?"#2d6a4f":r.pts<0?"#dc2626":"#aaa" }}>
                        {r.pts>0?`+${r.pts}`:r.pts<0?`${r.pts}`:"✓"}{r.pts!==0?" pts":""}
                      </span>
                    </div>
                    <div style={{ fontSize:10, color:"#bbb", marginBottom:r.max>0?4:0 }}>{r.detail}</div>
                    {r.max>0&&<div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.min((r.pts/r.max)*100,100)}%`, background:r.color }} /></div>}
                  </div>
                ))}
              </div>

              {/* QUICK LINKS */}
              <div className="card" style={{ padding:"16px" }}>
                <div style={{ fontSize:9, fontWeight:800, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>Quick Links</div>
                {[["✅","Get Verified","/verify"],["🎓","Create Listing","/listings/create"],["⭐","My Ratings","/ratings"],["🏆","Leaderboard","/leaderboard"],["💰","Wallet","/wallet"]].map(([icon,label,href])=>(
                  <a key={label} href={href} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:10, color:"#555", fontSize:13, fontWeight:600, transition:"all .1s" }}
                    onMouseOver={e=>{e.currentTarget.style.background="#e8f5ee";e.currentTarget.style.color="#2d6a4f"}}
                    onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#555"}}>
                    <span>{icon}</span><span style={{ flex:1 }}>{label}</span><span style={{ color:"#ccc" }}>›</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}