"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Rating = {
  id: string;
  session_id: string;
  rater_id: string;
  ratee_id: string;
  role: "teacher" | "learner";
  knowledge: number;
  communication: number;
  punctuality: number;
  overall: number;
  review_text: string;
  created_at: string;
  rater: { full_name: string; username: string; level: string };
  ratee: { full_name: string; username: string };
};

const mockRatings = [
  { id: "1", session_id: "s1", rater_id: "r1", ratee_id: "r2", role: "teacher" as const, knowledge: 5, communication: 5, punctuality: 4, overall: 5, review_text: "Maria is an amazing Python teacher! She explained everything so clearly and was super patient with my questions. Highly recommend!", created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), rater: { full_name: "Juan dela Cruz", username: "juandc", level: "Seedling" }, ratee: { full_name: "Maria Santos", username: "mariasantos" } },
  { id: "2", session_id: "s2", rater_id: "r2", ratee_id: "r3", role: "teacher" as const, knowledge: 5, communication: 4, punctuality: 5, overall: 5, review_text: "Carlo really knows his React stuff. The session was well-structured and I learned a ton about hooks and state management.", created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), rater: { full_name: "Bea Aquino", username: "beaaquino", level: "Learner" }, ratee: { full_name: "Carlo Reyes", username: "carloreyes" } },
  { id: "3", session_id: "s3", rater_id: "r3", ratee_id: "r4", role: "learner" as const, knowledge: 4, communication: 5, punctuality: 5, overall: 4, review_text: "Great learner! Came prepared with good questions and was very engaged throughout the session.", created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), rater: { full_name: "Reina Cruz", username: "reinacruz", level: "Master" }, ratee: { full_name: "Sam Ramos", username: "samramos" } },
  { id: "4", session_id: "s4", rater_id: "r4", ratee_id: "r5", role: "teacher" as const, knowledge: 5, communication: 5, punctuality: 5, overall: 5, review_text: "Ana is the best math tutor I've ever had. She broke down calculus in a way that finally made sense to me!", created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), rater: { full_name: "Kiko Dela Cruz", username: "kikodelacruz", level: "Skilled" }, ratee: { full_name: "Ana Villanueva", username: "anavillanueva" } },
];

const StarRating = ({ value, max = 5 }: { value: number; max?: number }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} style={{ fontSize: 14, color: i < value ? "#f59e0b" : "#e8e0d0" }}>★</span>
    ))}
  </div>
);

const InteractiveStars = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div style={{ display: "flex", gap: 4 }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        onClick={() => onChange(i + 1)}
        style={{ fontSize: 28, cursor: "pointer", color: i < value ? "#f59e0b" : "#e8e0d0", transition: "color 0.1s" }}
      >
        ★
      </span>
    ))}
  </div>
);

