import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from "recharts";
import {
  Download, Share2, Save, Plus, Copy, ExternalLink,
  TrendingUp, TrendingDown, Minus, ChevronDown,
  CheckCircle2, AlertTriangle, Sparkles, Presentation, MessageSquareQuote, Settings2,
} from "lucide-react";
import { studyStore } from "@/lib/study-store";
import { formatBRL, computeAcm, getValorIdeal } from "@/lib/study-engine";
import type { StudyResult, SearchOverrides, ComparableProperty } from "@/lib/study-types";
import { DEFAULT_ACM } from "@/lib/study-types";
import { runStudy } from "@/lib/study-runner";
import { CriteriosEditor } from "@/components/criterios-editor";
import { AcmPanel } from "@/components/acm-panel";
import { PrintSlides, PrintOwnerPages } from "@/components/print-slides";
import { ComparaveisManager } from "@/components/comparaveis-manager";
import { AiAnalysisCard } from "@/components/ai-analysis-card";
import { PropertyPhotosCarousel } from "@/components/property-photos-carousel";
import { analisarMercadoIa } from "@/lib/ai-analysis.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/relatorio/$id")({
  component: ReportPage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h2 className="text-xl font-semibold">Não foi possível abrir o relatório</h2>
      <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Erro inesperado."}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={() => reset()}>Tentar novamente</Button>
        <Link to="/app/novo-estudo"><Button>Novo estudo</Button></Link>
      </div>
    </div>
  ),
});

type SortKey = "menor-preco" | "maior-similaridade" | "maior-area" | "menor-precom2";

