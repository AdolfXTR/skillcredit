"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

type Profile = {
  id: string; full_name: string; username: string; credits: number; xp: number;
  level: string; role: string; avatar_url?: string;
  xp_multiplier?: number; multiplier_ends_at?: string | null;
  champion_title?: string | null; champion_streak?: number;
  teaching_title?: string | null; teaching_title_ends_at?: string | null;
  rating_title?: string | null;   rating_title_ends_at?: string | null;
};
type Activity = { id: string; type: string; title: string; body: string; created_at: string; is_read: boolean; link?: string };

const BADGE_TIERS = [
  { name:"Seedling", emoji:"🌱", color:"#2d6a4f", bg:"#dcfce7", desc:"Just getting started",  xpReq:0,    sessionsReq:0  },
  { name:"Rising",   emoji:"⭐", color:"#b45309", bg:"#fef3c7", desc:"Building momentum",     xpReq:100,  sessionsReq:0  },
  { name:"Pro",      emoji:"🔥", color:"#7c3aed", bg:"#ede9fe", desc:"Proven skill sharer",   xpReq:500,  sessionsReq:5  },
  { name:"Elite",    emoji:"💎", color:"#dc2626", bg:"#fee2e2", desc:"Top performer",          xpReq:2000, sessionsReq:20 },
  { name:"Legend",   emoji:"👑", color:"#d97706", bg:"#fffbeb", desc:"Community pillar",       xpReq:5000, sessionsReq:50 },
];
function getBadgeTier(xp:number,sessions:number){
  for(let i=BADGE_TIERS.length-1;i>=0;i--){const t=BADGE_TIERS[i];if(xp>=t.xpReq&&sessions>=t.sessionsReq)return t;}
  return BADGE_TIERS[0];
}
function getNextBadge(current:typeof BADGE_TIERS[0]){
  const idx=BADGE_TIERS.findIndex(b=>b.name===current.name);
  return idx<BADGE_TIERS.length-1?BADGE_TIERS[idx+1]:null;
}
const LEVELS=[
  {name:"Seedling",    min:0,    max:99,       color:"#2d6a4f"},
  {name:"Learner",     min:100,  max:299,      color:"#1d4ed8"},
  {name:"Contributor", min:300,  max:599,      color:"#7c3aed"},
  {name:"Skilled",     min:600,  max:999,      color:"#b45309"},
  {name:"Expert",      min:1000, max:1999,     color:"#dc2626"},
  {name:"Master",      min:2000, max:3999,     color:"#0891b2"},
  {name:"Legend",      min:4000, max:Infinity, color:"#d97706"},
];
const LEVEL_ICONS:Record<string,string>={
  Seedling:"🌱",Learner:"📘",Contributor:"💡",Skilled:"⚡",Expert:"🔥",Master:"🌊",Legend:"👑",
};
const XP_TO_NEXT:Record<string,number>={
  Seedling:100,Learner:300,Contributor:600,Skilled:1000,Expert:2000,Master:4000,Legend:9999,
};
function getLevelInfo(xp:number){return LEVELS.find(l=>xp>=l.min&&xp<=l.max)||LEVELS[0];}
function timeAgo(d:string){
  const diff=Date.now()-new Date(d).getTime();
  const m=Math.floor(diff/60000);
  if(m<1)return"just now";if(m<60)return`${m}m ago`;
  const h=Math.floor(m/60);if(h<24)return`${h}h ago`;
  return`${Math.floor(h/24)}d ago`;
}
function getTimeLeft(endsAt:string){
  const diff=new Date(endsAt).getTime()-Date.now();
  if(diff<=0)return null;
  const d=Math.floor(diff/86400000);const h=Math.floor((diff%86400000)/3600000);
  return d>0?`${d}d ${h}h left`:`${h}h left`;
}
function getWeekResetCountdown(){
  const now=new Date();const day=now.getUTCDay();
  const daysUntilMonday=day===0?1:8-day;
  const next=new Date(now);next.setUTCDate(now.getUTCDate()+daysUntilMonday);next.setUTCHours(0,0,0,0);
  const diff=next.getTime()-now.getTime();
  const d=Math.floor(diff/86400000);const h=Math.floor((diff%86400000)/3600000);
  return`${d}d ${h}h`;
}
function isTitleActive(endsAt?:string|null){return!!endsAt&&new Date(endsAt)>new Date();}

