import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, RotateCcw, Save } from "lucide-react";
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

  const update = (patch: Partial<AcmAdjustments>) => setAcm((cur) => ({ ...cur, ...patch }));

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

  const reset = () => setAcm(DEFAULT_ACM);

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

      <div className="grid gap-6 lg:grid-cols-2 print:hidden">
        <div className="space-y-5">
          <FactorSlider label="Localização" value={acm.localizacao} onChange={(v) => update({ localizacao: v })} />
          <FactorSlider label="Estado de conservação" value={acm.conservacao} onChange={(v) => update({ conservacao: v })} />
          <FactorSlider label="Idade do imóvel" value={acm.idade} onChange={(v) => update({ idade: v })} />
          <FactorSlider label="Padrão de acabamento" value={acm.padrao} onChange={(v) => update({ padrao: v })} />

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Multiplicador combinado: <strong className="text-foreground">{(computed.multiplicador * 100).toFixed(1)}%</strong>{" "}
            · cada fator parte de 100% (neutro). Acima valoriza, abaixo desvaloriza.
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
          />
          <SummaryItem
            label="Mínimo de fechamento"
            value={formatBRL(computed.valorMinimoFechamento)}
            hint={`-${acm.margemPublicacaoPct}%`}
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
  label, value, hint, highlight,
}: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-base font-bold tabular-nums", highlight && "text-primary")}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}