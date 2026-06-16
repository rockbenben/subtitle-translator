import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// `output` only applies at build time and Next.js 16 forbids middleware with
// `output: "export"` — including in dev. Setting it in dev disables next-intl's
// proxy.ts middleware, which fallback-redirects every `/{locale}/{tool}` to
// `/{defaultLocale}`. So we omit it in dev and only switch modes for builds.
//
// Docker: standalone (supports API routes /api/deepl, /api/nvidia)
// Static deployment: export (default — uses the remote EdgeOne proxy)
const isDev = process.env.NODE_ENV === "development";
const isDocker = process.env.DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isDev ? {} : { output: isDocker ? "standalone" : "export" }),
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "jsonpath-plus", "compromise"],
  },
};

export default withNextIntl(nextConfig);
