import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve modern image formats (smaller payloads → better LCP / Core Web
  // Vitals, a ranking tiebreaker). Applies to every next/image on the site.
  // Facility photos live in the Supabase `facility-photos` storage bucket, so
  // that host must be allowlisted for next/image to optimize them.
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uxykrvungmfzmpzrvebh.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Pin the workspace root to this project. Without it, a stray
  // ~/package-lock.json makes Next infer the home dir as the root.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Profile + facility photos are posted through Server Actions. The 1MB default
    // rejected ordinary phone photos (throwing the "Something went wrong" page).
    // Allow generous uploads — a real photo from any device, just not a billboard.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
