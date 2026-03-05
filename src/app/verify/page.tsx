"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Skill    = { id: string; name: string; category: string };
type Question = {
  id: string; question: string;
  type: "multiple_choice" | "short_answer" | "scenario";
  options?: string[]; correct?: string;
  difficulty: "easy" | "medium" | "hard";
  feedback_correct: string; feedback_wrong: string;
};

const CAT_ICON: Record<string, string> = {
  Programming:"💻", Design:"🎨", Language:"🌍", Academic:"📚",
  Music:"🎵", Arts:"🎭", Media:"🎬", Science:"🔬",
};

// ── Question bank ─────────────────────────────────────────────────────────────
const QUESTION_BANK: Record<string, Question[]> = {
  "Python":[
    {id:"py1",question:"What is the difference between a list and a tuple in Python?",type:"multiple_choice",options:["Lists are ordered, tuples are not","Lists are mutable, tuples are immutable","Tuples can hold more data types","Lists are faster than tuples"],correct:"Lists are mutable, tuples are immutable",difficulty:"easy",feedback_correct:"Lists can be modified after creation while tuples cannot.",feedback_wrong:"The key difference is mutability — lists can be changed, tuples cannot."},
    {id:"py2",question:"What does `*args` do in a Python function definition?",type:"multiple_choice",options:["Multiplies all arguments","Allows any number of positional arguments","Creates a pointer","Declares optional arguments"],correct:"Allows any number of positional arguments",difficulty:"medium",feedback_correct:"*args collects extra positional arguments into a tuple.",feedback_wrong:"The *args syntax packs extra positional arguments into a tuple."},
    {id:"py3",question:"Explain what a Python decorator is and give a real-world use case.",type:"short_answer",difficulty:"hard",feedback_correct:"Decorators wrap functions to extend behavior — common uses: logging, auth, caching.",feedback_wrong:"A decorator is a function that takes another function and extends its behavior."},
    {id:"py4",question:"What is the output of: `print(type([]) == type(()))`?",type:"multiple_choice",options:["True","False","Error","None"],correct:"False",difficulty:"easy",feedback_correct:"[] is a list and () is a tuple — different types, so False.",feedback_wrong:"[] is a list and () is a tuple — different types, so False."},
    {id:"py5",question:"What is a Python generator and how does it differ from a regular function?",type:"short_answer",difficulty:"hard",feedback_correct:"Generators use yield, producing values lazily — very memory-efficient.",feedback_wrong:"A generator uses the yield keyword to return values one at a time."},
    {id:"py6",question:"Which is most memory-efficient for filtering 1 million numbers?",type:"multiple_choice",options:["[x for x in nums if x%2==0]","(x for x in nums if x%2==0)","list(filter(lambda x: x%2==0, nums))","nums.filter(...)"],correct:"(x for x in nums if x%2==0)",difficulty:"hard",feedback_correct:"Generator expressions are lazy — they don't store all values in memory.",feedback_wrong:"Generator expressions (parentheses) are lazy and memory-efficient."},
    {id:"py7",question:"What does `__init__` do in a Python class?",type:"multiple_choice",options:["Destroys the object","Initializes instance attributes when an object is created","Imports modules","Defines class-level variables only"],correct:"Initializes instance attributes when an object is created",difficulty:"easy",feedback_correct:"__init__ is Python's constructor, called automatically when creating a new instance.",feedback_wrong:"__init__ runs automatically when you create an instance."},
    {id:"py8",question:"If you need fast key-value lookups, would you use a list or a dictionary, and why?",type:"scenario",difficulty:"medium",feedback_correct:"Dictionary — O(1) average lookup vs O(n) for lists.",feedback_wrong:"Dictionary — provides O(1) average time complexity for lookups."},
    {id:"py9",question:"What is the GIL and why does it matter for multithreading?",type:"short_answer",difficulty:"hard",feedback_correct:"GIL prevents true parallel threads — use multiprocessing for CPU-bound tasks.",feedback_wrong:"The GIL is a mutex preventing multiple threads from executing Python bytecode simultaneously."},
    {id:"py10",question:"What does `my_list[2:5]` return?",type:"multiple_choice",options:["Elements at index 2 and 5","Elements from index 2 up to but not including 5","Elements from index 2 to 5 inclusive","The last 5 elements"],correct:"Elements from index 2 up to but not including 5",difficulty:"easy",feedback_correct:"Python slicing stop is exclusive. [2:5] returns indices 2, 3, 4.",feedback_wrong:"Python slicing [2:5] returns indices 2, 3, 4 — stop is exclusive."},
    {id:"py11",question:"What is the difference between `is` and `==` in Python?",type:"multiple_choice",options:["`is` compares values, `==` compares identity","`is` compares identity, `==` compares values","They are identical","`is` only works on numbers"],correct:"`is` compares identity, `==` compares values",difficulty:"medium",feedback_correct:"`is` checks if two variables point to the same object in memory.",feedback_wrong:"`is` = same object in memory. `==` = same value."},
    {id:"py12",question:"What is a lambda function and when would you use one?",type:"short_answer",difficulty:"medium",feedback_correct:"A lambda is an anonymous one-liner function, useful for short callbacks like sort keys.",feedback_wrong:"Lambda creates anonymous functions: lambda x: x*2. Use for short, throwaway functions."},
  ],
  "React":[
    {id:"re1",question:"What is the difference between `useState` and `useRef`?",type:"multiple_choice",options:["useState is for strings only","useState triggers re-renders, useRef does not","useRef is deprecated in React 18","They are identical"],correct:"useState triggers re-renders, useRef does not",difficulty:"medium",feedback_correct:"Updating useState causes re-render; useRef persists without triggering re-renders.",feedback_wrong:"useState triggers component re-renders when updated; useRef does not."},
    {id:"re2",question:"What problem does `useCallback` solve? Give a concrete example.",type:"short_answer",difficulty:"hard",feedback_correct:"useCallback memoizes functions to prevent unnecessary re-creation on every render.",feedback_wrong:"useCallback memoizes a function so it's not recreated on every render."},
    {id:"re3",question:"What is the React virtual DOM?",type:"multiple_choice",options:["A simplified HTML structure","A JS representation of the real DOM for efficient updates","A browser-specific API","A way to avoid HTML"],correct:"A JS representation of the real DOM for efficient updates",difficulty:"easy",feedback_correct:"React uses the virtual DOM to calculate minimal real DOM updates.",feedback_wrong:"The virtual DOM is a lightweight JS copy of the real DOM for efficient diffing."},
    {id:"re4",question:"Your component re-renders too often. Walk me through 3 optimization strategies you'd try.",type:"scenario",difficulty:"hard",feedback_correct:"React.memo, useMemo, useCallback, lazy loading, and avoiding inline objects are valid.",feedback_wrong:"React.memo, useMemo, useCallback, and code splitting with lazy() are key strategies."},
    {id:"re5",question:"What is prop drilling and how does Context API solve it?",type:"short_answer",difficulty:"medium",feedback_correct:"Context API creates a provider accessible by any descendant without manual prop passing.",feedback_wrong:"Prop drilling = passing props through many layers. Context makes values globally accessible."},
    {id:"re6",question:"What does the dependency array in `useEffect` control?",type:"multiple_choice",options:["Order of effects","When the effect runs based on value changes","Which components use the effect","The effect return type"],correct:"When the effect runs based on value changes",difficulty:"medium",feedback_correct:"[] = once, [value] = when value changes, no array = every render.",feedback_wrong:"The dependency array controls when useEffect re-runs."},
    {id:"re7",question:"What happens if you call setState inside useEffect with no dependency array?",type:"multiple_choice",options:["Nothing","It runs once on mount","It causes an infinite loop","It throws an error"],correct:"It causes an infinite loop",difficulty:"hard",feedback_correct:"setState → re-render → useEffect runs → setState again → infinite loop!",feedback_wrong:"No dependency array = runs after every render. setState triggers re-render → infinite loop."},
    {id:"re8",question:"What is React.memo and when should you use it?",type:"short_answer",difficulty:"medium",feedback_correct:"React.memo wraps a component to prevent re-renders if props haven't changed.",feedback_wrong:"React.memo is a HOC that memoizes a component — skips re-render if props are the same."},
  ],
  "Math Tutoring":[
    {id:"mt1",question:"What is the derivative of f(x) = x³ + 2x² - 5x + 3?",type:"multiple_choice",options:["3x² + 4x - 5","x² + 4x - 5","3x² + 2x - 5","3x³ + 4x"],correct:"3x² + 4x - 5",difficulty:"medium",feedback_correct:"Power rule: x³→3x², 2x²→4x, -5x→-5, 3→0.",feedback_wrong:"Apply power rule: x³→3x², 2x²→4x, -5x→-5, constant→0."},
    {id:"mt2",question:"A student struggles with lim(x→2) of (x²-4)/(x-2). How do you explain the solution step by step?",type:"scenario",difficulty:"hard",feedback_correct:"Factor: (x+2)(x-2)/(x-2) = x+2. As x→2, answer = 4.",feedback_wrong:"Factor numerator: (x+2)(x-2). Cancel (x-2). As x→2, limit = 4."},
    {id:"mt3",question:"State the quadratic formula and explain what the discriminant tells us.",type:"short_answer",difficulty:"easy",feedback_correct:"x = (-b ± √(b²-4ac)) / 2a. Discriminant b²-4ac: positive=2 roots, zero=1 root, negative=no real roots.",feedback_wrong:"x = (-b ± √(b²-4ac)) / 2a"},
    {id:"mt4",question:"A triangle has sides 3, 4, and 5. What type is it?",type:"multiple_choice",options:["Acute","Right triangle","Obtuse","Equilateral"],correct:"Right triangle",difficulty:"easy",feedback_correct:"3²+4²=25=5². Satisfies Pythagorean theorem!",feedback_wrong:"3²+4²=9+16=25=5². This is a right triangle."},
    {id:"mt5",question:"What is the probability of rolling a sum of 7 with two dice?",type:"multiple_choice",options:["1/6","6/36","7/36","1/7"],correct:"6/36",difficulty:"medium",feedback_correct:"6 ways: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1). P = 6/36 = 1/6.",feedback_wrong:"6 combinations out of 36 total outcomes = 6/36."},
    {id:"mt6",question:"What is log₂(64)?",type:"multiple_choice",options:["4","5","6","8"],correct:"6",difficulty:"easy",feedback_correct:"2⁶ = 64, so log₂(64) = 6.",feedback_wrong:"2⁶=64, so log₂(64)=6."},
    {id:"mt7",question:"Explain what a standard deviation measures and give a real-world example.",type:"short_answer",difficulty:"medium",feedback_correct:"Standard deviation measures how spread out data points are from the mean.",feedback_wrong:"Standard deviation = average distance of data points from the mean."},
    {id:"mt8",question:"A student says 0.999... ≠ 1. How do you explain they are equal?",type:"scenario",difficulty:"hard",feedback_correct:"Let x=0.999..., then 10x=9.999..., subtract: 9x=9, so x=1.",feedback_wrong:"Multiply both sides: 10x-x=9.999...-0.999...=9. So 9x=9, x=1."},
  ],
  "UI/UX Design":[
    {id:"ux1",question:"What is the difference between UX and UI design?",type:"multiple_choice",options:["They are the same thing","UX = experience/flow, UI = visual elements","UI is for mobile, UX for web","UX is done after UI"],correct:"UX = experience/flow, UI = visual elements",difficulty:"easy",feedback_correct:"UX = research, flow, experience. UI = colors, typography, components.",feedback_wrong:"UX focuses on overall experience. UI focuses on the visual layer."},
    {id:"ux2",question:"A user can't find the checkout button on an e-commerce site. Walk through your UX process to fix it.",type:"scenario",difficulty:"hard",feedback_correct:"User interviews, heatmaps, A/B testing, and improving visual hierarchy.",feedback_wrong:"User interviews → heatmap analysis → A/B testing → visual hierarchy improvements."},
    {id:"ux3",question:"What is a wireframe and when in the design process is it used?",type:"multiple_choice",options:["High-fidelity mockup","Low-fidelity layout sketch without visual design","Finished design for development","Animation prototype"],correct:"Low-fidelity layout sketch without visual design",difficulty:"easy",feedback_correct:"Wireframes are low-fidelity blueprints used early to validate concepts cheaply.",feedback_wrong:"Wireframes are simple sketches showing layout/structure without colors."},
    {id:"ux4",question:"What is the minimum touch target size per accessibility guidelines?",type:"multiple_choice",options:["24x24px","44x44px","16x16px","100x100px"],correct:"44x44px",difficulty:"medium",feedback_correct:"44x44px per Apple HIG and WCAG ensures accessible tapping.",feedback_wrong:"44x44px is the recommended minimum per Apple HIG and Material Design."},
    {id:"ux5",question:"What contrast ratio does WCAG 2.1 AA require for normal text?",type:"multiple_choice",options:["2:1","3:1","4.5:1","7:1"],correct:"4.5:1",difficulty:"hard",feedback_correct:"4.5:1 for normal text, 3:1 for large text per WCAG 2.1 AA.",feedback_wrong:"WCAG 2.1 AA requires 4.5:1 for normal text."},
    {id:"ux6",question:"Explain the Gestalt principle of proximity and how you'd apply it in a form design.",type:"short_answer",difficulty:"medium",feedback_correct:"Nearby elements are perceived as related — group labels with their inputs.",feedback_wrong:"Proximity: nearby elements appear related. Apply to group form labels with inputs."},
  ],
  "Guitar":[
    {id:"gu1",question:"What is the emotional difference between major and minor chords?",type:"multiple_choice",options:["Major sounds sad, minor sounds happy","Major sounds happy/bright, minor sounds sad/dark","They sound identical","Minor is louder"],correct:"Major sounds happy/bright, minor sounds sad/dark",difficulty:"easy",feedback_correct:"Major (major third) = bright/happy. Minor (minor third) = darker/sadder.",feedback_wrong:"Major = bright/happy. Minor = darker/sadder — due to interval differences."},
    {id:"gu2",question:"What is a barre chord and why do beginners find it difficult?",type:"short_answer",difficulty:"medium",feedback_correct:"Barre uses one finger across all strings. Hard due to required finger strength and even pressure.",feedback_wrong:"A barre chord presses all strings with one finger — requires strength and consistent pressure."},
    {id:"gu3",question:"A student struggles switching from G to C chord smoothly. What specific exercises do you give them?",type:"scenario",difficulty:"hard",feedback_correct:"Slow tempo, find pivot fingers, one-minute changes drill, visualize next chord.",feedback_wrong:"Slow down, find anchor fingers, practice one-minute changes drill."},
    {id:"gu4",question:"What does EADGBE represent?",type:"multiple_choice",options:["A technique","Standard tuning from low to high","A chord progression","A scale type"],correct:"Standard tuning from low to high",difficulty:"easy",feedback_correct:"EADGBE is standard guitar tuning from thickest (E) to thinnest (e).",feedback_wrong:"EADGBE = standard tuning: 6th string (low E) to 1st string (high e)."},
    {id:"gu5",question:"What is a pentatonic scale and why is it popular for soloing?",type:"short_answer",difficulty:"medium",feedback_correct:"5-note scale that avoids dissonant intervals — almost any note sounds good over common chords.",feedback_wrong:"5 notes that avoid clashing intervals, very forgiving over most chord progressions."},
  ],
  "English Writing":[
    {id:"ew1",question:"Which sentence uses active voice?",type:"multiple_choice",options:["The report was written by Maria.","Maria wrote the report.","The report has been written.","Writing was done by Maria."],correct:"Maria wrote the report.",difficulty:"easy",feedback_correct:"Active voice: subject performs action. 'Maria wrote' = active.",feedback_wrong:"Active voice puts the subject performing the action first."},
    {id:"ew2",question:"Fix this sentence and explain: 'There is a lot of people who wants to learn English.'",type:"scenario",difficulty:"medium",feedback_correct:"'There are' (people is plural) and 'want' (agrees with people).",feedback_wrong:"'There is' → 'There are'. 'wants' → 'want' (subject-verb agreement)."},
    {id:"ew3",question:"What is a thesis statement? Where does it belong in an essay?",type:"short_answer",difficulty:"easy",feedback_correct:"A thesis states the main argument in 1-2 sentences, usually at the end of the introduction.",feedback_wrong:"A thesis concisely states your main argument, at the end of the introduction."},
    {id:"ew4",question:"What is the difference between 'affect' and 'effect'?",type:"multiple_choice",options:["Same meaning","Affect is usually a verb, effect is usually a noun","Effect is a verb, affect is a noun","Both are nouns"],correct:"Affect is usually a verb, effect is usually a noun",difficulty:"medium",feedback_correct:"Affect = verb (to influence). Effect = noun (result).",feedback_wrong:"Affect = verb. Effect = noun. RAVEN: Remember Affect Verb Effect Noun."},
    {id:"ew5",question:"Which sentence is grammatically correct?",type:"multiple_choice",options:["Me and John went to the store.","John and me went to the store.","John and I went to the store.","John and myself went to the store."],correct:"John and I went to the store.",difficulty:"easy",feedback_correct:"Use 'I' as a subject. Remove 'John and' — 'I went' sounds right, 'me went' does not.",feedback_wrong:"'John and I' — use I as subject."},
    {id:"ew6",question:"Explain the difference between a metaphor and a simile. Give one example of each.",type:"short_answer",difficulty:"medium",feedback_correct:"Simile uses 'like' or 'as'. Metaphor is a direct comparison.",feedback_wrong:"Simile: comparison using like/as. Metaphor: direct comparison without like/as."},
  ],
};

