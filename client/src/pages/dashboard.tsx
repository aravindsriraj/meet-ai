import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Bot, CheckCircle, Plus, Calendar, Clock } from "lucide-react";
import { Link } from "wouter";

const stats = [
  {
    title: "Total Meetings",
    value: "24",
    icon: Video,
    description: "All time meetings",
    testId: "stat-total-meetings",
  },
  {
    title: "Active AI Agents",
    value: "3",
    icon: Bot,
    description: "Currently running",
    testId: "stat-active-agents",
  },
  {
    title: "Completed Meetings",
    value: "18",
    icon: CheckCircle,
    description: "Successfully finished",
    testId: "stat-completed-meetings",
  },
];

const recentMeetings = [
  {
    id: "1",
    title: "Product Demo Call",
    agent: "Sales Assistant",
    status: "completed",
    date: "2026-01-30",
    duration: "32 min",
  },
  {
    id: "2",
    title: "Customer Onboarding",
    agent: "Support Bot",
    status: "completed",
    date: "2026-01-29",
    duration: "45 min",
  },
  {
    id: "3",
    title: "Technical Interview",
    agent: "Interview Assistant",
    status: "scheduled",
    date: "2026-02-01",
    duration: "60 min",
  },
  {
    id: "4",
    title: "Weekly Team Sync",
    agent: "Meeting Facilitator",
    status: "in-progress",
    date: "2026-01-31",
    duration: "30 min",
  },
];

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "completed":
      return "secondary";
    case "in-progress":
      return "default";
    case "scheduled":
      return "outline";
    default:
      return "secondary";
  }
}

export default function Dashboard() {
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
        <Link href="/meetings/new">
          <Button data-testid="button-new-meeting">
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </Link>
        <Link href="/agents/new">
          <Button variant="outline" data-testid="button-create-agent">
            <Bot className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
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
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Meetings</CardTitle>
        </CardHeader>
        <CardContent>
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
                      <span className="font-medium">{meeting.title}</span>
                      <Badge variant={getStatusBadgeVariant(meeting.status)}>
                        {meeting.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {meeting.agent}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {meeting.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {meeting.duration}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
