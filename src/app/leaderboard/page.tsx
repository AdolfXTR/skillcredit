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
  avatar_url?: string | null; champion_title?: string | null;
};
type SessionUser = {
  id: string; full_name: string; username: string;
  level: string; session_count: number;
  avatar_url?: string | null; champion_title?: string | null;
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

const XP_PERKS = [
  { rank:1, credits:20, perks:["👑 Champion Crown Title","📌 Featured Listing on Browse","⚡ 1.25x XP Boost for a week"] },
  { rank:2, credits:10, perks:["🥈 Silver Badge","1.15x XP Boost","🔥 Hot Teacher Tag"] },
  { rank:3, credits:5,  perks:["🥉 Bronze Badge","1.10x XP Boost","🔥 Hot Teacher Tag"] },
];
const SESSION_PERKS = [
  { rank:1, title:"Most Dedicated Teacher 🏫", perks:["🏫 Title on Profile","🔥 Hot Teacher Tag for a week","Community Spotlight"] },
  { rank:2, title:"Active Mentor 🎓",           perks:["🎓 Active Mentor Title","Recognition Badge"] },
  { rank:3, title:"Rising Teacher 🌟",          perks:["🌟 Rising Teacher Title","Recognition Badge"] },
];
const RATING_PERKS = [
  { rank:1, title:"Top Rated ⭐",       perks:["⭐ Star Border on Avatar","Top Rated Badge on Profile","Trust Spotlight"] },
  { rank:2, title:"Highly Rated 🌟",    perks:["🌟 Highly Rated Badge","Profile Recognition"] },
  { rank:3, title:"Trusted Teacher 💎", perks:["💎 Trusted Teacher Badge","Profile Recognition"] },
];

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}
function initials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span>{[1,2,3,4,5].map(i=>(
      <span key={i} style={{ fontSize:size, color:i<=Math.round(value)?"#f59e0b":"#e5e7eb", lineHeight:1 }}>★</span>
    ))}</span>
  );
}
function getNextReset() {
  const now = new Date();
  const day = now.getUTCDay();
  const reset = new Date(now);
  reset.setUTCDate(now.getUTCDate() + (day === 0 ? 7 : 7 - day));
  reset.setUTCHours(23, 59, 0, 0);
  return reset;
}
function UserAvatar({ name, level, avatarUrl, size=44, isDark=false, rank }: {
  name:string; level:string; avatarUrl?:string|null; size?:number; isDark?:boolean; rank?:number;
}) {
  const lc = LEVEL_COLORS[level] || LEVEL_COLORS.Seedling;
  const ringColor = rank===1?"#e8a800":rank===2?"#c0c0c0":rank===3?"#cd7f32":isDark?"rgba(255,255,255,.3)":lc.ring;
  const glow = rank===1?"0 0 0 3px #e8a800,0 0 22px rgba(232,168,0,.6),0 0 44px rgba(232,168,0,.3)"
             : rank===2?"0 0 0 2.5px #c0c0c0,0 0 16px rgba(160,160,160,.5)"
             : rank===3?"0 0 0 2.5px #cd7f32,0 0 16px rgba(205,127,50,.45)"
             : "none";
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", flexShrink:0,
      background:avatarUrl?"transparent":(isDark?"rgba(255,255,255,.2)":lc.bg),
      border:`2.5px solid ${ringColor}`, boxShadow:glow,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.36, fontWeight:800, color:isDark?"#fff":lc.color,
    }}>
      {avatarUrl?<img src={avatarUrl} alt={name} style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:initials(name)}
    </div>
  );
}

