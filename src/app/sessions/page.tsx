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
  listing?: { title: string; format: string };
  teacher?: { full_name: string; username: string; credits: number };
  learner?: { full_name: string; username: string; credits: number };
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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: "Pending",   color: "#b45309", bg: "#fef3c7", icon: "⏳" },
  confirmed: { label: "Confirmed", color: "#1d4ed8", bg: "#dbeafe", icon: "✅" },
  completed: { label: "Completed", color: "#166534", bg: "#dcfce7", icon: "🎉" },
  cancelled: { label: "Cancelled", color: "#991b1b", bg: "#fee2e2", icon: "❌" },
  disputed:  { label: "Disputed",  color: "#7c3aed", bg: "#ede9fe", icon: "⚠️" },
};

const FORMAT_ICONS: Record<string, string> = {
  video: "🎥", chat: "💬", docs: "📄", mixed: "🔀",
};

function StarRating({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHover(i + 1)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontSize: 22, color: (hover || value) > i ? "#f59e0b" : "#d1d5db",
            transition: "color 0.1s",
          }}
        >★</button>
      ))}
    </div>
  );
}

export default function SessionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<"all" | "teaching" | "learning">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rating modal
  const [ratingSession, setRatingSession] = useState<Session | null>(null);
  const [ratingForm, setRatingForm] = useState<RatingForm>({
    overall: 0, knowledge: 0, communication: 0, punctuality: 0,
    preparedness: 0, respectfulness: 0, review: "",
  });
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Dispute modal
  const [disputeSession, setDisputeSession] = useState<Session | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(prof);

    // Load sessions where user is teacher or learner
    const { data: rawSessions } = await supabase
      .from("sessions")
      .select(`
        *,
        listing:listings(title, format),
        teacher:profiles!sessions_teacher_id_fkey(full_name, username, credits),
        learner:profiles!sessions_learner_id_fkey(full_name, username, credits)
      `)
      .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    setSessions(rawSessions || []);
    setLoading(false);
  }

  async function handleAccept(session: Session) {
    setActionLoading(session.id + "-accept");
    await supabase
      .from("sessions")
      .update({ status: "confirmed", confirmed_time: session.proposed_time })
      .eq("id", session.id);

    // Notify learner
    await supabase.from("notifications").insert({
      user_id: session.learner_id,
      type: "session",
      title: "Session Confirmed! 🎉",
      body: `Your session has been confirmed. Get ready!`,
      link: `/sessions`,
    });

    await loadData();
    setActionLoading(null);
  }

  async function handleDecline(session: Session) {
    setActionLoading(session.id + "-decline");
    // Refund learner
    await supabase.from("profiles")
      .update({ credits: (profile?.credits || 0) + session.credit_amount })
      .eq("id", session.learner_id);

    await supabase.from("sessions")
      .update({ status: "cancelled" })
      .eq("id", session.id);

    await supabase.from("escrow")
      .update({ status: "refunded" })
      .eq("session_id", session.id);

    await supabase.from("credit_transactions").insert({
      user_id: session.learner_id,
      amount: session.credit_amount,
      type: "session_refund",
      reference_id: session.id,
      description: "Session declined — credits refunded",
    });

    await supabase.from("notifications").insert({
      user_id: session.learner_id,
      type: "session",
      title: "Session Declined",
      body: `Your session was declined. ${session.credit_amount} credits have been refunded.`,
      link: `/sessions`,
    });

    await loadData();
    setActionLoading(null);
  }

  async function handleMarkComplete(session: Session) {
    setActionLoading(session.id + "-complete");
    const { data: { user } } = await supabase.auth.getUser();
    const isTeacher = user?.id === session.teacher_id;

    const update = isTeacher
      ? { teacher_completed: true }
      : { learner_completed: true };

    const { data: updated } = await supabase
      .from("sessions")
      .update(update)
      .eq("id", session.id)
      .select()
      .single();

    // Both confirmed → release escrow
    if (
      (isTeacher && session.learner_completed) ||
      (!isTeacher && session.teacher_completed)
    ) {
      // Pay teacher
      const { data: teacherProf } = await supabase
        .from("profiles").select("credits").eq("id", session.teacher_id).single();
      await supabase.from("profiles")
        .update({ credits: (teacherProf?.credits || 0) + session.credit_amount, xp: supabase.rpc as any })
        .eq("id", session.teacher_id);

      // Simple XP update
      await supabase.rpc("increment_xp", { user_id: session.teacher_id, amount: 50 });
      await supabase.rpc("increment_xp", { user_id: session.learner_id, amount: 20 });
      await supabase.from("sessions")
        .update({ status: "completed" })
        .eq("id", session.id);

      await supabase.from("escrow")
        .update({ status: "released", released_at: new Date().toISOString() })
        .eq("session_id", session.id);

      await supabase.from("credit_transactions").insert({
        user_id: session.teacher_id,
        amount: session.credit_amount,
        type: "session_earn",
        reference_id: session.id,
        description: `Session completed — credits received`,
      });

      // Notify both to rate
      await supabase.from("notifications").insert([
        {
          user_id: session.teacher_id,
          type: "session",
          title: "Session Complete! Rate your learner 🌟",
          body: `Leave a review to help the community.`,
          link: `/sessions`,
        },
        {
          user_id: session.learner_id,
          type: "session",
          title: "Session Complete! Rate your teacher 🌟",
          body: `Leave a review to help the community.`,
          link: `/sessions`,
        },
      ]);
    }

    await loadData();
    setActionLoading(null);
    // Open rating modal
    setRatingSession(updated || session);
  }

  async function handleSubmitRating() {
    if (!ratingSession || !profile) return;
    setActionLoading("rating");

    const isTeacher = profile.id === ratingSession.teacher_id;
    const ratedId = isTeacher ? ratingSession.learner_id : ratingSession.teacher_id;

    await supabase.from("ratings").insert({
      session_id: ratingSession.id,
      rater_id: profile.id,
      rated_id: ratedId,
      overall: ratingForm.overall,
      knowledge: isTeacher ? null : ratingForm.knowledge,
      communication: ratingForm.communication,
      punctuality: isTeacher ? null : ratingForm.punctuality,
      preparedness: isTeacher ? ratingForm.preparedness : null,
      respectfulness: isTeacher ? ratingForm.respectfulness : null,
      review: ratingForm.review,
      is_revealed: false,
    });

    setRatingSubmitted(true);
    setActionLoading(null);
  }

  async function handleDispute() {
    if (!disputeSession || !profile) return;
    setActionLoading("dispute");

    await supabase.from("sessions")
      .update({ status: "disputed" })
      .eq("id", disputeSession.id);

    await supabase.from("escrow")
      .update({ status: "disputed" })
      .eq("session_id", disputeSession.id);

    await supabase.from("notifications").insert({
      user_id: disputeSession.teacher_id === profile.id ? disputeSession.learner_id : disputeSession.teacher_id,
      type: "dispute",
      title: "⚠️ Dispute Raised",
      body: `A dispute has been opened for your session. A moderator will review within 48 hours.`,
      link: `/sessions`,
    });

    setDisputeSession(null);
    setDisputeReason("");
    await loadData();
    setActionLoading(null);
  }

  const filteredSessions = sessions.filter(s => {
    if (tab === "teaching") return s.teacher_id === profile?.id;
    if (tab === "learning") return s.learner_id === profile?.id;
    return true;
  });

  const stats = {
    total: sessions.length,
    upcoming: sessions.filter(s => s.status === "confirmed").length,
    pending: sessions.filter(s => s.status === "pending").length,
    completed: sessions.filter(s => s.status === "completed").length,
  };

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  function getInitials(name: string) {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  }

  const LEVEL_COLORS: Record<string, string> = {
    Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
    Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 1s linear infinite" }}>⏳</div>
          <div style={{ color: "#666", fontSize: 15 }}>Loading your sessions…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .session-card { transition: box-shadow 0.2s, transform 0.2s; }
        .session-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10); transform: translateY(-2px); }
        .tab-btn { transition: all 0.15s; cursor: pointer; border: none; }
        .action-btn { transition: all 0.15s; cursor: pointer; }
        .action-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .action-btn:active { transform: translateY(0); }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 14px", borderRadius: 8, color: href === "/sessions" ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: href === "/sessions" ? 700 : 600, textDecoration: "none", background: href === "/sessions" ? "#e8f4e8" : "transparent" }}>
              {label}
            </a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
            {getInitials(profile?.full_name || "")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>
            {profile?.credits} cr
          </span>
        </a>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>
            My Sessions
          </h1>
          <p style={{ color: "#666", marginTop: 6, fontSize: 15 }}>
            Track your teaching and learning sessions, manage bookings, and release payments.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Total", value: stats.total, color: "#1a1a1a", bg: "#fff", icon: "📋" },
            { label: "Pending", value: stats.pending, color: "#b45309", bg: "#fef3c7", icon: "⏳" },
            { label: "Upcoming", value: stats.upcoming, color: "#1d4ed8", bg: "#dbeafe", icon: "📅" },
            { label: "Completed", value: stats.completed, color: "#166534", bg: "#dcfce7", icon: "🎉" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 20px", border: "1.5px solid #e8e2d9" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "#f0ece4", padding: 4, borderRadius: 12, width: "fit-content" }}>
          {(["all", "teaching", "learning"] as const).map(t => (
            <button
              key={t}
              className="tab-btn"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "#1a1a1a" : "#888",
                boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {t === "all" ? "All Sessions" : t === "teaching" ? "🎓 Teaching" : "📚 Learning"}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filteredSessions.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
              No sessions yet
            </div>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>
              {tab === "teaching" ? "No one has booked a session with you yet." : tab === "learning" ? "You haven't booked any sessions yet." : "You have no sessions yet."}
            </p>
            <a href="/listings" style={{ display: "inline-block", padding: "10px 24px", background: "#2d6a4f", color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              Browse Skills →
            </a>
          </div>
        )}

        {/* Session cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredSessions.map(session => {
            const isTeacher = session.teacher_id === profile?.id;
            const other = isTeacher ? session.learner : session.teacher;
            const statusCfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending;
            const myCompleted = isTeacher ? session.teacher_completed : session.learner_completed;
            const otherCompleted = isTeacher ? session.learner_completed : session.teacher_completed;

            return (
              <div
                key={session.id}
                className="session-card"
                style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", overflow: "hidden" }}
              >
                {/* Card header */}
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #f0ece4", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Role badge */}
                    <div style={{ padding: "4px 12px", borderRadius: 20, background: isTeacher ? "#e8f4e8" : "#dbeafe", color: isTeacher ? "#2d6a4f" : "#1d4ed8", fontSize: 12, fontWeight: 700 }}>
                      {isTeacher ? "🎓 Teaching" : "📚 Learning"}
                    </div>
                    {/* Format */}
                    <div style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
                      {FORMAT_ICONS[session.listing?.format || "mixed"]} {session.listing?.format ? session.listing.format.charAt(0).toUpperCase() + session.listing.format.slice(1) : "Mixed"}
                    </div>
                    {/* Status */}
                    <div style={{ padding: "4px 12px", borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontSize: 12, fontWeight: 700 }}>
                      {statusCfg.icon} {statusCfg.label}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#2d6a4f", fontFamily: "'Fraunces', serif" }}>
                    {session.credit_amount} cr
                    <span style={{ fontSize: 12, color: "#aaa", fontWeight: 500, marginLeft: 4 }}>₱{session.credit_amount * 10}</span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "18px 24px", display: "flex", gap: 20, alignItems: "flex-start" }}>
                  {/* Other person */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                      {getInitials(other?.full_name || "?")}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{other?.full_name || "Unknown"}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>@{other?.username || "—"}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{isTeacher ? "Learner" : "Teacher"}</div>
                    </div>
                  </div>

                  {/* Session info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
                      {session.listing?.title || "Untitled Session"}
                    </div>
                    <div style={{ fontSize: 13, color: "#666", marginBottom: session.learner_note ? 8 : 0 }}>
                      📅 {formatDate(session.proposed_time)}
                    </div>
                    {session.learner_note && (
                      <div style={{ fontSize: 13, color: "#555", background: "#f8f6f2", padding: "8px 12px", borderRadius: 8, marginTop: 6, fontStyle: "italic" }}>
                        "{session.learner_note}"
                      </div>
                    )}

                    {/* Completion progress for confirmed sessions */}
                    {session.status === "confirmed" && (
                      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#888" }}>Completion:</div>
                        <div style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: session.teacher_completed ? "#dcfce7" : "#f0ece4", color: session.teacher_completed ? "#166534" : "#aaa" }}>
                          Teacher {session.teacher_completed ? "✓" : "○"}
                        </div>
                        <div style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: session.learner_completed ? "#dcfce7" : "#f0ece4", color: session.learner_completed ? "#166534" : "#aaa" }}>
                          Learner {session.learner_completed ? "✓" : "○"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>

                    {/* PENDING — teacher can accept/decline */}
                    {session.status === "pending" && isTeacher && (
                      <>
                        <button
                          className="action-btn"
                          onClick={() => handleAccept(session)}
                          disabled={!!actionLoading}
                          style={{ padding: "9px 18px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, border: "none" }}
                        >
                          {actionLoading === session.id + "-accept" ? "..." : "✅ Accept"}
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => handleDecline(session)}
                          disabled={!!actionLoading}
                          style={{ padding: "9px 18px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", fontSize: 13, fontWeight: 700, border: "none" }}
                        >
                          {actionLoading === session.id + "-decline" ? "..." : "❌ Decline"}
                        </button>
                      </>
                    )}

                    {/* PENDING — learner waiting */}
                    {session.status === "pending" && !isTeacher && (
                      <div style={{ padding: "9px 16px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                        ⏳ Waiting for teacher
                      </div>
                    )}

                    {/* CONFIRMED — mark complete */}
                    {session.status === "confirmed" && !myCompleted && (
                      <button
                        className="action-btn"
                        onClick={() => handleMarkComplete(session)}
                        disabled={!!actionLoading}
                        style={{ padding: "9px 18px", borderRadius: 10, background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 700, border: "none" }}
                      >
                        {actionLoading === session.id + "-complete" ? "..." : "✓ Mark Complete"}
                      </button>
                    )}

                    {session.status === "confirmed" && myCompleted && !otherCompleted && (
                      <div style={{ padding: "9px 14px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                        ✅ You confirmed<br />
                        <span style={{ fontSize: 11, color: "#888" }}>Waiting for other party</span>
                      </div>
                    )}

                    {/* CONFIRMED — raise dispute */}
                    {session.status === "confirmed" && (
                      <button
                        className="action-btn"
                        onClick={() => setDisputeSession(session)}
                        style={{ padding: "7px 14px", borderRadius: 10, background: "#f5f0e8", color: "#7c3aed", fontSize: 12, fontWeight: 700, border: "1px solid #e8e2d9" }}
                      >
                        ⚠️ Raise Dispute
                      </button>
                    )}

                    {/* COMPLETED — rate if not yet rated */}
                    {session.status === "completed" && (
                      <button
                        className="action-btn"
                        onClick={() => { setRatingSession(session); setRatingSubmitted(false); setRatingForm({ overall: 0, knowledge: 0, communication: 0, punctuality: 0, preparedness: 0, respectfulness: 0, review: "" }); }}
                        style={{ padding: "9px 18px", borderRadius: 10, background: "#f59e0b", color: "#fff", fontSize: 13, fontWeight: 700, border: "none" }}
                      >
                        ⭐ Rate Session
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── RATING MODAL ─── */}
      {ratingSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            {ratingSubmitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🌟</div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Rating Submitted!</h2>
                <p style={{ color: "#666", marginBottom: 24 }}>Your review is saved. Both ratings reveal once the other party rates too.</p>
                <button onClick={() => setRatingSession(null)} style={{ padding: "10px 28px", background: "#2d6a4f", color: "#fff", borderRadius: 10, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, margin: 0 }}>
                    Rate this Session
                  </h2>
                  <button onClick={() => setRatingSession(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
                </div>

                <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
                  🔒 Double-blind — neither party sees ratings until both submit.
                </p>

                {/* Teacher rating a learner */}
                {profile?.id === ratingSession.teacher_id ? (
                  <>
                    {[
                      { key: "overall", label: "Overall Experience" },
                      { key: "preparedness", label: "Preparedness" },
                      { key: "respectfulness", label: "Respectfulness" },
                      { key: "communication", label: "Communication" },
                    ].map(({ key, label }) => (
                      <div key={key} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>{label}</div>
                        <StarRating
                          value={ratingForm[key as keyof RatingForm] as number}
                          onChange={v => setRatingForm(f => ({ ...f, [key]: v }))}
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  /* Learner rating a teacher */
                  <>
                    {[
                      { key: "overall", label: "Overall Experience" },
                      { key: "knowledge", label: "Knowledge & Expertise" },
                      { key: "communication", label: "Communication" },
                      { key: "punctuality", label: "Punctuality" },
                    ].map(({ key, label }) => (
                      <div key={key} style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>{label}</div>
                        <StarRating
                          value={ratingForm[key as keyof RatingForm] as number}
                          onChange={v => setRatingForm(f => ({ ...f, [key]: v }))}
                        />
                      </div>
                    ))}
                  </>
                )}

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 }}>Written Review (optional)</div>
                  <textarea
                    value={ratingForm.review}
                    onChange={e => setRatingForm(f => ({ ...f, review: e.target.value.slice(0, 300) }))}
                    placeholder="Share your experience with the community…"
                    maxLength={300}
                    style={{ width: "100%", minHeight: 80, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none" }}
                  />
                  <div style={{ fontSize: 11, color: "#aaa", textAlign: "right" }}>{ratingForm.review.length}/300</div>
                </div>

                <button
                  onClick={handleSubmitRating}
                  disabled={ratingForm.overall === 0 || !!actionLoading}
                  style={{ width: "100%", padding: "12px", borderRadius: 12, background: ratingForm.overall === 0 ? "#e8e2d9" : "#2d6a4f", color: ratingForm.overall === 0 ? "#aaa" : "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: ratingForm.overall === 0 ? "not-allowed" : "pointer" }}
                >
                  {actionLoading === "rating" ? "Submitting…" : "Submit Rating ⭐"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── DISPUTE MODAL ─── */}
      {disputeSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 440, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, margin: 0, color: "#7c3aed" }}>
                ⚠️ Raise a Dispute
              </h2>
              <button onClick={() => setDisputeSession(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>
            <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
              Credits will remain frozen in escrow until a moderator reviews and resolves this dispute within 48 hours.
            </p>
            <textarea
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              placeholder="Describe what went wrong. Include as much detail as possible — screenshots or evidence can be shared via chat."
              style={{ width: "100%", minHeight: 100, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDisputeSession(null)}
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f5f0e8", color: "#555", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={disputeReason.length < 10 || !!actionLoading}
                style={{ flex: 1, padding: "10px", borderRadius: 10, background: disputeReason.length < 10 ? "#e8e2d9" : "#7c3aed", color: disputeReason.length < 10 ? "#aaa" : "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: disputeReason.length < 10 ? "not-allowed" : "pointer" }}
              >
                {actionLoading === "dispute" ? "Submitting…" : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}