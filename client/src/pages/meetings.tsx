import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Bot,
  Play,
  XCircle,
  Eye,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { CreateMeetingDialog } from "@/components/create-meeting-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MeetingWithAgent, MeetingStatus } from "@shared/schema";
import { format } from "date-fns";

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

function formatMeetingDate(meeting: MeetingWithAgent) {
  const date = meeting.scheduledAt || meeting.createdAt;
  if (!date) return "No date";
  return format(new Date(date), "PPP");
}

function formatMeetingTime(meeting: MeetingWithAgent) {
  const date = meeting.scheduledAt || meeting.createdAt;
  if (!date) return "";
  return format(new Date(date), "p");
}

function MeetingCard({ meeting }: { meeting: MeetingWithAgent }) {
  const { toast } = useToast();

  const startMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/meetings/${meeting.id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting started" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/meetings/${meeting.id}/status`, {
        status: "cancelled",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting cancelled" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const renderActions = () => {
    switch (meeting.status) {
      case "upcoming":
        return (
          <div className="flex items-center gap-2">
            <Link href={`/meetings/${meeting.id}/lobby`}>
              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startMutation.mutate();
                }}
                disabled={startMutation.isPending}
                data-testid={`button-start-meeting-${meeting.id}`}
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
              data-testid={`button-cancel-meeting-${meeting.id}`}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Cancel
            </Button>
          </div>
        );
      case "active":
        return (
          <Link href={`/meetings/${meeting.id}/call`}>
            <Button
              size="sm"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-join-meeting-${meeting.id}`}
            >
              <Video className="h-4 w-4" />
              Join Call
            </Button>
          </Link>
        );
      case "processing":
        return (
          <Button size="sm" variant="outline" disabled data-testid={`button-processing-${meeting.id}`}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </Button>
        );
      case "completed":
        return (
          <Link href={`/meetings/${meeting.id}`}>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-view-meeting-${meeting.id}`}
            >
              <Eye className="h-4 w-4" />
              View Details
            </Button>
          </Link>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Link href={`/meetings/${meeting.id}`} data-testid={`link-meeting-${meeting.id}`}>
      <Card className="hover-elevate">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium" data-testid={`text-meeting-name-${meeting.id}`}>
                  {meeting.name}
                </span>
                <Badge
                  variant="outline"
                  className={getStatusBadgeStyles(meeting.status)}
                  data-testid={`badge-status-${meeting.id}`}
                >
                  {meeting.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {meeting.agent && (
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {meeting.agent.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatMeetingDate(meeting)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatMeetingTime(meeting)}
                </span>
              </div>
            </div>
          </div>
          <div onClick={(e) => e.preventDefault()}>{renderActions()}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MeetingCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-md" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-24" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ status }: { status: string }) {
  const messages: Record<string, { title: string; description: string }> = {
    all: {
      title: "No meetings yet",
      description: "Create your first meeting to get started with AI-powered video calls.",
    },
    upcoming: {
      title: "No upcoming meetings",
      description: "Schedule a new meeting to see it here.",
    },
    active: {
      title: "No active meetings",
      description: "Start a meeting to begin your AI-powered video call.",
    },
    processing: {
      title: "No meetings being processed",
      description: "Completed meetings will appear here while generating summaries.",
    },
    completed: {
      title: "No completed meetings",
      description: "Your finished meetings with transcripts and summaries will appear here.",
    },
  };

  const { title, description } = messages[status] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-medium" data-testid="text-empty-title">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function Meetings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const { data: meetings = [], isLoading } = useQuery<MeetingWithAgent[]>({
    queryKey: ["/api/meetings"],
  });

  const filteredMeetings = meetings.filter((meeting) => {
    if (activeTab === "all") return meeting.status !== "cancelled";
    return meeting.status === activeTab;
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Meetings
          </h1>
          <p className="text-muted-foreground">
            View and manage all your AI-powered meetings.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-meeting">
          <Plus className="h-4 w-4" />
          New Meeting
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-filter">
          <TabsTrigger value="all" data-testid="tab-all">
            All
          </TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active">
            Active
          </TabsTrigger>
          <TabsTrigger value="processing" data-testid="tab-processing">
            Processing
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <MeetingCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredMeetings.length === 0 ? (
            <EmptyState status={activeTab} />
          ) : (
            <div className="space-y-4">
              {filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
