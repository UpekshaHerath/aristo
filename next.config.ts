import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB loads a platform-specific native .node binding via require() inside a
  // switch. Bundling makes webpack resolve every branch, including platforms whose
  // optional dependency was never installed. Keep it a runtime require instead.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings", "@mastra/duckdb"],
};

export default nextConfig;
