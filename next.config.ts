import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // bcryptjs and Prisma are server-only; keep them out of client bundles.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
