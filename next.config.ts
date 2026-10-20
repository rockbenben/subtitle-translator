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
  // sharp 是 next 的 optionalDependency，Next 的依赖追踪会把它连同
  // node_modules/@img/sharp-<platform>/*.node 一起打进 .next/standalone。
  // 那是个平台专属二进制，会让产物带上 CPU 架构属性 —— 于是 Dockerfile 里
  // builder 阶段就被迫按目标架构各跑一遍（arm64 在 QEMU 下执行 yarn install，
  // 慢到卡死）。本项目 images.unoptimized=true 且完全没用 next/image，
  // sharp 是纯死重，排除后 standalone 变成纯 JS，多架构可复用同一份产物。
  // ⚠️ 如果将来启用 next/image 优化，必须同时删掉这段排除。
  outputFileTracingExcludes: {
    "*": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
};

export default withNextIntl(nextConfig);
