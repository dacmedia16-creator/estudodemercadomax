import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ArrowRight, FilePlus2 } from "lucide-react";
import { studyStore } from "@/lib/study-store";
import { formatBRL } from "@/lib/study-engine";
import type { StudyResult } from "@/lib/study-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/comparativos")({
  component: ComparativosPage,
});

const MAX_SEL = 4;

function ComparativosPage() {
  const [list, setList] = useState<StudyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try { setList(await studyStore.all()); }
      catch (err) { toast.error(`Não foi possível carregar os estudos: ${(err as Error).message}`); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SEL) {
        toast.info(`Selecione no máximo ${MAX_SEL} estudos.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const chosen = useMemo(
    () => selected.map((id) => list.find((s) => s.id === id)).filter(Boolean) as StudyResult[],
    [selected, list],
  );

  const chartData = useMemo(
    () => chosen.map((s) => ({
      name: `${s.input.bairro.slice(0, 14)}${s.input.bairro.length > 14 ? "…" : ""}`,
      "R$/m² médio": s.precoM2Medio,
      "Preço médio": s.precoMedio,
    })),
    [chosen],
  );

  const minM2 = chosen.length ? Math.min(...chosen.map((s) => s.precoM2Medio || Infinity)) : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Análise cruzada</div>
          <h1 className="text-3xl font-bold tracking-tight">Comparativos</h1>
          <p className="mt-1 text-muted-foreground">Selecione de 2 a {MAX_SEL} estudos para comparar lado a lado.</p>
        </div>
        <Link to="/app/novo-estudo"><Button variant="outline" className="gap-2"><FilePlus2 className="h-4 w-4" /> Novo estudo</Button></Link>
      </div>

      {loading ? (
        <div className="mt-8 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.length < 2 ? (
        <Card className="mt-8 flex flex-col items-center border-dashed border-border/60 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Crie pelo menos 2 estudos</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Para cruzar resultados você precisa ter ao menos dois estudos salvos. Crie um novo estudo e volte aqui.
          </p>
          <Link to="/app/novo-estudo" className="mt-6"><Button className="gap-2">Criar estudo <ArrowRight className="h-4 w-4" /></Button></Link>
        </Card>
      ) : (
        <>
          <Card className="mt-6 border-border/60 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-medium">Selecione os estudos ({selected.length}/{MAX_SEL})</div>
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Limpar seleção</Button>
              )}
            </div>
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Estudo</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((s) => {
                    const checked = selected.includes(s.id);
                    const disabled = !checked && selected.length >= MAX_SEL;
                    return (
                      <TableRow key={s.id} className={checked ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(s.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{s.input.tipo} · {s.input.bairro}</TableCell>
                        <TableCell className="text-muted-foreground">{s.input.cidade}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatBRL(s.precoMedio)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {chosen.length < 2 ? (
            <Card className="mt-6 border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              Selecione ao menos 2 estudos acima para ver a comparação.
            </Card>
          ) : (
            <>
              <Card className="mt-6 border-border/60 p-6">
                <h2 className="text-lg font-semibold">Comparação lado a lado</h2>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        {chosen.map((s) => (
                          <TableHead key={s.id} className="text-right">{s.input.bairro}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <Row label="Cidade" values={chosen.map((s) => s.input.cidade)} />
                      <Row label="Tipo" values={chosen.map((s) => s.input.tipo)} />
                      <Row label="Área (m²)" values={chosen.map((s) => `${s.input.areaUtil}`)} />
                      <Row label="Quartos" values={chosen.map((s) => `${s.input.quartos}`)} />
                      <Row label="Valor pretendido" values={chosen.map((s) => formatBRL(s.input.valorPretendido))} />
                      <Row label="Preço médio" values={chosen.map((s) => formatBRL(s.precoMedio))} highlight />
                      <Row
                        label="R$/m² médio"
                        values={chosen.map((s) =>
                          s.precoM2Medio === minM2 && s.precoM2Medio > 0
                            ? `${formatBRL(s.precoM2Medio)} 🟢`
                            : formatBRL(s.precoM2Medio),
                        )}
                      />
                      <Row label="Faixa sugerida" values={chosen.map((s) => `${formatBRL(s.faixaMin)} – ${formatBRL(s.faixaMax)}`)} />
                      <Row label="Menor preço" values={chosen.map((s) => formatBRL(s.menorPreco))} />
                      <Row label="Maior preço" values={chosen.map((s) => formatBRL(s.maiorPreco))} />
                      <Row label="Status" values={chosen.map((s) => s.status)} />
                      <Row label="Nº de comparáveis" values={chosen.map((s) => `${s.comparaveis.length}`)} />
                      <TableRow>
                        <TableCell className="font-medium">Ação</TableCell>
                        {chosen.map((s) => (
                          <TableCell key={s.id} className="text-right">
                            <Link to="/app/relatorio/$id" params={{ id: s.id }}>
                              <Button size="sm" variant="outline" className="gap-1">
                                Abrir <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="mt-6 border-border/60 p-6">
                <h2 className="text-lg font-semibold">Gráfico comparativo</h2>
                <p className="text-sm text-muted-foreground">R$/m² médio e Preço médio por estudo.</p>
                <div className="mt-4 h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="R$/m² médio" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="right" dataKey="Preço médio" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, values, highlight }: { label: string; values: string[]; highlight?: boolean }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={`text-right ${highlight ? "font-semibold text-primary" : ""}`}>{v}</TableCell>
      ))}
    </TableRow>
  );
}