import { inngest } from "./client";
import { storage } from "../storage";
import OpenAI from "openai";
import { StreamChat } from "stream-chat";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const streamChat = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

export const processMeetingTranscripts = inngest.createFunction(
  { id: "process-meeting-transcripts", name: "Save Meeting Transcripts" },
  { event: "meeting/call.ended" },
  async ({ event, step }) => {
    const { meetingId, transcriptData } = event.data;

    await step.run("save-transcripts", async () => {
      if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
        await storage.createTranscripts(transcriptData.map((t: any) => ({
          meetingId,
          speaker: t.speaker,
          content: t.content,
          timestamp: t.timestamp,
        })));
        console.log(`Saved ${transcriptData.length} transcripts for meeting ${meetingId}`);
      }
    });

    return { success: true, transcriptCount: transcriptData?.length || 0 };
  }
);

export const generateMeetingSummary = inngest.createFunction(
  { id: "generate-meeting-summary", name: "Generate Meeting Summary" },
  { event: "meeting/call.ended" },
  async ({ event, step }) => {
    const { meetingId } = event.data;

    const summaries = await step.run("generate-summary", async () => {
      const transcripts = await storage.getTranscriptsByMeeting(meetingId);
      
      if (transcripts.length === 0) {
        console.log(`No transcripts found for meeting ${meetingId}, skipping summary`);
        return [];
      }

      const transcriptText = transcripts.map(t => `[${t.speaker}]: ${t.content}`).join("\n");
      
      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert meeting summarizer. Create a comprehensive, detailed summary of the meeting organized by topics.

Return a JSON object with a "topics" array, where each topic has:
- "topic": A clear, concise topic title
- "content": A detailed summary of what was discussed about this topic
- "keyPoints": An array of key takeaways from this topic

Be thorough and capture all important discussions, decisions, and action items.`,
          },
          {
            role: "user",
            content: `Create a detailed summary of this meeting transcript:\n\n${transcriptText}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });

      const summaryContent = summaryResponse.choices[0]?.message?.content || "{}";
      try {
        const parsed = JSON.parse(summaryContent);
        const topics = parsed.topics || parsed.summaries || [parsed];
        
        const summaryData = (Array.isArray(topics) ? topics : [topics]).map((s: any, i: number) => ({
          meetingId,
          topic: s.topic || `Topic ${i + 1}`,
          content: s.content || s.summary || "",
          startTimestamp: s.startTimestamp || null,
          endTimestamp: s.endTimestamp || null,
        }));

        await storage.createSummaries(summaryData);
        console.log(`Created ${summaryData.length} summaries for meeting ${meetingId}`);
        return summaryData;
      } catch (e) {
        console.error("Failed to parse summary response:", e);
        return [];
      }
    });

    return { success: true, summaryCount: summaries.length };
  }
);

export const setupAskAiChat = inngest.createFunction(
  { id: "setup-ask-ai-chat", name: "Setup Ask AI Chat Channel" },
  { event: "meeting/call.ended" },
  async ({ event, step }) => {
    const { meetingId } = event.data;

    const channelId = await step.run("create-stream-channel", async () => {
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        throw new Error(`Meeting ${meetingId} not found`);
      }

      const channelId = `meeting-${meetingId}`;
      
      try {
        await streamChat.upsertUser({
          id: "ai-assistant",
          name: "AI Assistant",
          role: "admin",
        });

        const channel = streamChat.channel("messaging", channelId, {
          created_by_id: "ai-assistant",
        });

        await channel.create();
        
        await channel.update({
          name: `Ask AI: ${meeting.name}`,
        } as any, { name: `Ask AI: ${meeting.name}` } as any);
        
        console.log(`Created Stream Chat channel ${channelId} for meeting ${meetingId}`);
        
        return channelId;
      } catch (error: any) {
        if (error.code === 4 && error.message?.includes("already exists")) {
          console.log(`Channel ${channelId} already exists`);
          return channelId;
        }
        throw error;
      }
    });

    return { success: true, channelId };
  }
);

export const completeMeetingProcessing = inngest.createFunction(
  { id: "complete-meeting-processing", name: "Complete Meeting Processing" },
  { event: "meeting/call.ended" },
  async ({ event, step }) => {
    const { meetingId } = event.data;

    await step.sleep("wait-for-processing", "5s");

    await step.run("mark-completed", async () => {
      await storage.updateMeetingStatus(meetingId, "completed");
      console.log(`Meeting ${meetingId} marked as completed`);
    });

    return { success: true, meetingId };
  }
);

export const allFunctions = [
  processMeetingTranscripts,
  generateMeetingSummary,
  setupAskAiChat,
  completeMeetingProcessing,
];
