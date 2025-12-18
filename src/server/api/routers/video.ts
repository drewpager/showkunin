import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import "~/dotenv-config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { genAI, fileManager } from "~/server/gemini";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

export const videoRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx: { prisma, session, s3, posthog }, input }) => {
      const limit = input.limit ?? 20;
      const { cursor } = input;

      const videos = await prisma.video.findMany({
        take: limit + 1,
        where: {
          userId: session.user.id,
        },
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (videos.length > limit) {
        const nextItem = videos.pop();
        nextCursor = nextItem?.id;
      }

      // Generate signed URLs for all videos
      const videosWithUrls = await Promise.all(
        videos.map(async (video) => {
          const thumbnailUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: process.env.AWS_BUCKET_NAME,
              Key: video.userId + "/" + video.id + "-thumbnail",
            }),
            { expiresIn: 7 * 24 * 60 * 60 }
          );
          return {
            ...video,
            thumbnailUrl,
          };
        })
      );

      // Track analytics asynchronously (don't block response)
      void (async () => {
        const totalCount = await prisma.video.count({
          where: { userId: session.user.id },
        });
        posthog?.capture({
          distinctId: session.user.id,
          event: "viewing video list",
          properties: {
            videoAmount: totalCount,
          },
        });
        void posthog?.shutdownAsync();
      })();

      return {
        items: videosWithUrls,
        nextCursor,
      };
    }),
  get: publicProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { s3, posthog, session, prisma } = ctx;
      const video = await prisma.video.findUnique({
        where: {
          id: input.videoId,
        },
        include: {
          user: true,
        },
      });
      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (video.userId !== session?.user.id && !video.sharing) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (session) {
        posthog?.capture({
          distinctId: session.user.id,
          event: "viewing video",
          properties: {
            videoId: video.id,
            videoCreatedAt: video.createdAt,
            videoUpdatedAt: video.updatedAt,
            videoUser: video.user.id,
            videoSharing: video.sharing,
            videoDeleteAfterLinkExpires: video.delete_after_link_expires,
            videoShareLinkExpiresAt: video.shareLinkExpiresAt,
          },
        });
        void posthog?.shutdownAsync();
      }

      let signedUrl = null;
      if (!video.fileDeletedAt) {
        const getObjectCommand = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: video.userId + "/" + video.id,
        });

        signedUrl = await getSignedUrl(s3, getObjectCommand);
      }

      const thumbnailUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: video.userId + "/" + video.id + "-thumbnail",
        }),
        { expiresIn: 7 * 24 * 60 * 60 }
      );

      return { ...video, video_url: signedUrl, thumbnailUrl };
    }),
  getUploadUrl: protectedProcedure
    .input(z.object({ key: z.string(), userContext: z.string().optional() }))
    .mutation(async ({ ctx: { prisma, session, s3, posthog }, input }) => {
      const { key, userContext } = input;

      const videos = await prisma.video.findMany({
        where: {
          userId: session.user.id,
        },
      });

      if (
        session.user.stripeSubscriptionStatus !== "active" &&
        !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
        videos.length >= 10
      ) {
        posthog?.capture({
          distinctId: session.user.id,
          event: "hit video upload limit",
          properties: {
            videoAmount: videos.length,
            stripeSubscriptionStatus: session.user.stripeSubscriptionStatus,
          },
        });
        void posthog?.shutdownAsync();

        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Sorry, you have reached the maximum video upload limit on our free tier. Please upgrade to upload more.",
        });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "uploading video",
        properties: {
          videoAmount: videos.length,
          stripeSubscriptionStatus: session.user.stripeSubscriptionStatus,
        },
      });
      void posthog?.shutdownAsync();

      const video = await prisma.video.create({
        data: {
          userId: session.user.id,
          title: key,
          userContext,
        },
      });

      const signedVideoUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: session.user.id + "/" + video.id,
        })
      );

      const signedThumbnailUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: video.userId + "/" + video.id + "-thumbnail",
        })
      );

      return {
        success: true,
        id: video.id,
        signedVideoUrl,
        signedThumbnailUrl,
      };
    }),
  setSharing: protectedProcedure
    .input(z.object({ videoId: z.string(), sharing: z.boolean() }))
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          sharing: input.sharing,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video setSharing",
        properties: {
          videoId: input.videoId,
          videoSharing: input.sharing,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  setDeleteAfterLinkExpires: protectedProcedure
    .input(
      z.object({ videoId: z.string(), delete_after_link_expires: z.boolean() })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          delete_after_link_expires: input.delete_after_link_expires,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video delete_after_link_expires",
        properties: {
          videoId: input.videoId,
          delete_after_link_expires: input.delete_after_link_expires,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  setShareLinkExpiresAt: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        shareLinkExpiresAt: z.nullable(z.date()),
      })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          shareLinkExpiresAt: input.shareLinkExpiresAt,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video shareLinkExpiresAt",
        properties: {
          videoId: input.videoId,
          shareLinkExpiresAt: input.shareLinkExpiresAt,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  renameVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
        title: z.string(),
      })
    )
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          title: input.title,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video title",
        properties: {
          videoId: input.videoId,
          title: input.title,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  deleteVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      })
    )
    .mutation(async ({ ctx: { prisma, session, s3, posthog }, input }) => {
      const deleteVideo = await prisma.video.deleteMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
      });

      if (deleteVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "video delete",
        properties: {
          videoId: input.videoId,
        },
      });
      void posthog?.shutdownAsync();

      const deleteVideoObject = await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: session.user.id + "/" + input.videoId,
        })
      );

      const deleteThumbnailObject = await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: session.user.id + "/" + input.videoId + "-thumbnail",
        })
      );

      return {
        success: true,
        deleteVideo,
        deleteVideoObject,
        deleteThumbnailObject,
      };
    }),
  deleteVideoFile: protectedProcedure
    .input(
      z.object({
        videoId: z.string(),
      })
    )
    .mutation(async ({ ctx: { prisma, session, s3, posthog }, input }) => {
      // 1. Update DB to mark file as deleted
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          fileDeletedAt: new Date(),
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "video file delete (retention)",
        properties: {
          videoId: input.videoId,
        },
      });
      void posthog?.shutdownAsync();

      // 2. Delete objects from S3
      const deleteVideoObject = await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: session.user.id + "/" + input.videoId,
        })
      );

      const deleteThumbnailObject = await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: session.user.id + "/" + input.videoId + "-thumbnail",
        })
      );

      return {
        success: true,
        updateVideo,
        deleteVideoObject,
        deleteThumbnailObject,
      };
    }),
  setSolved: protectedProcedure
    .input(z.object({ videoId: z.string(), solved: z.boolean().nullable() }))
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          solved: input.solved,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video solved",
        properties: {
          videoId: input.videoId,
          solved: input.solved,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        updateVideo,
      };
    }),
  analyzeVideo: publicProcedure
    .input(z.object({ videoId: z.string(), refinementPrompt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { s3, prisma, session } = ctx;
      
      // Get video from database
      const video = await prisma.video.findUnique({
        where: { id: input.videoId },
      });

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check if user has access to this video
      if (video.userId !== session?.user.id && !video.sharing) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        // Get the video from S3
        const getObjectCommand = new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: video.userId + "/" + video.id,
        });

        const signedUrl = await getSignedUrl(s3, getObjectCommand, {
          expiresIn: 3600,
        });

        // Download video to temporary file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `${video.id}.webm`);
        
        const response = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });
        
        fs.writeFileSync(tempFilePath, new Uint8Array(response.data as ArrayBuffer));

        // Upload to Gemini
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
          mimeType: "video/webm",
          displayName: video.title,
        });

        // Wait for file to be processed
        let file = await fileManager.getFile(uploadResult.file.name);
        while (file.state === "PROCESSING") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await fileManager.getFile(uploadResult.file.name);
        }

        if (file.state === "FAILED") {
          throw new Error("Video processing failed");
        }

        // Analyze the video
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResult.file.mimeType,
              fileUri: uploadResult.file.uri,
            },
          },
          {
            text: input.refinementPrompt 
              ? `You are an AI automation expert analyzing a screen recording.
              
              User Context:
              ${video.userContext ?? "None"}

              Previous Analysis:
              ${video.aiAnalysis ?? "No previous analysis."}

              User Refinement Request:
              ${input.refinementPrompt}

              Please provide an updated analysis and response based on the video and the user's specific request above. Maintain the same structured format (Task Summary, Automation Approach, Implementation Steps, Code Example, Tools/Technologies) unless the user's request specifically implies a different format.`
                            : `You are an AI problem solving and automation expert analyzing a screen recording. The user is showing you a task they want automated or a problem they want resolved.

              User Context:
              ${video.userContext ?? "None"}

              Please analyze this video and provide:

              1. **Code Example**: If applicable, provide code snippets with clear instructions on where to use them
              2. **Task Summary**: A clear description of what the user is trying to accomplish
              3. **Automation Approach**: How this task could be automated (e.g., using browser automation, API calls, scripts, etc.)
              4. **Implementation Steps**: Step-by-step instructions for implementing the automation
              5. **Tools/Technologies**: List any tools, libraries, or services that would be helpful

              Format your response in a clear, concise, and structured way that's easy for the user to follow.`,
          },
        ]);

        const analysisText = result.response.text();

        // Clean up temporary file
        fs.unlinkSync(tempFilePath);

        // Delete the file from Gemini
        await fileManager.deleteFile(uploadResult.file.name);

        // Save analysis to database
        const updatedVideo = await prisma.video.update({
          where: { id: input.videoId },
          data: {
            aiAnalysis: analysisText,
            aiAnalysisGeneratedAt: new Date(),
          },
        });

        return {
          success: true,
          analysis: analysisText,
          generatedAt: updatedVideo.aiAnalysisGeneratedAt,
        };
      } catch (error) {
        console.error("Error analyzing video:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze video",
        });
      }
    }),
});
