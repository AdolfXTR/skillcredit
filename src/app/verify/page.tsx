"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
  level: string;
};

type Skill = {
  id: string;
  name: string;
  category: string;
};

type Question = {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

type QuizBank = Record<string, Question[]>;

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#1d4ed8", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#0891b2", Legend: "#d97706",
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Programming: { bg: "#dbeafe", color: "#1d4ed8" },
  Design:      { bg: "#fce7f3", color: "#be185d" },
  Language:    { bg: "#dcfce7", color: "#166534" },
  Academic:    { bg: "#fef3c7", color: "#b45309" },
  Music:       { bg: "#ede9fe", color: "#7c3aed" },
  Arts:        { bg: "#fee2e2", color: "#991b1b" },
  Media:       { bg: "#e0f2fe", color: "#0369a1" },
};

// Quiz bank — 10 questions per skill category
const QUIZ_BANK: QuizBank = {
  "Python": [
    { id: 1, question: "What is the output of `print(type([]))`?", options: ["<class 'list'>", "<class 'array'>", "<class 'tuple'>", "<class 'dict'>"], correct: 0, explanation: "[] creates an empty list, so type([]) returns <class 'list'>." },
    { id: 2, question: "Which keyword is used to define a function in Python?", options: ["function", "def", "func", "define"], correct: 1, explanation: "Python uses 'def' to define functions, e.g. def my_function():" },
    { id: 3, question: "What does `len('hello')` return?", options: ["4", "5", "6", "hello"], correct: 1, explanation: "len() counts characters. 'hello' has 5 characters." },
    { id: 4, question: "How do you create a comment in Python?", options: ["// comment", "/* comment */", "# comment", "-- comment"], correct: 2, explanation: "Python uses # for single-line comments." },
    { id: 5, question: "What is the correct way to create a dictionary?", options: ["d = []", "d = ()", "d = {}", "d = <>"], correct: 2, explanation: "Dictionaries use curly braces {} with key:value pairs." },
    { id: 6, question: "Which of these is a valid Python list?", options: ["[1, 2, 3]", "{1, 2, 3}", "(1, 2, 3)", "<1, 2, 3>"], correct: 0, explanation: "Lists use square brackets []." },
    { id: 7, question: "What does `range(5)` produce?", options: ["1 to 5", "0 to 5", "0 to 4", "1 to 4"], correct: 2, explanation: "range(5) produces numbers from 0 up to (but not including) 5: 0,1,2,3,4." },
    { id: 8, question: "How do you check if a key exists in a dictionary?", options: ["key in dict", "dict.has(key)", "dict.contains(key)", "key.exists(dict)"], correct: 0, explanation: "The 'in' operator checks if a key exists in a dictionary." },
    { id: 9, question: "What is a lambda function?", options: ["A class method", "An anonymous function", "A loop function", "A recursive function"], correct: 1, explanation: "Lambda creates anonymous (unnamed) functions: lambda x: x + 1" },
    { id: 10, question: "Which method adds an item to the end of a list?", options: ["list.add()", "list.insert()", "list.append()", "list.push()"], correct: 2, explanation: "append() adds an element to the end of a list." },
  ],
  "React": [
    { id: 1, question: "What is JSX?", options: ["A database query language", "A JavaScript syntax extension for HTML-like code", "A CSS framework", "A testing library"], correct: 1, explanation: "JSX is a syntax extension that allows you to write HTML-like code inside JavaScript." },
    { id: 2, question: "What hook manages state in a functional component?", options: ["useEffect", "useContext", "useState", "useRef"], correct: 2, explanation: "useState is the primary hook for managing local state in functional components." },
    { id: 3, question: "What does the 'key' prop do in a list?", options: ["Styles the element", "Helps React identify which items changed", "Encrypts data", "Adds event listeners"], correct: 1, explanation: "Keys help React identify which items in a list have changed, added, or removed." },
    { id: 4, question: "What is a React component?", options: ["A CSS class", "A reusable piece of UI", "A database table", "A server endpoint"], correct: 1, explanation: "Components are reusable pieces of UI that can be composed together." },
    { id: 5, question: "When does useEffect run by default?", options: ["Only on mount", "Only on unmount", "After every render", "Never"], correct: 2, explanation: "Without a dependency array, useEffect runs after every render." },
    { id: 6, question: "How do you pass data to a child component?", options: ["Through state", "Through props", "Through context only", "Through refs only"], correct: 1, explanation: "Props (properties) are used to pass data from parent to child components." },
    { id: 7, question: "What is the virtual DOM?", options: ["A real browser DOM", "A lightweight copy of the real DOM", "A CSS rendering engine", "A server-side template"], correct: 1, explanation: "React uses a virtual DOM to efficiently update only the parts of the real DOM that changed." },
    { id: 8, question: "What does React.Fragment do?", options: ["Creates a portal", "Groups elements without adding extra DOM nodes", "Memoizes a component", "Creates a context"], correct: 1, explanation: "Fragment lets you group children without adding extra nodes to the DOM." },
    { id: 9, question: "What is prop drilling?", options: ["A CSS technique", "Passing props through many nested components", "A performance optimization", "A testing method"], correct: 1, explanation: "Prop drilling is passing data through multiple layers of components that don't need it." },
    { id: 10, question: "Which lifecycle does componentDidMount correspond to in hooks?", options: ["useEffect with no deps", "useEffect with empty deps []", "useState", "useCallback"], correct: 1, explanation: "useEffect with an empty dependency array [] runs once after the component mounts." },
  ],
  "default": [
    { id: 1, question: "What is the primary goal of effective teaching?", options: ["Covering all material fast", "Ensuring student understanding", "Using complex terminology", "Finishing on time"], correct: 1, explanation: "Effective teaching prioritizes student understanding over content coverage speed." },
    { id: 2, question: "What is active learning?", options: ["Studying alone", "Students passively receiving info", "Students actively engaging with material", "Reading textbooks only"], correct: 2, explanation: "Active learning involves students engaging with material through discussion, practice, and application." },
    { id: 3, question: "What does formative assessment do?", options: ["Grades students at end of course", "Monitors learning during the process", "Ranks students against each other", "Replaces all exams"], correct: 1, explanation: "Formative assessment monitors student learning to provide ongoing feedback." },
    { id: 4, question: "Which is a key principle of adult learning (andragogy)?", options: ["Adults need spoon-feeding", "Adults are self-directed learners", "Adults learn only through lectures", "Adults avoid challenges"], correct: 1, explanation: "Adults are self-directed and bring experience to learning situations." },
    { id: 5, question: "What is a learning objective?", options: ["A teaching method", "A measurable statement of what students will achieve", "A curriculum overview", "A grading rubric"], correct: 1, explanation: "Learning objectives describe specific, measurable outcomes students should achieve." },
    { id: 6, question: "What does scaffolding mean in education?", options: ["Building a physical structure", "Providing temporary support to help learners progress", "Testing students frequently", "Assigning group projects"], correct: 1, explanation: "Scaffolding provides temporary structured support that is gradually removed as the learner grows." },
    { id: 7, question: "Which is an example of intrinsic motivation?", options: ["Studying for a reward", "Learning because you find it interesting", "Studying to avoid punishment", "Competing for grades"], correct: 1, explanation: "Intrinsic motivation comes from within — doing something because it's personally rewarding." },
    { id: 8, question: "What is the best way to give constructive feedback?", options: ["Focus only on mistakes", "Be vague to avoid hurt feelings", "Be specific and actionable", "Delay feedback as long as possible"], correct: 2, explanation: "Good feedback is specific, actionable, and timely." },
    { id: 9, question: "What is spaced repetition?", options: ["Reviewing material once", "Cramming before exams", "Reviewing material at increasing intervals", "Reading the same page repeatedly"], correct: 2, explanation: "Spaced repetition spreads learning over time to improve long-term retention." },
    { id: 10, question: "Which promotes deeper learning?", options: ["Memorizing facts", "Understanding and applying concepts", "Copying notes", "Passive listening"], correct: 1, explanation: "Deeper learning comes from understanding and being able to apply knowledge, not just memorize." },
  ],
};

