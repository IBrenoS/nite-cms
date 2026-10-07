import type { NextConfig } from "next";
import path from "node:path";

import { readPublicMediaConfiguration } from "./src/lib/public-media-config";

const publicMedia = readPublicMediaConfiguration(process.env);
const selfHostedOutput = {
  output: "standalone" as const,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
};

const nextConfig: NextConfig = {
  ...selfHostedOutput,
  poweredByHeader: false,
  transpilePackages: ["@nite/cms-db", "@nite/cms-ui", "@nite/editorial"],
  typedRoutes: true,
  images: {
    remotePatterns: publicMedia.configured ? [publicMedia.remotePattern] : [],
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
