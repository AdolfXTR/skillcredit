"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Skill = { id: string; name: string; category: string };
type Question = {
  id: string; question: string;
  type: "multiple_choice" | "short_answer" | "scenario";
  options?: string[]; correct?: string;
  difficulty: "easy" | "medium" | "hard";
  feedback_correct: string; feedback_wrong: string;
};

const CAT_ICON: Record<string, string> = {
  Programming:"💻",Design:"🎨",Language:"🌍",Academic:"📚",Music:"🎵",Arts:"🎭",Media:"🎬",Science:"🔬",
};

const QUESTION_BANK: Record<string, Question[]> = {
  "Python":[
    {id:"py1",question:"What is the difference between a list and a tuple in Python?",type:"multiple_choice",options:["Lists are ordered, tuples are not","Lists are mutable, tuples are immutable","Tuples can hold more data types","Lists are faster than tuples"],correct:"Lists are mutable, tuples are immutable",difficulty:"easy",feedback_correct:"Correct! Lists can be modified after creation while tuples cannot.",feedback_wrong:"The key difference is mutability — lists can be changed, tuples cannot."},
    {id:"py2",question:"What does `*args` do in a Python function definition?",type:"multiple_choice",options:["Multiplies all arguments","Allows any number of positional arguments","Creates a pointer","Declares optional arguments"],correct:"Allows any number of positional arguments",difficulty:"medium",feedback_correct:"*args collects extra positional arguments into a tuple.",feedback_wrong:"The *args syntax packs extra positional arguments into a tuple."},
    {id:"py3",question:"Explain what a Python decorator is and give a real-world use case.",type:"short_answer",difficulty:"hard",feedback_correct:"Decorators wrap functions to extend behavior — common uses: logging, auth, caching.",feedback_wrong:"A decorator is a function that takes another function and extends its behavior."},
    {id:"py4",question:"What is the output of: `print(type([]) == type(()))`?",type:"multiple_choice",options:["True","False","Error","None"],correct:"False",difficulty:"easy",feedback_correct:"[] is a list and () is a tuple — different types, so False.",feedback_wrong:"[] is a list and () is a tuple — different types, so False."},
    {id:"py5",question:"What is a Python generator and how does it differ from a regular function?",type:"short_answer",difficulty:"hard",feedback_correct:"Generators use yield, producing values lazily — very memory-efficient.",feedback_wrong:"A generator uses the yield keyword to return values one at a time."},
    {id:"py6",question:"Which is most memory-efficient for filtering 1 million numbers?",type:"multiple_choice",options:["[x for x in nums if x%2==0]","(x for x in nums if x%2==0)","list(filter(lambda x: x%2==0, nums))","nums.filter(...)"],correct:"(x for x in nums if x%2==0)",difficulty:"hard",feedback_correct:"Generator expressions are lazy — they don't store all values in memory.",feedback_wrong:"Generator expressions (parentheses) are lazy and memory-efficient."},
    {id:"py7",question:"What does `__init__` do in a Python class?",type:"multiple_choice",options:["Destroys the object","Initializes instance attributes when an object is created","Imports modules","Defines class-level variables only"],correct:"Initializes instance attributes when an object is created",difficulty:"easy",feedback_correct:"__init__ is Python's constructor, called automatically when creating a new instance.",feedback_wrong:"__init__ runs automatically when you create an instance."},
    {id:"py8",question:"Fast key-value lookups: list or dictionary, and why?",type:"scenario",difficulty:"medium",feedback_correct:"Dictionary — O(1) average lookup vs O(n) for lists.",feedback_wrong:"Dictionary — provides O(1) average time complexity for lookups."},
    {id:"py9",question:"What is the GIL and why does it matter for multithreading?",type:"short_answer",difficulty:"hard",feedback_correct:"GIL prevents true parallel threads — use multiprocessing for CPU-bound tasks.",feedback_wrong:"The GIL is a mutex preventing multiple threads from executing Python bytecode simultaneously."},
    {id:"py10",question:"What does `my_list[2:5]` return?",type:"multiple_choice",options:["Elements at index 2 and 5","Elements from index 2 up to but not including 5","Elements from index 2 to 5 inclusive","The last 5 elements"],correct:"Elements from index 2 up to but not including 5",difficulty:"easy",feedback_correct:"Python slicing stop is exclusive. [2:5] returns indices 2, 3, 4.",feedback_wrong:"Python slicing [2:5] returns indices 2, 3, 4 — stop is exclusive."},
    {id:"py11",question:"Difference between `is` and `==` in Python?",type:"multiple_choice",options:["`is` compares values, `==` compares identity","`is` compares identity, `==` compares values","They are identical","`is` only works on numbers"],correct:"`is` compares identity, `==` compares values",difficulty:"medium",feedback_correct:"`is` checks if two variables point to the same object in memory.",feedback_wrong:"`is` = same object in memory. `==` = same value."},
    {id:"py12",question:"What is a lambda function and when would you use one?",type:"short_answer",difficulty:"medium",feedback_correct:"A lambda is an anonymous one-liner function, useful for short callbacks like sort keys.",feedback_wrong:"Lambda creates anonymous functions: lambda x: x*2. Use for short, throwaway functions."},
  ],
  "React":[
    {id:"re1",question:"What is the difference between `useState` and `useRef`?",type:"multiple_choice",options:["useState is for strings only","useState triggers re-renders, useRef does not","useRef is deprecated in React 18","They are identical"],correct:"useState triggers re-renders, useRef does not",difficulty:"medium",feedback_correct:"Updating useState causes re-render; useRef persists without triggering re-renders.",feedback_wrong:"useState triggers component re-renders when updated; useRef does not."},
    {id:"re2",question:"What problem does `useCallback` solve?",type:"short_answer",difficulty:"hard",feedback_correct:"useCallback memoizes functions to prevent unnecessary re-creation on every render.",feedback_wrong:"useCallback memoizes a function so it's not recreated on every render."},
    {id:"re3",question:"What is the React virtual DOM?",type:"multiple_choice",options:["A simplified HTML structure","A JS representation of the real DOM for efficient updates","A browser-specific API","A way to avoid HTML"],correct:"A JS representation of the real DOM for efficient updates",difficulty:"easy",feedback_correct:"React uses the virtual DOM to calculate minimal real DOM updates.",feedback_wrong:"The virtual DOM is a lightweight JS copy of the real DOM for efficient diffing."},
    {id:"re4",question:"Your component re-renders too often. Name 3 optimization strategies.",type:"scenario",difficulty:"hard",feedback_correct:"React.memo, useMemo, useCallback, lazy loading, and avoiding inline objects are valid.",feedback_wrong:"React.memo, useMemo, useCallback, and code splitting with lazy() are key strategies."},
    {id:"re5",question:"What is prop drilling and how does Context API solve it?",type:"short_answer",difficulty:"medium",feedback_correct:"Context API creates a provider accessible by any descendant without manual prop passing.",feedback_wrong:"Prop drilling = passing props through many layers. Context makes values globally accessible."},
    {id:"re6",question:"What does the dependency array in `useEffect` control?",type:"multiple_choice",options:["Order of effects","When the effect runs based on value changes","Which components use the effect","The effect return type"],correct:"When the effect runs based on value changes",difficulty:"medium",feedback_correct:"[] = once, [value] = when value changes, no array = every render.",feedback_wrong:"The dependency array controls when useEffect re-runs."},
    {id:"re7",question:"What happens if you call setState inside useEffect with no dependency array?",type:"multiple_choice",options:["Nothing","It runs once on mount","It causes an infinite loop","It throws an error"],correct:"It causes an infinite loop",difficulty:"hard",feedback_correct:"setState → re-render → useEffect runs → setState again → infinite loop!",feedback_wrong:"No dependency array = runs after every render. setState triggers re-render → infinite loop."},
    {id:"re8",question:"What is React.memo and when should you use it?",type:"short_answer",difficulty:"medium",feedback_correct:"React.memo wraps a component to prevent re-renders if props haven't changed.",feedback_wrong:"React.memo is a HOC that memoizes a component — skips re-render if props are the same."},
  ],
  "Math Tutoring":[
    {id:"mt1",question:"What is the derivative of f(x) = x³ + 2x² - 5x + 3?",type:"multiple_choice",options:["3x² + 4x - 5","x² + 4x - 5","3x² + 2x - 5","3x³ + 4x"],correct:"3x² + 4x - 5",difficulty:"medium",feedback_correct:"Power rule: x³→3x², 2x²→4x, -5x→-5, 3→0.",feedback_wrong:"Apply power rule: x³→3x², 2x²→4x, -5x→-5, constant→0."},
    {id:"mt2",question:"A student struggles with lim(x→2) of (x²-4)/(x-2). How do you explain it?",type:"scenario",difficulty:"hard",feedback_correct:"Factor: (x+2)(x-2)/(x-2) = x+2. As x→2, answer = 4.",feedback_wrong:"Factor numerator: (x+2)(x-2). Cancel (x-2). As x→2, limit = 4."},
    {id:"mt3",question:"What is the quadratic formula?",type:"short_answer",difficulty:"easy",feedback_correct:"x = (-b ± √(b²-4ac)) / 2a — solves ax²+bx+c=0.",feedback_wrong:"x = (-b ± √(b²-4ac)) / 2a"},
    {id:"mt4",question:"A triangle has sides 3, 4, and 5. What type is it?",type:"multiple_choice",options:["Acute","Right triangle","Obtuse","Equilateral"],correct:"Right triangle",difficulty:"easy",feedback_correct:"3²+4²=25=5². Satisfies Pythagorean theorem!",feedback_wrong:"3²+4²=9+16=25=5². This is a right triangle."},
    {id:"mt5",question:"What is the probability of rolling a sum of 7 with two dice?",type:"multiple_choice",options:["1/6","6/36","7/36","1/7"],correct:"6/36",difficulty:"medium",feedback_correct:"6 ways: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1). P = 6/36 = 1/6.",feedback_wrong:"6 combinations out of 36 total outcomes = 6/36."},
    {id:"mt6",question:"What is log₂(64)?",type:"multiple_choice",options:["4","5","6","8"],correct:"6",difficulty:"easy",feedback_correct:"2⁶ = 64, so log₂(64) = 6.",feedback_wrong:"2⁶=64, so log₂(64)=6."},
    {id:"mt7",question:"Explain what a standard deviation measures.",type:"short_answer",difficulty:"medium",feedback_correct:"Standard deviation measures how spread out data points are from the mean.",feedback_wrong:"Standard deviation = average distance of data points from the mean."},
    {id:"mt8",question:"A student says 0.999... ≠ 1. How do you explain they are equal?",type:"scenario",difficulty:"hard",feedback_correct:"Let x=0.999..., then 10x=9.999..., subtract: 9x=9, so x=1.",feedback_wrong:"Multiply both sides: 10x-x=9.999...-0.999...=9. So 9x=9, x=1."},
  ],
  "UI/UX Design":[
    {id:"ux1",question:"What is the difference between UX and UI design?",type:"multiple_choice",options:["They are the same thing","UX = experience/flow, UI = visual elements","UI is for mobile, UX for web","UX is done after UI"],correct:"UX = experience/flow, UI = visual elements",difficulty:"easy",feedback_correct:"UX = research, flow, experience. UI = colors, typography, components.",feedback_wrong:"UX focuses on overall experience. UI focuses on the visual layer."},
    {id:"ux2",question:"User can't find the checkout button. What UX process do you follow?",type:"scenario",difficulty:"hard",feedback_correct:"User interviews, heatmaps, A/B testing, and improving visual hierarchy.",feedback_wrong:"User interviews → heatmap analysis → A/B testing → visual hierarchy improvements."},
    {id:"ux3",question:"What is a wireframe?",type:"multiple_choice",options:["High-fidelity mockup","Low-fidelity layout sketch without visual design","Finished design for development","Animation prototype"],correct:"Low-fidelity layout sketch without visual design",difficulty:"easy",feedback_correct:"Wireframes are low-fidelity blueprints used early to validate concepts cheaply.",feedback_wrong:"Wireframes are simple sketches showing layout/structure without colors."},
    {id:"ux4",question:"Minimum touch target size per accessibility guidelines?",type:"multiple_choice",options:["24x24px","44x44px","16x16px","100x100px"],correct:"44x44px",difficulty:"medium",feedback_correct:"44x44px per Apple HIG and WCAG ensures accessible tapping.",feedback_wrong:"44x44px is the recommended minimum per Apple HIG and Material Design."},
    {id:"ux5",question:"WCAG 2.1 AA contrast ratio for normal text?",type:"multiple_choice",options:["2:1","3:1","4.5:1","7:1"],correct:"4.5:1",difficulty:"hard",feedback_correct:"4.5:1 for normal text, 3:1 for large text per WCAG 2.1 AA.",feedback_wrong:"WCAG 2.1 AA requires 4.5:1 for normal text."},
    {id:"ux6",question:"Explain the Gestalt principle of proximity.",type:"short_answer",difficulty:"medium",feedback_correct:"Nearby elements are perceived as related — group labels with their inputs.",feedback_wrong:"Proximity: nearby elements appear related. Apply to group form labels with inputs."},
  ],
  "English Writing":[
    {id:"ew1",question:"What is the difference between active and passive voice?",type:"multiple_choice",options:["Passive is always preferred","Active voice is usually preferred for clarity","They are interchangeable","Passive is only for academic writing"],correct:"Active voice is usually preferred for clarity",difficulty:"easy",feedback_correct:"Active (Dog bites man) is clearer than passive (Man is bitten by dog).",feedback_wrong:"Active voice puts the subject performing the action — generally clearer."},
    {id:"ew2",question:"Fix: 'There is a lot of people who wants to learn English.'",type:"scenario",difficulty:"medium",feedback_correct:"'There are' (people is plural) and 'want' (agrees with people).",feedback_wrong:"'There is' → 'There are'. 'wants' → 'want' (subject-verb agreement)."},
    {id:"ew3",question:"What is a thesis statement and where does it belong?",type:"short_answer",difficulty:"easy",feedback_correct:"A thesis states the main argument in 1-2 sentences, usually at the end of the introduction.",feedback_wrong:"A thesis concisely states your main argument, at the end of the introduction."},
    {id:"ew4",question:"What is the difference between 'affect' and 'effect'?",type:"multiple_choice",options:["Same meaning","Affect is usually a verb, effect is usually a noun","Effect is a verb, affect is a noun","Both are nouns"],correct:"Affect is usually a verb, effect is usually a noun",difficulty:"medium",feedback_correct:"Affect = verb (to influence). Effect = noun (result).",feedback_wrong:"Affect = verb. Effect = noun. RAVEN: Remember Affect Verb Effect Noun."},
    {id:"ew5",question:"Which sentence is grammatically correct?",type:"multiple_choice",options:["Me and John went to the store.","John and me went to the store.","John and I went to the store.","John and myself went to the store."],correct:"John and I went to the store.",difficulty:"easy",feedback_correct:"Use 'I' as a subject. Remove 'John and' — 'I went' sounds right, 'me went' does not.",feedback_wrong:"'John and I' — use I as subject."},
  ],
  "Guitar":[
    {id:"gu1",question:"What is the emotional difference between major and minor chords?",type:"multiple_choice",options:["Major sounds sad, minor sounds happy","Major sounds happy/bright, minor sounds sad/dark","They sound identical","Minor is louder"],correct:"Major sounds happy/bright, minor sounds sad/dark",difficulty:"easy",feedback_correct:"Major (major third) = bright/happy. Minor (minor third) = darker/sadder.",feedback_wrong:"Major = bright/happy. Minor = darker/sadder — due to interval differences."},
    {id:"gu2",question:"What is a barre chord and why do beginners find it difficult?",type:"short_answer",difficulty:"medium",feedback_correct:"Barre uses one finger across all strings. Hard due to required finger strength and even pressure.",feedback_wrong:"A barre chord presses all strings with one finger — requires strength and consistent pressure."},
    {id:"gu3",question:"Student struggles switching G to C smoothly. What do you recommend?",type:"scenario",difficulty:"hard",feedback_correct:"Slow tempo, find pivot fingers, one-minute changes drill, visualize next chord.",feedback_wrong:"Slow down, find anchor fingers, practice one-minute changes drill."},
    {id:"gu4",question:"What does EADGBE represent?",type:"multiple_choice",options:["A technique","Standard tuning from low to high","A chord progression","A scale type"],correct:"Standard tuning from low to high",difficulty:"easy",feedback_correct:"EADGBE is standard guitar tuning from thickest (E) to thinnest (e).",feedback_wrong:"EADGBE = standard tuning: 6th string (low E) to 1st string (high e)."},
    {id:"gu5",question:"What is a pentatonic scale and why is it popular for soloing?",type:"short_answer",difficulty:"medium",feedback_correct:"5-note scale that avoids dissonant intervals — almost any note sounds good over common chords.",feedback_wrong:"5 notes that avoid clashing intervals, very forgiving over most chord progressions."},
  ],
};

