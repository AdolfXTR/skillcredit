"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DisputeSession = {
  id: string; teacher_id: string; learner_id: string; credit_amount: number;
  status: string; created_at: string;
  listing?: { title: string; format: string };
  teacher?: { id: string; full_name: string; username: string; level: string; avatar_url?: string | null };
  learner?: { id: string; full_name: string; username: string; level: string; avatar_url?: string | null };
};
type FlaggedListing = {
  id: string; title: string; description: string; format: string; price: number;
  status: string; is_flagged?: boolean; created_at: string;
  teacher?: { id: string; full_name: string; username: string; avatar_url?: string | null; level: string };
};
type Rating = {
  id: string; session_id: string; overall: number; review: string | null;
  is_flagged: boolean; created_at: string;
  rater?: { full_name: string; username: string };
  rated?: { full_name: string; username: string };
};
type Report = {
  id: string; reporter_id: string; reported_id: string; reason: string;
  status: string; created_at: string;
  reporter?: { full_name: string; username: string };
  reported?: { full_name: string; username: string };
};
type ContentItem = {
  id: string;
  type: "post"|"comment"|"listing"|"bounty"|"bio"|"avatar"|"session_note"|"username";
  content: string; author_id: string;
  author?: { id: string; full_name: string; username: string; level: string; avatar_url?: string | null };
  created_at: string; status?: string; extra?: string; image_url?: string | null;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling:"#2d6a4f", Learner:"#1d4ed8", Contributor:"#7c3aed",
  Skilled:"#b45309", Expert:"#dc2626", Master:"#0891b2", Legend:"#d97706",
};
const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  post:         { label:"Forum Post",   color:"#58a6ff", bg:"#0c2a4a", icon:"📝" },
  comment:      { label:"Answer",       color:"#a371f7", bg:"#1c1a3b", icon:"💬" },
  listing:      { label:"Listing",      color:"#f59e0b", bg:"#451a03", icon:"📚" },
  bounty:       { label:"Bounty",       color:"#3fb950", bg:"#0d4429", icon:"🎯" },
  bio:          { label:"Bio",          color:"#e6edf3", bg:"#21262d", icon:"👤" },
  avatar:       { label:"Avatar",       color:"#f85149", bg:"#450a0a", icon:"🖼️" },
  session_note: { label:"Session Note", color:"#d29922", bg:"#2d2000", icon:"📋" },
  username:     { label:"Username",     color:"#ec4899", bg:"#2d0a1f", icon:"🏷️" },
};
const REMOVAL_REASONS = [
  "Inappropriate or offensive content","Spam or misleading information","Harassment or hate speech",
  "Scam or fraudulent activity","Explicit or adult content","Threatening or dangerous content",
  "Impersonation or fake identity","Violates platform terms of service","Other",
];

function getInitials(name: string) { return name?.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2)||"?"; }
function Avatar({ user, size=32 }: { user: { full_name:string; level:string; avatar_url?: string|null }; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", background:user.avatar_url?"transparent":(LEVEL_COLORS[user.level]||"#2d6a4f"), display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.33, fontWeight:800, color:"#fff", flexShrink:0 }}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
        : getInitials(user.full_name)}
    </div>
  );
}

