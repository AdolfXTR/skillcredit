"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Skill = { id: string; name: string; category: string };
type Question = {
  question: string;
  type: "multiple_choice" | "short_answer" | "scenario";
  options?: string[];
  correct?: string;
  difficulty: "easy" | "medium" | "hard";
  feedback_correct: string;
  feedback_wrong: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  Programming: "💻", Design: "🎨", Language: "🌍",
  Academic: "📚", Music: "🎵", Arts: "🎭", Media: "🎬", Science: "🔬",
};

const CATEGORY_TW: Record<string, string> = {
  Programming: "bg-sky-50 text-sky-700",
  Design:      "bg-pink-50 text-pink-700",
  Language:    "bg-emerald-50 text-emerald-700",
  Academic:    "bg-violet-50 text-violet-700",
  Music:       "bg-amber-50 text-amber-700",
  Arts:        "bg-orange-50 text-orange-700",
  Media:       "bg-rose-50 text-rose-700",
  Science:     "bg-teal-50 text-teal-700",
};

const QUESTION_BANK: Record<string, Question[]> = {
  "Python": [
    { question: "What is the difference between a list and a tuple in Python?", type: "multiple_choice", options: ["Lists are ordered, tuples are not", "Lists are mutable, tuples are immutable", "Tuples can hold more data types", "Lists are faster than tuples"], correct: "Lists are mutable, tuples are immutable", difficulty: "easy", feedback_correct: "Correct! Lists can be modified after creation while tuples cannot.", feedback_wrong: "The key difference is mutability — lists can be changed, tuples cannot." },
    { question: "What does the `*args` syntax do in a Python function definition?", type: "multiple_choice", options: ["Multiplies all arguments together", "Allows passing any number of positional arguments", "Creates a pointer to arguments", "Declares arguments as optional"], correct: "Allows passing any number of positional arguments", difficulty: "medium", feedback_correct: "Exactly! *args collects extra positional arguments into a tuple.", feedback_wrong: "The *args syntax packs extra positional arguments into a tuple inside the function." },
    { question: "Explain what a Python decorator is and give a real-world use case.", type: "short_answer", difficulty: "hard", feedback_correct: "Great! Decorators wrap functions to extend behavior — common uses include logging, auth, caching.", feedback_wrong: "A decorator is a function that takes another function and extends its behavior without modifying it." },
    { question: "What is the output of: `print(type([]) == type(()))`?", type: "multiple_choice", options: ["True", "False", "Error", "None"], correct: "False", difficulty: "easy", feedback_correct: "Correct! A list [] and tuple () are different types so the comparison is False.", feedback_wrong: "[] is a list and () is a tuple — different types, so False." },
    { question: "What is a Python generator and how does it differ from a regular function?", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! Generators use yield, producing values lazily one at a time, which is memory-efficient.", feedback_wrong: "A generator uses the yield keyword to return values one at a time without storing the whole sequence." },
    { question: "You have a list of 1 million numbers and need all even ones. Which is more memory-efficient?", type: "multiple_choice", options: ["[x for x in nums if x%2==0]", "(x for x in nums if x%2==0)", "filter(lambda x: x%2==0, nums)", "Both B and C"], correct: "Both B and C", difficulty: "hard", feedback_correct: "Correct! Generator expressions and filter() are both lazy iterators.", feedback_wrong: "Generator expressions (parentheses) and filter() both produce lazy iterators — memory efficient." },
    { question: "What does `__init__` do in a Python class?", type: "multiple_choice", options: ["Destroys the object", "Initializes instance attributes when an object is created", "Imports modules", "Defines class-level variables only"], correct: "Initializes instance attributes when an object is created", difficulty: "easy", feedback_correct: "Correct! __init__ is the constructor called automatically when creating a new instance.", feedback_wrong: "__init__ is Python's constructor. It runs automatically when you create an instance." },
    { question: "Describe a scenario where you'd use a dictionary over a list in Python.", type: "scenario", difficulty: "medium", feedback_correct: "Good! Dictionaries excel for fast key-based lookup — O(1) vs O(n) for lists.", feedback_wrong: "Use a dictionary when you need key-based lookup — e.g. storing user data by ID, word counts." },
    { question: "What is the GIL in Python and why does it matter for multithreading?", type: "short_answer", difficulty: "hard", feedback_correct: "The GIL prevents true parallel Python threads — use multiprocessing for CPU-bound tasks.", feedback_wrong: "The GIL is a mutex that prevents multiple threads from executing Python bytecode simultaneously." },
    { question: "What is list slicing? What does `my_list[2:5]` return?", type: "multiple_choice", options: ["Elements at index 2 and 5", "Elements from index 2 up to but not including 5", "Elements from index 2 to 5 inclusive", "The last 5 elements"], correct: "Elements from index 2 up to but not including 5", difficulty: "easy", feedback_correct: "Correct! Python slicing stop is exclusive. [2:5] returns elements at indices 2, 3, 4.", feedback_wrong: "Python slicing [2:5] returns indices 2, 3, 4 — the stop is exclusive." },
  ],
  "React": [
    { question: "What is the difference between `useState` and `useRef` in React?", type: "multiple_choice", options: ["useState is for strings, useRef is for numbers", "useState triggers re-renders, useRef does not", "useRef is deprecated in React 18", "They are identical"], correct: "useState triggers re-renders, useRef does not", difficulty: "medium", feedback_correct: "Correct! Updating useState causes a re-render; useRef does not.", feedback_wrong: "useState triggers component re-renders when updated; useRef does not." },
    { question: "What problem does `useCallback` solve in React?", type: "short_answer", difficulty: "hard", feedback_correct: "useCallback memoizes functions to prevent unnecessary re-creation on every render.", feedback_wrong: "useCallback memoizes a function so it's not recreated on every render." },
    { question: "What is the React virtual DOM and why does it exist?", type: "multiple_choice", options: ["A simplified HTML structure", "A JS representation of the real DOM for efficient updates", "A browser-specific API", "A way to avoid using HTML"], correct: "A JS representation of the real DOM for efficient updates", difficulty: "easy", feedback_correct: "Correct! React uses the virtual DOM to calculate minimal DOM updates.", feedback_wrong: "The virtual DOM is a lightweight JS copy of the real DOM for efficient diffing." },
    { question: "Your React component re-renders too often. Name 3 optimization strategies.", type: "scenario", difficulty: "hard", feedback_correct: "React.memo, useMemo, useCallback, lazy loading, and avoiding inline objects are all valid.", feedback_wrong: "React.memo, useMemo, useCallback, and code splitting with lazy() are key strategies." },
    { question: "What is prop drilling and how does Context API solve it?", type: "short_answer", difficulty: "medium", feedback_correct: "Context API creates a provider accessible by any descendant without manual prop passing.", feedback_wrong: "Prop drilling is passing props through many layers. Context API makes values globally accessible." },
    { question: "What does the dependency array in `useEffect` control?", type: "multiple_choice", options: ["The order of effects", "When the effect runs based on value changes", "Which components can use the effect", "The effect's return type"], correct: "When the effect runs based on value changes", difficulty: "medium", feedback_correct: "Correct! [] = once, [value] = when value changes, no array = every render.", feedback_wrong: "The dependency array controls when useEffect re-runs." },
    { question: "What is the difference between controlled and uncontrolled components?", type: "multiple_choice", options: ["Controlled use class syntax", "Controlled components have state managed by React, uncontrolled use the DOM", "Uncontrolled components are deprecated", "No practical difference"], correct: "Controlled components have state managed by React, uncontrolled use the DOM", difficulty: "medium", feedback_correct: "Controlled bind form values to React state. Uncontrolled let the DOM manage state.", feedback_wrong: "Controlled components use useState for form values. Uncontrolled use useRef." },
    { question: "Explain React's reconciliation algorithm in simple terms.", type: "short_answer", difficulty: "hard", feedback_correct: "React diffs virtual DOM trees level-by-level using keys to efficiently update only what changed.", feedback_wrong: "Reconciliation compares old and new virtual DOM trees to find the minimum real DOM operations." },
  ],
  "Math Tutoring": [
    { question: "What is the derivative of f(x) = x³ + 2x² - 5x + 3?", type: "multiple_choice", options: ["3x² + 4x - 5", "x² + 4x - 5", "3x² + 2x - 5", "3x³ + 4x"], correct: "3x² + 4x - 5", difficulty: "medium", feedback_correct: "Correct! Power rule: x³→3x², 2x²→4x, -5x→-5, 3→0.", feedback_wrong: "Apply the power rule: x³→3x², 2x²→4x, -5x→-5, 3→0. Result: 3x² + 4x - 5." },
    { question: "A student struggles with lim(x→2) of (x²-4)/(x-2). How do you explain it?", type: "scenario", difficulty: "hard", feedback_correct: "Factor (x²-4) = (x+2)(x-2), cancel (x-2), limit = 4. Explain why direct substitution fails.", feedback_wrong: "Factor numerator: (x+2)(x-2). Cancel (x-2). As x→2, limit = 2+2 = 4." },
    { question: "What is the quadratic formula and when do you use it?", type: "short_answer", difficulty: "easy", feedback_correct: "x = (-b ± √(b²-4ac)) / 2a — use it to solve ax²+bx+c=0 when factoring isn't obvious.", feedback_wrong: "x = (-b ± √(b²-4ac)) / 2a. Use it for quadratic equations that don't factor easily." },
    { question: "A triangle has sides 3, 4, and 5. What type is it?", type: "multiple_choice", options: ["Acute triangle", "Right triangle", "Obtuse triangle", "Equilateral triangle"], correct: "Right triangle", difficulty: "easy", feedback_correct: "3²+4²=25=5². It satisfies Pythagorean theorem — right triangle!", feedback_wrong: "3²+4²=9+16=25=5². Since a²+b²=c², this is a right triangle." },
    { question: "Explain integration by parts and give an example.", type: "short_answer", difficulty: "hard", feedback_correct: "∫u dv = uv - ∫v du. Classic: ∫x·eˣdx where u=x, dv=eˣdx → xeˣ - eˣ + C.", feedback_wrong: "∫u dv = uv - ∫v du. Use for products like x·sin(x) or x·eˣ. LIATE helps choose u." },
    { question: "What is the probability of rolling a sum of 7 with two dice?", type: "multiple_choice", options: ["1/6", "6/36", "7/36", "1/7"], correct: "6/36", difficulty: "medium", feedback_correct: "36 total outcomes. (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 ways. P = 6/36 = 1/6.", feedback_wrong: "6×6=36 outcomes. 6 ways to get 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1). P=6/36." },
  ],
  "UI/UX Design": [
    { question: "What is the difference between UX and UI design?", type: "multiple_choice", options: ["They are the same thing", "UX focuses on user experience and flow, UI focuses on visual elements", "UI is for mobile, UX is for web", "UX is done after UI"], correct: "UX focuses on user experience and flow, UI focuses on visual elements", difficulty: "easy", feedback_correct: "UX = experience, flow, research. UI = colors, typography, components.", feedback_wrong: "UX focuses on the overall experience. UI focuses on the visual layer." },
    { question: "User can't find the checkout button. What UX process do you follow?", type: "scenario", difficulty: "hard", feedback_correct: "User interviews, heatmaps, A/B testing, and applying visual hierarchy are all correct.", feedback_wrong: "User interviews → heatmap analysis → A/B testing → visual hierarchy improvements." },
    { question: "What is a wireframe and when would you use one?", type: "multiple_choice", options: ["A high-fidelity mockup", "A low-fidelity layout sketch showing structure without visual design", "A finished design ready for development", "An animation prototype"], correct: "A low-fidelity layout sketch showing structure without visual design", difficulty: "easy", feedback_correct: "Wireframes are low-fidelity blueprints used early to validate concepts cheaply.", feedback_wrong: "Wireframes are simple sketches showing layout/structure without colors. Used early in design." },
    { question: "Explain the Gestalt principle of proximity and how you'd apply it in UI.", type: "short_answer", difficulty: "medium", feedback_correct: "Proximity groups related elements — like placing form labels directly above their inputs.", feedback_wrong: "Proximity: nearby elements are perceived as related. Group related controls (labels + inputs)." },
    { question: "What is the minimum touch target size recommended by accessibility guidelines?", type: "multiple_choice", options: ["24x24px", "44x44px", "16x16px", "100x100px"], correct: "44x44px", difficulty: "medium", feedback_correct: "44x44px per Apple HIG and WCAG — ensures accessible tapping.", feedback_wrong: "44x44px is the recommended minimum per Apple HIG and Google Material Design." },
    { question: "What is WCAG 2.1 AA contrast ratio for normal text?", type: "multiple_choice", options: ["2:1", "3:1", "4.5:1", "7:1"], correct: "4.5:1", difficulty: "hard", feedback_correct: "4.5:1 for normal text, 3:1 for large text per WCAG 2.1 AA.", feedback_wrong: "WCAG 2.1 AA requires 4.5:1 for normal text to ensure readability." },
  ],
  "English Writing": [
    { question: "What is the difference between active and passive voice?", type: "multiple_choice", options: ["Passive is always preferred", "Active voice is usually preferred for clarity and directness", "They are interchangeable", "Passive is only for academic writing"], correct: "Active voice is usually preferred for clarity and directness", difficulty: "easy", feedback_correct: "Active (Dog bites man) is clearer than passive (Man is bitten by dog).", feedback_wrong: "Active voice puts the subject performing the action. Generally clearer and more direct." },
    { question: "Fix: 'There is a lot of people who wants to learn English.' Explain the errors.", type: "scenario", difficulty: "medium", feedback_correct: "'There are' (people is plural) and 'want' (verb agrees with people, not 'who').", feedback_wrong: "'There is' → 'There are' (plural). 'wants' → 'want' (agrees with 'people')." },
    { question: "What is a thesis statement and where does it belong?", type: "short_answer", difficulty: "easy", feedback_correct: "A thesis states the main argument in 1-2 sentences, usually at the end of the introduction.", feedback_wrong: "A thesis is a concise sentence presenting your main argument, at the end of the introduction." },
    { question: "What is the difference between 'affect' and 'effect'?", type: "multiple_choice", options: ["Same meaning", "Affect is usually a verb, effect is usually a noun", "Effect is a verb, affect is a noun", "Both are nouns"], correct: "Affect is usually a verb, effect is usually a noun", difficulty: "medium", feedback_correct: "Affect = verb (to influence). Effect = noun (result). Trick: Affect=Action, Effect=End result.", feedback_wrong: "Affect is usually a verb (The rain affected my mood). Effect is usually a noun (The effect of rain)." },
    { question: "Explain what coherence and cohesion mean in writing.", type: "short_answer", difficulty: "hard", feedback_correct: "Coherence = logical flow of ideas. Cohesion = grammatical linking (transitions, pronouns).", feedback_wrong: "Coherence = logical organization. Cohesion = linguistic devices connecting sentences." },
  ],
  "Guitar": [
    { question: "What is the difference between a major and minor chord emotionally?", type: "multiple_choice", options: ["Major sounds sad, minor sounds happy", "Major sounds happy/bright, minor sounds sad/dark", "They sound identical", "Minor is louder"], correct: "Major sounds happy/bright, minor sounds sad/dark", difficulty: "easy", feedback_correct: "Major chords (major third) sound bright/happy. Minor (minor third) sound darker/sadder.", feedback_wrong: "Major = bright/happy (4 semitones). Minor = darker/sadder (3 semitones)." },
    { question: "What is a barre chord and why do beginners find it difficult?", type: "short_answer", difficulty: "medium", feedback_correct: "Barre uses one finger across all strings. Hard due to required finger strength and even pressure.", feedback_wrong: "A barre chord presses all strings with one finger. Requires strength and even pressure." },
    { question: "Student struggles switching G to C smoothly. What technique do you recommend?", type: "scenario", difficulty: "hard", feedback_correct: "Slow tempo, find pivot fingers, one-minute changes drill, visualize next chord.", feedback_wrong: "Slow down, find anchor fingers, practice one-minute changes drill, visualize next chord shape." },
    { question: "What does EADGBE represent in guitar?", type: "multiple_choice", options: ["A technique", "Standard tuning of six strings from low to high", "A chord progression", "A scale"], correct: "Standard tuning of six strings from low to high", difficulty: "easy", feedback_correct: "EADGBE is standard guitar tuning from thickest (lowest) to thinnest (highest).", feedback_wrong: "EADGBE is standard tuning: E-A-D-G-B-E from 6th (lowest) to 1st (highest) string." },
    { question: "What is a pentatonic scale and why is it popular for soloing?", type: "short_answer", difficulty: "medium", feedback_correct: "5-note scale avoiding dissonant intervals, making almost any note sound good over common chords.", feedback_wrong: "5 notes (no avoid notes that clash with chords), very forgiving and musical over most progressions." },
  ],
  "Photography": [
    { question: "What is the exposure triangle?", type: "multiple_choice", options: ["ISO, aperture, shutter speed", "Focus, zoom, flash", "White balance, contrast, saturation", "RAW, JPEG, HEIC"], correct: "ISO, aperture, shutter speed", difficulty: "easy", feedback_correct: "The three elements controlling exposure: ISO (sensor sensitivity), aperture (light opening), shutter speed (exposure duration).", feedback_wrong: "ISO, aperture, and shutter speed together make up the exposure triangle." },
    { question: "A photo is blurry in low light. What 3 settings do you adjust?", type: "scenario", difficulty: "medium", feedback_correct: "Widen aperture (lower f-number), raise ISO, slow shutter speed — balance for the scene.", feedback_wrong: "Open aperture (f/1.8), increase ISO, slow shutter speed (use tripod if needed)." },
    { question: "What is the rule of thirds?", type: "short_answer", difficulty: "easy", feedback_correct: "Divide frame 3x3, place subjects at intersections for more dynamic composition.", feedback_wrong: "Divide frame into 9 equal parts, place key elements at the 4 intersection points." },
    { question: "What does a shallow depth of field create?", type: "multiple_choice", options: ["Everything in focus", "Blurred background with sharp subject", "Wide angle view", "Increased shutter speed"], correct: "Blurred background with sharp subject", difficulty: "easy", feedback_correct: "Shallow DOF (low f-number like f/1.8) creates bokeh — blurred background for subject isolation.", feedback_wrong: "Shallow depth of field blurs the background while keeping the subject sharp (bokeh effect)." },
    { question: "Explain RAW vs JPEG and when you'd choose each.", type: "short_answer", difficulty: "medium", feedback_correct: "RAW = unprocessed, more editing latitude, larger files. JPEG = processed, smaller, less editable. Shoot RAW for editing flexibility.", feedback_wrong: "RAW preserves all data for maximum editing control. JPEG is processed in-camera, smaller, convenient for sharing without editing." },
  ],
  "Video Editing": [
    { question: "What is the difference between a cut and a dissolve transition?", type: "multiple_choice", options: ["Same thing", "A cut is instant, a dissolve gradually blends clips", "A dissolve is only for audio", "Cuts are only for action films"], correct: "A cut is instant, a dissolve gradually blends clips", difficulty: "easy", feedback_correct: "Cut = instant change. Dissolve = gradual blend, often suggesting passage of time.", feedback_wrong: "A cut is instantaneous. A dissolve fades one clip out while fading the next in." },
    { question: "Client says their video looks 'flat and boring.' What color grading do you do first?", type: "scenario", difficulty: "hard", feedback_correct: "Exposure, S-curve for contrast, saturation/LUT, white balance correction.", feedback_wrong: "Exposure → contrast S-curve → saturation/LUT → white balance → highlights/shadows." },
    { question: "What is the 180-degree rule?", type: "short_answer", difficulty: "medium", feedback_correct: "Camera stays on one side of the imaginary axis between subjects to maintain consistent screen direction.", feedback_wrong: "Two subjects always have same left/right relationship. Camera must stay on one side of the axis." },
    { question: "What does FPS (frames per second) affect?", type: "multiple_choice", options: ["File size only", "Smoothness of motion", "Audio quality", "Video resolution"], correct: "Smoothness of motion", difficulty: "easy", feedback_correct: "24fps = cinematic, 60fps = smooth/realistic, 120fps+ = slow motion.", feedback_wrong: "FPS controls motion smoothness. 24=cinematic, 30=standard, 60=smooth, 120+=slow motion." },
    { question: "Explain H.264 vs ProRes and when you'd use each.", type: "short_answer", difficulty: "hard", feedback_correct: "H.264 = compressed for delivery (YouTube). ProRes = high quality for editing/archival.", feedback_wrong: "H.264 = small files for sharing. ProRes = large high-quality files for editing clients." },
  ],
};

const DEFAULT_QUESTIONS: Question[] = [
  { question: "How long have you been practicing this skill and how did you learn it?", type: "short_answer", difficulty: "easy", feedback_correct: "Good background! Practical experience is valid evidence of skill.", feedback_wrong: "Share your learning journey — it establishes your experience level." },
  { question: "Describe a project where you applied this skill professionally or seriously.", type: "scenario", difficulty: "medium", feedback_correct: "Real-world application demonstrates practical competence beyond theory.", feedback_wrong: "Real-world application is the strongest evidence of competence." },
  { question: "What are the most common mistakes beginners make and how would you help them avoid these?", type: "short_answer", difficulty: "medium", feedback_correct: "Understanding common mistakes shows mastery and teaching ability.", feedback_wrong: "Knowing where students struggle shows meta-awareness of the skill." },
  { question: "How do you stay up to date with new developments in this area?", type: "short_answer", difficulty: "easy", feedback_correct: "Continuous learning is essential for any skill teacher.", feedback_wrong: "Keeping current through communities, courses, and practice is key." },
  { question: "If a student was frustrated and stuck, what approach would you take to help them?", type: "scenario", difficulty: "hard", feedback_correct: "Breaking concepts down, using analogies, adjusting explanations are hallmarks of great teachers.", feedback_wrong: "Adapt explanations, use different analogies, break concepts smaller, stay supportive." },
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
  return shuffle(bank).slice(0, 5);
}

function evaluateAnswer(q: Question, userAnswer: string): { score: number; correct: boolean; feedback: string } {
  if (q.type === "multiple_choice" && q.correct) {
    const correct = userAnswer === q.correct;
    return { score: correct ? 10 : 2, correct, feedback: correct ? q.feedback_correct : q.feedback_wrong };
  }
  const len = userAnswer.trim().length;
  const score = len > 200 ? Math.floor(Math.random() * 3) + 7 : len > 100 ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 3) + 2;
  const correct = score >= 6;
  return { score, correct, feedback: correct ? q.feedback_correct : q.feedback_wrong };
}

