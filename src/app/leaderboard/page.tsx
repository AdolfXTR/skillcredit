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
  sessions_count?: number;
  avg_rating?: number;
};

// ── Badge tier logic (mirrors BadgeSystem component) ──────────────────────────
type BadgeTier = { name: string; emoji: string; color: string; bg: string; border: string };

function getBadgeTier(xp: number, sessions: number, avgRating: number): BadgeTier {
  if (xp >= 5000 && sessions >= 100 && avgRating >= 4.8)
    return { name: "Legend",  emoji: "👑", color: "#b45309", bg: "#fef3c7", border: "#fde68a" };
  if (xp >= 1500 && sessions >= 30 && avgRating >= 4.5)
    return { name: "Elite",   emoji: "💎", color: "#7c3aed", bg: "#ede9fe", border: "#ddd6fe" };
  if (xp >= 500 && sessions >= 10 && avgRating >= 4.0)
    return { name: "Pro",     emoji: "🔥", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
  if (xp >= 100 || sessions >= 3)
    return { name: "Rising",  emoji: "⭐", color: "#d97706", bg: "#fef3c7", border: "#fde68a" };
  return   { name: "Seedling",emoji: "🌱", color: "#2d6a4f", bg: "#e8f4e8", border: "#bbf7d0" };
}

// ── Level colors (XP level, separate from badge) ──────────────────────────────
const LEVEL_PALETTE: Record<string, { bg: string; color: string; glow: string }> = {
  Seedling:    { bg: "#2d6a4f", color: "#fff", glow: "rgba(45,106,79,0.3)" },
  Learner:     { bg: "#1d4ed8", color: "#fff", glow: "rgba(29,78,216,0.3)" },
  Contributor: { bg: "#7c3aed", color: "#fff", glow: "rgba(124,58,237,0.3)" },
  Skilled:     { bg: "#b45309", color: "#fff", glow: "rgba(180,83,9,0.3)" },
  Expert:      { bg: "#dc2626", color: "#fff", glow: "rgba(220,38,38,0.3)" },
  Master:      { bg: "#0891b2", color: "#fff", glow: "rgba(8,145,178,0.3)" },
  Legend:      { bg: "#d97706", color: "#fff", glow: "rgba(217,119,6,0.35)" },
};

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

const WEEKLY_REWARDS = [
  { rank: 1, credits: 20, medal: "🥇", label: "Champion" },
  { rank: 2, credits: 10, medal: "🥈", label: "Runner-up" },
  { rank: 3, credits: 5,  medal: "🥉", label: "3rd Place" },
];

export default function LeaderboardPage() {
  const [leaders, setLeaders]       = useState<LeaderboardUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"xp" | "credits">("xp");
  const [currentUser, setCurrentUser] = useState<LeaderboardUser | null>(null);
  const [userStats, setUserStats]   = useState<Record<string, { sessions: number; avgRating: number }>>({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, credits, xp, level")
      .order(tab === "xp" ? "xp" : "credits", { ascending: false })
      .limit(20);

    const allUsers: LeaderboardUser[] = data || [];
    setLeaders(allUsers);

    if (user) {
      const me = allUsers.find(u => u.id === user.id);
      if (me) setCurrentUser(me);
    }

    // ── Load sessions + ratings for each user to compute correct badge ──
    const statsMap: Record<string, { sessions: number; avgRating: number }> = {};
    await Promise.all(allUsers.map(async u => {
      const [sessRes, ratRes] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true })
          .eq("teacher_id", u.id).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", u.id),
      ]);
      const ratings = ratRes.data || [];
      const avg = ratings.length > 0
        ? ratings.reduce((s: number, r: any) => s + r.overall, 0) / ratings.length
        : 0;
      statsMap[u.id] = { sessions: sessRes.count || 0, avgRating: avg };
    }));
    setUserStats(statsMap);
    setLoading(false);
  }

  const sorted = [...leaders].sort((a, b) =>
    tab === "xp" ? b.xp - a.xp : b.credits - a.credits
  );

  const myRank = currentUser ? sorted.findIndex(u => u.id === currentUser.id) + 1 : null;
  const myStats = currentUser ? userStats[currentUser.id] : null;
  const myBadge = currentUser && myStats
    ? getBadgeTier(currentUser.xp, myStats.sessions, myStats.avgRating)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        a { text-decoration: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:none} }
        .row-item { transition: background 0.12s, box-shadow 0.12s; }
        .row-item:hover { background: #f5f0e8 !important; }
        .nav-link { padding: 6px 12px; border-radius: 8px; color: #666; font-size: 13px; font-weight: 600; transition: all 0.12s; }
        .nav-link:hover { background: #f5f0e8; color: #333; }
        .nav-link.active { background: #e8f4e8; color: #2d6a4f; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #e0dbd4; border-radius: 999px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 2 }}>
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"],["People","/people"]].map(([l,h]) => (
            <a key={l} href={h} className="nav-link">{l}</a>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/wallet" style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 10, background: "#e8f4e8", textDecoration: "none" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>💰 {currentUser?.credits ?? "–"} cr</span>
          </a>
          <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: LEVEL_PALETTE[currentUser?.level || "Seedling"]?.bg || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
              {getInitials(currentUser?.full_name || "")}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{currentUser?.username}</span>
          </a>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: "linear-gradient(135deg, #1a2e1a 0%, #2d6a4f 60%, #1e4a38 100%)", padding: "44px 24px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -30, left: "20%", width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />
        <div style={{ position: "absolute", top: 10, right: "15%", fontSize: 90, opacity: 0.05, lineHeight: 1 }}>🏆</div>
        <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div style={{ animation: "fadeUp 0.5s ease" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>SkillCredit Rankings</div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1.0, letterSpacing: "-1.5px", marginBottom: 10 }}>
                Leader<em style={{ color: "#74c69d", fontStyle: "italic" }}>board</em>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.65 }}>Top contributors ranked by XP & credits. Resets every Monday.</p>
            </div>
            {/* Weekly reward pills */}
            <div style={{ display: "flex", gap: 10, animation: "fadeUp 0.5s 0.1s ease both" }}>
              {WEEKLY_REWARDS.map(r => (
                <div key={r.rank} style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 18px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(4px)" }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{r.medal}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>+{r.credits} cr</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* MY RANK BANNER */}
        {myRank && currentUser && myBadge && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "16px 22px", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", border: `2px solid ${myBadge.border}`, boxShadow: "0 2px 16px rgba(0,0,0,0.06)", animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: LEVEL_PALETTE[currentUser.level]?.bg || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", boxShadow: `0 3px 12px ${LEVEL_PALETTE[currentUser.level]?.glow}` }}>
                {getInitials(currentUser.full_name)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a" }}>Your Ranking</span>
                  {/* ✅ FIXED: show badge tier, not XP level */}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: myBadge.bg, color: myBadge.color, border: `1px solid ${myBadge.border}` }}>
                    {myBadge.emoji} {myBadge.name}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>@{currentUser.username} · XP Level: {currentUser.level}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#1a1a1a" }}>#{myRank}</div>
                <div style={{ fontSize: 10, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>Rank</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#2d6a4f" }}>
                  {tab === "xp" ? currentUser.xp : currentUser.credits}
                </div>
                <div style={{ fontSize: 10, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>{tab === "xp" ? "XP" : "Credits"}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB SWITCHER */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 }}>
          {[{ key: "xp", label: "⚡ Top XP Earners" }, { key: "credits", label: "💰 Most Credits" }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ padding: "10px 24px", borderRadius: 12, border: "1.5px solid", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                background: tab === t.key ? "#2d6a4f" : "#fff",
                color: tab === t.key ? "#fff" : "#555",
                borderColor: tab === t.key ? "#2d6a4f" : "#e8e2d9",
                boxShadow: tab === t.key ? "0 4px 16px rgba(45,106,79,0.25)" : "0 1px 4px rgba(0,0,0,0.04)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: 34, height: 34, border: "3px solid #e8e2d9", borderTopColor: "#2d6a4f", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "#aaa", fontSize: 13 }}>Loading rankings…</p>
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM */}
            {sorted.length >= 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.12fr 1fr", gap: 14, marginBottom: 24, alignItems: "end" }}>
                {/* 2nd */}
                {[1, 0, 2].map((idx) => {
                  const user = sorted[idx];
                  const s = userStats[user.id] || { sessions: 0, avgRating: 0 };
                  const badge = getBadgeTier(user.xp, s.sessions, s.avgRating);
                  const lvl = LEVEL_PALETTE[user.level] || LEVEL_PALETTE.Seedling;
                  const medals = ["🥇", "🥈", "🥉"];
                  const rank = idx + 1;
                  const isFirst = idx === 0;
                  const isMe = currentUser?.id === user.id;

                  return (
                    <div key={user.id} style={{ background: isFirst ? `linear-gradient(155deg, ${lvl.bg} 0%, ${lvl.bg}dd 100%)` : "#fff", borderRadius: 20, padding: isFirst ? "28px 18px 24px" : "20px 18px 18px", textAlign: "center", border: isFirst ? `2px solid ${lvl.bg}` : "1.5px solid #e8e2d9", boxShadow: isFirst ? `0 12px 40px ${lvl.glow}` : "0 2px 12px rgba(0,0,0,0.06)", animation: `popIn 0.4s ${idx * 0.08}s ease both`, position: "relative" }}>
                      {/* Medal */}
                      <div style={{ fontSize: isFirst ? 36 : 28, marginBottom: 10, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{medals[idx]}</div>

                      {/* Avatar */}
                      <div style={{ width: isFirst ? 60 : 50, height: isFirst ? 60 : 50, borderRadius: isFirst ? 18 : 14, background: isFirst ? "rgba(255,255,255,0.2)" : lvl.bg, border: isFirst ? "3px solid rgba(255,255,255,0.3)" : "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isFirst ? 20 : 16, fontWeight: 800, color: "#fff", margin: "0 auto 10px", boxShadow: `0 4px 16px ${lvl.glow}`, fontFamily: "'Fraunces', serif" }}>
                        {getInitials(user.full_name)}
                      </div>

                      {/* Name */}
                      <div style={{ fontSize: isFirst ? 15 : 13, fontWeight: 800, color: isFirst ? "#fff" : "#1a1a1a", fontFamily: "'Fraunces', serif", marginBottom: 2 }}>
                        {user.full_name.split(" ")[0]}
                        {isMe && <span style={{ marginLeft: 5, fontSize: 8, background: isFirst ? "rgba(255,255,255,0.25)" : "#2d6a4f", color: "#fff", padding: "1px 5px", borderRadius: 999, fontFamily: "'DM Sans', sans-serif" }}>YOU</span>}
                      </div>
                      <div style={{ fontSize: 11, color: isFirst ? "rgba(255,255,255,0.6)" : "#bbb", marginBottom: 10 }}>@{user.username}</div>

                      {/* ✅ FIXED: Show badge tier */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: isFirst ? "rgba(255,255,255,0.15)" : badge.bg, color: isFirst ? "#fff" : badge.color, fontSize: 10, fontWeight: 700, border: isFirst ? "1px solid rgba(255,255,255,0.2)" : `1px solid ${badge.border}`, marginBottom: 12 }}>
                        {badge.emoji} {badge.name}
                      </div>

                      {/* Score */}
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: isFirst ? 26 : 20, fontWeight: 900, color: isFirst ? "#fff" : "#1a1a1a" }}>
                        {tab === "xp" ? user.xp.toLocaleString() : user.credits}
                      </div>
                      <div style={{ fontSize: 10, color: isFirst ? "rgba(255,255,255,0.5)" : "#ccc", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {tab === "xp" ? "XP" : "Credits"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FULL RANKING LIST */}
            <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ padding: "14px 22px", borderBottom: "1.5px solid #f0ece4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Full Rankings</span>
                <span style={{ fontSize: 11, color: "#bbb", fontWeight: 600 }}>{sorted.length} users</span>
              </div>

              {sorted.map((user, i) => {
                const s = userStats[user.id] || { sessions: 0, avgRating: 0 };
                const badge = getBadgeTier(user.xp, s.sessions, s.avgRating);
                const lvl = LEVEL_PALETTE[user.level] || LEVEL_PALETTE.Seedling;
                const isMe = currentUser?.id === user.id;
                const rankDisplay = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;

                return (
                  <div key={user.id} className="row-item"
                    style={{ display: "flex", alignItems: "center", padding: "14px 22px", borderBottom: i < sorted.length - 1 ? "1px solid #f5f0e8" : "none", background: isMe ? "#f0fdf4" : "#fff", cursor: "pointer" }}
                    onClick={() => { if (user.id !== currentUser?.id) { /* open drawer - optional */ } }}>

                    {/* Rank */}
                    <div style={{ width: 44, textAlign: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: i < 3 ? 20 : 13, fontWeight: 700, color: i < 3 ? undefined : "#ccc", fontFamily: i >= 3 ? "'Fraunces', serif" : undefined }}>
                        {rankDisplay}
                      </span>
                    </div>

                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: lvl.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0, marginRight: 14, boxShadow: `0 2px 10px ${lvl.glow}`, fontFamily: "'Fraunces', serif" }}>
                      {getInitials(user.full_name)}
                    </div>

                    {/* Name + badges */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{user.full_name}</span>
                        {isMe && <span style={{ fontSize: 9, background: "#2d6a4f", color: "#fff", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>YOU</span>}
                        {/* ✅ FIXED: badge tier shown here */}
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                          {badge.emoji} {badge.name}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: "#bbb" }}>@{user.username}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: lvl.bg }}>Lvl: {user.level}</span>
                        {s.sessions > 0 && <span style={{ fontSize: 10, color: "#bbb" }}>📅 {s.sessions} sessions</span>}
                        {s.avgRating > 0 && <span style={{ fontSize: 10, color: "#bbb" }}>⭐ {s.avgRating.toFixed(1)}</span>}
                      </div>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>
                        {(tab === "xp" ? user.xp : user.credits).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: "#bbb", fontWeight: 700, textTransform: "uppercase" }}>
                        {tab === "xp" ? "XP" : "Credits"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}