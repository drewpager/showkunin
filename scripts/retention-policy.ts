
import { prisma } from "../src/server/db";
import { s3 } from "../src/server/aws/s3";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

async function main() {
  console.log("Starting retention policy check...");

  const videos = await prisma.video.findMany({
    where: {
      fileDeletedAt: null,
    },
    include: {
      user: true,
    },
  });

  console.log(`Found ${videos.length} active videos to check.`);

  let deletedCount = 0;
  let errorCount = 0;

  for (const video of videos) {
    const isPaying = video.user.stripeSubscriptionStatus === "active";
    const retentionDays = isPaying ? 60 : 30;
    
    const expirationDate = new Date(video.createdAt);
    expirationDate.setDate(expirationDate.getDate() + retentionDays);

    if (new Date() > expirationDate) {
      console.log(`Video ${video.id} (User: ${video.user.email}, Paying: ${isPaying}) expired on ${expirationDate.toISOString()}. Deleting...`);

      try {
        // Delete video file
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: video.userId + "/" + video.id,
          })
        );

        // Delete thumbnail
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: video.userId + "/" + video.id + "-thumbnail",
          })
        );

        // Update database
        await prisma.video.update({
          where: { id: video.id },
          data: {
            fileDeletedAt: new Date(),
          },
        });

        console.log(`Successfully deleted video ${video.id}`);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete video ${video.id}:`, error);
        errorCount++;
      }
    }
  }

  console.log(`Retention check complete.`);
  console.log(`Deleted: ${deletedCount}`);
  console.log(`Errors: ${errorCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
