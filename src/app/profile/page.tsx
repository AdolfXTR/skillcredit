"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; username: string; full_name: string; bio: string | null; location: string | null; avatar_url: string | null; credits: number };
type Listing = { id: string; title: string; description: string; credit_price: number; duration: number; is_active: boolean };
type Review = { id: string; overall: number; review: string | null; created_at: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [form, setForm] = useState({ full_name: "", bio: "", location: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const [profileRes, listingsRes, reviewsRes] = await Promise.all([
        supabase.from("profiles").select("id,username,full_name,bio,location,avatar_url,credits").eq("id", user.id).single(),
        supabase.from("listings").select("id,title,description,credit_price,duration,is_active").eq("teacher_id", user.id).order("created_at", { ascending: false }),
        supabase.from("ratings").select("id,overall,review,created_at").eq("rated_id", user.id).eq("is_flagged", false).order("created_at", { ascending: false }),
      ]);
      if (profileRes.data) {
        setProfile(profileRes.data);
        setForm({ full_name: profileRes.data.full_name || "", bio: profileRes.data.bio || "", location: profileRes.data.location || "" });
      }
      setListings(listingsRes.data || []);
      setReviews(reviewsRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.from("profiles").update({ full_name: form.full_name.trim(), bio: form.bio.trim() || null, location: form.location.trim() || null }).eq("id", profile.id);
    if (error) setMessage(error.message);
    else { setProfile({ ...profile, ...form }); setEditing(false); setMessage("Profile saved."); }
    setSaving(false);
  }

  if (loading) return <main style={{ minHeight: "100vh", background: "#f7f4ef" }}><Navbar /><p style={{ textAlign: "center", padding: 60 }}>Loading profile…</p></main>;
  if (!profile) return null;
  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.overall, 0) / reviews.length).toFixed(1) : "—";

  return <main style={{ minHeight: "100vh", background: "#f7f4ef", color: "#18241d", fontFamily: "'DM Sans',sans-serif" }}>
    <Navbar />
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 20px 72px" }}>
      <section style={{ background: "white", border: "1px solid #e8e2d9", borderRadius: 22, padding: 28, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#2d6a4f", color: "white", display: "grid", placeItems: "center", fontSize: 25, fontWeight: 800, overflow: "hidden" }}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : profile.full_name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 220 }}><h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 30, margin: 0 }}>{profile.full_name}</h1><p style={{ margin: "5px 0", color: "#718078" }}>@{profile.username}{profile.location ? ` · ${profile.location}` : ""}</p><p style={{ margin: "10px 0 0", lineHeight: 1.6 }}>{profile.bio || "Add a short introduction so other members can get to know you."}</p></div>
        <button onClick={() => { setEditing(!editing); setMessage(""); }} style={{ border: "1px solid #d7e5d9", background: "#f4faf5", color: "#2d6a4f", borderRadius: 10, padding: "10px 15px", fontWeight: 700, cursor: "pointer" }}>{editing ? "Close editor" : "Edit profile"}</button>
      </section>
      {message && <p role="status" style={{ color: message === "Profile saved." ? "#2d6a4f" : "#b42318" }}>{message}</p>}
      {editing && <section style={{ background: "white", border: "1px solid #e8e2d9", borderRadius: 18, padding: 22, marginTop: 16, display: "grid", gap: 12 }}>
        <label>Name<input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} style={inputStyle} /></label>
        <label>Location<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inputStyle} /></label>
        <label>About you<textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={4} style={inputStyle} /></label>
        <button onClick={saveProfile} disabled={saving || !form.full_name.trim()} style={buttonStyle}>{saving ? "Saving…" : "Save profile"}</button>
      </section>}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 18 }}>
        {[ ["Credits", `${profile.credits} cr`, "/wallet"], ["Listings", String(listings.length), "/listings/create"], ["Rating", `${average} (${reviews.length})`, "#reviews"] ].map(([label, value, href]) => <a key={label} href={href} style={{ background: "white", border: "1px solid #e8e2d9", borderRadius: 16, padding: 18, textDecoration: "none", color: "inherit" }}><span style={{ display: "block", color: "#718078", fontSize: 13 }}>{label}</span><strong style={{ display: "block", fontSize: 22, marginTop: 5 }}>{value}</strong></a>)}
      </section>
      <section style={{ marginTop: 30 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><h2 style={headingStyle}>Your listings</h2><a href="/listings/create" style={{ color: "#2d6a4f", fontWeight: 700, textDecoration: "none" }}>Create listing →</a></div>
        {listings.length ? listings.map(listing => <a key={listing.id} href={`/listings/${listing.id}`} style={rowStyle}><div><strong>{listing.title}</strong><p style={{ color: "#718078", margin: "5px 0 0", fontSize: 13 }}>{listing.duration} min · {listing.credit_price} credits · {listing.is_active ? "Active" : "Inactive"}</p></div><span>→</span></a>) : <p style={emptyStyle}>You have not created a listing yet.</p>}
      </section>
      <section id="reviews" style={{ marginTop: 30 }}><h2 style={headingStyle}>Recent reviews</h2>{reviews.length ? reviews.slice(0, 10).map(review => <article key={review.id} style={rowStyle}><div><strong>{"★".repeat(review.overall)}{"☆".repeat(5 - review.overall)}</strong>{review.review && <p style={{ color: "#59665e", margin: "6px 0 0" }}>{review.review}</p>}</div><time style={{ color: "#89948d", fontSize: 12 }}>{new Date(review.created_at).toLocaleDateString()}</time></article>) : <p style={emptyStyle}>Reviews from completed sessions will appear here.</p>}</section>
    </div>
  </main>;
}

const inputStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: 11, borderRadius: 9, border: "1px solid #d8ded9", font: "inherit", boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { justifySelf: "start", background: "#2d6a4f", color: "white", border: 0, padding: "11px 17px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
const headingStyle: React.CSSProperties = { fontFamily: "'Fraunces',serif", fontSize: 23, margin: "0 0 12px" };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", marginBottom: 8, borderRadius: 14, background: "white", border: "1px solid #e8e2d9", color: "inherit", textDecoration: "none" };
const emptyStyle: React.CSSProperties = { background: "white", border: "1px solid #e8e2d9", borderRadius: 14, padding: 20, color: "#718078" };
