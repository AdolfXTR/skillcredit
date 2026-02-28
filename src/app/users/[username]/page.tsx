"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string;
  bio: string; location: string; credits: number;
  xp: number; level: string; created_at: string;
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
type UserSkill = {
  id: string; skill_id: string; is_verified: boolean;
  skills: { name: string; category: string };
};
type Review = {
  id: string; overall: number; comment: string; created_at: string;
  rater: { full_name: string; username: string };
};

function getLevelFromXP(xp: number): string {
  if (xp >= 4000) return "Legend";
  if (xp >= 2000) return "Master";
  if (xp >= 1000) return "Expert";
  if (xp >= 600)  return "Skilled";
  if (xp >= 300)  return "Contributor";
  if (xp >= 100)  return "Learner";
  return "Seedling";
}

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "bg-emerald-100 text-emerald-700",
  Learner:  "bg-sky-100 text-sky-700",
  Contributor: "bg-violet-100 text-violet-700",
  Skilled:  "bg-amber-100 text-amber-700",
  Expert:   "bg-red-100 text-red-700",
  Master:   "bg-cyan-100 text-cyan-700",
  Legend:   "bg-orange-100 text-orange-700",
};

const LEVEL_AVATAR_GRADIENT: Record<string, string> = {
  Seedling:    "from-emerald-400 to-emerald-600",
  Learner:     "from-sky-400 to-sky-600",
  Contributor: "from-violet-400 to-violet-600",
  Skilled:     "from-amber-400 to-amber-600",
  Expert:      "from-red-400 to-red-600",
  Master:      "from-cyan-400 to-cyan-600",
  Legend:      "from-orange-400 to-orange-600",
};

const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600,
  Skilled: 1000, Expert: 2000, Master: 4000, Legend: 9999,
};

