"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string; bio: string;
  location: string; credits: number; xp: number; level: string;
  role: string; avatar_url: string; created_at: string; is_verified?: boolean;
  xp_multiplier?: number; multiplier_ends_at?: string | null;
  champion_title?: string | null; champion_streak?: number;
  teaching_title?: string | null; teaching_title_ends_at?: string | null;
  rating_title?: string | null;   rating_title_ends_at?: string | null;
};
type Listing     = { id: string; title: string; format: string; duration: number; credit_price: number; is_active: boolean; skills: { name: string; category: string } };
type Transaction = { id: string; amount: number; type: string; description: string; created_at: string };
type UserSkill   = { id: string; skill_id: string; is_verified: boolean; verified_at: string | null; skills: { name: string; category: string } };

const BADGE_TIERS = [
  { name:"Seedling", emoji:"🌱", color:"#2d6a4f", bg:"#dcfce7", desc:"Just getting started",  xpReq:0,    sessionsReq:0,  ratingReq:0   },
  { name:"Rising",   emoji:"⭐", color:"#b45309", bg:"#fef3c7", desc:"Building momentum",     xpReq:100,  sessionsReq:0,  ratingReq:0   },
  { name:"Pro",      emoji:"🔥", color:"#7c3aed", bg:"#ede9fe", desc:"Proven skill sharer",   xpReq:500,  sessionsReq:5,  ratingReq:0   },
  { name:"Elite",    emoji:"💎", color:"#dc2626", bg:"#fee2e2", desc:"Top performer",          xpReq:2000, sessionsReq:20, ratingReq:4.0 },
  { name:"Legend",   emoji:"👑", color:"#d97706", bg:"#fffbeb", desc:"Community pillar",       xpReq:5000, sessionsReq:50, ratingReq:4.5 },
];
function computeEarnedBadges(xp:number,sessions:number,bountiesWon:number,avgRating:number,listings:number){
  const earned:{icon:string;name:string;desc:string}[]=[];
  if(xp>=1)        earned.push({icon:"🌱",name:"First Steps",    desc:"Joined SkillCredit and started your journey"});
  if(sessions>=1)  earned.push({icon:"📚",name:"First Session",   desc:"Completed your very first session"});
  if(sessions>=5)  earned.push({icon:"🥉",name:"Rising Teacher",  desc:"Completed 5 sessions"});
  if(sessions>=20) earned.push({icon:"🥈",name:"Skilled Teacher", desc:"Completed 20 sessions"});
  if(sessions>=50) earned.push({icon:"🥇",name:"Top Teacher",     desc:"Completed 50 sessions"});
  if(bountiesWon>=1) earned.push({icon:"🎯",name:"First Bounty",  desc:"Won your first bounty challenge"});
  if(bountiesWon>=5) earned.push({icon:"🏹",name:"Bounty Hunter", desc:"Won 5 bounties"});
  if(listings>=1)  earned.push({icon:"📋",name:"First Listing",   desc:"Created your first skill listing"});
  if(listings>=3)  earned.push({icon:"🎓",name:"Active Teacher",  desc:"Created 3 skill listings"});
  if(avgRating>=4.5&&sessions>=3) earned.push({icon:"⭐",name:"Top Rated",   desc:"Maintained a 4.5+ rating"});
  if(avgRating>=4.8&&sessions>=5) earned.push({icon:"💎",name:"Elite Rated", desc:"Maintained a 4.8+ rating with 5+ sessions"});
  if(xp>=500)  earned.push({icon:"⚡",name:"XP Grinder",desc:"Earned 500 XP"});
  if(xp>=2000) earned.push({icon:"🔥",name:"XP Legend", desc:"Earned 2000 XP"});
  return earned;
}
function bayesianAvg(ratings:number[]):number{
  if(!ratings.length) return 0;
  const C=5,m=3.5;
  return (C*m+ratings.reduce((s,r)=>s+r,0))/(C+ratings.length);
}
function getBadgeTier(xp:number,sessions:number,rating:number){
  for(let i=BADGE_TIERS.length-1;i>=0;i--){const t=BADGE_TIERS[i];if(xp>=t.xpReq&&sessions>=t.sessionsReq&&rating>=t.ratingReq)return t;}
  return BADGE_TIERS[0];
}
function getNextBadge(current:typeof BADGE_TIERS[0]){
  const idx=BADGE_TIERS.findIndex(b=>b.name===current.name);
  return idx<BADGE_TIERS.length-1?BADGE_TIERS[idx+1]:null;
}
function getLevelFromXP(xp:number){
  if(xp>=4000)return"Legend";if(xp>=2000)return"Master";if(xp>=1000)return"Expert";
  if(xp>=600)return"Skilled";if(xp>=300)return"Contributor";if(xp>=100)return"Learner";
  return"Seedling";
}
const LEVEL_COLOR:Record<string,string>={Seedling:"#2d6a4f",Learner:"#1d4ed8",Contributor:"#7c3aed",Skilled:"#b45309",Expert:"#dc2626",Master:"#0891b2",Legend:"#d97706"};
const XP_TO_NEXT:Record<string,number>={Seedling:100,Learner:300,Contributor:600,Skilled:1000,Expert:2000,Master:4000,Legend:9999};
function calcRep(avgRating:number,sessions:number,repeatClients:number,disputes:number){
  return Math.max(0,Math.min(Math.min(Math.round(avgRating*sessions*4),80)+Math.min(sessions*2,15)+Math.min(repeatClients*5,10)+(disputes*-15),100));
}
function getInitials(name:string){return name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()||"??";}
function getRankFromProfile(p:Profile):number{
  if(p.xp_multiplier===1.25)return 1;if(p.xp_multiplier===1.15)return 2;if(p.xp_multiplier===1.10)return 3;
  if(p.champion_title)return 1;return 0;
}
function isTitleActive(endsAt?:string|null):boolean{if(!endsAt)return false;return new Date(endsAt)>new Date();}

