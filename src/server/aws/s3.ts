import { S3 } from "@aws-sdk/client-s3";
import { env } from "~/env.mjs";

const rawEndpoint = env.AWS_ENDPOINT?.trim?.() ?? "";
const endpoint = rawEndpoint
  ? rawEndpoint.startsWith("http://") || rawEndpoint.startsWith("https://")
    ? rawEndpoint
    : `https://${rawEndpoint}`
  : undefined;

export const s3 = new S3({
  ...(endpoint ? { endpoint } : {}),
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});