function getQuestions(skillName: string): Question[] {
  return QUIZ_BANK[skillName] || QUIZ_BANK["default"];
}

function getInitials(name: string) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function VerificationPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz state
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(prof);

    const { data: skillList } = await supabase.from("skills").select("*").order("category");
    setSkills(skillList || []);

    // Get already verified skills
    const { data: userSkills } = await supabase
      .from("user_skills")
      .select("skill_id")
      .eq("user_id", user.id)
      .eq("is_verified", true);
    setVerifiedSkills((userSkills || []).map(s => s.skill_id));
    setLoading(false);
  }

  function startQuiz(skill: Skill) {
    const qs = getQuestions(skill.name);
    // Shuffle and pick 5 questions
    const shuffled = [...qs].sort(() => Math.random() - 0.5).slice(0, 5);
    setSelectedSkill(skill);
    setQuestions(shuffled);
    setCurrentQ(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuizDone(false);
    setScore(0);
    setQuizStarted(true);
  }

  function handleAnswer(answerIdx: number) {
    if (selectedAnswer !== null) return; // already answered
    setSelectedAnswer(answerIdx);
    setShowExplanation(true);
  }

  function handleNext() {
    const newAnswers = [...answers, selectedAnswer!];
    setAnswers(newAnswers);

    if (currentQ + 1 >= questions.length) {
      // Quiz done
      const finalScore = newAnswers.filter((a, i) => a === questions[i].correct).length;
      const pct = (finalScore / questions.length) * 100;
      setScore(finalScore);
      setPassed(pct >= 80);
      setQuizDone(true);
      if (pct >= 80) saveVerification();
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  }

  async function saveVerification() {
    if (!profile || !selectedSkill) return;
    setSaving(true);

    // Upsert user_skill as verified
    await supabase.from("user_skills").upsert({
      user_id: profile.id,
      skill_id: selectedSkill.id,
      type: "teach",
      is_verified: true,
    }, { onConflict: "user_id,skill_id" });

    // Award XP
    await supabase.rpc("increment_xp", { user_id: profile.id, amount: 25 });

    // Notification
    await supabase.from("notifications").insert({
      user_id: profile.id,
      type: "achievement",
      title: `✅ ${selectedSkill.name} Verified!`,
      body: `You passed the ${selectedSkill.name} verification quiz and earned +25 XP!`,
      link: "/verify",
    });

    setVerifiedSkills(prev => [...prev, selectedSkill.id]);
    setSaving(false);
  }

  const skillsByCategory = skills.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {} as Record<string, Skill[]>);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf8f4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎓</div>
          <div style={{ color: "#666", fontSize: 15 }}>Loading verification center…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .skill-card { transition: box-shadow 0.18s, transform 0.18s; cursor: pointer; }
        .skill-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }
        .option-btn { transition: all 0.15s; cursor: pointer; border: none; text-align: left; }
        .option-btn:hover:not(:disabled) { transform: translateX(4px); }
      `}</style>

      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 24px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([label, href]) => (
            <a key={label} href={href} style={{ padding: "6px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>{label}</a>
          ))}
        </div>
        <a href="/profile" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: LEVEL_COLORS[profile?.level || "Seedling"], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
            {getInitials(profile?.full_name || "")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>@{profile?.username}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", background: "#e8f4e8", padding: "2px 8px", borderRadius: 20 }}>{profile?.credits} cr</span>
        </a>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px" }}>

        {/* Quiz in progress */}
        {quizStarted && !quizDone && selectedSkill && (
          <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <button onClick={() => setQuizStarted(false)} style={{ background: "none", border: "none", color: "#2d6a4f", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Back</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#888", marginBottom: 2 }}>Skill Verification — {selectedSkill.name}</div>
                <div style={{ background: "#f0ece4", borderRadius: 999, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${((currentQ) / questions.length) * 100}%`, height: "100%", background: "#2d6a4f", borderRadius: 999, transition: "width 0.3s" }} />
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>{currentQ + 1} / {questions.length}</span>
            </div>

            {/* Question card */}
            <div style={{ background: "#fff", borderRadius: 20, border: "1.5px solid #e8e2d9", padding: "32px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Question {currentQ + 1}
              </div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 28px", lineHeight: 1.4 }}>
                {questions[currentQ].question}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {questions[currentQ].options.map((option, idx) => {
                  let bg = "#f5f0e8";
                  let border = "1.5px solid #e8e2d9";
                  let color = "#333";

                  if (selectedAnswer !== null) {
                    if (idx === questions[currentQ].correct) {
                      bg = "#dcfce7"; border = "1.5px solid #86efac"; color = "#166534";
                    } else if (idx === selectedAnswer && selectedAnswer !== questions[currentQ].correct) {
                      bg = "#fee2e2"; border = "1.5px solid #fca5a5"; color = "#991b1b";
                    }
                  } else if (selectedAnswer === idx) {
                    bg = "#e8f4e8"; border = "1.5px solid #2d6a4f";
                  }

                  return (
                    <button
                      key={idx}
                      className="option-btn"
                      onClick={() => handleAnswer(idx)}
                      disabled={selectedAnswer !== null}
                      style={{ padding: "14px 18px", borderRadius: 12, background: bg, border, color, fontSize: 14, fontWeight: 600, width: "100%", display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: selectedAnswer !== null ? "transparent" : "#fff", border: selectedAnswer !== null ? "none" : "1.5px solid #e8e2d9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0, color: "#888" }}>
                        {selectedAnswer !== null
                          ? idx === questions[currentQ].correct ? "✓" : idx === selectedAnswer ? "✗" : String.fromCharCode(65 + idx)
                          : String.fromCharCode(65 + idx)}
                      </span>
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {showExplanation && (
                <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 12, background: selectedAnswer === questions[currentQ].correct ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${selectedAnswer === questions[currentQ].correct ? "#86efac" : "#fca5a5"}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selectedAnswer === questions[currentQ].correct ? "#166534" : "#991b1b", marginBottom: 4 }}>
                    {selectedAnswer === questions[currentQ].correct ? "✅ Correct!" : "❌ Incorrect"}
                  </div>
                  <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{questions[currentQ].explanation}</div>
                </div>
              )}
            </div>

            {/* Next button */}
            {selectedAnswer !== null && (
              <button
                onClick={handleNext}
                style={{ width: "100%", padding: "14px", borderRadius: 14, background: "#2d6a4f", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
              >
                {currentQ + 1 >= questions.length ? "See Results →" : "Next Question →"}
              </button>
            )}
          </div>
        )}

        {/* Quiz results */}
        {quizDone && selectedSkill && (
          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#fff", borderRadius: 24, border: "1.5px solid #e8e2d9", padding: "48px 40px", marginBottom: 20 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? "🎉" : "😔"}</div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>
                {passed ? "You're Verified!" : "Not Quite Yet"}
              </h1>
              <p style={{ fontSize: 16, color: "#666", marginBottom: 24 }}>
                {passed
                  ? `You scored ${score}/${questions.length} on the ${selectedSkill.name} quiz. ✅ Verified badge added!`
                  : `You scored ${score}/${questions.length}. You need 80% (${Math.ceil(questions.length * 0.8)}/${questions.length}) to pass.`}
              </p>

              {/* Score visual */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
                {questions.map((q, i) => {
                  const correct = answers[i] === q.correct;
                  return (
                    <div key={i} style={{ width: 48, height: 48, borderRadius: 12, background: correct ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                      {correct ? "✓" : "✗"}
                    </div>
                  );
                })}
              </div>

              {passed && (
                <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>🏆 {selectedSkill.name} — Verified Teacher</div>
                  <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>+25 XP awarded · Badge added to your profile</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                {!passed && (
                  <button onClick={() => startQuiz(selectedSkill)} style={{ padding: "12px 28px", borderRadius: 12, background: "#2d6a4f", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    Try Again →
                  </button>
                )}
                <button onClick={() => { setQuizStarted(false); setQuizDone(false); }} style={{ padding: "12px 28px", borderRadius: 12, background: "#f5f0e8", color: "#555", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  {passed ? "Back to Skills" : "Choose Another Skill"}
                </button>
                {passed && (
                  <a href="/listings/create" style={{ padding: "12px 28px", borderRadius: 12, background: "#2d6a4f", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                    Create a Listing →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Skill picker */}
        {!quizStarted && (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", margin: 0 }}>
                Skill Verification
              </h1>
              <p style={{ color: "#666", marginTop: 8, fontSize: 15, lineHeight: 1.6 }}>
                Take a short quiz to earn a <strong>✅ Verified</strong> badge on your skill listings. Score 80% or higher to pass. Verified teachers earn more trust and bookings!
              </p>
            </div>

            {/* How it works */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { icon: "📝", title: "5 Questions", desc: "Short multiple-choice quiz, auto-graded" },
                { icon: "🎯", title: "80% to Pass", desc: "Answer 4 out of 5 correctly to verify" },
                { icon: "✅", title: "Verified Badge", desc: "Badge shown on your listings & profile" },
              ].map(item => (
                <div key={item.title} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e8e2d9", padding: "18px 20px" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "#1a1a1a", marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              ))}
            </div>

            {/* Skill categories */}
            {Object.entries(skillsByCategory).map(([category, catSkills]) => {
              const cfg = CATEGORY_COLORS[category] || { bg: "#f0ece4", color: "#555" };
              return (
                <div key={category} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    {category}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {catSkills.map(skill => {
                      const isVerified = verifiedSkills.includes(skill.id);
                      return (
                        <div
                          key={skill.id}
                          className="skill-card"
                          onClick={() => !isVerified && startQuiz(skill)}
                          style={{
                            background: "#fff",
                            borderRadius: 14,
                            border: isVerified ? "1.5px solid #86efac" : "1.5px solid #e8e2d9",
                            padding: "18px 20px",
                            opacity: isVerified ? 0.9 : 1,
                            cursor: isVerified ? "default" : "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                                {category}
                              </span>
                              <div style={{ fontWeight: 800, fontSize: 15, color: "#1a1a1a", marginBottom: 4 }}>{skill.name}</div>
                              {isVerified ? (
                                <div style={{ fontSize: 12, color: "#166534", fontWeight: 700 }}>✅ Verified</div>
                              ) : (
                                <div style={{ fontSize: 12, color: "#aaa" }}>Click to take quiz →</div>
                              )}
                            </div>
                            <div style={{ fontSize: 28 }}>
                              {isVerified ? "✅" : category === "Programming" ? "💻" : category === "Design" ? "🎨" : category === "Language" ? "🌍" : category === "Academic" ? "📚" : category === "Music" ? "🎵" : "🎭"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}