"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BadgeChip, BadgeProgressCard, getBadgeTier } from "@/components/BadgeSystem";
import { ReputationCard, ReputationChip, calcReputation } from "@/components/ReputationScore";

type Profile = {
  id: string; full_name: string; username: string;
  bio: string; location: string; credits: number;
  xp: number; level: string; role: string;
  avatar_url: string; created_at: string;
  is_verified?: boolean;
};
type Badge = {
  id: string; badge_type: string; badge_name: string;
  description: string; earned_at: string;
};
type Listing = {
  id: string; title: string; format: string;
  duration: number; credit_price: number; is_active: boolean;
  skills: { name: string; category: string };
};
type Transaction = {
  id: string; amount: number; type: string;
  description: string; created_at: string;
};
type UserSkill = {
  id: string;
  skill_id: string;
  is_verified: boolean;   // ← FIXED: was "verified"
  verified_at: string | null;
  skills: { name: string; category: string };
};

const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600,
  Skilled: 1000, Expert: 2000, Master: 4000, Legend: 9999,
};

// Correct level thresholds (match your DB logic)
function getLevelFromXP(xp: number): string {
  if (xp >= 4000) return "Legend";
  if (xp >= 2000) return "Master";
  if (xp >= 1000) return "Expert";
  if (xp >= 600)  return "Skilled";
  if (xp >= 300)  return "Contributor";
  if (xp >= 100)  return "Learner";
  return "Seedling";
}

const BADGE_ICONS: Record<string, string> = {
  early_adopter: "🌟", rising_teacher: "🥉", skilled_teacher: "🥈",
  top_teacher: "🥇", expert_teacher: "💎", first_session: "📚",
  curious_learner: "📖", first_bounty: "🎯", problem_solver: "💪",
  helpful_voice: "💬", connector: "👥", on_fire: "🔥",
};

const FORMAT_CONFIG: Record<string, { label: string; tw: string }> = {
  video: { label: "📹 Video", tw: "bg-sky-50 text-sky-700" },
  chat:  { label: "💬 Chat",  tw: "bg-emerald-50 text-emerald-700" },
  docs:  { label: "📄 Docs",  tw: "bg-violet-50 text-violet-700" },
  mixed: { label: "🎨 Mixed", tw: "bg-amber-50 text-amber-700" },
};

const TX_ICONS: Record<string, string> = {
  signup_bonus: "🎁", session_earn: "📚", session_spend: "💳",
  bounty_earn: "🏆", bounty_spend: "🎯", referral: "👥",
  challenge: "⚡", purchase: "💰", forum_earn: "💬",
  topup: "💳",
};

const CATEGORY_TW: Record<string, string> = {
  Programming: "bg-sky-50 text-sky-700 border-sky-200",
  Design:      "bg-pink-50 text-pink-700 border-pink-200",
  Academic:    "bg-amber-50 text-amber-700 border-amber-200",
  Language:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  Music:       "bg-violet-50 text-violet-700 border-violet-200",
  Arts:        "bg-orange-50 text-orange-700 border-orange-200",
  Media:       "bg-rose-50 text-rose-700 border-rose-200",
  Science:     "bg-teal-50 text-teal-700 border-teal-200",
  Other:       "bg-stone-50 text-stone-600 border-stone-200",
};

function getCatTW(cat: string) {
  return CATEGORY_TW[cat] || CATEGORY_TW.Other;
}

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
}

