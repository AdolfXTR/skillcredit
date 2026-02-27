"use client";

export type BadgeTier = {
  name: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  minXP: number;
  minSessions: number;
  minRating: number;
  description: string;
};

export const BADGE_TIERS: BadgeTier[] = [
  {
    name: "Seedling",
    emoji: "🌱",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    glow: "",
    minXP: 0,
    minSessions: 0,
    minRating: 0,
    description: "Just getting started",
  },
  {
    name: "Rising",
    emoji: "⭐",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    glow: "",
    minXP: 50,
    minSessions: 5,
    minRating: 0,
    description: "Building momentum",
  },
  {
    name: "Pro",
    emoji: "💎",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-200",
    glow: "shadow-violet-100",
    minXP: 200,
    minSessions: 15,
    minRating: 4.0,
    description: "Proven skill sharer",
  },
  {
    name: "Elite",
    emoji: "🔥",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    glow: "shadow-orange-100",
    minXP: 500,
    minSessions: 30,
    minRating: 4.5,
    description: "Top performer",
  },
  {
    name: "Legend",
    emoji: "👑",
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    glow: "shadow-yellow-200",
    minXP: 1000,
    minSessions: 50,
    minRating: 4.8,
    description: "SkillCredit royalty",
  },
];

export function getBadgeTier(xp: number, sessions: number, avgRating: number): BadgeTier {
  // Go from highest to lowest and return the first one they qualify for
  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const tier = BADGE_TIERS[i];
    if (
      xp >= tier.minXP &&
      sessions >= tier.minSessions &&
      avgRating >= tier.minRating
    ) {
      return tier;
    }
  }
  return BADGE_TIERS[0];
}

export function getNextTier(current: BadgeTier): BadgeTier | null {
  const idx = BADGE_TIERS.findIndex((t) => t.name === current.name);
  return idx < BADGE_TIERS.length - 1 ? BADGE_TIERS[idx + 1] : null;
}

// ── Small inline badge (for nav, listings, profile header) ──────────────────
export function BadgeChip({ tier, size = "sm" }: { tier: BadgeTier; size?: "xs" | "sm" | "md" }) {
  const sizes = {
    xs: "text-[10px] px-2 py-0.5 gap-1",
    sm: "text-xs px-2.5 py-1 gap-1.5",
    md: "text-sm px-3 py-1.5 gap-2",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold ${sizes[size]} ${tier.bg} ${tier.border} ${tier.color}`}
    >
      <span>{tier.emoji}</span>
      <span>{tier.name}</span>
    </span>
  );
}

// ── Progress card (for dashboard & profile) ─────────────────────────────────
export function BadgeProgressCard({
  xp,
  sessions,
  avgRating,
}: {
  xp: number;
  sessions: number;
  avgRating: number;
}) {
  const current = getBadgeTier(xp, sessions, avgRating);
  const next = getNextTier(current);
  const currentIdx = BADGE_TIERS.findIndex((t) => t.name === current.name);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-black text-stone-400 uppercase tracking-widest">
          Your Badge
        </p>
        <BadgeChip tier={current} size="sm" />
      </div>

      {/* Current tier display */}
      <div className={`rounded-xl border p-4 mb-4 ${current.bg} ${current.border}`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{current.emoji}</span>
          <div>
            <p className={`font-black text-lg font-fraunces ${current.color}`}>
              {current.name}
            </p>
            <p className="text-xs text-stone-500">{current.description}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "XP", value: xp, icon: "⚡" },
          { label: "Sessions", value: sessions, icon: "📚" },
          { label: "Rating", value: avgRating > 0 ? avgRating.toFixed(1) : "—", icon: "⭐" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-stone-50 rounded-xl p-2.5 text-center border border-stone-100"
          >
            <p className="text-base">{stat.icon}</p>
            <p className="font-black text-sm text-stone-800">{stat.value}</p>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Next tier progress */}
      {next ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-stone-500">
              Next: {next.emoji} {next.name}
            </p>
            <span className={`text-xs font-bold ${next.color}`}>
              {next.description}
            </span>
          </div>

          {/* Requirements */}
          <div className="flex flex-col gap-1.5">
            {[
              {
                label: "XP",
                current: xp,
                required: next.minXP,
                icon: "⚡",
              },
              {
                label: "Sessions",
                current: sessions,
                required: next.minSessions,
                icon: "📚",
              },
              ...(next.minRating > 0
                ? [{ label: "Avg Rating", current: avgRating, required: next.minRating, icon: "⭐" }]
                : []),
            ].map((req) => {
              const pct = Math.min((req.current / req.required) * 100, 100);
              const done = req.current >= req.required;
              return (
                <div key={req.label}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[11px] font-semibold text-stone-500">
                      {req.icon} {req.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        done ? "text-emerald-600" : "text-stone-400"
                      }`}
                    >
                      {done ? "✓ Done" : `${req.current} / ${req.required}`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        done ? "bg-emerald-500" : "bg-stone-300"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-sm font-black text-yellow-600">
            👑 You&apos;ve reached the top!
          </p>
          <p className="text-xs text-stone-400 mt-1">Legend status achieved</p>
        </div>
      )}

      {/* All tiers preview */}
      <div className="mt-4 pt-4 border-t border-stone-100">
        <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-2">
          All Tiers
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {BADGE_TIERS.map((tier, i) => (
            <span
              key={tier.name}
              className={`text-[11px] px-2 py-0.5 rounded-full border font-bold transition-all ${
                i <= currentIdx
                  ? `${tier.bg} ${tier.border} ${tier.color}`
                  : "bg-stone-50 border-stone-100 text-stone-300"
              }`}
            >
              {tier.emoji} {tier.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Full tier showcase (for verify / about page) ─────────────────────────────
export function BadgeShowcase({ currentTier }: { currentTier: BadgeTier }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
      {BADGE_TIERS.map((tier) => {
        const isActive = tier.name === currentTier.name;
        const isPast =
          BADGE_TIERS.findIndex((t) => t.name === tier.name) <=
          BADGE_TIERS.findIndex((t) => t.name === currentTier.name);
        return (
          <div
            key={tier.name}
            className={`rounded-2xl border p-4 text-center transition-all ${
              isActive
                ? `${tier.bg} ${tier.border} shadow-md scale-105`
                : isPast
                ? `${tier.bg} ${tier.border} opacity-70`
                : "bg-stone-50 border-stone-100 opacity-40"
            }`}
          >
            <p className="text-3xl mb-2">{tier.emoji}</p>
            <p className={`font-black text-sm ${isActive ? tier.color : "text-stone-400"}`}>
              {tier.name}
            </p>
            <p className="text-[10px] text-stone-400 mt-1">{tier.description}</p>
            {tier.minXP > 0 && (
              <p className="text-[10px] font-bold text-stone-400 mt-1.5">
                {tier.minXP} XP · {tier.minSessions} sessions
              </p>
            )}
            {isActive && (
              <span className="mt-2 inline-block text-[10px] font-black bg-white rounded-full px-2 py-0.5 border border-current text-emerald-600">
                YOU ARE HERE
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}