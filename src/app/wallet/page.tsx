"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string;
  username: string;
  credits: number;
};

const typeConfig: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  signup_bonus: { icon: "🎁", color: "#2d6a4f", bg: "#e8f4e8", label: "Signup Bonus" },
  session_earned: { icon: "📚", color: "#2d6a4f", bg: "#e8f4e8", label: "Session Earned" },
  session_spent: { icon: "📖", color: "#dc2626", bg: "#fef2f2", label: "Session Booked" },
  bounty_earned: { icon: "🏆", color: "#2d6a4f", bg: "#e8f4e8", label: "Bounty Won" },
  bounty_posted: { icon: "🎯", color: "#dc2626", bg: "#fef2f2", label: "Bounty Posted" },
  topup: { icon: "💳", color: "#0369a1", bg: "#e0f2fe", label: "Top Up" },
  forum_earned: { icon: "💬", color: "#2d6a4f", bg: "#e8f4e8", label: "Forum Answer" },
  refund: { icon: "↩️", color: "#7c3aed", bg: "#f0f4ff", label: "Refund" },
  default: { icon: "💰", color: "#555", bg: "#f5f5f0", label: "Transaction" },
};

const topUpPackages = [
  { credits: 50, price: 500, label: "Starter", popular: false, bonus: 0 },
  { credits: 120, price: 1000, label: "Popular", popular: true, bonus: 20 },
  { credits: 260, price: 2000, label: "Value", popular: false, bonus: 60 },
  { credits: 550, price: 4000, label: "Pro", popular: false, bonus: 150 },
];

