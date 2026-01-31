import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { serve } from "inngest/express";
import { StreamChat } from "stream-chat";
import { storage } from "./storage";
import { insertAgentSchema, insertMeetingSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { inngest } from "./inngest/client";
import { allFunctions } from "./inngest/functions";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const streamChat = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // =====================
  // INNGEST HANDLER
  // =====================
  
  app.use("/api/inngest", serve({ client: inngest, functions: allFunctions }));

  // =====================
  // OBJECT STORAGE ROUTES
  // =====================
  
  registerObjectStorageRoutes(app);

  // =====================
  // AGENTS ROUTES
  // =====================
  
  app.get("/api/agents", async (req: Request, res: Response) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req: Request, res: Response) => {
    try {
      const data = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(data);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertAgentSchema.partial().parse(req.body);
      const agent = await storage.updateAgent(id, data);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error updating agent:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid agent data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAgent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  // =====================
  // MEETINGS ROUTES
  // =====================
  
  app.get("/api/meetings", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      let meetings;
      if (status && ["upcoming", "active", "processing", "completed", "cancelled"].includes(status)) {
        meetings = await storage.getMeetingsByStatus(status as any);
      } else {
        meetings = await storage.getAllMeetings();
      }
      res.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  app.get("/api/meetings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const full = req.query.full === "true";
      
      if (full) {
        const meeting = await storage.getMeetingFull(id);
        if (!meeting) {
          return res.status(404).json({ error: "Meeting not found" });
        }
        res.json(meeting);
      } else {
        const meeting = await storage.getMeeting(id);
        if (!meeting) {
          return res.status(404).json({ error: "Meeting not found" });
        }
        res.json(meeting);
      }
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "Failed to fetch meeting" });
    }
  });

  app.post("/api/meetings", async (req: Request, res: Response) => {
    try {
      const data = insertMeetingSchema.parse(req.body);
      const meeting = await storage.createMeeting(data);
      res.status(201).json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid meeting data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  app.patch("/api/meetings/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!["upcoming", "active", "processing", "completed", "cancelled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const meeting = await storage.updateMeetingStatus(id, status);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error updating meeting status:", error);
      res.status(500).json({ error: "Failed to update meeting status" });
    }
  });

  app.post("/api/meetings/:id/start", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const meeting = await storage.startMeeting(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error starting meeting:", error);
      res.status(500).json({ error: "Failed to start meeting" });
    }
  });

  app.post("/api/meetings/:id/end", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const recordingUrl = req.body?.recordingUrl || null;
      const meeting = await storage.endMeeting(id, recordingUrl);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error ending meeting:", error);
      res.status(500).json({ error: "Failed to end meeting" });
    }
  });

  app.delete("/api/meetings/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMeeting(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "Failed to delete meeting" });
    }
  });

  // =====================
  // TRANSCRIPTS ROUTES
  // =====================
  
  app.get("/api/meetings/:id/transcripts", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id);
      const query = req.query.q as string | undefined;
      
      let transcripts;
      if (query) {
        transcripts = await storage.searchTranscripts(meetingId, query);
      } else {
        transcripts = await storage.getTranscriptsByMeeting(meetingId);
      }
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching transcripts:", error);
      res.status(500).json({ error: "Failed to fetch transcripts" });
    }
  });

  // =====================
  // SUMMARIES ROUTES
  // =====================
  
  app.get("/api/meetings/:id/summaries", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id);
      const summaries = await storage.getSummariesByMeeting(meetingId);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ error: "Failed to fetch summaries" });
    }
  });

  // =====================
  // CONVERSATIONS (Q&A) ROUTES
  // =====================
  
  app.get("/api/meetings/:id/conversations", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id);
      const conversations = await storage.getConversationsByMeeting(meetingId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/meetings/:id/conversations", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { title } = req.body;
      const conversation = await storage.createConversation(title || "Meeting Q&A", meetingId);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response with streaming (Meeting context Q&A)
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }

      // Save user message
      await storage.createMessage(conversationId, "user", content);

      // Get conversation with meeting context
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Get meeting context if this conversation is linked to a meeting
      let meetingContext = "";
      if (conversation.meetingId) {
        const meeting = await storage.getMeetingFull(conversation.meetingId);
        if (meeting) {
          meetingContext = `
Meeting: ${meeting.name}
Status: ${meeting.status}

Summaries:
${meeting.summaries.map(s => `- ${s.topic}: ${s.content}`).join("\n")}

Transcript excerpts:
${meeting.transcripts.slice(0, 50).map(t => `[${t.speaker}]: ${t.content}`).join("\n")}
`;
        }
      }

      // Get conversation history
      const messages = await storage.getMessagesByConversation(conversationId);
      const chatMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
        {
          role: "system",
          content: `You are a helpful AI assistant that answers questions about meetings. Be concise and helpful.${meetingContext ? "\n\nMeeting Context:\n" + meetingContext : ""}`,
        },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      // Save assistant message
      await storage.createMessage(conversationId, "assistant", fullResponse);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  // =====================
  // VOICE CHAT ROUTE (for real-time AI agent during calls)
  // =====================
  
  app.post("/api/voice-chat", async (req: Request, res: Response) => {
    try {
      const { audio, agentId, voice = "alloy" } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      // Get agent instructions if provided
      let systemPrompt = "You are a helpful AI assistant participating in a video call.";
      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          systemPrompt = agent.instructions;
        }
      }

      // Import audio utilities
      const { ensureCompatibleFormat, speechToText } = await import("./replit_integrations/audio/client");
      
      // Convert to compatible format
      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer: audioBuffer, format: inputFormat } = await ensureCompatibleFormat(rawBuffer);

      // Transcribe user audio
      const userTranscript = await speechToText(audioBuffer, inputFormat);

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

      // Stream audio response from gpt-audio
      const stream = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userTranscript },
        ],
        stream: true,
      });

      let assistantTranscript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.audio?.transcript) {
          assistantTranscript += delta.audio.transcript;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}\n\n`);
        }

        if (delta?.audio?.data) {
          res.write(`data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript, userTranscript })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error processing voice chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process voice chat" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process voice chat" });
      }
    }
  });

  // =====================
  // PROCESSING ROUTES (Trigger Inngest background jobs)
  // =====================
  
  app.post("/api/meetings/:id/process", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { transcriptData } = req.body;

      // Send event to Inngest to trigger background processing
      await inngest.send({
        name: "meeting/call.ended",
        data: {
          meetingId,
          transcriptData: transcriptData || [],
        },
      });

      console.log(`Triggered background processing for meeting ${meetingId}`);
      res.json({ success: true, message: "Processing started in background" });
    } catch (error) {
      console.error("Error triggering meeting processing:", error);
      res.status(500).json({ error: "Failed to start meeting processing" });
    }
  });

  // =====================
  // STREAM CHAT TOKEN
  // =====================

  app.post("/api/stream-chat/token", async (req: Request, res: Response) => {
    try {
      const { meetingId, displayName } = req.body;
      
      if (!meetingId || typeof meetingId !== "number") {
        return res.status(400).json({ error: "meetingId is required and must be a number" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.status !== "completed") {
        return res.status(400).json({ error: "Ask AI is only available for completed meetings" });
      }

      const userId = `participant-m${meetingId}-${Date.now()}`;
      const userName = displayName || "Meeting Participant";

      await streamChat.upsertUser({
        id: userId,
        name: userName,
        role: "user",
      });

      const token = streamChat.createToken(userId);
      
      res.json({ token, userId, channelId: `meeting-${meetingId}` });
    } catch (error) {
      console.error("Error creating Stream Chat token:", error);
      res.status(500).json({ error: "Failed to create chat token" });
    }
  });

  // Ask AI - Generate AI response about meeting content
  app.post("/api/meetings/:id/ask-ai", async (req: Request, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id as string);
      const { question } = req.body;

      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "Question is required" });
      }

      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      if (meeting.status !== "completed") {
        return res.status(400).json({ error: "Ask AI is only available for completed meetings" });
      }

      // Fetch transcripts and summaries for context
      const transcripts = await storage.getTranscriptsByMeeting(meetingId);
      const summaries = await storage.getSummariesByMeeting(meetingId);

      // Build context from meeting content
      let context = `Meeting: ${meeting.name}\n\n`;
      
      if (summaries.length > 0) {
        context += "=== Meeting Summary ===\n";
        summaries.forEach(s => {
          context += `Topic: ${s.topic}\n${s.content}\n\n`;
        });
      }

      if (transcripts.length > 0) {
        context += "=== Meeting Transcript ===\n";
        transcripts.forEach(t => {
          context += `[${t.speaker}]: ${t.content}\n`;
        });
      }

      if (transcripts.length === 0 && summaries.length === 0) {
        return res.json({ 
          answer: "I don't have any transcript or summary data for this meeting yet. Please ensure the meeting was processed after it ended." 
        });
      }

      // Generate AI response using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that helps users understand and find information from their meeting recordings. 
