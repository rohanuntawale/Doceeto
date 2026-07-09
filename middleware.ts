import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED = ["/doctor", "/ops"];

export async function middleware(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Demo mode (no Supabase): everything is open — the landing page lets
  // you enter either console directly.
  if (!configured) return response;

  const isProtected = PROTECTED.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (path === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/doctor";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images.
    "/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
