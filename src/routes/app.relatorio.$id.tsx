import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from "recharts";
import {
  Download, Share2, Save, Plus, Copy, ExternalLink,
  TrendingUp, TrendingDown, Minus, Home, MapPin, Bed, Car, Maximize2,
  CheckCircle2, AlertTriangle, Sparkles, Presentation,
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

      {/* Block 1: resumo */}
      <Card className="border-border/60 p-6 print-section">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imóvel analisado</div>
        <div className="grid gap-6 md:grid-cols-4">
          <Info icon={Home} label="Tipo / Finalidade" value={`${input.tipo} · ${input.finalidade}`} />
          <Info icon={MapPin} label="Localização" value={`${input.bairro}, ${input.cidade}/${input.estado}`} />
          <Info icon={Maximize2} label="Área útil" value={`${input.areaUtil} m²`} />
          <Info icon={Bed} label="Quartos / Suítes" value={`${input.quartos} / ${input.suites}`} />
          <Info icon={Car} label="Vagas" value={`${input.vagas}`} />
          <Info icon={TrendingUp} label="Valor pretendido" value={formatBRL(input.valorPretendido)} highlight />
          <Info label="Preço por m²" value={formatBRL(study.precoM2Pretendido)} />
          <Info label="Condomínio" value={formatBRL(input.condominio)} />
        </div>
      </Card>

      {/* Block 2: indicadores */}
      <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Indicator label="Comparáveis encontrados" value={String(study.comparaveis.length)} />
        <Indicator label="Preço médio de mercado" value={formatBRL(study.precoMedio)} />
        <Indicator label="Preço médio por m²" value={formatBRL(study.precoM2Medio)} />
        <Indicator label="Faixa recomendada" value={`${formatBRL(study.faixaMin)} – ${formatBRL(study.faixaMax)}`} />
        <Indicator label="Menor preço" value={formatBRL(study.menorPreco)} />
        <Indicator label="Maior preço" value={formatBRL(study.maiorPreco)} />
        <Card className={cn("border p-5 md:col-span-2", statusColor)}>
          <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Status do imóvel</div>
          <div className="mt-3 flex items-center gap-3">
            <StatusIcon className="h-7 w-7" />
            <div>
              <div className="text-2xl font-bold">{study.status}</div>
              <div className="text-xs opacity-80">em relação ao mercado de {input.bairro}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Block 3: diagnostico */}
      <Card className="mt-6 border-border/60 p-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Diagnóstico estratégico</div>
        </div>
        <p className="text-base leading-relaxed text-foreground">{study.diagnostico}</p>
      </Card>

      {/* Block 3.2: ACM */}
      {study.comparaveis.length > 0 && (
        <div className="mt-6 print-break-before">
          <AcmPanel study={study} onChange={setStudy} />
        </div>
      )}

      {/* Block 3.3: Análise por IA */}
      {study.comparaveis.length > 0 && (
        <div className="mt-6 print:hidden">
          <AiAnalysisCard study={study} onChange={setStudy} />
        </div>
      )}

      {/* Block 3.5: critérios da busca */}
      <div className="mt-6 print:hidden">
        <CriteriosEditor
          study={study}
          input={input}
          onRerun={handleRerun}
          loading={rerunning}
          warning={rerunWarning}
        />
      </div>

      {/* Block 3.6: gerenciar comparáveis manualmente (excluir / incluir por link) */}
      <div className="mt-6 print:hidden">
        <ComparaveisManager
          study={study}
          originals={originalsRef.current}
          onChange={setStudy}
        />
      </div>

      {/* Block 5: graficos */}
      {study.comparaveis.length === 0 ? (
        <Card className="mt-6 border-warning/30 bg-warning/5 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning-foreground" />
          <div className="mt-3 text-base font-semibold">Nenhum comparável encontrado</div>
          <p className="mt-2 text-sm text-muted-foreground">
            A busca não retornou imóveis compatíveis. Use o painel <strong>Ajustar critérios</strong> acima
            para ampliar área, preço ou bairros e reexecute a busca.
          </p>
        </Card>
      ) : (
      <>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 p-6">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição de preços</div>
            <div className="text-sm text-muted-foreground">Comparáveis × valor pretendido</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
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
        </Card>
        <Card className="border-border/60 p-6">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço por m² dos comparáveis</div>
            <div className="text-sm text-muted-foreground">Média: {formatBRL(study.precoM2Medio)}</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 240)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <ReferenceLine y={study.precoM2Pretendido} stroke="oklch(0.78 0.16 75)" strokeDasharray="4 4" label={{ value: "Seu R$/m²", fontSize: 10, fill: "oklch(0.4 0.1 75)" }} />
              <Bar dataKey="precoM2" radius={[6, 6, 0, 0]} fill="oklch(0.7 0.18 152)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Block 4: tabela */}
      <Card className="mt-6 border-border/60 p-6 print-break-before print-section">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tabela comparativa</div>
            <div className="text-sm text-muted-foreground">{study.comparaveis.length} imóveis encontrados</div>
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="maior-similaridade">Maior similaridade</SelectItem>
              <SelectItem value="menor-preco">Menor preço</SelectItem>
              <SelectItem value="maior-area">Maior área</SelectItem>
              <SelectItem value="menor-precom2">Menor preço por m²</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portal</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead className="text-right">Área</TableHead>
                <TableHead className="text-right">Qtos</TableHead>
                <TableHead className="text-right">Vagas</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">R$/m²</TableHead>
                <TableHead className="text-right">Cond.</TableHead>
                <TableHead className="text-right">IPTU</TableHead>
                <TableHead className="text-right">DOM</TableHead>
                <TableHead>Anunciante</TableHead>
                <TableHead className="text-right">Similar.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{c.portal}</Badge></TableCell>
                  <TableCell className="max-w-[260px] font-medium">
                    <div className="truncate">{c.titulo}</div>
                    {c.mesmoCondominio && (
                      <Badge className="mt-1 bg-primary text-primary-foreground text-[9px]">Mesmo prédio</Badge>
                    )}
                    {!c.mesmoCondominio && c.mesmoEndereco && (
                      <Badge variant="outline" className="mt-1 text-[9px] border-primary/60 text-primary">Mesmo endereço</Badge>
                    )}
                    {c.preferenciaAtendida && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[9px] border-success/60 text-success">Match preferido</Badge>
                    )}
                    {c.removido && (
                      <Badge variant="outline" className="mt-1 text-[9px] border-destructive/60 text-destructive">Anúncio removido</Badge>
                    )}
                    {c.publicationType === "PREMIUM" && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[9px] border-amber-500/60 text-amber-600">Premium</Badge>
                    )}
                    {(c.aproximado || c.incomplete) && (!c.areaUtil || c.areaUtil <= 0) && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[9px] border-muted-foreground/40 text-muted-foreground">Área não informada</Badge>
                    )}
                    {typeof c.confidenceScore === "number" && c.confidenceScore < 50 && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[9px] border-warning/60 text-warning-foreground" title={c.confidenceFactors?.join(" · ")}>
                        Confiança {c.confidenceScore}
                      </Badge>
                    )}
                    {typeof c.dedupCount === "number" && c.dedupCount > 1 && (
                      <Badge variant="outline" className="ml-1 mt-1 text-[9px] border-primary/60 text-primary" title={c.dedupAnunciantes?.join(", ")}>
                        {c.dedupCount} anunciantes
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.bairro}</TableCell>
                  <TableCell className="text-right">{c.areaUtil > 0 ? `${c.areaUtil}m²` : "—"}</TableCell>
                  <TableCell className="text-right">{c.quartos > 0 ? c.quartos : "—"}</TableCell>
                  <TableCell className="text-right">{c.vagas}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(c.preco)}</TableCell>
                  <TableCell className="text-right">{c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.condominio ? formatBRL(c.condominio) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{c.iptu ? formatBRL(c.iptu) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{typeof c.diasMercado === "number" ? `${c.diasMercado}d` : "—"}</TableCell>
                  <TableCell className="max-w-[180px] text-xs">
                    <div className="truncate">{c.anunciante || "—"}</div>
                    {c.advertiserWhatsapp && (
                      <a
                        href={`https://wa.me/${c.advertiserWhatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-600 hover:underline"
                      >
                        WhatsApp
                      </a>
                    )}
                    {c.advertiserCreci && (
                      <span className="ml-2 text-[10px] text-muted-foreground">CRECI {c.advertiserCreci}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={cn("text-[10px]", c.similaridade > 75 ? "bg-success text-success-foreground" : c.similaridade > 55 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {c.similaridade}%
                    </Badge>
                  </TableCell>
                  <TableCell><a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline"><ExternalLink className="h-4 w-4" /></a></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Top anunciantes da região */}
      {(() => {
        const counts = new Map<string, number>();
        sorted.forEach((c) => {
          const name = (c.anunciante || "").trim();
          if (!name || name === "—") return;
          counts.set(name, (counts.get(name) ?? 0) + 1);
        });
        const top = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        if (top.length === 0) return null;
        return (
          <Card className="mt-6 border-border/60 p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anunciantes mais ativos nos comparáveis
            </div>
            <div className="flex flex-wrap gap-2">
              {top.map(([name, n]) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name} <span className="ml-1 opacity-70">· {n}</span>
                </Badge>
              ))}
            </div>
          </Card>
        );
      })()}

      {/* Block 6: concorrentes diretos */}
      <div className="mt-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concorrentes diretos</div>
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
                <div className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                  Concorrente direto pela proximidade de metragem, bairro e diferenciais semelhantes.
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Block 7: pontos fortes e fracos */}
      </>
      )}
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

      {/* Block 8: sugestao comercial */}
      <Card className="mt-6 border-border/60 p-6 print-section">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Sugestão comercial</div>
            <div className="text-sm text-muted-foreground">Pronto para usar com o cliente</div>
          </div>
          <Button variant="outline" size="sm" className="gap-2 print:hidden" onClick={copyAnalise}>
            <Copy className="h-4 w-4" /> Copiar análise
          </Button>
        </div>
        <div className="space-y-4">
          <Suggestion title="Título sugerido do anúncio" text={study.tituloSugerido} />
          <Suggestion title="Descrição sugerida" text={study.descricaoSugerida} />
          <Suggestion title="Argumento para o proprietário" text={study.argumentoProprietario} />
        </div>
      </Card>

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
            <th style={{ width: "16%" }}>Similaridade</th>
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