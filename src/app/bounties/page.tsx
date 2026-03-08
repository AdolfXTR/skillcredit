"use client";
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string; title: string; description: string; image_url?: string | null;
  credit_reward: number; first_place_pct: number; second_place_pct: number;
  third_place_pct: number; status: string; deadline: string; created_at: string;
  poster_id: string;
  profiles: { full_name: string; username: string; level: string; avatar_url?: string | null; xp_multiplier?: number; champion_title?: string | null };
  bounty_answers: { id: string }[];
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  if (h >= 1)  return `${h}h ${m}m left`;
  return `${m}m left`;
}
function getUrgency(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { dot: "#9ca3af", label: "Expired",  bg: "#f5f0e8", color: "#888" };
  const h = diff / 3600000;
  if (h <= 3)  return { dot: "#ef4444", label: "Urgent",    bg: "#fef2f2", color: "#dc2626" };
  if (h <= 24) return { dot: "#f59e0b", label: "Due soon",  bg: "#fffbeb", color: "#b45309" };
  return        { dot: "#22c55e", label: "Open",     bg: "#f0fdf4", color: "#15803d" };
}
function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}
function getRank(xp_multiplier?: number): 0|1|2|3 {
  if (!xp_multiplier || xp_multiplier < 1.1) return 0;
  if (xp_multiplier >= 1.25) return 1;
  if (xp_multiplier >= 1.15) return 2;
  return 3;
}

function PremiumAvatar({ name, level, avatarUrl, xp_multiplier, size = 28 }:
  { name: string; level?: string; avatarUrl?: string | null; xp_multiplier?: number; size?: number }) {
  const bg   = LEVEL_COLORS[level || "Seedling"] || "#2d6a4f";
  const rank = getRank(xp_multiplier);
  const ringStyle: React.CSSProperties = rank === 1
    ? { outline: "2.5px solid #ffd700", boxShadow: "0 0 0 1px #ffd700, 0 0 10px 2px rgba(255,215,0,0.6)", animation: "goldPulse 2s ease infinite" }
    : rank === 2
    ? { outline: "2.5px solid #c0c0c0", boxShadow: "0 0 0 1px #c0c0c0, 0 0 8px 2px rgba(192,192,192,0.5)", animation: "silverPulse 2s ease infinite" }
    : rank === 3
    ? { outline: "2.5px solid #cd7f32", boxShadow: "0 0 0 1px #cd7f32, 0 0 8px 2px rgba(205,127,50,0.5)", animation: "bronzePulse 2s ease infinite" }
    : {};
  const badge = rank===1?"👑":rank===2?"🥈":rank===3?"🥉":null;
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size, borderRadius:"50%", ...ringStyle }}>
      <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", background:bg,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.3, fontWeight:800, color:"#fff" }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : getInitials(name)
        }
      </div>
      {badge && <span style={{ position:"absolute", bottom:-3, right:-5, fontSize:size*0.38, lineHeight:1, filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))", zIndex:2 }}>{badge}</span>}
    </div>
  );
}

