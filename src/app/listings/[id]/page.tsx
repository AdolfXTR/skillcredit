"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PortfolioGallery, PortfolioItem } from "@/components/PortfolioSystem";
import { ReputationMini, calcReputation } from "@/components/ReputationScore";
import { BadgeChip, getBadgeTier } from "@/components/BadgeSystem";

type Listing = {
  id: string; title: string; description: string;
  credit_price: number; format: string; duration: number;
  prerequisites: string; outcomes: string; materials: string;
  is_active: boolean; created_at: string; teacher_id: string;
  skills: { name: string; category: string };
  profiles: { id: string; full_name: string; username: string; level: string; bio: string; xp: number };
};

type UserProfile = { id: string; full_name: string; credits: number };

const FORMAT_INFO: Record<string, { icon: string; label: string; color: string; bg: string; border: string; desc: string }> = {
  video: { icon: "📹", label: "Video Call", color: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200", desc: "Live session via Google Meet or Zoom" },
  chat:  { icon: "💬", label: "Chat",       color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200", desc: "Text-based teaching inside SkillCredit" },
  docs:  { icon: "📄", label: "Docs",       color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200", desc: "Shared documents and written guides" },
  mixed: { icon: "🎨", label: "Mixed",      color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200", desc: "Combination of video, chat, and documents" },
};

export default function ListingDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [listing, setListing]         = useState<Listing | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [portfolio, setPortfolio]     = useState<PortfolioItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingStep, setBookingStep] = useState<"form" | "confirm" | "success">("form");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [note, setNote]               = useState("");
  const [booking, setBooking]         = useState(false);
  const [bookError, setBookError]     = useState("");

  // Teacher reputation data
  const [teacherSessions, setTeacherSessions]     = useState(0);
  const [teacherAvgRating, setTeacherAvgRating]   = useState(0);
  const [teacherRepeats, setTeacherRepeats]       = useState(0);
  const [teacherDisputes, setTeacherDisputes]     = useState(0);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("id, full_name, credits").eq("id", user.id).single();
        if (prof) setCurrentUser(prof);
      }

      const { data, error } = await supabase
        .from("listings")
        .select(`*, skills(name, category), profiles(id, full_name, username, level, bio, xp)`)
        .eq("id", id).single();

      if (error || !data) { setLoading(false); return; }
      setListing(data as Listing);

      // Portfolio
      const { data: pData } = await supabase
        .from("portfolio_items").select("*").eq("listing_id", id);
      if (pData) setPortfolio(pData as PortfolioItem[]);

      // Teacher reputation data
      const teacherId = data.teacher_id;
      const [
        { count: sCount },
        { data: ratingData },
        { data: sessionData },
        { count: dCount },
      ] = await Promise.all([
        supabase.from("sessions").select("*", { count: "exact", head: true }).eq("teacher_id", teacherId).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", teacherId),
        supabase.from("sessions").select("learner_id").eq("teacher_id", teacherId).eq("status", "completed"),
        supabase.from("sessions").select("*", { count: "exact", head: true }).eq("teacher_id", teacherId).eq("status", "disputed"),
      ]);

      setTeacherSessions(sCount || 0);

      if (ratingData && ratingData.length > 0) {
        const avg = ratingData.reduce((s: number, r: { overall: number }) => s + r.overall, 0) / ratingData.length;
        setTeacherAvgRating(parseFloat(avg.toFixed(1)));
      }

      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => {
          counts[s.learner_id] = (counts[s.learner_id] || 0) + 1;
        });
        setTeacherRepeats(Object.values(counts).filter(c => c > 1).length);
      }

      setTeacherDisputes(dCount || 0);
      setLoading(false);
    };
    init();
  }, [id]);

  const handleBook = async () => {
    if (!currentUser || !listing) return;
    if (!proposedDate || !proposedTime) { setBookError("Please select a date and time."); return; }
    if (currentUser.credits < listing.credit_price) {
      setBookError(`You need ${listing.credit_price} credits but only have ${currentUser.credits}.`);
      return;
    }

    setBooking(true);
    setBookError("");

    const proposedDateTime = new Date(`${proposedDate}T${proposedTime}`).toISOString();

    const { data: session, error: sessionErr } = await supabase.from("sessions").insert({
      listing_id:    listing.id,
      teacher_id:    listing.teacher_id,
      learner_id:    currentUser.id,
      proposed_time: proposedDateTime,
      status:        "pending",
      learner_note:  note,
      credit_amount: listing.credit_price,
    }).select().single();

    if (sessionErr || !session) {
      setBookError("Failed to create session. Please try again.");
      setBooking(false);
      return;
    }

    await Promise.all([
      supabase.from("escrow").insert({ session_id: session.id, amount: listing.credit_price, status: "locked" }),
      supabase.from("profiles").update({ credits: currentUser.credits - listing.credit_price }).eq("id", currentUser.id),
      supabase.from("credit_transactions").insert({
        user_id: currentUser.id, amount: -listing.credit_price,
        type: "session_spend", reference_id: session.id,
        description: `Booked session: ${listing.title}`,
      }),
      supabase.from("notifications").insert({
        user_id: listing.teacher_id, type: "session",
        title: "New session request!",
        body: `${currentUser.full_name} wants to book "${listing.title}"`,
        link: `/sessions/${session.id}`,
      }),
    ]);

    setBooking(false);
    setBookingStep("success");
  };

  const isOwnListing = currentUser?.id === listing?.teacher_id;
  const canAfford    = currentUser ? currentUser.credits >= (listing?.credit_price || 0) : false;
  const fmt          = FORMAT_INFO[listing?.format || "mixed"] || FORMAT_INFO.mixed;
  const teacherInitials = listing?.profiles?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const teacherBadge = getBadgeTier(listing?.profiles?.xp || 0, teacherSessions, teacherAvgRating);
  const repScore     = calcReputation({ avgRating: teacherAvgRating, completedSessions: teacherSessions, repeatClients: teacherRepeats, disputes: teacherDisputes });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4">📋</div><p className="text-stone-400 text-sm">Loading listing...</p></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4">😕</div><p className="text-stone-400 text-sm">Listing not found.</p><a href="/listings" className="text-emerald-600 text-sm font-bold no-underline mt-2 block">← Back to listings</a></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap'); .font-fraunces{font-family:'Fraunces',serif;} .font-sans{font-family:'DM Sans',sans-serif;}`}</style>

      {/* Booking Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

            {bookingStep === "form" && (
              <>
                <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-1">Book a Session 📅</h2>
                <p className="text-stone-400 text-sm mb-6">Propose a time and the teacher will confirm.</p>

                <div className="flex flex-col gap-4">
                  {/* Summary */}
                  <div className={`rounded-2xl border p-4 flex justify-between items-center ${fmt.bg} ${fmt.border}`}>
                    <div>
                      <p className="text-sm font-bold text-stone-800 mb-0.5">{listing.title}</p>
                      <p className="text-xs text-stone-400">{fmt.icon} {fmt.label} · {listing.duration} min</p>
                    </div>
                    <div className="text-right">
                      <p className="font-fraunces text-xl font-black text-emerald-700">{listing.credit_price} cr</p>
                      <p className="text-[11px] text-stone-400">from wallet</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-500 block mb-1.5">Preferred Date *</label>
                    <input type="date" min={minDate} value={proposedDate}
                      onChange={e => setProposedDate(e.target.value)}
                      className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none font-sans transition-colors ${proposedDate ? "border-emerald-400" : "border-stone-200"}`} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-500 block mb-1.5">Preferred Time *</label>
                    <input type="time" value={proposedTime}
                      onChange={e => setProposedTime(e.target.value)}
                      className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none font-sans transition-colors ${proposedTime ? "border-emerald-400" : "border-stone-200"}`} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-500 block mb-1.5">Message to teacher <span className="font-normal text-stone-300">(optional)</span></label>
                    <textarea rows={3} placeholder="Tell the teacher about your experience level..."
                      value={note} onChange={e => setNote(e.target.value)}
                      className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none font-sans resize-none" />
                  </div>

                  <div className={`rounded-xl p-3 flex justify-between items-center ${canAfford ? "bg-emerald-50" : "bg-red-50"}`}>
                    <span className={`text-sm font-bold ${canAfford ? "text-emerald-700" : "text-red-600"}`}>
                      {canAfford ? "✓ You have enough credits" : "✗ Insufficient credits"}
                    </span>
                    <span className={`text-sm font-black ${canAfford ? "text-emerald-700" : "text-red-600"}`}>
                      {currentUser?.credits || 0} / {listing.credit_price} cr
                    </span>
                  </div>
                </div>

                {bookError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl mt-3">{bookError}</p>}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowBookModal(false)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold border-0 cursor-pointer hover:bg-stone-200 transition-colors">Cancel</button>
                  <button
                    onClick={() => { if (!proposedDate || !proposedTime) { setBookError("Please select a date and time."); return; } if (!canAfford) { setBookError(`You need ${listing.credit_price} credits.`); return; } setBookError(""); setBookingStep("confirm"); }}
                    className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-sm font-black border-0 cursor-pointer hover:bg-emerald-700 transition-colors">
                    Review Booking →
                  </button>
                </div>
              </>
            )}

            {bookingStep === "confirm" && (
              <>
                <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-1">Confirm Booking 🔒</h2>
                <p className="text-stone-400 text-sm mb-6">Credits will be held in escrow until the session is complete.</p>

                <div className="flex flex-col gap-2 mb-5">
                  {[
                    { label: "Session",       value: listing.title },
                    { label: "Teacher",       value: listing.profiles?.full_name },
                    { label: "Format",        value: `${fmt.icon} ${fmt.label}` },
                    { label: "Duration",      value: `${listing.duration} minutes` },
                    { label: "Proposed time", value: proposedDate && proposedTime ? new Date(`${proposedDate}T${proposedTime}`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "" },
                    { label: "Credits",       value: `${listing.credit_price} cr (₱${listing.credit_price * 10})` },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center px-4 py-2.5 bg-stone-50 rounded-xl text-sm">
                      <span className="text-stone-400 font-semibold">{item.label}</span>
                      <span className="text-stone-800 font-bold text-right max-w-[55%]">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    ⚠️ <strong>{listing.credit_price} credits</strong> will be locked in escrow. Released to the teacher after the session is marked complete.
                  </p>
                </div>

                {bookError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-3">{bookError}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setBookingStep("form")} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold border-0 cursor-pointer hover:bg-stone-200 transition-colors">← Back</button>
                  <button onClick={handleBook} disabled={booking}
                    className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-sm font-black border-0 cursor-pointer hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {booking ? "Confirming..." : `🔒 Confirm & Lock ${listing.credit_price} Credits`}
                  </button>
                </div>
              </>
            )}

            {bookingStep === "success" && (
              <div className="text-center py-4">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-2">Session Requested!</h2>
                <p className="text-stone-500 text-sm mb-1">Your request has been sent to <strong>{listing.profiles?.full_name}</strong>.</p>
                <p className="text-stone-400 text-sm mb-6"><strong>{listing.credit_price} credits</strong> are now held in escrow.</p>
                <div className="flex gap-3">
                  <a href="/dashboard" className="flex-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold no-underline text-center hover:bg-emerald-100 transition-colors">Dashboard</a>
                  <button onClick={() => { setShowBookModal(false); setBookingStep("form"); }}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-black border-0 cursor-pointer hover:bg-emerald-700 transition-colors">
                    Done ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-40 px-8 h-14 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="/listings" className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">← All Listings</a>
          {currentUser && (
            <span className="bg-emerald-50 text-emerald-700 text-sm font-bold px-3 py-1.5 rounded-full">💰 {currentUser.credits} cr</span>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-[1fr_320px] gap-7 items-start">

          {/* LEFT */}
          <div className="flex flex-col gap-5">

            {/* Hero */}
            <div className="bg-white rounded-2xl border border-stone-200 p-7">
              <div className="flex gap-2 flex-wrap mb-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${fmt.bg} ${fmt.color}`}>{fmt.icon} {fmt.label}</span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">{listing.skills?.category}</span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700">⏱ {listing.duration} min</span>
                {portfolio.length > 0 && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-violet-50 text-violet-700">📁 {portfolio.length} portfolio sample{portfolio.length > 1 ? "s" : ""}</span>
                )}
              </div>
              <h1 className="font-fraunces text-2xl font-black text-stone-900 mb-4 leading-snug">{listing.title}</h1>
              <p className="text-sm text-stone-500 leading-relaxed">{listing.description}</p>
            </div>

            {/* Portfolio Gallery */}
            <PortfolioGallery items={portfolio} />

            {/* What you'll learn */}
            {listing.outcomes && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
                <h3 className="font-fraunces text-base font-black text-emerald-700 mb-2">🎯 What You'll Walk Away With</h3>
                <p className="text-sm text-stone-600 leading-relaxed">{listing.outcomes}</p>
              </div>
            )}

            {/* Session details */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-fraunces text-base font-black text-stone-900 mb-4">Session Details</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: fmt.icon, label: "Format",        value: `${fmt.label} — ${fmt.desc}` },
                  { icon: "⏱",     label: "Duration",      value: `${listing.duration} minutes` },
                  { icon: "📋",    label: "Prerequisites",  value: listing.prerequisites || "None required" },
                  { icon: "📦",    label: "Materials",      value: listing.materials || "Will be discussed in session" },
                ].map(item => (
                  <div key={item.label} className="bg-stone-50 rounded-xl p-4">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide mb-1">{item.icon} {item.label}</p>
                    <p className="text-sm text-stone-600 leading-snug">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6">
              <h3 className="font-fraunces text-base font-black text-stone-900 mb-4">About the Teacher</h3>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 text-lg font-black flex items-center justify-center flex-shrink-0">
                  {teacherInitials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-fraunces text-lg font-black text-stone-900">{listing.profiles?.full_name}</h4>
                    <BadgeChip tier={teacherBadge} size="sm" />
                  </div>
                  <p className="text-xs text-stone-400 mb-2">@{listing.profiles?.username}</p>
                  {listing.profiles?.bio && <p className="text-sm text-stone-500 leading-relaxed">{listing.profiles.bio}</p>}
                </div>
              </div>

              {/* Reputation mini */}
              <ReputationMini data={{
                avgRating:          teacherAvgRating,
                completedSessions:  teacherSessions,
                repeatClients:      teacherRepeats,
                disputes:           teacherDisputes,
              }} />
            </div>
          </div>

          {/* RIGHT — Booking sidebar */}
          <div className="sticky top-20">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
              {/* Price */}
              <div className="text-center mb-5 pb-5 border-b border-stone-100">
                <p className="text-xs text-stone-400 font-semibold mb-1">Session price</p>
                <p className="font-fraunces text-5xl font-black text-emerald-700 leading-none mb-1">{listing.credit_price}</p>
                <p className="text-sm text-stone-400">credits · ₱{listing.credit_price * 10}</p>
              </div>

              {/* Quick info */}
              <div className="flex flex-col gap-2.5 mb-5">
                {[
                  { icon: fmt.icon, text: `${fmt.label} session` },
                  { icon: "⏱",     text: `${listing.duration} minutes` },
                  { icon: "🔒",    text: "Credits held in escrow" },
                  { icon: "↩️",    text: "Full refund if cancelled" },
                  ...(portfolio.length > 0 ? [{ icon: "📁", text: `${portfolio.length} portfolio sample${portfolio.length > 1 ? "s" : ""}` }] : []),
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-2.5 text-sm text-stone-500">
                    <span className="w-5 text-center">{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isOwnListing ? (
                <div className="bg-stone-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-stone-400">This is your own listing</p>
                </div>
              ) : currentUser ? (
                <>
                  <button onClick={() => setShowBookModal(true)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-fraunces text-base font-black border-0 cursor-pointer transition-colors mb-2">
                    Book Session →
                  </button>
                  {!canAfford && (
                    <p className="text-xs text-red-500 text-center">
                      Need {listing.credit_price - (currentUser?.credits || 0)} more credits.{" "}
                      <a href="/wallet" className="font-bold text-red-500 no-underline hover:underline">Top up →</a>
                    </p>
                  )}
                </>
              ) : (
                <a href="/login"
                  className="block w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-fraunces text-base font-black no-underline text-center transition-colors">
                  Log in to Book →
                </a>
              )}

              <p className="text-[11px] text-stone-300 text-center mt-3 leading-relaxed">
                Credits are locked in escrow until both parties confirm the session is complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}