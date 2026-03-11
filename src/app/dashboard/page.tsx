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
  { name:"Seedling", emoji:"🌱", color:"#16a34a", bg:"#f0fdf4", desc:"Just getting started",  xpReq:0,    sessionsReq:0  },
  { name:"Rising",   emoji:"⭐", color:"#b45309", bg:"#fffbeb", desc:"Building momentum",     xpReq:100,  sessionsReq:0  },
  { name:"Pro",      emoji:"🔥", color:"#7c3aed", bg:"#f5f3ff", desc:"Proven skill sharer",   xpReq:500,  sessionsReq:5  },
  { name:"Elite",    emoji:"💎", color:"#0369a1", bg:"#e0f2fe", desc:"Top performer",          xpReq:2000, sessionsReq:20 },
  { name:"Legend",   emoji:"👑", color:"#b45309", bg:"#fffbeb", desc:"Community pillar",       xpReq:5000, sessionsReq:50 },
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
  {name:"Seedling",    min:0,    max:99,       color:"#16a34a"},
  {name:"Learner",     min:100,  max:299,      color:"#2563eb"},
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

const ACTIVITY_CFG:Record<string,{icon:string;bg:string}> = {
  session:     {icon:"📅",bg:"#e0f2fe"},
  session_call:{icon:"📹",bg:"#e0e7ff"},
  message:     {icon:"💬",bg:"#f5f3ff"},
  credit:      {icon:"💰",bg:"#f0fdf4"},
  forum_earn:  {icon:"⭐",bg:"#fffbeb"},
  achievement: {icon:"🏆",bg:"#fffbeb"},
  platform:    {icon:"📢",bg:"#f1f5f9"},
  rating:      {icon:"⭐",bg:"#fffbeb"},
  review:      {icon:"⭐",bg:"#fffbeb"},
  dispute:     {icon:"⚠️",bg:"#fee2e2"},
  bounty:      {icon:"🎯",bg:"#fffbeb"},
};

