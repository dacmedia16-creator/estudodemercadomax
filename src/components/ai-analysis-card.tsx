import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, RotateCcw, Copy, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { analisarMercadoIa } from "@/lib/ai-analysis.functions";
import { computeAcm, formatBRL, rewriteCurrencyInText } from "@/lib/study-engine";
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

  // Faixa Entrada / Ideal / Teto é a MESMA do painel ACM — única fonte da
  // verdade. Assim os sliders, o piso competitivo e o teto de publicação
  // refletem aqui sem divergir do card "Valor sugerido" acima.
  const entradaAdj = ai ? acm.valorMinimoFechamento : 0;
  const idealAdj = ai ? acm.valorSugerido : 0;
  const tetoAdj = ai ? acm.valorMaximoPublicacao : 0;
  const pairs = ai
    ? [
        { original: ai.faixaRecomendada.entrada, ajustado: entradaAdj },
        { original: ai.faixaRecomendada.ideal, ajustado: idealAdj },
        { original: ai.faixaRecomendada.teto, ajustado: tetoAdj },
      ]
    : [];
  const discursoAjustado = ai?.discursoProprietario ? rewriteCurrencyInText(ai.discursoProprietario, pairs) : "";
  const argumentosAjustados = ai?.argumentosChave?.map((a) => rewriteCurrencyInText(a, pairs)) ?? [];
  const idealMudou = ai ? Math.abs(idealAdj - ai.faixaRecomendada.ideal) / Math.max(1, ai.faixaRecomendada.ideal) > 0.005 : false;

  const run = async () => {
    setLoading(true);
    try {
      const n = (v: unknown) => {
        const x = typeof v === "number" ? v : Number(v);
        return Number.isFinite(x) ? x : 0;
      };
      const comparaveis = study.comparaveis
        .filter((c) => n(c.preco) > 0)
        .slice(0, 15)
        .map((c) => ({
          titulo: c.titulo ?? "",
          bairro: c.bairro ?? "",
          areaUtil: n(c.areaUtil),
          quartos: n(c.quartos),
          preco: n(c.preco),
          precoM2: n(c.precoM2) || (n(c.areaUtil) > 0 ? n(c.preco) / n(c.areaUtil) : 0),
          similaridade: n(c.similaridade),
          portal: c.portal ?? "",
        }));
      if (comparaveis.length === 0) {
        toast.error("Sem comparáveis com preço para analisar.");
        setLoading(false);
        return;
      }
      const payload = {
        imovel: {
          tipo: study.input.tipo,
          finalidade: study.input.finalidade,
          bairro: study.input.bairro,
          cidade: study.input.cidade,
          estado: study.input.estado,
          areaUtil: n(study.input.areaUtil),
          quartos: n(study.input.quartos),
          suites: n(study.input.suites),
          vagas: n(study.input.vagas),
          condominio: n(study.input.condominio),
          iptu: n(study.input.iptu),
          valorPretendido: n(study.input.valorPretendido),
          diferenciais: study.input.diferenciais ?? [],
          edificio: study.input.edificio,
        },
        mercado: {
          precoMedio: n(study.precoMedio),
          precoM2Medio: n(study.precoM2Medio),
          menorPreco: n(study.menorPreco),
          maiorPreco: n(study.maiorPreco),
          p10: n(study.stats?.p10),
          p25: n(study.stats?.p25),
          median: n(study.stats?.median),
          p75: n(study.stats?.p75),
          p90: n(study.stats?.p90),
          valorPiso: n(acm.valorPiso),
          valorSugerido: n(acm.valorSugerido),
        },
        comparaveis,
      };
      const res = await callAi({ data: payload });
      if (!res.ok) {
        console.error("[AiAnalysisCard]", res.error);
        toast.error(res.error);
        return;
      }
      if (!res.data?.resumo || !res.data?.faixaRecomendada || !res.data?.discursoProprietario) {
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
        <Button onClick={run} disabled={loading} size="sm" variant={ai ? "outline" : "default"} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : ai ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analisando..." : ai ? "Gerar novamente" : "Tentar novamente"}
        </Button>
      </div>

      {!ai && !loading && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          Análise automática indisponível neste estudo. Clique em <strong>Tentar novamente</strong> para gerar uma faixa recomendada com justificativa, riscos e ações concretas.
        </div>
      )}

      {ai && (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
            {ai.resumo}
          </div>

          {acm.pisoAplicado && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
              Valor ajustado para respeitar o piso competitivo do mercado ({formatBRL(acm.valorPiso)}).
            </div>
          )}
          {idealMudou && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
              Valor ideal ajustado no painel ACM acima — o discurso e os argumentos abaixo já refletem o novo número.
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Posicionamento</div>
            <p className="mt-1 text-sm leading-relaxed">{ai.posicionamento}</p>
          </div>

          {ai.discursoProprietario && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <MessageSquareQuote className="h-4 w-4" /> Como conversar com o proprietário
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(discursoAjustado || ai.discursoProprietario || "");
                      toast.success("Discurso copiado");
                    } catch {
                      toast.error("Não foi possível copiar");
                    }
                  }}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{discursoAjustado}</p>
            </div>
          )}

          {ai.argumentosChave && ai.argumentosChave.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Argumentos de mercado
              </div>
              <ul className="space-y-1.5 text-sm">
                {argumentosAjustados.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

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