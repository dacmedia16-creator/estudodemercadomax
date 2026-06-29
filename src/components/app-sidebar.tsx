import { Link, useRouterState } from "@tanstack/react-router";
import { FilePlus2, FolderOpen, BarChart3, FileText, Settings, ShieldCheck } from "lucide-react";
import remaxIcon from "@/assets/remax-icon-transparent.png.asset.json";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsAdmin } from "@/hooks/use-is-admin";

const items = [
  { title: "Novo estudo", url: "/app/novo-estudo", icon: FilePlus2 },
  { title: "Estudos salvos", url: "/app/estudos", icon: FolderOpen },
  { title: "Comparativos", url: "/app/comparativos", icon: BarChart3 },
  { title: "Relatórios", url: "/app/relatorios", icon: FileText },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useIsAdmin();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/app/novo-estudo" className="flex items-center gap-2 px-2 py-3">
          <img src={remaxIcon.url} alt="RE/MAX Única Escolha" className="h-9 w-9 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-sidebar-foreground">RE/MAX Única</span>
            <span className="text-[10px] uppercase tracking-wider text-primary">Estudo de Mercado</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/app/admin"}>
                    <Link to="/app/admin" className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Administração</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}