import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  experimental: {},
};

export default nextConfig;
