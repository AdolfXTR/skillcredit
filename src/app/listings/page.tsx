"use client";
import { useEffect, useState } from "react";
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
  is_active: boolean;
  created_at: string;
  teacher_id: string;
  skills: { name: string; category: string };
  profiles: { full_name: string; username: string; level: string };
};

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
};

const FORMAT_CONFIG: Record<string, { bg: string; accent: string; icon: string; label: string }> = {
  video: { bg: "#e8f4e8", accent: "#2d6a4f", icon: "🎥", label: "Video" },
  chat:  { bg: "#f0f4ff", accent: "#3730a3", icon: "💬", label: "Chat" },
  docs:  { bg: "#fff8e7", accent: "#b45309", icon: "📄", label: "Docs" },
  mixed: { bg: "#fdf0f8", accent: "#9d174d", icon: "✨", label: "Mixed" },
};

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Programming: { color: "#1d4ed8", bg: "#dbeafe", icon: "💻" },
  Design:      { color: "#be185d", bg: "#fce7f3", icon: "🎨" },
  Language:    { color: "#166534", bg: "#dcfce7", icon: "🌍" },
  Academic:    { color: "#7c3aed", bg: "#ede9fe", icon: "📚" },
  Music:       { color: "#b45309", bg: "#fef3c7", icon: "🎵" },
  Arts:        { color: "#991b1b", bg: "#fee2e2", icon: "🎭" },
  Media:       { color: "#0369a1", bg: "#e0f2fe", icon: "🎬" },
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

