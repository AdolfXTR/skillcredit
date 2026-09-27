"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bayesianAvg } from "@/lib/ratings";

type Listing = {
  id: string;
  title: string;
  credit_price: number;
  duration: number;
  thumbnail_url: string | null;
  teacher_id: string;
  skills: { name: string; category: string } | null;
  profiles: { full_name: string; username: string; avatar_url: string | null } | null;
  rating?: number;
  ratingCount?: number;
};

const categoryColors: Record<string, string> = {
  Programming: "#d9e7f4",
  Design: "#f2dfe8",
  Language: "#dcebe2",
  Academic: "#e5e0f2",
  Music: "#f2e5cb",
  Arts: "#f1dfd8",
  Media: "#d9e9ec",
  Science: "#dcebe8",
  Sports: "#e5ebd8",
  Lifestyle: "#f1e4d8",
};

const steps = [
  { number: "01", title: "Find a skill", detail: "Browse listings for something you want to learn." },
  { number: "02", title: "Book a session", detail: "Request a time. Credits move into escrow." },
  { number: "03", title: "Teacher confirms", detail: "Your teacher accepts the session request." },
  { number: "04", title: "Meet and learn", detail: "Take the session together." },
  { number: "05", title: "Both mark complete", detail: "You and your teacher confirm it is done." },
  { number: "06", title: "Credits release", detail: "Escrow releases credits to the teacher." },
];

