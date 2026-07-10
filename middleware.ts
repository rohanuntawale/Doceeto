import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const isDoctorPath = (p: string) => p === "/doctor" || p.startsWith("/doctor/");
// Note: excludes /ops-signin, which must stay public.
const isOpsPath = (p: string) => p === "/ops" || p.startsWith("/ops/");

export async function middleware(request: NextRequest) {
  const { response, user, configured } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // Demo mode (no Supabase): auth is client-side (ops passcode gate).
  if (!configured) return response;

  if (!user && (isDoctorPath(path) || isOpsPath(path))) {
    const url = request.nextUrl.clone();
    // Admins land on the dedicated ops sign-in; everyone else on /login.
    url.pathname = isOpsPath(path) ? "/ops-signin" : "/login";
    if (!isOpsPath(path)) url.searchParams.set("next", path);
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