const DEFAULT_QUESTIONS: Question[] = [
  {id:"df1",question:"How long have you been practicing this skill and how did you learn it?",type:"short_answer",difficulty:"easy",feedback_correct:"Practical experience is valid evidence of skill.",feedback_wrong:"Share your learning journey to establish experience level."},
  {id:"df2",question:"Describe a specific project where you applied this skill and what you accomplished.",type:"scenario",difficulty:"medium",feedback_correct:"Real-world application demonstrates practical competence.",feedback_wrong:"Real-world application is the strongest evidence of competence."},
  {id:"df3",question:"What are the top 3 most common beginner mistakes in this area, and how would you help someone avoid them?",type:"short_answer",difficulty:"medium",feedback_correct:"Understanding common mistakes shows mastery and teaching ability.",feedback_wrong:"Knowing where students struggle shows meta-awareness of the skill."},
  {id:"df4",question:"How do you personally stay current with new developments in this skill area?",type:"short_answer",difficulty:"easy",feedback_correct:"Continuous learning is essential for any skill teacher.",feedback_wrong:"Keeping current through communities, courses, and practice is key."},
  {id:"df5",question:"A student is frustrated and stuck on a concept. Walk through exactly how you'd help them.",type:"scenario",difficulty:"hard",feedback_correct:"Breaking concepts down, using analogies — hallmarks of great teachers.",feedback_wrong:"Adapt explanations, use analogies, break concepts smaller, stay supportive."},
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

// ── REAL AI scoring via Claude API ────────────────────────────────────────────
async function evaluateAnswer(q: Question, answer: string): Promise<{ score: number; correct: boolean; feedback: string }> {
  // Multiple choice: instant, no API needed
  if (q.type === "multiple_choice" && q.correct) {
    const correct = answer === q.correct;
    return { score: correct ? 10 : 0, correct, feedback: correct ? q.feedback_correct : q.feedback_wrong };
  }

  // Short answer / scenario: real AI grading
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are grading a skill verification exam. Be strict but fair.

Question: ${q.question}
Question type: ${q.type}
Difficulty: ${q.difficulty}
Expected key concepts: ${q.feedback_correct}

Student's answer: "${answer}"

Grade this answer from 0 to 10 based on:
- Accuracy of knowledge (most important)
- Completeness of explanation
- Practical understanding shown

IMPORTANT: A vague or padded answer with no real knowledge = 0-3. Partial knowledge = 4-6. Solid answer = 7-9. Exceptional = 10.
Do NOT reward length alone. A 10-word correct answer beats a 200-word wrong one.

Respond ONLY with valid JSON, no other text:
{"score": <number 0-10>, "feedback": "<one sentence explaining the grade>"}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Math.max(0, Math.min(10, Math.round(parsed.score)));
    return { score, correct: score >= 6, feedback: parsed.feedback || q.feedback_correct };
  } catch {
    // Fallback if API fails: basic keyword check
    const lower = answer.toLowerCase();
    const keywords = q.feedback_correct.toLowerCase().split(/[\s,.\-—]+/).filter(w => w.length > 4);
    const hits = keywords.filter(k => lower.includes(k)).length;
    const score = Math.min(10, Math.round((hits / Math.max(keywords.length, 1)) * 10));
    return { score, correct: score >= 6, feedback: score >= 6 ? q.feedback_correct : q.feedback_wrong };
  }
}

