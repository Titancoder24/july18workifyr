import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default config;
