import { Button } from "@/components/ui/button";
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  PhoneOff, 
  Bot,
  MessageSquare,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Keyboard,
  Send
} from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRealtimeAgent, type RealtimeMessage } from "@/hooks/use-realtime-agent";
import type { MeetingWithAgent } from "@shared/schema";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MeetingCall() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { data: meeting, isLoading } = useQuery<MeetingWithAgent>({
    queryKey: ["/api/meetings", id],
  });

  const realtimeAgent = useRealtimeAgent({
    agentId: meeting?.agentId ?? undefined,
    onConnected: () => {
      console.log("Realtime agent connected");
    },
    onDisconnected: () => {
      console.log("Realtime agent disconnected");
    },
    onError: (error) => {
      console.error("Realtime agent error:", error);
    },
  });

  const startMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/meetings/${id}/start`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id] });
    },
  });

  const endMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/meetings/${id}/end`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id] });
    },
  });

  const processMeetingMutation = useMutation({
    mutationFn: async (transcriptData: { speaker: string; content: string; timestamp: number }[]) => {
      const res = await apiRequest("POST", `/api/meetings/${id}/process`, { transcriptData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setLocation(`/meetings/${id}`);
    },
    onError: (error) => {
      console.error("Error processing meeting:", error);
      setLocation(`/meetings/${id}`);
    },
  });

  useEffect(() => {
    if (meeting && meeting.status === "upcoming") {
      startMeetingMutation.mutate();
    }
  }, [meeting?.status]);

  useEffect(() => {
    if (meeting && meeting.agentId && !realtimeAgent.isConnected && !realtimeAgent.isConnecting) {
      realtimeAgent.connect();
    }
  }, [meeting?.agentId, realtimeAgent.isConnected, realtimeAgent.isConnecting]);

  useEffect(() => {
    if (!realtimeAgent.isConnected || realtimeAgent.isRecording) return;

    let attempts = 0;
    const maxAttempts = 20; // Max 10 seconds of retrying
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const attemptStart = () => {
      if (cancelled || attempts >= maxAttempts) return;
      
      const success = realtimeAgent.startRecording();
      if (!success && !cancelled) {
        attempts++;
        timerId = setTimeout(attemptStart, 500);
      }
    };

    // Initial delay before first attempt
    timerId = setTimeout(attemptStart, 1000);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [realtimeAgent.isConnected, realtimeAgent.isRecording]);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    setupCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOn;
      });
    }
  }, [isVideoOn]);

  useEffect(() => {
    realtimeAgent.setMuted(!isMicOn);
  }, [isMicOn, realtimeAgent.setMuted]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [realtimeAgent.messages]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendTextMessage = () => {
    if (textMessage.trim()) {
      realtimeAgent.sendTextMessage(textMessage.trim());
      setTextMessage("");
    }
  };

  const handleEndCall = () => {
    setShowEndDialog(true);
  };

  const confirmEndCall = async () => {
    setShowEndDialog(false);
    
    // Get transcripts from the realtime agent messages
    const transcriptData = realtimeAgent.messages
      .filter(msg => msg.isFinal && msg.content.trim())
      .map(msg => ({
        speaker: msg.type === "user" ? "User" : (meeting?.agent?.name || "AI Assistant"),
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
      }));
    
    // Stop recording and get the audio blob
    let recordingBlob: Blob | null = null;
    if (realtimeAgent.isRecording) {
      recordingBlob = await realtimeAgent.stopRecording();
      if (recordingBlob) {
        console.log("Recording saved:", recordingBlob.size, "bytes");
        // Create a download link for the recording (for now, client-side download)
        const url = URL.createObjectURL(recordingBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meeting-${id}-recording.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
    
    // Disconnect agent and stop video
    realtimeAgent.disconnect();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    
    // End the meeting first (sets status to "processing")
    await endMeetingMutation.mutateAsync();
    
    // Then process transcripts and generate summaries
    processMeetingMutation.mutate(transcriptData);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <div className="text-white">Loading meeting...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-black" data-testid="meeting-call-container">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white" data-testid="text-meeting-name">
              {meeting?.name || "Meeting"}
            </h1>
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-white/70" data-testid="text-call-duration">
              {formatDuration(callDuration)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-white/70 hover:text-white"
            data-testid="button-toggle-transcript"
          >
            {showTranscript ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 backdrop-blur">
            <Bot className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-white">
              {meeting?.agent?.name || "AI Agent"}
            </span>
            {realtimeAgent.isConnecting && (
              <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
            )}
            {realtimeAgent.isConnected && (
              <span className="flex h-2 w-2 rounded-full bg-green-500" title="Connected" />
            )}
            {realtimeAgent.isSpeaking && (
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Speaking" />
            )}
          </div>

          {realtimeAgent.isConnecting && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/20">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-white/70 text-sm">Connecting to AI agent...</p>
            </div>
          )}

          {realtimeAgent.isConnected && !realtimeAgent.isSpeaking && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30">
                <Bot className="h-16 w-16 text-primary/60" />
              </div>
              <div className="text-center">
                <p className="text-white/90 text-sm font-medium">AI is listening</p>
                <p className="text-white/50 text-xs mt-1">Speak naturally to have a conversation</p>
              </div>
            </div>
          )}

          {realtimeAgent.isSpeaking && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/20 animate-pulse">
                <Bot className="h-16 w-16 text-primary" />
              </div>
              <p className="text-white/90 text-sm font-medium">AI is speaking...</p>
            </div>
          )}

          {realtimeAgent.error && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-destructive/20">
                <Bot className="h-16 w-16 text-destructive" />
              </div>
              <div className="max-w-md rounded-lg bg-destructive/20 px-4 py-2">
                <p className="text-center text-sm text-destructive">{realtimeAgent.error}</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => realtimeAgent.connect()}
                data-testid="button-retry-connect"
              >
                Retry Connection
              </Button>
            </div>
          )}

          <div 
            className={`absolute bottom-4 right-4 overflow-hidden rounded-xl bg-black shadow-2xl transition-all ${
              isVideoOn ? "h-48 w-64" : "h-24 w-32"
            }`}
            data-testid="video-preview"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full object-cover ${isVideoOn ? "" : "hidden"}`}
            />
            {!isVideoOn && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
                <VideoOff className="h-8 w-8" />
                <span className="text-xs">Camera off</span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              You
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/80 p-4 backdrop-blur">
          <Button
            variant={isMicOn ? "secondary" : "destructive"}
            size="icon"
            onClick={() => setIsMicOn(!isMicOn)}
            data-testid="button-toggle-mic"
          >
            {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>
          
          <Button
            variant={isVideoOn ? "secondary" : "destructive"}
            size="icon"
            onClick={() => setIsVideoOn(!isVideoOn)}
            data-testid="button-toggle-video"
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            variant={showTextInput ? "default" : "outline"}
            size="icon"
            onClick={() => setShowTextInput(!showTextInput)}
            className="border-primary text-primary hover:bg-primary/10"
            data-testid="button-toggle-text-input"
          >
            <Keyboard className="h-5 w-5" />
          </Button>

          {realtimeAgent.isSpeaking && (
            <Button
              variant="outline"
              onClick={() => realtimeAgent.interrupt()}
              className="px-6 border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
              data-testid="button-interrupt"
            >
              Interrupt
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={handleEndCall}
            className="px-6"
            data-testid="button-end-call"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            End Call
          </Button>
        </div>

        {showTextInput && (
          <div className="border-t border-white/10 bg-black/80 p-4 backdrop-blur">
            <div className="flex gap-2">
              <Input
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                placeholder="Type a message to the AI..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                onKeyDown={(e) => e.key === "Enter" && handleSendTextMessage()}
                data-testid="input-text-message"
              />
              <Button
                onClick={handleSendTextMessage}
                disabled={!textMessage.trim()}
                data-testid="button-send-text"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {showTranscript && (
        <div 
          className="flex w-80 flex-col border-l border-white/10 bg-black/50"
          data-testid="transcript-panel"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white/70" />
              <h2 className="text-sm font-medium text-white">Live Transcript</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTranscript(false)}
              className="h-6 w-6 text-white/50 hover:text-white"
              data-testid="button-close-transcript"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {realtimeAgent.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-white/50">
                <MessageSquare className="mb-2 h-8 w-8" />
                <p className="text-sm">No messages yet</p>
                <p className="mt-1 text-xs">
                  {realtimeAgent.isConnected 
                    ? "Start speaking to the AI agent" 
                    : "Connecting to AI agent..."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {realtimeAgent.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.type === "user" ? "items-end" : "items-start"}`}
                    data-testid={`transcript-message-${msg.id}`}
                  >
                    <span className="mb-1 text-xs text-white/50">
                      {msg.type === "user" ? "You" : meeting?.agent?.name || "AI"}
                    </span>
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        msg.type === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {msg.content}
                      {!msg.isFinal && (
                        <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-white/50" />
                      )}
                    </div>
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          {meeting?.agent?.instructions && (
            <div className="border-t border-white/10 p-4">
              <p className="text-xs text-white/50">AI Context</p>
              <p className="mt-1 line-clamp-3 text-xs text-white/70">
                {meeting.agent.instructions}
              </p>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent data-testid="end-call-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>End Call</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end this call? The meeting will be marked as completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end-call">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEndCall}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-end-call"
            >
              End Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
