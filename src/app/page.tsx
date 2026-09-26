import Link from "next/link";

const steps = [
  ["01", "Find a skill", "Browse teacher listings and choose a session that fits."],
  ["02", "Book with credits", "Request a time. Your credits stay in escrow while the session is arranged."],
  ["03", "Learn and complete", "The teacher confirms the time. Both people mark the session complete to release credits."],
];

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ef", color: "#18241d", fontFamily: "'DM Sans',sans-serif" }}>
      <header style={{ height: 72, padding: "0 7vw", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #e8e2d9" }}>
        <Link href="/" style={{ fontFamily: "'Fraunces',serif", fontSize: 23, fontWeight: 900, color: "#2d6a4f", textDecoration: "none" }}>SkillCredit</Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/listings" style={{ color: "#425047", textDecoration: "none", fontWeight: 600 }}>Browse skills</Link>
          <Link href="/login" style={{ color: "#425047", textDecoration: "none", fontWeight: 600 }}>Log in</Link>
          <Link href="/signup" style={{ color: "white", background: "#2d6a4f", borderRadius: 999, padding: "10px 18px", textDecoration: "none", fontWeight: 700 }}>Join SkillCredit</Link>
        </nav>
      </header>
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "100px 28px 88px", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(260px,.8fr)", gap: 56, alignItems: "center" }}>
        <div>
          <p style={{ color: "#2d6a4f", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>Learn from each other</p>
          <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: "clamp(42px,6vw,68px)", lineHeight: 1.04, margin: "18px 0", letterSpacing: "-.04em" }}>Trade what you know for what you want to learn.</h1>
          <p style={{ color: "#69756d", lineHeight: 1.75, fontSize: 18, maxWidth: 600 }}>Find a peer teacher, book a session with credits, and exchange skills through a simple, protected process.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
            <Link href="/listings" style={{ color: "white", background: "#2d6a4f", borderRadius: 12, padding: "14px 21px", textDecoration: "none", fontWeight: 800 }}>Browse listings →</Link>
            <Link href="/signup" style={{ color: "#2d6a4f", background: "white", border: "1px solid #d7e5d9", borderRadius: 12, padding: "14px 21px", textDecoration: "none", fontWeight: 800 }}>Create an account</Link>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 24, padding: 28, border: "1px solid #e8e2d9", boxShadow: "0 16px 48px #1f34200c" }}>
          <p style={{ color: "#718078", fontSize: 13, fontWeight: 700, margin: "0 0 20px" }}>HOW THE EXCHANGE WORKS</p>
          {steps.map(([number, title, detail]) => <div key={number} style={{ display: "flex", gap: 15, padding: "15px 0", borderTop: "1px solid #f0eee8" }}><span style={{ color: "#2d6a4f", fontWeight: 900 }}>{number}</span><div><strong>{title}</strong><p style={{ color: "#718078", fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>{detail}</p></div></div>)}
        </div>
      </section>
      <section style={{ background: "#fff", padding: "54px 7vw", borderTop: "1px solid #e8e2d9" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 28 }}>
          {[["Peer learning", "Teach a skill you know and learn something new from another member."], ["Credit escrow", "Credits are held for the session and released after both people confirm completion."], ["Reviews", "After a completed session, both people can leave a star rating and optional review."]].map(([title, detail]) => <article key={title}><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20 }}>{title}</h2><p style={{ color: "#718078", lineHeight: 1.7, fontSize: 14 }}>{detail}</p></article>)}
        </div>
      </section>
    </main>
  );
}
