import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3 } from "~/server/aws/s3";
import "@dotenvx/dotenvx/config";

/**
 * Script to set S3 Bucket CORS configuration
 * Run with: tsx tests/setup-s3-cors.ts
 */
const setupCors = async () => {
  const bucketName = process.env.AWS_BUCKET_NAME ?? "";
  console.log(`🛠 Setting up CORS for bucket: ${bucketName}`);

  const corsRules = [
    {
      AllowedHeaders: ["*"],
      AllowedMethods: ["PUT", "POST", "DELETE", "GET", "HEAD"],
      AllowedOrigins: ["*"], // WARNING: In production, replace '*' with your specific domain(s)
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
  ];

  try {
    const command = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: corsRules,
      },
    });

    await s3.send(command);
    console.log("\n✅ CORS Configuration updated successfully!");
    console.log(JSON.stringify(corsRules, null, 2));
  } catch (error) {
    console.error("\n❌ Failed to set CORS configuration:");
    console.error(error);
    process.exit(1);
  }
};

setupCors()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
