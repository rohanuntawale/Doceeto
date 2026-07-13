import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const isLiveMode = process.env.NEXT_PUBLIC_BACKEND === "neo4j";

const isDoctorPath = (p: string) => p === "/doctor" || p.startsWith("/doctor/");
const isOpsPath = (p: string) => p === "/ops" || p.startsWith("/ops/");

export async function middleware(request: NextRequest) {
  // Demo mode: no real auth; everything is open (client-side ops gate only).
  if (!isLiveMode) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  // Guard the doctor and ops surfaces by role.
  if (isOpsPath(path) && session?.role !== "ops") {
    const url = request.nextUrl.clone();
    url.pathname = "/ops-signin";
    return NextResponse.redirect(url);
  }
  if (isDoctorPath(path) && session?.role !== "doctor") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Signed-in doctors skip the auth pages.
  if ((path === "/login" || path === "/register") && session?.role === "doctor") {
    const url = request.nextUrl.clone();
    url.pathname = "/doctor";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets, images and the API routes.
    "/((?!_next/static|_next/image|favicon.svg|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
