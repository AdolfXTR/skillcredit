"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string;
  location: string;
  credits: number;
  xp: number;
  level: string;
  role: string;
  avatar_url: string;
  created_at: string;
};

type Badge = {
  id: string;
  badge_type: string;
  badge_name: string;
  description: string;
  earned_at: string;
};

type Listing = {
  id: string;
  title: string;
  format: string;
  duration: number;
  credit_price: number;
  is_active: boolean;
  skills: { name: string; category: string };
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

const LEVEL_CONFIG: Record<string, { color: string; bg: string; next: number; icon: string }> = {
  Seedling:    { color: "#2d6a4f", bg: "#e8f4e8", next: 100,  icon: "🌱" },
  Learner:     { color: "#1d6fb8", bg: "#e3f0fb", next: 300,  icon: "📚" },
  Contributor: { color: "#7c3aed", bg: "#f0ebff", next: 600,  icon: "⚡" },
  Skilled:     { color: "#b45309", bg: "#fff8e7", next: 1000, icon: "🔥" },
  Expert:      { color: "#dc2626", bg: "#fef2f2", next: 2000, icon: "💡" },
  Master:      { color: "#059669", bg: "#ecfdf5", next: 4000, icon: "🏆" },
  Legend:      { color: "#d97706", bg: "#fffbeb", next: 9999, icon: "💎" },
};

const BADGE_ICONS: Record<string, string> = {
  early_adopter: "🌟",
  rising_teacher: "🥉",
  skilled_teacher: "🥈",
  top_teacher: "🥇",
  expert_teacher: "💎",
  first_session: "📚",
  curious_learner: "📖",
  first_bounty: "🎯",
  problem_solver: "💪",
  helpful_voice: "💬",
  connector: "👥",
  on_fire: "🔥",
};

const FORMAT_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  video: { bg: "#e3f0fb", color: "#1d6fb8", label: "📹 Video" },
  chat:  { bg: "#e8f4e8", color: "#2d6a4f", label: "💬 Chat" },
  docs:  { bg: "#f0ebff", color: "#7c3aed", label: "📄 Docs" },
  mixed: { bg: "#fff8e7", color: "#b45309", label: "🎨 Mixed" },
};

const TX_ICONS: Record<string, string> = {
  signup_bonus:   "🎁",
  session_earn:   "📚",
  session_spend:  "💳",
  bounty_earn:    "🏆",
  bounty_spend:   "🎯",
  referral:       "👥",
  challenge:      "⚡",
  purchase:       "💰",
  forum_earn:     "💬",
};

