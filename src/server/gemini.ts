import { GoogleGenAI } from "@google/genai";
import "~/dotenv-config";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in the environment variables.");
}

export const genAI = new GoogleGenAI({apiKey: apiKey ?? ""});
