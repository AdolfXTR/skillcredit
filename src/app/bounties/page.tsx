"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string;
  title: string;
  description: string;
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

const mockBounties = [
  { id: "1", title: "Help me solve this calculus integral problem", description: "I'm stuck on this integral: ∫(x² + 3x + 2)dx. Need a step-by-step explanation with the working shown clearly.", credit_reward: 20, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "1", profiles: { full_name: "Juan dela Cruz", username: "juandc", level: "Seedling" }, bounty_answers: [{ id: "1" }, { id: "2" }, { id: "3" }] },
  { id: "2", title: "Debug my Python Flask API — 500 error on POST", description: "My Flask API keeps throwing a 500 error when I POST to /api/users. I'll share the code in chat. Need help asap!", credit_reward: 35, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "2", profiles: { full_name: "Maria Santos", username: "mariasantos", level: "Learner" }, bounty_answers: [{ id: "1" }] },
  { id: "3", title: "Translate this paragraph from Filipino to formal English", description: "Kailangan ko ng tulong sa pagsasalin ng isang talata para sa aking thesis. About 150 words lang.", credit_reward: 10, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "3", profiles: { full_name: "Bea Aquino", username: "beaaquino", level: "Seedling" }, bounty_answers: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }] },
  { id: "4", title: "Review my 5-page business plan and give feedback", description: "I have a business plan for a small food business. Need honest feedback on the financials and marketing section.", credit_reward: 50, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "4", profiles: { full_name: "Carlo Reyes", username: "carloreyes", level: "Contributor" }, bounty_answers: [{ id: "1" }, { id: "2" }] },
  { id: "5", title: "Design a simple logo for my coffee shop", description: "Need a minimalist logo for 'Kape ni Lola' coffee shop. Brown and cream colors. Can be done in Canva.", credit_reward: 25, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "5", profiles: { full_name: "Reina Cruz", username: "reinacruz", level: "Skilled" }, bounty_answers: [] },
  { id: "6", title: "Explain how React useEffect hook works", description: "I keep getting confused by useEffect dependencies. Can someone give me a clear, simple explanation with examples?", credit_reward: 15, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "6", profiles: { full_name: "Sam Ramos", username: "samramos", level: "Learner" }, bounty_answers: [{ id: "1" }, { id: "2" }] },
];

