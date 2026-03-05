"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Skill = { id: string; name: string; category: string };

type UploadedFile = {
  url: string;
  path: string;
  name: string;
  type: "image" | "video" | "doc";
  caption: string;
};

function useImageUpload(bucket: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const upload = async (file: File, folder: string): Promise<{ url: string; path: string } | null> => {
    setUploading(true); setError(""); setProgress(10);
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    setProgress(40);
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (upErr) { setError("Upload failed: " + upErr.message); setUploading(false); setProgress(0); return null; }
    setProgress(80);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setProgress(100);
    setTimeout(() => { setUploading(false); setProgress(0); }, 500);
    return { url: data.publicUrl, path };
  };

  return { upload, uploading, progress, error };
}

function ThumbnailUploader({ userId, onUpload }: { userId: string; onUpload: (url: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error } = useImageUpload("listing-images");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB."); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    const result = await upload(file, `thumbnails/${userId}`);
    if (result) { onUpload(result.url); setUploaded(true); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
        Cover Image <span className="font-normal text-stone-400 normal-case">(recommended — listings with photos get 3x more clicks)</span>
      </label>
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-400 bg-stone-100">
          <img src={preview} alt="thumbnail" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={() => { setPreview(null); setUploaded(false); }}
              className="px-4 py-2 bg-white text-stone-800 rounded-xl text-sm font-bold border-0 cursor-pointer">Change Image</button>
          </div>
          {uploading && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
              <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
          {uploaded && !uploading && (
            <div className="absolute top-3 right-3 bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-full">✓ Uploaded</div>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-stone-300 rounded-2xl h-48 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
          onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => inputRef.current?.click()}>
          <span className="text-4xl mb-2">🖼️</span>
          <p className="text-sm font-bold text-stone-600 mb-1">Drop an image or click to upload</p>
          <p className="text-xs text-stone-400">JPG, PNG, WEBP · Max 5MB</p>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}

const MAX_PORTFOLIO_ITEMS = 10;

function PortfolioUploader({ userId, onChange }: { userId: string; onChange: (items: UploadedFile[]) => void }) {
  const [items, setItems] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList) => {
    if (items.length >= MAX_PORTFOLIO_ITEMS) { setUploadErr(`Maximum ${MAX_PORTFOLIO_ITEMS} portfolio samples allowed.`); return; }
    setUploading(true); setUploadErr("");
    const newItems: UploadedFile[] = [];
    const remaining = MAX_PORTFOLIO_ITEMS - items.length;
    const filesToProcess = Array.from(files).slice(0, remaining);
    if (Array.from(files).length > remaining) setUploadErr(`Only ${remaining} more sample${remaining !== 1 ? "s" : ""} can be added (max ${MAX_PORTFOLIO_ITEMS}).`);

    for (const file of filesToProcess) {
      if (file.size > 10 * 1024 * 1024) { setUploadErr(`${file.name} is too large (max 10MB).`); continue; }
      const ext = file.name.split(".").pop();
      const path = `portfolio/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listing-images").upload(path, file, { upsert: true });
      if (error) { setUploadErr("Upload failed: " + error.message); continue; }
      const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
      const isImg = file.type.startsWith("image/");
      const isVid = file.type.startsWith("video/");
      newItems.push({ url: data.publicUrl, path, name: file.name, type: isImg ? "image" : isVid ? "video" : "doc", caption: "" });
    }
    const updated = [...items, ...newItems];
    setItems(updated); onChange(updated); setUploading(false);
  };

  const updateCaption = (idx: number, caption: string) => {
    const updated = items.map((item, i) => i === idx ? { ...item, caption } : item);
    setItems(updated); onChange(updated);
  };

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated); onChange(updated);
  };

  return (
    <div>
      <div className="flex flex-col gap-3">
        {items.map((item, idx) => (
          <div key={idx} className="bg-stone-50 rounded-2xl border border-stone-200 p-3 flex gap-3 items-start">
            {item.type === "image" && <img src={item.url} alt={item.name} className="w-20 h-16 object-cover rounded-xl flex-shrink-0" />}
            {item.type === "video" && <div className="w-20 h-16 rounded-xl bg-stone-200 flex items-center justify-center flex-shrink-0 text-2xl">🎬</div>}
            {item.type === "doc"   && <div className="w-20 h-16 rounded-xl bg-stone-200 flex items-center justify-center flex-shrink-0 text-2xl">📄</div>}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-600 truncate mb-1.5">{item.name}</p>
              <input type="text" placeholder="Add a caption (optional)..." value={item.caption}
                onChange={e => updateCaption(idx, e.target.value)}
                className="w-full p-2 rounded-lg border border-stone-200 text-xs bg-white focus:outline-none focus:border-emerald-400 transition-colors" />
            </div>
            <button onClick={() => removeItem(idx)} className="text-stone-400 hover:text-red-500 border-0 bg-transparent cursor-pointer text-lg leading-none flex-shrink-0">×</button>
          </div>
        ))}

        {items.length < MAX_PORTFOLIO_ITEMS ? (
          <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${uploading ? "border-emerald-400 bg-emerald-50" : "border-stone-300 hover:border-emerald-400 hover:bg-emerald-50"}`}
            onClick={() => !uploading && inputRef.current?.click()}
            onDrop={e => { e.preventDefault(); if (!uploading) addFiles(e.dataTransfer.files); }}
            onDragOver={e => e.preventDefault()}>
            {uploading ? (
              <><div className="text-3xl mb-2 animate-pulse">⬆️</div><p className="text-sm font-bold text-emerald-600">Uploading...</p></>
            ) : (
              <><div className="text-3xl mb-2">📁</div>
              <p className="text-sm font-bold text-stone-600 mb-1">{items.length > 0 ? "Add more samples" : "Upload portfolio samples"}</p>
              <p className="text-xs text-stone-400">Images, videos, or documents · Max 10MB each · {MAX_PORTFOLIO_ITEMS - items.length} slot{MAX_PORTFOLIO_ITEMS - items.length !== 1 ? "s" : ""} remaining</p></>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 text-center">
            <p className="text-sm font-bold text-stone-500">Maximum {MAX_PORTFOLIO_ITEMS} samples reached</p>
            <p className="text-xs text-stone-400 mt-1">Remove a sample to add a different one</p>
          </div>
        )}
        <input ref={inputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); }} />
        {uploadErr && <p className="text-red-500 text-xs">{uploadErr}</p>}
      </div>
    </div>
  );
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function isValidUrl(str: string) {
  try { new URL(str); return true; } catch { return false; }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const FORMATS = [
  { id: "video", icon: "📹", label: "Video Call", desc: "Live 1-on-1 via Google Meet, Zoom, etc." },
  { id: "chat",  icon: "💬", label: "Chat",       desc: "Text-based teaching inside SkillCredit" },
  { id: "docs",  icon: "📄", label: "Docs",       desc: "Shared documents and written guides" },
  { id: "mixed", icon: "🎨", label: "Mixed",      desc: "Combination of formats" },
];

const DURATIONS = [
  { value: 30,  label: "30 min",  desc: "Quick session" },
  { value: 60,  label: "1 hour",  desc: "Standard" },
  { value: 120, label: "2 hours", desc: "Deep dive" },
];

const STEPS = ["Basic Info", "Session Details", "Portfolio", "Preview & Publish"];

const FORMAT_TW: Record<string, { bg: string; text: string; border: string }> = {
  video: { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-400"     },
  chat:  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-400" },
  docs:  { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-400"  },
  mixed: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-400"   },
};

// Icons per platform for the meeting link helper text
const MEETING_PLATFORMS = [
  { icon: "🎥", label: "Google Meet" },
  { icon: "💙", label: "Zoom" },
  { icon: "💜", label: "Discord" },
  { icon: "🔵", label: "Teams" },
];

const OTHER_SKILL_ID = "__other__";
const CATEGORIES = ["Programming","Design","Language","Academic","Music","Arts","Media","Science","Sports","Lifestyle","Other"];

export default function CreateListingPage() {
  const [step, setStep]             = useState(0);
  const [skills, setSkills]         = useState<Skill[]>([]);
  const [userId, setUserId]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);
  const [doneListingId, setDoneListingId] = useState<string | null>(null);
  const [error, setError]           = useState("");

  const [thumbnailUrl, setThumbnailUrl]     = useState<string | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<UploadedFile[]>([]);

  const [isCustomSkill, setIsCustomSkill]     = useState(false);
  const [customSkillName, setCustomSkillName] = useState("");
  const [customSkillCat, setCustomSkillCat]   = useState("");

  const [form, setForm] = useState({
    skill_id: "", title: "", description: "",
    prerequisites: "", outcomes: "", materials: "",
    format: "", duration: 60, credit_price: 10,
    meeting_link: "",   // ← NEW
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);
      const { data } = await supabase.from("skills").select("*").order("category");
      setSkills(data || []);
    })();
  }, []);

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    acc[s.category] = acc[s.category] || [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const selectedSkill    = isCustomSkill ? { name: customSkillName, category: customSkillCat || "Other" } : skills.find(s => s.id === form.skill_id);
  const selectedFormat   = FORMATS.find(f => f.id === form.format);
  const selectedDuration = DURATIONS.find(d => d.value === form.duration);

  const meetingLinkValid = !form.meeting_link || isValidUrl(form.meeting_link);

  const canProceed = () => {
    if (step === 0) {
      const skillOk = isCustomSkill ? customSkillName.trim().length >= 2 : !!form.skill_id;
      return skillOk && form.title.length >= 5 && form.description.length >= 20;
    }
    if (step === 1) return !!form.format && !!form.duration && form.credit_price >= 5 && meetingLinkValid;
    return true;
  };

  const handleSkillChange = (val: string) => {
    if (val === OTHER_SKILL_ID) {
      setIsCustomSkill(true);
      setForm(p => ({ ...p, skill_id: OTHER_SKILL_ID }));
    } else {
      setIsCustomSkill(false); setCustomSkillName(""); setCustomSkillCat("");
      setForm(p => ({ ...p, skill_id: val }));
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true); setError("");

    let finalSkillId = form.skill_id;
    if (isCustomSkill && customSkillName.trim()) {
      const { data: existing } = await supabase.from("skills").select("id").ilike("name", customSkillName.trim()).maybeSingle();
      if (existing) {
        finalSkillId = existing.id;
      } else {
        const { data: newSkill, error: skillErr } = await supabase.from("skills")
          .insert({ name: customSkillName.trim(), category: customSkillCat.trim() || "Other" }).select().single();
        if (skillErr || !newSkill) { setError("Could not create custom skill."); setSubmitting(false); return; }
        finalSkillId = newSkill.id;
      }
    }

    const { data: listing, error: listingErr } = await supabase.from("listings").insert({
      teacher_id:    userId,
      skill_id:      finalSkillId,
      title:         form.title,
      description:   form.description,
      prerequisites: form.prerequisites,
      outcomes:      form.outcomes,
      materials:     form.materials,
      format:        form.format,
      duration:      form.duration,
      credit_price:  form.credit_price,
      meeting_link:  form.meeting_link.trim() || null,  // ← NEW
      is_active:     true,
      thumbnail_url: thumbnailUrl || null,
    }).select().single();

    if (listingErr || !listing) {
      setError("Could not create listing: " + (listingErr?.message || "Unknown error"));
      setSubmitting(false); return;
    }

    if (portfolioItems.length > 0) {
      await supabase.from("portfolio_items").insert(
        portfolioItems.map(item => ({ listing_id: listing.id, user_id: userId, url: item.url, type: item.type, caption: item.caption || null }))
      );
    }

    await supabase.from("user_skills").upsert(
      { user_id: userId, skill_id: finalSkillId, type: "teach", is_verified: false },
      { onConflict: "user_id,skill_id" }
    );

    try { await supabase.rpc("increment_xp", { user_id: userId, amount: 10 }); } catch {}

    setDoneListingId(listing.id); setDone(true); setSubmitting(false);
  };

  const resetForm = () => {
    setDone(false); setStep(0); setThumbnailUrl(null); setPortfolioItems([]);
    setIsCustomSkill(false); setCustomSkillName(""); setCustomSkillCat("");
    setForm({ skill_id: "", title: "", description: "", prerequisites: "", outcomes: "", materials: "", format: "", duration: 60, credit_price: 10, meeting_link: "" });
    setError("");
  };

  if (done) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap'); .font-fraunces{font-family:'Fraunces',serif}`}</style>
      <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center max-w-md shadow-lg w-full mx-4">
        {thumbnailUrl && <div className="w-full h-40 rounded-2xl overflow-hidden mb-6"><img src={thumbnailUrl} alt="listing" className="w-full h-full object-cover" /></div>}
        <div className="text-6xl mb-5">🎉</div>
        <h2 className="font-fraunces text-3xl font-black text-stone-900 mb-3">Listing Published!</h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-1"><span className="font-bold text-stone-800">{form.title}</span> is now live on SkillCredit.</p>
        {isCustomSkill && <p className="text-violet-600 text-sm font-bold mb-1">✨ New skill "{customSkillName}" added!</p>}
        {portfolioItems.length > 0 && <p className="text-emerald-600 text-sm font-bold mb-1">📁 {portfolioItems.length} portfolio sample{portfolioItems.length > 1 ? "s" : ""} uploaded!</p>}
        {form.meeting_link && <p className="text-sky-600 text-sm font-bold mb-1">🔗 Meeting link saved!</p>}
        <p className="text-stone-400 text-sm mb-8">Learners can now find and book a session with you!</p>
        <div className="flex gap-3 mb-3">
          {doneListingId && <a href={`/listings/${doneListingId}`} className="flex-1 py-3 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold no-underline text-center hover:bg-stone-200 transition-colors">View Listing →</a>}
          <a href="/listings" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold no-underline text-center hover:bg-emerald-700 transition-colors">Browse All →</a>
        </div>
        <button onClick={resetForm} className="w-full py-3 bg-transparent text-stone-400 border border-stone-200 rounded-xl text-sm font-semibold cursor-pointer hover:bg-stone-50 transition-colors">+ Create another listing</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces{font-family:'Fraunces',serif} body{font-family:'DM Sans',sans-serif}
      `}</style>

      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-8 h-14 flex items-center justify-between shadow-sm">
        <a href="/dashboard" className="flex no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex gap-2">
          <a href="/listings" className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">Browse Skills</a>
          <a href="/profile"  className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">My Profile</a>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-fraunces text-3xl font-black text-stone-900 mb-2">Create a Skill Listing 🎓</h1>
          <p className="text-stone-400 text-sm">Share your knowledge and earn credits when learners book sessions with you.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-colors ${i <= step ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-400"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-bold whitespace-nowrap ${i === step ? "text-stone-800" : "text-stone-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 transition-colors ${i < step ? "bg-emerald-600" : "bg-stone-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">

          {/* ── STEP 0: Basic Info ── */}
          {step === 0 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Basic Information</h2>
                <p className="text-stone-400 text-sm">Tell learners what you're offering.</p>
              </div>
              {userId && <ThumbnailUploader userId={userId} onUpload={url => setThumbnailUrl(url)} />}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">What skill are you teaching? *</label>
                <select value={form.skill_id} onChange={e => handleSkillChange(e.target.value)}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none cursor-pointer transition-colors ${form.skill_id ? "border-emerald-400" : "border-stone-200"}`}>
                  <option value="">Select a skill...</option>
                  {Object.entries(grouped).map(([cat, catSkills]) => (
                    <optgroup key={cat} label={cat}>
                      {catSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </optgroup>
                  ))}
                  <optgroup label="─────────────">
                    <option value={OTHER_SKILL_ID}>✏️ Other — type your own skill</option>
                  </optgroup>
                </select>
                {isCustomSkill && (
                  <div className="mt-3 bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span>✨</span>
                      <p className="text-sm font-black text-violet-700">Add your own skill</p>
                      <span className="text-xs text-violet-400">It'll be added to the platform!</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-violet-600 block mb-1.5">Skill Name *</label>
                      <input type="text" placeholder="e.g. Rubik's Cube, Calligraphy, Drone Flying..."
                        value={customSkillName} onChange={e => setCustomSkillName(e.target.value)} maxLength={60}
                        className={`w-full p-3 rounded-xl border text-sm bg-white outline-none transition-colors ${customSkillName.length >= 2 ? "border-violet-400" : "border-violet-200"}`} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-violet-600 block mb-1.5">Category <span className="font-normal text-violet-400">(optional)</span></label>
                      <select value={customSkillCat} onChange={e => setCustomSkillCat(e.target.value)}
                        className="w-full p-3 rounded-xl border border-violet-200 text-sm bg-white outline-none">
                        <option value="">Choose a category...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <button onClick={() => { setIsCustomSkill(false); setForm(p => ({ ...p, skill_id: "" })); setCustomSkillName(""); setCustomSkillCat(""); }}
                      className="text-xs text-violet-400 hover:text-violet-600 transition-colors bg-transparent border-0 cursor-pointer text-left font-medium">← Back to skill list</button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Listing Title * <span className="text-stone-300 font-normal normal-case">{form.title.length}/80</span>
                </label>
                <input type="text" maxLength={80} placeholder="e.g. Python for Complete Beginners — Zero to First Project"
                  value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none transition-colors ${form.title.length >= 5 ? "border-emerald-400" : "border-stone-200"}`} />
              </div>
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Description * <span className="text-stone-300 font-normal normal-case">{form.description.length}/600</span>
                </label>
                <textarea maxLength={600} rows={4} placeholder="Describe what the session covers, your teaching style, and who this is for..."
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none resize-vertical transition-colors ${form.description.length >= 20 ? "border-emerald-400" : "border-stone-200"}`} />
              </div>
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Prerequisites <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. No experience needed / Basic math knowledge"
                  value={form.prerequisites} onChange={e => setForm(p => ({ ...p, prerequisites: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none" />
              </div>
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  What will learners walk away with? <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <textarea rows={3} placeholder="e.g. Understand variables and loops, build a simple calculator..."
                  value={form.outcomes} onChange={e => setForm(p => ({ ...p, outcomes: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none resize-vertical" />
              </div>
            </div>
          )}

          {/* ── STEP 1: Session Details ── */}
          {step === 1 && (
            <div className="flex flex-col gap-7">
              <div>
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Session Details</h2>
                <p className="text-stone-400 text-sm">Set how you'll teach, how long, and what it costs.</p>
              </div>

              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">Teaching Format *</label>
                <div className="grid grid-cols-2 gap-3">
                  {FORMATS.map(f => {
                    const selected = form.format === f.id;
                    const tw = FORMAT_TW[f.id];
                    return (
                      <div key={f.id} onClick={() => setForm(p => ({ ...p, format: f.id }))}
                        className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${selected ? `${tw.bg} ${tw.border}` : "bg-white border-stone-200 hover:border-stone-300"}`}>
                        <span className="text-2xl">{f.icon}</span>
                        <p className={`font-black text-sm mt-2 mb-1 ${selected ? tw.text : "text-stone-700"}`}>{f.label}</p>
                        <p className="text-xs text-stone-400 leading-snug">{f.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">Session Duration *</label>
                <div className="flex gap-3">
                  {DURATIONS.map(d => {
                    const selected = form.duration === d.value;
                    return (
                      <div key={d.value} onClick={() => setForm(p => ({ ...p, duration: d.value }))}
                        className={`flex-1 p-4 rounded-2xl cursor-pointer text-center border-2 transition-all ${selected ? "bg-emerald-50 border-emerald-400" : "bg-white border-stone-200 hover:border-stone-300"}`}>
                        <p className={`font-fraunces text-xl font-black mb-1 ${selected ? "text-emerald-700" : "text-stone-800"}`}>{d.label}</p>
                        <p className="text-xs text-stone-400">{d.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">
                  Credit Price per Session * <span className="font-normal text-stone-300 normal-case">= ₱{form.credit_price * 10}</span>
                </label>
                <div className="flex items-center gap-4 mb-3">
                  <button onClick={() => setForm(p => ({ ...p, credit_price: Math.max(5, p.credit_price - 5) }))}
                    className="w-10 h-10 rounded-xl border border-stone-200 bg-white text-xl cursor-pointer hover:bg-stone-50 transition-colors flex items-center justify-center font-bold border-0">−</button>
                  <div className="flex-1 text-center">
                    <p className="font-fraunces text-4xl font-black text-emerald-700">{form.credit_price}</p>
                    <p className="text-xs text-stone-400">credits · ₱{form.credit_price * 10}</p>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, credit_price: Math.min(100, p.credit_price + 5) }))}
                    className="w-10 h-10 rounded-xl border border-stone-200 bg-white text-xl cursor-pointer hover:bg-stone-50 transition-colors flex items-center justify-center font-bold border-0">+</button>
                </div>
                <input type="range" min={5} max={100} step={5} value={form.credit_price}
                  onChange={e => setForm(p => ({ ...p, credit_price: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-600" />
                <div className="flex justify-between text-[10px] text-stone-300 mt-1">
                  <span>5 cr (₱50)</span><span>50 cr (₱500)</span><span>100 cr (₱1,000)</span>
                </div>
              </div>

              {/* ── MEETING LINK ── */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Meeting Link <span className="font-normal text-stone-300 normal-case">(optional — you can add or change this later)</span>
                </label>

                {/* Platform hints */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {MEETING_PLATFORMS.map(p => (
                    <span key={p.label} className="text-xs font-semibold text-stone-400 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                      {p.icon} {p.label}
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔗</span>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/abc-def-ghi"
                    value={form.meeting_link}
                    onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))}
                    className={`w-full pl-9 pr-4 py-3 rounded-xl border text-sm bg-stone-50 outline-none transition-colors ${
                      !form.meeting_link ? "border-stone-200"
                      : meetingLinkValid ? "border-emerald-400" : "border-red-400"
                    }`}
                  />
                </div>

                {form.meeting_link && !meetingLinkValid && (
                  <p className="text-red-500 text-xs mt-1.5 font-semibold">⚠️ Please enter a valid URL (must start with https://)</p>
                )}
                {form.meeting_link && meetingLinkValid && (
                  <p className="text-emerald-600 text-xs mt-1.5 font-semibold">✓ Learners will see this link when their session is confirmed</p>
                )}

                <div className="mt-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-sky-700 font-semibold leading-relaxed">
                    💡 <strong>How it works:</strong> Once a learner books and you confirm, this link will appear on their Sessions page so they can join at the scheduled time.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Materials you'll provide <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <input type="text" placeholder="e.g. Slides, practice files, code templates"
                  value={form.materials} onChange={e => setForm(p => ({ ...p, materials: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none" />
              </div>
            </div>
          )}

          {/* ── STEP 2: Portfolio ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Portfolio Samples 📁</h2>
                <p className="text-stone-400 text-sm mb-1">Show learners examples of your work.</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-2">
                  <p className="text-xs font-bold text-emerald-700">📈 Listings with portfolio samples get <strong>3x more bookings!</strong></p>
                </div>
              </div>
              {userId && <PortfolioUploader userId={userId} onChange={setPortfolioItems} />}
              {portfolioItems.length === 0 && <p className="text-xs text-stone-400 text-center">You can skip this and add samples later.</p>}
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div>
              <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Preview & Publish</h2>
              <p className="text-stone-400 text-sm mb-6">This is how your listing will appear. Looks good? Hit publish!</p>

              <div className="bg-stone-50 rounded-2xl p-1 mb-6">
                <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="thumbnail" className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-24 bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-4xl">
                      {selectedSkill?.name?.slice(0, 1) || "🎓"}
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex gap-2 flex-wrap mb-3">
                      {selectedSkill && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{selectedSkill.category} · {selectedSkill.name}</span>}
                      {isCustomSkill && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700">✨ New</span>}
                      {selectedFormat && (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${FORMAT_TW[form.format]?.bg} ${FORMAT_TW[form.format]?.text}`}>
                          {selectedFormat.icon} {selectedFormat.label}
                        </span>
                      )}
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">⏱ {selectedDuration?.label}</span>
                      {portfolioItems.length > 0 && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700">📁 {portfolioItems.length} sample{portfolioItems.length > 1 ? "s" : ""}</span>}
                      {form.meeting_link && <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700">🔗 Link saved</span>}
                    </div>
                    <h3 className="font-fraunces text-base font-black text-stone-900 mb-2 leading-snug">{form.title || "Your listing title"}</h3>
                    <p className="text-xs text-stone-500 leading-relaxed mb-3">{form.description || "Your description will appear here."}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <div>
                        <span className="font-fraunces text-xl font-black text-emerald-700">{form.credit_price} cr</span>
                        <span className="text-xs text-stone-400 ml-2">· ₱{form.credit_price * 10}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Book session →</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {[
                  { label: "Skill",        value: isCustomSkill ? `${customSkillName} (New ✨)` : selectedSkill?.name },
                  { label: "Category",     value: isCustomSkill ? (customSkillCat || "Other") : selectedSkill?.category },
                  { label: "Format",       value: selectedFormat?.label },
                  { label: "Duration",     value: selectedDuration?.label },
                  { label: "Price",        value: `${form.credit_price} credits (₱${form.credit_price * 10})` },
                  { label: "Meeting link", value: form.meeting_link ? `✅ ${form.meeting_link.slice(0, 40)}…` : "None — can add later" },
                  { label: "Cover photo",  value: thumbnailUrl ? "✅ Uploaded" : "No photo (will use gradient)" },
                  { label: "Portfolio",    value: portfolioItems.length > 0 ? `${portfolioItems.length} sample${portfolioItems.length > 1 ? "s" : ""} uploaded` : "None" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center px-4 py-2.5 bg-stone-50 rounded-xl text-sm">
                    <span className="text-stone-400 font-semibold">{item.label}</span>
                    <span className="text-stone-700 font-bold">{item.value || "—"}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <p className="text-red-600 text-sm font-semibold">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-stone-100">
            {step > 0 && (
              <button onClick={() => setStep(p => p - 1)}
                className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold cursor-pointer hover:bg-stone-200 transition-colors border-0">← Back</button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(p => p + 1)} disabled={!canProceed()}
                className={`px-7 py-3 rounded-xl text-sm font-black text-white border-0 transition-colors ${canProceed() ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
                {step === 2 && portfolioItems.length === 0 ? "Skip →" : "Continue →"}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black border-0 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                {submitting ? <><span className="animate-spin inline-block">⟳</span> Publishing...</> : "🚀 Publish Listing"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}