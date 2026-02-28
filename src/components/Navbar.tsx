"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getBadgeTier, BadgeChip } from "@/components/BadgeSystem";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  xp: number;
  level: string;
};

// Pass the current page label to highlight the active nav link
// e.g. <Navbar activePage="Browse" />
export default function Navbar({ activePage }: { activePage?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unread, setUnread]   = useState(0);
  const [sessions, setSessions] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();
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

      const { data: ratingData } = await supabase
        .from("ratings").select("overall").eq("rated_id", user.id);
      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setAvgRating(parseFloat(avg.toFixed(1)));
      }
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const badge    = profile ? getBadgeTier(profile.xp, sessions, avgRating) : null;

  const navLinks = [
    { label: "Browse",    href: "/listings" },
    { label: "Bounties",  href: "/bounties" },
    { label: "Community", href: "/community" },
    { label: "Sessions",  href: "/sessions" },
    { label: "Messages",  href: "/messages" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
      `}</style>

      <nav
        className="bg-white border-b border-stone-200 sticky top-0 z-50 px-8 h-14 flex items-center justify-between font-sans"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        onClick={() => setShowMenu(false)}
      >
        {/* LOGO */}
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>

        {/* NAV LINKS */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ label, href }) => {
            const isActive = activePage === label;
            return (
              <a
                key={label}
                href={href}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors no-underline"
                style={{
                  background: isActive ? "#ecfdf5" : "transparent",
                  color: isActive ? "#059669" : "#78716c",
                  border: isActive ? "1px solid #a7f3d0" : "1px solid transparent",
                }}
              >
                {label}
              </a>
            );
          })}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">
          {/* Credits */}
          <a
            href="/wallet"
            className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1.5 rounded-full no-underline hover:bg-emerald-100 transition-colors"
          >
            💰 {profile?.credits ?? "—"} cr
          </a>

          {/* Notifications bell */}
          <a
            href="/notifications"
            className="relative w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-base no-underline hover:bg-stone-200 transition-colors"
          >
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {unread}
              </span>
            )}
          </a>

          {/* Avatar + dropdown */}
          <div
            className="relative"
            onClick={e => { e.stopPropagation(); setShowMenu(p => !p); }}
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white text-sm font-black flex items-center justify-center cursor-pointer ring-2 ring-emerald-200">
              {initials}
            </div>

            {showMenu && (
              <div className="absolute right-0 top-11 bg-white border border-stone-200 rounded-2xl p-2 w-52 shadow-xl z-50">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-stone-100 mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800 leading-tight">{profile?.full_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-stone-400">@{profile?.username}</p>
                        {badge && <BadgeChip tier={badge} size="xs" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                {[
                  { icon: "👤", label: "My Profile",     href: "/profile" },
                  { icon: "📋", label: "Create Listing", href: "/listings/create" },
                  { icon: "✅", label: "Get Verified",   href: "/verify" },
                  { icon: "💰", label: "Wallet",         href: "/wallet" },
                  { icon: "🏆", label: "Leaderboard",    href: "/leaderboard" },
                  { icon: "🔔", label: "Notifications",  href: "/notifications" },
                ].map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-stone-700 text-sm font-semibold hover:bg-stone-50 transition-colors no-underline"
                  >
                    <span>{item.icon}</span> {item.label}
                  </a>
                ))}

                <div className="border-t border-stone-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors cursor-pointer bg-transparent border-0"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    🚪 Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}