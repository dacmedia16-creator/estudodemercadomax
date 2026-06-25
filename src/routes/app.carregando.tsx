import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { geckoPlp, geckoPdp } from "@/lib/gecko.functions";
import { geckoItemToProperty } from "@/lib/gecko-adapter";
import { generateStudy } from "@/lib/study-engine";
import { studyStore } from "@/lib/study-store";
import type { StudyInput } from "@/lib/study-types";
import type { MockProperty } from "@/lib/mock-properties";
import type { GeckoItem } from "@/lib/gecko-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/carregando")({
  component: Loading,
});

const STEPS = [
  "Conectando à GeckoAPI",
  "Buscando imóveis no Zap Imóveis",
  "Analisando imóveis encontrados",
  "Gerando estudo de mercado",
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

    (async () => {
      let properties: MockProperty[] = [];
      let fellBack = false;

      try {
        setStep(1);
        const businessType: "sale" | "rent" = input.finalidade === "Aluguel" ? "rent" : "sale";
        const keyword = `${input.tipo.toLowerCase()} ${input.quartos} quartos`.trim();
        const priceMin = Math.round(input.valorPretendido * 0.7);
        const priceMax = Math.round(input.valorPretendido * 1.3);
        const areaMin = Math.round(input.areaUtil * 0.75);
        const areaMax = Math.round(input.areaUtil * 1.25);

        const plpRes = await geckoPlp({
          data: {
            city: input.cidade,
            state: input.estado.toUpperCase(),
            businessType,
            keyword,
            bedrooms: input.quartos > 0 ? [input.quartos] : undefined,
            parkingSpots: input.vagas > 0 ? [input.vagas] : undefined,
            priceMin,
            priceMax,
            areaMin,
            areaMax,
            page: 1,
          },
        });

        if (!plpRes.ok) {
          throw new Error(plpRes.errorMessage || plpRes.errorCode || "Falha GeckoAPI");
        }

        const items: GeckoItem[] = plpRes.data?.items ?? [];
        if (items.length === 0) {
          throw new Error("Nenhum imóvel encontrado");
        }

        setStep(2);
        properties = items
          .map((it) => geckoItemToProperty(it, input.areaUtil, input.quartos))
          .filter((p): p is MockProperty => p !== null);

        // Enrich top 6 via PDP in parallel — non-blocking on individual failures
        const top = properties.slice(0, 6).filter((p) => p.url);
        await Promise.allSettled(
          top.map(async (p) => {
            try {
              const pdp = await geckoPdp({ data: { url: p.url } });
              if (pdp.ok && pdp.data && typeof pdp.data === "object") {
                const d = pdp.data as Record<string, any>;
                if (typeof d.condominium === "number") p.condominio = d.condominium;
                if (typeof d.iptu === "number") p.iptu = d.iptu;
                if (Array.isArray(d.amenities)) p.diferenciais = d.amenities;
              }
            } catch {
              /* ignore individual PDP failure */
            }
          }),
        );
      } catch (err) {
        const msg = (err as Error).message ?? "Erro desconhecido";
        const errorCode = String(msg);
        if (errorCode.includes("NO_TOKEN")) {
          setWarning("Token GeckoAPI não configurado — usando dados de demonstração.");
        } else if (errorCode.includes("401") || errorCode.toUpperCase().includes("UNAUTHORIZED")) {
          setWarning("Token GeckoAPI inválido — usando dados de demonstração.");
          toast.error("Token GeckoAPI inválido. Verifique em Configurações.");
        } else if (errorCode.includes("402") || errorCode.includes("INSUFFICIENT")) {
          setWarning("Sem créditos GeckoAPI — usando dados de demonstração.");
          toast.error("Sem créditos na GeckoAPI.");
        } else {
          setWarning(`Falha na GeckoAPI (${msg}) — usando dados de demonstração.`);
        }
        fellBack = true;
        properties = [];
      }

      setStep(3);
      const result = generateStudy(input, properties);
      if (fellBack) {
        result.diagnostico = `[Dados de demonstração] ${result.diagnostico}`;
      }
      studyStore.save(result);
      sessionStorage.removeItem("rip:pending");

      // brief pause so the user sees the final step
      await new Promise((r) => setTimeout(r, 600));
      setStep(4);
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