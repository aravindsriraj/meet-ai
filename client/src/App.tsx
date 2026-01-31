import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, ThemeToggle } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import AgentDetail from "@/pages/agent-detail";
import Meetings from "@/pages/meetings";
import MeetingDetail from "@/pages/meeting-detail";
import MeetingLobby from "@/pages/meeting-lobby";
import MeetingCall from "@/pages/meeting-call";
import MeetingQAPage from "@/pages/meeting-qa";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents" component={Agents} />
      <Route path="/agents/:id" component={AgentDetail} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/meetings/:id" component={MeetingDetail} />
      <Route path="/meetings/:id/lobby" component={MeetingLobby} />
      <Route path="/meetings/:id/call" component={MeetingCall} />
      <Route path="/meetings/:meetingId/qa/:conversationId" component={MeetingQAPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b p-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
