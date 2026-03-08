"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Profile = {
  id: string; full_name: string; username: string; credits: number; xp: number; level: string;
  avatar_url?: string | null; xp_multiplier?: number; champion_title?: string | null; champion_streak?: number;
};
type WeeklyChamp = {
  rank: number; user_id: string; full_name: string; username: string; avatar_url: string | null;
  champion_title: string | null; champion_streak: number; xp: number; xp_multiplier: number;
  answers_given?: number; answers_accepted?: number; xp_earned?: number; credits_bonus?: number;
  accept_rate?: number;
};
type ForumPost = {
  id: string; author_id: string; skill_id: string | null; title: string; body: string;
  image_url?: string | null; is_answered: boolean; accepted_answer_id: string | null;
  upvotes: number; views?: number; status: string; created_at: string;
  author?: AuthorMeta; skill?: { name: string; category: string };
  answer_count?: number;
};
type ForumAnswer = {
  id: string; post_id: string; author_id: string; content: string; image_url?: string | null;
  upvotes: number; downvotes?: number; is_accepted: boolean; credits_awarded: boolean; created_at: string;
  reactions?: Record<string, number>;
  author?: AuthorMeta;
  author_stats?: { total_answers: number; accepted_answers: number; accept_rate: number };
};
type AuthorMeta = {
  full_name: string; username: string; level: string;
  avatar_url?: string | null; xp_multiplier?: number; champion_title?: string | null; xp?: number;
};
type Skill = { id: string; name: string; category: string };

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};
const LEVEL_XP: Record<string, [number, number]> = {
  Seedling: [0, 100], Learner: [100, 300], Contributor: [300, 700],
  Skilled: [700, 1500], Expert: [1500, 3000], Master: [3000, 6000], Legend: [6000, 10000],
};
const LEVEL_ORDER = ["Seedling","Learner","Contributor","Skilled","Expert","Master","Legend"];
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
const MIN_ANSWER_LENGTH = 30;
const REACTIONS = [
  { key: "helpful", emoji: "👍", label: "Helpful" },
  { key: "clear",   emoji: "🎯", label: "Clear"   },
  { key: "smart",   emoji: "🤯", label: "Smart"   },
];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
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
function getRank(xp_multiplier?: number): 0 | 1 | 2 | 3 {
  if (!xp_multiplier || xp_multiplier < 1.1) return 0;
  if (xp_multiplier >= 1.25) return 1;
  if (xp_multiplier >= 1.15) return 2;
  return 3;
}
function getWeekReset() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntil = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setUTCDate(now.getUTCDate() + daysUntil);
  next.setUTCHours(0, 0, 0, 0);
  const diff = next.getTime() - now.getTime();
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
  };
}
function getXPProgress(xp: number, level: string) {
  const [min, max] = LEVEL_XP[level] || [0, 100];
  const pct = Math.min(100, Math.round(((xp - min) / (max - min)) * 100));
  const nextLevel = LEVEL_ORDER[LEVEL_ORDER.indexOf(level) + 1];
  return { pct, min, max, nextLevel, remaining: max - xp };
}
function detectSpam(text: string): boolean {
  const t = text.trim();
  if (/(.)\1{5,}/.test(t)) return true;
  if (/^[^a-zA-Z0-9]+$/.test(t)) return true;
  const wordRatio = (t.match(/[a-zA-Z]{3,}/g) || []).length / Math.max(t.split(" ").length, 1);
  if (t.length > 10 && wordRatio < 0.15 && !/\d/.test(t)) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────
function useCountdown() {
  const [cd, setCd] = useState(getWeekReset());
  useEffect(() => {
    const t = setInterval(() => setCd(getWeekReset()), 60_000);
    return () => clearInterval(t);
  }, []);
  return cd;
}

// ─────────────────────────────────────────────────────────────
// SPARKLES (champion banner)
// ─────────────────────────────────────────────────────────────
function Sparkles() {
  const sparks = Array.from({ length: 10 }, (_, i) => ({
    id: i, left: 8 + Math.random() * 84, top: 5 + Math.random() * 90,
    size: 3 + Math.random() * 4, delay: Math.random() * 3, dur: 2 + Math.random() * 2,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }}>
      {sparks.map(s => (
        <div key={s.id} style={{ position: "absolute", left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,215,0,.9), transparent)", animation: `sparkFloat ${s.dur}s ${s.delay}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PREMIUM AVATAR
// ─────────────────────────────────────────────────────────────
function PremiumAvatar({ name, level, avatarUrl, size = 40, xp_multiplier }:
  { name: string; level?: string; avatarUrl?: string | null; size?: number; xp_multiplier?: number }) {
  const bg   = LEVEL_COLORS[level || "Seedling"] || "#2d6a4f";
  const rank = getRank(xp_multiplier);
  const anim = rank === 1 ? "goldPulse 2s ease infinite" : rank === 2 ? "silverPulse 2s ease infinite" : rank === 3 ? "bronzePulse 2s ease infinite" : undefined;
  const badge = rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <div style={{ position: "relative", flexShrink: 0, display: "inline-block" }}>
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", background: avatarUrl ? "transparent" : bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.3, fontWeight: 800, color: "#fff", boxShadow: rank === 0 ? `0 0 0 2px white, 0 0 0 3px ${bg}33` : undefined, animation: anim }}>
        {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(name)}
      </div>
      {badge && <span style={{ position: "absolute", bottom: -2, right: -4, fontSize: size * 0.28, lineHeight: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))" }}>{badge}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SKILL TAG
// ─────────────────────────────────────────────────────────────
function SkillTag({ skill }: { skill: { name: string; category: string } }) {
  const cfg = CATEGORY_COLORS[skill.category] || { bg: "#f0ece4", color: "#555", accent: "#888" };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.accent}33` }}>
      {CATEGORY_ICONS[skill.category]} {skill.name}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// IMAGE UPLOADER
// ─────────────────────────────────────────────────────────────
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
    setUploading(true); setDone(false);
    const ext = file.name.split(".").pop();
    const path = `forum/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("forum-images").upload(path, file, { upsert: true });
    if (error) { setUploading(false); return; }
    const { data } = supabase.storage.from("forum-images").getPublicUrl(path);
    onUploaded(data.publicUrl); setUploading(false); setDone(true);
  }
  function clear() { setPreview(null); setDone(false); onUploaded(null); if (inputRef.current) inputRef.current.value = ""; }
  return (
    <div>
      {preview ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 140, borderRadius: 10, border: "2px solid #e8e2d9", display: "block" }} />
          {uploading && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.85)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 18, height: 18, border: "2px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} /></div>}
          {done && <div style={{ position: "absolute", bottom: 6, right: 6, background: "#2d6a4f", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>✓</div>}
          <button onClick={clear} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "#1a1a1a", color: "#fff", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "#f5f0e8", border: "1.5px dashed #d4cec7", color: "#888", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────────
function Navbar({ profile }: { profile: Profile | null }) {
  const links = [["Dashboard","/dashboard"],["Explore","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]];
  return (
    <nav style={{ background: "rgba(255,255,255,.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8e2d9", padding: "0 28px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
      <a href="/dashboard"><span style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span><span style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span></a>
      <div style={{ display: "flex", gap: 2 }}>
        {links.map(([l, h]) => (
          <a key={l} href={h} style={{ padding: "7px 13px", borderRadius: 8, fontSize: 13, fontWeight: 600, transition: "all .12s", display: "inline-block", background: h === "/community" ? "#e6f2ec" : "transparent", color: h === "/community" ? "#2d6a4f" : "#666" }}
            onMouseEnter={e => { if (h !== "/community") { (e.currentTarget as HTMLElement).style.background = "#eee9e0"; (e.currentTarget as HTMLElement).style.color = "#1a1a1a"; } }}
            onMouseLeave={e => { if (h !== "/community") { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#666"; } }}
          >{l}</a>
        ))}
      </div>
      {profile ? (
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 14px 5px 6px", borderRadius: 999, background: "#f5f0e8", border: "1.5px solid #e8e2d9" }}>
          <PremiumAvatar name={profile.full_name} level={profile.level} avatarUrl={profile.avatar_url} size={28} xp_multiplier={profile.xp_multiplier} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile.username}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#2d6a4f" }}>{profile.credits} cr</span>
        </a>
      ) : <a href="/login" style={{ padding: "8px 20px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700 }}>Sign in</a>}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPACT CHAMPION PODIUM (reduced height — fix #1)
// ─────────────────────────────────────────────────────────────
function ChampionPodium({ champs, onDismiss, onCompete }: {
  champs: WeeklyChamp[]; onDismiss: () => void; onCompete: () => void;
}) {
  const cd = useCountdown();
  const ordered = [champs.find(c => c.rank === 2), champs.find(c => c.rank === 1), champs.find(c => c.rank === 3)];
  const meta = {
    1: { emoji: "🥇", color: "#ffd700", bg: "rgba(255,215,0,.12)", anim: "goldRing 2s ease infinite",   height: 80 },
    2: { emoji: "🥈", color: "#c8c8c8", bg: "rgba(200,200,200,.1)", anim: "silverRing 2s ease infinite", height: 64 },
    3: { emoji: "🥉", color: "#cd7f32", bg: "rgba(205,127,50,.1)",  anim: "bronzeRing 2s ease infinite", height: 56 },
  } as const;

  return (
    <div style={{ position: "relative", background: "linear-gradient(135deg,#0a1a10,#1a3d2e 50%,#2d6a4f)", borderRadius: 18, padding: "18px 20px", marginBottom: 14, overflow: "hidden", border: "1.5px solid rgba(255,215,0,.2)", boxShadow: "0 8px 32px rgba(45,106,79,.3)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#ffd700 30%,#e8a800 50%,#ffd700 70%,transparent)", backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite" }} />
      <Sparkles />

      {/* Header row — compact */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,215,0,.7)", letterSpacing: 1.4, textTransform: "uppercase" as const, marginBottom: 3 }}>📌 This Week's Champions</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: "#fff" }}>Top performers earn real rewards 🏆</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Countdown pill */}
          <div style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "7px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.4)", textTransform: "uppercase" as const, letterSpacing: 1 }}>Resets in</div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 15, fontWeight: 900, color: "#ffd700", lineHeight: 1.2 }}>{cd.d}d {cd.h}h</div>
          </div>
          <button onClick={onDismiss} style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.4)", width: 24, height: 24, borderRadius: "50%", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      </div>

      {/* Podium — horizontal compact cards */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, position: "relative", zIndex: 1 }}>
        {ordered.map((champ, i) => {
          if (!champ) {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const m = meta[rank as 1|2|3];
            return (
              <div key={i} style={{ flex: rank === 1 ? 1.2 : 1, background: "rgba(255,255,255,.04)", border: "1px dashed rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 20, opacity: .3 }}>{m.emoji}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.2)", marginTop: 4 }}>Open</div>
              </div>
            );
          }
          const m = meta[champ.rank as 1|2|3];
          return (
            <div key={champ.user_id} style={{ flex: champ.rank === 1 ? 1.2 : 1, background: m.bg, border: `1px solid ${m.color}33`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              {champ.rank === 1 && <div style={{ fontSize: 12, animation: "crownBounce 1.5s ease infinite", marginBottom: 4 }}>👑</div>}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                <div style={{ width: champ.rank === 1 ? 42 : 36, height: champ.rank === 1 ? 42 : 36, borderRadius: "50%", overflow: "hidden", background: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", animation: m.anim }}>
                  {champ.avatar_url ? <img src={champ.avatar_url} alt={champ.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(champ.full_name)}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", marginBottom: 2 }}>{champ.full_name.split(" ")[0]}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: m.color }}>{m.emoji}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                {champ.xp_earned != null && <span style={{ fontSize: 9, color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.07)", padding: "2px 6px", borderRadius: 99 }}>+{champ.xp_earned} XP</span>}
                {champ.answers_accepted != null && <span style={{ fontSize: 9, color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.07)", padding: "2px 6px", borderRadius: 99 }}>{champ.answers_accepted}✓</span>}
              </div>
              {/* Streak + accept rate gamification — fix #4 */}
              {champ.champion_streak > 1 && <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 700, marginTop: 4 }}>🔥 {champ.champion_streak}wk streak</div>}
              {champ.accept_rate != null && champ.accept_rate >= 70 && <div style={{ fontSize: 9, color: "#86efac", fontWeight: 700 }}>🎯 {champ.accept_rate}% accepted</div>}
            </div>
          );
        })}
      </div>

      {/* Rewards + CTAs */}
      <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, display: "flex", gap: 6, background: "rgba(0,0,0,.2)", borderRadius: 10, padding: "8px 10px", alignItems: "center", flexWrap: "wrap" }}>
          {[{ p: "🥇", r: "+20cr · 1.25x" }, { p: "🥈", r: "+12cr · 1.15x" }, { p: "🥉", r: "+6cr · 1.10x" }].map(r => (
            <div key={r.p} style={{ fontSize: 10, color: "rgba(255,255,255,.5)" }}>{r.p} <span style={{ fontWeight: 700 }}>{r.r}</span></div>
          ))}
        </div>
        <a href="/leaderboard" style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,215,0,.12)", border: "1px solid rgba(255,215,0,.3)", color: "#ffd700", fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>Leaderboard →</a>
        <button onClick={onCompete} style={{ padding: "8px 14px", borderRadius: 10, background: "#2d6a4f", border: "1px solid rgba(255,255,255,.15)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>🔥 Compete</button>
      </div>
    </div>
  );
}

// Mini strip after dismiss
function ChampionMiniStrip({ champs, onExpand }: { champs: WeeklyChamp[]; onExpand: () => void }) {
  const cd = useCountdown();
  return (
    <div onClick={onExpand} style={{ background: "linear-gradient(90deg,#1a3d2e,#2d6a4f)", borderRadius: 12, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12, border: "1.5px solid rgba(255,215,0,.2)", cursor: "pointer" }}>
      <span style={{ fontSize: 16, animation: "crownBounce 2s ease infinite" }}>👑</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,215,0,.7)", marginBottom: 1 }}>THIS WEEK</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {champs.slice(0, 3).map(c => `${c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : "🥉"} ${c.full_name.split(" ")[0]}`).join("  ·  ")}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#ffd700", flexShrink: 0 }}>{cd.d}d {cd.h}h</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DAILY CHALLENGE WIDGET — fix #11
// ─────────────────────────────────────────────────────────────
function DailyChallenge({ profile, posts }: { profile: Profile | null; posts: ForumPost[] }) {
  const openCount  = posts.filter(p => !p.is_answered).length;
  const target     = 2;
  const todayKey   = `daily_${new Date().toDateString()}_${profile?.id}`;
  const [done, setDone] = useState(() => {
    try { return parseInt(localStorage.getItem(todayKey) || "0"); } catch { return 0; }
  });
  const pct = Math.min(100, Math.round((done / target) * 100));

  return (
    <div style={{ background: "linear-gradient(135deg,#fff7ed,#fef3c7)", border: "1.5px solid #fde68a", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#92400e" }}>Daily Challenge</div>
            <div style={{ fontSize: 11, color: "#b45309" }}>Answer {target} questions → <strong>+5 credits</strong></div>
          </div>
        </div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: done >= target ? "#2d6a4f" : "#f59e0b" }}>{done}/{target}</div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 6, background: "#fed7aa", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: done >= target ? "#2d6a4f" : "#f59e0b", borderRadius: 999, transition: "width .4s ease" }} />
      </div>
      {done >= target
        ? <div style={{ marginTop: 6, fontSize: 11, color: "#15803d", fontWeight: 800 }}>✅ Challenge complete! Reward claimed.</div>
        : <div style={{ marginTop: 6, fontSize: 11, color: "#b45309" }}>{openCount} open question{openCount !== 1 ? "s" : ""} need your help</div>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TRENDING QUESTIONS — fix #2
// ─────────────────────────────────────────────────────────────
function TrendingQuestions({ posts, onClick }: { posts: ForumPost[]; onClick: (p: ForumPost) => void }) {
  const trending = [...posts]
    .sort((a, b) => (b.upvotes + (b.answer_count || 0) * 2) - (a.upvotes + (a.answer_count || 0) * 2))
    .slice(0, 5);

  if (trending.length === 0) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🔥</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a" }}>Trending Questions</span>
      </div>
      {trending.map((p, i) => (
        <div key={p.id} onClick={() => onClick(p)} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: i > 0 ? "1px solid #f5f0e8" : "none", cursor: "pointer" }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.opacity = ".75"}
          onMouseOut={e  => (e.currentTarget as HTMLElement).style.opacity = "1"}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#ddd", width: 18, flexShrink: 0, textAlign: "center" }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: "#bbb" }}>▲ {p.upvotes}</span>
              <span style={{ fontSize: 11, color: "#bbb" }}>💬 {p.answer_count}</span>
              {p.is_answered && <span style={{ fontSize: 10, color: "#15803d", fontWeight: 700 }}>✓ solved</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EARN CREDITS CARD
// ─────────────────────────────────────────────────────────────
function EarnCreditsCard({ onAnswerClick, openCount }: { onAnswerClick: () => void; openCount: number }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#fff7ed,#fef3c7)", border: "1.5px solid #fed7aa", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 16px rgba(245,158,11,.1)" }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>💰</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 14, fontWeight: 900, color: "#92400e", marginBottom: 2 }}>Earn credits by helping out</div>
        <div style={{ fontSize: 12, color: "#b45309" }}>
          Accepted answer → <strong>+2 credits</strong> + <strong>+15 XP</strong>
          {openCount > 0 && <span style={{ marginLeft: 6, background: "#fff", border: "1px solid #fcd34d", borderRadius: 99, padding: "1px 7px", fontWeight: 800, color: "#b45309", fontSize: 11 }}>{openCount} open now</span>}
        </div>
      </div>
      <button onClick={onAnswerClick}
        style={{ padding: "8px 16px", borderRadius: 10, background: "#f59e0b", color: "#fff", fontSize: 12, fontWeight: 900, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 3px 10px rgba(245,158,11,.3)", transition: "all .15s" }}
        onMouseOver={e => { e.currentTarget.style.background = "#d97706"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseOut={e  => { e.currentTarget.style.background = "#f59e0b"; e.currentTarget.style.transform = "none"; }}>
        Answer →
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────
function PostCard({ fp, idx, onClick, onLightbox }: { fp: ForumPost; idx: number; onClick: () => void; onLightbox: (url: string) => void }) {
  const rank = getRank(fp.author?.xp_multiplier);
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${fp.is_answered ? "#86efac44" : "#e8e2d9"}`, padding: "16px 20px", marginBottom: 8, animation: `fadeUp 0.3s ${idx * 0.04}s ease both`, boxShadow: "0 2px 8px rgba(0,0,0,.03)", cursor: "pointer", transition: "all .2s" }}
      onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 24px rgba(0,0,0,.08)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseOut={e  => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,.03)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <PremiumAvatar name={fp.author?.full_name || "?"} level={fp.author?.level} avatarUrl={fp.author?.avatar_url} size={32} xp_multiplier={fp.author?.xp_multiplier} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{fp.author?.full_name}</span>
          {fp.author?.champion_title && rank > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(255,215,0,.12)", color: "#b8860b", padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(255,215,0,.2)" }}>
              {rank === 1 ? "👑" : rank === 2 ? "🥈" : "🥉"} {fp.author.champion_title}
            </span>
          )}
          {fp.skill && <SkillTag skill={fp.skill} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {fp.is_answered
            ? <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 800 }}>✓ Solved</span>
            : <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 999, background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>Open</span>}
          <span style={{ fontSize: 11, color: "#ccc" }}>{timeAgo(fp.created_at)}</span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.4 }}>{fp.title}</div>
      <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{fp.body}</div>
      {/* Engagement metrics — fix #9 */}
      <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 8, borderTop: "1px solid #f5f0e8", fontSize: 11, color: "#bbb", fontWeight: 600 }}>
        <span>▲ {fp.upvotes}</span>
        <span>💬 {fp.answer_count} {fp.answer_count === 1 ? "answer" : "answers"}</span>
        {fp.views != null && <span>👁 {fp.views.toLocaleString()} views</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANSWER EDITOR with toolbar + spam detection
// ─────────────────────────────────────────────────────────────
function AnswerEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  function insertAt(before: string, after = "", placeholder = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder;
    onChange(ta.value.slice(0, s) + before + sel + after + ta.value.slice(e));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); }, 0);
  }
  const tools = [
    { label: "B",    action: () => insertAt("**", "**", "bold"),  style: { fontWeight: 900 } },
    { label: "I",    action: () => insertAt("_", "_", "italic"),  style: { fontStyle: "italic" as const } },
    { label: "</>",  action: () => insertAt("`", "`", "code"),    style: { fontFamily: "monospace" } },
    { label: "Block",action: () => insertAt("```\n", "\n```", "code"), style: {} },
    { label: "$x$",  action: () => insertAt("$", "$", "x^2+1"),  style: { fontFamily: "monospace" } },
  ];
  const isSpam = detectSpam(value);
  const ready  = !isSpam && value.trim().length >= MIN_ANSWER_LENGTH;
  return (
    <div>
      <div style={{ display: "flex", gap: 4, padding: "7px 10px", background: "#f8f7f4", borderRadius: "10px 10px 0 0", border: "1.5px solid #e8e2d9", borderBottom: "none", flexWrap: "wrap" }}>
        {tools.map(t => (
          <button key={t.label} type="button" onClick={t.action}
            style={{ padding: "3px 9px", borderRadius: 6, background: "#fff", border: "1px solid #e8e2d9", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#555", ...t.style }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {value.trim().length >= MIN_ANSWER_LENGTH && !isSpam && (
          <div style={{ fontSize: 10, fontWeight: 800, color: "#2d6a4f", display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#2d6a4f" }} /> Ready
          </div>
        )}
      </div>
      <textarea ref={textareaRef} value={value} onChange={e => onChange(e.target.value)}
        placeholder={`Write a detailed answer…\nTip: use \`code\`, \`\`\`blocks\`\`\`, or $math$ for equations`}
        style={{ width: "100%", minHeight: 120, padding: "12px 14px", borderRadius: "0 0 10px 10px", border: "1.5px solid #e8e2d9", borderTop: "none", fontSize: 14, resize: "vertical", lineHeight: 1.7, outline: "none", fontFamily: "'DM Sans',sans-serif" }}
        onFocus={e => (e.currentTarget.style.borderColor = "#2d6a4f")}
        onBlur={e  => (e.currentTarget.style.borderColor = "#e8e2d9")}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11 }}>
        <span style={{ color: isSpam ? "#dc2626" : value.trim().length < MIN_ANSWER_LENGTH ? "#f59e0b" : "#2d6a4f", fontWeight: 700 }}>
          {isSpam ? "⚠️ Spam detected" : value.trim().length < MIN_ANSWER_LENGTH ? `✏️ ${MIN_ANSWER_LENGTH - value.trim().length} more chars` : "✓ Good to post"}
        </span>
        <span style={{ color: "#ccc" }}>{value.trim().length}/{MIN_ANSWER_LENGTH} min</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// POST DETAIL VIEW (full Q&A)
// ─────────────────────────────────────────────────────────────
function PostDetail({ post: initialPost, profile, onBack, onLoadAnswers }: {
  post: ForumPost; profile: Profile | null; onBack: () => void;
  onLoadAnswers?: (postId: string) => Promise<ForumAnswer[]>;
}) {
  const [post, setPost]           = useState(initialPost);
  const [answers, setAnswers]     = useState<ForumAnswer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [newAnswer, setNewAnswer] = useState("");
  const [posting, setPosting]     = useState(false);
  const [sort, setSort]           = useState<"Top"|"Newest">("Top");
  const [lightbox, setLightbox]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    // increment views
    await supabase.from("forum_posts").update({ views: (post.views || 0) + 1 }).eq("id", post.id);
    const { data } = await supabase.from("forum_answers")
      .select(`*, author:profiles!forum_answers_author_id_fkey(full_name,username,level,avatar_url,xp_multiplier,champion_title,xp)`)
      .eq("post_id", post.id);
    setAnswers(data || []);
    setLoading(false);
  }

  function sortedAnswers() {
    const accepted = answers.filter(a => a.is_accepted);
    const rest = answers.filter(a => !a.is_accepted);
    const sorted = sort === "Top"
      ? [...rest].sort((a, b) => (b.upvotes - (b.downvotes || 0)) - (a.upvotes - (a.downvotes || 0)))
      : [...rest].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return [...accepted, ...sorted];
  }

  async function handleSubmit() {
    if (!profile || detectSpam(newAnswer) || newAnswer.trim().length < MIN_ANSWER_LENGTH) return;
    setPosting(true);
    await supabase.from("forum_answers").insert({ post_id: post.id, author_id: profile.id, content: newAnswer.trim() });
    if (post.author_id !== profile.id) await supabase.from("notifications").insert({ user_id: post.author_id, type: "platform", title: "New answer on your question 💬", body: `${profile.full_name} answered: "${post.title}"`, link: "/community" });
    setNewAnswer(""); await load(); setPosting(false);
  }

  async function handleAccept(answer: ForumAnswer) {
    if (!profile || post.author_id !== profile.id) return;
    await supabase.from("forum_answers").update({ is_accepted: true }).eq("id", answer.id);
    await supabase.from("forum_posts").update({ is_answered: true, accepted_answer_id: answer.id, status: "answered" }).eq("id", post.id);
    if (!answer.credits_awarded) {
      await supabase.from("forum_answers").update({ credits_awarded: true }).eq("id", answer.id);
      const { data: ap } = await supabase.from("profiles").select("credits").eq("id", answer.author_id).single();
      await supabase.from("profiles").update({ credits: (ap?.credits || 0) + 2 }).eq("id", answer.author_id);
      await supabase.rpc("increment_xp", { user_id: answer.author_id, amount: 15 });
      await supabase.from("notifications").insert({ user_id: answer.author_id, type: "achievement", title: "Answer accepted! 🎉", body: `+2 credits +15 XP for your answer on "${post.title}"`, link: "/community" });
    }
    setPost(p => ({ ...p, is_answered: true })); await load();
  }

  async function handleUpvote(answer: ForumAnswer) {
    if (!profile) return;
    await supabase.from("forum_answers").update({ upvotes: answer.upvotes + 1 }).eq("id", answer.id);
    await load();
  }

  async function handleReact(answer: ForumAnswer, key: string) {
    if (!profile) return;
    const updated = { ...answer.reactions, [key]: ((answer.reactions || {})[key] || 0) + 1 };
    await supabase.from("forum_answers").update({ reactions: updated }).eq("id", answer.id);
    await load();
  }

  const spam = detectSpam(newAnswer);
  const canPost = !spam && newAnswer.trim().length >= MIN_ANSWER_LENGTH && !posting;

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", padding: "28px 20px" }}>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24 }}>
          <img src={lightbox} alt="full" style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16 }} />
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22, fontSize: 13, color: "#aaa", fontWeight: 600 }}>
        <a href="/dashboard" style={{ color: "#2d6a4f", fontWeight: 700 }}>Dashboard</a>
        <span>›</span>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>Community</button>
        <span>›</span>
        <span style={{ color: "#888", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</span>
      </div>

      {/* Question */}
      <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e8e2d9", padding: "24px 28px", marginBottom: 18, boxShadow: "0 2px 14px rgba(0,0,0,.04)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {/* Vote */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, paddingTop: 4 }}>
            <button onClick={async () => { await supabase.from("forum_posts").update({ upvotes: post.upvotes + 1 }).eq("id", post.id); setPost(p => ({ ...p, upvotes: p.upvotes + 1 })); }} style={{ width: 34, height: 34, borderRadius: 9, background: "#f5f0e8", border: "1.5px solid #e8e2d9", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: post.upvotes > 0 ? "#2d6a4f" : "#bbb" }}>{post.upvotes}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
              <PremiumAvatar name={post.author?.full_name || "?"} level={post.author?.level} avatarUrl={post.author?.avatar_url} size={36} xp_multiplier={post.author?.xp_multiplier} />
              <span style={{ fontSize: 14, fontWeight: 800 }}>{post.author?.full_name}</span>
              {post.skill && <SkillTag skill={post.skill} />}
              {post.is_answered && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontWeight: 800 }}>✅ Solved</span>}
              {/* Engagement metrics */}
              <span style={{ fontSize: 11, color: "#ccc", marginLeft: "auto" }}>👁 {(post.views || 0).toLocaleString()} · 💬 {answers.length} · {timeAgo(post.created_at)}</span>
            </div>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1.3, marginBottom: 12 }}>{post.title}</h2>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{post.body}</p>
            {post.image_url && <img src={post.image_url} onClick={() => setLightbox(post.image_url!)} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, border: "1.5px solid #e8e2d9", marginTop: 14, cursor: "zoom-in", display: "block" }} />}
          </div>
        </div>
      </div>

      {/* Answers header + sort */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a" }}>{answers.length} {answers.length === 1 ? "Answer" : "Answers"}</div>
        {answers.length > 1 && (
          <div style={{ display: "flex", gap: 3, background: "#f0ece4", padding: 3, borderRadius: 999 }}>
            {(["Top", "Newest"] as const).map(o => (
              <button key={o} onClick={() => setSort(o)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: sort === o ? "#fff" : "transparent", color: sort === o ? "#1a1a1a" : "#888", fontFamily: "'DM Sans',sans-serif" }}>{o}</button>
            ))}
          </div>
        )}
      </div>

      {/* Answers */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}><div style={{ width: 24, height: 24, border: "2.5px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} /></div>
      ) : answers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 24px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🤔</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a" }}>No answers yet</div>
          <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Be first — accepted answers earn <strong>+2 credits</strong> + <strong>+15 XP</strong></div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {sortedAnswers().map((a, idx) => (
            <div key={a.id} style={{
              background: a.is_accepted ? "linear-gradient(135deg,#f0fdf4,#ecfdf5)" : "#fff",
              borderRadius: 16, border: `1.5px solid ${a.is_accepted ? "#86efac" : "#e8e2d9"}`,
              padding: "20px 24px", boxShadow: a.is_accepted ? "0 4px 20px rgba(34,197,94,.1)" : "0 2px 8px rgba(0,0,0,.03)",
              animation: `fadeUp .3s ${idx * .05}s ease both`,
            }}>
              {a.is_accepted && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "8px 14px", background: "#dcfce7", borderRadius: 9 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#15803d" }}>Accepted Answer</div>
                    {a.credits_awarded && <div style={{ fontSize: 11, color: "#166534" }}>🏆 +2 credits · +15 XP awarded</div>}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                {/* Vote column */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <button onClick={() => handleUpvote(a)} style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f0e8", border: "1.5px solid #e8e2d9", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "#dcfce7"; e.currentTarget.style.borderColor = "#86efac"; }}
                    onMouseOut={e  => { e.currentTarget.style.background = "#f5f0e8"; e.currentTarget.style.borderColor = "#e8e2d9"; }}>▲</button>
                  <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 900, color: a.upvotes > 0 ? "#2d6a4f" : "#bbb" }}>{a.upvotes - (a.downvotes || 0)}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Author credibility — fix #7 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <PremiumAvatar name={a.author?.full_name || "?"} level={a.author?.level} avatarUrl={a.author?.avatar_url} size={34} xp_multiplier={a.author?.xp_multiplier} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{a.author?.full_name}</span>
                        {a.author?.champion_title && getRank(a.author?.xp_multiplier) > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(255,215,0,.12)", color: "#b8860b", padding: "1px 8px", borderRadius: 999, border: "1px solid rgba(255,215,0,.25)" }}>
                            {getRank(a.author?.xp_multiplier) === 1 ? "👑" : getRank(a.author?.xp_multiplier) === 2 ? "🥈" : "🥉"} {a.author.champion_title}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: "#bbb" }}>{timeAgo(a.created_at)}</span>
                      </div>
                      {/* Credibility stats */}
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        {a.author?.level && <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLORS[a.author.level] || "#2d6a4f" }}>{a.author.level}</span>}
                        {a.author_stats && <span style={{ fontSize: 10, color: "#bbb" }}>{a.author_stats.total_answers} answers · {a.author_stats.accept_rate}% accepted</span>}
                      </div>
                    </div>
                  </div>
                  <p style={{ color: "#444", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 12 }}>{a.content}</p>
                  {a.image_url && <img src={a.image_url} onClick={() => setLightbox(a.image_url!)} style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 9, border: "1.5px solid #e8e2d9", display: "block", marginBottom: 12, cursor: "zoom-in" }} />}
                  {/* Reactions + Accept */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid #f0ece4" }}>
                    {REACTIONS.map(r => {
                      const count = (a.reactions || {})[r.key] || 0;
                      return (
                        <button key={r.key} onClick={() => handleReact(a, r.key)} title={r.label}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: count > 0 ? "#f0fdf4" : "#f5f0e8", border: `1px solid ${count > 0 ? "#86efac" : "#e8e2d9"}`, fontSize: 11, fontWeight: count > 0 ? 800 : 600, color: count > 0 ? "#2d6a4f" : "#999", cursor: "pointer" }}>
                          {r.emoji}{count > 0 && <span>{count}</span>}
                        </button>
                      );
                    })}
                    {profile && post.author_id === profile.id && !post.is_answered && (
                      <button onClick={() => handleAccept(a)} style={{ marginLeft: "auto", padding: "5px 16px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 11, fontWeight: 800, border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(45,106,79,.25)" }}>✓ Accept (+2 cr)</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answer composer */}
      {profile ? (
        <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9", padding: "22px 24px", boxShadow: "0 4px 18px rgba(0,0,0,.05)" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: ".1em", textTransform: "uppercase" as const, marginBottom: 14 }}>Your Answer</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <PremiumAvatar name={profile.full_name} level={profile.level} avatarUrl={profile.avatar_url} size={36} xp_multiplier={profile.xp_multiplier} />
            <div style={{ flex: 1 }}>
              <AnswerEditor value={newAnswer} onChange={setNewAnswer} />
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleSubmit} disabled={!canPost}
                  style={{ padding: "10px 26px", borderRadius: 999, background: canPost ? "#2d6a4f" : "#e8e2d9", color: canPost ? "#fff" : "#aaa", fontSize: 13, fontWeight: 800, border: "none", cursor: canPost ? "pointer" : "not-allowed", boxShadow: canPost ? "0 4px 14px rgba(45,106,79,.3)" : "none", transition: "all .15s" }}>
                  {posting ? "Posting…" : "Post Answer →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 24, background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9" }}>
          <a href="/login" style={{ color: "#2d6a4f", fontWeight: 700, fontSize: 14 }}>Sign in to answer →</a>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function Sidebar({ profile, posts, skills, champs, onFilterTag, onAnswerClick, podiumDismissed }: {
  profile: Profile | null;
  posts: ForumPost[];
  skills: Skill[];
  champs: WeeklyChamp[];
  onFilterTag: (skillId: string) => void;
  onAnswerClick: () => void;
  podiumDismissed: boolean;
}) {
  const cd = useCountdown();
  const xpInfo = profile ? getXPProgress(profile.xp, profile.level) : null;

  // Top contributors from answer counts
  const unanswered = posts.filter(p => !p.is_answered).slice(0, 4);
  // Popular tags from post distribution
  const tagCounts = posts.reduce((acc, p) => {
    if (p.skill) acc[p.skill.name] = (acc[p.skill.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 74 }}>

      {/* Compact champions when dismissed — fix #3 */}
      {champs.length > 0 && podiumDismissed && (
        <div style={{ background: "linear-gradient(135deg,#1a3d2e,#2d6a4f)", borderRadius: 14, padding: "14px 16px", border: "1.5px solid rgba(255,215,0,.25)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,215,0,.7)", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10 }}>👑 Weekly Leaders</div>
          {champs.slice(0, 3).map(c => {
            const xp = getXPProgress(c.xp, c.xp_multiplier >= 1.25 ? "Expert" : c.xp_multiplier >= 1.15 ? "Skilled" : "Contributor");
            return (
              <div key={c.user_id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : "🥉"}</span>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#fff" }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(c.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.full_name.split(" ")[0]}</div>
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)" }}>+{c.xp_earned} XP{c.champion_streak > 1 ? ` · 🔥${c.champion_streak}wk` : ""}</div>
                  </div>
                </div>
                {/* XP progress bar — fix #5 */}
                <div style={{ height: 3, background: "rgba(255,255,255,.1)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${xp.pct}%`, background: c.rank === 1 ? "#ffd700" : c.rank === 2 ? "#c8c8c8" : "#cd7f32", borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,.3)" }}>Resets in {cd.d}d {cd.h}h</div>
            <a href="/leaderboard" style={{ fontSize: 10, color: "#ffd700", fontWeight: 700 }}>Full Leaderboard →</a>
          </div>
        </div>
      )}

      {/* My XP progress (if logged in) — fix #5 */}
      {profile && xpInfo && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <PremiumAvatar name={profile.full_name} level={profile.level} avatarUrl={profile.avatar_url} size={36} xp_multiplier={profile.xp_multiplier} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{profile.full_name.split(" ")[0]}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: LEVEL_COLORS[profile.level] || "#2d6a4f" }}>{profile.level}</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#bbb", marginBottom: 4, fontWeight: 600 }}>
            <span>{profile.level}</span>
            <span>{xpInfo.nextLevel || "Max"}</span>
          </div>
          <div style={{ height: 6, background: "#f0ece4", borderRadius: 999, overflow: "hidden", marginBottom: 5 }}>
            <div style={{ height: "100%", width: `${xpInfo.pct}%`, background: `linear-gradient(90deg, ${LEVEL_COLORS[profile.level] || "#2d6a4f"}, ${LEVEL_COLORS[xpInfo.nextLevel || profile.level] || "#2d6a4f"})`, borderRadius: 999, transition: "width .5s ease" }} />
          </div>
          <div style={{ fontSize: 10, color: "#bbb" }}>
            {xpInfo.nextLevel ? `${xpInfo.remaining} XP to ${xpInfo.nextLevel}` : "Max level reached 🎉"}
          </div>
        </div>
      )}

      {/* Unanswered questions — fix #3 */}
      {unanswered.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>❓ Needs Answers</div>
          {unanswered.map((p, i) => (
            <div key={p.id} style={{ fontSize: 12, color: "#555", padding: "6px 0", borderTop: i > 0 ? "1px solid #f5f0e8" : "none", lineHeight: 1.4, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={p.title}>
              <span style={{ color: "#f59e0b", fontWeight: 700, marginRight: 5 }}>●</span>{p.title}
            </div>
          ))}
          <button onClick={onAnswerClick} style={{ width: "100%", marginTop: 10, padding: "7px", borderRadius: 9, background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 800, border: "1px solid #fde68a", cursor: "pointer" }}>
            Answer & Earn Credits →
          </button>
        </div>
      )}

      {/* Popular tags — fix #3 */}
      {topTags.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>🏷 Popular Topics</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topTags.map(([name, count]) => {
              const skill = skills.find(s => s.name === name);
              const cfg = skill ? CATEGORY_COLORS[skill.category] : { bg: "#f0ece4", color: "#555", accent: "#888" };
              return (
                <button key={name} onClick={() => {
                  const s = skills.find(sk => sk.name === name);
                  if (s) onFilterTag(s.id);
                }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.accent}33`, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {skill && CATEGORY_ICONS[skill.category]} {name}
                  <span style={{ fontSize: 10, opacity: .7, fontWeight: 600 }}>·{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Earn credits CTA */}
      <div style={{ borderRadius: 14, padding: "18px", background: "linear-gradient(145deg,#1a4a36,#2d6a4f 60%,#3a8a63)", color: "#fff", boxShadow: "0 6px 24px rgba(45,106,79,.2)" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>💰</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Earn Credits</div>
        <p style={{ fontSize: 12, opacity: .8, lineHeight: 1.65, marginBottom: 12 }}>Accepted answer → <strong style={{ opacity: 1 }}>+2 credits</strong> + <strong style={{ opacity: 1 }}>+15 XP</strong></p>
        <button onClick={onAnswerClick} style={{ width: "100%", padding: "9px", borderRadius: 10, background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,.25)", cursor: "pointer", transition: "all .15s" }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,.25)")}
          onMouseOut={e  => (e.currentTarget.style.background = "rgba(255,255,255,.15)")}>
          See Open Questions →
        </button>
      </div>

      {/* Guidelines */}
      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", marginBottom: 10 }}>📋 Guidelines</div>
        {["Be respectful & constructive", "Tag your skill topic", "No spam or self-promotion", "Credit helpful answers"].map((rule, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: "#e6f2ec", color: "#2d6a4f", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontSize: 12, color: "#555" }}>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────
function EmptyState({ message, onAsk }: { message: string; onAsk?: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 16, border: "1.5px solid #e8e2d9" }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>{message}</div>
      {onAsk && <button onClick={onAsk} style={{ marginTop: 12, padding: "9px 22px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer" }}>Ask the First Question →</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE — default export
// ─────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [posts, setPosts]                   = useState<ForumPost[]>([]);
  const [skills, setSkills]                 = useState<Skill[]>([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState<"feed"|"questions"|"groups"|"leaderboard">("questions");
  const [filterSkill, setFilterSkill]       = useState<string>("all");
  const [filterStatus, setFilterStatus]     = useState<"all"|"open"|"answered">("all");
  const [search, setSearch]                 = useState("");
  const [showPostModal, setShowPostModal]   = useState(false);
  const [newPost, setNewPost]               = useState({ title: "", body: "", skill_id: "" });
  const [postImageUrl, setPostImageUrl]     = useState<string | null>(null);
  const [posting, setPosting]               = useState(false);
  const [openPost, setOpenPost]             = useState<ForumPost | null>(null);
  const [lightbox, setLightbox]             = useState<string | null>(null);
  const [weeklyChamps, setWeeklyChamps]     = useState<WeeklyChamp[]>([]);
  const [podiumDismissed, setPodiumDismissed] = useState(false);
  const [sortPosts, setSortPosts]           = useState<"newest"|"votes"|"unanswered">("newest");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("*,xp_multiplier,champion_title,champion_streak").eq("id", user.id).single();
      setProfile(prof);
    }
    const { data: skillList } = await supabase.from("skills").select("*").order("category");
    setSkills(skillList || []);
    await loadPosts();
    await loadChampions();
    setLoading(false);
  }

  async function loadChampions() {
    try {
      const { data: champRows } = await supabase.from("weekly_champions").select("user_id,rank,credits_bonus,xp_earned,week_start").in("rank", [1, 2, 3]).order("week_start", { ascending: false }).limit(3);
      if (!champRows || champRows.length === 0) return;
      const latestWeek = champRows[0].week_start;
      if ((Date.now() - new Date(latestWeek).getTime()) / (1000 * 60 * 60 * 24) > 14) return;
      const thisWeek = champRows.filter(c => c.week_start === latestWeek);
      const enriched: WeeklyChamp[] = await Promise.all(thisWeek.map(async c => {
        const { data: prof } = await supabase.from("profiles").select("full_name,username,avatar_url,champion_title,champion_streak,xp,xp_multiplier").eq("id", c.user_id).single();
        const { count: total }    = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("author_id", c.user_id);
        const { count: accepted } = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("author_id", c.user_id).eq("is_accepted", true);
        const t = total || 0, a = accepted || 0;
        return {
          rank: c.rank, user_id: c.user_id,
          full_name: prof?.full_name || "?", username: prof?.username || "?",
          avatar_url: prof?.avatar_url || null, champion_title: prof?.champion_title || null,
          champion_streak: prof?.champion_streak || 0, xp: prof?.xp || 0,
          xp_multiplier: prof?.xp_multiplier || 1,
          xp_earned: c.xp_earned, credits_bonus: c.credits_bonus,
          answers_given: t, answers_accepted: a,
          accept_rate: t > 0 ? Math.round((a / t) * 100) : 0,
        } as WeeklyChamp;
      }));
      setWeeklyChamps(enriched);
    } catch { }
  }

  async function loadPosts() {
    const { data } = await supabase.from("forum_posts")
      .select(`*, author:profiles!forum_posts_author_id_fkey(full_name,username,level,avatar_url,xp_multiplier,champion_title), skill:skills(name,category)`)
      .neq("status", "archived").order("created_at", { ascending: false });
    const withCounts = await Promise.all((data || []).map(async (p: ForumPost) => {
      const { count } = await supabase.from("forum_answers").select("*", { count: "exact", head: true }).eq("post_id", p.id);
      return { ...p, answer_count: count || 0 };
    }));
    setPosts(withCounts);
  }

  async function handlePostQuestion() {
    if (!profile || !newPost.title.trim() || !newPost.body.trim()) return;
    setPosting(true);
    const { data: createdPost, error } = await supabase.from("forum_posts").insert({
      author_id: profile.id, skill_id: newPost.skill_id || null,
      title: newPost.title.trim(), body: newPost.body.trim(),
      image_url: postImageUrl || null, status: "open",
    }).select().single();
    if (error) { alert("Error: " + error.message); setPosting(false); return; }
    setShowPostModal(false); setNewPost({ title: "", body: "", skill_id: "" }); setPostImageUrl(null);
    await loadPosts();
    if (createdPost) { setOpenPost(createdPost as ForumPost); }
    setPosting(false);
  }

  function handleCompete() { setTab("questions"); setFilterStatus("open"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function handleFilterTag(skillId: string) { setFilterSkill(skillId); setTab("questions"); }

  // Sort + filter posts
  const filteredPosts = (() => {
    let result = posts.filter(p => {
      const matchSkill  = filterSkill === "all" || p.skill_id === filterSkill;
      const matchStatus = filterStatus === "all" || (filterStatus === "answered" ? p.is_answered : !p.is_answered);
      const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase());
      return matchSkill && matchStatus && matchSearch;
    });
    if (sortPosts === "votes")      result = [...result].sort((a, b) => b.upvotes - a.upvotes);
    else if (sortPosts === "unanswered") result = result.filter(p => !p.is_answered);
    return result;
  })();

  const skillsByCategory = skills.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Skill[]>);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #2d6a4f", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 14px" }} />
        <p style={{ color: "#999", fontSize: 13 }}>Loading community…</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} a{text-decoration:none}
        @keyframes spin        {to{transform:rotate(360deg)}}
        @keyframes fadeUp      {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeIn      {from{opacity:0}to{opacity:1}}
        @keyframes shimmer     {0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes crownBounce {0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-5px) rotate(5deg)}}
        @keyframes sparkFloat  {0%,100%{opacity:0;transform:scale(0) translateY(0)}50%{opacity:1;transform:scale(1) translateY(-8px)}}
        @keyframes goldPulse   {0%,100%{box-shadow:0 0 0 3px #e8a800,0 0 12px rgba(232,168,0,.7)}50%{box-shadow:0 0 0 3px #ffd700,0 0 24px rgba(255,215,0,1)}}
        @keyframes silverPulse {0%,100%{box-shadow:0 0 0 3px #aaa,0 0 8px rgba(180,180,180,.6)}50%{box-shadow:0 0 0 3px #ddd,0 0 16px rgba(220,220,220,.9)}}
        @keyframes bronzePulse {0%,100%{box-shadow:0 0 0 3px #a0522d,0 0 8px rgba(160,82,45,.6)}50%{box-shadow:0 0 0 3px #cd7f32,0 0 16px rgba(205,127,50,.8)}}
        @keyframes goldRing    {0%,100%{box-shadow:0 0 0 2.5px #e8a800,0 0 10px rgba(232,168,0,.6)}50%{box-shadow:0 0 0 2.5px #ffd700,0 0 18px rgba(255,215,0,.9)}}
        @keyframes silverRing  {0%,100%{box-shadow:0 0 0 2px #aaa}50%{box-shadow:0 0 0 2px #ddd,0 0 10px rgba(220,220,220,.7)}}
        @keyframes bronzeRing  {0%,100%{box-shadow:0 0 0 2px #a0522d}50%{box-shadow:0 0 0 2px #cd7f32,0 0 10px rgba(205,127,50,.6)}}
        select,input,textarea{outline:none;font-family:'DM Sans',sans-serif}
        select:focus,input:focus,textarea:focus{border-color:#2d6a4f!important;box-shadow:0 0 0 3px rgba(45,106,79,.1)}
        @media(max-width:900px){.community-grid{grid-template-columns:1fr!important}}
        @media(max-width:600px){.post-filter-row{flex-direction:column!important}}
      `}</style>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24, animation: "fadeIn .2s ease" }}>
          <img src={lightbox} alt="full" style={{ maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16 }} />
        </div>
      )}

      <Navbar profile={profile} />

      {openPost ? (
        <PostDetail
          post={openPost}
          profile={profile}
          onBack={() => { setOpenPost(null); loadPosts(); }}
        />
      ) : (
        <div style={{ maxWidth: 1140, margin: "0 auto", padding: "32px 24px" }}>
          {/* Page header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, animation: "fadeUp .3s ease" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#bbb", fontWeight: 600, marginBottom: 6 }}>
                <a href="/dashboard" style={{ color: "#2d6a4f", fontWeight: 700 }}>Dashboard</a>
                <span>›</span><span>Community</span>
              </div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 900, color: "#111", letterSpacing: "-.5px", lineHeight: 1.1 }}>Community</h1>
              <p style={{ color: "#888", marginTop: 4, fontSize: 14, fontWeight: 500 }}>Ask questions · Share knowledge · Earn credits</p>
            </div>
            {profile && (
              <button onClick={() => setShowPostModal(true)}
                style={{ padding: "11px 22px", borderRadius: 999, background: "#2d6a4f", color: "#fff", fontSize: 13, fontWeight: 800, border: "none", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 4px 18px rgba(45,106,79,.3)", cursor: "pointer", transition: "all .15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "#1a4a36")}
                onMouseOut={e  => (e.currentTarget.style.background = "#2d6a4f")}>
                + Ask a Question
              </button>
            )}
          </div>

          {/* Tabs — improved naming fix #8 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#ede9e1", padding: 4, borderRadius: 999, width: "fit-content", animation: "fadeUp .3s .05s ease both" }}>
            {([["feed","🏠 Feed"],["questions","❓ Questions"],["groups","👥 Groups"],["leaderboard","🏆 Leaderboard"]] as const).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: "7px 16px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#1a1a1a" : "#888", boxShadow: tab === t ? "0 2px 8px rgba(0,0,0,.1)" : "none", transition: "all .15s", fontFamily: "'DM Sans',sans-serif" }}>
                {l}
              </button>
            ))}
          </div>

          <div className="community-grid" style={{ display: "grid", gridTemplateColumns: "1fr 288px", gap: 22, alignItems: "start", animation: "fadeUp .3s .1s ease both" }}>
            {/* MAIN CONTENT */}
            <div>
              {/* Champion podium */}
              {weeklyChamps.length > 0 && !podiumDismissed && (tab === "feed" || tab === "questions") && (
                <ChampionPodium champs={weeklyChamps} onDismiss={() => setPodiumDismissed(true)} onCompete={handleCompete} />
              )}
              {weeklyChamps.length > 0 && podiumDismissed && (tab === "feed" || tab === "questions") && (
                <ChampionMiniStrip champs={weeklyChamps} onExpand={() => setPodiumDismissed(false)} />
              )}

              {/* Earn credits card */}
              {(tab === "feed" || tab === "questions") && (
                <EarnCreditsCard onAnswerClick={handleCompete} openCount={posts.filter(p => !p.is_answered).length} />
              )}

              {/* ── FEED TAB ── */}
              {tab === "feed" && (
                <div>
                  {/* Daily challenge — fix #11 */}
                  <DailyChallenge profile={profile} posts={posts} />

                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "Questions",  val: posts.length,                              icon: "❓", bg: "#eff6ff", color: "#1d4ed8" },
                      { label: "Answered",   val: posts.filter(p => p.is_answered).length,   icon: "✅", bg: "#f0fdf4", color: "#15803d" },
                      { label: "Need Help",  val: posts.filter(p => !p.is_answered).length,  icon: "⏳", bg: "#fffbeb", color: "#b45309" },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "16px 18px", border: "1.5px solid #e8e2d9" }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trending — fix #2 */}
                  <TrendingQuestions posts={posts} onClick={async (p) => { setOpenPost(p); }} />

                  <div style={{ fontSize: 11, fontWeight: 800, color: "#bbb", letterSpacing: ".12em", textTransform: "uppercase" as const, marginBottom: 10 }}>Recent Activity</div>
                  {posts.slice(0, 8).map((fp, idx) => <PostCard key={fp.id} fp={fp} idx={idx} onClick={() => setOpenPost(fp)} onLightbox={setLightbox} />)}
                  {posts.length === 0 && <EmptyState message="No posts yet — be first!" onAsk={profile ? () => setShowPostModal(true) : undefined} />}
                </div>
              )}

              {/* ── QUESTIONS TAB ── */}
              {tab === "questions" && (
                <div>
                  {/* Search + filters — fix #9 */}
                  <div className="post-filter-row" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#bbb" }}>🔍</span>
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…" style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13, background: "#fff" }} />
                    </div>
                    <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 12, background: "#fff", cursor: "pointer" }}>
                      <option value="all">All Skills</option>
                      {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 12, background: "#fff", cursor: "pointer" }}>
                      <option value="all">All Status</option>
                      <option value="open">Open</option>
                      <option value="answered">Answered</option>
                    </select>
                    {/* Sort — fix #9 */}
                    <select value={sortPosts} onChange={e => setSortPosts(e.target.value as any)} style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 12, background: "#fff", cursor: "pointer" }}>
                      <option value="newest">Newest</option>
                      <option value="votes">Most Votes</option>
                      <option value="unanswered">Unanswered</option>
                    </select>
                  </div>
                  {/* Urgency CTA when filtering open — fix #6 */}
                  {filterStatus === "open" && filteredPosts.length > 0 && (
                    <div style={{ padding: "10px 16px", background: "linear-gradient(90deg,#fff7ed,#fef3c7)", borderRadius: 10, border: "1px solid #fde68a", marginBottom: 12, fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                      🔥 Answer {Math.min(3, filteredPosts.length)} questions today → earn <strong>+10 XP bonus</strong>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#bbb", fontWeight: 600, marginBottom: 12 }}>{filteredPosts.length} question{filteredPosts.length !== 1 ? "s" : ""}{search && ` for "${search}"`}</div>
                  {filteredPosts.length === 0
                    ? <EmptyState message="No questions found" onAsk={profile ? () => setShowPostModal(true) : undefined} />
                    : filteredPosts.map((fp, idx) => <PostCard key={fp.id} fp={fp} idx={idx} onClick={() => setOpenPost(fp)} onLightbox={setLightbox} />)}
                </div>
              )}

              {/* ── GROUPS TAB ── */}
              {tab === "groups" && (
                <div>
                  {Object.entries(skillsByCategory).map(([category, catSkills]) => {
                    const cfg = CATEGORY_COLORS[category] || { bg: "#f0ece4", color: "#555", accent: "#888" };
                    return (
                      <div key={category} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                          <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[category]}</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: ".06em", textTransform: "uppercase" as const }}>{category}</span>
                          <span style={{ fontSize: 11, color: "#bbb" }}>{catSkills.length} skills</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                          {catSkills.map(skill => {
                            const qCount = posts.filter(p => p.skill_id === skill.id).length;
                            return (
                              <div key={skill.id} onClick={() => { setFilterSkill(skill.id); setTab("questions"); }}
                                style={{ background: "#fff", borderRadius: 12, border: "1.5px solid #e8e2d9", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all .15s" }}
                                onMouseOver={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,0,0,.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                                onMouseOut={e  => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: 13, color: "#1a1a1a", marginBottom: 4 }}>{skill.name}</div>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: cfg.bg, color: cfg.color }}>{qCount} Q{qCount !== 1 ? "s" : ""}</span>
                                </div>
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{CATEGORY_ICONS[category]}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── LEADERBOARD TAB ── fix #8 */}
              {tab === "leaderboard" && (
                <div>
                  <div style={{ background: "linear-gradient(135deg,#0a1a10,#1a3d2e,#2d6a4f)", borderRadius: 18, padding: "24px", marginBottom: 16, border: "1.5px solid rgba(255,215,0,.2)", position: "relative", overflow: "hidden" }}>
                    <Sparkles />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>🏆 Weekly Leaderboard</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 18 }}>Top contributors this week earn credits, XP multipliers & featured status</div>
                      {weeklyChamps.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,.3)", fontSize: 13 }}>No champions yet this week. Be the first!</div>
                      ) : weeklyChamps.map(c => {
                        const meta = c.rank === 1 ? { emoji: "🥇", color: "#ffd700" } : c.rank === 2 ? { emoji: "🥈", color: "#c8c8c8" } : { emoji: "🥉", color: "#cd7f32" };
                        const xp = getXPProgress(c.xp, c.xp_multiplier >= 1.25 ? "Expert" : "Skilled");
                        return (
                          <div key={c.user_id} style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                              <PremiumAvatar name={c.full_name} avatarUrl={c.avatar_url} size={38} xp_multiplier={c.xp_multiplier} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{c.full_name}</span>
                                  {c.champion_streak > 1 && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>🔥 {c.champion_streak}wk streak</span>}
                                  {c.accept_rate != null && c.accept_rate >= 80 && <span style={{ fontSize: 10, color: "#86efac", fontWeight: 700 }}>🎯 {c.accept_rate}%</span>}
                                </div>
                                {/* XP progress — fix #5 */}
                                <div style={{ height: 4, background: "rgba(255,255,255,.1)", borderRadius: 999, overflow: "hidden", marginBottom: 3 }}>
                                  <div style={{ height: "100%", width: `${xp.pct}%`, background: meta.color, borderRadius: 999 }} />
                                </div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>+{c.xp_earned} XP · {c.answers_accepted} accepted</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                {c.credits_bonus != null && <div style={{ fontSize: 12, fontWeight: 900, color: "#86efac" }}>+{c.credits_bonus} cr</div>}
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)"}}>{c.xp_multiplier}x XP</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>🏅 Top Contributors by Posts</div>
                    {Object.entries(
                      posts.reduce((acc, p) => {
                        const name = p.author?.full_name || "?";
                        acc[name] = { count: (acc[name]?.count || 0) + 1, ...p.author };
                        return acc;
                      }, {} as Record<string, any>)
                    ).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([name, info], i) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i > 0 ? "1px solid #f5f0e8" : "none" }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#ccc", width: 20 }}>#{i + 1}</span>
                        <PremiumAvatar name={name} level={info.level} avatarUrl={info.avatar_url} size={32} xp_multiplier={info.xp_multiplier} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
                          <div style={{ fontSize: 11, color: "#bbb" }}>{info.count} posts</div>
                        </div>
                        {info.level && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${LEVEL_COLORS[info.level] || "#2d6a4f"}15`, color: LEVEL_COLORS[info.level] || "#2d6a4f" }}>{info.level}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SIDEBAR */}
            <Sidebar
              profile={profile}
              posts={posts}
              skills={skills}
              champs={weeklyChamps}
              onFilterTag={handleFilterTag}
              onAnswerClick={handleCompete}
              podiumDismissed={podiumDismissed}
            />
          </div>
        </div>
      )}

      {/* ASK MODAL */}
      {showPostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20, animation: "fadeIn .2s ease" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "28px", maxWidth: 540, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.25)", animation: "fadeUp .25s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 900, color: "#111" }}>Ask a Question</h2>
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>The community is here to help 🌱</p>
              </div>
              <button onClick={() => setShowPostModal(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f0e8", border: "none", fontSize: 14, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", letterSpacing: ".06em", textTransform: "uppercase" as const, display: "block", marginBottom: 7 }}>Skill / Topic</label>
              <select value={newPost.skill_id} onChange={e => setNewPost(p => ({ ...p, skill_id: e.target.value }))} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13, background: "#fff", cursor: "pointer" }}>
                <option value="">Select a skill (optional)</option>
                {skills.map(s => <option key={s.id} value={s.id}>{CATEGORY_ICONS[s.category]} {s.name} — {s.category}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", letterSpacing: ".06em", textTransform: "uppercase" as const, display: "block", marginBottom: 7 }}>Question *</label>
              <input value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value.slice(0, 120) }))} placeholder="What do you want to know? Be specific…" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13 }} />
              <div style={{ fontSize: 11, color: "#ccc", textAlign: "right", marginTop: 3 }}>{newPost.title.length}/120</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", letterSpacing: ".06em", textTransform: "uppercase" as const, display: "block", marginBottom: 7 }}>Details *</label>
              <textarea value={newPost.body} onChange={e => setNewPost(p => ({ ...p, body: e.target.value.slice(0, 1000) }))} placeholder="Add context, what you've tried, what you need help with…" style={{ width: "100%", minHeight: 110, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2ddd6", fontSize: 13, resize: "vertical", lineHeight: 1.6 }} />
              <div style={{ fontSize: 11, color: "#ccc", textAlign: "right" }}>{newPost.body.length}/1000</div>
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: "#555", letterSpacing: ".06em", textTransform: "uppercase" as const, display: "block", marginBottom: 7 }}>Photo <span style={{ fontWeight: 500, color: "#bbb", textTransform: "none" as const, fontSize: 11, letterSpacing: 0 }}>(optional)</span></label>
              <ImageUploader onUploaded={url => setPostImageUrl(url)} label="📷 Attach a photo" />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowPostModal(false)} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#f5f0e8", color: "#666", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>Cancel</button>
              <button onClick={handlePostQuestion} disabled={!newPost.title.trim() || !newPost.body.trim() || posting}
                style={{ flex: 2, padding: "11px", borderRadius: 10, background: !newPost.title.trim() || !newPost.body.trim() ? "#e8e2d9" : "#2d6a4f", color: !newPost.title.trim() || !newPost.body.trim() ? "#bbb" : "#fff", fontWeight: 800, fontSize: 13, border: "none", cursor: !newPost.title.trim() || !newPost.body.trim() ? "not-allowed" : "pointer" }}>
                {posting ? "Posting…" : "Post Question →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}