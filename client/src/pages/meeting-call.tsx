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
  ChevronLeft
} from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVoiceRecorder, useAudioPlayback } from "../../replit_integrations/audio";
import type { MeetingWithAgent } from "@shared/schema";
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

interface TranscriptMessage {
  id: number;
  speaker: "user" | "ai";
  content: string;
  timestamp: Date;
}

export default function MeetingCall() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [currentAiText, setCurrentAiText] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  
  const recorder = useVoiceRecorder();
  const audioPlayback = useAudioPlayback();

  const { data: meeting, isLoading } = useQuery<MeetingWithAgent>({
    queryKey: ["/api/meetings", id],
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
      setLocation(`/meetings/${id}`);
    },
  });

  useEffect(() => {
    if (meeting && meeting.status === "upcoming") {
      startMeetingMutation.mutate();
    }
  }, [meeting?.status]);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
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
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicOn;
      });
    }
  }, [isMicOn]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptMessages]);

  useEffect(() => {
    audioPlayback.init();
  }, [audioPlayback.init]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const addTranscriptMessage = useCallback((speaker: "user" | "ai", content: string) => {
    messageIdRef.current += 1;
    setTranscriptMessages((prev) => [
      ...prev,
      { id: messageIdRef.current, speaker, content, timestamp: new Date() },
    ]);
  }, []);

  const handleTalkStart = async () => {
    if (isRecording) return;
    setIsRecording(true);
    audioPlayback.clear();
    // Ensure AudioContext is resumed on user interaction (browser autoplay policy)
    await audioPlayback.ensureResumed();
    try {
      await recorder.startRecording();
    } catch (err) {
      console.error("Failed to start recording:", err);
      setIsRecording(false);
    }
  };

  const handleTalkEnd = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    
    try {
      const blob = await recorder.stopRecording();
      if (blob.size === 0) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        
        setIsAiSpeaking(true);
        setCurrentAiText("");

        const response = await fetch("/api/voice-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64,
            agentId: meeting?.agentId,
          }),
        });

        const eventReader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullAiTranscript = "";

        if (eventReader) {
          while (true) {
            const { done, value } = await eventReader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === "user_transcript") {
                    addTranscriptMessage("user", data.data);
                  } else if (data.type === "transcript") {
                    fullAiTranscript += data.data;
                    setCurrentAiText(fullAiTranscript);
                  } else if (data.type === "audio") {
                    await audioPlayback.pushAudio(data.data);
                  } else if (data.type === "done") {
                    if (fullAiTranscript) {
                      addTranscriptMessage("ai", fullAiTranscript);
                    }
                    audioPlayback.signalComplete();
                    setIsAiSpeaking(false);
                    setCurrentAiText("");
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to process voice:", err);
      setIsAiSpeaking(false);
    }
  };

  const handleEndCall = () => {
    setShowEndDialog(true);
  };

  const confirmEndCall = () => {
    setShowEndDialog(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    endMeetingMutation.mutate();
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
            {isAiSpeaking && (
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>

          {isAiSpeaking && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/20 animate-pulse">
                <Bot className="h-16 w-16 text-primary" />
              </div>
              {currentAiText && (
                <div className="max-w-md rounded-lg bg-black/60 px-4 py-2 backdrop-blur">
                  <p className="text-center text-sm text-white/90">{currentAiText}</p>
                </div>
              )}
            </div>
          )}

          <div 
            className={`absolute bottom-4 right-4 overflow-hidden rounded-xl bg-black shadow-2xl transition-all ${
              isVideoOn ? "h-48 w-64" : "h-24 w-32"
            }`}
            data-testid="video-preview"
          >
            {isVideoOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            ) : (
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
            variant={isRecording ? "default" : "outline"}
            className={`px-6 ${isRecording ? "bg-primary text-primary-foreground" : "border-primary text-primary hover:bg-primary/10"}`}
            onMouseDown={handleTalkStart}
            onMouseUp={handleTalkEnd}
            onMouseLeave={handleTalkEnd}
            onTouchStart={handleTalkStart}
            onTouchEnd={handleTalkEnd}
            disabled={isAiSpeaking}
            data-testid="button-talk-to-ai"
          >
            <Bot className="mr-2 h-4 w-4" />
            {isRecording ? "Recording..." : "Hold to Talk to AI"}
          </Button>

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
      </div>

      {showTranscript && (
        <div 
          className="flex w-80 flex-col border-l border-white/10 bg-black/50"
          data-testid="transcript-panel"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-white/70" />
              <h2 className="text-sm font-medium text-white">Transcript</h2>
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
            {transcriptMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-white/50">
                <MessageSquare className="mb-2 h-8 w-8" />
                <p className="text-sm">No messages yet</p>
                <p className="mt-1 text-xs">Hold the "Talk to AI" button to start</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transcriptMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.speaker === "user" ? "items-end" : "items-start"}`}
                    data-testid={`transcript-message-${msg.id}`}
                  >
                    <span className="mb-1 text-xs text-white/50">
                      {msg.speaker === "user" ? "You" : meeting?.agent?.name || "AI"}
                    </span>
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        msg.speaker === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isAiSpeaking && currentAiText && (
                  <div className="flex flex-col items-start">
                    <span className="mb-1 text-xs text-white/50">
                      {meeting?.agent?.name || "AI"}
                    </span>
                    <div className="max-w-[90%] rounded-lg bg-white/10 px-3 py-2 text-sm text-white">
                      {currentAiText}
                      <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-white/50" />
                    </div>
                  </div>
                )}
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