const mockProfile: Profile = {
  id: "mock",
  full_name: "Your Name",
  username: "username",
  bio: "Add a bio to tell the community about yourself!",
  location: "Philippines",
  credits: 20,
  xp: 0,
  level: "Seedling",
  role: "user",
  avatar_url: "",
  created_at: new Date().toISOString(),
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"listings" | "activity" | "badges">("listings");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", bio: "", location: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (prof) {
        setProfile(prof);
        setEditForm({ full_name: prof.full_name || "", bio: prof.bio || "", location: prof.location || "" });
      } else {
        setProfile(mockProfile);
      }

      const { data: b } = await supabase.from("badges").select("*").eq("user_id", user.id).order("earned_at", { ascending: false });
      setBadges(b || []);

      const { data: l } = await supabase
        .from("listings")
        .select("*, skills(name, category)")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      setListings((l as Listing[]) || []);

      const { data: tx } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setTransactions(tx || []);

      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { data } = await supabase
      .from("profiles")
      .update({ full_name: editForm.full_name, bio: editForm.bio, location: editForm.location })
      .eq("id", profile.id)
      .select()
      .single();
    if (data) setProfile(data);
    setSaving(false);
    setEditing(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <p style={{ color: "#888" }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const levelConfig = LEVEL_CONFIG[profile.level] || LEVEL_CONFIG["Seedling"];
  const xpProgress = Math.min((profile.xp / levelConfig.next) * 100, 100);
  const joinDate = new Date(profile.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long" });
  const initials = profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse Skills</a>
          <a href="/bounties" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Bounties</a>
          <a href="/dashboard" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Dashboard</a>
          <div style={{ background: "#e8f4e8", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>
            💰 {profile.credits} credits
          </div>
          <button onClick={handleLogout} style={{ padding: "7px 14px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Log out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* Profile Card */}
        <div style={{ background: "white", borderRadius: 24, padding: "32px", marginBottom: 24, border: "1px solid #e8e0d0", position: "relative", overflow: "hidden" }}>
          {/* Decorative top bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg, ${levelConfig.color}, ${levelConfig.color}88)` }} />

          {editing ? (
            /* Edit mode */
            <div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 24 }}>Edit Profile</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Full Name</label>
                  <input
                    value={editForm.full_name}
                    onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                    rows={3}
                    placeholder="Tell the community about yourself..."
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box", resize: "vertical" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 6 }}>Location</label>
                  <input
                    value={editForm.location}
                    onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Manila, Philippines"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setEditing(false)} style={{ padding: "11px 20px", borderRadius: 10, background: "#f5f0e8", color: "#555", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} style={{ padding: "11px 24px", borderRadius: 10, background: saving ? "#a8c5b5" : "#2d6a4f", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* View mode */
            <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
              {/* Avatar */}
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: levelConfig.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: levelConfig.color, border: `3px solid ${levelConfig.color}33`, flexShrink: 0 }}>
                {initials}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>
                    {profile.full_name || "Unnamed User"}
                  </h1>
                  <span style={{ background: levelConfig.bg, color: levelConfig.color, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
                    {levelConfig.icon} {profile.level}
                  </span>
                </div>

                <p style={{ fontSize: 14, color: "#888", margin: "0 0 8px" }}>@{profile.username}</p>

                {profile.bio ? (
                  <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: "0 0 10px", maxWidth: 480 }}>{profile.bio}</p>
                ) : (
                  <p style={{ fontSize: 14, color: "#bbb", margin: "0 0 10px", fontStyle: "italic" }}>No bio yet — add one to stand out!</p>
                )}

                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {profile.location && <span style={{ fontSize: 13, color: "#888" }}>📍 {profile.location}</span>}
                  <span style={{ fontSize: 13, color: "#888" }}>📅 Joined {joinDate}</span>
                  {badges.length > 0 && <span style={{ fontSize: 13, color: "#888" }}>🏅 {badges.length} badge{badges.length !== 1 ? "s" : ""}</span>}
                </div>
              </div>

              {/* Edit button */}
              <button onClick={() => setEditing(true)} style={{ padding: "9px 20px", borderRadius: 10, background: "#f5f0e8", color: "#555", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                ✏️ Edit Profile
              </button>
            </div>
          )}

          {/* XP Bar */}
          {!editing && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f0ece4" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>⚡ {profile.xp} XP</span>
                <span style={{ fontSize: 12, color: "#aaa" }}>{levelConfig.next - profile.xp} XP to next level</span>
              </div>
              <div style={{ height: 8, background: "#f0ece4", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${xpProgress}%`, background: `linear-gradient(90deg, ${levelConfig.color}, ${levelConfig.color}cc)`, borderRadius: 999, transition: "width 0.6s ease" }} />
              </div>
            </div>
          )}
        </div>

        {/* Stats Row */}
        {!editing && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Credits", value: profile.credits, icon: "💰", color: "#2d6a4f", bg: "#e8f4e8" },
              { label: "XP Earned", value: profile.xp, icon: "⚡", color: "#7c3aed", bg: "#f0ebff" },
              { label: "Listings", value: listings.length, icon: "📋", color: "#1d6fb8", bg: "#e3f0fb" },
              { label: "Badges", value: badges.length, icon: "🏅", color: "#b45309", bg: "#fff8e7" },
              { label: "Transactions", value: transactions.length, icon: "📊", color: "#059669", bg: "#ecfdf5" },
            ].map((stat) => (
              <div key={stat.label} style={{ background: "white", borderRadius: 16, padding: "18px", border: "1px solid #e8e0d0", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
                <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {!editing && (
          <div>
            <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 14, padding: 6, border: "1px solid #e8e0d0", marginBottom: 20, width: "fit-content" }}>
              {(["listings", "badges", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: activeTab === tab ? "#2d6a4f" : "transparent",
                    color: activeTab === tab ? "white" : "#888",
                    fontFamily: "'DM Sans', sans-serif",
                    transition: "all 0.15s"
                  }}
                >
                  {tab === "listings" ? "📋 My Listings" : tab === "badges" ? "🏅 Badges" : "📊 Activity"}
                </button>
              ))}
            </div>

            {/* Listings Tab */}
            {activeTab === "listings" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>
                    My Skill Listings
                  </h3>
                  <a href="/listings/create" style={{ padding: "9px 18px", background: "#2d6a4f", color: "white", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    + Create Listing
                  </a>
                </div>

                {listings.length === 0 ? (
                  <div style={{ background: "white", borderRadius: 20, padding: "48px", textAlign: "center", border: "1px solid #e8e0d0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No listings yet</p>
                    <p style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>Create a skill listing to start teaching and earning credits!</p>
                    <a href="/listings/create" style={{ padding: "11px 24px", background: "#2d6a4f", color: "white", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
                      Create your first listing →
                    </a>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {listings.map((listing) => {
                      const fmt = FORMAT_COLORS[listing.format] || FORMAT_COLORS.mixed;
                      return (
                        <div key={listing.id} style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #e8e0d0", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                              <span style={{ background: fmt.bg, color: fmt.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{fmt.label}</span>
                              {listing.skills && <span style={{ fontSize: 12, color: "#888" }}>{listing.skills.name}</span>}
                              <span style={{ background: listing.is_active ? "#e8f4e8" : "#f5f5f0", color: listing.is_active ? "#2d6a4f" : "#888", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                                {listing.is_active ? "● Active" : "○ Paused"}
                              </span>
                            </div>
                            <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>{listing.title}</h4>
                            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>{listing.duration} min session</p>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f" }}>{listing.credit_price} cr</div>
                            <div style={{ fontSize: 12, color: "#aaa" }}>per session</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === "badges" && (
              <div>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>Earned Badges</h3>
                {badges.length === 0 ? (
                  <div style={{ background: "white", borderRadius: 20, padding: "48px", textAlign: "center", border: "1px solid #e8e0d0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏅</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No badges yet</p>
                    <p style={{ fontSize: 14, color: "#888" }}>Complete sessions, answer bounties, and participate in the community to earn badges!</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {badges.map((badge) => (
                      <div key={badge.id} style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #e8e0d0", textAlign: "center" }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>{BADGE_ICONS[badge.badge_type] || "🏅"}</div>
                        <p style={{ fontWeight: 700, color: "#1a1a1a", fontSize: 14, margin: "0 0 4px" }}>{badge.badge_name}</p>
                        <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px", lineHeight: 1.4 }}>{badge.description}</p>
                        <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Earned {new Date(badge.earned_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div>
                <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>Credit Activity</h3>
                {transactions.length === 0 ? (
                  <div style={{ background: "white", borderRadius: 20, padding: "48px", textAlign: "center", border: "1px solid #e8e0d0" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>No transactions yet</p>
                    <p style={{ fontSize: 14, color: "#888" }}>Your credit history will appear here once you start teaching, learning, or posting bounties.</p>
                  </div>
                ) : (
                  <div style={{ background: "white", borderRadius: 20, border: "1px solid #e8e0d0", overflow: "hidden" }}>
                    {transactions.map((tx, i) => (
                      <div key={tx.id} style={{ padding: "16px 20px", borderBottom: i < transactions.length - 1 ? "1px solid #f0ece4" : "none", display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: tx.amount > 0 ? "#e8f4e8" : "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                            {TX_ICONS[tx.type] || "💳"}
                          </div>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 2px" }}>{tx.description || tx.type.replace(/_/g, " ")}</p>
                            <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>{new Date(tx.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: tx.amount > 0 ? "#2d6a4f" : "#dc2626", flexShrink: 0 }}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount} cr
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}