export default function WalletPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "topup" | "history">("overview");
  const [selectedPackage, setSelectedPackage] = useState<number | null>(1);
  const [paymentMethod, setPaymentMethod] = useState("gcash");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (prof) setProfile(prof);

      const { data: txns } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (txns) setTransactions(txns);
      setLoading(false);
    };
    init();
  }, []);

  const handleTopUp = async () => {
    if (selectedPackage === null || !profile) return;
    setProcessing(true);

    const pkg = topUpPackages[selectedPackage];
    const totalCredits = pkg.credits + pkg.bonus;

    // Simulate PayMongo payment (in real app, redirect to PayMongo checkout)
    await new Promise((r) => setTimeout(r, 2000));

    // Add credits to profile
    await supabase.from("profiles")
      .update({ credits: (profile.credits || 0) + totalCredits })
      .eq("id", profile.id);

    // Log transaction
    await supabase.from("credit_transactions").insert({
      user_id: profile.id,
      amount: totalCredits,
      type: "topup",
      description: `Top up — ${pkg.label} package (${pkg.credits} + ${pkg.bonus} bonus credits) via ${paymentMethod.toUpperCase()}`,
    });

    setProfile((p) => p ? { ...p, credits: p.credits + totalCredits } : p);
    setProcessing(false);
    setSuccess(true);
  };

  const totalEarned = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#fffdf7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>💰</div>
          <p style={{ color: "#888", marginTop: 12 }}>Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: "white", borderBottom: "1px solid #e8e0d0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/dashboard" style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 800, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/dashboard" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Dashboard</a>
          <a href="/listings" style={{ padding: "7px 14px", borderRadius: 8, color: "#555", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse</a>
          <div style={{ background: "#e8f4e8", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>💰</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>{profile?.credits} credits</span>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 32, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>My Wallet 💰</h1>
          <p style={{ fontSize: 15, color: "#888" }}>Manage your credits and top up anytime</p>
        </div>

        {/* Balance card */}
        <div style={{ background: "linear-gradient(135deg, #2d6a4f, #1b4332)", borderRadius: 24, padding: "32px", marginBottom: 24, color: "white", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", bottom: -30, left: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Available Balance</p>
          <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 52, fontWeight: 900, margin: "0 0 4px" }}>{profile?.credits}</p>
          <p style={{ fontSize: 15, opacity: 0.7, marginBottom: 24 }}>credits · ₱{(profile?.credits || 0) * 10} equivalent</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setActiveTab("topup")}
              style={{ padding: "12px 28px", background: "white", color: "#2d6a4f", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              + Top Up Credits
            </button>
            <button
              onClick={() => setActiveTab("history")}
              style={{ padding: "12px 28px", background: "rgba(255,255,255,0.15)", color: "white", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              View History
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { icon: "⬆️", label: "Total Earned", value: totalEarned, color: "#2d6a4f", bg: "#e8f4e8" },
            { icon: "⬇️", label: "Total Spent", value: totalSpent, color: "#dc2626", bg: "#fef2f2" },
            { icon: "📊", label: "Transactions", value: transactions.length, color: "#0369a1", bg: "#e0f2fe" },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #e8e0d0" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 12 }}>
                {s.icon}
              </div>
              <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 26, fontWeight: 800, color: s.color, margin: "0 0 2px" }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "white", borderRadius: 14, padding: 4, marginBottom: 24, border: "1px solid #e8e0d0", width: "fit-content" }}>
          {[
            { key: "overview", label: "Overview" },
            { key: "topup", label: "💳 Top Up" },
            { key: "history", label: "📋 History" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as typeof activeTab); setSuccess(false); }}
              style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: activeTab === tab.key ? "#2d6a4f" : "transparent", color: activeTab === tab.key ? "white" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>How to earn credits 💡</h3>
              {[
                { icon: "🎓", action: "Teach a session", credits: "+session price" },
                { icon: "🏆", action: "Win a bounty (1st place)", credits: "+60% of reward" },
                { icon: "💬", action: "Answer forum questions", credits: "+2 credits" },
                { icon: "📅", action: "Daily challenges", credits: "+3–5 credits" },
                { icon: "🎁", action: "Signup bonus", credits: "+20 credits" },
              ].map((item) => (
                <div key={item.action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f5f0e8" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span>{item.icon}</span>
                    <span style={{ fontSize: 13, color: "#333" }}>{item.action}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6a4f" }}>{item.credits}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>Recent transactions</h3>
              {transactions.slice(0, 5).map((txn) => {
                const cfg = typeConfig[txn.type] || typeConfig.default;
                return (
                  <div key={txn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f5f0e8" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#333", margin: 0 }}>{cfg.label}</p>
                        <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{new Date(txn.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: txn.amount > 0 ? "#2d6a4f" : "#dc2626" }}>
                      {txn.amount > 0 ? "+" : ""}{txn.amount}
                    </span>
                  </div>
                );
              })}
              {transactions.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>No transactions yet</p>}
            </div>
          </div>
        )}

        {/* Top Up tab */}
        {activeTab === "topup" && (
          <div>
            {success ? (
              <div style={{ background: "white", borderRadius: 24, padding: "60px 40px", textAlign: "center", border: "1px solid #e8e0d0" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>Credits Added!</h2>
                <p style={{ color: "#666", fontSize: 15, marginBottom: 8 }}>
                  Your wallet has been topped up successfully.
                </p>
                <div style={{ background: "#e8f4e8", borderRadius: 12, padding: "16px 24px", display: "inline-block", marginBottom: 28 }}>
                  <p style={{ fontSize: 14, color: "#2d6a4f", fontWeight: 600, margin: 0 }}>
                    💰 New balance: <strong>{profile?.credits} credits</strong>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  <a href="/listings" style={{ padding: "12px 28px", background: "#2d6a4f", color: "white", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>Browse Skills →</a>
                  <button onClick={() => setSuccess(false)} style={{ padding: "12px 28px", background: "#f5f0e8", color: "#555", border: "none", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Top up more</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
                <div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 16 }}>Choose a package</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                    {topUpPackages.map((pkg, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedPackage(i)}
                        style={{ background: selectedPackage === i ? "#e8f4e8" : "white", borderRadius: 16, padding: "20px", border: `2px solid ${selectedPackage === i ? "#2d6a4f" : "#e8e0d0"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}
                      >
                        {pkg.popular && (
                          <span style={{ position: "absolute", top: -10, right: 16, background: "#2d6a4f", color: "white", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>MOST POPULAR</span>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 4 }}>{pkg.label}</p>
                        <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 800, color: "#1a1a1a", margin: "0 0 2px" }}>{pkg.credits} <span style={{ fontSize: 14, fontWeight: 600 }}>credits</span></p>
                        {pkg.bonus > 0 && <p style={{ fontSize: 12, color: "#2d6a4f", fontWeight: 600, margin: "0 0 8px" }}>+ {pkg.bonus} bonus credits!</p>}
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#b45309", margin: 0 }}>₱{pkg.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 12 }}>Payment method</h3>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { key: "gcash", label: "GCash", icon: "📱" },
                      { key: "maya", label: "Maya", icon: "💚" },
                      { key: "card", label: "Credit Card", icon: "💳" },
                    ].map((method) => (
                      <div
                        key={method.key}
                        onClick={() => setPaymentMethod(method.key)}
                        style={{ flex: 1, background: paymentMethod === method.key ? "#e8f4e8" : "white", borderRadius: 12, padding: "14px", border: `2px solid ${paymentMethod === method.key ? "#2d6a4f" : "#e8e0d0"}`, cursor: "pointer", textAlign: "center" }}
                      >
                        <span style={{ fontSize: 24 }}>{method.icon}</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#333", margin: "6px 0 0" }}>{method.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order summary */}
                <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0", height: "fit-content" }}>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 20 }}>Order Summary</h3>
                  {selectedPackage !== null && (
                    <>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, color: "#666" }}>Package</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{topUpPackages[selectedPackage].label}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, color: "#666" }}>Credits</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{topUpPackages[selectedPackage].credits}</span>
                        </div>
                        {topUpPackages[selectedPackage].bonus > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 13, color: "#2d6a4f" }}>Bonus credits 🎁</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#2d6a4f" }}>+{topUpPackages[selectedPackage].bonus}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, color: "#666" }}>Payment via</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{paymentMethod.toUpperCase()}</span>
                        </div>
                        <div style={{ height: 1, background: "#e8e0d0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>Total you pay</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#b45309" }}>₱{topUpPackages[selectedPackage].price.toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>Credits you get</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#2d6a4f" }}>{topUpPackages[selectedPackage].credits + topUpPackages[selectedPackage].bonus} cr</span>
                        </div>
                      </div>
                      <button
                        onClick={handleTopUp}
                        disabled={processing}
                        style={{ width: "100%", padding: "14px", background: processing ? "#a8c5b5" : "#2d6a4f", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: processing ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {processing ? "Processing payment..." : `Pay ₱${topUpPackages[selectedPackage].price.toLocaleString()} →`}
                      </button>
                      <p style={{ fontSize: 11, color: "#aaa", textAlign: "center", marginTop: 10 }}>
                        Secured by PayMongo · GCash · Maya
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {activeTab === "history" && (
          <div style={{ background: "white", borderRadius: 20, padding: "24px", border: "1px solid #e8e0d0" }}>
            <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 20 }}>Transaction History</h3>
            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <span style={{ fontSize: 40 }}>📋</span>
                <p style={{ color: "#888", marginTop: 12 }}>No transactions yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {transactions.map((txn, i) => {
                  const cfg = typeConfig[txn.type] || typeConfig.default;
                  return (
                    <div key={txn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < transactions.length - 1 ? "1px solid #f5f0e8" : "none" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                          {cfg.icon}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#333", margin: "0 0 2px" }}>{cfg.label}</p>
                          <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>{txn.description}</p>
                          <p style={{ fontSize: 11, color: "#ccc", margin: 0 }}>{new Date(txn.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: txn.amount > 0 ? "#2d6a4f" : "#dc2626", flexShrink: 0 }}>
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