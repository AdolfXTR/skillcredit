"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Listing = {
  id: string; title: string; description: string;
  credit_price: number; format: string; duration: number;
  prerequisites: string; outcomes: string;
  is_active: boolean; created_at: string; teacher_id: string;
  thumbnail_url?: string; avg_rating?: number; total_ratings?: number; total_students?: number;
  is_featured?: boolean; is_hot_teacher?: boolean; difficulty?: string;
  skills: { name: string; category: string };
  profiles: { full_name: string; username: string; level: string; xp: number; xp_multiplier?: number; champion_title?: string | null; avatar_url?: string | null };
};
type Profile = {
  id: string; full_name: string; username: string; credits: number; level: string; xp: number;
  xp_multiplier?: number; champion_title?: string | null; avatar_url?: string | null;
};

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FORMAT_CONFIG: Record<string, { bg: string; accent: string; icon: string; label: string }> = {
  video: { bg: "#e8f4e8", accent: "#2d6a4f", icon: "📹", label: "Video" },
  chat:  { bg: "#f0f4ff", accent: "#3730a3", icon: "💬", label: "Chat"  },
  docs:  { bg: "#fff8e7", accent: "#b45309", icon: "📄", label: "Docs"  },
  mixed: { bg: "#fdf0f8", accent: "#9d174d", icon: "🎨", label: "Mixed" },
};
const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: string; thumb: string }> = {
  Programming: { color:"#1d4ed8", bg:"#dbeafe", icon:"💻", thumb:"linear-gradient(135deg,#1e3a8a,#1d4ed8 50%,#3b82f6)" },
  Design:      { color:"#be185d", bg:"#fce7f3", icon:"🎨", thumb:"linear-gradient(135deg,#831843,#be185d 50%,#ec4899)" },
  Language:    { color:"#166534", bg:"#dcfce7", icon:"🌍", thumb:"linear-gradient(135deg,#14532d,#16a34a 50%,#4ade80)" },
  Academic:    { color:"#7c3aed", bg:"#ede9fe", icon:"📚", thumb:"linear-gradient(135deg,#4c1d95,#7c3aed 50%,#a78bfa)" },
  Music:       { color:"#b45309", bg:"#fef3c7", icon:"🎵", thumb:"linear-gradient(135deg,#78350f,#d97706 50%,#fcd34d)" },
  Arts:        { color:"#991b1b", bg:"#fee2e2", icon:"🎭", thumb:"linear-gradient(135deg,#7f1d1d,#dc2626 50%,#f87171)" },
  Media:       { color:"#0369a1", bg:"#e0f2fe", icon:"🎬", thumb:"linear-gradient(135deg,#0c4a6e,#0284c7 50%,#38bdf8)" },
  Science:     { color:"#0f766e", bg:"#ccfbf1", icon:"🔬", thumb:"linear-gradient(135deg,#134e4a,#0f766e 50%,#2dd4bf)" },
  Sports:      { color:"#15803d", bg:"#dcfce7", icon:"⚽", thumb:"linear-gradient(135deg,#14532d,#15803d 50%,#4ade80)" },
  Lifestyle:   { color:"#c2410c", bg:"#ffedd5", icon:"✨", thumb:"linear-gradient(135deg,#7c2d12,#c2410c 50%,#fb923c)" },
  Other:       { color:"#57534e", bg:"#f5f5f4", icon:"💡", thumb:"linear-gradient(135deg,#292524,#57534e 50%,#a8a29e)" },
};
const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  beginner:     { label: "Beginner Friendly", color: "#15803d", bg: "#dcfce7", border: "#86efac" },
  intermediate: { label: "Intermediate",      color: "#b45309", bg: "#fef3c7", border: "#fcd34d" },
  advanced:     { label: "Advanced",          color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
};
const LEVEL_COLORS: Record<string, string> = {
  Seedling:"#2d6a4f", Learner:"#1d4ed8", Contributor:"#7c3aed",
  Skilled:"#b45309", Expert:"#dc2626", Master:"#0891b2", Legend:"#d97706",
};

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function getInitials(name: string) { return (name||"??").split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2); }
function getLevelFromXP(xp: number): string {
  if (xp>=4000) return "Legend"; if (xp>=2000) return "Master"; if (xp>=1000) return "Expert";
  if (xp>=600)  return "Skilled"; if (xp>=300) return "Contributor"; if (xp>=100) return "Learner";
  return "Seedling";
}
function getRank(xp_multiplier?: number): 0|1|2|3 {
  if (!xp_multiplier||xp_multiplier<1.1) return 0;
  if (xp_multiplier>=1.25) return 1; if (xp_multiplier>=1.15) return 2; return 3;
}
function renderStars(rating: number, max = 5) {
  return Array.from({ length: max }, (_, i) => (
    <span key={i} style={{ fontSize: 11, color: i < Math.round(rating) ? "#f59e0b" : "#e2d9cc" }}>★</span>
  ));
}

