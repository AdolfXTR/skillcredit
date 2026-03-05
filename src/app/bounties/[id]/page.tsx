"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string; title: string; description: string; image_url?: string | null;
  credit_reward: number; first_place_pct: number; second_place_pct: number;
  third_place_pct: number; status: string; deadline: string; created_at: string;
  poster_id: string;
  profiles: { full_name: string; username: string; level: string };
};
type Answer = {
  id: string; bounty_id: string; answerer_id: string; content: string;
  image_url?: string | null; placement: number | null; credits_earned: number;
  created_at: string;
  profiles: { full_name: string; username: string; level: string };
};
type CurrentUser = { id: string; full_name: string; username: string; credits: number; level: string; };

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#7c3aed", Learner: "#6d28d9", Contributor: "#5b21b6",
  Skilled: "#4c1d95", Expert: "#3730a3", Master: "#312e81", Legend: "#1e1b4b",
};

// ── FIX #7: expired checked first ────────────────────────────────────────────
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
  if (diff <= 0) return { color: "#6b7280", bg: "#f3f4f6", label: "Closed",   dot: "#9ca3af" }; // FIX #7
  const h = diff / 3600000;
  if (h <= 3)  return { color: "#dc2626", bg: "#fef2f2", label: "Urgent",    dot: "#ef4444" };
  if (h <= 24) return { color: "#b45309", bg: "#fffbeb", label: "Due soon",  dot: "#f59e0b" };
  return        { color: "#15803d", bg: "#f0fdf4", label: "Open",     dot: "#22c55e" };
}
function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function Avatar({ name, level, size = 38 }: { name: string; level?: string; size?: number }) {
  const bg = LEVEL_COLORS[level || "Seedling"] || "#7c3aed";
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.3,fontWeight:800,color:"#fff",flexShrink:0,boxShadow:`0 0 0 2px white,0 0 0 3px ${bg}44` }}>
      {getInitials(name)}
    </div>
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
    if (error) { console.error(error); setUploading(false); return; }
    const { data } = supabase.storage.from("forum-images").getPublicUrl(path);
    onUploaded(data.publicUrl);
    setUploading(false); setDone(true);
  }
  function clear() { setPreview(null); setDone(false); onUploaded(null); if (inputRef.current) inputRef.current.value = ""; }

  return (
    <div>
      {preview ? (
        <div style={{ position:"relative",display:"inline-block" }}>
          <img src={preview} alt="preview" style={{ maxWidth:"100%",maxHeight:160,borderRadius:10,border:"1.5px solid #ddd6fe",display:"block" }} />
          {uploading && <div style={{ position:"absolute",inset:0,background:"rgba(255,255,255,.85)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center" }}><div style={{ width:18,height:18,border:"2px solid #7c3aed",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite" }} /></div>}
          {done && <div style={{ position:"absolute",bottom:6,right:6,background:"#7c3aed",color:"#fff",fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:20 }}>✓</div>}
          <button onClick={clear} style={{ position:"absolute",top:5,right:5,width:22,height:22,borderRadius:"50%",background:"#1a1a1a",color:"#fff",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,background:"#ede9fe",border:"1.5px dashed #a78bfa",color:"#6d28d9",fontSize:13,fontWeight:600,cursor:"pointer" }}>{label}</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── FIX #F: Confirmation modal ────────────────────────────────────────────────
function ConfirmModal({ onConfirm, onCancel, place, credits }: { onConfirm: () => void; onCancel: () => void; place: 1|2|3; credits: number }) {
  const emoji = place===1?"🥇":place===2?"🥈":"🥉";
  const label = place===1?"1st":place===2?"2nd":"3rd";
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(15,10,30,.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"fadeIn .15s ease" }}>
      <div style={{ background:"#fff",borderRadius:20,padding:"28px 32px",maxWidth:380,width:"100%",textAlign:"center",boxShadow:"0 24px 60px rgba(90,60,180,.3)",animation:"fadeUp .2s ease" }}>
        <div style={{ fontSize:44,marginBottom:12 }}>{emoji}</div>
        <h3 style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1e1b2e",marginBottom:8 }}>Confirm {label} Place Award</h3>
        <p style={{ fontSize:14,color:"#6b6880",lineHeight:1.6,marginBottom:22 }}>
          You're about to award <strong style={{ color:"#7c3aed" }}>{credits} credits</strong> for {label} place.<br/>
          <strong style={{ color:"#dc2626" }}>This cannot be undone.</strong>
        </p>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,padding:"11px",borderRadius:12,background:"#ede9fe",color:"#7c3aed",fontWeight:700,fontSize:14,border:"none",cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex:1,padding:"11px",borderRadius:12,background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",fontWeight:800,fontSize:14,border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(124,58,237,.35)" }}>
            {emoji} Award Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
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
  // FIX #F: confirmation before placement
  const [confirmPending, setConfirmPending]         = useState<{ answerId: string; place: 1|2|3; credits: number } | null>(null);

  useEffect(() => { init(); }, [id]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("id,full_name,username,credits,level").eq("id", user.id).single();
      if (prof) setCurrentUser(prof);
    }
    if (!id) { setLoading(false); return; }

    const { data: b } = await supabase.from("bounties").select("*,profiles(full_name,username,level)").eq("id", id).single();
    if (b) setBounty(b as Bounty);

    if (user) {
      const isPoster = b?.poster_id === user.id;
      const { data: myAns } = await supabase.from("bounty_answers").select("id").eq("bounty_id", id).eq("answerer_id", user.id).maybeSingle();

      // FIX #1: set hasAnswered from DB truth, not derived state
      if (myAns) setHasAnswered(true);

      if (isPoster || myAns) {
        await loadAnswers();
      }
    }
    setLoading(false);
  }

  async function loadAnswers() {
    const { data } = await supabase.from("bounty_answers").select("*,profiles(full_name,username,level)").eq("bounty_id", id).order("created_at", { ascending: true });
    setAnswers((data as Answer[]) || []);
  }

  // FIX #D: realtime subscription — answers update live for poster
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`bounty_${id}_answers`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bounty_answers", filter: `bounty_id=eq.${id}` }, () => {
        loadAnswers();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function handleSubmitAnswer() {
    if (!currentUser || !bounty) return;
    // FIX #2: UI guard (RLS policy on DB is the real enforcement)
    if (currentUser.id === bounty.poster_id) return;

    if (!answerContent.trim() || answerContent.length < 20) {
      setSubmitError("Answer must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    const insertData: Record<string, unknown> = {
      bounty_id:    bounty.id,
      answerer_id:  currentUser.id,
      content:      answerContent.trim(),
    };
    if (answerImageUrl) insertData.image_url = answerImageUrl;

    const { error } = await supabase.from("bounty_answers").insert(insertData);
    if (error) {
      console.error("Submit error:", JSON.stringify(error));
      setSubmitError("Failed to submit: " + (error.message || JSON.stringify(error)));
      setSubmitting(false);
      return;
    }

    await loadAnswers();
    setHasAnswered(true);
    setSubmitSuccess(true);
    setSubmitting(false);

    if (bounty.poster_id !== currentUser.id) {
      await supabase.from("notifications").insert({
        user_id: bounty.poster_id, type: "platform",
        title:   "New answer on your bounty! 🎯",
        body:    `${currentUser.full_name} answered your bounty: "${bounty.title}"`,
        link:    `/bounties/${bounty.id}`,
      });
    }
  }

  // FIX #F: now triggered via confirmation modal, not directly
  function requestAssignment(answerId: string, placement: 1|2|3) {
    if (!bounty) return;
    const pct     = placement===1 ? bounty.first_place_pct : placement===2 ? bounty.second_place_pct : bounty.third_place_pct;
    const credits = Math.floor(bounty.credit_reward * pct / 100);
    setConfirmPending({ answerId, place: placement, credits });
  }

  // FIX #3 + #10: close bounty when all 3 placed; idempotency via existing placement check
  async function handleAssignPlacement() {
    if (!bounty || !confirmPending) return;
    const { answerId, place, credits } = confirmPending;
    setConfirmPending(null);
    setAssigning(true);

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
          title:   `${place===1?"🥇 1st":place===2?"🥈 2nd":"🥉 3rd"} place on a bounty!`,
          body:    `You earned ${credits} credits for "${bounty.title}"`,
          link:    `/bounties/${bounty.id}`,
        });
        // FIX #10: only award XP once — the placement check above (answers.some) ensures idempotency in UI
        // but also use upsert/rpc guard if available
        await supabase.rpc("increment_xp", { user_id: answer.answerer_id, amount: place===1?30:place===2?20:10 });
      }
    }

    await loadAnswers();

    // FIX #3: check if all 3 places filled → close bounty
    const { data: fresh } = await supabase.from("bounty_answers").select("placement").eq("bounty_id", bounty.id);
    const assigned = (fresh||[]).filter((a: any) => a.placement !== null).length;
    if (assigned >= 3) {
      await supabase.from("bounties").update({ status: "closed" }).eq("id", bounty.id);
      setBounty(b => b ? { ...b, status: "closed" } : b);
    }

    setAssigning(false);
  }

  // ── Loading / not found ───────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh",background:"#f4f2fb",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:36,height:36,border:"3px solid #7c3aed",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 16px" }} />
        <p style={{ color:"#a8a4bc",fontSize:14 }}>Loading bounty…</p>
      </div>
    </div>
  );

  if (!bounty) return (
    <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:12 }}>🎯</div>
        <p style={{ color:"#a8a4bc" }}>Bounty not found</p>
        <a href="/bounties" style={{ display:"inline-block",marginTop:16,padding:"10px 24px",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",borderRadius:10,fontSize:13,fontWeight:700 }}>← Back to Bounties</a>
      </div>
    </div>
  );

  // ── Computed ──────────────────────────────────────────────────────────────
  const urgency           = getUrgency(bounty.deadline);
  const timeLeft          = getTimeLeft(bounty.deadline);
  const isExpired         = new Date(bounty.deadline).getTime() < Date.now();
  const isClosed          = bounty.status === "closed" || isExpired;
  const isPoster          = currentUser?.id === bounty.poster_id;
  const isOpen            = bounty.status === "open" && !isExpired;
  const placementsAssigned= answers.filter(a => a.placement !== null).length;

  return (
    <div style={{ minHeight:"100vh",background:"#f4f2fb",fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none;}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn {from{opacity:0}to{opacity:1}}
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:.5}}
        .btn{transition:all .15s;cursor:pointer;border:none;}
        .btn:hover{opacity:.88;transform:translateY(-1px);}
        .img-zoom{cursor:zoom-in;transition:opacity .15s;}
        .img-zoom:hover{opacity:.85;}
        .nav-link{padding:7px 13px;border-radius:9px;color:#6b6880;font-size:13px;font-weight:600;transition:all .12s;display:inline-block;}
        .nav-link:hover{background:#ede9fe;color:#7c3aed;}
        .nav-link.active{background:#ede9fe;color:#7c3aed;font-weight:700;}
        textarea:focus,input:focus{outline:none;border-color:#7c3aed!important;box-shadow:0 0 0 3px rgba(124,58,237,.1);}
      `}</style>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out",padding:24,animation:"fadeIn .2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth:"88vw",maxHeight:"88vh",borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,.5)" }} />
          <button onClick={() => setLightbox(null)} style={{ position:"absolute",top:20,right:20,width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",fontSize:16,cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* FIX #F: confirm modal */}
      {confirmPending && (
        <ConfirmModal
          place={confirmPending.place}
          credits={confirmPending.credits}
          onConfirm={handleAssignPlacement}
          onCancel={() => setConfirmPending(null)}
        />
      )}

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)",backdropFilter:"blur(12px)",borderBottom:"1px solid #ebe8f4",padding:"0 28px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100 }}>
        <a href="/dashboard">
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#7c3aed" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:900,color:"#1e1b2e" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className={`nav-link${h==="/bounties"?" active":""}`}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <a href="/bounties" className="btn" style={{ padding:"7px 14px",borderRadius:8,background:"#ede9fe",color:"#7c3aed",fontSize:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4 }}>← All Bounties</a>
          {currentUser && (
            <a href="/profile" style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 12px 5px 6px",borderRadius:999,background:"#ede9fe",border:"1.5px solid #ddd6fe" }}>
              <Avatar name={currentUser.full_name} level={currentUser.level} size={26} />
              <span style={{ fontSize:12,fontWeight:800,color:"#7c3aed" }}>{currentUser.credits} cr</span>
            </a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:800,margin:"0 auto",padding:"32px 20px" }}>

        {/* FIX #E: closed banner at top */}
        {isClosed && (
          <div style={{ background:"#f3f4f6",borderRadius:14,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12,border:"1.5px solid #e5e7eb",animation:"fadeUp .3s ease" }}>
            <span style={{ fontSize:22 }}>🔒</span>
            <div>
              <div style={{ fontSize:14,fontWeight:800,color:"#374151" }}>This bounty is closed</div>
              <div style={{ fontSize:12,color:"#9ca3af" }}>{bounty.status==="closed"?"All 3 placements have been awarded.":"The deadline has passed."}</div>
            </div>
            <a href="/bounties" style={{ marginLeft:"auto",padding:"7px 16px",borderRadius:10,background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",fontSize:12,fontWeight:700,flexShrink:0 }}>Find Open Bounties →</a>
          </div>
        )}

        {/* BOUNTY CARD */}
        <div style={{ background:"#fff",borderRadius:20,border:"1.5px solid #ebe8f4",padding:"28px 30px",marginBottom:16,boxShadow:"0 2px 16px rgba(90,60,180,.05)",animation:"fadeUp .3s ease" }}>
          <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap" }}>
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:999,background:urgency.bg,color:urgency.color }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:urgency.dot,display:"inline-block",animation:isOpen?"pulse 2s infinite":"none" }}/>{urgency.label}
            </span>
            <span style={{ fontSize:12,color:"#a8a4bc",fontWeight:600 }}>⏱ {timeLeft}</span>
            <span style={{ fontSize:12,color:"#a8a4bc",fontWeight:600 }}>💬 {answers.length} answer{answers.length!==1?"s":""}</span>
          </div>
          <h1 style={{ fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:900,color:"#1e1b2e",lineHeight:1.3,marginBottom:14 }}>{bounty.title}</h1>
          <p style={{ fontSize:15,color:"#4b4860",lineHeight:1.75,marginBottom:18,whiteSpace:"pre-wrap" }}>{bounty.description}</p>
          {bounty.image_url && (
            <div style={{ marginBottom:20 }}>
              <img src={bounty.image_url} alt="bounty" className="img-zoom" onClick={() => setLightbox(bounty.image_url!)} style={{ maxWidth:"100%",maxHeight:360,borderRadius:14,border:"1.5px solid #ebe8f4",display:"block" }} />
              <span style={{ fontSize:11,color:"#a8a4bc",marginTop:5,display:"block" }}>Click to enlarge</span>
            </div>
          )}
          <div style={{ display:"flex",alignItems:"center",gap:10,paddingTop:16,borderTop:"1px solid #ebe8f4" }}>
            <Avatar name={bounty.profiles?.full_name||"?"} level={bounty.profiles?.level} size={36} />
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:"#1e1b2e" }}>{bounty.profiles?.full_name}</div>
              <div style={{ fontSize:11,color:"#a8a4bc" }}>@{bounty.profiles?.username} · {new Date(bounty.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          </div>
        </div>

        {/* REWARD CARD */}
        <div style={{ background:"linear-gradient(135deg,#ede9fe,#ddd6fe)",borderRadius:18,padding:"22px 24px",border:"1.5px solid #c4b5fd",marginBottom:16,animation:"fadeUp .3s .05s ease both" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16 }}>
            <div>
              <div style={{ fontSize:12,color:"#6d28d9",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:4 }}>Total Reward Pool</div>
              <div style={{ fontFamily:"'Fraunces',serif",fontSize:44,fontWeight:900,color:"#7c3aed",lineHeight:1 }}>{bounty.credit_reward} <span style={{ fontSize:20 }}>credits</span></div>
            </div>
            <div style={{ display:"flex",gap:10 }}>
              {[{e:"🥇 1st",p:bounty.first_place_pct},{e:"🥈 2nd",p:bounty.second_place_pct},{e:"🥉 3rd",p:bounty.third_place_pct}].map(({e,p})=>(
                <div key={e} style={{ background:"#fff",borderRadius:14,padding:"14px 18px",textAlign:"center",border:"1px solid #ddd6fe",minWidth:80 }}>
                  <div style={{ fontSize:13,color:"#a78bfa",marginBottom:4 }}>{e}</div>
                  <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#7c3aed" }}>{Math.floor(bounty.credit_reward*p/100)} cr</div>
                  <div style={{ fontSize:10,color:"#a78bfa" }}>{p}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* POSTER JUDGE VIEW */}
        {isPoster && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #ebe8f4",padding:"22px 26px",marginBottom:16,animation:"fadeUp .3s .1s ease both" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:answers.length>0?14:0 }}>
              <div style={{ fontSize:15,fontWeight:800,color:"#1e1b2e" }}>🏆 Judging Panel</div>
              <span style={{ fontSize:13,color:"#a8a4bc",fontWeight:600 }}>{placementsAssigned}/3 awarded</span>
            </div>
            {answers.length > 0 && (
              <div style={{ background:"#ede9fe",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#6d28d9",fontWeight:600 }}>
                💡 Assign 1st, 2nd, and 3rd place. A confirmation will appear before credits are sent.
              </div>
            )}
          </div>
        )}

        {/* NOT LOGGED IN */}
        {!currentUser && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #ebe8f4",padding:"40px 24px",textAlign:"center",marginBottom:16 }}>
            <div style={{ fontSize:44,marginBottom:14 }}>🔒</div>
            <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#1e1b2e",marginBottom:8 }}>Sign in to answer</div>
            <p style={{ fontSize:14,color:"#a8a4bc",marginBottom:20 }}>You need an account to submit answers and earn credits.</p>
            <a href="/login" style={{ display:"inline-block",padding:"12px 28px",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",borderRadius:999,fontSize:14,fontWeight:700 }}>Sign in to Answer →</a>
          </div>
        )}

        {/* ANSWER FORM — FIX #2: double-check poster can't submit */}
        {currentUser && !isPoster && !hasAnswered && isOpen && (
          <div style={{ background:"#fff",borderRadius:18,border:"1.5px solid #ebe8f4",padding:"26px 28px",marginBottom:16,animation:"fadeUp .3s .1s ease both",boxShadow:"0 4px 20px rgba(90,60,180,.06)" }}>
            <div style={{ fontSize:16,fontWeight:800,color:"#1e1b2e",marginBottom:6 }}>Submit Your Answer 💡</div>
            <div style={{ background:"#ede9fe",border:"1px solid #ddd6fe",borderRadius:10,padding:"10px 14px",marginBottom:18,fontSize:13,color:"#6d28d9",fontWeight:600 }}>
              🙈 Semi-blind contest — you can't see other answers until you submit your own. Be original!
            </div>
            {submitSuccess ? (
              <div style={{ textAlign:"center",padding:"24px 0" }}>
                <div style={{ fontSize:52,marginBottom:12 }}>✅</div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:"#7c3aed",marginBottom:6 }}>Answer submitted!</div>
                <p style={{ fontSize:14,color:"#a8a4bc" }}>You can now see all answers below. Good luck! 🤞</p>
              </div>
            ) : (
              <div style={{ display:"flex",gap:14,alignItems:"flex-start" }}>
                <Avatar name={currentUser.full_name} level={currentUser.level} size={40} />
                <div style={{ flex:1 }}>
                  <textarea rows={6} value={answerContent} onChange={e => setAnswerContent(e.target.value)}
                    placeholder="Write your answer here. Be detailed and clear…"
                    style={{ width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid #ebe8f4",fontSize:14,fontFamily:"'DM Sans',sans-serif",resize:"vertical",lineHeight:1.65,marginBottom:12 }}/>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <ImageUploader onUploaded={url => setAnswerImageUrl(url)} label="📷 Add Photo"/>
                      <span style={{ fontSize:12,color:answerContent.length<20?"#f59e0b":"#a8a4bc" }}>
                        {answerContent.length<20?`${20-answerContent.length} more chars needed`:"✓ Ready to submit"}
                      </span>
                    </div>
                    {submitError && <p style={{ color:"#dc2626",fontSize:12,margin:0,maxWidth:300 }}>{submitError}</p>}
                    <button onClick={handleSubmitAnswer} disabled={submitting||answerContent.trim().length<20} className="btn"
                      style={{ padding:"10px 24px",borderRadius:999,background:answerContent.trim().length<20?"#ede9fe":"linear-gradient(135deg,#7c3aed,#5b21b6)",color:answerContent.trim().length<20?"#a78bfa":"#fff",fontSize:14,fontWeight:700,boxShadow:answerContent.trim().length>=20?"0 4px 14px rgba(124,58,237,.35)":"none" }}>
                      {submitting?"Submitting…":"Submit → See All Answers"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXPIRED + NOT ANSWERED */}
        {currentUser && !isPoster && !hasAnswered && isExpired && (
          <div style={{ background:"#f3f4f6",borderRadius:16,padding:"22px",textAlign:"center",border:"1.5px solid #e5e7eb",marginBottom:16 }}>
            <p style={{ fontSize:14,color:"#6b7280",fontWeight:700 }}>⏰ This bounty expired before you answered.</p>
            <a href="/bounties" style={{ display:"inline-block",marginTop:12,padding:"9px 22px",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",borderRadius:999,fontSize:13,fontWeight:700 }}>Find open bounties →</a>
          </div>
        )}

        {/* ANSWERS LIST */}
        {(hasAnswered || isPoster) && (
          <div style={{ animation:"fadeUp .3s ease" }}>
            <div style={{ fontSize:11,fontWeight:800,color:"#a8a4bc",letterSpacing:".1em",textTransform:"uppercase",marginBottom:14,paddingLeft:4 }}>
              {answers.length} Answer{answers.length!==1?"s":""}
            </div>
            {answers.length === 0 ? (
              <div style={{ textAlign:"center",padding:"48px 24px",background:"#fff",borderRadius:18,border:"1.5px solid #ebe8f4" }}>
                <div style={{ fontSize:40,marginBottom:12 }}>⏳</div>
                <div style={{ fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:800,color:"#a8a4bc" }}>No answers yet</div>
                <p style={{ fontSize:13,color:"#a8a4bc",marginTop:6 }}>Share the bounty to get responses!</p>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                {answers.map((answer, idx) => {
                  const isMyAnswer    = answer.answerer_id === currentUser?.id;
                  const placementEmoji= answer.placement===1?"🥇":answer.placement===2?"🥈":answer.placement===3?"🥉":null;
                  const placementLabel= answer.placement===1?"1st Place":answer.placement===2?"2nd Place":"3rd Place";
                  return (
                    <div key={answer.id} style={{
                      background: placementEmoji?"linear-gradient(135deg,#ede9fe,#ddd6fe)":isMyAnswer?"#faf9ff":"#fff",
                      borderRadius:16, border:`1.5px solid ${placementEmoji?"#c4b5fd":isMyAnswer?"#ddd6fe":"#ebe8f4"}`,
                      padding:"22px 24px", position:"relative", overflow:"hidden",
                      boxShadow: placementEmoji?"0 4px 20px rgba(124,58,237,.15)":"0 2px 8px rgba(90,60,180,.03)",
                      animation:`fadeUp .3s ${idx*.05}s ease both`,
                    }}>
                      {placementEmoji && (
                        <div style={{ position:"absolute",top:0,right:0,background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",fontSize:12,fontWeight:800,padding:"5px 16px",borderBottomLeftRadius:12 }}>
                          {placementEmoji} {placementLabel} · +{answer.credits_earned} cr
                        </div>
                      )}
                      {isMyAnswer && !placementEmoji && (
                        <div style={{ position:"absolute",top:0,right:0,background:"#7c3aed",color:"#fff",fontSize:11,fontWeight:800,padding:"4px 12px",borderBottomLeftRadius:10 }}>Your answer</div>
                      )}
                      <div style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                        <Avatar name={answer.profiles?.full_name||"?"} level={answer.profiles?.level} size={40} />
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                            <span style={{ fontSize:14,fontWeight:700,color:"#1e1b2e" }}>{answer.profiles?.full_name}</span>
                            <span style={{ fontSize:11,color:"#a8a4bc" }}>@{answer.profiles?.username}</span>
                            <span style={{ fontSize:11,color:"#a8a4bc",marginLeft:"auto" }}>#{idx+1} · {new Date(answer.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                          </div>
                          <p style={{ fontSize:14,color:"#4b4860",lineHeight:1.75,whiteSpace:"pre-wrap",marginBottom:answer.image_url?14:0 }}>{answer.content}</p>
                          {answer.image_url && (
                            <div style={{ marginBottom:14 }}>
                              <img src={answer.image_url} alt="attachment" className="img-zoom" onClick={() => setLightbox(answer.image_url!)} style={{ maxWidth:"100%",maxHeight:280,borderRadius:12,border:"1.5px solid #ebe8f4",display:"block" }} />
                              <span style={{ fontSize:11,color:"#a8a4bc",marginTop:4,display:"block" }}>Click to enlarge</span>
                            </div>
                          )}

                          {/* FIX #F + #10: award buttons → go through requestAssignment → ConfirmModal */}
                          {isPoster && !answer.placement && !isClosed && (
                            <div style={{ display:"flex",gap:8,alignItems:"center",paddingTop:12,borderTop:"1px solid #ebe8f4",flexWrap:"wrap" }}>
                              <span style={{ fontSize:12,color:"#a8a4bc",fontWeight:600 }}>Award:</span>
                              {([1,2,3] as const).map(place => {
                                const taken = answers.some(a => a.placement === place);
                                const pcts  = [bounty.first_place_pct, bounty.second_place_pct, bounty.third_place_pct];
                                const e     = place===1?"🥇":place===2?"🥈":"🥉";
                                const cr    = Math.floor(bounty.credit_reward * pcts[place-1] / 100);
                                return (
                                  <button key={place}
                                    onClick={() => !taken && !assigning && requestAssignment(answer.id, place)}
                                    disabled={taken || assigning} className="btn"
                                    style={{ padding:"7px 14px",borderRadius:10,fontSize:12,fontWeight:700,background:taken?"#f3f4f6":"#ede9fe",color:taken?"#9ca3af":"#7c3aed",border:`1px solid ${taken?"#e5e7eb":"#ddd6fe"}`,fontFamily:"'DM Sans',sans-serif",cursor:taken?"not-allowed":"pointer" }}>
                                    {assigning?"…":`${e} ${cr} cr${taken?" (taken)":""}`}
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