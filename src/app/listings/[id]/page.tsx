"use client";
import React, { useEffect, useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type PortfolioItem = { id: string; url: string; type: string; caption: string };
type Review = { id: string; overall: number; review?: string | null; created_at: string; reviewer?: { full_name: string; avatar_url?: string | null } | { full_name: string; avatar_url?: string | null }[] };
type Listing = {
  id: string; title: string; description: string;
  credit_price: number; format: string; duration: number;
  prerequisites: string; outcomes: string; materials: string;
  is_active: boolean; created_at: string; teacher_id: string;
  thumbnail_url?: string; difficulty?: string;
  skills: { name: string; category: string };
  profiles: {
    id: string; full_name: string; username: string; bio: string;
    avatar_url?: string | null;
  };
};
type UserProfile = { id: string; full_name: string; credits: number };

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FORMAT_INFO: Record<string, { icon: string; label: string; color: string; bg: string; border: string; desc: string }> = {
  video: { icon:"📹", label:"Video Call", color:"#0369a1", bg:"#e0f2fe", border:"#bae6fd", desc:"Live session via Google Meet or Zoom" },
  chat:  { icon:"💬", label:"Chat",       color:"#166534", bg:"#dcfce7", border:"#86efac", desc:"Text-based teaching inside SkillCredit" },
  docs:  { icon:"📄", label:"Docs",       color:"#7c3aed", bg:"#ede9fe", border:"#c4b5fd", desc:"Shared documents and written guides" },
  mixed: { icon:"🎨", label:"Mixed",      color:"#b45309", bg:"#fef3c7", border:"#fcd34d", desc:"Combination of video, chat, and documents" },
};
const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: string; gradient: string }> = {
  Programming: { color:"#1d4ed8", bg:"#dbeafe", icon:"💻", gradient:"linear-gradient(135deg,#1e3a8a,#1d4ed8 50%,#3b82f6)" },
  Design:      { color:"#be185d", bg:"#fce7f3", icon:"🎨", gradient:"linear-gradient(135deg,#831843,#be185d 50%,#ec4899)" },
  Language:    { color:"#166534", bg:"#dcfce7", icon:"🌍", gradient:"linear-gradient(135deg,#14532d,#16a34a 50%,#4ade80)" },
  Academic:    { color:"#7c3aed", bg:"#ede9fe", icon:"📚", gradient:"linear-gradient(135deg,#4c1d95,#7c3aed 50%,#a78bfa)" },
  Music:       { color:"#b45309", bg:"#fef3c7", icon:"🎵", gradient:"linear-gradient(135deg,#78350f,#d97706 50%,#fcd34d)" },
  Arts:        { color:"#991b1b", bg:"#fee2e2", icon:"🎭", gradient:"linear-gradient(135deg,#7f1d1d,#dc2626 50%,#f87171)" },
  Media:       { color:"#0369a1", bg:"#e0f2fe", icon:"🎬", gradient:"linear-gradient(135deg,#0c4a6e,#0284c7 50%,#38bdf8)" },
  Science:     { color:"#0f766e", bg:"#ccfbf1", icon:"🔬", gradient:"linear-gradient(135deg,#134e4a,#0f766e 50%,#2dd4bf)" },
  Other:       { color:"#57534e", bg:"#f5f5f4", icon:"💡", gradient:"linear-gradient(135deg,#292524,#57534e 50%,#a8a29e)" },
};
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  beginner:     { label: "🟢 Beginner Friendly", color: "#15803d", bg: "#dcfce7" },
  intermediate: { label: "🟡 Intermediate",      color: "#b45309", bg: "#fef3c7" },
  advanced:     { label: "🔴 Advanced",          color: "#dc2626", bg: "#fee2e2" },
};

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function getInitials(n: string) { return (n||"??").split(" ").map(c=>c[0]).join("").slice(0,2).toUpperCase(); }
function Stars({ rating, count, size = 14 }: { rating: number; count?: number; size?: number }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
      {Array.from({length:5},(_,i)=>(
        <span key={i} style={{ fontSize:size, color: i < Math.round(rating) ? "#f59e0b" : "#e2d9cc", lineHeight:1 }}>★</span>
      ))}
      <span style={{ fontSize:size-2, fontWeight:700, color:"#b45309", marginLeft:3 }}>{rating.toFixed(1)}</span>
      {count != null && <span style={{ fontSize:size-3, color:"#bbb" }}>({count})</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// TEACHER AVATAR (large, for detail page)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// PORTFOLIO GALLERY
// ─────────────────────────────────────────────────────────────
function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [lightbox, setLightbox] = useState<string|null>(null);
  if (!items.length) return null;
  return (
    <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:24 }}>
      <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:16 }}>📁 Portfolio Samples</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {items.map(item => (
          <div key={item.id} onClick={() => item.type==="image" && setLightbox(item.url)}
            style={{ borderRadius:12, overflow:"hidden", border:"1.5px solid #e8e2d9", cursor:"pointer", transition:"opacity .15s" }}
            onMouseOver={e => (e.currentTarget as HTMLElement).style.opacity=".85"}
            onMouseOut={e  => (e.currentTarget as HTMLElement).style.opacity="1"}>
            {item.type==="image" ? <img src={item.url} alt={item.caption||"Portfolio"} style={{ width:"100%", height:96, objectFit:"cover" }} /> : item.type==="video" ? <div style={{ width:"100%", height:96, background:"#f0ece4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>🎬</div> : <div style={{ width:"100%", height:96, background:"#f0ece4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>📄</div>}
            {item.caption && <p style={{ fontSize:11, color:"#aaa", padding:"6px 8px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.caption}</p>}
          </div>
        ))}
      </div>
      {lightbox && <div onClick={() => setLightbox(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}><img src={lightbox} alt="Preview" style={{ maxWidth:"90vw", maxHeight:"90vh", borderRadius:16 }} /></div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REVIEWS SECTION
// ─────────────────────────────────────────────────────────────
function ReviewsSection({ teacherId, avgRating, totalRatings }: { teacherId: string; avgRating: number; totalRatings: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from("ratings")
      .select(`id, overall, review, created_at, reviewer:profiles!ratings_rater_id_fkey(full_name, avatar_url)`)
      .eq("rated_id", teacherId).eq("is_flagged", false).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => { setReviews((data || []) as unknown as Review[]); setLoading(false); });
  }, [teacherId]);

  const visible = expanded ? reviews : reviews.slice(0, 3);
  if (!loading && reviews.length === 0) return null;

  return (
    <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", display:"flex", alignItems:"center", gap:8 }}>
          ⭐ Reviews
          {totalRatings > 0 && <span style={{ fontSize:12, fontWeight:700, background:"#fef3c7", color:"#b45309", padding:"2px 10px", borderRadius:99 }}>{totalRatings}</span>}
        </h3>
        {avgRating > 0 && <Stars rating={avgRating} count={totalRatings} size={15} />}
      </div>
      {reviews.length >= 3 && (() => {
        const dist = [5,4,3,2,1].map(star => ({ star, count: reviews.filter(r => Math.round(r.overall) === star).length }));
        return (
          <div style={{ marginBottom:18, display:"flex", flexDirection:"column", gap:5 }}>
            {dist.map(d => (
              <div key={d.star} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                <span style={{ width:16, textAlign:"right", color:"#888", fontWeight:600 }}>{d.star}★</span>
                <div style={{ flex:1, height:6, background:"#f0ece4", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${reviews.length ? (d.count/reviews.length)*100 : 0}%`, background:"#f59e0b", borderRadius:99 }} />
                </div>
                <span style={{ width:18, color:"#bbb", fontWeight:600 }}>{d.count}</span>
              </div>
            ))}
          </div>
        );
      })()}
      {loading ? (
        <div style={{ textAlign:"center", padding:24, color:"#bbb", fontSize:13 }}>Loading reviews…</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {visible.map(r => {
            const rev = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
            return (
            <div key={r.id} style={{ padding:"14px 16px", background:"#fafaf8", borderRadius:14, border:"1.5px solid #f0ece4" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", overflow:"hidden", flexShrink:0 }}>
                  {rev?.avatar_url ? <img src={rev.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : getInitials(rev?.full_name||"?")}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1a1a1a" }}>{rev?.full_name || "Anonymous"}</div>
                  <Stars rating={r.overall} size={11} />
                </div>
                <span style={{ marginLeft:"auto", fontSize:11, color:"#ccc" }}>
                  {new Date(r.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                </span>
              </div>
              {r.review && <p style={{ fontSize:13, color:"#555", lineHeight:1.65, fontStyle:"italic" }}>"{r.review}"</p>}
            </div>
            );
          })}
          {reviews.length > 3 && (
            <button onClick={() => setExpanded(e => !e)}
              style={{ padding:"9px", borderRadius:12, background:"#f5f0e8", color:"#2d6a4f", fontSize:12, fontWeight:700, border:"1.5px solid #e8e2d9", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              {expanded ? "Show fewer reviews" : `Show all ${reviews.length} reviews →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PROFILE FIELDS for FK joins
// ─────────────────────────────────────────────────────────────
const PROFILE_FIELDS = "id,full_name,username,bio,avatar_url";

function PlainTeacherAvatar({ name, avatar_url, size }: { name: string; avatar_url?: string | null; size: number }) {
  return <div style={{ width:size, height:size, flexShrink:0, borderRadius:"50%", overflow:"hidden", display:"grid", placeItems:"center", background:"#e7f1e9", color:"#214c39", fontWeight:800 }}>{avatar_url ? <img src={avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : getInitials(name)}</div>;
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [listing, setListing]           = useState<Listing|null>(null);
  const [currentUser, setCurrentUser]   = useState<UserProfile|null>(null);
  const [portfolio, setPortfolio]       = useState<PortfolioItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingStep, setBookingStep]   = useState<"form"|"confirm"|"success">("form");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [note, setNote]                 = useState("");
  const [booking, setBooking]           = useState(false);
  const [bookError, setBookError]       = useState("");
  const [teacherSessions, setTeacherSessions]   = useState(0);
  const [teacherAvgRating, setTeacherAvgRating] = useState(0);
  const [teacherTotalRatings, setTeacherTotalRatings] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isMobile, setIsMobile]         = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("book=1") && listing) {
      setShowBookModal(true);
    }
  }, [listing]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("id,full_name,credits").eq("id", user.id).single();
        if (prof) setCurrentUser(prof);
      }
      const { data, error } = await supabase.from("listings")
        .select(`id,title,description,credit_price,format,duration,prerequisites,outcomes,materials,is_active,created_at,teacher_id,thumbnail_url,difficulty,skills(name,category),profiles(${PROFILE_FIELDS})`)
        .eq("id", id).single();
      if (error || !data) { setLoading(false); return; }
      setListing(data as unknown as Listing);
      const { data: pData } = await supabase.from("portfolio_items").select("*").eq("listing_id", id);
      if (pData) setPortfolio(pData as PortfolioItem[]);
      const tid = data.teacher_id;
      const [{ count: sCount }, { data: ratingData }] = await Promise.all([
        supabase.from("sessions").select("*",{count:"exact",head:true}).eq("teacher_id",tid).eq("status","completed"),
        supabase.from("ratings").select("overall").eq("rated_id", tid).eq("is_flagged", false),
      ]);
      setTeacherSessions(sCount || 0);
      if (ratingData?.length) {
        setTeacherAvgRating(parseFloat(bayesianAvg(ratingData.map((r:any) => r.overall)).toFixed(2)));
        setTeacherTotalRatings(ratingData.length);
      }
      setLoading(false);
    };
    init();
  }, [id]);

  const openBookModal = () => { setProposedDate(""); setProposedTime(""); setNote(""); setBookError(""); setBookingStep("form"); setShowBookModal(true); };

  const handleBook = async () => {
    if (!currentUser || !listing) return;
    if (currentUser.id === listing.teacher_id) { setBookError("You cannot book your own listing."); return; }
    if (!proposedDate || !proposedTime) { setBookError("Please select a date and time."); return; }
    if (currentUser.credits < listing.credit_price) { setBookError(`You need ${listing.credit_price} credits but only have ${currentUser.credits}.`); return; }
    setBooking(true); setBookError("");
    const { data: existing } = await supabase.from("sessions").select("id").eq("listing_id",listing.id).eq("learner_id",currentUser.id).in("status",["pending","confirmed"]).maybeSingle();
    if (existing) { setBookError("You already have an active booking for this listing."); setBooking(false); return; }
    let deductedCredits: number | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: balance, error: balanceError } = await supabase.from("profiles").select("credits").eq("id", currentUser.id).single();
      if (balanceError || !balance) break;
      if (balance.credits < listing.credit_price) {
        setCurrentUser({ ...currentUser, credits: balance.credits });
        setBookError(`You need ${listing.credit_price} credits but only have ${balance.credits}.`);
        setBooking(false);
        return;
      }
      const { data: updatedBalance, error: debitError } = await supabase.from("profiles")
        .update({ credits: balance.credits - listing.credit_price })
        .eq("id", currentUser.id).eq("credits", balance.credits)
        .select("credits").maybeSingle();
      if (!debitError && updatedBalance) { deductedCredits = updatedBalance.credits; break; }
    }
    if (deductedCredits === null) {
      setBookError("Your credit balance changed while booking. Please try again.");
      setBooking(false);
      return;
    }
    const dt = new Date(`${proposedDate}T${proposedTime}`).toISOString();
    const { data: session, error: sessionErr } = await supabase.from("sessions").insert({
      listing_id: listing.id, teacher_id: listing.teacher_id, learner_id: currentUser.id,
      proposed_time: dt, status: "pending", learner_note: note, credit_amount: listing.credit_price,
    }).select().single();
    if (sessionErr || !session) {
      const { error: refundError } = await supabase.rpc("increment_credits", { user_id: currentUser.id, amount: listing.credit_price });
      setBookError(refundError
        ? "The session could not be created and automatic credit recovery failed. Please contact an administrator before trying again."
        : "Failed to create session. Your credits were returned; please try again.");
      setBooking(false); return;
    }
    const { error: escrowError } = await supabase.from("escrow").insert({ session_id: session.id, amount: listing.credit_price, status: "locked" });
    if (escrowError) {
      const { error: refundError } = await supabase.rpc("increment_credits", { user_id: currentUser.id, amount: listing.credit_price });
      const { error: cancelError } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", session.id).eq("status", "pending");
      setBookError(refundError || cancelError
        ? "Escrow setup failed and the automatic rollback was incomplete. Please contact an administrator before booking again."
        : "Could not lock credits for this session. Your credits were returned.");
      setBooking(false); return;
    }
    const { error: transactionError } = await supabase.from("credit_transactions").insert({ user_id: currentUser.id, amount: -listing.credit_price, type: "session_spend", reference_id: session.id, description: `Booked session: ${listing.title}` });
    if (transactionError) {
      const { data: refundedEscrow, error: escrowRollbackError } = await supabase.from("escrow").update({ status: "refunded" }).eq("session_id", session.id).eq("status", "locked").select("id").maybeSingle();
      const { error: creditRollbackError } = await supabase.rpc("increment_credits", { user_id: currentUser.id, amount: listing.credit_price });
      const { error: sessionRollbackError } = await supabase.from("sessions").update({ status: "cancelled" }).eq("id", session.id).eq("status", "pending");
      const { error: refundLedgerError } = refundedEscrow && !escrowRollbackError && !creditRollbackError
        ? await supabase.from("credit_transactions").insert({ user_id: currentUser.id, amount: listing.credit_price, type: "session_refund", reference_id: session.id, description: `Booking rollback: ${listing.title}` })
        : { error: new Error("Credit recovery incomplete") };
      setBookError(escrowRollbackError || !refundedEscrow || creditRollbackError || sessionRollbackError || refundLedgerError
        ? "Booking failed and automatic rollback was incomplete. Please contact an administrator before trying again."
        : "Could not record this booking. Your credits were returned.");
      setBooking(false); return;
    }
    await supabase.from("notifications").insert({ user_id: listing.teacher_id, type: "session", title: "New session request!", body: `${currentUser.full_name} wants to book "${listing.title}"`, link: "/sessions" });
    setCurrentUser(p => p ? { ...p, credits: deductedCredits! } : p);
    setBooking(false); setBookingStep("success");
  };

  const isOwnListing = currentUser?.id === listing?.teacher_id;
  const canAfford    = currentUser ? currentUser.credits >= (listing?.credit_price || 0) : false;
  const fmt          = FORMAT_INFO[listing?.format || "mixed"] || FORMAT_INFO.mixed;
  const cat          = CATEGORY_CONFIG[listing?.skills?.category || ""] || CATEGORY_CONFIG.Other;
  const diff         = listing?.difficulty ? DIFFICULTY_CONFIG[listing.difficulty] : null;
  const tomorrow     = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate      = tomorrow.toISOString().split("T")[0];

  function parseBullets(text: string): string[] {
    return text.split(/\n|•|–|-(?=\s)/).map(s => s.trim()).filter(s => s.length > 3);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:32, height:32, border:"3px solid #2d6a4f", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto 14px" }} />
        <p style={{ color:"#999", fontSize:13 }}>Loading listing…</p>
      </div>
    </div>
  );
  if (!listing) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:14 }}>😕</div>
        <p style={{ color:"#aaa", marginBottom:12 }}>Listing not found.</p>
        <a href="/listings" style={{ color:"#2d6a4f", fontWeight:700 }}>← Back to listings</a>
      </div>
    </div>
  );

  const bookButton = (label = "Book Session") => (
    isOwnListing ? null : currentUser ? (
      <button onClick={openBookModal}
        style={{ width:"100%", padding:"14px", background:"#2d6a4f", color:"#fff", borderRadius:16, fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, border:"none", cursor:"pointer", boxShadow:"0 6px 20px rgba(45,106,79,.3)", transition:"background .15s" }}
        onMouseOver={e => (e.currentTarget.style.background = "#1a4a36")}
        onMouseOut={e  => (e.currentTarget.style.background = "#2d6a4f")}>
        {label} — {listing.credit_price} credits
      </button>
    ) : (
      <a href="/login" style={{ display:"block", width:"100%", padding:"14px", background:"#2d6a4f", color:"#fff", borderRadius:16, fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, textAlign:"center", textDecoration:"none" }}>
        Log in to Book →
      </a>
    )
  );

  const outcomeBullets = listing.outcomes ? parseBullets(listing.outcomes) : [];
  const descShort = listing.description.length > 200;

  return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", fontFamily:"'DM Sans',sans-serif", paddingBottom: isMobile ? 90 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;color:inherit}
        @keyframes spin       {to{transform:rotate(360deg)}}
        @keyframes fadeUp     {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @media(max-width:768px){
          .detail-grid{grid-template-columns:1fr!important}
          .detail-sidebar{display:none!important}
          .mobile-sticky-bar{display:flex!important}
          .hero-section{height:240px!important;border-radius:0!important}
        }
        @media(min-width:769px){.mobile-sticky-bar{display:none!important}}
      `}</style>

      {/* BOOKING MODAL */}
      {showBookModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:20 }}>
          <div style={{ background:"#fff", borderRadius:24, padding:32, width:"100%", maxWidth:440, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.25)", animation:"fadeUp .25s ease" }}>
            {bookingStep === "form" && (
              <>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, marginBottom:4 }}>Book a Session 📅</h2>
                <p style={{ color:"#aaa", fontSize:13, marginBottom:24 }}>Propose a time and the teacher will confirm.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ padding:14, borderRadius:16, background:fmt.bg, border:`1px solid ${fmt.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{listing.title}</p>
                      <p style={{ fontSize:11, color:"#aaa" }}>{fmt.icon} {fmt.label} · {listing.duration} min</p>
                    </div>
                    <p style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, color:"#2d6a4f" }}>{listing.credit_price} cr</p>
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:800, color:"#555", letterSpacing:".06em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>Preferred Date *</label>
                    <input type="date" min={minDate} value={proposedDate} onChange={e => setProposedDate(e.target.value)} style={{ width:"100%", padding:"11px 12px", borderRadius:12, border:`1.5px solid ${proposedDate?"#2d6a4f":"#e8e2d9"}`, fontSize:14, background:"#fafaf8", fontFamily:"'DM Sans',sans-serif", outline:"none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:800, color:"#555", letterSpacing:".06em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>Preferred Time *</label>
                    <input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} style={{ width:"100%", padding:"11px 12px", borderRadius:12, border:`1.5px solid ${proposedTime?"#2d6a4f":"#e8e2d9"}`, fontSize:14, background:"#fafaf8", fontFamily:"'DM Sans',sans-serif", outline:"none" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:800, color:"#555", letterSpacing:".06em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>Message <span style={{ fontWeight:500, color:"#bbb", textTransform:"none" as const, fontSize:11 }}>(optional)</span></label>
                    <textarea rows={3} placeholder="Tell the teacher about your experience level…" value={note} onChange={e => setNote(e.target.value)} style={{ width:"100%", padding:"11px 12px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:13, background:"#fafaf8", outline:"none", resize:"none", fontFamily:"'DM Sans',sans-serif" }} />
                  </div>
                  <div style={{ padding:11, borderRadius:12, background:canAfford?"#f0fdf4":"#fef2f2", display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:canAfford?"#15803d":"#dc2626" }}>{canAfford?"✓ You have enough credits":"✗ Insufficient credits"}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:canAfford?"#15803d":"#dc2626" }}>{currentUser?.credits||0} / {listing.credit_price} cr</span>
                  </div>
                </div>
                {bookError && <p style={{ color:"#dc2626", fontSize:13, background:"#fef2f2", padding:12, borderRadius:11, marginTop:12 }}>{bookError}</p>}
                <div style={{ display:"flex", gap:10, marginTop:20 }}>
                  <button onClick={() => setShowBookModal(false)} style={{ flex:1, padding:12, background:"#f5f0e8", color:"#666", borderRadius:12, fontSize:13, fontWeight:700, border:"none", cursor:"pointer" }}>Cancel</button>
                  <button onClick={() => { if (!proposedDate||!proposedTime){setBookError("Please select date and time.");return;} if (!canAfford){setBookError(`Need ${listing.credit_price} credits.`);return;} setBookError(""); setBookingStep("confirm"); }}
                    style={{ flex:2, padding:12, background:"#2d6a4f", color:"#fff", borderRadius:12, fontSize:13, fontWeight:800, border:"none", cursor:"pointer" }}>
                    Review Booking →
                  </button>
                </div>
              </>
            )}
            {bookingStep === "confirm" && (
              <>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, marginBottom:4 }}>Confirm Booking 🔒</h2>
                <p style={{ color:"#aaa", fontSize:13, marginBottom:20 }}>Credits will be held in escrow until session is complete.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                  {[{label:"Session",value:listing.title},{label:"Teacher",value:listing.profiles?.full_name},{label:"Format",value:`${fmt.icon} ${fmt.label}`},{label:"Duration",value:`${listing.duration} minutes`},{label:"Time",value:proposedDate&&proposedTime?new Date(`${proposedDate}T${proposedTime}`).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):""},{label:"Credits",value:`${listing.credit_price} credits`}].map(item=>(
                    <div key={item.label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 12px", background:"#fafaf8", borderRadius:10, fontSize:13 }}>
                      <span style={{ color:"#aaa", fontWeight:600 }}>{item.label}</span>
                      <span style={{ color:"#1a1a1a", fontWeight:700, maxWidth:"55%", textAlign:"right" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:11, padding:12, marginBottom:16 }}>
                  <p style={{ fontSize:12, color:"#b45309", lineHeight:1.6 }}>⚠️ <strong>{listing.credit_price} credits</strong> will be locked in escrow and released to the teacher after the session is complete.</p>
                </div>
                {bookError && <p style={{ color:"#dc2626", fontSize:13, background:"#fef2f2", padding:12, borderRadius:11, marginBottom:12 }}>{bookError}</p>}
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={() => setBookingStep("form")} style={{ flex:1, padding:12, background:"#f5f0e8", color:"#666", borderRadius:12, fontSize:13, fontWeight:700, border:"none", cursor:"pointer" }}>← Back</button>
                  <button onClick={handleBook} disabled={booking} style={{ flex:2, padding:12, background:"#2d6a4f", color:"#fff", borderRadius:12, fontSize:13, fontWeight:800, border:"none", cursor:booking?"not-allowed":"pointer", opacity:booking?.6:1 }}>
                    {booking ? "Confirming…" : `🔒 Confirm & Lock ${listing.credit_price} Credits`}
                  </button>
                </div>
              </>
            )}
            {bookingStep === "success" && (
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <div style={{ fontSize:56, marginBottom:14 }}>🎉</div>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:8 }}>Session Requested!</h2>
                <p style={{ color:"#888", fontSize:14, marginBottom:4 }}>Your request was sent to <strong>{listing.profiles?.full_name}</strong>.</p>
                <p style={{ color:"#aaa", fontSize:13, marginBottom:24 }}><strong>{listing.credit_price} credits</strong> are now held in escrow.</p>
                <div style={{ display:"flex", gap:10 }}>
                  <a href="/sessions" style={{ flex:1, padding:12, background:"#f0fdf4", color:"#15803d", borderRadius:12, fontSize:13, fontWeight:700, textAlign:"center" }}>View Sessions</a>
                  <button onClick={() => { setShowBookModal(false); setBookingStep("form"); }} style={{ flex:1, padding:12, background:"#2d6a4f", color:"#fff", borderRadius:12, fontSize:13, fontWeight:800, border:"none", cursor:"pointer" }}>Done ✓</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <Navbar />

      <div style={{ maxWidth:1020, margin:"0 auto", padding: isMobile ? "0 0 20px" : "28px 24px" }}>
        <div className="detail-grid" style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

            {/* HERO */}
            <div className="hero-section" style={{ borderRadius: isMobile ? 0 : 20, overflow:"hidden", border: isMobile ? "none" : "1.5px solid #e8e2d9", height: isMobile ? 240 : 300, position:"relative", boxShadow: isMobile ? "none" : "0 4px 20px rgba(0,0,0,.06)" }}>
              {listing.thumbnail_url
                ? <img src={listing.thumbnail_url} alt={listing.title} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <div style={{ width:"100%", height:"100%", background:cat.gradient, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:80, filter:"drop-shadow(0 4px 20px rgba(0,0,0,.3))", lineHeight:1 }}>{cat.icon}</span>
                  </div>
              }
              <div style={{ position:"absolute", bottom:14, left:14, display:"flex", gap:8 }}>
                {teacherAvgRating > 0 && (
                  <div style={{ background:"rgba(0,0,0,.55)", backdropFilter:"blur(10px)", borderRadius:20, padding:"5px 12px" }}>
                    <Stars rating={teacherAvgRating} count={teacherTotalRatings} size={12} />
                  </div>
                )}
                <div style={{ background:"rgba(0,0,0,.55)", backdropFilter:"blur(10px)", borderRadius:20, padding:"5px 12px", fontSize:12, color:"rgba(255,255,255,.9)", fontWeight:600 }}>
                  ⏱ {listing.duration} min
                </div>
              </div>
            </div>

            {/* TITLE + TAGS */}
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding: isMobile ? "20px 18px" : 26 }}>
              <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 11px", borderRadius:20, background:fmt.bg, color:fmt.color, border:`1px solid ${fmt.border}` }}>
                  {fmt.icon} {fmt.label}
                </span>
                <span style={{ fontSize:11, fontWeight:700, padding:"3px 11px", borderRadius:20, background:cat.bg, color:cat.color }}>
                  {cat.icon} {listing.skills?.name}
                </span>
                {diff && (
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 11px", borderRadius:20, background:diff.bg, color:diff.color }}>
                    {diff.label}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize: isMobile ? 22 : 26, fontWeight:900, color:"#1a1a1a", lineHeight:1.2, marginBottom:14 }}>{listing.title}</h1>
              {(teacherAvgRating > 0 || teacherSessions > 0) && (
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14, flexWrap:"wrap" }}>
                  {teacherAvgRating > 0 && <Stars rating={teacherAvgRating} count={teacherTotalRatings} size={13} />}
                  {teacherSessions > 0 && <span style={{ fontSize:12, color:"#888", fontWeight:600 }}>🎓 {teacherSessions} sessions taught</span>}
                </div>
              )}
              <div>
                <div style={{ color:"#555", fontSize:14, lineHeight:1.8, overflow:"hidden", maxHeight: isMobile && !descExpanded ? "5em" : "none", maskImage: isMobile && !descExpanded ? "linear-gradient(to bottom, black 60%, transparent 100%)" : "none", WebkitMaskImage: isMobile && !descExpanded ? "linear-gradient(to bottom, black 60%, transparent 100%)" : "none" }}>
                  {listing.description}
                </div>
                {isMobile && descShort && (
                  <button onClick={() => setDescExpanded(e => !e)}
                    style={{ fontSize:13, color:"#2d6a4f", fontWeight:700, background:"none", border:"none", cursor:"pointer", padding:"6px 0", fontFamily:"'DM Sans',sans-serif" }}>
                    {descExpanded ? "Show less ↑" : "Read more →"}
                  </button>
                )}
              </div>
            </div>

            {/* OUTCOMES */}
            {outcomeBullets.length > 0 && (
              <div style={{ background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)", border:"1.5px solid #86efac", borderRadius:20, padding:22 }}>
                <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#15803d", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
                  🎯 What You'll Walk Away With
                </h3>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {outcomeBullets.map((bullet, i) => (
                    <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#fff", flexShrink:0, marginTop:1 }}>✓</div>
                      <span style={{ fontSize:14, color:"#1a4a36", lineHeight:1.55 }}>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SESSION INCLUDES */}
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:22 }}>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:16 }}>📦 Session Includes</h3>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  { icon:"🕒", text:`${listing.duration} minute 1-on-1 session` },
                  { icon:`${fmt.icon}`, text:fmt.desc },
                  { icon:"🔒", text:"Credits held in escrow until session completes" },
                  { icon:"↩️", text:"Full refund if teacher cancels or doesn't show" },
                  ...(portfolio.length > 0 ? [{ icon:"📁", text:`${portfolio.length} portfolio sample${portfolio.length>1?"s":""}` }] : []),
                  ...(listing.materials ? [{ icon:"📋", text:`Materials: ${listing.materials}` }] : []),
                ].map((item, i) => (
                  <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span style={{ fontSize:18, flexShrink:0, lineHeight:1.4 }}>{item.icon}</span>
                    <span style={{ fontSize:14, color:"#555", lineHeight:1.55 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SESSION DETAILS grid */}
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:22 }}>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:16 }}>Session Details</h3>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { icon:fmt.icon, label:"Format",       value:`${fmt.label} — ${fmt.desc}` },
                  { icon:"⏱",     label:"Duration",     value:`${listing.duration} minutes` },
                  { icon:"📋",    label:"Prerequisites", value:listing.prerequisites||"None required" },
                  { icon:"📦",    label:"Materials",     value:listing.materials||"Discussed during session" },
                ].map(item => (
                  <div key={item.label} style={{ background:"#fafaf8", borderRadius:13, padding:14 }}>
                    <p style={{ fontSize:10, fontWeight:800, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>{item.icon} {item.label}</p>
                    <p style={{ fontSize:13, color:"#555", lineHeight:1.4 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* PORTFOLIO */}
            <PortfolioGallery items={portfolio} />

            {/* TEACHER CARD — with perk badges */}
            <div className="sc-panel" style={{ padding:22 }}>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:16 }}>👤 About the Teacher</h3>
              <div style={{ display:"flex", gap:14, marginBottom:12 }}>
                <PlainTeacherAvatar name={listing.profiles?.full_name||"?"} avatar_url={listing.profiles?.avatar_url} size={56} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                    <h4 style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>{listing.profiles?.full_name}</h4>
                  </div>
                  <p style={{ fontSize:12, color:"#68756d", marginBottom:6 }}>@{listing.profiles?.username}</p>
                  {/* Credibility stats */}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:8 }}>
                    {teacherAvgRating > 0 && <span style={{ fontSize:12, fontWeight:700, color:"#b45309" }}>⭐ {teacherAvgRating.toFixed(1)} rating</span>}
                    {teacherSessions > 0 && <span style={{ fontSize:12, color:"#888" }}>🎓 {teacherSessions} sessions</span>}
                    {teacherTotalRatings > 0 && <span style={{ fontSize:12, color:"#888" }}>💬 {teacherTotalRatings} reviews</span>}
                  </div>
                  {listing.profiles?.bio && <p style={{ fontSize:13, color:"#555", lineHeight:1.65, marginTop:8 }}>{listing.profiles.bio}</p>}
                </div>
              </div>
              {/* Stat grid */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, paddingTop:14, borderTop:"1px solid #f0ece4" }}>
                {[
                  { icon:"📚", label:"Sessions", value:teacherSessions },
                  { icon:"⭐", label:"Avg Rating", value:teacherAvgRating > 0 ? teacherAvgRating.toFixed(1) : "—" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:"center", background:"#fafaf8", borderRadius:12, padding:12 }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                    <p style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>{s.value}</p>
                    <p style={{ fontSize:10, color:"#aaa", fontWeight:600 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* REVIEWS */}
            <ReviewsSection teacherId={listing.teacher_id} avgRating={teacherAvgRating} totalRatings={teacherTotalRatings} />
          </div>

          {/* ── RIGHT: STICKY BOOKING CARD — desktop only ── */}
          <div className="detail-sidebar" style={{ position:"sticky", top:76 }}>
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:24, boxShadow:"0 4px 24px rgba(0,0,0,.07)" }}>
              <div style={{ textAlign:"center", marginBottom:18, paddingBottom:18, borderBottom:"1px solid #f0ece4" }}>
                <p style={{ fontSize:11, color:"#aaa", fontWeight:600, marginBottom:4 }}>Session price</p>
                <p style={{ fontFamily:"'Fraunces',serif", fontSize:44, fontWeight:900, color:"#2d6a4f", lineHeight:1, marginBottom:3 }}>{listing.credit_price}</p>
                {teacherAvgRating > 0 && (
                  <div style={{ marginTop:10, display:"flex", justifyContent:"center" }}>
                    <Stars rating={teacherAvgRating} count={teacherTotalRatings} size={13} />
                  </div>
                )}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                {[
                  { icon:fmt.icon, text:`${fmt.label} session` },
                  { icon:"⏱",     text:`${listing.duration} minutes` },
                  ...(diff ? [{ icon:"📊", text:diff.label }] : []),
                  { icon:"🔒",    text:"Credits held in escrow" },
                  { icon:"↩️",    text:"Full refund if cancelled" },
                  ...(portfolio.length > 0 ? [{ icon:"📁", text:`${portfolio.length} portfolio sample${portfolio.length>1?"s":""}` }] : []),
                ].map(item => (
                  <div key={item.text} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#555" }}>
                    <span style={{ width:20, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              {isOwnListing ? (
                <div style={{ background:"#fafaf8", borderRadius:14, padding:14, textAlign:"center" }}>
                  <p style={{ fontSize:13, color:"#aaa" }}>This is your own listing</p>
                  <a href="/listings" style={{ fontSize:12, color:"#2d6a4f", fontWeight:700 }}>Browse other listings →</a>
                </div>
              ) : currentUser ? (
                <>
                  {bookButton()}
                  {!canAfford && (
                    <p style={{ fontSize:12, color:"#dc2626", textAlign:"center", marginTop:8 }}>
                      Need {listing.credit_price - (currentUser?.credits||0)} more credits.{" "}
                      <a href="/listings" style={{ fontWeight:700, color:"#a85136" }}>Browse lower-cost sessions →</a>
                    </p>
                  )}
                </>
              ) : (
                <a href="/login" style={{ display:"block", padding:"14px", background:"#2d6a4f", color:"#fff", borderRadius:16, fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, textAlign:"center" }}>Log in to Book →</a>
              )}
              <p style={{ fontSize:11, color:"#ccc", textAlign:"center", marginTop:12, lineHeight:1.5 }}>Credits locked in escrow until both parties confirm session completion.</p>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR */}
      <div className="mobile-sticky-bar" style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", borderTop:"1.5px solid #e8e2d9", padding:"12px 20px", zIndex:50, alignItems:"center", gap:14, boxShadow:"0 -4px 20px rgba(0,0,0,.08)" }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f", lineHeight:1 }}>{listing.credit_price} cr</div>
        </div>
        <div style={{ flex:1 }}>
          {isOwnListing ? (
            <div style={{ fontSize:12, color:"#aaa", textAlign:"center" }}>Your listing</div>
          ) : currentUser ? (
            <button onClick={openBookModal}
              style={{ width:"100%", padding:"13px", background:canAfford?"#2d6a4f":"#e8e2d9", color:canAfford?"#fff":"#aaa", borderRadius:14, fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, border:"none", cursor:canAfford?"pointer":"not-allowed", minHeight:48 }}>
              {canAfford ? "Book Session →" : "Insufficient credits"}
            </button>
          ) : (
            <a href="/login" style={{ display:"block", padding:"13px", background:"#2d6a4f", color:"#fff", borderRadius:14, fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, textAlign:"center", minHeight:48 }}>
              Log in to Book
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
