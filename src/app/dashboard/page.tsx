"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BadgeProgressCard, getBadgeTier, BadgeChip } from "@/components/BadgeSystem";
import { ReputationCard } from "@/components/ReputationScore";

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
  { icon: "🔍", label: "Browse Skills",    desc: "Find a teacher",    href: "/listings",       color: "bg-emerald-50",  accent: "text-emerald-700",  border: "border-emerald-100" },
  { icon: "🎯", label: "Post Bounty",      desc: "Get help fast",     href: "/bounties",       color: "bg-amber-50",    accent: "text-amber-700",    border: "border-amber-100" },
  { icon: "🎓", label: "Create Listing",   desc: "Start teaching",    href: "/listings/create",color: "bg-violet-50",   accent: "text-violet-700",   border: "border-violet-100" },
  { icon: "💬", label: "Community",        desc: "Join discussions",  href: "/community",      color: "bg-pink-50",     accent: "text-pink-700",     border: "border-pink-100" },
  { icon: "📅", label: "My Sessions",      desc: "Manage bookings",   href: "/sessions",       color: "bg-sky-50",      accent: "text-sky-700",      border: "border-sky-100" },
  { icon: "✉️", label: "Messages",         desc: "Chat with users",   href: "/messages",       color: "bg-rose-50",     accent: "text-rose-700",     border: "border-rose-100" },
  { icon: "✅", label: "Get Verified",     desc: "Earn skill badges", href: "/verify",         color: "bg-green-50",    accent: "text-green-700",    border: "border-green-100" },
  { icon: "🏆", label: "Leaderboard",      desc: "See top users",     href: "/leaderboard",    color: "bg-yellow-50",   accent: "text-yellow-700",   border: "border-yellow-100" },
];

const dailyChallenges = [
  { icon: "📚", text: "Complete a learning session today", credits: 5,  xp: 10, href: "/sessions" },
  { icon: "💬", text: "Answer 2 forum questions",          credits: 3,  xp: 10, href: "/community" },
  { icon: "🎯", text: "Submit a bounty answer",            credits: 3,  xp: 10, href: "/bounties" },
];

const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600,
  Skilled: 1000, Expert: 2000, Master: 4000, Legend: 9999,
};

