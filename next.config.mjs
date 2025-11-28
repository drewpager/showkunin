/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
import { config as dotenvx } from "@dotenvx/dotenvx";

dotenvx({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
  override: true,
});

!process.env.SKIP_ENV_VALIDATION && (await import("./src/env.mjs"));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  /**
   * If you have the "experimental: { appDir: true }" setting enabled, then you
   * must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  images: {
    remotePatterns: [],
  },

  async rewrites() {
    return [
      ...(!!process.env.POSTHOG_PROXY_PATH && !!process.env.NEXT_PUBLIC_POSTHOG_HOST ? [{
        source: "/" + process.env.POSTHOG_PROXY_PATH + "/:path*",
        destination: process.env.NEXT_PUBLIC_POSTHOG_HOST + "/:path*",
      }] : []),
    ];
  },

  output: "standalone",
};
export default config;
