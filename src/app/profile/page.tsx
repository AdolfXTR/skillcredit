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
  id: string; skill_id: string; verified: boolean;
  verified_at: string | null;
  skills: { name: string; category: string };
};

const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600,
  Skilled: 1000, Expert: 2000, Master: 4000, Legend: 9999,
};

const BADGE_ICONS: Record<string, string> = {
  early_adopter: "🌟", rising_teacher: "🥉", skilled_teacher: "🥈",
  top_teacher: "🥇", expert_teacher: "💎", first_session: "📚",
  curious_learner: "📖", first_bounty: "🎯", problem_solver: "💪",
  helpful_voice: "💬", connector: "👥", on_fire: "🔥",
};

const FORMAT_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  video: { bg: "bg-sky-50",    color: "text-sky-700",    label: "📹 Video" },
  chat:  { bg: "bg-emerald-50",color: "text-emerald-700",label: "💬 Chat" },
  docs:  { bg: "bg-violet-50", color: "text-violet-700", label: "📄 Docs" },
  mixed: { bg: "bg-amber-50",  color: "text-amber-700",  label: "🎨 Mixed" },
};

const TX_ICONS: Record<string, string> = {
  signup_bonus: "🎁", session_earn: "📚", session_spend: "💳",
  bounty_earn: "🏆", bounty_spend: "🎯", referral: "👥",
  challenge: "⚡", purchase: "💰", forum_earn: "💬",
};

// Category colors for skill badges
const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Programming:  { bg: "bg-sky-50",     color: "text-sky-700",     border: "border-sky-200" },
  Design:       { bg: "bg-pink-50",    color: "text-pink-700",    border: "border-pink-200" },
  Academic:     { bg: "bg-amber-50",   color: "text-amber-700",   border: "border-amber-200" },
  Language:     { bg: "bg-emerald-50", color: "text-emerald-700", border: "border-emerald-200" },
  Music:        { bg: "bg-violet-50",  color: "text-violet-700",  border: "border-violet-200" },
  Arts:         { bg: "bg-orange-50",  color: "text-orange-700",  border: "border-orange-200" },
  Media:        { bg: "bg-rose-50",    color: "text-rose-700",    border: "border-rose-200" },
  Other:        { bg: "bg-stone-50",   color: "text-stone-600",   border: "border-stone-200" },
};

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
}

