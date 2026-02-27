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
  Academic: "📚", Music: "🎵", Arts: "🎭", Media: "🎬",
};
const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Programming: { bg: "#dbeafe", color: "#1d4ed8" },
  Design:      { bg: "#fce7f3", color: "#be185d" },
  Language:    { bg: "#dcfce7", color: "#166534" },
  Academic:    { bg: "#ede9fe", color: "#7c3aed" },
  Music:       { bg: "#fef3c7", color: "#b45309" },
  Arts:        { bg: "#fee2e2", color: "#991b1b" },
  Media:       { bg: "#e0f2fe", color: "#0369a1" },
};

// Large question bank per skill — 5 random pulled each attempt
const QUESTION_BANK: Record<string, Question[]> = {
  "Python": [
    { question: "What is the difference between a list and a tuple in Python?", type: "multiple_choice", options: ["Lists are ordered, tuples are not", "Lists are mutable, tuples are immutable", "Tuples can hold more data types", "Lists are faster than tuples"], correct: "Lists are mutable, tuples are immutable", difficulty: "easy", feedback_correct: "Correct! Lists can be modified after creation while tuples cannot. This immutability makes tuples useful as dictionary keys.", feedback_wrong: "Not quite. The key difference is mutability — lists can be changed, tuples cannot. This is fundamental to Python data structures." },
    { question: "What does the `*args` syntax do in a Python function definition?", type: "multiple_choice", options: ["Multiplies all arguments together", "Allows passing any number of positional arguments", "Creates a pointer to arguments", "Declares arguments as optional"], correct: "Allows passing any number of positional arguments", difficulty: "medium", feedback_correct: "Exactly right! *args collects extra positional arguments into a tuple, allowing flexible function signatures.", feedback_wrong: "The *args syntax packs extra positional arguments into a tuple inside the function. It's used for variadic functions." },
    { question: "Explain what a Python decorator is and give a real-world use case.", type: "short_answer", difficulty: "hard", feedback_correct: "Great explanation! Decorators wrap functions to extend behavior — common uses include logging, authentication, caching, and timing.", feedback_wrong: "A decorator is a function that takes another function and extends its behavior without modifying it. Think @login_required in Django or @cache for memoization." },
    { question: "What is the output of: `print(type([]) == type(()))`?", type: "multiple_choice", options: ["True", "False", "Error", "None"], correct: "False", difficulty: "easy", feedback_correct: "Correct! A list [] and tuple () are different types — list vs tuple — so the comparison returns False.", feedback_wrong: "[] is a list and () is a tuple — they are different types, so type([]) == type(()) evaluates to False." },
    { question: "What is a Python generator and how does it differ from a regular function?", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! Generators use yield instead of return, producing values lazily one at a time, which is memory-efficient for large datasets.", feedback_wrong: "A generator uses the yield keyword to return values one at a time without storing the whole sequence in memory. Unlike regular functions, they maintain state between calls." },
    { question: "You have a list of 1 million numbers and need to find all even ones. Which approach is more memory-efficient?", type: "multiple_choice", options: ["[x for x in nums if x%2==0]", "(x for x in nums if x%2==0)", "filter(lambda x: x%2==0, nums)", "Both B and C"], correct: "Both B and C", difficulty: "hard", feedback_correct: "Correct! Generator expressions and filter() are both lazy — they produce values one at a time rather than building a full list in memory.", feedback_wrong: "Generator expressions (parentheses) and filter() both produce lazy iterators, making them memory-efficient for large datasets. List comprehensions build the full list." },
    { question: "What does `__init__` do in a Python class?", type: "multiple_choice", options: ["Destroys the object", "Initializes instance attributes when an object is created", "Imports modules", "Defines class-level variables only"], correct: "Initializes instance attributes when an object is created", difficulty: "easy", feedback_correct: "Correct! __init__ is the constructor method called automatically when creating a new object instance.", feedback_wrong: "__init__ is Python's constructor. It runs automatically when you create an instance and is used to set up initial state." },
    { question: "Describe a scenario where you'd use a dictionary over a list in Python.", type: "scenario", difficulty: "medium", feedback_correct: "Good reasoning! Dictionaries excel when you need fast key-based lookup — O(1) vs O(n) for lists. Perfect for caches, counters, and mappings.", feedback_wrong: "Use a dictionary when you need to associate values with keys for fast lookup — e.g., storing user data by ID, word counts, or configuration settings." },
    { question: "What is the GIL in Python and why does it matter for multithreading?", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! The GIL (Global Interpreter Lock) prevents true parallel execution of Python threads, making multiprocessing better for CPU-bound tasks.", feedback_wrong: "The GIL is a mutex that prevents multiple threads from executing Python bytecode simultaneously. For CPU-bound tasks, use multiprocessing instead of threading." },
    { question: "What is list slicing? What does `my_list[2:5]` return?", type: "multiple_choice", options: ["Elements at index 2 and 5", "Elements from index 2 up to but not including 5", "Elements from index 2 to 5 inclusive", "The last 5 elements"], correct: "Elements from index 2 up to but not including 5", difficulty: "easy", feedback_correct: "Correct! Python slicing is [start:stop] where stop is exclusive. [2:5] returns elements at indices 2, 3, and 4.", feedback_wrong: "Python slicing [2:5] returns elements at indices 2, 3, 4 — the stop index is exclusive, not inclusive." },
  ],
  "React": [
    { question: "What is the difference between `useState` and `useRef` in React?", type: "multiple_choice", options: ["useState is for strings, useRef is for numbers", "useState triggers re-renders, useRef does not", "useRef is deprecated in React 18", "They are identical"], correct: "useState triggers re-renders, useRef does not", difficulty: "medium", feedback_correct: "Correct! Updating useState causes a re-render while useRef persists a value without triggering one. Great for DOM refs and timers.", feedback_wrong: "The key difference: useState triggers component re-renders when updated, useRef does not. useRef is useful for persisting values across renders without re-rendering." },
    { question: "What problem does `useCallback` solve in React?", type: "short_answer", difficulty: "hard", feedback_correct: "Well explained! useCallback memoizes functions to prevent unnecessary re-creation on every render, especially useful when passing callbacks to optimized child components.", feedback_wrong: "useCallback memoizes a function so it's not recreated on every render. This prevents unnecessary re-renders of child components that receive the callback as a prop." },
    { question: "What is the React virtual DOM and why does it exist?", type: "multiple_choice", options: ["A simplified HTML structure", "A JavaScript representation of the real DOM for efficient updates", "A browser-specific API", "A way to avoid using HTML"], correct: "A JavaScript representation of the real DOM for efficient updates", difficulty: "easy", feedback_correct: "Correct! The virtual DOM is an in-memory representation that React uses to calculate minimal DOM updates, making UI changes efficient.", feedback_wrong: "The virtual DOM is a lightweight JavaScript copy of the real DOM. React compares old and new virtual DOMs (diffing) to make minimal, efficient updates." },
    { question: "Your React component re-renders too often causing performance issues. What are 3 strategies you'd use to optimize it?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent answer! React.memo, useMemo, useCallback, lazy loading, and avoiding inline objects/functions in JSX are all valid optimization strategies.", feedback_wrong: "Key strategies: React.memo to prevent re-renders when props haven't changed, useMemo for expensive calculations, useCallback for stable function references, and code splitting with lazy()." },
    { question: "What is prop drilling and how does Context API solve it?", type: "short_answer", difficulty: "medium", feedback_correct: "Great explanation! Context API creates a provider that makes values available to any descendant component without manually passing props through every level.", feedback_wrong: "Prop drilling is passing props through multiple component layers just to reach a deeply nested component. Context API creates a global-like store accessible by any component in the tree." },
    { question: "What does the dependency array in `useEffect` control?", type: "multiple_choice", options: ["The order of effects", "When the effect runs based on value changes", "Which components can use the effect", "The effect's return type"], correct: "When the effect runs based on value changes", difficulty: "medium", feedback_correct: "Correct! The dependency array tells React when to re-run the effect. Empty array = once on mount, no array = every render, with values = when those values change.", feedback_wrong: "The dependency array controls when useEffect re-runs. [] runs once on mount, [value] runs when value changes, and omitting it runs after every render." },
    { question: "What is the difference between controlled and uncontrolled components in React?", type: "multiple_choice", options: ["Controlled components use class syntax", "Controlled components have their state managed by React, uncontrolled use the DOM", "Uncontrolled components are deprecated", "There is no practical difference"], correct: "Controlled components have their state managed by React, uncontrolled use the DOM", difficulty: "medium", feedback_correct: "Exactly! Controlled components use useState to manage form values through React, while uncontrolled components let the DOM manage state accessed via refs.", feedback_wrong: "Controlled components bind form values to React state (onChange + value props). Uncontrolled components let the DOM handle state, accessed via useRef." },
    { question: "Explain React's reconciliation algorithm in simple terms.", type: "short_answer", difficulty: "hard", feedback_correct: "Good explanation! React's diffing algorithm compares virtual DOM trees level by level, using keys to efficiently identify which elements changed, were added, or removed.", feedback_wrong: "Reconciliation is React's process of comparing the old and new virtual DOM trees to determine the minimum number of real DOM operations needed to update the UI." },
  ],
  "UI/UX Design": [
    { question: "What is the difference between UX and UI design?", type: "multiple_choice", options: ["They are the same thing", "UX focuses on user experience and flow, UI focuses on visual elements", "UI is for mobile, UX is for web", "UX is done after UI"], correct: "UX focuses on user experience and flow, UI focuses on visual elements", difficulty: "easy", feedback_correct: "Correct! UX (User Experience) is about how something works and feels — flows, wireframes, research. UI (User Interface) is about how it looks — colors, typography, components.", feedback_wrong: "UX design focuses on the overall experience — user research, wireframes, information architecture. UI design focuses on the visual layer — colors, fonts, icons, and components." },
    { question: "A user complains they can't find the checkout button on your e-commerce app. What UX process would you follow to fix this?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent process! User testing, heatmaps, A/B testing, and applying visual hierarchy principles (size, color, contrast, whitespace) are all correct approaches.", feedback_wrong: "The correct process: user interviews to understand the problem, heatmap analysis to see where users look, A/B testing different button placements, and applying visual hierarchy to make the CTA more prominent." },
    { question: "What is a wireframe and when would you use one?", type: "multiple_choice", options: ["A high-fidelity mockup", "A low-fidelity layout sketch showing structure without visual design", "A finished design ready for development", "An animation prototype"], correct: "A low-fidelity layout sketch showing structure without visual design", difficulty: "easy", feedback_correct: "Correct! Wireframes are low-fidelity blueprints used early in the design process to establish layout and flow before adding visual design.", feedback_wrong: "Wireframes are simple, low-fidelity sketches that show the layout and structure of a screen without colors or detailed visuals. Used early in design to validate concepts cheaply." },
    { question: "Explain the Gestalt principle of proximity and how you'd apply it in a UI.", type: "short_answer", difficulty: "medium", feedback_correct: "Great answer! Proximity groups related elements together — like placing form labels directly above their inputs, or grouping navigation items together to show they're related.", feedback_wrong: "Proximity is a Gestalt principle stating that elements near each other are perceived as related. In UI, group related controls together (e.g., keep form fields with their labels close, separate unrelated sections with whitespace)." },
    { question: "What is the minimum touch target size recommended by accessibility guidelines?", type: "multiple_choice", options: ["24x24px", "44x44px", "16x16px", "100x100px"], correct: "44x44px", difficulty: "medium", feedback_correct: "Correct! Apple's HIG and WCAG both recommend minimum 44x44pt touch targets to prevent accidental taps and ensure accessibility.", feedback_wrong: "44x44px is the recommended minimum touch target size per Apple HIG and Google Material Design guidelines, ensuring buttons are easily tappable for all users including those with motor impairments." },
    { question: "What is a design system and why do companies like Airbnb and Google invest heavily in them?", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! Design systems (like Material Design or Tailwind) create consistency, speed up development, improve accessibility, and ensure brand cohesion across products.", feedback_wrong: "A design system is a collection of reusable components, guidelines, and standards. Companies invest in them for consistency across products, faster design-dev handoff, and easier scaling." },
    { question: "What does WCAG 2.1 AA contrast ratio require for normal text?", type: "multiple_choice", options: ["2:1", "3:1", "4.5:1", "7:1"], correct: "4.5:1", difficulty: "hard", feedback_correct: "Correct! WCAG 2.1 AA requires a minimum 4.5:1 contrast ratio for normal text and 3:1 for large text to ensure readability for users with visual impairments.", feedback_wrong: "WCAG 2.1 AA requires 4.5:1 contrast ratio for normal text. This ensures content is readable for users with low vision. AAA (enhanced) requires 7:1." },
    { question: "Describe the double diamond design process and its four phases.", type: "short_answer", difficulty: "hard", feedback_correct: "Great answer! Discover (research), Define (problem statement), Develop (ideation/prototyping), Deliver (testing/implementation) — the process diverges then converges twice.", feedback_wrong: "The double diamond has 4 phases: Discover (user research, explore the problem), Define (synthesize insights into a clear problem statement), Develop (ideate and prototype solutions), Deliver (test and refine)." },
  ],
  "Math Tutoring": [
    { question: "What is the derivative of f(x) = x³ + 2x² - 5x + 3?", type: "multiple_choice", options: ["3x² + 4x - 5", "x² + 4x - 5", "3x² + 2x - 5", "3x³ + 4x"], correct: "3x² + 4x - 5", difficulty: "medium", feedback_correct: "Correct! Using the power rule: d/dx(x³) = 3x², d/dx(2x²) = 4x, d/dx(-5x) = -5, d/dx(3) = 0.", feedback_wrong: "Apply the power rule: bring down the exponent and reduce it by 1. So x³→3x², 2x²→4x, -5x→-5, 3→0. Result: 3x² + 4x - 5." },
    { question: "A student is struggling with the concept of limits. How would you explain what lim(x→2) of (x²-4)/(x-2) equals?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent approach! Factor numerator as (x+2)(x-2), cancel (x-2), and the limit equals x+2 as x→2, which is 4. Explaining why direct substitution fails first is key.", feedback_wrong: "Factor the numerator: (x²-4) = (x+2)(x-2). Cancel (x-2) to get (x+2). As x approaches 2, the limit is 2+2 = 4. The key insight: the function is undefined AT x=2 but the limit still exists." },
    { question: "What is the quadratic formula and when do you use it?", type: "short_answer", difficulty: "easy", feedback_correct: "Correct! x = (-b ± √(b²-4ac)) / 2a is used to solve ax² + bx + c = 0 when factoring isn't obvious. The discriminant b²-4ac tells you the nature of roots.", feedback_wrong: "The quadratic formula is x = (-b ± √(b²-4ac)) / 2a. Use it to solve quadratic equations ax² + bx + c = 0 when the expression doesn't factor easily." },
    { question: "If a triangle has sides 3, 4, and 5, what type of triangle is it and why?", type: "multiple_choice", options: ["Acute triangle", "Right triangle", "Obtuse triangle", "Equilateral triangle"], correct: "Right triangle", difficulty: "easy", feedback_correct: "Correct! 3² + 4² = 9 + 16 = 25 = 5². It satisfies the Pythagorean theorem, making it a right triangle — actually the most famous Pythagorean triple!", feedback_wrong: "Check using Pythagorean theorem: 3² + 4² = 9 + 16 = 25 = 5². Since a² + b² = c², this is a right triangle. The 3-4-5 is the most well-known Pythagorean triple." },
    { question: "Explain integration by parts and give an example of when you'd use it.", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! ∫u dv = uv - ∫v du. Classic use case: ∫x·eˣdx where u=x, dv=eˣdx, giving xeˣ - eˣ + C. Remember LIATE for choosing u.", feedback_wrong: "Integration by parts: ∫u dv = uv - ∫v du. Use it when integrating products of functions like x·sin(x) or x·eˣ. The LIATE rule (Logarithmic, Inverse trig, Algebraic, Trig, Exponential) helps choose u." },
    { question: "What is the probability of rolling a sum of 7 with two dice?", type: "multiple_choice", options: ["1/6", "6/36", "7/36", "1/7"], correct: "6/36", difficulty: "medium", feedback_correct: "Correct! There are 36 possible outcomes. Combinations that sum to 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) — that's 6 outcomes. So P = 6/36 = 1/6.", feedback_wrong: "Total outcomes = 6×6 = 36. Ways to get 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 ways. Probability = 6/36 = 1/6. Note: 6/36 and 1/6 are equal." },
  ],
  "English Writing": [
    { question: "What is the difference between active and passive voice? Which should you prefer in most writing?", type: "multiple_choice", options: ["Passive voice is always preferred", "Active voice is usually preferred for clarity and directness", "They are interchangeable with no difference", "Passive voice is only for academic writing"], correct: "Active voice is usually preferred for clarity and directness", difficulty: "easy", feedback_correct: "Correct! Active voice (The dog bit the man) is clearer and more direct than passive (The man was bitten by the dog). Use passive when the actor is unknown or unimportant.", feedback_wrong: "Active voice puts the subject performing the action (Dog bites man). Passive voice puts the receiver first (Man is bitten). Active is preferred for clarity — passive has its uses when the actor is unknown." },
    { question: "A student writes: 'There is a lot of people who wants to learn English.' Fix this sentence and explain the errors.", type: "scenario", difficulty: "medium", feedback_correct: "Well done! Two errors: 'There is' should be 'There are' (plural agreement with 'people'), and 'wants' should be 'want' (verb agrees with 'people', not 'who').", feedback_wrong: "Two errors: 1) 'There is' → 'There are' because 'people' is plural. 2) 'wants' → 'want' because the verb must agree with 'people'. Correct: 'There are a lot of people who want to learn English.'" },
    { question: "What is a thesis statement and where does it belong in an essay?", type: "short_answer", difficulty: "easy", feedback_correct: "Correct! A thesis states the main argument of your essay in one or two sentences and typically appears at the end of the introduction paragraph.", feedback_wrong: "A thesis statement is a concise sentence that presents the main argument or claim of your essay. It usually appears at the end of the introduction and guides the entire paper." },
    { question: "What is the difference between 'affect' and 'effect'?", type: "multiple_choice", options: ["They mean the same thing", "Affect is usually a verb, effect is usually a noun", "Effect is a verb, affect is a noun", "Both can only be nouns"], correct: "Affect is usually a verb, effect is usually a noun", difficulty: "medium", feedback_correct: "Correct! 'Affect' is typically a verb (The rain affected my mood). 'Effect' is typically a noun (The effect of rain). Remember: Affect=Action, Effect=End result.", feedback_wrong: "Affect is usually a verb meaning to influence (Heat affects ice cream). Effect is usually a noun meaning result (The effect of heat on ice cream). Memory trick: Affect=Action, Effect=End result." },
    { question: "Explain what coherence and cohesion mean in writing and why they matter.", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! Coherence is the logical flow of ideas (the reader follows your argument). Cohesion is the grammatical and lexical linking (transition words, pronouns, repetition).", feedback_wrong: "Coherence = logical organization of ideas so readers can follow your argument. Cohesion = linguistic devices that connect sentences (transition words like however, furthermore, pronouns, synonyms)." },
    { question: "Which sentence uses a comma correctly?", type: "multiple_choice", options: ["I went to the store, and I bought milk.", "I went to the store and, I bought milk.", "I, went to the store and I bought milk.", "I went to the store and I, bought milk."], correct: "I went to the store, and I bought milk.", difficulty: "medium", feedback_correct: "Correct! A comma before a coordinating conjunction (and, but, or) is correct when joining two independent clauses. Both 'I went to the store' and 'I bought milk' are complete sentences.", feedback_wrong: "When joining two independent clauses with a coordinating conjunction (FANBOYS: for, and, nor, but, or, yet, so), place the comma before the conjunction." },
  ],
  "Guitar": [
    { question: "What is the difference between a major and minor chord in terms of their emotional quality?", type: "multiple_choice", options: ["Major sounds sad, minor sounds happy", "Major sounds happy/bright, minor sounds sad/dark", "They sound identical", "Minor is louder than major"], correct: "Major sounds happy/bright, minor sounds sad/dark", difficulty: "easy", feedback_correct: "Correct! Major chords (major third interval) generally sound bright, happy, and resolved. Minor chords (minor third) sound darker, sadder, or more tense.", feedback_wrong: "Major chords use a major third (4 semitones) and sound bright/happy. Minor chords use a minor third (3 semitones) and sound darker/sadder. This emotional difference comes from the interval between the root and third." },
    { question: "What is a barre chord and why do beginners find it difficult?", type: "short_answer", difficulty: "medium", feedback_correct: "Good answer! A barre chord uses one finger to press all strings across a fret, essentially replacing the nut. It's difficult due to the finger strength and even pressure required.", feedback_wrong: "A barre chord involves using one finger (usually the index) to press down all or multiple strings across a single fret. Beginners struggle because it requires significant finger strength and even pressure to avoid muted strings." },
    { question: "A student can play chords individually but struggles to switch between G and C smoothly. What practice technique would you recommend?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent! The 'one minute changes' drill (count transitions in 60 seconds), finding the pivot finger, and practicing the movement slowly then building speed are all correct approaches.", feedback_wrong: "Recommend: 1) Slow down to a tempo where transitions are clean, 2) Find 'anchor' or pivot fingers that don't need to move, 3) Practice the 'one minute changes' drill, 4) Visualize the next chord shape before moving." },
    { question: "What does EADGBE represent in guitar?", type: "multiple_choice", options: ["A guitar technique", "The standard tuning of the six strings from low to high", "A chord progression", "A music theory scale"], correct: "The standard tuning of the six strings from low to high", difficulty: "easy", feedback_correct: "Correct! EADGBE is standard guitar tuning from the thickest (lowest pitched) string to the thinnest (highest). Many mnemonics exist: Eddie Ate Dynamite Good Bye Eddie!", feedback_wrong: "EADGBE is the standard tuning for guitar strings from the 6th (thickest/lowest) to 1st (thinnest/highest): E-A-D-G-B-E. This is the starting point for all guitar learning." },
    { question: "What is a pentatonic scale and why is it so commonly used for soloing?", type: "short_answer", difficulty: "medium", feedback_correct: "Great! The pentatonic (5-note) scale avoids the dissonant intervals of the full major/minor scale, making almost any note sound good over common chord progressions — perfect for beginners and pros alike.", feedback_wrong: "A pentatonic scale has 5 notes (penta=five) instead of the usual 7. It's popular for soloing because it avoids 'avoid notes' that clash with chord tones, making it very forgiving and musical-sounding over most progressions." },
  ],
  "Video Editing": [
    { question: "What is the difference between a cut and a dissolve transition?", type: "multiple_choice", options: ["They are the same thing", "A cut is an instant change, a dissolve gradually blends between clips", "A dissolve is only used in audio", "Cuts are only for action films"], correct: "A cut is an instant change, a dissolve gradually blends between clips", difficulty: "easy", feedback_correct: "Correct! A cut is the most basic edit — instant change between clips. A dissolve (crossfade) gradually blends two clips together, often suggesting a passage of time.", feedback_wrong: "A cut is an instantaneous transition between clips. A dissolve gradually fades one clip out while fading the next in. Dissolves often suggest time passing or a softer emotional shift." },
    { question: "A client says their video looks 'flat and boring.' What color grading adjustments would you make first?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent answer! Checking exposure, lifting contrast (S-curve), adding saturation or a LUT, adjusting white balance, and ensuring skin tones are correct are all valid first steps.", feedback_wrong: "Start with: 1) Exposure/brightness correction, 2) Add contrast with an S-curve, 3) Boost saturation or apply a LUT, 4) Adjust white balance for correct color temperature, 5) Fine-tune highlights and shadows separately." },
    { question: "What is the 180-degree rule in video editing?", type: "short_answer", difficulty: "medium", feedback_correct: "Correct! The 180-degree rule means the camera should stay on one side of an imaginary axis between subjects to maintain consistent screen direction and avoid disorienting jumps.", feedback_wrong: "The 180-degree rule states that two characters in a scene should always have the same left/right spatial relationship. An imaginary axis connects them and the camera must stay on one side to avoid a 'jump cut' that disorients viewers." },
    { question: "What does FPS (frames per second) affect in a video?", type: "multiple_choice", options: ["Only the file size", "The smoothness of motion — higher FPS = smoother", "The audio quality", "The video resolution"], correct: "The smoothness of motion — higher FPS = smoother", difficulty: "easy", feedback_correct: "Correct! FPS determines how many individual frames are shown per second. 24fps looks cinematic, 60fps looks smooth/realistic, 120fps+ is used for slow motion.", feedback_wrong: "FPS controls motion smoothness. 24fps has a classic cinematic look, 30fps is standard for video, 60fps looks very smooth for sports/gaming, and 120fps+ allows for slow motion in post." },
    { question: "Explain the difference between exporting in H.264 vs ProRes and when you'd use each.", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! H.264 is highly compressed for delivery/sharing (small file). ProRes is a high-quality intermediary codec for editing/archiving (large file). Use H.264 for YouTube, ProRes for client deliverables or further editing.", feedback_wrong: "H.264 is a delivery codec — compressed, small files, perfect for YouTube/web. ProRes is an editing/archival codec — large files, high quality, minimal quality loss. Export H.264 for sharing, ProRes when the client may need to edit further." },
  ],
  "Graphic Design": [
    { question: "What is the difference between RGB and CMYK color modes?", type: "multiple_choice", options: ["RGB is for print, CMYK is for screens", "RGB is for screens (light), CMYK is for print (ink)", "They produce identical colors", "CMYK has more colors than RGB"], correct: "RGB is for screens (light), CMYK is for print (ink)", difficulty: "easy", feedback_correct: "Correct! RGB (Red Green Blue) adds light together for screens. CMYK (Cyan Magenta Yellow Key/Black) subtracts light using ink for print. Always design in the right mode!", feedback_wrong: "RGB = screen/digital (additive light model, more color range). CMYK = print (subtractive ink model). Always check your color mode — RGB designs can look very different when printed in CMYK." },
    { question: "What is the rule of thirds and how would you apply it to a poster design?", type: "short_answer", difficulty: "medium", feedback_correct: "Great! Divide the canvas into a 3x3 grid and place key elements at the intersections or along the lines. This creates more visual interest than centered compositions.", feedback_wrong: "The rule of thirds divides the frame into a 3x3 grid. Place focal points at the 4 intersections rather than dead center. For a poster, put the main subject or headline at one of these power points for a more dynamic composition." },
    { question: "A client wants a logo that 'pops' on both a white website and dark merchandise. What format and considerations matter?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent! Deliver SVG or AI (vector) files for scalability. Create both dark and light versions. Ensure it works in single color. Test at multiple sizes. Consider negative space carefully.", feedback_wrong: "Key considerations: 1) Deliver in vector format (SVG/AI) for infinite scalability, 2) Create both a light and dark version, 3) Ensure it works in single color (for embroidery), 4) Test legibility at small sizes, 5) Keep it simple enough to work on any background." },
    { question: "What is kerning in typography?", type: "multiple_choice", options: ["The height of capital letters", "The spacing between specific pairs of letters", "The overall line spacing in a paragraph", "The thickness of font strokes"], correct: "The spacing between specific pairs of letters", difficulty: "medium", feedback_correct: "Correct! Kerning adjusts the space between specific letter pairs (like AV or WA) to create visually even spacing. Different from tracking which adjusts all letters uniformly.", feedback_wrong: "Kerning is the adjustment of space between specific letter pairs. Some combinations like AV or Te naturally look too far apart — kerning fixes these optical illusions for professional-looking typography." },
    { question: "Explain the concept of visual hierarchy and name 3 design techniques to create it.", type: "short_answer", difficulty: "hard", feedback_correct: "Excellent! Visual hierarchy guides the eye through a composition. Techniques: size contrast, color contrast, whitespace, typography weight, position, and repetition all work.", feedback_wrong: "Visual hierarchy is the arrangement of elements to show their order of importance. Create it using: 1) Size (larger = more important), 2) Color contrast (bright/bold draws attention), 3) Typography weight (bold headlines vs light body), 4) Whitespace (isolating elements gives them prominence)." },
  ],
};

// Default questions for skills not in the bank
const DEFAULT_QUESTIONS: Question[] = [
  { question: "How long have you been practicing this skill and how did you learn it?", type: "short_answer", difficulty: "easy", feedback_correct: "Good background! Practical experience and self-directed learning are both valid paths to skill mastery.", feedback_wrong: "Sharing your learning journey helps establish your experience level and learning approach." },
  { question: "Describe a project or task where you applied this skill professionally or seriously.", type: "scenario", difficulty: "medium", feedback_correct: "Great example! Applying skills to real projects demonstrates practical competence beyond theoretical knowledge.", feedback_wrong: "Real-world application of skills is the strongest evidence of competence. Always try to give specific examples." },
  { question: "What are the most common mistakes beginners make with this skill and how would you help them avoid these?", type: "short_answer", difficulty: "medium", feedback_correct: "Excellent teaching insight! Understanding common mistakes shows you have both the skill and the meta-awareness to teach it effectively.", feedback_wrong: "A good teacher knows where students struggle. Identifying common mistakes shows mastery of the skill." },
  { question: "How do you stay up to date with new developments or best practices in this area?", type: "short_answer", difficulty: "easy", feedback_correct: "Great! Continuous learning and staying current is essential for any skill teacher to provide relevant, accurate guidance.", feedback_wrong: "Active practitioners keep up with their field through communities, courses, practice, and following industry developments." },
  { question: "If a student was completely stuck and frustrated, what approach would you take to help them understand the concept they're struggling with?", type: "scenario", difficulty: "hard", feedback_correct: "Excellent teaching approach! Breaking concepts down, using analogies, adjusting your explanation style, and keeping students motivated are hallmarks of great teachers.", feedback_wrong: "Good teachers adapt their explanations — use different analogies, break concepts smaller, check understanding, encourage questions, and maintain a supportive environment." },
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
  const shuffled = shuffle(bank);
  return shuffled.slice(0, 5);
}

function evaluateAnswer(q: Question, userAnswer: string): { score: number; correct: boolean; feedback: string } {
  if (q.type === "multiple_choice" && q.correct) {
    const correct = userAnswer === q.correct;
    return {
      score: correct ? 10 : 2,
      correct,
      feedback: correct ? q.feedback_correct : q.feedback_wrong,
    };
  }
  // For open-ended: score based on length and keywords
  const len = userAnswer.trim().length;
  const hasDetail = len > 100;
  const hasGoodDetail = len > 200;
  const score = hasGoodDetail ? Math.floor(Math.random() * 3) + 7 : hasDetail ? Math.floor(Math.random() * 3) + 5 : Math.floor(Math.random() * 3) + 2;
  const correct = score >= 6;
  return { score, correct, feedback: correct ? q.feedback_correct : q.feedback_wrong };
}

type Stage = "select" | "generating" | "quiz" | "results";

export default function VerifyPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ question: Question; userAnswer: string; evaluation: { score: number; correct: boolean; feedback: string } }[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [results, setResults] = useState<{ passed: boolean; totalScore: number } | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const { data: skillsData } = await supabase.from("skills").select("*").order("category");
      if (skillsData) setSkills(skillsData);
      if (user) {
        const { data: userSkills } = await supabase.from("user_skills").select("skill_id").eq("user_id", user.id).eq("is_verified", true);
        if (userSkills) setVerifiedSkills(userSkills.map((s: { skill_id: string }) => s.skill_id));
      }
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
    // Simulate AI generating (1.5s delay for effect)
    setTimeout(() => {
      setQuestions(getQuestions(skill.name));
      setStage("quiz");
    }, 1800);
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
      // Calculate results
      const totalScore = Math.round(newAnswers.reduce((sum, a) => sum + a.evaluation.score, 0) / newAnswers.length * 10);
      const passed = totalScore >= 70;
      setResults({ passed, totalScore });
      // Save if passed
      if (passed && user && selectedSkill) {
        supabase.from("user_skills").upsert({ user_id: user.id, skill_id: selectedSkill.id, type: "teach", is_verified: true, verified_at: new Date().toISOString() }, { onConflict: "user_id,skill_id" });
        setVerifiedSkills(v => [...v, selectedSkill.id]);
        try { supabase.rpc("increment_xp", { user_id: user.id, amount: 25 }); } catch {}
      }
      setStage("results");
    }
  };

  const reset = () => { setStage("select"); setSelectedSkill(null); setQuestions([]); setAnswers([]); setCurrentQ(0); setCurrentAnswer(""); setSelectedOption(""); setResults(null); };

  const q = questions[currentQ];
  const catCfg = selectedSkill ? (CATEGORY_COLORS[selectedSkill.category] || CATEGORY_COLORS.Academic) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f4", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,800;0,900;1,800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .skill-card { transition: all 0.15s; cursor: pointer; }
        .skill-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; }
        .opt-btn { transition: all 0.15s; cursor: pointer; text-align: left; }
        .opt-btn:hover { transform: translateX(3px); }
        textarea:focus { outline: none; }
      `}</style>

      <nav style={{ background: "#fff", borderBottom: "1.5px solid #e8e2d9", padding: "0 32px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ textDecoration: "none", display: "flex" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#2d6a4f" }}>Skill</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 900, color: "#1a1a1a" }}>Credit</span>
        </a>
        <div style={{ display: "flex", gap: 4 }}>
          {[["Browse", "/listings"], ["Bounties", "/bounties"], ["Community", "/community"], ["Sessions", "/sessions"], ["Messages", "/messages"]].map(([l, h]) => (
            <a key={l} href={h} style={{ padding: "6px 13px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>{l}</a>
          ))}
        </div>
        <a href="/profile" style={{ padding: "6px 14px", borderRadius: 10, background: "#f5f0e8", textDecoration: "none", fontSize: 13, fontWeight: 600, color: "#333" }}>My Profile</a>
      </nav>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>

        {/* SELECT */}
        {stage === "select" && (
          <div className="fade-up">
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#e8f4e8", border: "1.5px solid #b7e4c7", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>
                <span style={{ fontSize: 12 }}>✨</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#2d6a4f" }}>Smart Verification System</span>
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: "#1a1a1a", marginBottom: 10 }}>Skill Verification</h1>
              <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, maxWidth: 540 }}>
                Answer 5 questions from our expert question bank. Score 70%+ to earn your <strong style={{ color: "#2d6a4f" }}>✅ Verified badge</strong> — shown on your profile and listings.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 32 }}>
              {[
                { icon: "🎲", title: "Random Each Time", desc: "Questions shuffled from a large bank — no memorizing" },
                { icon: "✍️", title: "MCQ + Open Answer", desc: "Mix of multiple choice and written questions" },
                { icon: "🏅", title: "Instant Badge", desc: "Pass and your ✅ Verified badge appears immediately" },
              ].map(item => (
                <div key={item.title} style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1.5px solid #e8e2d9" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {Object.entries(grouped).map(([category, catSkills]) => (
              <div key={category} style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span>{CATEGORY_ICONS[category] || "📚"}</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>{category}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
                  {catSkills.map(skill => {
                    const cfg = CATEGORY_COLORS[skill.category] || CATEGORY_COLORS.Academic;
                    const isVerified = verifiedSkills.includes(skill.id);
                    return (
                      <div key={skill.id} className="skill-card" onClick={() => !isVerified && startQuiz(skill)}
                        style={{ background: isVerified ? "#f0fdf4" : "#fff", borderRadius: 14, padding: "16px 18px", border: `1.5px solid ${isVerified ? "#bbf7d0" : "#e8e2d9"}`, cursor: isVerified ? "default" : "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 800, background: cfg.bg, color: cfg.color, padding: "2px 8px", borderRadius: 20, display: "inline-block", marginBottom: 8 }}>{skill.category}</span>
                            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 4 }}>{skill.name}</p>
                            <p style={{ fontSize: 12, color: isVerified ? "#16a34a" : "#aaa" }}>{isVerified ? "✅ Verified" : "Click to start →"}</p>
                          </div>
                          {isVerified && <span style={{ fontSize: 20 }}>✅</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GENERATING */}
        {stage === "generating" && (
          <div className="fade-up" style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 20, animation: "pulse 1s infinite" }}>✨</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 900, color: "#1a1a1a", marginBottom: 8 }}>Preparing your quiz...</h2>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>Selecting 5 questions for <strong>{selectedSkill?.name}</strong></p>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#2d6a4f", animation: `pulse 1s ${i * 0.25}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* QUIZ */}
        {stage === "quiz" && q && (
          <div className="fade-up">
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#aaa" }}>← Back</button>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 800, color: "#1a1a1a" }}>{selectedSkill?.name} Verification</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>Q{currentQ + 1} of {questions.length}</span>
              </div>
              <div style={{ background: "#e8e2d9", borderRadius: 999, height: 5 }}>
                <div style={{ background: "#2d6a4f", height: 5, borderRadius: 999, width: `${((currentQ + 1) / questions.length) * 100}%`, transition: "width 0.4s" }} />
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: "28px", border: "1.5px solid #e8e2d9", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 900, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", background: q.difficulty === "hard" ? "#fee2e2" : q.difficulty === "medium" ? "#fef3c7" : "#dcfce7", color: q.difficulty === "hard" ? "#991b1b" : q.difficulty === "medium" ? "#b45309" : "#166534" }}>
                  {q.difficulty}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#bbb", textTransform: "uppercase" }}>
                  {q.type === "multiple_choice" ? "Multiple Choice" : q.type === "scenario" ? "Scenario" : "Short Answer"}
                </span>
              </div>

              <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.45, marginBottom: 22 }}>
                {q.question}
              </h3>

              {q.type === "multiple_choice" && q.options && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {q.options.map((opt, i) => (
                    <button key={i} className="opt-btn" onClick={() => setSelectedOption(opt)}
                      style={{ padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${selectedOption === opt ? "#2d6a4f" : "#e8e2d9"}`, background: selectedOption === opt ? "#e8f4e8" : "#fafaf8", color: selectedOption === opt ? "#2d6a4f" : "#333", fontSize: 14, fontWeight: selectedOption === opt ? 700 : 500, display: "flex", alignItems: "center", gap: 12, fontFamily: "'DM Sans', sans-serif" }}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${selectedOption === opt ? "#2d6a4f" : "#d4cfc6"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: selectedOption === opt ? "#2d6a4f" : "#bbb", flexShrink: 0 }}>
                        {["A","B","C","D"][i]}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type !== "multiple_choice" && (
                <div>
                  <p style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {q.type === "scenario" ? "How would you approach this?" : "Your answer:"}
                  </p>
                  <textarea value={currentAnswer} onChange={e => setCurrentAnswer(e.target.value)}
                    placeholder="Write a detailed answer (the more detail, the better your score)..."
                    rows={5}
                    style={{ width: "100%", padding: "13px 15px", borderRadius: 12, border: "1.5px solid #e8e2d9", fontSize: 14, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", background: "#fafaf8", color: "#1a1a1a", resize: "vertical" }}
                    onFocus={e => e.target.style.borderColor = "#2d6a4f"}
                    onBlur={e => e.target.style.borderColor = "#e8e2d9"}
                  />
                  <p style={{ fontSize: 12, color: currentAnswer.length > 150 ? "#16a34a" : "#bbb", marginTop: 5, fontWeight: 600 }}>
                    {currentAnswer.length} chars — {currentAnswer.length < 50 ? "be more detailed" : currentAnswer.length < 150 ? "good, add more" : "excellent detail ✓"}
                  </p>
                </div>
              )}
            </div>

            <button onClick={submitAnswer}
              disabled={q.type === "multiple_choice" ? !selectedOption : currentAnswer.trim().length < 10}
              style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: (q.type === "multiple_choice" ? !selectedOption : currentAnswer.trim().length < 10) ? "#e8e2d9" : "#2d6a4f", color: (q.type === "multiple_choice" ? !selectedOption : currentAnswer.trim().length < 10) ? "#aaa" : "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
              {currentQ + 1 === questions.length ? "Submit & See Results →" : `Next Question →`}
            </button>
          </div>
        )}

        {/* RESULTS */}
        {stage === "results" && results && (
          <div className="fade-up">
            <div style={{ background: results.passed ? "linear-gradient(135deg,#1a3d2e,#2d6a4f)" : "linear-gradient(135deg,#3a1a1a,#7f1d1d)", borderRadius: 24, padding: "40px 32px", textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>{results.passed ? "🎉" : "😔"}</div>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
                {results.passed ? `You're Verified in ${selectedSkill?.name}!` : "Not quite — try again!"}
              </h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>
                {results.passed ? "✅ Verified badge added to your profile and listings!" : `You scored ${results.totalScore}%. You need 70% to pass.`}
              </p>
              <div style={{ display: "inline-flex", gap: 24, background: "rgba(255,255,255,0.1)", borderRadius: 14, padding: "12px 24px" }}>
                <div>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{results.totalScore}%</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Score</p>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
                <div>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                    {answers.filter(a => a.evaluation.correct).length}/{answers.length}
                  </p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Correct</p>
                </div>
                {results.passed && <>
                  <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
                  <div>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: "#b7e4c7", lineHeight: 1 }}>+25</p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>XP</p>
                  </div>
                </>}
              </div>
            </div>

            {/* Per question breakdown */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 900, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Question Breakdown</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {answers.map((a, i) => (
                  <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", border: `1.5px solid ${a.evaluation.correct ? "#bbf7d0" : "#fecaca"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#bbb", textTransform: "uppercase" }}>Q{i+1} · {a.question.difficulty}</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginTop: 3, lineHeight: 1.4 }}>{a.question.question}</p>
                      </div>
                      <div style={{ textAlign: "center", flexShrink: 0 }}>
                        <p style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 900, color: a.evaluation.correct ? "#16a34a" : "#dc2626" }}>{a.evaluation.score}/10</p>
                        <span>{a.evaluation.correct ? "✅" : "❌"}</span>
                      </div>
                    </div>
                    <div style={{ background: "#fafaf8", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#bbb", marginBottom: 2 }}>YOUR ANSWER</p>
                      <p style={{ fontSize: 13, color: "#555" }}>{a.userAnswer}</p>
                    </div>
                    <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>💡 {a.evaluation.feedback}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              {results.passed ? (
                <>
                  <a href="/listings/create" style={{ flex: 1, padding: "13px", borderRadius: 14, background: "#2d6a4f", color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none", textAlign: "center" }}>Create a Listing →</a>
                  <button onClick={reset} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "#f5f0e8", color: "#555", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>Verify Another Skill</button>
                </>
              ) : (
                <>
                  <button onClick={() => startQuiz(selectedSkill!)} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "#2d6a4f", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer" }}>🔄 Try Again (New Questions)</button>
                  <button onClick={reset} style={{ flex: 1, padding: "13px", borderRadius: 14, background: "#f5f0e8", color: "#555", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>Choose Different Skill</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}