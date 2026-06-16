import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitnotes/core", "@fitnotes/database", "@fitnotes/ui"],
};

export default nextConfig;