const ACTIVITY_ICONS:Record<string,string>={
  achievement:"🏆",platform:"📢",session:"📅",payment:"💰",
  message:"💬",review:"⭐",credit:"💰",dispute:"⚠️",bounty:"🎯",
  forum_earn:"⭐",rating:"⭐",session_call:"📹",
};
const QUICK_ACTIONS=[
  {icon:"🔍",label:"Browse Skills",  desc:"Find a teacher",   href:"/listings",        color:"#2d6a4f",bg:"#f0fdf4"},
  {icon:"🎯",label:"Post Bounty",    desc:"Get help fast",    href:"/bounties",        color:"#b45309",bg:"#fffbeb"},
  {icon:"🎓",label:"Create Listing", desc:"Start teaching",   href:"/listings/create", color:"#7c3aed",bg:"#f5f3ff"},
];
const SECONDARY_ACTIONS=[
  {icon:"💬",label:"Community", href:"/community",      color:"#0891b2"},
  {icon:"📅",label:"Sessions",  href:"/sessions",       color:"#6366f1"},
  {icon:"✉️",label:"Messages",  href:"/messages",       color:"#ec4899"},
  {icon:"✅",label:"Get Verified",href:"/verify",       color:"#16a34a"},
  {icon:"⭐",label:"My Ratings", href:"/ratings",       color:"#f59e0b"},
];