You have access to the meeting transcript and summary below. 
Answer the user's questions accurately based on this content.
If the answer is not in the meeting content, say so honestly.
Be concise but thorough.

${context}`
          },
          {
            role: "user",
            content: question
          }
        ],
        max_tokens: 1024,
      });

      const answer = completion.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
      
      res.json({ answer });
    } catch (error) {
      console.error("Error in Ask AI:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  // =====================
  // REALTIME API SESSION (WebRTC)
  // =====================

  app.post("/api/realtime/session", express.text({ type: ["application/sdp", "text/plain"] }), async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : null;
      const sdpOffer = req.body;

      if (!sdpOffer || typeof sdpOffer !== "string") {
        return res.status(400).json({ error: "SDP offer is required" });
      }

      // Get agent configuration if provided
      let instructions = "You are a helpful AI assistant participating in a video call. Be conversational and natural. Always respond in English unless the user specifically asks you to speak another language.";
      let voice = "alloy";
      
      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (agent) {
          instructions = agent.instructions;
          voice = agent.voice || "alloy";
        }
      }

      // Create session configuration for WebRTC calls endpoint
      // Per OpenAI docs: only type, model, instructions, and audio config are allowed here
      // Turn detection and other settings must be configured via session.update after connection
      const sessionConfig = JSON.stringify({
        type: "realtime",
        model: "gpt-realtime",
        instructions,
        audio: { 
          output: { voice } 
        }
      });

      // Create multipart form data
      const formData = new FormData();
      formData.set("sdp", sdpOffer);
      formData.set("session", sessionConfig);

      // Call OpenAI Realtime API (requires user's own API key, not AI integrations)
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI Realtime API error:", errorText);
        return res.status(response.status).json({ error: "Failed to create realtime session" });
      }

      // Return the SDP answer
      const sdpAnswer = await response.text();
      res.set("Content-Type", "application/sdp").send(sdpAnswer);
    } catch (error) {
      console.error("Error creating realtime session:", error);
      res.status(500).json({ error: "Failed to create realtime session" });
    }
  });

  return httpServer;
}