type Stage = "select" | "generating" | "quiz" | "results";

export default function VerifyPage() {
  const [skills, setSkills]             = useState<Skill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [profile, setProfile]           = useState<{ id: string; credits: number } | null>(null);
  const [stage, setStage]               = useState<Stage>("select");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [currentQ, setCurrentQ]         = useState(0);
  const [answers, setAnswers]           = useState<{ question: Question; userAnswer: string; evaluation: ReturnType<typeof evaluateAnswer> }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults]           = useState<{ passed: boolean; totalScore: number } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase.from("profiles").select("id, credits").eq("id", user.id).single();
      setProfile(prof);

      const { data: skillsData } = await supabase.from("skills").select("*").order("category");
      if (skillsData) setSkills(skillsData);

      // FIXED: use is_verified column
      const { data: userSkills } = await supabase.from("user_skills").select("skill_id").eq("user_id", user.id).eq("is_verified", true);
      if (userSkills) setVerifiedSkills(userSkills.map((s: { skill_id: string }) => s.skill_id));
    };
    init();
  }, []);

  const grouped = skills.reduce((acc, skill) => {
    if (!acc[skill.category]) acc[skill.category] = [];
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  const startQuiz = (skill: Skill) => {
    setSelectedSkill(skill);
    setStage("generating");
    setAnswers([]);
    setCurrentQ(0);
    setCurrentAnswer("");
    setSelectedOption("");
    setTimeout(() => {
      setQuestions(getQuestions(skill.name));
      setStage("quiz");
    }, 1500);
  };

  const submitAnswer = () => {
    const q = questions[currentQ];
    const answer = q.type === "multiple_choice" ? selectedOption : currentAnswer;
    if (!answer.trim()) return;
    const evaluation = evaluateAnswer(q, answer);
    const newAnswers = [...answers, { question: q, userAnswer: answer, evaluation }];
    setAnswers(newAnswers);
    setCurrentAnswer("");
    setSelectedOption("");

    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      const totalScore = Math.round(newAnswers.reduce((sum, a) => sum + a.evaluation.score, 0) / newAnswers.length * 10);
      const passed = totalScore >= 70;
      setResults({ passed, totalScore });

      if (passed && profile && selectedSkill) {
        // FIXED: use is_verified column name
        supabase.from("user_skills").upsert(
          { user_id: profile.id, skill_id: selectedSkill.id, type: "teach", is_verified: true, verified_at: new Date().toISOString() },
          { onConflict: "user_id,skill_id" }
        );
        setVerifiedSkills(v => [...v, selectedSkill.id]);
        try { supabase.rpc("increment_xp", { user_id: profile.id, amount: 25 }); } catch {}
      }
      setStage("results");
    }
  };

  const reset = () => {
    setStage("select"); setSelectedSkill(null); setQuestions([]);
    setAnswers([]); setCurrentQ(0); setCurrentAnswer("");
    setSelectedOption(""); setResults(null);
  };

  const q = questions[currentQ];

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-up { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-6 h-14 flex items-center justify-between shadow-sm">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-1">
          {[["Browse","/listings"],["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              💰 {profile.credits} cr
            </span>
          )}
          <a href="/profile" className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors no-underline">
            👤 My Profile
          </a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-10">

        {/* ── SELECT SKILL ── */}
        {stage === "select" && (
          <div className="fade-up">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full mb-4">
                <span className="text-xs font-black text-emerald-700">✨ Smart Verification System</span>
              </div>
              <h1 className="font-fraunces text-4xl font-black text-stone-900 mb-3">Skill Verification</h1>
              <p className="text-base text-stone-500 leading-relaxed max-w-lg">
                Answer 5 questions from our expert question bank. Score 70%+ to earn your
                <strong className="text-emerald-700"> ✅ Verified badge</strong> — shown on your profile and listings.
              </p>
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { icon: "🎲", title: "Random Each Time", desc: "Questions shuffled — no memorizing" },
                { icon: "✍️", title: "MCQ + Open Answer", desc: "Mix of multiple choice and written" },
                { icon: "🏅", title: "Instant Badge", desc: "Pass and badge appears immediately" },
              ].map(item => (
                <div key={item.title} className="bg-white rounded-2xl p-4 border border-stone-200 hover:shadow-sm transition-shadow">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="text-sm font-bold text-stone-800 mb-1">{item.title}</p>
                  <p className="text-xs text-stone-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Skill list */}
            {Object.entries(grouped).map(([category, catSkills]) => (
              <div key={category} className="mb-7">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{CATEGORY_ICONS[category] || "📖"}</span>
                  <span className="text-xs font-black text-stone-400 uppercase tracking-widest">{category}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {catSkills.map(skill => {
                    const isVerified = verifiedSkills.includes(skill.id);
                    const tw = CATEGORY_TW[skill.category] || "bg-stone-50 text-stone-600";
                    return (
                      <div key={skill.id}
                        onClick={() => !isVerified && startQuiz(skill)}
                        className={`rounded-2xl p-4 border transition-all duration-150 ${
                          isVerified
                            ? "bg-emerald-50 border-emerald-200 cursor-default"
                            : "bg-white border-stone-200 cursor-pointer hover:-translate-y-1 hover:shadow-md"
                        }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tw}`}>{skill.category}</span>
                          {isVerified && <span className="text-lg">✅</span>}
                        </div>
                        <p className="font-fraunces text-sm font-black text-stone-900 mb-1">{skill.name}</p>
                        <p className={`text-xs font-semibold ${isVerified ? "text-emerald-600" : "text-stone-400"}`}>
                          {isVerified ? "Verified ✓" : "Click to start →"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── GENERATING ── */}
        {stage === "generating" && (
          <div className="fade-up text-center py-24">
            <div className="text-6xl mb-5" style={{ animation: "pulse 1s infinite" }}>✨</div>
            <h2 className="font-fraunces text-2xl font-black text-stone-900 mb-2">Preparing your quiz...</h2>
            <p className="text-sm text-stone-400 mb-8">Selecting 5 questions for <strong>{selectedSkill?.name}</strong></p>
            <div className="flex gap-2 justify-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-emerald-600" style={{ animation: `pulse 1s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {stage === "quiz" && q && (
          <div className="fade-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={reset} className="text-stone-400 text-sm hover:text-stone-600 transition-colors border-0 bg-transparent cursor-pointer font-medium">← Back</button>
                <span className="font-fraunces text-lg font-black text-stone-900">{selectedSkill?.name}</span>
              </div>
              <span className="text-sm font-bold text-stone-400">Q{currentQ + 1} of {questions.length}</span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-stone-200 rounded-full mb-6 overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
            </div>

            {/* Question card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-7 mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  q.difficulty === "hard" ? "bg-red-50 text-red-700" :
                  q.difficulty === "medium" ? "bg-amber-50 text-amber-700" :
                  "bg-emerald-50 text-emerald-700"
                }`}>{q.difficulty}</span>
                <span className="text-[10px] font-bold text-stone-300 uppercase tracking-wide">
                  {q.type === "multiple_choice" ? "Multiple Choice" : q.type === "scenario" ? "Scenario" : "Short Answer"}
                </span>
              </div>

              <h3 className="font-fraunces text-xl font-black text-stone-900 leading-snug mb-6">{q.question}</h3>

              {q.type === "multiple_choice" && q.options && (
                <div className="flex flex-col gap-2.5">
                  {q.options.map((opt, i) => (
                    <button key={i} onClick={() => setSelectedOption(opt)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 flex items-center gap-3 cursor-pointer font-sans ${
                        selectedOption === opt
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white"
                      }`}>
                      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        selectedOption === opt ? "border-emerald-500 bg-emerald-500 text-white" : "border-stone-300 text-stone-400"
                      }`}>{["A","B","C","D"][i]}</span>
                      <span className="text-sm font-semibold">{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {q.type !== "multiple_choice" && (
                <div>
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">
                    {q.type === "scenario" ? "How would you approach this?" : "Your answer:"}
                  </label>
                  <textarea value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
                    placeholder="Write a detailed answer (the more detail, the better your score)..."
                    rows={5}
                    className="w-full p-4 rounded-xl border-2 border-stone-200 text-sm leading-relaxed bg-stone-50 text-stone-800 resize-none focus:outline-none focus:border-emerald-400 transition-colors font-sans" />
                  <p className={`text-xs mt-2 font-semibold ${currentAnswer.length > 150 ? "text-emerald-600" : "text-stone-400"}`}>
                    {currentAnswer.length} chars — {currentAnswer.length < 50 ? "be more detailed" : currentAnswer.length < 150 ? "good, add more" : "excellent detail ✓"}
                  </p>
                </div>
              )}
            </div>

            <button onClick={submitAnswer}
              disabled={q.type === "multiple_choice" ? !selectedOption : currentAnswer.trim().length < 10}
              className={`w-full py-4 rounded-xl text-base font-black border-0 cursor-pointer transition-all font-sans ${
                (q.type === "multiple_choice" ? !selectedOption : currentAnswer.trim().length < 10)
                  ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md"
              }`}>
              {currentQ + 1 === questions.length ? "Submit & See Results →" : "Next Question →"}
            </button>
          </div>
        )}

        {/* ── RESULTS ── */}
        {stage === "results" && results && (
          <div className="fade-up">
            {/* Result banner */}
            <div className={`rounded-3xl p-10 text-center mb-5 ${
              results.passed
                ? "bg-gradient-to-br from-emerald-800 to-emerald-600"
                : "bg-gradient-to-br from-stone-800 to-stone-600"
            }`}>
              <div className="text-6xl mb-4">{results.passed ? "🎉" : "😔"}</div>
              <h2 className="font-fraunces text-3xl font-black text-white mb-2">
                {results.passed ? `You're Verified in ${selectedSkill?.name}!` : "Not quite — try again!"}
              </h2>
              <p className="text-white/70 text-sm mb-6">
                {results.passed ? "✅ Verified badge added to your profile and listings!" : `You scored ${results.totalScore}%. You need 70% to pass.`}
              </p>
              <div className="inline-flex gap-6 bg-white/10 rounded-2xl px-8 py-4">
                <div>
                  <p className="font-fraunces text-4xl font-black text-white">{results.totalScore}%</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">Score</p>
                </div>
                <div className="w-px bg-white/20" />
                <div>
                  <p className="font-fraunces text-4xl font-black text-white">{answers.filter(a => a.evaluation.correct).length}/{answers.length}</p>
                  <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">Correct</p>
                </div>
                {results.passed && (
                  <>
                    <div className="w-px bg-white/20" />
                    <div>
                      <p className="font-fraunces text-4xl font-black text-emerald-300">+25</p>
                      <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">XP</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Breakdown */}
            <div className="mb-5">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3">Question Breakdown</p>
              <div className="flex flex-col gap-3">
                {answers.map((a, i) => (
                  <div key={i} className={`bg-white rounded-2xl p-5 border-2 ${a.evaluation.correct ? "border-emerald-200" : "border-red-200"}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 mr-4">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Q{i+1} · {a.question.difficulty}</span>
                        <p className="text-sm font-bold text-stone-900 mt-1 leading-snug">{a.question.question}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-fraunces text-2xl font-black ${a.evaluation.correct ? "text-emerald-600" : "text-red-500"}`}>{a.evaluation.score}/10</p>
                        <span className="text-xl">{a.evaluation.correct ? "✅" : "❌"}</span>
                      </div>
                    </div>
                    <div className="bg-stone-50 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Your Answer</p>
                      <p className="text-sm text-stone-600 leading-relaxed">{a.userAnswer}</p>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">💡 {a.evaluation.feedback}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {results.passed ? (
                <>
                  <a href="/listings/create" className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-black text-center no-underline hover:bg-emerald-700 transition-colors">
                    Create a Listing →
                  </a>
                  <button onClick={reset} className="flex-1 py-3.5 rounded-xl bg-stone-100 text-stone-600 text-sm font-bold border-0 cursor-pointer hover:bg-stone-200 transition-colors">
                    Verify Another Skill
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => startQuiz(selectedSkill!)} className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-black border-0 cursor-pointer hover:bg-emerald-700 transition-colors">
                    🔄 Try Again (New Questions)
                  </button>
                  <button onClick={reset} className="flex-1 py-3.5 rounded-xl bg-stone-100 text-stone-600 text-sm font-bold border-0 cursor-pointer hover:bg-stone-200 transition-colors">
                    Choose Different Skill
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}