export default function Dashboard() {
  const [profile,setProfile]                 = useState<Profile|null>(null);
  const [activities,setActivities]           = useState<Activity[]>([]);
  const [loading,setLoading]                 = useState(true);
  const [greeting,setGreeting]               = useState("Good day");
  const [greetingEmoji,setGreetingEmoji]     = useState("☀️");
  const [showMenu,setShowMenu]               = useState(false);
  const [unread,setUnread]                   = useState(0);
  const [sessions,setSessions]               = useState(0);
  const [pendingSessions,setPendingSessions] = useState(0);
  const [bountiesWon,setBountiesWon]         = useState(0);
  const [avgRating,setAvgRating]             = useState<number|null>(null);
  const [ratingCount,setRatingCount]         = useState(0);
  const [repeatClients,setRepeatClients]     = useState(0);
  const [disputes,setDisputes]               = useState(0);
  const [weekReset,setWeekReset]             = useState("");

  useEffect(()=>{
    const h=new Date().getHours();
    if(h<12){setGreeting("Good morning");setGreetingEmoji("☀️");}
    else if(h<18){setGreeting("Good afternoon");setGreetingEmoji("⛅");}
    else{setGreeting("Good evening");setGreetingEmoji("🌙");}
    setWeekReset(getWeekResetCountdown());

    const load=async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){window.location.href="/login";return;}

      const{data:p}=await supabase.from("profiles")
        .select("*,xp_multiplier,multiplier_ends_at,champion_title,champion_streak,teaching_title,teaching_title_ends_at,rating_title,rating_title_ends_at")
        .eq("id",user.id).single();
      if(p)setProfile(p);

      const{count:nCount}=await supabase.from("notifications")
        .select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("is_read",false);
      setUnread(nCount||0);

      const{data:acts}=await supabase.from("notifications").select("*")
        .eq("user_id",user.id).order("created_at",{ascending:false}).limit(6);
      setActivities((acts as Activity[])||[]);

      const{count:sCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true})
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status","completed");
      setSessions(sCount||0);

      const{count:pendingCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","pending");
      setPendingSessions(pendingCount||0);

      const{count:bCount}=await supabase.from("bounty_answers")
        .select("*",{count:"exact",head:true}).eq("answerer_id",user.id).not("placement","is",null);
      setBountiesWon(bCount||0);

      const{data:ratingData}=await supabase.from("ratings")
        .select("overall").eq("rated_id",user.id).eq("is_flagged",false);
      if(ratingData&&ratingData.length>0){
        const raw=ratingData.map((r:{overall:number})=>r.overall);
        setAvgRating(parseFloat(bayesianAvg(raw).toFixed(2)));
        setRatingCount(raw.length);
      }

      const{data:sessionData}=await supabase.from("sessions")
        .select("learner_id").eq("teacher_id",user.id).eq("status","completed");
      if(sessionData){
        const counts:Record<string,number>={};
        sessionData.forEach((s:{learner_id:string})=>{counts[s.learner_id]=(counts[s.learner_id]||0)+1;});
        setRepeatClients(Object.values(counts).filter(c=>c>1).length);
      }

      const{count:dCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","disputed");
      setDisputes(dCount||0);

      setLoading(false);
    };
    load();
  },[]);

  const handleLogout=async()=>{await supabase.auth.signOut();window.location.href="/";};

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#f8f7f4",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16,animation:"pulse 1.5s ease infinite"}}>🌱</div>
        <p style={{color:"#aaa",fontSize:14}}>Loading your dashboard…</p>
      </div>
    </div>
  );
  if(!profile)return null;

  const levelInfo  = getLevelInfo(profile.xp);
  const badge      = getBadgeTier(profile.xp,sessions);
  const nextBadge  = getNextBadge(badge);
  const initials   = profile.full_name?.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)||"??";
  const xpNext     = XP_TO_NEXT[levelInfo.name]||100;
  const xpPct      = Math.min((profile.xp/xpNext)*100,100);
  const avatarUrl  = profile.avatar_url||null;
  const firstName  = profile.full_name.split(" ")[0];

  // Perk states
  const hasMulti       = !!(profile.xp_multiplier&&profile.xp_multiplier>1&&profile.multiplier_ends_at&&new Date(profile.multiplier_ends_at)>new Date());
  const hasChampion    = !!profile.champion_title;
  const hasTeaching    = isTitleActive(profile.teaching_title_ends_at)&&!!profile.teaching_title;
  const hasRating      = isTitleActive(profile.rating_title_ends_at)&&!!profile.rating_title;
  const hasAnyPerk     = hasMulti||hasChampion||hasTeaching||hasRating;
  const multiTimeLeft  = hasMulti&&profile.multiplier_ends_at?getTimeLeft(profile.multiplier_ends_at):null;
  const teachTimeLeft  = hasTeaching&&profile.teaching_title_ends_at?getTimeLeft(profile.teaching_title_ends_at):null;
  const rateTimeLeft   = hasRating&&profile.rating_title_ends_at?getTimeLeft(profile.rating_title_ends_at):null;

  // Rank border
  const rankFromTitle = profile.champion_title?.includes("Champion")?1:profile.champion_title?.includes("Runner")?2:profile.champion_title?.includes("Third")?3:0;
  const rankBorderColor = rankFromTitle===1?"#e8a800":rankFromTitle===2?"#c0c0c0":rankFromTitle===3?"#cd7f32":null;

  // Rep
  const ratingPts  = avgRating?Math.min(Math.round(avgRating*sessions*4),80):0;
  const sessionPts = Math.min(sessions*2,15);
  const repeatPts  = Math.min(repeatClients*5,10);
  const disputePts = disputes*-15;
  const rep        = Math.max(0,Math.min(ratingPts+sessionPts+repeatPts+disputePts,100));
  const repLabel   = rep>=80?"Exceptional":rep>=60?"Great":rep>=40?"Good":rep>=20?"Fair":"Building";
  const ratingDisplay  = avgRating!==null?avgRating.toFixed(2):"—";
  const ratingSubLabel = avgRating!==null?`${ratingCount} review${ratingCount!==1?"s":""}`:"No ratings yet";

  return(
    <div style={{minHeight:"100vh",background:"#f8f7f4",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes xpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.02)}}
        @keyframes goldSpin{0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 18px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.8)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 14px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e0e0e0,0 0 22px rgba(200,200,200,.6)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 14px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 22px rgba(232,160,80,.5)}}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9;box-shadow:0 2px 12px rgba(0,0,0,.03)}
        .action-card{transition:all .15s;cursor:pointer;border-radius:16px;border:1.5px solid #e8e2d9;padding:18px;display:flex;flex-direction:column;gap:8px;background:#fafaf8}
        .action-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(0,0,0,.09)}
        .secondary-card{transition:all .15s;cursor:pointer;border-radius:13px;border:1.5px solid #e8e2d9;padding:11px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;background:#fafaf8;text-align:center}
        .secondary-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.07)}
        .stat-card{transition:all .15s}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.07)}
        .xp-bar{background:linear-gradient(90deg,#2d6a4f,#52b788,#84cc9e);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:all .12s}
        .nav-a:hover{background:#eee9e0;color:#1a1a1a}
        .menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;transition:all .12s;cursor:pointer}
        .menu-item:hover{background:#f5f0e8;color:#1a1a1a}
        .rep-bar{border-radius:999px;height:5px}
        .gold-avatar{animation:goldSpin 2s ease infinite}
        .silver-avatar{animation:silverPulse 2s ease infinite}
        .bronze-avatar{animation:bronzePulse 2s ease infinite}
        .multi-badge{animation:xpPulse 1.5s ease infinite}
        .perk-banner{border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:12px}
        @media(max-width:900px){.main-grid{grid-template-columns:1fr!important}.stats-row{grid-template-columns:repeat(3,1fr)!important}.sidebar{display:none!important}}
        @media(max-width:600px){.stats-row{grid-template-columns:repeat(2,1fr)!important}.nav-links{display:none!important}}
      `}</style>

      {/* NAVBAR */}
      <nav style={{background:"rgba(255,255,255,.96)",backdropFilter:"blur(16px)",borderBottom:"1px solid #e8e2d9",padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <a href="/dashboard">
          <span style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#2d6a4f"}}>Skill</span>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a"}}>Credit</span>
        </a>
        <div className="nav-links" style={{display:"flex",gap:2}}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h])=>(
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <a href="/wallet" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:999,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:"1.5px solid #86efac",fontSize:13,fontWeight:800,color:"#2d6a4f"}}>
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" style={{position:"relative",width:36,height:36,borderRadius:"50%",background:"#f5f0e8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
            🔔
            {unread>0&&(
              <span style={{position:"absolute",top:-2,right:-2,minWidth:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:"2px solid white"}}>
                {unread}
              </span>
            )}
          </a>
          <div style={{position:"relative"}} onClick={e=>{e.stopPropagation();setShowMenu(m=>!m);}}>
            <div className={rankFromTitle===1?"gold-avatar":rankFromTitle===2?"silver-avatar":rankFromTitle===3?"bronze-avatar":""}
              style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",cursor:"pointer",
                background:avatarUrl?"transparent":levelInfo.color,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:rankBorderColor?undefined:`0 0 0 2px white, 0 0 0 3.5px ${levelInfo.color}`}}>
              {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{color:"#fff",fontSize:12,fontWeight:900}}>{initials}</span>}
            </div>
            {showMenu&&(
              <div style={{position:"absolute",right:0,top:44,background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:18,padding:8,width:210,boxShadow:"0 16px 48px rgba(0,0,0,.15)",zIndex:200}}>
                <div style={{padding:"10px 12px 12px",borderBottom:"1px solid #f0ece4",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:avatarUrl?"transparent":levelInfo.color,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{color:"#fff",fontSize:11,fontWeight:900}}>{initials}</span>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:"#1a1a1a"}}>{profile.full_name}</div>
                      <div style={{fontSize:11,color:"#aaa"}}>@{profile.username} · <span style={{color:badge.color,fontWeight:700}}>{badge.emoji} {badge.name}</span></div>
                    </div>
                  </div>
                </div>
                {[["👤","My Profile","/profile"],["👥","People","/people"],["📋","Create Listing","/listings/create"],["✅","Get Verified","/verify"],["⭐","My Ratings","/ratings"],["💰","Wallet","/wallet"],["🏆","Leaderboard","/leaderboard"],["🔔","Notifications","/notifications"]].map(([icon,label,href])=>(
                  <a key={label} href={href} className="menu-item">{icon} {label}</a>
                ))}
                <div style={{borderTop:"1px solid #f0ece4",marginTop:6,paddingTop:6}}>
                  <button onClick={handleLogout} className="menu-item" style={{width:"100%",background:"none",border:"none",color:"#ef4444",fontFamily:"'DM Sans',sans-serif"}}>🚪 Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px"}}>

        {/* PENDING ALERT */}
        {pendingSessions>0&&(
          <a href="/sessions" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(90deg,#fffbeb,#fef3c7)",border:"1.5px solid #fde68a",borderRadius:16,padding:"12px 18px",marginBottom:12,gap:12,animation:"fadeUp .3s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⏳</span>
              <span style={{fontSize:13,fontWeight:800,color:"#92400e"}}>{pendingSessions} pending session request{pendingSessions>1?"s":""} awaiting your response</span>
            </div>
            <div style={{background:"#f59e0b",color:"#fff",padding:"6px 16px",borderRadius:99,fontSize:12,fontWeight:800,whiteSpace:"nowrap" as const,flexShrink:0}}>Review →</div>
          </a>
        )}



        {/* HERO CARD */}
        <div className="card" style={{padding:"24px 28px",marginBottom:14,animation:"fadeUp .4s ease",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:rankBorderColor?`linear-gradient(90deg,${rankBorderColor},${rankBorderColor}66)`:`linear-gradient(90deg,${levelInfo.color},${levelInfo.color}66)`,borderRadius:"20px 20px 0 0"}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap" as const,gap:20}}>

            {/* Left: avatar + name */}
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div className={rankFromTitle===1?"gold-avatar":rankFromTitle===2?"silver-avatar":rankFromTitle===3?"bronze-avatar":""}
                  style={{width:62,height:62,borderRadius:"50%",overflow:"hidden",
                    background:avatarUrl?"transparent":`linear-gradient(135deg,${levelInfo.color},${levelInfo.color}88)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:rankBorderColor?undefined:`0 8px 24px ${levelInfo.color}44`}}>
                  {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:22,fontWeight:900,color:"#fff"}}>{initials}</span>}
                </div>
                <div style={{position:"absolute",bottom:-2,right:-2,background:"#fff",borderRadius:"50%",padding:2,fontSize:14,lineHeight:1}}>
                  {rankFromTitle===1?"👑":rankFromTitle===2?"🥈":rankFromTitle===3?"🥉":LEVEL_ICONS[levelInfo.name]}
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:"#bbb",fontWeight:700,marginBottom:3}}>{greeting}, {firstName} {greetingEmoji}</div>
                <h1 style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:"#111",lineHeight:1.1,marginBottom:8}}>{profile.full_name}</h1>

                {/* PRIMARY badges */}
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const,marginBottom:5}}>
                  {hasChampion&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#fffbeb",color:"#e8a800",border:"1px solid #f0d890"}}>
                    {rankFromTitle===1?"👑":rankFromTitle===2?"🥈":"🥉"} {profile.champion_title}
                  </span>}
                  {hasTeaching&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe"}}>{profile.teaching_title}</span>}
                  {hasRating&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a"}}>{profile.rating_title}</span>}
                  {hasMulti&&<span className="multi-badge" style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#fdf0ee",color:"#c0392b",border:"1px solid #f0b8b0"}}>⚡ {profile.xp_multiplier}x XP</span>}
                </div>

                {/* SECONDARY — muted */}
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                  <span style={{fontSize:11,color:"#aaa"}}>@{profile.username}</span>
                  <span style={{fontSize:11,color:"#ccc"}}>·</span>
                  <span style={{fontSize:11,fontWeight:700,color:badge.color}}>{badge.emoji} {badge.name}</span>
                  <span style={{fontSize:11,color:"#ccc"}}>·</span>
                  <span style={{fontSize:11,fontWeight:600,color:levelInfo.color}}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
                  {avgRating!==null&&<><span style={{fontSize:11,color:"#ccc"}}>·</span><span style={{fontSize:11,fontWeight:600,color:"#b45309"}}>⭐ {avgRating.toFixed(2)}</span></>}
                </div>
              </div>
            </div>

            {/* Right: XP bar */}
            <div style={{minWidth:240,flex:"0 0 240px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
                <div>
                  <div style={{fontSize:11,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".06em"}}>Level Progress</div>
                  <div style={{fontSize:13,fontWeight:800,color:levelInfo.color,marginTop:2}}>{levelInfo.name}</div>
                </div>
                <div style={{textAlign:"right" as const}}>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:"#111"}}>{profile.xp.toLocaleString()}</span>
                  <span style={{fontSize:12,color:"#aaa"}}> / {xpNext.toLocaleString()} XP</span>
                </div>
              </div>
              <div style={{height:8,background:"#f0ece4",borderRadius:999,overflow:"hidden",marginBottom:6}}>
                <div className="xp-bar" style={{width:`${xpPct}%`,transition:"width 1s ease"}}/>
              </div>
              <div style={{fontSize:11,color:"#888",fontWeight:700}}>
                {Math.max(0,xpNext-profile.xp)>0?`🔥 ${(xpNext-profile.xp).toLocaleString()} XP to next level`:"🎉 Max level reached!"}
                {hasMulti&&<span style={{marginLeft:8,color:"#c0392b",fontWeight:800}}>· ⚡ {multiTimeLeft}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* STATS ROW */}
        <div className="stats-row" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:14,animation:"fadeUp .4s .07s ease both"}}>
          {[
            {icon:"💰",label:"Credits",     value:profile.credits,sub:"in wallet",   color:"#2d6a4f",bg:"#f0fdf4",href:"/wallet"},
            {icon:"⚡",label:"XP Earned",   value:profile.xp,     sub:levelInfo.name,color:"#7c3aed",bg:"#f5f3ff",href:"/leaderboard"},
            {icon:"📅",label:"Sessions",    value:sessions,        sub:"completed",   color:"#0891b2",bg:"#e0f2fe",href:"/sessions"},
            {icon:"🏆",label:"Bounties Won",value:bountiesWon,     sub:"solved",      color:"#b45309",bg:"#fffbeb",href:"/bounties"},
          ].map(s=>(
            <a key={s.label} href={s.href} className="card stat-card" style={{padding:"18px 16px",display:"block"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:28,height:28,borderRadius:8,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{s.icon}</div>
                <span style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".05em"}}>{s.label}</span>
              </div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10,color:"#bbb",fontWeight:600,marginTop:4}}>{s.sub}</div>
            </a>
          ))}
          <a href="/ratings" className="card stat-card" style={{padding:"18px 16px",display:"block"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:28,height:28,borderRadius:8,background:"#fffbeb",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⭐</div>
              <span style={{fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".05em"}}>Rating</span>
            </div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:900,color:avgRating!==null?"#f59e0b":"#d1cec8",lineHeight:1}}>{ratingDisplay}</div>
            <div style={{fontSize:10,color:"#bbb",fontWeight:600,marginTop:4}}>{ratingSubLabel}</div>
          </a>
        </div>

        {/* MAIN GRID */}
        <div className="main-grid" style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,animation:"fadeUp .4s .1s ease both"}}>
          <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>

            {/* QUICK ACTIONS */}
            <div className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h2 style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:900,color:"#1a1a1a"}}>Quick Actions</h2>
                <a href="/leaderboard" style={{fontSize:11,color:"#2d6a4f",fontWeight:700,background:"#f0fdf4",padding:"5px 12px",borderRadius:99,border:"1px solid #86efac"}}>🏆 Leaderboard →</a>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
                {QUICK_ACTIONS.map(a=>(
                  <a key={a.label} href={a.href} className="action-card" style={{background:a.bg,borderColor:`${a.color}22`}}>
                    <div style={{width:40,height:40,borderRadius:12,background:`${a.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{a.icon}</div>
                    <div style={{fontSize:14,fontWeight:900,color:a.color}}>{a.label}</div>
                    <div style={{fontSize:12,color:"#888"}}>{a.desc}</div>
                  </a>
                ))}
              </div>
              <div style={{borderTop:"1px dashed #e8e2d9",paddingTop:12}}>
                <div style={{fontSize:10,color:"#ccc",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:10}}>More</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {SECONDARY_ACTIONS.map(a=>(
                    <a key={a.label} href={a.href} className="secondary-card">
                      <span style={{fontSize:18}}>{a.icon}</span>
                      <span style={{fontSize:11,fontWeight:700,color:a.color}}>{a.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* RECENT ACTIVITY */}
            <div className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                <div>
                  <h2 style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:900,color:"#1a1a1a"}}>Recent Activity</h2>
                  {unread>0&&<span style={{fontSize:11,color:"#2d6a4f",fontWeight:700}}>{unread} unread</span>}
                </div>
                <a href="/notifications" style={{fontSize:12,color:"#2d6a4f",fontWeight:700}}>View all →</a>
              </div>
              {activities.length===0?(
                <div style={{textAlign:"center" as const,padding:"28px 0"}}>
                  <div style={{fontSize:36,marginBottom:8}}>🌱</div>
                  <p style={{fontSize:13,color:"#aaa",marginBottom:16}}>No activity yet — complete a session to get started!</p>
                  <a href="/listings" style={{display:"inline-block",padding:"9px 22px",background:"#2d6a4f",color:"#fff",borderRadius:999,fontSize:13,fontWeight:700}}>Browse Skills →</a>
                </div>
              ):activities.map((act,idx)=>{
                const icon=ACTIVITY_ICONS[act.type]||"📌";
                const cleanBody=act.body&&!act.body.trim().startsWith("{")&&act.body.length<120?act.body:"";
                return(
                  <div key={act.id} style={{display:"flex",gap:12,padding:"13px 10px",borderBottom:idx<activities.length-1?"1px solid #f5f0e8":"none",alignItems:"flex-start",borderLeft:act.is_read?"none":"3px solid #2d6a4f",paddingLeft:act.is_read?10:13,marginLeft:act.is_read?0:-3}}>
                    <div style={{width:38,height:38,borderRadius:12,background:"#f5f0e8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:3}}>
                        <div style={{fontSize:13,fontWeight:act.is_read?600:800,color:"#1a1a1a",lineHeight:1.35}}>{act.title}</div>
                        <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                          {!act.is_read&&<div style={{width:7,height:7,borderRadius:"50%",background:"#2d6a4f"}}/>}
                          <span style={{fontSize:10,color:"#ccc",fontWeight:600,whiteSpace:"nowrap" as const}}>{timeAgo(act.created_at)}</span>
                        </div>
                      </div>
                      {cleanBody&&<div style={{fontSize:12,color:"#888",lineHeight:1.5}}>{cleanBody}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="sidebar" style={{display:"flex",flexDirection:"column" as const,gap:14}}>

            {/* ACTIVE PERKS CARD — only shown when user has perks */}
            {hasAnyPerk&&(
              <div className="card" style={{padding:"20px",border:"1.5px solid #e8a80044",background:"linear-gradient(135deg,#fffdf5,#fff)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:800,color:"#b45309",letterSpacing:".1em",textTransform:"uppercase" as const}}>🏆 Active Perks</div>
                  <a href="/leaderboard" style={{fontSize:10,color:"#2d6a4f",fontWeight:700}}>View →</a>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {hasChampion&&(
                    <div style={{background:"linear-gradient(135deg,#1a3d1a,#2d6a4f)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:18}}>{rankFromTitle===1?"👑":rankFromTitle===2?"🥈":"🥉"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.champion_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>XP Leaderboard</div>
                      </div>
                    </div>
                  )}
                  {hasMulti&&(
                    <div className="multi-badge" style={{background:"linear-gradient(135deg,#3b0a0a,#c0392b)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:18}}>⚡</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.xp_multiplier}x XP Multiplier</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>{multiTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  {hasTeaching&&(
                    <div style={{background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:18}}>🎓</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.teaching_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>Teaching Activity · {teachTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  {hasRating&&(
                    <div style={{background:"linear-gradient(135deg,#3b2000,#92400e)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:18}}>⭐</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.rating_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>Student Ratings · {rateTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  <div style={{marginTop:4,padding:"8px 12px",background:"#f5f0e8",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#888",fontWeight:600}}>Week resets in</span>
                    <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:900,color:"#b45309"}}>{weekReset}</span>
                  </div>
                </div>
              </div>
            )}

            {/* WALLET */}
            <a href="/wallet" style={{display:"block",background:"linear-gradient(135deg,#1a4a36,#2d6a4f 60%,#3a8a63)",borderRadius:20,padding:"22px",color:"#fff",position:"relative",overflow:"hidden",boxShadow:"0 8px 28px rgba(45,106,79,.3)",transition:"transform .15s"}}
              onMouseOver={e=>(e.currentTarget.style.transform="translateY(-2px)")}
              onMouseOut={e=>(e.currentTarget.style.transform="translateY(0)")}>
              <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
              <p style={{fontSize:10,fontWeight:700,opacity:.6,marginBottom:3,letterSpacing:".1em",textTransform:"uppercase" as const}}>💰 Your Wallet</p>
              <p style={{fontFamily:"'Fraunces',serif",fontSize:42,fontWeight:900,lineHeight:1,marginBottom:2}}>{profile.credits}</p>
              <p style={{fontSize:13,opacity:.6,marginBottom:18}}>credits · ₱{profile.credits*10} value</p>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,background:"#fff",color:"#2d6a4f",textAlign:"center" as const,padding:"10px",borderRadius:12,fontSize:12,fontWeight:900}}>+ Top Up</div>
                <div style={{flex:1,background:"rgba(255,255,255,.1)",color:"#fff",textAlign:"center" as const,padding:"10px",borderRadius:12,fontSize:12,fontWeight:700,border:"1px solid rgba(255,255,255,.2)"}}>History</div>
              </div>
            </a>

            {/* BADGE & LEVEL */}
            <div className="card" style={{padding:"20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:800,color:"#bbb",letterSpacing:".1em",textTransform:"uppercase" as const}}>Badge & Level</div>
                <span style={{fontSize:11,fontWeight:800,padding:"4px 10px",borderRadius:999,background:`${levelInfo.color}15`,color:levelInfo.color}}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
              </div>
              <div style={{background:badge.bg,borderRadius:14,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:32}}>{badge.emoji}</span>
                <div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:badge.color}}>{badge.name}</div>
                  <div style={{fontSize:12,color:badge.color,opacity:.75}}>{badge.desc}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                {[
                  {icon:"⚡",val:profile.xp,  label:"XP"},
                  {icon:"📚",val:sessions,     label:"Sessions"},
                  {icon:"⭐",val:ratingDisplay,label:"Rating"},
                ].map(s=>(
                  <div key={s.label} style={{background:"#f8f7f4",borderRadius:10,padding:"10px 8px",textAlign:"center" as const}}>
                    <div style={{fontSize:15,marginBottom:3}}>{s.icon}</div>
                    <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#1a1a1a"}}>{s.val}</div>
                    <div style={{fontSize:10,color:"#aaa",fontWeight:700,textTransform:"uppercase" as const}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {nextBadge&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:12}}>
                    <span style={{fontWeight:700,color:"#555"}}>Next: {nextBadge.emoji} {nextBadge.name}</span>
                    <span style={{color:"#aaa"}}>{nextBadge.desc}</span>
                  </div>
                  {[
                    {icon:"⚡",label:"XP",      current:profile.xp,req:nextBadge.xpReq},
                    {icon:"📚",label:"Sessions",current:sessions,   req:nextBadge.sessionsReq},
                  ].filter(r=>r.req>0).map(r=>{
                    const done=r.current>=r.req;const pct=Math.min((r.current/r.req)*100,100);
                    return(
                      <div key={r.label} style={{marginBottom:9}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
                          <span style={{color:"#666",fontWeight:600}}>{r.icon} {r.label}</span>
                          <span style={{color:done?"#2d6a4f":"#aaa",fontWeight:700}}>{done?"✓ Done":`${r.current} / ${r.req}`}</span>
                        </div>
                        <div style={{height:5,background:"#f0ece4",borderRadius:999,overflow:"hidden"}}>
                          <div className="rep-bar" style={{width:`${pct}%`,background:done?"#2d6a4f":"#d4cec7"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginTop:12,paddingTop:12,borderTop:"1px solid #f0ece4"}}>
                <div style={{fontSize:10,fontWeight:800,color:"#ccc",width:"100%",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:4}}>All Levels</div>
                {LEVELS.map(t=>(
                  <span key={t.name} style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:999,
                    background:t.name===levelInfo.name?`${t.color}18`:"#f5f0e8",
                    color:t.name===levelInfo.name?t.color:"#bbb",
                    border:t.name===levelInfo.name?`1px solid ${t.color}33`:"none"}}>
                    {LEVEL_ICONS[t.name]} {t.name}
                  </span>
                ))}
              </div>
            </div>

            {/* REPUTATION */}
            <div className="card" style={{padding:"20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:800,color:"#bbb",letterSpacing:".1em",textTransform:"uppercase" as const}}>Reputation</div>
                <span style={{fontSize:12,fontWeight:800,color:"#b45309",background:"#fffbeb",padding:"3px 10px",borderRadius:99,border:"1px solid #fde68a"}}>{repLabel}</span>
              </div>
              <div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",borderRadius:14,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>💫</span>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:900,color:"#b45309",lineHeight:1}}>{rep}<span style={{fontSize:14,color:"#daa520"}}>/100</span></div>
                </div>
                <svg viewBox="0 0 52 52" style={{width:52,height:52,transform:"rotate(-90deg)",flexShrink:0}}>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5"/>
                  <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep,100)/100)*131.9} 131.9`} strokeLinecap="round"/>
                </svg>
              </div>
              {[
                {icon:"⭐",label:"Rating",  pts:ratingPts, max:80,detail:avgRating!==null?`${avgRating.toFixed(2)} avg × ${sessions} sessions`:"No ratings yet",color:"#f59e0b"},
                {icon:"📚",label:"Sessions",pts:sessionPts,max:15,detail:`${sessions} × 2 pts`,color:"#2d6a4f"},
                {icon:"🔄",label:"Repeats", pts:repeatPts, max:10,detail:`${repeatClients} repeat clients × 5`,color:"#6366f1"},
                {icon:"⚠️",label:"Disputes",pts:disputePts,max:0, detail:disputes===0?"No disputes ✓":`${disputes} × -15 pts`,color:disputes>0?"#dc2626":"#aaa"},
              ].map(r=>(
                <div key={r.label} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#333"}}>{r.icon} {r.label}</span>
                    <span style={{fontSize:13,fontWeight:800,color:r.pts>0?"#2d6a4f":r.pts<0?"#dc2626":"#aaa"}}>
                      {r.pts>0?`+${r.pts}`:r.pts<0?`${r.pts}`:"✓"}{r.pts!==0?" pts":""}
                    </span>
                  </div>
                  <div style={{fontSize:11,color:"#bbb",marginBottom:r.max>0?4:0}}>{r.detail}</div>
                  {r.max>0&&(
                    <div style={{height:5,background:"#f0ece4",borderRadius:999,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min((r.pts/r.max)*100,100)}%`,background:r.color,borderRadius:999}}/>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* LEADERBOARD CTA */}
            <a href="/leaderboard" style={{display:"block",background:"linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)",borderRadius:20,padding:"20px",color:"#fff",transition:"transform .15s",boxShadow:"0 8px 28px rgba(67,56,202,.3)"}}
              onMouseOver={e=>(e.currentTarget.style.transform="translateY(-2px)")}
              onMouseOut={e=>(e.currentTarget.style.transform="translateY(0)")}>
              <div style={{fontSize:10,fontWeight:800,opacity:.5,textTransform:"uppercase" as const,letterSpacing:".1em",marginBottom:10}}>🏆 Weekly Leaderboard</div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,marginBottom:4}}>Compete for #1 👑</div>
              <div style={{fontSize:12,opacity:.6,marginBottom:14}}>Top 3 earn credits, XP boosts + titles every week.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                {[
                  {emoji:"🥇",label:"#1",reward:"+20cr · 1.25x"},
                  {emoji:"🥈",label:"#2",reward:"+10cr · 1.15x"},
                  {emoji:"🥉",label:"#3",reward:"+5cr · 1.10x"},
                ].map(r=>(
                  <div key={r.label} style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"8px 6px",textAlign:"center" as const}}>
                    <div style={{fontSize:14}}>{r.emoji}</div>
                    <div style={{fontSize:11,fontWeight:900,marginTop:2}}>{r.label}</div>
                    <div style={{fontSize:9,opacity:.6,marginTop:1}}>{r.reward}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.08)",borderRadius:12,padding:"10px 14px"}}>
                <div style={{fontSize:11,opacity:.6}}>Resets in</div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#fbbf24"}}>{weekReset}</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}