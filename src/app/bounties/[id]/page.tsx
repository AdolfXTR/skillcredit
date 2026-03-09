"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string; title: string; description: string; image_url?: string | null;
  credit_reward: number; first_place_pct: number; second_place_pct: number;
  third_place_pct: number; status: string; deadline: string; created_at: string;
  poster_id: string;
  profiles: {
    full_name: string; username: string; level: string;
    avatar_url?: string | null; xp_multiplier?: number;
    champion_title?: string | null; champion_streak?: number;
    teaching_title?: string | null; teaching_title_ends_at?: string | null;
    rating_title?: string | null; rating_title_ends_at?: string | null;
  };
};
type Answer = {
  id: string; bounty_id: string; answerer_id: string; content: string;
  image_url?: string | null; placement: number | null; credits_earned: number;
  created_at: string;
  profiles: {
    full_name: string; username: string; level: string;
    avatar_url?: string | null; xp_multiplier?: number;
    champion_title?: string | null;
    teaching_title?: string | null; teaching_title_ends_at?: string | null;
    rating_title?: string | null; rating_title_ends_at?: string | null;
  };
};
type CurrentUser = { id: string; full_name: string; username: string; credits: number; level: string; avatar_url?: string | null; xp_multiplier?: number; };

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

function getTimeLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)} days left`;
  if (h >= 1)  return `${h}h ${m}m left`;
  return `${m}m left`;
}
function getUrgency(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { color: "#6b7280", bg: "#f3f4f6", label: "Closed",  dot: "#9ca3af" };
  const h = diff / 3600000;
  if (h <= 3)  return { color: "#dc2626", bg: "#fef2f2", label: "Urgent",   dot: "#ef4444" };
  if (h <= 24) return { color: "#b45309", bg: "#fffbeb", label: "Due soon", dot: "#f59e0b" };
  return        { color: "#15803d", bg: "#f0fdf4", label: "Open",    dot: "#22c55e" };
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
function isActiveTitle(endsAt?: string | null) {
  if (!endsAt) return false;
  return new Date(endsAt) > new Date();
}

// ── Perk badges row (champion + teaching + rating) ──
function PerkBadges({ profile }: { profile: { xp_multiplier?: number; champion_title?: string | null; teaching_title?: string | null; teaching_title_ends_at?: string | null; rating_title?: string | null; rating_title_ends_at?: string | null } }) {
  const rank = getRank(profile.xp_multiplier);
  const hasTeaching = profile.teaching_title && isActiveTitle(profile.teaching_title_ends_at);
  const hasRating = profile.rating_title && isActiveTitle(profile.rating_title_ends_at);
  if (!rank && !hasTeaching && !hasRating) return null;
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
      {rank > 0 && profile.champion_title && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
          background: rank===1?"rgba(255,215,0,0.15)":rank===2?"rgba(192,192,192,0.15)":"rgba(205,127,50,0.15)",
          color: rank===1?"#b8860b":rank===2?"#888":"#a0522d",
          border: `1px solid ${rank===1?"rgba(255,215,0,0.4)":rank===2?"rgba(192,192,192,0.4)":"rgba(205,127,50,0.4)"}` }}>
          {rank===1?"👑":rank===2?"🥈":"🥉"} {profile.champion_title}
        </span>
      )}
      {hasTeaching && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#eef6f2", color: "#2d6a4f", border: "1px solid #c6e8d4" }}>
          🎓 {profile.teaching_title}
        </span>
      )}
      {hasRating && (
        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#fefce8", color: "#92400e", border: "1px solid #fde68a" }}>
          ⭐ {profile.rating_title}
        </span>
      )}
    </div>
  );
}

// ── Premium avatar with gold/silver/bronze rings + champion badge ──
function PremiumAvatar({ name, level, avatarUrl, xp_multiplier, size = 38 }:
  { name: string; level?: string; avatarUrl?: string | null; xp_multiplier?: number; size?: number }) {
  const bg   = LEVEL_COLORS[level || "Seedling"] || "#2d6a4f";
  const rank = getRank(xp_multiplier);
  const ringStyle: React.CSSProperties = rank === 1
    ? { outline: "3px solid #ffd700", boxShadow: "0 0 0 1px #ffd700, 0 0 14px 3px rgba(255,215,0,0.7)", animation: "goldPulse 2s ease infinite" }
    : rank === 2
    ? { outline: "3px solid #c0c0c0", boxShadow: "0 0 0 1px #c0c0c0, 0 0 10px 2px rgba(192,192,192,0.5)", animation: "silverPulse 2s ease infinite" }
    : rank === 3
    ? { outline: "3px solid #cd7f32", boxShadow: "0 0 0 1px #cd7f32, 0 0 10px 2px rgba(205,127,50,0.5)", animation: "bronzePulse 2s ease infinite" }
    : {};
  const badge = rank===1?"👑":rank===2?"🥈":rank===3?"🥉":null;
  return (
    <div style={{ position:"relative", flexShrink:0, width:size, height:size, borderRadius:"50%", ...ringStyle }}>
      <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden", background:bg,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*.3, fontWeight:800, color:"#fff" }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : getInitials(name)}
      </div>
      {badge && <span style={{ position:"absolute", bottom:-4, right:-6, fontSize:size*0.38, lineHeight:1, filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))", zIndex:2 }}>{badge}</span>}
    </div>
  );
}

// ── XP Multiplier badge ──
function XPBadge({ xp_multiplier }: { xp_multiplier?: number }) {
  const rank = getRank(xp_multiplier);
  if (!rank) return null;
  const styles: Record<number, { bg: string; color: string; border: string }> = {
    1: { bg: "rgba(255,215,0,0.15)", color: "#b8860b", border: "rgba(255,215,0,0.4)" },
    2: { bg: "rgba(192,192,192,0.15)", color: "#888", border: "rgba(192,192,192,0.4)" },
    3: { bg: "rgba(205,127,50,0.15)", color: "#a0522d", border: "rgba(205,127,50,0.4)" },
  };
  const s = styles[rank];
  return (
    <span style={{ fontSize:10, fontWeight:800, background:s.bg, color:s.color, padding:"2px 8px", borderRadius:999, border:`1px solid ${s.border}` }}>
      ⚡ {xp_multiplier}x XP
    </span>
  );
}

function ImageUploader({ onUploaded, label = "📷 Attach Photo" }: { onUploaded: (url: string | null) => void; label?: string }) {
  const inputRef                  = useRef<HTMLInputElement>(null);
  const [preview,   setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done,      setDone]      = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    const ext  = file.name.split(".").pop();
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
          <button onClick={clear} style={{ position:"absolute",top:5,right:5,width:22,height:22,borderRadius:"50%",background:"#1a1a1a",color:"#fff",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"#f0fdf4",border:"1.5px dashed #86efac",color:"#2d6a4f",fontSize:13,fontWeight:600,cursor:"pointer" }}>{label}</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

function ConfirmModal({ onConfirm, onCancel, place, credits }: { onConfirm: () => void; onCancel: () => void; place: 1|2|3; credits: number }) {
  const emoji = place===1?"🥇":place===2?"🥈":"🥉";
  const label = place===1?"1st":place===2?"2nd":"3rd";
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .15s ease" }}>
      <div style={{ background:"#fff",borderRadius:20,padding:"28px 32px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 24px 60px rgba(0,0,0,.2)",animation:"fadeUp .2s ease" }}>
        <div style={{ fontSize:44,marginBottom:12 }}>{emoji}</div>
        <h3 style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a",marginBottom:8 }}>Confirm {label} Place Award</h3>
        <p style={{ fontSize:14,color:"#666",lineHeight:1.6,marginBottom:22 }}>
          You're about to award <strong style={{ color:"#2d6a4f" }}>{credits} credits</strong> for {label} place.<br/>
          <strong style={{ color:"#dc2626" }}>This cannot be undone.</strong>
        </p>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,padding:"11px",borderRadius:12,background:"#f5f0e8",color:"#666",fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1,padding:"11px",borderRadius:12,background:"linear-gradient(135deg,#2d6a4f,#1a4a36)",color:"#fff",fontWeight:800,fontSize:14,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(45,106,79,.3)" }}>
            {emoji} Award Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BountyDetailPage() {
  const params                                      = useParams();
  const id                                          = params?.id as string;
  const [bounty,         setBounty]                 = useState<Bounty | null>(null);
  const [answers,        setAnswers]                = useState<Answer[]>([]);
  const [currentUser,    setCurrentUser]            = useState<CurrentUser | null>(null);
  const [loading,        setLoading]                = useState(true);
  const [hasAnswered,    setHasAnswered]            = useState(false);
  const [answerContent,  setAnswerContent]          = useState("");
  const [answerImageUrl, setAnswerImageUrl]         = useState<string | null>(null);
  const [submitting,     setSubmitting]             = useState(false);
  const [submitError,    setSubmitError]            = useState("");
  const [submitSuccess,  setSubmitSuccess]          = useState(false);
  const [assigning,      setAssigning]              = useState(false);
  const [lightbox,       setLightbox]               = useState<string | null>(null);
  const [confirmPending, setConfirmPending]         = useState<{ answerId: string; place: 1|2|3; credits: number } | null>(null);

  useEffect(() => { init(); }, [id]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles")
        .select("id,full_name,username,credits,level,avatar_url,xp_multiplier").eq("id", user.id).single();
      if (prof) setCurrentUser(prof);
    }
    if (!id) { setLoading(false); return; }

    const { data: b } = await supabase.from("bounties")
      .select("*,profiles(full_name,username,level,avatar_url,xp_multiplier,champion_title,champion_streak,teaching_title,teaching_title_ends_at,rating_title,rating_title_ends_at)")
      .eq("id", id).single();
    if (b) setBounty(b as Bounty);

    if (user) {
      const { data: myAns } = await supabase.from("bounty_answers").select("id").eq("bounty_id", id).eq("answerer_id", user.id).maybeSingle();
      if (myAns) setHasAnswered(true);
      if (b?.poster_id === user.id || myAns) await loadAnswers();
    }
    setLoading(false);
  }

  async function loadAnswers() {
    const { data } = await supabase.from("bounty_answers")
      .select("*,profiles(full_name,username,level,avatar_url,xp_multiplier,champion_title,teaching_title,teaching_title_ends_at,rating_title,rating_title_ends_at)")
      .eq("bounty_id", id).order("created_at", { ascending: true });
    setAnswers((data as Answer[]) || []);
  }

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`bounty_${id}_answers`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"bounty_answers", filter:`bounty_id=eq.${id}` }, () => { loadAnswers(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function handleSubmitAnswer() {
    if (!currentUser || !bounty) return;
    if (currentUser.id === bounty.poster_id) return;
    if (!answerContent.trim() || answerContent.length < 20) { setSubmitError("Answer must be at least 20 characters."); return; }
    setSubmitting(true); setSubmitError("");
    const insertData: Record<string, unknown> = { bounty_id: bounty.id, answerer_id: currentUser.id, content: answerContent.trim() };
    if (answerImageUrl) insertData.image_url = answerImageUrl;
    const { error } = await supabase.from("bounty_answers").insert(insertData);
    if (error) { setSubmitError("Failed to submit: " + error.message); setSubmitting(false); return; }
    await loadAnswers();
    setHasAnswered(true); setSubmitSuccess(true); setSubmitting(false);
    await supabase.from("notifications").insert({
      user_id: bounty.poster_id, type: "platform",
      title: "New answer on your bounty! 🎯",
      body: `${currentUser.full_name} answered: "${bounty.title}"`,
      link: `/bounties/${bounty.id}`,
    });
  }

  function requestAssignment(answerId: string, placement: 1|2|3) {
    if (!bounty) return;
    const pct = placement===1 ? bounty.first_place_pct : placement===2 ? bounty.second_place_pct : bounty.third_place_pct;
    setConfirmPending({ answerId, place: placement, credits: Math.floor(bounty.credit_reward * pct / 100) });
  }

  async function handleAssignPlacement() {
    if (!bounty || !confirmPending) return;
    const { answerId, place, credits } = confirmPending;
    setConfirmPending(null); setAssigning(true);
    await supabase.from("bounty_answers").update({ placement: place, credits_earned: credits }).eq("id", answerId);
    const answer = answers.find(a => a.id === answerId);
    if (answer) {
      const { data: wp } = await supabase.from("profiles").select("credits").eq("id", answer.answerer_id).single();
      if (wp) {
        await supabase.from("profiles").update({ credits: wp.credits + credits }).eq("id", answer.answerer_id);
        await supabase.from("credit_transactions").insert({
          user_id: answer.answerer_id, amount: credits, type: "bounty_earn",
          reference_id: bounty.id,
          description: `${place===1?"🥇 1st":place===2?"🥈 2nd":"🥉 3rd"} place — ${bounty.title}`,
        });
        await supabase.from("notifications").insert({
          user_id: answer.answerer_id, type: "achievement",
          title: `${place===1?"🥇 1st":place===2?"🥈 2nd":"🥉 3rd"} place on a bounty!`,
          body: `You earned ${credits} credits for "${bounty.title}"`,
          link: `/bounties/${bounty.id}`,
        });
        await supabase.rpc("increment_xp", { user_id: answer.answerer_id, amount: place===1?30:place===2?20:10 });
      }
    }
    await loadAnswers();
    const { data: fresh } = await supabase.from("bounty_answers").select("placement").eq("bounty_id", bounty.id);
    if ((fresh||[]).filter((a: any) => a.placement !== null).length >= 3) {
      await supabase.from("bounties").update({ status: "closed" }).eq("id", bounty.id);
      setBounty(b => b ? { ...b, status: "closed" } : b);
    }
    setAssigning(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:36,height:36,border:"3px solid #2d6a4f",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 16px" }} />
        <p style={{ color:"#aaa",fontSize:14 }}>Loading bounty…</p>
      </div>
    </div>
  );

  if (!bounty) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>🎯</div>
        <p style={{ color:"#aaa" }}>Bounty not found</p>
        <a href="/bounties" style={{ display:"inline-block",marginTop:16,padding:"10px 24px",background:"#2d6a4f",color:"#fff",borderRadius:10,fontSize:13,fontWeight:700 }}>← Back to Bounties</a>
      </div>
    </div>
  );

  const urgency            = getUrgency(bounty.deadline);
  const timeLeft           = getTimeLeft(bounty.deadline);
  const isExpired          = new Date(bounty.deadline).getTime() < Date.now();
  const isClosed           = bounty.status === "closed" || isExpired;
  const isPoster           = currentUser?.id === bounty.poster_id;
  const isOpen             = bounty.status === "open" && !isExpired;
  const placementsAssigned = answers.filter(a => a.placement !== null).length;
  const posterRank         = getRank(bounty.profiles?.xp_multiplier);

  const placementConfig: Record<number, { bg: string; border: string; badge: string; color: string; glow: string }> = {
    1: { bg:"linear-gradient(135deg,#fffbeb,#fef3c7)", border:"#fde68a", badge:"🥇", color:"#b45309", glow:"rgba(255,215,0,0.2)" },
    2: { bg:"linear-gradient(135deg,#f8f8f8,#f0f0f0)", border:"#d1d5db", badge:"🥈", color:"#6b7280", glow:"rgba(192,192,192,0.2)" },
    3: { bg:"linear-gradient(135deg,#fff7ed,#fde8d0)", border:"#fed7aa", badge:"🥉", color:"#a0522d", glow:"rgba(205,127,50,0.2)" },
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;}
        @keyframes spin        {to{transform:rotate(360deg)}}
        @keyframes fadeUp      {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn      {from{opacity:0}to{opacity:1}}
        @keyframes pulse       {0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes goldPulse   {0%,100%{box-shadow:0 0 0 1px #ffd700,0 0 10px 2px rgba(255,215,0,.6)}50%{box-shadow:0 0 0 1px #ffd700,0 0 18px 4px rgba(255,215,0,1)}}
        @keyframes silverPulse {0%,100%{box-shadow:0 0 0 1px #c0c0c0,0 0 8px 2px rgba(192,192,192,.5)}50%{box-shadow:0 0 0 1px #ddd,0 0 14px 3px rgba(220,220,220,.9)}}
        @keyframes bronzePulse {0%,100%{box-shadow:0 0 0 1px #cd7f32,0 0 8px 2px rgba(205,127,50,.5)}50%{box-shadow:0 0 0 1px #cd7f32,0 0 14px 3px rgba(205,127,50,.8)}}
        .btn{transition:all .15s;cursor:pointer;border:none;}
        .btn:hover{opacity:.88;transform:translateY(-1px);}
        .img-zoom{cursor:zoom-in;transition:opacity .15s;}
        .img-zoom:hover{opacity:.85;}
        .nav-link{padding:7px 13px;border-radius:9px;color:#555;font-size:13px;font-weight:600;transition:all .12s;display:inline-block;}
        .nav-link:hover{background:#f0ece4;color:#1a1a1a;}
        .nav-link.active{background:#f0fdf4;color:#2d6a4f;font-weight:700;}
        textarea:focus,input:focus{outline:none;border-color:#2d6a4f!important;box-shadow:0 0 0 3px rgba(45,106,79,.1);}
      `}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24,animation:"fadeIn .2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth:"88vw",maxHeight:"88vh",borderRadius:16 }} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute",top:20,right:20,width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",fontSize:16,cursor:"pointer" }}>✕</button>
        </div>
      )}

      {confirmPending && (
        <ConfirmModal place={confirmPending.place} credits={confirmPending.credits}
          onConfirm={handleAssignPlacement} onCancel={() => setConfirmPending(null)} />
      )}

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid #e8e2d9",padding:"0 28px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:2 }}>
          {[["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className={`nav-link${h==="/bounties"?" active":""}`}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <a href="/bounties" className="btn" style={{ padding:"7px 14px",borderRadius:8,background:"#f5f0e8",color:"#555",fontSize:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4 }}>← All Bounties</a>
          {currentUser && (
            <a href="/profile" style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:999,background:"#f0fdf4",border:"1.5px solid #86efac" }}>
              <PremiumAvatar name={currentUser.full_name} level={currentUser.level} avatarUrl={currentUser.avatar_url} xp_multiplier={currentUser.xp_multiplier} size={26} />
              <span style={{ fontSize:12,fontWeight:800,color:"#2d6a4f" }}>{currentUser.credits} cr</span>
            </a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:800,margin:"0 auto",padding:"32px 20px" }}>

        {isClosed && (
          <div style={{ background:"#f5f5f4",borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12,border:"1.5px solid #e7e5e4",animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:22 }}>🔒</span>
            <div>
              <div style={{ fontSize:14,fontWeight:800,color:"#1a1a1a" }}>This bounty is closed</div>
              <div style={{ fontSize:12,color:"#aaa" }}>{bounty.status==="closed"?"All 3 placements have been awarded.":"The deadline has passed."}</div>
            </div>
            <a href="/bounties" style={{ marginLeft:"auto",padding:"7px 16px",borderRadius:10,background:"#2d6a4f",color:"#fff",fontSize:12,fontWeight:700,flexShrink:0 }}>Find Open Bounties →</a>
          </div>
        )}

        {/* BOUNTY CARD */}
        <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #e8e2d9",padding:"28px 30px",marginBottom:16,boxShadow:"0 2px 16px rgba(0,0,0,.04)",animation:"fadeUp .3s ease" }}>
          <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap" }}>
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:999,background:urgency.bg,color:urgency.color }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:urgency.dot,display:"inline-block",animation:isOpen?"pulse 2s infinite":"none" }}/>{urgency.label}
            </span>
            <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>⏱ {timeLeft}</span>
            <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>💬 {answers.length} answer{answers.length!==1?"s":""}</span>
          </div>

          <h1 style={{ fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:900,color:"#1a1a1a",lineHeight:1.3,marginBottom:14 }}>{bounty.title}</h1>
          <p style={{ fontSize:15,color:"#555",lineHeight:1.75,marginBottom:18,whiteSpace:"pre-wrap" }}>{bounty.description}</p>

          {bounty.image_url && (
            <div style={{ marginBottom:20 }}>
              <img src={bounty.image_url} alt="bounty" className="img-zoom" onClick={() => setLightbox(bounty.image_url!)}
                style={{ maxWidth:"100%",maxHeight:360,borderRadius:14,border:"1.5px solid #e8e2d9",display:"block" }} />
              <span style={{ fontSize:11,color:"#aaa",marginTop:5,display:"block" }}>Click to enlarge</span>
            </div>
          )}

          {/* POSTER INFO */}
          <div style={{ display:"flex",alignItems:"center",gap:12,paddingTop:16,borderTop:"1px solid #f0ece4" }}>
            <PremiumAvatar name={bounty.profiles?.full_name||"?"} level={bounty.profiles?.level}
              avatarUrl={bounty.profiles?.avatar_url} xp_multiplier={bounty.profiles?.xp_multiplier} size={40} />
            <div style={{ flex:1 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{bounty.profiles?.full_name}</span>
                <XPBadge xp_multiplier={bounty.profiles?.xp_multiplier} />
              </div>
              <div style={{ fontSize:11,color:"#aaa",marginBottom:5 }}>@{bounty.profiles?.username} · {new Date(bounty.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
              <PerkBadges profile={bounty.profiles} />
            </div>
          </div>
        </div>

        {/* REWARD CARD */}
        <div style={{ background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:18,padding:"22px 24px",border:"1.5px solid #86efac",marginBottom:16,animation:"fadeUp .3s .05s ease both" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16 }}>
            <div>
              <div style={{ fontSize:12,color:"#2d6a4f",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:4 }}>Total Reward Pool</div>
              <div style={{ fontFamily:"'Fraunces',serif",fontSize:44,fontWeight:900,color:"#2d6a4f",lineHeight:1 }}>{bounty.credit_reward} <span style={{ fontSize:20 }}>credits</span></div>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              {[{e:"🥇",label:"1st",p:bounty.first_place_pct},{e:"🥈",label:"2nd",p:bounty.second_place_pct},{e:"🥉",label:"3rd",p:bounty.third_place_pct}].map(({e,label,p})=>{
                const assigned = answers.find(a => a.placement === (label==="1st"?1:label==="2nd"?2:3));
                return (
                  <div key={label} style={{ background:"#fff",borderRadius:14,padding:"14px 18px",textAlign:"center",border:"1px solid #86efac",minWidth:80,position:"relative",overflow:"hidden" }}>
                    {assigned && <div style={{ position:"absolute",inset:0,background:"rgba(45,106,79,0.06)" }} />}
                    <div style={{ fontSize:20,marginBottom:4 }}>{e}</div>
                    <div style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:800,color:"#2d6a4f" }}>{Math.floor(bounty.credit_reward*p/100)} cr</div>
                    <div style={{ fontSize:10,color:"#52b788",fontWeight:700,marginTop:2 }}>{p}%</div>
                    {assigned && <div style={{ fontSize:10,color:"#2d6a4f",fontWeight:800,marginTop:4 }}>✓ Awarded</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isPoster && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #e8e2d9",padding:"22px 26px",marginBottom:16,animation:"fadeUp .3s .1s ease both" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:answers.length>0?14:0 }}>
              <div style={{ fontSize:15,fontWeight:800,color:"#1a1a1a" }}>🏆 Judging Panel</div>
              <span style={{ fontSize:13,color:"#aaa",fontWeight:600 }}>{placementsAssigned}/3 awarded</span>
            </div>
            {answers.length > 0 && (
              <div style={{ background:"#f0fdf4",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#2d6a4f",fontWeight:600,border:"1px solid #86efac" }}>
                💡 Assign 1st, 2nd, and 3rd place. A confirmation will appear before credits are sent.
              </div>
            )}
          </div>
        )}

        {!currentUser && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #e8e2d9",padding:"40px 24px",textAlign:"center",marginBottom:16 }}>
            <div style={{ fontSize:44,marginBottom:14 }}>🔒</div>
            <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#1a1a1a",marginBottom:8 }}>Sign in to answer</div>
            <p style={{ fontSize:14,color:"#aaa",marginBottom:20 }}>You need an account to submit answers and earn credits.</p>
            <a href="/login" style={{ display:"inline-block",padding:"12px 28px",background:"#2d6a4f",color:"#fff",borderRadius:999,fontSize:14,fontWeight:700 }}>Sign in to Answer →</a>
          </div>
        )}

        {currentUser && !isPoster && !hasAnswered && isOpen && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #e8e2d9",padding:"26px 28px",marginBottom:16,animation:"fadeUp .3s .1s ease both",boxShadow:"0 4px 20px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:16,fontWeight:800,color:"#1a1a1a",marginBottom:6 }}>Submit Your Answer 💡</div>
            <div style={{ background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:13,color:"#2d6a4f",fontWeight:600 }}>
              🙈 Semi-blind contest — you can't see other answers until you submit your own. Be original!
            </div>
            {submitSuccess ? (
              <div style={{ textAlign:"center",padding:"24px 0" }}>
                <div style={{ fontSize:52,marginBottom:12 }}>✅</div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#2d6a4f",marginBottom:6 }}>Answer submitted!</div>
                <p style={{ fontSize:14,color:"#aaa" }}>You can now see all answers below. Good luck! 🤞</p>
              </div>
            ) : (
              <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
                <PremiumAvatar name={currentUser.full_name} level={currentUser.level} avatarUrl={currentUser.avatar_url} xp_multiplier={currentUser.xp_multiplier} size={40} />
                <div style={{ flex:1 }}>
                  <textarea rows={6} value={answerContent} onChange={e => setAnswerContent(e.target.value)}
                    placeholder="Write your answer here. Be detailed and clear…"
                    style={{ width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #e8e2d9",fontSize:14,fontFamily:"'DM Sans',sans-serif",resize:"vertical",lineHeight:1.65,marginBottom:12 }}/>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <ImageUploader onUploaded={url => setAnswerImageUrl(url)} label="📷 Add Photo"/>
                      <span style={{ fontSize:12,color:answerContent.length<20?"#f59e0b":"#aaa" }}>
                        {answerContent.length<20?`${20-answerContent.length} more chars needed`:"✓ Ready to submit"}
                      </span>
                    </div>
                    {submitError && <p style={{ color:"#dc2626",fontSize:12,margin:0 }}>{submitError}</p>}
                    <button onClick={handleSubmitAnswer} disabled={submitting||answerContent.trim().length<20} className="btn"
                      style={{ padding:"10px 24px",borderRadius:999,background:answerContent.trim().length<20?"#f0fdf4":"#2d6a4f",color:answerContent.trim().length<20?"#86efac":"#fff",fontSize:14,fontWeight:700,boxShadow:answerContent.trim().length>=20?"0 4px 14px rgba(45,106,79,.3)":"none" }}>
                      {submitting?"Submitting…":"Submit → See All Answers"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentUser && !isPoster && !hasAnswered && isExpired && (
          <div style={{ background:"#f5f5f4",borderRadius:16,padding:"22px",textAlign:"center",border:"1.5px solid #e7e5e4",marginBottom:16 }}>
            <p style={{ fontSize:14,color:"#666",fontWeight:700 }}>⏰ This bounty expired before you answered.</p>
            <a href="/bounties" style={{ display:"inline-block",marginTop:12,padding:"9px 22px",background:"#2d6a4f",color:"#fff",borderRadius:999,fontSize:13,fontWeight:700 }}>Find open bounties →</a>
          </div>
        )}

        {/* ANSWERS LIST */}
        {(hasAnswered || isPoster) && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ fontSize:11,fontWeight:800,color:"#aaa",letterSpacing:".1em",textTransform:"uppercase",marginBottom:14,paddingLeft:4 }}>
              {answers.length} Answer{answers.length!==1?"s":""}
            </div>
            {answers.length === 0 ? (
              <div style={{ textAlign:"center",padding:"48px 24px",background:"#fff",borderRadius:18,border:"1.5px solid #e8e2d9" }}>
                <div style={{ fontSize:40,marginBottom:12 }}>⏳</div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:800,color:"#aaa" }}>No answers yet</div>
                <p style={{ fontSize:13,color:"#aaa",marginTop:6 }}>Share the bounty to get responses!</p>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                {answers.map((answer, idx) => {
                  const isMyAnswer = answer.answerer_id === currentUser?.id;
                  const placement  = answer.placement as 1|2|3|null;
                  const pc         = placement ? placementConfig[placement] : null;
                  const ansRank    = getRank(answer.profiles?.xp_multiplier);
                  return (
                    <div key={answer.id} style={{
                      background: pc ? pc.bg : isMyAnswer ? "#f0fdf4" : "#fff",
                      borderRadius:16,
                      border:`1.5px solid ${pc ? pc.border : isMyAnswer ? "#86efac" : "#e8e2d9"}`,
                      padding:"22px 24px", position:"relative", overflow:"hidden",
                      boxShadow: pc ? `0 4px 20px ${pc.glow}` : "0 2px 8px rgba(0,0,0,.03)",
                      animation:`fadeUp .3s ${idx*.05}s ease both`,
                    }}>
                      {pc && (
                        <div style={{ position:"absolute",top:0,right:0,background:placement===1?"linear-gradient(135deg,#f59e0b,#d97706)":placement===2?"linear-gradient(135deg,#9ca3af,#6b7280)":"linear-gradient(135deg,#cd7f32,#a0522d)",color:"#fff",fontSize:12,fontWeight:800,padding:"5px 16px",borderBottomLeftRadius:12 }}>
                          {pc.badge} {placement===1?"1st":placement===2?"2nd":"3rd"} Place · +{answer.credits_earned} cr
                        </div>
                      )}
                      {isMyAnswer && !placement && (
                        <div style={{ position:"absolute",top:0,right:0,background:"#2d6a4f",color:"#fff",fontSize:11,fontWeight:800,padding:"4px 12px",borderBottomLeftRadius:10 }}>Your answer</div>
                      )}

                      <div style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                        <PremiumAvatar name={answer.profiles?.full_name||"?"} level={answer.profiles?.level}
                          avatarUrl={answer.profiles?.avatar_url} xp_multiplier={answer.profiles?.xp_multiplier} size={40} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap" }}>
                            <span style={{ fontSize:14,fontWeight:700,color:"#1a1a1a" }}>{answer.profiles?.full_name}</span>
                            <XPBadge xp_multiplier={answer.profiles?.xp_multiplier} />
                            <span style={{ fontSize:11,color:"#aaa",marginLeft:"auto" }}>#{idx+1} · {new Date(answer.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                          </div>
                          {/* Perk badges for answerer */}
                          <div style={{ marginBottom:10 }}>
                            <PerkBadges profile={answer.profiles} />
                          </div>
                          <p style={{ fontSize:14,color:"#555",lineHeight:1.75,whiteSpace:"pre-wrap",marginBottom:answer.image_url?14:0 }}>{answer.content}</p>
                          {answer.image_url && (
                            <div style={{ marginBottom:14 }}>
                              <img src={answer.image_url} alt="attachment" className="img-zoom" onClick={() => setLightbox(answer.image_url!)}
                                style={{ maxWidth:"100%",maxHeight:280,borderRadius:12,border:"1.5px solid #e8e2d9",display:"block" }} />
                              <span style={{ fontSize:11,color:"#aaa",marginTop:4,display:"block" }}>Click to enlarge</span>
                            </div>
                          )}

                          {isPoster && !answer.placement && !isClosed && (
                            <div style={{ display:"flex",gap:8,alignItems:"center",paddingTop:12,borderTop:"1px solid #f0ece4",flexWrap:"wrap" }}>
                              <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>Award:</span>
                              {([1,2,3] as const).map(place => {
                                const taken = answers.some(a => a.placement === place);
                                const pcts  = [bounty.first_place_pct,bounty.second_place_pct,bounty.third_place_pct];
                                const pc2   = placementConfig[place];
                                const cr    = Math.floor(bounty.credit_reward * pcts[place-1] / 100);
                                return (
                                  <button key={place}
                                    onClick={() => !taken && !assigning && requestAssignment(answer.id, place)}
                                    disabled={taken||assigning} className="btn"
                                    style={{ padding:"7px 14px",borderRadius:10,fontSize:12,fontWeight:700,
                                      background:taken?"#f5f5f4":pc2.bg,
                                      color:taken?"#aaa":pc2.color,
                                      border:`1px solid ${taken?"#e5e7eb":pc2.border}`,
                                      fontFamily:"'DM Sans',sans-serif",cursor:taken?"not-allowed":"pointer" }}>
                                    {assigning?"…":`${pc2.badge} ${cr} cr${taken?" ✓":""}`}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}