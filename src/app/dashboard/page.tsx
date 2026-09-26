"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";
import { CORE_NOTIFICATION_TYPES } from "@/lib/notification-types";

type Profile = {
  id: string; full_name: string; username: string; credits: number;
  avatar_url?: string;
};
type Activity = { id: string; type: string; title: string; body: string; created_at: string; is_read: boolean; link?: string };

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTIVITY_CFG: Record<string, { icon: string; bg: string }> = {
  session: { icon: "📅", bg: "#e0f2fe" },
  message: { icon: "💬", bg: "#f5f3ff" },
  credit: { icon: "💰", bg: "#f0fdf4" },
  achievement: { icon: "🎉", bg: "#fffbeb" },
  platform: { icon: "📢", bg: "#f1f5f9" },
  review: { icon: "⭐", bg: "#fffbeb" },
  dispute: { icon: "⚠️", bg: "#fee2e2" },
};

const QUICK_ACTIONS = [
  { icon: "🔍", label: "Browse Skills", desc: "Find a teacher in seconds", href: "/listings" },
  { icon: "🎓", label: "Start Teaching", desc: "Create your first listing", href: "/listings/create" },
];
const SECONDARY_ACTIONS = [
  { icon: "📅", label: "Sessions", href: "/sessions" },
  { icon: "✉️", label: "Messages", href: "/messages" },
  { icon: "💰", label: "Wallet", href: "/wallet" },
  { icon: "👤", label: "Profile", href: "/profile" },
];

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good day");
  const [greetingEmoji, setGreetingEmoji] = useState("☀️");
  const [unread, setUnread] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [pendingSessions, setPendingSessions] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) { setGreeting("Good morning"); setGreetingEmoji("☀️"); }
    else if (h < 18) { setGreeting("Good afternoon"); setGreetingEmoji("⛅"); }
    else { setGreeting("Good evening"); setGreetingEmoji("🌙"); }

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: p } = await supabase.from("profiles").select("id,full_name,username,credits,avatar_url").eq("id", user.id).single();
      if (p) setProfile(p);

      const { count: nCount } = await supabase.from("notifications")
        .select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false).in("type", CORE_NOTIFICATION_TYPES as unknown as string[]);
      setUnread(nCount || 0);

      const { data: acts } = await supabase.from("notifications").select("*")
        .eq("user_id", user.id).in("type", CORE_NOTIFICATION_TYPES as unknown as string[]).order("created_at", { ascending: false }).limit(8);
      setActivities((acts as Activity[]) || []);

      const { count: sCount } = await supabase.from("sessions")
        .select("*", { count: "exact", head: true })
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status", "completed");
      setSessions(sCount || 0);

      const { count: pendingCount } = await supabase.from("sessions")
        .select("*", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "pending");
      setPendingSessions(pendingCount || 0);

      const { data: ratingData } = await supabase.from("ratings")
        .select("overall").eq("rated_id", user.id).eq("is_flagged", false);
      if (ratingData && ratingData.length > 0) {
        setAvgRating(parseFloat(bayesianAvg(ratingData.map((r: any) => r.overall)).toFixed(2)));
        setRatingCount(ratingData.length);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 1.5s ease infinite" }}>🌱</div>
        <p style={{ color: "#98A2B3", fontSize: 14 }}>Loading your dashboard…</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const initials = profile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const firstName = profile.full_name.split(" ")[0];
  const ratingDisplay = avgRating !== null ? avgRating.toFixed(2) : "—";
  const ratingSubLabel = avgRating !== null ? `${ratingCount} review${ratingCount !== 1 ? "s" : ""}` : "No ratings yet";

  return (
    <div style={{ minHeight: "100vh", background: "#F7F4EF", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .card{background:#fff;border-radius:20px;border:1px solid #EAECF0;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.025)}
        .card-lift{transition:transform .18s,box-shadow .18s}
        .card-lift:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.09)!important}
        .action-card{transition:all .18s cubic-bezier(.34,1.2,.64,1);cursor:pointer;border-radius:16px;border:1px solid #EAECF0;padding:20px;display:flex;flex-direction:column;gap:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .action-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.1)!important;border-color:#BBF7D0}
        .secondary-card{transition:all .15s;cursor:pointer;border-radius:12px;border:1px solid #EAECF0;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;background:#fff;text-align:center}
        .secondary-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.07);border-color:#BBF7D0}
        .stat-cell{border-radius:14px;background:#F9FAFB;text-align:center;padding:12px 8px;transition:background .12s,transform .12s;display:block}
        .stat-cell:hover{background:#F2F4F7;transform:translateY(-2px)}
        .activity-row{border-radius:12px;transition:background .12s}
        .activity-row:hover{background:#F8F9FB}
        @media(max-width:960px){.main-grid{grid-template-columns:1fr!important}.sidebar{display:none!important}}
        @media(max-width:600px){.actions-3{grid-template-columns:1fr!important}}
      `}</style>

      <Navbar />

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}>

        {/* PENDING */}
        {pendingSessions > 0 && (
          <a href="/sessions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, padding: "12px 18px", marginBottom: 16, gap: 12, animation: "fadeUp .3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>⏳</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{pendingSessions} pending session request{pendingSessions > 1 ? "s" : ""} awaiting your response</span>
            </div>
            <div style={{ background: "#f59e0b", color: "#fff", padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" as const }}>Review →</div>
          </a>
        )}

        {/* HERO CARD */}
        <div className="card" style={{ padding: "26px 28px 22px", marginBottom: 14, animation: "fadeUp .4s ease", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#16a34a,#16a34a44)", borderRadius: "20px 20px 0 0" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", background: profile.avatar_url ? "transparent" : "linear-gradient(135deg,#16a34a,#16a34a88)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 6px 20px rgba(22,163,74,.2)" }}>
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{initials}</span>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#98A2B3", fontWeight: 600, marginBottom: 2 }}>{greeting}, {firstName} {greetingEmoji}</div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, color: "#101828", lineHeight: 1.15, marginBottom: 6 }}>{profile.full_name}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#98A2B3" }}>@{profile.username}</span>
                {avgRating !== null && <><span style={{ fontSize: 10, color: "#D0D5DD" }}>·</span><span style={{ fontSize: 11, fontWeight: 600, color: "#B45309" }}>⭐ {avgRating.toFixed(2)}</span></>}
              </div>
            </div>
          </div>

          {/* Inline stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid #F2F4F7" }}>
            {[
              { icon: "💰", label: "Credits", value: String(profile.credits), sub: "in wallet", href: "/wallet" },
              { icon: "📅", label: "Sessions", value: String(sessions), sub: "completed", href: "/sessions" },
              { icon: "⭐", label: "Rating", value: ratingDisplay, sub: ratingSubLabel, href: "/profile" },
            ].map(s => (
              <a key={s.label} href={s.href} className="stat-cell">
                <div style={{ fontSize: 17, marginBottom: 5 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#101828", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#98A2B3", fontWeight: 600, marginTop: 3, textTransform: "uppercase" as const, letterSpacing: ".04em" }}>{s.label}</div>
                <div style={{ fontSize: 10, color: "#C4C9D4", marginTop: 1 }}>{s.sub}</div>
              </a>
            ))}
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 292px", gap: 14, animation: "fadeUp .4s .1s ease both" }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>

            {/* QUICK ACTIONS */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: "#101828", marginBottom: 16 }}>What's Next</h2>
              <div className="actions-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                {QUICK_ACTIONS.map(a => (
                  <a key={a.label} href={a.href} className="action-card">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{a.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#101828", marginTop: 2 }}>{a.label}</div>
                    <div style={{ fontSize: 12, color: "#667085", lineHeight: 1.4 }}>{a.desc}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginTop: 2 }}>Get started →</div>
                  </a>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #F2F4F7", paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: "#C4C9D4", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", marginBottom: 10 }}>More</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7 }}>
                  {SECONDARY_ACTIONS.map(a => (
                    <a key={a.label} href={a.href} className="secondary-card">
                      <span style={{ fontSize: 17 }}>{a.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#344054" }}>{a.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTIVITY */}
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: "#101828" }}>Recent Activity</h2>
                  {unread > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#F0FDF4", color: "#16a34a", border: "1px solid #BBF7D0" }}>{unread} new</span>}
                </div>
                <a href="/notifications" style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>View all →</a>
              </div>
              {activities.length === 0 ? (
                <div style={{ textAlign: "center" as const, padding: "32px 0" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
                  <p style={{ fontSize: 13, color: "#98A2B3", marginBottom: 16 }}>No activity yet — complete a session to get started!</p>
                  <a href="/listings" style={{ display: "inline-block", padding: "9px 22px", background: "#16a34a", color: "#fff", borderRadius: 999, fontSize: 13, fontWeight: 700 }}>Browse Skills →</a>
                </div>
              ) : activities.map((act, idx) => {
                const cfg = ACTIVITY_CFG[act.type] || { icon: "📌", bg: "#F1F5F9" };
                const cleanBody = act.body && !act.body.trim().startsWith("{") && act.body.length < 120 ? act.body : "";
                return (
                  <div key={act.id} className="activity-row"
                    style={{ display: "flex", gap: 12, padding: "13px 10px", borderBottom: idx < activities.length - 1 ? "1px solid #F9FAFB" : "none", alignItems: "flex-start" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, position: "relative" as const }}>
                      {cfg.icon}
                      {!act.is_read && <div style={{ position: "absolute" as const, top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#16a34a", border: "1.5px solid #fff" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                        <div style={{ fontSize: 13, fontWeight: act.is_read ? 600 : 700, color: "#101828", lineHeight: 1.35 }}>{act.title}</div>
                        <span style={{ fontSize: 10, color: "#C4C9D4", fontWeight: 600, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{timeAgo(act.created_at)}</span>
                      </div>
                      {cleanBody && <div style={{ fontSize: 12, color: "#667085", lineHeight: 1.5 }}>{cleanBody}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="sidebar" style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>

            {/* WALLET */}
            <a href="/wallet" className="card-lift" style={{ display: "block", background: "linear-gradient(135deg,#14532d,#16a34a 55%,#22c55e)", borderRadius: 20, padding: "20px", color: "#fff", position: "relative" as const, overflow: "hidden", boxShadow: "0 6px 22px rgba(22,163,74,.27)", transition: "all .18s" }}>
              <div style={{ position: "absolute" as const, top: -24, right: -24, width: 88, height: 88, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />
              <p style={{ fontSize: 10, fontWeight: 700, opacity: .55, marginBottom: 3, letterSpacing: ".1em", textTransform: "uppercase" as const }}>💰 Your Wallet</p>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: 38, fontWeight: 900, lineHeight: 1, marginBottom: 2 }}>{profile.credits}</p>
              <p style={{ fontSize: 12, opacity: .55, marginBottom: 16 }}>credits</p>
              <div style={{ background: "rgba(255,255,255,.95)", color: "#16a34a", textAlign: "center" as const, padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 800 }}>View Wallet →</div>
            </a>

            {/* PROFILE SUMMARY */}
            <div className="card" style={{ padding: "18px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 12 }}>Your Snapshot</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#667085" }}>📅 Sessions completed</span>
                  <span style={{ fontWeight: 700, color: "#101828" }}>{sessions}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#667085" }}>⭐ Average rating</span>
                  <span style={{ fontWeight: 700, color: "#101828" }}>{ratingDisplay}{avgRating !== null && ` (${ratingCount})`}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "#667085" }}>💰 Credit balance</span>
                  <span style={{ fontWeight: 700, color: "#101828" }}>{profile.credits}</span>
                </div>
              </div>
              <a href="/profile" style={{ display: "block", marginTop: 14, textAlign: "center" as const, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>View full profile →</a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
