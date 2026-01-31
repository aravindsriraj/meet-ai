import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, Bot, CheckCircle, Plus, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreateMeetingDialog } from "@/components/create-meeting-dialog";
import { format } from "date-fns";
import type { MeetingWithAgent, Agent } from "@shared/schema";

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "secondary";
    case "active":
      return "default";
    case "processing":
      return "outline";
    case "upcoming":
      return "outline";
    default:
      return "secondary";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "in-progress";
    case "upcoming":
      return "scheduled";
    default:
      return status;
  }
}

function calculateDuration(meeting: MeetingWithAgent): string {
  if (!meeting.startedAt) return "—";
  
  const start = new Date(meeting.startedAt);
  const end = meeting.endedAt ? new Date(meeting.endedAt) : new Date();
  
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 1) return "< 1 min";
  if (diffMins < 60) return `${diffMins} min`;
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatMeetingDate(meeting: MeetingWithAgent): string {
  const date = meeting.scheduledAt || meeting.startedAt || meeting.createdAt;
  if (!date) return "—";
  return format(new Date(date), "yyyy-MM-dd");
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function MeetingRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-md border p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<MeetingWithAgent[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const totalMeetings = meetings.length;
  const activeAgents = agents.length;
  const completedMeetings = meetings.filter(m => m.status === "completed").length;

  const recentMeetings = meetings
    .filter(m => m.status !== "cancelled")
    .slice(0, 4);

  const stats = [
    {
      title: "Total Meetings",
      value: totalMeetings.toString(),
      icon: Video,
      description: "All time meetings",
      testId: "stat-total-meetings",
    },
    {
      title: "Active AI Agents",
      value: activeAgents.toString(),
      icon: Bot,
      description: "Currently available",
      testId: "stat-active-agents",
    },
    {
      title: "Completed Meetings",
      value: completedMeetings.toString(),
      icon: CheckCircle,
      description: "Successfully finished",
      testId: "stat-completed-meetings",
    },
  ];

  const isLoading = meetingsLoading || agentsLoading;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your AI meeting platform.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button data-testid="button-new-meeting" onClick={() => setMeetingDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          New Meeting
        </Button>
        <Link href="/agents">
          <Button variant="outline" data-testid="button-create-agent">
            <Bot className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          stats.map((stat) => (
            <Card key={stat.title} data-testid={stat.testId}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <MeetingRowSkeleton />
              <MeetingRowSkeleton />
              <MeetingRowSkeleton />
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No meetings yet. Create your first meeting to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  data-testid={`link-meeting-${meeting.id}`}
                >
                  <div className="flex items-center justify-between rounded-md border p-4 hover-elevate">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{meeting.name}</span>
                        <Badge variant={getStatusBadgeVariant(meeting.status)}>
                          {getStatusLabel(meeting.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                          {calculateDuration(meeting)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateMeetingDialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen} />
    </div>
  );
}
