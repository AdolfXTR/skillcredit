import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({
            request: { headers: req.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() not getSession() — more reliable in middleware
  const { data: { user } } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

  // ── Public paths — no auth needed ──
  const publicPaths = ["/", "/login", "/signup", "/leaderboard"];
  const isPublic = publicPaths.some(p => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!user) return res;

  // ── Staff role redirects ──
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? null;

  if (path === "/dashboard") {
    if (role === "admin")     return NextResponse.redirect(new URL("/admin",     req.url));
    if (role === "moderator") return NextResponse.redirect(new URL("/moderator", req.url));
    if (role === "support")   return NextResponse.redirect(new URL("/support",   req.url));
  }

  if (path.startsWith("/admin") && role !== "admin")
    return NextResponse.redirect(new URL("/dashboard", req.url));

  if (path.startsWith("/moderator") && role !== "admin" && role !== "moderator")
    return NextResponse.redirect(new URL("/dashboard", req.url));

  if (path.startsWith("/support") && !["admin", "moderator", "support"].includes(role || ""))
    return NextResponse.redirect(new URL("/dashboard", req.url));

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};