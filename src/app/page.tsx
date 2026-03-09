"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type WeeklyChamp = {
  full_name: string; username: string; avatar_url: string | null;
  champion_title: string | null; champion_streak: number; xp: number;
};

const mockCards = [
  { type:"listing",     title:"Python for Absolute Beginners",                          teacher:"Maria S.",  credits:15, rating:4.9, color:"#e8f4e8", accent:"#2d6a4f", tag:"💻" },
  { type:"bounty",      title:"Help me solve this calculus problem — due tonight!",      credits:20, answers:3,  deadline:"2h left",    color:"#fff8e7", accent:"#b45309", tag:"🎯" },
  { type:"community",   title:"How do I center a div in CSS? I've tried everything 😭", upvotes:47, answers:12, color:"#f0f4ff", accent:"#3730a3", tag:"💬" },
  { type:"listing",     title:"UI/UX Design Fundamentals with Figma",                   teacher:"Reina C.", credits:12, rating:5.0, color:"#fdf0f8", accent:"#9d174d", tag:"🎨" },
  { type:"achievement", title:"🏆 Carlo just earned Top Teacher in JavaScript!",        sub:"23 sessions · 4.9 stars",             color:"#f0fdf4", accent:"#166534", tag:"⭐" },
  { type:"bounty",      title:"Need someone to review my 5-page business plan",         credits:35, answers:1,  deadline:"1 day left", color:"#fff8e7", accent:"#b45309", tag:"🎯" },
  { type:"listing",     title:"Guitar Basics — From zero to your first song",           teacher:"Sam R.",   credits:10, rating:4.7, color:"#fef9f0", accent:"#92400e", tag:"🎵" },
  { type:"listing",     title:"English Conversation Practice — Job-ready fluency",      teacher:"Lisa M.",  credits:8,  rating:4.8, color:"#f0fdf4", accent:"#166534", tag:"🌍" },
];

const features = [
  { icon:"🎓", title:"1-on-1 Sessions",   desc:"Book private sessions with verified skill teachers. Credits held in escrow until you're satisfied." },
  { icon:"🎯", title:"Bounty Tasks",       desc:"Post a problem, set a reward. The community competes to give you the best answer." },
  { icon:"💬", title:"Community Forum",    desc:"Ask questions, share knowledge, earn credits just by helping others." },
  { icon:"✅", title:"Skill Verification", desc:"Teachers take quizzes to earn Verified badges — so you always know who's qualified." },
  { icon:"🔒", title:"Escrow Protection",  desc:"Credits are locked until both parties confirm the session is complete. 100% safe." },
  { icon:"🏆", title:"XP & Levels",        desc:"Earn XP, level up from Seedling to Legend, unlock badges and climb the leaderboard." },
];

const learnTopics = [
  { emoji:"💻", label:"Coding"          },
  { emoji:"🌍", label:"English"         },
  { emoji:"🎸", label:"Guitar"          },
  { emoji:"🎨", label:"Design"          },
  { emoji:"📐", label:"Math"            },
  { emoji:"📊", label:"Business"        },
  { emoji:"🎬", label:"Video Editing"   },
  { emoji:"📸", label:"Photography"     },
  { emoji:"🍳", label:"Cooking"         },
  { emoji:"🗣️", label:"Public Speaking" },
];

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) || "??";
}

