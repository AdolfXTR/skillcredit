"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Bounty = {
  id: string;
  title: string;
  description: string;
  credit_reward: number;
  first_place_pct: number;
  second_place_pct: number;
  third_place_pct: number;
  status: string;
  deadline: string;
  created_at: string;
  poster_id: string;
  profiles: { full_name: string; username: string; level: string };
};

type Answer = {
  id: string;
  bounty_id: string;
  answerer_id: string;
  content: string;
  placement: number | null;
  credits_earned: number;
  created_at: string;
  profiles: { full_name: string; username: string; level: string };
};

type CurrentUser = {
  id: string;
  full_name: string;
  credits: number;
};

const LEVEL_COLORS: Record<string, string> = {
  Seedling: "#2d6a4f", Learner: "#0369a1", Contributor: "#7c3aed",
  Skilled: "#b45309", Expert: "#dc2626", Master: "#059669", Legend: "#d97706",
};

const getTimeLeft = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 48) return `${Math.floor(hours / 24)} days left`;
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

const getUrgency = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  const hours = diff / (1000 * 60 * 60);
  if (hours <= 3) return { color: "#dc2626", bg: "#fef2f2", label: "🔴 Urgent" };
  if (hours <= 24) return { color: "#b45309", bg: "#fff8e7", label: "🟡 Due soon" };
  return { color: "#2d6a4f", bg: "#e8f4e8", label: "🟢 Open" };
};

const mockBounty: Bounty = {
  id: "mock", title: "Help me solve this calculus integral problem", description: "I'm stuck on this integral: ∫(x² + 3x + 2)dx. Need a step-by-step explanation with the working shown clearly. Bonus if you can explain why each step works!", credit_reward: 20, first_place_pct: 60, second_place_pct: 30, third_place_pct: 10, status: "open", deadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(), poster_id: "mock-poster",
  profiles: { full_name: "Juan dela Cruz", username: "juandc", level: "Seedling" },
};

