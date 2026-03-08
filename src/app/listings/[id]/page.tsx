"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type PortfolioItem = { id: string; url: string; type: string; caption: string };
type Review = { id: string; overall: number; comment?: string; created_at: string; reviewer?: { full_name: string; avatar_url?: string | null } };
type Listing = {
  id: string; title: string; description: string;
  credit_price: number; format: string; duration: number;
  prerequisites: string; outcomes: string; materials: string;
  is_active: boolean; created_at: string; teacher_id: string;
  thumbnail_url?: string; is_featured?: boolean; is_hot_teacher?: boolean; difficulty?: string;
  skills: { name: string; category: string };
  profiles: { id: string; full_name: string; username: string; level: string; bio: string; xp: number; xp_multiplier?: number; champion_title?: string | null; champion_streak?: number; avatar_url?: string | null };
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
const LEVEL_COLORS: Record<string, string> = {
  Seedling:"#2d6a4f", Learner:"#1d4ed8", Contributor:"#7c3aed",
  Skilled:"#b45309", Expert:"#dc2626", Master:"#0891b2", Legend:"#d97706",
};

function getInitials(n: string) { return (n||"??").split(" ").map(c=>c[0]).join("").slice(0,2).toUpperCase(); }
function getLevelFromXP(xp: number): string {
  if (xp>=4000) return "Legend"; if (xp>=2000) return "Master"; if (xp>=1000) return "Expert";
  if (xp>=600)  return "Skilled"; if (xp>=300) return "Contributor"; if (xp>=100) return "Learner";
  return "Seedling";
}
function getRank(m?: number): 0|1|2|3 {
  if (!m||m<1.1) return 0; if (m>=1.25) return 1; if (m>=1.15) return 2; return 3;
}
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
// TEACHER AVATAR (large, for detail page)
// ─────────────────────────────────────────────────────────────
function TeacherAvatar({ name, xp, xp_multiplier, avatar_url, size = 56 }:
  { name: string; xp: number; xp_multiplier?: number; avatar_url?: string | null; size?: number }) {
  const level = getLevelFromXP(xp);
  const bg    = LEVEL_COLORS[level] || "#2d6a4f";
  const rank  = getRank(xp_multiplier);
  const ringStyle: React.CSSProperties = rank===1
    ? { outline:"3px solid #ffd700", boxShadow:"0 0 0 1px #ffd700,0 0 14px 3px rgba(255,215,0,.7)", animation:"goldPulse 2s ease infinite" }
    : rank===2 ? { outline:"3px solid #c0c0c0", boxShadow:"0 0 0 1px #c0c0c0,0 0 10px 2px rgba(192,192,192,.5)", animation:"silverPulse 2s ease infinite" }
    : rank===3 ? { outline:"3px solid #cd7f32", boxShadow:"0 0 0 1px #cd7f32,0 0 10px 2px rgba(205,127,50,.5)", animation:"bronzePulse 2s ease infinite" } : {};
  const badge = rank===1?"👑":rank===2?"🥈":rank===3?"🥉":null;
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size, borderRadius:14, ...ringStyle }}>
      <div style={{ width:size, height:size, borderRadius:14, background:bg, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:size*.3, fontWeight:800, overflow:"hidden" }}>
        {avatar_url ? <img src={avatar_url} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : getInitials(name)}
      </div>
      {badge && <span style={{ position:"absolute", bottom:-5, right:-7, fontSize:size*.32, lineHeight:1, filter:"drop-shadow(0 1px 3px rgba(0,0,0,.5))", zIndex:2 }}>{badge}</span>}
    </div>
  );
}

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
// REVIEWS SECTION (fix #7)
// ─────────────────────────────────────────────────────────────
function ReviewsSection({ teacherId, avgRating, totalRatings }: { teacherId: string; avgRating: number; totalRatings: number }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from("ratings")
      .select(`id, overall, comment, created_at, reviewer:profiles!ratings_reviewer_id_fkey(full_name, avatar_url)`)
      .eq("rated_id", teacherId).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => { setReviews((data || []) as Review[]); setLoading(false); });
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

      {/* Rating distribution bar */}
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
          {visible.map(r => (
            <div key={r.id} style={{ padding:"14px 16px", background:"#fafaf8", borderRadius:14, border:"1.5px solid #f0ece4" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", overflow:"hidden", flexShrink:0 }}>
                  {r.reviewer?.avatar_url ? <img src={r.reviewer.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : getInitials(r.reviewer?.full_name||"?")}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1a1a1a" }}>{r.reviewer?.full_name || "Anonymous"}</div>
                  <Stars rating={r.overall} size={11} />
                </div>
                <span style={{ marginLeft:"auto", fontSize:11, color:"#ccc" }}>
                  {new Date(r.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}
                </span>
              </div>
              {r.comment && <p style={{ fontSize:13, color:"#555", lineHeight:1.65, fontStyle:"italic" }}>"{r.comment}"</p>}
            </div>
          ))}
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

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Open modal with ?book=1 query param
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
        .select(`*, skills(name,category), profiles(id,full_name,username,level,bio,xp,xp_multiplier,champion_title,champion_streak,avatar_url)`)
        .eq("id", id).single();
      if (error || !data) { setLoading(false); return; }
      setListing(data as Listing);
      const { data: pData } = await supabase.from("portfolio_items").select("*").eq("listing_id", id);
      if (pData) setPortfolio(pData as PortfolioItem[]);
      const tid = data.teacher_id;
      const [{ count: sCount }, { data: ratingData }] = await Promise.all([
        supabase.from("sessions").select("*",{count:"exact",head:true}).eq("teacher_id",tid).eq("status","completed"),
        supabase.from("ratings").select("overall").eq("rated_id", tid),
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
    const dt = new Date(`${proposedDate}T${proposedTime}`).toISOString();
    const { data: session, error: sessionErr } = await supabase.from("sessions").insert({
      listing_id: listing.id, teacher_id: listing.teacher_id, learner_id: currentUser.id,
      proposed_time: dt, status: "pending", learner_note: note, credit_amount: listing.credit_price,
    }).select().single();
    if (sessionErr || !session) { setBookError("Failed to create session. Please try again."); setBooking(false); return; }
    await Promise.all([
      supabase.from("escrow").insert({ session_id: session.id, amount: listing.credit_price, status: "locked" }),
      supabase.from("profiles").update({ credits: currentUser.credits - listing.credit_price }).eq("id", currentUser.id),
      supabase.from("credit_transactions").insert({ user_id: currentUser.id, amount: -listing.credit_price, type: "session_spend", reference_id: session.id, description: `Booked session: ${listing.title}` }),
      supabase.from("notifications").insert({ user_id: listing.teacher_id, type: "session", title: "New session request!", body: `${currentUser.full_name} wants to book "${listing.title}"`, link: "/sessions" }),
    ]);
    setCurrentUser(p => p ? { ...p, credits: p.credits - listing.credit_price } : p);
    setBooking(false); setBookingStep("success");
  };

  const isOwnListing = currentUser?.id === listing?.teacher_id;
  const canAfford    = currentUser ? currentUser.credits >= (listing?.credit_price || 0) : false;
  const fmt          = FORMAT_INFO[listing?.format || "mixed"] || FORMAT_INFO.mixed;
  const cat          = CATEGORY_CONFIG[listing?.skills?.category || ""] || CATEGORY_CONFIG.Other;
  const diff         = listing?.difficulty ? DIFFICULTY_CONFIG[listing.difficulty] : null;
  const teacherRank  = getRank(listing?.profiles?.xp_multiplier);
  const tomorrow     = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate      = tomorrow.toISOString().split("T")[0];

  // Parse outcomes into bullets
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
        @keyframes goldPulse  {0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 14px rgba(232,168,0,.7)}50%{box-shadow:0 0 0 3px #ffd700,0 0 24px rgba(255,215,0,1)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 3px #aaa,0 0 10px rgba(180,180,180,.6)}50%{box-shadow:0 0 0 3px #ddd,0 0 18px rgba(220,220,220,.9)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 3px #a0522d,0 0 10px rgba(160,82,45,.6)}50%{box-shadow:0 0 0 3px #cd7f32,0 0 18px rgba(205,127,50,.8)}}
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
                  {[{label:"Session",value:listing.title},{label:"Teacher",value:listing.profiles?.full_name},{label:"Format",value:`${fmt.icon} ${fmt.label}`},{label:"Duration",value:`${listing.duration} minutes`},{label:"Time",value:proposedDate&&proposedTime?new Date(`${proposedDate}T${proposedTime}`).toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):""},{label:"Credits",value:`${listing.credit_price} cr (₱${listing.credit_price*10})`}].map(item=>(
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
      <nav style={{ background:"rgba(255,255,255,.96)", backdropFilter:"blur(12px)", borderBottom:"1px solid #e8e2d9", padding:"0 28px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        <a href="/dashboard" style={{ fontFamily:"'Fraunces',serif" }}>
          <span style={{ fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <a href="/listings" style={{ padding:"7px 14px", borderRadius:9, color:"#555", fontSize:13, fontWeight:600, transition:"background .12s" }}
            onMouseOver={e => (e.currentTarget.style.background="#f0ece4")}
            onMouseOut={e  => (e.currentTarget.style.background="transparent")}>
            ← All Listings
          </a>
          {currentUser && <span style={{ background:"#f0fdf4", color:"#15803d", fontSize:13, fontWeight:800, padding:"6px 14px", borderRadius:999, border:"1px solid #86efac" }}>💰 {currentUser.credits} cr</span>}
        </div>
      </nav>

      <div style={{ maxWidth:1020, margin:"0 auto", padding: isMobile ? "0 0 20px" : "28px 24px" }}>
        <div className="detail-grid" style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:24, alignItems:"start" }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

            {/* HERO IMAGE — full width on mobile, fix mobile #1 */}
            <div className="hero-section" style={{ borderRadius: isMobile ? 0 : 20, overflow:"hidden", border: isMobile ? "none" : "1.5px solid #e8e2d9", height: isMobile ? 240 : 300, position:"relative", boxShadow: isMobile ? "none" : "0 4px 20px rgba(0,0,0,.06)" }}>
              {listing.thumbnail_url
                ? <img src={listing.thumbnail_url} alt={listing.title} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : <div style={{ width:"100%", height:"100%", background:cat.gradient, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:80, filter:"drop-shadow(0 4px 20px rgba(0,0,0,.3))", lineHeight:1 }}>{cat.icon}</span>
                  </div>
              }
              {/* Overlay: rating + duration */}
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
              {listing.is_featured && <div style={{ position:"absolute", top:14, right:14, background:"rgba(255,215,0,.9)", borderRadius:20, padding:"4px 12px", fontSize:11, fontWeight:800, color:"#78350f" }}>⭐ Featured</div>}
            </div>

            {/* TITLE + TAGS card */}
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding: isMobile ? "20px 18px" : 26 }}>
              {/* Tags — MAX 3, fix #3 */}
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

              {/* Social proof row */}
              {(teacherAvgRating > 0 || teacherSessions > 0) && (
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14, flexWrap:"wrap" }}>
                  {teacherAvgRating > 0 && <Stars rating={teacherAvgRating} count={teacherTotalRatings} size={13} />}
                  {teacherSessions > 0 && <span style={{ fontSize:12, color:"#888", fontWeight:600 }}>🎓 {teacherSessions} sessions taught</span>}
                  {listing.is_hot_teacher && <span style={{ fontSize:11, fontWeight:800, background:"#fff7ed", color:"#c2410c", padding:"2px 9px", borderRadius:99, border:"1px solid #fed7aa" }}>🔥 Hot Teacher</span>}
                </div>
              )}

              {/* Description — collapsible on mobile, fix mobile #5 */}
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

            {/* WHAT YOU'LL WALK AWAY WITH — bullet list, fix #5 */}
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

            {/* SESSION INCLUDES — fix #8 */}
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

            {/* TEACHER CARD — fix #2 */}
            <div style={{ background:"#fff", borderRadius:20, border:`1.5px solid ${teacherRank===1?"rgba(255,215,0,.4)":teacherRank===2?"rgba(170,170,170,.5)":teacherRank===3?"rgba(160,82,45,.4)":"#e8e2d9"}`, padding:22 }}>
              {teacherRank === 1 && <div style={{ height:2, background:"linear-gradient(90deg,transparent,#ffd700,#e8a800,#ffd700,transparent)", borderRadius:"2px 2px 0 0", margin:"-22px -22px 20px" }} />}
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:16 }}>👤 About the Teacher</h3>
              <div style={{ display:"flex", gap:14, marginBottom:16 }}>
                <TeacherAvatar name={listing.profiles?.full_name||"?"} xp={listing.profiles?.xp||0} xp_multiplier={listing.profiles?.xp_multiplier} avatar_url={listing.profiles?.avatar_url} size={56} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                    <h4 style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>{listing.profiles?.full_name}</h4>
                    {listing.profiles?.champion_title && teacherRank > 0 && (
                      <span style={{ fontSize:10, fontWeight:800, background:"rgba(255,215,0,.15)", color:"#b8860b", padding:"2px 9px", borderRadius:999, border:"1px solid rgba(255,215,0,.3)" }}>
                        {teacherRank===1?"👑":teacherRank===2?"🥈":"🥉"} {listing.profiles.champion_title}{(listing.profiles.champion_streak||0)>1?` ×${listing.profiles.champion_streak} 🔥`:""}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize:12, color:"#aaa", marginBottom:6 }}>@{listing.profiles?.username} · {getLevelFromXP(listing.profiles?.xp||0)}</p>
                  {/* Credibility stats — fix #7 context */}
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {teacherAvgRating > 0 && <span style={{ fontSize:12, fontWeight:700, color:"#b45309" }}>⭐ {teacherAvgRating.toFixed(1)} rating</span>}
                    {teacherSessions > 0 && <span style={{ fontSize:12, color:"#888" }}>🎓 {teacherSessions} sessions</span>}
                    {teacherTotalRatings > 0 && <span style={{ fontSize:12, color:"#888" }}>💬 {teacherTotalRatings} reviews</span>}
                  </div>
                  {listing.profiles?.bio && <p style={{ fontSize:13, color:"#555", lineHeight:1.65, marginTop:8 }}>{listing.profiles.bio}</p>}
                </div>
              </div>
              {/* Stat grid */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, paddingTop:14, borderTop:"1px solid #f0ece4" }}>
                {[
                  { icon:"📚", label:"Sessions", value:teacherSessions },
                  { icon:"⭐", label:"Avg Rating", value:teacherAvgRating > 0 ? teacherAvgRating.toFixed(1) : "—" },
                  { icon:"⚡", label:"XP",         value:(listing.profiles?.xp||0).toLocaleString() },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:"center", background:"#fafaf8", borderRadius:12, padding:12 }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                    <p style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#1a1a1a" }}>{s.value}</p>
                    <p style={{ fontSize:10, color:"#aaa", fontWeight:600 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* REVIEWS — fix #7 */}
            <ReviewsSection teacherId={listing.teacher_id} avgRating={teacherAvgRating} totalRatings={teacherTotalRatings} />
          </div>

          {/* ── RIGHT: STICKY BOOKING CARD — fix #10 — desktop only ── */}
          <div className="detail-sidebar" style={{ position:"sticky", top:76 }}>
            <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:24, boxShadow:"0 4px 24px rgba(0,0,0,.07)" }}>
              {/* Price */}
              <div style={{ textAlign:"center", marginBottom:18, paddingBottom:18, borderBottom:"1px solid #f0ece4" }}>
                <p style={{ fontSize:11, color:"#aaa", fontWeight:600, marginBottom:4 }}>Session price</p>
                <p style={{ fontFamily:"'Fraunces',serif", fontSize:44, fontWeight:900, color:"#2d6a4f", lineHeight:1, marginBottom:3 }}>{listing.credit_price}</p>
                <p style={{ fontSize:13, color:"#aaa" }}>credits · ₱{listing.credit_price * 10}</p>
                {teacherAvgRating > 0 && (
                  <div style={{ marginTop:10, display:"flex", justifyContent:"center" }}>
                    <Stars rating={teacherAvgRating} count={teacherTotalRatings} size={13} />
                  </div>
                )}
              </div>
              {/* Session facts */}
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
              {/* Primary CTA — fix #1 */}
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
                      <a href="/wallet" style={{ fontWeight:700, color:"#dc2626" }}>Top up →</a>
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

      {/* MOBILE STICKY BOTTOM BAR — fix mobile CTA, fix #4 */}
      <div className="mobile-sticky-bar" style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", borderTop:"1.5px solid #e8e2d9", padding:"12px 20px", zIndex:50, alignItems:"center", gap:14, boxShadow:"0 -4px 20px rgba(0,0,0,.08)" }}>
        <div>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f", lineHeight:1 }}>{listing.credit_price} cr</div>
          <div style={{ fontSize:11, color:"#aaa" }}>≈ ₱{listing.credit_price * 10}</div>
        </div>
        <div style={{ flex:1 }}>
          {isOwnListing ? (
            <div style={{ fontSize:12, color:"#aaa", textAlign:"center" }}>Your listing</div>
          ) : currentUser ? (
            <>
              <button onClick={openBookModal}
                style={{ width:"100%", padding:"13px", background:canAfford?"#2d6a4f":"#e8e2d9", color:canAfford?"#fff":"#aaa", borderRadius:14, fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, border:"none", cursor:canAfford?"pointer":"not-allowed", minHeight:48 }}>
                {canAfford ? "Book Session →" : "Insufficient credits"}
              </button>
            </>
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