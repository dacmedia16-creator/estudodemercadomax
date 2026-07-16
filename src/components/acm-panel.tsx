import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { computeAcm, formatBRL } from "@/lib/study-engine";
import { DEFAULT_ACM, type AcmAdjustments, type StudyResult } from "@/lib/study-types";
import { studyStore } from "@/lib/study-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REFORMA_PRESETS = [
  { label: "Sem reforma", value: 0 },
  { label: "Estética leve", value: 350 },
  { label: "Estética completa", value: 500 },
  { label: "Estrutural", value: 1500 },
];

export function AcmPanel({ study, onChange }: { study: StudyResult; onChange?: (s: StudyResult) => void }) {
  const [acm, setAcm] = useState<AcmAdjustments>({ ...DEFAULT_ACM, ...(study.acm ?? {}) });
  const computed = useMemo(() => computeAcm(study, acm), [study, acm]);

  // Resync quando o estudo muda (ex.: reexecução da busca cria novo objeto).
  useEffect(() => {
    setAcm({ ...DEFAULT_ACM, ...(study.acm ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [study.id, study.revisao]);

  const update = (patch: Partial<AcmAdjustments>) => {
    setAcm((cur) => {
      const next = { ...cur, ...patch };
      // Propaga em tempo real para o relatório/slide refletirem o ajuste
      // sem precisar clicar em "Salvar ajustes".
      onChange?.({ ...study, acm: next });
      return next;
    });
  };

  const persist = async () => {
    const next: StudyResult = { ...study, acm };
    try {
      await studyStore.save(next);
      onChange?.(next);
      toast.success("Ajustes ACM salvos");
    } catch (err) {
      toast.error(`Não foi possível salvar: ${(err as Error).message}`);
    }
  };

  const reset = () => {
    setAcm(DEFAULT_ACM);
    onChange?.({ ...study, acm: DEFAULT_ACM });
  };

  const diffPretendido =
    study.input.valorPretendido > 0
      ? (computed.valorSugerido - study.input.valorPretendido) / study.input.valorPretendido
      : 0;

  return (
    <Card className="border-border/60 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Avaliação ACM</div>
            <div className="text-sm text-muted-foreground">
              Ajustes percentuais sobre a média de R$/m² dos comparáveis
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-2" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Resetar
          </Button>
          <Button size="sm" className="gap-2" onClick={persist}>
            <Save className="h-3.5 w-3.5" /> Salvar ajustes
          </Button>
        </div>
      </div>

      {/* Estratégia + piso competitivo */}
      <div className="mb-5 grid gap-4 rounded-xl border border-border bg-muted/20 p-4 print:hidden md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estratégia de precificação
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { v: "agressivo", label: "Agressivo", hint: "P25 · vende rápido" },
              { v: "equilibrado", label: "Equilibrado", hint: "Mediana · default" },
              { v: "premium", label: "Premium", hint: "P75 · posicionamento" },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => update({ estrategia: opt.v as AcmAdjustments["estrategia"] })}
                className={cn(
                  "rounded-md border px-2 py-2 text-left text-[11px] leading-tight transition",
                  (acm.estrategia ?? "equilibrado") === opt.v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="opacity-70">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Respeitar piso de mercado
            </div>
            <button
              type="button"
              onClick={() => update({ respeitarPiso: !(acm.respeitarPiso ?? true) })}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition",
                (acm.respeitarPiso ?? true)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {(acm.respeitarPiso ?? true) ? "ATIVO" : "INATIVO"}
            </button>
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Máx. acima do piso</span>
            <span className="tabular-nums text-foreground">+{acm.maxAcimaPisoPct ?? 15}%</span>
          </div>
          <Slider
            min={0}
            max={25}
            step={1}
            value={[acm.maxAcimaPisoPct ?? 15]}
            onValueChange={([v]) => update({ maxAcimaPisoPct: v })}
            disabled={!(acm.respeitarPiso ?? true)}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Garante que o sugerido não fica muito longe do imóvel mais barato do mercado.
          </div>
        </div>
      </div>

      {/* Régua de percentis */}
      {study.stats && (
        <PercentilRuler
          stats={study.stats}
          sugeridoM2={computed.valorSugerido && study.input.areaUtil > 0 ? Math.round(computed.valorSugerido / study.input.areaUtil) : computed.valorM2Avaliado}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <div className="space-y-5">
          <FactorSlider label="Localização" value={acm.localizacao} onChange={(v) => update({ localizacao: v })} />
          <FactorSlider label="Estado de conservação" value={acm.conservacao} onChange={(v) => update({ conservacao: v })} />
          <FactorSlider label="Idade do imóvel" value={acm.idade} onChange={(v) => update({ idade: v })} />
          <FactorSlider label="Padrão de acabamento" value={acm.padrao} onChange={(v) => update({ padrao: v })} />

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Multiplicador combinado: <strong className="text-foreground">{(computed.multiplicador * 100).toFixed(1)}%</strong>{" "}
            · média dos 4 fatores (cada um pesa 1/4). 100% = neutro.
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Reforma / atualização (R$ por m²)</label>
              <span className="text-sm tabular-nums text-muted-foreground">{formatBRL(acm.reformaPorM2)}/m²</span>
            </div>
            <Input
              type="number"
              min={0}
              step={50}
              value={acm.reformaPorM2}
              onChange={(e) => update({ reformaPorM2: Math.max(0, Number(e.target.value) || 0) })}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REFORMA_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => update({ reformaPorM2: p.value })}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] transition",
                    acm.reformaPorM2 === p.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label} {p.value > 0 ? `· R$${p.value}` : ""}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Referência: estética R$ 200–500/m² · estrutural R$ 1.000–2.000/m²
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Margem de negociação</label>
              <span className="text-sm tabular-nums text-muted-foreground">±{acm.margemPublicacaoPct}%</span>
            </div>
            <Slider
              min={0}
              max={15}
              step={1}
              value={[acm.margemPublicacaoPct]}
              onValueChange={([v]) => update({ margemPublicacaoPct: v })}
            />
            <div className="mt-1 text-[11px] text-muted-foreground">
              Aplicada para cima (valor máximo de publicação) e para baixo (mínimo de fechamento).
            </div>
          </div>
        </div>
      </div>

      {/* Resumo - avaliação para venda */}
      <div className="mt-6 rounded-xl border border-border bg-muted/20 p-5 print:mt-0 print:border-primary/40 print:bg-transparent">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground print:text-primary">
          Avaliação ACM · Resumo para venda
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Média R$/m² (mercado)" value={formatBRL(study.precoM2Medio)} />
          <SummaryItem
            label="Valor avaliado do m²"
            value={formatBRL(computed.valorM2Avaliado)}
            hint={`× ${(computed.multiplicador * 100).toFixed(1)}%`}
          />
          <SummaryItem
            label="Desconto de reforma"
            value={computed.descontoReforma > 0 ? `- ${formatBRL(computed.descontoReforma)}` : "—"}
          />
          <SummaryItem
            label="Valor sugerido"
            value={formatBRL(computed.valorSugerido)}
            highlight
          hint={
            computed.pisoAplicado
              ? "limitado pelo teto acima do piso · também usado na Análise por IA"
              : computed.abaixoDoPiso
                ? `abaixo do piso (${formatBRL(computed.valorPiso)}) · também usado na Análise por IA`
                : "referência única — replicada nos cards da Análise por IA"
          }
          hintTone={computed.pisoAplicado || computed.abaixoDoPiso ? "warning" : undefined}
          />
          <SummaryItem
            label="Máximo de publicação"
            value={formatBRL(computed.valorMaximoPublicacao)}
            hint={`+${acm.margemPublicacaoPct}%`}
            highlight
          />
          <SummaryItem
            label="Valor pretendido pelo cliente"
            value={formatBRL(study.input.valorPretendido)}
          />
          <div className="rounded-lg border border-border/70 bg-background p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pretendido vs. sugerido
            </div>
            {study.input.valorPretendido > 0 ? (
              <Badge
                className={cn(
                  "mt-2 text-[11px]",
                  Math.abs(diffPretendido) <= 0.05
                    ? "bg-primary/10 text-primary"
                    : diffPretendido > 0
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning-foreground",
                )}
              >
                {diffPretendido > 0 ? "+" : ""}
                {(diffPretendido * 100).toFixed(1)}%
              </Badge>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">—</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FactorSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  const delta = value - 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-foreground">{value}%</span>
          <span
            className={cn(
              "text-[11px] tabular-nums",
              delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-success" : "text-warning-foreground",
            )}
          >
            ({delta > 0 ? "+" : ""}{delta})
          </span>
        </div>
      </div>
      <Slider min={80} max={120} step={1} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function SummaryItem({
  label, value, hint, highlight, hintTone,
}: { label: string; value: string; hint?: string; highlight?: boolean; hintTone?: "warning" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-base font-bold tabular-nums", highlight && "text-primary")}>{value}</div>
      {hint && (
        <div
          className={cn(
            "mt-0.5 text-[10px]",
            hintTone === "warning" ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/** Régua visual mostrando onde o sugerido cai dentro da distribuição. */
function PercentilRuler({
  stats,
  sugeridoM2,
}: {
  stats: NonNullable<StudyResult["stats"]>;
  sugeridoM2: number;
}) {
  const min = stats.minM2;
  const max = stats.maxM2;
  const range = Math.max(1, max - min);
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));
  const sugerido = pos(sugeridoM2);

  const marks: { v: number; label: string; tone: "muted" | "strong" }[] = [
    { v: stats.p10, label: "P10", tone: "muted" },
    { v: stats.p25, label: "P25", tone: "strong" },
    { v: stats.median, label: "Mediana", tone: "strong" },
    { v: stats.p75, label: "P75", tone: "strong" },
    { v: stats.p90, label: "P90", tone: "muted" },
  ];

  return (
    <div className="mb-5 rounded-xl border border-border bg-background p-4 print:hidden">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="font-semibold uppercase tracking-wider text-muted-foreground">
          Distribuição de R$/m² dos comparáveis
        </div>
        <div className="text-muted-foreground">
          {formatBRL(min)} → {formatBRL(max)}
        </div>
      </div>
      <div className="relative h-12">
        {/* Track com faixa P25-P75 destacada */}
        <div className="absolute left-0 right-0 top-5 h-2 rounded-full bg-muted" />
        <div
          className="absolute top-5 h-2 rounded-full bg-primary/30"
          style={{ left: `${pos(stats.p25)}%`, width: `${pos(stats.p75) - pos(stats.p25)}%` }}
        />
        {/* Marcas */}
        {marks.map((m) => (
          <div key={m.label} className="absolute top-4 -translate-x-1/2" style={{ left: `${pos(m.v)}%` }}>
            <div className={cn("h-4 w-px", m.tone === "strong" ? "bg-foreground/70" : "bg-muted-foreground/40")} />
            <div className={cn("mt-0.5 text-[9px] tabular-nums", m.tone === "strong" ? "text-foreground" : "text-muted-foreground")}>
              {m.label}
            </div>
          </div>
        ))}
        {/* Indicador do sugerido */}
        <div className="absolute top-0 -translate-x-1/2" style={{ left: `${sugerido}%` }}>
          <div className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
            Sugerido
          </div>
          <div className="mx-auto mt-0.5 h-7 w-0.5 bg-primary" />
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] tabular-nums text-muted-foreground">
        R$/m² sugerido: <span className="font-semibold text-foreground">{formatBRL(sugeridoM2)}</span>
      </div>
    </div>
  );
}