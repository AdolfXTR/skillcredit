"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Transaction = {
  id: string; amount: number; type: string;
  description: string; created_at: string;
};
type Profile = {
  id: string; full_name: string; username: string; credits: number;
};

const TX_CONFIG: Record<string, { icon: string; label: string; tw: string }> = {
  signup_bonus:    { icon: "🎁", label: "Signup Bonus",     tw: "bg-emerald-50" },
  session_earn:    { icon: "📚", label: "Session Earned",   tw: "bg-emerald-50" },
  session_spend:   { icon: "📖", label: "Session Booked",   tw: "bg-red-50" },
  session_refund:  { icon: "↩️", label: "Session Refund",   tw: "bg-violet-50" },
  bounty_earn:     { icon: "🏆", label: "Bounty Won",       tw: "bg-emerald-50" },
  bounty_spend:    { icon: "🎯", label: "Bounty Posted",    tw: "bg-red-50" },
  topup:           { icon: "💳", label: "Top Up",           tw: "bg-sky-50" },
  forum_earn:      { icon: "💬", label: "Forum Answer",     tw: "bg-emerald-50" },
  refund:          { icon: "↩️", label: "Refund",           tw: "bg-violet-50" },
  credit_transfer: { icon: "💸", label: "Credit Transfer",  tw: "bg-amber-50" },
  default:         { icon: "💰", label: "Transaction",      tw: "bg-stone-50" },
};

