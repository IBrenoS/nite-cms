import type { NextConfig } from "next";

const publicMediaUrl = process.env.R2_PUBLIC_BASE_URL;
let mediaRemotePattern: URL | undefined;
try {
  mediaRemotePattern = publicMediaUrl ? new URL(publicMediaUrl) : undefined;
} catch {
  mediaRemotePattern = undefined;
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@nite/content", "@nite/ui"],
  typedRoutes: true,
  images: {
    remotePatterns: mediaRemotePattern ? [mediaRemotePattern] : [],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
