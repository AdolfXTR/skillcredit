"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string; bio: string;
  location: string; credits: number; xp: number; level: string;
  role: string; avatar_url: string; created_at: string; is_verified?: boolean;
};
type Badge       = { id: string; badge_type: string; badge_name: string; description: string; earned_at: string };
type Listing     = { id: string; title: string; format: string; duration: number; credit_price: number; is_active: boolean; skills: { name: string; category: string } };
type Transaction = { id: string; amount: number; type: string; description: string; created_at: string };
type UserSkill   = { id: string; skill_id: string; is_verified: boolean; verified_at: string | null; skills: { name: string; category: string } };

// ── BAYESIAN AVERAGE ──────────────────────────────────────────────────────────
// C = confidence weight (5 reviews needed to fully trust score)
// m = global prior mean (3.5 = midpoint of 1-5 scale)
// Formula: (C×m + sum) / (C + count)
function bayesianAvg(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const C = 5, m = 3.5;
  const sum = ratings.reduce((s, r) => s + r, 0);
  return (C * m + sum) / (C + ratings.length);
}

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
  video: { label: "Video",  color: "#0369a1", bg: "#e0f2fe" },
  chat:  { label: "Chat",   color: "#065f46", bg: "#d1fae5" },
  docs:  { label: "Docs",   color: "#5b21b6", bg: "#ede9fe" },
  mixed: { label: "Mixed",  color: "#92400e", bg: "#fef3c7" },
};
const TX_ICONS: Record<string, string> = {
  signup_bonus: "🎁", session_earn: "📚", session_spend: "💳",
  bounty_earn: "🏆", topup: "💳", challenge: "⚡", session_refund: "↩️",
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
      if (prof) {
        setProfile(prof);
        setEditForm({ full_name: prof.full_name || "", bio: prof.bio || "", location: prof.location || "" });
      }

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

      // ── BAYESIAN AVG (replaces raw average) ──
      if (ratingData && ratingData.length > 0) {
        const bayes = bayesianAvg(ratingData.map((r: { overall: number }) => r.overall));
        setAvgRating(parseFloat(bayes.toFixed(2)));
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
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#2d6a4f] border-t-transparent mx-auto mb-3" style={{ animation: "spin .8s linear infinite" }} />
        <p className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Loading profile</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const verifiedSkills   = userSkills.filter(s => s.is_verified);
  const unverifiedSkills = userSkills.filter(s => !s.is_verified);
  const displayLevel     = getLevelFromXP(profile.xp);
  const lvlColor         = LEVEL_COLOR[displayLevel] || "#2d6a4f";
  const badge            = getBadgeTier(profile.xp, sessions, avgRating);
  const nextBadge        = getNextBadge(badge);
  const rep              = calcRep(avgRating, sessions, repeatClients, disputes);
  const repLabel         = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";
  const xpNext           = XP_TO_NEXT[displayLevel] || 100;
  const xpPct            = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate         = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-[#faf8f4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp .35s ease both}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9}
        .navlink{padding:5px 11px;border-radius:7px;font-size:13px;font-weight:600;color:#666;transition:all .12s;display:inline-block}
        .navlink:hover{background:#f0ece4;color:#1a1a1a}
        .navlink.active{background:#e8f4e8;color:#2d6a4f}
        .listing-row{transition:box-shadow .15s,transform .15s}
        .listing-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
        .tx-row:hover{background:#faf8f4}
        .stat-card{transition:all .15s}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.07)}
        .progress-bar{height:4px;background:#f0ece4;border-radius:999px;overflow:hidden}
        .progress-fill{height:100%;border-radius:999px;transition:width .6s}
        .quick-link:hover{background:#e8f5ee!important;color:#2d6a4f!important}
      `}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard">
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div className="flex gap-0.5">
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className="navlink">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="/wallet" className="text-xs font-800 text-[#2d6a4f] bg-green-50 px-3.5 py-1.5 rounded-full border border-green-200">
            💰 {profile.credits} cr
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            className="text-xs font-600 text-red-500 bg-red-50 px-3.5 py-1.5 rounded-full border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Log out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-8 pb-20">

        {/* PROFILE HERO */}
        <div className="card overflow-hidden mb-4 fade-up" style={{ borderLeft: `3px solid ${lvlColor}` }}>
          <div className="p-6">
            {editing ? (
              <div className="max-w-md">
                <h2 className="text-xl font-900 text-stone-900 mb-5" style={{ fontFamily: "'Fraunces', serif" }}>Edit Profile</h2>
                <div className="flex flex-col gap-4">
                  {[
                    { key: "full_name", label: "Full Name",  placeholder: "Your full name",                    type: "input"    },
                    { key: "location",  label: "Location",   placeholder: "e.g. Cebu City, Philippines",       type: "input"    },
                    { key: "bio",       label: "Bio",        placeholder: "Tell the community about yourself…", type: "textarea" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-800 text-stone-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea value={editForm[f.key as keyof typeof editForm]} rows={3} placeholder={f.placeholder}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-sm outline-none focus:border-[#2d6a4f] transition-colors resize-none"
                          style={{ fontFamily: "'DM Sans', sans-serif" }} />
                      ) : (
                        <input value={editForm[f.key as keyof typeof editForm]} placeholder={f.placeholder}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-sm outline-none focus:border-[#2d6a4f] transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }} />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm font-700 hover:bg-stone-200 transition-colors border-0 cursor-pointer" style={{ fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="py-2.5 px-8 bg-[#2d6a4f] text-white rounded-xl text-sm font-800 hover:bg-[#1a4a36] transition-colors border-0 cursor-pointer disabled:opacity-60" style={{ fontFamily: "'DM Sans', sans-serif", flex: 2 }}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-5 flex-wrap">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-900 shrink-0"
                  style={{ background: `linear-gradient(135deg,${lvlColor},${lvlColor}99)`, boxShadow: `0 6px 20px ${lvlColor}33` }}>
                  {getInitials(profile.full_name || "")}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>
                      {profile.full_name || "Unnamed User"}
                    </h1>
                    <span className="text-xs font-800 px-2.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                      {badge.emoji} {badge.name}
                    </span>
                    <span className="text-xs font-700 px-2.5 py-0.5 rounded-full" style={{ background: `${lvlColor}15`, color: lvlColor }}>
                      {displayLevel}
                    </span>
                    {profile.is_verified && (
                      <span className="text-xs font-700 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Verified</span>
                    )}
                  </div>

                  <p className="text-xs text-stone-400 mb-3">@{profile.username}</p>

                  {profile.bio
                    ? <p className="text-sm text-stone-500 leading-relaxed mb-3 max-w-lg">{profile.bio}</p>
                    : <p className="text-sm text-stone-300 italic mb-3">No bio yet — add one to stand out!</p>}

                  {/* Verified skills row */}
                  {verifiedSkills.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs font-700 text-stone-400">Verified in:</span>
                      {verifiedSkills.slice(0, 4).map(s => (
                        <span key={s.id} className="text-xs font-700 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          ✓ {s.skills?.name}
                        </span>
                      ))}
                      {verifiedSkills.length > 4 && <span className="text-xs text-stone-400">+{verifiedSkills.length - 4} more</span>}
                    </div>
                  )}

                  {/* Meta row — shows Bayesian rating */}
                  <div className="flex items-center gap-4 flex-wrap text-xs text-stone-400">
                    {profile.location && <span>📍 {profile.location}</span>}
                    <span>📅 Joined {joinDate}</span>
                    {avgRating > 0 && <span>⭐ {avgRating.toFixed(2)} avg rating</span>}
                    <span>🏅 {badges.length} badge{badges.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <button onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-xs font-700 rounded-xl border border-stone-200 hover:bg-stone-200 transition-colors cursor-pointer shrink-0"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  ✏️ Edit Profile
                </button>
              </div>
            )}

            {/* XP Bar */}
            {!editing && (
              <div className="mt-5 pt-5 border-t border-stone-100">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-700 text-stone-500">⚡ {profile.xp} XP · {displayLevel}</span>
                  <span className="text-xs text-stone-300">{xpNext - profile.xp > 0 ? `${xpNext - profile.xp} XP to next level` : "Max level!"}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg,${lvlColor},${lvlColor}88)` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS STRIP */}
        {!editing && (
          <div className="grid grid-cols-5 gap-3 mb-4 fade-up" style={{ animationDelay: ".06s" }}>
            {[
              { label: "Credits",  value: profile.credits, icon: "💰", color: "#2d6a4f", href: "/wallet"          },
              { label: "XP",       value: profile.xp,      icon: "⚡", color: "#7c3aed", href: "/leaderboard"     },
              { label: "Sessions", value: sessions,         icon: "📚", color: "#0891b2", href: "/sessions"        },
              { label: "Listings", value: listings.length,  icon: "📋", color: "#b45309", href: "/listings/create" },
              { label: "Badges",   value: badges.length,    icon: "🏅", color: "#dc2626", href: "#"                },
            ].map(s => (
              <a key={s.label} href={s.href}
                onClick={s.label === "Badges" ? e => { e.preventDefault(); setActiveTab("badges"); } : undefined}
                className="card stat-card p-4 text-center block">
                <div className="text-2xl font-900 leading-none mb-1" style={{ fontFamily: "'Fraunces', serif", color: s.color }}>{s.value}</div>
                <div className="text-xs text-stone-400 font-700 uppercase tracking-wider">{s.label}</div>
              </a>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        {!editing && (
          <div className="grid gap-4 fade-up" style={{ gridTemplateColumns: "1fr 280px", animationDelay: ".1s" }}>

            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">

              {/* SKILLS */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-800 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Skills & Verifications</h3>
                    <p className="text-xs text-stone-400 mt-0.5">Skills you've listed or been verified in</p>
                  </div>
                  <a href="/verify" className="text-xs font-700 text-[#2d6a4f] bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">+ Get Verified</a>
                </div>

                {verifiedSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">✓ Verified</p>
                    <div className="flex flex-wrap gap-2">
                      {verifiedSkills.map(s => (
                        <span key={s.id} className="text-xs font-700 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          ✓ {s.skills?.name} <span className="text-green-500 font-500">· {s.skills?.category}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {unverifiedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">○ Unverified</p>
                    <div className="flex flex-wrap gap-2">
                      {unverifiedSkills.map(s => (
                        <span key={s.id} className="text-xs font-600 px-3 py-1 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                          {s.skills?.name} <a href="/verify" className="text-[#2d6a4f] font-700 ml-1">verify →</a>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {userSkills.length === 0 && (
                  <div className="flex items-center gap-4 bg-green-50 rounded-xl p-4 border border-green-200">
                    <span className="text-3xl">✅</span>
                    <div className="flex-1">
                      <p className="text-sm font-700 text-stone-800 mb-0.5">Get your skills verified!</p>
                      <p className="text-xs text-stone-500">Verified teachers get <strong>2x more bookings</strong>.</p>
                    </div>
                    <a href="/verify" className="text-xs font-800 text-white bg-[#2d6a4f] px-3 py-2 rounded-lg hover:bg-[#1a4a36] transition-colors whitespace-nowrap">Verify Now →</a>
                  </div>
                )}
              </div>

              {/* TABS */}
              <div>
                <div className="flex bg-stone-100 p-1 rounded-xl gap-0.5 w-fit mb-4">
                  {[{k:"listings",l:"Listings"},{k:"badges",l:"Badges"},{k:"activity",l:"Activity"}].map(t => (
                    <button key={t.k} onClick={() => setActiveTab(t.k as any)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-700 transition-all border-0 cursor-pointer ${activeTab === t.k ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600 bg-transparent"}`}
                      style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {/* LISTINGS TAB */}
                {activeTab === "listings" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>My Skill Listings</h3>
                      <a href="/listings/create" className="text-xs font-700 text-white bg-[#2d6a4f] px-4 py-2 rounded-xl hover:bg-[#1a4a36] transition-colors">+ Create Listing</a>
                    </div>
                    {listings.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">📋</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No listings yet</h4>
                        <p className="text-xs text-stone-400 mb-5">Create a skill listing to start teaching!</p>
                        <a href="/listings/create" className="inline-block text-xs font-700 text-white bg-[#2d6a4f] px-5 py-2.5 rounded-xl hover:bg-[#1a4a36] transition-colors">Create your first listing →</a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {listings.map(listing => {
                          const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                          return (
                            <div key={listing.id} className="listing-row card px-5 py-4 flex items-center gap-4 justify-between flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="text-xs font-700 px-2.5 py-0.5 rounded-full" style={{ background: fmt.bg, color: fmt.color }}>{fmt.label}</span>
                                  {listing.skills && <span className="text-xs text-stone-400">{listing.skills.name}</span>}
                                  <span className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${listing.is_active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                                    {listing.is_active ? "● Active" : "○ Paused"}
                                  </span>
                                </div>
                                <p className="text-sm font-800 text-stone-900 mb-0.5" style={{ fontFamily: "'Fraunces', serif" }}>{listing.title}</p>
                                <p className="text-xs text-stone-400">{listing.duration} min session</p>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-xl font-900 text-[#2d6a4f]" style={{ fontFamily: "'Fraunces', serif" }}>{listing.credit_price} cr</div>
                                <div className="text-xs text-stone-400">per session</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* BADGES TAB */}
                {activeTab === "badges" && (
                  <div>
                    <h3 className="text-base font-900 text-stone-900 mb-3" style={{ fontFamily: "'Fraunces', serif" }}>Earned Badges</h3>
                    {badges.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">🏅</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No badges yet</h4>
                        <p className="text-xs text-stone-400">Complete sessions, answer bounties, and participate!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {badges.map(b => (
                          <div key={b.id} className="card p-5 text-center">
                            <div className="text-4xl mb-3">{BADGE_ICONS[b.badge_type] || "🏅"}</div>
                            <p className="text-sm font-800 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>{b.badge_name}</p>
                            <p className="text-xs text-stone-400 leading-relaxed mb-2">{b.description}</p>
                            <p className="text-xs text-stone-300">{new Date(b.earned_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIVITY TAB */}
                {activeTab === "activity" && (
                  <div>
                    <h3 className="text-base font-900 text-stone-900 mb-3" style={{ fontFamily: "'Fraunces', serif" }}>Credit Activity</h3>
                    {transactions.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">📊</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No transactions yet</h4>
                        <p className="text-xs text-stone-400">Your credit history will appear here.</p>
                      </div>
                    ) : (
                      <div className="card overflow-hidden">
                        {transactions.map((tx, i) => (
                          <div key={tx.id} className="tx-row flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: i < transactions.length - 1 ? "1px solid #f5f0e8" : "none" }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${tx.amount > 0 ? "bg-green-50" : "bg-red-50"}`}>
                                {TX_ICONS[tx.type] || "💳"}
                              </div>
                              <div>
                                <p className="text-sm font-600 text-stone-700">{tx.description || tx.type.replace(/_/g, " ")}</p>
                                <p className="text-xs text-stone-400">{new Date(tx.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                            <div className="text-base font-900 shrink-0" style={{ fontFamily: "'Fraunces', serif", color: tx.amount > 0 ? "#2d6a4f" : "#dc2626" }}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="flex flex-col gap-3">

              {/* BADGE PROGRESS */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-800 text-stone-400 uppercase tracking-widest">Badge Tier</p>
                  <span className="text-xs font-800 px-2.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.emoji} {badge.name}</span>
                </div>

                <div className="rounded-xl p-3 mb-4 flex items-center gap-3 border" style={{ background: badge.bg, borderColor: `${badge.color}22` }}>
                  <span className="text-3xl">{badge.emoji}</span>
                  <div>
                    <p className="text-sm font-900" style={{ fontFamily: "'Fraunces', serif", color: badge.color }}>{badge.name}</p>
                    <p className="text-xs font-500" style={{ color: badge.color, opacity: 0.75 }}>{badge.desc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: "⚡", val: profile.xp,              label: "XP"       },
                    { icon: "📚", val: sessions,                 label: "Sessions" },
                    { icon: "⭐", val: avgRating.toFixed(2),     label: "Rating"   },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-50 rounded-xl p-2.5 text-center">
                      <div className="text-sm mb-1">{s.icon}</div>
                      <div className="text-base font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{s.val}</div>
                      <div className="text-xs text-stone-400 font-600 uppercase tracking-wide" style={{ fontSize: 9 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {nextBadge && (
                  <div>
                    <p className="text-xs font-700 text-stone-600 mb-3">Next: {nextBadge.emoji} {nextBadge.name}</p>
                    {[
                      { label: "XP",       current: profile.xp, req: nextBadge.xpReq       },
                      { label: "Sessions", current: sessions,    req: nextBadge.sessionsReq  },
                      { label: "Rating",   current: avgRating,   req: nextBadge.ratingReq    },
                    ].filter(r => r.req > 0).map(r => {
                      const done = r.current >= r.req;
                      const pct  = Math.min((r.current / r.req) * 100, 100);
                      return (
                        <div key={r.label} className="mb-2.5">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-stone-500 font-600">{r.label}</span>
                            <span className={`text-xs font-700 ${done ? "text-[#2d6a4f]" : "text-stone-400"}`}>
                              {done ? "✓" : `${typeof r.current === "number" && r.current % 1 !== 0 ? r.current.toFixed(2) : r.current} / ${r.req}`}
                            </span>
                          </div>
                          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: done ? "#2d6a4f" : "#cbd5e1" }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* All tiers */}
                <div className="pt-3 mt-1 border-t border-stone-100">
                  <p className="text-xs font-700 text-stone-300 uppercase tracking-widest mb-2" style={{ fontSize: 9 }}>All Tiers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_TIERS.map(t => (
                      <span key={t.name} className="text-xs font-700 px-2 py-0.5 rounded-full" style={{
                        background: t.name === badge.name ? t.bg : "#f5f0e8",
                        color: t.name === badge.name ? t.color : "#ccc",
                      }}>
                        {t.emoji} {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* REPUTATION */}
              <div className="card p-5">
                <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-3">Reputation Score</p>

                <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-center justify-between border border-amber-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💫</span>
                    <div>
                      <div className="text-2xl font-900 text-amber-700 leading-none" style={{ fontFamily: "'Fraunces', serif" }}>
                        {rep}<span className="text-sm text-amber-400">/100</span>
                      </div>
                      <div className="text-xs font-700 text-amber-700">{repLabel}</div>
                    </div>
                  </div>
                  <svg viewBox="0 0 52 52" className="w-11 h-11 shrink-0" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep, 100) / 100) * 131.9} 131.9`} strokeLinecap="round" />
                  </svg>
                </div>

                {[
                  { icon: "⭐", label: "Rating",   pts: Math.min(Math.round(avgRating * sessions * 4), 80), max: 80,  detail: `${avgRating.toFixed(2)} avg × ${sessions} sessions` },
                  { icon: "📚", label: "Sessions", pts: Math.min(sessions * 2, 15),                         max: 15,  detail: `${sessions} × 2 pts`                               },
                  { icon: "🔄", label: "Repeats",  pts: Math.min(repeatClients * 5, 10),                    max: 10,  detail: `${repeatClients} repeat clients × 5`               },
                  { icon: "⚠️", label: "Disputes", pts: disputes * -15,                                     max: 0,   detail: disputes === 0 ? "No disputes ✓" : `${disputes} × -15` },
                ].map(r => (
                  <div key={r.label} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-700 text-stone-600">{r.icon} {r.label}</span>
                      <span className={`text-xs font-800 ${r.pts > 0 ? "text-[#2d6a4f]" : r.pts < 0 ? "text-red-500" : "text-stone-400"}`}>
                        {r.pts > 0 ? `+${r.pts}` : r.pts < 0 ? `${r.pts}` : "✓"}{r.pts !== 0 ? " pts" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mb-1">{r.detail}</p>
                    {r.max > 0 && <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min((r.pts / r.max) * 100, 100)}%`, background: "#f59e0b" }} /></div>}
                  </div>
                ))}
              </div>

              {/* QUICK LINKS */}
              <div className="card p-4">
                <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">Quick Links</p>
                {[
                  ["✅", "Get Verified",    "/verify"],
                  ["🎓", "Create Listing",  "/listings/create"],
                  ["⭐", "My Ratings",      "/ratings"],
                  ["🏆", "Leaderboard",     "/leaderboard"],
                  ["💰", "Wallet",          "/wallet"],
                ].map(([icon, label, href]) => (
                  <a key={label} href={href} className="quick-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-stone-500 text-xs font-600 transition-all">
                    <span>{icon}</span>
                    <span className="flex-1">{label}</span>
                    <span className="text-stone-300">›</span>
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