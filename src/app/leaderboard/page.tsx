"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

type LeaderboardUser = {
  id: string; full_name: string; username: string;
  credits: number; xp: number; level: string;
  avatar_url?: string | null;
  xp_multiplier?: number; multiplier_ends_at?: string | null;
  champion_title?: string | null; champion_streak?: number;
};
type RatedUser = {
  id: string; full_name: string; username: string;
  level: string; bayesian_avg: number; rating_count: number;
  avatar_url?: string | null;
  champion_title?: string | null;
};
type PrevChamp = { full_name: string; xp_earned: number };

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
  { rank:1, credits:20, bonus:"👑 Crown · 📌 Featured · 1.25x XP" },
  { rank:2, credits:10, bonus:"🥈 Badge · 1.15x XP · 🔥 Hot Tag"  },
  { rank:3, credits:5,  bonus:"🥉 Badge · 1.10x XP · 🔥 Hot Tag"  },
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

function getNextReset() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  const reset = new Date(now);
  reset.setUTCDate(now.getUTCDate() + daysUntilSunday);
  reset.setUTCHours(23, 59, 0, 0);
  return reset;
}

function UserAvatar({ name, level, avatarUrl, size = 44, isDark = false, rank }: {
  name: string; level: string; avatarUrl?: string | null;
  size?: number; isDark?: boolean; rank?: number;
}) {
  const lc = LEVEL_COLORS[level] || LEVEL_COLORS.Seedling;
  const glowColor = rank === 1 ? "rgba(232,168,0,.55)"
                  : rank === 2 ? "rgba(160,160,160,.4)"
                  : rank === 3 ? "rgba(205,127,50,.4)"
                  : "none";
  const ringColor = rank === 1 ? "#e8a800"
                  : rank === 2 ? "#c0c0c0"
                  : rank === 3 ? "#cd7f32"
                  : isDark ? "rgba(255,255,255,.3)" : lc.ring;
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", overflow:"hidden", flexShrink:0,
      background: avatarUrl ? "transparent" : (isDark ? "rgba(255,255,255,.2)" : lc.bg),
      border:`2.5px solid ${ringColor}`,
      boxShadow: rank && rank <= 3 ? `0 0 14px ${glowColor}, 0 0 28px ${glowColor}` : "none",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.36, fontWeight:800,
      color: isDark ? "#fff" : lc.color,
      transition:"box-shadow .2s",
    }}>
      {avatarUrl
        ? <img src={avatarUrl} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
        : initials(name)
      }
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab,        setTab]        = useState<"xp"|"credits"|"rating">("xp");
  const [leaders,    setLeaders]    = useState<LeaderboardUser[]>([]);
  const [ratedUsers, setRatedUsers] = useState<RatedUser[]>([]);
  const [me,         setMe]         = useState<LeaderboardUser | null>(null);
  const [myId,       setMyId]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [rateLoad,   setRateLoad]   = useState(true);
  const [countdown,  setCountdown]  = useState("");
  const [prevChamp,  setPrevChamp]  = useState<PrevChamp | null>(null);

  // ── Live countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const diff = getNextReset().getTime() - Date.now();
      if (diff <= 0) { setCountdown("Resetting…"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── XP / Credits tab ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === "rating") return;
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);

      // Try with new reward columns first; fall back to base columns if SQL hasn't been run yet
      let data: any[] | null = null;
      const { data: d1, error: e1 } = await supabase
        .from("profiles")
        .select("id,full_name,username,credits,xp,level,avatar_url,xp_multiplier,multiplier_ends_at,champion_title,champion_streak")
        .order(tab === "credits" ? "credits" : "xp", { ascending: false })
        .limit(20);

      if (!e1 && d1 && d1.length) {
        data = d1;
      } else {
        // SQL not run yet — fetch without new columns so users still show
        const { data: d2 } = await supabase
          .from("profiles")
          .select("id,full_name,username,credits,xp,level,avatar_url")
          .order(tab === "credits" ? "credits" : "xp", { ascending: false })
          .limit(20);
        data = d2;
      }

      if (data && data.length) {
        setLeaders(data);
        if (user) { const found = data.find((u: LeaderboardUser) => u.id === user.id); if (found) setMe(found); }
      }

      // Previous week's champion
      const { data: prevWinner } = await supabase
        .from("weekly_champions")
        .select("xp_earned, profiles(full_name)")
        .eq("rank", 1)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevWinner) setPrevChamp({ full_name: (prevWinner as any).profiles?.full_name, xp_earned: prevWinner.xp_earned });

      setLoading(false);
    };
    load();
  }, [tab]);

  // ── Ratings tab ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "rating") return;
    const load = async () => {
      setRateLoad(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyId(user.id);
      try {
        const { data: vd, error: ve } = await supabase
          .from("user_rating_stats")
          .select(`rated_id, bayesian_avg, rating_count, profiles:rated_id(full_name,username,level,avatar_url,champion_title)`)
          .order("bayesian_avg", { ascending: false })
          .gt("rating_count", 0)
          .limit(20);

        if (!ve && vd && vd.length) {
          setRatedUsers((vd as any[]).map(r => ({
            id: r.rated_id,
            full_name:    r.profiles?.full_name   || "Unknown",
            username:     r.profiles?.username    || "unknown",
            level:        r.profiles?.level       || "Seedling",
            avatar_url:   r.profiles?.avatar_url  || null,
            champion_title: r.profiles?.champion_title || null,
            bayesian_avg: parseFloat((r.bayesian_avg || 0).toFixed(2)),
            rating_count: r.rating_count,
          })));
        } else {
          const { data: raw } = await supabase
            .from("ratings")
            .select(`rated_id, overall, profiles:rated_id(full_name,username,level,avatar_url,champion_title)`);
          if (raw && raw.length) {
            const g: Record<string, { overalls:number[]; p:any }> = {};
            (raw as any[]).forEach(r => {
              if (!g[r.rated_id]) g[r.rated_id] = { overalls:[], p:r.profiles };
              g[r.rated_id].overalls.push(r.overall);
            });
            setRatedUsers(
              Object.entries(g)
                .map(([id,{overalls,p}]) => ({
                  id, full_name:p?.full_name||"Unknown", username:p?.username||"unknown",
                  level:p?.level||"Seedling", avatar_url:p?.avatar_url||null,
                  champion_title:p?.champion_title||null,
                  bayesian_avg:parseFloat(bayesianAvg(overalls).toFixed(2)),
                  rating_count:overalls.length,
                }))
                .sort((a,b)=>b.bayesian_avg-a.bayesian_avg).slice(0,20)
            );
          }
        }
      } catch(e){ console.error("Top rated error:",e); }
      setRateLoad(false);
    };
    load();
  }, [tab]);

  const sorted      = [...leaders].sort((a,b) => tab==="credits" ? b.credits-a.credits : b.xp-a.xp);
  const myRank      = me ? sorted.findIndex(u => u.id === me.id) + 1 : 0;
  const myRatedRank = myId ? ratedUsers.findIndex(u => u.id === myId) + 1 : 0;
  const myRated     = myId ? ratedUsers.find(u => u.id === myId) || null : null;
  const isRating    = tab === "rating";
  const busy        = isRating ? rateLoad : loading;
  const top3        = isRating ? ratedUsers.slice(0,3) : sorted.slice(0,3);

  return (
    <div style={{ minHeight:"100vh", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;color:inherit}

        @keyframes fadeUp    {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes shimmer   {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes skel      {0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes goldSpin  {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes crownFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-7px) rotate(4deg)}}
        @keyframes pulse     {0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes countPop  {0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        @keyframes xpGlow    {0%,100%{opacity:.8}50%{opacity:1}}

        .tab-btn  {border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .14s}
        .row      {transition:background .13s,transform .1s;cursor:pointer}
        .row:hover{background:#fafdf8 !important;transform:translateX(2px)}
        .pod      {transition:transform .2s,box-shadow .2s}
        .pod:hover{transform:translateY(-5px) !important}
        .skel     {animation:skel 1.5s ease infinite;background:#f0ece4;border-radius:8px}

        /* Gold animated border for #1 avatar */
        .ring-gold {
          outline: 3px solid transparent;
          outline-offset: 2px;
          box-shadow:
            0 0 0 3px #e8a800,
            0 0 20px rgba(232,168,0,.5),
            0 0 40px rgba(232,168,0,.25);
          animation: goldSpin 2s linear infinite;
        }
        .ring-silver {
          box-shadow: 0 0 0 2.5px #c0c0c0, 0 0 14px rgba(160,160,160,.4);
        }
        .ring-bronze {
          box-shadow: 0 0 0 2.5px #cd7f32, 0 0 14px rgba(205,127,50,.35);
        }

        .crown-float { animation: crownFloat 2.5s ease-in-out infinite; }
        .countdown   { animation: countPop 1s ease infinite; }
        .multiplier-badge { animation: xpGlow 1.5s ease infinite; }

        .navlink { padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:background .12s }
        .navlink:hover { background:#eee9e0; color:#2d6a4f !important; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background:"rgba(255,255,255,.97)",backdropFilter:"blur(16px)",borderBottom:"1.5px solid #e8e2d9",padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:4 }}>
          {[["Dashboard","/dashboard"],["Browse","/listings"],["Bounties","/bounties"],["Sessions","/sessions"],["Community","/community"]].map(([l,h])=>(
            <a key={l} href={h} className="navlink">{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ padding:"6px 14px",borderRadius:10,background:"#f5f0e8",fontSize:13,fontWeight:700,color:"#333" }}>My Profile →</a>
      </nav>

      <div style={{ maxWidth:860,margin:"0 auto",padding:"36px 24px 80px" }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign:"center",marginBottom:28,animation:"fadeUp .4s ease" }}>
          <div style={{ fontSize:11,fontWeight:800,color:"#2d6a4f",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8 }}>Community Rankings</div>
          <h1 style={{ fontFamily:"'Fraunces',serif",fontSize:42,fontWeight:900,color:"#1a1a1a",letterSpacing:"-.5px",marginBottom:10 }}>Leaderboard 🏆</h1>
          <p style={{ fontSize:14,color:"#aaa",marginBottom:20 }}>Top contributors, biggest earners, and highest rated teachers.</p>

          {/* ── COUNTDOWN ── */}
          <div style={{ display:"inline-flex",alignItems:"center",gap:12,background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:16,padding:"12px 22px",boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
            <span style={{ fontSize:20 }}>⏳</span>
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:9,fontWeight:800,color:"#aaa",textTransform:"uppercase",letterSpacing:".1em" }}>Resets in</p>
              <p className="countdown" style={{ fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:"#c0392b",lineHeight:1 }}>{countdown}</p>
            </div>
            <div style={{ width:1,height:28,background:"#e8e2d9" }} />
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:9,fontWeight:800,color:"#aaa",textTransform:"uppercase",letterSpacing:".1em" }}>Winners get</p>
              <p style={{ fontSize:12,fontWeight:700,color:"#1a1a1a" }}>Credits · Badges · XP Boost</p>
            </div>
          </div>
        </div>

        {/* ── PRIZE STRIP ── */}
        <div style={{ display:"flex",gap:10,marginBottom:28,justifyContent:"center",animation:"fadeUp .4s .04s ease both" }}>
          {WEEKLY.map(b => (
            <div key={b.rank} style={{ background:"#fff",borderRadius:16,padding:"16px 20px",textAlign:"center",border:"1.5px solid #e8e2d9",flex:1,maxWidth:200 }}>
              <p style={{ fontSize:28,margin:"0 0 6px" }}>{medal(b.rank)}</p>
              <p style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#2d6a4f",margin:"0 0 4px" }}>+{b.credits} cr</p>
              <p style={{ fontSize:10,color:"#999",fontWeight:600,lineHeight:1.6 }}>{b.bonus}</p>
              <p style={{ fontSize:9,color:"#ccc",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginTop:4 }}>Weekly bonus</p>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div style={{ display:"flex",justifyContent:"center",marginBottom:20,animation:"fadeUp .4s .08s ease both" }}>
          <div style={{ display:"flex",gap:3,background:"#fff",borderRadius:14,padding:4,border:"1.5px solid #e8e2d9",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
            {([
              { key:"xp",      icon:"⚡", label:"Top XP"      },
              { key:"credits", icon:"💰", label:"Most Credits" },
              { key:"rating",  icon:"⭐", label:"Top Rated"    },
            ] as const).map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)}
                style={{ padding:"10px 24px",borderRadius:10,
                  background:tab===t.key?(t.key==="rating"?"linear-gradient(135deg,#f59e0b,#d97706)":"#2d6a4f"):"transparent",
                  color:tab===t.key?"#fff":"#666",fontSize:13,fontWeight:700,
                  boxShadow:tab===t.key?"0 2px 12px rgba(0,0,0,.15)":"none" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {isRating && (
          <div style={{ textAlign:"center",marginBottom:16,animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:12,color:"#b45309",fontWeight:700,background:"#fffbeb",padding:"7px 18px",borderRadius:999,border:"1.5px solid #fde68a",display:"inline-flex",alignItems:"center",gap:6 }}>
              ⭐ Bayesian averaging · min 1 review · accounts for review volume
            </span>
          </div>
        )}

        {/* ── MY RANK BANNER ── */}
        {!isRating && myRank > 0 && me && (
          <div style={{ background:"#e8f4e8",borderRadius:14,padding:"14px 22px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #2d6a4f",animation:"fadeUp .3s ease",flexWrap:"wrap",gap:10 }}>
            <div style={{ display:"flex",gap:12,alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{medal(myRank)}</span>
              <UserAvatar name={me.full_name} level={me.level} avatarUrl={me.avatar_url} size={36} rank={myRank <= 3 ? myRank : undefined} />
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:"#2d6a4f" }}>Your rank</div>
                <div style={{ fontSize:12,color:"#555" }}>@{me.username} · {LEVEL_ICONS[me.level]} {me.level}</div>
              </div>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:10 }}>
              {/* XP Multiplier badge */}
              {me.xp_multiplier && me.xp_multiplier > 1 && me.multiplier_ends_at && new Date(me.multiplier_ends_at) > new Date() && (
                <span className="multiplier-badge" style={{ background:"#c0392b",color:"#fff",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:800 }}>
                  ⚡ {me.xp_multiplier}x XP active!
                </span>
              )}
              {/* Champion title */}
              {me.champion_title && (
                <span style={{ background:"#fffbeb",border:"1px solid #f0d890",borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:800,color:"#e8a800" }}>
                  🏆 {me.champion_title}
                  {me.champion_streak && me.champion_streak > 1 ? ` ×${me.champion_streak}` : ""}
                </span>
              )}
              <div style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:800,color:"#2d6a4f" }}>
                {tab==="xp" ? `${me.xp} XP` : `${me.credits} cr`}
              </div>
            </div>
          </div>
        )}

        {isRating && myRated && myRatedRank > 0 && (
          <div style={{ background:"#fffbeb",borderRadius:14,padding:"14px 22px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1.5px solid #fde68a",animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex",gap:12,alignItems:"center" }}>
              <span style={{ fontSize:22 }}>{medal(myRatedRank)}</span>
              <UserAvatar name={myRated.full_name} level={myRated.level} avatarUrl={myRated.avatar_url} size={36} rank={myRatedRank<=3?myRatedRank:undefined} />
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:"#b45309" }}>Your rating rank</div>
                <div style={{ fontSize:12,color:"#666" }}>@{myRated.username} · {myRated.rating_count} review{myRated.rating_count!==1?"s":""}</div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:"#b45309" }}>{myRated.bayesian_avg.toFixed(2)}</div>
              <Stars value={myRated.bayesian_avg} size={13} />
            </div>
          </div>
        )}

        {isRating && !myRated && !rateLoad && (
          <div style={{ background:"#f5f0e8",borderRadius:14,padding:"14px 22px",marginBottom:18,display:"flex",alignItems:"center",gap:12,border:"1.5px dashed #d4cfc6",animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:20 }}>⭐</span>
            <span style={{ fontSize:13,color:"#888" }}><b style={{ color:"#555" }}>You're not ranked yet.</b> Complete sessions and earn reviews to appear here!</span>
            <a href="/listings" style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#2d6a4f",background:"#e8f4e8",padding:"6px 14px",borderRadius:999,border:"1px solid #bbf7d0",whiteSpace:"nowrap" }}>Browse Skills →</a>
          </div>
        )}

        {/* ── PODIUM TOP 3 ── */}
        {!busy && top3.length >= 3 && (() => {
          const order = [1,0,2]; // show 2nd, 1st, 3rd
          return (
            <div style={{ display:"flex",gap:12,marginBottom:20,alignItems:"flex-end",animation:"fadeUp .4s .12s ease both" }}>
              {order.map(idx => {
                const user  = top3[idx] as any;
                const pos   = idx + 1;
                const isDark = idx === 0;
                const medalEmoji = medal(pos);
                const lc    = LEVEL_COLORS[user.level] || LEVEL_COLORS.Seedling;
                const hasMulti = user.xp_multiplier > 1 && user.multiplier_ends_at && new Date(user.multiplier_ends_at) > new Date();

                return (
                  <a key={user.id} href={`/profile/${user.username}`} className="pod"
                    style={{ flex:1,borderRadius:20,padding:pos===1?"30px 14px 24px":"22px 14px 18px",textAlign:"center",
                      border:`1.5px solid ${isDark?"transparent":lc.ring}`,
                      transform:pos===1?"scale(1.04)":"scale(1)",
                      boxShadow:pos===1?(isRating?"0 8px 32px rgba(180,83,9,.3)":"0 10px 36px rgba(45,106,79,.3)"):"0 2px 8px rgba(0,0,0,.04)",
                      background:isDark?(isRating?"linear-gradient(135deg,#b45309,#92400e)":"linear-gradient(135deg,#2d6a4f,#1b4332)"):"#fff",
                      color:isDark?"#fff":"inherit",position:"relative",overflow:"hidden" }}>

                    {/* Crown floats for #1 */}
                    {pos === 1
                      ? <div className="crown-float" style={{ fontSize:32,marginBottom:6 }}>👑</div>
                      : <div style={{ fontSize:28,marginBottom:8 }}>{medalEmoji}</div>
                    }

                    {/* Champion title */}
                    {user.champion_title && (
                      <div style={{ display:"inline-flex",alignItems:"center",gap:4,background:isDark?"rgba(255,255,255,.15)":"#fffbeb",border:`1px solid ${isDark?"rgba(255,255,255,.25)":"#f0d890"}`,borderRadius:99,padding:"2px 9px",marginBottom:8,fontSize:9,fontWeight:800,color:isDark?"#fff":"#e8a800",textTransform:"uppercase",letterSpacing:".06em" }}>
                        🏆 {user.champion_title}
                        {user.champion_streak > 1 && <span style={{ background:isDark?"rgba(255,255,255,.2)":"rgba(232,168,0,.2)",borderRadius:99,padding:"1px 5px",fontSize:8 }}>×{user.champion_streak}</span>}
                      </div>
                    )}

                    {/* Avatar with glow ring */}
                    <div style={{ position:"relative",display:"inline-block",marginBottom:10 }}>
                      <div style={{ borderRadius:"50%",
                        boxShadow:pos===1?"0 0 0 3px #e8a800, 0 0 20px rgba(232,168,0,.55), 0 0 40px rgba(232,168,0,.25)":pos===2?"0 0 0 2.5px #c0c0c0, 0 0 14px rgba(160,160,160,.4)":"0 0 0 2.5px #cd7f32, 0 0 14px rgba(205,127,50,.35)" }}>
                        <UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={pos===1?60:50} isDark={isDark} />
                      </div>
                      {hasMulti && (
                        <div className="multiplier-badge" style={{ position:"absolute",top:-4,right:-4,background:"#c0392b",color:"#fff",borderRadius:99,padding:"2px 6px",fontSize:8,fontWeight:900,border:"2px solid #fff",whiteSpace:"nowrap" }}>
                          ⚡{user.xp_multiplier}x
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize:pos===1?14:13,fontWeight:800,color:isDark?"#fff":"#333",marginBottom:2 }}>
                      {user.full_name.split(" ")[0]}
                    </div>
                    <div style={{ fontSize:11,color:isDark?"rgba(255,255,255,.55)":"#bbb",marginBottom:8 }}>
                      @{user.username}
                    </div>

                    {/* Level badge */}
                    <div style={{ display:"inline-flex",alignItems:"center",gap:4,background:isDark?"rgba(255,255,255,.12)":"#f5f0e8",borderRadius:99,padding:"3px 10px",marginBottom:10,fontSize:10,fontWeight:700,color:isDark?"rgba(255,255,255,.8)":lc.color }}>
                      {LEVEL_ICONS[user.level]} {user.level}
                    </div>

                    {isRating ? (
                      <>
                        <div style={{ fontFamily:"'Fraunces',serif",fontSize:pos===1?26:20,fontWeight:900,color:isDark?"#fff":pos===2?"#94a3b8":"#b45309",lineHeight:1 }}>
                          {(user as RatedUser).bayesian_avg.toFixed(2)}
                        </div>
                        <div style={{ marginTop:5 }}><Stars value={(user as RatedUser).bayesian_avg} size={pos===1?15:12} /></div>
                        <div style={{ fontSize:10,color:isDark?"rgba(255,255,255,.5)":"#bbb",marginTop:3 }}>{(user as RatedUser).rating_count} reviews</div>
                      </>
                    ) : (
                      <div style={{ fontFamily:"'Fraunces',serif",fontSize:pos===1?28:22,fontWeight:900,color:isDark?"#b7e4c7":pos===2?"#94a3b8":"#b45309" }}>
                        {tab==="xp" ? `${(user as LeaderboardUser).xp} XP` : `${(user as LeaderboardUser).credits} cr`}
                      </div>
                    )}

                    {/* Featured listing badge for #1 */}
                    {pos === 1 && !isRating && (
                      <div style={{ marginTop:10,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"5px 10px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.8)" }}>
                        📌 Listing featured on Browse
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          );
        })()}

        {/* ── FULL LIST ── */}
        <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #e8e2d9",overflow:"hidden",animation:"fadeUp .4s .18s ease both" }}>
          <div style={{ padding:"14px 24px",borderBottom:"1px solid #f5f0e8",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <span style={{ fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".06em" }}>
              {isRating?"Ranked by Bayesian Average Rating":tab==="xp"?"Ranked by Total XP Earned":"Ranked by Credits Held"}
            </span>
            {isRating && <span style={{ fontSize:10,color:"#ccc",fontWeight:600 }}>C=5 · m=3.5</span>}
          </div>

          {busy ? (
            <div>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 24px",borderBottom:"1px solid #f5f0e8" }}>
                  <div className="skel" style={{ width:36,height:18,flexShrink:0 }} />
                  <div className="skel" style={{ width:42,height:42,borderRadius:"50%",flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div className="skel" style={{ height:13,width:"40%",marginBottom:6 }} />
                    <div className="skel" style={{ height:10,width:"28%" }} />
                  </div>
                  <div className="skel" style={{ width:64,height:20 }} />
                </div>
              ))}
            </div>
          ) : isRating ? (
            ratedUsers.length === 0 ? (
              <div style={{ textAlign:"center",padding:"64px 0" }}>
                <div style={{ fontSize:44,marginBottom:12 }}>⭐</div>
                <p style={{ fontSize:14,color:"#bbb",marginBottom:20 }}>No rated teachers yet — complete sessions to appear!</p>
                <a href="/listings" style={{ display:"inline-block",padding:"11px 28px",background:"#2d6a4f",color:"#fff",borderRadius:12,fontWeight:700,fontSize:13 }}>Browse Skills →</a>
              </div>
            ) : ratedUsers.map((user,i)=>{
              const lc   = LEVEL_COLORS[user.level] || LEVEL_COLORS.Seedling;
              const isMe = user.id === myId;
              return (
                <a key={user.id} href={`/profile/${user.username}`} className="row"
                  style={{ display:"flex",alignItems:"center",padding:"15px 24px",background:isMe?"#fffbeb":"#fff",borderBottom:i<ratedUsers.length-1?"1px solid #f5f0e8":"none" }}>
                  <div style={{ width:46,textAlign:"center",flexShrink:0 }}>
                    <span style={{ fontSize:i<3?22:13,fontWeight:700,color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span>
                  </div>
                  <div style={{ marginRight:14 }}>
                    <UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={44} rank={i<3?i+1:undefined} />
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.full_name}</span>
                      {isMe && <span style={{ fontSize:9,background:"#2d6a4f",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:800,flexShrink:0 }}>YOU</span>}
                      {user.champion_title && <span style={{ fontSize:9,background:"#fffbeb",color:"#e8a800",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0d890",flexShrink:0 }}>🏆 {user.champion_title}</span>}
                      {i===0 && <span style={{ fontSize:9,background:"#fffbeb",color:"#b45309",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #fde68a",flexShrink:0 }}>TOP RATED ⭐</span>}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:3 }}>
                      <span style={{ fontSize:11,color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10,background:lc.bg,color:lc.color,padding:"1px 7px",borderRadius:999,fontWeight:700 }}>{LEVEL_ICONS[user.level]} {user.level}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:i===0?"#b45309":i===1?"#94a3b8":i===2?"#92400e":"#555",lineHeight:1,marginBottom:3 }}>
                      {user.bayesian_avg.toFixed(2)}
                    </div>
                    <Stars value={user.bayesian_avg} size={12} />
                    <div style={{ fontSize:10,color:"#bbb",fontWeight:600,marginTop:2 }}>{user.rating_count} review{user.rating_count!==1?"s":""}</div>
                  </div>
                </a>
              );
            })
          ) : (
            sorted.map((user,i)=>{
              const lc      = LEVEL_COLORS[user.level] || LEVEL_COLORS.Seedling;
              const isMe    = me?.id === user.id;
              const hasMulti = user.xp_multiplier && user.xp_multiplier > 1 && user.multiplier_ends_at && new Date(user.multiplier_ends_at) > new Date();
              return (
                <div key={user.id} className="row"
                  style={{ display:"flex",alignItems:"center",padding:"15px 24px",background:isMe?"#f0fdf4":"#fff",borderBottom:i<sorted.length-1?"1px solid #f5f0e8":"none" }}>
                  <div style={{ width:46,textAlign:"center",flexShrink:0 }}>
                    <span style={{ fontSize:i<3?22:13,fontWeight:700,color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span>
                  </div>
                  <div style={{ marginRight:14 }}>
                    <UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={44} rank={i<3?i+1:undefined} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{user.full_name}</span>
                      {isMe && <span style={{ fontSize:9,background:"#2d6a4f",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:800 }}>YOU</span>}
                      {user.champion_title && (
                        <span style={{ fontSize:9,background:"#fffbeb",color:"#e8a800",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0d890" }}>
                          🏆 {user.champion_title}
                          {user.champion_streak && user.champion_streak > 1 ? ` ×${user.champion_streak}` : ""}
                        </span>
                      )}
                      {hasMulti && (
                        <span className="multiplier-badge" style={{ fontSize:9,background:"#fdf0ee",color:"#c0392b",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0b8b0" }}>
                          ⚡ {user.xp_multiplier}x XP
                        </span>
                      )}
                      {i === 0 && !isRating && (
                        <span style={{ fontSize:9,background:"#e8f4e8",color:"#2d6a4f",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #b7dfc8" }}>
                          📌 Listing Featured
                        </span>
                      )}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:3 }}>
                      <span style={{ fontSize:11,color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10,background:lc.bg,color:lc.color,padding:"1px 7px",borderRadius:999,fontWeight:700 }}>{LEVEL_ICONS[user.level]} {user.level}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#2d6a4f",lineHeight:1 }}>
                      {tab==="xp" ? user.xp : user.credits}
                    </div>
                    <div style={{ fontSize:11,color:"#aaa",marginTop:2 }}>{tab==="xp"?"XP":"credits"}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {isRating && !rateLoad && ratedUsers.length > 0 && (
          <p style={{ textAlign:"center",fontSize:11,color:"#ccc",fontWeight:600,marginTop:14 }}>
            Formula: (C × m + Σ ratings) ÷ (C + n) · C=5, m=3.5 (global mean)
          </p>
        )}

        {/* ── PREVIOUS CHAMPION BANNER ── */}
        {prevChamp && (
          <div style={{ marginTop:24,background:"linear-gradient(135deg,#1a3d2e,#2d6a4f)",borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",gap:16,animation:"fadeUp .4s .22s ease both" }}>
            <span style={{ fontSize:32 }}>🏆</span>
            <div>
              <p style={{ fontSize:10,fontWeight:800,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:3 }}>Last Week's Champion</p>
              <p style={{ fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:"#fff" }}>{prevChamp.full_name}</p>
              <p style={{ fontSize:12,color:"rgba(255,255,255,.6)" }}>{prevChamp.xp_earned.toLocaleString()} XP earned that week</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}