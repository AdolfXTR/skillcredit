"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Session = {
  id: string;
  listing_id: string;
  teacher_id: string;
  learner_id: string;
  proposed_time: string;
  confirmed_time: string | null;
  status: string;
  learner_note: string | null;
  credit_amount: number;
  teacher_completed: boolean;
  learner_completed: boolean;
  created_at: string;
  listing?: { title: string; format: string; description?: string };
  teacher?: { id: string; full_name: string; username: string; level: string };
  learner?: { id: string; full_name: string; username: string; level: string };
};

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  xp: number;
  level: string;
};

type RatingForm = {
  overall: number;
  knowledge: number;
  communication: number;
  punctuality: number;
  preparedness: number;
  respectfulness: number;
  review: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string; dot: string }> = {
  pending:   { label: "Pending",   color: "#92400e", bg: "#fffbeb", border: "#fde68a", icon: "⏳", dot: "#f59e0b" },
  confirmed: { label: "Confirmed", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", icon: "📅", dot: "#3b82f6" },
  completed: { label: "Completed", color: "#166534", bg: "#f0fdf4", border: "#bbf7d0", icon: "✅", dot: "#22c55e" },
  cancelled: { label: "Cancelled", color: "#991b1b", bg: "#fef2f2", border: "#fecaca", icon: "✕",  dot: "#ef4444" },
  disputed:  { label: "Disputed",  color: "#6d28d9", bg: "#faf5ff", border: "#e9d5ff", icon: "⚠️", dot: "#a855f7" },
};

const FORMAT_ICONS: Record<string, string> = { video: "🎥", chat: "💬", docs: "📄", mixed: "🔀" };
const FORMAT_LABELS: Record<string, string> = { video: "Video Call", chat: "Live Chat", docs: "Async Docs", mixed: "Mixed" };
const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function timeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff); const isPast = diff < 0;
  if (abs < 3600000) return `${isPast ? "" : "in "}${Math.round(abs / 60000)}m${isPast ? " ago" : ""}`;
  if (abs < 86400000) return `${isPast ? "" : "in "}${Math.round(abs / 3600000)}h${isPast ? " ago" : ""}`;
  return `${isPast ? "" : "in "}${Math.round(abs / 86400000)}d${isPast ? " ago" : ""}`;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 24, color: (hover || value) >= i ? "#f59e0b" : "#e5e7eb" }}>★</button>
      ))}
    </div>
  );
}

