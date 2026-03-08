"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
  avatar_url?: string | null;
};

type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
};

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string; label: string }> = {
  session:      { icon: "📅", color: "#1d4ed8", bg: "#eff6ff",  border: "#bfdbfe", label: "Session" },
  session_call: { icon: "📹", color: "#1d4ed8", bg: "#eff6ff",  border: "#bfdbfe", label: "Session" },
  credit:       { icon: "💰", color: "#166534", bg: "#f0fdf4",  border: "#bbf7d0", label: "Credits" },
  message:      { icon: "💬", color: "#7c3aed", bg: "#faf5ff",  border: "#e9d5ff", label: "Message" },
  dispute:      { icon: "⚠️", color: "#b45309", bg: "#fffbeb",  border: "#fde68a", label: "Dispute" },
  achievement:  { icon: "🏆", color: "#d97706", bg: "#fffbeb",  border: "#fde68a", label: "Badge" },
  platform:     { icon: "📢", color: "#555",    bg: "#f5f0e8",  border: "#e8e2d9", label: "Platform" },
  forum_earn:   { icon: "⭐", color: "#166534", bg: "#f0fdf4",  border: "#bbf7d0", label: "Earned" },
  rating:       { icon: "⭐", color: "#d97706", bg: "#fffbeb",  border: "#fde68a", label: "Review" },
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

// Full human-readable timeAgo
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 120)    return "1 minute ago";
  if (diff < 3600)   return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200)   return "1 hour ago";
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

// Safely parse JSON body from notifications that accidentally stored raw JSON
function parseBody(type: string, body: string): string {
  if (!body) return "";
  // Try to detect JSON blob
  if (body.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(body);
      // credit_transfer style
      if (parsed.amount !== undefined && parsed.from_id) {
        return `${parsed.amount} credits were transferred`;
      }
      // message style — extract plain text
      if (parsed.content) return parsed.content;
      // fallback: just return something readable
      return Object.entries(parsed)
        .filter(([k]) => !k.endsWith("_id") && k !== "type")
        .map(([k, v]) => `${v}`)
        .join(" · ");
    } catch { /* not JSON */ }
  }
  return body;
}

// Quick actions per notification type
function getQuickActions(notif: Notification): { label: string; href: string; style: "primary" | "secondary" }[] {
  const type = notif.type;
  if (type === "message") return [
    { label: "💬 Reply", href: "/messages", style: "primary" },
  ];
  if (type === "session" && notif.title?.toLowerCase().includes("complet")) return [
    { label: "⭐ Rate Now", href: notif.link || "/sessions", style: "primary" },
    { label: "View Session", href: "/sessions", style: "secondary" },
  ];
  if (type === "session" && (notif.title?.toLowerCase().includes("book") || notif.title?.toLowerCase().includes("request"))) return [
    { label: "✓ Manage", href: "/sessions", style: "primary" },
  ];
  if (type === "credit" || type === "forum_earn") return [
    { label: "View Credits", href: "/profile", style: "secondary" },
  ];
  if (type === "achievement") return [
    { label: "🏆 View Badge", href: "/profile", style: "primary" },
  ];
  if (type === "dispute") return [
    { label: "⚠️ View Dispute", href: notif.link || "/sessions", style: "primary" },
  ];
  if (notif.link) return [{ label: "View →", href: notif.link, style: "secondary" }];
  return [];
}

function groupByDate(notifications: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = [];
  let currentLabel = "";
  notifications.forEach(n => {
    const d = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    let label = d.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
    if (d.toDateString() === today.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    if (label !== currentLabel) { currentLabel = label; groups.push({ label, items: [] }); }
    groups[groups.length - 1].items.push(n);
  });
  return groups;
}

// Minimal avatar component
function NotifAvatar({ profile, size = 38 }: { profile: Profile | null; size?: number }) {
  const level = profile?.level || "Seedling";
  const color = LEVEL_COLORS[level] || "#2d6a4f";
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, color: "#fff", flexShrink: 0, letterSpacing: -0.5 }}>
      {getInitials(profile?.full_name || "?")}
    </div>
  );
}