export default function BountyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerContent, setAnswerContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("id, full_name, credits").eq("id", user.id).single();
        if (prof) setCurrentUser(prof);
      }

      if (id === "mock" || !id) {
        setBounty(mockBounty);
        setLoading(false);
        return;
      }

      const { data: b } = await supabase
        .from("bounties")
        .select("*, profiles(full_name, username, level)")
        .eq("id", id)
        .single();

      if (b) setBounty(b as Bounty);
      else setBounty(mockBounty);

      // Check if user already answered
      if (user) {
        const { data: myAnswer } = await supabase
          .from("bounty_answers")
          .select("id")
          .eq("bounty_id", id)
          .eq("answerer_id", user.id)
          .single();

        if (myAnswer) {
          setHasAnswered(true);
          // Load all answers (semi-blind: revealed after answering)
          const { data: allAnswers } = await supabase
            .from("bounty_answers")
            .select("*, profiles(full_name, username, level)")
            .eq("bounty_id", id)
            .order("created_at", { ascending: true });
          setAnswers((allAnswers as Answer[]) || []);
        }
      }

      setLoading(false);
    };
    init();
  }, [id]);

  const handleSubmitAnswer = async () => {
    if (!currentUser || !bounty) return;
    if (!answerContent.trim() || answerContent.length < 20) {
      setSubmitError("Answer must be at least 20 characters.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const { error } = await supabase.from("bounty_answers").insert({
      bounty_id: bounty.id,
      answerer_id: currentUser.id,
      content: answerContent,
    });

    if (error) {
      setSubmitError("Failed to submit answer. Please try again.");
      setSubmitting(false);
      return;
    }

    // Now reveal all answers
    const { data: allAnswers } = await supabase
      .from("bounty_answers")
      .select("*, profiles(full_name, username, level)")
      .eq("bounty_id", bounty.id)
      .order("created_at", { ascending: true });

    setAnswers((allAnswers as Answer[]) || []);
    setHasAnswered(true);
    setSubmitSuccess(true);
    setSubmitting(false);
  };

  const handleAssignPlacement = async (answerId: string, placement: 1 | 2 | 3) => {
    if (!bounty) return;
    setAssigning(true);

    const pct = placement === 1 ? bounty.first_place_pct : placement === 2 ? bounty.second_place_pct : bounty.third_place_pct;
    const creditsEarned = Math.floor(bounty.credit_reward * pct / 100);

    await supabase.from("bounty_answers").update({ placement, credits_earned: creditsEarned }).eq("id", answerId);

    // Find the answer to get answerer_id
    const answer = answers.find(a => a.id === answerId);
    if (answer) {
      // Award credits to winner
      const { data: winnerProfile } = await supabase.from("profiles").select("credits").eq("id", answer.answerer_id).single();
      if (winnerProfile) {
        await supabase.from("profiles").update({ credits: winnerProfile.credits + creditsEarned }).eq("id", answer.answerer_id);
        await supabase.from("credit_transactions").insert({
          user_id: answer.answerer_id,
          amount: creditsEarned,
          type: "bounty_earn",
          reference_id: bounty.id,
          description: `${placement === 1 ? "🥇 1st" : placement === 2 ? "🥈 2nd" : "🥉 3rd"} place — ${bounty.title}`,
        });
        // Notify winner
        await supabase.from("notifications").insert({
          user_id: answer.answerer_id,
          type: "achievement",
          title: `${placement === 1 ? "🥇 1st place" : placement === 2 ? "🥈 2nd place" : "🥉 3rd place"} on a bounty!`,
          body: `You earned ${creditsEarned} credits for your answer on "${bounty.title}"`,
        });
      }
    }

    // Refresh answers
    const { data: updated } = await supabase
      .from("bounty_answers")
      .select("*, profiles(full_name, username, level)")
      .eq("bounty_id", bounty.id)
      .order("created_at", { ascending: true });
    setAnswers((updated as Answer[]) || []);
    setAssigning(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f5f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <p style={{ color: "#888" }}>Loading bounty...</p>
        </div>
      </div>
    );
  }

  if (!bounty) return null;

  const urgency = getUrgency(bounty.deadline);
  const timeLeft = getTimeLeft(bounty.deadline);
  const isExpired = new Date(bounty.deadline).getTime() < Date.now();
  const isPoster = currentUser?.id === bounty.poster_id;
  const isOpen = bounty.status === "open" && !isExpired;
  const posterInitials = bounty.profiles?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
  const placementsAssigned = answers.filter(a => a.placement !== null).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/bounties" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← All Bounties</a>
          {currentUser && (
            <div style={{ background: "#e8f4e8", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>
              💰 {currentUser.credits} credits
            </div>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>

        {/* Bounty header */}
        <div style={{ background: "white", borderRadius: 24, padding: "32px", border: "1px solid #e8e0d0", marginBottom: 20 }}>
          {/* Status tags */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: urgency.bg, color: urgency.color, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>
              {urgency.label}
            </span>
            <span style={{ fontSize: 13, color: "#888" }}>⏱ {timeLeft}</span>
            <span style={{ fontSize: 13, color: "#888" }}>💬 {answers.length} answer{answers.length !== 1 ? "s" : ""}</span>
            {isExpired && <span style={{ background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>Deadline passed</span>}
          </div>

          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: "#1a1a1a", marginBottom: 16, lineHeight: 1.3 }}>
            {bounty.title}
          </h1>

          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>
            {bounty.description}
          </p>

          {/* Posted by */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid #f0ece4" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: LEVEL_COLORS[bounty.profiles?.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "white" }}>
              {posterInitials}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333", margin: 0 }}>{bounty.profiles?.full_name}</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>@{bounty.profiles?.username} · Posted {new Date(bounty.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        </div>

        {/* Reward card */}
        <div style={{ background: "#fff8e7", borderRadius: 20, padding: "24px", border: "1px solid #f5e0b0", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Total reward pool</p>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 40, fontWeight: 800, color: "#b45309", margin: 0 }}>
                {bounty.credit_reward} <span style={{ fontSize: 18 }}>credits</span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { place: "🥇 1st", pct: bounty.first_place_pct },
                { place: "🥈 2nd", pct: bounty.second_place_pct },
                { place: "🥉 3rd", pct: bounty.third_place_pct },
              ].map(p => (
                <div key={p.place} style={{ background: "white", borderRadius: 12, padding: "14px 18px", textAlign: "center", border: "1px solid #f5e0b0" }}>
                  <p style={{ fontSize: 13, margin: "0 0 4px" }}>{p.place}</p>
                  <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#b45309", margin: 0 }}>
                    {Math.floor(bounty.credit_reward * p.pct / 100)} cr
                  </p>
                  <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{p.pct}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ANSWER SECTION */}
        {!currentUser ? (
          <div style={{ background: "white", borderRadius: 20, padding: "32px", textAlign: "center", border: "1px solid #e8e0d0", marginBottom: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Log in to answer</h3>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 20 }}>You need an account to submit answers and earn credits.</p>
            <a href="/login" style={{ display: "inline-block", padding: "12px 28px", background: "#b45309", color: "white", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Log in to Answer →
            </a>
          </div>
        ) : isPoster ? (
          /* POSTER VIEW — judge answers */
          <div style={{ background: "white", borderRadius: 20, padding: "28px", border: "1px solid #e8e0d0", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>
                🏆 Judge Answers
              </h3>
              <span style={{ fontSize: 13, color: "#888" }}>{placementsAssigned}/3 placements assigned</span>
            </div>
            {answers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <p style={{ color: "#888", fontSize: 14 }}>No answers yet. Share the bounty to get responses!</p>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#888", marginBottom: 0, background: "#f5f0e8", padding: "10px 14px", borderRadius: 10 }}>
                💡 Assign 1st, 2nd, and 3rd place to the best answers. Credits will be sent immediately to winners.
              </p>
            )}
          </div>
        ) : !hasAnswered && isOpen ? (
          /* ANSWER FORM — semi-blind */
          <div style={{ background: "white", borderRadius: 20, padding: "28px", border: "1px solid #e8e0d0", marginBottom: 20 }}>
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>
              Submit Your Answer 💡
            </h3>
            <div style={{ background: "#f5f0e8", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#b45309" }}>
              🙈 <strong>Semi-blind:</strong> You can't see other answers until you submit your own. Be original!
            </div>

            {submitSuccess ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <h4 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#2d6a4f", marginBottom: 8 }}>Answer submitted!</h4>
                <p style={{ fontSize: 14, color: "#888" }}>You can now see all other answers below. Good luck! 🤞</p>
              </div>
            ) : (
              <>
                <textarea
                  rows={6}
                  placeholder="Write your answer here. Be detailed and clear — the poster will judge based on quality. You can use plain text, show your working, include examples..."
                  value={answerContent}
                  onChange={e => setAnswerContent(e.target.value)}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1.5px solid ${answerContent.length >= 20 ? "#2d6a4f" : "#e8e0d0"}`, fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", resize: "vertical", boxSizing: "border-box", background: "#fafaf8", lineHeight: 1.6 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: answerContent.length >= 20 ? "#2d6a4f" : "#aaa" }}>
                    {answerContent.length} chars {answerContent.length < 20 ? `(min 20)` : "✓"}
                  </span>
                  {submitError && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{submitError}</p>}
                </div>
                <button
                  onClick={handleSubmitAnswer}
                  disabled={submitting || answerContent.length < 20}
                  style={{ marginTop: 16, width: "100%", padding: "14px", background: submitting || answerContent.length < 20 ? "#d0d0c8" : "#b45309", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: submitting || answerContent.length < 20 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  {submitting ? "Submitting..." : "Submit Answer — Then See All Answers 👁️"}
                </button>
              </>
            )}
          </div>
        ) : !isOpen ? (
          <div style={{ background: "#fef2f2", borderRadius: 20, padding: "20px", textAlign: "center", border: "1px solid #fecaca", marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: "#dc2626", fontWeight: 600, margin: 0 }}>⏰ This bounty has expired and is no longer accepting answers.</p>
          </div>
        ) : null}

        {/* ANSWERS LIST */}
        {(hasAnswered || isPoster) && answers.length > 0 && (
          <div>
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>
              All Answers ({answers.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {answers.map((answer, idx) => {
                const answerInitials = answer.profiles?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";
                const isMyAnswer = answer.answerer_id === currentUser?.id;
                const placementEmoji = answer.placement === 1 ? "🥇" : answer.placement === 2 ? "🥈" : answer.placement === 3 ? "🥉" : null;

                return (
                  <div key={answer.id} style={{
                    background: "white", borderRadius: 20, padding: "24px", border: `2px solid ${placementEmoji ? "#f5e0b0" : isMyAnswer ? "#c8e6c9" : "#e8e0d0"}`,
                    position: "relative", overflow: "hidden"
                  }}>
                    {/* Placement ribbon */}
                    {placementEmoji && (
                      <div style={{ position: "absolute", top: 0, right: 0, background: "#b45309", color: "white", fontSize: 12, fontWeight: 800, padding: "4px 14px", borderBottomLeftRadius: 12 }}>
                        {placementEmoji} {answer.placement === 1 ? "1st" : answer.placement === 2 ? "2nd" : "3rd"} · {answer.credits_earned} cr
                      </div>
                    )}
                    {isMyAnswer && !placementEmoji && (
                      <div style={{ position: "absolute", top: 0, right: 0, background: "#2d6a4f", color: "white", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderBottomLeftRadius: 10 }}>
                        Your answer
                      </div>
                    )}

                    {/* Answerer info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: LEVEL_COLORS[answer.profiles?.level] || "#2d6a4f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>
                        {answerInitials}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#333", margin: 0 }}>{answer.profiles?.full_name}</p>
                        <p style={{ fontSize: 11, color: "#888", margin: 0 }}>@{answer.profiles?.username} · Answer #{idx + 1} · {new Date(answer.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>

                    {/* Answer content */}
                    <p style={{ fontSize: 14, color: "#333", lineHeight: 1.7, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>
                      {answer.content}
                    </p>

                    {/* Poster: assign placement buttons */}
                    {isPoster && !answer.placement && (
                      <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid #f0ece4" }}>
                        <p style={{ fontSize: 12, color: "#888", margin: "0 8px 0 0", alignSelf: "center" }}>Award:</p>
                        {([1, 2, 3] as const).map(place => {
                          const alreadyTaken = answers.some(a => a.placement === place);
                          const emoji = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
                          const pct = place === 1 ? bounty.first_place_pct : place === 2 ? bounty.second_place_pct : bounty.third_place_pct;
                          return (
                            <button
                              key={place}
                              onClick={() => !alreadyTaken && handleAssignPlacement(answer.id, place)}
                              disabled={alreadyTaken || assigning}
                              style={{ padding: "7px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 700, cursor: alreadyTaken || assigning ? "not-allowed" : "pointer", background: alreadyTaken ? "#f0ece4" : "#fff8e7", color: alreadyTaken ? "#aaa" : "#b45309", fontFamily: "'DM Sans', sans-serif" }}
                            >
                              {emoji} {Math.floor(bounty.credit_reward * pct / 100)} cr {alreadyTaken ? "(taken)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Not answered yet but expired */}
        {!hasAnswered && !isPoster && isExpired && (
          <div style={{ background: "white", borderRadius: 20, padding: "32px", textAlign: "center", border: "1px solid #e8e0d0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
            <p style={{ fontSize: 15, color: "#888" }}>This bounty expired before you could answer.</p>
            <a href="/bounties" style={{ display: "inline-block", marginTop: 16, padding: "10px 24px", background: "#b45309", color: "white", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Find other bounties →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}