function ReportPage() {
  const { id } = Route.useParams();
  const [study, setStudy] = useState<StudyResult | null>(null);
  const [sort, setSort] = useState<SortKey>("maior-similaridade");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunWarning, setRerunWarning] = useState<string | null>(null);
  // Snapshot dos comparáveis que vieram da última busca — usado para
  // restaurar a lista quando o usuário desfaz exclusões/inclusões manuais.
  const originalsRef = useRef<ComparableProperty[]>([]);
  const aiAutoTriedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = (await studyStore.get(id)) ?? null;
        if (cancelled) return;
        setStudy(s);
        originalsRef.current = s ? [...s.comparaveis] : [];
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Auto-geração da análise da IA para estudos antigos (sem aiAnalysis salva).
  useEffect(() => {
    if (!study) return;
    if (study.aiAnalysis) return;
    if (aiAutoTriedRef.current.has(study.id)) return;
    if (!study.comparaveis || study.comparaveis.length === 0) return;
    aiAutoTriedRef.current.add(study.id);
    (async () => {
      try {
        const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
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
        const res = await analisarMercadoIa({ data: payload });
        if (!res.ok || !res.data?.resumo || !res.data?.faixaRecomendada || !res.data?.discursoProprietario) return;
        const next: StudyResult = { ...study, aiAnalysis: res.data };
        setStudy(next);
        try { await studyStore.save(next); } catch { /* best-effort */ }
      } catch (e) {
        console.warn("[relatorio] auto AI failed:", (e as Error).message);
      }
    })();
  }, [study]);

  // Auto-export quando a tela é aberta com ?auto=onepager ou ?auto=slides
  // (usado pela central de Relatórios para disparar export sem cliques extras).
  useEffect(() => {
    if (!study) return;
    const params = new URLSearchParams(window.location.search);
    const auto = params.get("auto");
    if (auto !== "onepager" && auto !== "slides") return;
    const html = document.documentElement;
    if (auto === "slides") {
      html.classList.add("print-mode-slides");
      toast.info("Configure como Paisagem · 'Salvar como PDF'.");
    } else {
      toast.info("Use 'Salvar como PDF' na impressão.");
    }
    const cleanup = () => {
      html.classList.remove("print-mode-slides");
      window.removeEventListener("afterprint", cleanup);
      // Limpa o query param para não reimprimir em refresh.
      const url = new URL(window.location.href);
      url.searchParams.delete("auto");
      window.history.replaceState({}, "", url.toString());
    };
    window.addEventListener("afterprint", cleanup);
    const t = setTimeout(() => window.print(), 400);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", cleanup); };
  }, [study]);

  const handleRerun = async (overrides: SearchOverrides) => {
    if (!study) return;
    setRerunning(true);
    setRerunWarning(null);
    try {
      const { result, warning, fellBack } = await runStudy(study.input, overrides, undefined, study.id);
      // Keep same id so the URL stays valid; increment revision counter.
      result.id = study.id;
      result.revisao = (study.revisao ?? 0) + 1;
      await studyStore.save(result);
      setStudy(result);
      originalsRef.current = [...result.comparaveis];
      setRerunWarning(warning);
      if (fellBack) toast.error(warning ?? "Falha ao buscar — exibindo dados de demonstração.");
      else toast.success(`Busca reexecutada · ${result.comparaveis.length} comparáveis`);
    } catch (err) {
      toast.error(`Erro ao reexecutar: ${(err as Error).message}`);
    } finally {
      setRerunning(false);
    }
  };

  const sorted = useMemo(() => {
    if (!study) return [];
    const arr = [...study.comparaveis];
    switch (sort) {
      case "menor-preco": return arr.sort((a, b) => a.preco - b.preco);
      case "maior-similaridade": return arr.sort((a, b) => b.similaridade - a.similaridade);
      case "maior-area": return arr.sort((a, b) => b.areaUtil - a.areaUtil);
      case "menor-precom2": return arr.sort((a, b) => a.precoM2 - b.precoM2);
    }
  }, [study, sort]);

  if (!study) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-xl font-semibold">Estudo não encontrado</h2>
        <p className="mt-2 text-muted-foreground">Talvez ele tenha sido removido.</p>
        <Link to="/app/novo-estudo"><Button className="mt-6">Criar novo estudo</Button></Link>
      </div>
    );
  }

  const { input } = study;
  const statusColor =
    study.status === "Abaixo da média" ? "text-success bg-success/10 border-success/30"
    : study.status === "Acima da média" ? "text-warning-foreground bg-warning/15 border-warning/30"
    : "text-primary bg-primary/10 border-primary/30";
  const StatusIcon = study.status === "Acima da média" ? TrendingUp : study.status === "Abaixo da média" ? TrendingDown : Minus;

  const chartData = study.comparaveis.map((c, i) => ({
    name: `#${i + 1}`,
    preco: c.preco,
    precoM2: c.precoM2,
    bairro: c.bairro,
    isYours: false,
  }));

  const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
  const valorIdeal = getValorIdeal(study, acm);
  const ratioMin = acm.valorSugerido > 0 ? acm.valorMinimoFechamento / acm.valorSugerido : 0.95;
  const ratioMax = acm.valorSugerido > 0 ? acm.valorMaximoPublicacao / acm.valorSugerido : 1.05;
  const idealMin = Math.round(valorIdeal * ratioMin);
  const idealMax = Math.round(valorIdeal * ratioMax);
  const statusToneClass =
    study.status === "Abaixo da média" ? "text-success"
    : study.status === "Acima da média" ? "text-warning-foreground"
    : "text-primary";

  const copyAnalise = () => {
    const text = `${study.diagnostico}\n\nTítulo sugerido: ${study.tituloSugerido}\n\n${study.descricaoSugerida}\n\n${study.argumentoProprietario}`;
    navigator.clipboard.writeText(text);
    toast.success("Análise comercial copiada!");
  };

  return (
    <>
      {/* One-pager exclusivo do PDF (A4, página única) */}
      <PrintOnePager study={study} sorted={sorted} />
      {/* Páginas "Argumentos" + "Carta ao Proprietário" — entram no PDF padrão (A4 paisagem) */}
      <PrintOwnerPages study={study} sorted={sorted} />
      {/* Apresentação 16:9 para o proprietário (ativada via classe `print-mode-slides`) */}
      <PrintSlides study={study} sorted={sorted} />

      <div className="mx-auto max-w-7xl px-6 py-8 print-hide-on-print">
      {/* Header (oculto no PDF) */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Relatório do estudo</div>
          <h1 className="text-3xl font-bold tracking-tight">{input.tipo} em {input.bairro}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerado em {new Date(study.createdAt).toLocaleString("pt-BR")} · Finalidade: {input.finalidade}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { window.print(); toast.info("Use 'Salvar como PDF' na impressão."); }}>
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button size="sm" className="gap-2" onClick={() => {
            const html = document.documentElement;
            html.classList.add("print-mode-slides");
            const cleanup = () => {
              html.classList.remove("print-mode-slides");
              window.removeEventListener("afterprint", cleanup);
            };
            window.addEventListener("afterprint", cleanup);
            toast.info("Configure como Paisagem · 'Salvar como PDF'.");
            setTimeout(() => window.print(), 50);
          }}>
            <Presentation className="h-4 w-4" /> Exportar ACM (1 página)
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }}>
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={async () => {
            try { await studyStore.save(study); toast.success("Estudo salvo!"); }
            catch (err) { toast.error((err as Error).message); }
          }}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
          <Link to="/app/novo-estudo"><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo estudo</Button></Link>
        </div>
      </div>

      {/* HERO — valor recomendado */}
      <ResumoHero
        study={study}
        valorIdeal={valorIdeal}
        idealMin={idealMin}
        idealMax={idealMax}
        statusToneClass={statusToneClass}
        StatusIcon={StatusIcon}
      />

      {/* Faixa fina de indicadores */}
      <p className="mt-3 text-xs text-muted-foreground">
        Preço médio: <span className="font-medium text-foreground">{formatBRL(study.precoMedio)}</span>
        {" · "}Menor: <span className="font-medium text-foreground">{formatBRL(study.menorPreco)}</span>
        {" · "}Maior: <span className="font-medium text-foreground">{formatBRL(study.maiorPreco)}</span>
        {" · "}Faixa recomendada: <span className="font-medium text-foreground">{formatBRL(study.faixaMin)} – {formatBRL(study.faixaMax)}</span>
      </p>

      {/* Card "Como apresentar ao proprietário" */}
      <Card className="mt-6 border-border/60 p-6 print:hidden">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageSquareQuote className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Como apresentar ao proprietário</div>
            <div className="text-sm text-muted-foreground">Resumo, discurso e anúncio prontos para levar à reunião.</div>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Resumo do estudo
          </div>
          <p>{study.diagnostico}</p>
          {study.aiAnalysis?.resumo && (
            <p className="mt-2 border-t border-primary/20 pt-2 text-muted-foreground">{study.aiAnalysis.resumo}</p>
          )}
        </div>

        {study.comparaveis.length > 0 && (
          <div className="mt-5">
            <AiAnalysisCard study={study} onChange={setStudy} />
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Anúncio pronto</div>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyAnalise}>
              <Copy className="h-3 w-3" /> Copiar tudo
            </Button>
          </div>
          <Suggestion title="Título sugerido do anúncio" text={study.tituloSugerido} />
          <Suggestion title="Descrição sugerida" text={study.descricaoSugerida} />
          <Suggestion title="Argumento para o proprietário" text={study.argumentoProprietario} />
        </div>
      </Card>

      {/* Card "Prova de mercado" */}
      {study.comparaveis.length === 0 ? (
        <Card className="mt-6 border-warning/30 bg-warning/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning-foreground" />
          <div className="mt-3 text-base font-semibold">Nenhum imóvel parecido encontrado</div>
          <p className="mt-2 text-sm text-muted-foreground">
            A busca não retornou imóveis compatíveis. Abra <strong>Ajustar estudo (avançado)</strong> abaixo
            para ampliar área, preço ou bairros e reexecute a busca.
          </p>
        </Card>
      ) : (
        <Card className="mt-6 border-border/60 p-6 print-section print-break-before">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">Prova de mercado</div>
              <div className="text-sm text-muted-foreground">{study.comparaveis.length} imóveis parecidos anunciados agora.</div>
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="maior-similaridade">Maior semelhança</SelectItem>
                <SelectItem value="menor-preco">Menor preço</SelectItem>
                <SelectItem value="maior-area">Maior área</SelectItem>
                <SelectItem value="menor-precom2">Menor preço por m²</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gráfico principal */}
          <div className="rounded-lg border border-border/60 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição de preços</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 240)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <ReferenceLine y={input.valorPretendido} stroke="oklch(0.78 0.16 75)" strokeDasharray="4 4" label={{ value: "Seu imóvel", fontSize: 10, fill: "oklch(0.4 0.1 75)" }} />
                <Bar dataKey="preco" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="oklch(0.58 0.16 152)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela enxuta com expansão */}
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Portal</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead className="text-right">Área</TableHead>
                  <TableHead className="text-right">Qtos</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Semelhança</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => {
                  const badge = c.mesmoCondominio ? { label: "Mesmo prédio", cls: "bg-primary text-primary-foreground" }
                    : c.mesmoEndereco ? { label: "Mesmo endereço", cls: "border border-primary/60 text-primary bg-transparent" }
                    : c.preferenciaAtendida ? { label: "Match preferido", cls: "border border-success/60 text-success bg-transparent" }
                    : null;
                  const isOpen = expandedRow === c.id;
                  return (
                    <>
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => setExpandedRow(isOpen ? null : c.id)}>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{c.portal}</Badge></TableCell>
                        <TableCell className="max-w-[360px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{c.titulo}</span>
                            {badge && <Badge className={cn("shrink-0 text-[9px]", badge.cls)}>{badge.label}</Badge>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{c.bairro}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.areaUtil > 0 ? `${c.areaUtil}m²` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.quartos > 0 ? c.quartos : "—"}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatBRL(c.preco)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, c.similaridade))}%` }} />
                            </div>
                            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{c.similaridade}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground"><ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} /></TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={c.id + "-detail"} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7}>
                            <div className="grid gap-3 py-2 text-xs md:grid-cols-4">
                              <DetailKV label="Vagas" value={String(c.vagas)} />
                              <DetailKV label="R$/m²" value={c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"} />
                              <DetailKV label="Condomínio" value={c.condominio ? formatBRL(c.condominio) : "—"} />
                              <DetailKV label="IPTU" value={c.iptu ? formatBRL(c.iptu) : "—"} />
                              <DetailKV label="Dias no mercado" value={typeof c.diasMercado === "number" ? `${c.diasMercado} dias` : "—"} />
                              <DetailKV label="Anunciante" value={c.anunciante || "—"} />
                              {c.advertiserCreci && <DetailKV label="CRECI" value={c.advertiserCreci} />}
                              {c.advertiserWhatsapp && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">WhatsApp</div>
                                  <a
                                    href={`https://wa.me/${c.advertiserWhatsapp.replace(/\D/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-emerald-600 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {c.advertiserWhatsapp}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-2 text-[10px]">
                              {c.publicationType === "PREMIUM" && (
                                <Badge variant="outline" className="border-amber-500/60 text-amber-600">Premium</Badge>
                              )}
                              {typeof c.confidenceScore === "number" && c.confidenceScore < 50 && (
                                <Badge variant="outline" className="border-warning/60 text-warning-foreground" title={c.confidenceFactors?.join(" · ")}>
                                  Confiança {c.confidenceScore}
                                </Badge>
                              )}
                              {typeof c.dedupCount === "number" && c.dedupCount > 1 && (
                                <Badge variant="outline" className="border-primary/60 text-primary" title={c.dedupAnunciantes?.join(", ")}>
                                  {c.dedupCount} anunciantes
                                </Badge>
                              )}
                              {(c.aproximado || c.incomplete) && (!c.areaUtil || c.areaUtil <= 0) && (
                                <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">Área não informada</Badge>
                              )}
                              {c.removido && (
                                <Badge variant="outline" className="border-destructive/60 text-destructive">Anúncio removido</Badge>
                              )}
                              {c.url && (
                                <a
                                  href={c.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Abrir anúncio <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Concorrentes diretos */}
          <div className="mt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concorrentes diretos</div>
            <div className="grid gap-4 md:grid-cols-3">
              {sorted.slice(0, 3).map((c) => (
                <Card key={c.id} className="group overflow-hidden border-border/60">
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <PropertyPhotosCarousel
                      images={c.imagens && c.imagens.length ? c.imagens : (c.imagem ? [c.imagem] : [])}
                      alt={c.titulo}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{c.portal}</Badge>
                      <Badge className="bg-success text-success-foreground text-[10px]">{c.similaridade}% similar</Badge>
                    </div>
                    <h4 className="mt-2 line-clamp-2 font-semibold">{c.titulo}</h4>
                    <div className="mt-2 text-2xl font-bold text-primary">{formatBRL(c.preco)}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{c.bairro}</span>
                      <span>· {c.areaUtil}m²</span>
                      <span>· {c.quartos} qtos</span>
                      <span>· {c.vagas} vagas</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Mais dados (colapsado) */}
          <details className="mt-6 rounded-lg border border-border/60 p-4 open:pb-5">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ver mais dados
            </summary>
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço por m² dos parecidos · média {formatBRL(study.precoM2Medio)}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 240)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <ReferenceLine y={study.precoM2Pretendido} stroke="oklch(0.78 0.16 75)" strokeDasharray="4 4" label={{ value: "Seu R$/m²", fontSize: 10, fill: "oklch(0.4 0.1 75)" }} />
                  <Bar dataKey="precoM2" radius={[6, 6, 0, 0]} fill="oklch(0.7 0.18 152)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(() => {
              const counts = new Map<string, number>();
              sorted.forEach((c) => {
                const name = (c.anunciante || "").trim();
                if (!name || name === "—") return;
                counts.set(name, (counts.get(name) ?? 0) + 1);
              });
              const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
              if (top.length === 0) return null;
              return (
                <div className="mt-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Anunciantes mais ativos
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {top.map(([name, n]) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name} <span className="ml-1 opacity-70">· {n}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })()}
          </details>
        </Card>
      )}

      {/* Accordion — Ajustar estudo (avançado) */}
      <Accordion type="single" collapsible className="mt-6 print:hidden">
        <AccordionItem value="ajustes" className="rounded-lg border border-border/60 bg-card px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Settings2 className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold">Ajustar estudo (avançado)</div>
                <div className="text-xs text-muted-foreground">ACM, critérios de busca e lista de comparáveis.</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6 pt-2">
            {study.comparaveis.length > 0 && <AcmPanel study={study} onChange={setStudy} />}
            <CriteriosEditor
              study={study}
              input={input}
              onRerun={handleRerun}
              loading={rerunning}
              warning={rerunWarning}
            />
            <ComparaveisManager
              study={study}
              originals={originalsRef.current}
              onChange={setStudy}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Pontos fortes e pontos de atenção */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 print-break-before">
        <Card className="border-success/30 bg-success/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div className="text-sm font-semibold text-foreground">Pontos fortes</div>
          </div>
          <ul className="space-y-2 text-sm">
            {study.pontosFortes.map((p) => (
              <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{p}</li>
            ))}
          </ul>
        </Card>
        <Card className="border-warning/30 bg-warning/5 p-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-foreground" />
            <div className="text-sm font-semibold text-foreground">Pontos de atenção</div>
          </div>
          <ul className="space-y-2 text-sm">
            {study.pontosAtencao.map((p) => (
              <li key={p} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />{p}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Slide ACM — pré-visualização do material exportado, ao final do relatório */}
      <Card className="mt-6 border-border/60 p-6 print-section">
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Slide ACM</div>
          <div className="text-sm text-muted-foreground">
            Pré-visualização do material gerado para apresentação ao proprietário.
          </div>
        </div>
        <PrintSlides study={study} sorted={sorted} variant="screen" />
      </Card>

      </div>
    </>
  );
}