const FORMAT_CONFIG:Record<string,{label:string;color:string;bg:string}>={
  video:{label:"Video",color:"#0369a1",bg:"#e0f2fe"},chat:{label:"Chat",color:"#065f46",bg:"#d1fae5"},
  docs:{label:"Docs",color:"#5b21b6",bg:"#ede9fe"},mixed:{label:"Mixed",color:"#92400e",bg:"#fef3c7"},
};
const TX_ICONS:Record<string,string>={signup_bonus:"🎁",session_earn:"📚",session_spend:"💳",bounty_earn:"🏆",topup:"💳",challenge:"⚡",session_refund:"↩️",weekly_reward:"🏅"};

function PremiumAvatar({url,initials,lvlColor,rank,size=64}:{url?:string|null;initials:string;lvlColor:string;rank?:number;size?:number;}){
  const borderClass=rank===1?"gold-border":rank===2?"silver-border":rank===3?"bronze-border":"";
  const rankIcon=rank===1?"👑":rank===2?"🥈":rank===3?"🥉":null;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      {rank&&rank<=3&&<div className={borderClass} style={{position:"absolute",inset:-4,borderRadius:size>=56?20:"50%",pointerEvents:"none",zIndex:1}}/>}
      <div style={{width:size,height:size,borderRadius:size>=56?16:"50%",overflow:"hidden",background:url?"transparent":`linear-gradient(135deg,${lvlColor},${lvlColor}99)`,boxShadow:rank&&rank<=3?"none":`0 6px 20px ${lvlColor}33`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:2}}>
        {url?<img src={url} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{color:"#fff",fontSize:size*0.32,fontWeight:900}}>{initials}</span>}
      </div>
      {rankIcon&&<div style={{position:"absolute",bottom:-4,right:-4,background:"#fff",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,boxShadow:"0 2px 8px rgba(0,0,0,.15)",zIndex:3}}>{rankIcon}</div>}
    </div>
  );
}

