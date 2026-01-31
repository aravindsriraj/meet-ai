import { useState, useRef, useCallback, useEffect } from "react";

export interface RealtimeMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  isFinal: boolean;
}

export interface RealtimeAgentState {
  isConnected: boolean;
  isConnecting: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isRecording: boolean;
  error: string | null;
  messages: RealtimeMessage[];
  connectionState: RTCPeerConnectionState | null;
}

export interface UseRealtimeAgentOptions {
  agentId?: number;
  onMessage?: (message: RealtimeMessage) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useRealtimeAgent(options: UseRealtimeAgentOptions = {}) {
  const [state, setState] = useState<RealtimeAgentState>({
    isConnected: false,
    isConnecting: false,
    isListening: false,
    isSpeaking: false,
    isRecording: false,
    error: null,
    messages: [],
    connectionState: null,
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingReadyRef = useRef(false);
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  const currentAssistantTextRef = useRef<string>("");
  const messageIdCounter = useRef(0);
  const optionsRef = useRef(options);
  
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  const addMessage = useCallback((message: RealtimeMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
    optionsRef.current.onMessage?.(message);
  }, []);

  const updateMessage = useCallback((messageId: string, content: string, isFinal: boolean) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg => 
        msg.id === messageId ? { ...msg, content, isFinal } : msg
      ),
    }));
  }, []);

  const handleServerEvent = useCallback((event: any) => {
    console.log("Realtime event:", event.type, event);
    
    switch (event.type) {
      case "session.created":
        console.log("Session created:", event.session);
        break;

      case "session.updated":
        console.log("Session updated:", event.session);
        break;

      case "input_audio_buffer.speech_started":
        setState(prev => ({ ...prev, isListening: true }));
        break;

      case "input_audio_buffer.speech_stopped":
        setState(prev => ({ ...prev, isListening: false }));
        break;

      case "input_audio_buffer.committed":
        console.log("Audio buffer committed");
        break;

      case "conversation.item.created":
        if (event.item?.role === "user" && event.item?.content) {
          const textContent = event.item.content.find((c: any) => c.type === "input_text" || c.type === "text");
          if (textContent?.text) {
            addMessage({
              id: generateMessageId(),
              type: "user",
              content: textContent.text,
              timestamp: new Date(),
              isFinal: true,
            });
          }
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          addMessage({
            id: generateMessageId(),
            type: "user",
            content: event.transcript,
            timestamp: new Date(),
            isFinal: true,
          });
        }
        break;

      case "response.created":
        setState(prev => ({ ...prev, isSpeaking: true }));
        break;

      case "response.output_item.added":
        if (event.item?.role === "assistant") {
          const newMsgId = generateMessageId();
          currentAssistantMessageIdRef.current = newMsgId;
          currentAssistantTextRef.current = "";
          addMessage({
            id: newMsgId,
            type: "assistant",
            content: "",
            timestamp: new Date(),
            isFinal: false,
          });
        }
        break;

      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta":
        if (event.delta && currentAssistantMessageIdRef.current) {
          currentAssistantTextRef.current += event.delta;
          updateMessage(currentAssistantMessageIdRef.current, currentAssistantTextRef.current, false);
        }
        break;

      case "response.text.delta":
      case "response.output_text.delta":
        if (event.delta && currentAssistantMessageIdRef.current) {
          currentAssistantTextRef.current += event.delta;
          updateMessage(currentAssistantMessageIdRef.current, currentAssistantTextRef.current, false);
        }
        break;

      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done":
      case "response.text.done":
      case "response.output_text.done":
        if (currentAssistantMessageIdRef.current) {
          updateMessage(currentAssistantMessageIdRef.current, currentAssistantTextRef.current, true);
        }
        break;

      case "response.output_item.done":
        if (currentAssistantMessageIdRef.current && currentAssistantTextRef.current) {
          updateMessage(currentAssistantMessageIdRef.current, currentAssistantTextRef.current, true);
        }
        currentAssistantMessageIdRef.current = null;
        currentAssistantTextRef.current = "";
        break;

      case "response.audio.delta":
        setState(prev => ({ ...prev, isSpeaking: true }));
        break;

      case "response.audio.done":
        break;

      case "response.done":
        setState(prev => ({ ...prev, isSpeaking: false }));
        currentAssistantMessageIdRef.current = null;
        currentAssistantTextRef.current = "";
        break;

      case "rate_limits.updated":
        console.log("Rate limits updated:", event.rate_limits);
        break;

      case "error":
        console.error("Realtime API error:", event.error);
        const errorMsg = event.error?.message || "Unknown error";
        setState(prev => ({ ...prev, error: errorMsg }));
        optionsRef.current.onError?.(errorMsg);
        break;

      default:
        console.log("Unhandled realtime event:", event.type);
    }
  }, [addMessage, updateMessage, generateMessageId]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;
      const mimeType = recorder.mimeType || "audio/webm";

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        recordedChunksRef.current = [];
        setState(prev => ({ ...prev, isRecording: false }));
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const startRecording = useCallback(() => {
    if (!localStreamRef.current || !remoteStreamRef.current) {
      console.warn("Cannot start recording: streams not available");
      recordingReadyRef.current = false;
      return false;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      console.log("Recording already in progress");
      return true;
    }

    try {
      // Clean up previous audio context if any
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
      localSource.connect(destination);

      const remoteSource = audioContext.createMediaStreamSource(remoteStreamRef.current);
      remoteSource.connect(destination);

      const mixedStream = destination.stream;
      
      // Try different MIME types for browser compatibility
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            console.warn("No supported audio MIME type found");
            mimeType = "";
          }
        }
      }

      const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setState(prev => ({ ...prev, isRecording: true }));
      console.log("Recording started with MIME type:", mimeType || "default");
      return true;
    } catch (err) {
      console.error("Failed to start recording:", err);
      return false;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    remoteStreamRef.current = null;
    recordingReadyRef.current = false;
    currentAssistantMessageIdRef.current = null;
    currentAssistantTextRef.current = "";
  }, []);

  const connect = useCallback(async () => {
    if (peerConnectionRef.current) {
      console.log("Already connected or connecting");
      return;
    }

    setState(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null,
      messages: [],
    }));

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        setState(prev => ({ ...prev, connectionState: pc.connectionState }));
        
        if (pc.connectionState === "connected") {
          setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
          optionsRef.current.onConnected?.();
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setState(prev => ({ 
            ...prev, 
            isConnected: false, 
            isConnecting: false,
            error: `Connection ${pc.connectionState}`,
          }));
          optionsRef.current.onDisconnected?.();
        } else if (pc.connectionState === "closed") {
          setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
          optionsRef.current.onDisconnected?.();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };

      audioElementRef.current = document.createElement("audio");
      audioElementRef.current.autoplay = true;
      
      pc.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0];
          remoteStreamRef.current = event.streams[0];
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => {
        console.log("Adding local track:", track.kind);
        pc.addTrack(track, stream);
      });

      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("Data channel opened");
        setState(prev => ({ ...prev, isListening: true }));
        
        // Enable input audio transcription to get user speech-to-text
        // Using GA API structure: audio.input.transcription
        const sessionUpdate = {
          type: "session.update",
          session: {
            type: "realtime",
            audio: {
              input: {
                transcription: {
                  model: "gpt-4o-transcribe"
                }
              }
            }
          }
        };
        dc.send(JSON.stringify(sessionUpdate));
        console.log("Sent session.update to enable transcription");
      };

      dc.onclose = () => {
        console.log("Data channel closed");
        setState(prev => ({ ...prev, isListening: false }));
      };

      dc.onerror = (error) => {
        console.error("Data channel error:", error);
      };

      dc.onmessage = (event) => {
        try {
          const serverEvent = JSON.parse(event.data);
          handleServerEvent(serverEvent);
        } catch (err) {
          console.error("Failed to parse server event:", err, event.data);
        }
      };

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", checkState);
          
          setTimeout(resolve, 2000);
        }
        
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
        });
      });

      const offer = pc.localDescription;
      if (!offer) {
        throw new Error("Failed to create offer");
      }

      const sessionUrl = optionsRef.current.agentId 
        ? `/api/realtime/session?agentId=${optionsRef.current.agentId}`
        : "/api/realtime/session";

      console.log("Sending SDP offer to server...");
      const response = await fetch(sessionUrl, {
        method: "POST",
        body: offer.sdp,
        headers: { "Content-Type": "application/sdp" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Session creation failed:", response.status, errorText);
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const answerSdp = await response.text();
      console.log("Received SDP answer from server");
      
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("Remote description set successfully");

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect";
      console.error("Connection error:", err);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        isConnected: false,
        error: errorMessage,
      }));
      optionsRef.current.onError?.(errorMessage);
      cleanup();
    }
  }, [handleServerEvent, cleanup]);

  const sendTextMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.error("Data channel not open");
      return;
    }

    const createEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    };
    dataChannelRef.current.send(JSON.stringify(createEvent));

    const responseEvent = { type: "response.create" };
    dataChannelRef.current.send(JSON.stringify(responseEvent));

    addMessage({
      id: generateMessageId(),
      type: "user",
      content: text,
      timestamp: new Date(),
      isFinal: true,
    });
  }, [addMessage, generateMessageId]);

  const interrupt = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      return;
    }
    
    const event = { type: "response.cancel" };
    dataChannelRef.current.send(JSON.stringify(event));
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setState({
      isConnected: false,
      isConnecting: false,
      isListening: false,
      isSpeaking: false,
      isRecording: false,
      error: null,
      messages: [],
      connectionState: null,
    });
    optionsRef.current.onDisconnected?.();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    connect,
    disconnect,
    sendTextMessage,
    interrupt,
    setMuted,
    startRecording,
    stopRecording,
  };
}