function ImageUploader({ onUploaded, label = "📷 Add Photo" }: { onUploaded: (url: string | null) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `bounties/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("forum-images").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return; }
    const { data } = supabase.storage.from("forum-images").getPublicUrl(path);
    onUploaded(data.publicUrl);
    setUploading(false); setDone(true);
  }
  function clear() { setPreview(null); setDone(false); onUploaded(null); if (inputRef.current) inputRef.current.value = ""; }
  return (
    <div>
      {preview ? (
        <div style={{ position:"relative", display:"inline-block" }}>
          <img src={preview} alt="preview" style={{ maxWidth:"100%", maxHeight:160, borderRadius:10, border:"1.5px solid #e8e2d9", display:"block" }} />
          {uploading && <div style={{ position:"absolute",inset:0,background:"rgba(255,255,255,.85)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ width:18,height:18,border:"2px solid #2d6a4f",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite" }} /></div>}
          {done && <div style={{ position:"absolute",bottom:6,right:6,background:"#2d6a4f",color:"#fff",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20 }}>✓</div>}
          <button onClick={clear} style={{ position:"absolute",top:5,right:5,width:22,height:22,borderRadius:"50%",background:"#1a1a1a",color:"#fff",border:"none",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"#f0fdf4",border:"1.5px dashed #86efac",color:"#2d6a4f",fontSize:13,fontWeight:600,cursor:"pointer" }}>{label}</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [user, setUser] = useState<{ id: string; credits: number; full_name: string; level: string; avatar_url?: string | null; xp_multiplier?: number } | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newBounty, setNewBounty] = useState({ title: "", description: "", deadline_hours: 24 });
  const [rewardInput, setRewardInput] = useState("10");
  const [bountyImageUrl, setBountyImageUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: prof } = await supabase.from("profiles").select("id,full_name,credits,level,avatar_url,xp_multiplier").eq("id", authUser.id).single();
      if (prof) setUser(prof);
    }
    await fetchBounties();
  }

  async function fetchBounties() {
    setLoading(true);
    const { data } = await supabase.from("bounties")
      .select(`*, profiles(full_name,username,level,avatar_url,xp_multiplier,champion_title), bounty_answers(id)`)
      .eq("status", "open").order("created_at", { ascending: false });
    setBounties((data as Bounty[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    const channel = supabase.channel("bounty_answers_live")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"bounty_answers" }, () => { fetchBounties(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handlePostBounty() {
    if (!user) { window.location.href = "/login"; return; }
    const reward = parseInt(rewardInput);
    if (!newBounty.title.trim())       { setPostError("Please enter a title.");               return; }
    if (!newBounty.description.trim()) { setPostError("Please enter a description.");          return; }
    if (isNaN(reward) || reward < 5)   { setPostError("Minimum reward is 5 credits.");        return; }
    if (reward > user.credits)         { setPostError(`You only have ${user.credits} credits.`); return; }
    setPosting(true); setPostError("");
    const { error: deductErr } = await supabase.rpc("deduct_credits", { user_id: user.id, amount: reward });
    if (deductErr) { setPostError("Failed to deduct credits. Please try again."); setPosting(false); return; }
    const deadline = new Date(Date.now() + newBounty.deadline_hours * 3600000).toISOString();
    const { data: created, error: insertErr } = await supabase.from("bounties").insert({
      poster_id: user.id, title: newBounty.title.trim(), description: newBounty.description.trim(),
      image_url: bountyImageUrl || null, credit_reward: reward, deadline, status: "open",
      first_place_pct: 60, second_place_pct: 30, third_place_pct: 10,
    }).select().single();
    if (insertErr) {
      await supabase.rpc("increment_credits", { user_id: user.id, amount: reward });
      setPostError("Failed to post bounty. Your credits have been refunded.");
      setPosting(false); return;
    }
    setUser(u => u ? { ...u, credits: u.credits - reward } : u);
    setShowPostModal(false);
    setNewBounty({ title:"", description:"", deadline_hours:24 });
    setRewardInput("10"); setBountyImageUrl(null);
    if (created) window.location.href = `/bounties/${created.id}`;
  }

  const rewardNum = parseInt(rewardInput) || 0;
  const rewardValid = rewardNum >= 5 && rewardNum <= (user?.credits || 0);

  const filtered = bounties
    .filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "reward_high")  return b.credit_reward - a.credit_reward;
      if (sortBy === "urgent")       return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (sortBy === "most_answers") return (b.bounty_answers?.length||0) - (a.bounty_answers?.length||0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div style={{ minHeight:"100vh", background:"#f8f7f4", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;}
        @keyframes spin        {to{transform:rotate(360deg)}}
        @keyframes fadeUp      {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn      {from{opacity:0}to{opacity:1}}
        @keyframes goldPulse   {0%,100%{box-shadow:0 0 0 1px #ffd700,0 0 10px 2px rgba(255,215,0,.6)}50%{box-shadow:0 0 0 1px #ffd700,0 0 16px 3px rgba(255,215,0,1)}}
        @keyframes silverPulse {0%,100%{box-shadow:0 0 0 1px #c0c0c0,0 0 8px 2px rgba(192,192,192,.5)}50%{box-shadow:0 0 0 1px #ddd,0 0 12px 2px rgba(220,220,220,.9)}}
        @keyframes bronzePulse {0%,100%{box-shadow:0 0 0 1px #cd7f32,0 0 8px 2px rgba(205,127,50,.5)}50%{box-shadow:0 0 0 1px #cd7f32,0 0 12px 2px rgba(205,127,50,.8)}}
        .bcard{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9;transition:box-shadow .2s,transform .2s;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.03);}
        .bcard:hover{box-shadow:0 10px 36px rgba(45,106,79,.1);transform:translateY(-2px);}
        .btn{transition:all .15s;cursor:pointer;border:none;}
        .btn:hover{opacity:.88;transform:translateY(-1px);}
        .nav-a{padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;color:#666;transition:all .12s;display:inline-block;}
        .nav-a:hover{background:#f0ece4;color:#1a1a1a;}
        .nav-a.active{background:#f0fdf4;color:#2d6a4f;font-weight:700;}
        input:focus,textarea:focus,select:focus{outline:none;border-color:#2d6a4f!important;box-shadow:0 0 0 3px rgba(45,106,79,.1);}
        .img-zoom{cursor:zoom-in;transition:opacity .15s;}
        .img-zoom:hover{opacity:.85;}
      `}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24,animation:"fadeIn .2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth:"88vw",maxHeight:"88vh",borderRadius:16 }} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute",top:20,right:20,width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",fontSize:16,cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",borderBottom:"1px solid #e8e2d9",padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className={`nav-a${h==="/bounties"?" active":""}`}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={() => user ? setShowPostModal(true) : (window.location.href="/login")} className="btn"
            style={{ padding:"8px 18px",borderRadius:999,background:"linear-gradient(135deg,#2d6a4f,#1a4a36)",color:"#fff",fontSize:13,fontWeight:700,boxShadow:"0 4px 16px rgba(45,106,79,.3)" }}>
            + Post Bounty
          </button>
          {user && (
            <a href="/profile" style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:999,background:"#f0fdf4",border:"1.5px solid #86efac" }}>
              <PremiumAvatar name={user.full_name} level={user.level} avatarUrl={user.avatar_url} xp_multiplier={user.xp_multiplier} size={28} />
              <span style={{ fontSize:12,fontWeight:800,color:"#2d6a4f" }}>{user.credits} cr</span>
            </a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:1100,margin:"0 auto",padding:"36px 24px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32,flexWrap:"wrap",gap:16 }}>
          <div style={{ animation:"fadeUp .3s ease" }}>
            <h1 style={{ fontFamily:"'Fraunces',serif",fontSize:38,fontWeight:900,color:"#1a1a1a",letterSpacing:"-.5px",lineHeight:1.1 }}>Bounty Board 🎯</h1>
            <p style={{ color:"#aaa",marginTop:8,fontSize:15 }}>Post tasks · Get answers · Award credits to winners</p>
          </div>
          <div style={{ display:"flex",gap:12,animation:"fadeUp .3s .05s ease both" }}>
            {[
              { label:"Open Bounties",    val:bounties.length,                              bg:"linear-gradient(135deg,#f0fdf4,#dcfce7)", color:"#2d6a4f", border:"#86efac" },
              { label:"Credits at Stake", val:bounties.reduce((s,b)=>s+b.credit_reward,0), bg:"linear-gradient(135deg,#fffbeb,#fef3c7)", color:"#b45309", border:"#fde68a" },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg,borderRadius:16,padding:"14px 22px",textAlign:"center",border:`1.5px solid ${s.border}` }}>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:900,color:s.color,lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:11,color:"#aaa",fontWeight:600,marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"flex",gap:10,marginBottom:24,flexWrap:"wrap",animation:"fadeUp .3s .1s ease both" }}>
          <div style={{ flex:1,minWidth:200,position:"relative" }}>
            <span style={{ position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#aaa" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bounties…"
              style={{ width:"100%",padding:"10px 14px 10px 36px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:14,fontFamily:"'DM Sans',sans-serif",background:"#fff" }} />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding:"10px 16px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:13,fontFamily:"'DM Sans',sans-serif",background:"#fff",color:"#1a1a1a",cursor:"pointer" }}>
            <option value="newest">Newest first</option>
            <option value="reward_high">Highest reward</option>
            <option value="urgent">Most urgent</option>
            <option value="most_answers">Most answers</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign:"center",padding:"80px 0" }}>
            <div style={{ width:32,height:32,border:"3px solid #2d6a4f",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 16px" }} />
            <p style={{ color:"#aaa",fontSize:14 }}>Loading bounties…</p>
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {filtered.map((bounty, idx) => {
              const urg = getUrgency(bounty.deadline);
              const tl  = getTimeLeft(bounty.deadline);
              const ac  = bounty.bounty_answers?.length || 0;
              const isExpired = new Date(bounty.deadline).getTime() < Date.now();
              const rank = getRank(bounty.profiles?.xp_multiplier);
              return (
                <div key={bounty.id} className="bcard"
                  onClick={() => window.location.href = user ? `/bounties/${bounty.id}` : "/login"}
                  style={{ padding:"22px 24px",animation:`fadeUp .3s ${idx*.04}s ease both`,opacity:isExpired?0.75:1 }}>
                  <div style={{ display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap" }}>
                    <div style={{ flex:1,minWidth:240 }}>
                      <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap" }}>
                        <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:999,background:urg.bg,color:urg.color }}>
                          <span style={{ width:6,height:6,borderRadius:"50%",background:urg.dot,display:"inline-block" }} />{urg.label}
                        </span>
                        <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>⏱ {tl}</span>
                        <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>💬 {ac} answer{ac!==1?"s":""}</span>
                      </div>
                      <h3 style={{ fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:800,color:"#1a1a1a",lineHeight:1.35,marginBottom:8 }}>{bounty.title}</h3>
                      <p style={{ fontSize:13,color:"#666",lineHeight:1.6,marginBottom:12 }}>
                        {bounty.description.length>140?bounty.description.slice(0,140)+"…":bounty.description}
                      </p>
                      {bounty.image_url && (
                        <img src={bounty.image_url} alt="" className="img-zoom"
                          onClick={e => { e.stopPropagation(); setLightbox(bounty.image_url!); }}
                          style={{ maxHeight:90,borderRadius:8,border:"1px solid #e8e2d9",marginBottom:12,display:"block" }} />
                      )}
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <PremiumAvatar name={bounty.profiles?.full_name||"?"} level={bounty.profiles?.level} avatarUrl={bounty.profiles?.avatar_url} xp_multiplier={bounty.profiles?.xp_multiplier} size={26} />
                        <span style={{ fontSize:12,color:"#aaa" }}>
                          <strong style={{ color:"#1a1a1a",fontWeight:700 }}>{bounty.profiles?.full_name}</strong>
                          {bounty.profiles?.champion_title && rank > 0 && (
                            <span style={{ marginLeft:6,fontSize:10,fontWeight:800,
                              color:rank===1?"#b8860b":rank===2?"#888":"#a0522d",
                              background:rank===1?"rgba(255,215,0,0.15)":rank===2?"rgba(192,192,192,0.15)":"rgba(205,127,50,0.15)",
                              padding:"1px 7px",borderRadius:999 }}>
                              {rank===1?"👑":rank===2?"🥈":"🥉"} {bounty.profiles.champion_title}
                            </span>
                          )}
                          {" · "}@{bounty.profiles?.username}
                        </span>
                      </div>
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:10,flexShrink:0 }}>
                      <div style={{ background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:14,padding:"16px 22px",textAlign:"center",border:"1.5px solid #86efac" }}>
                        <div style={{ fontSize:11,fontWeight:800,color:"#2d6a4f",letterSpacing:".08em",marginBottom:3 }}>REWARD</div>
                        <div style={{ fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:900,color:"#2d6a4f",lineHeight:1 }}>{bounty.credit_reward}</div>
                        <div style={{ fontSize:11,color:"#52b788",fontWeight:600 }}>credits</div>
                      </div>
                      <div style={{ display:"flex",gap:5 }}>
                        {[{e:"🥇",p:bounty.first_place_pct},{e:"🥈",p:bounty.second_place_pct},{e:"🥉",p:bounty.third_place_pct}].map(({e,p}) => (
                          <div key={e} style={{ background:"#f8f7f4",border:"1.5px solid #e8e2d9",borderRadius:8,padding:"6px 8px",textAlign:"center",minWidth:46 }}>
                            <div style={{ fontSize:12 }}>{e}</div>
                            <div style={{ fontSize:11,fontWeight:800,color:"#2d6a4f" }}>{Math.floor(bounty.credit_reward*p/100)}cr</div>
                          </div>
                        ))}
                      </div>
                      {isExpired ? (
                        <div style={{ padding:"9px 16px",borderRadius:999,background:"#f5f0e8",color:"#aaa",fontSize:12,fontWeight:700,textAlign:"center",width:"100%" }}>🔒 Closed</div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); window.location.href = user?`/bounties/${bounty.id}`:"/login"; }} className="btn"
                          style={{ width:"100%",padding:"9px 20px",borderRadius:999,background:"linear-gradient(135deg,#2d6a4f,#1a4a36)",color:"#fff",fontSize:13,fontWeight:700,boxShadow:"0 4px 12px rgba(45,106,79,.25)" }}>
                          {user?"Answer →":"Sign in →"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign:"center",padding:"64px 24px",background:"#fff",borderRadius:20,border:"1.5px solid #e8e2d9" }}>
                <div style={{ fontSize:44,marginBottom:14 }}>🎯</div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#1a1a1a",marginBottom:6 }}>No bounties found</div>
                <p style={{ color:"#aaa",fontSize:14,marginBottom:20 }}>Be the first to post a task!</p>
                <button onClick={() => user?setShowPostModal(true):(window.location.href="/login")} className="btn"
                  style={{ padding:"11px 28px",borderRadius:999,background:"linear-gradient(135deg,#2d6a4f,#1a4a36)",color:"#fff",fontSize:14,fontWeight:700 }}>
                  Post a Bounty →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POST MODAL */}
      {showPostModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20,animation:"fadeIn .2s ease" }}>
          <div style={{ background:"#fff",borderRadius:24,padding:"32px",maxWidth:560,width:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.2)",animation:"fadeUp .25s ease" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
              <div>
                <h2 style={{ fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:900,color:"#1a1a1a" }}>Post a Bounty 🎯</h2>
                <p style={{ fontSize:13,color:"#aaa",marginTop:3 }}>Describe your task and set a credit reward</p>
              </div>
              <button onClick={() => setShowPostModal(false)} style={{ width:34,height:34,borderRadius:"50%",background:"#f5f0e8",border:"none",fontSize:16,cursor:"pointer",color:"#666",fontWeight:700 }}>✕</button>
            </div>
            {[{key:"title",label:"Task Title *",placeholder:"e.g. Help me debug my Python code",type:"input",rows:undefined},{key:"description",label:"Description *",placeholder:"Describe your task in detail…",type:"textarea",rows:4}].map(f => (
              <div key={f.key} style={{ marginBottom:16 }}>
                <label style={{ fontSize:12,fontWeight:800,color:"#888",letterSpacing:".06em",textTransform:"uppercase" as const,display:"block",marginBottom:8 }}>{f.label}</label>
                {f.type==="input"
                  ?<input value={(newBounty as any)[f.key]} onChange={e=>setNewBounty(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} style={{ width:"100%",padding:"11px 14px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:14,fontFamily:"'DM Sans',sans-serif" }} />
                  :<textarea value={(newBounty as any)[f.key]} onChange={e=>setNewBounty(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} rows={f.rows} style={{ width:"100%",padding:"11px 14px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:14,fontFamily:"'DM Sans',sans-serif",resize:"vertical",lineHeight:1.6 }} />
                }
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12,fontWeight:800,color:"#888",letterSpacing:".06em",textTransform:"uppercase" as const,display:"block",marginBottom:8 }}>Attach Photo <span style={{ fontWeight:500,color:"#aaa",textTransform:"none" as const,fontSize:12,letterSpacing:0 }}>(optional)</span></label>
              <ImageUploader onUploaded={url => setBountyImageUrl(url)} label="📷 Add photo to your bounty" />
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16 }}>
              <div>
                <label style={{ fontSize:12,fontWeight:800,color:"#888",letterSpacing:".06em",textTransform:"uppercase" as const,display:"block",marginBottom:8 }}>Credit Reward</label>
                <input type="number" min={5} max={user?.credits||9999} value={rewardInput} onChange={e=>{setRewardInput(e.target.value);setPostError("");}}
                  style={{ width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${rewardValid?"#e8e2d9":"#fca5a5"}`,fontSize:14,fontFamily:"'DM Sans',sans-serif" }} />
                <div style={{ fontSize:11,marginTop:5,fontWeight:600,color:rewardValid?"#aaa":"#dc2626" }}>
                  {!rewardInput?"Enter an amount":rewardNum<5?"⚠️ Minimum is 5 credits":rewardNum>(user?.credits||0)?`⚠️ You only have ${user?.credits||0} credits`:`✓ ${(user?.credits||0)-rewardNum} credits remaining`}
                </div>
              </div>
              <div>
                <label style={{ fontSize:12,fontWeight:800,color:"#888",letterSpacing:".06em",textTransform:"uppercase" as const,display:"block",marginBottom:8 }}>Deadline</label>
                <select value={newBounty.deadline_hours} onChange={e=>setNewBounty(p=>({...p,deadline_hours:parseInt(e.target.value)}))}
                  style={{ width:"100%",padding:"11px 14px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:14,fontFamily:"'DM Sans',sans-serif",background:"#fff",cursor:"pointer" }}>
                  <option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>3 days</option>
                </select>
              </div>
            </div>
            <div style={{ background:"linear-gradient(135deg,#f0fdf4,#f8fff8)",border:"1.5px solid #bbf7d0",borderRadius:14,padding:"14px 16px",marginBottom:22 }}>
              <div style={{ fontSize:11,fontWeight:800,color:"#2d6a4f",letterSpacing:".08em",marginBottom:10 }}>PRIZE SPLIT</div>
              <div style={{ display:"flex",gap:8 }}>
                {[{e:"🥇 1st",p:60},{e:"🥈 2nd",p:30},{e:"🥉 3rd",p:10}].map(({e,p}) => (
                  <div key={e} style={{ flex:1,background:"#fff",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid #bbf7d0" }}>
                    <div style={{ fontSize:12,color:"#52b788",marginBottom:3 }}>{e}</div>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:800,color:"#2d6a4f" }}>{rewardValid?Math.floor(rewardNum*p/100):"—"} cr</div>
                  </div>
                ))}
              </div>
            </div>
            {postError && <p style={{ color:"#dc2626",fontSize:13,marginBottom:12,fontWeight:600 }}>⚠️ {postError}</p>}
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setShowPostModal(false)} className="btn" style={{ flex:1,padding:"12px",borderRadius:12,background:"#f5f0e8",color:"#666",fontWeight:700,fontSize:14,border:"none" }}>Cancel</button>
              <button onClick={handlePostBounty} disabled={posting||!rewardValid||!newBounty.title.trim()||!newBounty.description.trim()} className="btn"
                style={{ flex:2,padding:"12px",borderRadius:12,background:posting||!rewardValid?"#d1fae5":"linear-gradient(135deg,#2d6a4f,#1a4a36)",color:posting||!rewardValid?"#52b788":"#fff",fontWeight:800,fontSize:14,border:"none",boxShadow:rewardValid?"0 4px 16px rgba(45,106,79,.25)":"none" }}>
                {posting?`Posting…`:`Post Bounty — ${rewardValid?rewardNum:"?"} cr 🎯`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}