"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SharedNavbar from "../../components/Navbar";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Profile = { id: string; full_name: string; username: string; credits: number; avatar_url?: string | null };
type Skill = { id: string; name: string; category: string };
type AuthorMeta = { full_name: string; username: string; avatar_url?: string | null };
type ForumPost = {
  id: string; author_id: string; skill_id: string | null; title: string; body: string;
  is_answered: boolean; accepted_answer_id: string | null; created_at: string;
  author?: AuthorMeta; skill?: { name: string; category: string };
  answer_count?: number;
};
type ForumAnswer = {
  id: string; post_id: string; author_id: string; content: string;
  is_accepted: boolean; credits_awarded: boolean; created_at: string;
  author?: AuthorMeta;
};

const CATEGORY_ICONS: Record<string, string> = {
  Programming: "💻", Design: "🎨", Language: "🌍", Academic: "📚",
  Music: "🎵", Arts: "🎭", Media: "🎬", Science: "🔬",
  Business: "💼", Health: "🏥", Sports: "⚽", Cooking: "🍳",
};
const MIN_ANSWER_LENGTH = 20;
const ACCEPT_REWARD = 2;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function initials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function Avatar({ name, avatarUrl, size = 34 }: { name: string; avatarUrl?: string | null; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
      {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}
    </div>
  );
}

