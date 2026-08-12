import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/legal/company";

/**
 * /robots.txt
 *
 * The disallow list is a privacy control, not an SEO preference. Everything
 * behind a session — a patient's records, a doctor's cockpit, the operations
 * console — must never be crawled, and `/rx/` above all: those URLs contain the
 * share token that opens a prescription without signing in, so a crawled one is
 * an indexed medical document.
 *
 * Note this is defence in depth, not the control itself. Robots directives are
 * advisory and a hostile crawler ignores them; the actual protection is the
 * server-side session check on every one of these routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/patient",
          "/patient/",
          "/doctor",
          "/doctor/",
          "/nurse",
          "/nurse/",
          "/ops",
          "/ops/",
          "/ops-signin",
          // Prescription share links. Never index a medical document.
          "/rx/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
