"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type SupportUser = {
  id: string;
  full_name: string;
  username: string;
  email?: string;
  credits: number;
  xp: number;
  level: string;
  avatar_url?: string | null;
  is_banned?: boolean;
  is_verified?: boolean;
  created_at: string;
};

type UserSession = {
  id: string;
  status: string;
  credit_amount: number;
  proposed_time: string;
  teacher_id: string;
  learner_id: string;
  listing?: { title: string; format: string };
  teacher?: { full_name: string; username: string };
  learner?: { full_name: string; username: string };
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  user?: { full_name: string; username: string; avatar_url?: string | null; level: string };
  replies?: TicketReply[];
};

type TicketReply = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_support: boolean;
  created_at: string;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function Avatar({ user, size = 32 }: { user: { full_name: string; level: string; avatar_url?: string | null }; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: user.avatar_url ? "transparent" : (LEVEL_COLORS[user.level] || "#2d6a4f"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {user.avatar_url ? <img src={user.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : getInitials(user.full_name)}
    </div>
  );
}

export default function SupportDashboard() {
  const [tab, setTab] = useState<"tickets"|"lookup"|"sessions"|"refunds">("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [replyMsg, setReplyMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lookedUpUser, setLookedUpUser] = useState<SupportUser | null>(null);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeTicket?.replies]);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!prof || !["admin","moderator","support"].includes(prof.role || "")) { window.location.href = "/dashboard"; return; }
    setProfile(prof);
    await loadTickets();
    setLoading(false);
  }

  async function loadTickets() {
    const { data } = await supabase.from("support_tickets")
      .select(`*, user:profiles!support_tickets_user_id_fkey(full_name, username, level, avatar_url)`)
      .order("created_at", { ascending: false }).limit(60);
    setTickets((data as any) || []);
  }

  async function loadTicketReplies(ticket: Ticket) {
    const { data } = await supabase.from("support_replies")
      .select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    const updated = { ...ticket, replies: (data as any) || [] };
    setActiveTicket(updated);
  }

  async function sendReply() {
    if (!activeTicket || !replyMsg.trim() || !profile) return;
    setActionLoading("reply");
    const { data: reply } = await supabase.from("support_replies").insert({
      ticket_id: activeTicket.id,
      sender_id: profile.id,
      message: replyMsg.trim(),
      is_support: true,
    }).select().single();

    if (reply) {
      const updated = { ...activeTicket, replies: [...(activeTicket.replies || []), reply as TicketReply] };
      setActiveTicket(updated);
      setTickets(prev => prev.map(t => t.id === activeTicket.id ? { ...t, status: "in_progress" } : t));
      await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", activeTicket.id);
      try {
        await supabase.from("notifications").insert({ user_id: activeTicket.user_id, type: "support", title: "💬 Support replied to your ticket", body: replyMsg.trim().slice(0, 80), link: "/support" });
      } catch (_) {}
    }
    setReplyMsg("");
    setActionLoading(null);
  }

  async function closeTicket(ticketId: string) {
    await supabase.from("support_tickets").update({ status: "closed" }).eq("id", ticketId);
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "closed" } : t));
    if (activeTicket?.id === ticketId) setActiveTicket(prev => prev ? { ...prev, status: "closed" } : null);
    showToast("Ticket closed.");
  }

  async function lookupUser() {
    if (!searchQuery.trim()) return;
    setActionLoading("lookup");
    const { data, error } = await supabase.from("profiles").select("*")
      .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`).limit(1).single();
    if (error || !data) { showToast("User not found.", "error"); setActionLoading(null); return; }
    setLookedUpUser(data);

    const [sessRes, txRes] = await Promise.all([
      supabase.from("sessions").select(`*, listing:listings(title, format), teacher:profiles!sessions_teacher_id_fkey(full_name, username), learner:profiles!sessions_learner_id_fkey(full_name, username)`)
        .or(`teacher_id.eq.${data.id},learner_id.eq.${data.id}`).order("created_at", { ascending: false }).limit(20),
      supabase.from("credit_transactions").select("*").eq("user_id", data.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setUserSessions(sessRes.data || []);
    setUserTransactions(txRes.data || []);
    setActionLoading(null);
  }

  async function handleCreditRefund() {
    if (!lookedUpUser || !refundAmount || !refundReason) return;
    setActionLoading("refund");
    const amount = parseInt(refundAmount);
    await supabase.rpc("increment_credits", { user_id: lookedUpUser.id, amount });
    await supabase.from("credit_transactions").insert({ user_id: lookedUpUser.id, amount, type: "support_refund", description: `Support refund: ${refundReason}` })
    await supabase.from("notifications").insert({ user_id: lookedUpUser.id, type: "credit", title: `💰 Support Refund: ${amount} credits`, body: refundReason, link: "/wallet" })
    showToast(`${amount} cr refunded to ${lookedUpUser.full_name}.`);
    setRefundAmount(""); setRefundReason("");
    setLookedUpUser(prev => prev ? { ...prev, credits: prev.credits + amount } : null);
    setActionLoading(null);
  }

  const openTickets = tickets.filter(t => t.status !== "closed");
  const closedTickets = tickets.filter(t => t.status === "closed");

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 32, height: 32, border: "2px solid #58a6ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
    </div>
  );

  const TABS = [
    { id: "tickets",  label: "🎫 Tickets",  count: openTickets.length },
    { id: "lookup",   label: "🔍 User Lookup" },
    { id: "sessions", label: "📅 Sessions" },
    { id: "refunds",  label: "💰 Refunds" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", fontFamily: "'DM Sans', sans-serif", color: "#e6edf3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#30363d;border-radius:99px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .ticket-row:hover{background:#1c2128 !important;cursor:pointer}
        .row-hover:hover{background:#161b22 !important}
        a{color:inherit;text-decoration:none}
        textarea:focus,input:focus{outline:none}
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
          <span style={{ fontSize: 12, fontWeight: 700, color: "#58a6ff", background: "#0c2a4a", padding: "3px 10px", borderRadius: 99, letterSpacing: 1 }}>SUPPORT</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", background: tab === t.id ? "#21262d" : "transparent", color: tab === t.id ? "#e6edf3" : "#8b949e", transition: "all .12s" }}>
              {t.label}
              {"count" in t && (t as any).count > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: "#58a6ff", color: "#fff", padding: "1px 5px", borderRadius: 99, fontWeight: 800 }}>{(t as any).count}</span>}
            </button>
          ))}
        </div>
        <a href="/dashboard" style={{ fontSize: 12, color: "#8b949e", padding: "5px 12px", borderRadius: 8, border: "1px solid #30363d", background: "#161b22" }}>← Back to App</a>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 28px 60px" }}>

        {/* TICKETS TAB */}
        {tab === "tickets" && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, height: "calc(100vh - 140px)", animation: "fadeUp .3s ease" }}>
            {/* Ticket list */}
            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #30363d" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e6edf3" }}>Support Tickets</div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{openTickets.length} open · {closedTickets.length} closed</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {tickets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#8b949e", fontSize: 13 }}>No tickets yet.</div>
                ) : tickets.map(t => (
                  <div key={t.id} className="ticket-row"
                    onClick={() => { setActiveTicket(t); loadTicketReplies(t); }}
                    style={{ padding: "12px 14px", borderBottom: "1px solid #21262d", background: activeTicket?.id === t.id ? "#1c2128" : "transparent", transition: "background .1s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {t.user && <Avatar user={t.user} size={24} />}
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e6edf3", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 99, flexShrink: 0,
                        background: t.status === "open" ? "#0c2a4a" : t.status === "in_progress" ? "#451a03" : "#21262d",
                        color: t.status === "open" ? "#58a6ff" : t.status === "in_progress" ? "#f59e0b" : "#8b949e"
                      }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6e7681", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.message}</div>
                    <div style={{ fontSize: 10, color: "#6e7681", marginTop: 4 }}>{new Date(t.created_at).toLocaleDateString()} · @{t.user?.username}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket detail / chat */}
            <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {!activeTicket ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#8b949e", gap: 12 }}>
                  <div style={{ fontSize: 36 }}>🎫</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Select a ticket to view</div>
                </div>
              ) : (
                <>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", gap: 12 }}>
                    {activeTicket.user && <Avatar user={activeTicket.user} size={34} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#e6edf3" }}>{activeTicket.subject}</div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>@{activeTicket.user?.username} · {new Date(activeTicket.created_at).toLocaleDateString()}</div>
                    </div>
                    {activeTicket.status !== "closed" && (
                      <button onClick={() => closeTicket(activeTicket.id)}
                        style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                        Close Ticket
                      </button>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* Original message */}
                    <div style={{ background: "#21262d", borderRadius: 12, padding: "12px 14px", maxWidth: "75%" }}>
                      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>@{activeTicket.user?.username}</div>
                      <div style={{ fontSize: 13, color: "#c9d1d9", lineHeight: 1.6 }}>{activeTicket.message}</div>
                    </div>
                    {/* Replies */}
                    {(activeTicket.replies || []).map(r => (
                      <div key={r.id} style={{ display: "flex", justifyContent: r.is_support ? "flex-end" : "flex-start" }}>
                        <div style={{ background: r.is_support ? "#1c2a1a" : "#21262d", border: r.is_support ? "1px solid #2d4a36" : "none", borderRadius: 12, padding: "10px 14px", maxWidth: "75%" }}>
                          {r.is_support && <div style={{ fontSize: 10, color: "#3fb950", fontWeight: 700, marginBottom: 3 }}>SUPPORT</div>}
                          <div style={{ fontSize: 13, color: "#c9d1d9", lineHeight: 1.6 }}>{r.message}</div>
                          <div style={{ fontSize: 10, color: "#6e7681", marginTop: 4 }}>{new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  {activeTicket.status !== "closed" && (
                    <div style={{ padding: "12px 16px", borderTop: "1px solid #30363d", display: "flex", gap: 10 }}>
                      <textarea value={replyMsg} onChange={e => setReplyMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        placeholder="Type a reply... (Enter to send)"
                        rows={2}
                        style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "none" }} />
                      <button onClick={sendReply} disabled={!replyMsg.trim() || !!actionLoading}
                        style={{ padding: "0 18px", borderRadius: 10, border: "none", background: replyMsg.trim() ? "#1c2a1a" : "#21262d", color: replyMsg.trim() ? "#3fb950" : "#8b949e", fontWeight: 800, fontSize: 14, cursor: replyMsg.trim() ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif" }}>
                        {actionLoading === "reply" ? "…" : "↑"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* USER LOOKUP TAB */}
        {tab === "lookup" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>User Lookup</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>Search any user to view their full profile and history.</p>

            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupUser()}
                placeholder="Search by name or @username..."
                style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
              <button onClick={lookupUser} disabled={!!actionLoading}
                style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#0c2a4a", color: "#58a6ff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {actionLoading === "lookup" ? "…" : "🔍 Search"}
              </button>
            </div>

            {lookedUpUser && (
              <div style={{ animation: "fadeUp .2s ease" }}>
                {/* User card */}
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: "22px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 18 }}>
                  <Avatar user={lookedUpUser} size={56} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#e6edf3", fontFamily: "'Fraunces', serif" }}>{lookedUpUser.full_name}</div>
                    <div style={{ fontSize: 13, color: "#8b949e" }}>@{lookedUpUser.username} · Joined {new Date(lookedUpUser.created_at).toLocaleDateString()}</div>
                    <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                      <span style={{ fontSize: 13, color: "#58a6ff" }}>{lookedUpUser.xp} XP</span>
                      <span style={{ fontSize: 13, color: "#f59e0b" }}>{lookedUpUser.credits} credits</span>
                      <span style={{ fontSize: 13, color: LEVEL_COLORS[lookedUpUser.level] || "#8b949e" }}>{lookedUpUser.level}</span>
                      {lookedUpUser.is_verified && <span style={{ fontSize: 11, background: "#0d4429", color: "#3fb950", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>✓ Verified</span>}
                      {lookedUpUser.is_banned && <span style={{ fontSize: 11, background: "#450a0a", color: "#f85149", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>Banned</span>}
                    </div>
                  </div>
                </div>

                {/* Transaction history */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#e6edf3", marginBottom: 10 }}>Credit History</div>
                  <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
                    {userTransactions.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>No transactions.</div>
                    ) : userTransactions.map(tx => (
                      <div key={tx.id} className="row-hover" style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", borderBottom: "1px solid #21262d" }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: tx.amount > 0 ? "#3fb950" : "#f85149", fontFamily: "'Fraunces', serif", minWidth: 60 }}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3" }}>{tx.description || tx.type}</div>
                          <div style={{ fontSize: 11, color: "#6e7681" }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                        </div>
                        <span style={{ fontSize: 10, background: "#21262d", color: "#8b949e", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>{tx.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SESSIONS TAB */}
        {tab === "sessions" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>Session Lookup</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>Look up a user to see all their sessions and history.</p>

            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupUser()}
                placeholder="Search by name or @username..."
                style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
              <button onClick={lookupUser} disabled={!!actionLoading}
                style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#0c2a4a", color: "#58a6ff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {actionLoading === "lookup" ? "…" : "🔍 Search"}
              </button>
            </div>

            {lookedUpUser && userSessions.length > 0 && (
              <div style={{ animation: "fadeUp .2s ease" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#e6edf3", marginBottom: 10 }}>{lookedUpUser.full_name}'s Sessions ({userSessions.length})</div>
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 14px", borderBottom: "1px solid #30363d", fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.7 }}>
                    <span>Listing</span><span>Role</span><span>Credits</span><span>Status</span><span>Date</span>
                  </div>
                  {userSessions.map(s => {
                    const isTeacher = s.teacher_id === lookedUpUser.id;
                    const cfg = { pending: "#f59e0b", confirmed: "#58a6ff", completed: "#3fb950", cancelled: "#f85149", disputed: "#a371f7" }[s.status] || "#8b949e";
                    return (
                      <div key={s.id} className="row-hover" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "11px 14px", borderBottom: "1px solid #21262d", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>{s.listing?.title || "Untitled"}</div>
                          <div style={{ fontSize: 11, color: "#8b949e" }}>{isTeacher ? `Learner: ${s.learner?.full_name}` : `Teacher: ${s.teacher?.full_name}`}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isTeacher ? "#58a6ff" : "#3fb950" }}>{isTeacher ? "Teaching" : "Learning"}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{s.credit_amount} cr</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg }}>{s.status}</span>
                        <span style={{ fontSize: 11, color: "#8b949e" }}>{new Date(s.proposed_time).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {lookedUpUser && userSessions.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px", background: "#161b22", borderRadius: 14, border: "1px solid #30363d", color: "#8b949e", fontSize: 13 }}>
                No sessions found for {lookedUpUser.full_name}.
              </div>
            )}
          </div>
        )}

        {/* REFUNDS TAB */}
        {tab === "refunds" && (
          <div style={{ animation: "fadeUp .3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#e6edf3", marginBottom: 6 }}>Credit Refunds</h1>
            <p style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>Search a user and issue a manual credit refund.</p>

            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && lookupUser()}
                placeholder="Search by name or @username..."
                style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: "1px solid #30363d", background: "#161b22", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
              <button onClick={lookupUser} disabled={!!actionLoading}
                style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#0c2a4a", color: "#58a6ff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {actionLoading === "lookup" ? "…" : "🔍 Find User"}
              </button>
            </div>

            {lookedUpUser && (
              <div style={{ animation: "fadeUp .2s ease" }}>
                <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 14, padding: "22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                    <Avatar user={lookedUpUser} size={44} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#e6edf3" }}>{lookedUpUser.full_name}</div>
                      <div style={{ fontSize: 12, color: "#8b949e" }}>@{lookedUpUser.username} · Current balance: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{lookedUpUser.credits} cr</span></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Amount to refund</label>
                    <input value={refundAmount} onChange={e => setRefundAmount(e.target.value)} type="number" min="1" placeholder="e.g. 10"
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Reason</label>
                    <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Explain why this refund is being issued..."
                      style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 9, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical" }} />
                  </div>

                  <button onClick={handleCreditRefund} disabled={!refundAmount || !refundReason || !!actionLoading}
                    style={{ width: "100%", padding: "13px", borderRadius: 11, border: "none", background: refundAmount && refundReason ? "#1a4a36" : "#21262d", color: refundAmount && refundReason ? "#3fb950" : "#8b949e", fontWeight: 800, fontSize: 14, cursor: refundAmount && refundReason ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif', transition: 'all .15s" }}>
                    {actionLoading === "refund" ? "Processing…" : `💰 Issue Refund${refundAmount ? ` (${refundAmount} cr)` : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}