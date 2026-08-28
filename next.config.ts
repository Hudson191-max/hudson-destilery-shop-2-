import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Type errors must fail the build — shipping type-unsafe code hides bugs.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Catches effect/double-render bugs during development.
  reactStrictMode: true,
  // Self-hosting on a private server: `standalone` produces a minimal deploy
  // (~1/10th the size of shipping the whole node_modules) — see the `build`
  // and `start` scripts in package.json. Ignored on Vercel.
  output: "standalone",
  // Don't advertise the framework version to attackers.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Static brand assets are referenced by fixed filenames, so a bounded
        // TTL keeps them cheap without risking stale-forever content.
        source: "/:path*.(png|jpg|jpeg|svg|webp|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
