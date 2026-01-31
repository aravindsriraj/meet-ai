import { useEffect, useState, useCallback, useRef } from "react";
import { StreamChat, Channel as StreamChannel, Event } from "stream-chat";
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
  Window,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import { Card } from "@/components/ui/card";
import { Loader2, MessageCircle, Bot } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AskAIChatProps {
  meetingId: number;
  meetingName: string;
}

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY || "";

export function AskAIChat({ meetingId, meetingName }: AskAIChatProps) {
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const userIdRef = useRef<string>("");
  const processedMessagesRef = useRef<Set<string>>(new Set());

  const handleAskAI = useCallback(async (question: string, currentChannel: StreamChannel) => {
    if (!question.trim() || isAiResponding) return;

    setIsAiResponding(true);
    try {
      const response = await apiRequest("POST", `/api/meetings/${meetingId}/ask-ai`, {
        question: question.trim(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI response");
      }

      const { answer } = await response.json();

      await currentChannel.sendMessage({
        text: answer,
        user: { id: "ai-assistant", name: "AI Assistant" },
      });
    } catch (err: any) {
      console.error("Failed to get AI response:", err);
      await currentChannel.sendMessage({
        text: "Sorry, I couldn't process your question. Please try again.",
        user: { id: "ai-assistant", name: "AI Assistant" },
      });
    } finally {
      setIsAiResponding(false);
    }
  }, [meetingId, isAiResponding]);

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;
    let currentClient: StreamChat | null = null;
    let currentChannel: StreamChannel | null = null;

    const init = async () => {
      if (!STREAM_API_KEY) {
        setError("Stream Chat API key not configured");
        setLoading(false);
        return;
      }

      try {
        const tokenResponse = await apiRequest("POST", "/api/stream-chat/token", {
          meetingId,
          displayName: "Meeting Participant",
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || "Failed to get chat token");
        }

        const { token, userId, channelId } = await tokenResponse.json();
        userIdRef.current = userId;

        currentClient = StreamChat.getInstance(STREAM_API_KEY);
        await currentClient.connectUser(
          { id: userId, name: "You" },
          token
        );

        currentChannel = currentClient.channel("messaging", channelId);
        await currentChannel.watch();

        const messageHandler = (event: Event) => {
          const message = event.message;
          if (!message || !message.id) return;
          
          if (processedMessagesRef.current.has(message.id)) return;
          
          if (message.user?.id === userId && message.text && currentChannel) {
            processedMessagesRef.current.add(message.id);
            handleAskAI(message.text, currentChannel);
          }
        };

        currentChannel.on("message.new", messageHandler);
        cleanupFn = () => currentChannel?.off("message.new", messageHandler);

        setChatClient(currentClient);
        setChannel(currentChannel);
        setLoading(false);
      } catch (err: any) {
        console.error("Failed to initialize chat:", err);
        setError(err.message || "Failed to connect to chat");
        setLoading(false);
      }
    };

    init();

    return () => {
      cleanupFn?.();
      if (currentClient) {
        currentClient.disconnectUser();
      }
    };
  }, [meetingId, handleAskAI]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[500px]" data-testid="loading-chat">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Connecting to Ask AI...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex items-center justify-center h-[500px]" data-testid="chat-error">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <MessageCircle className="h-8 w-8" />
          <p className="text-center">{error}</p>
          <p className="text-sm text-center">
            Ask AI chat is not available for this meeting yet.
          </p>
        </div>
      </Card>
    );
  }

  if (!chatClient || !channel) {
    return (
      <Card className="flex items-center justify-center h-[500px]" data-testid="chat-unavailable">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <MessageCircle className="h-8 w-8" />
          <p>Chat channel not available</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="h-[500px] rounded-lg overflow-hidden border relative" data-testid="ask-ai-chat">
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            <ChannelHeader title={`Ask AI: ${meetingName}`} />
            <MessageList />
            <MessageInput />
          </Window>
        </Channel>
      </Chat>
      {isAiResponding && (
        <div className="absolute bottom-16 left-4 right-4 flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2">
          <Bot className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm text-primary">AI is thinking...</span>
        </div>
      )}
    </div>
  );
}
