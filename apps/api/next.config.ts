import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@nite/cms-db", "@nite/editorial"],
};

export default nextConfig;