function AvatarUploader({userId,currentUrl,initials,lvlColor,rank,onUploaded}:{userId:string;currentUrl:string|null;initials:string;lvlColor:string;rank?:number;onUploaded:(url:string)=>void;}){
  const inputRef=useRef<HTMLInputElement>(null);
  const [uploading,setUploading]=useState(false);
  const [preview,setPreview]=useState<string|null>(currentUrl||null);
  const [err,setErr]=useState("");
  const handleFile=async(file:File)=>{
    if(!file.type.startsWith("image/")){setErr("Please pick an image.");return;}
    if(file.size>3*1024*1024){setErr("Max 3 MB.");return;}
    setErr("");setUploading(true);
    const ext=file.name.split(".").pop();const path=`${userId}/avatar.${ext}`;
    const{error:upErr}=await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type});
    if(upErr){setErr("Upload failed.");setUploading(false);return;}
    const{data}=supabase.storage.from("avatars").getPublicUrl(path);
    const url=data.publicUrl+`?t=${Date.now()}`;
    await supabase.from("profiles").update({avatar_url:data.publicUrl}).eq("id",userId);
    setPreview(url);onUploaded(data.publicUrl);setUploading(false);
  };
  return(
    <div style={{position:"relative",width:64,height:64}}>
      <div onClick={()=>!uploading&&inputRef.current?.click()} style={{cursor:"pointer",position:"relative",width:64,height:64}}>
        <PremiumAvatar url={preview} initials={initials} lvlColor={lvlColor} rank={rank} size={64}/>
      </div>
      <button onClick={()=>!uploading&&inputRef.current?.click()} style={{position:"absolute",bottom:-4,right:-4,width:22,height:22,borderRadius:"50%",background:"#fff",border:"2px solid #e8e2d9",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,boxShadow:"0 2px 8px rgba(0,0,0,.12)",zIndex:10}}>
        {uploading?"⟳":"📷"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
      {err&&<div style={{position:"absolute",top:"100%",left:0,marginTop:4,fontSize:10,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",padding:"3px 8px",borderRadius:6,whiteSpace:"nowrap",zIndex:20}}>{err}</div>}
    </div>
  );
}

export default function ProfilePage(){
  const [profile,setProfile]=useState<Profile|null>(null);
  const [listings,setListings]=useState<Listing[]>([]);
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [userSkills,setUserSkills]=useState<UserSkill[]>([]);
  const [loading,setLoading]=useState(true);
  const [activeTab,setActiveTab]=useState<"listings"|"badges"|"activity">("listings");
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editForm,setEditForm]=useState({full_name:"",bio:"",location:""});
  const [sessions,setSessions]=useState(0);
  const [avgRating,setAvgRating]=useState(0);
  const [repeatClients,setRepeatClients]=useState(0);
  const [disputes,setDisputes]=useState(0);
  const [bountiesWon,setBountiesWon]=useState(0);
  const [editingListing,setEditingListing]=useState<Listing|null>(null);
  const [editListingForm,setEditListingForm]=useState({title:"",description:"",prerequisites:"",outcomes:"",materials:"",credit_price:10,is_active:true});
  const [savingListing,setSavingListing]=useState(false);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [confirmDeleteId,setConfirmDeleteId]=useState<string|null>(null);
  const [listingError,setListingError]=useState("");

  useEffect(()=>{
    const load=async()=>{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){window.location.href="/login";return;}
      const{data:prof}=await supabase.from("profiles")
        .select("*,xp_multiplier,multiplier_ends_at,champion_title,champion_streak,teaching_title,teaching_title_ends_at,rating_title,rating_title_ends_at")
        .eq("id",user.id).single();
      if(prof){setProfile(prof);setEditForm({full_name:prof.full_name||"",bio:prof.bio||"",location:prof.location||""});}
      const[{data:l},{data:tx},{count:sCount},{data:ratingData},{data:sessionData},{count:dCount},{data:skillsData},{count:bCount}]=await Promise.all([
        supabase.from("listings").select("*,skills(name,category)").eq("teacher_id",user.id).order("created_at",{ascending:false}),
        supabase.from("credit_transactions").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
        supabase.from("sessions").select("*",{count:"exact",head:true}).or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status","completed"),
        supabase.from("ratings").select("overall").eq("rated_id",user.id),
        supabase.from("sessions").select("learner_id").eq("teacher_id",user.id).eq("status","completed"),
        supabase.from("sessions").select("*",{count:"exact",head:true}).eq("teacher_id",user.id).eq("status","disputed"),
        supabase.from("user_skills").select("*,skills(name,category)").eq("user_id",user.id).order("is_verified",{ascending:false}),
        supabase.from("bounty_answers").select("*",{count:"exact",head:true}).eq("answerer_id",user.id).not("placement","is",null),
      ]);
      setListings((l as Listing[])||[]);setTransactions(tx||[]);setSessions(sCount||0);
      setUserSkills((skillsData as UserSkill[])||[]);setBountiesWon(bCount||0);
      if(ratingData&&ratingData.length>0)setAvgRating(parseFloat(bayesianAvg(ratingData.map((r:any)=>r.overall)).toFixed(2)));
      if(sessionData){const counts:Record<string,number>={};sessionData.forEach((s:any)=>{counts[s.learner_id]=(counts[s.learner_id]||0)+1;});setRepeatClients(Object.values(counts).filter(c=>c>1).length);}
      setDisputes(dCount||0);setLoading(false);
    };load();
  },[]);

  const handleSave=async()=>{
    if(!profile)return;setSaving(true);
    const{data}=await supabase.from("profiles").update(editForm).eq("id",profile.id).select().single();
    if(data)setProfile(data);setSaving(false);setEditing(false);
  };
  const openEditListing=async(listing:Listing)=>{
    setListingError("");setEditingListing(listing);
    setEditListingForm({title:listing.title,description:"",prerequisites:"",outcomes:"",materials:"",credit_price:listing.credit_price,is_active:listing.is_active});
    const{data}=await supabase.from("listings").select("*").eq("id",listing.id).single();
    if(data)setEditListingForm({title:data.title||"",description:data.description||"",prerequisites:data.prerequisites||"",outcomes:data.outcomes||"",materials:data.materials||"",credit_price:data.credit_price,is_active:data.is_active});
  };
  const handleSaveListing=async()=>{
    if(!editingListing||!profile)return;setSavingListing(true);setListingError("");
    const{error}=await supabase.from("listings").update({title:editListingForm.title,description:editListingForm.description,prerequisites:editListingForm.prerequisites,outcomes:editListingForm.outcomes,materials:editListingForm.materials,credit_price:editListingForm.credit_price,is_active:editListingForm.is_active}).eq("id",editingListing.id);
    if(error){setListingError("Failed to save.");setSavingListing(false);return;}
    const{data:l}=await supabase.from("listings").select("*,skills(name,category)").eq("teacher_id",profile.id).order("created_at",{ascending:false});
    setListings((l as Listing[])||[]);setSavingListing(false);setEditingListing(null);
  };
  const handleDeleteListing=async(id:string)=>{
    setDeletingId(id);await supabase.from("listings").delete().eq("id",id);
    setListings(prev=>prev.filter(l=>l.id!==id));setDeletingId(null);setConfirmDeleteId(null);
  };

  if(loading)return(
    <div style={{minHeight:"100vh",background:"#faf8f4",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={{width:32,height:32,borderRadius:"50%",border:"2px solid #2d6a4f",borderTopColor:"transparent",margin:"0 auto 12px",animation:"spin .8s linear infinite"}}/>
        <p style={{fontSize:12,fontWeight:600,color:"#aaa",letterSpacing:"0.1em",textTransform:"uppercase"}}>Loading profile</p>
      </div>
    </div>
  );
  if(!profile)return null;

  const verifiedSkills=userSkills.filter(s=>s.is_verified);
  const unverifiedSkills=userSkills.filter(s=>!s.is_verified);
  const displayLevel=getLevelFromXP(profile.xp);
  const lvlColor=LEVEL_COLOR[displayLevel]||"#2d6a4f";
  const badge=getBadgeTier(profile.xp,sessions,avgRating);
  const nextBadge=getNextBadge(badge);
  const rep=calcRep(avgRating,sessions,repeatClients,disputes);
  const repLabel=rep>=80?"Exceptional":rep>=60?"Great":rep>=40?"Good":rep>=20?"Fair":"Building";
  const xpNext=XP_TO_NEXT[displayLevel]||100;
  const xpPct=Math.min((profile.xp/xpNext)*100,100);
  const joinDate=new Date(profile.created_at).toLocaleDateString("en-PH",{year:"numeric",month:"long"});
  const earnedBadges=computeEarnedBadges(profile.xp,sessions,bountiesWon,avgRating,listings.length);
  const rank=getRankFromProfile(profile);
  const hasMulti=profile.xp_multiplier&&profile.xp_multiplier>1&&profile.multiplier_ends_at&&new Date(profile.multiplier_ends_at)>new Date();
  const rankLabel=rank===1?"👑 Champion":rank===2?"🥈 Runner-up":rank===3?"🥉 Third Place":null;
  const rankBg=rank===1?"linear-gradient(135deg,#1a3d2e,#2d6a4f)":rank===2?"linear-gradient(135deg,#2c3e50,#34495e)":rank===3?"linear-gradient(135deg,#4a2c0a,#7a4a1a)":null;
  const hasTeachingTitle=isTitleActive(profile.teaching_title_ends_at)&&!!profile.teaching_title;
  const hasRatingTitle=isTitleActive(profile.rating_title_ends_at)&&!!profile.rating_title;

  return(
    <div style={{minHeight:"100vh",background:"#faf8f4",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box}a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes popIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes goldPulse{0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 16px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 3px #ffd700,0 0 28px rgba(255,215,0,.85)}}
        @keyframes silverPulse{0%,100%{box-shadow:0 0 0 2.5px #c0c0c0,0 0 12px rgba(160,160,160,.4)}50%{box-shadow:0 0 0 2.5px #e8e8e8,0 0 20px rgba(200,200,200,.65)}}
        @keyframes bronzePulse{0%,100%{box-shadow:0 0 0 2.5px #cd7f32,0 0 12px rgba(205,127,50,.35)}50%{box-shadow:0 0 0 2.5px #e8a060,0 0 20px rgba(232,160,80,.55)}}
        .gold-border{border-radius:20px;animation:goldPulse 2s ease infinite}
        .silver-border{border-radius:20px;animation:silverPulse 2s ease infinite}
        .bronze-border{border-radius:20px;animation:bronzePulse 2s ease infinite}
        .fade-up{animation:fadeUp .35s ease both}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9}
        .navlink{padding:5px 11px;border-radius:7px;font-size:13px;font-weight:600;color:#666;transition:all .12s;display:inline-block}
        .navlink:hover{background:#f0ece4;color:#1a1a1a}
        .listing-row{transition:box-shadow .15s,transform .15s}.listing-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
        .tx-row:hover{background:#faf8f4}
        .stat-card{transition:all .15s}.stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.07)}
        .progress-bar{height:4px;background:#f0ece4;border-radius:999px;overflow:hidden}
        .progress-fill{height:100%;border-radius:999px;transition:width .6s}
        .quick-link:hover{background:#e8f5ee!important;color:#2d6a4f!important}
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:480px;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:popIn .18s ease;max-height:90vh;overflow-y:auto}
        .xp-bar{background:linear-gradient(90deg,#2d6a4f,#52b788);background-size:200%;animation:shimmer 2.5s infinite;border-radius:999px;height:100%}
      `}</style>

      {/* LISTING EDIT MODAL */}
      {editingListing&&(
        <div className="modal-backdrop" onClick={()=>setEditingListing(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a",marginBottom:4}}>Edit Listing ✏️</h2>
            <p style={{fontSize:12,color:"#aaa",marginBottom:20}}>Update your listing. Price changes affect future bookings only.</p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{key:"title",label:"Title *",type:"input"},{key:"description",label:"Description",type:"textarea"},{key:"outcomes",label:"What learners will achieve",type:"textarea"},{key:"prerequisites",label:"Prerequisites",type:"input"},{key:"materials",label:"Materials",type:"input"}].map(f=>(
                <div key={f.key}>
                  <label style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",display:"block",marginBottom:6}}>{f.label}</label>
                  {f.type==="textarea"?<textarea value={editListingForm[f.key as keyof typeof editListingForm] as string} rows={3} onChange={e=>setEditListingForm(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",borderRadius:11,border:"1.5px solid #e8e2d9",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafaf8",outline:"none",resize:"vertical"}}/>:<input value={editListingForm[f.key as keyof typeof editListingForm] as string} onChange={e=>setEditListingForm(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",borderRadius:11,border:"1.5px solid #e8e2d9",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafaf8",outline:"none"}}/>}
                </div>
              ))}
              <div>
                <label style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",display:"block",marginBottom:6}}>Credit Price</label>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setEditListingForm(p=>({...p,credit_price:Math.max(5,p.credit_price-5)}))} style={{width:36,height:36,borderRadius:9,border:"1.5px solid #e8e2d9",background:"#fafaf8",fontSize:18,cursor:"pointer"}}>-</button>
                  <div style={{flex:1,textAlign:"center",fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:900,color:"#2d6a4f"}}>{editListingForm.credit_price} cr</div>
                  <button onClick={()=>setEditListingForm(p=>({...p,credit_price:Math.min(100,p.credit_price+5)}))} style={{width:36,height:36,borderRadius:9,border:"1.5px solid #e8e2d9",background:"#fafaf8",fontSize:18,cursor:"pointer"}}>+</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",borderRadius:11,cursor:"pointer"}} onClick={()=>setEditListingForm(p=>({...p,is_active:!p.is_active}))}>
                <div style={{width:38,height:22,borderRadius:999,background:editListingForm.is_active?"#2d6a4f":"#d1cec7",position:"relative",transition:"background .2s",flexShrink:0}}>
                  <div style={{position:"absolute",top:3,left:editListingForm.is_active?18:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:editListingForm.is_active?"#2d6a4f":"#888"}}>{editListingForm.is_active?"Active - visible to learners":"Paused - hidden from browse"}</span>
              </div>
            </div>
            {listingError&&<p style={{color:"#dc2626",fontSize:12,marginTop:10}}>{listingError}</p>}
            <div style={{display:"flex",gap:8,marginTop:20}}>
              <button onClick={()=>setEditingListing(null)} style={{flex:1,padding:"10px",borderRadius:11,background:"#f5f0e8",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",color:"#666"}}>Cancel</button>
              <button onClick={handleSaveListing} disabled={savingListing||!editListingForm.title.trim()} style={{flex:2,padding:"10px",borderRadius:11,background:savingListing?"#aaa":"#2d6a4f",border:"none",fontSize:13,fontWeight:800,cursor:"pointer",color:"#fff"}}>
                {savingListing?"Saving...":"Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDeleteId&&(
        <div className="modal-backdrop" onClick={()=>setConfirmDeleteId(null)}>
          <div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:40,marginBottom:8}}>🗑️</div>
              <h3 style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:"#1a1a1a",marginBottom:6}}>Delete Listing?</h3>
              <p style={{fontSize:13,color:"#888"}}>This permanently removes the listing. Pending bookings will be cancelled.</p>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDeleteId(null)} style={{flex:1,padding:"10px",borderRadius:11,background:"#f5f0e8",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",color:"#666"}}>Cancel</button>
              <button onClick={()=>handleDeleteListing(confirmDeleteId)} disabled={deletingId===confirmDeleteId} style={{flex:1,padding:"10px",borderRadius:11,background:"#dc2626",border:"none",fontSize:13,fontWeight:800,cursor:"pointer",color:"#fff"}}>
                {deletingId===confirmDeleteId?"Deleting...":"Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{position:"sticky",top:0,zIndex:40,background:"rgba(255,255,255,.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid #e8e2d9",padding:"0 24px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <a href="/dashboard"><span style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:19,color:"#2d6a4f"}}>Skill</span><span style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:19,color:"#1a1a1a"}}>Credit</span></a>
        <div style={{display:"flex",gap:2}}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h])=><a key={l} href={h} className="navlink">{l}</a>)}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <a href="/wallet" style={{fontSize:12,fontWeight:800,color:"#2d6a4f",background:"#e8f4e8",padding:"6px 14px",borderRadius:999,border:"1px solid #b7e4c7"}}>💰 {profile.credits} cr</a>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href="/";}} style={{fontSize:12,fontWeight:600,color:"#dc2626",background:"#fef2f2",padding:"6px 14px",borderRadius:999,border:"1px solid #fecaca",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Log out</button>
        </div>
      </nav>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 28px 80px"}}>

        {/* PROFILE HERO */}
        <div className="card fade-up" style={{overflow:"hidden",marginBottom:16,borderLeft:`3px solid ${rank===1?"#e8a800":rank===2?"#c0c0c0":rank===3?"#cd7f32":lvlColor}`}}>
          <div style={{padding:24}}>
            {editing?(
              <div style={{maxWidth:480}}>
                <h2 style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a",marginBottom:20}}>Edit Profile</h2>
                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:16,background:"#faf8f4",borderRadius:16,border:"1px solid #e8e2d9"}}>
                  <AvatarUploader userId={profile.id} currentUrl={profile.avatar_url||null} initials={getInitials(profile.full_name||"")} lvlColor={lvlColor} rank={rank||undefined} onUploaded={url=>setProfile(p=>p?{...p,avatar_url:url}:p)}/>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:"#555",marginBottom:4}}>Profile Photo</p>
                    <p style={{fontSize:12,color:"#aaa",lineHeight:1.5}}>Click to upload · JPG, PNG, WEBP · Max 3 MB</p>
                    {rank>0&&<p style={{fontSize:11,fontWeight:700,marginTop:4,color:rank===1?"#e8a800":rank===2?"#c0c0c0":"#cd7f32"}}>✨ {rank===1?"Gold":rank===2?"Silver":"Bronze"} border active!</p>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
                  {[{key:"full_name",label:"Full Name",placeholder:"Your full name",type:"input"},{key:"location",label:"Location",placeholder:"e.g. Cebu City, Philippines",type:"input"},{key:"bio",label:"Bio",placeholder:"Tell the community about yourself…",type:"textarea"}].map(f=>(
                    <div key={f.key}>
                      <label style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",display:"block",marginBottom:6}}>{f.label}</label>
                      {f.type==="textarea"?<textarea value={editForm[f.key as keyof typeof editForm]} rows={3} placeholder={f.placeholder} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",borderRadius:11,border:"1.5px solid #e8e2d9",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafaf8",outline:"none",resize:"vertical"}}/>:<input value={editForm[f.key as keyof typeof editForm]} placeholder={f.placeholder} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))} style={{width:"100%",padding:"10px 13px",borderRadius:11,border:"1.5px solid #e8e2d9",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fafaf8",outline:"none"}}/>}
                    </div>
                  ))}
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={()=>setEditing(false)} style={{flex:1,padding:"10px",borderRadius:11,background:"#f5f0e8",border:"none",fontSize:13,fontWeight:700,cursor:"pointer",color:"#666",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} style={{flex:2,padding:"10px",borderRadius:11,background:saving?"#aaa":"#2d6a4f",border:"none",fontSize:13,fontWeight:800,cursor:"pointer",color:"#fff",fontFamily:"'DM Sans',sans-serif"}}>{saving?"Saving…":"Save Changes"}</button>
                  </div>
                </div>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"flex-start",gap:20,flexWrap:"wrap" as const}}>
                <div style={{position:"relative",flexShrink:0,cursor:"pointer"}} onClick={()=>setEditing(true)} title="Edit profile photo">
                  <PremiumAvatar url={profile.avatar_url||null} initials={getInitials(profile.full_name||"")} lvlColor={lvlColor} rank={rank||undefined} size={64}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                    {/* Name */}
                  <h1 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#111",marginBottom:8}}>{profile.full_name||"Unnamed User"}</h1>

                  {/* PRIMARY badges — the important ones */}
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const,marginBottom:6}}>
                    {profile.is_verified&&<span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:999,background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0"}}>✓ Verified</span>}
                    {hasTeachingTitle&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe"}}>{profile.teaching_title}</span>}
                    {hasRatingTitle&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#fffbeb",color:"#92400e",border:"1px solid #fde68a"}}>{profile.rating_title}</span>}
                    {profile.champion_title&&<span style={{fontSize:12,fontWeight:800,padding:"4px 12px",borderRadius:999,background:"#fffbeb",color:"#e8a800",border:"1px solid #f0d890"}}>🏆 {profile.champion_title}{profile.champion_streak&&profile.champion_streak>1?` ×${profile.champion_streak}`:""}</span>}
                  </div>

                  {/* SECONDARY badges — smaller, muted */}
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,marginBottom:10}}>
                    <span style={{fontSize:11,fontWeight:700,color:badge.color}}>{badge.emoji} {badge.name}</span>
                    <span style={{fontSize:11,color:"#ccc"}}>·</span>
                    <span style={{fontSize:11,fontWeight:600,color:lvlColor}}>{displayLevel}</span>
                    {hasMulti&&<><span style={{fontSize:11,color:"#ccc"}}>·</span><span style={{fontSize:11,fontWeight:700,color:"#c0392b"}}>⚡ {profile.xp_multiplier}x XP</span></>}
                  </div>

                  <p style={{fontSize:12,color:"#aaa",marginBottom:12}}>@{profile.username}</p>
                  {profile.bio?<p style={{fontSize:14,color:"#555",lineHeight:1.7,marginBottom:12,maxWidth:520}}>{profile.bio}</p>:<p style={{fontSize:14,color:"#ccc",fontStyle:"italic",marginBottom:12}}>No bio yet — add one to stand out!</p>}
                  {verifiedSkills.length>0&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,marginBottom:12}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#aaa"}}>Verified in:</span>
                      {verifiedSkills.slice(0,4).map(s=><span key={s.id} style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0"}}>✓ {s.skills?.name}</span>)}
                      {verifiedSkills.length>4&&<span style={{fontSize:11,color:"#aaa"}}>+{verifiedSkills.length-4} more</span>}
                    </div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" as const,fontSize:12,color:"#aaa"}}>
                    {profile.location&&<span>📍 {profile.location}</span>}
                    <span>📅 Joined {joinDate}</span>
                    {avgRating>0&&<span>⭐ {avgRating.toFixed(2)} avg rating</span>}
                    <span>🏅 {earnedBadges.length} badge{earnedBadges.length!==1?"s":""}</span>
                  </div>
                </div>
                <button onClick={()=>setEditing(true)} style={{padding:"8px 16px",borderRadius:12,background:"#f5f0e8",border:"1.5px solid #e8e2d9",fontSize:12,fontWeight:700,cursor:"pointer",color:"#555",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>✏️ Edit Profile</button>
              </div>
            )}
            {!editing&&(
              <div style={{marginTop:20,paddingTop:20,borderTop:"1px solid #f5f0e8"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:8}}>
                  <div>
                    <span style={{fontSize:11,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em"}}>Level Progress</span>
                    <div style={{fontSize:13,fontWeight:800,color:lvlColor,marginTop:2}}>{displayLevel}{hasMulti?<span style={{fontSize:11,color:"#c0392b",marginLeft:6}}>⚡ {profile.xp_multiplier}x active</span>:""}</div>
                  </div>
                  <div style={{textAlign:"right" as const}}>
                    <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:900,color:"#111"}}>{profile.xp.toLocaleString()}</span>
                    <span style={{fontSize:12,color:"#aaa"}}> / {xpNext.toLocaleString()} XP</span>
                    <div style={{fontSize:11,color:"#aaa",marginTop:1}}>{xpNext-profile.xp>0?`+${(xpNext-profile.xp).toLocaleString()} XP to next level`:"Max level! 🏆"}</div>
                  </div>
                </div>
                <div className="progress-bar" style={{height:6}}>
                  <div className="xp-bar" style={{width:`${xpPct}%`}}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS STRIP */}
        {!editing&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16,animation:"fadeUp .35s .06s ease both"}}>
            {[{label:"Credits",value:profile.credits,icon:"💰",color:"#2d6a4f",href:"/wallet"},{label:"XP",value:profile.xp,icon:"⚡",color:"#7c3aed",href:"/leaderboard"},{label:"Sessions",value:sessions,icon:"📚",color:"#0891b2",href:"/sessions"},{label:"Listings",value:listings.length,icon:"📋",color:"#b45309",href:"/listings/create"},{label:"Badges",value:earnedBadges.length,icon:"🏅",color:"#dc2626",href:"#"}].map(s=>(
              <a key={s.label} href={s.href} onClick={s.label==="Badges"?e=>{e.preventDefault();setActiveTab("badges");}:undefined} className="card stat-card" style={{padding:"16px 12px",textAlign:"center" as const,display:"block"}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:s.color,lineHeight:1,marginBottom:4}}>{s.value}</div>
                <div style={{fontSize:10,color:"#aaa",fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.label}</div>
              </a>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        {!editing&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16,animation:"fadeUp .35s .1s ease both"}}>
            <div style={{display:"flex",flexDirection:"column" as const,gap:16}}>

              {/* SKILLS */}
              <div className="card" style={{padding:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div><h3 style={{fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:900,color:"#111"}}>Skills & Verifications</h3><p style={{fontSize:12,color:"#aaa",marginTop:2}}>Skills you've listed or been verified in</p></div>
                  <a href="/verify" style={{fontSize:12,fontWeight:700,color:"#2d6a4f",background:"#e8f4e8",padding:"6px 14px",borderRadius:9,border:"1px solid #b7e4c7"}}>+ Get Verified</a>
                </div>
                {verifiedSkills.length>0&&(
                  <div style={{marginBottom:12}}>
                    <p style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8}}>✓ Verified</p>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
                      {verifiedSkills.map(s=><span key={s.id} style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:999,background:"#f0fdf4",color:"#166534",border:"1px solid #bbf7d0"}}>✓ {s.skills?.name} <span style={{color:"#6ee7b7",fontWeight:500}}>· {s.skills?.category}</span></span>)}
                    </div>
                  </div>
                )}
                {unverifiedSkills.length>0&&(
                  <div>
                    <p style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8}}>○ Unverified</p>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
                      {unverifiedSkills.map(s=><span key={s.id} style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:999,background:"#f5f0e8",color:"#888",border:"1px solid #e8e2d9"}}>{s.skills?.name} <a href="/verify" style={{color:"#2d6a4f",fontWeight:700,marginLeft:4}}>verify →</a></span>)}
                    </div>
                  </div>
                )}
                {userSkills.length===0&&(
                  <div style={{background:"#f0fdf4",borderRadius:14,padding:20,border:"1px solid #bbf7d0"}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                      <span style={{fontSize:28,flexShrink:0}}>✅</span>
                      <div style={{flex:1}}>
                        <p style={{fontSize:14,fontWeight:800,color:"#111",marginBottom:8}}>Get your skills verified!</p>
                        <div style={{display:"flex",flexDirection:"column" as const,gap:4,marginBottom:12}}>
                          {["2× more bookings from learners","Verified badge on your profile","Higher ranking in search results"].map(b=>(
                            <div key={b} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#166534"}}>
                              <span style={{color:"#2d6a4f",fontWeight:800}}>✓</span> {b}
                            </div>
                          ))}
                        </div>
                        <a href="/verify" style={{fontSize:12,fontWeight:800,color:"#fff",background:"#2d6a4f",padding:"9px 18px",borderRadius:10,display:"inline-block"}}>Verify Now →</a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TABS */}
              <div>
                <div style={{display:"flex",background:"#f5f0e8",padding:4,borderRadius:12,gap:2,width:"fit-content",marginBottom:16}}>
                  {[{k:"listings",l:"Listings"},{k:"badges",l:`Badges (${earnedBadges.length})`},{k:"activity",l:"Activity"}].map(t=>(
                    <button key={t.k} onClick={()=>setActiveTab(t.k as any)} style={{padding:"7px 16px",borderRadius:9,fontSize:12,fontWeight:700,transition:"all .15s",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",background:activeTab===t.k?"#fff":"transparent",color:activeTab===t.k?"#111":"#aaa",boxShadow:activeTab===t.k?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{t.l}</button>
                  ))}
                </div>

                {activeTab==="listings"&&(
                  <div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div>
                        <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111"}}>My Skill Listings ({listings.length})</h3>
                        <p style={{fontSize:12,color:"#aaa",marginTop:2}}>Create and manage sessions you offer to students.</p>
                      </div>
                      <a href="/listings/create" style={{fontSize:12,fontWeight:700,color:"#fff",background:"#2d6a4f",padding:"8px 16px",borderRadius:10,flexShrink:0}}>+ Create Listing</a>
                    </div>
                    {listings.length===0?(
                      <div className="card" style={{padding:48,textAlign:"center" as const}}>
                        <p style={{fontSize:36,marginBottom:12}}>📋</p>
                        <h4 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111",marginBottom:8}}>No listings yet</h4>
                        <p style={{fontSize:12,color:"#aaa",marginBottom:20}}>Create a skill listing to start teaching!</p>
                        <a href="/listings/create" style={{fontSize:12,fontWeight:700,color:"#fff",background:"#2d6a4f",padding:"10px 20px",borderRadius:10,display:"inline-block"}}>Create your first listing →</a>
                      </div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                        {listings.map(listing=>{
                          const fmt=FORMAT_CONFIG[listing.format]||FORMAT_CONFIG.mixed;
                          return(
                            <div key={listing.id} className="listing-row card" style={{padding:"16px 20px",display:"flex",alignItems:"center",gap:16,justifyContent:"space-between",flexWrap:"wrap" as const}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,marginBottom:6}}>
                                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:fmt.bg,color:fmt.color}}>{fmt.label}</span>
                                  {listing.skills&&<span style={{fontSize:11,color:"#aaa"}}>{listing.skills.name}</span>}
                                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:listing.is_active?"#f0fdf4":"#f5f0e8",color:listing.is_active?"#166534":"#aaa"}}>{listing.is_active?"● Active":"○ Paused"}</span>
                                </div>
                                <p style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:900,color:"#111",marginBottom:2}}>{listing.title}</p>
                                <p style={{fontSize:12,color:"#aaa"}}>{listing.duration} min session</p>
                              </div>
                              <div style={{textAlign:"right" as const,flexShrink:0,marginRight:8}}>
                                <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:900,color:"#2d6a4f"}}>{listing.credit_price} cr</div>
                                <div style={{fontSize:11,color:"#aaa"}}>per session</div>
                              </div>
                              <div style={{display:"flex",gap:8,flexShrink:0}}>
                                <button onClick={()=>openEditListing(listing)} style={{padding:"6px 14px",borderRadius:9,background:"#f5f0e8",border:"1.5px solid #e8e2d9",fontSize:12,fontWeight:700,cursor:"pointer",color:"#555",fontFamily:"'DM Sans',sans-serif"}}>✏️ Edit</button>
                                <button onClick={()=>setConfirmDeleteId(listing.id)} style={{padding:"6px 14px",borderRadius:9,background:"#fef2f2",border:"1.5px solid #fecaca",fontSize:12,fontWeight:700,cursor:"pointer",color:"#dc2626",fontFamily:"'DM Sans',sans-serif"}}>🗑</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab==="badges"&&(
                  <div>
                    <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111",marginBottom:12}}>Earned Badges</h3>
                    {earnedBadges.length===0?(
                      <div className="card" style={{padding:48,textAlign:"center" as const}}>
                        <p style={{fontSize:36,marginBottom:12}}>🏅</p>
                        <h4 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111",marginBottom:8}}>No badges yet</h4>
                        <p style={{fontSize:12,color:"#aaa"}}>Complete sessions, answer bounties, and participate!</p>
                      </div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        {earnedBadges.map((b,i)=>(
                          <div key={i} className="card" style={{padding:20,textAlign:"center" as const}}>
                            <div style={{fontSize:36,marginBottom:12}}>{b.icon}</div>
                            <p style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:900,color:"#111",marginBottom:6}}>{b.name}</p>
                            <p style={{fontSize:12,color:"#aaa",lineHeight:1.6}}>{b.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab==="activity"&&(
                  <div>
                    <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111",marginBottom:12}}>Credit Activity</h3>
                    {transactions.length===0?(
                      <div className="card" style={{padding:48,textAlign:"center" as const}}>
                        <p style={{fontSize:36,marginBottom:12}}>📊</p>
                        <h4 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111",marginBottom:8}}>No transactions yet</h4>
                        <p style={{fontSize:12,color:"#aaa"}}>Your credit history will appear here.</p>
                      </div>
                    ):(
                      <div className="card" style={{overflow:"hidden"}}>
                        {transactions.map((tx,i)=>(
                          <div key={tx.id} className="tx-row" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 20px",borderBottom:i<transactions.length-1?"1px solid #f5f0e8":"none"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:36,height:36,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,background:tx.amount>0?"#f0fdf4":"#fef2f2"}}>{TX_ICONS[tx.type]||"💳"}</div>
                              <div>
                                <p style={{fontSize:13,fontWeight:600,color:"#555"}}>{tx.description||tx.type.replace(/_/g," ")}</p>
                                <p style={{fontSize:11,color:"#aaa"}}>{new Date(tx.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                              </div>
                            </div>
                            <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,flexShrink:0,color:tx.amount>0?"#2d6a4f":"#dc2626"}}>{tx.amount>0?"+":""}{tx.amount} cr</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>

              {/* All active weekly perks */}
              {(rank>0||hasTeachingTitle||hasRatingTitle)&&(
                <div style={{borderRadius:20,padding:"18px 20px",background:rank>0?(rankBg||"#1a3d2e"):"linear-gradient(135deg,#1a1a2e,#2d2d4e)",border:"1.5px solid rgba(255,255,255,.08)"}}>
                  <div style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,.4)",textTransform:"uppercase" as const,letterSpacing:".12em",marginBottom:12}}>🏆 This Week's Titles</div>
                  {rank>0&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:(hasTeachingTitle||hasRatingTitle)?12:0,paddingBottom:(hasTeachingTitle||hasRatingTitle)?12:0,borderBottom:(hasTeachingTitle||hasRatingTitle)?"1px solid rgba(255,255,255,.08)":"none"}}>
                      <span style={{fontSize:28}}>{rank===1?"👑":rank===2?"🥈":"🥉"}</span>
                      <div>
                        <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#fff"}}>#{rank} XP Leader</div>
                        {profile.champion_title&&<div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>🏆 {profile.champion_title}</div>}
                        {hasMulti&&<div style={{fontSize:11,color:"#ffd700",fontWeight:700,marginTop:2}}>⚡ {profile.xp_multiplier}x XP active</div>}
                      </div>
                    </div>
                  )}
                  {hasTeachingTitle&&(
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:hasRatingTitle?12:0,paddingBottom:hasRatingTitle?12:0,borderBottom:hasRatingTitle?"1px solid rgba(255,255,255,.08)":"none"}}>
                      <span style={{fontSize:22}}>🎓</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:"#93c5fd"}}>{profile.teaching_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Teaching Activity</div>
                      </div>
                    </div>
                  )}
                  {hasRatingTitle&&(
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:22}}>⭐</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:800,color:"#fcd34d"}}>{profile.rating_title}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Student Ratings</div>
                      </div>
                    </div>
                  )}
                  <a href="/leaderboard" style={{display:"block",textAlign:"center" as const,background:"rgba(255,255,255,.12)",borderRadius:10,padding:"9px",fontSize:12,fontWeight:700,color:"#fff",border:"1px solid rgba(255,255,255,.15)",marginTop:14}}>View Leaderboard →</a>
                </div>
              )}

              {/* Badge tier card */}
              <div className="card" style={{padding:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <p style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em"}}>Badge Tier</p>
                  <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:999,background:badge.bg,color:badge.color}}>{badge.emoji} {badge.name}</span>
                </div>
                <div style={{borderRadius:12,padding:12,marginBottom:16,display:"flex",alignItems:"center",gap:12,background:badge.bg,border:`1px solid ${badge.color}22`}}>
                  <span style={{fontSize:28}}>{badge.emoji}</span>
                  <div><p style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:900,color:badge.color}}>{badge.name}</p><p style={{fontSize:12,color:badge.color,opacity:.75}}>{badge.desc}</p></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                  {[{icon:"⚡",val:profile.xp,label:"XP"},{icon:"📚",val:sessions,label:"Sessions"},{icon:"⭐",val:avgRating.toFixed(2),label:"Rating"}].map(s=>(
                    <div key={s.label} style={{background:"#faf8f4",borderRadius:12,padding:10,textAlign:"center" as const}}>
                      <div style={{fontSize:12,marginBottom:4}}>{s.icon}</div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:900,color:"#111"}}>{s.val}</div>
                      <div style={{fontSize:9,color:"#aaa",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {nextBadge&&(
                  <div>
                    <p style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:10}}>Next: {nextBadge.emoji} {nextBadge.name}</p>
                    {[{label:"XP",current:profile.xp,req:nextBadge.xpReq},{label:"Sessions",current:sessions,req:nextBadge.sessionsReq},{label:"Rating",current:avgRating,req:nextBadge.ratingReq}].filter(r=>r.req>0).map(r=>{
                      const done=r.current>=r.req;const pct=Math.min((r.current/r.req)*100,100);
                      return(
                        <div key={r.label} style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                            <span style={{fontSize:11,color:"#555",fontWeight:600}}>{r.label}</span>
                            <span style={{fontSize:11,fontWeight:700,color:done?"#2d6a4f":"#aaa"}}>{done?"✓":`${typeof r.current==="number"&&r.current%1!==0?r.current.toFixed(2):r.current} / ${r.req}`}</span>
                          </div>
                          <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:done?"#2d6a4f":"#cbd5e1"}}/></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{paddingTop:12,marginTop:4,borderTop:"1px solid #f5f0e8"}}>
                  <p style={{fontSize:9,fontWeight:700,color:"#ccc",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8}}>All Tiers</p>
                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                    {BADGE_TIERS.map(t=><span key={t.name} style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:999,background:t.name===badge.name?t.bg:"#f5f0e8",color:t.name===badge.name?t.color:"#ccc"}}>{t.emoji} {t.name}</span>)}
                  </div>
                </div>
              </div>

              {/* Reputation */}
              <div className="card" style={{padding:20}}>
                <p style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:12}}>Reputation Score</p>
                <div style={{background:"#fffbeb",borderRadius:12,padding:12,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",border:"1px solid #fde68a"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:20}}>💫</span>
                    <div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#92400e",lineHeight:1}}>{rep}<span style={{fontSize:13,color:"#fbbf24"}}>/100</span></div>
                      <div style={{fontSize:11,fontWeight:700,color:"#92400e"}}>{repLabel}</div>
                    </div>
                  </div>
                  <svg viewBox="0 0 52 52" style={{width:44,height:44,flexShrink:0,transform:"rotate(-90deg)"}}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5"/>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep,100)/100)*131.9} 131.9`} strokeLinecap="round"/>
                  </svg>
                </div>
                {[{icon:"⭐",label:"Rating",pts:Math.min(Math.round(avgRating*sessions*4),80),max:80,detail:`${avgRating.toFixed(2)} avg × ${sessions} sessions`},{icon:"📚",label:"Sessions",pts:Math.min(sessions*2,15),max:15,detail:`${sessions} × 2 pts`},{icon:"🔄",label:"Repeats",pts:Math.min(repeatClients*5,10),max:10,detail:`${repeatClients} repeat clients × 5`},{icon:"⚠️",label:"Disputes",pts:disputes*-15,max:0,detail:disputes===0?"No disputes ✓":`${disputes} × -15`}].map(r=>(
                  <div key={r.label} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#555"}}>{r.icon} {r.label}</span>
                      <span style={{fontSize:12,fontWeight:800,color:r.pts>0?"#2d6a4f":r.pts<0?"#dc2626":"#aaa"}}>{r.pts>0?`+${r.pts}`:r.pts<0?`${r.pts}`:"✓"}{r.pts!==0?" pts":""}</span>
                    </div>
                    <p style={{fontSize:11,color:"#aaa",marginBottom:4}}>{r.detail}</p>
                    {r.max>0&&<div className="progress-bar"><div className="progress-fill" style={{width:`${Math.min((r.pts/r.max)*100,100)}%`,background:"#f59e0b"}}/></div>}
                  </div>
                ))}
              </div>

              {/* Quick links */}
              <div className="card" style={{padding:16}}>
                <p style={{fontSize:10,fontWeight:800,color:"#aaa",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:8}}>Quick Links</p>
                {[["✅","Get Verified","/verify"],["🎓","Create Listing","/listings/create"],["⭐","My Ratings","/ratings"],["🏆","Leaderboard","/leaderboard"],["💰","Wallet","/wallet"]].map(([icon,label,href])=>(
                  <a key={label} href={href} className="quick-link" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,color:"#555",fontSize:12,fontWeight:600,transition:"all .12s"}}>
                    <span>{icon}</span><span style={{flex:1}}>{label}</span><span style={{color:"#ccc"}}>›</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}