"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────
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
  knowledge: number;
  communication: number;
  punctuality: number;
  overall: number;
  review: string;
  created_at: string;
  rater: Profile;
  rated: Profile;
  role_rated: "teacher" | "learner";
};

// ── Star components ──────────────────────────────────────────────────────────
function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`text-sm ${i < value ? "text-amber-400" : "text-stone-200"}`}>★</span>
      ))}
    </div>
  );
}

function InteractiveStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          onClick={() => onChange(i + 1)}
          onMouseEnter={() => setHover(i + 1)}
          onMouseLeave={() => setHover(0)}
          className={`text-3xl cursor-pointer transition-colors ${
            i < (hover || value) ? "text-amber-400" : "text-stone-200"
          }`}
        >★</span>
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RatingsPage() {
  const [user, setUser]               = useState<Profile | null>(null);
  const [ratings, setRatings]         = useState<Rating[]>([]);
  const [sessions, setSessions]       = useState<CompletedSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<"all" | "teacher" | "learner">("all");
  const [showModal, setShowModal]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [alreadyRated, setAlreadyRated] = useState<string[]>([]);

  // Form state
  const [selectedSession, setSelectedSession] = useState<CompletedSession | null>(null);
  const [roleRated, setRoleRated]   = useState<"teacher" | "learner">("teacher");
  const [form, setForm] = useState({
    knowledge: 0, communication: 0, punctuality: 0, overall: 0, review: "",
  });

  const loadData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) { window.location.href = "/login"; return; }

    // Get full profile
    const { data: profile } = await supabase
      .from("profiles").select("id, full_name, username").eq("id", u.id).single();
    setUser(profile);

    // Get all ratings with rater and rated profiles
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select(`
        id, session_id, rater_id, rated_id,
        knowledge, communication, punctuality, overall, review,
        created_at, role_rated,
        rater:rater_id ( id, full_name, username ),
        rated:rated_id ( id, full_name, username )
      `)
      .order("created_at", { ascending: false });

    if (ratingsData) setRatings(ratingsData as unknown as Rating[]);

    // Get completed sessions where user is teacher or learner
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

    // Which sessions has the user already rated?
    const { data: myRatings } = await supabase
      .from("ratings").select("session_id").eq("rater_id", u.id);
    if (myRatings) setAlreadyRated(myRatings.map(r => r.session_id));

    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // When session is selected, auto-detect who the user is rating
  const handleSelectSession = (session: CompletedSession) => {
    setSelectedSession(session);
    // If user is the learner → they rate the teacher, and vice versa
    const role: "teacher" | "learner" = session.learner_id === user?.id ? "teacher" : "learner";
    setRoleRated(role);
    setForm({ knowledge: 0, communication: 0, punctuality: 0, overall: 0, review: "" });
  };

  const handleSubmit = async () => {
    if (!user || !selectedSession || form.overall === 0) return;
    setSubmitting(true);

    // Determine who is being rated
    const ratedId = roleRated === "teacher"
      ? selectedSession.teacher_id
      : selectedSession.learner_id;

    const { error } = await supabase.from("ratings").insert({
      session_id:    selectedSession.id,
      rater_id:      user.id,
      rated_id:      ratedId,
      role_rated:    roleRated,
      knowledge:     form.knowledge || form.overall,
      communication: form.communication || form.overall,
      punctuality:   form.punctuality || form.overall,
      overall:       form.overall,
      review:        form.review,
    });

    if (!error) {
      setSubmitted(true);
      setAlreadyRated(prev => [...prev, selectedSession.id]);
      await loadData(); // refresh ratings list
      setTimeout(() => {
        setShowModal(false);
        setSubmitted(false);
        setSelectedSession(null);
        setForm({ knowledge: 0, communication: 0, punctuality: 0, overall: 0, review: "" });
      }, 2000);
    }
    setSubmitting(false);
  };

  const filtered = ratings.filter(r =>
    tab === "all" ? true : r.role_rated === tab
  );

  const avgRating = ratings.length > 0
    ? (ratings.reduce((s, r) => s + r.overall, 0) / ratings.length).toFixed(1)
    : "—";

  // Sessions that haven't been rated yet by this user
  const unratedSessions = sessions.filter(s => !alreadyRated.includes(s.id));

  const initials = (name: string) =>
    name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        .font-sans { font-family: 'DM Sans', sans-serif; }
      `}</style>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">⭐</div>
                <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-2">Review submitted!</h2>
                <p className="text-stone-400 text-sm">Thank you for your feedback.</p>
              </div>
            ) : (
              <>
                <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-1">Rate a Session ⭐</h2>
                <p className="text-stone-400 text-sm mb-6">Your honest review helps the community!</p>

                {/* Session selector */}
                <div className="mb-6">
                  <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-2">
                    Select Session to Rate
                  </p>
                  {unratedSessions.length === 0 ? (
                    <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 text-center">
                      <p className="text-sm text-stone-400 font-medium">
                        {sessions.length === 0
                          ? "No completed sessions yet — complete a session first!"
                          : "You've already rated all your completed sessions! 🎉"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                      {unratedSessions.map(session => {
                        const isSelected = selectedSession?.id === session.id;
                        const isLearner = session.learner_id === user?.id;
                        const otherPerson = isLearner ? session.teacher : session.learner;
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleSelectSession(session)}
                            className={`text-left p-3 rounded-xl border transition-all ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-300"
                                : "bg-stone-50 border-stone-200 hover:border-emerald-200"
                            }`}
                          >
                            <p className={`text-sm font-bold ${isSelected ? "text-emerald-700" : "text-stone-700"}`}>
                              {session.listing?.title || "Session"}
                            </p>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {isLearner ? "🎓 Rating teacher:" : "📚 Rating learner:"} {otherPerson?.full_name}
                              {" · "}{new Date(session.proposed_time).toLocaleDateString()}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rating criteria — only show when session selected */}
                {selectedSession && (
                  <>
                    {/* Who are we rating */}
                    <div className={`rounded-xl border p-3 mb-5 ${
                      roleRated === "teacher" ? "bg-emerald-50 border-emerald-200" : "bg-sky-50 border-sky-200"
                    }`}>
                      <p className={`text-xs font-bold ${roleRated === "teacher" ? "text-emerald-700" : "text-sky-700"}`}>
                        {roleRated === "teacher" ? "🎓 You are rating the teacher:" : "📚 You are rating the learner:"}
                      </p>
                      <p className={`text-sm font-black mt-0.5 ${roleRated === "teacher" ? "text-emerald-900" : "text-sky-900"}`}>
                        {roleRated === "teacher"
                          ? selectedSession.teacher?.full_name
                          : selectedSession.learner?.full_name}
                      </p>
                    </div>

                    <div className="flex flex-col gap-5 mb-6">
                      {roleRated === "teacher" ? (
                        <>
                          {[
                            { key: "knowledge",     label: "Knowledge & Expertise" },
                            { key: "communication", label: "Communication" },
                            { key: "punctuality",   label: "Punctuality" },
                            { key: "overall",       label: "Overall Rating ✦" },
                          ].map(c => (
                            <div key={c.key}>
                              <p className="text-sm font-bold text-stone-700 mb-2">{c.label}</p>
                              <InteractiveStars
                                value={form[c.key as keyof typeof form] as number}
                                onChange={v => setForm(p => ({ ...p, [c.key]: v }))}
                              />
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { key: "communication", label: "Communication & Responsiveness" },
                            { key: "punctuality",   label: "Preparedness & Punctuality" },
                            { key: "overall",       label: "Overall Rating ✦" },
                          ].map(c => (
                            <div key={c.key}>
                              <p className="text-sm font-bold text-stone-700 mb-2">{c.label}</p>
                              <InteractiveStars
                                value={form[c.key as keyof typeof form] as number}
                                onChange={v => setForm(p => ({ ...p, [c.key]: v }))}
                              />
                            </div>
                          ))}
                        </>
                      )}

                      {/* Written review */}
                      <div>
                        <p className="text-sm font-bold text-stone-700 mb-2">
                          Written Review <span className="text-stone-300 font-normal">(optional)</span>
                        </p>
                        <textarea
                          value={form.review}
                          onChange={e => setForm(p => ({ ...p, review: e.target.value.slice(0, 300) }))}
                          placeholder="Share your experience..."
                          rows={3}
                          className="w-full p-3 rounded-xl border border-stone-200 text-sm bg-stone-50 resize-none focus:outline-none focus:border-emerald-400 transition-colors font-sans"
                        />
                        <p className="text-[11px] text-stone-300 text-right mt-1">{form.review.length}/300</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowModal(false); setSelectedSession(null); }}
                    className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedSession || form.overall === 0}
                    className={`flex-[2] py-3 rounded-xl text-sm font-black text-white transition-colors ${
                      !selectedSession || form.overall === 0
                        ? "bg-stone-200 cursor-not-allowed text-stone-400"
                        : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                    }`}
                  >
                    {submitting ? "Submitting..." : "Submit Review ⭐"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-40 px-8 h-14 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-1">
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l, h]) => (
            <a key={l} href={h} className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-black px-4 py-2 rounded-xl transition-colors"
        >
          ⭐ Write a Review
        </button>
      </nav>

      {/* ── BODY ── */}
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="font-fraunces text-3xl font-black text-stone-900 mb-1">Ratings & Reviews ⭐</h1>
            <p className="text-stone-400 text-sm">What the community says about teachers and learners</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Avg Rating", value: `${avgRating}★`, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100" },
              { label: "Total Reviews", value: ratings.length, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl px-5 py-3 text-center`}>
                <p className={`font-fraunces text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-stone-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Unrated sessions banner */}
        {unratedSessions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💬</span>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  You have {unratedSessions.length} unrated session{unratedSessions.length > 1 ? "s" : ""}!
                </p>
                <p className="text-xs text-amber-600">Share your experience and earn karma in the community.</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              Rate Now →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 w-fit mb-6">
          {[
            { key: "all",     label: "All Reviews" },
            { key: "teacher", label: "🎓 Teachers" },
            { key: "learner", label: "📚 Learners" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t.key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-700 hover:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ratings list */}
        {loading ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-stone-400 text-sm">Loading reviews...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-stone-200">
            <div className="text-5xl mb-3">⭐</div>
            <p className="text-stone-400 text-sm mb-4">No reviews yet in this category</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
            >
              Write the first review!
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map(rating => (
              <div key={rating.id} className="bg-white rounded-2xl border border-stone-200 p-6 hover:shadow-sm transition-shadow">
                {/* Header row */}
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center flex-shrink-0">
                      {initials(rating.rater?.full_name || "")}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-800">{rating.rater?.full_name}</p>
                      <p className="text-xs text-stone-400">
                        @{rating.rater?.username} rated{" "}
                        <span className="font-bold text-stone-600">@{rating.rated?.username}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      rating.role_rated === "teacher"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-sky-50 text-sky-700 border border-sky-100"
                    }`}>
                      {rating.role_rated === "teacher" ? "🎓 Teacher Review" : "📚 Learner Review"}
                    </span>
                    <span className="text-xs text-stone-300">
                      {new Date(rating.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Stars breakdown */}
                <div className="flex flex-wrap gap-5 mb-4">
                  {rating.role_rated === "teacher" ? (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Knowledge</p>
                        <Stars value={rating.knowledge} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Communication</p>
                        <Stars value={rating.communication} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Punctuality</p>
                        <Stars value={rating.punctuality} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Communication</p>
                        <Stars value={rating.communication} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Preparedness</p>
                        <Stars value={rating.punctuality} />
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Overall</p>
                    <div className="flex items-center gap-2">
                      <Stars value={rating.overall} />
                      <span className="font-fraunces text-base font-black text-amber-500">{rating.overall}.0</span>
                    </div>
                  </div>
                </div>

                {/* Review text */}
                {rating.review && (
                  <div className="bg-stone-50 rounded-xl border-l-4 border-amber-300 px-4 py-3">
                    <p className="text-sm text-stone-600 italic leading-relaxed">
                      &ldquo;{rating.review}&rdquo;
                    </p>
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