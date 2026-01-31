import type { Express, Request, Response } from "express";
import { ObjectStorageService } from "./objectStorage";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function registerObjectStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", async (req: Request, res: Response) => {
    try {
      const { name, contentType } = req.body;

      if (!name || !contentType) {
        return res.status(400).json({ error: "Name and contentType are required" });
      }

      const result = await ObjectStorageService.getPresignedUploadUrl(name, contentType);
      res.json(result);
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/generate-avatar", async (req: Request, res: Response) => {
    try {
      const { agentName, agentDescription } = req.body;

      if (!agentName) {
        return res.status(400).json({ error: "Agent name is required" });
      }

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
