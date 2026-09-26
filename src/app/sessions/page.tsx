"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type SessionProfile = {
  id: string; full_name: string; username: string;
  avatar_url?: string | null;
};

type Session = {
  id: string; listing_id: string; teacher_id: string; learner_id: string;
  proposed_time: string; confirmed_time: string | null; status: string;
  learner_note: string | null; credit_amount: number;
  teacher_completed: boolean; learner_completed: boolean; created_at: string;
  listing?: { title: string; format: string; description?: string; meeting_link?: string | null };
  teacher?: SessionProfile;
  learner?: SessionProfile;
};

type Profile = {
  id: string; full_name: string; username: string; credits: number;
};

type RatingForm = { overall: number; review: string };

// cancel modal context
type CancelContext = {
  session: Session;
  mode: "cancel" | "decline"; // cancel = learner cancels pending, decline = teacher declines
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; badgeBg: string; badgeText: string }> = {
  pending:   { label:"Pending",   dot:"#f59e0b", badgeBg:"#fef3c7", badgeText:"#92400e" },
  confirmed: { label:"Upcoming",  dot:"#3b82f6", badgeBg:"#dbeafe", badgeText:"#1e40af" },
  completed: { label:"Completed", dot:"#22c55e", badgeBg:"#dcfce7", badgeText:"#166534" },
  cancelled: { label:"Cancelled", dot:"#ef4444", badgeBg:"#fee2e2", badgeText:"#991b1b" },
  disputed:  { label:"Disputed",  dot:"#a855f7", badgeBg:"#ede9fe", badgeText:"#6d28d9" },
};
const FORMAT_LABELS: Record<string, string> = { video:"Video", chat:"Chat", docs:"Docs", mixed:"Mixed" };
const PROFILE_FIELDS = "id,full_name,username,avatar_url";

// Quick-pick cancel reasons
const CANCEL_REASONS_LEARNER = [
  "Schedule conflict — can't make it",
  "Found another teacher",
  "Personal emergency",
  "Made a booking mistake",
];
const CANCEL_REASONS_TEACHER = [
  "I'm unavailable at this time",
  "Topic is outside my expertise",
  "Personal emergency",
  "Please rebook at a different time",
  "Technical issues on my end",
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) || "?";
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit", hour12:true });
}
function timeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff); const past = diff < 0;
  if (abs < 3_600_000)  return `${past?"":"in "}${Math.round(abs/60_000)}m${past?" ago":""}`;
  if (abs < 86_400_000) return `${past?"":"in "}${Math.round(abs/3_600_000)}h${past?" ago":""}`;
  return `${past?"":"in "}${Math.round(abs/86_400_000)}d${past?" ago":""}`;
}

// ─── AVATAR ───────────────────────────────────────────────────────────────────
function SessionAvatar({ profile, size = 40, statusDot }: {
  profile: { full_name: string; avatar_url?: string | null };
  size?: number; statusDot?: string;
}) {
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size, borderRadius:"50%" }}>
      <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", background:"#2d6a4f",
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.34, fontWeight:800, color:"#fff" }}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.full_name} style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
          : getInitials(profile.full_name)}
      </div>
      {statusDot && <div style={{ position:"absolute", bottom:-1, right:-1, width:size*.3, height:size*.3, borderRadius:"50%", background:statusDot, border:"2px solid #fff" }} />}
    </div>
  );
}

// ─── STAR PICKER ─────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button key={i} onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          className="bg-transparent border-0 cursor-pointer p-0.5 text-3xl leading-none transition-transform hover:scale-110"
          style={{ color:(hover||value)>=i?"#f59e0b":"#e5e7eb" }}>★</button>
      ))}
    </div>
  );
}
function Stars({ value }: { value: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} className="text-sm" style={{ color:i<=Math.round(value)?"#f59e0b":"#e5e7eb" }}>★</span>)}</span>;
}

