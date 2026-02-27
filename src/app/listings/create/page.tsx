"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PortfolioUpload, PortfolioItem } from "@/components/PortfolioSystem";

type Skill = { id: string; name: string; category: string };

const FORMATS = [
  { id: "video", icon: "📹", label: "Video Call", desc: "Live 1-on-1 via Google Meet, Zoom, etc." },
  { id: "chat",  icon: "💬", label: "Chat",       desc: "Text-based teaching inside SkillCredit" },
  { id: "docs",  icon: "📄", label: "Docs",       desc: "Shared documents and written guides" },
  { id: "mixed", icon: "🎨", label: "Mixed",      desc: "Combination of formats" },
];

const DURATIONS = [
  { value: 30,  label: "30 min",  desc: "Quick session" },
  { value: 60,  label: "1 hour",  desc: "Standard session" },
  { value: 120, label: "2 hours", desc: "Deep dive" },
];

const STEPS = ["Basic Info", "Session Details", "Portfolio", "Preview & Publish"];

const FORMAT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  video: { bg: "bg-sky-50",    color: "text-sky-700",    border: "border-sky-400" },
  chat:  { bg: "bg-emerald-50",color: "text-emerald-700",border: "border-emerald-400" },
  docs:  { bg: "bg-violet-50", color: "text-violet-700", border: "border-violet-400" },
  mixed: { bg: "bg-amber-50",  color: "text-amber-700",  border: "border-amber-400" },
};

const OTHER_SKILL_ID = "__other__";

