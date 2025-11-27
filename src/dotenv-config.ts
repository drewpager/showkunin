import { config } from "@dotenvx/dotenvx";

// In production, Next.js sets NODE_ENV to 'production'
// We need to explicitly tell dotenvx to load .env.production
// because it defaults to .env
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env";

config({ path: envFile, override: true });
