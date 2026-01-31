import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bot, Plus, Pencil, Trash2, Volume2 } from "lucide-react";
import { Link } from "wouter";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { EditAgentDialog } from "@/components/edit-agent-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";

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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AgentCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24 mt-2" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1" data-testid="text-empty-title">
          No AI Agents Yet
        </h3>
        <p className="text-muted-foreground text-center mb-4 max-w-sm">
          Create your first AI agent to start conducting intelligent video meetings.
        </p>
        <Button onClick={onCreateClick} data-testid="button-create-first-agent">
          <Plus className="h-4 w-4" />
          Create Your First Agent
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Agents() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Agent deleted",
        description: "The AI agent has been deleted successfully.",
      });
      setDeletingAgent(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (deletingAgent) {
      deleteMutation.mutate(deletingAgent.id);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            AI Agents
          </h1>
          <p className="text-muted-foreground">
            Manage your AI agents for video meetings.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-agent">
          <Plus className="h-4 w-4" />
          Create Agent
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <AgentCardSkeleton />
            <AgentCardSkeleton />
            <AgentCardSkeleton />
          </>
        ) : !agents || agents.length === 0 ? (
          <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
        ) : (
          agents.map((agent) => (
            <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <Link href={`/agents/${agent.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={agent.avatarUrl || undefined} alt={agent.name} />
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate" data-testid={`text-agent-name-${agent.id}`}>
                      {agent.name}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={`mt-1 ${voiceColors[agent.voice] || ""}`}
                      data-testid={`badge-voice-${agent.id}`}
                    >
                      <Volume2 className="h-3 w-3 mr-1" />
                      {agent.voice}
                    </Badge>
                  </div>
                </Link>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingAgent(agent);
                    }}
                    data-testid={`button-edit-agent-${agent.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingAgent(agent);
                    }}
                    data-testid={`button-delete-agent-${agent.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={`/agents/${agent.id}`}>
                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-agent-description-${agent.id}`}>
                    {agent.description || "No description provided"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground" data-testid={`text-agent-date-${agent.id}`}>
                    Created {formatDate(agent.createdAt)}
                  </p>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateAgentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      
      {editingAgent && (
        <EditAgentDialog
          agent={editingAgent}
          open={!!editingAgent}
          onOpenChange={(open) => !open && setEditingAgent(null)}
        />
      )}

      <AlertDialog open={!!deletingAgent} onOpenChange={(open) => !open && setDeletingAgent(null)}>
        <AlertDialogContent data-testid="dialog-delete-agent">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAgent?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
