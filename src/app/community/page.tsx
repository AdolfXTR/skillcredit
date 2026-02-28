"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  xp: number;
  level: string;
};
type ForumPost = {
  id: string;
  author_id: string;
  skill_id: string | null;
  title: string;
  body: string;
  image_url?: string | null;
  is_answered: boolean;
  accepted_answer_id: string | null;
  upvotes: number;
  status: string;
  created_at: string;
  author?: { full_name: string; username: string; level: string };
  skill?: { name: string; category: string };
  answer_count?: number;
};
type ForumAnswer = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  image_url?: string | null;
  upvotes: number;
  is_accepted: boolean;
  credits_awarded: boolean;
  created_at: string;
  author?: { full_name: string; username: string; level: string };
};
type Skill = { id: string; name: string; category: string };

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};
const CATEGORY_COLORS: Record<string, { bg: string; color: string; accent: string }> = {
  Programming: { bg: "#dbeafe", color: "#1d4ed8", accent: "#3b82f6" },
  Design:      { bg: "#fce7f3", color: "#be185d", accent: "#ec4899" },
  Language:    { bg: "#dcfce7", color: "#166534", accent: "#22c55e" },
  Academic:    { bg: "#fef3c7", color: "#b45309", accent: "#f59e0b" },
  Music:       { bg: "#ede9fe", color: "#7c3aed", accent: "#a855f7" },
  Arts:        { bg: "#fee2e2", color: "#991b1b", accent: "#ef4444" },
  Media:       { bg: "#e0f2fe", color: "#0369a1", accent: "#0ea5e9" },
  Science:     { bg: "#d1fae5", color: "#065f46", accent: "#10b981" },
  Business:    { bg: "#fef9c3", color: "#854d0e", accent: "#eab308" },
  Health:      { bg: "#fce7f3", color: "#9d174d", accent: "#f472b6" },
  Sports:      { bg: "#ecfdf5", color: "#047857", accent: "#34d399" },
  Cooking:     { bg: "#fff7ed", color: "#c2410c", accent: "#f97316" },
};
const CATEGORY_ICONS: Record<string, string> = {
  Programming: "💻", Design: "🎨", Language: "🌍", Academic: "📚",
  Music: "🎵", Arts: "🎭", Media: "🎬", Science: "🔬",
  Business: "💼", Health: "🏥", Sports: "⚽", Cooking: "🍳",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function Avatar({ name, level, size = 40 }: { name: string; level?: string; size?: number }) {
  const bg = LEVEL_COLORS[level || "Seedling"] || "#2d6a4f";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.3, fontWeight: 800, color: "#fff", flexShrink: 0,
      boxShadow: `0 0 0 2px white, 0 0 0 3px ${bg}33`,
    }}>
      {getInitials(name)}
    </div>
  );
}

function SkillTag({ skill }: { skill: { name: string; category: string } }) {
  const cfg = CATEGORY_COLORS[skill.category] || { bg: "#f0ece4", color: "#555", accent: "#888" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.accent}33`,
      letterSpacing: "0.02em",
    }}>
      {CATEGORY_ICONS[skill.category]} {skill.name}
    </span>
  );
}

function ImageUploader({ onUploaded, label = "📷 Add Photo" }: { onUploaded: (url: string | null) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true); setDone(false);
    const ext = file.name.split(".").pop();
    const path = `forum/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("forum-images").upload(path, file, { upsert: true });
    if (error) { console.error(error); setUploading(false); return; }
    const { data } = supabase.storage.from("forum-images").getPublicUrl(path);
    onUploaded(data.publicUrl);
    setUploading(false); setDone(true);
  }

  function clear() {
    setPreview(null); setDone(false); onUploaded(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {preview ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 12, border: "2px solid #e8e2d9", display: "block" }} />
          {uploading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, border: "2px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          {done && <div style={{ position: "absolute", bottom: 8, right: 8, background: "#2d6a4f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20 }}>✓ Uploaded</div>}
          <button onClick={clear} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "#1a1a1a", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px",
          borderRadius: 10, background: "#f5f0e8", border: "1.5px dashed #d4cec7",
          color: "#888", fontSize: 13, fontWeight: 600, cursor: "pointer",
          transition: "all 0.15s",
        }}>
          {label}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

