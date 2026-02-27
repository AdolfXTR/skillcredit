"use client";
import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
export type PortfolioItem = {
  id: string;
  listing_id: string;
  url: string;
  type: "image" | "video" | "link" | "pdf";
  caption: string;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getFileType(file: File): "image" | "video" | "pdf" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "pdf";
}

function getTypeIcon(type: string) {
  if (type === "image") return "🖼️";
  if (type === "video") return "🎬";
  if (type === "pdf")   return "📄";
  return "🔗";
}

function getTypeBadge(type: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    image: { bg: "bg-sky-50",     color: "text-sky-700",    label: "Image" },
    video: { bg: "bg-violet-50",  color: "text-violet-700", label: "Video" },
    pdf:   { bg: "bg-amber-50",   color: "text-amber-700",  label: "PDF" },
    link:  { bg: "bg-emerald-50", color: "text-emerald-700",label: "Link" },
  };
  return map[type] || map.link;
}

// ── PortfolioUpload (for create/edit listing) ─────────────────────────────────
export function PortfolioUpload({
  listingId,
  userId,
  onUpdate,
}: {
  listingId: string | null; // null = listing not created yet, upload after submit
  userId: string;
  onUpdate?: (items: PortfolioItem[]) => void;
}) {
  const [items, setItems]       = useState<PortfolioItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (items.length >= 3) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Max 10MB per file.");
      return;
    }

    setUploading(true);
    const ext  = file.name.split(".").pop();
    const path = `portfolios/${userId}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("portfolio-uploads")
      .upload(path, file, { upsert: true });

    if (upErr) {
      alert("Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("portfolio-uploads")
      .getPublicUrl(path);

    const newItem: PortfolioItem = {
      id:         crypto.randomUUID(),
      listing_id: listingId || "pending",
      url:        publicUrl,
      type:       getFileType(file),
      caption:    "",
      created_at: new Date().toISOString(),
    };

    const updated = [...items, newItem];
    setItems(updated);
    onUpdate?.(updated);
    setUploading(false);
  };

  const addLink = () => {
    if (!linkInput.trim() || items.length >= 3) return;
    try { new URL(linkInput); } catch { alert("Please enter a valid URL."); return; }

    const newItem: PortfolioItem = {
      id:         crypto.randomUUID(),
      listing_id: listingId || "pending",
      url:        linkInput.trim(),
      type:       "link",
      caption:    linkCaption.trim(),
      created_at: new Date().toISOString(),
    };

    const updated = [...items, newItem];
    setItems(updated);
    onUpdate?.(updated);
    setLinkInput("");
    setLinkCaption("");
    setShowLinkForm(false);
  };

  const removeItem = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    onUpdate?.(updated);
  };

  const updateCaption = (id: string, caption: string) => {
    setCaptions(p => ({ ...p, [id]: caption }));
    const updated = items.map(i => i.id === id ? { ...i, caption } : i);
    setItems(updated);
    onUpdate?.(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-stone-700">Portfolio Samples
            <span className="ml-2 text-xs font-normal text-stone-400">(optional — up to 3)</span>
          </p>
          <p className="text-xs text-stone-400 mt-0.5">Show learners examples of your work to build trust and boost bookings</p>
        </div>
        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
          items.length >= 3 ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"
        }`}>
          {items.length}/3
        </span>
      </div>

      {/* Uploaded items */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {items.map(item => {
            const badge = getTypeBadge(item.type);
            return (
              <div key={item.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                {/* Preview */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-stone-200 flex items-center justify-center">
                  {item.type === "image" ? (
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{getTypeIcon(item.type)}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
                      {badge.label}
                    </span>
                    {item.type === "link" && (
                      <a href={item.url} target="_blank" rel="noreferrer"
                        className="text-xs text-emerald-600 truncate max-w-[180px] no-underline hover:underline">
                        {item.url}
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Add a caption... (optional)"
                    value={captions[item.id] || item.caption}
                    onChange={e => updateCaption(item.id, e.target.value)}
                    maxLength={80}
                    className="w-full text-xs p-2 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-emerald-400 transition-colors font-sans"
                  />
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-sm flex-shrink-0 border-0 cursor-pointer transition-colors"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload area — hide when max reached */}
      {items.length < 3 && (
        <div className="flex flex-col gap-2">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-emerald-400 bg-emerald-50"
                : "border-stone-200 hover:border-emerald-300 hover:bg-stone-50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            />
            {uploading ? (
              <div>
                <div className="text-2xl mb-2 animate-pulse">⏳</div>
                <p className="text-sm font-bold text-stone-500">Uploading...</p>
              </div>
            ) : (
              <div>
                <div className="text-2xl mb-2">📎</div>
                <p className="text-sm font-bold text-stone-600">Drop a file or click to upload</p>
                <p className="text-xs text-stone-400 mt-1">Images, videos, PDFs · Max 10MB</p>
              </div>
            )}
          </div>

          {/* Link option */}
          {!showLinkForm ? (
            <button
              onClick={() => setShowLinkForm(true)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors bg-transparent border-0 cursor-pointer py-1"
            >
              + Add a link instead (GitHub, Behance, YouTube, etc.)
            </button>
          ) : (
            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-3 flex flex-col gap-2">
              <input
                type="url"
                placeholder="https://github.com/yourproject"
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-emerald-400 transition-colors font-sans"
              />
              <input
                type="text"
                placeholder="Caption (optional)"
                value={linkCaption}
                onChange={e => setLinkCaption(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-emerald-400 transition-colors font-sans"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowLinkForm(false)} className="flex-1 py-2 bg-stone-100 text-stone-500 text-xs font-bold rounded-xl border-0 cursor-pointer hover:bg-stone-200 transition-colors">
                  Cancel
                </button>
                <button onClick={addLink} className="flex-[2] py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl border-0 cursor-pointer hover:bg-emerald-700 transition-colors">
                  Add Link
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PortfolioGallery (for listing detail page) ────────────────────────────────
export function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6">
      <h3 className="font-fraunces text-base font-black text-stone-900 mb-4">
        📁 Portfolio Samples
        <span className="ml-2 text-xs font-normal text-stone-400">{items.length} sample{items.length !== 1 ? "s" : ""}</span>
      </h3>

      <div className={`grid gap-3 ${items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {items.map(item => {
          const badge = getTypeBadge(item.type);
          return (
            <div
              key={item.id}
              className="group cursor-pointer"
              onClick={() => item.type === "link" ? window.open(item.url, "_blank") : setLightbox(item)}
            >
              {/* Thumbnail */}
              <div className="relative rounded-2xl overflow-hidden bg-stone-100 aspect-video mb-2">
                {item.type === "image" ? (
                  <>
                    <img src={item.url} alt={item.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-2xl transition-opacity">🔍</span>
                    </div>
                  </>
                ) : item.type === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <span className="text-4xl">🎬</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <span className="text-white text-xl ml-1">▶</span>
                      </div>
                    </div>
                  </div>
                ) : item.type === "pdf" ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50">
                    <span className="text-4xl mb-1">📄</span>
                    <span className="text-xs font-bold text-amber-700">PDF Document</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                    <span className="text-3xl mb-1">🔗</span>
                    <span className="text-xs font-bold text-emerald-700 px-2 text-center truncate w-full px-4">
                      {item.url.replace(/^https?:\/\//, "")}
                    </span>
                  </div>
                )}

                {/* Type badge */}
                <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              {/* Caption */}
              {item.caption && (
                <p className="text-xs text-stone-500 leading-snug px-1">{item.caption}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white text-2xl font-black bg-transparent border-0 cursor-pointer hover:opacity-70 transition-opacity"
            >
              ✕
            </button>
            {lightbox.type === "image" && (
              <img src={lightbox.url} alt={lightbox.caption} className="w-full rounded-2xl max-h-[80vh] object-contain" />
            )}
            {lightbox.type === "video" && (
              <video src={lightbox.url} controls autoPlay className="w-full rounded-2xl max-h-[80vh]" />
            )}
            {lightbox.type === "pdf" && (
              <div className="bg-white rounded-2xl p-8 text-center">
                <div className="text-5xl mb-4">📄</div>
                <p className="font-bold text-stone-800 mb-2">{lightbox.caption || "PDF Document"}</p>
                <a href={lightbox.url} target="_blank" rel="noreferrer"
                  className="inline-block bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl no-underline hover:bg-emerald-700 transition-colors">
                  Open PDF →
                </a>
              </div>
            )}
            {lightbox.caption && (
              <p className="text-white/70 text-sm text-center mt-3">{lightbox.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}