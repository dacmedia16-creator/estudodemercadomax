import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { analisarMercadoIa } from "@/lib/ai-analysis.functions";
import { computeAcm, formatBRL } from "@/lib/study-engine";
import { studyStore } from "@/lib/study-store";
import { DEFAULT_ACM, type StudyResult } from "@/lib/study-types";

interface Props {
  study: StudyResult;
  onChange: (next: StudyResult) => void;
}

export function AiAnalysisCard({ study, onChange }: Props) {
  const callAi = useServerFn(analisarMercadoIa);
  const [loading, setLoading] = useState(false);
  const ai = study.aiAnalysis;
  const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);

  const run = async () => {
    setLoading(true);
    try {
      const payload = {
        imovel: {
          tipo: study.input.tipo,
          finalidade: study.input.finalidade,
          bairro: study.input.bairro,
          cidade: study.input.cidade,
          estado: study.input.estado,
          areaUtil: study.input.areaUtil,
          quartos: study.input.quartos,
          suites: study.input.suites,
          vagas: study.input.vagas,
          condominio: study.input.condominio,
          iptu: study.input.iptu,
          valorPretendido: study.input.valorPretendido,
          diferenciais: study.input.diferenciais ?? [],
          edificio: study.input.edificio,
        },
        mercado: {
          precoMedio: study.precoMedio,
          precoM2Medio: study.precoM2Medio,
          menorPreco: study.menorPreco,
          maiorPreco: study.maiorPreco,
          p10: study.stats?.p10,
          p25: study.stats?.p25,
          median: study.stats?.median,
          p75: study.stats?.p75,
          p90: study.stats?.p90,
          valorPiso: acm.valorPiso,
          valorSugerido: acm.valorSugerido,
        },
        comparaveis: study.comparaveis.slice(0, 15).map((c) => ({
          titulo: c.titulo,
          bairro: c.bairro,
          areaUtil: c.areaUtil,
          quartos: c.quartos,
          preco: c.preco,
          precoM2: c.precoM2,
          similaridade: c.similaridade,
          portal: c.portal,
        })),
      };
      const res = await callAi({ data: payload });
      if (!res.ok) {
        console.error("[AiAnalysisCard]", res.error);
        toast.error(res.error);
        return;
      }
      if (!res.data?.resumo || !res.data?.faixaRecomendada) {
        console.error("[AiAnalysisCard] resposta incompleta", res.data);
        toast.error("A IA retornou uma resposta incompleta. Tente novamente.");
        return;
      }
      const next: StudyResult = { ...study, aiAnalysis: res.data };
      onChange(next);
      try {
        await studyStore.save(next);
      } catch {
        /* persistência best-effort */
      }
      toast.success("Análise gerada pela IA");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border/60 p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Análise por IA</div>
            <div className="text-sm text-muted-foreground">
              Recomendação qualitativa baseada nos comparáveis e no piso de mercado.
            </div>
          </div>
        </div>
        <Button onClick={run} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : ai ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analisando..." : ai ? "Gerar novamente" : "Analisar com IA"}
        </Button>
      </div>

      {!ai && !loading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          Clique em <strong>Analisar com IA</strong> para receber uma faixa recomendada com justificativa, riscos e ações concretas.
        </div>
      )}

      {ai && (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
            {ai.resumo}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FaixaCell label="Entrada (rápido)" value={ai.faixaRecomendada.entrada} tone="muted" />
            <FaixaCell label="Ideal" value={ai.faixaRecomendada.ideal} tone="primary" />
            <FaixaCell label="Teto de publicação" value={ai.faixaRecomendada.teto} tone="success" />
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Posicionamento</div>
            <p className="mt-1 text-sm leading-relaxed">{ai.posicionamento}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" /> Riscos
              </div>
              <ul className="space-y-1.5 text-sm">
                {ai.riscos.map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-warning-foreground">•</span>{r}</li>
                ))}
                {ai.riscos.length === 0 && <li className="text-muted-foreground">Nenhum risco crítico identificado.</li>}
              </ul>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-success" /> Recomendações
              </div>
              <ul className="space-y-1.5 text-sm">
                {ai.recomendacoes.map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-success">•</span>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">Gerado por IA · revisar antes de apresentar</Badge>
            <span>{new Date(ai.geradoEm).toLocaleString("pt-BR")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function FaixaCell({ label, value, tone }: { label: string; value: number; tone: "muted" | "primary" | "success" }) {
  const cls =
    tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "success" ? "border-success/40 bg-success/5 text-success"
    : "border-border bg-background text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{formatBRL(value)}</div>
    </div>
  );
}