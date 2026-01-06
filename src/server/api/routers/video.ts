import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import "~/dotenv-config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { genAI } from "~/server/gemini";
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
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
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

      if (video.userId !== session?.user.id && !video.sharing && !video.linkShareSeo) {
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
  getExamples: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx: { prisma, s3 }, input }) => {
      const limit = input.limit ?? 20;
      const { cursor } = input;

      const videos = await prisma.video.findMany({
        take: limit + 1,
        where: {
          linkShareSeo: true,
        },
        include: {
          user: {
            select: {
              name: true,
              image: true,
            },
          },
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

      return {
        items: videosWithUrls,
        nextCursor,
      };
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
  setLinkShareSeo: protectedProcedure
    .input(z.object({ videoId: z.string(), linkShareSeo: z.boolean() }))
    .mutation(async ({ ctx: { prisma, session, posthog }, input }) => {
      if (input.linkShareSeo) {
        const video = await prisma.video.findUnique({
          where: { id: input.videoId },
          select: { solved: true, userId: true },
        });

        if (!video || video.userId !== session.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        if (video.solved !== true) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You must mark this task as solved before enabling SEO link sharing.",
          });
        }
      }

      const updateVideo = await prisma.video.updateMany({
        where: {
          id: input.videoId,
          userId: session.user.id,
        },
        data: {
          linkShareSeo: input.linkShareSeo,
        },
      });

      if (updateVideo.count === 0) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "update video setLinkShareSeo",
        properties: {
          videoId: input.videoId,
          linkShareSeo: input.linkShareSeo,
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
      const MODEL_NAME = "gemini-3-flash-preview";
      
      // Get video from database
      const video = await prisma.video.findUnique({
        where: { id: input.videoId },
      });

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check if user has access to this video
      if (video.userId !== session?.user.id && !video.sharing && !video.linkShareSeo) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        let cacheName = video.geminiCacheName;
        let cacheValid = false;

        // Check if we have a valid cache
        if (cacheName && video.geminiCacheExpiresAt && video.geminiCacheExpiresAt > new Date()) {
          cacheValid = true;
        }

        if (!cacheValid) {
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
        const tempFilePath = path.join(tempDir, `${video.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}.webm`);
        
        const response = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });
        
        fs.writeFileSync(tempFilePath, new Uint8Array(response.data as ArrayBuffer));

        // Upload to Gemini
        const uploadResult = await genAI.files.upload({
          file: tempFilePath,
          config: {
            mimeType: "video/webm",
            displayName: video.title,
          },
        });

        if (!uploadResult.name) {
            fs.unlinkSync(tempFilePath);
          throw new Error("Upload failed: No file name returned from Gemini");
        }

        // Wait for file to be processed
        let file = await genAI.files.get({ name: uploadResult.name });
        while (file.state === "PROCESSING") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await genAI.files.get({ name: uploadResult.name });
        }

        if (file.state === "FAILED") {
            fs.unlinkSync(tempFilePath);
          throw new Error("Video processing failed");
        }

          // Create Cache
          const cache = await genAI.caches.create({
            model: MODEL_NAME,
            config: {
              displayName: video.title,
              contents: [
                {
                  role: "user",
                  parts: [{
                    fileData: {
                      mimeType: uploadResult.mimeType,
                      fileUri: uploadResult.uri,
                    },
                  }],
                },
              ],
              ttl: "3600s", // 1 Hour Default
              tools: [
                { urlContext: {} }
              ]
            },
          });

          if (cache.name) {
            cacheName = cache.name;
          }

          // Update DB with new cache info
          await prisma.video.update({
            where: { id: video.id },
            data: {
              geminiCacheName: cacheName,
              geminiCacheExpiresAt: new Date(Date.now() + 3500 * 1000), // Slightly less than 1 hour to be safe
            },
          });

          // Clean up temporary file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.error("Failed to cleanup temp file:", e);
          }
          
          // Note: We are NOT deleting the Gemini file immediately as it backs the cache.
          // It will eventually expire via retention policy.
        }

        // Analyze the video using Cache
        const result = await genAI.models.generateContent({
          model: MODEL_NAME,
          contents: [
            {
              parts: [
                {
                  text: input.refinementPrompt 
              ? `You are an AI problem solving and automation expert analyzing a screen recording, the subsequent analysis, and the user's follow up request.

              User Refinement Request:
              ${input.refinementPrompt}

              Please provide a refined analysis and updated response using the following context and the user's specific request. 
              
              User Context:
              ${video.userContext ?? "None"}

              Previous Analysis:
              ${video.aiAnalysis ?? "No previous analysis."}
              
              Maintain this format:
              TITLE: [A 5-word or less descriptive title for the task]
              ---ANALYSIS_START---
              1. User Analysis (Markdown) - Provide the new insights, answers to follow-up questions, or changed instructions. IMPORTANT: If the user requests code or if the previous code needs updating, YOU MUST PROVIDE THE FULL UPDATED CODE SNIPPETS. Do not just describe the changes; show the actual code.
              2. "---COMPUTER_USE_PLAN---" separator
              3. Computer Use Instructions (JSON) - Provide the FULL, complete, and updated JSON plan that incorporates all changes. This replaces the previous plan.`
              : 
              
              `You are an AI problem solving and automation expert analyzing a screen recording. The user is showing you a task they want automated or a problem they want resolved.

              User Context:
              ${video.userContext ?? "None"}

              Please analyze this video and provide your response in the following format:

              TITLE: [A 5-word or less descriptive title for the task]

              ---ANALYSIS_START---

              Section 1: User Analysis (Markdown)
              1. **Code Example**: If applicable, provide code snippets with clear instructions on where to use them
              2. **Task Summary**: A clear description of what the user is trying to accomplish
              3. **Automation Approach**: How this task could be automated (e.g., using browser automation, API calls, scripts, etc.)
              4. **Implementation Steps**: Step-by-step instructions for implementing the automation
              5. **Tools/Technologies**: List any tools, libraries, or services that would be helpful

              Verify that the output of Section 1 is valid Markdown.

              ---COMPUTER_USE_PLAN---

              Section 2: Computer Use Instructions (JSON)
              Provide a valid JSON object immediately following the separator. Do not include markdown code blocks.
              The JSON should contain a step-by-step plan for a Computer Use agent to replicate the workflow shown in the video.
              
              Format:
              {
                "task_description": "Brief description of the task",
                "steps": [
                  {
                    "action": "click" | "type" | "scroll" | "wait",
                    "coordinate": [x, y], // Estimate coordinates based on a 1024x768 resolution grid.
                    "text": "...", // For type actions
                    "description": "Explanation of the step",
                    "element_description": "Visual description of the element to interact with"
                  }
                ]
              }`
                },
              ],
            },
          ],
          config: {
            cachedContent: cacheName ? cacheName : undefined,
          }
        });

        const rawResponse = result.text ?? "";
        let analysisText = rawResponse;
        let title = video.title;

        // Parse title and main analysis text
        const analysisStartMarkers = ["---ANALYSIS_START---", "---ANALYSIS_START"];
        let foundStart = false;
        
        for (const marker of analysisStartMarkers) {
          if (rawResponse.includes(marker)) {
            const parts = rawResponse.split(marker);
            const preStart = parts[0] ?? "";
            
            // Extract title from before the start marker
            const titleMatch = preStart.match(/TITLE:\s*(.*)/i);
            if (titleMatch?.[1]) {
              title = titleMatch[1].trim();
            }
            
            analysisText = parts[1]?.trim() ?? "";
            foundStart = true;
            break;
          }
        }

        if (!foundStart) {
          // Fallback parsing if separator is missing
          const titleMatch = rawResponse.match(/TITLE:\s*(.*)/i);
          if (titleMatch?.[1]) {
            title = titleMatch[1].trim();
            analysisText = rawResponse.replace(/TITLE:.*\n?/i, "").trim();
          }
        }

        // For refinements, append the new analysis to the old one
        let finalAnalysis = analysisText;
        if (input.refinementPrompt && video.aiAnalysis) {
          const planSeparator = "---COMPUTER_USE_PLAN---";
          const separators = [planSeparator, "---COMPUTER_USE_PLAN", "Section 2: Computer Use Instructions (JSON)"];
          
          let oldDisplay = video.aiAnalysis;
          let oldPlan = "";
          for (const sep of separators) {
            if (video.aiAnalysis.includes(sep)) {
              const parts = video.aiAnalysis.split(sep);
              oldDisplay = parts[0]?.trim() ?? "";
              oldPlan = parts[1]?.trim() ?? "";
              break;
            }
          }

          let newDisplay = analysisText;
          let newPlan = "";
          for (const sep of separators) {
            if (analysisText.includes(sep)) {
              const parts = analysisText.split(sep);
              newDisplay = parts[0]?.trim() ?? "";
              newPlan = parts[1]?.trim() ?? "";
              break;
            }
          }

          if (newDisplay) {
            const timestamp = new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            
            // User Refinement Block
            const userPromptBlock = input.refinementPrompt 
              ? `\n\n---\n\n> **User Refinement**\n> ${input.refinementPrompt.replace(/\n/g, '\n> ')}\n\n`
              : `\n\n---\n\n`;

            const separatorWithHeader = `### Refined Analysis (${timestamp})\n\n`;
            const planToUse = newPlan || oldPlan;
            
            finalAnalysis = `${oldDisplay}${userPromptBlock}${separatorWithHeader}${newDisplay}${planToUse ? `\n\n${planSeparator}\n${planToUse}` : ""}`;
          }
        }

        // Save analysis and update title in database
        const updatedVideo = await prisma.video.update({
          where: { id: input.videoId },
          data: {
            title: title,
            aiAnalysis: finalAnalysis,
            aiAnalysisGeneratedAt: new Date(),
          },
        });

        return {
          success: true,
          analysis: finalAnalysis,
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
  
  analyzeScreencastUpdate: publicProcedure
    .input(z.object({ 
      videoId: z.string(), 
      videoBlob: z.string(), // base64 encoded video
      refinementPrompt: z.string().optional(), 
    }))
    .mutation(async ({ ctx, input }) => {
      const { prisma, session } = ctx;
      
      // Get video from database
      const video = await prisma.video.findUnique({
        where: { id: input.videoId },
      });

      if (!video) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check if user has access to this video
      if (video.userId !== session?.user.id && !video.sharing && !video.linkShareSeo) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        // Decode base64 video blob
        const videoBuffer = Buffer.from(input.videoBlob, 'base64');
        
        // Write to temporary file
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `screencast-${video.id}-${Date.now()}.webm`);
        
        fs.writeFileSync(tempFilePath, new Uint8Array(videoBuffer));

        // Upload to Gemini (temporary)
        const uploadResult = await genAI.files.upload({
          file: tempFilePath,
          config: {
            mimeType: "video/webm",
            displayName: `Screencast Update - ${video.title}`,
          },
        });

        if (!uploadResult.name) {
          throw new Error("Upload failed: No file name returned from Gemini");
        }

        // Wait for file to be processed
        let file = await genAI.files.get({ name: uploadResult.name });
        while (file.state === "PROCESSING") {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await genAI.files.get({ name: uploadResult.name });
        }

        if (file.state === "FAILED") {
          throw new Error("Video processing failed");
        }

        // Analyze the video with refinement context
        const result = await genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                {
                  fileData: {
                    mimeType: uploadResult.mimeType,
                    fileUri: uploadResult.uri,
                  },
                },
                {
                  text: `You are an AI problem solving and automation expert analyzing a follow-up screen recording.
              
                  User Context:
                  ${video.userContext ?? "None"}

                  Previous Analysis:
                  ${video.aiAnalysis ?? "No previous analysis."}

                  User Refinement Request:
                  ${input.refinementPrompt ? input.refinementPrompt : "N/A"}

                  Additional Screencast Context:
                  The user has recorded a NEW screencast to provide additional visual context for their refinement request. Please analyze this new recording alongside the original video context.

                  Please provide a refined analysis based on the new screencast and the user's specific request above. 
                                
                  Maintain this format:
                  ---ANALYSIS_START---
                  1. User Analysis (Markdown) - Provide the new insights, answers to follow-up questions, or changed instructions based on the new screencast. IMPORTANT: If the user requests code or if the previous code needs updating, YOU MUST PROVIDE THE FULL UPDATED CODE SNIPPETS. Do not just describe the changes; show the actual code.
                  2. "---COMPUTER_USE_PLAN---" separator
                  3. Computer Use Instructions (JSON) - Provide the FULL, complete, and updated JSON plan that incorporates all changes. This replaces the previous plan.`
                },
              ],
            },
          ],
          config: {
            tools: [
              { urlContext: {} }
            ]
          }
        });

        const rawResponse = result.text ?? "";
        let analysisText = rawResponse;

        // Parse title and main analysis text
        const analysisStartMarkers = ["---ANALYSIS_START---", "---ANALYSIS_START"];
        let foundStart = false;
        
        for (const marker of analysisStartMarkers) {
          if (rawResponse.includes(marker)) {
            const parts = rawResponse.split(marker);
            analysisText = parts[1]?.trim() ?? "";
            foundStart = true;
            break;
          }
        }

        if (!foundStart) {
          // Fallback parsing if separator is missing
          analysisText = rawResponse.replace(/TITLE:.*\n?/i, "").trim();
        }

        // Clean up temporary file
        fs.unlinkSync(tempFilePath);

        // Delete the file from Gemini
        if (uploadResult.name) {
          await genAI.files.delete({ name: uploadResult.name });
        }

        // Append the new analysis to the old one
        let finalAnalysis = analysisText;
        if (video.aiAnalysis) {
          const planSeparator = "---COMPUTER_USE_PLAN---";
          const separators = [planSeparator, "---COMPUTER_USE_PLAN", "Section 2: Computer Use Instructions (JSON)"];
          
          let oldDisplay = video.aiAnalysis;
          let oldPlan = "";
          for (const sep of separators) {
            if (video.aiAnalysis.includes(sep)) {
              const parts = video.aiAnalysis.split(sep);
              oldDisplay = parts[0]?.trim() ?? "";
              oldPlan = parts[1]?.trim() ?? "";
              break;
            }
          }

          let newDisplay = analysisText;
          let newPlan = "";
          for (const sep of separators) {
            if (analysisText.includes(sep)) {
              const parts = analysisText.split(sep);
              newDisplay = parts[0]?.trim() ?? "";
              newPlan = parts[1]?.trim() ?? "";
              break;
            }
          }

          if (newDisplay) {
            const timestamp = new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            
            let userPromptBlock = `\n\n---\n\n> **User Refinement**\n`;
            if (input.refinementPrompt) {
               userPromptBlock += `> ${input.refinementPrompt.replace(/\n/g, '\n> ')}\n`;
            }
            userPromptBlock += `> 🎥 **Screencast Refinement Recorded**\n\n`;

            const separatorWithHeader = `### Screencast Update (${timestamp})\n\n`;
            const planToUse = newPlan || oldPlan;
            
            finalAnalysis = `${oldDisplay}${userPromptBlock}${separatorWithHeader}${newDisplay}${planToUse ? `\n\n${planSeparator}\n${planToUse}` : ""}`;
          }
        }

        // Save updated analysis in database
        const updatedVideo = await prisma.video.update({
          where: { id: input.videoId },
          data: {
            aiAnalysis: finalAnalysis,
            aiAnalysisGeneratedAt: new Date(),
          },
        });

        return {
          success: true,
          analysis: finalAnalysis,
          generatedAt: updatedVideo.aiAnalysisGeneratedAt,
        };
      } catch (error) {
        console.error("Error analyzing screencast update:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to analyze screencast update",
        });
      }
    }),
  copyTask: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ ctx: { prisma, session, s3, posthog }, input }) => {
      const { videoId } = input;

      // 1. Get original video
      const originalVideo = await prisma.video.findUnique({
        where: { id: videoId },
      });

      if (!originalVideo) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Check if user has access to this video (owner or shared)
      if (originalVideo.userId !== session.user.id && !originalVideo.sharing && !originalVideo.linkShareSeo) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // 2. Check user's video limit
      const userVideoCount = await prisma.video.count({
        where: { userId: session.user.id },
      });

      if (
        session.user.stripeSubscriptionStatus !== "active" &&
        !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
        userVideoCount >= 10
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You have reached the maximum video limit on our free tier. Please upgrade to copy more tasks.",
        });
      }

      // 3. Create new video record
      const newVideo = await prisma.video.create({
        data: {
          userId: session.user.id,
          title: `Copy of ${originalVideo.title}`,
          userContext: originalVideo.userContext,
          aiAnalysis: originalVideo.aiAnalysis,
          aiAnalysisGeneratedAt: originalVideo.aiAnalysisGeneratedAt,
          sharing: false, // Default to private for the copy
          linkShareSeo: false,
        },
      });

      // 4. Copy S3 objects
      const bucket = process.env.AWS_BUCKET_NAME;
      if (!bucket) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AWS_BUCKET_NAME is not defined",
        });
      }
      
      // Copy video file
      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${originalVideo.userId}/${originalVideo.id}`,
            Key: `${session.user.id}/${newVideo.id}`,
          })
        );
      } catch (err) {
        console.error("Error copying video in S3:", err);
      }

      // Copy thumbnail
      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${originalVideo.userId}/${originalVideo.id}-thumbnail`,
            Key: `${session.user.id}/${newVideo.id}-thumbnail`,
          })
        );
      } catch (err) {
        console.error("Error copying thumbnail in S3:", err);
      }

      posthog?.capture({
        distinctId: session.user.id,
        event: "copy task",
        properties: {
          originalVideoId: originalVideo.id,
          newVideoId: newVideo.id,
        },
      });
      void posthog?.shutdownAsync();

      return {
        success: true,
        newVideoId: newVideo.id,
      };
    }),
});