const FORMAT_CONFIG: Record<string, { label: string; tw: string }> = {
  video: { label: "📹 Video", tw: "bg-sky-50 text-sky-700" },
  chat:  { label: "💬 Chat",  tw: "bg-emerald-50 text-emerald-700" },
  docs:  { label: "📄 Docs",  tw: "bg-violet-50 text-violet-700" },
  mixed: { label: "🎨 Mixed", tw: "bg-amber-50 text-amber-700" },
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

const BADGE_ICONS: Record<string, string> = {
  early_adopter: "🌟", rising_teacher: "🥉", skilled_teacher: "🥈",
  top_teacher: "🥇", expert_teacher: "💎", first_session: "📚",
  curious_learner: "📖", first_bounty: "🎯", problem_solver: "💪",
  helpful_voice: "💬", connector: "👥", on_fire: "🔥",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`text-sm ${i <= Math.round(rating) ? "text-amber-400" : "text-stone-200"}`}>★</span>
      ))}
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params?.username as string;

  const [currentUser, setCurrentUser]     = useState<{ id: string } | null>(null);
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [badges, setBadges]               = useState<Badge[]>([]);
  const [listings, setListings]           = useState<Listing[]>([]);
  const [userSkills, setUserSkills]       = useState<UserSkill[]>([]);
  const [reviews, setReviews]             = useState<Review[]>([]);
  const [sessions, setSessions]           = useState(0);
  const [avgRating, setAvgRating]         = useState(0);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [activeTab, setActiveTab]         = useState<"listings" | "badges" | "reviews">("listings");
  const [messageSent, setMessageSent]     = useState(false);
  const [sendingMsg, setSendingMsg]       = useState(false);

  useEffect(() => {
    if (!username) return;
    const load = async () => {
      // Get current logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user ? { id: user.id } : null);

      // Find target profile by username
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!prof) { setNotFound(true); setLoading(false); return; }

      // Redirect to own profile if viewing yourself
      if (user && prof.id === user.id) {
        window.location.href = "/profile";
        return;
      }

      setProfile(prof);

      const [
        { data: b },
        { data: l },
        { count: sCount },
        { data: ratingData },
        { data: skillsData },
        { data: reviewData },
      ] = await Promise.all([
        supabase.from("badges").select("*").eq("user_id", prof.id).order("earned_at", { ascending: false }),
        supabase.from("listings").select("*, skills(name, category)").eq("teacher_id", prof.id).eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("sessions").select("*", { count: "exact", head: true }).or(`teacher_id.eq.${prof.id},learner_id.eq.${prof.id}`).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", prof.id),
        supabase.from("user_skills").select("*, skills(name, category)").eq("user_id", prof.id).eq("is_verified", true),
        supabase.from("ratings").select("*, rater:profiles!ratings_rater_id_fkey(full_name, username)").eq("rated_id", prof.id).order("created_at", { ascending: false }).limit(10),
      ]);

      setBadges(b || []);
      setListings((l as Listing[]) || []);
      setSessions(sCount || 0);
      setUserSkills((skillsData as UserSkill[]) || []);
      setReviews((reviewData as Review[]) || []);

      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }

      setLoading(false);
    };
    load();
  }, [username]);

  const sendMessage = async () => {
    if (!currentUser || !profile || sendingMsg) return;
    setSendingMsg(true);
    // Create or find existing conversation, then redirect to messages
    const { data: existing } = await supabase
      .from("messages")
      .select("conversation_id")
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .limit(1);

    // Just redirect to messages with the user's ID as a query param
    window.location.href = `/messages?with=${profile.id}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">👤</div>
        <p className="text-stone-400 text-sm font-medium">Loading profile...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🕵️</div>
        <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-2">User not found</h2>
        <p className="text-stone-400 text-sm mb-6">No user with the username <strong>@{username}</strong> exists.</p>
        <a href="/listings" className="inline-block bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold no-underline hover:bg-emerald-700 transition-colors">Browse Users →</a>
      </div>
    </div>
  );

  if (!profile) return null;

  const displayLevel = getLevelFromXP(profile.xp);
  const xpNext = XP_TO_NEXT[displayLevel] || 100;
  const xpPct  = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });
  const verifiedSkills = userSkills.filter(s => s.is_verified);
  const avatarGradient = LEVEL_AVATAR_GRADIENT[displayLevel] || "from-emerald-400 to-emerald-600";
  const levelTw = LEVEL_COLORS[displayLevel] || LEVEL_COLORS.Seedling;

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease both; }
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
        <a href="/profile" className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors no-underline">
          👤 My Profile
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-8 fade-up">

        {/* ── PROFILE HERO ── */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm mb-6 overflow-hidden">
          {/* Top gradient bar — changes color by level */}
          <div className={`h-1.5 bg-gradient-to-r ${avatarGradient}`} />

          {/* Banner area */}
          <div className={`h-24 bg-gradient-to-br ${avatarGradient} opacity-10`} style={{ marginBottom: -48 }} />

          <div className="px-7 pb-7">
            <div className="flex items-end gap-5 mb-5">
              {/* Avatar */}
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${avatarGradient} text-white text-3xl font-black flex items-center justify-center flex-shrink-0 shadow-lg ring-4 ring-white -mt-6`}>
                {getInitials(profile.full_name)}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 ml-auto pb-1">
                {currentUser ? (
                  <>
                    <button onClick={sendMessage} disabled={sendingMsg}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors border-0 cursor-pointer disabled:opacity-50">
                      💬 {sendingMsg ? "Opening..." : "Message"}
                    </button>
                    {listings.length > 0 && (
                      <a href={`/listings?teacher=${profile.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-200 transition-colors no-underline">
                        📋 Book a Session
                      </a>
                    )}
                  </>
                ) : (
                  <a href="/login" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold no-underline hover:bg-emerald-700 transition-colors">
                    Sign in to message
                  </a>
                )}
              </div>
            </div>

            {/* Name + info */}
            <div className="flex items-start gap-4 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 flex-wrap mb-1">
                  <h1 className="font-fraunces text-2xl font-black text-stone-900">{profile.full_name}</h1>
                  {/* Level badge */}
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${levelTw}`}>
                    ⭐ {displayLevel}
                  </span>
                  {/* Verified indicator */}
                  {verifiedSkills.length > 0 && (
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      ✅ Verified Teacher
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-400 font-medium mb-2">@{profile.username}</p>

                {profile.bio ? (
                  <p className="text-sm text-stone-600 leading-relaxed mb-3 max-w-xl">{profile.bio}</p>
                ) : (
                  <p className="text-sm text-stone-300 italic mb-3">No bio yet.</p>
                )}

                {/* Verified skills */}
                {verifiedSkills.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Verified in:</span>
                    {verifiedSkills.map(s => (
                      <span key={s.id} className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${CATEGORY_TW[s.skills?.category || "Other"]}`}>
                        ✅ {s.skills?.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-4 flex-wrap">
                  {profile.location && <span className="text-xs text-stone-400">📍 {profile.location}</span>}
                  <span className="text-xs text-stone-400">📅 Joined {joinDate}</span>
                  {avgRating > 0 && (
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      ⭐ <span className="font-bold text-amber-600">{avgRating.toFixed(1)}</span> avg rating
                    </span>
                  )}
                  {sessions > 0 && <span className="text-xs text-stone-400">📚 {sessions} sessions completed</span>}
                </div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="mt-5 pt-5 border-t border-stone-100">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-bold text-stone-500">⚡ {profile.xp} XP — {displayLevel}</span>
                <span className="text-xs text-stone-300">{Math.max(xpNext - profile.xp, 0)} XP to next level</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${avatarGradient} rounded-full transition-all duration-700`} style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "XP",       value: profile.xp,       icon: "⚡", tw: "text-violet-700 bg-violet-50" },
            { label: "Sessions", value: sessions,          icon: "📚", tw: "text-sky-700 bg-sky-50" },
            { label: "Listings", value: listings.length,   icon: "📋", tw: "text-amber-700 bg-amber-50" },
            { label: "Badges",   value: badges.length,     icon: "🏅", tw: "text-rose-600 bg-rose-50" },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 border border-stone-200 text-center hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 ${stat.tw.split(" ")[1]} rounded-xl flex items-center justify-center text-xl mx-auto mb-2`}>{stat.icon}</div>
              <p className={`font-fraunces text-2xl font-black ${stat.tw.split(" ")[0]}`}>{stat.value}</p>
              <p className="text-[11px] text-stone-400 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-[1fr_280px] gap-5">
          <div>
            {/* Tabs */}
            <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-5">
              {([
                { key: "listings", label: `📋 Listings (${listings.length})` },
                { key: "badges",   label: `🏅 Badges (${badges.length})` },
                { key: "reviews",  label: `⭐ Reviews (${reviews.length})` },
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
                {listings.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                    <div className="text-5xl mb-3">📋</div>
                    <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No active listings</p>
                    <p className="text-sm text-stone-400">@{profile.username} hasn't posted any skill listings yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {listings.map(listing => {
                      const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                      return (
                        <div key={listing.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex items-center gap-4 justify-between hover:shadow-sm transition-shadow group">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${fmt.tw}`}>{fmt.label}</span>
                              {listing.skills && (
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${CATEGORY_TW[listing.skills.category || "Other"]}`}>
                                  {listing.skills.name}
                                </span>
                              )}
                            </div>
                            <h4 className="font-fraunces text-base font-black text-stone-900 mb-1 group-hover:text-emerald-700 transition-colors">{listing.title}</h4>
                            <p className="text-xs text-stone-400">{listing.duration} min session</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-fraunces text-xl font-black text-emerald-700">{listing.credit_price} cr</p>
                            <p className="text-xs text-stone-400 mb-2">per session</p>
                            <a href={`/listings/${listing.id}`}
                              className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg no-underline hover:bg-emerald-100 transition-colors">
                              Book →
                            </a>
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
                {badges.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                    <div className="text-5xl mb-3">🏅</div>
                    <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No badges yet</p>
                    <p className="text-sm text-stone-400">@{profile.username} hasn't earned any badges yet.</p>
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

            {/* ── REVIEWS ── */}
            {activeTab === "reviews" && (
              <div>
                {reviews.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                    <div className="text-5xl mb-3">⭐</div>
                    <p className="font-fraunces text-lg font-black text-stone-800 mb-1">No reviews yet</p>
                    <p className="text-sm text-stone-400">@{profile.username} hasn't received any reviews yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Rating summary */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-6 mb-2">
                      <div className="text-center">
                        <p className="font-fraunces text-5xl font-black text-amber-600">{avgRating.toFixed(1)}</p>
                        <StarRating rating={avgRating} />
                        <p className="text-xs text-stone-400 mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex-1">
                        {[5,4,3,2,1].map(star => {
                          const count = reviews.filter(r => Math.round(r.overall) === star).length;
                          const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                          return (
                            <div key={star} className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-stone-400 w-3">{star}</span>
                              <span className="text-xs text-amber-400">★</span>
                              <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-stone-400 w-4">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {reviews.map(review => (
                      <div key={review.id} className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-sm transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-400 to-stone-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                            {getInitials(review.rater?.full_name || "?")}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-stone-800">{review.rater?.full_name}</p>
                            <p className="text-xs text-stone-400">@{review.rater?.username}</p>
                          </div>
                          <div className="text-right">
                            <StarRating rating={review.overall} />
                            <p className="text-[11px] text-stone-300 mt-1">{timeAgo(review.created_at)}</p>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-stone-600 leading-relaxed italic">"{review.comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="flex flex-col gap-4">

            {/* Quick action card */}
            {listings.length > 0 && (
              <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl p-5 text-white">
                <div className="text-2xl mb-2">🎓</div>
                <p className="font-fraunces text-base font-black mb-1">Book a Session</p>
                <p className="text-emerald-200 text-xs leading-relaxed mb-4">
                  Learn directly from <strong>{profile.full_name.split(" ")[0]}</strong> — {listings.length} skill{listings.length !== 1 ? "s" : ""} available
                </p>
                <a href={`/listings?teacher=${profile.id}`}
                  className="block w-full text-center py-2.5 bg-white text-emerald-800 rounded-xl text-sm font-black no-underline hover:bg-emerald-50 transition-colors">
                  View Listings →
                </a>
              </div>
            )}

            {/* Stats card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">About</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">Level</span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${levelTw}`}>⭐ {displayLevel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">XP</span>
                  <span className="text-xs font-bold text-violet-700">⚡ {profile.xp.toLocaleString()}</span>
                </div>
                {avgRating > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">Rating</span>
                    <span className="text-xs font-bold text-amber-600">★ {avgRating.toFixed(1)} / 5.0</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">Sessions</span>
                  <span className="text-xs font-bold text-sky-700">📚 {sessions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">Badges</span>
                  <span className="text-xs font-bold text-rose-600">🏅 {badges.length}</span>
                </div>
                {verifiedSkills.length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-stone-500">Verified Skills</span>
                    <span className="text-xs font-bold text-emerald-700">✅ {verifiedSkills.length}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-stone-500">Member since</span>
                  <span className="text-xs font-bold text-stone-600">{joinDate}</span>
                </div>
              </div>
            </div>

            {/* Verified skills card */}
            {verifiedSkills.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">✅ Verified Skills</p>
                <div className="flex flex-wrap gap-2">
                  {verifiedSkills.map(s => (
                    <span key={s.id} className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${CATEGORY_TW[s.skills?.category || "Other"]}`}>
                      {s.skills?.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Message card */}
            {currentUser && (
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Send a Message</p>
                <p className="text-xs text-stone-500 mb-3">Have a question? Message {profile.full_name.split(" ")[0]} directly.</p>
                <button onClick={sendMessage} disabled={sendingMsg}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold border-0 cursor-pointer hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  💬 {sendingMsg ? "Opening chat..." : "Send Message"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}