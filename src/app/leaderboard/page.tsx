"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type LeaderboardUser = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  xp: number;
  level: string;
};

const mockLeaders = [
  { id: "1", full_name: "Carlo Reyes", username: "carloreyes", credits: 340, xp: 2800, level: "Legend" },
  { id: "2", full_name: "Maria Santos", username: "mariasantos", credits: 290, xp: 2100, level: "Master" },
  { id: "3", full_name: "Ana Villanueva", username: "anavillanueva", credits: 245, xp: 1800, level: "Expert" },
  { id: "4", full_name: "Reina Cruz", username: "reinacruz", credits: 198, xp: 1500, level: "Expert" },
  { id: "5", full_name: "Kiko Dela Cruz", username: "kikodelacruz", credits: 175, xp: 1200, level: "Skilled" },
  { id: "6", full_name: "Lisa Mendoza", username: "lisamendoza", credits: 150, xp: 980, level: "Skilled" },
  { id: "7", full_name: "Sam Ramos", username: "samramos", credits: 120, xp: 750, level: "Contributor" },
  { id: "8", full_name: "Bea Aquino", username: "beaaquino", credits: 95, xp: 520, level: "Contributor" },
  { id: "9", full_name: "Juan dela Cruz", username: "juandc", credits: 60, xp: 310, level: "Learner" },
  { id: "10", full_name: "Borja France Adolf P", username: "adolf", credits: 20, xp: 0, level: "Seedling" },
];

const levelColors: Record<string, { color: string; bg: string }> = {
  Legend: { color: "#1a1a1a", bg: "#f5f0e8" },
  Master: { color: "#9d174d", bg: "#fdf0f8" },
  Expert: { color: "#dc2626", bg: "#fef2f2" },
  Skilled: { color: "#b45309", bg: "#fff8e7" },
  Contributor: { color: "#7c3aed", bg: "#f0f4ff" },
  Learner: { color: "#0369a1", bg: "#e0f2fe" },
  Seedling: { color: "#2d6a4f", bg: "#e8f4e8" },
};

const rankMedal = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

