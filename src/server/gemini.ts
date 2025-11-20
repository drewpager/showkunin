import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import "@dotenvx/dotenvx/config";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in the environment variables.");
}

export const genAI = new GoogleGenerativeAI(apiKey ?? "");
export const fileManager = new GoogleAIFileManager(apiKey ?? "");
