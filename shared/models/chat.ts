// Re-export chat-related types from main schema
export { 
  conversations, 
  messages,
  insertConversationSchema,
  insertMessageSchema,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage
} from "../schema";
