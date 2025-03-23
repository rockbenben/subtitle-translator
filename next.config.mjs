import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

// This file is used to configure Static Next.js for the Tauri app.
const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

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
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? "/" : `http://${internalHost}:3000`,
};

export default withNextIntl(nextConfig);
