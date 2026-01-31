import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Meeting, Conversation, Message } from "@shared/schema";

type ConversationWithMessages = Conversation & { messages: Message[] };

const suggestedQuestions = [
  "What were the main topics discussed?",
  "Can you summarize the key decisions?",
  "What action items were mentioned?",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-testid={`message-${message.id}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-violet-100 dark:bg-violet-900/30"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        )}
      </div>
      <div
        className={`flex max-w-[75%] flex-col gap-1 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-card border rounded-bl-sm"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(message.createdAt), "p")}
        </span>
      </div>
    </div>
  );
}

function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 flex-row" data-testid="streaming-message">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
        <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex max-w-[75%] flex-col gap-1 items-start">
        <div className="bg-card border rounded-2xl rounded-bl-sm px-4 py-2">
          <p className="text-sm whitespace-pre-wrap break-words">
            {content}
            <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestedClick }: { onSuggestedClick: (question: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-medium mb-2">Ask about this meeting</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        I'm an AI assistant that knows about everything discussed in this meeting.
        Ask me anything about the topics, decisions, or action items.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-md">
        <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
        {suggestedQuestions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            className="justify-start text-left h-auto py-3 px-4"
            onClick={() => onSuggestedClick(question)}
            data-testid={`suggested-question-${index}`}
          >
            <MessageSquare className="h-4 w-4 shrink-0 mr-2 text-muted-foreground" />
            <span className="truncate">{question}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function MeetingQAPage() {
  const { meetingId, conversationId } = useParams<{
    meetingId: string;
    conversationId: string;
  }>();
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: meeting, isLoading: meetingLoading } = useQuery<Meeting>({
    queryKey: ["/api/meetings", meetingId],
    enabled: !!meetingId,
  });

  const { data: conversation, isLoading: conversationLoading } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/conversations", conversationId],
    enabled: !!conversationId,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.messages, streamingContent]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setStreamingContent((prev) => prev + data.content);
              }
              if (data.done) {
                queryClient.invalidateQueries({
                  queryKey: ["/api/conversations", conversationId],
                });
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleSuggestedClick = (question: string) => {
    sendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  if (meetingLoading || conversationLoading) {
    return (
      <div className="flex flex-1 flex-col h-full">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
        <div className="flex-1 p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-3/4" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!meeting || !conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Conversation not found</h1>
        <Link href={`/meetings/${meetingId}`}>
          <Button variant="outline" data-testid="button-back-to-meeting">
            Back to Meeting
          </Button>
        </Link>
      </div>
    );
  }

  const messages = conversation.messages || [];
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <Link href={`/meetings/${meetingId}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate" data-testid="text-meeting-name">
              {meeting.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Ask questions about this meeting
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {hasMessages ? (
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="space-y-4 p-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isStreaming && streamingContent && (
                <StreamingMessage content={streamingContent} />
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-3" data-testid="loading-indicator">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <Loader2 className="h-4 w-4 text-violet-600 dark:text-violet-400 animate-spin" />
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        ) : (
          <EmptyState onSuggestedClick={handleSuggestedClick} />
        )}
      </div>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the meeting..."
            disabled={isStreaming}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || isStreaming}
            data-testid="button-send"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