const QUESTION_TIME = 60;
const MAX_STRIKES   = 3;

type Stage = "select" | "generating" | "quiz" | "grading" | "results" | "cooldown";
type AnswerRecord = { question: Question; userAnswer: string; evaluation: { score: number; correct: boolean; feedback: string }; timeUsed: number };

export default function VerifyPage() {
  const [skills, setSkills]             = useState<Skill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [profile, setProfile]           = useState<{ id: string; credits: number; full_name: string } | null>(null);
  const [stage, setStage]               = useState<Stage>("select");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentQ, setCurrentQ]         = useState(0);
  const [answers, setAnswers]           = useState<AnswerRecord[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults]           = useState<{ passed: boolean; totalScore: number; disqualified?: boolean } | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [cooldowns, setCooldowns]       = useState<Record<string, number>>({});
  const [gradingMsg, setGradingMsg]     = useState("Grading your answers…");

  // Anti-cheat
  const [strikes, setStrikes]           = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const strikesRef    = useRef(0);
  const quizActiveRef = useRef(false);

  // Timer — use refs so closures never go stale
  const [timeLeft, setTimeLeft]   = useState(QUESTION_TIME);
  const [timerWarn, setTimerWarn] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep handleTimeUp fresh via ref — fixes the stale closure bug
  const answersRef  = useRef<AnswerRecord[]>([]);
  const currentQRef = useRef(0);
  const questionsRef = useRef<Question[]>([]);
  answersRef.current  = answers;
  currentQRef.current = currentQ;
  questionsRef.current = questions;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase.from("profiles").select("id, credits, full_name").eq("id", user.id).single();
      setProfile(prof);

      const { data: sk } = await supabase.from("skills").select("*").order("category");
      if (sk) setSkills(sk);

      const { data: uSk } = await supabase.from("user_skills").select("skill_id").eq("user_id", user.id).eq("is_verified", true);
      if (uSk) setVerifiedSkills(uSk.map((s: any) => s.skill_id));

      // ✅ Cooldowns from Supabase — not localStorage (can't be bypassed)
      const { data: cdData } = await supabase.from("user_skills")
        .select("skill_id, last_attempt_at")
        .eq("user_id", user.id)
        .eq("is_verified", false)
        .not("last_attempt_at", "is", null);

      if (cdData) {
        const cdMap: Record<string, number> = {};
        cdData.forEach((row: any) => {
          const expiresAt = new Date(row.last_attempt_at).getTime() + 24 * 60 * 60 * 1000;
          if (expiresAt > Date.now()) cdMap[row.skill_id] = expiresAt;
        });
        setCooldowns(cdMap);
      }
    })();
  }, []);

  // Anti-cheat: tab switching
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
      if (selectedSkill) {
        recordFailedAttempt(selectedSkill.id);
      }
      setResults({ passed: false, totalScore: 0, disqualified: true });
      setStage("results");
    } else {
      setShowStrikeWarning(true);
    }
  }, [selectedSkill]);

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

  // ✅ handleTimeUp uses refs — never stale
  const handleTimeUp = useCallback(() => {
    const q = questionsRef.current[currentQRef.current];
    if (!q) return;
    const ev = { score: 0, correct: false, feedback: "⏱ Time ran out. " + q.feedback_wrong };
    const newAnswers = [...answersRef.current, { question: q, userAnswer: "(Time expired)", evaluation: ev, timeUsed: QUESTION_TIME }];
    answersRef.current = newAnswers;
    setAnswers(newAnswers);
    setCurrentAnswer(""); setSelectedOption("");
    if (currentQRef.current + 1 < questionsRef.current.length) {
      setCurrentQ(currentQRef.current + 1);
    } else {
      finishQuiz(newAnswers);
    }
  }, []);

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
  }, [handleTimeUp]);

  useEffect(() => {
    if (stage === "quiz") startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage, currentQ, startTimer]);

  // ✅ Record failed attempt in Supabase — not localStorage
  const recordFailedAttempt = async (skillId: string) => {
    if (!profile) return;
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    setCooldowns(prev => ({ ...prev, [skillId]: expiresAt }));
    await supabase.from("user_skills").upsert(
      { user_id: profile.id, skill_id: skillId, is_verified: false, last_attempt_at: new Date().toISOString() },
      { onConflict: "user_id,skill_id" }
    );
  };

  const finishQuiz = async (fa: AnswerRecord[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    quizActiveRef.current = false;
    setStage("grading");

    // ✅ Real AI grading — re-evaluate all open-ended answers
    setGradingMsg("Grading your answers with AI…");
    const graded: AnswerRecord[] = await Promise.all(
      fa.map(async (a) => {
        if (a.question.type === "multiple_choice") return a;
        setGradingMsg(`Grading question ${fa.indexOf(a) + 1} of ${fa.length}…`);
        const evaluation = await evaluateAnswer(a.question, a.userAnswer);
        return { ...a, evaluation };
      })
    );

    const totalScore = Math.round(graded.reduce((s, a) => s + a.evaluation.score, 0) / graded.length * 10);
    const passed = totalScore >= 70;

    setAnswers(graded);
    setResults({ passed, totalScore });

    if (passed && profile && selectedSkill) {
      await supabase.from("user_skills").upsert(
        { user_id: profile.id, skill_id: selectedSkill.id, type: "teach", is_verified: true, verified_at: new Date().toISOString() },
        { onConflict: "user_id,skill_id" }
      );
      setVerifiedSkills(v => [...v, selectedSkill.id]);
      // ✅ Proper XP with error handling
      const { error: xpErr } = await supabase.rpc("increment_xp", { user_id: profile.id, amount: 25 });
      if (xpErr) console.warn("XP grant failed:", xpErr.message);
    } else if (!passed && selectedSkill) {
      await recordFailedAttempt(selectedSkill.id);
    }

    setStage("results");
  };

  const submitAnswer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const q = questions[currentQ];
    const answer = q.type === "multiple_choice" ? selectedOption : currentAnswer;
    if (!answer.trim()) return;
    const timeUsed = QUESTION_TIME - timeLeft;
    const ev = q.type === "multiple_choice"
      ? { score: answer === q.correct ? 10 : 0, correct: answer === q.correct, feedback: answer === q.correct ? q.feedback_correct : q.feedback_wrong }
      : { score: 0, correct: false, feedback: "Pending AI grading…" }; // placeholder, graded in finishQuiz
    const newAnswers = [...answers, { question: q, userAnswer: answer, evaluation: ev, timeUsed }];
    setAnswers(newAnswers); setCurrentAnswer(""); setSelectedOption("");
    if (currentQ + 1 < questions.length) setCurrentQ(currentQ + 1); else finishQuiz(newAnswers);
  };

  const startQuiz = (skill: Skill) => {
    const cdEnd = cooldowns[skill.id];
    if (cdEnd && Date.now() < cdEnd) {
      setSelectedSkill(skill);
      setCooldownLeft(Math.ceil((cdEnd - Date.now()) / 1000));
      setStage("cooldown");
      return;
    }
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
    const iv = setInterval(() => setCooldownLeft(p => {
      if (p <= 1) { clearInterval(iv); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [stage]);

  const grouped  = skills.reduce((acc, s) => { if (!acc[s.category]) acc[s.category] = []; acc[s.category].push(s); return acc; }, {} as Record<string, Skill[]>);
  const filtered = Object.entries(grouped).reduce((acc, [cat, cs]) => {
    const f = cs.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (f.length) acc[cat] = f; return acc;
  }, {} as Record<string, Skill[]>);

  const q        = questions[currentQ];
  const timerPct = (timeLeft / QUESTION_TIME) * 100;
  const timerCol = timeLeft <= 10 ? "#c0392b" : timeLeft <= 20 ? "#b45309" : "#2d6a4f";
  const fmtCD    = (s: number) => { const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60; return h ? `${h}h ${m}m` : m ? `${m}m ${ss}s` : `${ss}s`; };

  const getInitials = (name: string) => name?.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() || "??";

  return (
    <div style={{ minHeight:"100vh", background:"#f5f2ed", fontFamily:"'DM Sans', sans-serif", color:"#1a1a1a" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        a { text-decoration:none; color:inherit; }
        textarea, input, button { font-family:inherit; }
        ::placeholder { color:#b0a89e; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#d5cfc8; border-radius:99px; }

        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes popIn    { 0%{opacity:0;transform:scale(.94)} 70%{transform:scale(1.015)} 100%{opacity:1;transform:scale(1)} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes wobble   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes dotBounce{ 0%,80%,100%{transform:scale(0);opacity:.3} 40%{transform:scale(1);opacity:1} }
        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        .fadeup  { animation:fadeUp .4s cubic-bezier(.22,.68,0,1.05) both; }
        .fadein  { animation:fadeIn .25s ease both; }
        .popin   { animation:popIn .4s cubic-bezier(.22,.68,0,1.15) both; }
        .wobble  { animation:wobble .6s ease infinite; }

        .skill-card { transition:transform .18s, box-shadow .18s; cursor:pointer; }
        .skill-card:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(0,0,0,.12); }
        .opt-btn  { transition:border-color .12s, background .12s; cursor:pointer; }
        .opt-btn:hover:not(.opt-sel) { border-color:#b7dfc8 !important; background:#f5fbf7 !important; }
        .opt-sel  { border-color:#2d6a4f !important; background:#e8f5ee !important; }
        .cta-btn  { transition:opacity .15s, transform .12s; cursor:pointer; }
        .cta-btn:hover { opacity:.88; transform:translateY(-1px); }
        .navlink  { transition:color .1s, background .1s; }
        .navlink:hover { color:#2d6a4f !important; background:#edf7f1 !important; }

        .dot { width:8px; height:8px; border-radius:50%; background:#2d6a4f; display:inline-block; }
        .dot:nth-child(1){ animation:dotBounce 1.2s ease infinite 0s; }
        .dot:nth-child(2){ animation:dotBounce 1.2s ease infinite .2s; }
        .dot:nth-child(3){ animation:dotBounce 1.2s ease infinite .4s; }

        .shimmer-line {
          background: linear-gradient(90deg, #e8e2d9 25%, #f5f0e8 50%, #e8e2d9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* ── STRIKE WARNING ── */}
      {showStrikeWarning && (
        <div className="fadein" style={{ position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)" }}>
          <div className="popin" style={{ background:"#fff",border:"1.5px solid #f0b8b0",borderRadius:20,maxWidth:400,width:"calc(100% - 40px)",padding:"36px 32px",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",gap:6,justifyContent:"center",marginBottom:20 }}>
              {Array.from({length:MAX_STRIKES}).map((_,i)=>(
                <div key={i} style={{ flex:1,height:5,borderRadius:99,background:i<strikes?"#c0392b":"#e8e2da",transition:"background .3s" }} />
              ))}
            </div>
            <div style={{ fontSize:44,marginBottom:12 }}>🚨</div>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:22,fontWeight:900,color:"#1a1a1a",marginBottom:8 }}>Tab Switch Detected</h2>
            <p style={{ fontSize:14,color:"#777",marginBottom:6 }}>You left the exam window.</p>
            <p style={{ fontSize:14,color:"#1a1a1a",marginBottom:20 }}>
              Strike <strong style={{ color:"#c0392b" }}>{strikes}</strong> of <strong>{MAX_STRIKES}</strong>
              {" — "}
              {MAX_STRIKES - strikes === 1
                ? <span style={{ color:"#c0392b",fontWeight:700 }}>one more = disqualified!</span>
                : <span style={{ color:"#b45309",fontWeight:700 }}>{MAX_STRIKES - strikes} remaining</span>}
            </p>
            <div style={{ background:"#fdf0ee",border:"1px solid #f0b8b0",borderRadius:10,padding:"12px 16px",marginBottom:24,textAlign:"left" }}>
              <p style={{ fontSize:12,color:"#888",lineHeight:1.7 }}>Switching tabs, alt-tabbing, or focusing another window is flagged. The timer kept running while you were away.</p>
            </div>
            <button className="cta-btn" onClick={()=>setShowStrikeWarning(false)}
              style={{ background:"#2d6a4f",color:"#fff",border:"none",borderRadius:12,padding:"13px",width:"100%",fontSize:14,fontWeight:700 }}>
              Resume Exam →
            </button>
          </div>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav style={{ position:"sticky",top:0,zIndex:50,height:58,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",background:"rgba(255,255,255,0.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid #e8e2d9" }}>
        <a href="/dashboard" style={{ display:"flex",alignItems:"center" }}>
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:900,fontSize:20,color:"#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:900,fontSize:20,color:"#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display:"flex",gap:2 }}>
          {[["Dashboard","/dashboard"],["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"]].map(([l,h])=>(
            <a key={l} href={h} className="navlink" style={{ padding:"6px 12px",borderRadius:8,fontSize:13,fontWeight:600,color:"#666" }}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          {profile && (
            <span style={{ fontSize:12,fontWeight:700,color:"#2d6a4f",background:"#e8f4e8",border:"1px solid #b7dfc8",padding:"5px 13px",borderRadius:99 }}>
              💰 {profile.credits} cr
            </span>
          )}
          <a href="/profile" style={{ width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#2d6a4f,#1a4a35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff" }}>
            {profile ? getInitials(profile.full_name || "") : "?"}
          </a>
        </div>
      </nav>

      <div style={{ maxWidth:840,margin:"0 auto",padding:"36px 24px 80px" }}>

        {/* ════ SELECT ════ */}
        {stage === "select" && (
          <div className="fadeup">
            <div style={{ marginBottom:32 }}>
              <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"#e8f4e8",border:"1px solid #b7dfc8",borderRadius:99,padding:"5px 14px",marginBottom:14,fontSize:12,fontWeight:700,color:"#2d6a4f" }}>
                ✅ Skill Verification Center
              </div>
              <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:32,fontWeight:900,color:"#1a1a1a",marginBottom:8,letterSpacing:"-0.02em" }}>Get Verified</h1>
              <p style={{ fontSize:15,color:"#666",maxWidth:480,lineHeight:1.65 }}>
                Prove your knowledge with a real quiz. Score 70%+ to earn a verified badge on your listings — graded by AI, not just word count.
              </p>
            </div>

            {/* How it works strip */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28 }}>
              {[
                { icon:"⏱", title:"60s per question",  desc:"Timer per question, not total" },
                { icon:"🤖", title:"AI-graded",         desc:"Open answers judged on actual knowledge" },
                { icon:"👁️", title:"Tab monitoring",    desc:"3 strikes = disqualified" },
                { icon:"⏳", title:"24h cooldown",       desc:"Failed attempts lock for a day" },
              ].map(f=>(
                <div key={f.title} style={{ background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:14,padding:"16px",boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                  <div style={{ fontSize:22,marginBottom:8 }}>{f.icon}</div>
                  <p style={{ fontSize:12,fontWeight:800,color:"#1a1a1a",marginBottom:3 }}>{f.title}</p>
                  <p style={{ fontSize:11,color:"#999",lineHeight:1.5 }}>{f.desc}</p>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{ position:"relative",marginBottom:24 }}>
              <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none" }}>🔍</span>
              <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search skills…"
                style={{ width:"100%",paddingLeft:42,paddingRight:16,paddingTop:11,paddingBottom:11,borderRadius:12,background:"#fff",border:"1.5px solid #e8e2d9",fontSize:14,outline:"none",color:"#1a1a1a",transition:"border-color .15s" }}
                onFocus={e=>e.target.style.borderColor="#2d6a4f"} onBlur={e=>e.target.style.borderColor="#e8e2d9"} />
            </div>

            {/* Skill grid */}
            {Object.entries(filtered).map(([cat, catSkills]) => (
              <div key={cat} style={{ marginBottom:28 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:12 }}>
                  <span style={{ fontSize:16 }}>{CAT_ICON[cat]||"📖"}</span>
                  <span style={{ fontSize:11,fontWeight:800,color:"#999",textTransform:"uppercase",letterSpacing:"0.1em" }}>{cat}</span>
                  <div style={{ flex:1,height:1,background:"#e8e2d9" }} />
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:10 }}>
                  {catSkills.map(skill => {
                    const isV   = verifiedSkills.includes(skill.id);
                    const cdEnd = cooldowns[skill.id];
                    const hasCd = !!(cdEnd && Date.now() < cdEnd);
                    const remH  = hasCd ? Math.ceil((cdEnd - Date.now()) / 3600000) : 0;
                    return (
                      <div key={skill.id}
                        className={!isV && !hasCd ? "skill-card" : ""}
                        onClick={()=>!isV&&!hasCd&&startQuiz(skill)}
                        style={{ background:isV?"#e8f4e8":hasCd?"#fdf0ee":"#fff",
                          border:`1.5px solid ${isV?"#b7dfc8":hasCd?"#f0b8b0":"#e8e2d9"}`,
                          borderRadius:14,padding:"16px",cursor:isV||hasCd?"default":"pointer",
                          boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                          <span style={{ fontSize:22 }}>{CAT_ICON[cat]||"📖"}</span>
                          {isV  && <span style={{ fontSize:10,fontWeight:800,color:"#2d6a4f",background:"#c8f0d8",border:"1px solid #a8dfc0",padding:"2px 9px",borderRadius:99 }}>✓ Verified</span>}
                          {hasCd && <span style={{ fontSize:10,fontWeight:700,color:"#c0392b",background:"#fde0d8",border:"1px solid #f0b8b0",padding:"2px 9px",borderRadius:99 }}>⏳ {remH}h</span>}
                        </div>
                        <p style={{ fontSize:13,fontWeight:700,color:"#1a1a1a",marginBottom:4 }}>{skill.name}</p>
                        {!isV && !hasCd && <p style={{ fontSize:11,color:"#2d6a4f",fontWeight:600 }}>Take quiz →</p>}
                        {isV            && <p style={{ fontSize:11,color:"#2d6a4f",fontWeight:600 }}>Badge earned 🏅</p>}
                        {hasCd          && <p style={{ fontSize:11,color:"#c0392b",fontWeight:600 }}>Try again in {remH}h</p>}
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
          <div className="fadeup" style={{ maxWidth:460,margin:"60px auto 0",textAlign:"center" }}>
            <div style={{ fontSize:52,marginBottom:16,animation:"pulse 2s infinite" }}>⏳</div>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26,fontWeight:900,color:"#1a1a1a",marginBottom:8 }}>Cooldown Active</h2>
            <p style={{ color:"#888",marginBottom:24,fontSize:15 }}>You recently failed <strong style={{ color:"#1a1a1a" }}>{selectedSkill?.name}</strong> verification.</p>
            <div style={{ background:"#fdf0ee",border:"1.5px solid #f0b8b0",borderRadius:16,padding:"22px 28px",display:"inline-flex",alignItems:"center",gap:16,marginBottom:28 }}>
              <span style={{ fontSize:28 }}>⏱</span>
              <div>
                <p style={{ fontSize:10,fontWeight:800,color:"#c0392b",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4 }}>Time Remaining</p>
                <p style={{ fontFamily:"'Fraunces',serif", fontSize:32,fontWeight:900,color:"#1a1a1a" }}>{fmtCD(cooldownLeft)}</p>
              </div>
            </div>
            <br />
            <button className="cta-btn" onClick={reset} style={{ background:"#f5f0e8",color:"#555",border:"1.5px solid #e8e2d9",borderRadius:12,padding:"11px 22px",fontSize:13,fontWeight:700,cursor:"pointer" }}>
              ← Choose Another Skill
            </button>
          </div>
        )}

        {/* ════ GENERATING ════ */}
        {stage === "generating" && (
          <div className="fadeup" style={{ maxWidth:460,margin:"80px auto 0",textAlign:"center" }}>
            <div style={{ fontSize:44,marginBottom:16,animation:"pulse .9s infinite" }}>🎲</div>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:24,fontWeight:900,color:"#1a1a1a",marginBottom:8 }}>Preparing your quiz…</h2>
            <p style={{ fontSize:14,color:"#888",marginBottom:28 }}>Selecting 5 random questions for <strong style={{ color:"#1a1a1a" }}>{selectedSkill?.name}</strong></p>
            <div style={{ display:"flex",gap:7,justifyContent:"center",marginBottom:24 }}>
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
            <div style={{ background:"#fdf0ee",border:"1px solid #f0b8b0",borderRadius:10,padding:"11px 16px",display:"inline-block" }}>
              <p style={{ fontSize:12,color:"#c0392b",fontWeight:700 }}>👁️ Tab switching is monitored · {MAX_STRIKES} strikes = disqualified</p>
            </div>
          </div>
        )}

        {/* ════ QUIZ ════ */}
        {stage === "quiz" && q && (
          <div className="fadeup" style={{ maxWidth:600,margin:"0 auto" }}>
            {/* Top bar */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <button className="cta-btn" onClick={reset} style={{ background:"#f5f0e8",color:"#666",border:"1.5px solid #e8e2d9",borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer" }}>← Exit</button>
              <span style={{ fontSize:13,fontWeight:700,color:"#1a1a1a" }}>{selectedSkill?.name}</span>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ display:"flex",gap:4 }}>
                  {Array.from({length:MAX_STRIKES}).map((_,i)=>(
                    <div key={i} style={{ width:9,height:9,borderRadius:"50%",background:i<strikes?"#c0392b":"#e2ddd7",border:`1px solid ${i<strikes?"#c0392b":"#d0c9c0"}`,transition:"background .2s" }} />
                  ))}
                </div>
                <span style={{ fontSize:12,color:"#aaa",fontWeight:600 }}>Q{currentQ+1}/{questions.length}</span>
              </div>
            </div>

            {/* Progress dots */}
            <div style={{ display:"flex",gap:5,marginBottom:16 }}>
              {questions.map((_,i)=>(
                <div key={i} style={{ flex:1,height:4,borderRadius:99,background:i<currentQ?"#2d6a4f":i===currentQ?"#b7dfc8":"#e2ddd7",transition:"background .3s" }} />
              ))}
            </div>

            {/* Timer */}
            <div style={{ background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:14,padding:"13px 16px",display:"flex",alignItems:"center",gap:13,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
              <div className={timerWarn?"wobble":""} style={{ width:48,height:48,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,flexShrink:0,
                background:timeLeft<=10?"#fdf0ee":timeLeft<=20?"#fdf6e3":"#e8f4e8",
                color:timerCol, border:`2px solid ${timeLeft<=10?"#f0b8b0":timeLeft<=20?"#f0d890":"#b7dfc8"}` }}>
                {timeLeft}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,fontWeight:700,color:"#bbb",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6 }}>
                  <span>Time Remaining</span>
                  <span style={{ color:timerCol }}>{timeLeft<=10?"⚠️ Hurry!":timeLeft<=20?"Running low…":"You've got this"}</span>
                </div>
                <div style={{ height:6,borderRadius:99,background:"#e8e2d9",overflow:"hidden" }}>
                  <div style={{ height:"100%",borderRadius:99,background:timerCol,width:`${timerPct}%`,transition:"width 1s linear" }} />
                </div>
              </div>
            </div>

            {/* Question card */}
            <div style={{ background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:18,padding:"26px",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
              <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:14 }}>
                <span style={{ fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:99,textTransform:"uppercase",letterSpacing:"0.06em",
                  color:q.difficulty==="hard"?"#c0392b":q.difficulty==="medium"?"#b45309":"#2d6a4f",
                  background:q.difficulty==="hard"?"#fdf0ee":q.difficulty==="medium"?"#fdf6e3":"#e8f4e8",
                  border:`1px solid ${q.difficulty==="hard"?"#f0b8b0":q.difficulty==="medium"?"#f0d890":"#b7dfc8"}` }}>
                  {q.difficulty}
                </span>
                <span style={{ fontSize:10,fontWeight:600,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em" }}>
                  {q.type==="multiple_choice"?"Multiple Choice":q.type==="scenario"?"Scenario":"Short Answer"}
                </span>
                {(q.type==="short_answer"||q.type==="scenario") && (
                  <span style={{ fontSize:10,fontWeight:700,color:"#2d6a4f",background:"#e8f4e8",border:"1px solid #b7dfc8",padding:"2px 8px",borderRadius:99,marginLeft:"auto" }}>🤖 AI Graded</span>
                )}
              </div>
              <p style={{ fontSize:16,fontWeight:700,color:"#1a1a1a",lineHeight:1.6,marginBottom:20,fontFamily:"'Fraunces',serif" }}>{q.question}</p>

              {q.type==="multiple_choice" && q.options && (
                <div style={{ display:"flex",flexDirection:"column",gap:9 }}>
                  {q.options.map((opt,i)=>{
                    const sel = selectedOption===opt;
                    return (
                      <button key={i} className={`opt-btn${sel?" opt-sel":""}`}
                        onClick={()=>setSelectedOption(opt)}
                        style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 15px",borderRadius:11,
                          border:`1.5px solid ${sel?"#2d6a4f":"#e8e2d9"}`,
                          background:sel?"#e8f4e8":"#faf8f4",
                          cursor:"pointer",textAlign:"left",width:"100%" }}>
                        <span style={{ width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0,
                          background:sel?"#2d6a4f":"#e8e2d9",color:sel?"#fff":"#aaa" }}>
                          {["A","B","C","D"][i]}
                        </span>
                        <span style={{ fontSize:13,fontWeight:600,color:sel?"#2d6a4f":"#1a1a1a" }}>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type !== "multiple_choice" && (
                <div>
                  <label style={{ display:"block",fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8 }}>
                    {q.type==="scenario"?"Describe your approach:":"Your answer:"}
                  </label>
                  <textarea value={currentAnswer} onChange={e=>setCurrentAnswer(e.target.value)} rows={5}
                    placeholder="Be specific — AI grades on actual knowledge, not length…"
                    style={{ width:"100%",padding:"13px 15px",borderRadius:12,border:"1.5px solid #e8e2d9",background:"#faf8f4",color:"#1a1a1a",fontSize:13,lineHeight:1.7,resize:"none",outline:"none",transition:"border-color .15s" }}
                    onFocus={e=>e.target.style.borderColor="#2d6a4f"} onBlur={e=>e.target.style.borderColor="#e8e2d9"} />
                  <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}>
                    <p style={{ fontSize:11,color:currentAnswer.length>80?"#2d6a4f":currentAnswer.length>30?"#b45309":"#ccc",fontWeight:600 }}>
                      {currentAnswer.length} chars {currentAnswer.length<30?"— write more":currentAnswer.length<80?"— getting there":"— good detail ✓"}
                    </p>
                    <p style={{ fontSize:11,color:"#ccc" }}>AI judges quality, not length</p>
                  </div>
                </div>
              )}
            </div>

            {(()=>{
              const dis = q.type==="multiple_choice"?!selectedOption:currentAnswer.trim().length<15;
              return (
                <button className="cta-btn" onClick={submitAnswer} disabled={dis}
                  style={{ background:dis?"#ccc":"#2d6a4f",color:"#fff",border:"none",borderRadius:12,width:"100%",padding:"14px",fontSize:15,fontWeight:800,cursor:dis?"not-allowed":"pointer",boxShadow:dis?"none":"0 4px 20px rgba(45,106,79,0.3)" }}>
                  {currentQ+1===questions.length?"Finish & Get Graded →":"Next Question →"}
                </button>
              );
            })()}
          </div>
        )}

        {/* ════ GRADING ════ */}
        {stage === "grading" && (
          <div className="fadeup" style={{ maxWidth:460,margin:"80px auto 0",textAlign:"center" }}>
            <div style={{ width:64,height:64,borderRadius:"50%",background:"#e8f4e8",border:"2px solid #b7dfc8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 20px",animation:"spin 2s linear infinite" }}>🤖</div>
            <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:24,fontWeight:900,color:"#1a1a1a",marginBottom:8 }}>Grading in progress</h2>
            <p style={{ fontSize:14,color:"#888",marginBottom:28 }}>{gradingMsg}</p>
            <div style={{ display:"flex",gap:7,justifyContent:"center",marginBottom:28 }}>
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
            <div style={{ background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:14,padding:"16px 20px",textAlign:"left" }}>
              <p style={{ fontSize:12,color:"#2d6a4f",fontWeight:700,marginBottom:4 }}>🤖 How AI grading works</p>
              <p style={{ fontSize:12,color:"#888",lineHeight:1.7 }}>Claude evaluates your open-ended answers for accuracy, depth, and practical understanding — not just word count. Answers are graded on a 0–10 scale.</p>
            </div>
          </div>
        )}

        {/* ════ RESULTS ════ */}
        {stage==="results" && results && (
          <div className="fadeup" style={{ maxWidth:600,margin:"0 auto" }}>
            {/* Banner */}
            <div style={{ background:results.disqualified?"#fdf0ee":results.passed?"#e8f4e8":"#fff",
              border:`1.5px solid ${results.disqualified?"#f0b8b0":results.passed?"#b7dfc8":"#e8e2d9"}`,
              borderRadius:20,padding:"32px 28px",textAlign:"center",marginBottom:16,
              borderTop:`5px solid ${results.disqualified?"#c0392b":results.passed?"#2d6a4f":"#ccc"}` }}>
              <div style={{ fontSize:52,marginBottom:12 }}>{results.disqualified?"🚫":results.passed?"🎉":"😔"}</div>
              <h2 style={{ fontFamily:"'Fraunces',serif", fontSize:26,fontWeight:900,color:"#1a1a1a",marginBottom:10 }}>
                {results.disqualified?"Disqualified":results.passed?`Verified in ${selectedSkill?.name}!`:"Not quite this time"}
              </h2>
              <p style={{ fontSize:14,color:"#666",maxWidth:380,margin:"0 auto 24px",lineHeight:1.75 }}>
                {results.disqualified
                  ?`You switched tabs ${tabSwitchCount} time${tabSwitchCount!==1?"s":""}. ${MAX_STRIKES} strikes triggered automatic disqualification. A 24-hour cooldown has been applied.`
                  :results.passed
                  ?"Your verified badge is now live on your profile and listings. You earned +25 XP."
                  :`Your score was ${results.totalScore}%. You need 70% to pass. Review the feedback below and try again in 24 hours.`}
              </p>

              <div style={{ display:"inline-flex",gap:0,background:"#f5f0e8",borderRadius:12,overflow:"hidden",border:"1px solid #e8e2d9" }}>
                {(results.disqualified?[
                  {v:String(tabSwitchCount),l:"Tab Switches",c:"#c0392b"},
                  {v:`${MAX_STRIKES}/${MAX_STRIKES}`,l:"Strikes",c:"#c0392b"},
                  {v:"24h",l:"Cooldown",c:"#1a1a1a"},
                ]:[
                  {v:`${results.totalScore}%`,l:"Score",c:"#1a1a1a"},
                  {v:`${answers.filter(a=>a.evaluation.correct).length}/${answers.length}`,l:"Correct",c:"#1a1a1a"},
                  {v:results.passed?"+25 XP":"0 XP",l:"XP Earned",c:results.passed?"#2d6a4f":"#aaa"},
                ]).map((x,i,arr)=>(
                  <div key={i} style={{ padding:"14px 26px",borderRight:i<arr.length-1?"1px solid #e8e2d9":"none",textAlign:"center" }}>
                    <p style={{ fontFamily:"'Fraunces',serif", fontSize:28,fontWeight:900,color:x.c,lineHeight:1 }}>{x.v}</p>
                    <p style={{ fontSize:9,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:4 }}>{x.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Question breakdown */}
            {!results.disqualified && answers.length > 0 && (
              <>
                <p style={{ fontSize:11,fontWeight:800,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:12 }}>Question Breakdown</p>
                <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16 }}>
                  {answers.map((a,i)=>(
                    <div key={i} style={{ background:"#fff",border:"1.5px solid #e8e2d9",borderRadius:16,padding:"18px 20px",
                      borderLeft:`4px solid ${a.evaluation.correct?"#2d6a4f":"#c0392b"}` }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
                        <div style={{ flex:1,marginRight:12 }}>
                          <div style={{ display:"flex",alignItems:"center",gap:7,marginBottom:7 }}>
                            <span style={{ fontSize:9,fontWeight:800,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em" }}>Q{i+1}</span>
                            <span style={{ fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:99,textTransform:"uppercase",letterSpacing:"0.06em",
                              color:a.question.difficulty==="hard"?"#c0392b":a.question.difficulty==="medium"?"#b45309":"#2d6a4f",
                              background:a.question.difficulty==="hard"?"#fdf0ee":a.question.difficulty==="medium"?"#fdf6e3":"#e8f4e8" }}>
                              {a.question.difficulty}
                            </span>
                            <span style={{ fontSize:10,color:"#ccc" }}>⏱ {a.timeUsed}s</span>
                            {a.question.type!=="multiple_choice" && <span style={{ fontSize:10,color:"#2d6a4f",fontWeight:700 }}>🤖 AI graded</span>}
                          </div>
                          <p style={{ fontSize:13,fontWeight:700,color:"#1a1a1a",lineHeight:1.5 }}>{a.question.question}</p>
                        </div>
                        <div style={{ textAlign:"right",flexShrink:0 }}>
                          <p style={{ fontFamily:"'Fraunces',serif", fontSize:22,fontWeight:900,color:a.evaluation.correct?"#2d6a4f":"#c0392b",lineHeight:1 }}>{a.evaluation.score}<span style={{ fontSize:12,color:"#ccc" }}>/10</span></p>
                          <span style={{ fontSize:18 }}>{a.evaluation.correct?"✅":"❌"}</span>
                        </div>
                      </div>
                      <div style={{ background:"#faf8f4",borderRadius:10,padding:"9px 13px",marginBottom:10 }}>
                        <p style={{ fontSize:9,fontWeight:800,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4 }}>Your Answer</p>
                        <p style={{ fontSize:12,color:"#666",lineHeight:1.65 }}>{a.userAnswer}</p>
                      </div>
                      <p style={{ fontSize:12,color:"#888",lineHeight:1.65 }}>💡 {a.evaluation.feedback}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* CTAs */}
            <div style={{ display:"flex",gap:10 }}>
              {results.passed ? (
                <>
                  <a href="/listings/create" style={{ flex:2,display:"block",background:"#2d6a4f",color:"#fff",border:"none",borderRadius:12,padding:"14px",textAlign:"center",fontSize:14,fontWeight:800,boxShadow:"0 4px 20px rgba(45,106,79,.3)" }}>
                    Create a Listing →
                  </a>
                  <button className="cta-btn" onClick={reset} style={{ flex:1,background:"#f5f0e8",color:"#555",border:"1.5px solid #e8e2d9",borderRadius:12,padding:"14px",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                    Verify Another
                  </button>
                </>
              ) : (
                <>
                  <button className="cta-btn" onClick={reset} style={{ flex:1,background:"#f5f0e8",color:"#555",border:"1.5px solid #e8e2d9",borderRadius:12,padding:"14px",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                    ← Choose Another Skill
                  </button>
                  <div style={{ flex:1,background:"#fdf0ee",border:"1.5px solid #f0b8b0",borderRadius:12,padding:"14px",textAlign:"center",color:"#c0392b",fontSize:13,fontWeight:700 }}>
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