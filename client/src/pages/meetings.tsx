import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Clock,
  Search,
  Play,
  XCircle,
  Loader2,
  CalendarDays,
  Video,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { CreateMeetingDialog } from "@/components/create-meeting-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MeetingWithAgent, MeetingStatus, Agent } from "@shared/schema";
import { format, formatDistanceStrict } from "date-fns";

const statusConfig: Record<MeetingStatus, { label: string; color: string; dotColor: string }> = {
  upcoming: { 
    label: "Upcoming", 
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    dotColor: "bg-amber-500"
  },
  active: { 
    label: "Active", 
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    dotColor: "bg-blue-500"
  },
  processing: { 
    label: "Processing", 
    color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800",
    dotColor: "bg-purple-500"
  },
  completed: { 
    label: "Completed", 
    color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    dotColor: "bg-green-500"
  },
  cancelled: { 
    label: "Cancelled", 
    color: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700",
    dotColor: "bg-gray-400"
  },
};

const agentColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function getAgentColor(agentId: number): string {
  return agentColors[agentId % agentColors.length];
}

function formatMeetingDate(meeting: MeetingWithAgent) {
  const date = meeting.scheduledAt || meeting.startedAt || meeting.createdAt;
  if (!date) return "No date";
  return format(new Date(date), "MMM d");
}

function calculateDuration(meeting: MeetingWithAgent): string | null {
  if (!meeting.startedAt) return null;
  
  const start = new Date(meeting.startedAt);
  const end = meeting.endedAt ? new Date(meeting.endedAt) : new Date();
  
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.round(diffMs / 60000);
  
  if (diffMins < 1) return "< 1 minute";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""}`;
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  if (mins === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours}h ${mins}m`;
}

function MeetingRow({ meeting }: { meeting: MeetingWithAgent }) {
  const { toast } = useToast();
  const status = statusConfig[meeting.status];
  const duration = calculateDuration(meeting);

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
      await apiRequest("PATCH", `/api/meetings/${meeting.id}/status`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting cancelled" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      e.preventDefault();
    }
  };

  const renderActions = () => {
    switch (meeting.status) {
      case "upcoming":
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
            <Link href={`/meetings/${meeting.id}/lobby`}>
              <Button
                size="sm"
                onClick={(e) => {
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
              variant="ghost"
              onClick={(e) => {
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
            </Button>
          </div>
        );
      case "active":
        return (
          <div onClick={(e) => e.preventDefault()}>
            <Link href={`/meetings/${meeting.id}/call`}>
              <Button size="sm" data-testid={`button-join-meeting-${meeting.id}`}>
                <Video className="h-4 w-4" />
                Join
              </Button>
            </Link>
          </div>
        );
      case "processing":
        return (
          <Button size="sm" variant="ghost" disabled data-testid={`button-processing-${meeting.id}`}>
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <Link href={`/meetings/${meeting.id}`} data-testid={`link-meeting-${meeting.id}`}>
      <div 
        className="flex items-center justify-between py-4 px-4 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate" data-testid={`text-meeting-name-${meeting.id}`}>
            {meeting.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {meeting.agent && (
              <>
                <span 
                  className={`w-2 h-2 rounded-full ${getAgentColor(meeting.agent.id)}`}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[150px]">{meeting.agent.name}</span>
                <span className="text-muted-foreground/50">•</span>
              </>
            )}
            <span>{formatMeetingDate(meeting)}</span>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <Badge 
            variant="outline" 
            className={`${status.color} flex items-center gap-1.5 font-normal`}
            data-testid={`badge-status-${meeting.id}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status.label}
          </Badge>

          {duration && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-[100px]">
              <Clock className="h-4 w-4" />
              <span>{duration}</span>
            </div>
          )}

          {!duration && meeting.status !== "completed" && meeting.status !== "cancelled" && (
            <div className="min-w-[100px]" />
          )}

          {renderActions()}
        </div>
      </div>
    </Link>
  );
}

function MeetingRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-4 px-4 border-b border-border/50">
      <div className="flex-1">
        <Skeleton className="h-5 w-48 mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1" data-testid="text-empty-title">
        No meetings found
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Create your first meeting to get started with AI-powered video calls.
      </p>
      <Button onClick={onCreateClick} data-testid="button-create-first-meeting">
        <Plus className="h-4 w-4" />
        New Meeting
      </Button>
    </div>
  );
}

export default function Meetings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const { data: meetings = [], isLoading } = useQuery<MeetingWithAgent[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      if (meeting.status === "cancelled") return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = meeting.name.toLowerCase().includes(query);
        const matchesAgent = meeting.agent?.name.toLowerCase().includes(query);
        if (!matchesName && !matchesAgent) return false;
      }
      
      if (statusFilter !== "all" && meeting.status !== statusFilter) return false;
      
      if (agentFilter !== "all" && meeting.agentId?.toString() !== agentFilter) return false;
      
      return true;
    });
  }, [meetings, searchQuery, statusFilter, agentFilter]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          My Meetings
        </h1>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-new-meeting">
          <Plus className="h-4 w-4" />
          New Meeting
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-agent">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id.toString()}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getAgentColor(agent.id)}`} />
                  {agent.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <MeetingRowSkeleton key={i} />
            ))}
          </>
        ) : filteredMeetings.length === 0 ? (
          <EmptyState onCreateClick={() => setDialogOpen(true)} />
        ) : (
          <>
            {filteredMeetings.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </>
        )}
      </div>

      <CreateMeetingDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
