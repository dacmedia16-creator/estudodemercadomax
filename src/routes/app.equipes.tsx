import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  adminAddMemberToTeam, adminCreateTeam, adminDeleteTeam, adminGetTeam, adminListTeams,
  adminRemoveMemberFromTeam, adminUpdateTeam,
} from "@/lib/team.functions";

export const Route = createFileRoute("/app/equipes")({
  component: TeamsAdminPage,
});

function TeamsAdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/app", replace: true });
    }
  }, [roleLoading, isAdmin, navigate]);

  const listQ = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => adminListTeams(),
    enabled: isAdmin,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    if (detailId) await queryClient.invalidateQueries({ queryKey: ["admin-team", detailId] });
  };

  const handleCreate = async () => {
    if (!name.trim() || !managerEmail.trim()) {
      toast.error("Preencha nome da equipe e e-mail do gestor.");
      return;
    }
    setCreating(true);
    try {
      await adminCreateTeam({
        data: {
          name: name.trim(),
          managerEmail: managerEmail.trim(),
          managerPassword: managerPassword ? managerPassword : undefined,
        },
      });
      toast.success("Equipe criada.");
      setCreateOpen(false); setName(""); setManagerEmail(""); setManagerPassword("");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar equipe.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteTeam({ data: { id } });
      toast.success("Equipe excluída.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir.");
    }
  };

  const handleRename = async () => {
    if (!renaming) return;
    try {
      await adminUpdateTeam({ data: { id: renaming.id, name: renaming.name.trim() } });
      toast.success("Nome atualizado.");
      setRenaming(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao renomear.");
    }
  };

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const teams = listQ.data?.teams ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Equipes
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie equipes, defina o gestor responsável e adicione corretores.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Nova equipe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova equipe</DialogTitle>
              <DialogDescription>
                Informe um nome e o gestor responsável. Se o e-mail já existir, ele será promovido a gestor.
                Se for novo, informe também uma senha inicial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="t-name">Nome da equipe</Label>
                <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Equipe Centro" />
              </div>
              <div>
                <Label htmlFor="t-mgr">E-mail do gestor</Label>
                <Input id="t-mgr" type="email" value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)} placeholder="gestor@exemplo.com" />
              </div>
              <div>
                <Label htmlFor="t-pass">Senha inicial (se novo usuário, mín. 8)</Label>
                <Input id="t-pass" type="text" value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)} placeholder="deixe em branco se já existir" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-0 overflow-hidden">
        {listQ.isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : teams.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma equipe ainda. Clique em "Nova equipe" para começar.
          </div>
        ) : (
          <div className="divide-y">
            {teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Gestor: {t.managerEmail} · criada em {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t.memberCount} corretor(es)</Badge>
                  <Badge variant="outline">{t.studyCount} estudo(s)</Badge>
                  <Button size="sm" variant="outline" onClick={() => setDetailId(t.id)}>
                    Gerenciar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: t.id, name: t.name })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir equipe "{t.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Os corretores serão desvinculados da equipe. As contas e os estudos são preservados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(t.id)}
                        >
                          Excluir
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

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear equipe</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rn">Nome</Label>
            <Input id="rn" value={renaming?.name ?? ""}
              onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={handleRename}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team detail drawer */}
      {detailId && (
        <TeamDetailDialog
          teamId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function TeamDetailDialog({
  teamId, onClose, onChanged,
}: { teamId: string; onClose: () => void; onChanged: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const detailQ = useQuery({
    queryKey: ["admin-team", teamId],
    queryFn: () => adminGetTeam({ data: { id: teamId } }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!email || password.length < 8) {
      toast.error("Informe e-mail válido e senha com 8+ caracteres.");
      return;
    }
    setAdding(true);
    try {
      await adminAddMemberToTeam({ data: { teamId, email: email.trim(), password } });
      toast.success("Corretor adicionado.");
      setEmail(""); setPassword(""); setAddOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-team", teamId] });
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao adicionar.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string, deleteAccount: boolean) => {
    try {
      await adminRemoveMemberFromTeam({ data: { teamId, userId, deleteAccount } });
      toast.success(deleteAccount ? "Corretor removido e conta excluída." : "Corretor desvinculado.");
      await queryClient.invalidateQueries({ queryKey: ["admin-team", teamId] });
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover.");
    }
  };

  const team = detailQ.data;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{team?.name ?? "Carregando..."}</DialogTitle>
          <DialogDescription>
            Gestor: {team?.managerEmail ?? "…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Corretores</div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Adicionar corretor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar corretor</DialogTitle>
                <DialogDescription>
                  Se o e-mail não existir, uma conta será criada com a senha informada.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="am-email">E-mail</Label>
                  <Input id="am-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="am-pass">Senha inicial (mín. 8)</Label>
                  <Input id="am-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={adding}>
                  {adding && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-0 overflow-hidden max-h-80 overflow-y-auto">
          {detailQ.isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !team || team.members.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum corretor nesta equipe.
            </div>
          ) : (
            <div className="divide-y">
              {team.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <div className="truncate">{m.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Adicionado em {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(m.userId, false)}>
                      Desvincular
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir conta de {m.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove o corretor da equipe e apaga a conta e os estudos dele. Ação irreversível.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleRemove(m.userId, true)}
                          >
                            Excluir conta
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}