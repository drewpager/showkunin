import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "~/server/aws/s3";
import axios from "axios";
import "@dotenvx/dotenvx/config";

/**
 * Test script to verify S3 Presigned URL generation and upload
 * Run with: tsx tests/s3-presigned-url-test.ts
 */
const testPresignedUpload = async () => {
  const testKey = `presigned-test-${Date.now()}.txt`;
  const testContent = "Hello World - Presigned URL Test";
  const bucketName = process.env.AWS_BUCKET_NAME ?? "";

  console.log("🚀 Starting S3 Presigned URL upload test...");
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🔑 Key: ${testKey}`);

  try {
    // Step 1: Generate Presigned URL
    console.log("\n🔗 Generating presigned URL...");
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      // ContentType removed to match application code
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    console.log(`✅ Signed URL generated: ${signedUrl}`);

    // Step 2: Upload using the signed URL (simulating client-side upload)
    console.log("\n📤 Uploading file via signed URL...");
    
    await axios.put(signedUrl, testContent, {
      headers: {
        "Content-Type": "text/plain",
      },
    });

    console.log("✅ Upload successful!");

    // Step 3: Verify (Optional - we assume if PUT succeeds, it's there, but we can check)
    // We can reuse the logic from the other test or just trust the 200 OK from axios

  } catch (error) {
    console.error("\n❌ Test failed with error:");
    if (axios.isAxiosError(error)) {
        console.error("Axios Error Status:", error.response?.status);
        console.error("Axios Error Data:", error.response?.data);
    } else {
        console.error(error);
    }
    process.exit(1);
  }
};

testPresignedUpload()
  .then(() => {
    console.log("\n✨ Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Unhandled error:", error);
    process.exit(1);
  });
