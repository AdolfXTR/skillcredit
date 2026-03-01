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
  thumbnail_url?: string;
  skills: { name: string; category: string };
  profiles: { full_name: string; username: string; level: string; avg_rating?: number };
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

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: string; thumb: string }> = {
  Programming: { color: "#1d4ed8", bg: "#dbeafe", icon: "💻", thumb: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #3b82f6 100%)" },
  Design:      { color: "#be185d", bg: "#fce7f3", icon: "🎨", thumb: "linear-gradient(135deg, #831843 0%, #be185d 50%, #ec4899 100%)" },
  Language:    { color: "#166534", bg: "#dcfce7", icon: "🌍", thumb: "linear-gradient(135deg, #14532d 0%, #16a34a 50%, #4ade80 100%)" },
  Academic:    { color: "#7c3aed", bg: "#ede9fe", icon: "📚", thumb: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)" },
  Music:       { color: "#b45309", bg: "#fef3c7", icon: "🎵", thumb: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #fcd34d 100%)" },
  Arts:        { color: "#991b1b", bg: "#fee2e2", icon: "🎭", thumb: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f87171 100%)" },
  Media:       { color: "#0369a1", bg: "#e0f2fe", icon: "🎬", thumb: "linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #38bdf8 100%)" },
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

const MOCK: Listing[] = [
  { id: "1", title: "Python for Absolute Beginners", description: "Learn Python from scratch — variables, loops, functions, and your first project.", credit_price: 15, format: "video", duration: 60, prerequisites: "None", outcomes: "Build a simple Python app", is_active: true, created_at: new Date().toISOString(), teacher_id: "1", skills: { name: "Python", category: "Programming" }, profiles: { full_name: "Maria Santos", username: "mariasantos", level: "Expert", avg_rating: 4.9 } },
  { id: "2", title: "UI/UX Design with Figma", description: "Master Figma and learn how to design beautiful, user-friendly interfaces.", credit_price: 12, format: "mixed", duration: 90, prerequisites: "Basic computer skills", outcomes: "Design a full app UI in Figma", is_active: true, created_at: new Date().toISOString(), teacher_id: "2", skills: { name: "UI/UX Design", category: "Design" }, profiles: { full_name: "Reina Cruz", username: "reinacruz", level: "Master", avg_rating: 4.8 } },
  { id: "3", title: "English Conversation Practice", description: "Improve your spoken English with a native-level speaker. Perfect for job interviews.", credit_price: 8, format: "video", duration: 30, prerequisites: "Basic English", outcomes: "Speak more confidently in English", is_active: true, created_at: new Date().toISOString(), teacher_id: "3", skills: { name: "English Writing", category: "Language" }, profiles: { full_name: "Lisa Mendoza", username: "lisamendoza", level: "Skilled", avg_rating: 4.7 } },
  { id: "4", title: "JavaScript & React Fundamentals", description: "Go from zero to building real React apps. We'll cover JS basics and React hooks.", credit_price: 20, format: "chat", duration: 120, prerequisites: "Basic HTML/CSS", outcomes: "Build a React app from scratch", is_active: true, created_at: new Date().toISOString(), teacher_id: "4", skills: { name: "React", category: "Programming" }, profiles: { full_name: "Carlo Reyes", username: "carloreyes", level: "Legend", avg_rating: 5.0 } },
  { id: "5", title: "Guitar for Beginners", description: "Learn your first chords and play your favorite songs within a week!", credit_price: 10, format: "video", duration: 45, prerequisites: "None — just bring a guitar!", outcomes: "Play 3 songs end to end", is_active: true, created_at: new Date().toISOString(), teacher_id: "5", skills: { name: "Guitar", category: "Music" }, profiles: { full_name: "Sam Ramos", username: "samramos", level: "Contributor", avg_rating: 4.6 } },
  { id: "6", title: "Video Editing with CapCut", description: "Create stunning reels, vlogs, and YouTube videos using CapCut on mobile.", credit_price: 14, format: "docs", duration: 60, prerequisites: "A smartphone", outcomes: "Edit and publish your first viral reel", is_active: true, created_at: new Date().toISOString(), teacher_id: "6", skills: { name: "Video Editing", category: "Media" }, profiles: { full_name: "Kiko Dela Cruz", username: "kikodelacruz", level: "Skilled", avg_rating: 4.5 } },
  { id: "7", title: "Math Tutoring — Algebra & Calculus", description: "Struggling with math? I'll break down complex concepts into simple steps.", credit_price: 18, format: "mixed", duration: 90, prerequisites: "High school level", outcomes: "Ace your next math exam", is_active: true, created_at: new Date().toISOString(), teacher_id: "7", skills: { name: "Math Tutoring", category: "Academic" }, profiles: { full_name: "Ana Villanueva", username: "anavillanueva", level: "Expert", avg_rating: 4.8 } },
  { id: "8", title: "Graphic Design with Canva", description: "Create professional posters, social media content, and presentations using Canva.", credit_price: 9, format: "video", duration: 45, prerequisites: "None", outcomes: "Design 5 professional graphics", is_active: true, created_at: new Date().toISOString(), teacher_id: "8", skills: { name: "Graphic Design", category: "Design" }, profiles: { full_name: "Bea Aquino", username: "beaaquino", level: "Learner", avg_rating: 4.3 } },
];

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function renderStars(rating: number) {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
        .select(`*, skills(name, category), profiles(full_name, username, level, avg_rating)`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setListings((!error && data && data.length > 0) ? data as Listing[] : MOCK as Listing[]);
      setLoading(false);
    };
    init();
  }, []);

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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; color: inherit; }
        .listing-card { transition: transform 0.2s ease, box-shadow 0.2s ease; cursor: pointer; }
        .listing-card:hover { transform: translateY(-5px); box-shadow: 0 20px 48px rgba(0,0,0,0.13) !important; }
        .listing-card:hover .book-btn { background: #1a4a36 !important; }
        .filter-btn { transition: all 0.15s; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; }
        .filter-btn:hover { opacity: 0.85; }
        .cat-pill { transition: all 0.15s; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; }
        .cat-pill:hover { transform: translateY(-1px); }
        .nav-a { padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #555; transition: all 0.12s; }
        .nav-a:hover { background: #f0ede8; color: #1a1a1a; }
        .nav-a.active { background: #e8f4e8; color: #2d6a4f; }
        input[type=range] { accent-color: #2d6a4f; }
        input:focus, select:focus { outline: none; border-color: #2d6a4f !important; box-shadow: 0 0 0 3px rgba(45,106,79,0.1); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .card-appear { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(16px)", borderBottom: "1.5px solid #e8e2d9", padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        {/* Logo — links to dashboard */}
        <a href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {/* Dashboard home link */}
          <a href="/dashboard" className="nav-a" style={{ display: "flex", alignItems: "center", gap: 5 }}>🏠 Dashboard</a>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([label, href]) => (
            <a key={label} href={href} className={`nav-a${href === "/listings" ? " active" : ""}`}>{label}</a>
          ))}
        </div>

        {/* Right side */}
        {profile ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href="/listings/create" style={{ padding: "8px 18px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15 }}>+</span> Create Listing
            </a>
            <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 6px", borderRadius: 10, background: "#f5f0e8" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                {getInitials(profile.full_name)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile.username}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 10px", borderRadius: 20 }}>{profile.credits} cr</span>
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/login" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600 }}>Log in</a>
            <a href="/signup" style={{ padding: "8px 18px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700 }}>Sign up free</a>
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
          <button onClick={() => setShowSidebar(s => !s)} className="filter-btn"
            style={{ padding: "9px 18px", borderRadius: 10, background: showSidebar ? "#2d6a4f" : "#f5f0e8", color: showSidebar ? "#fff" : "#555", fontSize: 13, fontWeight: 700 }}>
            {showSidebar ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 18 }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
          <input type="text" placeholder="Search skills, teachers, topics..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "13px 16px 13px 46px", borderRadius: 14, border: "1.5px solid #e8e2d9", fontSize: 14, background: "#fff", fontFamily: "'DM Sans', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", transition: "border-color 0.15s" }}
          />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "#e8e2d9", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>}
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {categories.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = category === cat;
            return (
              <button key={cat} className="cat-pill" onClick={() => setCategory(cat)}
                style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${active ? (cfg?.color || "#2d6a4f") : "#e8e2d9"}`, background: active ? (cfg?.bg || "#e8f4e8") : "#fff", color: active ? (cfg?.color || "#2d6a4f") : "#666", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {cfg?.icon && <span>{cfg.icon}</span>}{cat}
              </button>
            );
          })}
        </div>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>Active:</span>
            {activeFilters.map((f, i) => (
              <button key={i} onClick={f.clear} className="filter-btn"
                style={{ padding: "4px 12px", borderRadius: 20, background: "#1a1a1a", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {f.label} <span style={{ opacity: 0.5 }}>✕</span>
              </button>
            ))}
            <button onClick={clearAll} className="filter-btn" style={{ padding: "4px 12px", borderRadius: 20, background: "#fee2e2", color: "#991b1b", fontSize: 12, fontWeight: 700 }}>Clear all</button>
          </div>
        )}

        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: showSidebar ? "240px 1fr" : "1fr", gap: 20, alignItems: "start" }}>

          {/* ── SIDEBAR ── */}
          {showSidebar && (
            <div style={{ position: "sticky", top: 74, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Sort */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Sort By</div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#333", cursor: "pointer" }}>
                  <option value="newest">⭐ Newest first</option>
                  <option value="price_low">💰 Price: Low → High</option>
                  <option value="price_high">💰 Price: High → Low</option>
                  <option value="duration_low">⏱ Shortest first</option>
                </select>
              </div>

              {/* Format */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Format</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {["All", "video", "chat", "docs", "mixed"].map(f => {
                    const cfg = FORMAT_CONFIG[f];
                    const active = format === f;
                    return (
                      <button key={f} onClick={() => setFormat(f)} className="filter-btn"
                        style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${active ? (cfg?.accent || "#2d6a4f") : "#e8e2d9"}`, background: active ? (cfg?.bg || "#e8f4e8") : "#fafaf8", color: active ? (cfg?.accent || "#2d6a4f") : "#555", fontSize: 13, fontWeight: 700, textAlign: "left" }}>
                        {cfg ? `${cfg.icon} ${cfg.label}` : "✨ All Formats"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Max Price */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Max Price</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>0 cr</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#2d6a4f" }}>{maxPrice === 50 ? "Any" : `≤ ${maxPrice} cr`}</span>
                </div>
                <input type="range" min={5} max={50} step={5} value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} style={{ width: "100%" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 4 }}>
                  {[10, 20, 30, 50].map(p => (
                    <button key={p} onClick={() => setMaxPrice(p)} className="filter-btn"
                      style={{ flex: 1, fontSize: 11, padding: "4px 0", borderRadius: 8, border: "1.5px solid #e8e2d9", background: maxPrice === p ? "#2d6a4f" : "#fff", color: maxPrice === p ? "#fff" : "#888", fontWeight: 700 }}>
                      {p === 50 ? "Any" : `${p}cr`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Duration</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { val: "all", label: "⏱ Any duration" },
                    { val: "30min", label: "⚡ Up to 30 min" },
                    { val: "1hr", label: "🕐 Up to 1 hour" },
                    { val: "2hr", label: "🕑 Up to 2 hours" },
                  ].map(opt => (
                    <button key={opt.val} onClick={() => setMaxDuration(opt.val)} className="filter-btn"
                      style={{ padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${maxDuration === opt.val ? "#2d6a4f" : "#e8e2d9"}`, background: maxDuration === opt.val ? "#e8f4e8" : "#fafaf8", color: maxDuration === opt.val ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: 700, textAlign: "left" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilters.length > 0 && (
                <button onClick={clearAll} className="filter-btn"
                  style={{ padding: "11px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 700, fontSize: 13, width: "100%" }}>
                  🗑 Reset All Filters
                </button>
              )}
            </div>
          )}

          {/* ── LISTINGS ── */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <span style={{ fontSize: 13, color: "#888", fontWeight: 600 }}>
                Showing <strong style={{ color: "#1a1a1a" }}>{filtered.length}</strong> of <strong style={{ color: "#1a1a1a" }}>{listings.length}</strong> listings
                {search && <span> for "<strong>{search}</strong>"</span>}
              </span>
              {!showSidebar && (
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ padding: "7px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", cursor: "pointer" }}>
                  <option value="newest">Newest first</option>
                  <option value="price_low">Price: Low → High</option>
                  <option value="price_high">Price: High → Low</option>
                  <option value="duration_low">Shortest first</option>
                </select>
              )}
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
                <p style={{ color: "#888" }}>Loading listings...</p>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9" }}>
                <div style={{ fontSize: 48, marginBottom: 14 }}>🔍</div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>No listings found</h3>
                <p style={{ color: "#888", fontSize: 14, marginBottom: 20 }}>Try adjusting your filters or search terms</p>
                <button onClick={clearAll} className="filter-btn" style={{ padding: "10px 24px", background: "#2d6a4f", color: "#fff", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Clear all filters</button>
              </div>
            )}

            {/* ── CARD GRID ── */}
            {!loading && filtered.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: showSidebar ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 18 }}>
                {filtered.map((listing, i) => {
                  const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                  const cat = CATEGORY_CONFIG[listing.skills?.category] || { color: "#2d6a4f", bg: "#e8f4e8", icon: "📚", thumb: "linear-gradient(135deg, #1a4a36, #2d6a4f)" };
                  const rating = listing.profiles?.avg_rating || 0;

                  return (
                    <div key={listing.id} className="listing-card card-appear"
                      style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", animationDelay: `${i * 0.04}s` }}
                      onClick={() => window.location.href = profile ? `/listings/${listing.id}` : "/login"}>

                      {/* ── THUMBNAIL (category gradient + icon) ── */}
                      <div style={{ position: "relative", height: 140, background: listing.thumbnail_url ? `url(${listing.thumbnail_url}) center/cover` : cat.thumb, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {/* big category icon as placeholder art */}
                        {!listing.thumbnail_url && (
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 52, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))", lineHeight: 1 }}>{cat.icon}</div>
                          </div>
                        )}
                        {/* Glassmorphism price tag — bottom right of image */}
                        <div style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", borderRadius: 20, padding: "5px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 900, color: "#fff" }}>{listing.credit_price} cr</span>
                          <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.3)" }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>⏱ {listing.duration}m</span>
                        </div>
                        {/* Format badge — top left */}
                        <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: fmt.accent, display: "flex", alignItems: "center", gap: 4 }}>
                          {fmt.icon} {fmt.label}
                        </div>
                        {/* Rating — top right */}
                        {rating > 0 && (
                          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#b45309", display: "flex", alignItems: "center", gap: 3 }}>
                            ★ {rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {/* ── CARD BODY ── */}
                      <div style={{ padding: "18px 20px 20px" }}>

                        {/* Category tag */}
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ background: cat.bg, color: cat.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                            {cat.icon} {listing.skills?.name}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 900, color: "#1a1a1a", marginBottom: 7, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {listing.title}
                        </h3>

                        {/* Description */}
                        <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {listing.description}
                        </p>

                        {/* You'll learn */}
                        {listing.outcomes && (
                          <div style={{ background: "#f8f7f4", borderRadius: 10, padding: "9px 12px", marginBottom: 14, borderLeft: `3px solid ${cat.color}` }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: "#aaa", marginBottom: 3, letterSpacing: "0.06em", textTransform: "uppercase" }}>YOU'LL LEARN</p>
                            <p style={{ fontSize: 12, color: "#444", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{listing.outcomes}</p>
                          </div>
                        )}

                        {/* Teacher row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#fafaf8", borderRadius: 12, marginBottom: 14 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: LEVEL_COLORS[listing.profiles?.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            {getInitials(listing.profiles?.full_name || "?")}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: "#222" }}>{listing.profiles?.full_name}</p>
                            <p style={{ fontSize: 11, color: "#aaa" }}>@{listing.profiles?.username} · {listing.profiles?.level}</p>
                          </div>
                          {rating > 0 && (
                            <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>{renderStars(rating)}</div>
                          )}
                        </div>

                        {/* CTA row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", flex: 1 }}>
                            <button className="book-btn" style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "background 0.15s", letterSpacing: "0.01em" }}>
                              {profile ? "Book Now →" : "Login to Book"}
                            </button>
                          </div>
                        </div>
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