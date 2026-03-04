"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

// ── Types ─────────────────────────────────────────────────────────────────────
type LeaderboardUser = {
  id: string; full_name: string; username: string;
  credits: number; xp: number; level: string;
};
type RatedUser = {
  id: string; full_name: string; username: string;
  level: string; bayesian_avg: number; rating_count: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, { color: string; bg: string; ring: string }> = {
  Legend:      { color:"#d97706", bg:"#fffbeb", ring:"#fde68a" },
  Master:      { color:"#0891b2", bg:"#e0f2fe", ring:"#bae6fd" },
  Expert:      { color:"#dc2626", bg:"#fef2f2", ring:"#fecaca" },
  Skilled:     { color:"#b45309", bg:"#fff8e7", ring:"#fde68a" },
  Contributor: { color:"#7c3aed", bg:"#f0f4ff", ring:"#ddd6fe" },
  Learner:     { color:"#1d4ed8", bg:"#e0f2fe", ring:"#bfdbfe" },
  Seedling:    { color:"#2d6a4f", bg:"#e8f4e8", ring:"#bbf7d0" },
};
const LEVEL_ICONS: Record<string, string> = {
  Seedling:"🌱", Learner:"📘", Contributor:"💡",
  Skilled:"⚡", Expert:"🔥", Master:"🌊", Legend:"👑",
};
const WEEKLY = [
  { rank:1, credits:20 }, { rank:2, credits:10 }, { rank:3, credits:5 },
];
const MOCK: LeaderboardUser[] = [
  { id:"1",  full_name:"Carlo Reyes",          username:"carloreyes",    credits:340, xp:2800, level:"Legend"      },
  { id:"2",  full_name:"Maria Santos",         username:"mariasantos",   credits:290, xp:2100, level:"Master"      },
  { id:"3",  full_name:"Ana Villanueva",       username:"anavillanueva", credits:245, xp:1800, level:"Expert"      },
  { id:"4",  full_name:"Reina Cruz",           username:"reinacruz",     credits:198, xp:1500, level:"Expert"      },
  { id:"5",  full_name:"Kiko Dela Cruz",       username:"kikodelacruz",  credits:175, xp:1200, level:"Skilled"     },
  { id:"6",  full_name:"Lisa Mendoza",         username:"lisamendoza",   credits:150, xp:980,  level:"Skilled"     },
  { id:"7",  full_name:"Sam Ramos",            username:"samramos",      credits:120, xp:750,  level:"Contributor" },
  { id:"8",  full_name:"Bea Aquino",           username:"beaaquino",     credits:95,  xp:520,  level:"Contributor" },
  { id:"9",  full_name:"Juan dela Cruz",       username:"juandc",        credits:60,  xp:310,  level:"Learner"     },
  { id:"10", full_name:"Borja France Adolf P", username:"adolf",         credits:20,  xp:0,    level:"Seedling"    },
];

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}
function initials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize:size, color:i<=Math.round(value)?"#f59e0b":"#e5e7eb", lineHeight:1 }}>★</span>
      ))}
    </span>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function LeaderboardPage() {
  const [tab,        setTab]        = useState<"xp"|"credits"|"rating">("xp");
  const [leaders,    setLeaders]    = useState<LeaderboardUser[]>([]);
  const [ratedUsers, setRatedUsers] = useState<RatedUser[]>([]);
  const [me,         setMe]         = useState<LeaderboardUser | null>(null);
  const [myId,       setMyId]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [rateLoad,   setRateLoad]   = useState(true);

  // ── XP / Credits fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === "rating") return;
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,username,credits,xp,level")
        .order(tab === "credits" ? "credits" : "xp", { ascending: false })
        .limit(20);
      if (error || !data || !data.length) {
        setLeaders(MOCK);
      } else {
        setLeaders(data);
        if (user) { const found = data.find((u: LeaderboardUser) => u.id === user.id); if (found) setMe(found); }
      }
      setLoading(false);
    };
    load();
  }, [tab]);

  // ── Top Rated fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "rating") return;
    const load = async () => {
      setRateLoad(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);

      try {
        // Try Bayesian view first
        const { data: vd, error: ve } = await supabase
          .from("user_rating_stats")
          .select(`rated_id, bayesian_avg, rating_count, profiles:rated_id(full_name,username,level)`)
          .order("bayesian_avg", { ascending: false })
          .gt("rating_count", 0)
          .limit(20);

        if (!ve && vd && vd.length) {
          setRatedUsers((vd as any[]).map(r => ({
            id: r.rated_id,
            full_name:    r.profiles?.full_name  || "Unknown",
            username:     r.profiles?.username   || "unknown",
            level:        r.profiles?.level      || "Seedling",
            bayesian_avg: parseFloat((r.bayesian_avg || 0).toFixed(2)),
            rating_count: r.rating_count,
          })));
        } else {
          // Fallback: compute from raw ratings
          const { data: raw } = await supabase
            .from("ratings")
            .select(`rated_id, overall, profiles:rated_id(full_name,username,level)`);
          if (raw && raw.length) {
            const g: Record<string, { overalls:number[]; p:any }> = {};
            (raw as any[]).forEach(r => {
              if (!g[r.rated_id]) g[r.rated_id] = { overalls: [], p: r.profiles };
              g[r.rated_id].overalls.push(r.overall);
            });
            setRatedUsers(
              Object.entries(g)
                .map(([id, { overalls, p }]) => ({
                  id, full_name: p?.full_name||"Unknown", username: p?.username||"unknown",
                  level: p?.level||"Seedling",
                  bayesian_avg: parseFloat(bayesianAvg(overalls).toFixed(2)),
                  rating_count: overalls.length,
                }))
                .sort((a,b) => b.bayesian_avg - a.bayesian_avg)
                .slice(0,20)
            );
          }
        }
      } catch (e) { console.error("Top rated error:", e); }
      setRateLoad(false);
    };
    load();
  }, [tab]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const sorted      = [...leaders].sort((a,b) => tab==="credits" ? b.credits-a.credits : b.xp-a.xp);
  const myRank      = me ? sorted.findIndex(u => u.id === me.id) + 1 : 0;
  const myRatedRank = myId ? ratedUsers.findIndex(u => u.id === myId) + 1 : 0;
  const myRated     = myId ? ratedUsers.find(u => u.id === myId) || null : null;
  const isRating    = tab === "rating";
  const busy        = isRating ? rateLoad : loading;
  const top3        = isRating ? ratedUsers.slice(0,3) : sorted.slice(0,3);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;color:inherit}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes shimmer {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes glow    {0%,100%{box-shadow:0 4px 24px rgba(45,106,79,.25)}50%{box-shadow:0 8px 40px rgba(45,106,79,.45)}}
        @keyframes starglow{0%,100%{box-shadow:0 4px 24px rgba(245,158,11,.2)}50%{box-shadow:0 8px 40px rgba(245,158,11,.45)}}
        @keyframes skel    {0%,100%{opacity:.5}50%{opacity:1}}
        .tab-btn{border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .14s}
        .row{transition:background .13s;cursor:pointer}
        .row:hover{background:#fafdf8 !important}
        .pod{transition:transform .2s,box-shadow .2s}
        .pod:hover{transform:translateY(-4px) !important}
        .skel{animation:skel 1.5s ease infinite;background:#f0ece4;border-radius:8px}
        .xpbar{background:linear-gradient(90deg,#2d6a4f,#52b788);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{ background:"rgba(255,255,255,.97)", backdropFilter:"blur(16px)", borderBottom:"1.5px solid #e8e2d9", padding:"0 32px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:4 }}>
          {[["Dashboard","/dashboard"],["Browse","/listings"],["Bounties","/bounties"],["Sessions","/sessions"],["Community","/community"]].map(([l,h])=>(
            <a key={l} href={h} style={{ padding:"6px 12px", borderRadius:8, fontSize:13, fontWeight:600, color:"#666", transition:"background .12s" }}
              onMouseOver={e=>{(e.currentTarget as HTMLElement).style.background="#eee9e0"}}
              onMouseOut={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ padding:"6px 14px", borderRadius:10, background:"#f5f0e8", fontSize:13, fontWeight:700, color:"#333" }}>My Profile →</a>
      </nav>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"36px 24px 80px" }}>

        {/* HEADER */}
        <div style={{ textAlign:"center", marginBottom:32, animation:"fadeUp .4s ease" }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#2d6a4f", letterSpacing:".12em", textTransform:"uppercase", marginBottom:8 }}>Community Rankings</div>
          <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:42, fontWeight:900, color:"#1a1a1a", letterSpacing:"-.5px", marginBottom:10 }}>Leaderboard 🏆</h1>
          <p style={{ fontSize:14, color:"#aaa" }}>Top contributors, biggest earners, and highest rated teachers.</p>
        </div>

        {/* WEEKLY BONUSES */}
        <div style={{ display:"flex", gap:12, marginBottom:32, justifyContent:"center", animation:"fadeUp .4s .05s ease both" }}>
          {WEEKLY.map(b => (
            <div key={b.rank} style={{ background:"#fff", borderRadius:16, padding:"16px 28px", textAlign:"center", border:"1.5px solid #e8e2d9", flex:1, maxWidth:160 }}>
              <p style={{ fontSize:28, margin:"0 0 6px" }}>{medal(b.rank)}</p>
              <p style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800, color:"#2d6a4f", margin:"0 0 2px" }}>+{b.credits} cr</p>
              <p style={{ fontSize:11, color:"#bbb", margin:0, fontWeight:600 }}>Weekly bonus</p>
            </div>
          ))}
        </div>

        {/* TAB SWITCHER */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:24, animation:"fadeUp .4s .1s ease both" }}>
          <div style={{ display:"flex", gap:3, background:"#fff", borderRadius:14, padding:4, border:"1.5px solid #e8e2d9", boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
            {([
              { key:"xp",      icon:"⚡", label:"Top XP"       },
              { key:"credits", icon:"💰", label:"Most Credits"  },
              { key:"rating",  icon:"⭐", label:"Top Rated"     },
            ] as const).map(t => (
              <button key={t.key} className="tab-btn" onClick={() => setTab(t.key)}
                style={{ padding:"10px 24px", borderRadius:10,
                         background:tab===t.key ? (t.key==="rating" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "#2d6a4f") : "transparent",
                         color:tab===t.key?"#fff":"#666", fontSize:13, fontWeight:700,
                         boxShadow:tab===t.key?"0 2px 12px rgba(0,0,0,.15)":"none" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* RATING TAB INFO PILL */}
        {isRating && (
          <div style={{ textAlign:"center", marginBottom:20, animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:12, color:"#b45309", fontWeight:700, background:"#fffbeb", padding:"7px 18px", borderRadius:999, border:"1.5px solid #fde68a", display:"inline-flex", alignItems:"center", gap:6 }}>
              ⭐ Bayesian averaging · min 1 review · accounts for review volume
            </span>
          </div>
        )}

        {/* MY RANK BANNER — XP/Credits */}
        {!isRating && myRank > 0 && me && (
          <div style={{ background:"#e8f4e8", borderRadius:14, padding:"14px 22px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1.5px solid #2d6a4f", animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{medal(myRank)}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#2d6a4f" }}>Your rank</div>
                <div style={{ fontSize:12, color:"#555" }}>@{me.username} · {LEVEL_ICONS[me.level]} {me.level}</div>
              </div>
            </div>
            <div style={{ fontFamily:"'Fraunces',serif", fontSize:20, fontWeight:800, color:"#2d6a4f" }}>
              {tab==="xp" ? `${me.xp} XP` : `${me.credits} cr`}
            </div>
          </div>
        )}

        {/* MY RANK BANNER — Rating */}
        {isRating && myRated && myRatedRank > 0 && (
          <div style={{ background:"#fffbeb", borderRadius:14, padding:"14px 22px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", border:"1.5px solid #fde68a", animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{medal(myRatedRank)}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#b45309" }}>Your rating rank</div>
                <div style={{ fontSize:12, color:"#666" }}>@{myRated.username} · {myRated.rating_count} review{myRated.rating_count!==1?"s":""}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, color:"#b45309" }}>{myRated.bayesian_avg.toFixed(2)}</div>
              <Stars value={myRated.bayesian_avg} size={13} />
            </div>
          </div>
        )}

        {/* NOT RANKED YET — Rating */}
        {isRating && !myRated && !rateLoad && (
          <div style={{ background:"#f5f0e8", borderRadius:14, padding:"14px 22px", marginBottom:20, display:"flex", alignItems:"center", gap:12, border:"1.5px dashed #d4cfc6", animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:20 }}>⭐</span>
            <span style={{ fontSize:13, color:"#888" }}><b style={{ color:"#555" }}>You're not ranked yet.</b> Complete sessions and earn reviews to appear here!</span>
            <a href="/listings" style={{ marginLeft:"auto", fontSize:12, fontWeight:700, color:"#2d6a4f", background:"#e8f4e8", padding:"6px 14px", borderRadius:999, border:"1px solid #bbf7d0", whiteSpace:"nowrap" }}>Browse Skills →</a>
          </div>
        )}

        {/* ── PODIUM TOP 3 ──────────────────────────────────────────────────── */}
        {!busy && top3.length >= 3 && (() => {
          const podiumData = [
            { user: top3[1], pos: 2, medal: "🥈", scale: 1,    extra: {} },
            { user: top3[0], pos: 1, medal: "🥇", scale: 1.04, extra: { background: isRating ? "linear-gradient(135deg,#b45309,#92400e)" : "linear-gradient(135deg,#2d6a4f,#1b4332)", color: "#fff" } },
            { user: top3[2], pos: 3, medal: "🥉", scale: 1,    extra: {} },
          ];
          return (
            <div style={{ display:"flex", gap:12, marginBottom:20, alignItems:"flex-end", animation:"fadeUp .4s .15s ease both" }}>
              {podiumData.map(({ user, pos, medal: m, scale, extra }) => {
                const lc = LEVEL_COLORS[(user as any).level || "Seedling"] || LEVEL_COLORS.Seedling;
                const isDark = !!extra.color;
                return (
                  <a key={(user as any).id || pos} href={`/profile/${(user as any).username}`}
                    className="pod"
                    style={{ flex:1, borderRadius:20, padding: pos===1?"32px 14px 24px":"24px 14px 20px", textAlign:"center",
                             border:`1.5px solid ${isDark?"transparent":lc.ring}`,
                             transform:`scale(${scale})`,
                             boxShadow: pos===1 ? (isRating ? "0 8px 32px rgba(180,83,9,.3)" : "0 8px 32px rgba(45,106,79,.3)") : "0 2px 8px rgba(0,0,0,.04)",
                             ...(isDark ? extra : { background:"#fff" }) }}>
                    <div style={{ fontSize: pos===1?38:32, marginBottom:10 }}>{m}</div>
                    {/* Avatar */}
                    <div style={{ width:pos===1?56:48, height:pos===1?56:48, borderRadius:"50%",
                                  background: isDark ? "rgba(255,255,255,.2)" : lc.bg,
                                  border: `2px solid ${isDark?"rgba(255,255,255,.3)":lc.ring}`,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  fontSize:pos===1?22:18, fontWeight:800,
                                  color: isDark?"#fff":lc.color, margin:"0 auto 10px" }}>
                      {initials((user as any).full_name)}
                    </div>
                    {/* Name */}
                    <div style={{ fontSize:pos===1?14:13, fontWeight:800, color:isDark?"#fff":"#333", marginBottom:2 }}>
                      {(user as any).full_name.split(" ")[0]}
                    </div>
                    <div style={{ fontSize:11, color:isDark?"rgba(255,255,255,.6)":"#bbb", marginBottom:10 }}>
                      @{(user as any).username}
                    </div>
                    {/* Score */}
                    {isRating ? (
                      <>
                        <div style={{ fontFamily:"'Fraunces',serif", fontSize:pos===1?26:20, fontWeight:900, color:isDark?"#fff":pos===2?"#94a3b8":"#b45309", lineHeight:1 }}>
                          {(user as RatedUser).bayesian_avg.toFixed(2)}
                        </div>
                        <div style={{ marginTop:5 }}><Stars value={(user as RatedUser).bayesian_avg} size={pos===1?15:12} /></div>
                        <div style={{ fontSize:10, color:isDark?"rgba(255,255,255,.5)":"#bbb", marginTop:3 }}>
                          {(user as RatedUser).rating_count} reviews
                        </div>
                      </>
                    ) : (
                      <div style={{ fontFamily:"'Fraunces',serif", fontSize:pos===1?26:20, fontWeight:900, color:isDark?"#fff":pos===2?"#94a3b8":"#b45309" }}>
                        {tab==="xp" ? `${(user as LeaderboardUser).xp} XP` : `${(user as LeaderboardUser).credits} cr`}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          );
        })()}

        {/* ── FULL LIST ─────────────────────────────────────────────────────── */}
        <div style={{ background:"#fff", borderRadius:20, border:"1.5px solid #e8e2d9", overflow:"hidden", animation:"fadeUp .4s .2s ease both" }}>

          {/* List header */}
          <div style={{ padding:"14px 24px", borderBottom:"1px solid #f5f0e8", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:".06em" }}>
              {isRating ? "Ranked by Bayesian Average Rating" : tab==="xp" ? "Ranked by Total XP Earned" : "Ranked by Credits Held"}
            </span>
            {isRating && (
              <span style={{ fontSize:10, color:"#ccc", fontWeight:600 }}>C=5 · m=3.5</span>
            )}
          </div>

          {busy ? (
            /* Skeleton */
            <div>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 24px", borderBottom:"1px solid #f5f0e8" }}>
                  <div className="skel" style={{ width:36, height:18, flexShrink:0 }} />
                  <div className="skel" style={{ width:42, height:42, borderRadius:"50%", flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div className="skel" style={{ height:13, width:"40%", marginBottom:6 }} />
                    <div className="skel" style={{ height:10, width:"28%" }} />
                  </div>
                  <div className="skel" style={{ width:64, height:20 }} />
                </div>
              ))}
            </div>
          ) : isRating ? (
            /* ── Rating rows ── */
            ratedUsers.length === 0 ? (
              <div style={{ textAlign:"center", padding:"64px 0" }}>
                <div style={{ fontSize:44, marginBottom:12 }}>⭐</div>
                <p style={{ fontSize:14, color:"#bbb", marginBottom:20 }}>No rated teachers yet — complete sessions to appear!</p>
                <a href="/listings" style={{ display:"inline-block", padding:"11px 28px", background:"#2d6a4f", color:"#fff", borderRadius:12, fontWeight:700, fontSize:13 }}>Browse Skills →</a>
              </div>
            ) : ratedUsers.map((user, i) => {
              const lc   = LEVEL_COLORS[user.level] || LEVEL_COLORS.Seedling;
              const isMe = user.id === myId;
              return (
                <a key={user.id} href={`/profile/${user.username}`}
                  className="row"
                  style={{ display:"flex", alignItems:"center", padding:"15px 24px", background:isMe?"#fffbeb":"#fff", borderBottom:i<ratedUsers.length-1?"1px solid #f5f0e8":"none" }}>
                  {/* Rank */}
                  <div style={{ width:46, textAlign:"center", flexShrink:0 }}>
                    <span style={{ fontSize:i<3?22:13, fontWeight:700, color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span>
                  </div>
                  {/* Avatar */}
                  <div style={{ width:44, height:44, borderRadius:"50%", background:lc.bg, border:`2px solid ${lc.ring}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:lc.color, flexShrink:0, marginRight:14 }}>
                    {initials(user.full_name)}
                  </div>
                  {/* Name + level */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#1a1a1a", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {user.full_name}
                      </span>
                      {isMe && <span style={{ fontSize:9, background:"#2d6a4f", color:"#fff", padding:"2px 7px", borderRadius:999, fontWeight:800, flexShrink:0 }}>YOU</span>}
                      {i===0 && <span style={{ fontSize:9, background:"#fffbeb", color:"#b45309", padding:"2px 7px", borderRadius:999, fontWeight:800, border:"1px solid #fde68a", flexShrink:0 }}>TOP RATED ⭐</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:3 }}>
                      <span style={{ fontSize:11, color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10, background:lc.bg, color:lc.color, padding:"1px 7px", borderRadius:999, fontWeight:700 }}>
                        {LEVEL_ICONS[user.level]} {user.level}
                      </span>
                    </div>
                  </div>
                  {/* Score */}
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, color:i===0?"#b45309":i===1?"#94a3b8":i===2?"#92400e":"#555", lineHeight:1, marginBottom:3 }}>
                      {user.bayesian_avg.toFixed(2)}
                    </div>
                    <Stars value={user.bayesian_avg} size={12} />
                    <div style={{ fontSize:10, color:"#bbb", fontWeight:600, marginTop:2 }}>
                      {user.rating_count} review{user.rating_count!==1?"s":""}
                    </div>
                  </div>
                </a>
              );
            })
          ) : (
            /* ── XP / Credits rows ── */
            sorted.map((user, i) => {
              const lc   = LEVEL_COLORS[user.level] || LEVEL_COLORS.Seedling;
              const isMe = me?.id === user.id;
              return (
                <div key={user.id} className="row"
                  style={{ display:"flex", alignItems:"center", padding:"15px 24px", background:isMe?"#f0fdf4":"#fff", borderBottom:i<sorted.length-1?"1px solid #f5f0e8":"none" }}>
                  {/* Rank */}
                  <div style={{ width:46, textAlign:"center", flexShrink:0 }}>
                    <span style={{ fontSize:i<3?22:13, fontWeight:700, color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span>
                  </div>
                  {/* Avatar */}
                  <div style={{ width:44, height:44, borderRadius:"50%", background:lc.bg, border:`2px solid ${lc.ring}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:lc.color, flexShrink:0, marginRight:14 }}>
                    {initials(user.full_name)}
                  </div>
                  {/* Name + level */}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#1a1a1a" }}>{user.full_name}</span>
                      {isMe && <span style={{ fontSize:9, background:"#2d6a4f", color:"#fff", padding:"2px 7px", borderRadius:999, fontWeight:800 }}>YOU</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:3 }}>
                      <span style={{ fontSize:11, color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10, background:lc.bg, color:lc.color, padding:"1px 7px", borderRadius:999, fontWeight:700 }}>
                        {LEVEL_ICONS[user.level]} {user.level}
                      </span>
                    </div>
                  </div>
                  {/* Score */}
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:800, color:"#2d6a4f", lineHeight:1 }}>
                      {tab==="xp" ? user.xp : user.credits}
                    </div>
                    <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{tab==="xp" ? "XP" : "credits"}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer formula note */}
        {isRating && !rateLoad && ratedUsers.length > 0 && (
          <p style={{ textAlign:"center", fontSize:11, color:"#ccc", fontWeight:600, marginTop:16 }}>
            Formula: (C × m + Σ ratings) ÷ (C + n) · C=5, m=3.5 (global mean)
          </p>
        )}
      </div>
    </div>
  );
}