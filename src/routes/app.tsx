import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-lg print:hidden">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden text-sm font-semibold text-muted-foreground md:block">
                Radar Imobiliário <span className="text-primary">Pro</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/app/novo-estudo">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Novo estudo
                </Button>
              </Link>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">CR</AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}