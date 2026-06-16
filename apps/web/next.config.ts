import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitnotes/core", "@fitnotes/database", "@fitnotes/ui"],
  webpack(config) {
    // Resolve TypeScript .ts/.tsx when imports use .js extension (verbatimModuleSyntax)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
