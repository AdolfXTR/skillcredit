"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string; full_name: string; username: string; bio: string;
  location: string; credits: number; xp: number; level: string;
  role: string; avatar_url: string; created_at: string; is_verified?: boolean;
};
type Listing     = { id: string; title: string; format: string; duration: number; credit_price: number; is_active: boolean; skills: { name: string; category: string } };
type Transaction = { id: string; amount: number; type: string; description: string; created_at: string };
type UserSkill   = { id: string; skill_id: string; is_verified: boolean; verified_at: string | null; skills: { name: string; category: string } };

const BADGE_TIERS = [
  { name: "Seedling", emoji: "🌱", color: "#2d6a4f", bg: "#dcfce7", desc: "Just getting started",  xpReq: 0,    sessionsReq: 0,  ratingReq: 0   },
  { name: "Rising",   emoji: "⭐", color: "#b45309", bg: "#fef3c7", desc: "Building momentum",     xpReq: 100,  sessionsReq: 0,  ratingReq: 0   },
  { name: "Pro",      emoji: "🔥", color: "#7c3aed", bg: "#ede9fe", desc: "Proven skill sharer",   xpReq: 500,  sessionsReq: 5,  ratingReq: 0   },
  { name: "Elite",    emoji: "💎", color: "#dc2626", bg: "#fee2e2", desc: "Top performer",          xpReq: 2000, sessionsReq: 20, ratingReq: 4.0 },
  { name: "Legend",   emoji: "👑", color: "#d97706", bg: "#fffbeb", desc: "Community pillar",       xpReq: 5000, sessionsReq: 50, ratingReq: 4.5 },
];

function computeEarnedBadges(xp: number, sessions: number, bountiesWon: number, avgRating: number, listings: number) {
  const earned: { icon: string; name: string; desc: string }[] = [];
  if (xp >= 1)        earned.push({ icon: "🌱", name: "First Steps",     desc: "Joined SkillCredit and started your journey" });
  if (sessions >= 1)  earned.push({ icon: "📚", name: "First Session",    desc: "Completed your very first session" });
  if (sessions >= 5)  earned.push({ icon: "🥉", name: "Rising Teacher",   desc: "Completed 5 sessions" });
  if (sessions >= 20) earned.push({ icon: "🥈", name: "Skilled Teacher",  desc: "Completed 20 sessions" });
  if (sessions >= 50) earned.push({ icon: "🥇", name: "Top Teacher",      desc: "Completed 50 sessions" });
  if (bountiesWon >= 1) earned.push({ icon: "🎯", name: "First Bounty",   desc: "Won your first bounty challenge" });
  if (bountiesWon >= 5) earned.push({ icon: "🏹", name: "Bounty Hunter",  desc: "Won 5 bounties" });
  if (listings >= 1)  earned.push({ icon: "📋", name: "First Listing",    desc: "Created your first skill listing" });
  if (listings >= 3)  earned.push({ icon: "🎓", name: "Active Teacher",   desc: "Created 3 skill listings" });
  if (avgRating >= 4.5 && sessions >= 3) earned.push({ icon: "⭐", name: "Top Rated",   desc: "Maintained a 4.5+ rating" });
  if (avgRating >= 4.8 && sessions >= 5) earned.push({ icon: "💎", name: "Elite Rated", desc: "Maintained a 4.8+ rating with 5+ sessions" });
  if (xp >= 500)  earned.push({ icon: "⚡", name: "XP Grinder", desc: "Earned 500 XP" });
  if (xp >= 2000) earned.push({ icon: "🔥", name: "XP Legend",  desc: "Earned 2000 XP" });
  return earned;
}

function bayesianAvg(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const C = 5, m = 3.5;
  const sum = ratings.reduce((s, r) => s + r, 0);
  return (C * m + sum) / (C + ratings.length);
}

function getBadgeTier(xp: number, sessions: number, rating: number) {
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const t = BADGE_TIERS[i];
    if (xp >= t.xpReq && sessions >= t.sessionsReq && rating >= t.ratingReq) return t;
  }
  return BADGE_TIERS[0];
}
function getNextBadge(current: typeof BADGE_TIERS[0]) {
  const idx = BADGE_TIERS.findIndex(b => b.name === current.name);
  return idx < BADGE_TIERS.length - 1 ? BADGE_TIERS[idx + 1] : null;
}
function getLevelFromXP(xp: number) {
  if (xp >= 4000) return "Legend";
  if (xp >= 2000) return "Master";
  if (xp >= 1000) return "Expert";
  if (xp >= 600)  return "Skilled";
  if (xp >= 300)  return "Contributor";
  if (xp >= 100)  return "Learner";
  return "Seedling";
}

