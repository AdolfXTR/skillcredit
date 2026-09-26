"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminProfile = { id: string; full_name: string | null; username: string; credits: number; role: string; is_verified: boolean | null; avatar_url: string | null; created_at: string };
type Dispute = { id: string; reason: string; status: string; filed_by: string };
type EscrowRow = { id: string; session_id: string; amount: number; status: string; created_at: string; session: { id: string; status: string; teacher_id: string; learner_id: string; listing: { title: string } | null; disputes: Dispute[] } | null };
type Tab = "overview" | "users" | "escrow";

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [escrows, setEscrows] = useState<EscrowRow[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<AdminProfile | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ users: 0, listings: 0, sessions: 0, completed: 0, disputes: 0, escrow: 0 });

  useEffect(() => { void load(); }, []);

  async function load() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("id,full_name,username,credits,role,is_verified,avatar_url,created_at").eq("id", user.id).single();
    if (profileError || !profile || profile.role !== "admin") { window.location.href = "/dashboard"; return; }
    setAdmin(profile);
    const [usersRes, listingsRes, sessionsRes, completedRes, disputesRes, escrowRes] = await Promise.all([
      supabase.from("profiles").select("id,full_name,username,credits,role,is_verified,avatar_url,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("sessions").select("id", { count: "exact", head: true }),
      supabase.from("sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
      supabase.from("escrow").select("*, session:sessions(id,status,teacher_id,learner_id,listing:listings(title),disputes(id,reason,status,filed_by))").order("created_at", { ascending: false }).limit(100),
    ]);
    if (usersRes.error || listingsRes.error || sessionsRes.error || completedRes.error || disputesRes.error || escrowRes.error) {
      setError(usersRes.error?.message || listingsRes.error?.message || sessionsRes.error?.message || completedRes.error?.message || disputesRes.error?.message || escrowRes.error?.message || "Could not load admin data.");
    }
    setUsers((usersRes.data || []) as AdminProfile[]);
    setEscrows((escrowRes.data || []) as unknown as EscrowRow[]);
    setStats({ users: usersRes.count || 0, listings: listingsRes.count || 0, sessions: sessionsRes.count || 0, completed: completedRes.count || 0, disputes: disputesRes.count || 0, escrow: (escrowRes.data || []).filter(row => row.status === "locked" || row.status === "disputed").reduce((sum, row) => sum + row.amount, 0) });
  }

  async function verifyUser(target: AdminProfile) {
    setBusy(target.id); setMessage("");
    const { error: updateError } = await supabase.from("profiles").update({ is_verified: !target.is_verified }).eq("id", target.id);
    if (updateError) setError(updateError.message);
    else { setMessage(`${target.full_name || target.username} verification updated.`); await load(); }
    setBusy(null);
  }

  async function adjustCredits() {
    if (!editUser || !admin) return;
    const amount = Number(creditAmount);
    if (!Number.isSafeInteger(amount) || amount === 0) return;
    setBusy(editUser.id); setError(""); setMessage("");
    const { error: adjustmentError } = await supabase.rpc("increment_credits", { user_id: editUser.id, amount });
    if (adjustmentError) { setError(adjustmentError.message); setBusy(null); return; }
    const { error: ledgerError } = await supabase.from("credit_transactions").insert({ user_id: editUser.id, amount, type: "admin_adjustment", description: note.trim() || `Credit adjustment by ${admin.username}` });
    if (ledgerError) {
      const { error: rollbackError } = await supabase.rpc("increment_credits", { user_id: editUser.id, amount: -amount });
      setError(rollbackError ? `Credit adjustment completed but history and rollback failed: ${ledgerError.message}` : `Adjustment was rolled back because history could not be recorded: ${ledgerError.message}`);
      setBusy(null); return;
    }
    setMessage(`Adjusted ${editUser.username}'s balance by ${amount} credits.`);
    setEditUser(null); setCreditAmount(""); setNote(""); await load(); setBusy(null);
  }

  async function resolveEscrow(row: EscrowRow, resolution: "release_to_teacher" | "refund_to_learner") {
    if (!admin || !row.session) return;
    const recipientId = resolution === "release_to_teacher" ? row.session.teacher_id : row.session.learner_id;
    const finalEscrowStatus = resolution === "release_to_teacher" ? "released" : "refunded";
    const finalSessionStatus = resolution === "release_to_teacher" ? "completed" : "cancelled";
    setBusy(row.id); setError(""); setMessage("");
    const { data: claimed, error: claimError } = await supabase.from("escrow").update({ status: finalEscrowStatus })
      .eq("id", row.id).eq("status", row.status).select("id").maybeSingle();
    if (claimError || !claimed) { setError(claimError?.message || "This escrow has already changed. Refresh and retry."); setBusy(null); return; }
    const { error: creditError } = await supabase.rpc("increment_credits", { user_id: recipientId, amount: row.amount });
    if (creditError) {
      await supabase.from("escrow").update({ status: row.status }).eq("id", row.id).eq("status", finalEscrowStatus);
      setError(creditError.message); setBusy(null); return;
    }
    const transactionType = resolution === "release_to_teacher" ? "session_earn" : "session_refund";
    const { error: ledgerError } = await supabase.from("credit_transactions").insert({ user_id: recipientId, amount: row.amount, type: transactionType, reference_id: row.session_id, description: `Admin dispute resolution: ${row.amount} credits ${resolution === "release_to_teacher" ? "released" : "refunded"}` });
    if (ledgerError) {
      const { error: rollbackError } = await supabase.rpc("increment_credits", { user_id: recipientId, amount: -row.amount });
      if (!rollbackError) await supabase.from("escrow").update({ status: row.status }).eq("id", row.id).eq("status", finalEscrowStatus);
      setError(rollbackError ? `Credits were applied but the history entry failed: ${ledgerError.message}` : `Resolution rolled back because history could not be saved: ${ledgerError.message}`);
      setBusy(null); return;
    }
    await supabase.from("sessions").update({ status: finalSessionStatus }).eq("id", row.session_id).eq("status", "disputed");
    await supabase.from("disputes").update({ status: "resolved", resolution_type: resolution, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq("session_id", row.session_id).in("status", ["open", "under_review"]);
    await supabase.from("notifications").insert({ user_id: recipientId, type: "dispute", title: "Dispute resolved", body: resolution === "release_to_teacher" ? `${row.amount} credits were released to you.` : `${row.amount} credits were returned to you.`, link: "/sessions" });
    setMessage(`Escrow resolved: ${row.amount} credits ${resolution === "release_to_teacher" ? "released to the teacher" : "refunded to the learner"}.`);
    await load(); setBusy(null);
  }

  const filteredUsers = useMemo(() => users.filter(user => `${user.full_name || ""} ${user.username}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const activeEscrows = escrows.filter(row => row.status === "locked" || row.status === "disputed");

  if (!admin) return <main className="sc-shell" style={{ display: "grid", placeItems: "center" }}>Loading administration…</main>;

  return <main className="sc-shell" style={{ paddingBottom: 56 }}>
    <header style={{ background: "#fffefa", borderBottom: "1px solid var(--sc-border)" }}><div className="sc-container" style={{ minHeight: 68, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <a href="/dashboard" style={{ color: "var(--sc-forest)", fontFamily: "Fraunces,serif", fontWeight: 900, fontSize: 21, textDecoration: "none" }}>SkillCredit <span style={{ color: "var(--sc-muted)", font: "600 12px 'DM Sans',sans-serif", marginLeft: 8 }}>Administration</span></a>
      <a href="/dashboard" className="sc-button">Back to dashboard</a>
    </div></header>
    <div className="sc-container" style={{ paddingTop: 32 }}>
      <p className="sc-eyebrow">Operations</p><h1 style={{ font: "900 34px Fraunces,serif", margin: "6px 0" }}>Keep the exchange running</h1>
      <p style={{ color: "var(--sc-muted)", margin: 0 }}>Member accounts, credit corrections, and session disputes.</p>
      {(error || message) && <div role="status" style={{ marginTop: 16, padding: 13, borderRadius: 12, background: error ? "#fcebea" : "#e7f1e9", color: error ? "#9e3125" : "#214c39" }}>{error || message}</div>}
      <nav aria-label="Admin sections" style={{ display: "flex", gap: 8, margin: "24px 0 18px", flexWrap: "wrap" }}>{([ ["overview", "Overview"], ["users", "Members"], ["escrow", "Escrow & disputes"] ] as [Tab,string][]).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`sc-button ${tab === key ? "sc-button-primary" : ""}`}>{label}</button>)}</nav>
      {tab === "overview" && <>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          {[["Members",stats.users], ["Listings",stats.listings], ["Sessions",stats.sessions], ["Completed",stats.completed], ["Open disputes",stats.disputes], ["Credits held",`${stats.escrow} cr`]].map(([label,value]) => <article key={label} className="sc-panel" style={{ padding: 18 }}><div className="sc-eyebrow">{label}</div><strong style={{ display: "block", font: "900 27px Fraunces,serif", marginTop: 8 }}>{value}</strong></article>)}
        </section>
        <section style={{ marginTop: 28 }}><h2 style={{ font: "800 23px Fraunces,serif" }}>Needs attention</h2>{activeEscrows.filter(row => row.status === "disputed").length ? activeEscrows.filter(row => row.status === "disputed").map(row => <EscrowCard key={row.id} row={row} busy={busy} onResolve={resolveEscrow} />) : <p className="sc-panel" style={{ padding: 18, color: "var(--sc-muted)" }}>No disputes are waiting for review.</p>}</section>
      </>}
      {tab === "users" && <section className="sc-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}><div><h2 style={{ font: "800 23px Fraunces,serif", margin: 0 }}>Member accounts</h2><p style={{ color: "var(--sc-muted)", margin: "4px 0 0", fontSize: 13 }}>Search members and make a documented credit correction.</p></div><input className="sc-field" aria-label="Search members" placeholder="Name or username" value={search} onChange={event => setSearch(event.target.value)} style={{ maxWidth: 280 }} /></div>
        {filteredUsers.map(user => <div key={user.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) auto auto", gap: 14, alignItems: "center", padding: "13px 0", borderTop: "1px solid var(--sc-border)" }}><div><strong>{user.full_name || user.username}</strong><div style={{ color: "var(--sc-muted)", fontSize: 12 }}>@{user.username} · {user.credits} credits</div></div><button className="sc-button" disabled={!!busy} onClick={() => void verifyUser(user)}>{busy === user.id ? "Saving…" : user.is_verified ? "Remove verification" : "Verify member"}</button><button className="sc-button sc-button-primary" onClick={() => { setEditUser(user); setCreditAmount(""); setNote(""); }}>Adjust credits</button></div>)}
        {!filteredUsers.length && <p style={{ color: "var(--sc-muted)" }}>No matching members.</p>}
      </section>}
      {tab === "escrow" && <section><div style={{ marginBottom: 14 }}><h2 style={{ font: "800 23px Fraunces,serif", margin: 0 }}>Escrow and disputes</h2><p style={{ color: "var(--sc-muted)", margin: "4px 0 0", fontSize: 13 }}>Resolve a hold by releasing credits to the teacher or refunding the learner.</p></div>{activeEscrows.length ? activeEscrows.map(row => <EscrowCard key={row.id} row={row} busy={busy} onResolve={resolveEscrow} />) : <p className="sc-panel" style={{ padding: 18, color: "var(--sc-muted)" }}>No credits are currently held.</p>}</section>}
    </div>
    {editUser && <div role="presentation" onClick={() => setEditUser(null)} style={{ position: "fixed", inset: 0, background: "#10201888", display: "grid", placeItems: "center", padding: 18, zIndex: 200 }}><section role="dialog" aria-modal="true" aria-labelledby="adjust-title" onClick={event => event.stopPropagation()} className="sc-panel" style={{ width: "min(440px,100%)", padding: 24 }}><h2 id="adjust-title" style={{ font: "800 23px Fraunces,serif", marginTop: 0 }}>Adjust member credits</h2><p style={{ color: "var(--sc-muted)" }}>@{editUser.username} · current balance {editUser.credits}</p><label style={{ display: "block", marginTop: 16 }}>Credit change<input className="sc-field" type="number" value={creditAmount} onChange={event => setCreditAmount(event.target.value)} placeholder="e.g. 10 or -5" /></label><label style={{ display: "block", marginTop: 12 }}>Reason<input className="sc-field" value={note} onChange={event => setNote(event.target.value)} placeholder="Reason for the correction" /></label><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button className="sc-button" onClick={() => setEditUser(null)}>Cancel</button><button className="sc-button sc-button-primary" disabled={!!busy || !creditAmount || Number(creditAmount) === 0} onClick={() => void adjustCredits()}>{busy ? "Saving…" : "Save adjustment"}</button></div></section></div>}
  </main>;
}

function EscrowCard({ row, busy, onResolve }: { row: EscrowRow; busy: string | null; onResolve: (row: EscrowRow, resolution: "release_to_teacher" | "refund_to_learner") => void }) {
  const dispute = row.session?.disputes?.find(item => item.status === "open" || item.status === "under_review");
  return <article className="sc-panel" style={{ display: "grid", gridTemplateColumns: "minmax(200px,1fr) auto", gap: 18, alignItems: "center", padding: 18, marginBottom: 10 }}>
    <div><div className="sc-eyebrow">{row.status === "disputed" ? "Dispute review" : "Session escrow"}</div><strong style={{ display: "block", fontSize: 17, marginTop: 5 }}>{row.session?.listing?.title || "Session"}</strong><p style={{ color: "var(--sc-muted)", fontSize: 13, margin: "5px 0" }}>{row.amount} credits · {new Date(row.created_at).toLocaleDateString()}</p>{dispute && <p style={{ margin: "8px 0 0", color: "#744c1d", lineHeight: 1.5 }}>{dispute.reason}</p>}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}><button className="sc-button sc-button-primary" disabled={!!busy || !row.session?.teacher_id} onClick={() => onResolve(row, "release_to_teacher")}>{busy === row.id ? "Working…" : "Release to teacher"}</button><button className="sc-button" disabled={!!busy || !row.session?.learner_id} onClick={() => onResolve(row, "refund_to_learner")}>Refund learner</button></div>
  </article>;
}
