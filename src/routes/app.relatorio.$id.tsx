import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from "recharts";
import {
  Download, Share2, Save, Plus, Copy, ExternalLink,
  TrendingUp, TrendingDown, Minus, Home, MapPin, Bed, Car, Maximize2,
  CheckCircle2, AlertTriangle, Sparkles,
} from "lucide-react";
import { studyStore } from "@/lib/study-store";
import { formatBRL } from "@/lib/study-engine";
import type { StudyResult } from "@/lib/study-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/relatorio/$id")({
  component: ReportPage,
});

type SortKey = "menor-preco" | "maior-similaridade" | "maior-area" | "menor-precom2";

function ReportPage() {
  const { id } = Route.useParams();
  const [study, setStudy] = useState<StudyResult | null>(null);
  const [sort, setSort] = useState<SortKey>("maior-similaridade");

  useEffect(() => {
    setStudy(studyStore.get(id) ?? null);
  }, [id]);

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
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado!"); }}>
            <Share2 className="h-4 w-4" /> Compartilhar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { studyStore.save(study); toast.success("Estudo salvo!"); }}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
          <Link to="/app/novo-estudo"><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo estudo</Button></Link>
        </div>
      </div>

      {/* Block 1: resumo */}
      <Card className="border-border/60 p-6">
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

      {/* Block 5: graficos */}
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
      <Card className="mt-6 border-border/60 p-6">
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
                <TableHead className="text-right">Similar.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{c.portal}</Badge></TableCell>
                  <TableCell className="max-w-[260px] truncate font-medium">{c.titulo}</TableCell>
                  <TableCell className="text-muted-foreground">{c.bairro}</TableCell>
                  <TableCell className="text-right">{c.areaUtil}m²</TableCell>
                  <TableCell className="text-right">{c.quartos}</TableCell>
                  <TableCell className="text-right">{c.vagas}</TableCell>
                  <TableCell className="text-right font-semibold">{formatBRL(c.preco)}</TableCell>
                  <TableCell className="text-right">{formatBRL(c.precoM2)}</TableCell>
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

      {/* Block 6: concorrentes diretos */}
      <div className="mt-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concorrentes diretos</div>
        <div className="grid gap-4 md:grid-cols-3">
          {sorted.slice(0, 3).map((c) => (
            <Card key={c.id} className="overflow-hidden border-border/60">
              <div className="aspect-video w-full overflow-hidden bg-muted">
                <img src={c.imagem} alt={c.titulo} className="h-full w-full object-cover" />
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
      <Card className="mt-6 border-border/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Sugestão comercial</div>
            <div className="text-sm text-muted-foreground">Pronto para usar com o cliente</div>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={copyAnalise}>
            <Copy className="h-4 w-4" /> Copiar análise
          </Button>
        </div>
        <div className="space-y-4">
          <Suggestion title="Título sugerido do anúncio" text={study.tituloSugerido} />
          <Suggestion title="Descrição sugerida" text={study.descricaoSugerida} />
          <Suggestion title="Argumento para o proprietário" text={study.argumentoProprietario} />
        </div>
      </Card>
    </div>
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