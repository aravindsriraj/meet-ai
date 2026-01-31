import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ArrowLeft,
  PhoneCall,
  Bot,
  AlertCircle,
  Volume2,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MeetingWithAgent } from "@shared/schema";

type MediaDevice = {
  deviceId: string;
  label: string;
};

type PermissionState = "pending" | "granted" | "denied" | "error";

export default function MeetingLobby() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [permissionState, setPermissionState] = useState<PermissionState>("pending");
  const [permissionError, setPermissionError] = useState<string>("");

  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");

  const [audioLevel, setAudioLevel] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { data: meeting, isLoading: meetingLoading } = useQuery<MeetingWithAgent>({
    queryKey: ["/api/meetings", id],
  });

  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const videos = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
        }));

      const audios = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
        }));

      setVideoDevices(videos);
      setAudioDevices(audios);

      if (videos.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videos[0].deviceId);
      }
      if (audios.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audios[0].deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        setAudioLevel(normalizedLevel);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error("Error starting audio analyzer:", err);
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    setPermissionState("pending");
    setPermissionError("");

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
      };

      stopStream();

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current && isVideoOn) {
        videoRef.current.srcObject = stream;
      }

      if (isMicOn) {
        startAudioAnalyzer(stream);
      }

      await enumerateDevices();
      setPermissionState("granted");
    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      setPermissionState("denied");

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermissionError(
          "Camera and microphone access was denied. Please allow access in your browser settings and try again."
        );
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setPermissionError(
          "No camera or microphone found. Please connect a device and try again."
        );
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setPermissionError(
          "Your camera or microphone is being used by another application. Please close it and try again."
        );
      } else {
        setPermissionError(`Unable to access media devices: ${err.message || "Unknown error"}`);
      }
    }
  }, [selectedVideoDevice, selectedAudioDevice, isVideoOn, isMicOn, stopStream, enumerateDevices, startAudioAnalyzer]);

  useEffect(() => {
    requestPermissions();

    return () => {
      stopStream();
    };
  }, []);

  useEffect(() => {
    if (permissionState !== "granted" || !streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isVideoOn;
      if (videoRef.current) {
        if (isVideoOn) {
          videoRef.current.srcObject = streamRef.current;
        } else {
          videoRef.current.srcObject = null;
        }
      }
    }
  }, [isVideoOn, permissionState]);

  useEffect(() => {
    if (permissionState !== "granted" || !streamRef.current) return;

    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMicOn;
    }

    if (isMicOn && streamRef.current) {
      startAudioAnalyzer(streamRef.current);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioLevel(0);
    }
  }, [isMicOn, permissionState, startAudioAnalyzer]);

  useEffect(() => {
    if (permissionState === "granted" && (selectedVideoDevice || selectedAudioDevice)) {
      requestPermissions();
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  const startMeetingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${id}/start`);
    },
    onSuccess: () => {
      stopStream();
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      navigate(`/meetings/${id}/call`);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start meeting",
      });
    },
  });

  const handleJoinMeeting = () => {
    startMeetingMutation.mutate();
  };

  const canJoin = permissionState === "granted";

  if (meetingLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="mb-6 aspect-video w-full" />
          <Skeleton className="mb-6 h-32 w-full" />
          <Skeleton className="mx-auto h-12 w-40" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Meeting not found</h1>
        <Link href="/meetings">
          <Button variant="outline" data-testid="button-back-to-meetings">
            Back to Meetings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-4">
          <Link href={`/meetings/${id}`}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Meeting Lobby
            </h1>
            <p className="text-muted-foreground">
              Check your audio and video before joining
            </p>
          </div>
        </div>

        <Card className="mb-6" data-testid="card-meeting-info">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2" data-testid="text-meeting-name">
              {meeting.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {meeting.agent && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1" data-testid="text-agent-info">
                  <Bot className="h-4 w-4" />
                  {meeting.agent.name}
                </span>
                <Badge variant="outline" data-testid="badge-voice-type">
                  Voice: {meeting.agent.voice}
                </Badge>
              </div>
            )}
            {!meeting.agent && (
              <p className="text-sm text-muted-foreground">No AI agent assigned</p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 overflow-hidden">
          <CardContent className="relative aspect-video bg-zinc-900 p-0" data-testid="video-preview-container">
            {permissionState === "granted" && isVideoOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                data-testid="video-preview"
              />
            ) : permissionState === "granted" && !isVideoOn ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-400">
                <VideoOff className="h-16 w-16" />
                <span className="text-lg">Camera is off</span>
              </div>
            ) : permissionState === "pending" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-zinc-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
                <span>Requesting camera access...</span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-zinc-400">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <span className="text-lg font-medium">Permissions Required</span>
                <p className="max-w-sm text-sm">{permissionError}</p>
                <Button
                  variant="secondary"
                  onClick={requestPermissions}
                  className="mt-2"
                  data-testid="button-request-permissions"
                >
                  Request Permissions
                </Button>
              </div>
            )}

            {permissionState === "granted" && isMicOn && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/60 px-3 py-2" data-testid="audio-level-indicator">
                <Volume2 className="h-4 w-4 text-white" />
                <div className="flex h-2 w-24 overflow-hidden rounded-full bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Device Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant={isMicOn ? "default" : "secondary"}
                onClick={() => setIsMicOn(!isMicOn)}
                disabled={permissionState !== "granted"}
                data-testid="button-toggle-mic"
              >
                {isMicOn ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
                {isMicOn ? "Microphone On" : "Microphone Off"}
              </Button>
              <Button
                variant={isVideoOn ? "default" : "secondary"}
                onClick={() => setIsVideoOn(!isVideoOn)}
                disabled={permissionState !== "granted"}
                data-testid="button-toggle-video"
              >
                {isVideoOn ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <VideoOff className="h-4 w-4" />
                )}
                {isVideoOn ? "Camera On" : "Camera Off"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="camera-select">
                  Camera
                </label>
                <Select
                  value={selectedVideoDevice}
                  onValueChange={setSelectedVideoDevice}
                  disabled={permissionState !== "granted" || videoDevices.length === 0}
                >
                  <SelectTrigger id="camera-select" data-testid="select-camera">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device) => (
                      <SelectItem
                        key={device.deviceId}
                        value={device.deviceId}
                        data-testid={`camera-option-${device.deviceId}`}
                      >
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="microphone-select">
                  Microphone
                </label>
                <Select
                  value={selectedAudioDevice}
                  onValueChange={setSelectedAudioDevice}
                  disabled={permissionState !== "granted" || audioDevices.length === 0}
                >
                  <SelectTrigger id="microphone-select" data-testid="select-microphone">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map((device) => (
                      <SelectItem
                        key={device.deviceId}
                        value={device.deviceId}
                        data-testid={`microphone-option-${device.deviceId}`}
                      >
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Link href={`/meetings/${id}`}>
            <Button variant="outline" data-testid="button-cancel">
              Cancel
            </Button>
          </Link>
          <Button
            size="lg"
            className="px-8"
            onClick={handleJoinMeeting}
            disabled={!canJoin || startMeetingMutation.isPending}
            data-testid="button-join-meeting"
          >
            {startMeetingMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <PhoneCall className="h-4 w-4" />
            )}
            Join Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}
