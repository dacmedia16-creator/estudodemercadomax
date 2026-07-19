import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { runStudy } from "@/lib/study-runner";
import { studyStore } from "@/lib/study-store";
import type { StudyInput } from "@/lib/study-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/carregando")({
  component: Loading,
});

const STEPS = [
  "Conectando...",
  "Buscando imóveis nos portais ativos",
  "Analisando imóveis encontrados",
  "Gerando estudo de mercado",
  "Gerando análise por IA",
];

function Loading() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const raw = sessionStorage.getItem("rip:pending");
    if (!raw) {
      navigate({ to: "/app/novo-estudo" });
      return;
    }
    const input = JSON.parse(raw) as StudyInput;
    const kwRaw = sessionStorage.getItem("rip:pending-keyword");
    const radiusRaw = sessionStorage.getItem("rip:pending-radius");
    const fmRaw = sessionStorage.getItem("rip:pending-fieldmodes");
    const radiusKm = radiusRaw ? Number(radiusRaw) : undefined;
    const overrides: Record<string, unknown> = kwRaw ? { keyword: kwRaw, autoExpand: true } : {};
    if (radiusKm && radiusKm > 0) overrides.radiusKm = radiusKm;
    if (fmRaw) {
      try { overrides.fieldModes = JSON.parse(fmRaw); } catch { /* ignore */ }
    }

    (async () => {
      const preStudyId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : undefined;
      const { result, warning, fellBack } = await runStudy(input, overrides, (s) => setStep(s), preStudyId);
      if (preStudyId) result.id = preStudyId;
      if (warning) setWarning(warning);
      if (fellBack && warning?.includes("inválido")) toast.error("Token GeckoAPI inválido. Verifique em Configurações.");
      if (fellBack && warning?.includes("créditos")) toast.error("Sem créditos na GeckoAPI.");
      if (fellBack && warning?.includes("indisponível")) {
        toast.error("GeckoAPI indisponível no momento. Tente novamente em alguns minutos.");
      }
      try {
        await studyStore.save(result);
      } catch (err) {
        toast.error(`Não foi possível salvar o estudo: ${(err as Error).message}`);
        return;
      }
      sessionStorage.removeItem("rip:pending");
      sessionStorage.removeItem("rip:pending-keyword");
      sessionStorage.removeItem("rip:pending-radius");
      sessionStorage.removeItem("rip:pending-fieldmodes");

      // brief pause so the user sees the final step
      await new Promise((r) => setTimeout(r, 400));
      setStep(5);
      await new Promise((r) => setTimeout(r, 300));
      navigate({ to: "/app/relatorio/$id", params: { id: result.id } });
    })();
  }, [navigate]);

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
        {warning && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>{warning}</span>
          </div>
        )}
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