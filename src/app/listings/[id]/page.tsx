"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  title: string;
  description: string;
  credit_price: number;
  format: string;
  duration: number;
  prerequisites: string;
  outcomes: string;
  materials: string;
  is_active: boolean;
  created_at: string;
  teacher_id: string;
  skills: { name: string; category: string };
  profiles: { id: string; full_name: string; username: string; level: string; bio: string; credits: number; xp: number };
};

type UserProfile = {
  id: string;
  full_name: string;
  credits: number;
};

const FORMAT_INFO: Record<string, { icon: string; label: string; color: string; bg: string; desc: string }> = {
  video: { icon: "📹", label: "Video Call", color: "#1d6fb8", bg: "#e3f0fb", desc: "Live session via Google Meet, Zoom, or any video platform" },
  chat:  { icon: "💬", label: "Chat",       color: "#2d6a4f", bg: "#e8f4e8", desc: "Text-based teaching inside SkillCredit messenger" },
  docs:  { icon: "📄", label: "Docs",       color: "#7c3aed", bg: "#f0ebff", desc: "Shared documents, written guides, and notes" },
  mixed: { icon: "🎨", label: "Mixed",      color: "#b45309", bg: "#fff8e7", desc: "Combination of video, chat, and documents" },
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#0369a1", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#059669", Legend: "#d97706",
};

const mockListing: Listing = {
  id: "mock", title: "Python for Absolute Beginners", description: "Learn Python from scratch in a structured, fun, and beginner-friendly session. We'll go through variables, data types, loops, functions, and build a mini project together by the end of the session.", credit_price: 15, format: "video", duration: 60, prerequisites: "No prior experience needed — just bring curiosity!", outcomes: "Understand Python basics, write your first functions, build a simple calculator app", materials: "Slides, code templates, practice exercises PDF", is_active: true, created_at: new Date().toISOString(), teacher_id: "mock-teacher",
  skills: { name: "Python", category: "Programming" },
  profiles: { id: "mock-teacher", full_name: "Maria Santos", username: "mariasantos", level: "Expert", bio: "Software engineer with 5 years experience. I love teaching Python to beginners!", credits: 0, xp: 1200 },
};

