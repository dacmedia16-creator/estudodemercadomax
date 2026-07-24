import { Link, useRouterState } from "@tanstack/react-router";
import { FilePlus2, FolderOpen, BarChart3, FileText, Settings, ShieldCheck, LayoutDashboard, Users } from "lucide-react";
import logoIcon from "@/assets/estudo-mercado-max-logo.png";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsGestor } from "@/hooks/use-is-gestor";

const items = [
  { title: "Início", url: "/app", icon: LayoutDashboard },
  { title: "Novo estudo", url: "/app/novo-estudo", icon: FilePlus2 },
  { title: "Estudos salvos", url: "/app/estudos", icon: FolderOpen },
  { title: "Comparativos", url: "/app/comparativos", icon: BarChart3 },
  { title: "Relatórios", url: "/app/relatorios", icon: FileText },
  { title: "Configurações", url: "/app/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useIsAdmin();
  const { isGestor } = useIsGestor();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/app/novo-estudo" className="flex items-center gap-2 px-2 py-3" onClick={closeOnMobile}>
          <img src={logoIcon} alt="Estudo de Mercado MAX" className="h-12 w-12 object-contain" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-sidebar-foreground">ESTUDO DE MERCADO</span>
            <span className="text-[10px] uppercase tracking-wider text-primary">{"\n"}</span>
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
                    <Link to={item.url} className="flex items-center gap-2" onClick={closeOnMobile}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isGestor && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === (isAdmin ? "/app/equipes" : "/app/equipe")}
                  >
                    <Link
                      to={isAdmin ? "/app/equipes" : "/app/equipe"}
                      className="flex items-center gap-2"
                      onClick={closeOnMobile}
                    >
                      <Users className="h-4 w-4" />
                      <span>{isAdmin ? "Equipes" : "Equipe"}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/app/admin"}>
                    <Link to="/app/admin" className="flex items-center gap-2" onClick={closeOnMobile}>
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