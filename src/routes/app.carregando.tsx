import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/carregando")({
  component: Loading,
});

const STEPS = [
  "Montando filtros de busca",
  "Consultando portais imobiliários",
  "Encontrando imóveis comparáveis",
  "Calculando preço por m²",
  "Gerando análise estratégica",
  "Preparando relatório",
];

function Loading() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const id = sessionStorage.getItem("rip:lastId");
      if (id) navigate({ to: "/app/relatorio/$id", params: { id } });
      else navigate({ to: "/app/novo-estudo" });
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step, navigate]);

  const progress = (step / STEPS.length) * 100;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
      <h1 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
        Analisando o mercado ao redor do seu imóvel...
      </h1>
      <p className="mt-2 text-center text-muted-foreground">
        Isso leva apenas alguns segundos. Não feche a página.
      </p>

      <Card className="mt-8 w-full border-border/60 p-6">
        <Progress value={progress} className="mb-6" />
        <ul className="space-y-3">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className={cn("flex items-center gap-3 text-sm transition", !done && !active && "opacity-50")}>
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                </span>
                <span className={cn(done ? "text-foreground" : active ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}