export default function CreateListingPage() {
  const [step, setStep]         = useState(0);
  const [skills, setSkills]     = useState<Skill[]>([]);
  const [userId, setUserId]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);

  // Custom skill state
  const [isCustomSkill, setIsCustomSkill]   = useState(false);
  const [customSkillName, setCustomSkillName] = useState("");
  const [customSkillCategory, setCustomSkillCategory] = useState("");

  const [form, setForm] = useState({
    skill_id: "", title: "", description: "",
    prerequisites: "", outcomes: "", materials: "",
    format: "", duration: 60, credit_price: 10,
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      setUserId(user.id);
      const { data } = await supabase.from("skills").select("*").order("category");
      setSkills(data || []);
    };
    init();
  }, []);

  const selectedFormat   = FORMATS.find(f => f.id === form.format);
  const selectedDuration = DURATIONS.find(d => d.value === form.duration);
  const selectedSkill    = isCustomSkill
    ? { name: customSkillName, category: customSkillCategory || "Other" }
    : skills.find(s => s.id === form.skill_id);

  const canProceed = () => {
    if (step === 0) {
      const skillOk = isCustomSkill
        ? customSkillName.trim().length >= 2
        : !!form.skill_id;
      return skillOk && form.title.length >= 5 && form.description.length >= 20;
    }
    if (step === 1) return form.format && form.duration && form.credit_price >= 5;
    return true;
  };

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const handleSkillChange = (value: string) => {
    if (value === OTHER_SKILL_ID) {
      setIsCustomSkill(true);
      setForm(p => ({ ...p, skill_id: OTHER_SKILL_ID }));
    } else {
      setIsCustomSkill(false);
      setCustomSkillName("");
      setCustomSkillCategory("");
      setForm(p => ({ ...p, skill_id: value }));
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError("");

    let finalSkillId = form.skill_id;

    // If custom skill, insert it into skills table first
    if (isCustomSkill && customSkillName.trim()) {
      const { data: newSkill, error: skillErr } = await supabase
        .from("skills")
        .insert({
          name:     customSkillName.trim(),
          category: customSkillCategory.trim() || "Other",
        })
        .select()
        .single();

      if (skillErr || !newSkill) {
        // Try to find existing skill with same name
        const { data: existing } = await supabase
          .from("skills")
          .select("id")
          .ilike("name", customSkillName.trim())
          .single();
        if (existing) {
          finalSkillId = existing.id;
        } else {
          setError("Could not create custom skill. Please try again.");
          setSubmitting(false);
          return;
        }
      } else {
        finalSkillId = newSkill.id;
      }
    }

    const { data: listing, error: err } = await supabase.from("listings").insert({
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
      is_active:     true,
    }).select().single();

    if (err || !listing) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    if (portfolioItems.length > 0) {
      await supabase.from("portfolio_items").insert(
        portfolioItems.map(item => ({
          listing_id: listing.id,
          url:        item.url,
          type:       item.type,
          caption:    item.caption,
        }))
      );
    }

    setDone(true);
    setSubmitting(false);
  };

  // ── Done screen ────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center font-sans">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap'); .font-fraunces{font-family:'Fraunces',serif;} .font-sans{font-family:'DM Sans',sans-serif;}`}</style>
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center max-w-md shadow-lg">
          <div className="text-6xl mb-5">🎉</div>
          <h2 className="font-fraunces text-3xl font-black text-stone-900 mb-3">Listing Published!</h2>
          <p className="text-stone-500 text-sm leading-relaxed mb-1">
            <span className="font-bold text-stone-800">{form.title}</span> is now live on SkillCredit.
          </p>
          {isCustomSkill && (
            <p className="text-violet-600 text-sm font-bold mb-1">✨ New skill "{customSkillName}" added to the platform!</p>
          )}
          {portfolioItems.length > 0 && (
            <p className="text-emerald-600 text-sm font-bold mb-1">✅ {portfolioItems.length} portfolio sample{portfolioItems.length > 1 ? "s" : ""} uploaded!</p>
          )}
          <p className="text-stone-400 text-sm mb-8">Learners can now find and book a session with you!</p>
          <div className="flex gap-3">
            <a href="/listings" className="flex-1 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold no-underline text-center hover:bg-emerald-100 transition-colors">Browse All →</a>
            <a href="/profile"  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold no-underline text-center hover:bg-emerald-700 transition-colors">My Profile →</a>
          </div>
          <button
            onClick={() => { setDone(false); setStep(0); setPortfolioItems([]); setIsCustomSkill(false); setCustomSkillName(""); setCustomSkillCategory(""); setForm({ skill_id: "", title: "", description: "", prerequisites: "", outcomes: "", materials: "", format: "", duration: 60, credit_price: 10 }); }}
            className="mt-3 w-full py-3 bg-transparent text-stone-400 border border-stone-200 rounded-xl text-sm font-semibold cursor-pointer hover:bg-stone-50 transition-colors"
          >
            + Create another listing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap'); .font-fraunces{font-family:'Fraunces',serif;} .font-sans{font-family:'DM Sans',sans-serif;}`}</style>

      {/* Navbar */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-8 h-14 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-1">
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${i <= step ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-400"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`text-xs font-bold whitespace-nowrap ${i === step ? "text-stone-800" : "text-stone-400"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 ${i < step ? "bg-emerald-600" : "bg-stone-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">

          {/* ── STEP 0: Basic Info ── */}
          {step === 0 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Basic Information</h2>
                <p className="text-stone-400 text-sm">Tell learners what you're offering and what they'll get.</p>
              </div>

              {/* Skill picker */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">What skill are you teaching? *</label>
                <select
                  value={form.skill_id}
                  onChange={e => handleSkillChange(e.target.value)}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none cursor-pointer font-sans transition-colors ${form.skill_id ? "border-emerald-400" : "border-stone-200"}`}
                >
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

                {/* Custom skill fields */}
                {isCustomSkill && (
                  <div className="mt-3 bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">✨</span>
                      <p className="text-sm font-black text-violet-700">Add your own skill</p>
                      <span className="text-xs text-violet-400 font-medium">It'll be added to the platform!</span>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-violet-600 block mb-1.5">Skill Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Rubik's Cube Solving, Calligraphy, Drone Flying..."
                        value={customSkillName}
                        onChange={e => setCustomSkillName(e.target.value)}
                        maxLength={60}
                        className={`w-full p-3 rounded-xl border text-sm bg-white outline-none font-sans transition-colors ${customSkillName.length >= 2 ? "border-violet-400" : "border-violet-200"}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-violet-600 block mb-1.5">Category <span className="font-normal text-violet-400">(optional — helps learners find you)</span></label>
                      <input
                        type="text"
                        placeholder="e.g. Sports, Arts, Technology, Lifestyle..."
                        value={customSkillCategory}
                        onChange={e => setCustomSkillCategory(e.target.value)}
                        maxLength={40}
                        className="w-full p-3 rounded-xl border border-violet-200 text-sm bg-white outline-none font-sans"
                      />
                    </div>
                    <button
                      onClick={() => { setIsCustomSkill(false); setForm(p => ({ ...p, skill_id: "" })); setCustomSkillName(""); setCustomSkillCategory(""); }}
                      className="text-xs text-violet-400 hover:text-violet-600 transition-colors bg-transparent border-0 cursor-pointer text-left font-medium"
                    >
                      ← Back to skill list
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Listing Title * <span className="text-stone-300 font-normal normal-case">{form.title.length}/80</span>
                </label>
                <input
                  type="text" maxLength={80}
                  placeholder="e.g. Python for Complete Beginners — Zero to First Project"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none font-sans transition-colors ${form.title.length >= 5 ? "border-emerald-400" : "border-stone-200"}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Description * <span className="text-stone-300 font-normal normal-case">{form.description.length}/600</span>
                </label>
                <textarea
                  maxLength={600} rows={4}
                  placeholder="Describe what the session covers, your teaching style, and who this is for..."
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className={`w-full p-3 rounded-xl border text-sm bg-stone-50 outline-none font-sans resize-vertical transition-colors ${form.description.length >= 20 ? "border-emerald-400" : "border-stone-200"}`}
                />
              </div>

              {/* Prerequisites */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Prerequisites <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. No experience needed / Basic math knowledge"
                  value={form.prerequisites}
                  onChange={e => setForm(p => ({ ...p, prerequisites: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none font-sans"
                />
              </div>

              {/* Outcomes */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  What will learners walk away with? <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Understand variables and loops, build a simple calculator..."
                  value={form.outcomes}
                  onChange={e => setForm(p => ({ ...p, outcomes: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none font-sans resize-vertical"
                />
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

              {/* Format */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">Teaching Format *</label>
                <div className="grid grid-cols-2 gap-3">
                  {FORMATS.map(f => {
                    const isSelected = form.format === f.id;
                    const fc = FORMAT_COLORS[f.id];
                    return (
                      <div key={f.id} onClick={() => setForm(p => ({ ...p, format: f.id }))}
                        className={`p-4 rounded-2xl cursor-pointer border-2 transition-all ${isSelected ? `${fc.bg} ${fc.border}` : "bg-white border-stone-200 hover:border-stone-300"}`}>
                        <span className="text-2xl">{f.icon}</span>
                        <p className={`font-black text-sm mt-2 mb-1 ${isSelected ? fc.color : "text-stone-700"}`}>{f.label}</p>
                        <p className="text-xs text-stone-400 leading-snug">{f.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">Session Duration *</label>
                <div className="flex gap-3">
                  {DURATIONS.map(d => {
                    const isSelected = form.duration === d.value;
                    return (
                      <div key={d.value} onClick={() => setForm(p => ({ ...p, duration: d.value }))}
                        className={`flex-1 p-4 rounded-2xl cursor-pointer text-center border-2 transition-all ${isSelected ? "bg-emerald-50 border-emerald-400" : "bg-white border-stone-200 hover:border-stone-300"}`}>
                        <p className={`font-fraunces text-xl font-black mb-1 ${isSelected ? "text-emerald-700" : "text-stone-800"}`}>{d.label}</p>
                        <p className="text-xs text-stone-400">{d.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-3">
                  Credit Price per Session * <span className="font-normal text-stone-300 normal-case">= ₱{form.credit_price * 10}</span>
                </label>
                <div className="flex items-center gap-4 mb-3">
                  <button onClick={() => setForm(p => ({ ...p, credit_price: Math.max(5, p.credit_price - 5) }))}
                    className="w-10 h-10 rounded-xl border border-stone-200 bg-white text-xl cursor-pointer hover:bg-stone-50 transition-colors flex items-center justify-center flex-shrink-0 font-bold">−</button>
                  <div className="flex-1 text-center">
                    <p className="font-fraunces text-4xl font-black text-emerald-700">{form.credit_price}</p>
                    <p className="text-xs text-stone-400">credits · ₱{form.credit_price * 10}</p>
                  </div>
                  <button onClick={() => setForm(p => ({ ...p, credit_price: Math.min(100, p.credit_price + 5) }))}
                    className="w-10 h-10 rounded-xl border border-stone-200 bg-white text-xl cursor-pointer hover:bg-stone-50 transition-colors flex items-center justify-center flex-shrink-0 font-bold">+</button>
                </div>
                <input type="range" min={5} max={100} step={5} value={form.credit_price}
                  onChange={e => setForm(p => ({ ...p, credit_price: parseInt(e.target.value) }))}
                  className="w-full accent-emerald-600" />
                <div className="flex justify-between text-[10px] text-stone-300 mt-1">
                  <span>5 cr (₱50)</span><span>50 cr (₱500)</span><span>100 cr (₱1,000)</span>
                </div>
              </div>

              {/* Materials */}
              <div>
                <label className="text-xs font-black text-stone-500 uppercase tracking-wide block mb-2">
                  Materials you'll provide <span className="font-normal text-stone-300 normal-case">(optional)</span>
                </label>
                <input type="text"
                  placeholder="e.g. Slides, practice files, code templates"
                  value={form.materials}
                  onChange={e => setForm(p => ({ ...p, materials: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 outline-none font-sans" />
              </div>
            </div>
          )}

          {/* ── STEP 2: Portfolio ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Portfolio Samples 📁</h2>
                <p className="text-stone-400 text-sm">Show learners examples of your work. Listings with portfolios get <span className="font-bold text-emerald-600">3x more bookings</span>!</p>
              </div>
              <PortfolioUpload listingId={null} userId={userId || ""} onUpdate={setPortfolioItems} />
              {portfolioItems.length === 0 && (
                <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 text-center">
                  <p className="text-sm text-stone-400">No samples yet — you can skip this and add them later from your profile!</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div>
              <h2 className="font-fraunces text-xl font-black text-stone-900 mb-1">Preview & Publish</h2>
              <p className="text-stone-400 text-sm mb-6">This is how your listing will appear. Looks good? Hit publish!</p>

              <div className="bg-stone-50 rounded-2xl p-1 mb-6">
                <div className="bg-white rounded-xl p-6 border border-stone-200">
                  <div className="flex gap-2 flex-wrap mb-4">
                    {selectedSkill && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {selectedSkill.category} · {selectedSkill.name}
                      </span>
                    )}
                    {isCustomSkill && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700">✨ New Skill</span>
                    )}
                    {selectedFormat && (
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${FORMAT_COLORS[form.format]?.bg} ${FORMAT_COLORS[form.format]?.color}`}>
                        {selectedFormat.icon} {selectedFormat.label}
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">⏱ {selectedDuration?.label}</span>
                    {portfolioItems.length > 0 && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700">📁 {portfolioItems.length} sample{portfolioItems.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <h3 className="font-fraunces text-lg font-black text-stone-900 mb-3 leading-snug">{form.title || "Your listing title"}</h3>
                  <p className="text-sm text-stone-500 leading-relaxed mb-4">{form.description || "Your description will appear here."}</p>
                  {form.outcomes && (
                    <div className="bg-emerald-50 rounded-xl p-3 mb-3">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wide mb-1">You'll Learn</p>
                      <p className="text-sm text-stone-600">{form.outcomes}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                    <div>
                      <span className="font-fraunces text-2xl font-black text-emerald-700">{form.credit_price} cr</span>
                      <span className="text-sm text-stone-400 ml-2">per session · ₱{form.credit_price * 10}</span>
                    </div>
                    <div className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold">Book session →</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {[
                  { label: "Skill",     value: isCustomSkill ? `${customSkillName} (New ✨)` : selectedSkill?.name },
                  { label: "Category",  value: isCustomSkill ? (customSkillCategory || "Other") : selectedSkill?.category },
                  { label: "Format",    value: selectedFormat?.label },
                  { label: "Duration",  value: selectedDuration?.label },
                  { label: "Price",     value: `${form.credit_price} credits (₱${form.credit_price * 10})` },
                  { label: "Portfolio", value: portfolioItems.length > 0 ? `${portfolioItems.length} sample${portfolioItems.length > 1 ? "s" : ""} uploaded` : "No samples" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center px-4 py-2.5 bg-stone-50 rounded-xl text-sm">
                    <span className="text-stone-400 font-semibold">{item.label}</span>
                    <span className="text-stone-700 font-bold">{item.value}</span>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-stone-100">
            {step > 0 && (
              <button onClick={() => setStep(p => p - 1)}
                className="px-6 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold cursor-pointer hover:bg-stone-200 transition-colors border-0">
                ← Back
              </button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(p => p + 1)} disabled={!canProceed()}
                className={`px-7 py-3 rounded-xl text-sm font-black text-white border-0 transition-colors ${canProceed() ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer" : "bg-stone-200 text-stone-400 cursor-not-allowed"}`}>
                {step === 2 && portfolioItems.length === 0 ? "Skip →" : "Continue →"}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black border-0 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? "Publishing..." : "🚀 Publish Listing"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}