import { useEffect, useState, useCallback } from "react";
import { StreamChat, Channel as StreamChannel } from "stream-chat";
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
import { Loader2, MessageCircle } from "lucide-react";
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

  const initializeChat = useCallback(async () => {
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

      const client = StreamChat.getInstance(STREAM_API_KEY);
      await client.connectUser(
        { id: userId, name: "Meeting Participant" },
        token
      );

      const chatChannel = client.channel("messaging", channelId);
      await chatChannel.watch();

      setChatClient(client);
      setChannel(chatChannel);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to initialize chat:", err);
      setError(err.message || "Failed to connect to chat");
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    initializeChat();

    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
      }
    };
  }, [initializeChat]);

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
    <div className="h-[500px] rounded-lg overflow-hidden border" data-testid="ask-ai-chat">
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel channel={channel}>
          <Window>
            <ChannelHeader title={`Ask AI: ${meetingName}`} />
            <MessageList />
            <MessageInput />
          </Window>
        </Channel>
      </Chat>
    </div>
  );
}