const LEVEL_COLOR: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};
const XP_TO_NEXT: Record<string, number> = {
  Seedling: 100, Learner: 300, Contributor: 600, Skilled: 1000,
  Expert: 2000, Master: 4000, Legend: 9999,
};

function calcRep(avgRating: number, sessions: number, repeatClients: number, disputes: number) {
  const r = Math.min(Math.round(avgRating * sessions * 4), 80);
  const s = Math.min(sessions * 2, 15);
  const c = Math.min(repeatClients * 5, 10);
  const d = disputes * -15;
  return Math.max(0, Math.min(r + s + c + d, 100));
}

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
}

const FORMAT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  video: { label: "Video", color: "#0369a1", bg: "#e0f2fe" },
  chat:  { label: "Chat",  color: "#065f46", bg: "#d1fae5" },
  docs:  { label: "Docs",  color: "#5b21b6", bg: "#ede9fe" },
  mixed: { label: "Mixed", color: "#92400e", bg: "#fef3c7" },
};
const TX_ICONS: Record<string, string> = {
  signup_bonus: "🎁", session_earn: "📚", session_spend: "💳",
  bounty_earn: "🏆", topup: "💳", challenge: "⚡", session_refund: "↩️",
};

// ── AVATAR COMPONENT ─────────────────────────────────────────────────────────
function AvatarUploader({
  userId, currentUrl, initials, lvlColor,
  onUploaded,
}: {
  userId: string; currentUrl: string | null; initials: string;
  lvlColor: string; onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(currentUrl || null);
  const [err, setErr]             = useState("");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setErr("Please pick an image."); return; }
    if (file.size > 3 * 1024 * 1024)    { setErr("Max 3 MB.");             return; }
    setErr(""); setUploading(true);

    const ext  = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) { setErr("Upload failed."); setUploading(false); return; }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = data.publicUrl + `?t=${Date.now()}`; // bust cache
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
    setPreview(url);
    onUploaded(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
      {/* Avatar circle */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer"
        style={{ background: preview ? "transparent" : `linear-gradient(135deg,${lvlColor},${lvlColor}99)`, boxShadow: `0 6px 20px ${lvlColor}33` }}
        title="Click to change photo"
      >
        {preview ? (
          <img src={preview} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-xl font-900">{initials}</span>
        )}
      </div>

      {/* Camera badge */}
      <button
        onClick={() => !uploading && inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-stone-100 flex items-center justify-center cursor-pointer hover:bg-stone-50 transition-colors"
        style={{ fontSize: 11, boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}
        title="Upload photo"
      >
        {uploading ? <span style={{ animation: "spin .8s linear infinite", display: "inline-block" }}>⟳</span> : "📷"}
      </button>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      {err && (
        <div className="absolute top-full left-0 mt-1 text-xs text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded-lg whitespace-nowrap z-10">
          {err}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile]             = useState<Profile | null>(null);
  const [listings, setListings]           = useState<Listing[]>([]);
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [userSkills, setUserSkills]       = useState<UserSkill[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<"listings"|"badges"|"activity">("listings");
  const [editing, setEditing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [editForm, setEditForm]           = useState({ full_name: "", bio: "", location: "" });
  const [sessions, setSessions]           = useState(0);
  const [avgRating, setAvgRating]         = useState(0);
  const [repeatClients, setRepeatClients] = useState(0);
  const [disputes, setDisputes]           = useState(0);
  const [bountiesWon, setBountiesWon]     = useState(0);

  const [editingListing, setEditingListing]   = useState<Listing | null>(null);
  const [editListingForm, setEditListingForm] = useState({ title: "", description: "", prerequisites: "", outcomes: "", materials: "", credit_price: 10, is_active: true });
  const [savingListing, setSavingListing]     = useState(false);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [listingError, setListingError]       = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) {
        setProfile(prof);
        setEditForm({ full_name: prof.full_name || "", bio: prof.bio || "", location: prof.location || "" });
      }

      const [
        { data: l }, { data: tx },
        { count: sCount }, { data: ratingData }, { data: sessionData },
        { count: dCount }, { data: skillsData }, { count: bCount },
      ] = await Promise.all([
        supabase.from("listings").select("*, skills(name,category)").eq("teacher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("sessions").select("*", { count: "exact", head: true }).or(`teacher_id.eq.${user.id},learner_id.eq.${user.id}`).eq("status", "completed"),
        supabase.from("ratings").select("overall").eq("rated_id", user.id),
        supabase.from("sessions").select("learner_id").eq("teacher_id", user.id).eq("status", "completed"),
        supabase.from("sessions").select("*", { count: "exact", head: true }).eq("teacher_id", user.id).eq("status", "disputed"),
        supabase.from("user_skills").select("*, skills(name,category)").eq("user_id", user.id).order("is_verified", { ascending: false }),
        supabase.from("bounty_answers").select("*", { count: "exact", head: true }).eq("answerer_id", user.id).not("placement", "is", null),
      ]);

      setListings((l as Listing[]) || []);
      setTransactions(tx || []);
      setSessions(sCount || 0);
      setUserSkills((skillsData as UserSkill[]) || []);
      setBountiesWon(bCount || 0);

      if (ratingData && ratingData.length > 0) {
        const bayes = bayesianAvg(ratingData.map((r: { overall: number }) => r.overall));
        setAvgRating(parseFloat(bayes.toFixed(2)));
      }

      if (sessionData) {
        const counts: Record<string, number> = {};
        sessionData.forEach((s: { learner_id: string }) => { counts[s.learner_id] = (counts[s.learner_id] || 0) + 1; });
        setRepeatClients(Object.values(counts).filter(c => c > 1).length);
      }
      setDisputes(dCount || 0);
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { data } = await supabase.from("profiles").update(editForm).eq("id", profile.id).select().single();
    if (data) setProfile(data);
    setSaving(false); setEditing(false);
  };

  const openEditListing = async (listing: Listing) => {
    setListingError("");
    setEditingListing(listing);
    setEditListingForm({ title: listing.title, description: "", prerequisites: "", outcomes: "", materials: "", credit_price: listing.credit_price, is_active: listing.is_active });
    const { data } = await supabase.from("listings").select("*").eq("id", listing.id).single();
    if (data) setEditListingForm({ title: data.title || "", description: data.description || "", prerequisites: data.prerequisites || "", outcomes: data.outcomes || "", materials: data.materials || "", credit_price: data.credit_price, is_active: data.is_active });
  };

  const handleSaveListing = async () => {
    if (!editingListing || !profile) return;
    setSavingListing(true); setListingError("");
    const { error } = await supabase.from("listings").update({ title: editListingForm.title, description: editListingForm.description, prerequisites: editListingForm.prerequisites, outcomes: editListingForm.outcomes, materials: editListingForm.materials, credit_price: editListingForm.credit_price, is_active: editListingForm.is_active }).eq("id", editingListing.id);
    if (error) { setListingError("Failed to save. Try again."); setSavingListing(false); return; }
    const { data: l } = await supabase.from("listings").select("*, skills(name,category)").eq("teacher_id", profile.id).order("created_at", { ascending: false });
    setListings((l as Listing[]) || []);
    setSavingListing(false); setEditingListing(null);
  };

  const handleDeleteListing = async (id: string) => {
    setDeletingId(id);
    await supabase.from("listings").delete().eq("id", id);
    setListings(prev => prev.filter(l => l.id !== id));
    setDeletingId(null); setConfirmDeleteId(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#2d6a4f] border-t-transparent mx-auto mb-3" style={{ animation: "spin .8s linear infinite" }} />
        <p className="text-xs font-semibold text-stone-400 tracking-widest uppercase">Loading profile</p>
      </div>
    </div>
  );
  if (!profile) return null;

  const verifiedSkills   = userSkills.filter(s => s.is_verified);
  const unverifiedSkills = userSkills.filter(s => !s.is_verified);
  const displayLevel     = getLevelFromXP(profile.xp);
  const lvlColor         = LEVEL_COLOR[displayLevel] || "#2d6a4f";
  const badge            = getBadgeTier(profile.xp, sessions, avgRating);
  const nextBadge        = getNextBadge(badge);
  const rep              = calcRep(avgRating, sessions, repeatClients, disputes);
  const repLabel         = rep >= 80 ? "Exceptional" : rep >= 60 ? "Great" : rep >= 40 ? "Good" : rep >= 20 ? "Fair" : "Building";
  const xpNext           = XP_TO_NEXT[displayLevel] || 100;
  const xpPct            = Math.min((profile.xp / xpNext) * 100, 100);
  const joinDate         = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });
  const earnedBadges     = computeEarnedBadges(profile.xp, sessions, bountiesWon, avgRating, listings.length);

  return (
    <div className="min-h-screen bg-[#faf8f4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes popIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fade-up{animation:fadeUp .35s ease both}
        .card{background:#fff;border-radius:20px;border:1.5px solid #e8e2d9}
        .navlink{padding:5px 11px;border-radius:7px;font-size:13px;font-weight:600;color:#666;transition:all .12s;display:inline-block}
        .navlink:hover{background:#f0ece4;color:#1a1a1a}
        .listing-row{transition:box-shadow .15s,transform .15s}
        .listing-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
        .tx-row:hover{background:#faf8f4}
        .stat-card{transition:all .15s}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.07)}
        .progress-bar{height:4px;background:#f0ece4;border-radius:999px;overflow:hidden}
        .progress-fill{height:100%;border-radius:999px;transition:width .6s}
        .quick-link:hover{background:#e8f5ee!important;color:#2d6a4f!important}
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:480px;box-shadow:0 24px 64px rgba(0,0,0,.18);animation:popIn .18s ease;max-height:90vh;overflow-y:auto}
      `}</style>

      {/* LISTING EDIT MODAL */}
      {editingListing && (
        <div className="modal-backdrop" onClick={() => setEditingListing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a", marginBottom: 4 }}>Edit Listing ✏️</h2>
            <p style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>Update your listing. Price changes affect future bookings only.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "title",         label: "Title *",                    type: "input"    },
                { key: "description",   label: "Description",                type: "textarea" },
                { key: "outcomes",      label: "What learners will achieve", type: "textarea" },
                { key: "prerequisites", label: "Prerequisites",              type: "input"    },
                { key: "materials",     label: "Materials",                  type: "input"    },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea value={editListingForm[f.key as keyof typeof editListingForm] as string} rows={3}
                      onChange={e => setEditListingForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "#fafaf8", outline: "none", resize: "vertical" }} />
                  ) : (
                    <input value={editListingForm[f.key as keyof typeof editListingForm] as string}
                      onChange={e => setEditListingForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: "100%", padding: "10px 13px", borderRadius: 11, border: "1.5px solid #e8e2d9", fontSize: 13, fontFamily: "'DM Sans',sans-serif", background: "#fafaf8", outline: "none" }} />
                  )}
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: "#aaa", textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Credit Price</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setEditListingForm(p => ({ ...p, credit_price: Math.max(5, p.credit_price - 5) }))} style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e8e2d9", background: "#fafaf8", fontSize: 18, cursor: "pointer" }}>-</button>
                  <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 900, color: "#2d6a4f" }}>{editListingForm.credit_price} cr</div>
                  <button onClick={() => setEditListingForm(p => ({ ...p, credit_price: Math.min(100, p.credit_price + 5) }))} style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e8e2d9", background: "#fafaf8", fontSize: 18, cursor: "pointer" }}>+</button>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 11, cursor: "pointer" }}
                onClick={() => setEditListingForm(p => ({ ...p, is_active: !p.is_active }))}>
                <div style={{ width: 38, height: 22, borderRadius: 999, background: editListingForm.is_active ? "#2d6a4f" : "#d1cec7", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 3, left: editListingForm.is_active ? 18 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: editListingForm.is_active ? "#2d6a4f" : "#888" }}>
                  {editListingForm.is_active ? "Active - visible to learners" : "Paused - hidden from browse"}
                </span>
              </div>
            </div>
            {listingError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 10 }}>{listingError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditingListing(null)} style={{ flex: 1, padding: "10px", borderRadius: 11, background: "#f5f0e8", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#666" }}>Cancel</button>
              <button onClick={handleSaveListing} disabled={savingListing || !editListingForm.title.trim()} style={{ flex: 2, padding: "10px", borderRadius: 11, background: savingListing ? "#aaa" : "#2d6a4f", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#fff" }}>
                {savingListing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDeleteId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🗑️</div>
              <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 900, color: "#1a1a1a", marginBottom: 6 }}>Delete Listing?</h3>
              <p style={{ fontSize: 13, color: "#888" }}>This permanently removes the listing. Pending bookings will be cancelled.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 11, background: "#f5f0e8", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#666" }}>Cancel</button>
              <button onClick={() => handleDeleteListing(confirmDeleteId)} disabled={deletingId === confirmDeleteId} style={{ flex: 1, padding: "10px", borderRadius: 11, background: "#dc2626", border: "none", fontSize: 13, fontWeight: 800, cursor: "pointer", color: "#fff" }}>
                {deletingId === confirmDeleteId ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 px-6 h-14 flex items-center justify-between">
        <a href="/dashboard">
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 19, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div className="flex gap-0.5">
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className="navlink">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="/wallet" className="text-xs font-800 text-[#2d6a4f] bg-green-50 px-3.5 py-1.5 rounded-full border border-green-200">
            💰 {profile.credits} cr
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            className="text-xs font-600 text-red-500 bg-red-50 px-3.5 py-1.5 rounded-full border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Log out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-8 pb-20">

        {/* PROFILE HERO */}
        <div className="card overflow-hidden mb-4 fade-up" style={{ borderLeft: `3px solid ${lvlColor}` }}>
          <div className="p-6">
            {editing ? (
              <div className="max-w-md">
                <h2 className="text-xl font-900 text-stone-900 mb-5" style={{ fontFamily: "'Fraunces', serif" }}>Edit Profile</h2>

                {/* Avatar uploader inside edit form */}
                <div className="flex items-center gap-4 mb-5 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                  <AvatarUploader
                    userId={profile.id}
                    currentUrl={profile.avatar_url || null}
                    initials={getInitials(profile.full_name || "")}
                    lvlColor={lvlColor}
                    onUploaded={url => setProfile(p => p ? { ...p, avatar_url: url } : p)}
                  />
                  <div>
                    <p className="text-sm font-700 text-stone-700 mb-0.5">Profile Photo</p>
                    <p className="text-xs text-stone-400 leading-relaxed">Click the avatar or 📷 button to upload.<br/>JPG, PNG, WEBP · Max 3 MB</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {[
                    { key: "full_name", label: "Full Name",  placeholder: "Your full name",                    type: "input"    },
                    { key: "location",  label: "Location",   placeholder: "e.g. Cebu City, Philippines",       type: "input"    },
                    { key: "bio",       label: "Bio",        placeholder: "Tell the community about yourself…", type: "textarea" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-800 text-stone-400 uppercase tracking-widest block mb-1.5">{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea value={editForm[f.key as keyof typeof editForm]} rows={3} placeholder={f.placeholder}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-sm outline-none focus:border-[#2d6a4f] transition-colors resize-none"
                          style={{ fontFamily: "'DM Sans', sans-serif" }} />
                      ) : (
                        <input value={editForm[f.key as keyof typeof editForm]} placeholder={f.placeholder}
                          onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full p-3 rounded-xl border border-stone-200 bg-stone-50 text-sm outline-none focus:border-[#2d6a4f] transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }} />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm font-700 hover:bg-stone-200 transition-colors border-0 cursor-pointer" style={{ fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="py-2.5 px-8 bg-[#2d6a4f] text-white rounded-xl text-sm font-800 hover:bg-[#1a4a36] transition-colors border-0 cursor-pointer disabled:opacity-60" style={{ fontFamily: "'DM Sans', sans-serif", flex: 2 }}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-5 flex-wrap">
                {/* Avatar in view mode — click to open edit */}
                <div className="relative shrink-0 cursor-pointer" onClick={() => setEditing(true)} title="Edit profile photo">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
                    style={{ background: profile.avatar_url ? "transparent" : `linear-gradient(135deg,${lvlColor},${lvlColor}99)`, boxShadow: `0 6px 20px ${lvlColor}33` }}>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xl font-900">{getInitials(profile.full_name || "")}</span>
                    )}
                  </div>
                  {/* Small camera hint */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center" style={{ fontSize: 10, boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>📷</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{profile.full_name || "Unnamed User"}</h1>
                    <span className="text-xs font-800 px-2.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.emoji} {badge.name}</span>
                    <span className="text-xs font-700 px-2.5 py-0.5 rounded-full" style={{ background: `${lvlColor}15`, color: lvlColor }}>{displayLevel}</span>
                    {profile.is_verified && <span className="text-xs font-700 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Verified</span>}
                  </div>
                  <p className="text-xs text-stone-400 mb-3">@{profile.username}</p>
                  {profile.bio ? <p className="text-sm text-stone-500 leading-relaxed mb-3 max-w-lg">{profile.bio}</p>
                    : <p className="text-sm text-stone-300 italic mb-3">No bio yet — add one to stand out!</p>}
                  {verifiedSkills.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="text-xs font-700 text-stone-400">Verified in:</span>
                      {verifiedSkills.slice(0, 4).map(s => (
                        <span key={s.id} className="text-xs font-700 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">✓ {s.skills?.name}</span>
                      ))}
                      {verifiedSkills.length > 4 && <span className="text-xs text-stone-400">+{verifiedSkills.length - 4} more</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-4 flex-wrap text-xs text-stone-400">
                    {profile.location && <span>📍 {profile.location}</span>}
                    <span>📅 Joined {joinDate}</span>
                    {avgRating > 0 && <span>⭐ {avgRating.toFixed(2)} avg rating</span>}
                    <span>🏅 {earnedBadges.length} badge{earnedBadges.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-stone-100 text-stone-600 text-xs font-700 rounded-xl border border-stone-200 hover:bg-stone-200 transition-colors cursor-pointer shrink-0"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}>✏️ Edit Profile</button>
              </div>
            )}
            {!editing && (
              <div className="mt-5 pt-5 border-t border-stone-100">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-700 text-stone-500">⚡ {profile.xp} XP · {displayLevel}</span>
                  <span className="text-xs text-stone-300">{xpNext - profile.xp > 0 ? `${xpNext - profile.xp} XP to next level` : "Max level!"}</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg,${lvlColor},${lvlColor}88)` }} /></div>
              </div>
            )}
          </div>
        </div>

        {/* STATS STRIP */}
        {!editing && (
          <div className="grid grid-cols-5 gap-3 mb-4 fade-up" style={{ animationDelay: ".06s" }}>
            {[
              { label: "Credits",  value: profile.credits,    icon: "💰", color: "#2d6a4f", href: "/wallet"          },
              { label: "XP",       value: profile.xp,         icon: "⚡", color: "#7c3aed", href: "/leaderboard"     },
              { label: "Sessions", value: sessions,            icon: "📚", color: "#0891b2", href: "/sessions"        },
              { label: "Listings", value: listings.length,     icon: "📋", color: "#b45309", href: "/listings/create" },
              { label: "Badges",   value: earnedBadges.length, icon: "🏅", color: "#dc2626", href: "#"               },
            ].map(s => (
              <a key={s.label} href={s.href}
                onClick={s.label === "Badges" ? e => { e.preventDefault(); setActiveTab("badges"); } : undefined}
                className="card stat-card p-4 text-center block">
                <div className="text-2xl font-900 leading-none mb-1" style={{ fontFamily: "'Fraunces', serif", color: s.color }}>{s.value}</div>
                <div className="text-xs text-stone-400 font-700 uppercase tracking-wider">{s.label}</div>
              </a>
            ))}
          </div>
        )}

        {/* MAIN GRID */}
        {!editing && (
          <div className="grid gap-4 fade-up" style={{ gridTemplateColumns: "1fr 280px", animationDelay: ".1s" }}>
            <div className="flex flex-col gap-4">

              {/* SKILLS */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-800 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>Skills & Verifications</h3>
                    <p className="text-xs text-stone-400 mt-0.5">Skills you've listed or been verified in</p>
                  </div>
                  <a href="/verify" className="text-xs font-700 text-[#2d6a4f] bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">+ Get Verified</a>
                </div>
                {verifiedSkills.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">✓ Verified</p>
                    <div className="flex flex-wrap gap-2">
                      {verifiedSkills.map(s => (
                        <span key={s.id} className="text-xs font-700 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          ✓ {s.skills?.name} <span className="text-green-500 font-500">· {s.skills?.category}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {unverifiedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">○ Unverified</p>
                    <div className="flex flex-wrap gap-2">
                      {unverifiedSkills.map(s => (
                        <span key={s.id} className="text-xs font-600 px-3 py-1 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                          {s.skills?.name} <a href="/verify" className="text-[#2d6a4f] font-700 ml-1">verify →</a>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {userSkills.length === 0 && (
                  <div className="flex items-center gap-4 bg-green-50 rounded-xl p-4 border border-green-200">
                    <span className="text-3xl">✅</span>
                    <div className="flex-1">
                      <p className="text-sm font-700 text-stone-800 mb-0.5">Get your skills verified!</p>
                      <p className="text-xs text-stone-500">Verified teachers get <strong>2x more bookings</strong>.</p>
                    </div>
                    <a href="/verify" className="text-xs font-800 text-white bg-[#2d6a4f] px-3 py-2 rounded-lg hover:bg-[#1a4a36] transition-colors whitespace-nowrap">Verify Now →</a>
                  </div>
                )}
              </div>

              {/* TABS */}
              <div>
                <div className="flex bg-stone-100 p-1 rounded-xl gap-0.5 w-fit mb-4">
                  {[{k:"listings",l:"Listings"},{k:"badges",l:`Badges (${earnedBadges.length})`},{k:"activity",l:"Activity"}].map(t => (
                    <button key={t.k} onClick={() => setActiveTab(t.k as "listings"|"badges"|"activity")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-700 transition-all border-0 cursor-pointer ${activeTab === t.k ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600 bg-transparent"}`}
                      style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {activeTab === "listings" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>My Skill Listings</h3>
                      <a href="/listings/create" className="text-xs font-700 text-white bg-[#2d6a4f] px-4 py-2 rounded-xl hover:bg-[#1a4a36] transition-colors">+ Create Listing</a>
                    </div>
                    {listings.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">📋</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No listings yet</h4>
                        <p className="text-xs text-stone-400 mb-5">Create a skill listing to start teaching!</p>
                        <a href="/listings/create" className="inline-block text-xs font-700 text-white bg-[#2d6a4f] px-5 py-2.5 rounded-xl hover:bg-[#1a4a36] transition-colors">Create your first listing →</a>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {listings.map(listing => {
                          const fmt = FORMAT_CONFIG[listing.format] || FORMAT_CONFIG.mixed;
                          return (
                            <div key={listing.id} className="listing-row card px-5 py-4 flex items-center gap-4 justify-between flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                  <span className="text-xs font-700 px-2.5 py-0.5 rounded-full" style={{ background: fmt.bg, color: fmt.color }}>{fmt.label}</span>
                                  {listing.skills && <span className="text-xs text-stone-400">{listing.skills.name}</span>}
                                  <span className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${listing.is_active ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                                    {listing.is_active ? "● Active" : "○ Paused"}
                                  </span>
                                </div>
                                <p className="text-sm font-800 text-stone-900 mb-0.5" style={{ fontFamily: "'Fraunces', serif" }}>{listing.title}</p>
                                <p className="text-xs text-stone-400">{listing.duration} min session</p>
                              </div>
                              <div className="text-right shrink-0 mr-2">
                                <div className="text-xl font-900 text-[#2d6a4f]" style={{ fontFamily: "'Fraunces', serif" }}>{listing.credit_price} cr</div>
                                <div className="text-xs text-stone-400">per session</div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button onClick={() => openEditListing(listing)} style={{ padding: "6px 14px", borderRadius: 9, background: "#f5f0e8", border: "1.5px solid #e8e2d9", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#555", fontFamily: "'DM Sans',sans-serif" }}>✏️ Edit</button>
                                <button onClick={() => setConfirmDeleteId(listing.id)} style={{ padding: "6px 14px", borderRadius: 9, background: "#fef2f2", border: "1.5px solid #fecaca", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#dc2626", fontFamily: "'DM Sans',sans-serif" }}>🗑</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "badges" && (
                  <div>
                    <h3 className="text-base font-900 text-stone-900 mb-3" style={{ fontFamily: "'Fraunces', serif" }}>Earned Badges</h3>
                    {earnedBadges.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">🏅</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No badges yet</h4>
                        <p className="text-xs text-stone-400">Complete sessions, answer bounties, and participate!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {earnedBadges.map((b, i) => (
                          <div key={i} className="card p-5 text-center">
                            <div className="text-4xl mb-3">{b.icon}</div>
                            <p className="text-sm font-800 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>{b.name}</p>
                            <p className="text-xs text-stone-400 leading-relaxed">{b.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "activity" && (
                  <div>
                    <h3 className="text-base font-900 text-stone-900 mb-3" style={{ fontFamily: "'Fraunces', serif" }}>Credit Activity</h3>
                    {transactions.length === 0 ? (
                      <div className="card p-12 text-center">
                        <p className="text-4xl mb-3">📊</p>
                        <h4 className="text-base font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>No transactions yet</h4>
                        <p className="text-xs text-stone-400">Your credit history will appear here.</p>
                      </div>
                    ) : (
                      <div className="card overflow-hidden">
                        {transactions.map((tx, i) => (
                          <div key={tx.id} className="tx-row flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: i < transactions.length - 1 ? "1px solid #f5f0e8" : "none" }}>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${tx.amount > 0 ? "bg-green-50" : "bg-red-50"}`}>{TX_ICONS[tx.type] || "💳"}</div>
                              <div>
                                <p className="text-sm font-600 text-stone-700">{tx.description || tx.type.replace(/_/g, " ")}</p>
                                <p className="text-xs text-stone-400">{new Date(tx.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                            <div className="text-base font-900 shrink-0" style={{ fontFamily: "'Fraunces', serif", color: tx.amount > 0 ? "#2d6a4f" : "#dc2626" }}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="flex flex-col gap-3">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-800 text-stone-400 uppercase tracking-widest">Badge Tier</p>
                  <span className="text-xs font-800 px-2.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{badge.emoji} {badge.name}</span>
                </div>
                <div className="rounded-xl p-3 mb-4 flex items-center gap-3 border" style={{ background: badge.bg, borderColor: `${badge.color}22` }}>
                  <span className="text-3xl">{badge.emoji}</span>
                  <div>
                    <p className="text-sm font-900" style={{ fontFamily: "'Fraunces', serif", color: badge.color }}>{badge.name}</p>
                    <p className="text-xs font-500" style={{ color: badge.color, opacity: 0.75 }}>{badge.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: "⚡", val: profile.xp,          label: "XP"       },
                    { icon: "📚", val: sessions,             label: "Sessions" },
                    { icon: "⭐", val: avgRating.toFixed(2), label: "Rating"   },
                  ].map(s => (
                    <div key={s.label} className="bg-stone-50 rounded-xl p-2.5 text-center">
                      <div className="text-sm mb-1">{s.icon}</div>
                      <div className="text-base font-900 text-stone-900" style={{ fontFamily: "'Fraunces', serif" }}>{s.val}</div>
                      <div className="text-xs text-stone-400 font-600 uppercase tracking-wide" style={{ fontSize: 9 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {nextBadge && (
                  <div>
                    <p className="text-xs font-700 text-stone-600 mb-3">Next: {nextBadge.emoji} {nextBadge.name}</p>
                    {[
                      { label: "XP",       current: profile.xp, req: nextBadge.xpReq       },
                      { label: "Sessions", current: sessions,    req: nextBadge.sessionsReq  },
                      { label: "Rating",   current: avgRating,   req: nextBadge.ratingReq    },
                    ].filter(r => r.req > 0).map(r => {
                      const done = r.current >= r.req;
                      const pct  = Math.min((r.current / r.req) * 100, 100);
                      return (
                        <div key={r.label} className="mb-2.5">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-stone-500 font-600">{r.label}</span>
                            <span className={`text-xs font-700 ${done ? "text-[#2d6a4f]" : "text-stone-400"}`}>
                              {done ? "✓" : `${typeof r.current === "number" && r.current % 1 !== 0 ? r.current.toFixed(2) : r.current} / ${r.req}`}
                            </span>
                          </div>
                          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: done ? "#2d6a4f" : "#cbd5e1" }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="pt-3 mt-1 border-t border-stone-100">
                  <p className="text-xs font-700 text-stone-300 uppercase tracking-widest mb-2" style={{ fontSize: 9 }}>All Tiers</p>
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_TIERS.map(t => (
                      <span key={t.name} className="text-xs font-700 px-2 py-0.5 rounded-full" style={{ background: t.name === badge.name ? t.bg : "#f5f0e8", color: t.name === badge.name ? t.color : "#ccc" }}>
                        {t.emoji} {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-3">Reputation Score</p>
                <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-center justify-between border border-amber-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💫</span>
                    <div>
                      <div className="text-2xl font-900 text-amber-700 leading-none" style={{ fontFamily: "'Fraunces', serif" }}>{rep}<span className="text-sm text-amber-400">/100</span></div>
                      <div className="text-xs font-700 text-amber-700">{repLabel}</div>
                    </div>
                  </div>
                  <svg viewBox="0 0 52 52" className="w-11 h-11 shrink-0" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#fde68a" strokeWidth="5" />
                    <circle cx="26" cy="26" r="21" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray={`${(Math.min(rep, 100) / 100) * 131.9} 131.9`} strokeLinecap="round" />
                  </svg>
                </div>
                {[
                  { icon: "⭐", label: "Rating",   pts: Math.min(Math.round(avgRating * sessions * 4), 80), max: 80, detail: `${avgRating.toFixed(2)} avg × ${sessions} sessions` },
                  { icon: "📚", label: "Sessions", pts: Math.min(sessions * 2, 15),                         max: 15, detail: `${sessions} × 2 pts` },
                  { icon: "🔄", label: "Repeats",  pts: Math.min(repeatClients * 5, 10),                    max: 10, detail: `${repeatClients} repeat clients × 5` },
                  { icon: "⚠️", label: "Disputes", pts: disputes * -15,                                      max: 0,  detail: disputes === 0 ? "No disputes ✓" : `${disputes} × -15` },
                ].map(r => (
                  <div key={r.label} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-700 text-stone-600">{r.icon} {r.label}</span>
                      <span className={`text-xs font-800 ${r.pts > 0 ? "text-[#2d6a4f]" : r.pts < 0 ? "text-red-500" : "text-stone-400"}`}>
                        {r.pts > 0 ? `+${r.pts}` : r.pts < 0 ? `${r.pts}` : "✓"}{r.pts !== 0 ? " pts" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mb-1">{r.detail}</p>
                    {r.max > 0 && <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min((r.pts / r.max) * 100, 100)}%`, background: "#f59e0b" }} /></div>}
                  </div>
                ))}
              </div>

              <div className="card p-4">
                <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">Quick Links</p>
                {[["✅","Get Verified","/verify"],["🎓","Create Listing","/listings/create"],["⭐","My Ratings","/ratings"],["🏆","Leaderboard","/leaderboard"],["💰","Wallet","/wallet"]].map(([icon,label,href]) => (
                  <a key={label} href={href} className="quick-link flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-stone-500 text-xs font-600 transition-all">
                    <span>{icon}</span><span className="flex-1">{label}</span><span className="text-stone-300">›</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}