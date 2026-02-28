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
  signup_bonus:  { icon: "🎁", label: "Signup Bonus",   tw: "bg-emerald-50" },
  session_earn:  { icon: "📚", label: "Session Earned", tw: "bg-emerald-50" },
  session_spend: { icon: "📖", label: "Session Booked", tw: "bg-red-50" },
  bounty_earn:   { icon: "🏆", label: "Bounty Won",     tw: "bg-emerald-50" },
  bounty_spend:  { icon: "🎯", label: "Bounty Posted",  tw: "bg-red-50" },
  topup:         { icon: "💳", label: "Top Up",         tw: "bg-sky-50" },
  forum_earn:    { icon: "💬", label: "Forum Answer",   tw: "bg-emerald-50" },
  refund:        { icon: "↩️", label: "Refund",         tw: "bg-violet-50" },
  default:       { icon: "💰", label: "Transaction",    tw: "bg-stone-50" },
};

const PACKAGES = [
  { credits: 50,  price: 500,  label: "Starter", bonus: 0,   popular: false },
  { credits: 120, price: 1000, label: "Popular",  bonus: 20,  popular: true  },
  { credits: 260, price: 2000, label: "Value",    bonus: 60,  popular: false },
  { credits: 550, price: 4000, label: "Pro",      bonus: 150, popular: false },
];

const PAYMENT_METHODS = [
  { key: "gcash", label: "GCash",       icon: "📱" },
  { key: "maya",  label: "Maya",        icon: "💚" },
  { key: "card",  label: "Credit Card", icon: "💳" },
];

