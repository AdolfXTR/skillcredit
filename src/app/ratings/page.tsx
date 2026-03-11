"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Profile = {
  id: string; full_name: string; username: string; credits: number; xp: number;
  avatar_url?: string | null; champion_title?: string | null; xp_multiplier?: number;
};
type CompletedSession = {
  id: string; teacher_id: string; learner_id: string;
  credit_amount: number; proposed_time: string;
  listing: { title: string };
  teacher: { id: string; full_name: string; username: string };
  learner: { id: string; full_name: string; username: string };
};
type Rating = {
  id: string; session_id: string; rater_id: string; rated_id: string;
  knowledge: number | null; communication: number | null;
  punctuality: number | null; preparedness: number | null;
  respectfulness: number | null; overall: number;
  review: string | null; created_at: string;
  rater: { id: string; full_name: string; username: string; avatar_url?: string | null };
  rated: { id: string; full_name: string; username: string; avatar_url?: string | null };
  role_rated: "teacher" | "learner";
};

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const BADGE_TIERS = [
  { name:"Seedling", emoji:"🌱", color:"#2d6a4f", xpReq:0,    sessionsReq:0  },
  { name:"Rising",   emoji:"⭐", color:"#b45309", xpReq:100,  sessionsReq:0  },
  { name:"Pro",      emoji:"🔥", color:"#7c3aed", xpReq:500,  sessionsReq:5  },
  { name:"Elite",    emoji:"💎", color:"#dc2626", xpReq:2000, sessionsReq:20 },
  { name:"Legend",   emoji:"👑", color:"#d97706", xpReq:5000, sessionsReq:50 },
];
const LEVEL_COLORS: Record<string, string> = {
  Seedling:"#2d6a4f", Learner:"#1d4ed8", Contributor:"#7c3aed",
  Skilled:"#b45309", Expert:"#dc2626", Master:"#0891b2", Legend:"#d97706",
};
function getLevelFromXP(xp: number) {
  if (xp>=4000) return "Legend"; if (xp>=2000) return "Master"; if (xp>=1000) return "Expert";
  if (xp>=600)  return "Skilled"; if (xp>=300) return "Contributor"; if (xp>=100) return "Learner";
  return "Seedling";
}
function getBadgeTier(xp: number, sessions = 0) {
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const t = BADGE_TIERS[i];
    if (xp >= t.xpReq && sessions >= t.sessionsReq) return t;
  }
  return BADGE_TIERS[0];
}

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function bayesianAvg(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const C = 5, m = 3.5;
  return (C * m + ratings.reduce((s, r) => s + r, 0)) / (C + ratings.length);
}
function initials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function formatRating(val: number) {
  return Number.isInteger(val) ? `${val}.0` : val.toFixed(1);
}

