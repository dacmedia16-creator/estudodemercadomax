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
import { Check, ChevronsUpDown, Crown, Loader2, Pencil, Plus, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  adminAddMemberToTeam, adminCreateTeam, adminDeleteTeam, adminGetTeam, adminListAvailableUsers,
  adminListTeams, adminRemoveMemberFromTeam, adminUpdateTeam,
} from "@/lib/team.functions";

export const Route = createFileRoute("/app/equipes")({
  component: TeamsAdminPage,
});

// Cor de destaque por equipe — determinística a partir do id, sem precisar
// guardar cor nenhuma no banco.
const TEAM_DOT_COLORS = [
  "bg-emerald-500", "bg-teal-500", "bg-violet-500", "bg-blue-500",
  "bg-amber-500", "bg-orange-500", "bg-pink-500", "bg-rose-500",
];
function teamDotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TEAM_DOT_COLORS[hash % TEAM_DOT_COLORS.length];
}

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
  const [managerId, setManagerId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminListAvailableUsers(),
    enabled: isAdmin && createOpen,
  });
  const users = usersQ.data?.users ?? [];
  const selectedUser = users.find((u) => u.id === managerId);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    if (detailId) await queryClient.invalidateQueries({ queryKey: ["admin-team", detailId] });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da equipe.");
      return;
    }
    if (!creatingNew && !managerId) {
      toast.error("Selecione um gestor.");
      return;
    }
    if (creatingNew && (!managerEmail.trim() || managerPassword.length < 8)) {
      toast.error("Informe e-mail e senha (mín. 8) para o novo gestor.");
      return;
    }
    setCreating(true);
    try {
      await adminCreateTeam({
        data: {
          name: name.trim(),
          managerId: creatingNew ? undefined : managerId ?? undefined,
          managerEmail: creatingNew ? managerEmail.trim() : undefined,
          managerPassword: creatingNew ? managerPassword : undefined,
        },
      });
      toast.success("Equipe criada.");
      setCreateOpen(false); setName(""); setManagerId(null);
      setCreatingNew(false); setManagerEmail(""); setManagerPassword("");
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
  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase()));

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
                Informe um nome e escolha o gestor entre os usuários cadastrados.
                Se preferir, crie um novo gestor informando e-mail e senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="t-name">Nome da equipe</Label>
                <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Equipe Centro" />
              </div>
              {!creatingNew ? (
                <div>
                  <Label>Gestor</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {selectedUser ? selectedUser.email : (usersQ.isLoading ? "Carregando..." : "Selecionar usuário")}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por e-mail..." />
                        <CommandList>
                          <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                          <CommandGroup>
                            {users.map((u) => (
                              <CommandItem
                                key={u.id}
                                value={u.email}
                                onSelect={() => { setManagerId(u.id); setPickerOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", managerId === u.id ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate">{u.email}</span>
                                <Badge variant="outline" className="ml-2 text-[10px]">{u.role}</Badge>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() => { setCreatingNew(true); setManagerId(null); }}
                  >
                    + Criar novo gestor
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Novo gestor</Label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => { setCreatingNew(false); setManagerEmail(""); setManagerPassword(""); }}
                    >
                      Escolher existente
                    </button>
                  </div>
                  <div>
                    <Label htmlFor="t-mgr">E-mail</Label>
                    <Input id="t-mgr" type="email" value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)} placeholder="gestor@exemplo.com" />
                  </div>
                  <div>
                    <Label htmlFor="t-pass">Senha inicial (mín. 8)</Label>
                    <Input id="t-pass" type="text" value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)} />
                  </div>
                </div>
              )}
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipe..."
          className="pl-9"
        />
      </div>

      {listQ.isLoading ? (
        <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : teams.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma equipe ainda. Clique em "Nova equipe" para começar.
        </Card>
      ) : filteredTeams.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma equipe encontrada para "{search}".
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", teamDotColor(t.id))} />
                <span className="font-semibold truncate">{t.name}</span>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>{t.memberCount} {t.memberCount === 1 ? "membro" : "membros"}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Crown className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate" title={t.managerEmail}>{t.managerEmail}</span>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-3">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setDetailId(t.id)}>
                  <Users className="h-3.5 w-3.5" /> Membros
                </Button>
                <Button size="icon" variant="ghost" title="Renomear" onClick={() => setRenaming({ id: t.id, name: t.name })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive" title="Excluir equipe">
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
            </Card>
          ))}
        </div>
      )}

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