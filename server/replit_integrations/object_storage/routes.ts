import type { Express, Request, Response } from "express";
import { ObjectStorageService } from "./objectStorage";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const uploadRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contentType: z.string().refine(
    (type) => ALLOWED_IMAGE_TYPES.includes(type),
    { message: "Only image files are allowed" }
  ),
  size: z.number().max(MAX_FILE_SIZE, "File size exceeds 10MB limit").optional(),
});

const generateAvatarSchema = z.object({
  agentName: z.string().min(1, "Agent name is required"),
  agentDescription: z.string().optional(),
});

export function registerObjectStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", async (req: Request, res: Response) => {
    try {
      const parseResult = uploadRequestSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { name, contentType } = parseResult.data;
      const result = await ObjectStorageService.getPresignedUploadUrl(name, contentType);
      res.json(result);
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/generate-avatar", async (req: Request, res: Response) => {
    try {
      const parseResult = generateAvatarSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0].message });
      }

      const { agentName, agentDescription } = parseResult.data;

      const prompt = `Create a professional, modern avatar icon for an AI assistant named "${agentName}". ${agentDescription ? `The assistant's role: ${agentDescription}.` : ""} The avatar should be:
- A clean, minimalist design suitable for a profile picture
- Circular-friendly composition (centered subject)
- Modern, tech-inspired aesthetic with subtle gradients
- Professional and friendly appearance
- No text or letters
- Abstract or stylized representation of an AI assistant
- High contrast, vibrant but professional colors`;

      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
      });

      const imageData = response.data[0];
      
      if (!imageData.b64_json) {
        return res.status(500).json({ error: "No image data received" });
      }

      const imageBuffer = Buffer.from(imageData.b64_json, "base64");
      const fileName = `avatar-${agentName.toLowerCase().replace(/\s+/g, "-")}.png`;

      const { publicUrl } = await ObjectStorageService.uploadBuffer(
        fileName,
        imageBuffer,
        "image/png"
      );

      res.json({ avatarUrl: publicUrl });
    } catch (error) {
      console.error("Error generating avatar:", error);
      res.status(500).json({ error: "Failed to generate avatar" });
    }
  });
}
