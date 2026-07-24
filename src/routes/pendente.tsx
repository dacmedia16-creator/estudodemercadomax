import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock3, LogOut, RotateCcw } from "lucide-react";
import remaxFull from "@/assets/remax-full.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pendente")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aguardando liberação — Estudo de Mercado Pro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendentePage,
});

function PendentePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      const isActive = data.user.app_metadata?.active !== false;
      if (isActive) {
        toast.success("Conta liberada!");
        navigate({ to: "/app", replace: true });
      } else {
        toast.info("Ainda aguardando liberação. Tente novamente em instantes.");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex flex-col items-center justify-center gap-2">
          <img src={remaxFull} alt="ESTUDO DE MERCADO" className="h-24 w-auto rounded-lg" />
          <span className="text-sm font-bold uppercase tracking-wider text-foreground">
            Estudo de Mercado <span className="text-primary">MAX</span>
          </span>
        </Link>

        <Card className="border-border/60 p-6 text-center shadow-[var(--shadow-elegant)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Clock3 className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Conta aguardando liberação</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu cadastro foi criado com sucesso. Um administrador ou gestor precisa liberar o acesso
            antes de você poder usar a plataforma.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button className="gap-2" onClick={handleCheck} disabled={checking}>
              <RotateCcw className="h-4 w-4" />{" "}
              {checking ? "Verificando..." : "Verificar novamente"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
