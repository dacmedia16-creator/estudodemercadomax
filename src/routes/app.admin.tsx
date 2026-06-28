import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DollarSign, ExternalLink, FileText, Loader2, Plus, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  adminCreateUser, adminDeleteStudy, adminDeleteUser, adminListAllStudies, adminListUsers, adminSetRole,
} from "@/lib/admin.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiCostPanel } from "@/components/api-cost-panel";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/app/novo-estudo", replace: true });
    }
  }, [roleLoading, isAdmin, navigate]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminListUsers(),
    enabled: isAdmin,
  });

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCreate = async () => {
    if (!newEmail || newPassword.length < 8) {
      toast.error("Informe email válido e senha com 8+ caracteres.");
      return;
    }
    setCreating(true);
    try {
      await adminCreateUser({ data: { email: newEmail.trim(), password: newPassword, isAdmin: newIsAdmin } });
      toast.success("Usuário criado.");
      setNewEmail(""); setNewPassword(""); setNewIsAdmin(false); setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setCreating(false); }
  };

  const handleToggleAdmin = async (id: string, makeAdmin: boolean) => {
    try {
      await adminSetRole({ data: { id, isAdmin: makeAdmin } });
      toast.success(makeAdmin ? "Promovido a admin." : "Removido de admin.");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteUser({ data: { id } });
      toast.success("Usuário excluído.");
      await refetch();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (roleLoading || !isAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Administração
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Painel do super admin</h1>
      <p className="mt-1 text-muted-foreground">
        Gerencie contas e visualize todos os estudos gerados na plataforma.
      </p>

      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="studies" className="gap-2"><FileText className="h-4 w-4" /> Estudos</TabsTrigger>
          <TabsTrigger value="cost" className="gap-2"><DollarSign className="h-4 w-4" /> Custo API</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Usuários</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} usuário(s) cadastrado(s). Crie, promova ou remova contas.
            </p>
          </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Criar usuário</DialogTitle>
              <DialogDescription>O usuário será criado com email já confirmado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ne">Email</Label>
                <Input id="ne" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="usuario@imobiliaria.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np">Senha (mín. 8 caracteres)</Label>
                <Input id="np" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label htmlFor="na" className="text-sm">Conceder papel de administrador</Label>
                  <p className="text-xs text-muted-foreground">Pode gerenciar usuários e ver todos os estudos.</p>
                </div>
                <Switch id="na" checked={newIsAdmin} onCheckedChange={setNewIsAdmin} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>

        <Card className="mt-4 overflow-hidden border-border/60">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Criado</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.email}</span>
                        {u.isSuperAdmin && (
                          <Badge className="border border-primary/30 bg-primary/10 text-[10px] text-primary">Super admin</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={u.isAdmin}
                        disabled={u.isSuperAdmin}
                        onCheckedChange={(v) => handleToggleAdmin(u.id, v)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={u.isSuperAdmin} title={u.isSuperAdmin ? "Super admin não pode ser excluído" : "Excluir"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação remove permanentemente <strong>{u.email}</strong> e todos os estudos associados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Card>
        </TabsContent>

        <TabsContent value="studies" className="mt-4">
          <AdminStudiesTab currentUserId={null} />
        </TabsContent>

        <TabsContent value="cost" className="mt-4">
          <ApiCostPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminStudiesTab({ currentUserId }: { currentUserId: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-studies"],
    queryFn: () => adminListAllStudies(),
  });

  const studies = data?.studies ?? [];
  const uniqueEmails = Array.from(new Set(studies.map((s) => s.email))).sort();

  const filtered = studies.filter((s) => {
    if (userFilter !== "all" && s.email !== userFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${s.cidade ?? ""} ${s.bairro ?? ""} ${s.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const handleDelete = async (id: string, email: string) => {
    try {
      await adminDeleteStudy({ data: { id } });
      toast.success(`Estudo de ${email} excluído.`);
      await queryClient.invalidateQueries({ queryKey: ["admin-studies"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Estudos da plataforma</h2>
          <p className="text-sm text-muted-foreground">
            {studies.length} estudo(s) de {uniqueEmails.length} usuário(s).
          </p>
        </div>
        <div className="flex flex-1 max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cidade, bairro ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">Todos usuários</option>
            {uniqueEmails.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden border-border/60">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {studies.length === 0
              ? "Nenhum estudo cadastrado na plataforma."
              : "Nenhum estudo encontrado com os filtros atuais."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Localização</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.email}</span>
                        {currentUserId && s.userId !== currentUserId && (
                          <Badge variant="secondary" className="text-[10px]">de outro usuário</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[s.bairro, s.cidade].filter(Boolean).join(" • ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.status ? <Badge variant="outline" className="text-xs">{s.status}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => navigate({ to: "/app/relatorio/$id", params: { id: s.id } })}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" title="Excluir estudo">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir este estudo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O estudo de <strong>{s.email}</strong> será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(s.id, s.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}