function PerkStrip({ tab }: { tab:"xp"|"sessions"|"rating" }) {
  const perks  = tab==="xp"?XP_PERKS:tab==="sessions"?SESSION_PERKS:RATING_PERKS;
  const accent = tab==="xp"?"#2d6a4f":tab==="sessions"?"#1d4ed8":"#b45309";
  const bg     = tab==="xp"?"#e8f4e8":tab==="sessions"?"#e0f2fe":"#fffbeb";
  const bd     = tab==="xp"?"#bbf7d0":tab==="sessions"?"#bfdbfe":"#fde68a";
  const medalColors = ["linear-gradient(135deg,#f6d860,#e8a800)","linear-gradient(135deg,#e8e8e8,#c0c0c0)","linear-gradient(135deg,#e8b97a,#cd7f32)"];
  return (
    <div style={{ display:"flex",gap:10,marginBottom:24,justifyContent:"center",animation:"fadeUp .4s .04s ease both" }}>
      {perks.map((p,idx)=>(
        <div key={idx} style={{ background:"#fff",borderRadius:18,padding:"20px 16px",textAlign:"center",border:"1.5px solid #e8e2d9",flex:1,maxWidth:220,position:"relative",overflow:"hidden" }}>
          {/* Colored top accent bar */}
          <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:medalColors[idx],borderRadius:"18px 18px 0 0" }} />
          <div style={{ width:44,height:44,borderRadius:"50%",background:medalColors[idx],display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 10px",boxShadow:`0 4px 12px rgba(0,0,0,.12)` }}>
            {medal(p.rank)}
          </div>
          {tab==="xp"?(
            <>
              <p style={{ fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:accent,margin:"0 0 2px",lineHeight:1 }}>+{(p as typeof XP_PERKS[0]).credits} cr</p>
              <p style={{ fontSize:9,color:"#bbb",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginBottom:8 }}>credit reward</p>
            </>
          ):(
            <p style={{ fontSize:10,fontWeight:800,color:accent,background:bg,border:`1px solid ${bd}`,borderRadius:99,padding:"3px 10px",display:"inline-block",margin:"0 0 10px" }}>
              {(p as typeof SESSION_PERKS[0]).title}
            </p>
          )}
          <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
            {p.perks.map((perk,i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:5,background:"#f9f7f4",borderRadius:8,padding:"4px 8px" }}>
                <span style={{ fontSize:10,color:"#666",fontWeight:600,lineHeight:1.4 }}>{perk}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize:9,color:"#ccc",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",marginTop:10 }}>
            {tab==="xp"?"Weekly bonus":"Weekly title"}
          </p>
        </div>
      ))}
    </div>
  );
}

// Progress bar to next rank
function ProgressToNext({ current, next, label }: { current:number; next:number; label:string }) {
  const gap = next - current;
  if (gap <= 0) return null;
  const prev = Math.max(0, next - next * 0.3);
  const pct  = Math.min(100, Math.max(5, ((current - prev) / (next - prev)) * 100));
  return (
    <div style={{ marginTop:10 }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
        <span style={{ fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:600 }}>Progress to {label}</span>
        <span style={{ fontSize:10,color:"rgba(255,255,255,.9)",fontWeight:800 }}>+{gap.toLocaleString()} to go</span>
      </div>
      <div style={{ height:6,borderRadius:99,background:"rgba(255,255,255,.15)",overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${pct}%`,borderRadius:99,background:"rgba(255,255,255,.7)",transition:"width .6s ease" }} />
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab,          setTab]          = useState<"xp"|"sessions"|"rating">("xp");
  const [leaders,      setLeaders]      = useState<LeaderboardUser[]>([]);
  const [sessionUsers, setSessionUsers] = useState<SessionUser[]>([]);
  const [ratedUsers,   setRatedUsers]   = useState<RatedUser[]>([]);
  const [me,           setMe]           = useState<LeaderboardUser|null>(null);
  const [myId,         setMyId]         = useState<string|null>(null);
  const [loading,      setLoading]      = useState(true);
  const [sessLoad,     setSessLoad]     = useState(true);
  const [rateLoad,     setRateLoad]     = useState(true);
  const [countdown,    setCountdown]    = useState("");
  const [prevChamp,    setPrevChamp]    = useState<PrevChamp|null>(null);

  // Countdown
  useEffect(()=>{
    const tick=()=>{
      const diff=getNextReset().getTime()-Date.now();
      if(diff<=0){setCountdown("Resetting…");return;}
      const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),
            m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick(); const iv=setInterval(tick,1000); return()=>clearInterval(iv);
  },[]);

  // XP tab
  useEffect(()=>{
    if(tab!=="xp")return;
    const load=async()=>{
      setLoading(true);
      const {data:{user}}=await supabase.auth.getUser();
      if(user) setMyId(user.id);
      const {data:d1,error:e1}=await supabase.from("profiles")
        .select("id,full_name,username,credits,xp,level,avatar_url,xp_multiplier,multiplier_ends_at,champion_title,champion_streak")
        .order("xp",{ascending:false}).limit(20);
      let data:any=d1;
      if(e1||!d1?.length){
        const {data:d2}=await supabase.from("profiles")
          .select("id,full_name,username,credits,xp,level,avatar_url").order("xp",{ascending:false}).limit(20);
        data=d2;
      }
      if(data?.length){
        setLeaders(data);
        if(user){const found=data.find((u:any)=>u.id===user.id);if(found)setMe(found);}
      }
      const {data:pw}=await supabase.from("weekly_champions")
        .select("xp_earned,profiles(full_name)").eq("rank",1).order("week_start",{ascending:false}).limit(1).maybeSingle();
      if(pw) setPrevChamp({full_name:(pw as any).profiles?.full_name,xp_earned:pw.xp_earned});
      setLoading(false);
    };
    load();
  },[tab]);

  // Sessions tab
  useEffect(()=>{
    if(tab!=="sessions")return;
    const load=async()=>{
      setSessLoad(true);
      const {data:{user}}=await supabase.auth.getUser();
      if(user) setMyId(user.id);
      try{
        const {data:raw}=await supabase.from("sessions")
          .select("teacher_id,profiles:teacher_id(full_name,username,level,avatar_url,champion_title)")
          .eq("status","completed");
        if(raw?.length){
          const g:Record<string,{count:number;p:any}>={};
          (raw as any[]).forEach(r=>{if(!g[r.teacher_id])g[r.teacher_id]={count:0,p:r.profiles};g[r.teacher_id].count++;});
          setSessionUsers(Object.entries(g).map(([id,{count,p}])=>({
            id,full_name:p?.full_name||"Unknown",username:p?.username||"unknown",
            level:p?.level||"Seedling",avatar_url:p?.avatar_url||null,
            champion_title:p?.champion_title||null,session_count:count,
          })).sort((a,b)=>b.session_count-a.session_count).slice(0,20));
        }
      }catch(e){console.error(e);}
      setSessLoad(false);
    };
    load();
  },[tab]);

  // Rating tab
  useEffect(()=>{
    if(tab!=="rating")return;
    const load=async()=>{
      setRateLoad(true);
      const {data:{user}}=await supabase.auth.getUser();
      if(user) setMyId(user.id);
      try{
        const {data:vd,error:ve}=await supabase.from("user_rating_stats")
          .select("rated_id,bayesian_avg,rating_count,profiles:rated_id(full_name,username,level,avatar_url,champion_title)")
          .order("bayesian_avg",{ascending:false}).gt("rating_count",0).limit(20);
        if(!ve&&vd?.length){
          setRatedUsers((vd as any[]).map(r=>({
            id:r.rated_id,full_name:r.profiles?.full_name||"Unknown",username:r.profiles?.username||"unknown",
            level:r.profiles?.level||"Seedling",avatar_url:r.profiles?.avatar_url||null,
            champion_title:r.profiles?.champion_title||null,
            bayesian_avg:parseFloat((r.bayesian_avg||0).toFixed(2)),rating_count:r.rating_count,
          })));
        }else{
          const {data:raw}=await supabase.from("ratings")
            .select("rated_id,overall,profiles:rated_id(full_name,username,level,avatar_url,champion_title)");
          if(raw?.length){
            const g:Record<string,{overalls:number[];p:any}>={};
            (raw as any[]).forEach(r=>{if(!g[r.rated_id])g[r.rated_id]={overalls:[],p:r.profiles};g[r.rated_id].overalls.push(r.overall);});
            setRatedUsers(Object.entries(g).map(([id,{overalls,p}])=>({
              id,full_name:p?.full_name||"Unknown",username:p?.username||"unknown",
              level:p?.level||"Seedling",avatar_url:p?.avatar_url||null,champion_title:p?.champion_title||null,
              bayesian_avg:parseFloat(bayesianAvg(overalls).toFixed(2)),rating_count:overalls.length,
            })).sort((a,b)=>b.bayesian_avg-a.bayesian_avg).slice(0,20));
          }
        }
      }catch(e){console.error(e);}
      setRateLoad(false);
    };
    load();
  },[tab]);

  const isXP=tab==="xp", isSessions=tab==="sessions", isRating=tab==="rating";
  const busy=isRating?rateLoad:isSessions?sessLoad:loading;
  const sorted=[...leaders].sort((a,b)=>b.xp-a.xp);
  const top3=isRating?ratedUsers.slice(0,3):isSessions?sessionUsers.slice(0,3):sorted.slice(0,3);
  const myRank=me?sorted.findIndex(u=>u.id===me.id)+1:0;
  const mySessRank=myId?sessionUsers.findIndex(u=>u.id===myId)+1:0;
  const myRatedRank=myId?ratedUsers.findIndex(u=>u.id===myId)+1:0;
  const mySess=myId?sessionUsers.find(u=>u.id===myId)||null:null;
  const myRated=myId?ratedUsers.find(u=>u.id===myId)||null:null;
  const tabAccent=isRating?"#b45309":isSessions?"#1d4ed8":"#2d6a4f";
  const tabGrad=isRating?"linear-gradient(135deg,#b45309,#92400e)":isSessions?"linear-gradient(135deg,#1d4ed8,#1e40af)":"linear-gradient(135deg,#2d6a4f,#1b4332)";

  return (
    <div style={{ minHeight:"100vh",background:"#f5f5f0",fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes skel{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes crownFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-8px) rotate(4deg)}}
        @keyframes countPop{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes xpGlow{0%,100%{opacity:.8}50%{opacity:1}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 22px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #e8a800,0 0 32px rgba(232,168,0,.9),0 0 60px rgba(232,168,0,.4)}}
        .tab-btn{border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
        .row{transition:background .13s,transform .1s;cursor:pointer}
        .row:hover{background:#fafdf8 !important;transform:translateX(3px)}
        .pod{transition:transform .2s,box-shadow .2s}
        .pod:hover{transform:translateY(-6px) !important;box-shadow:0 16px 40px rgba(0,0,0,.15) !important}
        .skel{animation:skel 1.5s ease infinite;background:#f0ece4;border-radius:8px}
        .crown-float{animation:crownFloat 2.5s ease-in-out infinite}
        .countdown{animation:countPop 1s ease infinite}
        .xp-glow{animation:xpGlow 1.5s ease infinite}
        .gold-ring{animation:goldPulse 2s ease-in-out infinite}
        .navlink{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:background .12s}
        .navlink:hover{background:#eee9e0;color:#2d6a4f !important}
        @media(max-width:600px){
          .podium{flex-direction:column !important;align-items:center !important}
          .podium>a{width:100% !important;max-width:320px !important;transform:none !important}
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)",backdropFilter:"blur(16px)",borderBottom:"1.5px solid #e8e2d9",padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
          {[["Dashboard","/dashboard"],["Browse","/listings"],["Bounties","/bounties"],["Sessions","/sessions"],["Community","/community"]].map(([l,h])=>(
            <a key={l} href={h} className="navlink">{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ padding:"6px 14px",borderRadius:10,background:"#f5f0e8",fontSize:13,fontWeight:700,color:"#333",whiteSpace:"nowrap" }}>My Profile →</a>
      </nav>

      <div style={{ maxWidth:860,margin:"0 auto",padding:"36px 24px 80px" }}>

        {/* HEADER */}
        <div style={{ textAlign:"center",marginBottom:28,animation:"fadeUp .4s ease" }}>
          <div style={{ fontSize:11,fontWeight:800,color:"#2d6a4f",letterSpacing:".12em",textTransform:"uppercase",marginBottom:8 }}>Community Rankings</div>
          <h1 style={{ fontFamily:"'Fraunces',serif",fontSize:42,fontWeight:900,color:"#1a1a1a",letterSpacing:"-.5px",marginBottom:10 }}>Leaderboard 🏆</h1>
          <p style={{ fontSize:14,color:"#aaa",marginBottom:20 }}>Top XP earners, most active teachers, and highest rated instructors.</p>

          {/* Season countdown — more exciting */}
          <div style={{ display:"inline-flex",alignItems:"center",gap:12,background:"#1a1a1a",borderRadius:16,padding:"14px 24px",boxShadow:"0 4px 20px rgba(0,0,0,.15)" }}>
            <span style={{ fontSize:22 }}>⏳</span>
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:9,fontWeight:800,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".12em" }}>Season ends in</p>
              <p className="countdown" style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#f87171",lineHeight:1 }}>{countdown}</p>
            </div>
            <div style={{ width:1,height:32,background:"rgba(255,255,255,.1)" }} />
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:9,fontWeight:800,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".12em" }}>Winners announced</p>
              <p style={{ fontSize:12,fontWeight:700,color:"rgba(255,255,255,.85)" }}>Every Monday · Credits · Titles · Boosts</p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:"flex",justifyContent:"center",marginBottom:16,animation:"fadeUp .4s .08s ease both" }}>
          <div style={{ display:"flex",gap:3,background:"#fff",borderRadius:14,padding:4,border:"1.5px solid #e8e2d9",boxShadow:"0 2px 8px rgba(0,0,0,.04)" }}>
            {([
              { key:"xp",       icon:"🏆", label:"XP Leaders",        color:"#2d6a4f" },
              { key:"sessions", icon:"🎓", label:"Teaching Activity",  color:"#1d4ed8" },
              { key:"rating",   icon:"⭐", label:"Student Ratings",    color:"#b45309" },
            ] as const).map(t=>(
              <button key={t.key} className="tab-btn" onClick={()=>setTab(t.key)}
                style={{ padding:"10px 22px",borderRadius:10,background:tab===t.key?t.color:"transparent",
                  color:tab===t.key?"#fff":"#666",fontSize:13,fontWeight:700,
                  boxShadow:tab===t.key?"0 2px 12px rgba(0,0,0,.18)":"none" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB PILL */}
        <div style={{ textAlign:"center",marginBottom:20 }}>
          {isXP&&<span style={{ fontSize:12,color:"#2d6a4f",fontWeight:700,background:"#e8f4e8",padding:"7px 18px",borderRadius:999,border:"1.5px solid #bbf7d0",display:"inline-flex",alignItems:"center",gap:6 }}>⚡ Ranked by total XP · Resets weekly · Credit rewards for top 3</span>}
          {isSessions&&<span style={{ fontSize:12,color:"#1d4ed8",fontWeight:700,background:"#e0f2fe",padding:"7px 18px",borderRadius:999,border:"1.5px solid #bfdbfe",display:"inline-flex",alignItems:"center",gap:6 }}>🎓 Ranked by completed sessions as teacher · Titles & badges · No credit inflation</span>}
          {isRating&&<span style={{ fontSize:12,color:"#b45309",fontWeight:700,background:"#fffbeb",padding:"7px 18px",borderRadius:999,border:"1.5px solid #fde68a",display:"inline-flex",alignItems:"center",gap:6 }}>⭐ Bayesian average · Min 1 review · Titles & badges · No credit inflation</span>}
        </div>

        {/* PERK STRIP */}
        <PerkStrip tab={tab} />

        {/* MY RANK BANNERS */}
        {isXP&&myRank>0&&me&&(()=>{
          const above=myRank>1?sorted[myRank-2]:null;
          return (
            <div style={{ background:tabGrad,borderRadius:16,padding:"18px 24px",marginBottom:18,border:"none",animation:"fadeUp .3s ease",boxShadow:"0 4px 20px rgba(45,106,79,.25)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12 }}>
                <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                  <span style={{ fontSize:26 }}>{medal(myRank)}</span>
                  <UserAvatar name={me.full_name} level={me.level} avatarUrl={me.avatar_url} size={40} isDark rank={myRank<=3?myRank:undefined} />
                  <div>
                    <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>You are ranked #{myRank}</div>
                    <div style={{ fontSize:12,color:"rgba(255,255,255,.6)" }}>@{me.username} · {LEVEL_ICONS[me.level]} {me.level}</div>
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                  {me.xp_multiplier&&me.xp_multiplier>1&&me.multiplier_ends_at&&new Date(me.multiplier_ends_at)>new Date()&&(
                    <span className="xp-glow" style={{ background:"rgba(255,255,255,.15)",color:"#fff",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:800,border:"1px solid rgba(255,255,255,.25)" }}>⚡ {me.xp_multiplier}x XP active!</span>
                  )}
                  {me.champion_title&&<span style={{ background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.2)",borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:800,color:"rgba(255,255,255,.9)" }}>🏆 {me.champion_title}{me.champion_streak&&me.champion_streak>1?` ×${me.champion_streak}`:""}</span>}
                  <div style={{ fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#b7e4c7" }}>{me.xp.toLocaleString()} XP</div>
                </div>
              </div>
              {/* Progress to next rank */}
              {above&&<ProgressToNext current={me.xp} next={above.xp} label={`#${myRank-1} (${above.full_name.split(" ")[0]})`} />}
              {myRank===1&&<div style={{ marginTop:10,background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",textAlign:"center" }}>👑 You're the current champion! Keep earning XP to defend your lead.</div>}
            </div>
          );
        })()}

        {isSessions&&mySess&&mySessRank>0&&(()=>{
          const above=mySessRank>1?sessionUsers[mySessRank-2]:null;
          return (
            <div style={{ background:"linear-gradient(135deg,#1d4ed8,#1e40af)",borderRadius:16,padding:"18px 24px",marginBottom:18,animation:"fadeUp .3s ease",boxShadow:"0 4px 20px rgba(29,78,216,.25)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12 }}>
                <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                  <span style={{ fontSize:26 }}>{medal(mySessRank)}</span>
                  <UserAvatar name={mySess.full_name} level={mySess.level} avatarUrl={mySess.avatar_url} size={40} isDark rank={mySessRank<=3?mySessRank:undefined} />
                  <div>
                    <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>You are ranked #{mySessRank}</div>
                    <div style={{ fontSize:12,color:"rgba(255,255,255,.6)" }}>@{mySess.username} · {mySess.session_count} sessions completed</div>
                  </div>
                </div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#bfdbfe" }}>{mySess.session_count} sessions</div>
              </div>
              {above&&<ProgressToNext current={mySess.session_count} next={above.session_count} label={`#${mySessRank-1} (${above.full_name.split(" ")[0]})`} />}
              {mySessRank===1&&<div style={{ marginTop:10,background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",textAlign:"center" }}>🏫 You're the most dedicated teacher this week!</div>}
            </div>
          );
        })()}

        {isSessions&&!mySess&&!sessLoad&&(
          <div style={{ background:"#f5f0e8",borderRadius:14,padding:"14px 22px",marginBottom:18,display:"flex",alignItems:"center",gap:12,border:"1.5px dashed #d4cfc6",animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:20 }}>🎓</span>
            <span style={{ fontSize:13,color:"#888" }}><b style={{ color:"#555" }}>You haven't taught any sessions yet.</b> Create a listing and start teaching to appear here!</span>
            <a href="/listings/create" style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#1d4ed8",background:"#e0f2fe",padding:"6px 14px",borderRadius:999,border:"1px solid #bfdbfe",whiteSpace:"nowrap" }}>Create Listing →</a>
          </div>
        )}

        {isRating&&myRated&&myRatedRank>0&&(
          <div style={{ background:"linear-gradient(135deg,#b45309,#92400e)",borderRadius:16,padding:"18px 24px",marginBottom:18,animation:"fadeUp .3s ease",boxShadow:"0 4px 20px rgba(180,83,9,.25)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12 }}>
              <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                <span style={{ fontSize:26 }}>{medal(myRatedRank)}</span>
                <UserAvatar name={myRated.full_name} level={myRated.level} avatarUrl={myRated.avatar_url} size={40} isDark rank={myRatedRank<=3?myRatedRank:undefined} />
                <div>
                  <div style={{ fontSize:13,fontWeight:800,color:"#fff" }}>You are ranked #{myRatedRank}</div>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,.6)" }}>@{myRated.username} · {myRated.rating_count} review{myRated.rating_count!==1?"s":""}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#fff" }}>{myRated.bayesian_avg.toFixed(2)}</div>
                <Stars value={myRated.bayesian_avg} size={14} />
              </div>
            </div>
            {myRatedRank===1&&<div style={{ marginTop:10,background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",textAlign:"center" }}>⭐ You're the highest rated teacher this week!</div>}
          </div>
        )}
        {isRating&&!myRated&&!rateLoad&&(
          <div style={{ background:"#f5f0e8",borderRadius:14,padding:"14px 22px",marginBottom:18,display:"flex",alignItems:"center",gap:12,border:"1.5px dashed #d4cfc6",animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:20 }}>⭐</span>
            <span style={{ fontSize:13,color:"#888" }}><b style={{ color:"#555" }}>Not ranked yet.</b> Complete sessions and earn reviews to appear here!</span>
            <a href="/listings" style={{ marginLeft:"auto",fontSize:12,fontWeight:700,color:"#2d6a4f",background:"#e8f4e8",padding:"6px 14px",borderRadius:999,border:"1px solid #bbf7d0",whiteSpace:"nowrap" }}>Browse Skills →</a>
          </div>
        )}

        {/* PODIUM TOP 3 */}
        {!busy&&top3.length>=3&&(()=>{
          const order=[1,0,2];
          return (
            <div className="podium" style={{ display:"flex",gap:12,marginBottom:20,alignItems:"flex-end",animation:"fadeUp .4s .12s ease both" }}>
              {order.map(idx=>{
                const user=top3[idx] as any;
                const pos=idx+1,isDark=idx===0;
                const lc=LEVEL_COLORS[user.level]||LEVEL_COLORS.Seedling;
                const hasMulti=user.xp_multiplier>1&&user.multiplier_ends_at&&new Date(user.multiplier_ends_at)>new Date();
                const perkTitle=isSessions?SESSION_PERKS[idx]?.title:isRating?RATING_PERKS[idx]?.title:null;
                const podHeight=pos===1?"30px 16px 26px":"20px 16px 18px";
                const podScale=pos===1?1.05:0.97;
                const podShadow=pos===1?`0 12px 40px rgba(0,0,0,.22)`:"0 2px 10px rgba(0,0,0,.06)";
                const avatarSize=pos===1?68:52;

                return (
                  <a key={user.id} href={`/profile/${user.username}`} className="pod"
                    style={{ flex:1,borderRadius:22,padding:podHeight,textAlign:"center",
                      border:`1.5px solid ${isDark?"transparent":lc.ring}`,
                      transform:`scale(${podScale})`,transformOrigin:"bottom center",
                      boxShadow:podShadow,
                      background:isDark?tabGrad:"#fff",
                      color:isDark?"#fff":"inherit",position:"relative",overflow:"hidden" }}>

                    {/* Rank number badge */}
                    <div style={{ position:"absolute",top:10,left:12,background:isDark?"rgba(255,255,255,.15)":"#f5f0e8",borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:900,color:isDark?"rgba(255,255,255,.8)":"#999" }}>
                      #{pos}
                    </div>

                    {pos===1
                      ?<div className="crown-float" style={{ fontSize:34,marginBottom:6,marginTop:8 }}>👑</div>
                      :<div style={{ fontSize:30,marginBottom:8,marginTop:4 }}>{medal(pos)}</div>
                    }

                    {perkTitle&&<div style={{ display:"inline-flex",alignItems:"center",background:isDark?"rgba(255,255,255,.15)":"#f5f0e8",borderRadius:99,padding:"2px 9px",marginBottom:8,fontSize:9,fontWeight:800,color:isDark?"#fff":tabAccent,textTransform:"uppercase",letterSpacing:".06em" }}>{perkTitle}</div>}
                    {!perkTitle&&user.champion_title&&<div style={{ display:"inline-flex",alignItems:"center",background:isDark?"rgba(255,255,255,.15)":"#fffbeb",border:`1px solid ${isDark?"rgba(255,255,255,.2)":"#f0d890"}`,borderRadius:99,padding:"2px 9px",marginBottom:8,fontSize:9,fontWeight:800,color:isDark?"#fff":"#e8a800",textTransform:"uppercase" }}>🏆 {user.champion_title}{user.champion_streak>1&&` ×${user.champion_streak}`}</div>}

                    <div style={{ position:"relative",display:"inline-block",marginBottom:10 }}>
                      <div className={pos===1?"gold-ring":""} style={{ borderRadius:"50%",
                        boxShadow:pos===1?"0 0 0 3px #e8a800,0 0 22px rgba(232,168,0,.6)":pos===2?"0 0 0 2.5px #c0c0c0,0 0 14px rgba(160,160,160,.5)":"0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.4)" }}>
                        <UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={avatarSize} isDark={isDark} />
                      </div>
                      {hasMulti&&<div className="xp-glow" style={{ position:"absolute",top:-4,right:-4,background:"#c0392b",color:"#fff",borderRadius:99,padding:"2px 6px",fontSize:8,fontWeight:900,border:"2px solid #fff",whiteSpace:"nowrap" }}>⚡{user.xp_multiplier}x</div>}
                    </div>

                    <div style={{ fontSize:pos===1?15:13,fontWeight:800,color:isDark?"#fff":"#333",marginBottom:2 }}>{user.full_name.split(" ")[0]}</div>
                    <div style={{ fontSize:11,color:isDark?"rgba(255,255,255,.5)":"#bbb",marginBottom:8 }}>@{user.username}</div>
                    <div style={{ display:"inline-flex",alignItems:"center",gap:4,background:isDark?"rgba(255,255,255,.12)":"#f5f0e8",borderRadius:99,padding:"3px 10px",marginBottom:10,fontSize:10,fontWeight:700,color:isDark?"rgba(255,255,255,.8)":lc.color }}>{LEVEL_ICONS[user.level]} {user.level}</div>

                    {isRating?(<><div style={{ fontFamily:"'Fraunces',serif",fontSize:pos===1?28:22,fontWeight:900,color:isDark?"#fff":pos===2?"#94a3b8":"#b45309",lineHeight:1 }}>{user.bayesian_avg.toFixed(2)}</div><div style={{ marginTop:5 }}><Stars value={user.bayesian_avg} size={pos===1?15:12} /></div><div style={{ fontSize:10,color:isDark?"rgba(255,255,255,.5)":"#bbb",marginTop:3 }}>{user.rating_count} reviews</div></>)
                    :isSessions?(<><div style={{ fontFamily:"'Fraunces',serif",fontSize:pos===1?30:24,fontWeight:900,color:isDark?"#bfdbfe":pos===2?"#94a3b8":"#1e40af" }}>{user.session_count}</div><div style={{ fontSize:11,color:isDark?"rgba(255,255,255,.5)":"#bbb",marginTop:2 }}>sessions</div></>)
                    :(<><div style={{ fontFamily:"'Fraunces',serif",fontSize:pos===1?30:24,fontWeight:900,color:isDark?"#b7e4c7":pos===2?"#94a3b8":"#b45309" }}>{user.xp.toLocaleString()} XP</div>{pos===1&&<div style={{ marginTop:10,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"5px 10px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.75)" }}>📌 Listing featured on Browse</div>}</>)}
                  </a>
                );
              })}
            </div>
          );
        })()}

        {/* FULL LIST */}
        <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #e8e2d9",overflow:"hidden",animation:"fadeUp .4s .18s ease both" }}>
          <div style={{ padding:"14px 24px",borderBottom:"1px solid #f5f0e8",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <span style={{ fontSize:12,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".06em" }}>
              {isRating?"Ranked by Bayesian Average Rating":isSessions?"Ranked by Completed Sessions as Teacher":"Ranked by Total XP Earned"}
            </span>
            {isRating&&<span style={{ fontSize:10,color:"#ccc",fontWeight:600 }}>C=5 · m=3.5</span>}
          </div>

          {busy?(
            <div>{[1,2,3,4,5,6].map(i=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 24px",borderBottom:"1px solid #f5f0e8" }}>
                <div className="skel" style={{ width:36,height:18,flexShrink:0 }} />
                <div className="skel" style={{ width:42,height:42,borderRadius:"50%",flexShrink:0 }} />
                <div style={{ flex:1 }}><div className="skel" style={{ height:13,width:"40%",marginBottom:6 }} /><div className="skel" style={{ height:10,width:"28%" }} /></div>
                <div className="skel" style={{ width:72,height:22 }} />
              </div>
            ))}</div>
          ):isSessions?(
            sessionUsers.length===0?(
              <div style={{ textAlign:"center",padding:"64px 0" }}>
                <div style={{ fontSize:44,marginBottom:12 }}>🎓</div>
                <p style={{ fontSize:14,color:"#bbb",marginBottom:20 }}>No completed sessions yet — be the first to teach!</p>
                <a href="/listings/create" style={{ display:"inline-block",padding:"11px 28px",background:"#1d4ed8",color:"#fff",borderRadius:12,fontWeight:700,fontSize:13 }}>Create a Listing →</a>
              </div>
            ):sessionUsers.map((user,i)=>{
              const lc=LEVEL_COLORS[user.level]||LEVEL_COLORS.Seedling,isMe=user.id===myId;
              const perkTitle=SESSION_PERKS[i]?.title;
              return (
                <a key={user.id} href={`/profile/${user.username}`} className="row"
                  style={{ display:"flex",alignItems:"center",padding:"15px 24px",background:isMe?"#e0f2fe":"#fff",borderBottom:i<sessionUsers.length-1?"1px solid #f5f0e8":"none" }}>
                  <div style={{ width:46,textAlign:"center",flexShrink:0 }}><span style={{ fontSize:i<3?22:13,fontWeight:700,color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span></div>
                  <div style={{ marginRight:14 }}><UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={44} rank={i<3?i+1:undefined} /></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{user.full_name}</span>
                      {isMe&&<span style={{ fontSize:9,background:"#1d4ed8",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:800,flexShrink:0 }}>YOU</span>}
                      {perkTitle&&<span style={{ fontSize:9,background:"#e0f2fe",color:"#1d4ed8",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #bfdbfe",flexShrink:0 }}>{perkTitle}</span>}
                      {user.champion_title&&<span style={{ fontSize:9,background:"#fffbeb",color:"#e8a800",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0d890",flexShrink:0 }}>🏆 {user.champion_title}</span>}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:3 }}>
                      <span style={{ fontSize:11,color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10,background:lc.bg,color:lc.color,padding:"1px 7px",borderRadius:999,fontWeight:700 }}>{LEVEL_ICONS[user.level]} {user.level}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#1d4ed8",lineHeight:1 }}>{user.session_count}</div>
                    <div style={{ fontSize:11,color:"#aaa",marginTop:2 }}>sessions</div>
                  </div>
                </a>
              );
            })
          ):isRating?(
            ratedUsers.length===0?(
              <div style={{ textAlign:"center",padding:"64px 0" }}>
                <div style={{ fontSize:44,marginBottom:12 }}>⭐</div>
                <p style={{ fontSize:14,color:"#bbb",marginBottom:20 }}>No rated teachers yet — complete sessions to appear!</p>
                <a href="/listings" style={{ display:"inline-block",padding:"11px 28px",background:"#2d6a4f",color:"#fff",borderRadius:12,fontWeight:700,fontSize:13 }}>Browse Skills →</a>
              </div>
            ):ratedUsers.map((user,i)=>{
              const lc=LEVEL_COLORS[user.level]||LEVEL_COLORS.Seedling,isMe=user.id===myId;
              const perkTitle=RATING_PERKS[i]?.title;
              return (
                <a key={user.id} href={`/profile/${user.username}`} className="row"
                  style={{ display:"flex",alignItems:"center",padding:"15px 24px",background:isMe?"#fffbeb":"#fff",borderBottom:i<ratedUsers.length-1?"1px solid #f5f0e8":"none" }}>
                  <div style={{ width:46,textAlign:"center",flexShrink:0 }}><span style={{ fontSize:i<3?22:13,fontWeight:700,color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span></div>
                  <div style={{ marginRight:14 }}><UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={44} rank={i<3?i+1:undefined} /></div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.full_name}</span>
                      {isMe&&<span style={{ fontSize:9,background:"#2d6a4f",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:800,flexShrink:0 }}>YOU</span>}
                      {perkTitle&&<span style={{ fontSize:9,background:"#fffbeb",color:"#b45309",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #fde68a",flexShrink:0 }}>{perkTitle}</span>}
                      {user.champion_title&&<span style={{ fontSize:9,background:"#fffbeb",color:"#e8a800",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0d890",flexShrink:0 }}>🏆 {user.champion_title}</span>}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:3 }}>
                      <span style={{ fontSize:11,color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10,background:lc.bg,color:lc.color,padding:"1px 7px",borderRadius:999,fontWeight:700 }}>{LEVEL_ICONS[user.level]} {user.level}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right",flexShrink:0 }}>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:i===0?"#b45309":i===1?"#94a3b8":i===2?"#92400e":"#555",lineHeight:1,marginBottom:3 }}>{user.bayesian_avg.toFixed(2)}</div>
                    <Stars value={user.bayesian_avg} size={12} />
                    <div style={{ fontSize:10,color:"#bbb",fontWeight:600,marginTop:2 }}>{user.rating_count} review{user.rating_count!==1?"s":""}</div>
                  </div>
                </a>
              );
            })
          ):(
            sorted.map((user,i)=>{
              const lc=LEVEL_COLORS[user.level]||LEVEL_COLORS.Seedling,isMe=me?.id===user.id;
              const hasMulti=user.xp_multiplier&&user.xp_multiplier>1&&user.multiplier_ends_at&&new Date(user.multiplier_ends_at)>new Date();
              return (
                <div key={user.id} className="row"
                  style={{ display:"flex",alignItems:"center",padding:"15px 24px",background:isMe?"#f0fdf4":"#fff",borderBottom:i<sorted.length-1?"1px solid #f5f0e8":"none" }}>
                  <div style={{ width:46,textAlign:"center",flexShrink:0 }}><span style={{ fontSize:i<3?22:13,fontWeight:700,color:i<3?undefined:"#ccc" }}>{medal(i+1)}</span></div>
                  <div style={{ marginRight:14 }}><UserAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} size={44} rank={i<3?i+1:undefined} /></div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7,flexWrap:"wrap" }}>
                      <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{user.full_name}</span>
                      {isMe&&<span style={{ fontSize:9,background:"#2d6a4f",color:"#fff",padding:"2px 7px",borderRadius:999,fontWeight:800 }}>YOU</span>}
                      {user.champion_title&&<span style={{ fontSize:9,background:"#fffbeb",color:"#e8a800",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0d890" }}>🏆 {user.champion_title}{user.champion_streak&&user.champion_streak>1?` ×${user.champion_streak}`:""}</span>}
                      {hasMulti&&<span className="xp-glow" style={{ fontSize:9,background:"#fdf0ee",color:"#c0392b",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #f0b8b0" }}>⚡ {user.xp_multiplier}x XP</span>}
                      {i===0&&<span style={{ fontSize:9,background:"#e8f4e8",color:"#2d6a4f",padding:"2px 7px",borderRadius:999,fontWeight:800,border:"1px solid #b7dfc8" }}>📌 Featured</span>}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:7,marginTop:3 }}>
                      <span style={{ fontSize:11,color:"#bbb" }}>@{user.username}</span>
                      <span style={{ fontSize:10,background:lc.bg,color:lc.color,padding:"1px 7px",borderRadius:999,fontWeight:700 }}>{LEVEL_ICONS[user.level]} {user.level}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#2d6a4f",lineHeight:1 }}>{user.xp.toLocaleString()}</div>
                    <div style={{ fontSize:11,color:"#aaa",marginTop:2 }}>XP</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {isRating&&!rateLoad&&ratedUsers.length>0&&(
          <p style={{ textAlign:"center",fontSize:11,color:"#ccc",fontWeight:600,marginTop:14 }}>
            Formula: (C × m + Σ ratings) ÷ (C + n) · C=5, m=3.5 (global mean)
          </p>
        )}

        {/* PREV CHAMPION */}
        {prevChamp&&isXP&&(
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