export default function ListingDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingStep, setBookingStep] = useState<"form" | "confirm" | "success">("form");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: prof } = await supabase.from("profiles").select("id, full_name, credits").eq("id", user.id).single();
        if (prof) setCurrentUser(prof);
      }

      if (id === "mock" || !id) {
        setListing(mockListing);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("listings")
        .select(`*, skills(name, category), profiles(id, full_name, username, level, bio, xp)`)
        .eq("id", id)
        .single();

      if (error || !data) {
        setListing(mockListing);
      } else {
        setListing(data as Listing);
      }
      setLoading(false);
    };
    init();
  }, [id]);

  const handleBook = async () => {
    if (!currentUser || !listing) return;
    if (!proposedDate || !proposedTime) { setBookError("Please select a date and time."); return; }

    setBooking(true);
    setBookError("");

    const proposedDateTime = new Date(`${proposedDate}T${proposedTime}`).toISOString();

    // Check user has enough credits
    if (currentUser.credits < listing.credit_price) {
      setBookError(`You need ${listing.credit_price} credits but only have ${currentUser.credits}. Please top up your wallet.`);
      setBooking(false);
      return;
    }

    // Create session
    const { data: session, error: sessionErr } = await supabase.from("sessions").insert({
      listing_id: listing.id,
      teacher_id: listing.teacher_id,
      learner_id: currentUser.id,
      proposed_time: proposedDateTime,
      status: "pending",
      learner_note: note,
      credit_amount: listing.credit_price,
    }).select().single();

    if (sessionErr || !session) {
      setBookError("Failed to create session. Please try again.");
      setBooking(false);
      return;
    }

    // Create escrow record
    await supabase.from("escrow").insert({
      session_id: session.id,
      amount: listing.credit_price,
      status: "locked",
    });

    // Deduct credits from learner
    await supabase.from("profiles").update({ credits: currentUser.credits - listing.credit_price }).eq("id", currentUser.id);

    // Log credit transaction
    await supabase.from("credit_transactions").insert({
      user_id: currentUser.id,
      amount: -listing.credit_price,
      type: "session_spend",
      reference_id: session.id,
      description: `Booked session: ${listing.title}`,
    });

    // Create notification for teacher
    await supabase.from("notifications").insert({
      user_id: listing.teacher_id,
      type: "session",
      title: "New session request!",
      body: `${currentUser.full_name} wants to book "${listing.title}" on ${new Date(proposedDateTime).toLocaleDateString("en-PH", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      link: `/sessions/${session.id}`,
    });

    setBooking(false);
    setBookingStep("success");
  };

  const isOwnListing = currentUser?.id === listing?.teacher_id;
  const canAfford = currentUser ? currentUser.credits >= (listing?.credit_price || 0) : false;
  const fmt = FORMAT_INFO[listing?.format || "mixed"] || FORMAT_INFO.mixed;
  const levelColor = LEVEL_COLORS[listing?.profiles?.level || "Seedling"] || "#2d6a4f";
  const teacherInitials = listing?.profiles?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  // Min date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <p style={{ color: "#888" }}>Loading listing...</p>
        </div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Booking Modal */}
      {showBookModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "36px", maxWidth: 480, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>

            {/* Step: Form */}
            {bookingStep === "form" && (
              <>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>Book a Session 📅</h2>
                <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Propose a time and the teacher will confirm.</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Summary */}
                  <div style={{ background: fmt.bg, borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{listing.title}</p>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{fmt.icon} {fmt.label} · {listing.duration} min</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>{listing.credit_price} cr</p>
                      <p style={{ fontSize: 11, color: "#888", margin: 0 }}>from your wallet</p>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>Preferred Date *</label>
                    <input
                      type="date"
                      min={minDate}
                      value={proposedDate}
                      onChange={e => setProposedDate(e.target.value)}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${proposedDate ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#fafaf8" }}
                    />
                  </div>

                  {/* Time */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>Preferred Time *</label>
                    <input
                      type="time"
                      value={proposedTime}
                      onChange={e => setProposedTime(e.target.value)}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1.5px solid ${proposedTime ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", background: "#fafaf8" }}
                    />
                  </div>

                  {/* Note */}
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>
                      Message to teacher <span style={{ fontWeight: 400, color: "#aaa" }}>(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Tell the teacher about your experience level, what you want to focus on, any questions..."
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", resize: "vertical", background: "#fafaf8" }}
                    />
                  </div>

                  {/* Wallet check */}
                  <div style={{ background: canAfford ? "#e8f4e8" : "#fef2f2", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: canAfford ? "#2d6a4f" : "#dc2626", fontWeight: 600 }}>
                      {canAfford ? "✓ You have enough credits" : "✗ Insufficient credits"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: canAfford ? "#2d6a4f" : "#dc2626" }}>
                      {currentUser?.credits || 0} / {listing.credit_price} cr
                    </span>
                  </div>
                </div>

                {bookError && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{bookError}</p>}

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button onClick={() => setShowBookModal(false)} style={{ flex: 1, padding: "12px", background: "#f5f0e8", color: "#555", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => { if (!proposedDate || !proposedTime) { setBookError("Please select a date and time."); return; } if (!canAfford) { setBookError(`You need ${listing.credit_price} credits but only have ${currentUser?.credits || 0}.`); return; } setBookError(""); setBookingStep("confirm"); }}
                    style={{ flex: 2, padding: "12px", background: "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    Review Booking →
                  </button>
                </div>
              </>
            )}

            {/* Step: Confirm */}
            {bookingStep === "confirm" && (
              <>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>Confirm Booking 🔒</h2>
                <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Credits will be held in escrow until the session is complete.</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {[
                    { label: "Session", value: listing.title },
                    { label: "Teacher", value: listing.profiles?.full_name },
                    { label: "Format", value: `${fmt.icon} ${fmt.label}` },
                    { label: "Duration", value: `${listing.duration} minutes` },
                    { label: "Proposed time", value: proposedDate && proposedTime ? new Date(`${proposedDate}T${proposedTime}`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "" },
                    { label: "Credits", value: `${listing.credit_price} credits (₱${listing.credit_price * 10})` },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fafaf8", borderRadius: 10, fontSize: 13 }}>
                      <span style={{ color: "#888", fontWeight: 600 }}>{item.label}</span>
                      <span style={{ color: "#1a1a1a", fontWeight: 700, textAlign: "right", maxWidth: "60%" }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#fff8e7", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
                  <p style={{ fontSize: 12, color: "#b45309", margin: 0, lineHeight: 1.5 }}>
                    ⚠️ <strong>{listing.credit_price} credits</strong> will be locked in escrow when you confirm. They'll be released to the teacher after the session is marked complete. You can cancel for a full refund if the teacher hasn't confirmed yet.
                  </p>
                </div>

                {bookError && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>{bookError}</p>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setBookingStep("form")} style={{ flex: 1, padding: "12px", background: "#f5f0e8", color: "#555", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button onClick={handleBook} disabled={booking} style={{ flex: 2, padding: "12px", background: booking ? "#a8c5b5" : "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: booking ? "not-allowed" : "pointer" }}>
                    {booking ? "Confirming..." : `🔒 Confirm & Lock ${listing.credit_price} Credits`}
                  </button>
                </div>
              </>
            )}

            {/* Step: Success */}
            {bookingStep === "success" && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
                  Session Requested!
                </h2>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>
                  Your request has been sent to <strong>{listing.profiles?.full_name}</strong>.
                </p>
                <p style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
                  <strong>{listing.credit_price} credits</strong> are now held in escrow.
                </p>
                <p style={{ fontSize: 13, color: "#aaa", marginBottom: 28 }}>
                  You'll get a notification when the teacher responds. ⏳
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href="/dashboard" style={{ flex: 1, padding: "12px", background: "#e8f4e8", color: "#2d6a4f", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                    Dashboard
                  </a>
                  <button onClick={() => { setShowBookModal(false); setBookingStep("form"); }} style={{ flex: 1, padding: "12px", background: "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    Done ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← All Listings</a>
          {currentUser && (
            <div style={{ background: "#e8f4e8", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>
              💰 {currentUser.credits} credits
            </div>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28, alignItems: "start" }}>

          {/* LEFT — Main content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Hero card */}
            <div style={{ background: "white", borderRadius: 24, padding: "32px", border: "1px solid #e8e0d0" }}>
              {/* Tags */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ background: fmt.bg, color: fmt.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>
                  {fmt.icon} {fmt.label}
                </span>
                <span style={{ background: "#e8f4e8", color: "#2d6a4f", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>
                  {listing.skills?.category}
                </span>
                <span style={{ background: "#f5f0e8", color: "#b45309", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>
                  ⏱ {listing.duration} min
                </span>
                {listing.is_active && (
                  <span style={{ background: "#e8f4e8", color: "#2d6a4f", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>
                    ● Active
                  </span>
                )}
              </div>

              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", marginBottom: 16, lineHeight: 1.25 }}>
                {listing.title}
              </h1>

              <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 0 }}>
                {listing.description}
              </p>
            </div>

            {/* What you'll learn */}
            {listing.outcomes && (
              <div style={{ background: "#e8f4e8", borderRadius: 20, padding: "24px", border: "1px solid #c8e6c9" }}>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 800, color: "#2d6a4f", marginBottom: 12 }}>
                  🎯 What You'll Walk Away With
                </h3>
                <p style={{ fontSize: 14, color: "#333", lineHeight: 1.7, margin: 0 }}>{listing.outcomes}</p>
              </div>
            )}

            {/* Details grid */}
            <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>Session Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: fmt.icon, label: "Format", value: `${fmt.label} — ${fmt.desc}` },
                  { icon: "⏱", label: "Duration", value: `${listing.duration} minutes per session` },
                  { icon: "📋", label: "Prerequisites", value: listing.prerequisites || "None required" },
                  { icon: "📦", label: "Materials", value: listing.materials || "Will be discussed in session" },
                ].map(item => (
                  <div key={item.label} style={{ background: "#fafaf8", borderRadius: 12, padding: "14px" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#aaa", marginBottom: 4 }}>{item.icon} {item.label.toUpperCase()}</p>
                    <p style={{ fontSize: 13, color: "#333", margin: 0, lineHeight: 1.4 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher card */}
            <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>About the Teacher</h3>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: levelColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "white", flexShrink: 0 }}>
                  {teacherInitials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>{listing.profiles?.full_name}</h4>
                    <span style={{ background: "#f5f0e8", color: levelColor, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                      {listing.profiles?.level}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#888", margin: "0 0 8px" }}>@{listing.profiles?.username}</p>
                  {listing.profiles?.bio && (
                    <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6, margin: 0 }}>{listing.profiles.bio}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Booking sidebar */}
          <div style={{ position: "sticky", top: 88 }}>
            <div style={{ background: "white", borderRadius: 24, padding: "28px", border: "1px solid #e8e0d0", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>

              {/* Price */}
              <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #f0ece4" }}>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Session price</p>
                <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 44, fontWeight: 800, color: "#2d6a4f", margin: "0 0 2px" }}>
                  {listing.credit_price}
                </p>
                <p style={{ fontSize: 14, color: "#888", margin: 0 }}>credits · ₱{listing.credit_price * 10}</p>
              </div>

              {/* Quick info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {[
                  { icon: fmt.icon, text: `${fmt.label} session` },
                  { icon: "⏱", text: `${listing.duration} minutes` },
                  { icon: "🔒", text: "Credits held in escrow" },
                  { icon: "↩️", text: "Full refund if cancelled" },
                ].map(item => (
                  <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#555" }}>
                    <span style={{ width: 20, textAlign: "center" }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isOwnListing ? (
                <div style={{ background: "#f5f0e8", borderRadius: 14, padding: "14px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#888", margin: 0 }}>This is your own listing</p>
                </div>
              ) : currentUser ? (
                <>
                  <button
                    onClick={() => setShowBookModal(true)}
                    style={{ width: "100%", padding: "15px", background: "#2d6a4f", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Fraunces', Georgia, serif", marginBottom: 10 }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1a4a35"}
                    onMouseLeave={e => e.currentTarget.style.background = "#2d6a4f"}
                  >
                    Book Session →
                  </button>
                  {!canAfford && (
                    <p style={{ fontSize: 12, color: "#dc2626", textAlign: "center", margin: "8px 0 0" }}>
                      You need {listing.credit_price - (currentUser?.credits || 0)} more credits.{" "}
                      <a href="/wallet/topup" style={{ color: "#dc2626", fontWeight: 700 }}>Top up →</a>
                    </p>
                  )}
                </>
              ) : (
                <a href="/login" style={{ display: "block", width: "100%", padding: "15px", background: "#2d6a4f", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: "pointer", textDecoration: "none", textAlign: "center", boxSizing: "border-box", fontFamily: "'Fraunces', Georgia, serif" }}>
                  Log in to Book →
                </a>
              )}

              <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                Credits are locked in escrow until both parties confirm the session is complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}