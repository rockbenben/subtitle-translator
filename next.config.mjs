import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

// This file is used to configure Static Next.js for the Tauri app.
const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST;

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "",
  // Ensure Next.js uses SSG instead of SSR
  // https://nextjs.org/docs/pages/building-your-application/deploying/static-exports
  output: "export",
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  // Dynamically set assetPrefix based on environment
  assetPrefix: isProd
    ? "/" // production
    : internalHost
    ? `http://${internalHost}:3000` // dev + TAURI_DEV_HOST provided
    : "/", // dev + no TAURI_DEV_HOST
};

export default withNextIntl(nextConfig);