export default function SessionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<"all"|"teaching"|"learning">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [ratingSession, setRatingSession] = useState<Session | null>(null);
  const [ratingForm, setRatingForm] = useState<RatingForm>({ overall:0, knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, review:"" });
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState<Set<string>>(new Set());
  const [disputeSession, setDisputeSession] = useState<Session | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [newTime, setNewTime] = useState("");

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const [profRes, sessRes, ratingsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("sessions").select(`*, listing:listings(title, format, description), teacher:profiles!sessions_teacher_id_fkey(id, full_name, username, level), learner:profiles!sessions_learner_id_fkey(id, full_name, username, level)`).or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).order("created_at", { ascending: false }),
      supabase.from("ratings").select("session_id").eq("rater_id", user.id),
    ]);
    if (profRes.data) setProfile(profRes.data);
    setSessions(sessRes.data || []);
    setAlreadyRated(new Set((ratingsRes.data || []).map((r: any) => r.session_id)));
    setLoading(false);
  }

  function openMessageWith(otherId: string) {
    sessionStorage.setItem("openMessageWith", otherId);
    window.location.href = "/messages";
  }

  async function handleAccept(session: Session) {
    setActionLoading(session.id + "-accept");
    await supabase.from("sessions").update({ status: "confirmed", confirmed_time: session.proposed_time }).eq("id", session.id);
    try { await supabase.from("notifications").insert({ user_id: session.learner_id, type: "session", title: "Session Confirmed! 🎉", body: `Your session for "${session.listing?.title}" has been confirmed!`, link: "/sessions" }); } catch (_) {}
    showToast("Session accepted! Learner has been notified. 🎉");
    await loadData(); setActionLoading(null);
  }

  async function handleDecline(session: Session) {
    setActionLoading(session.id + "-decline");
    const { data: learnerProf } = await supabase.from("profiles").select("credits").eq("id", session.learner_id).single();
    await supabase.from("profiles").update({ credits: (learnerProf?.credits || 0) + session.credit_amount }).eq("id", session.learner_id);
    await supabase.from("sessions").update({ status: "cancelled" }).eq("id", session.id);
    await supabase.from("escrow").update({ status: "refunded" }).eq("session_id", session.id);
    try {
      await supabase.from("credit_transactions").insert({ user_id: session.learner_id, amount: session.credit_amount, type: "session_refund", reference_id: session.id, description: "Session declined — credits refunded" });
      await supabase.from("notifications").insert({ user_id: session.learner_id, type: "session", title: "Session Declined", body: `${session.credit_amount} credits have been refunded to your wallet.`, link: "/sessions" });
    } catch (_) {}
    showToast(`Session declined. ${session.credit_amount} credits refunded to learner.`);
    await loadData(); setActionLoading(null);
  }

  // ✅ THE FIX: use .select().single() to get FRESH data, not stale React state
  async function handleMarkComplete(session: Session) {
    setActionLoading(session.id + "-complete");
    const isTeacher = profile?.id === session.teacher_id;
    const update = isTeacher ? { teacher_completed: true } : { learner_completed: true };

    const { data: updated, error } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", session.id)
      .select()
      .single();

    if (error || !updated) {
      showToast("Something went wrong. Please try again.", "error");
      setActionLoading(null); return;
    }

    // ✅ Check FRESH DB values — not stale session from state
    const bothDone = updated.teacher_completed && updated.learner_completed;

    if (bothDone) {
      const { data: teacherProf } = await supabase.from("profiles").select("credits").eq("id", session.teacher_id).single();
      const { error: creditError } = await supabase.from("profiles").update({ credits: (teacherProf?.credits || 0) + session.credit_amount }).eq("id", session.teacher_id);
      if (creditError) { showToast("Error releasing credits. Please contact support.", "error"); setActionLoading(null); return; }
      await supabase.from("sessions").update({ status: "completed" }).eq("id", session.id);
      await supabase.from("escrow").update({ status: "released" }).eq("session_id", session.id);
      try {
        await supabase.rpc("increment_xp", { user_id: session.teacher_id, amount: 50 });
        await supabase.rpc("increment_xp", { user_id: session.learner_id, amount: 20 });
        await supabase.from("credit_transactions").insert({ user_id: session.teacher_id, amount: session.credit_amount, type: "session_earn", reference_id: session.id, description: `Session completed — ${session.credit_amount} credits released from escrow` });
        await supabase.from("notifications").insert([
          { user_id: session.teacher_id, type: "credit", title: `💰 ${session.credit_amount} credits received!`, body: `Credits released for completing "${session.listing?.title}". Check your wallet!`, link: "/wallet" },
          { user_id: session.learner_id, type: "session", title: "Session Complete! ⭐ Rate your teacher", body: `Leave a review for your session on "${session.listing?.title}"`, link: "/sessions" },
        ]);
      } catch (_) {}
      showToast(`🎉 Session complete! ${session.credit_amount} credits released to teacher!`);
    } else {
      const otherUserId = isTeacher ? session.learner_id : session.teacher_id;
      try { await supabase.from("notifications").insert({ user_id: otherUserId, type: "session", title: "Please confirm session complete ✅", body: `The ${isTeacher ? "teacher" : "learner"} has marked the session as done. Confirm to release credits!`, link: "/sessions" }); } catch (_) {}
      showToast(`✅ Marked as complete! Waiting for ${isTeacher ? "learner" : "teacher"} to confirm...`);
    }

    await loadData(); setActionLoading(null);
    if (bothDone) { setRatingSession(updated as Session); setRatingSubmitted(false); setRatingForm({ overall:0, knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, review:"" }); }
  }

  async function handleSubmitRating() {
    if (!ratingSession || !profile || ratingForm.overall === 0) return;
    setActionLoading("rating");
    const isTeacher = profile.id === ratingSession.teacher_id;
    const ratedId = isTeacher ? ratingSession.learner_id : ratingSession.teacher_id;
    try {
      await supabase.from("ratings").insert({ session_id: ratingSession.id, rater_id: profile.id, rated_id: ratedId, overall: ratingForm.overall, knowledge: !isTeacher ? ratingForm.knowledge : null, communication: ratingForm.communication, punctuality: !isTeacher ? ratingForm.punctuality : null, preparedness: isTeacher ? ratingForm.preparedness : null, respectfulness: isTeacher ? ratingForm.respectfulness : null, review: ratingForm.review, is_revealed: false });
      setAlreadyRated(prev => new Set([...prev, ratingSession.id]));
      setRatingSubmitted(true);
    } catch (_) {}
    setActionLoading(null);
  }

  async function handleDispute() {
    if (!disputeSession || !profile || disputeReason.length < 10) return;
    setActionLoading("dispute");
    await supabase.from("sessions").update({ status: "disputed" }).eq("id", disputeSession.id);
    await supabase.from("escrow").update({ status: "disputed" }).eq("session_id", disputeSession.id);
    const otherId = disputeSession.teacher_id === profile.id ? disputeSession.learner_id : disputeSession.teacher_id;
    try { await supabase.from("notifications").insert([{ user_id: otherId, type: "dispute", title: "⚠️ Dispute Raised", body: "A dispute has been raised for your session.", link: "/sessions" }, { user_id: profile.id, type: "dispute", title: "Dispute Submitted", body: "Your dispute is under review.", link: "/sessions" }]); } catch (_) {}
    setDisputeSession(null); setDisputeReason("");
    showToast("Dispute submitted. A moderator will review within 48 hours.");
    await loadData(); setActionLoading(null);
  }

  async function handleReschedule() {
    if (!rescheduleSession || !newTime) return;
    setActionLoading("reschedule");
    await supabase.from("sessions").update({ proposed_time: newTime, status: "pending", confirmed_time: null, teacher_completed: false, learner_completed: false }).eq("id", rescheduleSession.id);
    try { const otherId = rescheduleSession.teacher_id === profile?.id ? rescheduleSession.learner_id : rescheduleSession.teacher_id; await supabase.from("notifications").insert({ user_id: otherId, type: "session", title: "Session Rescheduled 📅", body: `Your session "${rescheduleSession.listing?.title}" has been rescheduled. Please re-confirm.`, link: "/sessions" }); } catch (_) {}
    setRescheduleSession(null); setNewTime("");
    showToast("Session rescheduled! The other party has been notified.");
    await loadData(); setActionLoading(null);
  }

  const filtered = sessions.filter(s => {
    const roleOk = tab === "all" || (tab === "teaching" && s.teacher_id === profile?.id) || (tab === "learning" && s.learner_id === profile?.id);
    const statusOk = statusFilter === "all" || s.status === statusFilter;
    return roleOk && statusOk;
  });
  const stats = { total: sessions.length, pending: sessions.filter(s => s.status === "pending").length, upcoming: sessions.filter(s => s.status === "confirmed").length, completed: sessions.filter(s => s.status === "completed").length, disputed: sessions.filter(s => s.status === "disputed").length };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "2.5px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#aaa", fontSize: 13 }}>Loading sessions...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } a { text-decoration: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .session-card { transition: box-shadow 0.15s, transform 0.15s; }
        .session-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .action-btn { transition: all 0.12s; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .action-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .tab-btn { transition: all 0.12s; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; }
        .nav-link { padding: 6px 12px; border-radius: 8px; color: #555; font-size: 13px; font-weight: 600; transition: background 0.12s; text-decoration: none; display: inline-block; }
        .nav-link:hover { background: #f5f0e8; color: #333; }
        .nav-link.active { background: #e8f4e8; color: #2d6a4f; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: toast.type === "success" ? "#2d6a4f" : "#dc2626", color: "white", padding: "14px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", maxWidth: 360, animation: "fadeUp 0.3s ease" }}>
          {toast.msg}
        </div>
      )}

      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className={`nav-link ${h === "/sessions" ? "active" : ""}`}>{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{getInitials(profile?.full_name || "")}</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-0.5px" }}>My Sessions</h1>
          <p style={{ color: "#aaa", marginTop: 6, fontSize: 14 }}>Manage your bookings, confirm completion, and communicate with your partner.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
          {[{label:"Total",val:stats.total,color:"#555",bg:"#fff"},{label:"Pending",val:stats.pending,color:"#92400e",bg:"#fffbeb"},{label:"Upcoming",val:stats.upcoming,color:"#1e40af",bg:"#eff6ff"},{label:"Completed",val:stats.completed,color:"#166534",bg:"#f0fdf4"},{label:"Disputed",val:stats.disputed,color:"#6d28d9",bg:"#faf5ff"}].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", border: "1.5px solid #e8e2d9", textAlign: "center", cursor: "pointer" }}
              onClick={() => setStatusFilter(s.label.toLowerCase() === "upcoming" ? "confirmed" : s.label.toLowerCase() === "total" ? "all" : s.label.toLowerCase())}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", background: "#f0ece4", padding: 3, borderRadius: 10, gap: 2 }}>
            {(["all","teaching","learning"] as const).map(t => (
              <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1a1a1a" : "#888", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                {t === "all" ? "All" : t === "teaching" ? "🎓 Teaching" : "📚 Learning"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["all","pending","confirmed","completed","cancelled","disputed"].map(s => (
              <button key={s} className="tab-btn" onClick={() => setStatusFilter(s)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusFilter === s ? "#1a1a1a" : "#fff", color: statusFilter === s ? "#fff" : "#888", border: `1.5px solid ${statusFilter === s ? "#1a1a1a" : "#e8e2d9"}` }}>
                {s === "all" ? "All Status" : s === "confirmed" ? "Upcoming" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {stats.pending > 0 && tab !== "learning" && (
          <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span>⏳</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>You have {stats.pending} pending session request{stats.pending > 1 ? "s" : ""} — Accept or decline below</span>
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "56px 20px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>No sessions found</div>
            <p style={{ color: "#aaa", fontSize: 13, marginBottom: 20 }}>{tab === "teaching" ? "No one has booked a session with you yet." : tab === "learning" ? "You haven't booked any sessions yet." : "No sessions match your filters."}</p>
            <a href="/listings" style={{ display: "inline-block", padding: "10px 24px", background: "#2d6a4f", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>Browse Skills →</a>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((session, idx) => {
            const isTeacher = session.teacher_id === profile?.id;
            const other = isTeacher ? session.learner : session.teacher;
            const otherId = isTeacher ? session.learner_id : session.teacher_id;
            const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending;
            const myDone = isTeacher ? session.teacher_completed : session.learner_completed;
            const otherDone = isTeacher ? session.learner_completed : session.teacher_completed;
            const isExpanded = expandedId === session.id;
            const hasRated = alreadyRated.has(session.id);

            return (
              <div key={session.id} className="session-card" style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", overflow: "hidden", animation: `fadeUp 0.4s ${idx * 0.04}s ease both` }}>
                <div style={{ height: 3, background: cfg.dot }} />
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #f5f0e8" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: LEVEL_COLORS[other?.level || "Seedling"] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{getInitials(other?.full_name || "?")}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{other?.full_name || "Unknown"}</span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>@{other?.username}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: isTeacher ? "#e0f2fe" : "#f0fdf4", color: isTeacher ? "#0369a1" : "#166534" }}>{isTeacher ? "Your Learner" : "Your Teacher"}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#333", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.listing?.title || "Untitled Session"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>{FORMAT_ICONS[session.listing?.format || "mixed"]} {FORMAT_LABELS[session.listing?.format || "mixed"]}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#2d6a4f", fontFamily: "'Fraunces', serif" }}>{session.credit_amount} cr</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.icon} {cfg.label}</span>
                    <button onClick={() => setExpandedId(isExpanded ? null : session.id)} style={{ width: 28, height: 28, borderRadius: "50%", background: "#f5f0e8", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</button>
                  </div>
                </div>

                <div style={{ padding: "14px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12, color: "#aaa", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>Scheduled</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>
                      📅 {formatDate(session.proposed_time)}
                      {session.status === "confirmed" && <span style={{ marginLeft: 8, fontSize: 11, color: "#2d6a4f", fontWeight: 700, background: "#e8f4e8", padding: "1px 7px", borderRadius: 999 }}>{timeFromNow(session.proposed_time)}</span>}
                    </div>
                    {session.learner_note && <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontStyle: "italic" }}>💬 "{session.learner_note}"</div>}
                  </div>

                  {(session.status === "confirmed" || session.status === "completed") && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600 }}>Confirmed by:</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: session.teacher_completed ? "#f0fdf4" : "#f5f0e8", color: session.teacher_completed ? "#166534" : "#bbb", border: `1px solid ${session.teacher_completed ? "#bbf7d0" : "#e8e2d9"}` }}>Teacher {session.teacher_completed ? "✓" : "○"}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: session.learner_completed ? "#f0fdf4" : "#f5f0e8", color: session.learner_completed ? "#166534" : "#bbb", border: `1px solid ${session.learner_completed ? "#bbf7d0" : "#e8e2d9"}` }}>Learner {session.learner_completed ? "✓" : "○"}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={() => openMessageWith(otherId)} className="action-btn" style={{ padding: "8px 16px", borderRadius: 9, background: "#2d6a4f", color: "#fff", fontSize: 12, fontWeight: 700, border: "none" }}>
                      💬 Message {isTeacher ? "Learner" : "Teacher"}
                    </button>
                    {session.status === "pending" && isTeacher && (<>
                      <button onClick={() => handleAccept(session)} disabled={!!actionLoading} className="action-btn" style={{ padding: "8px 16px", borderRadius: 9, background: "#166534", color: "#fff", fontSize: 12, fontWeight: 700, border: "none" }}>{actionLoading === session.id + "-accept" ? "..." : "✅ Accept"}</button>
                      <button onClick={() => handleDecline(session)} disabled={!!actionLoading} className="action-btn" style={{ padding: "8px 16px", borderRadius: 9, background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 700, border: "none" }}>{actionLoading === session.id + "-decline" ? "..." : "✕ Decline"}</button>
                    </>)}
                    {session.status === "pending" && !isTeacher && (<span style={{ fontSize: 11, fontWeight: 600, color: "#92400e", background: "#fffbeb", padding: "6px 12px", borderRadius: 9, border: "1px solid #fde68a" }}>⏳ Awaiting teacher response</span>)}
                    {session.status === "confirmed" && !myDone && (
                      <button onClick={() => handleMarkComplete(session)} disabled={!!actionLoading} className="action-btn" style={{ padding: "8px 16px", borderRadius: 9, background: "#1e40af", color: "#fff", fontSize: 12, fontWeight: 700, border: "none" }}>{actionLoading === session.id + "-complete" ? "..." : "✓ Mark Complete"}</button>
                    )}
                    {session.status === "confirmed" && myDone && !otherDone && (<span style={{ fontSize: 11, fontWeight: 600, color: "#166534", background: "#f0fdf4", padding: "6px 12px", borderRadius: 9, border: "1px solid #bbf7d0" }}>✅ Waiting for other party</span>)}
                    {session.status === "confirmed" && (<>
                      <button onClick={() => { setRescheduleSession(session); setNewTime(session.proposed_time.slice(0, 16)); }} className="action-btn" style={{ padding: "8px 12px", borderRadius: 9, background: "#f5f0e8", color: "#555", fontSize: 12, fontWeight: 600, border: "1.5px solid #e8e2d9" }}>📅 Reschedule</button>
                      <button onClick={() => setDisputeSession(session)} className="action-btn" style={{ padding: "8px 12px", borderRadius: 9, background: "#faf5ff", color: "#7c3aed", fontSize: 12, fontWeight: 700, border: "1.5px solid #e9d5ff" }}>⚠️ Dispute</button>
                    </>)}
                    {session.status === "completed" && !hasRated && (
                      <button onClick={() => { setRatingSession(session); setRatingSubmitted(false); setRatingForm({ overall:0, knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, review:"" }); }} className="action-btn" style={{ padding: "8px 16px", borderRadius: 9, background: "#f59e0b", color: "#fff", fontSize: 12, fontWeight: 700, border: "none" }}>⭐ Leave Review</button>
                    )}
                    {session.status === "completed" && hasRated && (<span style={{ fontSize: 11, fontWeight: 600, color: "#166634", background: "#f0fdf4", padding: "6px 12px", borderRadius: 9, border: "1px solid #bbf7d0" }}>⭐ Reviewed</span>)}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "14px 20px", borderTop: "1px solid #f5f0e8", background: "#fafdf8" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Session Details</div>
                        <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                          <div>📋 <b>Format:</b> {FORMAT_LABELS[session.listing?.format || "mixed"]}</div>
                          <div>💰 <b>Credits:</b> {session.credit_amount} cr (₱{session.credit_amount * 10})</div>
                          <div>🕐 <b>Booked:</b> {formatDate(session.created_at)}</div>
                          <div>🔖 <b>Status:</b> {cfg.label}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick Actions</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <a href={`/listings/${session.listing_id}`} style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 600 }}>📚 View Listing →</a>
                          <button onClick={() => openMessageWith(otherId)} style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>💬 Open full conversation →</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {ratingSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            {ratingSubmitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>🌟</div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Review Submitted!</h2>
                <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Both ratings reveal once the other party submits.</p>
                <button onClick={() => setRatingSession(null)} style={{ padding: "10px 28px", background: "#2d6a4f", color: "#fff", borderRadius: 10, border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900 }}>Rate this Session</h2>
                  <button onClick={() => setRatingSession(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#bbb" }}>✕</button>
                </div>
                <p style={{ color: "#aaa", fontSize: 12, marginBottom: 20 }}>🔒 Double-blind — neither party sees ratings until both submit.</p>
                {(profile?.id === ratingSession.teacher_id
                  ? [{key:"overall",label:"Overall Experience"},{key:"preparedness",label:"Learner Preparedness"},{key:"respectfulness",label:"Respectfulness"},{key:"communication",label:"Communication"}]
                  : [{key:"overall",label:"Overall Experience"},{key:"knowledge",label:"Knowledge & Expertise"},{key:"communication",label:"Communication"},{key:"punctuality",label:"Punctuality"}]
                ).map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>{label}</div>
                    <StarRating value={ratingForm[key as keyof RatingForm] as number} onChange={v => setRatingForm(f => ({ ...f, [key]: v }))} />
                  </div>
                ))}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>Written Review <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></div>
                  <textarea value={ratingForm.review} onChange={e => setRatingForm(f => ({ ...f, review: e.target.value.slice(0, 300) }))} placeholder="Share your experience…" style={{ width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical" }} />
                  <div style={{ fontSize: 10, color: "#bbb", textAlign: "right" }}>{ratingForm.review.length}/300</div>
                </div>
                <button onClick={handleSubmitRating} disabled={ratingForm.overall === 0 || !!actionLoading} style={{ width: "100%", padding: "12px", borderRadius: 11, background: ratingForm.overall === 0 ? "#e8e2d9" : "#2d6a4f", color: ratingForm.overall === 0 ? "#aaa" : "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: ratingForm.overall === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {actionLoading === "rating" ? "Submitting…" : "Submit Review ⭐"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {rescheduleSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 400, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900 }}>📅 Reschedule Session</h2>
              <button onClick={() => setRescheduleSession(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#bbb" }}>✕</button>
            </div>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Rescheduling resets the session to pending and notifies the other party.</p>
            <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 8 }}>New Date & Time</label>
            <input type="datetime-local" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRescheduleSession(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f5f0e8", color: "#555", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleReschedule} disabled={!newTime || !!actionLoading} style={{ flex: 1, padding: "10px", borderRadius: 10, background: newTime ? "#2d6a4f" : "#e8e2d9", color: newTime ? "#fff" : "#aaa", fontWeight: 700, fontSize: 13, border: "none", cursor: newTime ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>{actionLoading === "reschedule" ? "Saving..." : "Confirm Reschedule"}</button>
            </div>
          </div>
        </div>
      )}

      {disputeSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#6d28d9" }}>⚠️ Raise a Dispute</h2>
              <button onClick={() => setDisputeSession(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#bbb" }}>✕</button>
            </div>
            <p style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Credits will be frozen in escrow until a moderator resolves this within 48 hours.</p>
            <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} placeholder="Describe what went wrong in detail…" style={{ width: "100%", minHeight: 100, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDisputeSession(null)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f5f0e8", color: "#555", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={handleDispute} disabled={disputeReason.length < 10 || !!actionLoading} style={{ flex: 1, padding: "10px", borderRadius: 10, background: disputeReason.length < 10 ? "#e8e2d9" : "#7c3aed", color: disputeReason.length < 10 ? "#aaa" : "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: disputeReason.length < 10 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>{actionLoading === "dispute" ? "Submitting…" : "Submit Dispute"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}