import { S3 } from "@aws-sdk/client-s3";
import "@dotenvx/dotenvx/config";

const rawEndpoint = process.env.AWS_ENDPOINT?.trim?.() ?? "";
const endpoint = rawEndpoint
  ? rawEndpoint.startsWith("http://") || rawEndpoint.startsWith("https://")
    ? rawEndpoint
    : `https://${rawEndpoint}`
  : undefined;

export const s3 = new S3({
  ...(endpoint ? { endpoint } : {}),
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});
