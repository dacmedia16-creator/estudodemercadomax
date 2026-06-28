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
import { formatBRL, computeAcm } from "@/lib/study-engine";
import type { StudyResult, SearchOverrides, ComparableProperty } from "@/lib/study-types";
import { DEFAULT_ACM } from "@/lib/study-types";
import { runStudy } from "@/lib/study-runner";
import { CriteriosEditor } from "@/components/criterios-editor";
import { AcmPanel } from "@/components/acm-panel";
import { PrintSlides } from "@/components/print-slides";
import { ComparaveisManager } from "@/components/comparaveis-manager";
import { AiAnalysisCard } from "@/components/ai-analysis-card";
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
            <Card key={c.id} className="overflow-hidden border-border/60">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                {c.imagem ? (
                  <img
                    src={c.imagem}
                    alt={c.titulo}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
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
  const top = sorted.slice(0, 6);
  const fortes = study.pontosFortes.slice(0, 4);
  const atencao = study.pontosAtencao.slice(0, 4);
  return (
    <section className="print-onepager hidden print:block">
      <div className="op-header">
        <div>
          <div className="op-title">{input.tipo} em {input.bairro}, {input.cidade}/{input.estado}</div>
          <div className="op-sub">
            {input.areaUtil} m² · {input.quartos} dorm{input.suites > 0 ? ` (${input.suites} suíte${input.suites > 1 ? "s" : ""})` : ""} · {input.vagas} vaga{input.vagas !== 1 ? "s" : ""} · {input.finalidade}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9pt", fontWeight: 700, color: "var(--primary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Radar Imobiliário Pro</div>
          <div style={{ fontSize: "7.5pt", color: "#666" }}>
            {new Date(study.createdAt).toLocaleDateString("pt-BR")}
            {typeof study.revisao === "number" && study.revisao > 0 ? ` · rev. ${study.revisao}` : ""}
          </div>
        </div>
      </div>

      {/* HERO: valor recomendado em destaque + mín/máx */}
      <div className="op-hero">
        <div className="op-hero-main">
          <div className="lbl">Valor recomendado para venda</div>
          <div className="op-hero-value">{formatBRL(acm.valorSugerido)}</div>
          <div className="op-hero-meta">
            {study.comparaveis.length} comparáveis · média {formatBRL(study.precoM2Medio)}/m² · status: <b>{study.status}</b>
          </div>
        </div>
        <div className="op-hero-side">
          <div className="op-pill" style={{ borderColor: "var(--primary)" }}>
            <div className="lbl">Mínimo de fechamento</div>
            <div className="val">{formatBRL(acm.valorMinimoFechamento)}</div>
          </div>
          <div className="op-pill" style={{ borderColor: "var(--primary)" }}>
            <div className="lbl">Máximo de publicação</div>
            <div className="val" style={{ color: "var(--primary)" }}>{formatBRL(acm.valorMaximoPublicacao)}</div>
          </div>
        </div>
      </div>

      {/* Resumo ACM */}
      <div className="op-section-title">Resumo ACM</div>
      <div className="op-row3">
        <div className="op-cell">
          <b>Imóvel</b><br />
          Valor pretendido: {formatBRL(input.valorPretendido)}<br />
          R$/m² pretendido: {formatBRL(study.precoM2Pretendido)}<br />
          Cond.: {formatBRL(input.condominio)}
        </div>
        <div className="op-cell">
          <b>Mercado</b><br />
          Médio: {formatBRL(study.precoMedio)}<br />
          Faixa: {formatBRL(study.faixaMin)} – {formatBRL(study.faixaMax)}<br />
          Min/Max: {formatBRL(study.menorPreco)} / {formatBRL(study.maiorPreco)}
        </div>
        <div className="op-cell">
          <b>Diagnóstico</b><br />
          <span style={{ fontSize: "7.5pt", lineHeight: 1.3 }}>{study.diagnostico}</span>
        </div>
      </div>

      {/* Comparáveis */}
      <div className="op-section-title">Top comparáveis</div>
      <table>
        <thead>
          <tr>
            <th>Portal</th>
            <th>Endereço / título</th>
            <th className="num">m²</th>
            <th className="num">Qtos</th>
            <th className="num">Preço</th>
            <th className="num">R$/m²</th>
            <th className="num">Sim.</th>
          </tr>
        </thead>
        <tbody>
          {top.map((c) => (
            <tr key={c.id}>
              <td>{c.portal}</td>
              <td style={{ maxWidth: "180pt" }}>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.titulo}</div>
                <div style={{ fontSize: "7pt", color: "#666" }}>{c.bairro}</div>
              </td>
              <td className="num">{c.areaUtil > 0 ? c.areaUtil : "—"}</td>
              <td className="num">{c.quartos > 0 ? c.quartos : "—"}</td>
              <td className="num"><b>{formatBRL(c.preco)}</b></td>
              <td className="num">{c.precoM2 > 0 ? formatBRL(c.precoM2) : "—"}</td>
              <td className="num">{c.similaridade}%</td>
            </tr>
          ))}
          {top.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", color: "#888" }}>Nenhum comparável encontrado.</td></tr>
          )}
        </tbody>
      </table>

      {/* Pontos fortes / atenção */}
      <div className="op-row2" style={{ marginTop: "6pt" }}>
        <div className="op-cell">
          <b style={{ color: "var(--success, #15803d)" }}>Pontos fortes</b>
          <ul>{fortes.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div className="op-cell">
          <b style={{ color: "#b45309" }}>Pontos de atenção</b>
          <ul>{atencao.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>

      {/* Sugestão comercial – uma linha */}
      <div className="op-section-title">Sugestão comercial</div>
      <div className="op-cell" style={{ fontSize: "8pt" }}>
        <b>Título:</b> {study.tituloSugerido}<br />
        <b>Argumento:</b> {study.argumentoProprietario}
      </div>

      <div className="op-footer">
        <span>Radar Imobiliário Pro · estudo {study.id.slice(0, 8)}</span>
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