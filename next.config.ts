import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are never ignored to get a build out (rules.md §7).
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