const getTimeLeft = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const getUrgencyColor = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 3) return { bg: "#fef2f2", accent: "#dc2626", label: "🔴 Urgent" };
  if (hours <= 24) return { bg: "#fff8e7", accent: "#b45309", label: "🟡 Due soon" };
  return { bg: "#e8f4e8", accent: "#2d6a4f", label: "🟢 Open" };
};

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [newBounty, setNewBounty] = useState({ title: "", description: "", credit_reward: 10, deadline_hours: 24 });
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data, error } = await supabase
        .from("bounties")
        .select(`*, profiles(full_name, username, level), bounty_answers(id)`)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setBounties(mockBounties as unknown as Bounty[]);
      } else {
        setBounties(data as Bounty[]);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handlePostBounty = async () => {
    if (!user) { window.location.href = "/login"; return; }
    if (!newBounty.title || !newBounty.description) { setPostError("Please fill in all fields."); return; }
    if (newBounty.credit_reward < 5) { setPostError("Minimum bounty is 5 credits."); return; }

    setPosting(true);
    setPostError("");

    const deadline = new Date(Date.now() + newBounty.deadline_hours * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("bounties").insert({
      poster_id: user.id,
      title: newBounty.title,
      description: newBounty.description,
      credit_reward: newBounty.credit_reward,
      deadline,
      status: "open",
      first_place_pct: 60,
      second_place_pct: 30,
      third_place_pct: 10,
    });

    if (error) {
      setPostError("Failed to post bounty. Please try again.");
      setPosting(false);
      return;
    }

    // Deduct credits
await supabase.rpc("deduct_credits", { user_id: user.id, amount: newBounty.credit_reward });
    setShowPostModal(false);
    setNewBounty({ title: "", description: "", credit_reward: 10, deadline_hours: 24 });
    window.location.reload();
  };

  const filtered = bounties.filter((b) =>
    b.title.toLowerCase().includes(search.toLowerCase()) ||
    b.description.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    if (sortBy === "reward_high") return b.credit_reward - a.credit_reward;
    if (sortBy === "urgent") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (sortBy === "most_answers") return (b.bounty_answers?.length || 0) - (a.bounty_answers?.length || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Post Bounty Modal */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "40px", maxWidth: 500, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Post a Bounty Task 🎯</h2>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Describe your task and set a credit reward. The community will answer!</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Help me solve this calculus problem"
                  value={newBounty.title}
                  onChange={(e) => setNewBounty(p => ({ ...p, title: e.target.value }))}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Description</label>
                <textarea
                  placeholder="Describe your task in detail. The more context you give, the better answers you'll get!"
                  value={newBounty.description}
                  onChange={(e) => setNewBounty(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", resize: "vertical" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Credit Reward</label>
                  <input
                    type="number"
                    min={5}
                    value={newBounty.credit_reward}
                    onChange={(e) => setNewBounty(p => ({ ...p, credit_reward: parseInt(e.target.value) || 5 }))}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                  />
                  <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Min: 5 credits</p>
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Deadline</label>
                  <select
                    value={newBounty.deadline_hours}
                    onChange={(e) => setNewBounty(p => ({ ...p, deadline_hours: parseInt(e.target.value) }))}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={48}>48 hours</option>
                    <option value={72}>72 hours</option>
                  </select>
                </div>
              </div>

              {/* Reward split preview */}
              <div style={{ background: "#f5f0e8", borderRadius: 12, padding: "14px" }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>REWARD SPLIT PREVIEW</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { place: "🥇 1st", pct: 60 },
                    { place: "🥈 2nd", pct: 30 },
                    { place: "🥉 3rd", pct: 10 },
                  ].map((p) => (
                    <div key={p.place} style={{ flex: 1, background: "white", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: 12, margin: "0 0 2px" }}>{p.place}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>{Math.floor(newBounty.credit_reward * p.pct / 100)} cr</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {postError && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{postError}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowPostModal(false)}
                style={{ flex: 1, padding: "13px", background: "#f5f0e8", color: "#555", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePostBounty}
                disabled={posting}
                style={{ flex: 2, padding: "13px", background: posting ? "#a8c5b5" : "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: posting ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
              >
                {posting ? "Posting..." : `Post Bounty — ${newBounty.credit_reward} credits 🎯`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse Skills</a>
          <a href="/dashboard" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Dashboard</a>
          <button
            onClick={() => user ? setShowPostModal(true) : window.location.href = "/login"}
            style={{ padding: "8px 16px", borderRadius: 10, background: "#b45309", color: "white", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            + Post Bounty
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>
              Bounty Tasks 🎯
            </h1>
            <p style={{ fontSize: 15, color: "#888" }}>Answer tasks and earn credits. First answer your own then see others!</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Open Bounties", value: bounties.length, color: "#2d6a4f", bg: "#e8f4e8" },
              { label: "Total Credits", value: bounties.reduce((sum, b) => sum + b.credit_reward, 0), color: "#b45309", bg: "#fff8e7" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: stat.bg, borderRadius: 14, padding: "14px 20px", textAlign: "center" }}>
                <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: stat.color, margin: 0 }}>{stat.value}</p>
                <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search + Sort */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
            <input
              type="text"
              placeholder="Search bounties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "white", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 13, color: "#555", background: "white", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", outline: "none" }}
          >
            <option value="newest">Newest first</option>
            <option value="reward_high">Highest reward</option>
            <option value="urgent">Most urgent</option>
            <option value="most_answers">Most answers</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <span style={{ fontSize: 40 }}>🎯</span>
            <p style={{ color: "#888", marginTop: 12 }}>Loading bounties...</p>
          </div>
        )}

        {/* Bounty cards */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.map((bounty) => {
              const urgency = getUrgencyColor(bounty.deadline);
              const timeLeft = getTimeLeft(bounty.deadline);
              const answerCount = bounty.bounty_answers?.length || 0;

              return (
                <div
                  key={bounty.id}
                  style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={() => window.location.href = user ? `/bounties/${bounty.id}` : "/login"}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>

                    {/* Left content */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ background: urgency.bg, color: urgency.accent, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                          {urgency.label}
                        </span>
                        <span style={{ fontSize: 12, color: "#888" }}>⏱ {timeLeft}</span>
                        <span style={{ fontSize: 12, color: "#888" }}>💬 {answerCount} answer{answerCount !== 1 ? "s" : ""}</span>
                      </div>

                      <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3 }}>
                        {bounty.title}
                      </h3>

                      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 14 }}>
                        {bounty.description.length > 150 ? bounty.description.slice(0, 150) + "..." : bounty.description}
                      </p>

                      {/* Posted by */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#2d6a4f" }}>
                          {bounty.profiles?.full_name?.[0] || "?"}
                        </div>
                        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                          Posted by <strong style={{ color: "#333" }}>{bounty.profiles?.full_name}</strong> · @{bounty.profiles?.username}
                        </p>
                      </div>
                    </div>

                    {/* Right — reward */}
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ background: "#fff8e7", borderRadius: 16, padding: "20px 24px", marginBottom: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>TOTAL REWARD</p>
                        <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 800, color: "#b45309", margin: 0 }}>
                          {bounty.credit_reward}
                        </p>
                        <p style={{ fontSize: 12, color: "#888", margin: 0 }}>credits</p>
                      </div>

                      {/* Split preview */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {[
                          { place: "🥇", pct: bounty.first_place_pct },
                          { place: "🥈", pct: bounty.second_place_pct },
                          { place: "🥉", pct: bounty.third_place_pct },
                        ].map((p) => (
                          <div key={p.place} style={{ flex: 1, background: "#f5f0e8", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                            <p style={{ fontSize: 12, margin: "0 0 2px" }}>{p.place}</p>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#b45309", margin: 0 }}>{Math.floor(bounty.credit_reward * p.pct / 100)}cr</p>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); window.location.href = user ? `/bounties/${bounty.id}` : "/login"; }}
                        style={{ marginTop: 12, width: "100%", padding: "10px", background: "#b45309", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {user ? "Answer →" : "Log in to answer →"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <span style={{ fontSize: 48 }}>🎯</span>
                <p style={{ color: "#888", fontSize: 15, marginTop: 12 }}>No bounties found</p>
                <button
                  onClick={() => setShowPostModal(true)}
                  style={{ marginTop: 16, padding: "10px 24px", background: "#b45309", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Post the first bounty!
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}