// ─────────────────────────────────────────────────────────────
// STAR COMPONENTS
// ─────────────────────────────────────────────────────────────
function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div style={{ display:"flex", gap:2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} style={{ fontSize:13, color: i < Math.round(value) ? "#f59e0b" : "#e2d9cc" }}>★</span>
      ))}
    </div>
  );
}
function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:6 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(0)}
          style={{ fontSize:30, cursor:"pointer", userSelect:"none", color: i < (hover || value) ? "#f59e0b" : "#e2d9cc", transition:"color .1s" }}>★</span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function RatingsPage() {
  const [user,         setUser]         = useState<Profile | null>(null);
  const [ratings,      setRatings]      = useState<Rating[]>([]);
  const [sessions,     setSessions]     = useState<CompletedSession[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<"all"|"teacher"|"learner">("all");
  const [showModal,    setShowModal]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [alreadyRated, setAlreadyRated] = useState<string[]>([]);
  const [submitError,  setSubmitError]  = useState("");
  const [showMenu,     setShowMenu]     = useState(false);
  const [unread,       setUnread]       = useState(0);

  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [roleRated,       setRoleRated]       = useState<"teacher"|"learner">("teacher");
  const [form, setForm] = useState({ knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, overall:0, review:"" });

  const loadData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { window.location.href = "/login"; return; }

    const { data: profile } = await supabase.from("profiles")
      .select("id, full_name, username, credits, xp, avatar_url, champion_title, xp_multiplier")
      .eq("id", u.id).single();
    setUser(profile);

    const { count: nCount } = await supabase.from("notifications")
      .select("*", { count:"exact", head:true }).eq("user_id", u.id).eq("is_read", false);
    setUnread(nCount || 0);

    const { data: ratingsData } = await supabase.from("ratings").select(`
      id, session_id, rater_id, rated_id,
      knowledge, communication, punctuality, preparedness, respectfulness,
      overall, review, created_at, role_rated,
      rater:rater_id ( id, full_name, username, avatar_url ),
      rated:rated_id ( id, full_name, username, avatar_url )
    `).order("created_at", { ascending: false });
    if (ratingsData) setRatings(ratingsData as unknown as Rating[]);

    const { data: sessionData } = await supabase.from("sessions").select(`
      id, teacher_id, learner_id, credit_amount, proposed_time,
      listing:listing_id ( title ),
      teacher:teacher_id ( id, full_name, username ),
      learner:learner_id ( id, full_name, username )
    `).or(`teacher_id.eq.${u.id},learner_id.eq.${u.id}`).eq("status", "completed");
    if (sessionData) setSessions(sessionData as unknown as CompletedSession[]);

    const { data: myRatings } = await supabase.from("ratings").select("session_id").eq("rater_id", u.id);
    if (myRatings) setAlreadyRated(myRatings.map(r => r.session_id).filter(Boolean));

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSelectSession = (session: CompletedSession) => {
    setSelectedSession(session);
    setRoleRated(session.learner_id === user?.id ? "teacher" : "learner");
    setForm({ knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, overall:0, review:"" });
    setSubmitError("");
  };

  const handleSubmit = async () => {
    if (!user || !selectedSession || form.overall === 0) return;
    setSubmitting(true); setSubmitError("");
    const ratedId = roleRated === "teacher" ? selectedSession.teacher_id : selectedSession.learner_id;
    const payload = {
      session_id: selectedSession.id, rater_id: user.id, rated_id: ratedId,
      role_rated: roleRated, overall: form.overall,
      communication: form.communication || null, is_revealed: true, is_flagged: false,
      ...(roleRated === "learner"
        ? { preparedness: form.preparedness||null, respectfulness: form.respectfulness||null, knowledge:null, punctuality:null }
        : { knowledge: form.knowledge||null, punctuality: form.punctuality||null, preparedness:null, respectfulness:null }),
      review: form.review || null,
    };
    const { error } = await supabase.from("ratings").insert(payload);
    if (error) { setSubmitError(`Failed: ${error.message}`); setSubmitting(false); return; }
    setSubmitted(true);
    setAlreadyRated(prev => [...prev, selectedSession.id]);
    await loadData();
    setTimeout(() => {
      setShowModal(false); setSubmitted(false); setSelectedSession(null);
      setForm({ knowledge:0, communication:0, punctuality:0, preparedness:0, respectfulness:0, overall:0, review:"" });
    }, 2000);
    setSubmitting(false);
  };

  const filtered          = ratings.filter(r => tab === "all" ? true : r.role_rated === tab);
  const myReceivedRatings = ratings.filter(r => r.rated_id === user?.id);
  const avgRating         = myReceivedRatings.length > 0 ? bayesianAvg(myReceivedRatings.map(r => r.overall)).toFixed(2) : "—";
  const unratedSessions   = sessions.filter(s => !alreadyRated.includes(s.id));

  // Navbar derived — matches dashboard exactly
  const avatarUrl       = user?.avatar_url || null;
  const userInitials    = user ? initials(user.full_name) : "??";
  const levelColor      = user ? (LEVEL_COLORS[getLevelFromXP(user.xp||0)] || "#2d6a4f") : "#2d6a4f";
  const badge           = user ? getBadgeTier(user.xp||0) : BADGE_TIERS[0];
  const rankFromTitle   = user?.champion_title?.includes("Champion")?1:user?.champion_title?.includes("Runner")?2:user?.champion_title?.includes("Third")?3:0;
  const rankBorderColor = rankFromTitle===1?"#e8a800":rankFromTitle===2?"#c0c0c0":rankFromTitle===3?"#cd7f32":null;
  const handleLogout    = async () => { await supabase.auth.signOut(); window.location.href="/"; };

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f4", fontFamily:"'DM Sans',sans-serif" }} onClick={() => setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes goldSpin   {0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 18px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.8)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 14px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e0e0e0,0 0 22px rgba(200,200,200,.6)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 22px rgba(232,160,80,.5)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp .35s ease both}
        .modal-anim{animation:slideUp .22s ease}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:all .12s;text-decoration:none;display:inline-block}
        .nav-a:hover{background:#eee9e0;color:#1a1a1a}
        .menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;transition:all .12s;cursor:pointer;text-decoration:none}
        .menu-item:hover{background:#f5f0e8;color:#1a1a1a}
        .gold-avatar{animation:goldSpin 2s ease infinite}
        .silver-avatar{animation:silverPulse 2s ease infinite}
        .bronze-avatar{animation:bronzePulse 2s ease infinite}
        .rating-card{transition:box-shadow .15s,transform .15s}
        .rating-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
        @media(max-width:600px){.nav-links{display:none!important}}
      `}</style>

      {/* ── MODAL ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div className="modal-anim" style={{ background:"#fff", borderRadius:24, padding:28, width:"100%", maxWidth:520, boxShadow:"0 24px 64px rgba(0,0,0,.18)", maxHeight:"90vh", overflowY:"auto" }}>
            {submitted ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:48, marginBottom:16 }}>🌟</div>
                <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#1a1a1a", marginBottom:8 }}>Review Submitted!</h2>
                <p style={{ fontSize:13, color:"#aaa" }}>Thank you for your feedback.</p>
              </div>
            ) : (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                  <div>
                    <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a", marginBottom:4 }}>Rate a Session</h2>
                    <p style={{ fontSize:12, color:"#aaa" }}>Your honest review helps the community grow</p>
                  </div>
                  <button onClick={() => { setShowModal(false); setSelectedSession(null); }}
                    style={{ width:32, height:32, borderRadius:"50%", background:"#f5f0e8", border:"none", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#888" }}>✕</button>
                </div>

                <div style={{ marginBottom:20 }}>
                  <p style={{ fontSize:10, fontWeight:800, color:"#aaa", letterSpacing:".08em", textTransform:"uppercase" as const, marginBottom:8 }}>Select Session</p>
                  {unratedSessions.length === 0 ? (
                    <div style={{ background:"#fafaf8", borderRadius:12, border:"1.5px solid #e8e2d9", padding:16, textAlign:"center" }}>
                      <p style={{ fontSize:13, color:"#aaa" }}>{sessions.length === 0 ? "No completed sessions yet." : "You've rated all your sessions! 🎉"}</p>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:176, overflowY:"auto" }}>
                      {unratedSessions.map(session => {
                        const isSelected = selectedSession?.id === session.id;
                        const isLearner  = session.learner_id === user?.id;
                        const other      = isLearner ? session.teacher : session.learner;
                        return (
                          <button key={session.id} onClick={() => handleSelectSession(session)}
                            style={{ textAlign:"left", padding:"10px 14px", borderRadius:12, border:`1.5px solid ${isSelected?"#86efac":"#e8e2d9"}`, background:isSelected?"#f0fdf4":"#fafaf8", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .12s" }}>
                            <p style={{ fontSize:13, fontWeight:700, color:isSelected?"#15803d":"#333" }}>{session.listing?.title || "Session"}</p>
                            <p style={{ fontSize:11, color:"#aaa", marginTop:2 }}>
                              {isLearner ? "Rating teacher:" : "Rating learner:"} {other?.full_name} · {new Date(session.proposed_time).toLocaleDateString()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedSession && (
                  <>
                    <div style={{ borderRadius:12, border:`1.5px solid ${roleRated==="teacher"?"#86efac":"#93c5fd"}`, background:roleRated==="teacher"?"#f0fdf4":"#eff6ff", padding:"10px 14px", marginBottom:20 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:roleRated==="teacher"?"#15803d":"#1d4ed8" }}>
                        {roleRated==="teacher" ? "You are rating the Teacher:" : "You are rating the Learner:"}
                      </p>
                      <p style={{ fontSize:13, fontWeight:800, marginTop:2, color:roleRated==="teacher"?"#14532d":"#1e3a8a" }}>
                        {roleRated==="teacher" ? selectedSession.teacher?.full_name : selectedSession.learner?.full_name}
                      </p>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:20, marginBottom:20 }}>
                      {(roleRated === "teacher"
                        ? [{ key:"knowledge", label:"Knowledge & Expertise" }, { key:"communication", label:"Communication" }, { key:"punctuality", label:"Punctuality" }, { key:"overall", label:"Overall Rating" }]
                        : [{ key:"overall", label:"Overall Rating" }, { key:"preparedness", label:"Preparedness" }, { key:"respectfulness", label:"Respectfulness" }, { key:"communication", label:"Communication" }]
                      ).map(c => (
                        <div key={c.key}>
                          <p style={{ fontSize:13, fontWeight:700, color:"#444", marginBottom:8 }}>{c.label}</p>
                          <InteractiveStars value={form[c.key as keyof typeof form] as number} onChange={v => setForm(p => ({ ...p, [c.key]: v }))} />
                          {(form[c.key as keyof typeof form] as number) > 0 && (
                            <p style={{ fontSize:11, color:"#f59e0b", fontWeight:700, marginTop:4 }}>{["","Poor","Fair","Good","Great","Excellent!"][form[c.key as keyof typeof form] as number]}</p>
                          )}
                        </div>
                      ))}
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color:"#444", marginBottom:8 }}>Written Review <span style={{ color:"#ccc", fontWeight:400 }}>(optional)</span></p>
                        <textarea value={form.review}
                          onChange={e => setForm(p => ({ ...p, review: e.target.value.slice(0,300) }))}
                          placeholder="Share your experience…" rows={3}
                          style={{ width:"100%", padding:"10px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:13, background:"#fafaf8", resize:"none", outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
                        <p style={{ fontSize:11, color:"#ccc", textAlign:"right", marginTop:4 }}>{form.review.length}/300</p>
                      </div>
                    </div>
                  </>
                )}

                {submitError && (
                  <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#dc2626", fontWeight:600 }}>⚠️ {submitError}</div>
                )}

                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => { setShowModal(false); setSelectedSession(null); }}
                    style={{ flex:1, padding:"11px 0", background:"#f5f0e8", color:"#555", borderRadius:12, fontSize:13, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={submitting || !selectedSession || form.overall === 0}
                    style={{ flex:2, padding:"11px 0", borderRadius:12, fontSize:13, fontWeight:800, border:"none", fontFamily:"'DM Sans',sans-serif", background:!selectedSession||form.overall===0?"#e5e7eb":"#2d6a4f", color:!selectedSession||form.overall===0?"#9ca3af":"#fff", cursor:!selectedSession||form.overall===0?"not-allowed":"pointer" }}>
                    {submitting ? "Submitting…" : "Submit Review ★"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── NAVBAR — matches dashboard exactly ── */}
      <nav style={{ background:"rgba(255,255,255,.96)", backdropFilter:"blur(16px)", borderBottom:"1px solid #e8e2d9", padding:"0 32px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div className="nav-links" style={{ display:"flex", gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h]) => (
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        {user ? (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <a href="/wallet" style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:999, background:"linear-gradient(135deg,#f0fdf4,#dcfce7)", border:"1.5px solid #86efac", fontSize:13, fontWeight:800, color:"#2d6a4f" }}>
              💰 {user.credits} cr
            </a>
            <a href="/notifications" style={{ position:"relative", width:36, height:36, borderRadius:"50%", background:"#f5f0e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
              🔔
              {unread > 0 && (
                <span style={{ position:"absolute", top:-2, right:-2, minWidth:16, height:16, borderRadius:"50%", background:"#ef4444", color:"#fff", fontSize:9, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px", border:"2px solid white" }}>
                  {unread}
                </span>
              )}
            </a>
            <div style={{ position:"relative" }} onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}>
              <div className={rankFromTitle===1?"gold-avatar":rankFromTitle===2?"silver-avatar":rankFromTitle===3?"bronze-avatar":""}
                style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", cursor:"pointer", background:avatarUrl?"transparent":levelColor, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:rankBorderColor?undefined:`0 0 0 2px white, 0 0 0 3.5px ${levelColor}` }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ color:"#fff", fontSize:12, fontWeight:900 }}>{userInitials}</span>
                }
              </div>
              {showMenu && (
                <div style={{ position:"absolute", right:0, top:44, background:"#fff", border:"1.5px solid #e8e2d9", borderRadius:18, padding:8, width:210, boxShadow:"0 16px 48px rgba(0,0,0,.15)", zIndex:200 }}>
                  <div style={{ padding:"10px 12px 12px", borderBottom:"1px solid #f0ece4", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:avatarUrl?"transparent":levelColor, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {avatarUrl
                          ? <img src={avatarUrl} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>{userInitials}</span>
                        }
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:"#1a1a1a" }}>{user.full_name}</div>
                        <div style={{ fontSize:11, color:"#aaa" }}>@{user.username} · <span style={{ color:badge.color, fontWeight:700 }}>{badge.emoji} {badge.name}</span></div>
                      </div>
                    </div>
                  </div>
                  {[["👤","My Profile","/profile"],["👥","People","/people"],["📋","Create Listing","/listings/create"],["✅","Get Verified","/verify"],["⭐","My Ratings","/ratings"],["💰","Wallet","/wallet"],["🏆","Leaderboard","/leaderboard"],["🔔","Notifications","/notifications"]].map(([icon,label,href]) => (
                    <a key={label} href={href} className="menu-item">{icon} {label}</a>
                  ))}
                  <div style={{ borderTop:"1px solid #f0ece4", marginTop:6, paddingTop:6 }}>
                    <button onClick={handleLogout} className="menu-item" style={{ width:"100%", background:"none", border:"none", color:"#ef4444", fontFamily:"'DM Sans',sans-serif" }}>
                      🚪 Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <a href="/login" style={{ padding:"7px 14px", borderRadius:8, color:"#555", fontSize:13, fontWeight:600 }}>Log in</a>
            <a href="/signup" style={{ padding:"8px 18px", borderRadius:10, background:"#2d6a4f", color:"#fff", fontSize:13, fontWeight:700 }}>Sign up free</a>
          </div>
        )}
      </nav>

      {/* ── BODY ── */}
      <div style={{ maxWidth:896, margin:"0 auto", padding:"32px 24px" }}>

        {/* Header */}
        <div className="fade-up" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginBottom:32 }}>
          <div>
            <p style={{ fontSize:10, fontWeight:800, color:"#2d6a4f", letterSpacing:".1em", textTransform:"uppercase" as const, marginBottom:8 }}>Community</p>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:36, fontWeight:900, color:"#1a1a1a", lineHeight:1, marginBottom:8 }}>Ratings & Reviews</h1>
            <p style={{ fontSize:13, color:"#aaa" }}>What the community says about teachers and learners</p>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:20, padding:"12px 20px", textAlign:"center" }}>
              <p style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#f59e0b", lineHeight:1, marginBottom:4 }}>{avgRating}{avgRating !== "—" ? "★" : ""}</p>
              <p style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>My Avg Rating</p>
              {myReceivedRatings.length > 0 && <p style={{ fontSize:10, color:"#ccc", marginTop:2 }}>{myReceivedRatings.length} review{myReceivedRatings.length !== 1 ? "s" : ""}</p>}
            </div>
            <div style={{ background:"#f0fdf4", border:"1.5px solid #86efac", borderRadius:20, padding:"12px 20px", textAlign:"center" }}>
              <p style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, color:"#2d6a4f", lineHeight:1, marginBottom:4 }}>{ratings.length}</p>
              <p style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>Total Reviews</p>
            </div>
            <button onClick={() => setShowModal(true)}
              style={{ padding:"12px 20px", background:"#f59e0b", color:"#fff", borderRadius:16, fontSize:13, fontWeight:800, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              ★ Write a Review
            </button>
          </div>
        </div>

        {/* Unrated sessions banner */}
        {unratedSessions.length > 0 && (
          <div className="fade-up" style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:20, padding:16, marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"#fef3c7", display:"flex", alignItems:"center", justifyContent:"center", color:"#b45309", fontWeight:800, fontSize:13 }}>{unratedSessions.length}</div>
              <div>
                <p style={{ fontSize:13, fontWeight:800, color:"#92400e" }}>{unratedSessions.length} unrated session{unratedSessions.length > 1 ? "s" : ""} waiting</p>
                <p style={{ fontSize:11, color:"#b45309", marginTop:2 }}>Share your experience and help the community.</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              style={{ padding:"8px 18px", background:"#f59e0b", color:"#fff", borderRadius:12, fontSize:12, fontWeight:800, border:"none", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
              Rate Now →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", background:"#f5f0e8", padding:4, borderRadius:12, gap:2, width:"fit-content", marginBottom:24 }}>
          {[{ key:"all", label:"All Reviews" }, { key:"teacher", label:"Teachers" }, { key:"learner", label:"Learners" }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              style={{ padding:"6px 16px", borderRadius:9, fontSize:12, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all .12s", background:tab===t.key?"#fff":"transparent", color:tab===t.key?"#1a1a1a":"#aaa", boxShadow:tab===t.key?"0 1px 4px rgba(0,0,0,.08)":"none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Ratings list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"64px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>⭐</div>
            <p style={{ fontSize:13, color:"#aaa" }}>Loading reviews…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"64px 20px", background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⭐</div>
            <p style={{ fontSize:13, color:"#aaa", marginBottom:20 }}>No reviews yet in this category</p>
            <button onClick={() => setShowModal(true)}
              style={{ padding:"10px 24px", background:"#f59e0b", color:"#fff", borderRadius:12, fontSize:13, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
              Write the first review!
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {filtered.map(rating => (
              <div key={rating.id} className="rating-card"
                style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", padding:20, borderLeft:`3px solid ${rating.role_rated==="teacher"?"#22c55e":"#3b82f6"}` }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", overflow:"hidden", flexShrink:0, background:"#e8f4e8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {rating.rater?.avatar_url
                        ? <img src={rating.rater.avatar_url} alt={rating.rater.full_name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f" }}>{initials(rating.rater?.full_name||"")}</span>
                      }
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:"#1a1a1a" }}>{rating.rater?.full_name}</p>
                      <p style={{ fontSize:11, color:"#aaa" }}>
                        @{rating.rater?.username} rated <span style={{ fontWeight:700, color:"#555" }}>@{rating.rated?.username}</span>
                      </p>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:999, background:rating.role_rated==="teacher"?"#f0fdf4":"#eff6ff", color:rating.role_rated==="teacher"?"#15803d":"#1d4ed8", border:`1px solid ${rating.role_rated==="teacher"?"#86efac":"#93c5fd"}` }}>
                      {rating.role_rated==="teacher" ? "🎓 Teacher Review" : "📚 Learner Review"}
                    </span>
                    <span style={{ fontSize:11, color:"#ccc" }}>{new Date(rating.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display:"flex", flexWrap:"wrap", gap:20, marginBottom:rating.review?16:0 }}>
                  {rating.role_rated === "teacher" ? (
                    <>
                      {rating.knowledge     != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Knowledge</p><Stars value={rating.knowledge} /></div>}
                      {rating.communication != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Communication</p><Stars value={rating.communication} /></div>}
                      {rating.punctuality   != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Punctuality</p><Stars value={rating.punctuality} /></div>}
                    </>
                  ) : (
                    <>
                      {rating.preparedness   != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Preparedness</p><Stars value={rating.preparedness} /></div>}
                      {rating.respectfulness != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Respectfulness</p><Stars value={rating.respectfulness} /></div>}
                      {rating.communication  != null && <div><p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Communication</p><Stars value={rating.communication} /></div>}
                    </>
                  )}
                  <div>
                    <p style={{ fontSize:10, fontWeight:700, color:"#aaa", textTransform:"uppercase" as const, letterSpacing:".06em", marginBottom:4 }}>Overall</p>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Stars value={rating.overall} />
                      <span style={{ fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, color:"#f59e0b" }}>{formatRating(rating.overall)}</span>
                    </div>
                  </div>
                </div>

                {rating.review && (
                  <div style={{ background:"#fafaf8", borderRadius:12, borderLeft:"3px solid #fcd34d", padding:"10px 16px" }}>
                    <p style={{ fontSize:13, color:"#555", fontStyle:"italic", lineHeight:1.6 }}>"{rating.review}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}