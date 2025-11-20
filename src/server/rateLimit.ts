import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import "@dotenvx/dotenvx/config";

export const rateLimit =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        }),
        limiter: Ratelimit.slidingWindow(60, "60 s"),
      })
    : null;