// ─────────────────────────────────────────────────────────────
// PREMIUM AVATAR
// ─────────────────────────────────────────────────────────────
function PremiumAvatar({ name, xp, xp_multiplier, avatar_url, size = 32 }:
  { name: string; xp: number; xp_multiplier?: number; avatar_url?: string | null; size?: number }) {
  const level = getLevelFromXP(xp);
  const bg    = LEVEL_COLORS[level] || "#2d6a4f";
  const rank  = getRank(xp_multiplier);
  const ringStyle: React.CSSProperties = rank===1
    ? { outline:"2.5px solid #ffd700", boxShadow:"0 0 0 1px #ffd700,0 0 10px 2px rgba(255,215,0,.6)", animation:"goldPulse 2s ease infinite" }
    : rank===2 ? { outline:"2.5px solid #c0c0c0", boxShadow:"0 0 0 1px #c0c0c0,0 0 8px 2px rgba(192,192,192,.5)", animation:"silverPulse 2s ease infinite" }
    : rank===3 ? { outline:"2.5px solid #cd7f32", boxShadow:"0 0 0 1px #cd7f32,0 0 8px 2px rgba(205,127,50,.5)", animation:"bronzePulse 2s ease infinite" } : {};
  const badge = rank===1?"👑":rank===2?"🥈":rank===3?"🥉":null;
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size, borderRadius:"50%", ...ringStyle }}>
      <div style={{ width:size, height:size, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:size*.34, fontWeight:800, overflow:"hidden" }}>
        {avatar_url ? <img src={avatar_url} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : getInitials(name)}
      </div>
      {badge && <span style={{ position:"absolute", bottom:-3, right:-5, fontSize:size*.36, lineHeight:1, filter:"drop-shadow(0 1px 3px rgba(0,0,0,.5))", zIndex:2 }}>{badge}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LISTING CARD — improved
// ─────────────────────────────────────────────────────────────
function ListingCard({ listing, loggedIn, idx }: { listing: Listing; loggedIn: boolean; idx: number }) {
  const fmt        = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
  const cat        = CATEGORY_CONFIG[listing.skills?.category] || CATEGORY_CONFIG.Other;
  const rating     = listing.avg_rating || 0;
  const ratingCount = listing.total_ratings || 0;
  const students   = listing.total_students || 0;
  const isFeatured = !!listing.is_featured;
  const isHot      = !!listing.is_hot_teacher;
  const diff       = listing.difficulty ? DIFFICULTY_CONFIG[listing.difficulty] : null;
  const rank       = getRank(listing.profiles?.xp_multiplier);
  const hasThumbnail = !!listing.thumbnail_url;

  const href = loggedIn ? `/listings/${listing.id}` : "/login";

  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      border: `1.5px solid ${isFeatured ? "rgba(255,215,0,.5)" : "#e8e2d9"}`,
      overflow: "hidden",
      boxShadow: isFeatured ? "0 4px 24px rgba(255,215,0,.15)" : "0 2px 12px rgba(0,0,0,.04)",
      animationDelay: `${idx * .04}s`,
      position: "relative",
      transition: "transform .2s ease, box-shadow .2s ease",
      animation: "fadeUp .35s ease both",
    }}
    className="listing-card">

      {/* Featured gold stripe */}
      {isFeatured && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,#e8a800,#ffd700,#e8a800)", zIndex:2 }} />}

      {/* HERO IMAGE / THUMB */}
      <div style={{ position:"relative", height:150, overflow:"hidden", cursor:"pointer" }} onClick={() => window.location.href = href}>
        {hasThumbnail
          ? <img src={listing.thumbnail_url!} alt={listing.title} style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform .3s" }} className="card-img" />
          : <div style={{ width:"100%", height:"100%", background:cat.thumb, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:50, filter:"drop-shadow(0 4px 16px rgba(0,0,0,.3))", lineHeight:1 }}>{cat.icon}</span>
            </div>
        }
        {/* Format badge — top left */}
        <div style={{ position:"absolute", top:10, left:10, background:"rgba(255,255,255,.92)", backdropFilter:"blur(8px)", borderRadius:20, padding:"3px 9px", fontSize:10, fontWeight:700, color:fmt.accent, display:"flex", alignItems:"center", gap:3 }}>
          {fmt.icon} {fmt.label}
        </div>
        {/* Rating — top right */}
        {rating > 0 && (
          <div style={{ position:"absolute", top:10, right:10, background:"rgba(255,255,255,.92)", backdropFilter:"blur(8px)", borderRadius:20, padding:"3px 9px", fontSize:10, fontWeight:700, color:"#b45309", display:"flex", alignItems:"center", gap:3 }}>
            ★ {rating.toFixed(1)}{ratingCount > 0 && <span style={{ opacity:.65 }}>({ratingCount})</span>}
          </div>
        )}
        {/* Featured badge */}
        {isFeatured && (
          <div style={{ position:"absolute", bottom:10, left:10, background:"rgba(255,215,0,.92)", borderRadius:20, padding:"3px 9px", fontSize:9, fontWeight:800, color:"#78350f" }}>
            ⭐ Featured
          </div>
        )}
      </div>

      <div style={{ padding:"16px 18px 18px" }}>
        {/* Tags — max 2, clean — fix #2 */}
        <div style={{ display:"flex", gap:5, marginBottom:9, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ background:cat.bg, color:cat.color, fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20 }}>
            {cat.icon} {listing.skills?.name}
          </span>
          {diff && (
            <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20, background:diff.bg, color:diff.color, border:`1px solid ${diff.border}` }}>
              {diff.label}
            </span>
          )}
          {!diff && isHot && (
            <span style={{ background:"#fff7ed", color:"#c2410c", fontSize:10, fontWeight:800, padding:"2px 9px", borderRadius:20, border:"1px solid #fed7aa" }}>🔥 Hot</span>
          )}
        </div>

        {/* Title */}
        <h3 onClick={() => window.location.href = href} style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a", marginBottom:5, lineHeight:1.3, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", cursor:"pointer" }}>
          {listing.title}
        </h3>

        {/* Price + duration BELOW title — fix #3 */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#2d6a4f" }}>{listing.credit_price} cr</span>
          <span style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>≈ ₱{listing.credit_price * 10}</span>
          <span style={{ width:1, height:12, background:"#e8e2d9" }} />
          <span style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>⏱ {listing.duration}m</span>
        </div>

        {/* Social proof — fix #7 */}
        {(rating > 0 || students > 0) && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            {rating > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                {renderStars(rating)}
                <span style={{ fontSize:11, fontWeight:700, color:"#b45309", marginLeft:2 }}>{rating.toFixed(1)}</span>
                {ratingCount > 0 && <span style={{ fontSize:10, color:"#bbb" }}>({ratingCount})</span>}
              </div>
            )}
            {students > 0 && (
              <span style={{ fontSize:10, color:"#888", fontWeight:600 }}>🎓 {students} students</span>
            )}
          </div>
        )}

        {/* Teacher row — fix #5 */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 11px", background:"#fafaf8", borderRadius:11, marginBottom:13 }}>
          <PremiumAvatar name={listing.profiles?.full_name||"?"} xp={listing.profiles?.xp||0} xp_multiplier={listing.profiles?.xp_multiplier} avatar_url={listing.profiles?.avatar_url} size={30} />
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:12, fontWeight:700, color:"#222", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{listing.profiles?.full_name}</p>
            <p style={{ fontSize:10, color:"#aaa" }}>{getLevelFromXP(listing.profiles?.xp||0)} · @{listing.profiles?.username}</p>
          </div>
          {/* Champion inline */}
          {rank === 1 && listing.profiles?.champion_title && (
            <span style={{ fontSize:9, fontWeight:800, background:"#fef3c7", color:"#92400e", padding:"2px 7px", borderRadius:20, border:"1px solid #fbbf24", flexShrink:0 }}>👑</span>
          )}
        </div>

        {/* Dual CTA — fix #1 */}
        <div style={{ display:"flex", gap:7 }}>
          <a href={href}
            style={{ flex:1, padding:"9px 0", borderRadius:10, background:"#f5f0e8", color:"#2d6a4f", border:"1.5px solid #e8e2d9", fontSize:12, fontWeight:800, textAlign:"center", textDecoration:"none", display:"block", transition:"all .15s" }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "#e8e2d9"; }}
            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = "#f5f0e8"; }}>
            View Details
          </a>
          <a href={loggedIn ? `/listings/${listing.id}?book=1` : "/login"}
            style={{ flex:1.4, padding:"9px 0", borderRadius:10, background: isFeatured ? "#1a4a36" : "#2d6a4f", color:"#fff", border:"none", fontSize:12, fontWeight:800, textAlign:"center", textDecoration:"none", display:"block", transition:"background .15s", cursor:"pointer" }}
            className="book-btn"
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "#1a4a36"; }}
            onMouseOut={e  => { (e.currentTarget as HTMLElement).style.background = isFeatured ? "#1a4a36" : "#2d6a4f"; }}>
            Book Now →
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const [listings, setListings]       = useState<Listing[]>([]);
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState("All");
  const [format, setFormat]           = useState("All");
  const [sortBy, setSortBy]           = useState("newest");
  const [maxPrice, setMaxPrice]       = useState(100);
  const [maxDuration, setMaxDuration] = useState("all");
  const [difficulty, setDifficulty]   = useState("all");
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile]       = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const categories = ["All","Programming","Design","Language","Academic","Music","Arts","Media","Science","Sports","Lifestyle","Other"];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("*,xp_multiplier,champion_title,avatar_url").eq("id", user.id).single();
      if (prof) setProfile(prof);
    }
    const { data, error } = await supabase.from("listings")
      .select(`*, skills(name,category), profiles(full_name,username,level,xp,xp_multiplier,champion_title,avatar_url)`)
      .eq("is_active", true).order("created_at", { ascending: false });
    if (error) { setLoading(false); return; }
    const rows = (data || []) as Listing[];
    const teacherIds = [...new Set(rows.map(l => l.teacher_id))];
    let avgMap: Record<string, { avg: number; count: number }> = {};
    let studentMap: Record<string, number> = {};
    if (teacherIds.length > 0) {
      const [{ data: ratingsData }, { data: sessionsData }] = await Promise.all([
        supabase.from("ratings").select("rated_id,overall").in("rated_id", teacherIds),
        supabase.from("sessions").select("teacher_id").in("teacher_id", teacherIds).eq("status", "completed"),
      ]);
      if (ratingsData?.length) {
        const grouped: Record<string, number[]> = {};
        ratingsData.forEach((r: any) => { if (!grouped[r.rated_id]) grouped[r.rated_id]=[]; grouped[r.rated_id].push(r.overall); });
        Object.entries(grouped).forEach(([id, vals]) => { avgMap[id] = { avg: parseFloat(bayesianAvg(vals).toFixed(1)), count: vals.length }; });
      }
      if (sessionsData?.length) {
        sessionsData.forEach((s: any) => { studentMap[s.teacher_id] = (studentMap[s.teacher_id] || 0) + 1; });
      }
    }
    const hotIds = new Set(rows.filter(l => l.is_hot_teacher).map(l => l.teacher_id));
    const enriched = rows.map(l => ({
      ...l,
      avg_rating: avgMap[l.teacher_id]?.avg || 0,
      total_ratings: avgMap[l.teacher_id]?.count || 0,
      total_students: studentMap[l.teacher_id] || 0,
      is_hot_teacher: hotIds.has(l.teacher_id),
    }));
    enriched.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    setListings(enriched);
    setLoading(false);
  }

  // Active filters for pills
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (category !== "All")    activeFilters.push({ label:`📂 ${category}`, clear: () => setCategory("All") });
  if (format !== "All")      activeFilters.push({ label:`${FORMAT_CONFIG[format]?.icon} ${format}`, clear: () => setFormat("All") });
  if (maxPrice < 100)        activeFilters.push({ label:`💰 ≤${maxPrice} cr`, clear: () => setMaxPrice(100) });
  if (maxDuration !== "all") activeFilters.push({ label:`⏱ ${maxDuration}`, clear: () => setMaxDuration("all") });
  if (difficulty !== "all")  activeFilters.push({ label:`📊 ${difficulty}`, clear: () => setDifficulty("all") });
  if (search)                activeFilters.push({ label:`🔍 "${search}"`, clear: () => setSearch("") });

  const clearAll = () => { setSearch(""); setCategory("All"); setFormat("All"); setMaxPrice(100); setMaxDuration("all"); setDifficulty("all"); setSortBy("newest"); };

  const filtered = listings.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !search || l.title?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q) || l.profiles?.full_name?.toLowerCase().includes(q) || l.skills?.name?.toLowerCase().includes(q);
    const matchCat   = category === "All" || l.skills?.category === category;
    const matchFmt   = format === "All" || l.format === format;
    const matchPrice = l.credit_price <= maxPrice;
    const matchDur   = maxDuration==="all"?true:maxDuration==="30min"?l.duration<=30:maxDuration==="1hr"?l.duration<=60:maxDuration==="2hr"?l.duration<=120:true;
    const matchDiff  = difficulty === "all" || l.difficulty === difficulty;
    return matchSearch && matchCat && matchFmt && matchPrice && matchDur && matchDiff;
  }).sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (sortBy === "price_low")    return a.credit_price - b.credit_price;
    if (sortBy === "price_high")   return b.credit_price - a.credit_price;
    if (sortBy === "top_rated")    return (b.avg_rating||0) - (a.avg_rating||0);
    if (sortBy === "most_popular") return (b.total_students||0) - (a.total_students||0);
    if (sortBy === "duration_low") return a.duration - b.duration;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Sidebar filter block component
  function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e8e2d9", padding:"16px 18px" }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#aaa", letterSpacing:".08em", textTransform:"uppercase" as const, marginBottom:10 }}>{title}</div>
        {children}
      </div>
    );
  }

  const sidebarContent = (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <FilterBlock title="Sort By">
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ width:"100%", padding:"9px 12px", borderRadius:10, border:"1.5px solid #e8e2d9", fontSize:13, fontFamily:"'DM Sans',sans-serif", background:"#fff", color:"#333", cursor:"pointer" }}>
          <option value="newest">⭐ Newest first</option>
          <option value="top_rated">★ Top rated</option>
          <option value="most_popular">🔥 Most popular</option>
          <option value="price_low">💰 Price: Low → High</option>
          <option value="price_high">💰 Price: High → Low</option>
          <option value="duration_low">⏱ Shortest first</option>
        </select>
      </FilterBlock>

      <FilterBlock title="Format">
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {["All","video","chat","docs","mixed"].map(f => {
            const cfg = FORMAT_CONFIG[f]; const active = format === f;
            return (
              <button key={f} onClick={() => setFormat(f)}
                style={{ padding:"8px 12px", borderRadius:10, border:`1.5px solid ${active?(cfg?.accent||"#2d6a4f"):"#e8e2d9"}`, background:active?(cfg?.bg||"#e8f4e8"):"#fafaf8", color:active?(cfg?.accent||"#2d6a4f"):"#555", fontSize:13, fontWeight:700, textAlign:"left" as const, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .12s" }}>
                {cfg ? `${cfg.icon} ${cfg.label}` : "✨ All Formats"}
              </button>
            );
          })}
        </div>
      </FilterBlock>

      <FilterBlock title="Difficulty">
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {[{ val:"all", label:"All Levels" }, { val:"beginner", label:"🟢 Beginner" }, { val:"intermediate", label:"🟡 Intermediate" }, { val:"advanced", label:"🔴 Advanced" }].map(d => {
            const active = difficulty === d.val;
            return (
              <button key={d.val} onClick={() => setDifficulty(d.val)}
                style={{ padding:"8px 12px", borderRadius:10, border:`1.5px solid ${active?"#2d6a4f":"#e8e2d9"}`, background:active?"#e8f4e8":"#fafaf8", color:active?"#2d6a4f":"#555", fontSize:13, fontWeight:700, textAlign:"left" as const, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                {d.label}
              </button>
            );
          })}
        </div>
      </FilterBlock>

      <FilterBlock title="Max Price">
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
          <span style={{ fontSize:12, color:"#888" }}>0 cr</span>
          <span style={{ fontSize:13, fontWeight:800, color:"#2d6a4f" }}>{maxPrice === 100 ? "Any" : `≤ ${maxPrice} cr`}</span>
        </div>
        <input type="range" min={5} max={100} step={5} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} style={{ width:"100%" }} />
        <div style={{ display:"flex", gap:4, marginTop:8 }}>
          {[10,25,50,100].map(p => (
            <button key={p} onClick={() => setMaxPrice(p)}
              style={{ flex:1, fontSize:11, padding:"4px 0", borderRadius:7, border:"1.5px solid #e8e2d9", background:maxPrice===p?"#2d6a4f":"#fff", color:maxPrice===p?"#fff":"#888", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              {p===100?"Any":`${p}cr`}
            </button>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Duration">
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {[{val:"all",label:"⏱ Any"},{val:"30min",label:"⚡ ≤ 30 min"},{val:"1hr",label:"🕐 ≤ 1 hour"},{val:"2hr",label:"🕑 ≤ 2 hours"}].map(o => (
            <button key={o.val} onClick={() => setMaxDuration(o.val)}
              style={{ padding:"8px 12px", borderRadius:10, border:`1.5px solid ${maxDuration===o.val?"#2d6a4f":"#e8e2d9"}`, background:maxDuration===o.val?"#e8f4e8":"#fafaf8", color:maxDuration===o.val?"#2d6a4f":"#555", fontSize:13, fontWeight:700, textAlign:"left" as const, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              {o.label}
            </button>
          ))}
        </div>
      </FilterBlock>

      {activeFilters.length > 0 && (
        <button onClick={clearAll}
          style={{ padding:11, borderRadius:12, background:"#fee2e2", color:"#991b1b", fontWeight:700, fontSize:13, width:"100%", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          🗑 Reset All Filters
        </button>
      )}
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f4", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;color:inherit}
        @keyframes goldPulse  {0%,100%{box-shadow:0 0 0 2.5px #e8a800,0 0 10px rgba(232,168,0,.7)}50%{box-shadow:0 0 0 2.5px #ffd700,0 0 18px rgba(255,215,0,1)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #aaa,0 0 8px rgba(180,180,180,.6)}50%{box-shadow:0 0 0 2.5px #ddd,0 0 14px rgba(220,220,220,.9)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #a0522d,0 0 8px rgba(160,82,45,.6)}50%{box-shadow:0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.8)}}
        @keyframes fadeUp     {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes spin       {to{transform:rotate(360deg)}}
        .listing-card{transition:transform .2s ease,box-shadow .2s ease;animation:fadeUp .35s ease both}
        .listing-card:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(0,0,0,.13)!important}
        .listing-card:hover .card-img{transform:scale(1.04)}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#555;transition:all .12s;text-decoration:none}
        .nav-a:hover{background:#f0ede8;color:#1a1a1a}
        .nav-a.active{background:#e8f4e8;color:#2d6a4f}
        input[type=range]{accent-color:#2d6a4f}
        input:focus,select:focus{outline:none;border-color:#2d6a4f!important;box-shadow:0 0 0 3px rgba(45,106,79,.1)}
        /* Mobile modal overlay */
        .mobile-filter-overlay{display:none}
        @media(max-width:900px){
          .desktop-sidebar{display:none!important}
          .mobile-filter-overlay.open{display:flex}
          .listings-main-grid{grid-template-columns:1fr!important}
          .cat-scroll{overflow-x:auto;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;padding-bottom:4px}
          .cat-scroll::-webkit-scrollbar{display:none}
          .listings-grid{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(max-width:580px){
          .listings-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Mobile filter modal — fix #8 */}
      <div className={`mobile-filter-overlay${showMobileFilters ? " open" : ""}`} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:200, alignItems:"flex-end" }}>
        <div style={{ background:"#faf8f4", borderRadius:"20px 20px 0 0", padding:"24px 20px", maxHeight:"90vh", overflowY:"auto", width:"100%" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900 }}>Filters {activeFilters.length > 0 && <span style={{ fontSize:13, background:"#2d6a4f", color:"#fff", padding:"2px 8px", borderRadius:99, marginLeft:6 }}>{activeFilters.length}</span>}</div>
            <button onClick={() => setShowMobileFilters(false)} style={{ width:32, height:32, borderRadius:"50%", background:"#f5f0e8", border:"none", fontSize:14, cursor:"pointer" }}>✕</button>
          </div>
          {sidebarContent}
          <button onClick={() => setShowMobileFilters(false)} style={{ width:"100%", marginTop:16, padding:13, borderRadius:14, background:"#2d6a4f", color:"#fff", fontSize:14, fontWeight:800, border:"none", cursor:"pointer" }}>
            Show {filtered.length} results
          </button>
        </div>
      </div>

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)", backdropFilter:"blur(16px)", borderBottom:"1.5px solid #e8e2d9", padding:"0 32px", height:58, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:2, alignItems:"center" }}>
          <a href="/dashboard" className="nav-a">🏠</a>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"]].map(([l,h])=>(
            <a key={l} href={h} className={`nav-a${h==="/listings"?" active":""}`}>{l}</a>
          ))}
        </div>
        {profile ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <a href="/listings/create" style={{ padding:"8px 16px", borderRadius:10, background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>+ Create</a>
            <a href="/profile" style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px 5px 6px", borderRadius:10, background:"#f5f0e8" }}>
              <PremiumAvatar name={profile.full_name} xp={profile.xp||0} xp_multiplier={profile.xp_multiplier} avatar_url={profile.avatar_url} size={28} />
              <span style={{ fontSize:13, fontWeight:600, color:"#333" }}>@{profile.username}</span>
              <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f", background:"#e8f4e8", padding:"2px 9px", borderRadius:20 }}>{profile.credits} cr</span>
            </a>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <a href="/login" style={{ padding:"7px 14px", borderRadius:8, color:"#555", fontSize:13, fontWeight:600 }}>Log in</a>
            <a href="/signup" style={{ padding:"8px 18px", borderRadius:10, background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700 }}>Sign up free</a>
          </div>
        )}
      </nav>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 24px" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:20 }}>
          <div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:28, fontWeight:900, color:"#1a1a1a", marginBottom:3 }}>Browse Skills</h1>
            <p style={{ fontSize:13, color:"#888" }}>Find the perfect teacher · {listings.length} listings available</p>
          </div>
          {/* Desktop: show/hide filter button; Mobile: filter button */}
          {isMobile ? (
            <button onClick={() => setShowMobileFilters(true)}
              style={{ padding:"9px 18px", borderRadius:10, background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              🔎 Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </button>
          ) : (
            <button onClick={() => setShowSidebar(s => !s)}
              style={{ padding:"9px 18px", borderRadius:10, background:showSidebar?"#2d6a4f":"#f5f0e8", color:showSidebar?"#fff":"#555", fontSize:13, fontWeight:700, border:"none", cursor:"pointer" }}>
              {showSidebar ? "Hide Filters" : `Show Filters${activeFilters.length ? ` (${activeFilters.length})` : ""}`}
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position:"relative", marginBottom:16 }}>
          <span style={{ position:"absolute", left:15, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>🔍</span>
          <input type="text" placeholder="Search skills, teachers, topics…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:"100%", padding:"12px 16px 12px 44px", borderRadius:14, border:"1.5px solid #e8e2d9", fontSize:14, background:"#fff", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 2px 8px rgba(0,0,0,.04)" }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"#e8e2d9", border:"none", borderRadius:"50%", width:22, height:22, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>}
        </div>

        {/* Category pills — horizontally scrollable on mobile */}
        <div className="cat-scroll" style={{ display:"flex", gap:7, marginBottom:18, flexWrap:"wrap" }}>
          {categories.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = category === cat;
            return (
              <button key={cat} onClick={() => setCategory(cat)}
                style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${active?(cfg?.color||"#2d6a4f"):"#e8e2d9"}`, background:active?(cfg?.bg||"#e8f4e8"):"#fff", color:active?(cfg?.color||"#2d6a4f"):"#666", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:4, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .12s", whiteSpace:"nowrap" }}>
                {cfg?.icon && <span>{cfg.icon}</span>}{cat}
              </button>
            );
          })}
        </div>

        {/* Active filter chips — fix #4 */}
        {activeFilters.length > 0 && (
          <div style={{ display:"flex", gap:7, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#aaa", fontWeight:700 }}>Active:</span>
            {activeFilters.map((f, i) => (
              <button key={i} onClick={f.clear}
                style={{ padding:"3px 11px", borderRadius:20, background:"#1a1a1a", color:"#fff", fontSize:11, fontWeight:700, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontFamily:"'DM Sans',sans-serif" }}>
                {f.label} <span style={{ opacity:.5 }}>✕</span>
              </button>
            ))}
            <button onClick={clearAll}
              style={{ padding:"3px 11px", borderRadius:20, background:"#fee2e2", color:"#991b1b", fontSize:11, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              Clear all
            </button>
          </div>
        )}

        <div className="listings-main-grid" style={{ display:"grid", gridTemplateColumns:showSidebar&&!isMobile?"240px 1fr":"1fr", gap:20, alignItems:"start" }}>
          {/* SIDEBAR — desktop only */}
          {showSidebar && !isMobile && (
            <div className="desktop-sidebar" style={{ position:"sticky", top:74 }}>
              {sidebarContent}
            </div>
          )}

          {/* GRID */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontSize:13, color:"#888", fontWeight:600 }}>
                Showing <strong style={{ color:"#1a1a1a" }}>{filtered.length}</strong> of <strong style={{ color:"#1a1a1a" }}>{listings.length}</strong> listings
                {search && <span> for "<strong>{search}</strong>"</span>}
              </span>
              {(!showSidebar || isMobile) && (
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ padding:"7px 11px", borderRadius:10, border:"1.5px solid #e8e2d9", fontSize:12, fontFamily:"'DM Sans',sans-serif", background:"#fff", cursor:"pointer" }}>
                  <option value="newest">Newest</option>
                  <option value="top_rated">★ Top rated</option>
                  <option value="most_popular">🔥 Most popular</option>
                  <option value="price_low">Price: Low → High</option>
                  <option value="price_high">Price: High → Low</option>
                </select>
              )}
            </div>

            {loading && (
              <div style={{ textAlign:"center", padding:"80px 0" }}>
                <div style={{ width:32, height:32, border:"3px solid #2d6a4f", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto 14px" }} />
                <p style={{ color:"#888", fontSize:13 }}>Loading listings…</p>
              </div>
            )}

            {!loading && listings.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 20px", background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9" }}>
                <div style={{ fontSize:48, marginBottom:14 }}>📋</div>
                <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800, color:"#1a1a1a", marginBottom:8 }}>No listings yet</h3>
                <p style={{ color:"#888", fontSize:14, marginBottom:20 }}>Be the first to share your skill!</p>
                <a href="/listings/create" style={{ display:"inline-block", padding:"10px 24px", background:"#2d6a4f", color:"#fff", borderRadius:12, fontSize:13, fontWeight:700 }}>+ Create a Listing</a>
              </div>
            )}

            {/* EMPTY STATE — fix #10 */}
            {!loading && listings.length > 0 && filtered.length === 0 && (
              <div style={{ textAlign:"center", padding:"60px 20px", background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9" }}>
                <div style={{ fontSize:48, marginBottom:14 }}>😕</div>
                <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800, color:"#1a1a1a", marginBottom:6 }}>No skills found</h3>
                <p style={{ color:"#888", fontSize:14, marginBottom:20 }}>Try adjusting your filters or search terms</p>
                <button onClick={clearAll}
                  style={{ padding:"10px 24px", background:"#2d6a4f", color:"#fff", borderRadius:12, fontSize:13, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  Clear filters
                </button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="listings-grid" style={{ display:"grid", gridTemplateColumns:showSidebar&&!isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:16 }}>
                {filtered.map((listing, i) => (
                  <ListingCard key={listing.id} listing={listing} loggedIn={!!profile} idx={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}