const QUICK_ACTIONS=[
  {icon:"🔍",label:"Browse Skills",  desc:"Find a teacher in seconds",  href:"/listings"},
  {icon:"🎯",label:"Post Bounty",    desc:"Get expert help fast",        href:"/bounties"},
  {icon:"🎓",label:"Start Teaching", desc:"Create your first listing",   href:"/listings/create"},
];
const SECONDARY_ACTIONS=[
  {icon:"💬",label:"Community", href:"/community"},
  {icon:"📅",label:"Sessions",  href:"/sessions"},
  {icon:"✉️",label:"Messages",  href:"/messages"},
  {icon:"✅",label:"Verify",    href:"/verify"},
  {icon:"⭐",label:"Ratings",   href:"/ratings"},
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
  const [todaySession,setTodaySession]       = useState(false);
  const [dayStreak,setDayStreak]             = useState(0);

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
        .eq("user_id",user.id).order("created_at",{ascending:false}).limit(8);
      setActivities((acts as Activity[])||[]);

      const{count:sCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true})
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status","completed");
      setSessions(sCount||0);

      const{count:pendingCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","pending");
      setPendingSessions(pendingCount||0);

      const todayMidnight=new Date();todayMidnight.setHours(0,0,0,0);
      const{count:todayCount}=await supabase.from("sessions")
        .select("*",{count:"exact",head:true})
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status","completed").gte("updated_at",todayMidnight.toISOString());
      setTodaySession((todayCount||0)>0);

      const thirtyDaysAgo=new Date();thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
      const{data:recentSessions}=await supabase.from("sessions").select("updated_at")
        .or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`)
        .eq("status","completed").gte("updated_at",thirtyDaysAgo.toISOString())
        .order("updated_at",{ascending:false});
      if(recentSessions&&recentSessions.length>0){
        const dates=new Set(recentSessions.map((s:any)=>new Date(s.updated_at).toISOString().split("T")[0]));
        let streak=0;const check=new Date();
        if(!dates.has(check.toISOString().split("T")[0]))check.setDate(check.getDate()-1);
        while(streak<=30){const ds=check.toISOString().split("T")[0];if(!dates.has(ds))break;streak++;check.setDate(check.getDate()-1);}
        setDayStreak(streak);
      }

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
    <div style={{minHeight:"100vh",background:"#F7F4EF",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16,animation:"pulse 1.5s ease infinite"}}>🌱</div>
        <p style={{color:"#98A2B3",fontSize:14}}>Loading your dashboard…</p>
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

  const hasMulti      = !!(profile.xp_multiplier&&profile.xp_multiplier>1&&profile.multiplier_ends_at&&new Date(profile.multiplier_ends_at)>new Date());
  const hasChampion   = !!profile.champion_title;
  const hasTeaching   = isTitleActive(profile.teaching_title_ends_at)&&!!profile.teaching_title;
  const hasRating     = isTitleActive(profile.rating_title_ends_at)&&!!profile.rating_title;
  const hasAnyPerk    = hasMulti||hasChampion||hasTeaching||hasRating;
  const multiTimeLeft = hasMulti&&profile.multiplier_ends_at?getTimeLeft(profile.multiplier_ends_at):null;
  const teachTimeLeft = hasTeaching&&profile.teaching_title_ends_at?getTimeLeft(profile.teaching_title_ends_at):null;
  const rateTimeLeft  = hasRating&&profile.rating_title_ends_at?getTimeLeft(profile.rating_title_ends_at):null;

  const rankFromTitle = profile.champion_title?.includes("Champion")?1:profile.champion_title?.includes("Runner")?2:profile.champion_title?.includes("Third")?3:0;
  const rankBorderColor = rankFromTitle===1?"#e8a800":rankFromTitle===2?"#c0c0c0":rankFromTitle===3?"#cd7f32":null;

  const ratingPts  = avgRating?Math.min(Math.round(avgRating*sessions*4),80):0;
  const sessionPts = Math.min(sessions*2,15);
  const repeatPts  = Math.min(repeatClients*5,10);
  const disputePts = disputes*-15;
  const rep        = Math.max(0,Math.min(ratingPts+sessionPts+repeatPts+disputePts,100));
  const repLabel   = rep>=80?"Exceptional":rep>=60?"Great":rep>=40?"Good":rep>=20?"Fair":"Building";
  const ratingDisplay  = avgRating!==null?avgRating.toFixed(2):"—";
  const ratingSubLabel = avgRating!==null?`${ratingCount} review${ratingCount!==1?"s":""}`:"No ratings yet";

  return(
    <div style={{minHeight:"100vh",background:"#F7F4EF",fontFamily:"'DM Sans',sans-serif"}} onClick={()=>setShowMenu(false)}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes xpPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.02)}}
        @keyframes goldSpin{0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 18px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.8)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 12px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e0e0e0,0 0 20px rgba(200,200,200,.6)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 12px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 20px rgba(232,160,80,.5)}}
        .card{background:#fff;border-radius:20px;border:1px solid #EAECF0;box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.025)}
        .card-lift{transition:transform .18s,box-shadow .18s}
        .card-lift:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.09)!important}
        .action-card{transition:all .18s cubic-bezier(.34,1.2,.64,1);cursor:pointer;border-radius:16px;border:1px solid #EAECF0;padding:20px;display:flex;flex-direction:column;gap:8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04)}
        .action-card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.1)!important;border-color:#BBF7D0}
        .secondary-card{transition:all .15s;cursor:pointer;border-radius:12px;border:1px solid #EAECF0;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:5px;background:#fff;text-align:center}
        .secondary-card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.07);border-color:#BBF7D0}
        .stat-cell{border-radius:14px;background:#F9FAFB;text-align:center;padding:12px 8px;transition:background .12s,transform .12s;display:block}
        .stat-cell:hover{background:#F2F4F7;transform:translateY(-2px)}
        .xp-bar{background:linear-gradient(90deg,#16a34a,#22c55e,#4ade80);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#667085;transition:all .12s}
        .nav-a:hover{background:#F2F4F7;color:#101828}
        .menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#344054;transition:all .12s;cursor:pointer}
        .menu-item:hover{background:#F8F9FB;color:#101828}
        .gold-avatar{animation:goldSpin 2s ease infinite}
        .silver-avatar{animation:silverPulse 2s ease infinite}
        .bronze-avatar{animation:bronzePulse 2s ease infinite}
        .multi-badge{animation:xpPulse 1.5s ease infinite}
        .activity-row{border-radius:12px;transition:background .12s}
        .activity-row:hover{background:#F8F9FB}
        @media(max-width:960px){.main-grid{grid-template-columns:1fr!important}.sidebar{display:none!important}}
        @media(max-width:600px){.nav-links{display:none!important}.actions-3{grid-template-columns:1fr!important}}
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{background:"rgba(255,255,255,.97)",backdropFilter:"blur(16px)",borderBottom:"1px solid #EAECF0",padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <a href="/dashboard">
          <span style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#16a34a"}}>Skill</span>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#101828"}}>Credit</span>
        </a>
        <div className="nav-links" style={{display:"flex",gap:2}}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h])=>(
            <a key={l} href={h} className="nav-a">{l}</a>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <a href="/wallet" style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:999,background:"#F0FDF4",border:"1px solid #BBF7D0",fontSize:13,fontWeight:700,color:"#16a34a"}}>
            💰 {profile.credits} cr
          </a>
          <a href="/notifications" style={{position:"relative",width:36,height:36,borderRadius:"50%",background:"#F2F4F7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
            🔔
            {unread>0&&<span style={{position:"absolute",top:-2,right:-2,minWidth:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:"2px solid white"}}>{unread}</span>}
          </a>
          <div style={{position:"relative"}} onClick={e=>{e.stopPropagation();setShowMenu(m=>!m);}}>
            <div className={rankFromTitle===1?"gold-avatar":rankFromTitle===2?"silver-avatar":rankFromTitle===3?"bronze-avatar":""}
              style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",cursor:"pointer",
                background:avatarUrl?"transparent":levelInfo.color,display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:rankBorderColor?undefined:`0 0 0 2px white,0 0 0 3.5px ${levelInfo.color}`}}>
              {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{color:"#fff",fontSize:12,fontWeight:900}}>{initials}</span>}
            </div>
            {showMenu&&(
              <div style={{position:"absolute",right:0,top:44,background:"#fff",border:"1px solid #EAECF0",borderRadius:18,padding:8,width:210,boxShadow:"0 16px 48px rgba(0,0,0,.12)",zIndex:200}}>
                <div style={{padding:"10px 12px 12px",borderBottom:"1px solid #F2F4F7",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:avatarUrl?"transparent":levelInfo.color,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{color:"#fff",fontSize:11,fontWeight:900}}>{initials}</span>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:"#101828"}}>{profile.full_name}</div>
                      <div style={{fontSize:11,color:"#98A2B3"}}>@{profile.username} · <span style={{color:badge.color,fontWeight:700}}>{badge.emoji} {badge.name}</span></div>
                    </div>
                  </div>
                </div>
                {[["👤","My Profile","/profile"],["👥","People","/people"],["📋","Create Listing","/listings/create"],["✅","Get Verified","/verify"],["⭐","My Ratings","/ratings"],["💰","Wallet","/wallet"],["🏆","Leaderboard","/leaderboard"],["🔔","Notifications","/notifications"]].map(([icon,label,href])=>(
                  <a key={label} href={href} className="menu-item">{icon} {label}</a>
                ))}
                <div style={{borderTop:"1px solid #F2F4F7",marginTop:6,paddingTop:6}}>
                  <button onClick={handleLogout} className="menu-item" style={{width:"100%",background:"none",border:"none",color:"#ef4444",fontFamily:"'DM Sans',sans-serif"}}>🚪 Log out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={{maxWidth:1180,margin:"0 auto",padding:"28px 24px"}}>

        {/* PENDING */}
        {pendingSessions>0&&(
          <a href="/sessions" style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:14,padding:"12px 18px",marginBottom:16,gap:12,animation:"fadeUp .3s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span>⏳</span>
              <span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>{pendingSessions} pending session request{pendingSessions>1?"s":""} awaiting your response</span>
            </div>
            <div style={{background:"#f59e0b",color:"#fff",padding:"5px 14px",borderRadius:99,fontSize:12,fontWeight:700,whiteSpace:"nowrap" as const}}>Review →</div>
          </a>
        )}

        {/* ── HERO CARD ── */}
        <div className="card" style={{padding:"26px 28px 22px",marginBottom:14,animation:"fadeUp .4s ease",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:rankBorderColor?`linear-gradient(90deg,${rankBorderColor},${rankBorderColor}44)`:`linear-gradient(90deg,${levelInfo.color},${levelInfo.color}44)`,borderRadius:"20px 20px 0 0"}}/>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap" as const,gap:20}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{position:"relative",flexShrink:0}}>
                <div className={rankFromTitle===1?"gold-avatar":rankFromTitle===2?"silver-avatar":rankFromTitle===3?"bronze-avatar":""}
                  style={{width:60,height:60,borderRadius:"50%",overflow:"hidden",
                    background:avatarUrl?"transparent":`linear-gradient(135deg,${levelInfo.color},${levelInfo.color}88)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:rankBorderColor?undefined:`0 6px 20px ${levelInfo.color}33`}}>
                  {avatarUrl?<img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:20,fontWeight:900,color:"#fff"}}>{initials}</span>}
                </div>
                <div style={{position:"absolute",bottom:-2,right:-2,background:"#fff",borderRadius:"50%",padding:2,fontSize:13,lineHeight:1}}>
                  {rankFromTitle===1?"👑":rankFromTitle===2?"🥈":rankFromTitle===3?"🥉":LEVEL_ICONS[levelInfo.name]}
                </div>
              </div>

              <div>
                <div style={{fontSize:11,color:"#98A2B3",fontWeight:600,marginBottom:2}}>{greeting}, {firstName} {greetingEmoji}</div>
                <h1 style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:"#101828",lineHeight:1.15,marginBottom:8}}>{profile.full_name}</h1>

                {/* Perk pills */}
                {hasAnyPerk&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" as const,marginBottom:7}}>
                    {hasChampion&&<span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:999,background:"#FFFBEB",color:"#B45309",border:"1px solid #FDE68A"}}>
                      {rankFromTitle===1?"👑":rankFromTitle===2?"🥈":"🥉"} {profile.champion_title}
                    </span>}
                    {hasTeaching&&<span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:999,background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE"}}>{profile.teaching_title}</span>}
                    {hasRating&&<span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:999,background:"#FFFBEB",color:"#92400e",border:"1px solid #FDE68A"}}>{profile.rating_title}</span>}
                    {hasMulti&&<span className="multi-badge" style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:999,background:"#FEF2F2",color:"#B91C1C",border:"1px solid #FECACA"}}>⚡ {profile.xp_multiplier}x XP</span>}
                  </div>
                )}

                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                  <span style={{fontSize:11,color:"#98A2B3"}}>@{profile.username}</span>
                  <span style={{fontSize:10,color:"#D0D5DD"}}>·</span>
                  <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,background:`${levelInfo.color}12`,color:levelInfo.color}}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
                  <span style={{fontSize:10,color:"#D0D5DD"}}>·</span>
                  <span style={{fontSize:11,fontWeight:700,color:badge.color}}>{badge.emoji} {badge.name}</span>
                  {avgRating!==null&&<><span style={{fontSize:10,color:"#D0D5DD"}}>·</span><span style={{fontSize:11,fontWeight:600,color:"#B45309"}}>⭐ {avgRating.toFixed(2)}</span></>}
                </div>
              </div>
            </div>

            {/* XP progress */}
            <div style={{minWidth:230,flex:"0 0 230px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#98A2B3",textTransform:"uppercase" as const,letterSpacing:".07em",marginBottom:2}}>Level Progress</div>
                  <div style={{fontSize:13,fontWeight:800,color:levelInfo.color}}>{levelInfo.name}</div>
                </div>
                <div style={{textAlign:"right" as const}}>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:900,color:"#101828"}}>{profile.xp.toLocaleString()}</span>
                  <span style={{fontSize:11,color:"#98A2B3"}}> / {xpNext.toLocaleString()} XP</span>
                </div>
              </div>
              <div style={{height:8,background:"#F2F4F7",borderRadius:999,overflow:"hidden",marginBottom:7}}>
                <div className="xp-bar" style={{width:`${xpPct}%`,transition:"width 1s ease"}}/>
              </div>
              <div style={{fontSize:11,color:"#667085",fontWeight:600}}>
                {Math.max(0,xpNext-profile.xp)>0
                  ?<>🔥 <strong style={{color:"#101828"}}>{(xpNext-profile.xp).toLocaleString()} XP</strong> to next level</>
                  :"🎉 Max level reached!"}
                {hasMulti&&multiTimeLeft&&<span style={{marginLeft:8,color:"#B91C1C",fontWeight:700}}>· ⚡ {multiTimeLeft}</span>}
              </div>
            </div>
          </div>

          {/* Inline stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:20,paddingTop:18,borderTop:"1px solid #F2F4F7"}}>
            {[
              {icon:"💰",label:"Credits",  value:String(profile.credits), sub:"in wallet",     href:"/wallet"},
              {icon:"⚡",label:"XP",       value:profile.xp.toLocaleString(), sub:levelInfo.name, href:"/leaderboard"},
              {icon:"📅",label:"Sessions", value:String(sessions),         sub:"completed",     href:"/sessions"},
              {icon:"🎯",label:"Bounties", value:String(bountiesWon),      sub:"won",           href:"/bounties"},
              {icon:"⭐",label:"Rating",   value:ratingDisplay,            sub:ratingSubLabel,  href:"/ratings"},
            ].map(s=>(
              <a key={s.label} href={s.href} className="stat-cell">
                <div style={{fontSize:17,marginBottom:5}}>{s.icon}</div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#101828",lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:10,color:"#98A2B3",fontWeight:600,marginTop:3,textTransform:"uppercase" as const,letterSpacing:".04em"}}>{s.label}</div>
                <div style={{fontSize:10,color:"#C4C9D4",marginTop:1}}>{s.sub}</div>
              </a>
            ))}
          </div>
        </div>

        {/* ── TODAY'S GOAL ── */}
        <div style={{marginBottom:14,animation:"fadeUp .4s .05s ease both"}}>
          <div style={{background:todaySession?"#F0FDF4":"#fff",border:`1px solid ${todaySession?"#BBF7D0":"#EAECF0"}`,borderRadius:16,padding:"14px 20px",display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:40,height:40,borderRadius:12,background:todaySession?"#DCFCE7":"#F9FAFB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
              {todaySession?"✅":"🎯"}
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:700,color:todaySession?"#166534":"#344054"}}>Today's Goal</span>
                {!todaySession&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:"#F0FDF4",color:"#16a34a",border:"1px solid #BBF7D0"}}>+15 XP bonus</span>}
                {todaySession&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,background:"#DCFCE7",color:"#166534"}}>✓ Complete!</span>}
              </div>
              <div style={{height:5,background:todaySession?"#BBF7D0":"#F2F4F7",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:todaySession?"100%":"0%",background:"#16a34a",borderRadius:99,transition:"width 1s ease"}}/>
              </div>
              <div style={{fontSize:11,color:todaySession?"#16a34a":"#98A2B3",marginTop:4,fontWeight:600}}>
                {todaySession?"Session complete — +15 XP earned today 🎉":"Complete 1 session to earn your daily bonus"}
              </div>
            </div>
            <div style={{textAlign:"center" as const,flexShrink:0,paddingLeft:16,borderLeft:"1px solid #F2F4F7"}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:dayStreak>0?"#F59E0B":"#D1D5DB",lineHeight:1}}>🔥 {dayStreak}</div>
              <div style={{fontSize:9,color:"#98A2B3",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".05em",marginTop:4}}>Day Streak</div>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="main-grid" style={{display:"grid",gridTemplateColumns:"1fr 292px",gap:14,animation:"fadeUp .4s .1s ease both"}}>

          {/* LEFT */}
          <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>

            {/* QUICK ACTIONS */}
            <div className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h2 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#101828"}}>What's Next</h2>
                <a href="/leaderboard" style={{fontSize:11,color:"#16a34a",fontWeight:700,background:"#F0FDF4",padding:"4px 11px",borderRadius:99,border:"1px solid #BBF7D0"}}>🏆 Leaderboard →</a>
              </div>
              <div className="actions-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
                {QUICK_ACTIONS.map(a=>(
                  <a key={a.label} href={a.href} className="action-card">
                    <div style={{width:36,height:36,borderRadius:10,background:"#F0FDF4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{a.icon}</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#101828",marginTop:2}}>{a.label}</div>
                    <div style={{fontSize:12,color:"#667085",lineHeight:1.4}}>{a.desc}</div>
                    <div style={{fontSize:11,fontWeight:700,color:"#16a34a",marginTop:2}}>Get started →</div>
                  </a>
                ))}
              </div>
              <div style={{borderTop:"1px solid #F2F4F7",paddingTop:12}}>
                <div style={{fontSize:10,color:"#C4C9D4",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:10}}>More</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:7}}>
                  {SECONDARY_ACTIONS.map(a=>(
                    <a key={a.label} href={a.href} className="secondary-card">
                      <span style={{fontSize:17}}>{a.icon}</span>
                      <span style={{fontSize:11,fontWeight:600,color:"#344054"}}>{a.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTIVITY */}
            <div className="card" style={{padding:"22px 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <h2 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#101828"}}>Recent Activity</h2>
                  {unread>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,background:"#F0FDF4",color:"#16a34a",border:"1px solid #BBF7D0"}}>{unread} new</span>}
                </div>
                <a href="/notifications" style={{fontSize:12,color:"#16a34a",fontWeight:700}}>View all →</a>
              </div>
              {activities.length===0?(
                <div style={{textAlign:"center" as const,padding:"32px 0"}}>
                  <div style={{fontSize:36,marginBottom:8}}>🌱</div>
                  <p style={{fontSize:13,color:"#98A2B3",marginBottom:16}}>No activity yet — complete a session to get started!</p>
                  <a href="/listings" style={{display:"inline-block",padding:"9px 22px",background:"#16a34a",color:"#fff",borderRadius:999,fontSize:13,fontWeight:700}}>Browse Skills →</a>
                </div>
              ):activities.map((act,idx)=>{
                const cfg=ACTIVITY_CFG[act.type]||{icon:"📌",bg:"#F1F5F9"};
                const cleanBody=act.body&&!act.body.trim().startsWith("{")&&act.body.length<120?act.body:"";
                return(
                  <div key={act.id} className="activity-row"
                    style={{display:"flex",gap:12,padding:"13px 10px",borderBottom:idx<activities.length-1?"1px solid #F9FAFB":"none",alignItems:"flex-start"}}>
                    <div style={{width:38,height:38,borderRadius:12,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,position:"relative" as const}}>
                      {cfg.icon}
                      {!act.is_read&&<div style={{position:"absolute" as const,top:-2,right:-2,width:8,height:8,borderRadius:"50%",background:"#16a34a",border:"1.5px solid #fff"}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:3}}>
                        <div style={{fontSize:13,fontWeight:act.is_read?600:700,color:"#101828",lineHeight:1.35}}>{act.title}</div>
                        <span style={{fontSize:10,color:"#C4C9D4",fontWeight:600,whiteSpace:"nowrap" as const,flexShrink:0}}>{timeAgo(act.created_at)}</span>
                      </div>
                      {cleanBody&&<div style={{fontSize:12,color:"#667085",lineHeight:1.5}}>{cleanBody}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div className="sidebar" style={{display:"flex",flexDirection:"column" as const,gap:12}}>

            {/* ACTIVE PERKS */}
            {hasAnyPerk&&(
              <div className="card" style={{padding:"18px",border:"1px solid #FEF3C7",background:"linear-gradient(160deg,#FFFDF7 0%,#fff 70%)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <span style={{fontSize:11,fontWeight:800,color:"#B45309",letterSpacing:".07em",textTransform:"uppercase" as const}}>🏆 Active Perks</span>
                  <a href="/leaderboard" style={{fontSize:10,color:"#16a34a",fontWeight:700}}>View →</a>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:7}}>
                  {hasChampion&&(
                    <div style={{background:"linear-gradient(135deg,#14532d,#16a34a)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:17}}>{rankFromTitle===1?"👑":rankFromTitle===2?"🥈":"🥉"}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.champion_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>XP Leaderboard</div>
                      </div>
                    </div>
                  )}
                  {hasMulti&&(
                    <div className="multi-badge" style={{background:"linear-gradient(135deg,#450a0a,#dc2626)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:17}}>⚡</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.xp_multiplier}x XP Multiplier</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>{multiTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  {hasTeaching&&(
                    <div style={{background:"linear-gradient(135deg,#1e3a5f,#1d4ed8)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:17}}>🎓</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.teaching_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>Teaching Activity · {teachTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  {hasRating&&(
                    <div style={{background:"linear-gradient(135deg,#3b1f00,#92400e)",borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:17}}>⭐</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{profile.rating_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>Student Ratings · {rateTimeLeft||"Active"}</div>
                      </div>
                    </div>
                  )}
                  <div style={{padding:"7px 11px",background:"#F9FAFB",borderRadius:9,display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                    <span style={{fontSize:11,color:"#98A2B3",fontWeight:600}}>Week resets in</span>
                    <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:900,color:"#B45309"}}>{weekReset}</span>
                  </div>
                </div>
              </div>
            )}

            {/* WALLET */}
            <a href="/wallet" className="card-lift" style={{display:"block",background:"linear-gradient(135deg,#14532d,#16a34a 55%,#22c55e)",borderRadius:20,padding:"20px",color:"#fff",position:"relative" as const,overflow:"hidden",boxShadow:"0 6px 22px rgba(22,163,74,.27)",transition:"all .18s"}}>
              <div style={{position:"absolute" as const,top:-24,right:-24,width:88,height:88,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
              <p style={{fontSize:10,fontWeight:700,opacity:.55,marginBottom:3,letterSpacing:".1em",textTransform:"uppercase" as const}}>💰 Your Wallet</p>
              <p style={{fontFamily:"'Fraunces',serif",fontSize:38,fontWeight:900,lineHeight:1,marginBottom:2}}>{profile.credits}</p>
              <p style={{fontSize:12,opacity:.55,marginBottom:16}}>credits · ₱{profile.credits*10} value</p>
              <div style={{display:"flex",gap:8}}>
                <div style={{flex:1,background:"rgba(255,255,255,.95)",color:"#16a34a",textAlign:"center" as const,padding:"9px",borderRadius:10,fontSize:12,fontWeight:800}}>+ Top Up</div>
                <div style={{flex:1,background:"rgba(255,255,255,.12)",color:"#fff",textAlign:"center" as const,padding:"9px",borderRadius:10,fontSize:12,fontWeight:700,border:"1px solid rgba(255,255,255,.2)"}}>History</div>
              </div>
            </a>

            {/* BADGE & LEVEL */}
            <div className="card" style={{padding:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:11,fontWeight:700,color:"#667085"}}>Badge & Level</span>
                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,background:`${levelInfo.color}12`,color:levelInfo.color}}>{LEVEL_ICONS[levelInfo.name]} {levelInfo.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,background:"#F9FAFB",marginBottom:12}}>
                <span style={{fontSize:28}}>{badge.emoji}</span>
                <div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#101828"}}>{badge.name}</div>
                  <div style={{fontSize:11,color:"#667085"}}>{badge.desc}</div>
                </div>
              </div>
              {nextBadge&&(
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:600,color:"#98A2B3",marginBottom:9}}>Next: {nextBadge.emoji} {nextBadge.name}</div>
                  {[
                    {icon:"⚡",label:"XP",      current:profile.xp,req:nextBadge.xpReq},
                    {icon:"📚",label:"Sessions",current:sessions,  req:nextBadge.sessionsReq},
                  ].filter(r=>r.req>0).map(r=>{
                    const done=r.current>=r.req;const pct=Math.min((r.current/r.req)*100,100);
                    return(
                      <div key={r.label} style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
                          <span style={{color:"#667085",fontWeight:600}}>{r.icon} {r.label}</span>
                          <span style={{color:done?"#16a34a":"#98A2B3",fontWeight:700}}>{done?"✓":`${r.current}/${r.req}`}</span>
                        </div>
                        <div style={{height:4,background:"#F2F4F7",borderRadius:999,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:done?"#16a34a":"#D0D5DD",borderRadius:999,transition:"width 1s ease"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{paddingTop:12,borderTop:"1px solid #F2F4F7"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#C4C9D4",textTransform:"uppercase" as const,letterSpacing:".07em",marginBottom:8}}>Level Path</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap" as const}}>
                  {LEVELS.map(t=>(
                    <span key={t.name} style={{fontSize:10,fontWeight:700,padding:"3px 7px",borderRadius:99,
                      background:t.name===levelInfo.name?`${t.color}14`:"transparent",
                      color:t.name===levelInfo.name?t.color:"#C4C9D4",
                      border:`1px solid ${t.name===levelInfo.name?t.color+"22":"transparent"}`}}>
                      {LEVEL_ICONS[t.name]} {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* REPUTATION */}
            <div className="card" style={{padding:"18px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:11,fontWeight:700,color:"#667085"}}>Reputation</span>
                <span style={{fontSize:11,fontWeight:700,color:"#B45309",background:"#FFFBEB",padding:"2px 8px",borderRadius:99,border:"1px solid #FDE68A"}}>{repLabel}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{flex:1,height:9,background:"#F2F4F7",borderRadius:999,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${rep}%`,background:rep>=80?"#16a34a":rep>=60?"#F59E0B":"#D0D5DD",borderRadius:999,transition:"width 1s ease"}}/>
                </div>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:19,fontWeight:900,color:"#101828",flexShrink:0,minWidth:48,textAlign:"right" as const}}>{rep}<span style={{fontSize:10,color:"#98A2B3"}}>/100</span></span>
              </div>
              {[
                {icon:"⭐",label:"Rating",  pts:ratingPts, detail:avgRating!==null?`${avgRating.toFixed(2)} avg`:"No ratings yet"},
                {icon:"📚",label:"Sessions",pts:sessionPts,detail:`${sessions} completed`},
                {icon:"🔄",label:"Repeats", pts:repeatPts, detail:`${repeatClients} repeat clients`},
                ...(disputes>0?[{icon:"⚠️",label:"Disputes",pts:disputePts,detail:`${disputes} disputes`}]:[]),
              ].map(r=>(
                <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,marginBottom:8}}>
                  <span style={{color:"#667085"}}>{r.icon} {r.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:"#98A2B3"}}>{r.detail}</span>
                    <span style={{fontWeight:700,color:r.pts>0?"#16a34a":r.pts<0?"#DC2626":"#98A2B3",minWidth:28,textAlign:"right" as const}}>
                      {r.pts>0?`+${r.pts}`:r.pts<0?`${r.pts}`:"✓"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* LEADERBOARD CTA */}
            <a href="/leaderboard" className="card-lift" style={{display:"block",background:"linear-gradient(135deg,#1e1b4b,#312e81,#4338ca)",borderRadius:20,padding:"18px 20px",color:"#fff",boxShadow:"0 6px 22px rgba(67,56,202,.2)",transition:"all .18s"}}>
              <div style={{fontSize:10,fontWeight:700,opacity:.4,textTransform:"uppercase" as const,letterSpacing:".1em",marginBottom:8}}>🏆 Weekly Leaderboard</div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:900,marginBottom:3}}>Compete for #1 👑</div>
              <div style={{fontSize:11,opacity:.5,marginBottom:12,lineHeight:1.5}}>Top 3 earn credits, XP boosts + titles every week.</div>
              <div style={{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:12}}>
                {[
                  {e:"🥇",l:"Champion", r:"+20 cr · 1.25× XP"},
                  {e:"🥈",l:"Runner-up",r:"+10 cr · 1.15× XP"},
                  {e:"🥉",l:"Third",    r:"+5 cr · 1.10× XP"},
                ].map(r=>(
                  <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,.08)",borderRadius:9,padding:"7px 10px"}}>
                    <span style={{fontSize:12,fontWeight:700}}>{r.e} {r.l}</span>
                    <span style={{fontSize:10,opacity:.5}}>{r.r}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,.08)",borderRadius:10,padding:"8px 12px"}}>
                <span style={{fontSize:11,opacity:.4}}>Resets in</span>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:900,color:"#fbbf24"}}>{weekReset}</span>
              </div>
            </a>

          </div>
        </div>
      </div>
    </div>
  );
}