export default function ProfilePage() {
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [badges, setBadges]               = useState<Badge[]>([]);
  const [listings, setListings]           = useState<Listing[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [userSkills, setUserSkills]       = useState<UserSkill[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<"listings" | "badges" | "activity">("listings");
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
        supabase.from("user_skills").select("*, skills(name, category)").eq("user_id", user.id).order("verified", { ascending: false }),
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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4">👤</div><p className="text-stone-400 text-sm">Loading your profile...</p></div>
      </div>
    );
  }

  if (!profile) return null;

  const tier      = getBadgeTier(profile.xp, sessions, avgRating);
  const repScore  = calcReputation({ avgRating, completedSessions: sessions, repeatClients, disputes });
  const initials  = profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const xpNext    = XP_TO_NEXT[profile.level] || 100;
  const xpPct     = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate  = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });

  const verifiedSkills   = userSkills.filter(s => s.verified);
  const unverifiedSkills = userSkills.filter(s => !s.verified);

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        .font-sans { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* NAVBAR */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-8 h-14 flex items-center justify-between">
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
          <a href="/wallet" className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1.5 rounded-full no-underline hover:bg-emerald-100 transition-colors">
            💰 {profile.credits} cr
          </a>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors border-0 cursor-pointer">
            🚪 Log out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* PROFILE HERO */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm mb-6 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-600 to-emerald-300" />
          <div className="p-7">
            {editing ? (
              <div className="max-w-md">
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-5">Edit Profile</h2>
                <div className="flex flex-col gap-4">
                  {[
                    { key: "full_name", label: "Full Name",  placeholder: "Your full name",              type: "input" },
                    { key: "location",  label: "Location",   placeholder: "e.g. Manila, Philippines",    type: "input" },
                    { key: "bio",       label: "Bio",        placeholder: "Tell the community about yourself...", type: "textarea" },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-bold text-stone-500 uppercase tracking-wide block mb-1.5">{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea value={editForm[field.key as keyof typeof editForm]}
                          onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder} rows={3}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 resize-none focus:outline-none focus:border-emerald-400 transition-colors font-sans" />
                      ) : (
                        <input value={editForm[field.key as keyof typeof editForm]}
                          onChange={e => setEditForm(p => ({ ...p, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:outline-none focus:border-emerald-400 transition-colors font-sans" />
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
              <div className="flex items-start gap-6 flex-wrap">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-700 text-2xl font-black flex items-center justify-center flex-shrink-0 ring-4 ring-emerald-50">
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-48">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <h1 className="font-fraunces text-2xl font-black text-stone-900">{profile.full_name || "Unnamed User"}</h1>
                    <BadgeChip tier={tier} size="sm" />
                    <ReputationChip score={repScore} />
                    {profile.is_verified && (
                      <span className="flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-black px-2.5 py-0.5 rounded-full">
                        ✅ Verified
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-stone-400 mb-2">@{profile.username}</p>
                  <p className={`text-sm leading-relaxed mb-3 max-w-lg ${profile.bio ? "text-stone-600" : "text-stone-300 italic"}`}>
                    {profile.bio || "No bio yet — add one to stand out!"}
                  </p>

                  {/* Verified skills inline row */}
                  {verifiedSkills.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs font-black text-stone-400">VERIFIED IN:</span>
                      {verifiedSkills.slice(0, 4).map(s => {
                        const c = getCategoryColor(s.skills?.category || "Other");
                        return (
                          <span key={s.id} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${c.bg} ${c.color} ${c.border}`}>
                            ✅ {s.skills?.name}
                          </span>
                        );
                      })}
                      {verifiedSkills.length > 4 && (
                        <span className="text-xs text-stone-400 font-medium">+{verifiedSkills.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 flex-wrap">
                    {profile.location && <span className="text-xs text-stone-400">📍 {profile.location}</span>}
                    <span className="text-xs text-stone-400">📅 Joined {joinDate}</span>
                    {badges.length > 0 && <span className="text-xs text-stone-400">🏅 {badges.length} badge{badges.length !== 1 ? "s" : ""}</span>}
                    {avgRating > 0 && <span className="text-xs text-stone-400">⭐ {avgRating.toFixed(1)} avg rating</span>}
                  </div>
                </div>

                <button onClick={() => setEditing(true)} className="px-4 py-2 bg-stone-100 text-stone-600 text-sm font-bold rounded-xl hover:bg-stone-200 transition-colors border-0 cursor-pointer flex-shrink-0">
                  ✏️ Edit Profile
                </button>
              </div>
            )}

            {/* XP Bar */}
            {!editing && (
              <div className="mt-5 pt-5 border-t border-stone-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-stone-500">⚡ {profile.xp} XP — {profile.level}</span>
                  <span className="text-xs text-stone-300">{xpNext - profile.xp} XP to next level</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${xpPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS ROW */}
        {!editing && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            {[
              { label: "Credits",  value: profile.credits,  icon: "💰", color: "text-emerald-700", bg: "bg-emerald-50", href: "/wallet" },
              { label: "XP",       value: profile.xp,       icon: "⚡", color: "text-violet-700",  bg: "bg-violet-50",  href: "/leaderboard" },
              { label: "Sessions", value: sessions,          icon: "📚", color: "text-sky-700",     bg: "bg-sky-50",     href: "/sessions" },
              { label: "Listings", value: listings.length,   icon: "📋", color: "text-amber-700",   bg: "bg-amber-50",   href: "/listings/create" },
              { label: "Badges",   value: badges.length,     icon: "🏅", color: "text-rose-600",    bg: "bg-rose-50",    href: "#badges" },
            ].map(stat => (
              <a key={stat.label} href={stat.href}
                className="bg-white rounded-2xl p-4 border border-stone-200 no-underline text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 block"
                onClick={stat.href === "#badges" ? (e) => { e.preventDefault(); setActiveTab("badges"); } : undefined}>
                <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center text-lg mx-auto mb-2`}>{stat.icon}</div>
                <p className={`font-fraunces text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[11px] text-stone-400 font-medium mt-0.5">{stat.label}</p>
              </a>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        {!editing && (
          <div className="grid grid-cols-[1fr_300px] gap-5">

            {/* LEFT */}
            <div>
              {/* ── VERIFIED SKILLS SECTION ── */}
              {userSkills.length > 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-fraunces text-base font-black text-stone-900">Skills & Verifications</h3>
                      <p className="text-xs text-stone-400 mt-0.5">Skills you've listed or been verified in</p>
                    </div>
                    <a href="/verify" className="text-xs font-black text-emerald-600 hover:text-emerald-700 no-underline bg-emerald-50 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors">
                      + Get Verified
                    </a>
                  </div>

                  {/* Verified */}
                  {verifiedSkills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">✅ Verified Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {verifiedSkills.map(s => {
                          const c = getCategoryColor(s.skills?.category || "Other");
                          return (
                            <div key={s.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${c.bg} ${c.border}`}>
                              <span className="text-emerald-500 text-xs">✅</span>
                              <span className={`text-xs font-black ${c.color}`}>{s.skills?.name}</span>
                              <span className="text-[10px] text-stone-300">· {s.skills?.category}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unverified */}
                  {unverifiedSkills.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">🔓 Unverified Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {unverifiedSkills.map(s => (
                          <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50">
                            <span className="text-stone-300 text-xs">○</span>
                            <span className="text-xs font-bold text-stone-500">{s.skills?.name}</span>
                            <a href="/verify" className="text-[10px] text-emerald-500 font-bold no-underline hover:underline">verify →</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {verifiedSkills.length === 0 && (
                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="text-sm font-bold text-sky-800">Get your skills verified!</p>
                        <p className="text-xs text-sky-600">Verified teachers get <strong>2x more bookings</strong> and a badge on their profile.</p>
                      </div>
                      <a href="/verify" className="ml-auto bg-sky-600 text-white text-xs font-black px-3 py-2 rounded-xl no-underline hover:bg-sky-700 transition-colors whitespace-nowrap flex-shrink-0">
                        Verify Now →
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* No skills yet prompt */}
              {userSkills.length === 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎯</span>
                    <div className="flex-1">
                      <p className="font-fraunces text-sm font-black text-stone-800">No skills listed yet</p>
                      <p className="text-xs text-stone-400">Create a listing or get verified to show your skills here.</p>
                    </div>
                    <div className="flex gap-2">
                      <a href="/listings/create" className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl no-underline hover:bg-emerald-700 transition-colors whitespace-nowrap">
                        + Create Listing
                      </a>
                      <a href="/verify" className="bg-sky-50 text-sky-700 text-xs font-bold px-3 py-2 rounded-xl no-underline hover:bg-sky-100 transition-colors whitespace-nowrap">
                        Get Verified
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 w-fit mb-5">
                {([
                  { key: "listings", label: "📋 Listings" },
                  { key: "badges",   label: "🏅 Badges" },
                  { key: "activity", label: "📊 Activity" },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-0 cursor-pointer ${
                      activeTab === t.key ? "bg-emerald-600 text-white shadow-sm" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50 bg-transparent"
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* LISTINGS TAB */}
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
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${fmt.bg} ${fmt.color}`}>{fmt.label}</span>
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

              {/* BADGES TAB */}
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

              {/* ACTIVITY TAB */}
              {activeTab === "activity" && (
                <div>
                  <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">Credit Activity</h3>
                  {transactions.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                      <div className="text-5xl mb-3">📊</div>
                      <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No transactions yet</p>
                      <p className="text-sm text-stone-400">Your credit history will appear here once you start teaching or learning.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                      {transactions.map((tx, i) => (
                        <div key={tx.id} className={`flex items-center gap-3 px-5 py-4 justify-between ${i < transactions.length - 1 ? "border-b border-stone-100" : ""}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${tx.amount > 0 ? "bg-emerald-50" : "bg-red-50"}`}>
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

            {/* RIGHT */}
            <div className="flex flex-col gap-4">
              <BadgeProgressCard xp={profile.xp} sessions={sessions} avgRating={avgRating} />
              <ReputationCard data={{ avgRating, completedSessions: sessions, repeatClients, disputes }} />

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-3">Quick Links</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { icon: "✅", label: "Get Verified",   href: "/verify" },
                    { icon: "🎓", label: "Create Listing", href: "/listings/create" },
                    { icon: "⭐", label: "My Ratings",     href: "/ratings" },
                    { icon: "🏆", label: "Leaderboard",    href: "/leaderboard" },
                    { icon: "💰", label: "Wallet",         href: "/wallet" },
                  ].map(item => (
                    <a key={item.label} href={item.href}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-600 text-sm font-semibold hover:bg-stone-50 hover:text-emerald-700 transition-colors no-underline group">
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