function WeeklyChampionBanner({ champ }: { champ: WeeklyChamp }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{ position:"relative", background:"linear-gradient(90deg,#1a3d2e 0%,#2d6a4f 40%,#1a4a35 100%)", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,#ffd700,#e8a800,#ffd700,transparent)", backgroundSize:"200% 100%", animation:"shimmer 2s linear infinite" }} />
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"12px 32px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" as const }}>
        <div style={{ animation:"crownBounce 1.5s ease infinite", fontSize:24, flexShrink:0 }}>👑</div>
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{ width:38, height:38, borderRadius:10, overflow:"hidden", background:"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", animation:"goldRing 2s ease infinite" }}>
            {champ.avatar_url
              ? <img src={champ.avatar_url} alt={champ.full_name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : getInitials(champ.full_name)}
          </div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" as const }}>
            <span style={{ fontSize:13, fontWeight:900, color:"#fff", fontFamily:"'Fraunces',serif" }}>
              🏆 This Week's Champion: {champ.full_name}
            </span>
            {champ.champion_title && (
              <span style={{ fontSize:10, fontWeight:800, background:"rgba(255,215,0,0.2)", color:"#ffd700", padding:"2px 8px", borderRadius:999, border:"1px solid rgba(255,215,0,0.3)" }}>
                {champ.champion_title}{champ.champion_streak > 1 ? ` ×${champ.champion_streak} 🔥` : ""}
              </span>
            )}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginTop:2 }}>
            @{champ.username} · {champ.xp.toLocaleString()} XP · Earned 1.25× XP multiplier + 20 bonus credits
          </div>
        </div>
        <a href="/leaderboard" style={{ fontSize:12, fontWeight:800, color:"#ffd700", background:"rgba(255,215,0,0.12)", padding:"7px 16px", borderRadius:20, border:"1px solid rgba(255,215,0,0.3)", textDecoration:"none", whiteSpace:"nowrap" as const, flexShrink:0, transition:"all .2s" }}
          onMouseOver={e => { e.currentTarget.style.background="rgba(255,215,0,0.25)"; }}
          onMouseOut={e  => { e.currentTarget.style.background="rgba(255,215,0,0.12)"; }}>
          View Leaderboard →
        </a>
        <button onClick={() => setDismissed(true)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.35)", fontSize:16, cursor:"pointer", flexShrink:0, lineHeight:1, padding:"0 4px" }}>✕</button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled]       = useState(false);
  const [weeklyChamp, setWeeklyChamp] = useState<WeeklyChamp | null>(null);

  useEffect(() => {
    const fetchChamp = async () => {
      try {
        const { data } = await supabase
          .from("weekly_champions")
          .select("user_id, week_start")
          .eq("rank", 1)
          .order("week_start", { ascending: false })
          .limit(1)
          .single();
        if (!data) return;
        const weekStart = new Date(data.week_start);
        const daysSince = (Date.now() - weekStart.getTime()) / (1000*60*60*24);
        if (daysSince > 14) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,username,avatar_url,champion_title,champion_streak,xp")
          .eq("id", data.user_id)
          .single();
        if (prof) setWeeklyChamp(prof as WeeklyChamp);
      } catch { /* graceful fallback */ }
    };
    fetchChamp();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#faf8f4", fontFamily:"'DM Sans',sans-serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none}

        @keyframes fadeUp      {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes pulse       {0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes shimmer     {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes crownBounce {0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-5px) rotate(5deg)}}
        @keyframes goldRing    {0%,100%{box-shadow:0 0 0 2.5px #e8a800,0 0 12px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 2.5px #ffd700,0 0 22px rgba(255,215,0,.9)}}
        @keyframes champSlide  {from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}}

        .reveal{opacity:0;transform:translateY(36px);transition:opacity .7s ease,transform .7s ease}
        .reveal.visible{opacity:1;transform:none}

        .hero-tag{animation:fadeUp .5s ease both}
        .hero-h1{animation:fadeUp .5s .08s ease both}
        .hero-p{animation:fadeUp .5s .16s ease both}
        .hero-btns{animation:fadeUp .5s .24s ease both}
        .hero-proof{animation:fadeUp .5s .32s ease both}
        .preview-col{animation:fadeUp .6s .18s ease both}

        .cta-btn{transition:transform .2s,box-shadow .2s}
        .cta-btn:hover{transform:translateY(-2px);box-shadow:0 10px 32px rgba(45,106,79,0.4)!important}
        .feature-card{transition:transform .2s,box-shadow .2s}
        .feature-card:hover{transform:translateY(-5px);box-shadow:0 14px 40px rgba(0,0,0,0.1)!important}
        .nav-link{transition:color .15s,background .15s}
        .nav-link:hover{color:#2d6a4f!important;background:#eef6ee!important}
        .topic-pill{transition:all .2s}
        .topic-pill:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.08)}

        .hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
        .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
        .steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        .community-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
        .problem-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:24px;align-items:center;max-width:700px;margin:0 auto}
        .nav-links{display:flex;gap:4px}
        .footer-inner{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}

        @media(max-width:768px){
          .hero-grid{grid-template-columns:1fr;gap:36px}
          .features-grid{grid-template-columns:1fr 1fr}
          .steps-grid{grid-template-columns:1fr;gap:14px}
          .community-grid{grid-template-columns:1fr;gap:32px}
          .problem-grid{grid-template-columns:1fr;gap:16px}
          .nav-links{display:none}
          .preview-col{display:none}
          .section-pad{padding:60px 20px!important}
          .footer-inner{flex-direction:column;text-align:center}
        }
        @media(max-width:480px){
          .features-grid{grid-template-columns:1fr}
          .hero-h1-text{font-size:40px!important}
          .hero-btns-wrap{flex-direction:column}
          .hero-btns-wrap a{width:100%;text-align:center;justify-content:center}
        }
        @media(min-width:769px)and(max-width:1024px){
          .hero-grid{gap:32px}
          .hero-h1-text{font-size:46px!important}
        }
      `}</style>

      {weeklyChamp && <WeeklyChampionBanner champ={weeklyChamp} />}

      {/* ── NAVBAR ── */}
      <nav style={{ position:"sticky", top:0, zIndex:200, background:scrolled?"rgba(250,248,244,0.97)":"transparent", backdropFilter:scrolled?"blur(16px)":"none", borderBottom:scrolled?"1.5px solid #e8e2d9":"1.5px solid transparent", padding:"0 32px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all .3s ease" }}>
        <div style={{ display:"flex", alignItems:"center" }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:900, color:"#111" }}>Credit</span>
        </div>
        <div className="nav-links">
          {["How it works","Features","Community"].map(label => (
            <a key={label} href={`#${label.toLowerCase().replace(/ /g,"-")}`} className="nav-link"
              style={{ padding:"7px 14px", borderRadius:8, color:"#555", fontSize:13, fontWeight:600 }}>{label}</a>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <a href="/login"  style={{ padding:"8px 16px", borderRadius:10, border:"1.5px solid #ccc", color:"#444", fontWeight:600, fontSize:13 }}>Log in</a>
          <a href="/signup" className="cta-btn" style={{ padding:"8px 18px", borderRadius:10, background:"#2d6a4f", color:"#fff", fontWeight:800, fontSize:13, boxShadow:"0 4px 14px rgba(45,106,79,0.28)" }}>Sign up free</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight:"calc(100vh - 60px)", display:"flex", alignItems:"center", width:"100%" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 48px", width:"100%" }}>
          <div className="hero-grid">
            <div>
              <div className="hero-tag" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#e8f4e8", border:"1.5px solid #b7e4c7", padding:"6px 16px", borderRadius:999, marginBottom:24 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#2d6a4f", animation:"pulse 2s infinite", display:"inline-block" }} />
                <span style={{ fontSize:12, color:"#2d6a4f", fontWeight:700 }}>🚀 Early Access — Join the first learners</span>
              </div>
              <h1 className="hero-h1">
                <span className="hero-h1-text" style={{ fontFamily:"'Fraunces',serif", fontSize:62, fontWeight:900, color:"#111", lineHeight:1.05, display:"block", marginBottom:20, letterSpacing:"-0.02em" }}>
                  Share skills.<br /><em style={{ color:"#2d6a4f", fontStyle:"italic" }}>Earn credits.</em><br />Keep learning.
                </span>
              </h1>
              <p className="hero-p" style={{ fontSize:17, color:"#555", lineHeight:1.75, marginBottom:32, maxWidth:460 }}>
                Learn any skill by spending credits — or <strong style={{ color:"#2d6a4f" }}>earn credits by teaching what you know</strong>. No cash needed. Ever.
              </p>
              <div className="hero-btns">
                <div className="hero-btns-wrap" style={{ display:"flex", gap:12, flexWrap:"wrap" as const, marginBottom:12 }}>
                  <a href="/signup" className="cta-btn" style={{ background:"#2d6a4f", color:"#fff", padding:"16px 32px", borderRadius:14, fontWeight:800, fontSize:16, boxShadow:"0 6px 24px rgba(45,106,79,0.3)", display:"inline-flex", alignItems:"center", gap:8 }}>
                    🎁 Get 20 free credits — join now
                  </a>
                  <a href="/login" style={{ background:"#f0ece4", color:"#444", padding:"16px 26px", borderRadius:14, fontWeight:700, fontSize:16, display:"inline-flex", alignItems:"center", gap:8 }}>
                    Log in →
                  </a>
                </div>
                <p style={{ fontSize:12, color:"#aaa", marginBottom:28 }}>No credit card required · Free forever to start</p>
              </div>

              {weeklyChamp ? (
                <div style={{ display:"flex", alignItems:"center", gap:14, background:"linear-gradient(135deg,#1a3d2e,#2d6a4f)", border:"1.5px solid rgba(255,215,0,0.3)", borderRadius:18, padding:"14px 18px", maxWidth:420, animation:"champSlide .5s ease", boxShadow:"0 8px 28px rgba(45,106,79,0.3)" }}>
                  <span style={{ fontSize:22, animation:"crownBounce 1.5s ease infinite", flexShrink:0 }}>👑</span>
                  <div style={{ width:40, height:40, borderRadius:11, overflow:"hidden", background:"#2d6a4f", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900, color:"#fff", animation:"goldRing 2s ease infinite", flexShrink:0 }}>
                    {weeklyChamp.avatar_url
                      ? <img src={weeklyChamp.avatar_url} alt={weeklyChamp.full_name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : getInitials(weeklyChamp.full_name)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, fontWeight:800, color:"rgba(255,215,0,0.7)", textTransform:"uppercase" as const, letterSpacing:1.5, marginBottom:2 }}>This Week's Champion</div>
                    <div style={{ fontSize:14, fontWeight:900, color:"#fff", fontFamily:"'Fraunces',serif" }}>{weeklyChamp.full_name}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{weeklyChamp.champion_title}{weeklyChamp.champion_streak > 1 ? ` · ${weeklyChamp.champion_streak} week streak 🔥` : ""}</div>
                  </div>
                  <a href="/leaderboard" style={{ fontSize:11, fontWeight:800, color:"#ffd700", textDecoration:"none", whiteSpace:"nowrap" as const }}>View →</a>
                </div>
              ) : (
                <div className="hero-proof" style={{ display:"flex", alignItems:"center", gap:12, background:"#fff", border:"1.5px solid #e8e2d9", borderRadius:16, padding:"14px 18px", boxShadow:"0 2px 12px rgba(0,0,0,.04)", maxWidth:420 }}>
                  <div style={{ display:"flex", marginRight:4 }}>
                    {["#2d6a4f","#b45309","#9d174d","#3730a3","#166534"].map((c,i) => (
                      <div key={i} style={{ width:28, height:28, borderRadius:"50%", background:c, border:"2px solid #fff", marginLeft:i===0?0:-8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:900 }}>
                        {["M","S","R","J","L"][i]}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color:"#111", lineHeight:1.2 }}>Be among the first learners</div>
                    <div style={{ fontSize:11, color:"#999", marginTop:2 }}>Early access is open — grab your 20 free credits now 🎁</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right — preview */}
            <div className="preview-col" style={{ position:"relative" }}>
              <div style={{ position:"absolute", top:"10%", left:"10%", width:"80%", height:"80%", background:"radial-gradient(ellipse,rgba(45,106,79,0.1) 0%,transparent 70%)", pointerEvents:"none", borderRadius:"50%" }} />
              <div style={{ position:"relative", borderRadius:24, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.14),0 0 0 1.5px #e8e2d9", background:"#fff" }}>
                <div style={{ background:"#f5f0e8", padding:"10px 16px", display:"flex", alignItems:"center", gap:8, borderBottom:"1.5px solid #e8e2d9" }}>
                  <div style={{ display:"flex", gap:5 }}>
                    {["#fc605b","#fdbc40","#34c84a"].map(c => <div key={c} style={{ width:11, height:11, borderRadius:"50%", background:c }} />)}
                  </div>
                  <div style={{ flex:1, background:"#fff", borderRadius:6, padding:"4px 12px", fontSize:11, color:"#aaa", fontWeight:600 }}>skillcredit.ph</div>
                </div>
                <div style={{ padding:14, maxHeight:440, overflowY:"hidden", maskImage:"linear-gradient(to bottom, black 60%, transparent 100%)" }}>
                  <div style={{ columns:2, gap:10 }}>
                    {weeklyChamp && (
                      <div style={{ background:"linear-gradient(135deg,#1a3d2e,#2d6a4f)", borderRadius:13, padding:13, marginBottom:10, breakInside:"avoid", border:"1.5px solid rgba(255,215,0,0.3)", animation:"fadeUp .3s ease both" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                          <span style={{ fontSize:11 }}>👑</span>
                          <span style={{ fontSize:9, fontWeight:800, color:"#ffd700", textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>Champion</span>
                        </div>
                        <p style={{ fontFamily:"'Fraunces',serif", fontSize:11, fontWeight:800, color:"#fff", lineHeight:1.3, marginBottom:4 }}>🏆 {weeklyChamp.full_name} is this week's Champion!</p>
                        <p style={{ fontSize:10, color:"rgba(255,255,255,0.55)" }}>{weeklyChamp.xp.toLocaleString()} XP · {weeklyChamp.champion_title}</p>
                      </div>
                    )}
                    {mockCards.map((card,i) => (
                      <div key={i} style={{ background:card.color, borderRadius:13, padding:13, marginBottom:10, breakInside:"avoid", border:"1px solid rgba(0,0,0,.05)", animation:`fadeUp .5s ${i*.07}s ease both`, transition:"transform .2s,box-shadow .2s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,.08)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                          <span style={{ fontSize:11 }}>{card.tag}</span>
                          <span style={{ fontSize:9, fontWeight:800, color:card.accent, textTransform:"uppercase" as const, letterSpacing:"0.06em" }}>
                            {card.type==="listing"?"Skill":card.type==="bounty"?"Bounty":card.type==="achievement"?"Win":"Forum"}
                          </span>
                        </div>
                        <p style={{ fontFamily:"'Fraunces',serif", fontSize:11, fontWeight:800, color:"#111", lineHeight:1.3, marginBottom:4 }}>{card.title}</p>
                        {card.type==="listing"     && "teacher" in card && <p style={{ fontSize:10, color:"#888" }}>{(card as any).teacher} · <strong style={{ color:card.accent }}>{(card as any).credits} cr</strong></p>}
                        {card.type==="bounty"      && "credits" in card && <p style={{ fontSize:10, color:"#888" }}>🏆 <strong style={{ color:card.accent }}>{(card as any).credits} cr</strong> · {(card as any).deadline}</p>}
                        {card.type==="community"   && "upvotes" in card && <p style={{ fontSize:10, color:"#888" }}>▲ {(card as any).upvotes} · 💬 {(card as any).answers}</p>}
                        {card.type==="achievement" && "sub" in card     && <p style={{ fontSize:10, color:"#888" }}>{(card as any).sub}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY THIS EXISTS ── */}
      <section className="section-pad reveal" style={{ background:"#111", padding:"80px 48px" }}>
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center" as const }}>
          <span style={{ fontSize:12, fontWeight:800, color:"#52b788", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>The Problem</span>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:40, fontWeight:900, color:"#fff", marginTop:10, marginBottom:16, letterSpacing:"-0.02em", lineHeight:1.15 }}>
            Learning is expensive.<br /><em style={{ color:"#52b788", fontStyle:"italic" }}>But everyone knows something valuable.</em>
          </h2>
          <p style={{ fontSize:16, color:"rgba(255,255,255,0.5)", lineHeight:1.8, maxWidth:600, margin:"0 auto 48px" }}>
            Courses cost thousands. Tutors are hard to find. Most skills stay locked inside people who never get to share them.
          </p>
          <div className="problem-grid">
            <div style={{ background:"rgba(255,255,255,0.06)", borderRadius:20, padding:"28px 24px", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>😩</div>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#fff", marginBottom:8 }}>Before SkillCredit</h3>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.4)", lineHeight:1.7 }}>Pay ₱500/hr for tutors. Watch YouTube and hope. Can't afford online courses.</p>
            </div>
            <div style={{ fontSize:28, color:"#52b788", fontWeight:900 }}>→</div>
            <div style={{ background:"rgba(82,183,136,0.1)", borderRadius:20, padding:"28px 24px", border:"1.5px solid rgba(82,183,136,0.25)" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🌱</div>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#52b788", marginBottom:8 }}>With SkillCredit</h3>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.7 }}>Teach guitar, earn credits. Spend them to learn Python. No cash needed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT CAN YOU LEARN ── */}
      <section className="section-pad reveal" style={{ background:"#faf8f4", padding:"72px 48px" }}>
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center" as const }}>
          <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>What can you learn?</span>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:36, fontWeight:900, color:"#111", marginTop:10, marginBottom:8, letterSpacing:"-0.02em" }}>Anything the community knows</h2>
          <p style={{ fontSize:15, color:"#666", marginBottom:36 }}>If someone knows it, you can learn it — with credits, not cash.</p>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" as const, justifyContent:"center" }}>
            {learnTopics.map((t,i) => (
              <div key={i} className="topic-pill" style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", border:"1.5px solid #e8e2d9", borderRadius:999, padding:"10px 20px", fontSize:14, fontWeight:700, color:"#333", boxShadow:"0 2px 8px rgba(0,0,0,.04)", cursor:"default" }}>
                <span style={{ fontSize:18 }}>{t.emoji}</span> {t.label}
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#e8f4e8", border:"1.5px solid #b7e4c7", borderRadius:999, padding:"10px 20px", fontSize:14, fontWeight:700, color:"#2d6a4f" }}>+ much more</div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="section-pad reveal" style={{ background:"#fff", padding:"80px 48px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center" as const, marginBottom:52 }}>
            <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>How it works</span>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:40, fontWeight:900, color:"#111", marginTop:10, letterSpacing:"-0.02em" }}>Simple. Fair. Powerful.</h2>
          </div>
          <div className="steps-grid">
            {[
              { icon:"🌱", num:"01", title:"Sign up & get 20 credits",      desc:"Create your profile, list skills you can teach and skills you want to learn. 20 free credits land in your wallet instantly." },
              { icon:"📚", num:"02", title:"Book sessions or post bounties", desc:"Find a teacher and book a 1-on-1 session, or post a task bounty and let the community race to help you." },
              { icon:"⭐", num:"03", title:"Teach, earn, grow",              desc:"Every session you teach earns credits. Every bounty you solve earns credits. Spend them to keep learning — forever." },
            ].map(item => (
              <div key={item.num} style={{ background:"#faf8f4", borderRadius:20, padding:"32px 28px", border:"1.5px solid #e8e2d9", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:-16, right:-16, width:80, height:80, borderRadius:"50%", background:"#e8f4e8", opacity:.7 }} />
                <span style={{ fontSize:36, display:"block", marginBottom:14 }}>{item.icon}</span>
                <span style={{ fontSize:11, fontWeight:900, color:"#2d6a4f", letterSpacing:"0.1em" }}>STEP {item.num}</span>
                <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#111", margin:"8px 0 10px" }}>{item.title}</h3>
                <p style={{ fontSize:14, color:"#666", lineHeight:1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="section-pad reveal" style={{ padding:"80px 48px", background:"#faf8f4" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center" as const, marginBottom:48 }}>
            <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>Features</span>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:40, fontWeight:900, color:"#111", marginTop:10, letterSpacing:"-0.02em" }}>Everything you need to learn and earn</h2>
          </div>
          <div className="features-grid">
            {features.map((f,i) => (
              <div key={i} className="feature-card" style={{ background:"#fff", borderRadius:18, padding:"28px", border:"1.5px solid #e8e2d9", boxShadow:"0 2px 10px rgba(0,0,0,.04)" }}>
                <div style={{ width:48, height:48, borderRadius:14, background:"#e8f4e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:14 }}>{f.icon}</div>
                <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:17, fontWeight:900, color:"#111", marginBottom:8 }}>{f.title}</h3>
                <p style={{ fontSize:13, color:"#666", lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMUNITY ── */}
      <section id="community" className="section-pad reveal" style={{ background:"#fff", padding:"80px 48px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div className="community-grid">
            <div>
              <span style={{ fontSize:12, fontWeight:800, color:"#2d6a4f", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>Community</span>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:38, fontWeight:900, color:"#111", margin:"12px 0 16px", lineHeight:1.15 }}>A living, breathing knowledge community</h2>
              <p style={{ fontSize:15, color:"#555", lineHeight:1.75, marginBottom:24 }}>
                Ask questions in the forum, answer bounties, join skill groups, and watch your reputation grow. Every contribution earns you credits and XP.
              </p>
              <div style={{ display:"flex", flexDirection:"column" as const, gap:10, marginBottom:28 }}>
                {[
                  { icon:"💬", text:"Forum Q&A — ask anything, earn by answering"     },
                  { icon:"🎯", text:"Bounty tasks — post problems with credit rewards" },
                  { icon:"👥", text:"Skill groups — find your learning community"      },
                  { icon:"🏆", text:"Leaderboard — compete to be the top contributor"  },
                ].map(item => (
                  <div key={item.text} style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ width:36, height:36, borderRadius:10, background:"#e8f4e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{item.icon}</span>
                    <span style={{ fontSize:14, color:"#333", fontWeight:500 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              <a href="/signup" className="cta-btn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#2d6a4f", color:"#fff", padding:"13px 26px", borderRadius:12, fontWeight:800, fontSize:14, boxShadow:"0 4px 16px rgba(45,106,79,0.25)" }}>
                Join the community →
              </a>
            </div>
            <div style={{ display:"flex", flexDirection:"column" as const, gap:10 }}>
              {mockCards.filter(c => c.type==="community"||c.type==="achievement"||c.type==="bounty").slice(0,5).map((card,i) => (
                <div key={i} style={{ background:card.color, borderRadius:16, padding:"16px 18px", border:"1px solid rgba(0,0,0,.05)", transition:"transform .2s" }}
                  onMouseEnter={e => e.currentTarget.style.transform="translateX(4px)"}
                  onMouseLeave={e => e.currentTarget.style.transform="none"}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:14 }}>{card.tag}</span>
                    <span style={{ fontSize:10, fontWeight:800, color:card.accent, textTransform:"uppercase" as const }}>
                      {card.type==="bounty"?"Bounty":card.type==="achievement"?"Achievement":"Forum"}
                    </span>
                  </div>
                  <p style={{ fontFamily:"'Fraunces',serif", fontSize:14, fontWeight:800, color:"#111", marginBottom:4, lineHeight:1.3 }}>{card.title}</p>
                  {card.type==="bounty"      && "credits" in card && <p style={{ fontSize:12, color:"#777" }}>🏆 {(card as any).credits} credits · {(card as any).deadline} · {(card as any).answers} answers</p>}
                  {card.type==="achievement" && "sub" in card     && <p style={{ fontSize:12, color:"#777" }}>{(card as any).sub}</p>}
                  {card.type==="community"   && "upvotes" in card && <p style={{ fontSize:12, color:"#777" }}>▲ {(card as any).upvotes} upvotes · 💬 {(card as any).answers} answers</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD TEASER ── */}
      <section className="section-pad reveal" style={{ background:"linear-gradient(135deg,#0d1f15 0%,#152b1e 50%,#0d1f15 100%)", padding:"80px 48px" }}>
        <div style={{ maxWidth:960, margin:"0 auto", textAlign:"center" as const }}>
          <span style={{ fontSize:12, fontWeight:800, color:"#52b788", letterSpacing:"0.12em", textTransform:"uppercase" as const }}>Leaderboard Rewards</span>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:38, fontWeight:900, color:"#fff", marginTop:10, marginBottom:12, lineHeight:1.15 }}>
            Grind hard. Earn rewards.<br /><em style={{ color:"#ffd700", fontStyle:"italic" }}>Wear your crown.</em>
          </h2>
          <p style={{ fontSize:15, color:"rgba(255,255,255,0.5)", marginBottom:40, maxWidth:520, margin:"0 auto 32px" }}>
            Three leaderboards. Three ways to win. Top 3 each week unlock real perks — not just bragging rights.
          </p>

          {/* 3 leaderboard categories */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, maxWidth:860, margin:"0 auto 24px" }}>
            {[
              { icon:"🏆", label:"XP Leaders",       color:"#52b788", border:"rgba(82,183,136,0.25)", bg:"rgba(82,183,136,0.07)",
                desc:"Most XP earned this week",
                perks:["👑 Champion Crown Title","📌 Featured Listing on Browse","⚡ 1.25x XP Boost","+ 20 / 10 / 5 credits"] },
              { icon:"🎓", label:"Teaching Activity", color:"#93c5fd", border:"rgba(147,197,253,0.25)", bg:"rgba(147,197,253,0.07)",
                desc:"Most sessions completed as teacher",
                perks:["🏫 Most Dedicated Teacher title","🎓 Active Mentor title","🌟 Rising Teacher title","🔥 Hot Teacher Tag"] },
              { icon:"⭐", label:"Student Ratings",   color:"#fcd34d", border:"rgba(252,211,77,0.25)",  bg:"rgba(252,211,77,0.07)",
                desc:"Highest rated by learners",
                perks:["⭐ Star Border on Avatar","Top Rated Badge on Profile","🌟 Highly Rated Badge","💎 Trusted Teacher Badge"] },
            ].map(r => (
              <div key={r.label} style={{ background:r.bg, borderRadius:18, padding:"22px 18px", border:`1.5px solid ${r.border}`, textAlign:"left" as const }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:24 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:900, color:r.color, fontFamily:"'Fraunces',serif" }}>{r.label}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:600 }}>{r.desc}</div>
                  </div>
                </div>
                <div style={{ width:"100%", height:"1px", background:"rgba(255,255,255,0.07)", margin:"10px 0" }} />
                <div style={{ display:"flex", flexDirection:"column" as const, gap:5 }}>
                  {r.perks.map(p => (
                    <div key={p} style={{ display:"flex", alignItems:"center", gap:7, fontSize:11, color:"rgba(255,255,255,0.65)", fontWeight:600 }}>
                      <span style={{ color:r.color, fontSize:10 }}>✓</span> {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Top 3 placement rewards — XP Leaders only since those have credits */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, maxWidth:560, margin:"0 auto 36px" }}>
            {[
              { rank:"#1", icon:"🥇", color:"#ffd700", border:"rgba(255,215,0,0.2)",  bg:"rgba(255,215,0,0.06)",  bonus:"+ 20 credits · 1.25× XP" },
              { rank:"#2", icon:"🥈", color:"#c0c0c0", border:"rgba(192,192,192,0.2)", bg:"rgba(192,192,192,0.05)", bonus:"+ 10 credits · 1.15× XP" },
              { rank:"#3", icon:"🥉", color:"#cd7f32", border:"rgba(205,127,50,0.2)",  bg:"rgba(205,127,50,0.05)",  bonus:"+ 5 credits · 1.10× XP" },
            ].map(r => (
              <div key={r.rank} style={{ background:r.bg, borderRadius:14, padding:"14px 16px", border:`1px solid ${r.border}`, textAlign:"center" as const }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{r.icon}</div>
                <div style={{ fontSize:14, fontWeight:900, color:r.color, fontFamily:"'Fraunces',serif", marginBottom:4 }}>{r.rank} XP Leader</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:600 }}>{r.bonus}</div>
              </div>
            ))}
          </div>

          <a href="/leaderboard" className="cta-btn" style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#e8a800,#ffd700)", color:"#1a1a1a", padding:"14px 28px", borderRadius:12, fontWeight:900, fontSize:14, boxShadow:"0 6px 24px rgba(232,168,0,0.4)" }}>
            👑 See this week's leaderboard →
          </a>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="section-pad reveal" style={{ background:"linear-gradient(135deg,#1a3d2e 0%,#2d6a4f 50%,#1a4a35 100%)", padding:"96px 48px", textAlign:"center" as const, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-60, left:"10%", width:300, height:300, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }} />
        <div style={{ position:"absolute", bottom:-80, right:"15%", width:400, height:400, borderRadius:"50%", background:"rgba(255,255,255,0.03)" }} />
        <div style={{ position:"relative" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:999, padding:"6px 18px", marginBottom:24, fontSize:13, color:"rgba(255,255,255,0.8)", fontWeight:600 }}>
            🚀 Limited early access — join now
          </div>
          <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:48, fontWeight:900, color:"#fff", marginBottom:16, letterSpacing:"-0.02em", lineHeight:1.1 }}>
            Ready to start your<br /><em style={{ fontStyle:"italic", color:"#b7e4c7" }}>skill journey?</em>
          </h2>
          <p style={{ fontSize:17, color:"rgba(255,255,255,0.65)", maxWidth:500, margin:"0 auto 40px" }}>
            Join the first Filipinos building the SkillCredit community. It's free, it's fair, and it starts today.
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" as const, marginBottom:16 }}>
            <a href="/signup" className="cta-btn" style={{ background:"#fff", color:"#2d6a4f", padding:"18px 40px", borderRadius:14, fontWeight:900, fontSize:17, display:"inline-flex", alignItems:"center", gap:8 }}>
              🎁 Create free account — get 20 credits
            </a>
          </div>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>No credit card required · 20 free credits on signup · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:"#111", padding:"32px 48px" }}>
        <div className="footer-inner">
          <div style={{ display:"flex", alignItems:"center" }}>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:900, color:"#fff" }}>Credit</span>
          </div>
          <div style={{ textAlign:"center" as const }}>
            <p style={{ fontSize:12, color:"#444", marginBottom:6 }}>Built with ❤️ for Filipino learners and teachers</p>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"linear-gradient(135deg,#1a3d2e,#2d6a4f)", border:"1px solid rgba(45,106,79,0.4)", borderRadius:999, padding:"6px 16px" }}>
              <span style={{ fontSize:12 }}>👨‍💻</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>Developed by</span>
              <span style={{ fontSize:13, color:"#fff", fontWeight:700 }}>France Adolf P. Borja</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:16 }}>
            {["Privacy","Terms","Contact"].map(l => (
              <a key={l} href="#" style={{ fontSize:13, color:"#555", fontWeight:600, transition:"color .15s" }}
                onMouseOver={e => (e.currentTarget.style.color="#fff")}
                onMouseOut={e  => (e.currentTarget.style.color="#555")}>{l}</a>
            ))}
          </div>
        </div>
        <div style={{ borderTop:"1px solid #222", marginTop:24, paddingTop:20, textAlign:"center" as const }}>
          <p style={{ fontSize:11, color:"#333" }}>© 2025 SkillCredit · All rights reserved · Thesis Project</p>
        </div>
      </footer>
    </div>
  );
}