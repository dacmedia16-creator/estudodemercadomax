import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, DollarSign, Activity, FileBarChart2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { adminUsageStats } from "@/lib/admin.functions";
import { useNavigate } from "@tanstack/react-router";

const RATE_KEY = "radar:api-rate-brl";
const DEFAULT_RATE = 0.0127; // R$ por chamada — plano Developer (R$ 126,90 / 10.000)

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ApiCostPanel() {
  const navigate = useNavigate();
  const [month, setMonth] = useState<string>(currentMonth());
  const [rate, setRate] = useState<number>(() => {
    if (typeof localStorage === "undefined") return DEFAULT_RATE;
    const v = parseFloat(localStorage.getItem(RATE_KEY) ?? "");
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_RATE;
  });

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(RATE_KEY, String(rate));
  }, [rate]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-usage", month],
    queryFn: () => adminUsageStats({ data: { month } }),
  });

  const totalCalls = data?.totalCalls ?? 0;
  const uniqueStudies = data?.uniqueStudies ?? 0;
  const totalCost = totalCalls * rate;
  const avgPerStudy = uniqueStudies > 0 ? totalCost / uniqueStudies : 0;

  // Projeção linear simples para o mês corrente (não projeta meses passados).
  const projection = useMemo(() => {
    if (month !== currentMonth()) return null;
    const now = new Date();
    const day = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    if (day === 0) return null;
    const factor = daysInMonth / day;
    return { calls: Math.round(totalCalls * factor), cost: totalCost * factor };
  }, [month, totalCalls, totalCost]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custo da GeckoAPI</h2>
          <p className="text-sm text-muted-foreground">
            Visível apenas para administradores. Contabiliza cada chamada PLP/PDP feita pelo app.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="usage-month" className="text-xs">Mês</Label>
            <Input id="usage-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="usage-rate" className="text-xs">Taxa por chamada (R$)</Label>
            <Input
              id="usage-rate"
              type="number"
              step="0.0001"
              min="0"
              value={rate}
              onChange={(e) => setRate(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-9 w-[140px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9">
            {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={<Activity className="h-4 w-4" />} label="Chamadas no mês" value={totalCalls.toLocaleString("pt-BR")} hint={`${uniqueStudies} estudos`} />
            <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Custo no mês" value={brl(totalCost)} hint={`@ ${brl(rate)} / call`} />
            <KpiCard icon={<FileBarChart2 className="h-4 w-4" />} label="Custo médio por estudo" value={uniqueStudies > 0 ? brl(avgPerStudy) : "—"} hint={uniqueStudies > 0 ? `${(totalCalls / uniqueStudies).toFixed(1)} calls/estudo` : "sem dados"} />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Projeção do mês"
              value={projection ? brl(projection.cost) : "—"}
              hint={projection ? `${projection.calls.toLocaleString("pt-BR")} chamadas` : "mês fechado"}
            />
          </div>

          {/* Daily chart */}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Chamadas por dia</h3>
            {(data?.dailySeries ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem chamadas registradas neste mês.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.dailySeries.map((d) => ({ ...d, cost: d.calls * rate }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tickFormatter={(v: string) => v.slice(8)} fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      formatter={(value: any, name) => name === "calls" ? [`${value} chamadas`, "Chamadas"] : [brl(value as number), "Custo"]}
                      labelFormatter={(v) => `Dia ${v}`}
                    />
                    <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* By user */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Por usuário</h3>
            </div>
            <BreakdownTable
              rows={(data?.byUser ?? []).map((r) => ({ label: r.email, calls: r.calls }))}
              total={totalCalls}
              rate={rate}
              emptyText="Nenhum usuário fez chamadas neste mês."
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Por portal</h3>
              </div>
              <BreakdownTable
                rows={(data?.byPortal ?? []).map((r) => ({ label: portalLabel(r.portal), calls: r.calls }))}
                total={totalCalls}
                rate={rate}
                emptyText="Sem dados."
              />
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Por endpoint</h3>
              </div>
              <BreakdownTable
                rows={(data?.byEndpoint ?? []).map((r) => ({ label: r.endpoint.toUpperCase(), calls: r.calls }))}
                total={totalCalls}
                rate={rate}
                emptyText="Sem dados."
              />
            </Card>
          </div>

          {/* Top studies */}
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Top 10 estudos mais caros</h3>
            </div>
            {(data?.topStudies ?? []).length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Sem estudos identificados neste mês.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Localização</th>
                      <th className="px-4 py-2 text-right font-medium">Chamadas</th>
                      <th className="px-4 py-2 text-right font-medium">Custo</th>
                      <th className="px-4 py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data!.topStudies.map((s) => (
                      <tr key={s.studyId} className="hover:bg-muted/30">
                        <td className="px-4 py-2">{[s.bairro, s.cidade].filter(Boolean).join(" • ") || <span className="text-muted-foreground">{s.studyId.slice(0, 8)}…</span>}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{s.calls}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{brl(s.calls * rate)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate({ to: "/app/relatorio/$id", params: { id: s.studyId } })}>
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function BreakdownTable({ rows, total, rate, emptyText }: { rows: { label: string; calls: number }[]; total: number; rate: number; emptyText: string }) {
  if (rows.length === 0) return <p className="p-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Item</th>
            <th className="px-4 py-2 text-right font-medium">Chamadas</th>
            <th className="px-4 py-2 text-right font-medium">%</th>
            <th className="px-4 py-2 text-right font-medium">Custo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.label} className="hover:bg-muted/30">
              <td className="px-4 py-2">{r.label}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.calls}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                <Badge variant="outline" className="text-[10px]">{total > 0 ? ((r.calls / total) * 100).toFixed(1) : "0"}%</Badge>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{brl(r.calls * rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function portalLabel(p: string) {
  if (p === "zap") return "Zap Imóveis";
  if (p === "chaves") return "Chaves na Mão";
  if (p === "olx") return "OLX";
  return p;
}