// ─── MEETING LINK ─────────────────────────────────────────────────────────────
function MeetingLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const icon  = url.includes("meet.google")?"🎥":url.includes("zoom.us")?"💙":url.includes("discord.gg")?"💜":url.includes("teams.micro")?"🔵":"🔗";
  const label = url.includes("meet.google")?"Google Meet":url.includes("zoom.us")?"Zoom":url.includes("discord.gg")?"Discord":url.includes("teams.micro")?"Teams":"Join Meeting";
  const copyLink = async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 border border-sky-200 rounded-2xl">
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-sky-800 mb-0.5">Session Link</p>
        <p className="text-xs text-sky-500 truncate font-medium">{url.replace(/^https?:\/\//,"").slice(0,40)}…</p>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-black no-underline hover:bg-sky-700 transition-colors flex items-center gap-1.5">
          {icon} Join {label}
        </a>
        <button onClick={copyLink}
          className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-colors cursor-pointer ${copied?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-white text-stone-500 border-stone-200 hover:bg-stone-50"}`}>
          {copied?"✓ Copied":"Copy"}
        </button>
      </div>
    </div>
  );
}

// ─── CANCEL MODAL ─────────────────────────────────────────────────────────────
function CancelModal({
  ctx, profile, onClose, onConfirm, loading,
}: {
  ctx: CancelContext;
  profile: Profile;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  const isDecline = ctx.mode === "decline";
  const other = isDecline ? ctx.session.learner : ctx.session.teacher;
  const quickReasons = isDecline ? CANCEL_REASONS_TEACHER : CANCEL_REASONS_LEARNER;
  const canSubmit = reason.trim().length >= 5;

  return (
    <div className="overlay-anim fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5 backdrop-blur-sm">
      <div className="modal-anim bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">

        <div style={{ background: isDecline ? "linear-gradient(135deg,#fef2f2,#fff)" : "linear-gradient(135deg,#fff7ed,#fff)", borderBottom:"1px solid #f0ece4" }}
          className="px-7 py-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-900 text-stone-900 mb-1" style={{ fontFamily:"'Fraunces',serif", fontSize:20 }}>
              {isDecline ? "❌ Decline Session" : "🚫 Cancel Booking"}
            </h2>
            <p className="text-xs text-stone-500 font-500 leading-relaxed">
              {isDecline
                ? `Your reason will be sent as a message to ${other?.full_name || "the learner"} and they'll be refunded.`
                : `Your reason will be sent as a message to ${other?.full_name || "the teacher"} and your credits will be refunded.`}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:bg-stone-200 transition-colors text-sm">✕</button>
        </div>

        <div className="px-7 py-6 flex flex-col gap-5">

          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3">
            {other && <SessionAvatar profile={other} size={32} />}
            <div className="min-w-0">
              <p className="text-xs font-800 text-stone-800 truncate">{ctx.session.listing?.title || "Untitled Session"}</p>
              <p className="text-xs text-stone-400 font-500">with {other?.full_name} · {ctx.session.credit_amount} cr</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-700 text-stone-500 uppercase tracking-wider mb-3">Quick reasons</p>
            <div className="flex flex-wrap gap-2">
              {quickReasons.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className="text-xs font-600 px-3 py-1.5 rounded-full border transition-all cursor-pointer"
                  style={{
                    background: reason === r ? (isDecline ? "#fef2f2" : "#fff7ed") : "#f5f2ec",
                    borderColor: reason === r ? (isDecline ? "#fecaca" : "#fed7aa") : "#e8e0d0",
                    color: reason === r ? (isDecline ? "#dc2626" : "#c2410c") : "#666",
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-700 text-stone-500 uppercase tracking-wider mb-2">Or write your own</p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 300))}
              placeholder={isDecline
                ? "Let the learner know why you're declining…"
                : "Let the teacher know why you're cancelling…"}
              className="w-full min-h-24 p-3.5 rounded-xl border text-sm resize-none outline-none transition-colors"
              style={{
                fontFamily:"'DM Sans',sans-serif",
                borderColor: reason.trim().length >= 5 ? "#2d6a4f" : "#e8e0d0",
                boxShadow: reason.trim().length >= 5 ? "0 0 0 3px rgba(45,106,79,.08)" : "none",
              }}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs font-600" style={{ color: canSubmit ? "#2d6a4f" : "#f59e0b" }}>
                {!canSubmit ? `${Math.max(0, 5 - reason.trim().length)} more characters needed` : "✓ Ready to send"}
              </p>
              <p className="text-xs text-stone-300">{reason.length}/300</p>
            </div>
          </div>

          {canSubmit && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <p className="text-xs font-800 text-green-700 mb-1.5">📨 Message preview</p>
              <p className="text-xs text-green-800 leading-relaxed italic">
                "{profile.full_name} {isDecline ? "declined" : "cancelled"} the session for <strong>{ctx.session.listing?.title}</strong>:{" "}
                {reason.trim()}"
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 font-700 text-sm hover:bg-stone-200 transition-colors">
              Keep Session
            </button>
            <button
              onClick={() => onConfirm(reason.trim())}
              disabled={!canSubmit || loading}
              className="py-3 px-6 rounded-xl font-800 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                flex: 2,
                background: canSubmit ? (isDecline ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#ea580c,#c2410c)") : "#e5e7eb",
                color: canSubmit ? "#fff" : "#9ca3af",
              }}>
              {loading
                ? "Processing…"
                : isDecline
                ? "❌ Decline & Notify"
                : "🚫 Cancel & Notify"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const [profile,           setProfile]           = useState<Profile | null>(null);
  const [sessions,          setSessions]          = useState<Session[]>([]);
  const [tab,               setTab]               = useState<"all"|"teaching"|"learning">("all");
  const [statusFilter,      setStatusFilter]      = useState("all");
  const [loading,           setLoading]           = useState(true);
  const [actionLoading,     setActionLoading]     = useState<string | null>(null);
  const [expandedId,        setExpandedId]        = useState<string | null>(null);
  const [toast,             setToast]             = useState<{ msg: string; type: "success"|"error" } | null>(null);
  const [ratingSession,     setRatingSession]     = useState<Session | null>(null);
  const [ratingForm,        setRatingForm]        = useState<RatingForm>({ overall:0, review:"" });
  const [ratingSubmitted,   setRatingSubmitted]   = useState(false);
  const [ratingError,       setRatingError]       = useState("");
  const [alreadyRated,      setAlreadyRated]      = useState<Set<string>>(new Set());
  const [disputeSession,    setDisputeSession]    = useState<Session | null>(null);
  const [disputeReason,     setDisputeReason]     = useState("");
  const [cancelCtx,         setCancelCtx]         = useState<CancelContext | null>(null);

  const showToast = (msg: string, type: "success"|"error"="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const [profRes, sessRes, ratingsRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,username,credits").eq("id", user.id).single(),
      supabase.from("sessions")
        .select(`*, listing:listings(title,format,description,meeting_link),
          teacher:profiles!sessions_teacher_id_fkey(${PROFILE_FIELDS}),
          learner:profiles!sessions_learner_id_fkey(${PROFILE_FIELDS})`)
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.from("ratings").select("session_id").eq("rater_id", user.id),
    ]);
    if (profRes.data) setProfile(profRes.data);
    setSessions(sessRes.data || []);
    setAlreadyRated(new Set((ratingsRes.data||[]).map((r: any) => r.session_id).filter(Boolean)));
    setLoading(false);
  }

  function openMessageWith(otherId: string) {
    sessionStorage.setItem("openMessageWith", otherId);
    window.location.href = "/messages";
  }

  async function sendCancellationMessage(session: Session, reason: string, isDecline: boolean) {
    if (!profile) return;
    const recipientId = isDecline ? session.learner_id : session.teacher_id;
    const senderId    = profile.id;
    const text = `${profile.full_name} ${isDecline ? "declined" : "cancelled"} the session for "${session.listing?.title}": ${reason}`;
    try {
      await supabase.from("messages").insert({ sender_id: senderId, receiver_id: recipientId, content: text });
    } catch (_) {}
  }

  async function safeIncrementCredits(userId: string, amount: number): Promise<boolean> {
    const { error } = await supabase.rpc("increment_credits", { user_id: userId, amount });
    return !error;
  }

  async function handleAccept(session: Session) {
    setActionLoading(session.id+"-accept");
    const { data, error } = await supabase.from("sessions").update({ status:"confirmed", confirmed_time:session.proposed_time })
      .eq("id",session.id).eq("teacher_id",profile?.id).eq("status","pending").select("id").maybeSingle();
    if (error || !data) { showToast("This request is no longer pending. Refresh and try again.","error"); await loadData(); setActionLoading(null); return; }
    try { await supabase.from("notifications").insert({ user_id:session.learner_id, type:"session", title:"Session Confirmed! 🎉", body:`Your session for "${session.listing?.title}" has been confirmed!`, link:"/sessions" }); } catch(_){}
    showToast("Session accepted! Learner notified.");
    await loadData(); setActionLoading(null);
  }

  function openDeclineModal(session: Session) { setCancelCtx({ session, mode: "decline" }); }
  function openCancelModal(session: Session)  { setCancelCtx({ session, mode: "cancel" }); }

  async function handleCancelConfirm(reason: string) {
    if (!cancelCtx || !profile) return;
    const { session, mode } = cancelCtx;
    const isDecline = mode === "decline";
    setActionLoading(session.id + (isDecline ? "-decline" : "-cancel"));

    const { data: escrowRefund, error: escrowError } = await supabase.from("escrow")
      .update({ status:"refunded" }).eq("session_id", session.id).eq("status","locked").select("id").maybeSingle();
    if (escrowError || !escrowRefund) { showToast("This session's credits have already been resolved.","error"); await loadData(); setActionLoading(null); return; }
    if (!await safeIncrementCredits(session.learner_id, session.credit_amount)) {
      await supabase.from("escrow").update({ status:"locked" }).eq("id", escrowRefund.id).eq("status","refunded");
      showToast("Could not refund credits. Please retry.","error"); setActionLoading(null); return;
    }
    const { data: cancelled, error: cancelError } = await supabase.from("sessions").update({ status:"cancelled" })
      .eq("id",session.id).in("status",["pending","confirmed"]).select("id").maybeSingle();
    if (cancelError || !cancelled) {
      const balanceRestored = await safeIncrementCredits(session.learner_id, -session.credit_amount);
      if (balanceRestored) await supabase.from("escrow").update({ status:"locked" }).eq("id", escrowRefund.id).eq("status","refunded");
      showToast(balanceRestored
        ? "Could not cancel this session. The refund was rolled back; refresh and retry."
        : "Cancellation failed and the refund could not be rolled back. Contact an administrator.","error");
      await loadData(); setActionLoading(null); return;
    }

    await sendCancellationMessage(session, reason, isDecline);

    const { error: transactionError } = await supabase.from("credit_transactions").insert({
        user_id: session.learner_id,
        amount: session.credit_amount,
        type: "session_refund",
        reference_id: session.id,
        description: isDecline
          ? `Session declined by teacher — credits refunded`
          : `Session cancelled by learner — credits refunded`,
      });
    if (transactionError) {
      const { error: balanceRollbackError } = await supabase.rpc("increment_credits", { user_id: session.learner_id, amount: -session.credit_amount });
      if (!balanceRollbackError) {
        await supabase.from("sessions").update({ status:session.status }).eq("id",session.id).eq("status","cancelled");
        await supabase.from("escrow").update({ status:"locked" }).eq("id", escrowRefund.id).eq("status","refunded");
      }
      showToast(balanceRollbackError
        ? "Credits were refunded, but the refund history could not be recorded or rolled back. Contact an administrator."
        : "Could not record the refund. The change was rolled back; please retry.","error");
      await loadData(); setActionLoading(null); return;
    }

    try {
      const notifTarget  = isDecline ? session.learner_id : session.teacher_id;
      const notifTitle   = isDecline ? "Session Declined" : "Session Cancelled";
      const notifBody    = isDecline
        ? `${profile.full_name} declined your booking. ${session.credit_amount} credits refunded.`
        : `${profile.full_name} cancelled their booking for "${session.listing?.title}".`;

      await supabase.from("notifications").insert({
        user_id: notifTarget, type:"session", title: notifTitle, body: notifBody, link:"/sessions",
      });
    } catch (_) {}

    setCancelCtx(null);
    showToast(isDecline
      ? `Session declined. ${session.credit_amount} cr refunded & reason sent.`
      : `Booking cancelled. ${session.credit_amount} cr refunded & reason sent.`);
    await loadData();
    setActionLoading(null);
  }

  async function handleMarkComplete(session: Session) {
    if (!profile) return;
    setActionLoading(session.id+"-complete");
    const isTeacher = profile.id === session.teacher_id;
    const { data: updated, error } = await supabase.from("sessions")
      .update(isTeacher ? { teacher_completed:true } : { learner_completed:true })
      .eq("id",session.id).eq(isTeacher ? "teacher_id" : "learner_id",profile.id).eq("status","confirmed").select().maybeSingle();
    if (error||!updated) { showToast("Something went wrong.","error"); setActionLoading(null); return; }
    const bothDone = updated.teacher_completed && updated.learner_completed;
    if (bothDone) {
      const { data: freshSession } = await supabase.from("sessions").select("status").eq("id",session.id).single();
      if (freshSession?.status==="completed") { showToast("Session already completed!"); await loadData(); setActionLoading(null); return; }
      const { data: completedClaim, error: statusErr } = await supabase.from("sessions").update({ status:"completed" })
        .eq("id",session.id).eq("status","confirmed").select("id").maybeSingle();
      if (statusErr || !completedClaim) { showToast("Session status changed. Refresh and try again.","error"); await loadData(); setActionLoading(null); return; }
      const { data: releasedEscrow, error: escrowReleaseError } = await supabase.from("escrow").update({ status:"released" })
        .eq("session_id",session.id).eq("status","locked").select("id,amount").maybeSingle();
      if (escrowReleaseError || !releasedEscrow || releasedEscrow.amount !== session.credit_amount) {
        await supabase.from("sessions").update({ status:"confirmed" }).eq("id",session.id).eq("status","completed");
        showToast("Escrow could not be released. No credits were transferred.","error"); await loadData(); setActionLoading(null); return;
      }
      if (!await safeIncrementCredits(session.teacher_id, releasedEscrow.amount)) {
        await supabase.from("escrow").update({ status:"locked" }).eq("id",releasedEscrow.id).eq("status","released");
        await supabase.from("sessions").update({ status:"confirmed" }).eq("id",session.id).eq("status","completed");
        showToast("Could not release credits. Please retry.","error"); await loadData(); setActionLoading(null); return;
      }
      const { error: transactionError } = await supabase.from("credit_transactions").insert({ user_id:session.teacher_id, amount:releasedEscrow.amount, type:"session_earn", reference_id:session.id, description:`Session completed — ${releasedEscrow.amount} credits released from escrow` });
      if (transactionError) {
        const { error: rollbackError } = await supabase.rpc("increment_credits", { user_id:session.teacher_id, amount:-releasedEscrow.amount });
        if (!rollbackError) {
          await supabase.from("escrow").update({ status:"locked" }).eq("id",releasedEscrow.id).eq("status","released");
          await supabase.from("sessions").update({ status:"confirmed" }).eq("id",session.id).eq("status","completed");
        }
        showToast(rollbackError ? "Credits were released, but history could not be recorded. Contact an admin." : "Could not record the credit release. Please retry.","error");
        await loadData(); setActionLoading(null); return;
      }
      try {
        await supabase.from("notifications").insert([
          { user_id:session.teacher_id, type:"credit", title:`💰 ${session.credit_amount} credits received!`, body:`Credits released for "${session.listing?.title}".`, link:"/wallet" },
          { user_id:session.learner_id, type:"session", title:"Session Complete! Rate your teacher", body:`Leave a review for "${session.listing?.title}"`, link:"/sessions" },
        ]);
      } catch(_){}
      showToast(`Session complete! ${session.credit_amount} cr released.`);
      const { data: completedSession } = await supabase.from("sessions")
        .select(`*, listing:listings(title,format,description,meeting_link),
          teacher:profiles!sessions_teacher_id_fkey(${PROFILE_FIELDS}),
          learner:profiles!sessions_learner_id_fkey(${PROFILE_FIELDS})`)
        .eq("id",session.id).single();
      await loadData(); setActionLoading(null);
      if (completedSession) {
        setRatingSession(completedSession as Session);
        setRatingSubmitted(false); setRatingError("");
        setRatingForm({ overall:0, review:"" });
      }
    } else {
      const otherId = isTeacher ? session.learner_id : session.teacher_id;
      try { await supabase.from("notifications").insert({ user_id:otherId, type:"session", title:"Please confirm session complete ✅", body:`The ${isTeacher?"teacher":"learner"} marked it done. Confirm to release credits!`, link:"/sessions" }); } catch(_){}
      showToast(`Marked complete! Waiting for ${isTeacher?"learner":"teacher"} to confirm.`);
      await loadData(); setActionLoading(null);
    }
  }

  async function handleSubmitRating() {
    if (!ratingSession||!profile||ratingForm.overall===0) return;
    setActionLoading("rating"); setRatingError("");
    const isTeacher = profile.id===ratingSession.teacher_id;
    const ratedId = isTeacher ? ratingSession.learner_id : ratingSession.teacher_id;
    const payload = {
      session_id:ratingSession.id, rater_id:profile.id, rated_id:ratedId,
      role_rated:isTeacher?"learner":"teacher",
      overall:ratingForm.overall,
      review:ratingForm.review||null, is_revealed:true, is_flagged:false,
    };
    const { error } = await supabase.from("ratings").insert(payload);
    if (error) { setRatingError(`Failed to submit: ${error.message}`); setActionLoading(null); return; }
    setAlreadyRated(prev => new Set([...prev, ratingSession.id]));
    setRatingSubmitted(true); setActionLoading(null);
    await loadData();
  }

  async function handleDispute() {
    if (!disputeSession||!profile||disputeReason.length<10) return;
    setActionLoading("dispute");
    const otherId = disputeSession.teacher_id===profile.id?disputeSession.learner_id:disputeSession.teacher_id;
    const { data: dispute, error: disputeError } = await supabase.from("disputes").insert({
      session_id: disputeSession.id, filed_by: profile.id, against_user: otherId, reason: disputeReason.trim(), status: "open",
    }).select("id").single();
    if (disputeError || !dispute) { showToast("Could not save the dispute. Please retry.","error"); setActionLoading(null); return; }
    const { data: updatedSession, error: sessionError } = await supabase.from("sessions").update({ status:"disputed" })
      .eq("id",disputeSession.id).eq("status",disputeSession.status).select("id").maybeSingle();
    if (sessionError || !updatedSession) {
      await supabase.from("disputes").delete().eq("id",dispute.id);
      showToast("Session status changed. Refresh and try again.","error"); await loadData(); setActionLoading(null); return;
    }
    const { data: heldEscrow, error: escrowError } = await supabase.from("escrow").update({ status:"disputed" })
      .eq("session_id",disputeSession.id).eq("status","locked").select("id").maybeSingle();
    if (escrowError || !heldEscrow) {
      await supabase.from("sessions").update({ status:disputeSession.status }).eq("id",disputeSession.id).eq("status","disputed");
      await supabase.from("disputes").delete().eq("id",dispute.id);
      showToast("Could not place escrow on hold. Please retry.","error"); await loadData(); setActionLoading(null); return;
    }
    try { await supabase.from("notifications").insert([
      { user_id:otherId, type:"dispute", title:"⚠️ Dispute Raised", body:"A dispute has been raised for your session.", link:"/sessions" },
      { user_id:profile.id, type:"dispute", title:"Dispute Submitted", body:"Your dispute is under review.", link:"/sessions" },
    ]); } catch(_){}
    setDisputeSession(null); setDisputeReason("");
    showToast("Dispute submitted. An admin will review soon.");
    await loadData(); setActionLoading(null);
  }

  const filtered = sessions.filter(s => {
    const roleOk = tab==="all"||(tab==="teaching"&&s.teacher_id===profile?.id)||(tab==="learning"&&s.learner_id===profile?.id);
    const statusOk = statusFilter==="all"||s.status===statusFilter;
    return roleOk && statusOk;
  });

  const counts = {
    total:     sessions.length,
    pending:   sessions.filter(s=>s.status==="pending").length,
    upcoming:  sessions.filter(s=>s.status==="confirmed").length,
    completed: sessions.filter(s=>s.status==="completed").length,
    disputed:  sessions.filter(s=>s.status==="disputed").length,
  };

  if (loading) return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center" style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#2d6a4f] border-t-transparent mx-auto mb-3" style={{ animation:"spin .8s linear infinite" }} />
        <p className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Loading sessions</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf8f4]" style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box} a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp .35s ease both}
        .session-card{transition:box-shadow .2s,transform .2s}
        .session-card:hover{box-shadow:0 6px 24px rgba(0,0,0,.07);transform:translateY(-1px)}
        .modal-anim{animation:slideUp .22s ease}
        .overlay-anim{animation:fadeIn .15s ease}
      `}</style>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl text-white text-sm font-semibold shadow-2xl fade-up"
          style={{ background:toast.type==="success"?"linear-gradient(135deg,#1a4a36,#2d6a4f)":"linear-gradient(135deg,#991b1b,#dc2626)", maxWidth:360 }}>
          <span>{toast.type==="success"?"✓":"!"}</span>{toast.msg}
        </div>
      )}

      <Navbar />

      <div className="max-w-4xl mx-auto px-5 py-10 pb-20">
        <div className="flex items-start justify-between gap-4 mb-8 fade-up">
          <div>
            <p className="text-xs font-800 text-[#2d6a4f] tracking-widest uppercase mb-2">My Sessions</p>
            <h1 className="text-4xl font-900 text-stone-900 leading-none tracking-tight mb-2" style={{ fontFamily:"'Fraunces',serif" }}>Manage Bookings</h1>
            <p className="text-sm text-stone-400 font-500">Accept requests, confirm sessions, and rate your partners.</p>
          </div>
          <a href="/listings" className="flex items-center gap-2 px-5 py-2.5 bg-[#2d6a4f] text-white rounded-xl text-sm font-700 hover:bg-[#1a4a36] transition-colors whitespace-nowrap shadow-sm">+ Book a Session</a>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6 fade-up" style={{ animationDelay:".05s" }}>
          {[
            { label:"Total",     val:counts.total,     filter:"all",       accent:"#1a1a1a" },
            { label:"Pending",   val:counts.pending,   filter:"pending",   accent:"#f59e0b" },
            { label:"Upcoming",  val:counts.upcoming,  filter:"confirmed", accent:"#3b82f6" },
            { label:"Completed", val:counts.completed, filter:"completed", accent:"#22c55e" },
            { label:"Disputed",  val:counts.disputed,  filter:"disputed",  accent:"#a855f7" },
          ].map(s => (
            <button key={s.label} onClick={() => setStatusFilter(s.filter)}
              className={`bg-white rounded-2xl p-4 border text-center cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all ${statusFilter===s.filter?"border-stone-900 shadow-sm":"border-stone-200"}`}>
              <div className="text-3xl font-900 leading-none mb-1.5" style={{ fontFamily:"'Fraunces',serif", color:s.accent }}>{s.val}</div>
              <div className="text-xs text-stone-400 font-700 tracking-wider uppercase">{s.label}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 mb-5 items-center flex-wrap fade-up" style={{ animationDelay:".1s" }}>
          <div className="flex bg-stone-100 p-1 rounded-xl gap-0.5">
            {(["all","teaching","learning"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-700 transition-all ${tab===t?"bg-white text-stone-900 shadow-sm":"text-stone-400 hover:text-stone-600"}`}>
                {t==="all"?"All":t==="teaching"?"Teaching":"Learning"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {["all","pending","confirmed","completed","cancelled","disputed"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-1 rounded-full text-xs font-700 border transition-all ${statusFilter===s?"bg-stone-900 text-white border-stone-900":"bg-white text-stone-400 border-stone-200 hover:border-stone-400 hover:text-stone-600"}`}>
                {s==="all"?"All":s==="confirmed"?"Upcoming":s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {counts.pending > 0 && tab !== "learning" && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 fade-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-800 text-sm">{counts.pending}</div>
              <div>
                <p className="text-sm font-800 text-amber-800">Pending request{counts.pending>1?"s":""} waiting for your response</p>
                <p className="text-xs text-amber-600 font-500">Accept or decline to keep learners informed.</p>
              </div>
            </div>
            <button onClick={() => setStatusFilter("pending")} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-800 hover:bg-amber-600 transition-colors whitespace-nowrap">View Pending →</button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200 fade-up">
            <p className="text-5xl mb-5">📭</p>
            <h3 className="text-2xl font-900 text-stone-900 mb-2" style={{ fontFamily:"'Fraunces',serif" }}>No sessions found</h3>
            <p className="text-sm text-stone-400 mb-7 max-w-xs mx-auto">
              {tab==="teaching"?"No learners have booked you yet.":tab==="learning"?"You haven't booked any sessions yet.":"No sessions match your current filters."}
            </p>
            <a href="/listings" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-700 text-sm hover:bg-[#1a4a36] transition-colors">Browse Skills →</a>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((session, idx) => {
            const isTeacher  = session.teacher_id === profile?.id;
            const other      = isTeacher ? session.learner : session.teacher;
            const otherId    = isTeacher ? session.learner_id : session.teacher_id;
            const cfg        = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending;
            const myDone     = isTeacher ? session.teacher_completed : session.learner_completed;
            const otherDone  = isTeacher ? session.learner_completed : session.teacher_completed;
            const isExpanded = expandedId === session.id;
            const hasRated   = alreadyRated.has(session.id);
            const meetingLink = session.listing?.meeting_link;

            return (
              <div key={session.id} className="session-card bg-white rounded-2xl border border-stone-200 overflow-visible fade-up"
                style={{ animationDelay:`${idx*.04}s`, borderLeft:`3px solid ${cfg.dot}` }}>

                <div className="px-5 py-4 flex items-start gap-4">
                  {other && <SessionAvatar profile={other} size={40} statusDot={cfg.dot} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-800 text-stone-900">{other?.full_name||"Unknown"}</span>
                      <span className="text-xs text-stone-400">@{other?.username}</span>
                      <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${isTeacher?"bg-blue-50 text-blue-600":"bg-green-50 text-green-700"}`}>
                        {isTeacher?"Learner":"Teacher"}
                      </span>
                    </div>
                    <p className="text-xs font-600 text-stone-500 truncate max-w-xs">{session.listing?.title||"Untitled Session"}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-stone-400 font-500">{FORMAT_LABELS[session.listing?.format||"mixed"]}</span>
                    <div className="text-right">
                      <div className="text-lg font-900 text-[#2d6a4f] leading-none" style={{ fontFamily:"'Fraunces',serif" }}>{session.credit_amount} cr</div>
                    </div>
                    <span className="text-xs font-700 px-2.5 py-1 rounded-full" style={{ background:cfg.badgeBg, color:cfg.badgeText }}>{cfg.label}</span>
                    <button onClick={() => setExpandedId(isExpanded?null:session.id)}
                      className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-xs hover:bg-stone-200 transition-all"
                      style={{ transform:isExpanded?"rotate(180deg)":"none" }}>▾</button>
                  </div>
                </div>

                <div className="px-5 pb-4 flex items-center gap-4 flex-wrap border-t border-stone-50">
                  <div className="flex-1 min-w-0 pt-3">
                    <p className="text-xs font-600 text-stone-400 mb-1">
                      📅 {formatDate(session.proposed_time)}
                      {session.status==="confirmed" && (
                        <span className="ml-2 text-[#2d6a4f] font-800 bg-green-50 px-2 py-0.5 rounded-full text-xs">{timeFromNow(session.proposed_time)}</span>
                      )}
                    </p>
                    {session.learner_note && (
                      <p className="text-xs text-stone-400 italic border-l-2 border-stone-200 pl-2 mt-1">"{session.learner_note}"</p>
                    )}
                  </div>

                  {(session.status==="confirmed"||session.status==="completed") && (
                    <div className="flex gap-1.5 items-center pt-3">
                      {[{done:session.teacher_completed,lbl:"T"},{done:session.learner_completed,lbl:"L"}].map(({done,lbl}) => (
                        <span key={lbl} className={`text-xs font-800 w-6 h-6 rounded-full flex items-center justify-center border ${done?"bg-green-50 text-green-700 border-green-200":"bg-stone-50 text-stone-300 border-stone-200"}`}>
                          {done?"✓":lbl}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-center flex-wrap pt-3">
                    <button onClick={() => openMessageWith(otherId)} className="px-3.5 py-1.5 rounded-xl bg-stone-100 text-stone-600 text-xs font-700 hover:bg-stone-200 transition-colors border border-stone-200">Message</button>

                    {session.status==="pending" && isTeacher && (<>
                      <button onClick={() => handleAccept(session)} disabled={!!actionLoading}
                        className="px-4 py-1.5 rounded-xl bg-[#2d6a4f] text-white text-xs font-800 hover:bg-[#1a4a36] transition-colors disabled:opacity-50">
                        {actionLoading===session.id+"-accept"?"…":"Accept"}
                      </button>
                      <button onClick={() => openDeclineModal(session)} disabled={!!actionLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-700 hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50">
                        Decline
                      </button>
                    </>)}

                    {session.status==="pending" && !isTeacher && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-600 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">Awaiting teacher</span>
                        <button onClick={() => openCancelModal(session)} disabled={!!actionLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-700 hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50">
                          Cancel
                        </button>
                      </div>
                    )}

                    {session.status==="confirmed" && !myDone && (
                      <button onClick={() => handleMarkComplete(session)} disabled={!!actionLoading}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-800 hover:bg-blue-700 transition-colors disabled:opacity-50">
                        {actionLoading===session.id+"-complete"?"…":"Mark Complete"}
                      </button>
                    )}
                    {session.status==="confirmed" && myDone && !otherDone && (
                      <span className="text-xs font-600 text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">
                        Waiting for {isTeacher?"learner":"teacher"}
                      </span>
                    )}
                    {session.status==="confirmed" && myDone && otherDone && (
                      <button onClick={() => handleMarkComplete(session)} disabled={!!actionLoading}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-700 hover:bg-amber-100 transition-colors border border-amber-200 disabled:opacity-50">
                        {actionLoading===session.id+"-complete"?"Retrying…":"Retry credit release"}
                      </button>
                    )}

                    {session.status==="confirmed" && (
                      <button onClick={() => setDisputeSession(session)}
                        className="px-3.5 py-1.5 rounded-xl bg-violet-50 text-violet-600 text-xs font-700 hover:bg-violet-100 transition-colors border border-violet-200">
                        Dispute
                      </button>
                    )}

                    {session.status==="completed" && (
                      <button onClick={() => setDisputeSession(session)}
                        className="px-3.5 py-1.5 rounded-xl bg-violet-50 text-violet-600 text-xs font-700 hover:bg-violet-100 transition-colors border border-violet-200">
                        Dispute
                      </button>
                    )}
                    {session.status==="completed" && !hasRated && (
                      <button onClick={() => { setRatingSession(session); setRatingSubmitted(false); setRatingError(""); setRatingForm({overall:0,review:""}); }}
                        className="px-4 py-1.5 rounded-xl text-white text-xs font-800 hover:opacity-90 transition-opacity"
                        style={{ background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                        ★ Leave Review
                      </button>
                    )}
                    {session.status==="completed" && hasRated && (
                      <span className="text-xs font-700 text-green-700 bg-green-50 px-3 py-1.5 rounded-xl border border-green-200">★ Reviewed</span>
                    )}
                  </div>
                </div>

                {(session.status==="confirmed"||session.status==="upcoming") && meetingLink && (
                  <div className="px-5 pb-4"><MeetingLinkButton url={meetingLink} /></div>
                )}
                {(session.status==="confirmed"||session.status==="upcoming") && !meetingLink && isTeacher && (
                  <div className="px-5 pb-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                      <span className="text-lg">💡</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-amber-800">No meeting link set</p>
                        <p className="text-xs text-amber-600 font-medium">Add a Zoom / Google Meet link to your listing so the learner knows where to join.</p>
                      </div>
                      <a href={`/listings/${session.listing_id}/edit`}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-black no-underline hover:bg-amber-600 transition-colors whitespace-nowrap">
                        Edit Listing →
                      </a>
                    </div>
                  </div>
                )}
                {(session.status==="confirmed"||session.status==="upcoming") && !meetingLink && !isTeacher && (
                  <div className="px-5 pb-4">
                    <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl">
                      <span className="text-lg">⏳</span>
                      <div className="flex-1">
                        <p className="text-xs font-black text-stone-600">Meeting link pending</p>
                        <p className="text-xs text-stone-400 font-medium">The teacher hasn't added a meeting link yet. Message them to confirm where you'll connect.</p>
                      </div>
                      <button onClick={() => openMessageWith(otherId)}
                        className="px-3 py-1.5 bg-stone-700 text-white rounded-xl text-xs font-black border-0 cursor-pointer whitespace-nowrap hover:bg-stone-800 transition-colors">
                        Message →
                      </button>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/50">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-xs font-800 text-stone-400 uppercase tracking-wider mb-3">Details</p>
                        {[
                          ["Format",  FORMAT_LABELS[session.listing?.format||"mixed"]],
                          ["Credits", `${session.credit_amount} cr`],
                          ["Booked",  formatDate(session.created_at)],
                          ["Status",  cfg.label],
                        ].map(([k,v]) => (
                          <div key={k} className="flex gap-3 text-xs mb-1.5">
                            <span className="text-stone-400 w-14 shrink-0">{k}</span>
                            <span className="font-600 text-stone-600">{v}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-800 text-stone-400 uppercase tracking-wider mb-3">Quick Links</p>
                        <div className="flex flex-col gap-2">
                          <a href={`/listings/${session.listing_id}`} className="text-xs font-700 text-[#2d6a4f] hover:underline">View listing →</a>
                          <button onClick={() => openMessageWith(otherId)} className="text-xs font-700 text-violet-600 hover:underline text-left bg-transparent border-0 cursor-pointer p-0">Open full conversation →</button>
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

      {cancelCtx && profile && (
        <CancelModal
          ctx={cancelCtx}
          profile={profile}
          onClose={() => setCancelCtx(null)}
          onConfirm={handleCancelConfirm}
          loading={!!actionLoading}
        />
      )}

      {/* RATING MODAL — single overall rating + optional review */}
      {ratingSession && (
        <div className="overlay-anim fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5 backdrop-blur-sm">
          <div className="modal-anim bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            {ratingSubmitted ? (
              <div className="text-center py-14 px-8">
                <p className="text-5xl mb-4">🌟</p>
                <h2 className="text-2xl font-900 text-stone-900 mb-2" style={{ fontFamily:"'Fraunces',serif" }}>Review Submitted!</h2>
                <p className="text-sm text-stone-400 mb-1">Thanks for the feedback.</p>
                <div className="flex justify-center my-5"><Stars value={ratingForm.overall} /></div>
                <button onClick={() => { setRatingSession(null); setRatingSubmitted(false); }}
                  className="px-8 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-800 text-sm hover:bg-[#1a4a36] transition-colors">Done</button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start p-6 pb-0">
                  <div>
                    <h2 className="text-xl font-900 text-stone-900 mb-1" style={{ fontFamily:"'Fraunces',serif" }}>Rate this Session</h2>
                    <p className="text-xs text-stone-400">Honest reviews help others choose well</p>
                  </div>
                  <button onClick={() => setRatingSession(null)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:bg-stone-200 transition-colors text-sm">✕</button>
                </div>
                <div className="mx-6 mt-4 p-3 rounded-xl border text-xs font-600"
                  style={{ background:profile?.id===ratingSession.teacher_id?"#dbeafe":"#dcfce7", borderColor:profile?.id===ratingSession.teacher_id?"#bfdbfe":"#bbf7d0", color:profile?.id===ratingSession.teacher_id?"#1e40af":"#166534" }}>
                  Rating {profile?.id===ratingSession.teacher_id?"learner":"teacher"}:{" "}
                  <span className="font-800">{profile?.id===ratingSession.teacher_id?ratingSession.learner?.full_name:ratingSession.teacher?.full_name}</span>
                </div>
                <div className="p-6 flex flex-col gap-5">
                  <div>
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-sm font-700 text-stone-800">Overall Experience</span>
                      <span className="text-xs text-stone-400">How was the session overall?</span>
                    </div>
                    <StarPicker value={ratingForm.overall} onChange={v => setRatingForm(f=>({...f, overall:v}))} />
                    {ratingForm.overall > 0 && (
                      <p className="text-xs text-amber-500 font-700 mt-1">{["","Poor","Fair","Good","Great","Excellent!"][ratingForm.overall]}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-700 text-stone-800 mb-2">Written Review <span className="font-400 text-stone-400">(optional)</span></p>
                    <textarea value={ratingForm.review} onChange={e => setRatingForm(f=>({...f,review:e.target.value.slice(0,300)}))}
                      placeholder="Share your experience…"
                      className="w-full min-h-20 p-3 rounded-xl border border-stone-200 text-sm resize-none outline-none focus:border-[#2d6a4f] transition-colors"
                      style={{ fontFamily:"'DM Sans',sans-serif" }} />
                    <p className="text-xs text-stone-400 text-right mt-1">{ratingForm.review.length}/300</p>
                  </div>
                  {ratingError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-600">{ratingError}</div>}
                  <div className="flex gap-2">
                    <button onClick={() => setRatingSession(null)} className="flex-1 py-3 rounded-xl bg-stone-100 text-stone-600 font-700 text-sm hover:bg-stone-200 transition-colors">Cancel</button>
                    <button onClick={handleSubmitRating} disabled={ratingForm.overall===0||!!actionLoading}
                      className="flex-2 py-3 px-6 rounded-xl font-800 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background:ratingForm.overall>0?"linear-gradient(135deg,#2d6a4f,#1a4a36)":"#e5e7eb", color:ratingForm.overall>0?"#fff":"#9ca3af", flex:2 }}>
                      {actionLoading==="rating"?"Submitting…":"Submit Review ★"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* DISPUTE MODAL */}
      {disputeSession && (
        <div className="overlay-anim fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5 backdrop-blur-sm">
          <div className="modal-anim bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-900 text-violet-700" style={{ fontFamily:"'Fraunces',serif" }}>Raise a Dispute</h2>
              <button onClick={() => setDisputeSession(null)} className="text-stone-400 hover:text-stone-600 text-xl">✕</button>
            </div>
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl p-3 mb-5 font-600 leading-relaxed">
              Credits will be <strong>frozen in escrow</strong> until an admin resolves this.
            </p>
            <label className="text-xs font-700 text-stone-700 block mb-2">Describe what went wrong</label>
            <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
              placeholder="Provide as much detail as possible…"
              className="w-full min-h-28 p-3 rounded-xl border border-stone-200 text-sm resize-y outline-none focus:border-violet-400 transition-colors mb-2"
              style={{ fontFamily:"'DM Sans',sans-serif" }} />
            <p className={`text-xs font-700 mb-5 ${disputeReason.length<10?"text-red-400":"text-green-600"}`}>
              {disputeReason.length<10?`${10-disputeReason.length} more characters needed`:"✓ Ready to submit"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDisputeSession(null)} className="flex-1 py-2.5 rounded-xl bg-stone-100 text-stone-600 font-700 text-sm hover:bg-stone-200 transition-colors">Cancel</button>
              <button onClick={handleDispute} disabled={disputeReason.length<10||!!actionLoading}
                className="flex-2 py-2.5 px-5 rounded-xl font-800 text-sm transition-all disabled:opacity-40"
                style={{ flex:2, background:disputeReason.length>=10?"#7c3aed":"#e5e7eb", color:disputeReason.length>=10?"#fff":"#9ca3af" }}>
                {actionLoading==="dispute"?"Submitting…":"Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
