"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type BadgeTier = { name: string; emoji: string; color: string; bg: string; border: string };
function getBadgeTier(xp: number, sessions: number, avgRating: number): BadgeTier {
  if (xp >= 5000 && sessions >= 50 && avgRating >= 4.5)
    return { name: "Legend",  emoji: "👑", color: "#b45309", bg: "#fef3c7", border: "#fde68a" };
  if (xp >= 2000 && sessions >= 20 && avgRating >= 4.0)
    return { name: "Elite",   emoji: "💎", color: "#7c3aed", bg: "#ede9fe", border: "#ddd6fe" };
  if (xp >= 500  && sessions >= 5)
    return { name: "Pro",     emoji: "🔥", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
  if (xp >= 100  || sessions >= 1)
    return { name: "Rising",  emoji: "⭐", color: "#d97706", bg: "#fef3c7", border: "#fde68a" };
  return   { name: "Seedling",emoji: "🌱", color: "#2d6a4f", bg: "#e8f4e8", border: "#bbf7d0" };
}

// ── BAYESIAN AVERAGE ──────────────────────────────────────────────────────────
// Prevents someone with 1 lucky 5★ beating someone with 50 genuine reviews.
// C=5 confidence weight, m=3.5 global prior mean
// Formula: (C×m + sum_of_ratings) / (C + count)
function bayesianAvg(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const C = 5, m = 3.5;
  return (C * m + ratings.reduce((s, r) => s + r, 0)) / (C + ratings.length);
}

type User = {
  id: string; full_name: string; username: string; bio: string | null;
  location: string | null; level: string; credits: number; xp: number;
  role: string; is_verified: boolean; avatar_url: string | null; created_at: string;
};
type Listing = { id: string; title: string; credit_price: number; format: string; skill?: { name: string } };
type Review  = { id: string; overall: number; review: string; created_at: string; rater?: { full_name: string; username: string; level: string } };
type UserStats = { sessions: number; listings: number; avgRating: number; skills: { skill_name: string; is_verified: boolean }[] };

const LEVEL_PALETTE: Record<string, { bg: string; text: string; light: string; glow: string; pattern: string }> = {
  Seedling:    { bg: "#2d6a4f", text: "#fff", light: "#e8f4e8", glow: "rgba(45,106,79,0.2)",   pattern: "🌱" },
  Learner:     { bg: "#1d4ed8", text: "#fff", light: "#dbeafe", glow: "rgba(29,78,216,0.2)",   pattern: "📖" },
  Contributor: { bg: "#7c3aed", text: "#fff", light: "#ede9fe", glow: "rgba(124,58,237,0.2)",  pattern: "💡" },
  Skilled:     { bg: "#b45309", text: "#fff", light: "#fef3c7", glow: "rgba(180,83,9,0.2)",    pattern: "⚡" },
  Expert:      { bg: "#dc2626", text: "#fff", light: "#fee2e2", glow: "rgba(220,38,38,0.2)",   pattern: "🔥" },
  Master:      { bg: "#0891b2", text: "#fff", light: "#e0f2fe", glow: "rgba(8,145,178,0.2)",   pattern: "🌊" },
  Legend:      { bg: "#d97706", text: "#fff", light: "#fef3c7", glow: "rgba(217,119,6,0.25)",  pattern: "👑" },
};

const FORMAT_ICONS: Record<string, string> = { video: "🎥", chat: "💬", docs: "📄", mixed: "🔀" };

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function timeAgo(iso: string) {
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 1) return "New";
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}yr`;
}
function Stars({ rating }: { rating: number }) {
  return <span style={{ color: "#f59e0b", fontSize: 12 }}>{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</span>;
}

// ─── DRAWER ───────────────────────────────────────────────────────────────────
function UserDrawer({ userId, onClose, currentUserId }: { userId: string; onClose: () => void; currentUserId: string }) {
  const [user, setUser]         = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [stats, setStats]       = useState<UserStats>({ sessions: 0, listings: 0, avgRating: 0, skills: [] });
  const [tab, setTab]           = useState<"about"|"listings"|"reviews">("about");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    load();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [userId]);

  async function load() {
    setLoading(true);
    const [userRes, listingsRes, reviewsRes, sessionsRes, skillsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("listings").select("id,title,credit_price,format,skill:skills(name)").eq("teacher_id", userId).eq("is_active", true).limit(6),
      supabase.from("ratings").select("id,overall,review,created_at,rater:profiles!ratings_rater_id_fkey(full_name,username,level)").eq("rated_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("teacher_id", userId).eq("status", "completed"),
      supabase.from("user_skills").select("skill_name,is_verified").eq("user_id", userId),
    ]);
    if (userRes.data) setUser(userRes.data);
    setListings((listingsRes.data as any) || []);
    setReviews((reviewsRes.data as any) || []);
    const ratings = (reviewsRes.data as any) || [];
    // ── BAYESIAN AVG in drawer ──
    const avg = bayesianAvg((ratings as any[]).map((r: any) => r.overall));
    setStats({ sessions: sessionsRes.count || 0, listings: listingsRes.data?.length || 0, avgRating: avg, skills: (skillsRes.data as any) || [] });
    setLoading(false);
  }

  function openMsg() { sessionStorage.setItem("openMessageWith", userId); window.location.href = "/messages"; }

  const lvl = LEVEL_PALETTE[user?.level || "Seedling"] || LEVEL_PALETTE.Seedling;
  const badge = user ? getBadgeTier(user.xp, stats.sessions, stats.avgRating) : null;
  const isOwn = userId === currentUserId;

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:300, backdropFilter:"blur(4px)", animation:"fadeIn 0.15s ease" }} />
      <div style={{ position:"fixed", top:0, right:0, width:420, height:"100vh", background:"#fff", zIndex:301, display:"flex", flexDirection:"column", boxShadow:"-16px 0 60px rgba(0,0,0,0.15)", animation:"slideInRight 0.25s cubic-bezier(0.16,1,0.3,1)" }}>

        {/* HEADER BANNER */}
        <div style={{ height:80, background:`linear-gradient(135deg,${lvl.bg},${lvl.bg}bb)`, position:"relative", flexShrink:0, overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-30, left:-20, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.06)" }} />
          <div style={{ position:"absolute", bottom:-40, right:-10, width:140, height:140, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
          <div style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", fontSize:52, opacity:0.1 }}>{lvl.pattern}</div>
          <button onClick={onClose} style={{ position:"absolute", top:14, right:14, width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
            <div style={{ width:28, height:28, border:`3px solid ${lvl.light}`, borderTopColor:lvl.bg, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
            <p style={{ fontSize:12, color:"#aaa" }}>Loading…</p>
          </div>
        ) : user ? (
          <>
            {/* PROFILE HEADER */}
            <div style={{ padding:"0 20px 16px", borderBottom:"1.5px solid #f0ece4", flexShrink:0 }}>
              <div style={{ marginTop:-28, marginBottom:12, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
                <div style={{ width:62, height:62, borderRadius:16, background:lvl.bg, border:"3px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:"#fff", boxShadow:`0 4px 20px ${lvl.glow}`, fontFamily:"'Fraunces',serif" }}>
                  {getInitials(user.full_name)}
                </div>
                {!isOwn ? (
                  <div style={{ display:"flex", gap:7, paddingBottom:2 }}>
                    <button onClick={openMsg} style={{ padding:"8px 16px", borderRadius:10, background:lvl.bg, color:"#fff", border:"none", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:`0 2px 10px ${lvl.glow}` }}>
                      💬 Message
                    </button>
                    <a href={`/listings?teacher=${user.id}`} style={{ padding:"8px 14px", borderRadius:10, background:"#f5f0e8", color:"#555", border:"1.5px solid #e8e2d9", fontSize:12, fontWeight:700, textDecoration:"none", display:"flex", alignItems:"center" }}>
                      📚 Book
                    </a>
                  </div>
                ) : (
                  <a href="/profile" style={{ padding:"7px 14px", borderRadius:10, background:"#f5f0e8", color:"#555", border:"1.5px solid #e8e2d9", fontSize:12, fontWeight:700, textDecoration:"none" }}>✏️ Edit</a>
                )}
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:3 }}>
                <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>{user.full_name}</span>
                {user.is_verified && <span style={{ fontSize:10, fontWeight:700, color:"#166534", background:"#f0fdf4", padding:"2px 8px", borderRadius:999, border:"1px solid #bbf7d0" }}>✅ Verified</span>}
                {badge && <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:999, background:badge.bg, color:badge.color, border:`1px solid ${badge.border}` }}>{badge.emoji} {badge.name}</span>}
              </div>
              <div style={{ fontSize:12, color:"#aaa", marginBottom:badge ? 8 : 0 }}>
                @{user.username}
                <span style={{ margin:"0 6px", color:"#e0dbd4" }}>·</span>
                <span style={{ background:lvl.light, color:lvl.bg, padding:"1px 7px", borderRadius:999, fontSize:10, fontWeight:700 }}>{lvl.pattern} {user.level}</span>
                {user.location && <span style={{ marginLeft:8 }}>📍 {user.location}</span>}
              </div>
              {user.bio && <p style={{ fontSize:13, color:"#555", lineHeight:1.65, marginTop:8, marginBottom:0 }}>{user.bio}</p>}

              {/* STATS — no credits, bayesian rating */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:14 }}>
                {[
                  { label:"Sessions", val:stats.sessions,                                                    icon:"📅", color:"#0891b2" },
                  { label:"Rating",   val:stats.avgRating > 0 ? `${stats.avgRating.toFixed(2)}★` : "—",     icon:"⭐", color:"#f59e0b" },
                  { label:"XP",       val:user.xp.toLocaleString(),                                          icon:"⚡", color:lvl.bg  },
                ].map(s => (
                  <div key={s.label} style={{ background:"#faf8f4", borderRadius:12, padding:"10px 8px", textAlign:"center", border:"1.5px solid #f0ece4" }}>
                    <div style={{ fontSize:16, marginBottom:3 }}>{s.icon}</div>
                    <div style={{ fontSize:16, fontWeight:900, color:s.color, fontFamily:"'Fraunces',serif" }}>{s.val}</div>
                    <div style={{ fontSize:9, color:"#bbb", fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {stats.skills.filter(s => s.is_verified).length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:5 }}>
                  {stats.skills.filter(s => s.is_verified).slice(0,4).map(s => (
                    <span key={s.skill_name} style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:"#f0fdf4", color:"#166534", border:"1px solid #bbf7d0" }}>✅ {s.skill_name}</span>
                  ))}
                </div>
              )}
            </div>

            {/* TABS */}
            <div style={{ display:"flex", background:"#faf8f4", borderBottom:"1.5px solid #f0ece4", flexShrink:0 }}>
              {(["about","listings","reviews"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"11px 0", border:"none", background:"none", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", color:tab===t?lvl.bg:"#aaa", borderBottom:`2.5px solid ${tab===t?lvl.bg:"transparent"}`, textTransform:"capitalize", transition:"all 0.12s" }}>
                  {t === "listings" ? `Listings (${stats.listings})` : t === "reviews" ? `Reviews (${reviews.length})` : "About"}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
              {tab === "about" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ background:"#faf8f4", borderRadius:14, padding:"16px", border:"1.5px solid #e8e2d9" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Profile Info</div>
                    {[
                      ["🧑 Role",    user.role?.charAt(0).toUpperCase() + user.role?.slice(1)],
                      user.location ? ["📍 Location", user.location] : null,
                      ["⚡ XP",      user.xp.toLocaleString()],
                      ["📅 Joined",  new Date(user.created_at).toLocaleDateString("en-PH", { year:"numeric", month:"long" })],
                    ].filter(Boolean).map(item => {
                      const [k, v] = item as [string, string];
                      return (
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #f0ece4", fontSize:13 }}>
                          <span style={{ color:"#999" }}>{k}</span>
                          <span style={{ fontWeight:700, color:"#333" }}>{v}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:11, color:"#aaa", fontWeight:600 }}>
                      <span>XP Progress</span>
                      <span style={{ color:lvl.bg, fontWeight:700 }}>{user.level}</span>
                    </div>
                    <div style={{ background:"#f0ece4", borderRadius:999, height:7, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min((user.xp % 500)/500*100,100)}%`, background:`linear-gradient(90deg,${lvl.bg},${lvl.bg}99)`, borderRadius:999, transition:"width 0.6s ease" }} />
                    </div>
                  </div>

                  {stats.skills.length > 0 && (
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Skills</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {stats.skills.map(s => (
                          <span key={s.skill_name} style={{ fontSize:12, fontWeight:600, padding:"4px 11px", borderRadius:999, background:s.is_verified?"#f0fdf4":"#f5f0e8", color:s.is_verified?"#166534":"#555", border:`1px solid ${s.is_verified?"#bbf7d0":"#e8e2d9"}` }}>
                            {s.is_verified ? "✅ " : ""}{s.skill_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "listings" && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {listings.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"48px 0", color:"#ccc" }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>📭</div>
                      <p style={{ fontSize:13 }}>No active listings yet.</p>
                    </div>
                  ) : listings.map(l => (
                    <a key={l.id} href={`/listings/${l.id}`} style={{ display:"block", padding:"14px", borderRadius:14, border:"1.5px solid #e8e2d9", background:"#faf8f4", textDecoration:"none", transition:"all 0.12s" }}
                      onMouseOver={e => { e.currentTarget.style.background="#f5f0e8"; e.currentTarget.style.borderColor="#d4cfc8"; }}
                      onMouseOut={e =>  { e.currentTarget.style.background="#faf8f4"; e.currentTarget.style.borderColor="#e8e2d9"; }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:"#1a1a1a", marginBottom:4 }}>{l.title}</div>
                          <div style={{ fontSize:11, color:"#aaa" }}>{FORMAT_ICONS[l.format]} {l.format}{(l.skill as any)?.name && ` · ${(l.skill as any).name}`}</div>
                        </div>
                        <span style={{ fontSize:15, fontWeight:900, color:lvl.bg, fontFamily:"'Fraunces',serif", marginLeft:10 }}>{l.credit_price} cr</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}

              {tab === "reviews" && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {reviews.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"48px 0", color:"#ccc" }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>⭐</div>
                      <p style={{ fontSize:13 }}>No reviews yet.</p>
                    </div>
                  ) : reviews.map(r => (
                    <div key={r.id} style={{ padding:"14px", borderRadius:14, border:"1.5px solid #e8e2d9", background:"#faf8f4" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:LEVEL_PALETTE[(r.rater as any)?.level || "Seedling"]?.bg || "#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", flexShrink:0 }}>
                          {getInitials((r.rater as any)?.full_name || "?")}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#333" }}>{(r.rater as any)?.full_name}</div>
                          <div style={{ fontSize:10, color:"#bbb" }}>@{(r.rater as any)?.username}</div>
                        </div>
                        <Stars rating={r.overall} />
                      </div>
                      {r.review && <p style={{ fontSize:12, color:"#666", lineHeight:1.6, fontStyle:"italic" }}>"{r.review}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8, color:"#ccc" }}>
            <div style={{ fontSize:36 }}>👤</div>
            <p style={{ fontSize:13 }}>User not found</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function PeoplePage() {
  const [currentUser, setCurrentUser]       = useState<User | null>(null);
  const [users, setUsers]                   = useState<User[]>([]);
  const [filtered, setFiltered]             = useState<User[]>([]);
  const [search, setSearch]                 = useState("");
  const [levelFilter, setLevelFilter]       = useState("all");
  const [roleFilter, setRoleFilter]         = useState("all");
  const [sortBy, setSortBy]                 = useState<"xp"|"joined">("xp");
  const [loading, setLoading]               = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userStats, setUserStats]           = useState<Record<string, { sessions: number; avgRating: number; listings: number }>>({});
  const searchTimeout = useRef<any>(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(applyFilters, 200);
  }, [search, levelFilter, roleFilter, sortBy, users]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (prof) setCurrentUser(prof);
    const { data } = await supabase.from("profiles").select("*").order("xp", { ascending: false });
    const all = data || [];
    setUsers(all);

    const statsMap: Record<string, { sessions: number; avgRating: number; listings: number }> = {};
    await Promise.all(all.slice(0, 20).map(async (u: User) => {
      const [sessRes, listRes, ratRes] = await Promise.all([
        supabase.from("sessions").select("id", { count:"exact", head:true }).eq("teacher_id", u.id).eq("status","completed"),
        supabase.from("listings").select("id", { count:"exact", head:true }).eq("teacher_id", u.id).eq("is_active",true),
        supabase.from("ratings").select("overall").eq("rated_id", u.id),
      ]);
      // ── BAYESIAN AVG in cards ──
      const avg = bayesianAvg((ratRes.data || []).map((r: any) => r.overall));
      statsMap[u.id] = { sessions: sessRes.count || 0, listings: listRes.count || 0, avgRating: avg };
    }));
    setUserStats(statsMap);
    setLoading(false);
  }

  function applyFilters() {
    let result = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u => u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.bio?.toLowerCase().includes(q) || u.location?.toLowerCase().includes(q));
    }
    if (levelFilter !== "all") result = result.filter(u => u.level === levelFilter);
    if (roleFilter  !== "all") result = result.filter(u => u.role  === roleFilter);
    result.sort((a, b) => sortBy === "xp" ? (b.xp||0) - (a.xp||0) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setFiltered(result);
  }

  const LEVELS = ["Seedling","Learner","Contributor","Skilled","Expert","Master","Legend"];
  const isFiltering = search || levelFilter !== "all" || roleFilter !== "all";
  const top3 = filtered.slice(0, 3);
  const rest  = filtered.slice(3);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#faf8f4", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:32, height:32, border:"3px solid #e8e2d9", borderTopColor:"#2d6a4f", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#aaa", fontSize:13 }}>Loading people…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f4", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; } a { text-decoration:none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideInRight { from{transform:translateX(100%)} to{transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .user-card { transition:box-shadow 0.18s,transform 0.18s,border-color 0.18s; cursor:pointer; }
        .user-card:hover { transform:translateY(-3px); }
        .top-card { transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1); cursor:pointer; }
        .top-card:hover { transform:translateY(-5px) scale(1.015); }
        .nav-link { padding:6px 12px; border-radius:8px; color:#666; font-size:13px; font-weight:600; transition:all 0.12s; }
        .nav-link:hover { background:#f5f0e8; color:#333; }
        .nav-link.active { background:#e8f4e8; color:#2d6a4f; }
        ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:#e0dbd4; border-radius:999px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background:"#fff", borderBottom:"1.5px solid #e8e2d9", padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h]) => (
            <a key={l} href={h} className={`nav-link ${h==="/people"?"active":""}`}>{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px", borderRadius:10, background:"#f5f0e8" }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:LEVEL_PALETTE[currentUser?.level||"Seedling"]?.bg||"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>
            {getInitials(currentUser?.full_name||"")}
          </div>
          <span style={{ fontSize:13, fontWeight:600, color:"#333" }}>@{currentUser?.username}</span>
        </a>
      </nav>

      {/* HERO */}
      <div style={{ background:"linear-gradient(135deg,#152b1e 0%,#2d6a4f 55%,#1e4a38 100%)", padding:"44px 24px 40px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, right:-40, width:240, height:240, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
        <div style={{ position:"absolute", bottom:-50, left:"20%", width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />
        <div style={{ position:"absolute", top:10, right:"15%", fontSize:90, opacity:0.05 }}>👥</div>
        <div style={{ maxWidth:1100, margin:"0 auto", position:"relative", zIndex:2, display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:24 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.45)", letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>SkillCredit Community</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:46, fontWeight:900, color:"#fff", lineHeight:1.05, letterSpacing:"-1px", marginBottom:10 }}>Meet the People</h1>
            <p style={{ color:"rgba(255,255,255,0.6)", fontSize:14, maxWidth:360, lineHeight:1.7 }}>Discover teachers, learners & contributors. Click any card to view their profile.</p>
          </div>
          <div style={{ display:"flex", gap:28 }}>
            {[
              { val:users.length,                               label:"Members",  icon:"👥" },
              { val:users.filter(u=>u.role==="teacher").length, label:"Teachers", icon:"👩‍🏫" },
              { val:users.filter(u=>u.is_verified).length,      label:"Verified", icon:"✅" },
            ].map(s => (
              <div key={s.label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{s.icon}</div>
                <div style={{ fontFamily:"'Fraunces',serif", fontSize:34, fontWeight:900, color:"#fff", lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontWeight:700, marginTop:3, textTransform:"uppercase", letterSpacing:1 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px 80px" }}>

        {/* SEARCH + FILTERS */}
        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap", animation:"fadeUp 0.4s 0.1s ease both" }}>
          <div style={{ position:"relative", flex:1, minWidth:220 }}>
            <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:13, color:"#bbb", pointerEvents:"none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, username, location…"
              style={{ width:"100%", padding:"11px 14px 11px 40px", borderRadius:12, border:"1.5px solid #e8e2d9", background:"#fff", color:"#1a1a1a", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}
              onFocus={e => { e.target.style.borderColor="#2d6a4f"; e.target.style.boxShadow="0 0 0 3px rgba(45,106,79,0.08)"; }}
              onBlur={e =>  { e.target.style.borderColor="#e8e2d9"; e.target.style.boxShadow="none"; }} />
          </div>
          {[
            { val:levelFilter, set:setLevelFilter, opts:[["all","All Levels"],...LEVELS.map(l=>[l,`${LEVEL_PALETTE[l].pattern} ${l}`])] },
            { val:roleFilter,  set:setRoleFilter,  opts:[["all","All Roles"],["teacher","👩‍🏫 Teachers"],["learner","📖 Learners"]] },
            { val:sortBy,      set:setSortBy as any, opts:[["xp","🏆 Top XP"],["joined","✨ Newest"]] },
          ].map((f, i) => (
            <select key={i} value={f.val} onChange={e => f.set(e.target.value as any)}
              style={{ padding:"11px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", background:"#fff", color:"#555", fontSize:13, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>

        {/* RESULTS COUNT */}
        <div style={{ fontSize:12, color:"#bbb", fontWeight:600, marginBottom:20, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#2d6a4f", display:"inline-block" }} />
          <span>{filtered.length} {filtered.length===1?"person":"people"} found{search && <span style={{ color:"#999" }}> for "<b style={{ color:"#555" }}>{search}</b>"</span>}</span>
          {isFiltering && (
            <button onClick={() => { setSearch(""); setLevelFilter("all"); setRoleFilter("all"); }}
              style={{ fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:999, padding:"2px 8px", cursor:"pointer", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* EMPTY */}
        {filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"72px 20px", background:"#fff", borderRadius:22, border:"1.5px solid #e8e2d9" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#1a1a1a", marginBottom:8 }}>No one found</div>
            <p style={{ color:"#aaa", fontSize:13, marginBottom:18 }}>Try different terms or clear your filters.</p>
            <button onClick={() => { setSearch(""); setLevelFilter("all"); setRoleFilter("all"); }}
              style={{ padding:"10px 24px", borderRadius:12, background:"#2d6a4f", color:"#fff", border:"none", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              Clear filters
            </button>
          </div>
        )}

        {/* TOP 3 */}
        {!isFiltering && top3.length > 0 && (
          <div style={{ marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5 }}>🏆 Top Members</span>
              <div style={{ flex:1, height:1, background:"#e8e2d9" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              {top3.map((user, idx) => {
                const lvl   = LEVEL_PALETTE[user.level] || LEVEL_PALETTE.Seedling;
                const s     = userStats[user.id];
                const badge = getBadgeTier(user.xp, s?.sessions??0, s?.avgRating??0);
                const isMe  = user.id === currentUser?.id;
                const medals  = ["👑","🥈","🥉"];
                const borders = [`2px solid ${lvl.bg}`,"1.5px solid #e8e2d9","1.5px solid #e8e2d9"];
                const shadows = [`0 8px 32px ${lvl.glow}`,"0 4px 14px rgba(0,0,0,0.06)","0 4px 14px rgba(0,0,0,0.06)"];
                return (
                  <div key={user.id} className="top-card" onClick={() => setSelectedUserId(user.id)}
                    style={{ background:"#fff", borderRadius:20, border:borders[idx], overflow:"hidden", position:"relative", boxShadow:shadows[idx], animation:`fadeUp 0.5s ${idx*0.1}s ease both` }}>
                    <div style={{ position:"absolute", top:12, right:12, fontSize:20, zIndex:2, filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{medals[idx]}</div>
                    <div style={{ height:56, background:`linear-gradient(135deg,${lvl.bg},${lvl.bg}99)`, position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", paddingLeft:16, fontSize:28, opacity:0.1 }}>{lvl.pattern}</div>
                    </div>
                    <div style={{ padding:"0 16px 18px" }}>
                      <div style={{ marginTop:-22, marginBottom:12 }}>
                        <div style={{ width:48, height:48, borderRadius:13, background:lvl.bg, border:"3px solid #fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff", boxShadow:`0 3px 14px ${lvl.glow}`, fontFamily:"'Fraunces',serif" }}>
                          {getInitials(user.full_name)}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
                        <span style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#1a1a1a" }}>{user.full_name}</span>
                        {isMe && <span style={{ fontSize:8, fontWeight:700, background:"#2d6a4f", color:"#fff", padding:"1px 5px", borderRadius:999 }}>YOU</span>}
                        {user.is_verified && <span style={{ fontSize:11 }}>✅</span>}
                      </div>
                      <div style={{ fontSize:11, color:"#aaa", marginBottom:10 }}>@{user.username}</div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:999, background:badge.bg, color:badge.color, fontSize:11, fontWeight:700, marginBottom:12, border:`1px solid ${badge.border}` }}>
                        {badge.emoji} {badge.name}
                      </div>
                      {user.bio && (
                        <p style={{ fontSize:11, color:"#888", lineHeight:1.5, marginBottom:12, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{user.bio}</p>
                      )}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                        {[
                          { label:"XP",       val:user.xp.toLocaleString(),                                         color:lvl.bg   },
                          { label:"Sessions", val:s?.sessions??"-",                                                  color:"#0891b2"},
                          { label:"Rating",   val:s?.avgRating ? `${s.avgRating.toFixed(2)}★` : "—",               color:"#f59e0b"},
                        ].map(st => (
                          <div key={st.label} style={{ background:"#faf8f4", borderRadius:9, padding:"7px 4px", textAlign:"center", border:"1px solid #f0ece4" }}>
                            <div style={{ fontSize:12, fontWeight:900, color:st.color, fontFamily:"'Fraunces',serif" }}>{st.val}</div>
                            <div style={{ fontSize:8, color:"#ccc", textTransform:"uppercase", fontWeight:700 }}>{st.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ALL MEMBERS GRID */}
        {(isFiltering ? filtered : rest).length > 0 && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#bbb", textTransform:"uppercase", letterSpacing:1.5 }}>
                {isFiltering ? "Results" : "All Members"}
              </span>
              <div style={{ flex:1, height:1, background:"#e8e2d9" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
              {(isFiltering ? filtered : rest).map((user, idx) => {
                const lvl   = LEVEL_PALETTE[user.level] || LEVEL_PALETTE.Seedling;
                const s     = userStats[user.id];
                const badge = getBadgeTier(user.xp, s?.sessions??0, s?.avgRating??0);
                const isMe  = user.id === currentUser?.id;
                return (
                  <div key={user.id} className="user-card" onClick={() => setSelectedUserId(user.id)}
                    style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e8e2d9", overflow:"hidden", animation:`fadeUp 0.4s ${(idx%8)*0.04}s ease both` }}
                    onMouseOver={e => { e.currentTarget.style.boxShadow=`0 8px 28px ${lvl.glow}`; e.currentTarget.style.borderColor=lvl.bg+"55"; }}
                    onMouseOut={e =>  { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor="#e8e2d9"; }}>
                    <div style={{ height:3, background:`linear-gradient(90deg,${lvl.bg},${lvl.bg}44)` }} />
                    <div style={{ padding:"14px 14px 12px" }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:lvl.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", flexShrink:0, boxShadow:`0 3px 12px ${lvl.glow}`, fontFamily:"'Fraunces',serif" }}>
                          {getInitials(user.full_name)}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap", marginBottom:1 }}>
                            <span style={{ fontSize:13, fontWeight:800, color:"#1a1a1a", fontFamily:"'Fraunces',serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.full_name}</span>
                            {isMe && <span style={{ fontSize:8, fontWeight:700, background:"#2d6a4f", color:"#fff", padding:"1px 5px", borderRadius:999, flexShrink:0 }}>YOU</span>}
                            {user.is_verified && <span style={{ fontSize:10, flexShrink:0 }}>✅</span>}
                          </div>
                          <div style={{ fontSize:11, color:"#bbb" }}>@{user.username}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:10, color:"#ddd", fontWeight:600 }}>{timeAgo(user.created_at)}</div>
                          <div style={{ fontSize:9, marginTop:3, padding:"2px 7px", borderRadius:999, background:badge.bg, color:badge.color, fontWeight:700, border:`1px solid ${badge.border}`, whiteSpace:"nowrap" }}>
                            {badge.emoji} {badge.name}
                          </div>
                        </div>
                      </div>

                      {user.bio ? (
                        <p style={{ fontSize:12, color:"#666", lineHeight:1.55, marginBottom:9, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{user.bio}</p>
                      ) : (
                        <p style={{ fontSize:12, color:"#ddd", fontStyle:"italic", marginBottom:9 }}>No bio yet</p>
                      )}

                      {user.location && (
                        <div style={{ fontSize:11, color:"#bbb", marginBottom:10 }}>📍 {user.location}</div>
                      )}

                      <div style={{ display:"flex", borderTop:"1.5px solid #f5f0e8", paddingTop:9, gap:0 }}>
                        {[
                          { label:"XP",       val:user.xp.toLocaleString(),                                        color:lvl.bg   },
                          { label:"Sessions", val:s?.sessions??"-",                                                 color:"#0891b2"},
                          { label:"Rating",   val:s?.avgRating ? `${s.avgRating.toFixed(2)}★` : "—",              color:"#f59e0b"},
                        ].map((st, i, arr) => (
                          <div key={st.label} style={{ flex:1, textAlign:"center", borderRight:i<arr.length-1?"1px solid #f0ece4":"none" }}>
                            <div style={{ fontSize:13, fontWeight:900, color:st.color, fontFamily:"'Fraunces',serif" }}>{st.val}</div>
                            <div style={{ fontSize:8, color:"#ccc", fontWeight:700, textTransform:"uppercase" }}>{st.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedUserId && (
        <UserDrawer userId={selectedUserId} currentUserId={currentUser?.id||""} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}