const weeklyBonuses = [
  { rank: 1, credits: 20, label: "1st Place" },
  { rank: 2, credits: 10, label: "2nd Place" },
  { rank: 3, credits: 5, label: "3rd Place" },
];

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"xp" | "credits">("xp");
  const [currentUser, setCurrentUser] = useState<LeaderboardUser | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, credits, xp, level")
        .order(tab === "xp" ? "xp" : "credits", { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) {
        setLeaders(mockLeaders);
      } else {
        setLeaders(data);
        if (user) {
          const me = data.find((u: LeaderboardUser) => u.id === user.id);
          if (me) setCurrentUser(me);
        }
      }
      setLoading(false);
    };
    init();
  }, [tab]);

  const sorted = [...leaders].sort((a, b) =>
    tab === "xp" ? b.xp - a.xp : b.credits - a.credits
  );

  const myRank = currentUser ? sorted.findIndex(u => u.id === currentUser.id) + 1 : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Dashboard</a>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse</a>
          <a href="/bounties" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Bounties</a>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 36, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>
            Leaderboard 🏆
          </h1>
          <p style={{ fontSize: 15, color: "#888" }}>Top contributors this week — resets every Monday!</p>
        </div>

        {/* Weekly bonuses */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, justifyContent: "center" }}>
          {weeklyBonuses.map((bonus) => (
            <div key={bonus.rank} style={{ background: "white", borderRadius: 16, padding: "16px 24px", textAlign: "center", border: "1px solid #e8e0d0", flex: 1 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>{rankMedal(bonus.rank)}</p>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#2d6a4f", margin: "0 0 2px" }}>+{bonus.credits} cr</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>Weekly bonus</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 14, padding: 4, marginBottom: 24, border: "1px solid #e8e0d0", width: "fit-content", margin: "0 auto 24px" }}>
          {[
            { key: "xp", label: "⚡ Top XP Earners" },
            { key: "credits", label: "💰 Most Credits" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "xp" | "credits")}
              style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: tab === t.key ? "#2d6a4f" : "transparent", color: tab === t.key ? "white" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Your rank banner */}
        {myRank && currentUser && (
          <div style={{ background: "#e8f4e8", borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1.5px solid #2d6a4f" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>{rankMedal(myRank)}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f", margin: 0 }}>Your rank this week</p>
                <p style={{ fontSize: 12, color: "#666", margin: 0 }}>@{currentUser.username} · {currentUser.level}</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>
                {tab === "xp" ? `${currentUser.xp} XP` : `${currentUser.credits} cr`}
              </p>
            </div>
          </div>
        )}

        {/* Top 3 podium */}
        {!loading && sorted.length >= 3 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-end" }}>
            {/* 2nd place */}
            <div style={{ flex: 1, background: "white", borderRadius: 20, padding: "24px 16px", textAlign: "center", border: "1px solid #e8e0d0" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>🥈</p>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#e8e0d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#555", margin: "0 auto 8px" }}>
                {sorted[1].full_name[0]}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333", margin: "0 0 2px" }}>{sorted[1].full_name.split(" ")[0]}</p>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>@{sorted[1].username}</p>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#555", margin: 0 }}>
                {tab === "xp" ? `${sorted[1].xp} XP` : `${sorted[1].credits} cr`}
              </p>
            </div>

            {/* 1st place */}
            <div style={{ flex: 1, background: "linear-gradient(135deg, #2d6a4f, #1b4332)", borderRadius: 20, padding: "32px 16px", textAlign: "center", color: "white", transform: "scale(1.05)" }}>
              <p style={{ fontSize: 36, margin: "0 0 8px" }}>🥇</p>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "white", margin: "0 auto 8px" }}>
                {sorted[0].full_name[0]}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 2px" }}>{sorted[0].full_name.split(" ")[0]}</p>
              <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 6px" }}>@{sorted[0].username}</p>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, margin: 0 }}>
                {tab === "xp" ? `${sorted[0].xp} XP` : `${sorted[0].credits} cr`}
              </p>
            </div>

            {/* 3rd place */}
            <div style={{ flex: 1, background: "white", borderRadius: 20, padding: "24px 16px", textAlign: "center", border: "1px solid #e8e0d0" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>🥉</p>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#b45309", margin: "0 auto 8px" }}>
                {sorted[2].full_name[0]}
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333", margin: "0 0 2px" }}>{sorted[2].full_name.split(" ")[0]}</p>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 6px" }}>@{sorted[2].username}</p>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#b45309", margin: 0 }}>
                {tab === "xp" ? `${sorted[2].xp} XP` : `${sorted[2].credits} cr`}
              </p>
            </div>
          </div>
        )}

        {/* Full ranking list */}
        <div style={{ background: "white", borderRadius: 20, border: "1px solid #e8e0d0", overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <span style={{ fontSize: 36 }}>🏆</span>
              <p style={{ color: "#888", marginTop: 12 }}>Loading rankings...</p>
            </div>
          ) : (
            sorted.map((user, i) => {
              const lc = levelColors[user.level] || levelColors.Seedling;
              const isMe = currentUser?.id === user.id;
              return (
                <div
                  key={user.id}
                  style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: i < sorted.length - 1 ? "1px solid #f5f0e8" : "none", background: isMe ? "#f0fdf4" : "white", transition: "background 0.2s" }}
                >
                  {/* Rank */}
                  <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 700, color: i < 3 ? undefined : "#aaa" }}>
                      {rankMedal(i + 1)}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: lc.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: lc.color, flexShrink: 0, marginRight: 14 }}>
                    {user.full_name[0]}
                  </div>

                  {/* Name + level */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{user.full_name}</p>
                      {isMe && <span style={{ fontSize: 10, background: "#2d6a4f", color: "white", padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>YOU</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>@{user.username}</p>
                      <span style={{ fontSize: 10, background: lc.bg, color: lc.color, padding: "1px 6px", borderRadius: 999, fontWeight: 700 }}>{user.level}</span>
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#2d6a4f", margin: 0 }}>
                      {tab === "xp" ? user.xp : user.credits}
                    </p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{tab === "xp" ? "XP" : "credits"}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}