const DEFAULT_QUESTIONS: Question[] = [
  {id:"df1",question:"How long have you been practicing this skill and how did you learn it?",type:"short_answer",difficulty:"easy",feedback_correct:"Practical experience is valid evidence of skill.",feedback_wrong:"Share your learning journey to establish experience level."},
  {id:"df2",question:"Describe a project where you applied this skill professionally or seriously.",type:"scenario",difficulty:"medium",feedback_correct:"Real-world application demonstrates practical competence.",feedback_wrong:"Real-world application is the strongest evidence of competence."},
  {id:"df3",question:"What are the most common beginner mistakes, and how would you help someone avoid them?",type:"short_answer",difficulty:"medium",feedback_correct:"Understanding common mistakes shows mastery and teaching ability.",feedback_wrong:"Knowing where students struggle shows meta-awareness of the skill."},
  {id:"df4",question:"How do you stay up to date with new developments in this area?",type:"short_answer",difficulty:"easy",feedback_correct:"Continuous learning is essential for any skill teacher.",feedback_wrong:"Keeping current through communities, courses, and practice is key."},
  {id:"df5",question:"If a student was frustrated and stuck, what approach would you take?",type:"scenario",difficulty:"hard",feedback_correct:"Breaking concepts down, using analogies — hallmarks of great teachers.",feedback_wrong:"Adapt explanations, use analogies, break concepts smaller, stay supportive."},
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getQuestions(skillName: string): Question[] {
  const bank = QUESTION_BANK[skillName] || DEFAULT_QUESTIONS;
  return shuffle(bank).slice(0, 5).map(q => ({ ...q, options: q.options ? shuffle(q.options) : undefined }));
}

function evaluateAnswer(q: Question, answer: string) {
  if (q.type === "multiple_choice" && q.correct) {
    const correct = answer === q.correct;
    return { score: correct ? 10 : 0, correct, feedback: correct ? q.feedback_correct : q.feedback_wrong };
  }
  const len = answer.trim().length;
  const score = len > 200 ? Math.floor(Math.random() * 2) + 8
    : len > 100 ? Math.floor(Math.random() * 2) + 6
    : len > 50  ? Math.floor(Math.random() * 2) + 4
    : Math.floor(Math.random() * 2) + 1;
  return { score, correct: score >= 6, feedback: score >= 6 ? q.feedback_correct : q.feedback_wrong };
}

const QUESTION_TIME = 60;
const MAX_STRIKES   = 3;

type Stage = "select" | "generating" | "quiz" | "results" | "cooldown";
type AnswerRecord = { question: Question; userAnswer: string; evaluation: ReturnType<typeof evaluateAnswer>; timeUsed: number };

// ── Design tokens matching SkillCredit light theme ────────────────────────────
const T = {
  bg:       "#f0ede8",      // warm cream — matches the app background
  surface:  "#ffffff",      // card white
  border:   "#e2ddd7",      // warm gray border
  borderMd: "#d0c9c0",      // slightly darker border
  text:     "#1a1a1a",      // near-black text
  muted:    "#6b6560",      // muted brown-gray
  faint:    "#9e9690",      // faint label color
  green:    "#2d6a4f",      // SkillCredit dark green
  greenBg:  "#e8f5ee",      // light green fill
  greenBdr: "#b7dfc8",      // green border
  greenBtn: "#2d6a4f",      // green button
  red:      "#c0392b",
  redBg:    "#fdf0ee",
  redBdr:   "#f0b8b0",
  amber:    "#92600a",
  amberBg:  "#fdf6e3",
  amberBdr: "#f0d890",
  shadow:   "0 1px 3px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  shadowMd: "0 2px 12px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
};

const diffStyle = (d: string) => ({
  color: d==="hard" ? T.red : d==="medium" ? T.amber : T.green,
  background: d==="hard" ? T.redBg : d==="medium" ? T.amberBg : T.greenBg,
  border: `1px solid ${d==="hard" ? T.redBdr : d==="medium" ? T.amberBdr : T.greenBdr}`,
});

export default function VerifyPage() {
  const [skills, setSkills]               = useState<Skill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [cooldowns, setCooldowns]         = useState<Record<string, number>>({});
  const [profile, setProfile]             = useState<{ id: string; credits: number } | null>(null);
  const [stage, setStage]                 = useState<Stage>("select");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [questions, setQuestions]         = useState<Question[]>([]);
  const [currentQ, setCurrentQ]           = useState(0);
  const [answers, setAnswers]             = useState<AnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults]             = useState<{ passed: boolean; totalScore: number; disqualified?: boolean } | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");

  // Anti-cheat
  const [strikes, setStrikes]               = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const strikesRef    = useRef(0);
  const quizActiveRef = useRef(false);

  // Timer
  const [timeLeft, setTimeLeft]   = useState(QUESTION_TIME);
  const [timerWarn, setTimerWarn] = useState(false);
  const timerRef                  = useRef<NodeJS.Timeout | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: prof } = await supabase.from("profiles").select("id, credits").eq("id", user.id).single();
      setProfile(prof);
      const { data: sk } = await supabase.from("skills").select("*").order("category");
      if (sk) setSkills(sk);
      const { data: uSk } = await supabase.from("user_skills").select("skill_id").eq("user_id", user.id).eq("is_verified", true);
      if (uSk) setVerifiedSkills(uSk.map((s: any) => s.skill_id));
      const saved = localStorage.getItem("verify_cooldowns");
      if (saved) setCooldowns(JSON.parse(saved));
    })();
  }, []);

  // Tab-switch cheat detection
  const handleCheat = useCallback(() => {
    if (!quizActiveRef.current) return;
    const n = strikesRef.current + 1;
    strikesRef.current = n;
    setStrikes(n);
    setTabSwitchCount(c => c + 1);
    if (n >= MAX_STRIKES) {
      quizActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      setShowStrikeWarning(false);
      setSelectedSkill(skill => {
        if (skill) {
          const cd = Date.now() + 24 * 60 * 60 * 1000;
          setCooldowns(prev => { const u = {...prev, [skill.id]: cd}; localStorage.setItem("verify_cooldowns", JSON.stringify(u)); return u; });
        }
        return skill;
      });
      setResults({ passed: false, totalScore: 0, disqualified: true });
      setStage("results");
    } else {
      setShowStrikeWarning(true);
    }
  }, []);

  useEffect(() => {
    const onVis  = () => { if (document.hidden) handleCheat(); };
    const onBlur = () => handleCheat();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("blur", onBlur); };
  }, [handleCheat]);

  useEffect(() => {
    quizActiveRef.current = stage === "quiz";
    if (stage !== "quiz") { strikesRef.current = 0; setStrikes(0); setShowStrikeWarning(false); setTabSwitchCount(0); }
  }, [stage]);

  const startTimer = useCallback(() => {
    setTimeLeft(QUESTION_TIME); setTimerWarn(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleTimeUp(); return 0; }
        if (prev <= 15) setTimerWarn(true);
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (stage === "quiz") startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage, currentQ]);

  const handleTimeUp = () => {
    const q = questions[currentQ]; if (!q) return;
    const ev = { score: 0, correct: false, feedback: "⏱ Time ran out! " + q.feedback_wrong };
    advance([...answers, { question: q, userAnswer: "(Time expired)", evaluation: ev, timeUsed: QUESTION_TIME }]);
  };

  const advance = (na: AnswerRecord[]) => {
    setAnswers(na); setCurrentAnswer(""); setSelectedOption("");
    if (currentQ + 1 < questions.length) setCurrentQ(currentQ + 1); else finishQuiz(na);
  };

  const finishQuiz = (fa: AnswerRecord[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    quizActiveRef.current = false;
    const total = Math.round(fa.reduce((s, a) => s + a.evaluation.score, 0) / fa.length * 10);
    const passed = total >= 70;
    setResults({ passed, totalScore: total });
    if (passed && profile && selectedSkill) {
      supabase.from("user_skills").upsert({ user_id: profile.id, skill_id: selectedSkill.id, type: "teach", is_verified: true, verified_at: new Date().toISOString() }, { onConflict: "user_id,skill_id" });
      setVerifiedSkills(v => [...v, selectedSkill.id]);
      try { supabase.rpc("increment_xp", { user_id: profile.id, amount: 25 }); } catch {}
    } else if (!passed && selectedSkill) {
      const cd = Date.now() + 24 * 60 * 60 * 1000;
      const nc = {...cooldowns, [selectedSkill.id]: cd};
      setCooldowns(nc); localStorage.setItem("verify_cooldowns", JSON.stringify(nc));
    }
    setStage("results");
  };

  const submitAnswer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[currentQ];
    const answer = q.type === "multiple_choice" ? selectedOption : currentAnswer;
    if (!answer.trim()) return;
    advance([...answers, { question: q, userAnswer: answer, evaluation: evaluateAnswer(q, answer), timeUsed: QUESTION_TIME - timeLeft }]);
  };

  const startQuiz = (skill: Skill) => {
    const cd = cooldowns[skill.id];
    if (cd && Date.now() < cd) { setSelectedSkill(skill); setCooldownLeft(Math.ceil((cd - Date.now()) / 1000)); setStage("cooldown"); return; }
    setSelectedSkill(skill); setStage("generating");
    setAnswers([]); setCurrentQ(0); setCurrentAnswer(""); setSelectedOption("");
    strikesRef.current = 0; setStrikes(0); setTabSwitchCount(0);
    setTimeout(() => { setQuestions(getQuestions(skill.name)); setStage("quiz"); }, 1400);
  };

  const reset = () => {
    quizActiveRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("select"); setSelectedSkill(null); setQuestions([]);
    setAnswers([]); setCurrentQ(0); setCurrentAnswer(""); setSelectedOption("");
    setResults(null); setTimeLeft(QUESTION_TIME);
    setStrikes(0); strikesRef.current = 0; setShowStrikeWarning(false); setTabSwitchCount(0);
  };

  useEffect(() => {
    if (stage !== "cooldown") return;
    const iv = setInterval(() => setCooldownLeft(p => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; }), 1000);
    return () => clearInterval(iv);
  }, [stage]);

  const grouped = skills.reduce((acc, s) => { if (!acc[s.category]) acc[s.category] = []; acc[s.category].push(s); return acc; }, {} as Record<string, Skill[]>);
  const filtered = Object.entries(grouped).reduce((acc, [cat, cs]) => {
    const f = cs.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (f.length) acc[cat] = f; return acc;
  }, {} as Record<string, Skill[]>);

  const q        = questions[currentQ];
  const timerPct = (timeLeft / QUESTION_TIME) * 100;
  const timerCol = timeLeft <= 10 ? T.red : timeLeft <= 20 ? T.amber : T.green;
  const fmtCD    = (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60; return h ? `${h}h ${m}m` : m ? `${m}m ${ss}s` : `${ss}s`; };

  // ── Base layout wrappers
  const pageWrap: React.CSSProperties  = { minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize:14 };
  const cardBase: React.CSSProperties  = { background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, boxShadow:T.shadow };
  const btnGreen: React.CSSProperties  = { background:T.greenBtn, color:"#fff", border:"none", borderRadius:8, fontWeight:600, cursor:"pointer", fontSize:14, padding:"10px 20px", transition:"opacity .15s" };
  const btnGhost: React.CSSProperties  = { background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:8, fontWeight:500, cursor:"pointer", fontSize:13, padding:"8px 16px" };

  return (
    <div style={pageWrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        a { text-decoration:none; color:inherit; }
        textarea, input, button { font-family:inherit; }
        ::placeholder { color:#b0a89e; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#d5cfc8; border-radius:99px; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { 0%{opacity:0;transform:scale(.93) translateY(10px)} 70%{transform:scale(1.01)} 100%{opacity:1;transform:none} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes wobble { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0);opacity:.4} 40%{transform:scale(1);opacity:1} }

        .sc-fadeup  { animation:fadeUp .35s ease both; }
        .sc-fadein  { animation:fadeIn .2s ease both; }
        .sc-popin   { animation:popIn .4s cubic-bezier(.22,.68,0,1.15) both; }
        .sc-wobble  { animation:wobble .5s ease infinite; }

        .sc-skill   { transition:transform .15s, box-shadow .15s; cursor:pointer; }
        .sc-skill:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.1); }
        .sc-opt     { transition:border-color .12s, background .12s, transform .1s; cursor:pointer; }
        .sc-opt:hover { border-color:#b7dfc8 !important; background:#f5fbf7 !important; }
        .sc-opt-sel { border-color:#2d6a4f !important; background:#e8f5ee !important; }
        .sc-btn:hover { opacity:.88; }
        .sc-navlink  { transition:color .1s; }
        .sc-navlink:hover { color:#2d6a4f !important; }

        .sc-dot { width:7px; height:7px; border-radius:50%; background:#2d6a4f; display:inline-block; }
        .sc-dot:nth-child(1) { animation:dotBounce 1.2s ease infinite 0s; }
        .sc-dot:nth-child(2) { animation:dotBounce 1.2s ease infinite .2s; }
        .sc-dot:nth-child(3) { animation:dotBounce 1.2s ease infinite .4s; }
      `}</style>

      {/* ── STRIKE WARNING OVERLAY ── */}
      {showStrikeWarning && (
        <div className="sc-fadein" style={{ position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)" }}>
          <div className="sc-popin" style={{ ...cardBase,maxWidth:400,width:"calc(100% - 40px)",padding:"32px 28px",textAlign:"center",borderColor:T.redBdr,boxShadow:T.shadowMd }}>
            {/* Strike bars */}
            <div style={{ display:"flex",gap:6,justifyContent:"center",marginBottom:20 }}>
              {Array.from({length:MAX_STRIKES}).map((_,i)=>(
                <div key={i} style={{ flex:1,height:5,borderRadius:99,background:i<strikes?"#c0392b":"#e8e2da",transition:"background .3s" }} />
              ))}
            </div>
            <div style={{ fontSize:40,marginBottom:12 }}>🚨</div>
            <h2 style={{ fontSize:20,fontWeight:700,color:T.text,marginBottom:6 }}>Tab Switch Detected</h2>
            <p style={{ fontSize:13,color:T.muted,marginBottom:6 }}>You left the exam window.</p>
            <p style={{ fontSize:13,marginBottom:18,color:T.text }}>
              Strike <strong style={{ color:T.red }}>{strikes}</strong> of <strong>{MAX_STRIKES}</strong>
              {" — "}
              {MAX_STRIKES - strikes === 1
                ? <span style={{ color:T.red,fontWeight:600 }}>one more = disqualified!</span>
                : <span style={{ color:T.amber,fontWeight:600 }}>{MAX_STRIKES - strikes} remaining</span>}
            </p>
            <div style={{ background:T.redBg,border:`1px solid ${T.redBdr}`,borderRadius:8,padding:"10px 14px",marginBottom:20,textAlign:"left" }}>
              <p style={{ fontSize:11,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Warning</p>
              <p style={{ fontSize:12,color:T.muted,lineHeight:1.6 }}>Switching tabs, alt-tabbing, or focusing another window is flagged. The timer kept running while you were away.</p>
            </div>
            <button className="sc-btn" onClick={()=>setShowStrikeWarning(false)}
              style={{ ...btnGreen,width:"100%",padding:"12px",fontSize:14,borderRadius:8 }}>
              Resume Exam →
            </button>
          </div>
        </div>
      )}

      {/* ── NAVBAR — matching SkillCredit style ── */}
      <nav style={{ position:"sticky",top:0,zIndex:50,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",background:T.surface,borderBottom:`1px solid ${T.border}`,boxShadow:"0 1px 0 rgba(0,0,0,.04)" }}>
        <a href="/dashboard" style={{ fontWeight:700,fontSize:17,letterSpacing:"-0.3px" }}>
          <span style={{ color:T.green }}>Skill</span><span style={{ color:T.text }}>Credit</span>
        </a>
        <div style={{ display:"flex",alignItems:"center",gap:4 }}>
          {[["Dashboard","/dashboard"],["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h])=>(
            <a key={l} href={h} className="sc-navlink" style={{ padding:"6px 11px",borderRadius:6,fontSize:13,fontWeight:500,color:T.muted }}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          {profile && (
            <span style={{ fontSize:12,fontWeight:600,color:T.green,background:T.greenBg,border:`1px solid ${T.greenBdr}`,padding:"4px 12px",borderRadius:99 }}>
              💰 {profile.credits} cr
            </span>
          )}
          <a href="/profile" style={{ width:34,height:34,borderRadius:"50%",background:"#e07b39",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff" }}>
            {profile ? "BF" : "?"}
          </a>
        </div>
      </nav>

      {/* ── PAGE ── */}
      <div style={{ maxWidth:860,margin:"0 auto",padding:"36px 24px 80px" }}>

        {/* ════ SELECT ════ */}
        {stage === "select" && (
          <div className="sc-fadeup">
            {/* Page header */}
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:28,fontWeight:800,color:T.text,letterSpacing:"-0.5px",marginBottom:6 }}>Get Verified</h1>
              <p style={{ fontSize:14,color:T.muted }}>Prove your skills to unlock a verified badge on your listings.</p>
            </div>

            {/* Info banner */}
            <div style={{ ...cardBase,padding:"16px 20px",marginBottom:24,display:"flex",flexWrap:"wrap",gap:20,alignItems:"center",borderLeft:`4px solid ${T.green}` }}>
              <div style={{ flex:1,minWidth:200 }}>
                <p style={{ fontWeight:600,color:T.text,marginBottom:3 }}>How verification works</p>
                <p style={{ fontSize:12,color:T.muted,lineHeight:1.6 }}>Answer 5 randomized questions in 60 seconds each. Score 70%+ to earn your badge. Failed attempts have a 24-hour cooldown before retrying.</p>
              </div>
              <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                {[
                  {icon:"⏱",l:"60s / question"},
                  {icon:"🔀",l:"Randomized"},
                  {icon:"👁️",l:"Tab monitored"},
                  {icon:"⏳",l:"24h on fail"},
                ].map(f=>(
                  <div key={f.l} style={{ textAlign:"center",minWidth:64 }}>
                    <div style={{ fontSize:18,marginBottom:3 }}>{f.icon}</div>
                    <div style={{ fontSize:10,fontWeight:600,color:T.muted,whiteSpace:"nowrap" }}>{f.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Search */}
            <div style={{ position:"relative",marginBottom:20 }}>
              <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.faint,pointerEvents:"none" }}>🔍</span>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search skills…"
                style={{ width:"100%",paddingLeft:38,paddingRight:14,paddingTop:10,paddingBottom:10,borderRadius:8,background:T.surface,border:`1px solid ${T.border}`,color:T.text,fontSize:13,outline:"none" }}
                onFocus={e=>(e.target.style.borderColor=T.green)} onBlur={e=>(e.target.style.borderColor=T.border)} />
            </div>

            {/* Skill grid by category */}
            {Object.entries(filtered).map(([cat, catSkills]) => (
              <div key={cat} style={{ marginBottom:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span style={{ fontSize:14 }}>{CAT_ICON[cat]||"📖"}</span>
                  <span style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1.5 }}>{cat}</span>
                  <div style={{ flex:1,height:1,background:T.border }} />
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8 }}>
                  {catSkills.map(skill => {
                    const isV   = verifiedSkills.includes(skill.id);
                    const cdEnd = cooldowns[skill.id];
                    const hasCd = !!(cdEnd && Date.now() < cdEnd);
                    const remH  = hasCd ? Math.ceil((cdEnd - Date.now()) / 3600000) : 0;
                    return (
                      <div key={skill.id}
                        className={!isV && !hasCd ? "sc-skill" : ""}
                        onClick={()=>!isV&&!hasCd&&startQuiz(skill)}
                        style={{ ...cardBase,padding:"14px",cursor:isV||hasCd?"default":"pointer",
                          borderColor:isV?T.greenBdr:hasCd?T.redBdr:T.border,
                          background:isV?T.greenBg:hasCd?T.redBg:T.surface }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                          <span style={{ fontSize:18 }}>{CAT_ICON[cat]||"📖"}</span>
                          {isV  && <span style={{ fontSize:11,fontWeight:600,color:T.green,background:T.greenBg,border:`1px solid ${T.greenBdr}`,padding:"2px 8px",borderRadius:99 }}>Verified ✓</span>}
                          {hasCd && <span style={{ fontSize:11,fontWeight:600,color:T.red,background:T.redBg,border:`1px solid ${T.redBdr}`,padding:"2px 8px",borderRadius:99 }}>⏳ {remH}h</span>}
                        </div>
                        <p style={{ fontSize:13,fontWeight:600,color:T.text,lineHeight:1.3,marginBottom:4 }}>{skill.name}</p>
                        {!isV && !hasCd && <p style={{ fontSize:11,color:T.green,fontWeight:500 }}>Take quiz →</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════ COOLDOWN ════ */}
        {stage === "cooldown" && (
          <div className="sc-fadeup" style={{ maxWidth:480,margin:"60px auto 0",textAlign:"center" }}>
            <div style={{ fontSize:48,marginBottom:16,animation:"pulse 2s infinite" }}>⏳</div>
            <h2 style={{ fontSize:24,fontWeight:700,color:T.text,marginBottom:8 }}>Cooldown Active</h2>
            <p style={{ color:T.muted,marginBottom:20,fontSize:14 }}>You recently failed <strong style={{ color:T.text }}>{selectedSkill?.name}</strong> verification.</p>
            <div style={{ ...cardBase,padding:"20px 28px",display:"inline-flex",alignItems:"center",gap:14,marginBottom:24,borderColor:T.redBdr,background:T.redBg }}>
              <span style={{ fontSize:24 }}>⏱</span>
              <div>
                <p style={{ fontSize:10,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Time Remaining</p>
                <p style={{ fontSize:28,fontWeight:800,color:T.text }}>{fmtCD(cooldownLeft)}</p>
              </div>
            </div>
            <br />
            <button className="sc-btn" onClick={reset} style={btnGhost}>← Choose Another Skill</button>
          </div>
        )}

        {/* ════ GENERATING ════ */}
        {stage === "generating" && (
          <div className="sc-fadeup" style={{ maxWidth:480,margin:"60px auto 0",textAlign:"center" }}>
            <div style={{ fontSize:40,marginBottom:14,animation:"pulse .8s infinite" }}>🎲</div>
            <h2 style={{ fontSize:22,fontWeight:700,color:T.text,marginBottom:6 }}>Preparing your quiz…</h2>
            <p style={{ fontSize:13,color:T.muted,marginBottom:24 }}>Selecting 5 random questions for <strong style={{ color:T.text }}>{selectedSkill?.name}</strong></p>
            <div style={{ display:"flex",gap:6,justifyContent:"center",marginBottom:20 }}>
              <span className="sc-dot" /><span className="sc-dot" /><span className="sc-dot" />
            </div>
            <div style={{ ...cardBase,padding:"12px 16px",display:"inline-block",borderColor:T.redBdr,background:T.redBg }}>
              <p style={{ fontSize:12,color:T.red,fontWeight:600 }}>👁️ Tab switching is monitored. {MAX_STRIKES} strikes = disqualified.</p>
            </div>
          </div>
        )}

        {/* ════ QUIZ ════ */}
        {stage === "quiz" && q && (
          <div className="sc-fadeup" style={{ maxWidth:620,margin:"0 auto" }}>
            {/* Quiz nav */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <button className="sc-btn" onClick={reset} style={btnGhost}>← Exit</button>
              <span style={{ fontSize:13,fontWeight:600,color:T.text }}>{selectedSkill?.name}</span>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                {/* Strike pips */}
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  {Array.from({length:MAX_STRIKES}).map((_,i)=>(
                    <div key={i} title={`Strike ${i+1}`}
                      style={{ width:8,height:8,borderRadius:"50%",background:i<strikes?"#c0392b":"#e2ddd7",border:`1px solid ${i<strikes?"#c0392b":"#d0c9c0"}`,transition:"background .2s" }} />
                  ))}
                  {strikes > 0 && <span style={{ fontSize:10,fontWeight:600,color:T.red,marginLeft:3 }}>{strikes}/{MAX_STRIKES}</span>}
                </div>
                <span style={{ fontSize:12,color:T.faint,fontWeight:500 }}>Q{currentQ+1} of {questions.length}</span>
              </div>
            </div>

            {/* Progress */}
            <div style={{ display:"flex",gap:4,marginBottom:16 }}>
              {questions.map((_,i)=>(
                <div key={i} style={{ flex:1,height:4,borderRadius:99,background:i<currentQ?T.green:i===currentQ?"#b7dfc8":"#e2ddd7",transition:"background .3s" }} />
              ))}
            </div>

            {/* Timer */}
            <div style={{ ...cardBase,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
              <div className={timerWarn?"sc-wobble":""} style={{ width:46,height:46,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,flexShrink:0,
                background:timeLeft<=10?T.redBg:timeLeft<=20?T.amberBg:T.greenBg,
                color:timerCol,
                border:`1.5px solid ${timeLeft<=10?T.redBdr:timeLeft<=20?T.amberBdr:T.greenBdr}` }}>
                {timeLeft}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,fontWeight:600,color:T.faint,textTransform:"uppercase",letterSpacing:1,marginBottom:5 }}>
                  <span>Time Remaining</span>
                  <span style={{ color:timerCol }}>{timeLeft<=10?"⚠️ Hurry!":timeLeft<=20?"Running low…":"You've got this"}</span>
                </div>
                <div style={{ height:5,borderRadius:99,background:"#e2ddd7",overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:99,background:timerCol,width:`${timerPct}%`,transition:"width 1s linear" }} />
                </div>
              </div>
            </div>

            {/* Question card */}
            <div style={{ ...cardBase,padding:"24px",marginBottom:12 }}>
              <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:99,textTransform:"uppercase",letterSpacing:.8,...diffStyle(q.difficulty) }}>{q.difficulty}</span>
                <span style={{ fontSize:10,fontWeight:500,color:T.faint,textTransform:"uppercase",letterSpacing:.8 }}>
                  {q.type==="multiple_choice"?"Multiple Choice":q.type==="scenario"?"Scenario":"Short Answer"}
                </span>
              </div>
              <p style={{ fontSize:16,fontWeight:600,color:T.text,lineHeight:1.55,marginBottom:20 }}>{q.question}</p>

              {/* Options */}
              {q.type==="multiple_choice" && q.options && (
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {q.options.map((opt,i)=>{
                    const sel = selectedOption===opt;
                    return (
                      <button key={i} className={`sc-opt${sel?" sc-opt-sel":""}`}
                        onClick={()=>setSelectedOption(opt)}
                        style={{ display:"flex",alignItems:"center",gap:11,padding:"11px 14px",borderRadius:8,
                          border:`1.5px solid ${sel?T.green:T.border}`,
                          background:sel?T.greenBg:T.surface,
                          cursor:"pointer",textAlign:"left",width:"100%" }}>
                        <span style={{ width:26,height:26,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,
                          background:sel?T.green:"#f0ede8",color:sel?"#fff":T.faint }}>
                          {["A","B","C","D"][i]}
                        </span>
                        <span style={{ fontSize:13,fontWeight:500,color:sel?T.green:T.text }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text answer */}
              {q.type !== "multiple_choice" && (
                <div>
                  <label style={{ display:"block",fontSize:11,fontWeight:600,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:7 }}>
                    {q.type==="scenario"?"Describe your approach:":"Your answer:"}
                  </label>
                  <textarea value={currentAnswer} onChange={e=>setCurrentAnswer(e.target.value)} rows={5}
                    placeholder="Be detailed — more depth = higher score…"
                    style={{ width:"100%",padding:"12px 14px",borderRadius:8,border:`1.5px solid ${T.border}`,background:T.surface,color:T.text,fontSize:13,lineHeight:1.65,resize:"none",outline:"none" }}
                    onFocus={e=>(e.target.style.borderColor=T.green)} onBlur={e=>(e.target.style.borderColor=T.border)} />
                  <p style={{ fontSize:11,marginTop:6,color:currentAnswer.length>150?T.green:currentAnswer.length>50?T.amber:T.faint }}>
                    {currentAnswer.length} chars {currentAnswer.length<50?"— add more detail":currentAnswer.length<150?"— getting there…":"— great detail ✓"}
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            {(()=>{
              const dis = q.type==="multiple_choice"?!selectedOption:currentAnswer.trim().length<10;
              return (
                <button className="sc-btn" onClick={submitAnswer} disabled={dis}
                  style={{ ...btnGreen,width:"100%",padding:"12px",fontSize:14,borderRadius:8,opacity:dis?.45:1,cursor:dis?"not-allowed":"pointer" }}>
                  {currentQ+1===questions.length?"Submit & See Results →":"Next Question →"}
                </button>
              );
            })()}
          </div>
        )}

        {/* ════ RESULTS ════ */}
        {stage==="results" && results && (
          <div className="sc-fadeup" style={{ maxWidth:620,margin:"0 auto" }}>
            {/* Result banner */}
            <div style={{ ...cardBase,padding:"32px 28px",textAlign:"center",marginBottom:16,
              borderColor:results.disqualified?T.redBdr:results.passed?T.greenBdr:T.border,
              background:results.disqualified?T.redBg:results.passed?T.greenBg:T.surface,
              borderLeft:`5px solid ${results.disqualified?T.red:results.passed?T.green:T.borderMd}` }}>
              <div style={{ fontSize:48,marginBottom:12 }}>{results.disqualified?"🚫":results.passed?"🎉":"😔"}</div>
              <h2 style={{ fontSize:24,fontWeight:700,color:T.text,marginBottom:8 }}>
                {results.disqualified?"Disqualified":results.passed?`Verified in ${selectedSkill?.name}!`:"Not quite this time"}
              </h2>
              <p style={{ fontSize:13,color:T.muted,maxWidth:380,margin:"0 auto 20px",lineHeight:1.7 }}>
                {results.disqualified
                  ?`You switched tabs ${tabSwitchCount} time${tabSwitchCount!==1?"s":""}. ${MAX_STRIKES} strikes triggered automatic disqualification. A 24-hour cooldown has been applied.`
                  :results.passed
                  ?"Your verified badge has been added to your profile and listings! You earned +25 XP."
                  :`Your score was ${results.totalScore}%. You need 70% to pass. You can try again in 24 hours.`}
              </p>

              {/* Stats */}
              <div style={{ display:"inline-flex",gap:0,background:"#f0ede8",borderRadius:10,overflow:"hidden",border:`1px solid ${T.border}` }}>
                {(results.disqualified?[
                  {v:String(tabSwitchCount),l:"Tab Switches",c:T.red},
                  {v:`${MAX_STRIKES}/${MAX_STRIKES}`,l:"Strikes",c:T.red},
                  {v:"24h",l:"Cooldown",c:T.text},
                ]:[
                  {v:`${results.totalScore}%`,l:"Score",c:T.text},
                  {v:`${answers.filter(a=>a.evaluation.correct).length}/${answers.length}`,l:"Correct",c:T.text},
                  {v:results.passed?"+25 XP":"0 XP",l:"Earned",c:results.passed?T.green:T.muted},
                ]).map((x,i,arr)=>(
                  <div key={i} style={{ padding:"14px 24px",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none",textAlign:"center" }}>
                    <p style={{ fontSize:26,fontWeight:800,color:x.c,lineHeight:1 }}>{x.v}</p>
                    <p style={{ fontSize:9,fontWeight:600,color:T.faint,textTransform:"uppercase",letterSpacing:1,marginTop:3 }}>{x.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            {!results.disqualified && answers.length > 0 && (
              <>
                <p style={{ fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10 }}>Question Breakdown</p>
                <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:14 }}>
                  {answers.map((a,i)=>(
                    <div key={i} style={{ ...cardBase,padding:"16px 18px",borderLeft:`4px solid ${a.evaluation.correct?T.green:T.red}` }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                        <div style={{ flex:1,marginRight:12 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:6 }}>
                            <span style={{ fontSize:9,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:1 }}>Q{i+1}</span>
                            <span style={{ fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99,textTransform:"uppercase",letterSpacing:.5,...diffStyle(a.question.difficulty) }}>{a.question.difficulty}</span>
                            <span style={{ fontSize:10,color:T.faint }}>⏱ {a.timeUsed}s used</span>
                          </div>
                          <p style={{ fontSize:13,fontWeight:600,color:T.text,lineHeight:1.5 }}>{a.question.question}</p>
                        </div>
                        <div style={{ textAlign:"right",flexShrink:0 }}>
                          <p style={{ fontSize:20,fontWeight:800,color:a.evaluation.correct?T.green:T.red,lineHeight:1 }}>{a.evaluation.score}/10</p>
                          <span style={{ fontSize:15 }}>{a.evaluation.correct?"✅":"❌"}</span>
                        </div>
                      </div>
                      <div style={{ background:"#f7f4f0",borderRadius:7,padding:"8px 12px",marginBottom:8 }}>
                        <p style={{ fontSize:9,fontWeight:700,color:T.faint,textTransform:"uppercase",letterSpacing:1,marginBottom:3 }}>Your Answer</p>
                        <p style={{ fontSize:12,color:T.muted,lineHeight:1.6 }}>{a.userAnswer}</p>
                      </div>
                      <p style={{ fontSize:11,color:T.muted,lineHeight:1.6 }}>💡 {a.evaluation.feedback}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* CTAs */}
            <div style={{ display:"flex",gap:8 }}>
              {results.passed ? (
                <>
                  <a href="/listings/create" style={{ ...btnGreen,flex:1,padding:"12px",textAlign:"center",borderRadius:8,display:"block",fontSize:14 }}>
                    Create a Listing →
                  </a>
                  <button className="sc-btn" onClick={reset} style={{ ...btnGhost,flex:1,padding:"12px",borderRadius:8 }}>
                    Verify Another Skill
                  </button>
                </>
              ) : (
                <>
                  <button className="sc-btn" onClick={reset} style={{ ...btnGhost,flex:1,padding:"12px",borderRadius:8 }}>
                    ← Choose Another
                  </button>
                  <div style={{ flex:1,padding:"12px",borderRadius:8,background:T.redBg,border:`1px solid ${T.redBdr}`,color:T.red,fontWeight:600,fontSize:13,textAlign:"center" }}>
                    ⏳ 24h cooldown active
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}