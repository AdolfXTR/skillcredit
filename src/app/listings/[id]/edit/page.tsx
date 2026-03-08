"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Skill = { id: string; name: string; category: string };
type ListingForm = {
  title: string;
  description: string;
  credit_price: number;
  format: string;
  duration: number;
  difficulty: string;
  prerequisites: string;
  outcomes: string;
  materials: string;
  skill_id: string;
  is_active: boolean;
  meeting_link: string;
};

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FORMAT_OPTIONS = [
  { value: "video", icon: "📹", label: "Video Call", desc: "Google Meet, Zoom, or Jitsi" },
  { value: "chat",  icon: "💬", label: "Chat",       desc: "Text-based inside SkillCredit" },
  { value: "docs",  icon: "📄", label: "Docs",       desc: "Shared documents & written guides" },
  { value: "mixed", icon: "🎨", label: "Mixed",      desc: "Combination of video, chat, docs" },
];
const DIFFICULTY_OPTIONS = [
  { value: "beginner",     icon: "🟢", label: "Beginner Friendly" },
  { value: "intermediate", icon: "🟡", label: "Intermediate" },
  { value: "advanced",     icon: "🔴", label: "Advanced" },
];
const CATEGORIES = ["Programming","Design","Language","Academic","Music","Arts","Media","Science","Sports","Lifestyle","Other"];
const CATEGORY_ICONS: Record<string, string> = {
  Programming:"💻", Design:"🎨", Language:"🌍", Academic:"📚", Music:"🎵",
  Arts:"🎭", Media:"🎬", Science:"🔬", Sports:"⚽", Lifestyle:"✨", Other:"💡",
};

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function EditListingPage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = params?.id as string;

  const [form, setForm]           = useState<ListingForm>({
    title: "", description: "", credit_price: 10, format: "video",
    duration: 60, difficulty: "beginner", prerequisites: "",
    outcomes: "", materials: "", skill_id: "", is_active: true, meeting_link: "",
  });
  const [skills, setSkills]         = useState<Skill[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [selectedSkillName, setSelectedSkillName] = useState("");
  const [thumbnail, setThumbnail]   = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState<"basics" | "details">("basics");

  useEffect(() => { init(); }, [id]);

  useEffect(() => {
    if (!skillSearch.trim()) { setFilteredSkills(skills.slice(0, 20)); return; }
    const q = skillSearch.toLowerCase();
    setFilteredSkills(skills.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)).slice(0, 20));
  }, [skillSearch, skills]);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setCurrentUserId(user.id);

    // Load skills list
    const { data: skillsData } = await supabase.from("skills").select("*").order("name");
    if (skillsData) { setSkills(skillsData); setFilteredSkills(skillsData.slice(0, 20)); }

    // Load existing listing
    const { data, error: fetchErr } = await supabase
      .from("listings")
      .select("*, skills(id,name,category)")
      .eq("id", id)
      .single();

    if (fetchErr || !data) { setError("Listing not found."); setLoading(false); return; }
    if (data.teacher_id !== user.id) { router.push("/listings"); return; }

    setForm({
      title:        data.title        || "",
      description:  data.description  || "",
      credit_price: data.credit_price || 10,
      format:       data.format       || "video",
      duration:     data.duration     || 60,
      difficulty:   data.difficulty   || "beginner",
      prerequisites:data.prerequisites|| "",
      outcomes:     data.outcomes     || "",
      materials:    data.materials    || "",
      skill_id:     data.skill_id     || "",
      is_active:    data.is_active    ?? true,
      meeting_link: data.meeting_link || "",
    });
    if (data.skills) {
      setSelectedSkillName(`${data.skills.name} (${data.skills.category})`);
    }
    if (data.thumbnail_url) {
      setExistingThumbnail(data.thumbnail_url);
      setThumbnailPreview(data.thumbnail_url);
    }
    setLoading(false);
  }

  function set(field: keyof ListingForm, value: any) {
    setForm(f => ({ ...f, [field]: value }));
    setError("");
  }

  function handleThumbnailSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Thumbnail must be under 5MB."); return; }
    setThumbnail(file);
    const reader = new FileReader();
    reader.onload = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadThumbnail(): Promise<string | null> {
    if (!thumbnail || !currentUserId) return null;
    const ext  = thumbnail.name.split(".").pop();
    const path = `${currentUserId}/${id}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("listing-thumbnails").upload(path, thumbnail, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("listing-thumbnails").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    setError(""); setSuccess("");
    if (!form.title.trim())       { setError("Title is required."); setActiveSection("basics"); return; }
    if (!form.description.trim()) { setError("Description is required."); setActiveSection("basics"); return; }
    if (!form.skill_id)           { setError("Please select a skill."); setActiveSection("basics"); return; }

    setSaving(true);
    let thumbnailUrl = existingThumbnail;
    if (thumbnail) {
      const uploaded = await uploadThumbnail();
      if (uploaded) thumbnailUrl = uploaded;
    }

    // Build the update payload — only include fields that exist in your schema
    // Core columns — guaranteed to exist
    const corePayload: Record<string, any> = {
      title:       form.title.trim(),
      description: form.description.trim(),
      format:      form.format,
      skill_id:    form.skill_id,
      is_active:   form.is_active,
      ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}),
    };

    // Optional columns that may not exist in all deployments
    const optionalFields: Record<string, any> = {
      difficulty:    form.difficulty,
      prerequisites: form.prerequisites.trim(),
      outcomes:      form.outcomes.trim(),
      materials:     form.materials.trim(),
      meeting_link:  form.meeting_link.trim(),
    };

    // Try full save first
    let { error: updateErr } = await supabase.from("listings").update({ ...corePayload, ...optionalFields }).eq("id", id);

    // If a column is missing, find it, drop it, retry
    if (updateErr && (updateErr.code === "42703" || updateErr.message?.includes("column"))) {
      console.error("Column missing:", updateErr.message);
      const missingCol = Object.keys(optionalFields).find(k => updateErr!.message?.includes(k));
      if (missingCol) delete optionalFields[missingCol];
      const retry = await supabase.from("listings").update({ ...corePayload, ...optionalFields }).eq("id", id);
      if (retry.error) {
        // Last resort: core only
        const { error: coreErr } = await supabase.from("listings").update(corePayload).eq("id", id);
        if (coreErr) { setError("Failed to save: " + coreErr.message); setSaving(false); return; }
      }
      const tip = missingCol ? " (run: ALTER TABLE listings ADD COLUMN IF NOT EXISTS " + missingCol + " text DEFAULT '';)" : "";
      setSuccess("Saved!" + tip);
      setSaving(false);
      setTimeout(() => setSuccess(""), 6000);
      return;
    }

    if (updateErr) {
      setError("Failed to save: " + (updateErr.message || "Unknown error"));
      setSaving(false);
      return;
    }
    setSuccess("Changes saved!");
    setSaving(false);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleDelete() {
    if (!currentUserId) return;
    setDeleting(true);
    await supabase.from("listings").update({ is_active: false }).eq("id", id);
    router.push("/listings");
  }

  const hasMeetingLink = form.meeting_link.trim().length > 0;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=DM+Sans:wght@400;600;700&display=swap');`}</style>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:32, height:32, border:"3px solid #2d6a4f", borderTopColor:"transparent", borderRadius:"50%", animation:"spin .7s linear infinite", margin:"0 auto 14px" }} />
        <p style={{ color:"#999", fontSize:13 }}>Loading listing…</p>
      </div>
    </div>
  );

  if (error && !form.title) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:14 }}>😕</div>
        <p style={{ color:"#aaa", marginBottom:12 }}>{error}</p>
        <a href="/listings" style={{ color:"#2d6a4f", fontWeight:700 }}>← Back to listings</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f7f5f0", fontFamily:"'DM Sans',sans-serif", paddingBottom:60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
        input:focus,textarea:focus,select:focus{outline:none}
        .tab-btn{padding:8px 18px;border-radius:99px;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif}
        .tab-btn.active{background:#2d6a4f;color:#fff}
        .tab-btn:not(.active){background:#f0ede8;color:#777}
        .tab-btn:not(.active):hover{background:#e8e2d9;color:#333}
        .format-card{border-radius:12px;border:2px solid #e8e2d9;padding:12px 14px;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:10}
        .format-card.active{border-color:#2d6a4f;background:#f0fdf4}
        .format-card:not(.active):hover{border-color:#c6e8d4;background:#fafaf8}
        .diff-btn{padding:9px 14px;border-radius:10px;border:2px solid #e8e2d9;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;flex:1;text-align:center}
        .diff-btn.active{border-color:#2d6a4f;background:#f0fdf4;color:#15803d}
        .diff-btn:not(.active):hover{border-color:#c6e8d4}
        .preset-btn{padding:6px 12px;border-radius:8px;border:1.5px solid #e8e2d9;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s;background:#fff;font-family:'DM Sans',sans-serif;color:#555}
        .preset-btn.active{border-color:#2d6a4f;background:#e8f4e8;color:#2d6a4f}
        .preset-btn:not(.active):hover{border-color:#aaa}
        .skill-item{padding:9px 12px;cursor:pointer;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:8;transition:background .1s}
        .skill-item:hover{background:#f0fdf4}
        textarea{resize:vertical}
      `}</style>

      {/* NAVBAR */}
      <nav style={{ background:"rgba(255,255,255,.97)", backdropFilter:"blur(12px)", borderBottom:"1.5px solid #e8e2d9", padding:"0 28px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40 }}>
        <a href="/dashboard" style={{ fontFamily:"'Fraunces',serif" }}>
          <span style={{ fontSize:20, fontWeight:900, color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontSize:20, fontWeight:900, color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <a href={`/listings/${id}`} style={{ padding:"7px 14px", borderRadius:9, color:"#555", fontSize:13, fontWeight:600, background:"#f5f0e8" }}>
            👁 Preview
          </a>
          <a href="/listings" style={{ padding:"7px 14px", borderRadius:9, color:"#555", fontSize:13, fontWeight:600 }}>
            ← My Listings
          </a>
        </div>
      </nav>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"28px 20px" }}>
        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"#e8f4e8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>✏️</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:26, fontWeight:900, color:"#1a1a1a" }}>Edit Listing</h1>
          </div>
          <p style={{ fontSize:13, color:"#aaa", marginLeft:46 }}>Changes are saved immediately and visible to learners.</p>
        </div>

        {/* Active / Inactive toggle */}
        <div style={{ background:"#fff", borderRadius:16, border:"1.5px solid #e8e2d9", padding:"14px 20px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:"#1a1a1a", marginBottom:2 }}>Listing Status</p>
            <p style={{ fontSize:12, color:"#aaa" }}>{form.is_active ? "Visible to all learners on the browse page" : "Hidden — learners cannot find or book this listing"}</p>
          </div>
          <button onClick={() => set("is_active", !form.is_active)}
            style={{ padding:"8px 20px", borderRadius:99, border:"none", cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"'DM Sans',sans-serif", background:form.is_active?"#e8f4e8":"#fee2e2", color:form.is_active?"#15803d":"#dc2626", transition:"all .15s" }}>
            {form.is_active ? "✓ Active" : "⏸ Paused"}
          </button>
        </div>

        {/* Meeting link banner */}
        <div style={{ background: hasMeetingLink ? "#f0fdf4" : "#fffbeb", border:`1.5px solid ${hasMeetingLink?"#86efac":"#fde68a"}`, borderRadius:14, padding:"12px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>{hasMeetingLink ? "✅" : "💡"}</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color: hasMeetingLink ? "#15803d" : "#b45309", marginBottom:2 }}>
              {hasMeetingLink ? "Meeting link set" : "No meeting link set"}
            </p>
            <p style={{ fontSize:12, color: hasMeetingLink ? "#166534" : "#92400e" }}>
              {hasMeetingLink ? form.meeting_link : "Add a Zoom or Google Meet link below so learners know where to join."}
            </p>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {(["basics","details"] as const).map(s => (
            <button key={s} className={`tab-btn ${activeSection===s?"active":""}`} onClick={() => setActiveSection(s)}>
              {s === "basics" ? "📝 Basics" : "📦 Details"}
            </button>
          ))}
        </div>

        {/* ── BASICS ── */}
        {activeSection === "basics" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"fadeIn .2s ease" }}>

            {/* Title */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:8 }}>
                Session Title *
              </label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                placeholder="e.g. Learn Python from Scratch in 1 Hour"
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1.5px solid ${form.title?"#2d6a4f":"#e8e2d9"}`, fontSize:15, fontWeight:600, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a", transition:"border-color .15s" }}
                onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                onBlur={e  => e.target.style.borderColor = form.title ? "#2d6a4f" : "#e8e2d9"} />
              <p style={{ fontSize:11, color:"#bbb", marginTop:5 }}>{form.title.length}/80 characters</p>
            </div>

            {/* Description */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:8 }}>
                Description *
              </label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Describe what you'll teach, your teaching style, and what makes your session great…"
                rows={5}
                style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a", lineHeight:1.6 }}
                onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                onBlur={e  => e.target.style.borderColor = "#e8e2d9"} />
            </div>

            {/* Skill */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:8 }}>
                Skill / Subject *
              </label>
              <div style={{ position:"relative" }}>
                <input value={skillSearch || selectedSkillName}
                  onChange={e => { setSkillSearch(e.target.value); setSelectedSkillName(""); set("skill_id",""); setShowSkillDropdown(true); }}
                  onFocus={() => setShowSkillDropdown(true)}
                  placeholder="Search skills (e.g. Python, Guitar, Spanish)…"
                  style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:`1.5px solid ${form.skill_id?"#2d6a4f":"#e8e2d9"}`, fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a" }}
                />
                {showSkillDropdown && filteredSkills.length > 0 && (
                  <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", borderRadius:14, border:"1.5px solid #e8e2d9", boxShadow:"0 8px 32px rgba(0,0,0,.1)", zIndex:10, maxHeight:240, overflowY:"auto", animation:"slideIn .12s ease" }}>
                    {CATEGORIES.filter(cat => filteredSkills.some(s => s.category === cat)).map(cat => (
                      <div key={cat}>
                        <div style={{ padding:"6px 12px", fontSize:10, fontWeight:800, color:"#bbb", letterSpacing:".07em", textTransform:"uppercase" as const, background:"#fafaf8", borderBottom:"1px solid #f0ece4" }}>
                          {CATEGORY_ICONS[cat]} {cat}
                        </div>
                        {filteredSkills.filter(s => s.category === cat).map(skill => (
                          <div key={skill.id} className="skill-item"
                            onClick={() => { set("skill_id", skill.id); setSelectedSkillName(`${skill.name} (${skill.category})`); setSkillSearch(""); setShowSkillDropdown(false); }}>
                            <span style={{ fontSize:13, fontWeight:600, color:"#1a1a1a" }}>{skill.name}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.skill_id && (
                <p style={{ fontSize:12, color:"#2d6a4f", fontWeight:600, marginTop:6 }}>✓ {selectedSkillName}</p>
              )}
            </div>

            {/* Thumbnail */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:12 }}>
                Thumbnail Image
              </label>
              {thumbnailPreview ? (
                <div style={{ position:"relative", marginBottom:12 }}>
                  <img src={thumbnailPreview} alt="Thumbnail" style={{ width:"100%", height:180, objectFit:"cover", borderRadius:12, border:"1.5px solid #e8e2d9" }} />
                  <button onClick={() => { setThumbnail(null); setThumbnailPreview(null); setExistingThumbnail(null); }}
                    style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,.55)", border:"none", color:"#fff", borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    ✕
                  </button>
                </div>
              ) : null}
              <label style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:12, border:"1.5px dashed #c6e8d4", background:"#f9fdfb", cursor:"pointer" }}>
                <span style={{ fontSize:22 }}>🖼</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:"#2d6a4f" }}>{thumbnailPreview ? "Replace thumbnail" : "Upload thumbnail"}</p>
                  <p style={{ fontSize:11, color:"#aaa" }}>JPG, PNG or WebP · max 5MB</p>
                </div>
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={handleThumbnailSelect} />
              </label>
            </div>

            {/* Meeting link */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:8 }}>
                Meeting Link <span style={{ fontWeight:500, textTransform:"none" as const, fontSize:11, color:"#bbb" }}>(Zoom / Google Meet)</span>
              </label>
              <input value={form.meeting_link} onChange={e => set("meeting_link", e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:`1.5px solid ${hasMeetingLink?"#2d6a4f":"#e8e2d9"}`, fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a" }}
                onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                onBlur={e  => e.target.style.borderColor = form.meeting_link ? "#2d6a4f" : "#e8e2d9"} />
              <p style={{ fontSize:11, color:"#aaa", marginTop:5 }}>This link is shared with confirmed learners.</p>
            </div>
          </div>
        )}

        {/* ── DETAILS ── */}
        {activeSection === "details" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"fadeIn .2s ease" }}>

            {/* Format */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:12 }}>
                Session Format *
              </label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {FORMAT_OPTIONS.map(f => (
                  <div key={f.value} className={`format-card ${form.format===f.value?"active":""}`}
                    onClick={() => set("format", f.value)}>
                    <span style={{ fontSize:22, flexShrink:0 }}>{f.icon}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color: form.format===f.value?"#15803d":"#1a1a1a" }}>{f.label}</p>
                      <p style={{ fontSize:11, color:"#aaa" }}>{f.desc}</p>
                    </div>
                    {form.format===f.value && <span style={{ marginLeft:"auto", fontSize:16, flexShrink:0 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:12 }}>
                Difficulty Level
              </label>
              <div style={{ display:"flex", gap:8 }}>
                {DIFFICULTY_OPTIONS.map(d => (
                  <button key={d.value} className={`diff-btn ${form.difficulty===d.value?"active":""}`}
                    onClick={() => set("difficulty", d.value)}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Outcomes */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22 }}>
              <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>
                Learning Outcomes
              </label>
              <p style={{ fontSize:12, color:"#bbb", marginBottom:10 }}>What will learners be able to do after this session? (one per line or use •)</p>
              <textarea value={form.outcomes} onChange={e => set("outcomes", e.target.value)}
                placeholder={"• Understand the basics of X\n• Build a simple Y from scratch\n• Know how to Z"}
                rows={4}
                style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:13, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a", lineHeight:1.6 }}
                onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                onBlur={e  => e.target.style.borderColor = "#e8e2d9"} />
            </div>

            {/* Prerequisites & Materials */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #e8e2d9", padding:22, display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>Prerequisites</label>
                <input value={form.prerequisites} onChange={e => set("prerequisites", e.target.value)}
                  placeholder="e.g. Basic algebra, no coding experience needed"
                  style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a" }}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                  onBlur={e  => e.target.style.borderColor = "#e8e2d9"} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:800, color:"#aaa", letterSpacing:".07em", textTransform:"uppercase" as const, display:"block", marginBottom:6 }}>Materials Needed</label>
                <input value={form.materials} onChange={e => set("materials", e.target.value)}
                  placeholder="e.g. Laptop with Python installed, pen and paper"
                  style={{ width:"100%", padding:"11px 14px", borderRadius:12, border:"1.5px solid #e8e2d9", fontSize:14, fontFamily:"'DM Sans',sans-serif", background:"#fafaf8", color:"#1a1a1a" }}
                  onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                  onBlur={e  => e.target.style.borderColor = "#e8e2d9"} />
              </div>
            </div>


            {/* Danger zone */}
            <div style={{ background:"#fff", borderRadius:18, border:"1.5px solid #fca5a5", padding:22 }}>
              <h3 style={{ fontFamily:"'Fraunces',serif", fontSize:15, fontWeight:900, color:"#dc2626", marginBottom:8 }}>⚠️ Danger Zone</h3>
              <p style={{ fontSize:13, color:"#888", marginBottom:16, lineHeight:1.6 }}>
                Deactivating will hide this listing from Browse immediately. Existing booked sessions are unaffected.
              </p>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)}
                  style={{ padding:"9px 20px", borderRadius:10, background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fca5a5", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  🗑 Deactivate Listing
                </button>
              ) : (
                <div style={{ background:"#fef2f2", borderRadius:12, padding:16, border:"1.5px solid #fca5a5" }}>
                  <p style={{ fontSize:13, fontWeight:700, color:"#dc2626", marginBottom:12 }}>Are you sure? This will hide the listing from Browse.</p>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => setShowDeleteConfirm(false)}
                      style={{ flex:1, padding:"9px", borderRadius:9, background:"#f5f0e8", color:"#555", border:"1.5px solid #e8e2d9", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                      Cancel
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                      style={{ flex:1, padding:"9px", borderRadius:9, background:"#dc2626", color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", opacity:deleting?.6:1 }}>
                      {deleting ? "Deactivating…" : "Yes, Deactivate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div style={{ marginTop:16, padding:"12px 16px", borderRadius:12, background:"#fef2f2", border:"1.5px solid #fca5a5", fontSize:13, color:"#dc2626", fontWeight:600 }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop:16, padding:"12px 16px", borderRadius:12, background:"#f0fdf4", border:"1.5px solid #86efac", fontSize:13, color:"#15803d", fontWeight:700, animation:"fadeIn .2s ease" }}>
            ✓ {success}
          </div>
        )}

        {/* Save button */}
        <div style={{ marginTop:24, display:"flex", gap:10 }}>
          <a href={`/listings/${id}`}
            style={{ flex:1, padding:"14px", borderRadius:14, background:"#f5f0e8", color:"#555", fontWeight:700, fontSize:14, border:"1.5px solid #e8e2d9", textAlign:"center" as const, display:"block" }}>
            Cancel
          </a>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:2, padding:"14px", borderRadius:14, background: saving?"#7aad92":"#2d6a4f", color:"#fff", fontFamily:"'Fraunces',serif", fontSize:16, fontWeight:900, border:"none", cursor:saving?"not-allowed":"pointer", boxShadow:"0 4px 20px rgba(45,106,79,.25)", transition:"background .15s" }}
            onMouseOver={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = "#1a4a36"; }}
            onMouseOut={e  => { if (!saving) (e.currentTarget as HTMLElement).style.background = "#2d6a4f"; }}>
            {saving ? "Saving…" : "💾 Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}