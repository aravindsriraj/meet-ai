import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const meetingStatusEnum = pgEnum("meeting_status", [
  "upcoming",
  "active",
  "processing",
  "completed",
  "cancelled"
]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// AI Agents table - custom AI agents with role-based instructions
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  instructions: text("instructions").notNull(),
  voice: text("voice").notNull().default("alloy"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Meetings table - video call sessions with AI agents
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  status: meetingStatusEnum("status").notNull().default("upcoming"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  recordingUrl: text("recording_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Transcripts table - full call transcripts with speaker info
export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  speaker: text("speaker").notNull(),
  content: text("content").notNull(),
  timestamp: integer("timestamp").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Summaries table - AI-generated meeting summaries organized by topic
export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  content: text("content").notNull(),
  startTimestamp: integer("start_timestamp"),
  endTimestamp: integer("end_timestamp"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Conversations table - for AI Q&A about meetings
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Messages table - chat messages in conversations
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Relations
export const agentsRelations = relations(agents, ({ many }) => ({
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  agent: one(agents, {
    fields: [meetings.agentId],
    references: [agents.id],
  }),
  transcripts: many(transcripts),
  summaries: many(summaries),
  conversations: many(conversations),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  meeting: one(meetings, {
    fields: [transcripts.meetingId],
    references: [meetings.id],
  }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  meeting: one(meetings, {
    fields: [summaries.meetingId],
    references: [meetings.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  meeting: one(meetings, {
    fields: [conversations.meetingId],
    references: [meetings.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
  status: true,
  startedAt: true,
  endedAt: true,
  recordingUrl: true,
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
});

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetings.$inferSelect;
export type MeetingStatus = "upcoming" | "active" | "processing" | "completed" | "cancelled";

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcripts.$inferSelect;

export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Summary = typeof summaries.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Extended types for API responses
export type MeetingWithAgent = Meeting & {
  agent: Agent | null;
};

export type MeetingFull = Meeting & {
  agent: Agent | null;
  transcripts: Transcript[];
  summaries: Summary[];
};
