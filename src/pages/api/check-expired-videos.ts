import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "~/server/db";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import "@dotenvx/dotenvx/config";
import { s3 } from "~/server/aws/s3";
import { verifySignature } from "@upstash/qstash/nextjs";

export default verifySignature(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const expiredVideos = await prisma.video.findMany({
    where: {
      shareLinkExpiresAt: {
        lte: new Date(),
      },
      delete_after_link_expires: true,
      sharing: true,
    },
    include: {
      user: true,
    },
  });

  const updatedVideos = await prisma.video.updateMany({
    where: {
      shareLinkExpiresAt: {
        lte: new Date(),
      },
      delete_after_link_expires: false,
      sharing: true,
    },
    data: {
      sharing: false,
    },
  });

  const expiredVideoIds = expiredVideos.map((x) => x.id);
  expiredVideos.map(async (video) => {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: video.user.id + "/" + video.id,
    });

    const deleteThumbnailObjectCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: video.user.id + "/" + video.id + "-thumbnail",
    });

    return await Promise.all([
      s3.send(deleteObjectCommand),
      s3.send(deleteThumbnailObjectCommand),
    ]);
  });

  const deletedVideos = await prisma.video.deleteMany({
    where: {
      id: {
        in: expiredVideoIds,
      },
    },
  });

  res.status(200).json({ expiredVideos, updatedVideos, deletedVideos });
});
