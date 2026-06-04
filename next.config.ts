import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. Without it, a stray
  // ~/package-lock.json makes Next infer the home dir as the root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
