"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  credit_reward: number;
  first_place_pct: number;
  second_place_pct: number;
  third_place_pct: number;
  status: string;
  deadline: string;
  created_at: string;
  poster_id: string;
  profiles: { full_name: string; username: string; level: string };
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
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function getUrgency(deadline: string) {
  const h = (new Date(deadline).getTime() - Date.now()) / 3600000;
  if (h <= 3) return { dot: "#ef4444", label: "Urgent", bg: "#fef2f2", color: "#dc2626" };
  if (h <= 24) return { dot: "#f59e0b", label: "Due soon", bg: "#fffbeb", color: "#b45309" };
  return { dot: "#22c55e", label: "Open", bg: "#f0fdf4", color: "#15803d" };
}

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
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
    if (error) { console.error(error); setUploading(false); return; }
    const { data } = supabase.storage.from("forum-images").getPublicUrl(path);
    onUploaded(data.publicUrl);
    setUploading(false); setDone(true);
  }

  function clear() { setPreview(null); setDone(false); onUploaded(null); if (inputRef.current) inputRef.current.value = ""; }

  return (
    <div>
      {preview ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 10, border: "1.5px solid #e8e2d9", display: "block" }} />
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid #b45309", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /></div>}
          {done && <div style={{ position: "absolute", bottom: 6, right: 6, background: "#2d6a4f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>✓</div>}
          <button onClick={clear} style={{ position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: "50%", background: "#1a1a1a", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "#fef3c7", border: "1.5px dashed #fbbf24", color: "#92400e", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{label}</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [user, setUser] = useState<{ id: string; credits: number; full_name: string; level: string } | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newBounty, setNewBounty] = useState({ title: "", description: "", credit_reward: 10, deadline_hours: 24 });
  const [bountyImageUrl, setBountyImageUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: prof } = await supabase.from("profiles").select("id, full_name, credits, level").eq("id", authUser.id).single();
        if (prof) setUser(prof);
      }
      const { data } = await supabase
        .from("bounties")
        .select(`*, profiles(full_name, username, level), bounty_answers(id)`)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      setBounties((data as Bounty[]) || []);
      setLoading(false);
    };
    init();
  }, []);

  async function handlePostBounty() {
    if (!user) { window.location.href = "/login"; return; }
    if (!newBounty.title.trim() || !newBounty.description.trim()) { setPostError("Please fill in all fields."); return; }
    if (newBounty.credit_reward < 5) { setPostError("Minimum 5 credits."); return; }
    if (user.credits < newBounty.credit_reward) { setPostError("Not enough credits."); return; }
    setPosting(true); setPostError("");
    const deadline = new Date(Date.now() + newBounty.deadline_hours * 3600000).toISOString();
    const { data: created, error } = await supabase.from("bounties").insert({
      poster_id: user.id, title: newBounty.title.trim(), description: newBounty.description.trim(),
      image_url: bountyImageUrl || null,
      credit_reward: newBounty.credit_reward, deadline, status: "open",
      first_place_pct: 60, second_place_pct: 30, third_place_pct: 10,
    }).select().single();
    if (error) { setPostError("Failed to post. Try again."); setPosting(false); return; }
    await supabase.rpc("deduct_credits", { user_id: user.id, amount: newBounty.credit_reward });
    setShowPostModal(false);
    setNewBounty({ title: "", description: "", credit_reward: 10, deadline_hours: 24 });
    setBountyImageUrl(null);
    if (created) window.location.href = `/bounties/${created.id}`;
  }

  const filtered = bounties.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === "reward_high") return b.credit_reward - a.credit_reward;
    if (sortBy === "urgent") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sortBy === "most_answers") return (b.bounty_answers?.length || 0) - (a.bounty_answers?.length || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .card { transition: box-shadow 0.2s, transform 0.2s; cursor: pointer; }
        .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .btn { transition: all 0.15s; cursor: pointer; border: none; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .nav-link { padding: 7px 14px; border-radius: 8px; color: #666; font-size: 13px; font-weight: 600; transition: all 0.12s; display: inline-block; }
        .nav-link:hover { background: #eee9e0; color: #1a1a1a; }
        .nav-link.active { background: #fff3e6; color: #b45309; font-weight: 700; }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #b45309 !important; }
        .img-zoom { cursor: zoom-in; transition: opacity 0.15s; }
        .img-zoom:hover { opacity: 0.88; }
      `}</style>

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24, animation: "fadeIn 0.2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16 }} />
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
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
            <a key={l} href={h} className={`nav-link ${h === "/bounties" ? "active" : ""}`}>{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => user ? setShowPostModal(true) : window.location.href = "/login"} className="btn"
            style={{ padding: "8px 18px", borderRadius: 999, background: "#b45309", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(180,83,9,0.3)" }}>
            + Post Bounty
          </button>
          {user && (
            <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 6px", borderRadius: 999, background: "#f5f0e8", border: "1.5px solid #e8e2d9" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[user.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>{getInitials(user.full_name)}</div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>{user.credits} cr</span>
            </a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 900, color: "#111", letterSpacing: "-0.5px", lineHeight: 1.1 }}>Bounty Board</h1>
            <p style={{ color: "#888", marginTop: 8, fontSize: 15, fontWeight: 500 }}>Post tasks · Get answers · Award credits to winners</p>
          </div>
          <div style={{ display: "flex", gap: 12, animation: "fadeUp 0.3s 0.05s ease both" }}>
            {[
              { label: "Open Bounties", val: bounties.length, color: "#b45309", bg: "linear-gradient(135deg, #fff8e7, #fef3c7)" },
              { label: "Credits at Stake", val: bounties.reduce((s, b) => s + b.credit_reward, 0), color: "#2d6a4f", bg: "linear-gradient(135deg, #e8f4e8, #dcfce7)" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 22px", textAlign: "center", border: "1.5px solid #e8e2d9" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", animation: "fadeUp 0.3s 0.1s ease both" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#bbb" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bounties…"
              style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#fff", transition: "border-color 0.15s" }} />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: "10px 16px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "#fff", color: "#333", cursor: "pointer" }}>
            <option value="newest">Newest first</option>
            <option value="reward_high">Highest reward</option>
            <option value="urgent">Most urgent</option>
            <option value="most_answers">Most answers</option>
          </select>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #b45309", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ color: "#aaa", fontSize: 14 }}>Loading bounties…</p>
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map((bounty, idx) => {
              const urg = getUrgency(bounty.deadline);
              const tl = getTimeLeft(bounty.deadline);
              const ac = bounty.bounty_answers?.length || 0;
              return (
                <div key={bounty.id} className="card"
                  onClick={() => window.location.href = user ? `/bounties/${bounty.id}` : "/login"}
                  style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "22px 24px", animation: `fadeUp 0.3s ${idx * 0.04}s ease both`, boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: urg.bg, color: urg.color }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: urg.dot, display: "inline-block" }} />{urg.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#bbb", fontWeight: 600 }}>⏱ {tl}</span>
                        <span style={{ fontSize: 12, color: "#bbb", fontWeight: 600 }}>💬 {ac} answer{ac !== 1 ? "s" : ""}</span>
                      </div>
                      <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, color: "#111", lineHeight: 1.35, marginBottom: 8 }}>{bounty.title}</h3>
                      <p style={{ fontSize: 13, color: "#777", lineHeight: 1.6, marginBottom: 12 }}>
                        {bounty.description.length > 140 ? bounty.description.slice(0, 140) + "…" : bounty.description}
                      </p>
                      {bounty.image_url && (
                        <img src={bounty.image_url} alt="" className="img-zoom"
                          onClick={e => { e.stopPropagation(); setLightbox(bounty.image_url!); }}
                          style={{ maxHeight: 90, borderRadius: 8, border: "1px solid #e8e2d9", marginBottom: 12, display: "block" }} />
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: LEVEL_COLORS[bounty.profiles?.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                          {getInitials(bounty.profiles?.full_name || "?")}
                        </div>
                        <span style={{ fontSize: 12, color: "#aaa" }}>
                          <strong style={{ color: "#555", fontWeight: 700 }}>{bounty.profiles?.full_name}</strong> · @{bounty.profiles?.username}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ background: "linear-gradient(135deg, #fffbeb, #fef3c7)", borderRadius: 14, padding: "16px 22px", textAlign: "center", border: "1.5px solid #fde68a" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", letterSpacing: "0.08em", marginBottom: 3 }}>REWARD</div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 900, color: "#b45309", lineHeight: 1 }}>{bounty.credit_reward}</div>
                        <div style={{ fontSize: 11, color: "#d97706", fontWeight: 600 }}>credits</div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {[{ e: "🥇", p: bounty.first_place_pct }, { e: "🥈", p: bounty.second_place_pct }, { e: "🥉", p: bounty.third_place_pct }].map(({ e, p }) => (
                          <div key={e} style={{ background: "#fafafa", border: "1.5px solid #e8e2d9", borderRadius: 8, padding: "6px 8px", textAlign: "center", minWidth: 46 }}>
                            <div style={{ fontSize: 12 }}>{e}</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>{Math.floor(bounty.credit_reward * p / 100)}cr</div>
                          </div>
                        ))}
                      </div>
                      <button onClick={e => { e.stopPropagation(); window.location.href = user ? `/bounties/${bounty.id}` : "/login"; }} className="btn"
                        style={{ width: "100%", padding: "10px 20px", borderRadius: 999, background: "#b45309", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                        {user ? "Answer →" : "Sign in →"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>🎯</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>No bounties yet</div>
                <p style={{ color: "#aaa", fontSize: 14, marginBottom: 20 }}>Be the first to post a task!</p>
                <button onClick={() => user ? setShowPostModal(true) : window.location.href = "/login"} className="btn"
                  style={{ padding: "11px 28px", borderRadius: 999, background: "#b45309", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  Post a Bounty →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POST MODAL */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20, animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: "32px", maxWidth: 560, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", animation: "fadeUp 0.25s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#111" }}>Post a Bounty 🎯</h2>
                <p style={{ fontSize: 13, color: "#aaa", marginTop: 3 }}>Describe your task and set a credit reward</p>
              </div>
              <button onClick={() => setShowPostModal(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "#f5f0e8", border: "none", fontSize: 16, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Task Title *</label>
              <input value={newBounty.title} onChange={e => setNewBounty(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Help me debug my Python code"
                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.15s" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Description *</label>
              <textarea value={newBounty.description} onChange={e => setNewBounty(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe your task in detail. More context = better answers!"
                rows={4} style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", resize: "vertical", lineHeight: 1.6, transition: "border-color 0.15s" }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                Attach Photo <span style={{ fontWeight: 500, color: "#bbb", textTransform: "none", fontSize: 12, letterSpacing: 0 }}>(optional)</span>
              </label>
              <ImageUploader onUploaded={url => setBountyImageUrl(url)} label="📷 Add photo to your bounty" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Credit Reward</label>
                <input type="number" min={5} value={newBounty.credit_reward} onChange={e => setNewBounty(p => ({ ...p, credit_reward: parseInt(e.target.value) || 5 }))}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }} />
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Min 5 · You have {user?.credits || 0} cr</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Deadline</label>
                <select value={newBounty.deadline_hours} onChange={e => setNewBounty(p => ({ ...p, deadline_hours: parseInt(e.target.value) }))}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2ddd6", fontSize: 14, fontFamily: "'DM Sans', sans-serif", background: "#fff", cursor: "pointer" }}>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                </select>
              </div>
            </div>

            <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 14, padding: "14px 16px", marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#b45309", letterSpacing: "0.08em", marginBottom: 10 }}>PRIZE SPLIT</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ e: "🥇 1st", p: 60 }, { e: "🥈 2nd", p: 30 }, { e: "🥉 3rd", p: 10 }].map(({ e, p }) => (
                  <div key={e} style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>{e}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 800, color: "#b45309" }}>{Math.floor(newBounty.credit_reward * p / 100)} cr</div>
                  </div>
                ))}
              </div>
            </div>

            {postError && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{postError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowPostModal(false)} className="btn" style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#f5f0e8", color: "#666", fontWeight: 700, fontSize: 14 }}>Cancel</button>
              <button onClick={handlePostBounty} disabled={posting} className="btn"
                style={{ flex: 2, padding: "12px", borderRadius: 12, background: posting ? "#d4a574" : "#b45309", color: "#fff", fontWeight: 800, fontSize: 14, boxShadow: "0 4px 16px rgba(180,83,9,0.25)" }}>
                {posting ? "Posting…" : `Post Bounty — ${newBounty.credit_reward} cr 🎯`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}