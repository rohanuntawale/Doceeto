import { type NextRequest, NextResponse } from "next/server";
import {
  PATH_HEADER,
  RETIRED_COOKIES,
  SESSION_COOKIES,
  signInFor,
  surfaceFromPath,
} from "@/lib/auth/constants";

const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

/**
 * Two jobs only, both cheap.
 *
 * Sessions now live in the database, and the Edge runtime cannot reach the
 * Neo4j driver, so the middleware no longer decides who anyone is — that check
 * belongs to the surface layouts, which run on Node and read the store. What it
 * still does is turn away visitors carrying no session cookie at all (a
 * definite "not signed in", no lookup required) so an anonymous hit never
 * renders a dashboard, and publish the pathname for those layouts to read.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The mobile client is a separate Capacitor origin. Credentialed cookies
  // need an exact allow-list rather than a wildcard origin.
  if (path.startsWith("/api/")) return withApiCors(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATH_HEADER, path + request.nextUrl.search);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  const surface = surfaceFromPath(path);

  // Demo mode used to open EVERY surface, so /nurse, /doctor and /ops were one
  // URL away for anyone. Provider and ops surfaces now always demand a cookie,
  // whatever mode we are in — the layout still does the real session lookup,
  // this just turns away the obvious case at the edge.
  if (!isLiveMode && (!surface || surface === "patient")) return pass();
  if (surface && !request.cookies.get(SESSION_COOKIES[surface])?.value) {
    const url = request.nextUrl.clone();
    const target = signInFor(surface, path);
    const [pathname, query] = target.split("?");
    url.pathname = pathname;
    url.search = query ? `?${query}` : "";
    return sweep(request, NextResponse.redirect(url));
  }

  return sweep(request, pass());
}

function mobileCorsOrigins(): Set<string> {
  const configured = (process.env.MOBILE_CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(
    [
      "https://localhost",
      "capacitor://localhost",
      "http://localhost:5173",
      process.env.NEXT_PUBLIC_APP_URL,
      ...configured,
    ].filter((origin): origin is string => Boolean(origin)),
  );
}

function withApiCors(request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");
  const allowed = origin && mobileCorsOrigins().has(origin) ? origin : null;
  const headers = new Headers();
  if (allowed) {
    headers.set("Access-Control-Allow-Origin", allowed);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-Iyashi-Surface");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Vary", "Origin");
  }
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  return NextResponse.next({ headers });
}

/** Drop cookies from the pre-database schemes so nothing stale is presented. */
function sweep(request: NextRequest, res: NextResponse) {
  for (const name of RETIRED_COOKIES) {
    if (request.cookies.get(name)) res.cookies.delete(name);
  }
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets and images. API routes are included so
    // the mobile client receives credentialed CORS headers.
    "/((?!_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