export default function WalletPage() {
  const [profile, setProfile]           = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<"overview" | "topup" | "history">("overview");
  const [notifyDone, setNotifyDone]     = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) setProfile(prof);
      const { data: txns } = await supabase.from("credit_transactions")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(50);
      if (txns) setTransactions(txns);
      setLoading(false);
    };
    init();
  }, []);

  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent  = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">💰</div>
        <p className="text-stone-400 text-sm font-medium">Loading wallet...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-fraunces { font-family: 'Fraunces', serif; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .fade-up { animation: fadeUp .3s ease both; }
      `}</style>

      {/* NAVBAR */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50 px-6 h-14 flex items-center justify-between shadow-sm">
        <a href="/dashboard" className="flex items-center no-underline">
          <span className="font-fraunces text-xl font-black text-emerald-700">Skill</span>
          <span className="font-fraunces text-xl font-black text-stone-900">Credit</span>
        </a>
        <div className="flex items-center gap-1">
          {[["Bounties","/bounties"],["Community","/community"],["Sessions","/sessions"],["Messages","/messages"]].map(([l,h]) => (
            <a key={l} href={h} className="px-3 py-1.5 rounded-lg text-stone-500 text-sm font-semibold hover:bg-stone-100 transition-colors no-underline">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            💰 {profile?.credits} cr
          </span>
          <a href="/profile" className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors no-underline">
            👤 Profile
          </a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* HEADER */}
        <div className="mb-6 fade-up">
          <h1 className="font-fraunces text-4xl font-black text-stone-900 mb-1">My Wallet</h1>
          <p className="text-stone-400 text-sm">Track your credits and transaction history</p>
        </div>

        {/* BALANCE CARD */}
        <div className="relative bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 rounded-3xl p-8 mb-5 overflow-hidden shadow-xl fade-up">
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />
          <p className="text-emerald-200 text-sm font-semibold mb-1">Available Balance</p>
          <div className="flex items-end gap-3 mb-1">
            <p className="font-fraunces text-6xl font-black text-white leading-none">{profile?.credits}</p>
            <p className="text-emerald-300 text-lg font-bold mb-2">credits</p>
          </div>
          <p className="text-emerald-300/70 text-sm mb-7">≈ ₱{((profile?.credits || 0) * 10).toLocaleString()} equivalent</p>
          <div className="flex gap-3">
            <button onClick={() => setActiveTab("topup")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-800 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors border-0 cursor-pointer">
              + Top Up Credits
            </button>
            <button onClick={() => setActiveTab("history")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-xl font-semibold text-sm hover:bg-white/25 transition-colors border border-white/20 cursor-pointer">
              View History
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-5 fade-up">
          {[
            { icon: "⬆️", label: "Total Earned", value: `+${totalEarned}`, tw: "text-emerald-700", bg: "bg-emerald-50" },
            { icon: "⬇️", label: "Total Spent",  value: `-${totalSpent}`,  tw: "text-red-600",    bg: "bg-red-50" },
            { icon: "🔁", label: "Transactions", value: transactions.length.toString(), tw: "text-sky-700", bg: "bg-sky-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-stone-200 hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
              <p className={`font-fraunces text-2xl font-black ${s.tw}`}>{s.value}</p>
              <p className="text-xs text-stone-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* TABS */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-5">
          {[
            { key: "overview", label: "📊 Overview" },
            { key: "topup",    label: "💳 Top Up" },
            { key: "history",  label: "📋 History" },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-0 cursor-pointer ${
                activeTab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700 bg-transparent"
              }`}>
              {t.label}
              {t.key === "topup" && (
                <span className="ml-1.5 text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full align-middle">SOON</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-5 fade-up">
            <div className="bg-white rounded-2xl p-6 border border-stone-200">
              <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">How to earn credits 💡</h3>
              <div className="flex flex-col gap-0">
                {[
                  { icon: "🎓", action: "Teach a session",       credits: "+session price" },
                  { icon: "🏆", action: "Win a bounty (1st)",    credits: "+60% of reward" },
                  { icon: "💬", action: "Answer forum question",  credits: "+2 credits" },
                  { icon: "📅", action: "Daily challenges",       credits: "+3–5 credits" },
                  { icon: "🎁", action: "Signup bonus",           credits: "+20 credits" },
                ].map((item, i, arr) => (
                  <div key={item.action} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <div className="flex gap-3 items-center">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm text-stone-600 font-medium">{item.action}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{item.credits}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-stone-200">
              <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">Recent Transactions</h3>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📊</p>
                  <p className="text-stone-400 text-sm">No transactions yet</p>
                </div>
              ) : transactions.slice(0, 6).map((txn, i, arr) => {
                const cfg = TX_CONFIG[txn.type] || TX_CONFIG.default;
                return (
                  <div key={txn.id} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <div className="flex gap-3 items-center">
                      <div className={`w-8 h-8 ${cfg.tw} rounded-lg flex items-center justify-center text-sm`}>{cfg.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-stone-700">{cfg.label}</p>
                        <p className="text-[11px] text-stone-300">{new Date(txn.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-black ${txn.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {txn.amount > 0 ? "+" : ""}{txn.amount} cr
                    </span>
                  </div>
                );
              })}
              {transactions.length > 6 && (
                <button onClick={() => setActiveTab("history")} className="w-full mt-3 py-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-transparent border-0 cursor-pointer">
                  View all {transactions.length} transactions →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── TOP UP — COMING SOON ── */}
        {activeTab === "topup" && (
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden fade-up">
            {/* decorative top bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400" />

            <div className="flex flex-col items-center text-center px-12 py-16">
              {/* animated coin */}
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-5xl shadow-xl shadow-amber-200"
                  style={{ animation: "fadeUp .4s ease" }}>
                  💳
                </div>
                <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-xs font-black text-amber-600">
                  ⏳
                </div>
              </div>

              <span className="text-xs font-black tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mb-4 uppercase">
                Coming Soon
              </span>

              <h2 className="font-fraunces text-3xl font-black text-stone-900 mb-3 leading-tight">
                Credit Top-Up<br />is on its way
              </h2>
              <p className="text-stone-400 text-sm leading-relaxed max-w-sm mb-8">
                We're integrating GCash, Maya, and card payments so you can top up instantly.
                For now, earn credits by teaching sessions, answering bounties, and helping the community!
              </p>

              {/* Ways to earn callout */}
              <div className="w-full max-w-sm bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 text-left">
                <p className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-3">Earn credits for free right now</p>
                {[
                  ["🎓", "Teach a skill session", "earn the session price"],
                  ["🏆", "Answer a bounty",        "earn up to 60% of reward"],
                  ["💬", "Help on the forum",      "+2 credits per answer"],
                ].map(([icon, action, reward]) => (
                  <div key={action} className="flex items-center gap-3 py-2 border-b border-emerald-100 last:border-0">
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-700">{action}</p>
                      <p className="text-xs text-emerald-600 font-medium">{reward}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notify me */}
              {!notifyDone ? (
                <button
                  onClick={() => setNotifyDone(true)}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors border-0 cursor-pointer shadow-sm">
                  🔔 Notify me when it's live
                </button>
              ) : (
                <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-emerald-600 font-black text-sm">✓ We'll let you know!</span>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <a href="/listings" className="text-sm font-semibold text-emerald-600 hover:underline no-underline">Browse skills →</a>
                <span className="text-stone-200">·</span>
                <a href="/bounties" className="text-sm font-semibold text-emerald-600 hover:underline no-underline">View bounties →</a>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm fade-up">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-fraunces text-lg font-black text-stone-900">Transaction History</h3>
              <span className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">{transactions.length} total</span>
            </div>
            {transactions.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-5xl mb-3">📋</div>
                <p className="font-fraunces text-base font-black text-stone-700 mb-1">No transactions yet</p>
                <p className="text-stone-400 text-sm">Your history will appear here once you start transacting.</p>
              </div>
            ) : (
              <div>
                {transactions.map((txn, i) => {
                  const cfg = TX_CONFIG[txn.type] || TX_CONFIG.default;
                  return (
                    <div key={txn.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors justify-between ${i < transactions.length - 1 ? "border-b border-stone-100" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${cfg.tw} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
                          {cfg.icon}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{cfg.label}</p>
                          <p className="text-xs text-stone-400 mt-0.5">{txn.description}</p>
                          <p className="text-[11px] text-stone-300">{new Date(txn.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      <span className={`font-fraunces text-xl font-black flex-shrink-0 ${txn.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {txn.amount > 0 ? "+" : ""}{txn.amount} cr
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}