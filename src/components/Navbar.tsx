"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string;
  credits: number; xp: number; level: string; avatar_url?: string | null;
};

export default function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unread, setUnread] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile(p);
      const { count } = await supabase.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("is_read", false);
      setUnread(count || 0);
    };
    load();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  const navLinks = [
    { label: "Browse",    href: "/listings"  },
    { label: "Bounties",  href: "/bounties"  },
    { label: "Community", href: "/community" },
    { label: "Sessions",  href: "/sessions"  },
    { label: "Messages",  href: "/messages"  },
    { label: "People",    href: "/people"    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

        @keyframes navDropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bellRing {
          0%, 100% { transform: rotate(0deg); }
          20%      { transform: rotate(-12deg); }
          40%      { transform: rotate(10deg); }
          60%      { transform: rotate(-8deg); }
          80%      { transform: rotate(4deg); }
        }

        .sc-navbar { transition: height .25s ease, box-shadow .25s ease, background .25s ease; }

        .navlink{
          position:relative; padding:6px 12px; border-radius:8px;
          font-size:13px; font-weight:600; color:#666;
          text-decoration:none; display:inline-block;
          transition: color .18s ease, background .18s ease;
        }
        .navlink::after{
          content:""; position:absolute; left:12px; right:12px; bottom:2px;
          height:2px; border-radius:2px; background:#2d6a4f;
          transform:scaleX(0); transform-origin:center;
          transition: transform .2s ease;
        }
        .navlink:hover{ color:#1a1a1a; background:#f5f2eb; }
        .navlink:hover::after{ transform:scaleX(1); }
        .navlink.active{ background:#e8f4e8; color:#2d6a4f; }
        .navlink.active::after{ transform:scaleX(0); }

        .sc-create-btn{
          transition: transform .15s ease, box-shadow .2s ease, background .2s ease;
        }
        .sc-create-btn:hover{
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(45,106,79,.28);
          background:#256044;
        }
        .sc-create-btn:active{ transform: translateY(0) scale(.97); }

        .sc-credits{ transition: background .18s ease, transform .15s ease; }
        .sc-credits:hover{ background:#dcf0df; transform: translateY(-1px); }

        .sc-bell{ transition: background .18s ease, transform .15s ease; }
        .sc-bell:hover{ background:#eee8db; }
        .sc-bell:hover .sc-bell-icon{ animation: bellRing .5s ease; }

        .sc-avatar{ transition: transform .18s ease, box-shadow .18s ease; cursor:pointer; }
        .sc-avatar:hover{ transform: scale(1.06); box-shadow: 0 0 0 3px #e8f4e8; }

        .sc-dropdown{
          animation: navDropdownIn .16s ease both;
          transform-origin: top right;
        }

        .nav-menu-item{
          display:flex; align-items:center; gap:10px; padding:9px 14px;
          border-radius:10px; font-size:13px; font-weight:600; color:#444;
          text-decoration:none; transition: background .14s ease, padding-left .14s ease;
        }
        .nav-menu-item:hover{ background:#f5f0e8; padding-left:18px; }
      `}</style>

      <nav
        className="sc-navbar"
        onClick={() => setShowMenu(false)}
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: scrolled ? "rgba(255,255,255,.98)" : "rgba(255,255,255,.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e8e2d9",
          boxShadow: scrolled ? "0 2px 12px rgba(0,0,0,.05)" : "none",
          padding: "0 28px",
          height: scrolled ? 50 : 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >

        {/* LOGO */}
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 20, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: 20, color: "#1a1a1a" }}>Credit</span>
        </a>

        {/* NAV LINKS */}
        <div style={{ display: "flex", gap: 2 }}>
          {navLinks.map(({ label, href }) => (
            <a key={label} href={href} className={`navlink${pathname === href ? " active" : ""}`}>{label}</a>
          ))}
        </div>

        {/* RIGHT SIDE */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Create button */}
          <a href="/listings/create" className="sc-create-btn" style={{
            fontSize: 13, fontWeight: 700, color: "#fff", background: "#2d6a4f",
            padding: "7px 16px", borderRadius: 999, textDecoration: "none",
            border: "none", display: "inline-block",
          }}>+ Create</a>

          {/* Credits */}
          <a href="/wallet" className="sc-credits" style={{
            fontSize: 13, fontWeight: 800, color: "#2d6a4f", background: "#e8f4e8",
            padding: "6px 14px", borderRadius: 999, border: "1px solid #b7e4c7",
            textDecoration: "none", display: "inline-block",
          }}>💰 {profile?.credits ?? "—"} cr</a>

          {/* Bell */}
          <a href="/notifications" className="sc-bell" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "#f5f0e8" }}>
            <span className="sc-bell-icon" style={{ fontSize: 16, display: "inline-block" }}>🔔</span>
            {unread > 0 && (
              <span style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid white" }}>{unread}</span>
            )}
          </a>

          {/* Avatar + dropdown */}
          <div style={{ position: "relative" }} onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}>
            <div className="sc-avatar" style={{
              width: 36, height: 36, borderRadius: "50%", overflow: "hidden",
              border: "2px solid #2d6a4f",
              background: profile?.avatar_url ? "transparent" : "#2d6a4f",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>{initials}</span>
              }
            </div>

            {showMenu && (
              <div className="sc-dropdown" style={{
                position: "absolute", right: 0, top: 44, background: "#fff",
                border: "1px solid #e8e2d9", borderRadius: 16, padding: "8px",
                width: 220, boxShadow: "0 8px 32px rgba(0,0,0,.12)", zIndex: 200,
              }}>
                {/* User info */}
                <div style={{ padding: "10px 14px 10px", borderBottom: "1px solid #f0ece4", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", background: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>{initials}</span>
                      }
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: 0 }}>{profile?.full_name}</p>
                      <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>@{profile?.username}</p>
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
                  <a key={item.label} href={item.href} className="nav-menu-item">
                    <span>{item.icon}</span>{item.label}
                  </a>
                ))}

                <div style={{ borderTop: "1px solid #f0ece4", marginTop: 4, paddingTop: 4 }}>
                  <button onClick={handleLogout} className="nav-menu-item" style={{
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    color: "#dc2626", fontFamily: "'DM Sans', sans-serif", textAlign: "left",
                  }}>
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