export default function CommunityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "forum" | "groups">("forum");
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "answered">("all");
  const [search, setSearch] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", body: "", skill_id: "" });
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [answers, setAnswers] = useState<ForumAnswer[]>([]);
  const [newAnswer, setNewAnswer] = useState("");
  const [answerImageUrl, setAnswerImageUrl] = useState<string | null>(null);
  const [answering, setAnswering] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
    }
    const { data: skillList } = await supabase.from("skills").select("*").order("category");
    setSkills(skillList || []);
    await loadPosts();
    setLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase
      .from("forum_posts")
      .select(`*, author:profiles!forum_posts_author_id_fkey(full_name, username, level), skill:skills(name, category)`)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    const withCounts = await Promise.all((data || []).map(async (p: ForumPost) => {
      const { count } = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("post_id", p.id);
      return { ...p, answer_count: count || 0 };
    }));
    setPosts(withCounts);
  }

  async function loadAnswers(postId: string) {
    setLoadingAnswers(true);
    const { data } = await supabase
      .from("forum_answers")
      .select(`*, author:profiles!forum_answers_author_id_fkey(full_name, username, level)`)
      .eq("post_id", postId)
      .order("is_accepted", { ascending: false })
      .order("upvotes", { ascending: false });
    setAnswers(data || []);
    setLoadingAnswers(false);
  }

  async function handlePostQuestion() {
    if (!profile || !newPost.title.trim() || !newPost.body.trim()) return;
    setPosting(true);
    const { data: createdPost, error } = await supabase.from("forum_posts").insert({
      author_id: profile.id, skill_id: newPost.skill_id || null,
      title: newPost.title.trim(), body: newPost.body.trim(),
      image_url: postImageUrl || null, status: "open",
    }).select().single();
    if (error) { console.error(error); alert("Error: " + error.message); setPosting(false); return; }
    if (createdPost) {
      setShowPostModal(false); setNewPost({ title: "", body: "", skill_id: "" }); setPostImageUrl(null);
      await loadPosts(); setOpenPost(createdPost); setAnswers([]);
    }
    setPosting(false);
  }

  async function handleSubmitAnswer() {
    if (!profile || !openPost || newAnswer.trim().length < 20) return;
    setAnswering(true);
    await supabase.from("forum_answers").insert({ post_id: openPost.id, author_id: profile.id, content: newAnswer.trim(), image_url: answerImageUrl || null });
    if (openPost.author_id !== profile.id) {
      await supabase.from("notifications").insert({ user_id: openPost.author_id, type: "platform", title: "New answer on your question 💬", body: `${profile.full_name} answered: "${openPost.title}"`, link: `/community` });
    }
    setNewAnswer(""); setAnswerImageUrl(null);
    await loadAnswers(openPost.id);
    setAnswering(false);
  }

  async function handleAcceptAnswer(answer: ForumAnswer) {
    if (!openPost || !profile || openPost.author_id !== profile.id) return;
    await supabase.from("forum_answers").update({ is_accepted: true }).eq("id", answer.id);
    await supabase.from("forum_posts").update({ is_answered: true, accepted_answer_id: answer.id, status: "answered" }).eq("id", openPost.id);
    if (!answer.credits_awarded) {
      await supabase.from("forum_answers").update({ credits_awarded: true }).eq("id", answer.id);
      const { data: ap } = await supabase.from("profiles").select("credits").eq("id", answer.author_id).single();
      await supabase.from("profiles").update({ credits: (ap?.credits || 0) + 2 }).eq("id", answer.author_id);
      await supabase.from("credit_transactions").insert({ user_id: answer.author_id, amount: 2, type: "forum_earn", reference_id: openPost.id, description: "Forum answer accepted — 2 credits earned" });
      await supabase.from("notifications").insert({ user_id: answer.author_id, type: "achievement", title: "Your answer was accepted! 🎉", body: `You earned 2 credits for your answer on "${openPost.title}"`, link: `/community` });
    }
    await supabase.rpc("increment_xp", { user_id: answer.author_id, amount: 15 });
    await loadAnswers(openPost.id); await loadPosts();
    setOpenPost(prev => prev ? { ...prev, is_answered: true } : null);
  }

  async function handleUpvotePost(fp: ForumPost) {
    if (!profile) return;
    await supabase.from("forum_posts").update({ upvotes: fp.upvotes + 1 }).eq("id", fp.id);
    await loadPosts();
  }

  async function handleUpvoteAnswer(answer: ForumAnswer) {
    if (!profile) return;
    await supabase.from("forum_answers").update({ upvotes: answer.upvotes + 1 }).eq("id", answer.id);
    await loadAnswers(openPost!.id);
  }

  const filteredPosts = posts.filter(p => {
    const matchSkill = filterSkill === "all" || p.skill_id === filterSkill;
    const matchStatus = filterStatus === "all" || (filterStatus === "answered" ? p.is_answered : !p.is_answered);
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase());
    return matchSkill && matchStatus && matchSearch;
  });

  const skillsByCategory = skills.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Skill[]>);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#999", fontSize: 14, fontWeight: 500 }}>Loading community…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,700&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .post-card { transition: box-shadow 0.2s, transform 0.2s; cursor: pointer; }
        .post-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .btn-hover { transition: all 0.15s; cursor: pointer; }
        .btn-hover:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn-hover:active { transform: translateY(0); }
        .img-zoom { cursor: zoom-in; transition: opacity 0.15s, transform 0.2s; }
        .img-zoom:hover { opacity: 0.92; transform: scale(1.01); }
        .nav-link { padding: 7px 14px; border-radius: 8px; color: #666; font-size: 13px; font-weight: 600; transition: all 0.12s; display: inline-block; }
        .nav-link:hover { background: #eee9e0; color: #1a1a1a; }
        .nav-link.active { background: #e6f2ec; color: #2d6a4f; font-weight: 700; }
        .tab-pill { padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .filter-select { padding: 9px 14px; border-radius: 10px; border: 1.5px solid #e2ddd6; font-size: 13px; font-family: 'DM Sans', sans-serif; background: #fff; color: #333; outline: none; appearance: none; cursor: pointer; }
        .filter-select:focus { border-color: #2d6a4f; }
        textarea:focus, input:focus { outline: none; border-color: #2d6a4f !important; }
      `}</style>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24, animation: "fadeIn 0.2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }} />
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* NAVBAR */}
      <nav style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8e2d9", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([l, h]) => (
            <a key={l} href={h} className={`nav-link ${h === "/community" ? "active" : ""}`}>{l}</a>
          ))}
        </div>
        {profile ? (
          <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 14px 5px 6px", borderRadius: 999, background: "#f5f0e8", border: "1.5px solid #e8e2d9" }}>
            <Avatar name={profile.full_name} level={profile.level} size={28} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile.username}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f" }}>{profile.credits} cr</span>
          </a>
        ) : (
          <a href="/login" style={{ padding: "8px 20px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700 }}>Sign in</a>
        )}
      </nav>

      {/* ── THREAD VIEW ── */}
      {openPost ? (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px", animation: "fadeUp 0.3s ease" }}>
          <button onClick={() => setOpenPost(null)} className="btn-hover" style={{ background: "none", border: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 14, padding: "6px 0", marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back to Community
          </button>

          {/* Question */}
          <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9", padding: "28px 30px", marginBottom: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
              <Avatar name={openPost.author?.full_name || "?"} level={openPost.author?.level} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>{openPost.author?.full_name}</span>
                  <span style={{ fontSize: 12, color: "#bbb" }}>@{openPost.author?.username}</span>
                  {openPost.skill && <SkillTag skill={openPost.skill} />}
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#bbb" }}>{timeAgo(openPost.created_at)}</span>
                  {openPost.is_answered && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", letterSpacing: "0.02em" }}>✓ SOLVED</span>
                  )}
                </div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 800, color: "#111", lineHeight: 1.3, marginBottom: 12 }}>{openPost.title}</h2>
                <p style={{ color: "#555", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: openPost.image_url ? 16 : 0 }}>{openPost.body}</p>
                {openPost.image_url && (
                  <div style={{ marginBottom: 16 }}>
                    <img src={openPost.image_url} alt="attachment" className="img-zoom"
                      onClick={() => setLightbox(openPost.image_url!)}
                      style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 12, border: "1.5px solid #e8e2d9", display: "block" }} />
                    <span style={{ fontSize: 11, color: "#ccc", marginTop: 5, display: "block" }}>Click to enlarge</span>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 14, borderTop: "1px solid #f0ece4" }}>
                  <button onClick={() => handleUpvotePost(openPost)} className="btn-hover" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: "#f5f0e8", border: "1.5px solid #e8e2d9", color: "#555", fontSize: 13, fontWeight: 700 }}>
                    ▲ {openPost.upvotes}
                  </button>
                  <span style={{ fontSize: 13, color: "#bbb", fontWeight: 500 }}>{answers.length} {answers.length === 1 ? "answer" : "answers"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Answers */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, paddingLeft: 4 }}>
            {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
          </div>

          {loadingAnswers ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ width: 28, height: 28, border: "2.5px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
            </div>
          ) : answers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🤔</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#888" }}>No answers yet</div>
              <div style={{ fontSize: 13, color: "#bbb", marginTop: 4 }}>Be the first to help out!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {answers.map((answer, idx) => (
                <div key={answer.id} style={{
                  background: answer.is_accepted ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" : "#fff",
                  borderRadius: 16, border: `1.5px solid ${answer.is_accepted ? "#86efac" : "#e8e2d9"}`,
                  padding: "22px 26px",
                  boxShadow: answer.is_accepted ? "0 4px 20px rgba(34,197,94,0.1)" : "0 2px 8px rgba(0,0,0,0.03)",
                  animation: `fadeUp 0.3s ${idx * 0.05}s ease both`,
                }}>
                  {answer.is_accepted && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#15803d", letterSpacing: "0.02em" }}>✅ ACCEPTED ANSWER</span>
                      {answer.credits_awarded && <span style={{ fontSize: 11, background: "#fff", border: "1px solid #86efac", color: "#15803d", padding: "2px 9px", borderRadius: 999, fontWeight: 700 }}>+2 credits awarded</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <Avatar name={answer.author?.full_name || "?"} level={answer.author?.level} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{answer.author?.full_name}</span>
                        <span style={{ fontSize: 12, color: "#bbb" }}>@{answer.author?.username}</span>
                        <span style={{ fontSize: 12, color: "#ccc", marginLeft: "auto" }}>{timeAgo(answer.created_at)}</span>
                      </div>
                      <p style={{ color: "#444", fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: answer.image_url ? 14 : 0 }}>{answer.content}</p>
                      {answer.image_url && (
                        <div style={{ marginBottom: 14 }}>
                          <img src={answer.image_url} alt="attachment" className="img-zoom"
                            onClick={() => setLightbox(answer.image_url!)}
                            style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10, border: "1.5px solid #e8e2d9", display: "block" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 12, borderTop: "1px solid #f0ece4" }}>
                        <button onClick={() => handleUpvoteAnswer(answer)} className="btn-hover" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: "#f5f0e8", border: "1.5px solid #e8e2d9", color: "#555", fontSize: 12, fontWeight: 700 }}>
                          ▲ {answer.upvotes}
                        </button>
                        {profile && openPost.author_id === profile.id && !openPost.is_answered && (
                          <button onClick={() => handleAcceptAnswer(answer)} className="btn-hover" style={{ padding: "6px 16px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 12, fontWeight: 800, border: "none" }}>
                            ✓ Accept (+2 cr)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Write answer */}
          {profile ? (
            <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "24px 28px", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar name={profile.full_name} level={profile.level} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Write your answer</div>
                  <textarea value={newAnswer} onChange={e => setNewAnswer(e.target.value)}
                    placeholder="Share a detailed, helpful answer…"
                    style={{ width: "100%", minHeight: 110, padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, marginBottom: 12, transition: "border-color 0.15s" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <ImageUploader onUploaded={url => setAnswerImageUrl(url)} label="📷 Photo" />
                      <span style={{ fontSize: 12, color: newAnswer.length < 20 ? "#f59e0b" : "#aaa" }}>
                        {newAnswer.length < 20 ? `${20 - newAnswer.length} chars needed` : "✓ Good to go"}
                      </span>
                    </div>
                    <button onClick={handleSubmitAnswer} disabled={newAnswer.trim().length < 20 || answering} className="btn-hover"
                      style={{ padding: "10px 24px", borderRadius: 999, background: newAnswer.trim().length < 20 ? "#e8e2d9" : "#2d6a4f", color: newAnswer.trim().length < 20 ? "#aaa" : "#fff", fontSize: 14, fontWeight: 700, border: "none" }}>
                      {answering ? "Posting…" : "Post Answer →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 28, background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9" }}>
              <a href="/login" style={{ color: "#2d6a4f", fontWeight: 700, fontSize: 15 }}>Sign in to answer →</a>
            </div>
          )}
        </div>
      ) : (

        /* ── MAIN VIEW ── */
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 24px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 900, color: "#111", letterSpacing: "-0.5px", lineHeight: 1.1 }}>Community</h1>
              <p style={{ color: "#888", marginTop: 8, fontSize: 15, fontWeight: 500 }}>Ask questions · Share knowledge · Earn credits</p>
            </div>
            {profile && (
              <button onClick={() => setShowPostModal(true)} className="btn-hover"
                style={{ padding: "12px 24px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(45,106,79,0.3)" }}>
                <span style={{ fontSize: 16 }}>+</span> Ask a Question
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 28, background: "#ede9e1", padding: 4, borderRadius: 999, width: "fit-content" }}>
            {[["feed", "🏠 Feed"], ["forum", "💬 Forum"], ["groups", "🗂 Groups"]].map(([t, l]) => (
              <button key={t} className="tab-pill" onClick={() => setTab(t as any)}
                style={{ background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1a1a1a" : "#888", boxShadow: tab === t ? "0 2px 8px rgba(0,0,0,0.1)" : "none" }}>
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 308px", gap: 28, alignItems: "start" }}>
            {/* MAIN CONTENT */}
            <div>

              {/* FEED */}
              {tab === "feed" && (
                <div style={{ animation: "fadeUp 0.3s ease" }}>
                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Total Questions", val: posts.length, icon: "❓", from: "#dbeafe", to: "#eff6ff", color: "#1d4ed8" },
                      { label: "Answered", val: posts.filter(p => p.is_answered).length, icon: "✅", from: "#dcfce7", to: "#f0fdf4", color: "#15803d" },
                      { label: "Need Help", val: posts.filter(p => !p.is_answered).length, icon: "⏳", from: "#fef3c7", to: "#fffbeb", color: "#b45309" },
                    ].map(s => (
                      <div key={s.label} style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})`, borderRadius: 16, padding: "18px 20px", border: "1.5px solid #e8e2d9" }}>
                        <div style={{ fontSize: 22 }}>{s.icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, fontFamily: "'Fraunces', serif", lineHeight: 1.1, marginTop: 4 }}>{s.val}</div>
                        <div style={{ fontSize: 12, color: "#888", fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Recent Activity</div>
                  {posts.slice(0, 6).map((fp, idx) => (
                    <PostCard key={fp.id} fp={fp} idx={idx} onClick={async () => { setOpenPost(fp); await loadAnswers(fp.id); }} onLightbox={setLightbox} />
                  ))}
                  {posts.length === 0 && <EmptyState message="No posts yet — be the first to ask!" onAsk={profile ? () => setShowPostModal(true) : undefined} />}
                </div>
              )}

              {/* FORUM */}
              {tab === "forum" && (
                <div style={{ animation: "fadeUp 0.3s ease" }}>
                  {/* Filters */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#bbb" }}>🔍</span>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…"
                        style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#fff", transition: "border-color 0.15s" }} />
                    </div>
                    <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)} className="filter-select">
                      <option value="all">All Skills</option>
                      {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="filter-select">
                      <option value="all">All Status</option>
                      <option value="open">Open</option>
                      <option value="answered">Answered</option>
                    </select>
                  </div>

                  {/* Result count */}
                  <div style={{ fontSize: 12, color: "#bbb", fontWeight: 600, marginBottom: 14 }}>
                    {filteredPosts.length} question{filteredPosts.length !== 1 ? "s" : ""}
                    {search && ` for "${search}"`}
                  </div>

                  {filteredPosts.length === 0 ? (
                    <EmptyState message="No questions found" onAsk={profile ? () => setShowPostModal(true) : undefined} />
                  ) : filteredPosts.map((fp, idx) => (
                    <PostCard key={fp.id} fp={fp} idx={idx} onClick={async () => { setOpenPost(fp); await loadAnswers(fp.id); }} onLightbox={setLightbox} />
                  ))}
                </div>
              )}

              {/* GROUPS */}
              {tab === "groups" && (
                <div style={{ animation: "fadeUp 0.3s ease" }}>
                  {Object.entries(skillsByCategory).map(([category, catSkills]) => {
                    const cfg = CATEGORY_COLORS[category] || { bg: "#f0ece4", color: "#555", accent: "#888" };
                    return (
                      <div key={category} style={{ marginBottom: 28 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[category]}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>{category}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                          {catSkills.map(skill => {
                            const qCount = posts.filter(p => p.skill_id === skill.id).length;
                            return (
                              <div key={skill.id} className="post-card" onClick={() => { setFilterSkill(skill.id); setTab("forum"); }}
                                style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a1a", marginBottom: 5 }}>{skill.name}</div>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color }}>
                                    {qCount} question{qCount !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                  {CATEGORY_ICONS[category]}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SIDEBAR */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 74 }}>
              {/* Earn credits CTA */}
              <div style={{ borderRadius: 18, padding: "22px 22px", background: "linear-gradient(145deg, #1a4a36 0%, #2d6a4f 60%, #3a8a63 100%)", color: "#fff", boxShadow: "0 8px 32px rgba(45,106,79,0.25)" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>💰</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Earn Credits</div>
                <p style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.65, marginBottom: 16 }}>Answer questions and get accepted to earn <strong style={{ opacity: 1 }}>+2 credits</strong> and <strong style={{ opacity: 1 }}>+15 XP</strong>.</p>
                <button onClick={() => setTab("forum")} className="btn-hover" style={{ width: "100%", padding: "10px", borderRadius: 12, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" }}>
                  See Open Questions →
                </button>
              </div>

              {/* Top Contributors */}
              <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "20px 22px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 16, display: "flex", alignItems: "center", gap: 7 }}>
                  🏆 <span>Top Contributors</span>
                </div>
                {posts.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#bbb", textAlign: "center", padding: "12px 0" }}>No activity yet</div>
                ) : Object.entries(
                  posts.reduce((acc, p) => {
                    const name = p.author?.full_name || "?";
                    acc[name] = { count: (acc[name]?.count || 0) + 1, username: p.author?.username || "", level: p.author?.level || "Seedling" };
                    return acc;
                  }, {} as Record<string, { count: number; username: string; level: string }>)
                ).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([name, info], i) => (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#ddd", width: 20, textAlign: "center" }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <Avatar name={name} level={info.level} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{name}</div>
                      <div style={{ fontSize: 11, color: "#bbb" }}>{info.count} post{info.count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rules */}
              <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "20px 22px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 14 }}>📋 Guidelines</div>
                {["Be respectful and constructive", "Stay on topic — tag your skill", "No spam or self-promotion", "Credit helpful answers", "Report inappropriate content"].map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: "#e6f2ec", color: "#2d6a4f", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ASK QUESTION MODAL ── */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20, animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: "32px 32px", maxWidth: 560, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", animation: "fadeUp 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#111" }}>Ask a Question</h2>
                <p style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>The community is here to help 🌱</p>
              </div>
              <button onClick={() => setShowPostModal(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f0e8", border: "none", fontSize: 16, cursor: "pointer", color: "#888", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Skill / Topic</label>
              <select value={newPost.skill_id} onChange={e => setNewPost(p => ({ ...p, skill_id: e.target.value }))} className="filter-select" style={{ width: "100%", padding: "11px 14px" }}>
                <option value="">Select a skill (optional)</option>
                {skills.map(s => <option key={s.id} value={s.id}>{CATEGORY_ICONS[s.category]} {s.name} — {s.category}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Question *</label>
              <input value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value.slice(0, 120) }))}
                placeholder="What do you want to know? Be specific…"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.15s" }} />
              <div style={{ fontSize: 11, color: "#ccc", textAlign: "right", marginTop: 4 }}>{newPost.title.length}/120</div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Details *</label>
              <textarea value={newPost.body} onChange={e => setNewPost(p => ({ ...p, body: e.target.value.slice(0, 1000) }))}
                placeholder="Add context, what you've tried, what you need help with…"
                style={{ width: "100%", minHeight: 120, padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, transition: "border-color 0.15s" }} />
              <div style={{ fontSize: 11, color: "#ccc", textAlign: "right" }}>{newPost.body.length}/1000</div>
            </div>

            <div style={{ marginBottom: 26 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Photo <span style={{ fontWeight: 500, color: "#bbb", textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(optional, max 5MB)</span></label>
              <ImageUploader onUploaded={url => setPostImageUrl(url)} label="📷 Attach a photo" />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPostModal(false)} className="btn-hover" style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#f5f0e8", color: "#666", fontWeight: 700, fontSize: 14, border: "none" }}>Cancel</button>
              <button onClick={handlePostQuestion} disabled={!newPost.title.trim() || !newPost.body.trim() || posting} className="btn-hover"
                style={{ flex: 2, padding: "12px", borderRadius: 12, background: !newPost.title.trim() || !newPost.body.trim() ? "#e8e2d9" : "#2d6a4f", color: !newPost.title.trim() || !newPost.body.trim() ? "#bbb" : "#fff", fontWeight: 800, fontSize: 14, border: "none", boxShadow: newPost.title.trim() && newPost.body.trim() ? "0 4px 16px rgba(45,106,79,0.25)" : "none" }}>
                {posting ? "Posting…" : "Post Question →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */
function PostCard({ fp, idx, onClick, onLightbox }: { fp: ForumPost; idx: number; onClick: () => void; onLightbox: (url: string) => void }) {
  return (
    <div className="post-card" onClick={onClick}
      style={{ background: "#fff", borderRadius: 16, border: `1.5px solid ${fp.is_answered ? "#86efac55" : "#e8e2d9"}`, padding: "18px 22px", marginBottom: 10, animation: `fadeUp 0.3s ${idx * 0.04}s ease both`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center", marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: LEVEL_COLORS[fp.author?.level || "Seedling"] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
          {getInitials(fp.author?.full_name || "?")}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{fp.author?.full_name}</span>
          <span style={{ fontSize: 11, color: "#ccc" }}>@{fp.author?.username}</span>
          {fp.skill && <SkillTag skill={fp.skill} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          {fp.is_answered
            ? <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 800 }}>✓ Solved</span>
            : <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>Open</span>}
          <span style={{ fontSize: 11, color: "#ccc" }}>{timeAgo(fp.created_at)}</span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 5, lineHeight: 1.4 }}>{fp.title}</div>
      <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: fp.image_url ? 10 : 0 }}>{fp.body}</div>
      {fp.image_url && (
        <img src={fp.image_url} alt="" style={{ maxHeight: 110, borderRadius: 8, border: "1px solid #e8e2d9", marginTop: 8, display: "block" }} />
      )}
      <div style={{ display: "flex", gap: 14, marginTop: 12, paddingTop: 10, borderTop: "1px solid #f5f0e8", fontSize: 12, color: "#bbb", fontWeight: 600 }}>
        <span>▲ {fp.upvotes}</span>
        <span>💬 {fp.answer_count} {fp.answer_count === 1 ? "answer" : "answers"}</span>
        {fp.image_url && <span>🖼️ Photo</span>}
      </div>
    </div>
  );
}

function EmptyState({ message, onAsk }: { message: string; onAsk?: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "52px 24px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{message}</div>
      {onAsk && <button onClick={onAsk} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Ask the First Question →</button>}
    </div>
  );
}