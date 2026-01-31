import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bot, ArrowLeft, Pencil, Trash2, Volume2, Calendar, FileText } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { EditAgentDialog } from "@/components/edit-agent-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agent, MeetingWithAgent } from "@shared/schema";

const voiceColors: Record<string, string> = {
  alloy: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ash: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  ballad: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  coral: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  echo: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  sage: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  shimmer: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  verse: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex flex-1 items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const agentId = parseInt(id || "0");

  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent>({
    queryKey: ["/api/agents", agentId],
    enabled: agentId > 0,
  });

  const { data: meetings } = useQuery<MeetingWithAgent[]>({
    queryKey: ["/api/meetings"],
  });

  const agentMeetings = meetings?.filter((m) => m.agentId === agentId) || [];

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: "The AI agent has been deleted successfully.",
      });
      navigate("/agents");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (agentLoading) {
    return <DetailSkeleton />;
  }

  if (agentError || !agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Bot className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold" data-testid="text-error-title">Agent Not Found</h2>
        <p className="text-muted-foreground">The agent you're looking for doesn't exist.</p>
        <Link href="/agents">
          <Button data-testid="button-back-to-agents">
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/agents">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-1 items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              {agent.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              Created {formatDate(agent.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)} data-testid="button-edit">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} data-testid="button-delete">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle data-testid="text-agent-name">{agent.name}</CardTitle>
                <Badge
                  variant="secondary"
                  className={`mt-2 ${voiceColors[agent.voice] || ""}`}
                  data-testid="badge-agent-voice"
                >
                  <Volume2 className="h-3 w-3 mr-1" />
                  {agent.voice}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground" data-testid="text-agent-description">
                {agent.description || "No description provided"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Agent Instructions
              </CardTitle>
              <CardDescription>
                The AI agent will follow these instructions during video calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap" data-testid="text-agent-instructions">
                  {agent.instructions}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meetings
              </CardTitle>
              <CardDescription>
                {agentMeetings.length} meeting{agentMeetings.length !== 1 ? "s" : ""} using this agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentMeetings.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-meetings">
                  No meetings have used this agent yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {agentMeetings.slice(0, 5).map((meeting) => (
                    <Link
                      key={meeting.id}
                      href={`/meetings/${meeting.id}`}
                      className="block"
                    >
                      <div 
                        className="flex items-center justify-between rounded-md border p-3 hover-elevate"
                        data-testid={`link-meeting-${meeting.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{meeting.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(meeting.createdAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          {meeting.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                  {agentMeetings.length > 5 && (
                    <Link href="/meetings">
                      <Button variant="ghost" className="w-full" data-testid="button-view-all-meetings">
                        View all {agentMeetings.length} meetings
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {agent && (
        <EditAgentDialog
          agent={agent}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agent.name}"? This action cannot be undone.
              {agentMeetings.length > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This agent is used by {agentMeetings.length} meeting{agentMeetings.length !== 1 ? "s" : ""}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
