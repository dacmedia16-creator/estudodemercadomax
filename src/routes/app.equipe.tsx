import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, FileText, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useIsGestor } from "@/hooks/use-is-gestor";
import {
  gestorListTeam, gestorListTeamStudies, gestorRemoveMember,
} from "@/lib/team.functions";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/app/equipe")({
  component: TeamPage,
});

function TeamPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isGestor, isLoading: roleLoading } = useIsGestor();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (isAdmin) {
      navigate({ to: "/app/equipes", replace: true });
      return;
    }
    if (!roleLoading && !isGestor) {
      toast.error("Acesso restrito a gestores.");
      navigate({ to: "/app", replace: true });
    }
  }, [roleLoading, isGestor, isAdmin, navigate]);

  const teamQ = useQuery({
    queryKey: ["gestor-team"],
    queryFn: () => gestorListTeam(),
    enabled: isGestor,
  });

  const studiesQ = useQuery({
    queryKey: ["gestor-team-studies"],
    queryFn: () => gestorListTeamStudies(),
    enabled: isGestor,
  });

  const handleRemove = async (userId: string) => {
    try {
      await gestorRemoveMember({ data: { userId, deleteAccount: false } });
      toast.success("Corretor removido da equipe.");
      await queryClient.invalidateQueries({ queryKey: ["gestor-team"] });
      await queryClient.invalidateQueries({ queryKey: ["gestor-team-studies"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover.");
    }
  };

  if (roleLoading || !isGestor) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const members = teamQ.data?.members ?? [];
  const studies = studiesQ.data?.studies ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Equipe
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe os corretores e estudos da sua equipe. Novos corretores são adicionados pelo administrador.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Corretores" value={members.length} />
        <StatCard label="Estudos da equipe" value={studies.length} />
        <StatCard
          label="Cidades"
          value={new Set(studies.map((s) => s.cidade).filter(Boolean)).size}
        />
        <StatCard
          label="Bairros"
          value={new Set(studies.map((s) => s.bairro).filter(Boolean)).size}
        />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Corretores</TabsTrigger>
          <TabsTrigger value="studies">Estudos da equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="pt-4">
          <Card className="p-0 overflow-hidden">
            {teamQ.isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum corretor na sua equipe. Clique em "Adicionar corretor" para começar.
              </div>
            ) : (
              <div className="divide-y">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Adicionado em {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{m.studyCount} estudo(s)</Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {m.email} da equipe?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O corretor sai da sua equipe mas mantém a conta e os estudos. Somente o administrador pode excluir a conta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleRemove(m.userId)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="studies" className="pt-4">
          <Card className="p-0 overflow-hidden">
            {studiesQ.isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : studies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum estudo criado pela sua equipe ainda.
              </div>
            ) : (
              <div className="divide-y">
                {studies.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {s.bairro || "—"}{s.cidade ? ` · ${s.cidade}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.email} · {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status && <Badge variant="outline">{s.status}</Badge>}
                      <Link to="/app/relatorio/$id" params={{ id: s.id }}>
                        <Button size="sm" variant="ghost" className="gap-1">
                          Abrir <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}