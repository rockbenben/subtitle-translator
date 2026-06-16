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
// Set by `yarn build:tauri`. Drives Tauri-only `trailingSlash` so the static
// export emits `/{locale}/index.html` (resolved by Tauri's directory-index
// asset server) instead of flat `{locale}.html` (404s under tauri://). Gated on
// an EXPLICIT flag — never TAURI_ENV_PLATFORM, which isn't set for the frontend
// build and would silently yield flat files / broken locale routing.
const isTauri = process.env.TAURI_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isDev ? {} : { output: isDocker ? "standalone" : "export" }),
  ...(isTauri ? { trailingSlash: true } : {}),
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["antd", "@ant-design/icons", "jsonpath-plus", "compromise"],
  },
};

export default withNextIntl(nextConfig);
