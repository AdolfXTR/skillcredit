"use client";
import { useEffect, useState } from "react";
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

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Programming: { bg: "#dbeafe", color: "#1d4ed8" },
  Design:      { bg: "#fce7f3", color: "#be185d" },
  Language:    { bg: "#dcfce7", color: "#166534" },
  Academic:    { bg: "#fef3c7", color: "#b45309" },
  Music:       { bg: "#ede9fe", color: "#7c3aed" },
  Arts:        { bg: "#fee2e2", color: "#991b1b" },
  Media:       { bg: "#e0f2fe", color: "#0369a1" },
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

export default function CommunityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"feed" | "forum" | "groups">("feed");
  const [filterSkill, setFilterSkill] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "answered">("all");
  const [search, setSearch] = useState("");

  // Post modal
  const [showPostModal, setShowPostModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", body: "", skill_id: "" });
  const [posting, setPosting] = useState(false);

  // Thread view
  const [openPost, setOpenPost] = useState<ForumPost | null>(null);
  const [answers, setAnswers] = useState<ForumAnswer[]>([]);
  const [newAnswer, setNewAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

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

    // Get answer counts
    const withCounts = await Promise.all((data || []).map(async post => {
      const { count } = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("post_id", post.id);
      return { ...post, answer_count: count || 0 };
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
    const { data: post } = await supabase.from("forum_posts").insert({
      author_id: profile.id,
      skill_id: newPost.skill_id || null,
      title: newPost.title.trim(),
      body: newPost.body.trim(),
      status: "open",
    }).select().single();

    if (post) {
      setShowPostModal(false);
      setNewPost({ title: "", body: "", skill_id: "" });
      await loadPosts();
      // Open the new post immediately
      setOpenPost(post);
      setAnswers([]);
      setTab("forum");
    }
    setPosting(false);
  }

  async function handleSubmitAnswer() {
    if (!profile || !openPost || newAnswer.trim().length < 20) return;
    setAnswering(true);

    await supabase.from("forum_answers").insert({
      post_id: openPost.id,
      author_id: profile.id,
      content: newAnswer.trim(),
    });

    // Notify post author
    if (openPost.author_id !== profile.id) {
      await supabase.from("notifications").insert({
        user_id: openPost.author_id,
        type: "platform",
        title: "New answer on your question 💬",
        body: `${profile.full_name} answered your question: "${openPost.title}"`,
        link: `/community`,
      });
    }

    setNewAnswer("");
    await loadAnswers(openPost.id);
    setAnswering(false);
  }

  async function handleAcceptAnswer(answer: ForumAnswer) {
    if (!openPost || !profile || openPost.author_id !== profile.id) return;

    // Mark accepted
    await supabase.from("forum_answers").update({ is_accepted: true }).eq("id", answer.id);
    await supabase.from("forum_posts").update({ is_answered: true, accepted_answer_id: answer.id, status: "answered" }).eq("id", openPost.id);

    // Award 2 credits if not already
    if (!answer.credits_awarded) {
      await supabase.from("forum_answers").update({ credits_awarded: true }).eq("id", answer.id);
      const { data: answererProf } = await supabase.from("profiles").select("credits").eq("id", answer.author_id).single();
      await supabase.from("profiles").update({ credits: (answererProf?.credits || 0) + 2 }).eq("id", answer.author_id);
      await supabase.from("credit_transactions").insert({
        user_id: answer.author_id, amount: 2, type: "forum_earn",
        reference_id: openPost.id, description: "Forum answer accepted — 2 credits earned",
      });
      await supabase.from("notifications").insert({
        user_id: answer.author_id, type: "achievement",
        title: "Your answer was accepted! 🎉",
        body: `You earned 2 credits for your answer on "${openPost.title}"`,
        link: `/community`,
      });
    }

    // XP for answerer
    await supabase.rpc("increment_xp", { user_id: answer.author_id, amount: 15 });

    await loadAnswers(openPost.id);
    await loadPosts();
    setOpenPost(prev => prev ? { ...prev, is_answered: true } : null);
  }

  async function handleUpvotePost(post: ForumPost) {
    if (!profile) return;
    await supabase.from("forum_posts").update({ upvotes: post.upvotes + 1 }).eq("id", post.id);
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

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Skill[]>);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
          <div style={{ color: "#666", fontSize: 15 }}>Loading community…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .card { transition: box-shadow 0.18s, transform 0.18s; cursor: pointer; }
        .card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }
        .btn { transition: all 0.15s; cursor: pointer; border: none; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .answer-card { transition: box-shadow 0.15s; }
        .answer-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 14px", borderRadius: 8, color: href === "/community" ? "#2d6a4f" : "#555", fontSize: 13, fontWeight: href === "/community" ? 700 : 600, textDecoration: "none", background: href === "/community" ? "#e8f4e8" : "transparent" }}>
              {label}
            </a>
          ))}
        </div>
        {profile ? (
          <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
              {getInitials(profile.full_name)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile.username}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile.credits} cr</span>
          </a>
        ) : (
          <a href="/login" style={{ padding: "7px 18px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Sign in</a>
        )}
      </nav>

      {/* Thread detail view */}
      {openPost ? (
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px" }}>
          {/* Back */}
          <button onClick={() => setOpenPost(null)} className="btn" style={{ background: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 14, padding: "6px 0", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
            ← Back to Community
          </button>

          {/* Question card */}
          <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "28px 32px", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: LEVEL_COLORS[openPost.author?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                {getInitials(openPost.author?.full_name || "?")}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{openPost.author?.full_name}</span>
                  <span style={{ fontSize: 12, color: "#aaa" }}>@{openPost.author?.username}</span>
                  <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>{timeAgo(openPost.created_at)}</span>
                </div>
                {openPost.skill && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: CATEGORY_COLORS[openPost.skill.category]?.bg || "#f0ece4", color: CATEGORY_COLORS[openPost.skill.category]?.color || "#555" }}>
                    {openPost.skill.name}
                  </span>
                )}
              </div>
              {openPost.is_answered && (
                <div style={{ padding: "4px 12px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 }}>✓ Answered</div>
              )}
            </div>

            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 12px" }}>
              {openPost.title}
            </h2>
            <p style={{ color: "#444", fontSize: 15, lineHeight: 1.7, margin: "0 0 20px", whiteSpace: "pre-wrap" }}>{openPost.body}</p>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={() => handleUpvotePost(openPost)} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 20, background: "#f5f0e8", color: "#555", fontSize: 13, fontWeight: 700 }}>
                👍 {openPost.upvotes}
              </button>
              <span style={{ fontSize: 13, color: "#aaa" }}>💬 {answers.length} {answers.length === 1 ? "answer" : "answers"}</span>
            </div>
          </div>

          {/* Answers */}
          {loadingAnswers ? (
            <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Loading answers…</div>
          ) : answers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤔</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#888" }}>No answers yet — be the first to help!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              {answers.map(answer => (
                <div key={answer.id} className="answer-card" style={{ background: answer.is_accepted ? "#f0fdf4" : "#fff", borderRadius: 16, border: `1.5px solid ${answer.is_accepted ? "#86efac" : "#e8e2d9"}`, padding: "22px 26px" }}>
                  {answer.is_accepted && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color: "#166534", fontSize: 13, fontWeight: 700 }}>
                      <span>✅ Accepted Answer</span>
                      {answer.credits_awarded && <span style={{ fontSize: 11, background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>+2 cr awarded</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: LEVEL_COLORS[answer.author?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff" }}>
                      {getInitials(answer.author?.full_name || "?")}
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{answer.author?.full_name}</span>
                      <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>@{answer.author?.username}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>{timeAgo(answer.created_at)}</span>
                  </div>
                  <p style={{ color: "#333", fontSize: 15, lineHeight: 1.7, margin: "0 0 14px", whiteSpace: "pre-wrap" }}>{answer.content}</p>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => handleUpvoteAnswer(answer)} className="btn" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, background: "#f5f0e8", color: "#555", fontSize: 12, fontWeight: 700 }}>
                      👍 {answer.upvotes}
                    </button>
                    {profile && openPost.author_id === profile.id && !openPost.is_answered && (
                      <button onClick={() => handleAcceptAnswer(answer)} className="btn" style={{ padding: "5px 14px", borderRadius: 20, background: "#2d6a4f", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        ✓ Accept Answer (+2 cr)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit answer */}
          {profile ? (
            <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "22px 26px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>💬 Your Answer</div>
              <textarea
                value={newAnswer}
                onChange={e => setNewAnswer(e.target.value)}
                placeholder="Write a helpful, detailed answer… (min 20 characters)"
                style={{ width: "100%", minHeight: 120, padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", marginBottom: 10 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: newAnswer.length < 20 ? "#f59e0b" : "#aaa" }}>
                  {newAnswer.length < 20 ? `${20 - newAnswer.length} more characters needed` : "✓ Ready to submit"}
                </span>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={newAnswer.trim().length < 20 || answering}
                  className="btn"
                  style={{ padding: "10px 24px", borderRadius: 10, background: newAnswer.trim().length < 20 ? "#e8e2d9" : "#2d6a4f", color: newAnswer.trim().length < 20 ? "#aaa" : "#fff", fontSize: 14, fontWeight: 700 }}
                >
                  {answering ? "Posting…" : "Post Answer →"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9" }}>
              <a href="/login" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>Sign in to answer →</a>
            </div>
          )}
        </div>
      ) : (
        /* ─── MAIN COMMUNITY VIEW ─── */
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>Community</h1>
              <p style={{ color: "#666", marginTop: 6, fontSize: 15 }}>Ask questions, share knowledge, earn credits for helping others.</p>
            </div>
            {profile && (
              <button
                onClick={() => setShowPostModal(true)}
                className="btn"
                style={{ padding: "11px 22px", borderRadius: 12, background: "#2d6a4f", color: "#fff", fontSize: 14, fontWeight: 700 }}
              >
                + Ask a Question
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "#f0ece4", padding: 4, borderRadius: 12, width: "fit-content" }}>
            {(["feed", "forum", "groups"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="btn"
                style={{ padding: "8px 20px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1a1a1a" : "#888", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.10)" : "none" }}>
                {t === "feed" ? "🏠 Feed" : t === "forum" ? "💬 Forum Q&A" : "👥 Skill Groups"}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>

            {/* Main content */}
            <div>

              {/* FEED TAB */}
              {tab === "feed" && (
                <div>
                  {/* Stats banner */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Questions", value: posts.length, icon: "❓", color: "#1d4ed8", bg: "#dbeafe" },
                      { label: "Answered", value: posts.filter(p => p.is_answered).length, icon: "✅", color: "#166534", bg: "#dcfce7" },
                      { label: "Unanswered", value: posts.filter(p => !p.is_answered).length, icon: "⏳", color: "#b45309", bg: "#fef3c7" },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 18px", border: "1.5px solid #e8e2d9" }}>
                        <span style={{ fontSize: 18 }}>{s.icon}</span>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Fraunces', serif" }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recent posts preview */}
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>Recent Activity</div>
                  {posts.slice(0, 5).map(post => (
                    <div key={post.id} className="card" onClick={async () => { setOpenPost(post); setTab("forum"); await loadAnswers(post.id); }} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "18px 22px", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: LEVEL_COLORS[post.author?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
                          {getInitials(post.author?.full_name || "?")}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>{post.author?.full_name}</span>
                        {post.skill && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: CATEGORY_COLORS[post.skill.category]?.bg || "#f0ece4", color: CATEGORY_COLORS[post.skill.category]?.color || "#555" }}>
                            {post.skill.name}
                          </span>
                        )}
                        {post.is_answered && <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>✓ Answered</span>}
                        <span style={{ fontSize: 11, color: "#aaa", marginLeft: post.is_answered ? 0 : "auto" }}>{timeAgo(post.created_at)}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>{post.title}</div>
                      <div style={{ fontSize: 13, color: "#777", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.body}</div>
                      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 12, color: "#aaa" }}>
                        <span>👍 {post.upvotes}</span>
                        <span>💬 {post.answer_count} answers</span>
                      </div>
                    </div>
                  ))}
                  {posts.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9" }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
                      <div style={{ fontWeight: 700, color: "#888", fontSize: 15 }}>No posts yet — be the first to ask!</div>
                    </div>
                  )}
                </div>
              )}

              {/* FORUM TAB */}
              {tab === "forum" && (
                <div>
                  {/* Filters */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search questions…"
                      style={{ flex: 1, minWidth: 180, padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#fff" }}
                    />
                    <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
                      style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#333" }}>
                      <option value="all">All Skills</option>
                      {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                      style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#333" }}>
                      <option value="all">All Status</option>
                      <option value="open">Open</option>
                      <option value="answered">Answered</option>
                    </select>
                  </div>

                  {/* Post list */}
                  {filteredPosts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9" }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                      <div style={{ fontWeight: 700, color: "#888", fontSize: 15 }}>No questions found</div>
                      {profile && <button onClick={() => setShowPostModal(true)} className="btn" style={{ marginTop: 14, padding: "9px 20px", borderRadius: 10, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700 }}>Ask the First Question →</button>}
                    </div>
                  ) : (
                    filteredPosts.map(post => (
                      <div key={post.id} className="card" onClick={async () => { setOpenPost(post); await loadAnswers(post.id); }}
                        style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${post.is_answered ? "#86efac" : "#e8e2d9"}`, padding: "18px 22px", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: LEVEL_COLORS[post.author?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>
                            {getInitials(post.author?.full_name || "?")}
                          </div>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{post.author?.full_name}</span>
                            <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>@{post.author?.username}</span>
                          </div>
                          {post.skill && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, background: CATEGORY_COLORS[post.skill.category]?.bg || "#f0ece4", color: CATEGORY_COLORS[post.skill.category]?.color || "#555" }}>
                              {post.skill.name}
                            </span>
                          )}
                          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                            {post.is_answered
                              ? <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>✓ Answered</span>
                              : <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>Open</span>}
                            <span style={{ fontSize: 11, color: "#bbb" }}>{timeAgo(post.created_at)}</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 5 }}>{post.title}</div>
                        <div style={{ fontSize: 13, color: "#777", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 10 }}>{post.body}</div>
                        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#aaa" }}>
                          <span>👍 {post.upvotes}</span>
                          <span>💬 {post.answer_count} {post.answer_count === 1 ? "answer" : "answers"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* GROUPS TAB */}
              {tab === "groups" && (
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 800, marginBottom: 16, color: "#1a1a1a" }}>Skill Groups</div>
                  {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                    <div key={category} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{category}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                        {catSkills.map(skill => {
                          const cfg = CATEGORY_COLORS[category] || { bg: "#f0ece4", color: "#555" };
                          const questionCount = posts.filter(p => p.skill_id === skill.id).length;
                          return (
                            <div key={skill.id} className="card" onClick={() => { setFilterSkill(skill.id); setTab("forum"); }}
                              style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "16px 20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                                    {category}
                                  </span>
                                  <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>{skill.name}</div>
                                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{questionCount} question{questionCount !== 1 ? "s" : ""}</div>
                                </div>
                                <div style={{ fontSize: 22 }}>
                                  {category === "Programming" ? "💻" : category === "Design" ? "🎨" : category === "Language" ? "🌍" : category === "Academic" ? "📚" : category === "Music" ? "🎵" : category === "Arts" ? "🎭" : "🎬"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Earn credits card */}
              <div style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #1a4a36 100%)", borderRadius: 16, padding: "20px 22px", color: "#fff" }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>💡</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Earn Credits</div>
                <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, margin: "0 0 14px" }}>
                  Get your answer accepted and earn <strong>+2 credits</strong> + 15 XP instantly!
                </p>
                {profile && (
                  <button onClick={() => setShowPostModal(true)} className="btn" style={{ width: "100%", padding: "9px", borderRadius: 10, background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}>
                    Browse Open Questions →
                  </button>
                )}
              </div>

              {/* Top contributors */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 14 }}>🏆 Top Contributors</div>
                {posts.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#aaa", textAlign: "center", padding: "10px 0" }}>No activity yet</div>
                ) : (
                  // Count by author
                  Object.entries(
                    posts.reduce((acc, p) => {
                      const name = p.author?.full_name || "?";
                      const username = p.author?.username || "";
                      const level = p.author?.level || "Seedling";
                      acc[name] = { count: (acc[name]?.count || 0) + 1, username, level };
                      return acc;
                    }, {} as Record<string, { count: number; username: string; level: string }>)
                  ).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([name, info], i) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#aaa", width: 18 }}>#{i + 1}</span>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: LEVEL_COLORS[info.level], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
                        {getInitials(name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{name}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>{info.count} post{info.count !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Community rules */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>📋 Community Rules</div>
                {["Be respectful and constructive", "Stay on topic — tag your skill", "No spam or self-promotion", "Credit helpful answers", "Report inappropriate content"].map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", marginTop: 1 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: "#555", lineHeight: 1.5 }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── POST QUESTION MODAL ─── */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 900, margin: 0 }}>Ask a Question</h2>
              <button onClick={() => setShowPostModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#aaa" }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>Skill / Topic</label>
              <select value={newPost.skill_id} onChange={e => setNewPost(p => ({ ...p, skill_id: e.target.value }))}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#fff" }}>
                <option value="">Select a skill (optional)</option>
                {skills.map(s => <option key={s.id} value={s.id}>{s.name} — {s.category}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>Question Title *</label>
              <input
                value={newPost.title}
                onChange={e => setNewPost(p => ({ ...p, title: e.target.value.slice(0, 120) }))}
                placeholder="What do you want to know? Be specific…"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
              />
              <div style={{ fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 3 }}>{newPost.title.length}/120</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>Details *</label>
              <textarea
                value={newPost.body}
                onChange={e => setNewPost(p => ({ ...p, body: e.target.value.slice(0, 1000) }))}
                placeholder="Provide context, what you've already tried, examples…"
                style={{ width: "100%", minHeight: 120, padding: "10px 14px", borderRadius: 10, border: "1.5px solid #e8e2d9", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none" }}
              />
              <div style={{ fontSize: 11, color: "#aaa", textAlign: "right" }}>{newPost.body.length}/1000</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPostModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 12, background: "#f5f0e8", color: "#555", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={handlePostQuestion}
                disabled={!newPost.title.trim() || !newPost.body.trim() || posting}
                className="btn"
                style={{ flex: 2, padding: "11px", borderRadius: 12, background: !newPost.title.trim() || !newPost.body.trim() ? "#e8e2d9" : "#2d6a4f", color: !newPost.title.trim() || !newPost.body.trim() ? "#aaa" : "#fff", fontWeight: 700, fontSize: 14, border: "none" }}
              >
                {posting ? "Posting…" : "Post Question →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}