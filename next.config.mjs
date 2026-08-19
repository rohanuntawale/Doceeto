/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    // Ship less client JS for these heavy libs.
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
    // These routes read their .sql at RUNTIME, so nothing imports it and Next's
    // dependency tracing cannot see it. Without this the file is missing from
    // the serverless bundle and the route fails on Vercel with ENOENT — while
    // working perfectly in local dev.
    outputFileTracingIncludes: {
      "/api/admin/seed": ["./lib/postgres/schema.sql"],
      // Every social route installs the social schema through its guard, and
      // the bare /api/social path needs its own key — "/**" does not match it.
      "/api/social": ["./lib/social/schema.sql"],
      "/api/social/**": ["./lib/social/schema.sql"],
    },
  },
  /**
   * Short, memorable aliases for the legal pages, which live canonically under
   * /legal/*. These exist because the URLs get typed and pasted by hand into
   * places that are awkward to correct later — App Store Connect and the Play
   * Console privacy-policy and account-deletion fields, a payment gateway's
   * onboarding form, an investor's data room. "doceeto.health/privacy" survives
   * being read aloud; "/legal/medical-disclaimer" does not.
   *
   * Permanent (308), so search engines consolidate on the canonical /legal/*
   * URL that each page declares in its metadata.
   */
  async redirects() {
    const alias = (from, to) => ({
      source: from,
      destination: `/legal/${to}`,
      permanent: true,
    });
    return [
      alias("/privacy", "privacy"),
      alias("/privacy-policy", "privacy"),
      alias("/terms", "terms"),
      alias("/terms-of-use", "terms"),
      alias("/terms-of-service", "terms"),
      alias("/tos", "terms"),
      alias("/sales-policy", "sales"),
      alias("/refund", "sales"),
      alias("/refunds", "sales"),
      alias("/refund-policy", "sales"),
      alias("/cancellation", "sales"),
      alias("/pricing-policy", "sales"),
      alias("/disclaimer", "medical-disclaimer"),
      alias("/medical-disclaimer", "medical-disclaimer"),
      alias("/cookies", "cookies"),
      alias("/cookie-policy", "cookies"),
      alias("/grievance", "grievance"),
      alias("/grievance-redressal", "grievance"),
      alias("/delete-account", "data-deletion"),
      alias("/account-deletion", "data-deletion"),
      alias("/data-deletion", "data-deletion"),
      alias("/accessibility", "accessibility"),
      alias("/security", "security"),
      alias("/security.txt", "security"),
      alias("/emergency", "emergency"),
      alias("/telemedicine", "telemedicine-consent"),
      alias("/pharmacy", "pharmacy"),
      alias("/provider-terms", "providers"),
      // The human site map; the XML one is generated at /sitemap.xml.
      { source: "/site-map", destination: "/sitemap", permanent: true },
    ];
  },
};

export default nextConfig;
