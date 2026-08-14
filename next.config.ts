import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` optionally requires the native `pg-native` binding at runtime. Bundling
  // makes the bundler resolve that branch even though it is never installed, so
  // keep these as plain runtime requires on the server.
  serverExternalPackages: ["pg", "pg-native", "@mastra/pg"],
};

export default nextConfig;