export default function ProfilePage() {
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [badges, setBadges]             = useState<Badge[]>([]);
  const [listings, setListings]         = useState<Listing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userSkills, setUserSkills]     = useState<UserSkill[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<"listings" | "badges" | "activity">("listings");
  const [editing, setEditing]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [editForm, setEditForm]         = useState({ full_name: "", bio: "", location: "" });

  const [sessions, setSessions]         = useState(0);
  const [avgRating, setAvgRating]       = useState(0);
  const [repeatClients, setRepeatClients] = useState(0);
  const [disputes, setDisputes]         = useState(0);

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
        { data: b },
        { data: l },
        { data: tx },
        { count: sCount },
        { data: ratingData },
        { data: sessionData },
        { count: dCount },
        { data: skillsData },
      ] = await Promise.all([
        supabase.from("badges").select("*").eq("user_id", user.id).order("earned_at", { ascending: false }),
        supabase.from("listings").select("*, skills(name, category)").eq("teacher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("sessions").select("*", { count: "exact", head: true }).or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", user.id),
        supabase.from("sessions").select("learner_id").eq("teacher_id", user.id).eq("status", "completed"),
        supabase.from("sessions").select("*", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "disputed"),
        // FIXED: select is_verified (not verified)
        supabase.from("user_skills").select("*, skills(name, category)").eq("user_id", user.id).order("is_verified", { ascending: false }),
      ]);

      setBadges(b || []);
      setListings((l as Listing[]) || []);
      setTransactions(tx || []);
      setSessions(sCount || 0);
      // FIXED: cast with correct field name
      setUserSkills((skillsData as UserSkill[]) || []);

      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => {
          counts[s.learner_id] = (counts[s.learner_id] || 0) + 1;
        });
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
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">👤</div>
        <p className="text-stone-400 text-sm font-medium">Loading your profile...</p>
      </div>
    </div>
  );

  if (!profile) return null;

  // FIXED: use is_verified field
  const verifiedSkills   = userSkills.filter(s => s.is_verified);
  const unverifiedSkills = userSkills.filter(s => !s.is_verified);

  const tier     = getBadgeTier(profile.xp, sessions, avgRating);
  const repScore = calcReputation({ avgRating, completedSessions: sessions, repeatClients, disputes });
  const initials = getInitials(profile.full_name || "");
  // FIXED: derive level from XP to ensure consistency
  const displayLevel = getLevelFromXP(profile.xp);
  const xpNext   = XP_TO_NEXT[displayLevel] || 100;
  const xpPct    = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        body { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-6 h-14 flex items-center justify-between shadow-sm">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-1">
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="/wallet" className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1.5 rounded-full no-underline hover:bg-emerald-100 transition-colors border border-emerald-200">
            💰 {profile.credits} cr
          </a>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors border-0 cursor-pointer">
            🚪 Log out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* ── PROFILE HERO ── */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm mb-6 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400" />
          <div className="p-7">
            {editing ? (
              <div className="max-w-md">
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-5">Edit Profile</h2>
                <div className="flex flex-col gap-4">
                  {[
                    { key: "full_name", label: "Full Name", placeholder: "Your full name", type: "input" },
                    { key: "location", label: "Location", placeholder: "e.g. Cebu City, Philippines", type: "input" },
                    { key: "bio", label: "Bio", placeholder: "Tell the community about yourself...", type: "textarea" },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-1.5">{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea value={editForm[field.key as keyof typeof editForm]}
                          onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder} rows={3}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 resize-none focus:outline-none focus:border-emerald-400 transition-colors" />
                      ) : (
                        <input value={editForm[field.key as keyof typeof editForm]}
                          onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:outline-none focus:border-emerald-400 transition-colors" />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-colors border-0 cursor-pointer">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-black hover:bg-emerald-700 transition-colors border-0 cursor-pointer disabled:opacity-50">
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-5 flex-wrap">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-white text-2xl font-black flex items-center justify-center flex-shrink-0 shadow-lg">
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-48">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <h1 className="font-fraunces text-2xl font-black text-stone-900">{profile.full_name || "Unnamed User"}</h1>
                    <BadgeChip tier={tier} size="sm" />
                    <ReputationChip score={repScore} />
                  </div>
                  <p className="text-sm text-stone-400 font-medium mb-2">@{profile.username}</p>
                  <p className={`text-sm leading-relaxed mb-3 max-w-lg ${profile.bio ? "text-stone-600" : "text-stone-300 italic"}`}>
                    {profile.bio || "No bio yet — add one to stand out!"}
                  </p>

                  {/* Verified skills row */}
                  {verifiedSkills.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Verified in:</span>
                      {verifiedSkills.slice(0, 4).map(s => (
                        <span key={s.id} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${getCatTW(s.skills?.category || "Other")}`}>
                          ✅ {s.skills?.name}
                        </span>
                      ))}
                      {verifiedSkills.length > 4 && (
                        <span className="text-xs text-stone-400 font-medium">+{verifiedSkills.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 flex-wrap">
                    {profile.location && <span className="text-xs text-stone-400">📍 {profile.location}</span>}
                    <span className="text-xs text-stone-400">📅 Joined {joinDate}</span>
                    {avgRating > 0 && <span className="text-xs text-stone-400">⭐ {avgRating.toFixed(1)} avg rating</span>}
                    {/* FIXED: show correct badge count */}
                    <span className="text-xs text-stone-400">🏅 {badges.length} badge{badges.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <button onClick={() => setEditing(true)} className="px-4 py-2 bg-stone-100 text-stone-600 text-sm font-bold rounded-xl hover:bg-stone-200 transition-colors border-0 cursor-pointer flex-shrink-0">
                  ✏️ Edit Profile
                </button>
              </div>
            )}

            {/* XP Bar — FIXED: uses displayLevel derived from XP */}
            {!editing && (
              <div className="mt-5 pt-5 border-t border-stone-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-stone-500">⚡ {profile.xp} XP — {displayLevel}</span>
                  <span className="text-xs text-stone-300">{xpNext - profile.xp > 0 ? `${xpNext - profile.xp} XP to next level` : "Max level!"}</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ROW ── */}
        {!editing && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: "Credits",  value: profile.credits,  icon: "💰", tw: "text-emerald-700 bg-emerald-50", href: "/wallet" },
              { label: "XP",       value: profile.xp,       icon: "⚡", tw: "text-violet-700 bg-violet-50",  href: "/leaderboard" },
              { label: "Sessions", value: sessions,          icon: "📚", tw: "text-sky-700 bg-sky-50",        href: "/sessions" },
              { label: "Listings", value: listings.length,   icon: "📋", tw: "text-amber-700 bg-amber-50",   href: "/listings/create" },
              // FIXED: show actual badges count
              { label: "Badges",   value: badges.length,     icon: "🏅", tw: "text-rose-600 bg-rose-50",     href: "#badges" },
            ].map(stat => (
              <a key={stat.label} href={stat.href}
                onClick={stat.href === "#badges" ? (e) => { e.preventDefault(); setActiveTab("badges"); } : undefined}
                className="bg-white rounded-2xl p-4 border border-stone-200 no-underline text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 block group">
                <div className={`w-10 h-10 ${stat.tw.split(" ")[1]} rounded-xl flex items-center justify-center text-xl mx-auto mb-2`}>{stat.icon}</div>
                <p className={`font-fraunces text-2xl font-black ${stat.tw.split(" ")[0]}`}>{stat.value}</p>
                <p className="text-[11px] text-stone-400 font-medium mt-0.5">{stat.label}</p>
              </a>
            ))}
          </div>
        )}

        {/* ── MAIN GRID ── */}
        {!editing && (
          <div className="grid grid-cols-[1fr_300px] gap-5">
            <div>

              {/* ── SKILLS SECTION ── FIXED: uses is_verified */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-fraunces text-base font-black text-stone-900">Skills & Verifications</h3>
                    <p className="text-xs text-stone-400 mt-0.5">Skills you've listed or been verified in</p>
                  </div>
                  <a href="/verify" className="text-xs font-black text-emerald-600 hover:text-emerald-700 no-underline bg-emerald-50 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200">
                    + Get Verified
                  </a>
                </div>

                {verifiedSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2.5">✅ Verified Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {verifiedSkills.map(s => (
                        <div key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${getCatTW(s.skills?.category || "Other")}`}>
                          <span className="text-emerald-500 text-xs">✅</span>
                          <span className="text-xs font-black">{s.skills?.name}</span>
                          <span className="text-[10px] text-stone-300">· {s.skills?.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unverifiedSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2.5">🔓 Unverified</p>
                    <div className="flex flex-wrap gap-2">
                      {unverifiedSkills.map(s => (
                        <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50">
                          <span className="text-stone-300 text-xs">○</span>
                          <span className="text-xs font-bold text-stone-500">{s.skills?.name}</span>
                          <a href="/verify" className="text-[10px] text-emerald-500 font-bold no-underline hover:underline ml-1">verify →</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userSkills.length === 0 && (
                  <div className="bg-gradient-to-r from-sky-50 to-emerald-50 border border-sky-100 rounded-xl p-4 flex items-center gap-3">
                    <span className="text-3xl">✅</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-sky-800 mb-0.5">Get your skills verified!</p>
                      <p className="text-xs text-sky-600">Verified teachers get <strong>2x more bookings</strong> and a badge on their profile.</p>
                    </div>
                    <a href="/verify" className="bg-sky-600 text-white text-xs font-black px-3 py-2 rounded-xl no-underline hover:bg-sky-700 transition-colors whitespace-nowrap">
                      Verify Now →
                    </a>
                  </div>
                )}
              </div>

              {/* ── TABS ── */}
              <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-5">
                {([
                  { key: "listings", label: "📋 Listings" },
                  { key: "badges",   label: "🏅 Badges" },
                  { key: "activity", label: "📊 Activity" },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-0 cursor-pointer ${
                      activeTab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700 bg-transparent"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── LISTINGS ── */}
              {activeTab === "listings" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-fraunces text-lg font-black text-stone-900">My Skill Listings</h3>
                    <a href="/listings/create" className="bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl no-underline hover:bg-emerald-700 transition-colors">+ Create Listing</a>
                  </div>
                  {listings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                      <div className="text-5xl mb-3">📋</div>
                      <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No listings yet</p>
                      <p className="text-sm text-stone-400 mb-5">Create a skill listing to start teaching and earning credits!</p>
                      <a href="/listings/create" className="inline-block bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl no-underline hover:bg-emerald-700 transition-colors">Create your first listing →</a>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {listings.map(listing => {
                        const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                        return (
                          <div key={listing.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4 justify-between flex-wrap hover:shadow-sm transition-shadow">
                            <div className="flex-1 min-w-48">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${fmt.tw}`}>{fmt.label}</span>
                                {listing.skills && <span className="text-xs text-stone-400">{listing.skills.name}</span>}
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${listing.is_active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"}`}>
                                  {listing.is_active ? "● Active" : "○ Paused"}
                                </span>
                              </div>
                              <h4 className="font-fraunces text-base font-black text-stone-900 mb-1">{listing.title}</h4>
                              <p className="text-xs text-stone-400">{listing.duration} min session</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-fraunces text-xl font-black text-emerald-700">{listing.credit_price} cr</p>
                              <p className="text-xs text-stone-400">per session</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── BADGES ── */}
              {activeTab === "badges" && (
                <div>
                  <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">Earned Badges</h3>
                  {badges.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                      <div className="text-5xl mb-3">🏅</div>
                      <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No badges yet</p>
                      <p className="text-sm text-stone-400">Complete sessions, answer bounties, and participate to earn badges!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {badges.map(b => (
                        <div key={b.id} className="bg-white rounded-2xl border border-stone-200 p-5 text-center hover:shadow-sm transition-shadow">
                          <div className="text-4xl mb-2">{BADGE_ICONS[b.badge_type] || "🏅"}</div>
                          <p className="font-bold text-stone-800 text-sm mb-1">{b.badge_name}</p>
                          <p className="text-xs text-stone-400 leading-relaxed mb-2">{b.description}</p>
                          <p className="text-[11px] text-stone-300">{new Date(b.earned_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ACTIVITY ── */}
              {activeTab === "activity" && (
                <div>
                  <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">Credit Activity</h3>
                  {transactions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                      <div className="text-5xl mb-3">📊</div>
                      <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No transactions yet</p>
                      <p className="text-sm text-stone-400">Your credit history will appear here.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                      {transactions.map((tx, i) => (
                        <div key={tx.id} className={`flex items-center gap-3 px-5 py-4 justify-between hover:bg-stone-50 transition-colors ${i < transactions.length - 1 ? "border-b border-stone-100" : ""}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${tx.amount > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                              {TX_ICONS[tx.type] || "💳"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-stone-700">{tx.description || tx.type.replace(/_/g, " ")}</p>
                              <p className="text-xs text-stone-300">{new Date(tx.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                          </div>
                          <p className={`font-fraunces text-lg font-black flex-shrink-0 ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="flex flex-col gap-4">
              <BadgeProgressCard xp={profile.xp} sessions={sessions} avgRating={avgRating} />
              <ReputationCard data={{ avgRating, completedSessions: sessions, repeatClients, disputes }} />

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Quick Links</p>
                <div className="flex flex-col gap-1">
                  {[
                    { icon: "✅", label: "Get Verified",   href: "/verify" },
                    { icon: "🎓", label: "Create Listing", href: "/listings/create" },
                    { icon: "⭐", label: "My Ratings",     href: "/ratings" },
                    { icon: "🏆", label: "Leaderboard",    href: "/leaderboard" },
                    { icon: "💰", label: "Wallet",         href: "/wallet" },
                  ].map(item => (
                    <a key={item.label} href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-600 text-sm font-semibold hover:bg-emerald-50 hover:text-emerald-700 transition-colors no-underline group">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                      <span className="ml-auto text-stone-300 group-hover:text-emerald-400">›</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}