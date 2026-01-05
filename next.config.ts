import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

// Docker: standalone mode (supports API routes)
// Static deployment: export mode (uses remote API)
const isDocker = process.env.DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  output: isDocker ? "standalone" : "export",
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default withNextIntl(nextConfig);