export default function RatingsPage() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "teachers" | "learners">("all");
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    knowledge: 0, communication: 0, punctuality: 0, overall: 0,
    review_text: "", role: "teacher" as "teacher" | "learner",
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data, error } = await supabase
        .from("ratings")
        .select(`*, rater:rater_id(full_name, username, level), ratee:ratee_id(full_name, username)`)
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) {
        setRatings(mockRatings as unknown as Rating[]);
      } else {
        setRatings(data as Rating[]);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSubmit = async () => {
    if (!user) { window.location.href = "/login"; return; }
    if (form.overall === 0) return;
    setSubmitting(true);

    await supabase.from("ratings").insert({
      rater_id: user.id,
      ratee_id: user.id,
      role: form.role,
      knowledge: form.knowledge || form.overall,
      communication: form.communication || form.overall,
      punctuality: form.punctuality || form.overall,
      overall: form.overall,
      review_text: form.review_text,
    });

    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => { setShowModal(false); setSubmitted(false); }, 2000);
  };

  const filtered = ratings.filter(r => tab === "all" || r.role === (tab === "teachers" ? "teacher" : "learner"));

  const avgOverall = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.overall, 0) / ratings.length).toFixed(1)
    : "0.0";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Rate Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)", padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "40px", maxWidth: 480, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 64 }}>⭐</div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginTop: 16 }}>Review submitted!</h2>
                <p style={{ color: "#888", fontSize: 14 }}>Thank you for your feedback.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Rate a Session ⭐</h2>
                <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Your review helps the community find great teachers and learners!</p>

                {/* Role toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                  {["teacher", "learner"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setForm(p => ({ ...p, role: r as "teacher" | "learner" }))}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${form.role === r ? "#2d6a4f" : "#e8e0d0"}`, background: form.role === r ? "#e8f4e8" : "white", color: form.role === r ? "#2d6a4f" : "#555", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {r === "teacher" ? "🎓 Rating a Teacher" : "📚 Rating a Learner"}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {form.role === "teacher" ? (
                    <>
                      {[
                        { key: "knowledge", label: "Knowledge & Expertise" },
                        { key: "communication", label: "Communication" },
                        { key: "punctuality", label: "Punctuality" },
                        { key: "overall", label: "Overall Rating" },
                      ].map((criterion) => (
                        <div key={criterion.key}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>{criterion.label}</p>
                          <InteractiveStars
                            value={form[criterion.key as keyof typeof form] as number}
                            onChange={(v) => setForm(p => ({ ...p, [criterion.key]: v }))}
                          />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {[
                        { key: "communication", label: "Communication & Responsiveness" },
                        { key: "punctuality", label: "Preparedness & Punctuality" },
                        { key: "overall", label: "Overall Rating" },
                      ].map((criterion) => (
                        <div key={criterion.key}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>{criterion.label}</p>
                          <InteractiveStars
                            value={form[criterion.key as keyof typeof form] as number}
                            onChange={(v) => setForm(p => ({ ...p, [criterion.key]: v }))}
                          />
                        </div>
                      ))}
                    </>
                  )}

                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#333", marginBottom: 8 }}>Written Review <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span></p>
                    <textarea
                      placeholder="Share your experience..."
                      value={form.review_text}
                      onChange={(e) => setForm(p => ({ ...p, review_text: e.target.value.slice(0, 300) }))}
                      rows={3}
                      style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1.5px solid #e8e0d0", fontSize: 14, outline: "none", background: "#fafaf8", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif", resize: "none" }}
                    />
                    <p style={{ fontSize: 11, color: "#aaa", textAlign: "right", marginTop: 4 }}>{form.review_text.length}/300</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                  <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "13px", background: "#f5f0e8", color: "#555", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || form.overall === 0}
                    style={{ flex: 2, padding: "13px", background: form.overall === 0 ? "#ccc" : "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: form.overall === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {submitting ? "Submitting..." : "Submit Review ⭐"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dashboard" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Dashboard</a>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse</a>
          {user && (
            <button onClick={() => setShowModal(true)} style={{ padding: "8px 16px", borderRadius: 10, background: "#f59e0b", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              ⭐ Write a Review
            </button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Ratings & Reviews ⭐</h1>
            <p style={{ fontSize: 15, color: "#888" }}>What the community is saying about teachers and learners</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Avg Rating", value: `${avgOverall}★`, color: "#f59e0b", bg: "#fffbf0" },
              { label: "Total Reviews", value: ratings.length, color: "#2d6a4f", bg: "#e8f4e8" },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 20px", textAlign: "center", border: `1px solid ${s.color}30` }}>
                <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 14, padding: 4, marginBottom: 24, border: "1px solid #e8e0d0", width: "fit-content" }}>
          {[
            { key: "all", label: "All Reviews" },
            { key: "teachers", label: "🎓 Teachers" },
            { key: "learners", label: "📚 Learners" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: tab === t.key ? "#2d6a4f" : "transparent", color: tab === t.key ? "white" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Reviews list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <span style={{ fontSize: 36 }}>⭐</span>
            <p style={{ color: "#888", marginTop: 12 }}>Loading reviews...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.map((rating) => (
              <div key={rating.id} style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e8f4e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#2d6a4f" }}>
                      {rating.rater?.full_name?.[0] || "?"}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{rating.rater?.full_name}</p>
                      <p style={{ fontSize: 12, color: "#888", margin: 0 }}>@{rating.rater?.username} · rated <strong>@{rating.ratee?.username}</strong></p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, background: rating.role === "teacher" ? "#e8f4e8" : "#e0f2fe", color: rating.role === "teacher" ? "#2d6a4f" : "#0369a1", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>
                      {rating.role === "teacher" ? "🎓 Teacher Review" : "📚 Learner Review"}
                    </span>
                    <span style={{ fontSize: 12, color: "#aaa" }}>{new Date(rating.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Star breakdown */}
                <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
                  {rating.role === "teacher" ? (
                    <>
                      <div><p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Knowledge</p><StarRating value={rating.knowledge} /></div>
                      <div><p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Communication</p><StarRating value={rating.communication} /></div>
                      <div><p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Punctuality</p><StarRating value={rating.punctuality} /></div>
                    </>
                  ) : (
                    <>
                      <div><p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Communication</p><StarRating value={rating.communication} /></div>
                      <div><p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Preparedness</p><StarRating value={rating.punctuality} /></div>
                    </>
                  )}
                  <div>
                    <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px" }}>Overall</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <StarRating value={rating.overall} />
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{rating.overall}.0</span>
                    </div>
                  </div>
                </div>

                {/* Review text */}
                {rating.review_text && (
                  <div style={{ background: "#fafaf8", borderRadius: 12, padding: "14px 16px", borderLeft: "3px solid #f59e0b" }}>
                    <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                      &ldquo;{rating.review_text}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <span style={{ fontSize: 48 }}>⭐</span>
                <p style={{ color: "#888", fontSize: 15, marginTop: 12 }}>No reviews yet</p>
                {user && (
                  <button onClick={() => setShowModal(true)} style={{ marginTop: 16, padding: "10px 24px", background: "#f59e0b", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    Write the first review!
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}