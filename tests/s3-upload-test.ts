import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "~/server/aws/s3";
import "@dotenvx/dotenvx/config";

/**
 * Test script to upload a .txt file to AWS S3
 * Run with: tsx tests/s3-upload-test.ts
 */
const testUpload = async () => {
  const testKey = `test-file-${Date.now()}.txt`;
  const testContent = "Hello World - S3 Upload Test";
  const bucketName = process.env.AWS_BUCKET_NAME ?? "";

  console.log("🚀 Starting S3 upload test...");
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🔑 Key: ${testKey}`);

  try {
    // Step 1: Upload the file
    console.log("\n📤 Uploading file...");
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: "text/plain",
    });

    const putResponse = await s3.send(putCommand);
    console.log("✅ Upload successful!");
    console.log(
      `ETag: ${putResponse.ETag ? putResponse.ETag.toString() : "No ETag"}`
    );

    // Step 2: Verify the upload by retrieving the file
    console.log("\n📥 Verifying upload by retrieving file...");
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });

    const getResponse = await s3.send(getCommand);
    const bodyContents = await getResponse.Body?.transformToString();

    if (bodyContents === testContent) {
      console.log("✅ Verification successful! File content matches.");
    } else {
      console.log("⚠️  Warning: File content doesn't match!");
      console.log(`   Expected: ${testContent}`);
      console.log(
        `   Got: ${bodyContents ? bodyContents.toString() : "No body contents"}`
      );
    }

    // Step 3: Clean up - delete the test file
    console.log("\n🧹 Cleaning up test file...");
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });

    await s3.send(deleteCommand);
    console.log("✅ Test file deleted successfully!");

    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);

    // Try to clean up even if there was an error
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey,
      });
      await s3.send(deleteCommand);
      console.log("\n🧹 Cleaned up test file after error.");
    } catch (cleanupError) {
      console.error("⚠️  Failed to clean up test file:", cleanupError);
    }

    process.exit(1);
  }
};

// Run the test
testUpload()
  .then(() => {
    console.log("\n✨ Test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Unhandled error:", error);
    process.exit(1);
  });
