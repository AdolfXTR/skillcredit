"use client";

// ── Reputation Score Formula ─────────────────────────────────────────────────
// reputation = (avg_rating * 20) + (completed_sessions * 2) + (repeat_clients * 5) - (disputes * 15)
// Max possible ≈ 100 (capped)

export type ReputationData = {
  avgRating: number;       // 0–5
  completedSessions: number;
  repeatClients: number;
  disputes: number;
};

export function calcReputation(data: ReputationData): number {
  const score =
    data.avgRating * 20 +
    data.completedSessions * 2 +
    data.repeatClients * 5 -
    data.disputes * 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getReputationLabel(score: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  emoji: string;
} {
  if (score >= 85) return { label: "Exceptional",  emoji: "🌟", color: "text-yellow-700",  bg: "bg-yellow-50",  border: "border-yellow-200" };
  if (score >= 70) return { label: "Excellent",    emoji: "💎", color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200" };
  if (score >= 55) return { label: "Very Good",    emoji: "🔥", color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200" };
  if (score >= 40) return { label: "Good",         emoji: "✅", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (score >= 20) return { label: "Building",     emoji: "⭐", color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200" };
  return               { label: "New",             emoji: "🌱", color: "text-stone-500",   bg: "bg-stone-50",   border: "border-stone-200" };
}

// ── Inline score chip (for listing cards, search results) ────────────────────
export function ReputationChip({ score }: { score: number }) {
  const rep = getReputationLabel(score);
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${rep.bg} ${rep.border} ${rep.color}`}>
      {rep.emoji} {score}
    </span>
  );
}

// ── Full reputation card (for profile page) ──────────────────────────────────
export function ReputationCard({ data }: { data: ReputationData }) {
  const score = calcReputation(data);
  const rep   = getReputationLabel(score);
  const pct   = score; // already 0–100

  // Score arc segments
  const segments = [
    { label: "Rating",    value: Math.round(data.avgRating * 20),       max: 100, icon: "⭐", tip: `${data.avgRating.toFixed(1)} avg × 20` },
    { label: "Sessions",  value: Math.min(data.completedSessions * 2, 60), max: 60,  icon: "📚", tip: `${data.completedSessions} sessions × 2` },
    { label: "Repeats",   value: Math.min(data.repeatClients * 5, 30),   max: 30,  icon: "🔁", tip: `${data.repeatClients} repeat clients × 5` },
    { label: "Disputes",  value: -(data.disputes * 15),                  max: 0,   icon: "⚠️", tip: `${data.disputes} disputes × -15`, negative: true },
  ];

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">
        Reputation Score
      </p>

      {/* Score display */}
      <div className={`rounded-2xl border p-5 mb-4 ${rep.bg} ${rep.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{rep.emoji}</span>
            <div>
              <p className={`font-black text-2xl font-fraunces leading-none ${rep.color}`}>
                {score}
                <span className="text-sm font-bold opacity-50">/100</span>
              </p>
              <p className={`text-xs font-bold mt-0.5 ${rep.color}`}>{rep.label}</p>
            </div>
          </div>

          {/* Mini circular progress */}
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                className="text-stone-200" strokeWidth="4" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                className={rep.color} strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
                strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${rep.color}`}>
              {score}
            </span>
          </div>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              score >= 70 ? "bg-violet-500" :
              score >= 55 ? "bg-orange-500" :
              score >= 40 ? "bg-emerald-500" :
              score >= 20 ? "bg-blue-500" : "bg-stone-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Score breakdown */}
      <div className="space-y-2.5 mb-4">
        <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">
          Score Breakdown
        </p>
        {segments.map(seg => (
          <div key={seg.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-stone-500 flex items-center gap-1.5">
                {seg.icon} {seg.label}
              </span>
              <span className={`text-xs font-black ${
                seg.negative && data.disputes > 0 ? "text-red-500" : "text-stone-600"
              }`}>
                {seg.negative
                  ? data.disputes > 0 ? `−${data.disputes * 15} pts` : "No disputes ✓"
                  : `+${seg.value} pts`
                }
              </span>
            </div>
            {!seg.negative && (
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    seg.label === "Rating"   ? "bg-yellow-400" :
                    seg.label === "Sessions" ? "bg-emerald-400" : "bg-blue-400"
                  }`}
                  style={{ width: `${(seg.value / seg.max) * 100}%` }}
                />
              </div>
            )}
            <p className="text-[10px] text-stone-300 mt-0.5">{seg.tip}</p>
          </div>
        ))}
      </div>

      {/* How to improve */}
      {score < 85 && (
        <div className="bg-stone-50 rounded-xl border border-stone-100 p-3">
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-wide mb-2">
            💡 How to improve
          </p>
          <div className="space-y-1">
            {data.avgRating < 4.5 && (
              <p className="text-xs text-stone-500">• Deliver high-quality sessions to boost your rating</p>
            )}
            {data.completedSessions < 20 && (
              <p className="text-xs text-stone-500">• Complete more sessions (+2 pts each)</p>
            )}
            {data.repeatClients < 5 && (
              <p className="text-xs text-stone-500">• Build repeat clients for bonus points (+5 pts each)</p>
            )}
            {data.disputes > 0 && (
              <p className="text-xs text-red-400">• Resolve disputes — each one costs 15 pts</p>
            )}
          </div>
        </div>
      )}

      {score >= 85 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <p className="text-sm font-black text-yellow-700">🌟 Exceptional reputation!</p>
          <p className="text-xs text-yellow-600 mt-0.5">You&apos;re in the top tier of SkillCredit</p>
        </div>
      )}
    </div>
  );
}

// ── Compact version for listing sidebar ─────────────────────────────────────
export function ReputationMini({ data }: { data: ReputationData }) {
  const score = calcReputation(data);
  const rep   = getReputationLabel(score);

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${rep.bg} ${rep.border}`}>
      <span className="text-2xl">{rep.emoji}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <p className={`text-xs font-black ${rep.color}`}>{rep.label} Teacher</p>
          <p className={`text-sm font-black ${rep.color}`}>{score}/100</p>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              score >= 70 ? "bg-violet-500" :
              score >= 55 ? "bg-orange-500" :
              score >= 40 ? "bg-emerald-500" : "bg-blue-400"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="text-[10px] text-stone-400 mt-1">
          {data.completedSessions} sessions · {data.avgRating.toFixed(1)}★ avg rating
        </p>
      </div>
    </div>
  );
}