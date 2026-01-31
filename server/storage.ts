import { 
  users, agents, meetings, transcripts, summaries, conversations, messages,
  type User, type InsertUser,
  type Agent, type InsertAgent,
  type Meeting, type InsertMeeting, type MeetingWithAgent, type MeetingFull, type MeetingStatus,
  type Transcript, type InsertTranscript,
  type Summary, type InsertSummary,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Agents
  getAgent(id: number): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  
  // Meetings
  getMeeting(id: number): Promise<MeetingWithAgent | undefined>;
  getMeetingFull(id: number): Promise<MeetingFull | undefined>;
  getAllMeetings(): Promise<MeetingWithAgent[]>;
  getMeetingsByStatus(status: MeetingStatus): Promise<MeetingWithAgent[]>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeetingStatus(id: number, status: MeetingStatus): Promise<Meeting | undefined>;
  startMeeting(id: number): Promise<Meeting | undefined>;
  endMeeting(id: number, recordingUrl?: string): Promise<Meeting | undefined>;
  deleteMeeting(id: number): Promise<void>;
  
  // Transcripts
  getTranscriptsByMeeting(meetingId: number): Promise<Transcript[]>;
  searchTranscripts(meetingId: number, query: string): Promise<Transcript[]>;
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;
  createTranscripts(transcripts: InsertTranscript[]): Promise<Transcript[]>;
  
  // Summaries
  getSummariesByMeeting(meetingId: number): Promise<Summary[]>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  createSummaries(summaries: InsertSummary[]): Promise<Summary[]>;
  
  // Conversations (Q&A)
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsByMeeting(meetingId: number): Promise<Conversation[]>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(title: string, meetingId?: number): Promise<Conversation>;
  deleteConversation(id: number): Promise<void>;
  
  // Messages
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Agents
  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async getAllAgents(): Promise<Agent[]> {
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updated] = await db.update(agents).set(agent).where(eq(agents.id, id)).returning();
    return updated || undefined;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  // Meetings
  async getMeeting(id: number): Promise<MeetingWithAgent | undefined> {
    const result = await db.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: { agent: true },
    });
    return result ? { ...result, agent: result.agent || null } : undefined;
  }

  async getMeetingFull(id: number): Promise<MeetingFull | undefined> {
    const result = await db.query.meetings.findFirst({
      where: eq(meetings.id, id),
      with: { 
        agent: true,
        transcripts: { orderBy: [transcripts.timestamp] },
        summaries: { orderBy: [summaries.startTimestamp] },
      },
    });
    return result ? { 
      ...result, 
      agent: result.agent || null,
      transcripts: result.transcripts || [],
      summaries: result.summaries || [],
    } : undefined;
  }

  async getAllMeetings(): Promise<MeetingWithAgent[]> {
    const result = await db.query.meetings.findMany({
      with: { agent: true },
      orderBy: [desc(meetings.createdAt)],
    });
    return result.map(m => ({ ...m, agent: m.agent || null }));
  }

  async getMeetingsByStatus(status: MeetingStatus): Promise<MeetingWithAgent[]> {
    const result = await db.query.meetings.findMany({
      where: eq(meetings.status, status),
      with: { agent: true },
      orderBy: [desc(meetings.createdAt)],
    });
    return result.map(m => ({ ...m, agent: m.agent || null }));
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }

  async updateMeetingStatus(id: number, status: MeetingStatus): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({ status })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async startMeeting(id: number): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({ status: "active", startedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async endMeeting(id: number, recordingUrl?: string): Promise<Meeting | undefined> {
    const [updated] = await db.update(meetings)
      .set({ 
        status: "processing", 
        endedAt: new Date(),
        recordingUrl: recordingUrl || null,
      })
      .where(eq(meetings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMeeting(id: number): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // Transcripts
  async getTranscriptsByMeeting(meetingId: number): Promise<Transcript[]> {
    return db.select().from(transcripts)
      .where(eq(transcripts.meetingId, meetingId))
      .orderBy(transcripts.timestamp);
  }

  async searchTranscripts(meetingId: number, query: string): Promise<Transcript[]> {
    return db.select().from(transcripts)
      .where(and(
        eq(transcripts.meetingId, meetingId),
        ilike(transcripts.content, `%${query}%`)
      ))
      .orderBy(transcripts.timestamp);
  }

  async createTranscript(transcript: InsertTranscript): Promise<Transcript> {
    const [created] = await db.insert(transcripts).values(transcript).returning();
    return created;
  }

  async createTranscripts(items: InsertTranscript[]): Promise<Transcript[]> {
    if (items.length === 0) return [];
    return db.insert(transcripts).values(items).returning();
  }

  // Summaries
  async getSummariesByMeeting(meetingId: number): Promise<Summary[]> {
    return db.select().from(summaries)
      .where(eq(summaries.meetingId, meetingId))
      .orderBy(summaries.startTimestamp);
  }

  async createSummary(summary: InsertSummary): Promise<Summary> {
    const [created] = await db.insert(summaries).values(summary).returning();
    return created;
  }

  async createSummaries(items: InsertSummary[]): Promise<Summary[]> {
    if (items.length === 0) return [];
    return db.insert(summaries).values(items).returning();
  }

  // Conversations
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsByMeeting(meetingId: number): Promise<Conversation[]> {
    return db.select().from(conversations)
      .where(eq(conversations.meetingId, meetingId))
      .orderBy(desc(conversations.createdAt));
  }

  async getAllConversations(): Promise<Conversation[]> {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async createConversation(title: string, meetingId?: number): Promise<Conversation> {
    const [conversation] = await db.insert(conversations)
      .values({ title, meetingId: meetingId || null })
      .returning();
    return conversation;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // Messages
  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const [message] = await db.insert(messages)
      .values({ conversationId, role, content })
      .returning();
    return message;
  }
}

export const storage = new DatabaseStorage();
