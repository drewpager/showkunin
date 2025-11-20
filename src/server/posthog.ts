import { PostHog } from "posthog-node";
import "@dotenvx/dotenvx/config";

export const posthog =
  !!process.env.NEXT_PUBLIC_POSTHOG_KEY && !!process.env.NEXT_PUBLIC_POSTHOG_HOST
    ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      })
    : null;
