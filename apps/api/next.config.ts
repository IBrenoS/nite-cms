import type { NextConfig } from "next";
import path from "node:path";

const selfHostedOutput =
  process.env.VERCEL === "1"
    ? {}
    : {
        output: "standalone" as const,
        outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
      };

const nextConfig: NextConfig = {
  ...selfHostedOutput,
  poweredByHeader: false,
  transpilePackages: ["@nite/cms-db", "@nite/editorial"],
};

export default nextConfig;