/** One-pager A4 — só aparece em @media print. Tudo em uma única folha. */
function PrintOnePager({ study, sorted }: { study: StudyResult; sorted: StudyResult["comparaveis"] }) {
  const acm = computeAcm(study, study.acm ?? DEFAULT_ACM);
  const { input } = study;
  const valorIdeal = getValorIdeal(study, acm);
  // Mínimo/máximo de publicação derivados do Valor Ideal para coerência com o discurso.
  const ratioMin = acm.valorSugerido > 0 ? acm.valorMinimoFechamento / acm.valorSugerido : 0.95;
  const ratioMax = acm.valorSugerido > 0 ? acm.valorMaximoPublicacao / acm.valorSugerido : 1.05;
  const idealMin = Math.round(valorIdeal * ratioMin);
  const idealMax = Math.round(valorIdeal * ratioMax);
  const top = sorted.slice(0, 6);
  const fortes = study.pontosFortes.slice(0, 4);
  const atencao = study.pontosAtencao.slice(0, 4);
  return (
    <section className="print-onepager hidden print:block">
      {/* Faixa de marca */}
      <div className="op-brandbar">
        <div className="op-brandbar-left">ESTUDO DE MERCADO PRO</div>
        <div className="op-brandbar-right">
          #{study.id.slice(0, 8).toUpperCase()} · {new Date(study.createdAt).toLocaleDateString("pt-BR")}
          {typeof study.revisao === "number" && study.revisao > 0 ? ` · rev. ${study.revisao}` : ""}
        </div>
      </div>

      {/* Título do imóvel */}
      <div className="op-titleblock">
        <div className="op-title">{input.tipo} · {input.bairro}, {input.cidade}/{input.estado}</div>
        <div className="op-sub">
          {input.areaUtil} m² · {input.quartos} dorm{input.suites > 0 ? ` (${input.suites} suíte${input.suites > 1 ? "s" : ""})` : ""} · {input.vagas} vaga{input.vagas !== 1 ? "s" : ""} · {input.finalidade}
        </div>
      </div>

      {/* HERO azul cheio — valor recomendado */}
      <div className="op-hero">
        <div className="op-hero-label">Valor recomendado para venda</div>
        <div className="op-hero-value">{formatBRL(valorIdeal)}</div>
        {study.valorIdealRange && (
          <div className="op-hero-meta" style={{ fontStyle: "italic", color: "#cfe0ff", marginBottom: 4 }}>
            Margem de segurança da estimativa ({study.valorIdealRange.confianca}): {formatBRL(study.valorIdealRange.min)} – {formatBRL(study.valorIdealRange.max)}
          </div>
        )}
        {study.iaSobrescrita && (
          <div className="op-hero-meta" style={{ color: "#fde68a", fontWeight: 700 }}>
            ⚠ Estimativa ajustada para o preço médio de mercado (divergência &gt; 15%).
          </div>
        )}
        <div className="op-hero-pills">
          <div className="op-hpill">
            <div className="lbl">Preço para vender rápido</div>
            <div className="val">{formatBRL(idealMin)}</div>
          </div>
          <div className="op-hpill op-hpill-strong">
            <div className="lbl">Preço recomendado</div>
            <div className="val">{formatBRL(valorIdeal)}</div>
          </div>
          <div className="op-hpill">
            <div className="lbl">Preço máximo para anunciar</div>
            <div className="val">{formatBRL(idealMax)}</div>
          </div>
        </div>
        <div className="op-hero-meta">
          {study.comparaveis.length} imóveis parecidos analisados · preço médio de mercado {formatBRL(study.precoM2Medio)}/m² · situação: <b>{study.status}</b>
        </div>
      </div>

      {/* KPIs 3 colunas */}
      <div className="op-kpis">
        <div className="op-kpi">
          <div className="lbl">Preço pretendido pelo proprietário</div>
          <div className="val">{formatBRL(input.valorPretendido)}</div>
          <div className="meta">{formatBRL(study.precoM2Pretendido)}/m² · cond. {formatBRL(input.condominio)}</div>
        </div>
        <div className="op-kpi">
          <div className="lbl">Preço médio dos imóveis parecidos</div>
          <div className="val">{formatBRL(study.precoMedio)}</div>
          <div className="meta">faixa {formatBRL(study.faixaMin)} – {formatBRL(study.faixaMax)}</div>
        </div>
        <div className="op-kpi">
          <div className="lbl">O que o estudo mostra</div>
          <div className="val op-kpi-status">{study.status}</div>
          <div className="meta">{study.diagnostico}</div>
        </div>
      </div>

      {/* Comparáveis */}
      <div className="op-section-title">Imóveis parecidos anunciados hoje</div>
      <table className="op-table">
        <thead>
          <tr>
            <th style={{ width: "10%" }}>Portal</th>
            <th>Endereço / título</th>
            <th className="num" style={{ width: "7%" }}>m²</th>
            <th className="num" style={{ width: "7%" }}>Qtos</th>
            <th className="num" style={{ width: "13%" }}>Preço</th>
            <th className="num" style={{ width: "11%" }}>R$/m²</th>
            <th style={{ width: "16%" }}>Semelhança</th>
          </tr>
        </thead>
        <tbody>
          {top.map((c) => (
            <tr key={c.id}>
              <td>{c.portal}</td>
              <td>
                <div className="op-cmp-title">{c.titulo}</div>
                <div className="op-cmp-sub">
                  {c.bairro}
                  {c.mesmoCondominio && <span className="op-tag">mesmo prédio</span>}
                  {!c.mesmoCondominio && c.mesmoEndereco && <span className="op-tag">mesmo endereço</span>}
                </div>
              </td>
              <td className="num">{c.areaUtil > 0 ? c.areaUtil : "—"}</td>
              <td className="num">{c.quartos > 0 ? c.quartos : "—"}</td>
              <td className="num"><b>{formatBRL(c.preco)}</b></td>
              <td className="num">{c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"}</td>
              <td>
                <div className="op-simwrap">
                  <div className="op-simbar"><span style={{ width: `${Math.max(2, Math.min(100, c.similaridade))}%` }} /></div>
                  <span className="op-simval">{c.similaridade}%</span>
                </div>
              </td>
            </tr>
          ))}
          {top.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#888" }}>Nenhum comparável encontrado.</td></tr>
          )}
        </tbody>
      </table>

      {/* Pontos fortes / atenção */}
      <div className="op-points">
        <div className="op-point op-point-good">
          <div className="op-point-head">✓ Pontos fortes</div>
          <ul>{fortes.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="op-point op-point-warn">
          <div className="op-point-head">! Pontos de atenção</div>
          <ul>{atencao.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>

      {/* Sugestão comercial */}
      <div className="op-suggest">
        <div className="op-suggest-head">Sugestão comercial</div>
        <div className="op-suggest-body">
          <div><span className="lbl">Título:</span> {study.tituloSugerido}</div>
          <div style={{ marginTop: "2pt" }}><span className="lbl">Argumento:</span> {study.argumentoProprietario}</div>
        </div>
      </div>

      <div className="op-footer">
        <span>Estudo de Mercado Pro</span>
        <span>Gerado em {new Date(study.createdAt).toLocaleString("pt-BR")}</span>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value, highlight }: { icon?: typeof Home; label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={cn("mt-1 text-sm font-semibold", highlight && "text-primary text-base")}>{value}</div>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/60 p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

function Suggestion({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <button
          onClick={() => { navigator.clipboard.writeText(text); toast.success("Copiado!"); }}
          className="text-xs text-primary hover:underline"
        >Copiar</button>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return <CheckCircle2 className={className} />;
}