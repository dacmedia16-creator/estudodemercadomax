import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  FilePlus2, FolderOpen, BarChart3, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { studyStore } from "@/lib/study-store";
import { formatBRL } from "@/lib/study-engine";
import type { StudyResult } from "@/lib/study-types";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

const CHART_COLOR = "oklch(0.58 0.16 152)";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(6, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-40 shrink-0 truncate text-foreground">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{count}</div>
    </div>
  );
}

function statusBadgeClass(status: StudyResult["status"]) {
  switch (status) {
    case "Abaixo da média":
      return "bg-success/15 text-success border-success/30";
    case "Acima da média":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function DashboardPage() {
  const [studies, setStudies] = useState<StudyResult[] | null>(null);

  useEffect(() => {
    let alive = true;
    studyStore
      .all()
      .then((data) => { if (alive) setStudies(data); })
      .catch((e: unknown) => {
        console.error(e);
        toast.error("Erro ao carregar estudos");
        if (alive) setStudies([]);
      });
    return () => { alive = false; };
  }, []);

  const stats = useMemo(() => {
    const list = studies ?? [];
    const now = Date.now();
    const THIRTY = 30 * 24 * 60 * 60 * 1000;
    const bairros = new Set<string>();
    const cidades = new Set<string>();
    let recent = 0;
    for (const s of list) {
      const b = (s.input.bairro || "").trim();
      const c = (s.input.cidade || "").trim();
      if (b) bairros.add(b.toLowerCase());
      if (c) cidades.add(c.toLowerCase());
      if (now - new Date(s.createdAt).getTime() <= THIRTY) recent++;
    }
    return { total: list.length, recent, bairros: bairros.size, cidades: cidades.size };
  }, [studies]);

  const monthly = useMemo(() => {
    const list = studies ?? [];
    const buckets: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      buckets.push({ key, label, count: 0 });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const s of list) {
      const d = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = map.get(key);
      if (b) b.count++;
    }
    return buckets;
  }, [studies]);

  const topBairros = useMemo(() => {
    const list = studies ?? [];
    const counts = new Map<string, { label: string; count: number }>();
    for (const s of list) {
      const bairro = (s.input.bairro || "—").trim() || "—";
      const cidade = (s.input.cidade || "").trim();
      const label = cidade ? `${bairro} (${cidade})` : bairro;
      const key = label.toLowerCase();
      const cur = counts.get(key) ?? { label, count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [studies]);

  const latest = useMemo(() => {
    const list = studies ?? [];
    return [...list]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [studies]);

  const maxBairro = topBairros[0]?.count ?? 0;
  const loading = studies === null;
  const empty = !loading && studies!.length === 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      {/* A. Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Início</h1>
          <p className="text-sm text-muted-foreground">Resumo dos seus estudos de mercado</p>
        </div>
        <Link to="/app/novo-estudo">
          <Button size="sm" className="gap-2">
            <FilePlus2 className="h-4 w-4" /> Novo estudo
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : empty ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <FilePlus2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Nenhum estudo ainda</h2>
              <p className="text-sm text-muted-foreground">Crie seu primeiro estudo de mercado para começar.</p>
            </div>
            <Link to="/app/novo-estudo">
              <Button className="gap-2 mt-2">
                <FilePlus2 className="h-4 w-4" /> Criar primeiro estudo
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* B. Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total de estudos" value={stats.total} />
            <StatCard label="Últimos 30 dias" value={stats.recent} />
            <StatCard label="Bairros analisados" value={stats.bairros} />
            <StatCard label="Cidades atendidas" value={stats.cidades} />
          </div>

          {/* C. Grid 2 col */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estudos ao longo do tempo</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                        contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                      />
                      <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estudos por bairro</CardTitle>
              </CardHeader>
              <CardContent>
                {topBairros.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
                ) : (
                  <div className="space-y-3">
                    {topBairros.map((b) => (
                      <BarRow key={b.label} label={b.label} count={b.count} max={maxBairro} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* D. Latest studies */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimos estudos</CardTitle>
              <Link to="/app/estudos" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {latest.map((s) => (
                  <li key={s.id}>
                    <Link
                      to="/app/relatorio/$id"
                      params={{ id: s.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {s.input.tipo} · {s.input.bairro || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatShortDate(s.createdAt)}</div>
                      </div>
                      <div className="hidden sm:block text-sm tabular-nums">
                        {formatBRL(s.input.valorPretendido)}
                      </div>
                      <Badge variant="outline" className={statusBadgeClass(s.status)}>
                        {s.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* E. Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ShortcutCard to="/app/novo-estudo" icon={<FilePlus2 className="h-5 w-5" />} title="Novo estudo" description="Iniciar um novo estudo de mercado" />
            <ShortcutCard to="/app/estudos" icon={<FolderOpen className="h-5 w-5" />} title="Estudos salvos" description="Ver todos os estudos existentes" />
            <ShortcutCard to="/app/comparativos" icon={<BarChart3 className="h-5 w-5" />} title="Comparativos" description="Comparar imóveis lado a lado" />
          </div>
        </>
      )}
    </div>
  );
}

function ShortcutCard({
  to, icon, title, description,
}: { to: "/app/novo-estudo" | "/app/estudos" | "/app/comparativos"; icon: React.ReactNode; title: string; description: string }) {
  return (
    <Link to={to} className="block">
      <Card className="h-full hover:border-primary/40 transition">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-full bg-primary/10 p-2.5 text-primary">{icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}