export default function NotificationsPage() {
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [senderMap, setSenderMap]     = useState<Record<string, Profile>>({});
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("all");
  const [markingAll, setMarkingAll]   = useState(false);
  const [newToast, setNewToast]       = useState<Notification | null>(null);
  const [undoBuf, setUndoBuf]         = useState<Notification[] | null>(null);
  const toastTimeout  = useRef<any>(null);
  const undoTimeout   = useRef<any>(null);

  useEffect(() => { loadData(); }, []);

  // Real-time
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`notifs-${profile.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, (payload) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev]);
        setNewToast(n);
        clearTimeout(toastTimeout.current);
        toastTimeout.current = setTimeout(() => setNewToast(null), 4500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(prof);
    const { data: notifs } = await supabase
      .from("notifications").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = notifs || [];
    setNotifications(list);

    // Try to load sender avatars by extracting usernames/ids from notification titles
    // Fetch all profiles to map to senders (lightweight — just id, name, avatar, level)
    const { data: allProfiles } = await supabase.from("profiles").select("id,full_name,username,level,avatar_url,credits").limit(50);
    if (allProfiles) {
      const map: Record<string, Profile> = {};
      allProfiles.forEach((p: Profile) => { map[p.id] = p; map[p.username] = p; map[p.full_name] = p; });
      setSenderMap(map);
    }
    setLoading(false);
  }

  // Extract likely sender from notification title
  function getSender(notif: Notification): Profile | null {
    // Try to match a name from senderMap against the notification title
    for (const key of Object.keys(senderMap)) {
      if (notif.title?.includes(senderMap[key].full_name) || notif.body?.includes(senderMap[key].full_name)) {
        const p = senderMap[key];
        if (p.id !== profile?.id) return p;
      }
    }
    return null;
  }

  async function markAsRead(notif: Notification) {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.link) window.location.href = notif.link;
  }

  async function markAllRead() {
    if (!profile) return;
    setMarkingAll(true);
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  }

  async function deleteNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  async function clearAll() {
    if (!profile) return;
    // Save for undo
    setUndoBuf(notifications);
    setNotifications([]);
    clearTimeout(undoTimeout.current);
    undoTimeout.current = setTimeout(async () => {
      setUndoBuf(null);
      await supabase.from("notifications").delete().eq("user_id", profile.id);
    }, 5000);
  }

  async function undoClear() {
    clearTimeout(undoTimeout.current);
    if (undoBuf) setNotifications(undoBuf);
    setUndoBuf(null);
  }

  const filtered = filter === "all" ? notifications
    : filter === "unread" ? notifications.filter(n => !n.is_read)
    : notifications.filter(n => n.type === filter || (filter === "session" && n.type === "session_call"));

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const grouped = groupByDate(filtered);

  const filters = [
    { key: "all",         label: "All",      count: notifications.length },
    { key: "unread",      label: "Unread",   count: unreadCount },
    { key: "session",     label: "Sessions", count: notifications.filter(n => n.type === "session" || n.type === "session_call").length },
    { key: "credit",      label: "Credits",  count: notifications.filter(n => n.type === "credit" || n.type === "forum_earn").length },
    { key: "message",     label: "Messages", count: notifications.filter(n => n.type === "message").length },
    { key: "achievement", label: "Badges",   count: notifications.filter(n => n.type === "achievement").length },
    { key: "dispute",     label: "Disputes", count: notifications.filter(n => n.type === "dispute").length },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "2.5px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#aaa", fontSize: 13 }}>Loading notifications...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes slideIn { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:none} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .notif-row { transition: background 0.12s; cursor: pointer; position: relative; }
        .notif-row:hover { background: #f7f4f0 !important; }
        .del-btn { opacity: 0; transition: opacity 0.12s; }
        .notif-row:hover .del-btn { opacity: 1; }
        .filter-btn { transition: all 0.12s; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; }
        .filter-btn:hover { opacity: 0.82; }
        .nav-link { padding: 6px 12px; border-radius: 8px; color: #555; font-size: 13px; font-weight: 600; transition: background 0.12s; }
        .nav-link:hover { background: #f5f0e8; color: #333; }
        .qa-btn { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 7px; border: none; cursor: pointer; transition: all 0.12s; white-space: nowrap; }
        .qa-btn:hover { opacity: 0.85; }
        .qa-btn-primary { background: #2d6a4f; color: #fff; }
        .qa-btn-secondary { background: #f5f0e8; color: #555; border: 1.5px solid #e8e2d9 !important; }
      `}</style>

      {/* LIVE TOAST */}
      {newToast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 1000, animation: "slideIn 0.3s ease", maxWidth: 320 }}>
          <div style={{ background: "#fff", border: "1.5px solid #e8e2d9", borderRadius: 14, padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_CONFIG[newToast.type]?.icon || "🔔"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{newToast.title}</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>{parseBody(newToast.type, newToast.body)}</div>
            </div>
            <button onClick={() => setNewToast(null)} style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}

      {/* UNDO CLEAR TOAST */}
      {undoBuf !== null && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, animation: "slideUp 0.2s ease" }}>
          <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>All notifications deleted</span>
            <button onClick={undoClear} style={{ background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              Undo
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([l, h]) => (
            <a key={l} href={h} className="nav-link">{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
            {getInitials(profile?.full_name || "")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, animation: "fadeUp 0.35s ease" }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 10 }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ fontSize: 13, fontWeight: 700, background: "#dc2626", color: "#fff", padding: "3px 10px", borderRadius: 999, animation: "pulse 2s infinite" }}>
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p style={{ color: "#aaa", marginTop: 5, fontSize: 13 }}>Sessions, credits, messages & more — all in one place.</p>
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} disabled={markingAll}
                style={{ padding: "8px 15px", borderRadius: 9, background: "#e8f4e8", color: "#2d6a4f", fontSize: 12, fontWeight: 700, border: "1.5px solid #c6e8d4", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {markingAll ? "..." : "✓ Mark all as read"}
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll}
                style={{ padding: "8px 14px", borderRadius: 9, background: "#fff", color: "#aaa", fontSize: 12, fontWeight: 600, border: "1.5px solid #e8e2d9", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                🗑 Delete all
              </button>
            )}
          </div>
        </div>

        {/* STATS */}
        {notifications.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18, animation: "fadeUp 0.35s 0.05s ease both" }}>
            {[
              { label: "Total",    val: notifications.length,                                             color: "#555",    bg: "#fff" },
              { label: "Unread",   val: unreadCount,                                                      color: "#dc2626", bg: "#fef2f2" },
              { label: "Sessions", val: notifications.filter(n => n.type === "session").length,            color: "#1d4ed8", bg: "#eff6ff" },
              { label: "Credits",  val: notifications.filter(n => n.type === "credit" || n.type === "forum_earn").length, color: "#166534", bg: "#f0fdf4" },
              { label: "Messages", val: notifications.filter(n => n.type === "message").length,            color: "#7c3aed", bg: "#faf5ff" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: "10px 0", border: "1.5px solid #e8e2d9", textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, marginTop: 3, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* FILTER PILLS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", animation: "fadeUp 0.35s 0.1s ease both" }}>
          {filters.map(f => (
            <button key={f.key} className="filter-btn" onClick={() => setFilter(f.key)}
              style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: filter === f.key ? "#2d6a4f" : "#fff",
                color: filter === f.key ? "#fff" : "#666",
                border: `1.5px solid ${filter === f.key ? "#2d6a4f" : "#e8e2d9"}`,
                display: "flex", alignItems: "center", gap: 5 }}>
              {f.label}
              {f.count > 0 && (
                <span style={{ fontSize: 10, background: filter === f.key ? "rgba(255,255,255,0.25)" : "#f0ece4", color: filter === f.key ? "#fff" : "#999", padding: "1px 5px", borderRadius: 999 }}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* EMPTY STATE */}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", animation: "fadeUp 0.35s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{filter === "unread" ? "🎉" : "🔔"}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
              {filter === "unread" ? "You're all caught up!" : "Nothing here yet"}
            </div>
            <p style={{ color: "#aaa", fontSize: 13, lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
              {filter === "unread"
                ? "No unread notifications. Great job staying on top of things!"
                : "Notifications appear here when sessions are booked, credits move, messages arrive, and more."}
            </p>
          </div>
        )}

        {/* NOTIFICATION GROUPS */}
        {grouped.map(({ label, items }, gi) => (
          <div key={label} style={{ marginBottom: 28, animation: `fadeUp 0.35s ${gi * 0.04 + 0.12}s ease both` }}>

            {/* Sticky date header */}
            <div style={{ position: "sticky", top: 64, zIndex: 10, display: "flex", alignItems: "center", gap: 10, marginBottom: 8, background: "#faf8f4", padding: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#ede8de" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#bbb", letterSpacing: "0.08em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{label}</span>
              <div style={{ flex: 1, height: 1, background: "#ede8de" }} />
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", overflow: "hidden" }}>
              {items.map((notif, i) => {
                const cfg     = TYPE_CONFIG[notif.type] || TYPE_CONFIG.platform;
                const sender  = getSender(notif);
                const actions = getQuickActions(notif);
                const cleanBody = parseBody(notif.type, notif.body);

                return (
                  <div key={notif.id} className="notif-row" onClick={() => markAsRead(notif)}
                    style={{ padding: "14px 18px", borderBottom: i < items.length - 1 ? "1px solid #f5f0e8" : "none", display: "flex", gap: 12, alignItems: "flex-start", background: notif.is_read ? "#fff" : "#fafdfb", borderLeft: notif.is_read ? "none" : "3px solid #2d6a4f" }}>

                    {/* Avatar or icon */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {sender ? (
                        <NotifAvatar profile={sender} size={40} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>
                          {cfg.icon}
                        </div>
                      )}
                      {/* Type badge on avatar */}
                      {sender && (
                        <div style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%", background: cfg.bg, border: `1.5px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                          {cfg.icon}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: notif.is_read ? 500 : 700, color: "#1a1a1a", lineHeight: 1.3 }}>
                          {notif.title}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: "#bbb", whiteSpace: "nowrap" as const }}>{timeAgo(notif.created_at)}</span>
                          <button className="del-btn" onClick={e => deleteNotif(notif.id, e)}
                            style={{ width: 20, height: 20, borderRadius: "50%", background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Clean body — no raw JSON */}
                      {cleanBody && (
                        <p style={{ fontSize: 12, color: "#777", lineHeight: 1.5, marginBottom: actions.length > 0 ? 8 : 4 }}>{cleanBody}</p>
                      )}

                      {/* Quick actions + type badge */}
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {cfg.label}
                        </span>
                        {!notif.is_read && (
                          <span style={{ fontSize: 10, color: "#2d6a4f", fontWeight: 700, background: "#e8f4e8", padding: "2px 7px", borderRadius: 999 }}>New</span>
                        )}
                        {actions.map((a, ai) => (
                          <a key={ai} href={a.href}
                            onClick={e => { e.stopPropagation(); markAsRead(notif); }}
                            className={`qa-btn ${a.style === "primary" ? "qa-btn-primary" : "qa-btn-secondary"}`}
                            style={{ border: a.style === "secondary" ? "1.5px solid #e8e2d9" : "none" }}>
                            {a.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}