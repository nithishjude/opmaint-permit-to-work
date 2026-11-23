import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/session-token";

// Coarse gate: no valid session → login page (or 401 for the API).
// Fine-grained authorization happens per request in the domain layer.
const PUBLIC = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/cron\//, /^\/status\//];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in." } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