function initials(name?: string | null) {
  return (name || "SkillCredit").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function ListingCard({ listing, index }: { listing: Listing; index: number }) {
  const category = listing.skills?.category || "Skill";
  const teacher = listing.profiles?.full_name || "SkillCredit teacher";

  return (
    <Link href={`/listings/${listing.id}`} className={`home-listing home-listing-${index}`}>
      <div className="home-listing-art" style={{ backgroundColor: categoryColors[category] || "#e3e9e8" }}>
        {listing.thumbnail_url ? <img src={listing.thumbnail_url} alt="" /> : <span>{category.slice(0, 1)}</span>}
        <span className="home-category">{category}</span>
      </div>
      <div className="home-listing-body">
        <div className="home-listing-meta">
          <span>{listing.skills?.name || category}</span>
          <span>·</span>
          <span>{listing.duration} min</span>
        </div>
        <h3>{listing.title}</h3>
        <div className="home-teacher-row">
          <span className="home-avatar">
            {listing.profiles?.avatar_url ? <img src={listing.profiles.avatar_url} alt="" /> : initials(teacher)}
          </span>
          <span className="home-teacher-name">{teacher}</span>
          <span className="home-rating" aria-label={listing.rating ? `Rated ${listing.rating} out of 5` : "New teacher"}>
            <span aria-hidden="true">★</span> {listing.rating ? listing.rating.toFixed(1) : "New"}
            {listing.ratingCount ? <small>({listing.ratingCount})</small> : null}
          </span>
        </div>
        <div className="home-price-row">
          <span>Per session</span>
          <strong>{listing.credit_price} <small>credits</small></strong>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingState, setListingState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let active = true;
    async function loadListings() {
      try {
        const { data, error } = await supabase
          .from("listings")
          .select("id,title,credit_price,duration,thumbnail_url,teacher_id,skills(name,category),profiles(full_name,username,avatar_url)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;
        if (!data?.length) {
          if (active) setListingState("empty");
          return;
        }

        const rows = data as unknown as Listing[];
        const teacherIds = [...new Set(rows.map((listing) => listing.teacher_id))];
        let ratings: { rated_id: string; overall: number }[] | null = null;
        try {
          const result = await supabase
            .from("ratings")
            .select("rated_id,overall")
            .in("rated_id", teacherIds)
            .eq("is_flagged", false);
          if (!result.error) ratings = result.data;
        } catch {
          // Keep the listing visible even if the optional rating lookup is unavailable.
        }

        const grouped: Record<string, number[]> = {};
        ratings?.forEach((rating) => {
          (grouped[rating.rated_id] ||= []).push(rating.overall);
        });
        const ratedRows = rows.map((listing) => {
          const teacherRatings = grouped[listing.teacher_id] || [];
          return {
            ...listing,
            rating: teacherRatings.length ? Number(bayesianAvg(teacherRatings).toFixed(1)) : undefined,
            ratingCount: teacherRatings.length,
          };
        });

        if (active) {
          setListings(ratedRows);
          setListingState("ready");
        }
      } catch {
        if (active) setListingState("error");
      }
    }

    void loadListings();
    return () => { active = false; };
  }, []);

  return (
    <main className="home-page">
      <style>{`
        .home-page{--ink:#18241d;--muted:#68756d;--line:#e5e0d5;--green:#2d6a4f;--gold:#b47b22;min-height:100vh;background:#f7f4ef;color:var(--ink);font-family:"DM Sans",sans-serif;overflow:hidden}
        .home-page *{box-sizing:border-box}
        .home-page a{text-decoration:none;color:inherit}
        .home-topbar{height:68px;padding:0 max(28px,calc((100vw - 1240px)/2));display:flex;align-items:center;justify-content:space-between;background:#fffefa;border-bottom:1px solid var(--line)}
        .home-brand{font-family:"Fraunces",serif;font-size:21px;font-weight:900;letter-spacing:-.06em;color:var(--ink)!important}
        .home-brand span{color:var(--green)}
        .home-nav{display:flex;align-items:center;gap:28px;font-size:13px;font-weight:700}
        .home-nav a:not(.home-nav-join){color:#52616a;transition:color .18s}
        .home-nav a:not(.home-nav-join):hover{color:var(--green)}
        .home-nav-join{padding:10px 16px;border-radius:8px;background:var(--green);color:#fff!important;transition:transform .18s,background .18s}
        .home-nav-join:hover{background:var(--green);transform:translateY(-1px)}
        .home-hero{width:min(1240px,calc(100% - 56px));margin:0 auto;padding:52px 0 66px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.82fr);gap:50px;align-items:center}
        .home-kicker{display:flex;align-items:center;gap:9px;color:#4b626c;font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
        .home-kicker-mark{width:25px;height:25px;display:grid;place-items:center;background:#dfe9e5;border-radius:7px;color:var(--green);font-size:15px}
        .home-headline{max-width:660px;margin:22px 0 19px;font-family:"Fraunces",serif;font-size:clamp(48px,6vw,78px);line-height:.99;letter-spacing:-.065em;font-weight:800}
        .home-headline em{font-weight:700;color:var(--green);font-style:italic}
        .home-lede{max-width:480px;margin:0;color:#5d6a71;font-size:16px;line-height:1.7}
        .home-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:27px}
        .home-primary,.home-secondary{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 17px;border-radius:8px;font-size:13px;font-weight:800;transition:transform .18s,box-shadow .18s,background .18s}
        .home-primary{background:var(--green);color:#fff!important;box-shadow:0 5px 12px #2d6a4f24}
        .home-primary:hover{transform:translateY(-2px);box-shadow:0 8px 17px #2d6a4f33;background:#245a41}
        .home-secondary{border:1px solid #cad5d8;background:#fff;color:var(--ink)!important}
        .home-secondary:hover{transform:translateY(-2px);border-color:#9bafb4}
        .home-note{margin-top:17px;color:#7b878c;font-size:11px;letter-spacing:.01em}
        .home-market{position:relative;min-height:438px;padding:31px 28px 28px;background:#eee9df;border:1px solid #e2dbce;border-radius:18px;isolation:isolate}
        .home-market:before{content:"";position:absolute;z-index:-1;inset:0 0 auto;height:108px;background:#e7dfd1;border-radius:18px 18px 50% 0}
        .home-market-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:19px}
        .home-market-title{font-size:12px;font-weight:800;letter-spacing:.02em}
        .home-live{display:inline-flex;align-items:center;gap:6px;color:#50636a;font-size:10px;font-weight:700}
        .home-live:before{content:"";width:7px;height:7px;border-radius:50%;background:#54a37c;box-shadow:0 0 0 3px #54a37c22}
        .home-card-stack{display:grid;grid-template-columns:1fr 1fr;gap:13px;align-items:start}
        .home-market-empty{min-height:295px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:var(--muted)}
        .home-market-empty-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:3px;border:1px solid #d7e2d9;border-radius:14px;background:#f5f8f4;color:var(--green);font-size:24px}
        .home-market-empty strong{color:var(--ink);font-family:"Fraunces",serif;font-size:18px}
        .home-market-empty>span:not(.home-market-empty-icon){font-size:11px}
        .home-market-empty a{margin-top:4px;color:var(--green);font-size:11px;font-weight:800}
        .home-listing{display:block;overflow:hidden;border:1px solid #e5e0d5;border-radius:12px;background:#fffefa;box-shadow:0 8px 18px #293b3010;transition:transform .2s,box-shadow .2s}
        .home-listing:hover{transform:translateY(-4px);box-shadow:0 14px 28px #293b301c}
        .home-listing-0{max-width:370px;margin:24px auto 0}
        .home-listing-art{height:116px;position:relative;display:grid;place-items:center;overflow:hidden}
        .home-listing-art>span:first-child{font-family:"Fraunces",serif;font-weight:800;font-size:68px;line-height:1;color:#21313b18}
        .home-listing-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .home-category{position:absolute!important;left:10px;top:10px;padding:5px 8px;border:1px solid #ffffffa6;border-radius:5px;background:#ffffffdb;color:#35464e;font-size:9px;font-weight:800;letter-spacing:.03em}
        .home-listing-body{padding:13px 13px 11px}
        .home-listing-meta{display:flex;gap:6px;align-items:center;color:#738087;font-size:9px;font-weight:700}
        .home-listing h3{min-height:38px;margin:7px 0 10px;font-family:"Fraunces",serif;font-size:16px;line-height:1.2;letter-spacing:-.02em}
        .home-teacher-row{display:flex;align-items:center;gap:7px;padding-bottom:10px;border-bottom:1px solid #edf0ef}
        .home-avatar{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:50%;overflow:hidden;background:#e4eee8;color:var(--green);font-size:9px;font-weight:800}
        .home-avatar img{width:100%;height:100%;object-fit:cover}
        .home-teacher-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:#44525a;font-size:9px;font-weight:700}
        .home-rating{white-space:nowrap;color:#9a681b;font-size:9px;font-weight:800}
        .home-rating>span{color:#d69a34}
        .home-rating small{margin-left:2px;color:#899399;font-weight:600}
        .home-price-row{display:flex;justify-content:space-between;align-items:center;padding-top:10px;color:#849096;font-size:9px}
        .home-price-row strong{color:#835b19;font-size:14px}
        .home-price-row small{font-size:9px;font-weight:700}
        .home-exchange-note{position:absolute;left:50%;bottom:17px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;width:max-content;max-width:calc(100% - 24px);padding:8px 12px;border:1px solid #d8dfd6;border-radius:7px;background:#f8faf6;color:#526158;font-size:9px;font-weight:700;box-shadow:0 4px 11px #293b300b}
        .home-exchange-note b{color:var(--green);font-size:12px}
        .home-featured{background:#fffefa;padding:42px 0 48px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
        .home-section-inner{width:min(1240px,calc(100% - 56px));margin:0 auto}
        .home-section-heading{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}
        .home-section-kicker{margin:0 0 7px;color:#728087;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
        .home-section-heading h2,.home-flow-title{margin:0;font-family:"Fraunces",serif;font-size:clamp(25px,3vw,34px);line-height:1.1;letter-spacing:-.045em}
        .home-all-listings{white-space:nowrap;color:var(--green)!important;font-size:12px;font-weight:800}
        .home-all-listings:hover{text-decoration:underline}
        .home-path-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .home-path-card{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;min-height:135px;padding:20px 22px;border:1px solid var(--line);border-radius:12px;background:#f7f4ef;transition:transform .18s,border-color .18s,box-shadow .18s}
        .home-path-card:hover{transform:translateY(-2px);border-color:#bfd0c2;box-shadow:0 8px 20px #293b3010}
        .home-path-card strong{display:block;margin-bottom:7px;font-family:"Fraunces",serif;font-size:20px;color:var(--ink)}
        .home-path-card span{display:block;color:var(--muted);font-size:12px;line-height:1.55}
        .home-path-card b{flex:none;color:var(--green);font-size:17px}
        .home-flow{padding:54px 0 58px;background:#eeeae1}
        .home-flow-top{display:flex;justify-content:space-between;align-items:end;gap:25px;margin-bottom:26px}
        .home-flow-top p{max-width:345px;margin:0;color:#66747a;font-size:12px;line-height:1.6}
        .home-steps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border:1px solid #ddd7cc;border-radius:12px;background:#fffefa;overflow:hidden}
        .home-step{position:relative;padding:21px 22px 23px;min-height:143px}
        .home-step+.home-step{border-left:1px solid #e5e0d5}
        .home-step-num{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:7px;background:#e7efe7;color:var(--green);font-size:10px;font-weight:900}
        .home-step h3{margin:14px 0 7px;font-family:"Fraunces",serif;font-size:15px;letter-spacing:-.02em}
        .home-step p{max-width:280px;margin:0;color:var(--muted);font-size:10px;line-height:1.6}
        .home-flow-arrow{position:absolute;right:10px;top:25px;color:#aaa393;font-size:14px}
        .home-categories{padding:30px 0 35px;background:#f7f4ef}
        .home-categories-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
        .home-categories-label{margin-right:8px;color:#69777d;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        .home-category-chip{padding:7px 10px;border:1px solid #e5e0d5;border-radius:6px;background:#f2efe8;color:#68756d;font-size:10px;font-weight:700;cursor:default}
        .home-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px max(28px,calc((100vw - 1240px)/2));border-top:1px solid var(--line);background:#fffefa}
        .home-footer small{color:#7b878c;font-size:10px}
        .home-footer-links{display:flex;gap:18px;color:#58676e;font-size:10px;font-weight:700}
        .home-footer-links a:hover{color:var(--green)}
        @keyframes home-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .home-copy{animation:home-rise .45s ease both}.home-market{animation:home-rise .55s .08s ease both}
        @media(max-width:1100px){.home-steps{grid-template-columns:repeat(3,minmax(0,1fr))}.home-step:nth-child(4){border-left:0}.home-step:nth-child(n+4){border-top:1px solid #e5e0d5}}
        @media(max-width:900px){.home-hero{grid-template-columns:1fr;gap:32px;padding-top:44px}.home-copy{max-width:720px}.home-market{width:min(560px,100%);justify-self:center}.home-flow-top{align-items:start;flex-direction:column;gap:10px}}
        @media(max-width:600px){.home-topbar{height:60px;padding:0 16px}.home-nav{gap:13px;font-size:11px}.home-nav-join{padding:9px 11px}.home-hero,.home-section-inner{width:calc(100% - 32px)}.home-hero{padding:37px 0 40px;gap:27px}.home-headline{font-size:clamp(43px,12vw,62px);margin:18px 0 15px}.home-lede{font-size:14px}.home-market{min-height:390px;padding:22px 14px 25px}.home-card-stack{gap:9px}.home-listing-art{height:96px}.home-listing-body{padding:10px}.home-listing h3{font-size:14px}.home-listing-meta{font-size:8px}.home-teacher-row{gap:5px}.home-teacher-name,.home-rating{font-size:8px}.home-price-row strong{font-size:12px}.home-featured{padding:33px 0}.home-section-heading{align-items:start;flex-direction:column;gap:9px}.home-path-grid{grid-template-columns:1fr}.home-flow{padding:37px 0}.home-steps{grid-template-columns:1fr}.home-step{min-height:0;padding:17px 18px}.home-step+.home-step{border-left:0;border-top:1px solid #e5e0d5}.home-step h3{margin-top:10px}.home-flow-arrow{top:18px}.home-categories{padding:23px 0}.home-categories-label{flex-basis:100%;margin-bottom:2px}.home-footer{padding:20px 16px;align-items:flex-start;flex-direction:column}.home-footer-links{gap:14px}}
        @media(prefers-reduced-motion:reduce){.home-page *{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
      `}</style>

      <header className="home-topbar">
        <Link href="/" className="home-brand"><span>Skill</span>Credit</Link>
        <nav className="home-nav" aria-label="Main navigation">
          <Link href="/listings">Browse skills</Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="home-nav-join">Join SkillCredit</Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <div className="home-kicker"><span className="home-kicker-mark" aria-hidden="true">↔</span> A community built on sharing what you know</div>
          <h1 className="home-headline">Your next skill is <em>closer</em> than you think.</h1>
          <p className="home-lede">Learn from someone nearby in spirit. Teach what you know. Credits make every lesson a fair exchange between people.</p>
          <div className="home-hero-actions">
            <Link href="/listings" className="home-primary">Explore skill listings <span aria-hidden="true">&nbsp;→</span></Link>
            <Link href="/signup" className="home-secondary">Offer a skill to teach</Link>
          </div>
          <div className="home-note">No cash payments · Credits settle after you both complete the session</div>
        </div>

        <div className="home-market" aria-label="A current skill listing">
          <div className="home-market-head"><span className="home-market-title">A lesson from the community</span><span className="home-live">Peer-to-peer learning</span></div>
          {listingState === "ready" && listings[0] ? <ListingCard listing={listings[0]} index={0} /> : (
            <div className="home-market-empty" aria-live="polite">
              <span className="home-market-empty-icon" aria-hidden="true">↔</span>
              {listingState === "loading" && <><strong>Finding lessons to learn from</strong><span>Loading active skill listings…</span></>}
              {listingState === "empty" && <><strong>No active listings just yet</strong><span>Be the first to share a skill with the community.</span><Link href="/listings/create">Offer a skill&nbsp; →</Link></>}
              {listingState === "error" && <><strong>Skill listings couldn’t be loaded</strong><span>Please try browsing listings directly.</span><Link href="/listings">Open listings&nbsp; →</Link></>}
            </div>
          )}
          <div className="home-exchange-note"><b aria-hidden="true">↔</b> Teach one skill · use credits to learn another</div>
        </div>
      </section>

      <section className="home-featured">
        <div className="home-section-inner">
          <div className="home-section-heading">
            <div><p className="home-section-kicker">One exchange, two ways to take part</p><h2>Share what you know. Learn what’s next.</h2></div>
          </div>
          <div className="home-path-grid">
            <Link href="/listings" className="home-path-card"><span><strong>Learn a skill</strong><span>Browse peer-led sessions and use credits to book a teacher.</span></span><b aria-hidden="true">→</b></Link>
            <Link href="/listings/create" className="home-path-card"><span><strong>Teach a skill</strong><span>Share what you know and earn credits when sessions are completed.</span></span><b aria-hidden="true">→</b></Link>
          </div>
        </div>
      </section>

      <section className="home-flow">
        <div className="home-section-inner">
          <div className="home-flow-top"><div><p className="home-section-kicker">A clear exchange, start to finish</p><h2 className="home-flow-title">Learn together. Settle fairly.</h2></div><p>Credits are held while your session is underway, then released when both people confirm it is complete.</p></div>
          <div className="home-steps">
            {steps.map((step, index) => <article className="home-step" key={step.number}><span className="home-step-num">{step.number}</span>{index < steps.length - 1 && <span className="home-flow-arrow" aria-hidden="true">→</span>}<h3>{step.title}</h3><p>{step.detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="home-categories">
        <div className="home-section-inner home-categories-row"><span className="home-categories-label">Subjects shared here</span>{Object.keys(categoryColors).map((category) => <span className="home-category-chip" key={category}>{category}</span>)}</div>
      </section>

      <footer className="home-footer"><Link href="/" className="home-brand"><span>Skill</span>Credit</Link><small>Skills shared. Credits exchanged. People learning.</small><nav className="home-footer-links" aria-label="Footer"><Link href="/listings">Browse</Link><Link href="/login">Log in</Link><Link href="/signup">Join</Link></nav></footer>
    </main>
  );
}