export default function ModeratorDashboard() {
  const [tab, setTab] = useState<"overview"|"disputes"|"content"|"listings"|"ratings"|"reports">("overview");
  const [disputes, setDisputes] = useState<DisputeSession[]>([]);
  const [listings, setListings] = useState<FlaggedListing[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [contentFilter, setContentFilter] = useState<"all"|"post"|"comment"|"listing"|"bounty"|"bio"|"session_note"|"username">("all");
  const [contentSearch, setContentSearch] = useState("");
  const [removeModal, setRemoveModal] = useState<ContentItem|null>(null);
  const [removeReason, setRemoveReason] = useState(REMOVAL_REASONS[0]);
  const [removeNote, setRemoveNote] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem|null>(null);
  const [detailComments, setDetailComments] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProfile, setDetailProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string|null>(null);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [resolveModal, setResolveModal] = useState<DisputeSession|null>(null);
  const [resolution, setResolution] = useState<"teacher"|"learner"|"split">("teacher");
  const [resolveNote, setResolveNote] = useState("");
  const [warnModal, setWarnModal] = useState<any>(null);
  const [warnMsg, setWarnMsg] = useState("");
  const [modProfile, setModProfile] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  useEffect(()=>{loadAll();},[]);

  async function loadAll() {
    setLoading(true);
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) { window.location.href="/login"; return; }
    const {data:prof} = await supabase.from("profiles").select("*").eq("id",user.id).single();
    if (!prof||(prof.role!=="admin"&&prof.role!=="moderator")) { window.location.href="/dashboard"; return; }
    setModProfile(prof);
    await Promise.all([loadDisputes(),loadListings(),loadRatings(),loadReports(),loadAllContent(),loadActivity()]);
    setLoading(false);
  }

  async function loadActivity() {
    const {data} = await supabase.from("moderation_logs")
      .select("*").order("created_at",{ascending:false}).limit(8);
    setRecentActivity(data||[]);
  }

  async function loadAllContent() {
    setContentLoading(true);
    const items: ContentItem[] = [];
    async function fetchAuthors(ids: string[]) {
      if (!ids.length) return [] as any[];
      const {data} = await supabase.from("profiles").select("id,full_name,username,level,avatar_url").in("id",[...new Set(ids)]);
      return data||[];
    }
    const {data:posts,error:postsErr} = await supabase.from("forum_posts").select("id,title,body,author_id,created_at,status,image_url").order("created_at",{ascending:false}).limit(60);
    if (postsErr) console.warn("posts error:",postsErr.message);
    const postAuthors = await fetchAuthors((posts||[]).map((p:any)=>p.author_id));
    (posts||[]).forEach((p:any)=>items.push({id:p.id,type:"post",content:p.body||p.title,extra:p.title,author_id:p.author_id,author:postAuthors.find((a:any)=>a.id===p.author_id),created_at:p.created_at,status:p.status,image_url:p.image_url}));

    const {data:answers,error:commentsErr} = await supabase.from("forum_answers").select("id,content,author_id,post_id,created_at").order("created_at",{ascending:false}).limit(60);
    if (commentsErr) console.warn("forum_answers error:",commentsErr.message);
    const commentAuthors = await fetchAuthors((answers||[]).map((a:any)=>a.author_id));
    (answers||[]).forEach((c:any)=>items.push({id:c.id,type:"comment",content:c.content,author_id:c.author_id,author:commentAuthors.find((a:any)=>a.id===c.author_id),created_at:c.created_at}));

    const {data:bounties,error:bountiesErr} = await supabase.from("bounties").select("id,title,description,poster_id,created_at,status,image_url").order("created_at",{ascending:false}).limit(40);
    if (bountiesErr) console.warn("bounties error:",bountiesErr.message);
    const bountyAuthors = await fetchAuthors((bounties||[]).map((b:any)=>b.poster_id));
    (bounties||[]).forEach((b:any)=>items.push({id:b.id,type:"bounty",content:b.description||b.title,author_id:b.poster_id,author:bountyAuthors.find((a:any)=>a.id===b.poster_id),created_at:b.created_at,status:b.status,extra:b.title,image_url:b.image_url}));

    const {data:allListings,error:listingsErr} = await supabase.from("listings").select("id,title,description,teacher_id,created_at,is_active,thumbnail_url,credit_price,format").order("created_at",{ascending:false}).limit(40);
    if (listingsErr) console.warn("listings error:",listingsErr.message);
    const listingAuthors = await fetchAuthors((allListings||[]).map((l:any)=>l.teacher_id));
    (allListings||[]).forEach((l:any)=>items.push({id:l.id,type:"listing",content:l.description||l.title,author_id:l.teacher_id,author:listingAuthors.find((a:any)=>a.id===l.teacher_id),created_at:l.created_at,status:l.is_active?"active":"inactive",extra:`${l.title} · ${l.credit_price} cr · ${l.format}`,image_url:l.thumbnail_url}));

    const {data:profileBios} = await supabase.from("profiles").select("id,bio,full_name,username,level,avatar_url,created_at").not("bio","is",null).neq("bio","").order("created_at",{ascending:false}).limit(30);
    (profileBios||[]).forEach((p:any)=>items.push({id:`bio-${p.id}`,type:"bio",content:p.bio,author_id:p.id,author:{id:p.id,full_name:p.full_name,username:p.username,level:p.level,avatar_url:p.avatar_url},created_at:p.created_at}));

    const {data:usernames} = await supabase.from("profiles").select("id,username,full_name,level,avatar_url,created_at").not("username","is",null).order("created_at",{ascending:false}).limit(40);
    (usernames||[]).forEach((p:any)=>items.push({id:`username-${p.id}`,type:"username",content:p.username,author_id:p.id,author:{id:p.id,full_name:p.full_name,username:p.username,level:p.level,avatar_url:p.avatar_url},created_at:p.created_at}));

    const {data:sessionNotes} = await supabase.from("sessions").select("id,notes,teacher_id,created_at,status").not("notes","is",null).neq("notes","").order("created_at",{ascending:false}).limit(30);
    const snoteAuthors = await fetchAuthors((sessionNotes||[]).map((s:any)=>s.teacher_id));
    (sessionNotes||[]).forEach((s:any)=>items.push({id:`snote-${s.id}`,type:"session_note",content:s.notes,author_id:s.teacher_id,author:snoteAuthors.find((a:any)=>a.id===s.teacher_id),created_at:s.created_at,status:s.status}));

    items.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    setContentItems(items);
    setContentLoading(false);
  }

  async function loadDetail(item: ContentItem) {
    setSelectedContent(item); setDetailComments([]); setDetailProfile(null); setDetailLoading(true);
    const {data:prof} = await supabase.from("profiles").select("id,full_name,username,level,avatar_url,bio,xp,credits,created_at,is_verified,is_banned").eq("id",item.author_id).single();
    setDetailProfile(prof||null);
    if (item.type==="post") {
      const {data:comments} = await supabase.from("forum_answers").select("id,content,created_at,author_id").eq("post_id",item.id).order("created_at",{ascending:true}).limit(30);
      if (comments&&comments.length>0) {
        const uids=[...new Set(comments.map((c:any)=>c.author_id))];
        const {data:users} = await supabase.from("profiles").select("id,full_name,username,avatar_url,level").in("id",uids as string[]);
        setDetailComments(comments.map((c:any)=>({...c,user_id:c.author_id,user:(users||[]).find((u:any)=>u.id===c.author_id)})));
      } else setDetailComments([]);
    }
    setDetailLoading(false);
  }

  async function handleRemoveContent() {
    if (!removeModal) return;
    setActionLoading("remove");
    const item=removeModal;
    const reason=`${removeReason}${removeNote?": "+removeNote:""}`;
    try {
      switch(item.type) {
        case "post": await supabase.from("forum_posts").update({status:"removed",body:"[Removed by moderator]"}).eq("id",item.id); break;
        case "comment": await supabase.from("forum_answers").delete().eq("id",item.id); break;
        case "listing": await supabase.from("listings").update({is_active:false}).eq("id",item.id); break;
        case "bounty": await supabase.from("bounties").update({status:"removed"}).eq("id",item.id); break;
        case "bio": await supabase.from("profiles").update({bio:""}).eq("id",item.author_id); break;
        case "avatar": await supabase.from("profiles").update({avatar_url:null}).eq("id",item.author_id); break;
        case "username": await supabase.from("profiles").update({username_flagged:true}).eq("id",item.author_id); break;
        case "session_note": await supabase.from("sessions").update({notes:""}).eq("id",item.id.replace("snote-","")); break;
      }
      await supabase.from("moderation_logs").insert({mod_id:modProfile?.id,target_id:item.id,target_type:item.type,action:"removed",reason,author_id:item.author_id});
      await supabase.from("notifications").insert({user_id:item.author_id,type:"moderation",title:`⚠️ Your ${CONTENT_TYPE_CONFIG[item.type]?.label} was removed`,body:`A moderator removed your ${item.type}. Reason: ${reason}`,link:"/dashboard"});
      showToast(`${CONTENT_TYPE_CONFIG[item.type]?.label} removed. User notified.`);
      setContentItems(prev=>prev.filter(c=>c.id!==item.id));
      await loadActivity();
    } catch(_) { showToast("Failed to remove content.","error"); }
    setRemoveModal(null); setRemoveReason(REMOVAL_REASONS[0]); setRemoveNote(""); setActionLoading(null);
  }

  async function loadDisputes() {
    const {data} = await supabase.from("sessions").select(`*,listing:listings(title,format),teacher:profiles!sessions_teacher_id_fkey(id,full_name,username,level,avatar_url),learner:profiles!sessions_learner_id_fkey(id,full_name,username,level,avatar_url)`).eq("status","disputed").order("created_at",{ascending:false});
    setDisputes((data as unknown as DisputeSession[])||[]);
  }
  async function loadListings() {
    const {data} = await supabase.from("listings").select(`*,teacher:profiles!listings_teacher_id_fkey(id,full_name,username,level,avatar_url)`).or("is_flagged.eq.true,status.eq.pending_review").order("created_at",{ascending:false}).limit(50);
    setListings((data as unknown as FlaggedListing[])||[]);
  }
  async function loadRatings() {
    const {data} = await supabase.from("ratings").select(`*,rater:profiles!ratings_rater_id_fkey(full_name,username),rated:profiles!ratings_rated_id_fkey(full_name,username)`).eq("is_flagged",true).order("created_at",{ascending:false}).limit(50);
    setRatings((data as unknown as Rating[])||[]);
  }
  async function loadReports() {
    const {data} = await supabase.from("reports").select(`*,reporter:profiles!reports_reporter_id_fkey(full_name,username),reported:profiles!reports_reported_id_fkey(full_name,username)`).eq("status","open").order("created_at",{ascending:false}).limit(50);
    setReports((data as unknown as Report[])||[]);
  }

  async function handleResolveDispute() {
    if (!resolveModal) return;
    setActionLoading("resolve");
    const s=resolveModal;
    if (resolution==="teacher") { await supabase.rpc("increment_credits",{user_id:s.teacher_id,amount:s.credit_amount}); await supabase.from("escrow").update({status:"released"}).eq("session_id",s.id); }
    else if (resolution==="learner") { await supabase.rpc("increment_credits",{user_id:s.learner_id,amount:s.credit_amount}); await supabase.from("escrow").update({status:"refunded"}).eq("session_id",s.id); }
    else { const half=Math.floor(s.credit_amount/2); await supabase.rpc("increment_credits",{user_id:s.teacher_id,amount:half}); await supabase.rpc("increment_credits",{user_id:s.learner_id,amount:s.credit_amount-half}); await supabase.from("escrow").update({status:"released"}).eq("session_id",s.id); }
    await supabase.from("sessions").update({status:"completed"}).eq("id",s.id);
    const msg=resolution==="teacher"?"Resolved in teacher's favor.":resolution==="learner"?"Resolved in learner's favor.":"Split equally.";
    try { await supabase.from("notifications").insert([{user_id:s.teacher_id,type:"dispute",title:"⚖️ Dispute Resolved",body:`${msg} ${resolveNote}`,link:"/sessions"},{user_id:s.learner_id,type:"dispute",title:"⚖️ Dispute Resolved",body:`${msg} ${resolveNote}`,link:"/sessions"}]); } catch(_){}
    showToast(msg); setResolveModal(null); setResolveNote(""); setResolution("teacher"); await loadDisputes(); await loadActivity(); setActionLoading(null);
  }
  async function handleApproveListing(listing: FlaggedListing) {
    setActionLoading("listing-"+listing.id);
    await supabase.from("listings").update({is_flagged:false,status:"active"}).eq("id",listing.id);
    showToast(`"${listing.title}" approved.`); await loadListings(); setActionLoading(null);
  }
  async function handleRemoveListing(listing: FlaggedListing) {
    setActionLoading("listing-"+listing.id);
    await supabase.from("listings").update({status:"removed"}).eq("id",listing.id);
    if (listing.teacher?.id) await supabase.from("notifications").insert({user_id:listing.teacher.id,type:"moderation",title:"⚠️ Your listing was removed",body:`"${listing.title}" was removed.`,link:"/listings"});
    showToast(`"${listing.title}" removed.`); await loadListings(); setActionLoading(null);
  }
  async function handleRemoveRating(rating: Rating) {
    setActionLoading("rating-"+rating.id); await supabase.from("ratings").delete().eq("id",rating.id);
    showToast("Rating removed."); await loadRatings(); setActionLoading(null);
  }
  async function handleDismissRating(rating: Rating) {
    setActionLoading("rating-"+rating.id); await supabase.from("ratings").update({is_flagged:false}).eq("id",rating.id);
    showToast("Flag dismissed."); await loadRatings(); setActionLoading(null);
  }
  async function handleWarnUser() {
    if (!warnModal||!warnMsg) return;
    setActionLoading("warn");
    await supabase.from("notifications").insert({user_id:warnModal.id,type:"warning",title:"⚠️ Moderator Warning",body:warnMsg,link:"/dashboard"});
    await supabase.from("moderation_logs").insert({mod_id:modProfile?.id,target_id:warnModal.id,target_type:"user",action:"warned",reason:warnMsg,author_id:warnModal.id});
    showToast(`Warning sent to ${warnModal.full_name}.`);
    setWarnModal(null); setWarnMsg(""); setActionLoading(null); await loadActivity();
  }
  async function handleResolveReport(reportId: string) {
    await supabase.from("reports").update({status:"resolved"}).eq("id",reportId);
    showToast("Report marked resolved."); await loadReports();
  }

  const filteredContent = contentItems.filter(item => {
    const typeOk = contentFilter==="all"||item.type===contentFilter;
    const q = contentSearch.toLowerCase();
    const searchOk = !q||item.content?.toLowerCase().includes(q)||item.author?.full_name?.toLowerCase().includes(q)||item.author?.username?.toLowerCase().includes(q)||item.extra?.toLowerCase().includes(q);
    return typeOk&&searchOk;
  });

  const CONTENT_FILTERS = ["all","post","comment","listing","bounty","bio","session_note","username"] as const;

  const totalWork = disputes.length+listings.length+ratings.length+reports.length;
  const platformStatus = totalWork===0?"All Clear":totalWork<5?"Low Activity":totalWork<15?"Moderate":"Elevated";
  const statusColor = totalWork===0?"#3fb950":totalWork<5?"#58a6ff":totalWork<15?"#f59e0b":"#f85149";

  const activityIcons: Record<string,string> = { removed:"🗑️", warned:"⚠️", resolved:"✅", approved:"✓", dismissed:"↩" };

  const NAV = [
    { id:"overview",  icon:"⬡",  label:"Overview"         },
    { id:"disputes",  icon:"⚖️",  label:"Disputes",  count:disputes.length  },
    { id:"content",   icon:"🛡️",  label:"Content",   count:contentItems.length },
    { id:"listings",  icon:"📋",  label:"Flagged",   count:listings.length  },
    { id:"ratings",   icon:"⭐",  label:"Ratings",   count:ratings.length   },
    { id:"reports",   icon:"🚨",  label:"Reports",   count:reports.length   },
  ];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0a0d12", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:36, height:36, border:"2px solid #a371f7", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 14px" }} />
        <div style={{ fontSize:12, color:"#6e7681", letterSpacing:2, textTransform:"uppercase" }}>Loading</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0d12", fontFamily:"'DM Sans',sans-serif", color:"#e6edf3", display:"flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#21262d;border-radius:99px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        input:focus,textarea:focus,select:focus{outline:none}
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 16px;border-radius:10px;cursor:pointer;transition:all .15s;font-size:13px;font-weight:600;color:#6e7681;width:100%;border:none;background:transparent;font-family:'DM Sans',sans-serif;text-align:left}
        .nav-item:hover{background:#161b22;color:#c9d1d9}
        .nav-item.active{background:#161b22;color:#e6edf3;border-left:2px solid #a371f7}
        .stat-card{background:#0f1318;border:1px solid #21262d;border-radius:14px;padding:20px 22px;cursor:pointer;transition:all .18s}
        .stat-card:hover{border-color:#30363d;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.4)}
        .item-row{background:#0f1318;border:1px solid #21262d;border-radius:12px;padding:16px 18px;margin-bottom:8px;transition:all .15s}
        .item-row:hover{border-color:#30363d;background:#111620}
        .action-btn{padding:7px 14px;border-radius:8px;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s}
        .action-btn:hover{filter:brightness(1.15)}
      `}</style>

      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, zIndex:999, padding:"12px 20px", borderRadius:12, background:toast.type==="success"?"#0d4429":"#450a0a", color:toast.type==="success"?"#3fb950":"#f85149", fontSize:13, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,.6)", border:`1px solid ${toast.type==="success"?"#1a5c38":"#7f1d1d"}`, animation:"fadeUp .2s ease", display:"flex", alignItems:"center", gap:8 }}>
          {toast.type==="success"?"✓":"✕"} {toast.msg}
        </div>
      )}

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width:220, background:"#0d1117", borderRight:"1px solid #161b22", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", flexShrink:0 }}>
        <div style={{ padding:"22px 20px 16px", borderBottom:"1px solid #161b22" }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, marginBottom:6 }}>
            <span style={{ color:"#2d6a4f" }}>Skill</span><span style={{ color:"#e6edf3" }}>Credit</span>
          </div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#1c1a3b", border:"1px solid #3d2f7a", borderRadius:99, padding:"3px 10px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:"#a371f7", animation:"pulse 2s ease infinite" }} />
            <span style={{ fontSize:9, fontWeight:800, color:"#a371f7", letterSpacing:1.5 }}>MODERATOR</span>
          </div>
        </div>

        <nav style={{ padding:"12px 12px", flex:1, overflowY:"auto" }}>
          <div style={{ fontSize:9, fontWeight:700, color:"#484f58", letterSpacing:1.5, textTransform:"uppercase", padding:"4px 8px", marginBottom:6 }}>Workspace</div>
          {NAV.map(n => (
            <button key={n.id} className={`nav-item${tab===n.id?" active":""}`} onClick={()=>setTab(n.id as any)}>
              <span style={{ fontSize:14 }}>{n.icon}</span>
              <span style={{ flex:1 }}>{n.label}</span>
              {n.count !== undefined && n.count > 0 && (
                <span style={{ fontSize:10, background:"#f85149", color:"#fff", padding:"1px 6px", borderRadius:99, fontWeight:800, minWidth:18, textAlign:"center" }}>
                  {n.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:"12px 16px", borderTop:"1px solid #161b22" }}>
          {modProfile && (
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"#1c1a3b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#a371f7", flexShrink:0 }}>
                {getInitials(modProfile.full_name||"")}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#e6edf3" }}>{modProfile.full_name?.split(" ")[0]}</div>
                <div style={{ fontSize:10, color:"#484f58" }}>@{modProfile.username}</div>
              </div>
            </div>
          )}
          <a href="/dashboard" style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#484f58", padding:"7px 10px", borderRadius:8, border:"1px solid #161b22", textDecoration:"none", transition:"all .12s" }}
            onMouseOver={e=>{(e.currentTarget as HTMLElement).style.color="#8b949e";(e.currentTarget as HTMLElement).style.borderColor="#21262d"}}
            onMouseOut={e=>{(e.currentTarget as HTMLElement).style.color="#484f58";(e.currentTarget as HTMLElement).style.borderColor="#161b22"}}>
            ← Back to App
          </a>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"28px 32px 60px" }}>

        {/* ── OVERVIEW TAB ── */}
        {tab==="overview" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:900, marginBottom:4 }}>
                Good {new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, {modProfile?.full_name?.split(" ")[0]} 👋
              </h1>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:statusColor, animation:totalWork>0?"pulse 2s ease infinite":"none" }} />
                <span style={{ fontSize:13, color:"#8b949e" }}>Platform Status: <strong style={{ color:statusColor }}>{platformStatus}</strong></span>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
              {[
                { label:"Open Disputes",    value:disputes.length,  icon:"⚖️", color:"#a371f7", action:()=>setTab("disputes") },
                { label:"Flagged Content",  value:listings.length,  icon:"🚩", color:"#f85149", action:()=>setTab("listings") },
                { label:"Open Reports",     value:reports.length,   icon:"📝", color:"#f59e0b", action:()=>setTab("reports")  },
                { label:"Flagged Ratings",  value:ratings.length,   icon:"⭐", color:"#58a6ff", action:()=>setTab("ratings")  },
              ].map(s => (
                <div key={s.label} className="stat-card" onClick={s.action}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                    <span style={{ fontSize:22 }}>{s.icon}</span>
                    {(s.value as number)>0 && <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, animation:"pulse 2s ease infinite" }} />}
                  </div>
                  <div style={{ fontFamily:"'Fraunces',serif", fontSize:32, fontWeight:900, color:s.value>0?s.color:"#484f58", marginBottom:4 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#484f58", fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div style={{ background:"#0f1318", border:"1px solid #21262d", borderRadius:14, padding:"20px 22px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#484f58", textTransform:"uppercase", letterSpacing:1, marginBottom:16 }}>Content Overview</div>
                {CONTENT_FILTERS.filter(f=>f!=="all").map(type => {
                  const cfg = CONTENT_TYPE_CONFIG[type];
                  const count = contentItems.filter(c=>c.type===type).length;
                  const pct = contentItems.length > 0 ? (count/contentItems.length)*100 : 0;
                  return (
                    <div key={type} style={{ marginBottom:12, cursor:"pointer" }} onClick={()=>{setTab("content");setContentFilter(type);}}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <span style={{ fontSize:12 }}>{cfg.icon}</span>
                          <span style={{ fontSize:12, color:"#8b949e", fontWeight:600 }}>{cfg.label}</span>
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{count}</span>
                      </div>
                      <div style={{ height:3, background:"#21262d", borderRadius:99, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:cfg.color, borderRadius:99, transition:"width .6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background:"#0f1318", border:"1px solid #21262d", borderRadius:14, padding:"20px 22px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#484f58", textTransform:"uppercase", letterSpacing:1 }}>Recent Activity</div>
                  <button onClick={loadActivity} style={{ fontSize:10, color:"#484f58", background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>↻ refresh</button>
                </div>
                {recentActivity.length===0 ? (
                  <div style={{ textAlign:"center", padding:"32px 0", color:"#484f58" }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
                    <div style={{ fontSize:12 }}>No moderation activity yet</div>
                  </div>
                ) : recentActivity.map((a,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 0", borderBottom:i<recentActivity.length-1?"1px solid #161b22":"none" }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:"#161b22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                      {activityIcons[a.action]||"•"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:"#c9d1d9", fontWeight:600 }}>{a.action?.charAt(0).toUpperCase()+a.action?.slice(1)} {a.target_type}</div>
                      {a.reason && <div style={{ fontSize:11, color:"#484f58", marginTop:2 }}>{a.reason?.slice(0,60)}{a.reason?.length>60?"…":""}</div>}
                    </div>
                    <div style={{ fontSize:10, color:"#484f58", flexShrink:0 }}>
                      {new Date(a.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop:16, display:"flex", gap:10 }}>
              {disputes.length>0&&<button onClick={()=>setTab("disputes")} style={{ flex:1, padding:"12px", borderRadius:11, background:"#1c1a3b", border:"1px solid #3d2f7a", color:"#a371f7", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                ⚖️ Review {disputes.length} Dispute{disputes.length!==1?"s":""}
              </button>}
              {reports.length>0&&<button onClick={()=>setTab("reports")} style={{ flex:1, padding:"12px", borderRadius:11, background:"#2d1800", border:"1px solid #5a3000", color:"#f59e0b", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                🚨 Review {reports.length} Report{reports.length!==1?"s":""}
              </button>}
              {totalWork===0&&<div style={{ flex:1, padding:"14px", borderRadius:11, background:"#0d2a1a", border:"1px solid #1a4a2e", color:"#3fb950", fontSize:13, fontWeight:700, textAlign:"center" as const }}>
                ✅ Everything looks good — no pending actions
              </div>}
            </div>
          </div>
        )}

        {/* ── CONTENT MODERATION TAB ── */}
        {tab==="content" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:3 }}>🛡️ Content Moderation</h1>
                <p style={{ fontSize:12, color:"#6e7681" }}>Click any item to view full content and take action.</p>
              </div>
              <button onClick={()=>{loadAllContent();setSelectedContent(null);}} disabled={contentLoading}
                style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #21262d", background:"#0f1318", color:"#8b949e", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                {contentLoading?"⏳":"↻ Refresh"}
              </button>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
              {CONTENT_FILTERS.map(type=>{
                const cfg=type==="all"?{label:"All",color:"#e6edf3",bg:"#21262d",icon:"🛡️"}:CONTENT_TYPE_CONFIG[type];
                const count=type==="all"?contentItems.length:contentItems.filter(c=>c.type===type).length;
                return (
                  <button key={type} onClick={()=>{setContentFilter(type);setSelectedContent(null);}}
                    style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${contentFilter===type?cfg.color:"#21262d"}`, background:contentFilter===type?cfg.bg:"transparent", color:contentFilter===type?cfg.color:"#6e7681", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:4 }}>
                    {cfg.icon} {cfg.label} <span style={{ fontSize:10, background:"#161b22", color:"#8b949e", padding:"1px 5px", borderRadius:99 }}>{count}</span>
                  </button>
                );
              })}
            </div>

            <input value={contentSearch} onChange={e=>setContentSearch(e.target.value)} placeholder="🔍  Search content, username, or author..."
              style={{ width:"100%", padding:"9px 14px", borderRadius:10, border:"1px solid #21262d", background:"#0f1318", color:"#e6edf3", fontSize:13, fontFamily:"'DM Sans',sans-serif", marginBottom:14 }} />

            {contentLoading ? (
              <div style={{ textAlign:"center", padding:"60px", color:"#484f58" }}>
                <div style={{ width:28, height:28, border:"2px solid #a371f7", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 12px" }} />
                Loading content…
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:selectedContent?"340px 1fr":"1fr", gap:12, alignItems:"start" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:"calc(100vh - 300px)", overflowY:"auto", paddingRight:4 }}>
                  {filteredContent.length===0 ? (
                    <div style={{ textAlign:"center", padding:"48px 20px", background:"#0f1318", borderRadius:12, border:"1px solid #21262d", color:"#484f58" }}>
                      <div style={{ fontSize:30, marginBottom:8 }}>✅</div>
                      <div style={{ fontSize:14, fontWeight:700 }}>No content found</div>
                    </div>
                  ) : filteredContent.map(item=>{
                    const cfg=CONTENT_TYPE_CONFIG[item.type];
                    const isSelected=selectedContent?.id===item.id&&selectedContent?.type===item.type;
                    return (
                      <div key={item.id} onClick={()=>loadDetail(item)} style={{ background:isSelected?"#111e2e":"#0f1318", border:`1px solid ${isSelected?"#3b7dd8":"#21262d"}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all .12s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:99, background:cfg.bg, color:cfg.color, letterSpacing:0.5, whiteSpace:"nowrap" as const }}>
                            {cfg.icon} {cfg.label.toUpperCase()}
                          </span>
                          {item.status&&item.status!=="active"&&<span style={{ fontSize:9, background:"#450a0a", color:"#f85149", padding:"1px 6px", borderRadius:99, fontWeight:700 }}>{item.status}</span>}
                          <span style={{ fontSize:10, color:"#484f58", marginLeft:"auto" }}>{new Date(item.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</span>
                        </div>
                        {item.extra&&<div style={{ fontSize:10, color:"#6e7681", marginBottom:3, fontWeight:600 }}>{item.extra?.slice(0,50)}</div>}
                        <div style={{ fontSize:12, color:"#c9d1d9", lineHeight:1.5, marginBottom:6, wordBreak:"break-word" as const }}>{item.content?.slice(0,100)}{(item.content?.length||0)>100?"…":""}</div>
                        {item.author&&<div style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar user={item.author} size={18} /><span style={{ fontSize:10, color:"#6e7681" }}>{item.author.full_name}</span></div>}
                      </div>
                    );
                  })}
                </div>

                {selectedContent && (
                  <div style={{ background:"#0f1318", border:"1px solid #21262d", borderRadius:14, overflow:"hidden", maxHeight:"calc(100vh - 300px)", display:"flex", flexDirection:"column" }}>
                    <div style={{ padding:"14px 18px", borderBottom:"1px solid #161b22", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      {(()=>{const cfg=CONTENT_TYPE_CONFIG[selectedContent.type];return(<span style={{ fontSize:10, fontWeight:800, padding:"3px 9px", borderRadius:99, background:cfg.bg, color:cfg.color, letterSpacing:0.5 }}>{cfg.icon} {cfg.label.toUpperCase()}</span>);})()}
                      <button onClick={()=>setSelectedContent(null)} style={{ background:"none", border:"none", color:"#6e7681", fontSize:16, cursor:"pointer", lineHeight:1 }}>✕</button>
                    </div>
                    <div style={{ flex:1, overflowY:"auto", padding:"18px" }}>
                      {selectedContent.author&&(
                        <div style={{ background:"#161b22", borderRadius:12, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                          <Avatar user={selectedContent.author} size={40} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:14, fontWeight:800, color:"#e6edf3" }}>{selectedContent.author.full_name}</div>
                            <div style={{ fontSize:11, color:"#6e7681" }}>@{selectedContent.author.username} · {selectedContent.author.level}</div>
                            {detailProfile&&(
                              <div style={{ display:"flex", gap:10, marginTop:5, flexWrap:"wrap" as const }}>
                                <span style={{ fontSize:11, color:"#3fb950" }}>✦ {detailProfile.xp||0} XP</span>
                                <span style={{ fontSize:11, color:"#f59e0b" }}>💳 {detailProfile.credits||0} cr</span>
                                {detailProfile.is_verified&&<span style={{ fontSize:11, color:"#58a6ff" }}>✓ Verified</span>}
                                {detailProfile.is_banned&&<span style={{ fontSize:11, color:"#f85149", fontWeight:700 }}>🚫 BANNED</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ marginBottom:18 }}>
                        {selectedContent.extra&&<div style={{ fontSize:11, color:"#6e7681", marginBottom:7, fontWeight:600 }}>{selectedContent.type==="comment"?`Commenting on: "${selectedContent.extra}"`:`Title: ${selectedContent.extra}`}</div>}
                        <div style={{ fontSize:13, color:"#e6edf3", lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-word" as const, background:"#161b22", borderRadius:10, padding:"14px" }}>
                          {selectedContent.content||<span style={{ color:"#484f58", fontStyle:"italic" }}>No content</span>}
                        </div>
                        {selectedContent.image_url&&<div style={{ marginTop:10 }}><img src={selectedContent.image_url} alt="" style={{ maxWidth:"100%", borderRadius:10, border:"1px solid #21262d" }} /></div>}
                        {selectedContent.type==="bio"&&detailProfile?.avatar_url&&(
                          <div style={{ marginTop:10 }}>
                            <div style={{ fontSize:10, color:"#484f58", marginBottom:5, fontWeight:700, letterSpacing:0.8 }}>PROFILE PHOTO</div>
                            <img src={detailProfile.avatar_url} alt="" style={{ width:70, height:70, borderRadius:10, objectFit:"cover", border:"1px solid #21262d" }} />
                          </div>
                        )}
                      </div>
                      {selectedContent.type==="post"&&(
                        <div style={{ marginBottom:16 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"#484f58", marginBottom:8, textTransform:"uppercase", letterSpacing:0.8 }}>💬 Answers ({detailLoading?"…":detailComments.length})</div>
                          {detailLoading ? <div style={{ textAlign:"center", padding:"16px", color:"#484f58", fontSize:12 }}>Loading…</div>
                          : detailComments.length===0 ? <div style={{ textAlign:"center", padding:"12px", color:"#484f58", fontSize:12, background:"#161b22", borderRadius:8 }}>No answers yet</div>
                          : detailComments.map((c:any)=>(
                            <div key={c.id} style={{ display:"flex", gap:9, marginBottom:8, padding:"9px 11px", background:"#161b22", borderRadius:9 }}>
                              {c.user&&<Avatar user={c.user} size={26} />}
                              <div style={{ flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:"#e6edf3" }}>{c.user?.full_name||"Unknown"}</span>
                                  <span style={{ fontSize:10, color:"#484f58", marginLeft:"auto" }}>{new Date(c.created_at).toLocaleDateString()}</span>
                                </div>
                                <div style={{ fontSize:12, color:"#c9d1d9", lineHeight:1.5 }}>{c.content}</div>
                              </div>
                              <button onClick={()=>{setRemoveModal({...c,type:"comment",author_id:c.user_id,author:c.user});setRemoveReason(REMOVAL_REASONS[0]);setRemoveNote("");}} style={{ padding:"3px 8px", borderRadius:6, border:"none", background:"#450a0a", color:"#f85149", fontSize:10, fontWeight:700, cursor:"pointer", alignSelf:"flex-start", flexShrink:0, fontFamily:"'DM Sans',sans-serif" }}>Del</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ borderTop:"1px solid #161b22", paddingTop:14, display:"flex", gap:8 }}>
                        <button onClick={()=>setWarnModal({id:selectedContent.author_id,full_name:selectedContent.author?.full_name})} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #451a03", background:"transparent", color:"#f59e0b", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>⚠️ Warn User</button>
                        <button onClick={()=>{setRemoveModal(selectedContent);setRemoveReason(REMOVAL_REASONS[0]);setRemoveNote("");}} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", background:"#450a0a", color:"#f85149", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>🗑️ Remove</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── DISPUTES TAB ── */}
        {tab==="disputes" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:3 }}>⚖️ Dispute Resolution</h1>
              <p style={{ fontSize:13, color:"#6e7681" }}>{disputes.length} open dispute{disputes.length!==1?"s":""} waiting for review.</p>
            </div>
            {disputes.length===0 ? (
              <div style={{ textAlign:"center", padding:"64px 20px", background:"#0f1318", borderRadius:16, border:"1px solid #21262d" }}>
                <div style={{ fontSize:42, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#e6edf3", fontFamily:"'Fraunces',serif", marginBottom:6 }}>No open disputes!</div>
                <div style={{ fontSize:13, color:"#484f58" }}>All user disputes have been reviewed. New ones will appear here automatically.</div>
              </div>
            ) : disputes.map(d=>(
              <div key={d.id} className="item-row" style={{ borderLeft:"3px solid #a371f7" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>{d.listing?.title||"Untitled Session"}</div>
                    <div style={{ display:"flex", gap:10 }}>
                      <span style={{ fontSize:11, background:"#1c1a3b", color:"#a371f7", padding:"2px 9px", borderRadius:99, fontWeight:700 }}>{d.credit_amount} cr in escrow</span>
                      <span style={{ fontSize:11, color:"#484f58" }}>{new Date(d.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</span>
                    </div>
                  </div>
                  <button onClick={()=>{setResolveModal(d);setResolution("teacher");setResolveNote("");}} className="action-btn" style={{ background:"#1c1a3b", color:"#a371f7", border:"1px solid #3d2f7a" }}>
                    Resolve ⚖️
                  </button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[{label:"Teacher",user:d.teacher},{label:"Learner",user:d.learner}].map(({label,user})=>user&&(
                    <div key={label} style={{ background:"#161b22", borderRadius:9, padding:"11px 13px", display:"flex", alignItems:"center", gap:9 }}>
                      <Avatar user={user} size={32} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700 }}>{user.full_name}</div>
                        <div style={{ fontSize:10, color:"#6e7681" }}>@{user.username} · <span style={{ color:"#a371f7",fontWeight:700 }}>{label}</span></div>
                      </div>
                      <button onClick={()=>setWarnModal(user)} className="action-btn" style={{ background:"transparent", color:"#f59e0b", border:"1px solid #451a03", padding:"4px 10px", fontSize:10 }}>Warn</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── FLAGGED LISTINGS TAB ── */}
        {tab==="listings" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:3 }}>📋 Flagged Listings</h1>
              <p style={{ fontSize:13, color:"#6e7681" }}>{listings.length} listing{listings.length!==1?"s":""} flagged for review.</p>
            </div>
            {listings.length===0 ? (
              <div style={{ textAlign:"center", padding:"64px 20px", background:"#0f1318", borderRadius:16, border:"1px solid #21262d" }}>
                <div style={{ fontSize:42, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#e6edf3", fontFamily:"'Fraunces',serif", marginBottom:6 }}>No flagged listings!</div>
                <div style={{ fontSize:13, color:"#484f58" }}>All listings are clean. New flags will appear here.</div>
              </div>
            ) : listings.map(l=>(
              <div key={l.id} className="item-row" style={{ borderLeft:"3px solid #f59e0b" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:14, fontWeight:800 }}>{l.title}</span>
                      <span style={{ fontSize:10, background:"#451a03", color:"#f59e0b", padding:"2px 7px", borderRadius:99, fontWeight:700 }}>Flagged</span>
                    </div>
                    <div style={{ fontSize:12, color:"#6e7681", marginBottom:8 }}>{l.description?.slice(0,120)}…</div>
                    {l.teacher&&<div style={{ display:"flex", alignItems:"center", gap:7 }}><Avatar user={l.teacher} size={20} /><span style={{ fontSize:11, color:"#6e7681" }}>{l.teacher.full_name} · @{l.teacher.username}</span></div>}
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <button onClick={()=>handleApproveListing(l)} disabled={!!actionLoading} className="action-btn" style={{ background:"#0d2a1a", color:"#3fb950", border:"1px solid #1a4a2e" }}>✓ Approve</button>
                    <button onClick={()=>handleRemoveListing(l)} disabled={!!actionLoading} className="action-btn" style={{ background:"#450a0a", color:"#f85149", border:"none" }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RATINGS TAB ── */}
        {tab==="ratings" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:3 }}>⭐ Flagged Ratings</h1>
              <p style={{ fontSize:13, color:"#6e7681" }}>{ratings.length} rating{ratings.length!==1?"s":""} flagged for review.</p>
            </div>
            {ratings.length===0 ? (
              <div style={{ textAlign:"center", padding:"64px 20px", background:"#0f1318", borderRadius:16, border:"1px solid #21262d" }}>
                <div style={{ fontSize:42, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#e6edf3", fontFamily:"'Fraunces',serif", marginBottom:6 }}>No flagged ratings!</div>
                <div style={{ fontSize:13, color:"#484f58" }}>All ratings appear clean and legitimate.</div>
              </div>
            ) : ratings.map(r=>(
              <div key={r.id} className="item-row" style={{ borderLeft:"3px solid #f85149" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:"#6e7681", marginBottom:6 }}>From <strong style={{ color:"#e6edf3" }}>{r.rater?.full_name}</strong> → <strong style={{ color:"#e6edf3" }}>{r.rated?.full_name}</strong><span style={{ marginLeft:8, color:"#f59e0b" }}>{"★".repeat(r.overall)}{"☆".repeat(5-r.overall)}</span></div>
                    {r.review&&<div style={{ fontSize:13, color:"#c9d1d9", background:"#161b22", borderRadius:8, padding:"9px 12px", marginBottom:6 }}>"{r.review}"</div>}
                    <div style={{ fontSize:11, color:"#484f58" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <button onClick={()=>handleDismissRating(r)} disabled={!!actionLoading} className="action-btn" style={{ background:"#161b22", color:"#6e7681", border:"1px solid #21262d" }}>Dismiss</button>
                    <button onClick={()=>handleRemoveRating(r)} disabled={!!actionLoading} className="action-btn" style={{ background:"#450a0a", color:"#f85149", border:"none" }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab==="reports" && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:900, marginBottom:3 }}>🚨 User Reports</h1>
              <p style={{ fontSize:13, color:"#6e7681" }}>{reports.length} open report{reports.length!==1?"s":""}.</p>
            </div>
            {reports.length===0 ? (
              <div style={{ textAlign:"center", padding:"64px 20px", background:"#0f1318", borderRadius:16, border:"1px solid #21262d" }}>
                <div style={{ fontSize:42, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#e6edf3", fontFamily:"'Fraunces',serif", marginBottom:6 }}>No open reports!</div>
                <div style={{ fontSize:13, color:"#484f58" }}>The community is behaving well. New reports appear here instantly.</div>
              </div>
            ) : reports.map(r=>(
              <div key={r.id} className="item-row" style={{ borderLeft:"3px solid #f85149" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"#6e7681", marginBottom:6 }}><strong style={{ color:"#e6edf3" }}>{r.reporter?.full_name}</strong> reported <strong style={{ color:"#f85149" }}>{r.reported?.full_name}</strong></div>
                    <div style={{ fontSize:13, color:"#c9d1d9", background:"#161b22", borderRadius:8, padding:"9px 12px", marginBottom:6 }}>{r.reason}</div>
                    <div style={{ fontSize:11, color:"#484f58" }}>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                    <button onClick={()=>setWarnModal({id:r.reported_id,full_name:r.reported?.full_name})} className="action-btn" style={{ background:"#2d1800", color:"#f59e0b", border:"1px solid #451a03" }}>Warn User</button>
                    <button onClick={()=>handleResolveReport(r.id)} className="action-btn" style={{ background:"#0d2a1a", color:"#3fb950", border:"1px solid #1a4a2e" }}>Resolve</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REMOVE CONTENT MODAL ── */}
      {removeModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, animation:"fadeIn .15s ease" }}>
          <div style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:18, width:"100%", maxWidth:520, padding:28, maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#f85149", fontFamily:"'Fraunces',serif" }}>Remove {CONTENT_TYPE_CONFIG[removeModal.type]?.icon} {CONTENT_TYPE_CONFIG[removeModal.type]?.label}</div>
                <div style={{ fontSize:12, color:"#6e7681", marginTop:3 }}>User will be notified with the reason below.</div>
              </div>
              <button onClick={()=>setRemoveModal(null)} style={{ background:"none", border:"none", color:"#6e7681", fontSize:20, cursor:"pointer", marginLeft:12 }}>✕</button>
            </div>
            <div style={{ background:"#161b22", borderRadius:10, padding:"10px 14px", marginBottom:18, fontSize:12, color:"#6e7681", lineHeight:1.6 }}>
              <div style={{ fontWeight:700, color:"#e6edf3", marginBottom:4 }}>Content preview</div>
              {removeModal.content?.slice(0,160)}{(removeModal.content?.length||0)>160?"…":""}
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#6e7681", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:0.8 }}>Removal Reason *</label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {REMOVAL_REASONS.map(reason=>(
                  <label key={reason} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:`1px solid ${removeReason===reason?"#f85149":"#21262d"}`, background:removeReason===reason?"#1a0a0a":"#161b22", cursor:"pointer" }}>
                    <input type="radio" value={reason} checked={removeReason===reason} onChange={()=>setRemoveReason(reason)} style={{ accentColor:"#f85149" }} />
                    <span style={{ fontSize:12, color:removeReason===reason?"#f85149":"#6e7681", fontWeight:removeReason===reason?700:400 }}>{reason}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#6e7681", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>Additional Note (optional)</label>
              <textarea value={removeNote} onChange={e=>setRemoveNote(e.target.value)} placeholder="Provide additional context..."
                style={{ width:"100%", minHeight:72, padding:"9px 12px", borderRadius:9, border:"1px solid #21262d", background:"#0a0d12", color:"#e6edf3", fontSize:13, fontFamily:"'DM Sans',sans-serif", resize:"vertical" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setRemoveModal(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #21262d", background:"transparent", color:"#6e7681", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={handleRemoveContent} disabled={!!actionLoading} style={{ flex:2, padding:"11px", borderRadius:10, border:"none", background:"#450a0a", color:"#f85149", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                {actionLoading==="remove"?"Removing…":"🗑️ Remove & Notify User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESOLVE DISPUTE MODAL ── */}
      {resolveModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, animation:"fadeIn .15s ease" }}>
          <div style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:18, width:"100%", maxWidth:500, padding:28 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"'Fraunces',serif" }}>Resolve Dispute ⚖️</div>
                <div style={{ fontSize:12, color:"#6e7681", marginTop:2 }}>{resolveModal.listing?.title} · {resolveModal.credit_amount} cr in escrow</div>
              </div>
              <button onClick={()=>setResolveModal(null)} style={{ background:"none", border:"none", color:"#6e7681", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#6e7681", display:"block", marginBottom:10, textTransform:"uppercase", letterSpacing:0.8 }}>Award credits to</label>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  {val:"teacher",label:`Teacher — ${resolveModal.teacher?.full_name}`,sub:`Release ${resolveModal.credit_amount} cr to teacher`},
                  {val:"learner",label:`Learner — ${resolveModal.learner?.full_name}`,sub:`Refund ${resolveModal.credit_amount} cr to learner`},
                  {val:"split",label:"Split equally",sub:`${Math.floor(resolveModal.credit_amount/2)} cr each`},
                ].map(o=>(
                  <label key={o.val} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, border:`1px solid ${resolution===o.val?"#a371f7":"#21262d"}`, background:resolution===o.val?"#1c1a3b":"#161b22", cursor:"pointer" }}>
                    <input type="radio" value={o.val} checked={resolution===o.val} onChange={()=>setResolution(o.val as any)} style={{ accentColor:"#a371f7" }} />
                    <div><div style={{ fontSize:13, fontWeight:700 }}>{o.label}</div><div style={{ fontSize:11, color:"#6e7681" }}>{o.sub}</div></div>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#6e7681", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>Note to both parties</label>
              <textarea value={resolveNote} onChange={e=>setResolveNote(e.target.value)} placeholder="Explain the decision..."
                style={{ width:"100%", minHeight:80, padding:"10px 12px", borderRadius:9, border:"1px solid #21262d", background:"#0a0d12", color:"#e6edf3", fontSize:13, fontFamily:"'DM Sans',sans-serif", resize:"vertical" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setResolveModal(null)} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #21262d", background:"transparent", color:"#6e7681", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={handleResolveDispute} disabled={!!actionLoading} style={{ flex:2, padding:"11px", borderRadius:10, border:"none", background:"#1c1a3b", color:"#a371f7", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                {actionLoading==="resolve"?"Resolving…":"⚖️ Resolve Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WARN USER MODAL ── */}
      {warnModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20, animation:"fadeIn .15s ease" }}>
          <div style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:18, width:"100%", maxWidth:400, padding:26 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>⚠️ Warn {warnModal.full_name}</div>
              <button onClick={()=>setWarnModal(null)} style={{ background:"none", border:"none", color:"#6e7681", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <textarea value={warnMsg} onChange={e=>setWarnMsg(e.target.value)} placeholder="Warning message sent to the user as a notification..."
              style={{ width:"100%", minHeight:100, padding:"10px 12px", borderRadius:9, border:"1px solid #21262d", background:"#0a0d12", color:"#e6edf3", fontSize:13, fontFamily:"'DM Sans',sans-serif", resize:"vertical", marginBottom:14 }} />
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setWarnModal(null)} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #21262d", background:"transparent", color:"#6e7681", fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Cancel</button>
              <button onClick={handleWarnUser} disabled={!warnMsg||!!actionLoading} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:warnMsg?"#451a03":"#161b22", color:warnMsg?"#f59e0b":"#484f58", fontWeight:800, cursor:warnMsg?"pointer":"default", fontFamily:"'DM Sans',sans-serif" }}>
                {actionLoading==="warn"?"Sending…":"Send Warning"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}