const MOCK: Listing[] = [
  { id: "1", title: "Python for Absolute Beginners", description: "Learn Python from scratch — variables, loops, functions, and your first project.", credit_price: 15, format: "video", duration: 60, prerequisites: "None", outcomes: "Build a simple Python app", is_active: true, created_at: new Date().toISOString(), teacher_id: "1", skills: { name: "Python", category: "Programming" }, profiles: { full_name: "Maria Santos", username: "mariasantos", level: "Expert" } },
  { id: "2", title: "UI/UX Design with Figma", description: "Master Figma and learn how to design beautiful, user-friendly interfaces.", credit_price: 12, format: "mixed", duration: 90, prerequisites: "Basic computer skills", outcomes: "Design a full app UI in Figma", is_active: true, created_at: new Date().toISOString(), teacher_id: "2", skills: { name: "UI/UX Design", category: "Design" }, profiles: { full_name: "Reina Cruz", username: "reinacruz", level: "Master" } },
  { id: "3", title: "English Conversation Practice", description: "Improve your spoken English with a native-level speaker. Perfect for job interviews.", credit_price: 8, format: "video", duration: 30, prerequisites: "Basic English", outcomes: "Speak more confidently in English", is_active: true, created_at: new Date().toISOString(), teacher_id: "3", skills: { name: "English Writing", category: "Language" }, profiles: { full_name: "Lisa Mendoza", username: "lisamendoza", level: "Skilled" } },
  { id: "4", title: "JavaScript & React Fundamentals", description: "Go from zero to building real React apps. We'll cover JS basics and React hooks.", credit_price: 20, format: "chat", duration: 120, prerequisites: "Basic HTML/CSS", outcomes: "Build a React app from scratch", is_active: true, created_at: new Date().toISOString(), teacher_id: "4", skills: { name: "React", category: "Programming" }, profiles: { full_name: "Carlo Reyes", username: "carloreyes", level: "Legend" } },
  { id: "5", title: "Guitar for Beginners", description: "Learn your first chords and play your favorite songs within a week!", credit_price: 10, format: "video", duration: 45, prerequisites: "None — just bring a guitar!", outcomes: "Play 3 songs end to end", is_active: true, created_at: new Date().toISOString(), teacher_id: "5", skills: { name: "Guitar", category: "Music" }, profiles: { full_name: "Sam Ramos", username: "samramos", level: "Contributor" } },
  { id: "6", title: "Video Editing with CapCut", description: "Create stunning reels, vlogs, and YouTube videos using CapCut on mobile.", credit_price: 14, format: "docs", duration: 60, prerequisites: "A smartphone", outcomes: "Edit and publish your first viral reel", is_active: true, created_at: new Date().toISOString(), teacher_id: "6", skills: { name: "Video Editing", category: "Media" }, profiles: { full_name: "Kiko Dela Cruz", username: "kikodelacruz", level: "Skilled" } },
  { id: "7", title: "Math Tutoring — Algebra & Calculus", description: "Struggling with math? I'll break down complex concepts into simple steps.", credit_price: 18, format: "mixed", duration: 90, prerequisites: "High school level", outcomes: "Ace your next math exam", is_active: true, created_at: new Date().toISOString(), teacher_id: "7", skills: { name: "Math Tutoring", category: "Academic" }, profiles: { full_name: "Ana Villanueva", username: "anavillanueva", level: "Expert" } },
  { id: "8", title: "Graphic Design with Canva", description: "Create professional posters, social media content, and presentations using Canva.", credit_price: 9, format: "video", duration: 45, prerequisites: "None", outcomes: "Design 5 professional graphics", is_active: true, created_at: new Date().toISOString(), teacher_id: "8", skills: { name: "Graphic Design", category: "Design" }, profiles: { full_name: "Bea Aquino", username: "beaaquino", level: "Learner" } },
];

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [format, setFormat] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [maxPrice, setMaxPrice] = useState(50);
  const [maxDuration, setMaxDuration] = useState("all");
  const [showSidebar, setShowSidebar] = useState(true);

  const categories = ["All", "Programming", "Design", "Language", "Academic", "Music", "Arts", "Media"];

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(prof);
      }
      const { data, error } = await supabase
        .from("listings")
        .select(`*, skills(name, category), profiles(full_name, username, level)`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setListings((!error && data && data.length > 0) ? data as Listing[] : MOCK as Listing[]);
      setLoading(false);
    };
    init();
  }, []);

  // Active filters
  const activeFilters: { label: string; clear: () => void }[] = [];
  if (category !== "All") activeFilters.push({ label: `📂 ${category}`, clear: () => setCategory("All") });
  if (format !== "All") activeFilters.push({ label: `${FORMAT_CONFIG[format]?.icon} ${format}`, clear: () => setFormat("All") });
  if (maxPrice < 50) activeFilters.push({ label: `💰 ≤${maxPrice} cr`, clear: () => setMaxPrice(50) });
  if (maxDuration !== "all") activeFilters.push({ label: `⏱ ${maxDuration}`, clear: () => setMaxDuration("all") });
  if (search) activeFilters.push({ label: `🔍 "${search}"`, clear: () => setSearch("") });

  const clearAll = () => { setSearch(""); setCategory("All"); setFormat("All"); setMaxPrice(50); setMaxDuration("all"); setSortBy("newest"); };

  const filtered = listings.filter(l => {
    const matchSearch = !search ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.skills?.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || l.skills?.category === category;
    const matchFmt = format === "All" || l.format === format;
    const matchPrice = l.credit_price <= maxPrice;
    const matchDur =
      maxDuration === "all" ? true :
      maxDuration === "30min" ? l.duration <= 30 :
      maxDuration === "1hr" ? l.duration <= 60 :
      maxDuration === "2hr" ? l.duration <= 120 : true;
    return matchSearch && matchCat && matchFmt && matchPrice && matchDur;
  }).sort((a, b) => {
    if (sortBy === "price_low") return a.credit_price - b.credit_price;
    if (sortBy === "price_high") return b.credit_price - a.credit_price;
    if (sortBy === "duration_low") return a.duration - b.duration;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .listing-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
        .listing-card:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,0.11) !important; }
        .filter-pill { transition: all 0.15s; cursor: pointer; border: none; }
        .filter-pill:hover { opacity: 0.85; }
        input:focus, select:focus { outline: none; border-color: #2d6a4f !important; }
        .cat-btn { transition: all 0.15s; cursor: pointer; }
        .cat-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 1 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 13px", borderRadius: 8, color: href === "/listings" ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: href === "/listings" ? 700 : 600, textDecoration: "none", background: href === "/listings" ? "#e8f4e8" : "transparent" }}>{label}</a>
          ))}
        </div>
        {profile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href="/listings/create" style={{ padding: "8px 16px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>+ Create Listing</a>
            <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: LEVEL_COLORS[profile.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                {getInitials(profile.full_name)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile.username}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile.credits} cr</span>
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/login" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Log in</a>
            <a href="/signup" style={{ padding: "8px 16px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign up free</a>
          </div>
        )}
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 900, color: "#1a1a1a", marginBottom: 4 }}>Browse Skills</h1>
            <p style={{ fontSize: 14, color: "#888" }}>Find the perfect teacher · {listings.length} listings available</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowSidebar(s => !s)} className="filter-pill"
              style={{ padding: "8px 16px", borderRadius: 10, background: showSidebar ? "#2d6a4f" : "#f5f0e8", color: showSidebar ? "#fff" : "#555", fontSize: 13, fontWeight: 700 }}>
              {showSidebar ? "Hide Filters" : "Show Filters"}
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 18 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
          <input
            type="text"
            placeholder="Search skills, teachers, topics..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "13px 16px 13px 46px", borderRadius: 14, border: "1.5px solid #e8e2d9", fontSize: 14, background: "#fff", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "#e8e2d9", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          )}
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {categories.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = category === cat;
            return (
              <button key={cat} className="cat-btn" onClick={() => setCategory(cat)}
                style={{ padding: "7px 16px", borderRadius: 20, border: "1.5px solid", borderColor: active ? (cfg?.color || "#2d6a4f") : "#e8e2d9", background: active ? (cfg?.bg || "#e8f4e8") : "#fff", color: active ? (cfg?.color || "#2d6a4f") : "#666", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {cfg?.icon && <span>{cfg.icon}</span>} {cat}
              </button>
            );
          })}
        </div>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>Active:</span>
            {activeFilters.map((f, i) => (
              <button key={i} onClick={f.clear} className="filter-pill"
                style={{ padding: "4px 12px", borderRadius: 20, background: "#1a1a1a", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {f.label} <span style={{ opacity: 0.6 }}>✕</span>
              </button>
            ))}
            <button onClick={clearAll} style={{ padding: "4px 12px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>
              Clear all
            </button>
          </div>
        )}

        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: showSidebar ? "240px 1fr" : "1fr", gap: 20, alignItems: "start" }}>

          {/* Sidebar filters */}
          {showSidebar && (
            <div style={{ position: "sticky", top: 74, display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Sort */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Sort By</div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#333" }}>
                  <option value="newest">⭐ Newest first</option>
                  <option value="price_low">💰 Price: Low to High</option>
                  <option value="price_high">💰 Price: High to Low</option>
                  <option value="duration_low">⏱ Shortest first</option>
                </select>
              </div>

              {/* Format */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Format</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["All", "video", "chat", "docs", "mixed"].map(f => {
                    const cfg = FORMAT_CONFIG[f];
                    return (
                      <button key={f} onClick={() => setFormat(f)}
                        style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${format === f ? (cfg?.accent || "#2d6a4f") : "#e8e2d9"}`, background: format === f ? (cfg?.bg || "#e8f4e8") : "#fafaf8", color: format === f ? (cfg?.accent || "#2d6a4f") : "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                        {cfg ? `${cfg.icon} ${cfg.label}` : "✨ All Formats"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price range */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Max Price</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>0 cr</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#2d6a4f" }}>{maxPrice === 50 ? "Any" : `≤ ${maxPrice} cr`}</span>
                </div>
                <input type="range" min={5} max={50} step={5} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#2d6a4f" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  {[10, 20, 30, 50].map(p => (
                    <button key={p} onClick={() => setMaxPrice(p)}
                      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, border: "1px solid #e8e2d9", background: maxPrice === p ? "#2d6a4f" : "#fff", color: maxPrice === p ? "#fff" : "#888", cursor: "pointer", fontWeight: 700 }}>
                      {p === 50 ? "Any" : `${p}cr`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Duration</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { val: "all", label: "⏱ Any duration" },
                    { val: "30min", label: "⚡ Up to 30 min" },
                    { val: "1hr", label: "🕐 Up to 1 hour" },
                    { val: "2hr", label: "🕑 Up to 2 hours" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setMaxDuration(opt.val)}
                      style={{ padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${maxDuration === opt.val ? "#2d6a4f" : "#e8e2d9"}`, background: maxDuration === opt.val ? "#e8f4e8" : "#fafaf8", color: maxDuration === opt.val ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {activeFilters.length > 0 && (
                <button onClick={clearAll} style={{ padding: "11px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", width: "100%" }}>
                  🗑 Reset All Filters
                </button>
              )}
            </div>
          )}

          {/* Listings grid */}
          <div>
            {/* Results bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
                Showing <strong style={{ color: "#1a1a1a" }}>{filtered.length}</strong> of <strong style={{ color: "#1a1a1a" }}>{listings.length}</strong> listings
                {search && <span> for "<strong>{search}</strong>"</span>}
              </span>
              {!showSidebar && (
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff" }}>
                  <option value="newest">Newest first</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="duration_low">Shortest first</option>
                </select>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                <p style={{ color: "#888" }}>Loading listings...</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9" }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🔍</div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>No listings found</h3>
                <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>Try adjusting your filters or search terms</p>
                <button onClick={clearAll} style={{ padding: "10px 24px", background: "#2d6a4f", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Clear all filters
                </button>
              </div>
            )}

            {/* Masonry grid */}
            {!loading && filtered.length > 0 && (
              <div style={{ columns: showSidebar ? "280px 2" : "280px 3", gap: 18 }}>
                {filtered.map(listing => {
                  const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                  const cat = CATEGORY_CONFIG[listing.skills?.category] || { color: "#2d6a4f", bg: "#e8f4e8", icon: "📚" };
                  return (
                    <div key={listing.id} className="listing-card"
                      onClick={() => window.location.href = profile ? `/listings/${listing.id}` : "/login"}
                      style={{ background: "#fff", borderRadius: 20, padding: "22px", marginBottom: 18, breakInside: "avoid", border: "1.5px solid #e8e2d9", position: "relative", overflow: "hidden" }}>

                      {/* Top color accent */}
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: fmt.accent, borderRadius: "20px 20px 0 0" }} />

                      {/* Badges */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                        <span style={{ background: fmt.bg, color: fmt.accent, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                          {fmt.icon} {fmt.label}
                        </span>
                        <span style={{ background: cat.bg, color: cat.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                          {cat.icon} {listing.skills?.name}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.35 }}>
                        {listing.title}
                      </h3>

                      {/* Description */}
                      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {listing.description}
                      </p>

                      {/* Outcomes */}
                      {listing.outcomes && (
                        <div style={{ background: fmt.bg, borderRadius: 10, padding: "9px 12px", marginBottom: 14 }}>
                          <p style={{ fontSize: 10, fontWeight: 800, color: fmt.accent, marginBottom: 2, letterSpacing: "0.06em" }}>YOU'LL LEARN</p>
                          <p style={{ fontSize: 12, color: "#444", lineHeight: 1.4 }}>{listing.outcomes}</p>
                        </div>
                      )}

                      {/* Teacher */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "10px 12px", background: "#fafaf8", borderRadius: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: LEVEL_COLORS[listing.profiles?.level] || fmt.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {getInitials(listing.profiles?.full_name || "?")}
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>{listing.profiles?.full_name}</p>
                          <p style={{ fontSize: 11, color: "#aaa" }}>@{listing.profiles?.username} · {listing.profiles?.level}</p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1.5px solid #f0ece4" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ background: fmt.accent, color: "#fff", fontSize: 13, fontWeight: 800, padding: "5px 14px", borderRadius: 20 }}>
                            {listing.credit_price} cr
                          </span>
                          <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>⏱ {listing.duration}min</span>
                        </div>
                        <span style={{ fontSize: 12, color: fmt.accent, fontWeight: 700 }}>
                          {profile ? "Book →" : "Login →"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}