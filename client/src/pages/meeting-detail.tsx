import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Video,
  ArrowLeft,
  Play,
  Calendar,
  Clock,
  Bot,
  Trash2,
  Search,
  MessageSquare,
  FileText,
  Loader2,
  User,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { MeetingFull, MeetingStatus, Transcript, Summary, Conversation } from "@shared/schema";

function getStatusBadgeStyles(status: MeetingStatus) {
  switch (status) {
    case "upcoming":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
    case "processing":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    case "completed":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700";
    case "cancelled":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
    default:
      return "";
  }
}

function formatTimestamp(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function TranscriptViewer({ transcripts, meetingId }: { transcripts: Transcript[]; meetingId: number }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const { data: searchResults, isLoading: isSearching } = useQuery<Transcript[]>({
    queryKey: ["/api/meetings", meetingId, "transcripts", { q: searchQuery }],
    queryFn: async () => {
      if (!searchQuery) return transcripts;
      const res = await fetch(`/api/meetings/${meetingId}/transcripts?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search transcripts");
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  const displayTranscripts = searchQuery ? (searchResults ?? []) : transcripts;
  const matchCount = searchQuery ? displayTranscripts.length : 0;

  useEffect(() => {
    if (matchCount > 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentMatchIndex, matchCount]);

  const navigateMatch = (direction: "next" | "prev") => {
    if (matchCount === 0) return;
    if (direction === "next") {
      setCurrentMatchIndex((prev) => (prev + 1) % matchCount);
    } else {
      setCurrentMatchIndex((prev) => (prev - 1 + matchCount) % matchCount);
    }
  };

  if (transcripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No transcript available</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The transcript will be available after the meeting ends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentMatchIndex(0);
            }}
            className="pl-9"
            data-testid="input-search-transcript"
          />
        </div>
        {searchQuery && matchCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentMatchIndex + 1} of {matchCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMatch("prev")}
              disabled={matchCount === 0}
              data-testid="button-prev-match"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateMatch("next")}
              disabled={matchCount === 0}
              data-testid="button-next-match"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <ScrollArea className="h-[500px] rounded-lg border" ref={scrollRef}>
        <div className="space-y-1 p-4">
          {displayTranscripts.map((t, index) => {
            const isAI = t.speaker.toLowerCase().includes("ai") || 
                         t.speaker.toLowerCase().includes("assistant") || 
                         t.speaker.toLowerCase().includes("agent");
            const isCurrentMatch = searchQuery && index === currentMatchIndex;

            return (
              <div
                key={t.id}
                ref={(el) => {
                  if (searchQuery) matchRefs.current[index] = el;
                }}
                className={`flex gap-3 rounded-lg p-3 transition-colors ${
                  isCurrentMatch 
                    ? "bg-primary/10 ring-2 ring-primary" 
                    : "hover-elevate"
                }`}
                data-testid={`transcript-entry-${t.id}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isAI
                      ? "bg-violet-100 dark:bg-violet-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30"
                  }`}
                >
                  {isAI ? (
                    <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  ) : (
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-medium ${
                        isAI
                          ? "text-violet-700 dark:text-violet-400"
                          : "text-blue-700 dark:text-blue-400"
                      }`}
                    >
                      {t.speaker}
                    </span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {formatTimestamp(t.timestamp)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground break-words">
                    {searchQuery ? highlightText(t.content, searchQuery) : t.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryCard({ summary, defaultOpen = false }: { summary: Summary; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasTimestamp = summary.startTimestamp != null || summary.endTimestamp != null;
  const isLongContent = summary.content.length > 200;

  return (
    <Card data-testid={`summary-${summary.id}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <CardTitle className="text-base">{summary.topic}</CardTitle>
              {hasTimestamp && (
                <CardDescription className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {summary.startTimestamp != null && formatTimestamp(summary.startTimestamp)}
                  {summary.startTimestamp != null && summary.endTimestamp != null && " - "}
                  {summary.endTimestamp != null && formatTimestamp(summary.endTimestamp)}
                </CardDescription>
              )}
            </div>
            {isLongContent && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-toggle-summary-${summary.id}`}>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLongContent ? (
            <>
              {!isOpen && (
                <p className="text-sm text-muted-foreground">
                  {summary.content.slice(0, 200)}...
                  <button
                    onClick={() => setIsOpen(true)}
                    className="ml-1 text-primary hover:underline"
                    data-testid={`button-read-more-${summary.id}`}
                  >
                    Read more
                  </button>
                </p>
              )}
              <CollapsibleContent>
                <p className="text-sm text-muted-foreground">{summary.content}</p>
              </CollapsibleContent>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{summary.content}</p>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}

function SummaryList({ summaries }: { summaries: Summary[] }) {
  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No summary available</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-generated summaries will appear here after processing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {summaries.length} topic{summaries.length !== 1 ? "s" : ""} covered
        </p>
      </div>
      {summaries.map((summary, index) => (
        <SummaryCard key={summary.id} summary={summary} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

type ConversationWithMessageCount = Conversation & { messageCount: number };

function QAView({ meetingId }: { meetingId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: conversations, isLoading: loadingConversations } = useQuery<ConversationWithMessageCount[]>({
    queryKey: ["/api/meetings", meetingId, "conversations"],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/conversations`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const convos = await res.json();
      const convoWithCounts = await Promise.all(
        convos.map(async (c: Conversation) => {
          const detailRes = await fetch(`/api/conversations/${c.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            return { ...c, messageCount: detail.messages?.length || 0 };
          }
          return { ...c, messageCount: 0 };
        })
      );
      return convoWithCounts;
    },
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/meetings/${meetingId}/conversations`, {
        title: `Ask AI - ${format(new Date(), "PPp")}`,
      });
      return res.json();
    },
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", meetingId, "conversations"] });
      toast({ title: "Ask AI session started" });
      navigate(`/meetings/${meetingId}/qa/${conversation.id}`);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const hasConversations = conversations && conversations.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Ask AI Sessions</h3>
          <p className="text-sm text-muted-foreground">
            Ask questions about the meeting content
          </p>
        </div>
        <Button
          onClick={() => createConversation.mutate()}
          disabled={createConversation.isPending}
          data-testid="button-start-ask-ai"
        >
          {createConversation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Start New Session
        </Button>
      </div>

      {loadingConversations ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : hasConversations ? (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Card
              key={conversation.id}
              className="hover-elevate cursor-pointer"
              onClick={() => navigate(`/meetings/${meetingId}/qa/${conversation.id}`)}
              data-testid={`conversation-${conversation.id}`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{conversation.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(conversation.createdAt), "PPp")}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {conversation.messageCount} message{conversation.messageCount !== 1 ? "s" : ""}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No sessions yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a session to ask AI about the meeting content.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: meeting, isLoading } = useQuery<MeetingFull>({
    queryKey: ["/api/meetings", id, { full: "true" }],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${id}?full=true`);
      if (!res.ok) throw new Error("Failed to fetch meeting");
      return res.json();
    },
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting started" });
      navigate(`/meetings/${id}/lobby`);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting deleted" });
      navigate("/meetings");
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Meeting not found</h1>
        <Link href="/meetings">
          <Button variant="outline">Back to Meetings</Button>
        </Link>
      </div>
    );
  }

  const isCompleted = meeting.status === "completed";
  const isUpcoming = meeting.status === "upcoming";
  const isActive = meeting.status === "active";
  const isProcessing = meeting.status === "processing";

  const renderActionButton = () => {
    if (isUpcoming) {
      return (
        <Button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          data-testid="button-start-meeting"
        >
          {startMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start Meeting
        </Button>
      );
    }
    if (isActive) {
      return (
        <Link href={`/meetings/${id}/call`}>
          <Button data-testid="button-join-meeting">
            <Video className="h-4 w-4" />
            Join Call
          </Button>
        </Link>
      );
    }
    if (isProcessing) {
      return (
        <Button disabled data-testid="button-processing">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing...
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/meetings">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold" data-testid="text-meeting-name">
                {meeting.name}
              </h1>
              <Badge
                variant="outline"
                className={getStatusBadgeStyles(meeting.status)}
                data-testid="badge-status"
              >
                {meeting.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Meeting ID: {id}</p>
          </div>
          <div className="flex items-center gap-2">
            {renderActionButton()}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" data-testid="button-delete-meeting">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this meeting? This action cannot be undone.
                    All transcripts and summaries will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>{meeting.name}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {meeting.agent && (
                <span className="flex items-center gap-1">
                  <Bot className="h-4 w-4" />
                  {meeting.agent.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {meeting.scheduledAt
                  ? format(new Date(meeting.scheduledAt), "PPP")
                  : format(new Date(meeting.createdAt), "PPP")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {meeting.scheduledAt
                  ? format(new Date(meeting.scheduledAt), "p")
                  : format(new Date(meeting.createdAt), "p")}
              </span>
            </div>
          </div>
        </CardHeader>
        {meeting.agent && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{meeting.agent.description}</p>
          </CardContent>
        )}
      </Card>

      {isCompleted ? (
        <Tabs defaultValue="summary">
          <TabsList data-testid="tabs-content">
            <TabsTrigger value="summary" data-testid="tab-summary">
              <FileText className="mr-1 h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript">
              <FileText className="mr-1 h-4 w-4" />
              Transcript
            </TabsTrigger>
            <TabsTrigger value="ask-ai" data-testid="tab-ask-ai">
              <Bot className="mr-1 h-4 w-4" />
              Ask AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <SummaryList summaries={meeting.summaries} />
          </TabsContent>

          <TabsContent value="transcript" className="mt-4">
            <TranscriptViewer transcripts={meeting.transcripts} meetingId={meeting.id} />
          </TabsContent>

          <TabsContent value="ask-ai" className="mt-4">
            <QAView meetingId={meeting.id} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Meeting Content</CardTitle>
          </CardHeader>
          <CardContent>
            {isUpcoming && (
              <p className="text-sm text-muted-foreground">
                This meeting is scheduled. Start the meeting to begin your AI-powered video call.
              </p>
            )}
            {isActive && (
              <p className="text-sm text-muted-foreground">
                This meeting is currently in progress. Join the call to participate.
              </p>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing meeting transcript and generating summaries...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
