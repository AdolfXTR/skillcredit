"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; username: string };

type CompletedSession = {
  id: string;
  teacher_id: string;
  learner_id: string;
  credit_amount: number;
  proposed_time: string;
  listing: { title: string };
  teacher: Profile;
  learner: Profile;
};

type Rating = {
  id: string;
  session_id: string;
  rater_id: string;
  rated_id: string;
  knowledge: number | null;
  communication: number | null;
  punctuality: number | null;
  preparedness: number | null;
  respectfulness: number | null;
  overall: number;
  review: string | null;
  created_at: string;
  rater: Profile;
  rated: Profile;
  role_rated: "teacher" | "learner";
};

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < Math.round(value) ? "text-amber-400" : "text-stone-200"}`}>★</span>
      ))}
    </div>
  );
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(0)}
          className={`text-3xl cursor-pointer transition-colors select-none ${i < (hover || value) ? "text-amber-400" : "text-stone-200"}`}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function RatingsPage() {
  const [user,           setUser]           = useState<Profile | null>(null);
  const [ratings,        setRatings]        = useState<Rating[]>([]);
  const [sessions,       setSessions]       = useState<CompletedSession[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState<"all" | "teacher" | "learner">("all");
  const [showModal,      setShowModal]      = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [submitted,      setSubmitted]      = useState(false);
  const [alreadyRated,   setAlreadyRated]   = useState<string[]>([]);
  const [submitError,    setSubmitError]    = useState("");

  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [roleRated,       setRoleRated]       = useState<"teacher" | "learner">("teacher");
  const [form, setForm] = useState({
    knowledge: 0, communication: 0, punctuality: 0,
    preparedness: 0, respectfulness: 0, overall: 0, review: "",
  });

  const loadData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { window.location.href = "/login"; return; }

    const { data: profile } = await supabase
      .from("profiles").select("id, full_name, username").eq("id", u.id).single();
    setUser(profile);

    // ✅ Fetch all ratings for the community feed
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select(`
        id, session_id, rater_id, rated_id,
        knowledge, communication, punctuality, preparedness, respectfulness,
        overall, review, created_at, role_rated,
        rater:rater_id ( id, full_name, username ),
        rated:rated_id ( id, full_name, username )
      `)
      .order("created_at", { ascending: false });

    if (ratingsData) setRatings(ratingsData as unknown as Rating[]);

    const { data: sessionData } = await supabase
      .from("sessions")
      .select(`
        id, teacher_id, learner_id, credit_amount, proposed_time,
        listing:listing_id ( title ),
        teacher:teacher_id ( id, full_name, username ),
        learner:learner_id ( id, full_name, username )
      `)
      .or(`teacher_id.eq.${u.id},learner_id.eq.${u.id}`)
      .eq("status", "completed");

    if (sessionData) setSessions(sessionData as unknown as CompletedSession[]);

    const { data: myRatings } = await supabase
      .from("ratings").select("session_id").eq("rater_id", u.id);
    if (myRatings) setAlreadyRated(myRatings.map(r => r.session_id).filter(Boolean));

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSelectSession = (session: CompletedSession) => {
    setSelectedSession(session);
    const role: "teacher" | "learner" = session.learner_id === user?.id ? "teacher" : "learner";
    setRoleRated(role);
    setForm({ knowledge: 0, communication: 0, punctuality: 0, preparedness: 0, respectfulness: 0, overall: 0, review: "" });
    setSubmitError("");
  };

  const handleSubmit = async () => {
    if (!user || !selectedSession || form.overall === 0) return;
    setSubmitting(true);
    setSubmitError("");

    const ratedId = roleRated === "teacher"
      ? selectedSession.teacher_id
      : selectedSession.learner_id;

    // ✅ FIXED: correct fields per role, is_revealed + is_flagged set
    const payload = {
      session_id:     selectedSession.id,
      rater_id:       user.id,
      rated_id:       ratedId,
      role_rated:     roleRated,
      overall:        form.overall,
      communication:  form.communication || null,
      is_revealed:    true,
      is_flagged:     false,
      // Teacher rates learner → preparedness + respectfulness
      ...(roleRated === "learner" ? {
        preparedness:   form.preparedness   || null,
        respectfulness: form.respectfulness || null,
        knowledge:      null,
        punctuality:    null,
      } : {
        // Learner rates teacher → knowledge + punctuality
        knowledge:      form.knowledge   || null,
        punctuality:    form.punctuality || null,
        preparedness:   null,
        respectfulness: null,
      }),
      review: form.review || null,
    };

    const { error } = await supabase.from("ratings").insert(payload);

    if (error) {
      setSubmitError(`Failed: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setAlreadyRated(prev => [...prev, selectedSession.id]);
    await loadData();
    setTimeout(() => {
      setShowModal(false);
      setSubmitted(false);
      setSelectedSession(null);
      setForm({ knowledge: 0, communication: 0, punctuality: 0, preparedness: 0, respectfulness: 0, overall: 0, review: "" });
    }, 2000);
    setSubmitting(false);
  };

  const filtered = ratings.filter(r =>
    tab === "all" ? true : r.role_rated === tab
  );

  // ✅ FIXED: avg rating is only ratings WHERE the current user is the rated person
  const myReceivedRatings = ratings.filter(r => r.rated_id === user?.id);
  const avgRating = myReceivedRatings.length > 0
    ? (myReceivedRatings.reduce((s, r) => s + r.overall, 0) / myReceivedRatings.length).toFixed(1)
    : "—";

  const unratedSessions = sessions.filter(s => !alreadyRated.includes(s.id));

  const initials = (name: string) =>
    name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  // ✅ FIXED: proper decimal display, no hardcoded .0
  const formatRating = (val: number) =>
    Number.isInteger(val) ? `${val}.0` : val.toFixed(1);

  return (
    <div className="min-h-screen bg-[#faf8f4]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        a{text-decoration:none;color:inherit}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp .35s ease both}
        .navlink{padding:5px 11px;border-radius:7px;font-size:13px;font-weight:600;color:#666;transition:all .12s;display:inline-block}
        .navlink:hover{background:#f0ece4;color:#1a1a1a}
        .rating-card{transition:box-shadow .15s,transform .15s}
        .rating-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-1px)}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .modal-anim{animation:slideUp .22s ease}
      `}</style>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="modal-anim bg-white rounded-3xl p-7 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="text-center py-10">
                <div className="text-5xl mb-4">🌟</div>
                <h2 className="text-2xl font-900 text-stone-900 mb-2" style={{ fontFamily: "'Fraunces', serif" }}>Review Submitted!</h2>
                <p className="text-sm text-stone-400">Thank you for your feedback.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-xl font-900 text-stone-900 mb-1" style={{ fontFamily: "'Fraunces', serif" }}>Rate a Session</h2>
                    <p className="text-xs text-stone-400">Your honest review helps the community grow</p>
                  </div>
                  <button onClick={() => { setShowModal(false); setSelectedSession(null); }}
                    className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:bg-stone-200 transition-colors text-sm border-0 cursor-pointer">
                    ✕
                  </button>
                </div>

                {/* Session selector */}
                <div className="mb-5">
                  <p className="text-xs font-800 text-stone-400 uppercase tracking-widest mb-2">Select Session</p>
                  {unratedSessions.length === 0 ? (
                    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-center">
                      <p className="text-sm text-stone-400">
                        {sessions.length === 0
                          ? "No completed sessions yet."
                          : "You've rated all your sessions! 🎉"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-44 overflow-y-auto">
                      {unratedSessions.map(session => {
                        const isSelected = selectedSession?.id === session.id;
                        const isLearner  = session.learner_id === user?.id;
                        const other      = isLearner ? session.teacher : session.learner;
                        return (
                          <button key={session.id} onClick={() => handleSelectSession(session)}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? "bg-green-50 border-green-300" : "bg-stone-50 border-stone-200 hover:border-green-200"}`}
                            style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <p className={`text-sm font-700 ${isSelected ? "text-green-700" : "text-stone-700"}`}>
                              {session.listing?.title || "Session"}
                            </p>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {isLearner ? "Rating teacher:" : "Rating learner:"} {other?.full_name}
                              {" · "}{new Date(session.proposed_time).toLocaleDateString()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedSession && (
                  <>
                    {/* Who are we rating */}
                    <div className={`rounded-xl border p-3 mb-5 ${roleRated === "teacher" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
                      <p className={`text-xs font-700 ${roleRated === "teacher" ? "text-green-700" : "text-blue-700"}`}>
                        {roleRated === "teacher" ? "You are rating the Teacher:" : "You are rating the Learner:"}
                      </p>
                      <p className={`text-sm font-800 mt-0.5 ${roleRated === "teacher" ? "text-green-900" : "text-blue-900"}`}>
                        {roleRated === "teacher" ? selectedSession.teacher?.full_name : selectedSession.learner?.full_name}
                      </p>
                    </div>

                    <div className="flex flex-col gap-5 mb-5">
                      {/* ✅ FIXED: correct criteria per role */}
                      {roleRated === "teacher" ? (
                        <>
                          {[
                            { key: "knowledge",     label: "Knowledge & Expertise" },
                            { key: "communication", label: "Communication"          },
                            { key: "punctuality",   label: "Punctuality"            },
                            { key: "overall",       label: "Overall Rating"         },
                          ].map(c => (
                            <div key={c.key}>
                              <p className="text-sm font-700 text-stone-700 mb-2">{c.label}</p>
                              <InteractiveStars value={form[c.key as keyof typeof form] as number} onChange={v => setForm(p => ({ ...p, [c.key]: v }))} />
                              {(form[c.key as keyof typeof form] as number) > 0 && (
                                <p className="text-xs text-amber-500 font-700 mt-1">{["","Poor","Fair","Good","Great","Excellent!"][form[c.key as keyof typeof form] as number]}</p>
                              )}
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { key: "overall",        label: "Overall Rating"  },
                            { key: "preparedness",   label: "Preparedness"    },
                            { key: "respectfulness", label: "Respectfulness"  },
                            { key: "communication",  label: "Communication"   },
                          ].map(c => (
                            <div key={c.key}>
                              <p className="text-sm font-700 text-stone-700 mb-2">{c.label}</p>
                              <InteractiveStars value={form[c.key as keyof typeof form] as number} onChange={v => setForm(p => ({ ...p, [c.key]: v }))} />
                              {(form[c.key as keyof typeof form] as number) > 0 && (
                                <p className="text-xs text-amber-500 font-700 mt-1">{["","Poor","Fair","Good","Great","Excellent!"][form[c.key as keyof typeof form] as number]}</p>
                              )}
                            </div>
                          ))}
                        </>
                      )}

                      <div>
                        <p className="text-sm font-700 text-stone-700 mb-2">
                          Written Review <span className="text-stone-300 font-400">(optional)</span>
                        </p>
                        <textarea value={form.review}
                          onChange={e => setForm(p => ({ ...p, review: e.target.value.slice(0, 300) }))}
                          placeholder="Share your experience…" rows={3}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 resize-none outline-none focus:border-[#2d6a4f] transition-colors"
                          style={{ fontFamily: "'DM Sans', sans-serif" }} />
                        <p className="text-xs text-stone-300 text-right mt-1">{form.review.length}/300</p>
                      </div>
                    </div>
                  </>
                )}

                {submitError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-600 font-600">
                    ⚠️ {submitError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setShowModal(false); setSelectedSession(null); }}
                    className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-700 hover:bg-stone-200 transition-colors border-0 cursor-pointer"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit}
                    disabled={submitting || !selectedSession || form.overall === 0}
                    className="py-3 px-6 rounded-xl text-sm font-800 text-white transition-colors border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ flex: 2, background: !selectedSession || form.overall === 0 ? "#e5e7eb" : "#2d6a4f", color: !selectedSession || form.overall === 0 ? "#9ca3af" : "#fff", fontFamily: "'DM Sans', sans-serif", cursor: !selectedSession || form.overall === 0 ? "not-allowed" : "pointer" }}>
                    {submitting ? "Submitting…" : "Submit Review ★"}
                  </button>
                </div>
              </>
            )}
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
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-800 px-4 py-2 rounded-xl transition-colors border-0 cursor-pointer"
          style={{ fontFamily: "'DM Sans', sans-serif" }}>
          ★ Write a Review
        </button>
      </nav>

      {/* BODY */}
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8 fade-up">
          <div>
            <p className="text-xs font-800 text-[#2d6a4f] tracking-widest uppercase mb-2">Community</p>
            <h1 className="text-4xl font-900 text-stone-900 leading-none tracking-tight mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
              Ratings & Reviews
            </h1>
            <p className="text-sm text-stone-400">What the community says about teachers and learners</p>
          </div>
          <div className="flex gap-3">
            {/* ✅ FIXED: avgRating is now MY received ratings only */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-center">
              <p className="text-2xl font-900 text-amber-500 leading-none mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
                {avgRating}{avgRating !== "—" ? "★" : ""}
              </p>
              <p className="text-xs text-stone-400 font-600">My Avg Rating</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-center">
              <p className="text-2xl font-900 text-[#2d6a4f] leading-none mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
                {ratings.length}
              </p>
              <p className="text-xs text-stone-400 font-600">Total Reviews</p>
            </div>
          </div>
        </div>

        {/* Unrated sessions banner */}
        {unratedSessions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4 fade-up">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-800 text-sm">{unratedSessions.length}</div>
              <div>
                <p className="text-sm font-800 text-amber-800">
                  {unratedSessions.length} unrated session{unratedSessions.length > 1 ? "s" : ""} waiting
                </p>
                <p className="text-xs text-amber-600">Share your experience and help the community.</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-white text-xs font-800 px-4 py-2 rounded-xl transition-colors border-0 cursor-pointer whitespace-nowrap"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Rate Now →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-stone-100 p-1 rounded-xl gap-0.5 w-fit mb-6">
          {[
            { key: "all",     label: "All Reviews" },
            { key: "teacher", label: "Teachers"    },
            { key: "learner", label: "Learners"    },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-700 transition-all border-0 cursor-pointer ${tab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600 bg-transparent"}`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Ratings list */}
        {loading ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-sm text-stone-400">Loading reviews…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
            <p className="text-5xl mb-3">⭐</p>
            <p className="text-sm text-stone-400 mb-5">No reviews yet in this category</p>
            <button onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-white text-sm font-700 px-5 py-2.5 rounded-xl transition-colors border-0 cursor-pointer"
              style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Write the first review!
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(rating => (
              <div key={rating.id} className="rating-card bg-white rounded-2xl border border-stone-200 p-5" style={{ borderLeft: `3px solid ${rating.role_rated === "teacher" ? "#22c55e" : "#3b82f6"}` }}>
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 font-800 text-xs flex items-center justify-center shrink-0">
                      {initials(rating.rater?.full_name || "")}
                    </div>
                    <div>
                      <p className="text-sm font-700 text-stone-800">{rating.rater?.full_name}</p>
                      <p className="text-xs text-stone-400">
                        @{rating.rater?.username} rated{" "}
                        <span className="font-700 text-stone-600">@{rating.rated?.username}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-700 px-2.5 py-1 rounded-full ${rating.role_rated === "teacher" ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                      {rating.role_rated === "teacher" ? "🎓 Teacher Review" : "📚 Learner Review"}
                    </span>
                    <span className="text-xs text-stone-300">
                      {new Date(rating.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Stars breakdown — ✅ FIXED: correct fields per role */}
                <div className="flex flex-wrap gap-5 mb-4">
                  {rating.role_rated === "teacher" ? (
                    <>
                      {rating.knowledge     != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Knowledge</p><Stars value={rating.knowledge} /></div>}
                      {rating.communication != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Communication</p><Stars value={rating.communication} /></div>}
                      {rating.punctuality   != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Punctuality</p><Stars value={rating.punctuality} /></div>}
                    </>
                  ) : (
                    <>
                      {rating.preparedness   != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Preparedness</p><Stars value={rating.preparedness} /></div>}
                      {rating.respectfulness != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Respectfulness</p><Stars value={rating.respectfulness} /></div>}
                      {rating.communication  != null && <div><p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Communication</p><Stars value={rating.communication} /></div>}
                    </>
                  )}
                  <div>
                    <p className="text-xs font-700 text-stone-400 uppercase tracking-wider mb-1">Overall</p>
                    <div className="flex items-center gap-2">
                      <Stars value={rating.overall} />
                      {/* ✅ FIXED: no hardcoded .0 */}
                      <span className="text-base font-900 text-amber-500" style={{ fontFamily: "'Fraunces', serif" }}>{formatRating(rating.overall)}</span>
                    </div>
                  </div>
                </div>

                {/* Review text */}
                {rating.review && (
                  <div className="bg-stone-50 rounded-xl border-l-4 border-amber-300 px-4 py-3">
                    <p className="text-sm text-stone-600 italic leading-relaxed">"{rating.review}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}