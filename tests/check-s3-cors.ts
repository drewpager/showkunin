import { GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3 } from "~/server/aws/s3";
import "@dotenvx/dotenvx/config";

/**
 * Script to check S3 Bucket CORS configuration
 * Run with: tsx tests/check-s3-cors.ts
 */
const checkCors = async () => {
  const bucketName = process.env.AWS_BUCKET_NAME ?? "";
  console.log(`🔍 Checking CORS configuration for bucket: ${bucketName}`);

  try {
    const command = new GetBucketCorsCommand({
      Bucket: bucketName,
    });

    const response = await s3.send(command);
    console.log("\n✅ CORS Configuration found:");
    console.log(JSON.stringify(response.CORSRules, null, 2));
  } catch (error) {
    console.error("\n❌ Failed to get CORS configuration:");
    // @ts-ignore
    if (error.name === "NoSuchCORSConfiguration") {
      console.error("   No CORS configuration found for this bucket.");
    } else {
      console.error(error);
    }
    process.exit(1);
  }
};

checkCors()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