export default function Dashboard() {
  const [profile, setProfile]             = useState<Profile | null>(null);
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

      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);

      const { count: nCount } = await supabase
        .from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      setUnread(nCount || 0);

      const { count: sCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status", "completed");
      setSessions(sCount || 0);

      const { count: bCount } = await supabase
        .from("bounty_answers").select("*", { count: "exact", head: true })
        .eq("answerer_id", user.id)
        .not("placement", "is", null);
      setBountiesWon(bCount || 0);

      const { data: ratingData } = await supabase
        .from("ratings").select("overall").eq("rated_id", user.id);
      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }

      // Repeat clients — learners who booked more than once
      const { data: sessionData } = await supabase
        .from("sessions").select("learner_id")
        .eq("teacher_id", user.id).eq("status", "completed");
      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => {
          counts[s.learner_id] = (counts[s.learner_id] || 0) + 1;
        });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }

      // Disputes (sessions marked disputed)
      const { count: dCount } = await supabase
        .from("sessions").select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id).eq("status", "disputed");
      setDisputes(dCount || 0);

      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🌱</div>
          <p className="text-stone-400 text-sm font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const badge    = getBadgeTier(profile.xp, sessions, avgRating);
  const initials = profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const xpNext   = XP_TO_NEXT[profile.level] || 100;
  const xpPct    = Math.min((profile.xp / xpNext) * 100, 100);

  return (
    <div className="min-h-screen bg-stone-50 font-sans" onClick={() => setShowMenu(false)}>
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
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([label, href]) => (
            <a key={label} href={href} className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="/wallet" className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1.5 rounded-full no-underline hover:bg-emerald-100 transition-colors">
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" className="relative w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-base no-underline hover:bg-stone-200 transition-colors">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">{unread}</span>
            )}
          </a>
          <div className="relative" onClick={e => { e.stopPropagation(); setShowMenu(p => !p); }}>
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white text-sm font-black flex items-center justify-center cursor-pointer ring-2 ring-emerald-200">{initials}</div>
            {showMenu && (
              <div className="absolute right-0 top-11 bg-white border border-stone-200 rounded-2xl p-2 w-52 shadow-xl z-50">
                <div className="px-3 py-2.5 border-b border-stone-100 mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{initials}</div>
                    <div>
                      <p className="text-sm font-bold text-stone-800 leading-tight">{profile.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-stone-400">@{profile.username}</p>
                        <BadgeChip tier={badge} size="xs" />
                      </div>
                    </div>
                  </div>
                </div>
                {[
                  { icon: "👤", label: "My Profile",     href: "/profile" },
                  { icon: "📋", label: "Create Listing", href: "/listings/create" },
                  { icon: "✅", label: "Get Verified",   href: "/verify" },
                  { icon: "💰", label: "Wallet",         href: "/wallet" },
                  { icon: "🏆", label: "Leaderboard",    href: "/leaderboard" },
                  { icon: "🔔", label: "Notifications",  href: "/notifications" },
                ].map(item => (
                  <a key={item.label} href={item.href} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors no-underline">
                    <span>{item.icon}</span> {item.label}
                  </a>
                ))}
                <div className="border-t border-stone-100 mt-1 pt-1">
                  <button onClick={handleLogout} className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer bg-transparent border-0">
                    🚪 Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* PAGE BODY */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* WELCOME CARD */}
        <div className="bg-white rounded-3xl border border-stone-200 p-7 mb-6 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-600 to-emerald-300 rounded-t-3xl" />
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-50 opacity-60" />
          <div className="absolute -bottom-6 right-20 w-24 h-24 rounded-full bg-emerald-50 opacity-40" />
          <div className="flex items-center justify-between flex-wrap gap-5 relative">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 text-xl font-black flex items-center justify-center flex-shrink-0 ring-4 ring-emerald-50">{initials}</div>
              <div>
                <p className="text-xs text-stone-400 font-medium mb-1">{greeting} {badge.emoji}</p>
                <h1 className="font-fraunces text-2xl font-black text-stone-900 leading-tight mb-1.5">{profile.full_name}</h1>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">@{profile.username}</span>
                  <BadgeChip tier={badge} size="sm" />
                </div>
              </div>
            </div>
            <div className="min-w-[220px]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-stone-400">XP Progress</span>
                <span className="text-xs font-black text-emerald-700">{profile.xp} / {xpNext} XP</span>
              </div>
              <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${xpPct}%` }} />
              </div>
              <p className="text-[11px] text-stone-300 mt-1.5 text-right font-medium">{xpNext - profile.xp} XP to next level</p>
            </div>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { icon: "💰", label: "Credits",      value: profile.credits, color: "text-emerald-700", bg: "bg-emerald-50", href: "/wallet" },
            { icon: "⚡", label: "XP Earned",    value: profile.xp,      color: "text-violet-700",  bg: "bg-violet-50",  href: "/leaderboard" },
            { icon: "📅", label: "Sessions",     value: sessions,         color: "text-sky-700",     bg: "bg-sky-50",     href: "/sessions" },
            { icon: "🏆", label: "Bounties Won", value: bountiesWon,      color: "text-amber-700",   bg: "bg-amber-50",   href: "/bounties" },
          ].map(stat => (
            <a key={stat.label} href={stat.href} className="bg-white rounded-2xl p-5 border border-stone-200 no-underline block hover:-translate-y-0.5 hover:shadow-md transition-all duration-150">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center text-lg`}>{stat.icon}</div>
                <span className="text-xs text-stone-400 font-bold">{stat.label}</span>
              </div>
              <p className={`font-fraunces text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </a>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-[1fr_320px] gap-5">

          {/* LEFT */}
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
              <h2 className="font-fraunces text-lg font-black text-stone-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-4 gap-2.5">
                {quickActions.map(action => (
                  <a key={action.label} href={action.href} className={`${action.color} ${action.border} border rounded-2xl p-4 no-underline block hover:-translate-y-1 hover:shadow-md transition-all duration-150`}>
                    <span className="text-2xl">{action.icon}</span>
                    <p className={`font-black text-sm mt-2 mb-1 ${action.accent}`}>{action.label}</p>
                    <p className="text-[11px] text-stone-400 leading-snug">{action.desc}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-fraunces text-lg font-black text-stone-900">Recent Activity</h2>
                <a href="/notifications" className="text-xs text-emerald-600 font-bold no-underline hover:underline">View all →</a>
              </div>
              <div className="flex items-center gap-3 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100 mb-3">
                <span className="text-2xl">🎁</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-700">Welcome bonus credited</p>
                  <p className="text-xs text-stone-400">20 credits added to your wallet</p>
                </div>
                <span className="text-xs text-stone-300 whitespace-nowrap">Just now</span>
              </div>
              <div className="text-center py-4">
                <p className="text-stone-300 text-sm mb-3">Complete activities to see more here!</p>
                <a href="/listings" className="inline-block px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold no-underline hover:bg-emerald-700 transition-colors">Browse Skills →</a>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-5">

            <BadgeProgressCard xp={profile.xp} sessions={sessions} avgRating={avgRating} />

            <ReputationCard data={{ avgRating, completedSessions: sessions, repeatClients, disputes }} />

            <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-fraunces text-base font-black text-stone-900">Daily Challenges 🎯</h2>
                <span className="text-[10px] text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full font-bold">Resets midnight</span>
              </div>
              <div className="flex flex-col gap-2">
                {dailyChallenges.map((c, i) => (
                  <a key={i} href={c.href} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 no-underline hover:border-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer group">
                    <span className="text-xl flex-shrink-0">{c.icon}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-stone-700 group-hover:text-emerald-700 transition-colors leading-snug">{c.text}</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">+{c.credits} cr · +{c.xp} XP</p>
                    </div>
                    <span className="text-stone-300 text-sm group-hover:text-emerald-400 transition-colors">›</span>
                  </a>
                ))}
              </div>
            </div>

            <a href="/wallet" className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-2xl p-6 text-white no-underline block relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute -top-5 -right-5 w-28 h-28 rounded-full bg-white opacity-5" />
              <div className="absolute -bottom-8 right-4 w-36 h-36 rounded-full bg-white opacity-[0.03]" />
              <p className="text-xs font-bold opacity-60 mb-1 relative">YOUR WALLET</p>
              <p className="font-fraunces text-5xl font-black relative leading-none mb-1">{profile.credits}</p>
              <p className="text-sm opacity-60 mb-5 relative">credits · ₱{profile.credits * 10} value</p>
              <div className="flex gap-2 relative">
                <div className="flex-1 bg-white text-emerald-700 text-center py-2.5 rounded-xl text-xs font-black">+ Top Up</div>
                <div className="flex-1 bg-white/10 text-white text-center py-2.5 rounded-xl text-xs font-bold border border-white/20">History</div>
              </div>
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}