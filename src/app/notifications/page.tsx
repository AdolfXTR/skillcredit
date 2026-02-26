"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
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

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  session:     { icon: "📅", color: "#1d4ed8", bg: "#dbeafe", label: "Session" },
  credit:      { icon: "💰", color: "#166534", bg: "#dcfce7", label: "Credits" },
  message:     { icon: "💬", color: "#7c3aed", bg: "#ede9fe", label: "Message" },
  dispute:     { icon: "⚠️", color: "#b45309", bg: "#fef3c7", label: "Dispute" },
  achievement: { icon: "🏆", color: "#d97706", bg: "#fef3c7", label: "Achievement" },
  platform:    { icon: "📢", color: "#555",    bg: "#f5f0e8", label: "Platform" },
  forum_earn:  { icon: "⭐", color: "#166534", bg: "#dcfce7", label: "Earned" },
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function groupByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  notifications.forEach(n => {
    const date = new Date(n.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === today.toDateString()) label = "Today";
    else if (date.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = date.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });
  return groups;
}

export default function NotificationsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => { loadData(); }, []);

  // Real-time notifications
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("notifications-page")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
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
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    setNotifications(notifs || []);
    setLoading(false);
  }

  async function markAsRead(notif: Notification) {
    if (notif.is_read) {
      if (notif.link) window.location.href = notif.link;
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    if (notif.link) window.location.href = notif.link;
  }

  async function markAllRead() {
    if (!profile) return;
    setMarkingAll(true);
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  }

  async function deleteNotification(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
    ? notifications.filter(n => !n.is_read)
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const grouped = groupByDate(filtered);

  const filterOptions = [
    { key: "all", label: "All" },
    { key: "unread", label: `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { key: "session", label: "Sessions" },
    { key: "credit", label: "Credits" },
    { key: "message", label: "Messages" },
    { key: "achievement", label: "Achievements" },
    { key: "dispute", label: "Disputes" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
          <div style={{ color: "#666", fontSize: 15 }}>Loading notifications…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .notif-item { transition: background 0.15s, transform 0.15s; cursor: pointer; }
        .notif-item:hover { background: #f5f0e8 !important; }
        .filter-pill { transition: all 0.15s; cursor: pointer; border: none; }
        .delete-btn { opacity: 0; transition: opacity 0.15s; }
        .notif-item:hover .delete-btn { opacity: 1; }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              {label}
            </a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
            {getInitials(profile?.full_name || "")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{ marginLeft: 12, fontSize: 16, fontWeight: 700, background: "#dc2626", color: "#fff", padding: "3px 10px", borderRadius: 20, verticalAlign: "middle" }}>
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p style={{ color: "#888", marginTop: 6, fontSize: 15 }}>
              Stay on top of your sessions, credits, and community activity.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              style={{ padding: "9px 18px", borderRadius: 10, background: "#f5f0e8", color: "#2d6a4f", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              {markingAll ? "Marking…" : "✓ Mark all read"}
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              className="filter-pill"
              onClick={() => setFilter(opt.key)}
              style={{
                padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                background: filter === opt.key ? "#2d6a4f" : "#fff",
                color: filter === opt.key ? "#fff" : "#666",
                border: `1.5px solid ${filter === opt.key ? "#2d6a4f" : "#e8e2d9"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {filter === "unread" ? "🎉" : "🔔"}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
              {filter === "unread" ? "All caught up!" : "No notifications yet"}
            </div>
            <p style={{ color: "#888", fontSize: 14 }}>
              {filter === "unread"
                ? "You have no unread notifications."
                : "Notifications will appear here when you have activity."}
            </p>
          </div>
        )}

        {/* Grouped notifications */}
        {Object.entries(grouped).map(([dateLabel, notifs]) => (
          <div key={dateLabel} style={{ marginBottom: 28 }}>
            {/* Date group label */}
            <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, paddingLeft: 4 }}>
              {dateLabel}
            </div>

            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", overflow: "hidden" }}>
              {notifs.map((notif, i) => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.platform;
                return (
                  <div
                    key={notif.id}
                    className="notif-item"
                    onClick={() => markAsRead(notif)}
                    style={{
                      padding: "16px 20px",
                      borderBottom: i < notifs.length - 1 ? "1px solid #f5f0e8" : "none",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      background: notif.is_read ? "#fff" : "#fafdf8",
                      position: "relative",
                    }}
                  >
                    {/* Unread dot */}
                    {!notif.is_read && (
                      <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#2d6a4f" }} />
                    )}

                    {/* Icon */}
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: notif.is_read ? 600 : 800, color: "#1a1a1a", marginBottom: 3 }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                            {notif.body}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ fontSize: 11, color: "#bbb", whiteSpace: "nowrap" }}>{timeAgo(notif.created_at)}</span>
                          <button
                            className="delete-btn"
                            onClick={(e) => deleteNotification(notif.id, e)}
                            style={{ width: 24, height: 24, borderRadius: "50%", background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Type badge + link indicator */}
                      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {notif.link && (
                          <span style={{ fontSize: 11, color: "#2d6a4f", fontWeight: 600 }}>
                            View →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Summary stats */}
        {notifications.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
            {[
              { label: "Total", value: notifications.length, icon: "🔔", color: "#1a1a1a", bg: "#fff" },
              { label: "Unread", value: unreadCount, icon: "🟢", color: "#166534", bg: "#dcfce7" },
              { label: "Read", value: notifications.length - unreadCount, icon: "✓", color: "#888", bg: "#f5f0e8" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 18px", border: "1.5px solid #e8e2d9", textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}