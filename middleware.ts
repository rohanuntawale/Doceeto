import { type NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

const isDoctorPath = (p: string) => p === "/doctor" || p.startsWith("/doctor/");
const isOpsPath = (p: string) => p === "/ops" || p.startsWith("/ops/");
const isPatientPath = (p: string) => p === "/patient" || p.startsWith("/patient/");

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
  if (isPatientPath(path) && session?.role !== "patient") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  // Signed-in users skip the auth pages, landing on their own space.
  if (path === "/login") {
    if (session?.role === "doctor" || session?.role === "patient") {
      const url = request.nextUrl.clone();
      url.pathname = session.role === "doctor" ? "/doctor" : "/patient";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets, images and the API routes.
    "/((?!_next/static|_next/image|favicon.svg|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
