import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serve modern image formats (smaller payloads → better LCP / Core Web
  // Vitals, a ranking tiebreaker). Applies to every next/image on the site.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Pin the workspace root to this project. Without it, a stray
  // ~/package-lock.json makes Next infer the home dir as the root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