export default function WalletPage() {
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<"overview" | "topup" | "history">("overview");
  const [selectedPkg, setSelectedPkg] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("gcash");
  const [processing, setProcessing]   = useState(false);
  const [success, setSuccess]         = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) setProfile(prof);
      const { data: txns } = await supabase.from("credit_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (txns) setTransactions(txns);
      setLoading(false);
    };
    init();
  }, []);

  const handleTopUp = async () => {
    if (!profile) return;
    setProcessing(true);
    const pkg = PACKAGES[selectedPkg];
    const total = pkg.credits + pkg.bonus;
    await new Promise(r => setTimeout(r, 2000));
    await supabase.from("profiles").update({ credits: (profile.credits || 0) + total }).eq("id", profile.id);
    await supabase.from("credit_transactions").insert({
      user_id: profile.id, amount: total, type: "topup",
      description: `Top up — ${pkg.label} (${pkg.credits}+${pkg.bonus} bonus) via ${paymentMethod.toUpperCase()}`,
    });
    setProfile(p => p ? { ...p, credits: p.credits + total } : p);
    setTransactions(prev => [{
      id: Date.now().toString(), amount: total, type: "topup",
      description: `Top up — ${pkg.label} package`, created_at: new Date().toISOString()
    }, ...prev]);
    setProcessing(false);
    setSuccess(true);
  };

  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent  = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const pkg = PACKAGES[selectedPkg];

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
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            💰 {profile?.credits} cr
          </span>
          <a href="/profile" className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-sm font-semibold hover:bg-stone-200 transition-colors no-underline">
            👤 Profile
          </a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 py-8">

        {/* ── HEADER ── */}
        <div className="mb-6">
          <h1 className="font-fraunces text-4xl font-black text-stone-900 mb-1">My Wallet</h1>
          <p className="text-stone-400 text-sm">Manage your credits and top up anytime</p>
        </div>

        {/* ── BALANCE CARD ── */}
        <div className="relative bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 rounded-3xl p-8 mb-5 overflow-hidden shadow-xl">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />

          <p className="text-emerald-200 text-sm font-semibold mb-1">Available Balance</p>
          <div className="flex items-end gap-3 mb-1">
            <p className="font-fraunces text-6xl font-black text-white leading-none">{profile?.credits}</p>
            <p className="text-emerald-300 text-lg font-bold mb-2">credits</p>
          </div>
          <p className="text-emerald-300/70 text-sm mb-7">≈ ₱{((profile?.credits || 0) * 10).toLocaleString()} equivalent</p>

          <div className="flex gap-3">
            <button onClick={() => { setActiveTab("topup"); setSuccess(false); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-800 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors border-0 cursor-pointer">
              + Top Up Credits
            </button>
            <button onClick={() => setActiveTab("history")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-xl font-semibold text-sm hover:bg-white/25 transition-colors border border-white/20 cursor-pointer">
              View History
            </button>
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { icon: "⬆️", label: "Total Earned", value: `+${totalEarned}`, tw: "text-emerald-700", bg: "bg-emerald-50" },
            { icon: "⬇️", label: "Total Spent",  value: `-${totalSpent}`,  tw: "text-red-600",     bg: "bg-red-50" },
            { icon: "🔁", label: "Transactions", value: transactions.length.toString(), tw: "text-sky-700", bg: "bg-sky-50" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-stone-200 hover:shadow-sm transition-shadow">
              <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
              <p className={`font-fraunces text-2xl font-black ${s.tw}`}>{s.value}</p>
              <p className="text-xs text-stone-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-5">
          {[
            { key: "overview", label: "📊 Overview" },
            { key: "topup",    label: "💳 Top Up" },
            { key: "history",  label: "📋 History" },
          ].map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key as typeof activeTab); setSuccess(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-0 cursor-pointer ${
                activeTab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700 bg-transparent"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-stone-200">
              <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">How to earn credits 💡</h3>
              <div className="flex flex-col gap-0">
                {[
                  { icon: "🎓", action: "Teach a session",      credits: "+session price" },
                  { icon: "🏆", action: "Win a bounty (1st)",   credits: "+60% of reward" },
                  { icon: "💬", action: "Answer forum question", credits: "+2 credits" },
                  { icon: "📅", action: "Daily challenges",      credits: "+3–5 credits" },
                  { icon: "🎁", action: "Signup bonus",          credits: "+20 credits" },
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

        {/* ── TOP UP ── */}
        {activeTab === "topup" && (
          success ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-stone-200 shadow-sm">
              <div className="text-6xl mb-5">🎉</div>
              <h2 className="font-fraunces text-3xl font-black text-stone-900 mb-3">Credits Added!</h2>
              <p className="text-stone-400 text-sm mb-5">Your wallet has been topped up successfully.</p>
              <div className="inline-block bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-3 mb-8">
                <p className="text-emerald-700 font-bold text-sm">💰 New balance: <strong className="font-fraunces text-lg">{profile?.credits} credits</strong></p>
              </div>
              <div className="flex gap-3 justify-center max-w-sm mx-auto">
                <a href="/listings" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm text-center no-underline hover:bg-emerald-700 transition-colors">Browse Skills →</a>
                <button onClick={() => setSuccess(false)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold text-sm border-0 cursor-pointer hover:bg-stone-200 transition-colors">Top up more</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_320px] gap-5">
              <div>
                <h3 className="font-fraunces text-lg font-black text-stone-900 mb-4">Choose a Package</h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {PACKAGES.map((p, i) => (
                    <div key={i} onClick={() => setSelectedPkg(i)}
                      className={`relative rounded-2xl p-5 border-2 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${
                        selectedPkg === i ? "border-emerald-500 bg-emerald-50 shadow-md" : "border-stone-200 bg-white hover:border-stone-300"
                      }`}>
                      {p.popular && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full whitespace-nowrap">
                          MOST POPULAR
                        </span>
                      )}
                      <p className="text-xs font-bold text-stone-400 mb-1">{p.label}</p>
                      <p className="font-fraunces text-3xl font-black text-stone-900 mb-0.5">{p.credits} <span className="text-base font-semibold text-stone-500">cr</span></p>
                      {p.bonus > 0 && <p className="text-xs font-bold text-emerald-600 mb-2">+ {p.bonus} bonus! 🎁</p>}
                      <p className="text-lg font-black text-amber-600">₱{p.price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <h3 className="font-fraunces text-lg font-black text-stone-900 mb-3">Payment Method</h3>
                <div className="grid grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map(m => (
                    <div key={m.key} onClick={() => setPaymentMethod(m.key)}
                      className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-center ${
                        paymentMethod === m.key ? "border-emerald-500 bg-emerald-50" : "border-stone-200 bg-white hover:border-stone-300"
                      }`}>
                      <div className="text-3xl mb-1">{m.icon}</div>
                      <p className="text-sm font-bold text-stone-700">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order summary */}
              <div className="bg-white rounded-2xl p-6 border border-stone-200 h-fit shadow-sm">
                <h3 className="font-fraunces text-lg font-black text-stone-900 mb-5">Order Summary</h3>
                <div className="flex flex-col gap-3 mb-5">
                  {[
                    { label: "Package",  value: pkg.label },
                    { label: "Credits",  value: `${pkg.credits} cr` },
                    ...(pkg.bonus > 0 ? [{ label: "🎁 Bonus credits", value: `+${pkg.bonus} cr`, green: true }] : []),
                    { label: "Payment",  value: paymentMethod.toUpperCase() },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <span className={`text-sm ${(row as any).green ? "text-emerald-600 font-semibold" : "text-stone-500"}`}>{row.label}</span>
                      <span className={`text-sm font-bold ${(row as any).green ? "text-emerald-600" : "text-stone-800"}`}>{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-stone-100 pt-3 mt-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-bold text-stone-700">You pay</span>
                      <span className="font-fraunces text-xl font-black text-amber-600">₱{pkg.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-stone-700">You get</span>
                      <span className="font-fraunces text-xl font-black text-emerald-600">{pkg.credits + pkg.bonus} cr</span>
                    </div>
                  </div>
                </div>

                <button onClick={handleTopUp} disabled={processing}
                  className={`w-full py-3.5 rounded-xl text-sm font-black border-0 cursor-pointer transition-all font-sans ${
                    processing ? "bg-stone-200 text-stone-400 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md"
                  }`}>
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⟳</span> Processing...
                    </span>
                  ) : `Pay ₱${pkg.price.toLocaleString()} →`}
                </button>
                <p className="text-[10px] text-stone-300 text-center mt-3 font-medium">Secured by PayMongo · GCash · Maya</p>
              </div>
            </div>
          )
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
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