function SkillTag({ skill }: { skill: { name: string; category: string } }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#eef6f2", color: "#2d6a4f", border: "1px solid #c6e8d4" }}>
      {CATEGORY_ICONS[skill.category] || "🏷"} {skill.name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// QUESTION LIST CARD
// ─────────────────────────────────────────────────────────────
function QuestionCard({ post, onClick }: { post: ForumPost; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${post.is_answered ? "#86efac66" : "#e8e2d9"}`, padding: "16px 20px", marginBottom: 10, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.03)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
        <Avatar name={post.author?.full_name || "?"} avatarUrl={post.author?.avatar_url} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{post.author?.full_name}</span>
            {post.skill && <SkillTag skill={post.skill} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {post.is_answered
              ? <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 800 }}>✓ Answered</span>
              : <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>Open</span>}
            <span style={{ fontSize: 11, color: "#ccc" }}>{timeAgo(post.created_at)}</span>
          </div>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.4 }}>{post.title}</div>
      <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.body}</div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #f5f0e8", fontSize: 11, color: "#bbb", fontWeight: 600 }}>
        💬 {post.answer_count} {post.answer_count === 1 ? "answer" : "answers"}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUESTION DETAIL
// ─────────────────────────────────────────────────────────────
function QuestionDetail({ post, profile, onBack, onChanged }: {
  post: ForumPost; profile: Profile | null; onBack: () => void; onChanged: () => void;
}) {
  const [answers, setAnswers] = useState<ForumAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [answered, setAnswered] = useState(post.is_answered);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("forum_answers")
      .select(`*, author:profiles!forum_answers_author_id_fkey(full_name,username,avatar_url)`)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setAnswers(data || []);
    setLoading(false);
  }

  async function handleSubmit() {
    if (!profile || draft.trim().length < MIN_ANSWER_LENGTH) return;
    setPosting(true);
    await supabase.from("forum_answers").insert({ post_id: post.id, author_id: profile.id, content: draft.trim() });
    if (post.author_id !== profile.id) {
      await supabase.from("notifications").insert({
        user_id: post.author_id, type: "message",
        title: "New answer on your question", body: `${profile.full_name} answered: "${post.title}"`,
        link: "/community",
      });
    }
    setDraft("");
    await load();
    setPosting(false);
  }

  async function handleAccept(answer: ForumAnswer) {
    if (!profile || post.author_id !== profile.id || answered) return;
    await supabase.from("forum_answers").update({ is_accepted: true, credits_awarded: true }).eq("id", answer.id);
    await supabase.from("forum_posts").update({ is_answered: true, accepted_answer_id: answer.id, status: "answered" }).eq("id", post.id);
    const { data: ap } = await supabase.from("profiles").select("credits").eq("id", answer.author_id).single();
    await supabase.from("profiles").update({ credits: (ap?.credits || 0) + ACCEPT_REWARD }).eq("id", answer.author_id);
    await supabase.from("notifications").insert({
      user_id: answer.author_id, type: "credit",
      title: "Your answer was accepted 🎉", body: `+${ACCEPT_REWARD} credits for helping with "${post.title}"`,
      link: "/community",
    });
    setAnswered(true);
    await load();
    onChanged();
  }

  const canPost = !posting && draft.trim().length >= MIN_ANSWER_LENGTH;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18 }}>← Back to Community</button>

      <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "22px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <Avatar name={post.author?.full_name || "?"} avatarUrl={post.author?.avatar_url} size={34} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{post.author?.full_name}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {post.skill && <SkillTag skill={post.skill} />}
              <span style={{ fontSize: 11, color: "#ccc" }}>{timeAgo(post.created_at)}</span>
            </div>
          </div>
          {answered && <span style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 800 }}>✓ Answered</span>}
        </div>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#111", marginBottom: 10 }}>{post.title}</h2>
        <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.body}</p>
      </div>

      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>
        {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 30, color: "#bbb", fontSize: 13 }}>Loading…</div>
      ) : answers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 20px", background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", marginBottom: 16, color: "#aaa", fontSize: 13 }}>
          No answers yet — be the first to help.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {answers.map(a => (
            <div key={a.id} style={{ background: a.is_accepted ? "#f0fdf4" : "#fff", borderRadius: 14, border: `1.5px solid ${a.is_accepted ? "#86efac" : "#e8e2d9"}`, padding: "16px 18px" }}>
              {a.is_accepted && (
                <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d", marginBottom: 8 }}>
                  ✅ Accepted answer {a.credits_awarded && `· +${ACCEPT_REWARD} credits awarded`}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Avatar name={a.author?.full_name || "?"} avatarUrl={a.author?.avatar_url} size={26} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{a.author?.full_name}</span>
                <span style={{ fontSize: 11, color: "#ccc" }}>{timeAgo(a.created_at)}</span>
              </div>
              <p style={{ color: "#444", fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: profile && post.author_id === profile.id && !answered ? 10 : 0 }}>{a.content}</p>
              {profile && post.author_id === profile.id && !answered && (
                <button onClick={() => handleAccept(a)} style={{ padding: "5px 16px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer" }}>
                  ✓ Accept (+{ACCEPT_REWARD} cr)
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {profile ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", textTransform: "uppercase" as const, marginBottom: 10 }}>Your Answer</div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a helpful answer…"
            style={{ width: "100%", minHeight: 100, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, resize: "vertical", lineHeight: 1.6, fontFamily: "'DM Sans',sans-serif" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: draft.trim().length < MIN_ANSWER_LENGTH ? "#f59e0b" : "#2d6a4f", fontWeight: 700 }}>
              {draft.trim().length < MIN_ANSWER_LENGTH ? `${MIN_ANSWER_LENGTH - draft.trim().length} more characters` : "Ready to post"}
            </span>
            <button onClick={handleSubmit} disabled={!canPost}
              style={{ padding: "9px 22px", borderRadius: 999, background: canPost ? "#2d6a4f" : "#e8e2d9", color: canPost ? "#fff" : "#aaa", fontSize: 13, fontWeight: 800, border: "none", cursor: canPost ? "pointer" : "not-allowed" }}>
              {posting ? "Posting…" : "Post Answer"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 20, background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9" }}>
          <a href="/login" style={{ color: "#2d6a4f", fontWeight: 700, fontSize: 13 }}>Sign in to answer →</a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSkill, setFilterSkill] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "answered">("all");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", body: "", skill_id: "" });
  const [posting, setPosting] = useState(false);
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("id,full_name,username,credits,avatar_url").eq("id", user.id).single();
      setProfile(prof);
    }
    const { data: skillList } = await supabase.from("skills").select("*").order("category");
    setSkills(skillList || []);
    await loadPosts();
    setLoading(false);
  }

  async function loadPosts() {
    const { data } = await supabase.from("forum_posts")
      .select(`*, author:profiles!forum_posts_author_id_fkey(full_name,username,avatar_url), skill:skills(name,category)`)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    const withCounts = await Promise.all((data || []).map(async (p: ForumPost) => {
      const { count } = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("post_id", p.id);
      return { ...p, answer_count: count || 0 };
    }));
    setPosts(withCounts);
  }

  async function handlePost() {
    if (!profile || !newPost.title.trim() || !newPost.body.trim()) return;
    setPosting(true);
    const { data: created, error } = await supabase.from("forum_posts").insert({
      author_id: profile.id, skill_id: newPost.skill_id || null,
      title: newPost.title.trim(), body: newPost.body.trim(), status: "open",
    }).select().single();
    setPosting(false);
    if (error) { alert("Error: " + error.message); return; }
    setShowModal(false);
    setNewPost({ title: "", body: "", skill_id: "" });
    await loadPosts();
    if (created) setOpenPost(created as ForumPost);
  }

  const filtered = posts.filter(p => {
    const matchSkill = filterSkill === "all" || p.skill_id === filterSkill;
    const matchStatus = filterStatus === "all" || (filterStatus === "answered" ? p.is_answered : !p.is_answered);
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return matchSkill && matchStatus && matchSearch;
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <p style={{ color: "#999", fontSize: 13 }}>Loading community…</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box} a{text-decoration:none}
      `}</style>
      <SharedNavbar />

      {openPost ? (
        <QuestionDetail post={openPost} profile={profile} onBack={() => { setOpenPost(null); loadPosts(); }} onChanged={loadPosts} />
      ) : (
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 900, color: "#111" }}>Community Q&amp;A</h1>
              <p style={{ color: "#888", marginTop: 4, fontSize: 13 }}>Ask a question about a skill, get help, accept the best answer.</p>
            </div>
            {profile && (
              <button onClick={() => setShowModal(true)} style={{ padding: "10px 20px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 800, border: "none", cursor: "pointer" }}>
                + Ask a Question
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…"
              style={{ flex: 1, minWidth: 180, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13, background: "#fff" }} />
            <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 12, background: "#fff" }}>
              <option value="all">All Skills</option>
              {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 12, background: "#fff" }}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9" }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>No questions found</div>
              {profile && <button onClick={() => setShowModal(true)} style={{ marginTop: 8, padding: "9px 20px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Ask the First Question →</button>}
            </div>
          ) : (
            filtered.map(p => <QuestionCard key={p.id} post={p} onClick={() => setOpenPost(p)} />)
          )}
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900 }}>Ask a Question</h2>
              <button onClick={() => setShowModal(false)} style={{ width: 30, height: 30, borderRadius: "50%", background: "#f5f0e8", border: "none", fontSize: 13, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", display: "block", marginBottom: 6 }}>Skill / Topic</label>
              <select value={newPost.skill_id} onChange={e => setNewPost(p => ({ ...p, skill_id: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13 }}>
                <option value="">Select a skill (optional)</option>
                {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", display: "block", marginBottom: 6 }}>Question</label>
              <input value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value.slice(0, 120) }))} placeholder="What do you want to know?"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", display: "block", marginBottom: 6 }}>Details</label>
              <textarea value={newPost.body} onChange={e => setNewPost(p => ({ ...p, body: e.target.value.slice(0, 1000) }))} placeholder="Add context…"
                style={{ width: "100%", minHeight: 100, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#f5f0e8", color: "#666", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>Cancel</button>
              <button onClick={handlePost} disabled={!newPost.title.trim() || !newPost.body.trim() || posting}
                style={{ flex: 2, padding: "10px", borderRadius: 10, background: !newPost.title.trim() || !newPost.body.trim() ? "#e8e2d9" : "#2d6a4f", color: !newPost.title.trim() || !newPost.body.trim() ? "#bbb" : "#fff", fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer" }}>
                {posting ? "Posting…" : "Post Question →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
