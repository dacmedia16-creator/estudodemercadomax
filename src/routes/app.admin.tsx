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
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  adminCreateUser, adminDeleteUser, adminListUsers, adminSetRole,
} from "@/lib/admin.functions";

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Administração
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-muted-foreground">
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

      <Card className="mt-6 overflow-hidden border-border/60">
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
    </div>
  );
}