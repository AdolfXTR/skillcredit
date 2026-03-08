"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminUser = {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  level: string;
  xp: number;
  credits: number;
  avatar_url?: string | null;
  is_banned?: boolean;
  is_verified?: boolean;
  role?: string;
  created_at: string;
};

type Stats = {
  totalUsers: number;
  newUsersToday: number;
  totalSessions: number;
  completedSessions: number;
  totalRevenue: number;
  totalEscrow: number;
  pendingDisputes: number;
  totalListings: number;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function Avatar({ user, size = 36 }: { user: { full_name: string; level: string; avatar_url?: string | null }; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: user.avatar_url ? "transparent" : (LEVEL_COLORS[user.level] || "#2d6a4f"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {user.avatar_url
        ? <img src={user.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        : getInitials(user.full_name)}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview"|"users"|"credits"|"xp">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [xpAmount, setXpAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [escrowList, setEscrowList] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!prof || (prof.role !== "admin")) { window.location.href = "/dashboard"; return; }
    setProfile(prof);
    await Promise.all([loadStats(), loadUsers(), loadEscrow()]);
    setLoading(false);
  }

  async function loadStats() {
    const today = new Date(); today.setHours(0,0,0,0);
    const [usersRes, newUsersRes, sessionsRes, completedRes, escrowRes, disputeRes, listingsRes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
      supabase.from("sessions").select("credit_amount").eq("status", "completed"),
      supabase.from("escrow").select("amount").eq("status", "held"),
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "disputed"),
      supabase.from("listings").select("id", { count: "exact", head: true }),
    ]);
    const revenue = (completedRes.data || []).reduce((s: number, r: any) => s + (r.credit_amount || 0), 0);
    const escrow = (escrowRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    setStats({
      totalUsers: usersRes.count || 0,
      newUsersToday: newUsersRes.count || 0,
      totalSessions: sessionsRes.count || 0,
      completedSessions: completedRes.data?.length || 0,
      totalRevenue: revenue,
      totalEscrow: escrow,
      pendingDisputes: disputeRes.count || 0,
      totalListings: listingsRes.count || 0,
    });
  }

  async function loadUsers() {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    setUsers(data || []);
  }

  async function loadEscrow() {
    const { data } = await supabase.from("escrow").select("*, session:sessions(id, status, listing:listings(title))").order("created_at", { ascending: false }).limit(50);
    setEscrowList(data || []);
  }

  async function handleBanUser(user: AdminUser) {
    setActionLoading(user.id + "-ban");
    const newBanned = !user.is_banned;
    await supabase.from("profiles").update({ is_banned: newBanned }).eq("id", user.id);
    showToast(`${user.full_name} ${newBanned ? "banned" : "unbanned"}.`);
    await loadUsers(); setActionLoading(null);
  }

  async function handleVerifyUser(user: AdminUser) {
    setActionLoading(user.id + "-verify");
    const newVerified = !user.is_verified;
    await supabase.from("profiles").update({ is_verified: newVerified }).eq("id", user.id);
    showToast(`${user.full_name} ${newVerified ? "verified" : "unverified"}.`);
    await loadUsers(); setActionLoading(null);
  }

  async function handleAdjustXP() {
    if (!editUser || !xpAmount) return;
    setActionLoading("xp");
    const amount = parseInt(xpAmount);
    await supabase.rpc("increment_xp", { user_id: editUser.id, amount });
    try {
      await supabase.from("notifications").insert({ user_id: editUser.id, type: "xp", title: `⚡ XP Adjusted by Admin`, body: `${amount > 0 ? "+" : ""}${amount} XP. ${editNote || ""}`, link: "/dashboard" });
    } catch (_) {}
    showToast(`XP adjusted for ${editUser.full_name}.`);
    setXpAmount(""); setEditNote(""); setEditUser(null);
    await loadUsers(); setActionLoading(null);
  }

  async function handleAdjustCredits() {
    if (!editUser || !creditAmount) return;
    setActionLoading("credits");
    const amount = parseInt(creditAmount);
    await supabase.rpc("increment_credits", { user_id: editUser.id, amount });
    try {
      await supabase.from("credit_transactions").insert({ user_id: editUser.id, amount, type: "admin_adjustment", description: editNote || "Admin credit adjustment" });
      await supabase.from("notifications").insert({ user_id: editUser.id, type: "credit", title: `💰 Credits Adjusted by Admin`, body: `${amount > 0 ? "+" : ""}${amount} credits. ${editNote || ""}`, link: "/wallet" });
    } catch (_) {}
    showToast(`Credits adjusted for ${editUser.full_name}.`);
    setCreditAmount(""); setEditNote(""); setEditUser(null);
    await loadUsers(); setActionLoading(null);
  }

  async function handleReleaseEscrow(escrowId: string, sessionId: string, teacherId: string, amount: number) {
    setActionLoading("escrow-" + escrowId);
    await supabase.from("escrow").update({ status: "released" }).eq("id", escrowId);
    await supabase.from("sessions").update({ status: "completed" }).eq("id", sessionId);
    await supabase.rpc("increment_credits", { user_id: teacherId, amount });
    showToast(`Escrow released. ${amount} cr sent to teacher.`);
    await loadEscrow(); setActionLoading(null);
  }

  async function handleRefundEscrow(escrowId: string, sessionId: string, learnerId: string, amount: number) {
    setActionLoading("escrow-" + escrowId);
    await supabase.from("escrow").update({ status: "refunded" }).eq("id", escrowId);
    await supabase.from("sessions").update({ status: "cancelled" }).eq("id", sessionId);
    await supabase.rpc("increment_credits", { user_id: learnerId, amount });
    showToast(`Escrow refunded. ${amount} cr returned to learner.`);
    await loadEscrow(); setActionLoading(null);
  }

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "2px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#666", fontSize: 13 }}>Loading admin panel...</p>
      </div>
    </div>
  );

  const TABS = [
    { id: "overview", label: "📊 Overview" },
    { id: "users",    label: "👥 Users" },
    { id: "credits",  label: "💰 Escrow" },
    { id: "xp",       label: "⚡ XP & Badges" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'DM Sans', sans-serif", color: "#e6edf3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:99px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .row-hover:hover{background:#161b22 !important}
        a{color:inherit;text-decoration:none}
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, padding: "12px 20px", borderRadius: 12, background: toast.type === "success" ? "#1a4a36" : "#7f1d1d", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "fadeUp .2s ease" }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: "#161b22", borderBottom: "1px solid #30363d", padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#e6edf3" }}>Credit</span>
          </div>
          <div style={{ width: 1, height: 20, background: "#30363d" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", background: "#451a03", padding: "3px 10px", borderRadius: 99, letterSpacing: 1 }}>ADMIN</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: tab === t.id ? "#21262d" : "transparent", color: tab === t.id ? "#e6edf3" : "#8b949e", transition: "all .12s" }}>
              {t.label}
            </button>
          ))}
        </div>
        <a href="/dashboard" style={{ fontSize: 12, color: "#8b949e", padding: "5px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#161b22" }}>← Back to App</a>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 28px 60px" }}>

        {/* OVERVIEW TAB */}
        {tab === "overview" && stats && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>Platform Overview</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 28 }}>Live stats across all users, sessions, and credits.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Total Users",      val: stats.totalUsers,        sub: `+${stats.newUsersToday} today`,   color: "#58a6ff", icon: "👥" },
                { label: "Sessions",         val: stats.totalSessions,     sub: `${stats.completedSessions} done`, color: "#3fb950", icon: "📅" },
                { label: "Credits Earned",   val: stats.totalRevenue,      sub: "from completed sessions",          color: "#f59e0b", icon: "💰" },
                { label: "In Escrow",        val: stats.totalEscrow,       sub: `${stats.pendingDisputes} disputed`,color: "#d29922", icon: "🔒" },
              ].map(s => (
                <div key={s.label} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: "20px 22px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "'Fraunces', serif", marginBottom: 2 }}>{s.val.toLocaleString()}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8b949e" }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#6e7681", marginTop: 3 }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Active Listings", val: stats.totalListings, color: "#a371f7", icon: "📚" },
                { label: "Disputes Open",   val: stats.pendingDisputes, color: "#f85149", icon: "⚠️" },
                { label: "New Today",       val: stats.newUsersToday, color: "#39d353", icon: "🌱" },
                { label: "Completion Rate", val: stats.totalSessions > 0 ? Math.round((stats.completedSessions / stats.totalSessions) * 100) + "%" : "0%", color: "#58a6ff", icon: "✅" },
              ].map(s => (
                <div key={s.label} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3" }}>User Management</h1>
                <p style={{ fontSize: 13, color: "#8b949e", marginTop: 3 }}>{users.length} total users</p>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
                style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", width: 240, outline: "none" }} />
            </div>

            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 180px", padding: "10px 16px", borderBottom: "1px solid #30363d", fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.8 }}>
                <span>User</span><span>Level</span><span>XP</span><span>Credits</span><span>Status</span><span>Actions</span>
              </div>
              {filteredUsers.map(u => (
                <div key={u.id} className="row-hover" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 180px", padding: "12px 16px", borderBottom: "1px solid #21262d", alignItems: "center", transition: "background .1s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar user={u} size={32} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3" }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>@{u.username}</div>
                    </div>
                    {u.is_verified && <span style={{ fontSize: 10, background: "#0d4429", color: "#3fb950", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>✓ Verified</span>}
                    {u.role === "admin" && <span style={{ fontSize: 10, background: "#451a03", color: "#f59e0b", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>Admin</span>}
                    {u.role === "moderator" && <span style={{ fontSize: 10, background: "#1c1a3b", color: "#a371f7", padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>Mod</span>}
                  </div>
                  <span style={{ fontSize: 12, color: LEVEL_COLORS[u.level] || "#8b949e", fontWeight: 700 }}>{u.level}</span>
                  <span style={{ fontSize: 13, color: "#e6edf3", fontWeight: 600 }}>{u.xp}</span>
                  <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>{u.credits} cr</span>
                  <span>
                    {u.is_banned
                      ? <span style={{ fontSize: 11, background: "#450a0a", color: "#f85149", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>Banned</span>
                      : <span style={{ fontSize: 11, background: "#0d4429", color: "#3fb950", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>Active</span>}
                  </span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => { setEditUser(u); setXpAmount(""); setCreditAmount(""); setEditNote(""); }}
                      style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #30363d", background: "#21262d", color: "#e6edf3", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      Edit
                    </button>
                    <button onClick={() => handleVerifyUser(u)} disabled={!!actionLoading}
                      style={{ padding: "4px 8px", borderRadius: 7, border: "none", background: u.is_verified ? "#21262d" : "#0d4429", color: u.is_verified ? "#8b949e" : "#3fb950", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {u.is_verified ? "Unverify" : "Verify"}
                    </button>
                    <button onClick={() => handleBanUser(u)} disabled={!!actionLoading}
                      style={{ padding: "4px 8px", borderRadius: 7, border: "none", background: u.is_banned ? "#1c1a3b" : "#450a0a", color: u.is_banned ? "#a371f7" : "#f85149", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {u.is_banned ? "Unban" : "Ban"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ESCROW TAB */}
        {tab === "credits" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>Escrow Management</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>Release or refund held credits for sessions.</p>
            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 180px", padding: "10px 16px", borderBottom: "1px solid #30363d", fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.8 }}>
                <span>Session</span><span>Amount</span><span>Status</span><span>Date</span><span>Actions</span>
              </div>
              {escrowList.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>No escrow records found.</div>
              )}
              {escrowList.map(e => (
                <div key={e.id} className="row-hover" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 180px", padding: "12px 16px", borderBottom: "1px solid #21262d", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>{e.session?.listing?.title || "Unknown Session"}</div>
                    <div style={{ fontSize: 11, color: "#8b949e" }}>Session: {e.session_id?.slice(0, 8)}…</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#f59e0b" }}>{e.amount} cr</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: e.status === "held" ? "#1c2a1a" : e.status === "released" ? "#0d4429" : e.status === "disputed" ? "#1c1a3b" : "#450a0a", color: e.status === "held" ? "#7ee787" : e.status === "released" ? "#3fb950" : e.status === "disputed" ? "#a371f7" : "#f85149", display: "inline-block" }}>
                    {e.status}
                  </span>
                  <span style={{ fontSize: 11, color: "#8b949e" }}>{new Date(e.created_at).toLocaleDateString()}</span>
                  {e.status === "held" || e.status === "disputed" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleReleaseEscrow(e.id, e.session_id, e.teacher_id, e.amount)} disabled={!!actionLoading}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#0d4429", color: "#3fb950", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Release →
                      </button>
                      <button onClick={() => handleRefundEscrow(e.id, e.session_id, e.learner_id, e.amount)} disabled={!!actionLoading}
                        style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#450a0a", color: "#f85149", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Refund
                      </button>
                    </div>
                  ) : <span style={{ fontSize: 11, color: "#6e7681" }}>—</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* XP & BADGES TAB */}
        {tab === "xp" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>XP & Badge Adjustments</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>Search a user to adjust their XP or credits directly.</p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user to adjust..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {filteredUsers.slice(0, 20).map(u => (
                <div key={u.id} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar user={u} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>{u.full_name} <span style={{ fontSize: 12, color: "#8b949e" }}>@{u.username}</span></div>
                    <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
                      <span style={{ color: "#58a6ff" }}>{u.xp} XP</span>
                      <span style={{ margin: "0 8px", color: "#30363d" }}>·</span>
                      <span style={{ color: "#f59e0b" }}>{u.credits} cr</span>
                      <span style={{ margin: "0 8px", color: "#30363d" }}>·</span>
                      <span style={{ color: LEVEL_COLORS[u.level] || "#8b949e" }}>{u.level}</span>
                    </div>
                  </div>
                  <button onClick={() => { setEditUser(u); setXpAmount(""); setCreditAmount(""); setEditNote(""); }}
                    style={{ padding: "7px 16px", borderRadius: 9, border: "1px solid #30363d", background: "#21262d", color: "#e6edf3", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Adjust →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* EDIT USER MODAL */}
      {editUser && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 18, width: "100%", maxWidth: 480, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar user={editUser} size={40} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#e6edf3" }}>{editUser.full_name}</div>
                  <div style={{ fontSize: 12, color: "#8b949e" }}>@{editUser.username} · {editUser.xp} XP · {editUser.credits} cr</div>
                </div>
              </div>
              <button onClick={() => setEditUser(null)} style={{ background: "none", border: "none", color: "#8b949e", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Adjust XP (use - for deduct)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={xpAmount} onChange={e => setXpAmount(e.target.value)} placeholder="+50 or -20" type="number"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                <button onClick={handleAdjustXP} disabled={!xpAmount || !!actionLoading}
                  style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: xpAmount ? "#1c2a1a" : "#21262d", color: xpAmount ? "#3fb950" : "#8b949e", fontWeight: 700, fontSize: 13, cursor: xpAmount ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif" }}>
                  {actionLoading === "xp" ? "…" : "Apply XP"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Adjust Credits (use - for deduct)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="+10 or -5" type="number"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
                <button onClick={handleAdjustCredits} disabled={!creditAmount || !!actionLoading}
                  style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: creditAmount ? "#451a03" : "#21262d", color: creditAmount ? "#f59e0b" : "#8b949e", fontWeight: 700, fontSize: 13, cursor: creditAmount ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif" }}>
                  {actionLoading === "credits" ? "…" : "Apply Credits"}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Note (sent to user)</label>
              <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Reason for adjustment..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}