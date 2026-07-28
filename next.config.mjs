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
    // The setup route reads lib/postgres/schema.sql at RUNTIME, so nothing
    // imports it and Next's dependency tracing cannot see it. Without this the
    // file is missing from the serverless bundle and POST /api/admin/seed fails
    // on Vercel with ENOENT — while working perfectly in local dev.
    outputFileTracingIncludes: {
      "/api/admin/seed": ["./lib/postgres/schema.sql"],
    },
  },
};

export default nextConfig;
