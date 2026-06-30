import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RotateCcw, Search, Loader2, AlertTriangle, Building2 } from "lucide-react";
import type { StudyInput, SearchOverrides, StudyResult, FieldKey, FieldMode } from "@/lib/study-types";
import { FIELD_KEYS, FIELD_LABELS, DEFAULT_FIELD_MODES } from "@/lib/study-types";
import { descobrirBairrosVizinhos } from "@/lib/neighbors.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  study: StudyResult;
  input: StudyInput;
  onRerun: (overrides: SearchOverrides) => Promise<void> | void;
  loading?: boolean;
  warning?: string | null;
}

const TIPOS = ["Apartamento", "Casa", "Cobertura", "Sobrado", "Studio", "Kitnet", "Sala", "Terreno"];

/** Builds the form's starting state from the last execution's overrides, falling back to derived defaults. */
function initialFrom(input: StudyInput, study: StudyResult): Required<Omit<SearchOverrides, "bairrosProximos" | "fieldModes">> & {
  bairrosProximos: string[];
  fieldModes: Record<FieldKey, FieldMode>;
} {
  const o = study.overridesAplicados ?? {};
  return {
    keyword: o.keyword ?? `${input.tipo.toLowerCase()} ${input.bairro}`.trim(),
    cidade: o.cidade ?? input.cidade,
    estado: o.estado ?? input.estado,
    bairro: o.bairro ?? input.bairro,
    bairrosProximos: o.bairrosProximos ?? input.bairrosProximos,
    expandirBairrosProximos:
      o.expandirBairrosProximos ?? input.expandirBairrosProximos ?? (input.bairrosProximos.length > 0),
    tipo: o.tipo ?? input.tipo,
    finalidade: o.finalidade ?? input.finalidade,
    quartosMin: o.quartosMin ?? input.quartos,
    quartosMax: o.quartosMax ?? input.quartos,
    areaMin: o.areaMin ?? Math.round(input.areaUtil * 0.75),
    areaMax: o.areaMax ?? Math.round(input.areaUtil * 1.25),
    priceMin: o.priceMin ?? Math.round(input.valorPretendido * 0.7),
    priceMax: o.priceMax ?? Math.round(input.valorPretendido * 1.3),
    autoExpand: o.autoExpand ?? true,
    edificio: o.edificio ?? input.edificio ?? "",
    priorizarEdificio: o.priorizarEdificio ?? !!(input.edificio && input.edificio.trim()),
    maxPages: o.maxPages ?? 3,
    radiusKm: o.radiusKm ?? 2,
    filtrarAncoras: o.filtrarAncoras ?? true,
    top10Baratos: o.top10Baratos ?? true,
    fieldModes: { ...DEFAULT_FIELD_MODES, ...(o.fieldModes ?? {}) },
  };
}

export function CriteriosEditor({ study, input, onRerun, loading, warning }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => initialFrom(input, study));
  const [bairroInput, setBairroInput] = useState("");
  const [detectando, setDetectando] = useState(false);
  const detectFn = useServerFn(descobrirBairrosVizinhos);

  const reset = () => setForm(initialFrom(input, study));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addBairro = () => {
    const v = bairroInput.trim();
    if (!v || form.bairrosProximos.includes(v)) return;
    set("bairrosProximos", [...form.bairrosProximos, v]);
    setBairroInput("");
  };

  const removeBairro = (b: string) =>
    set("bairrosProximos", form.bairrosProximos.filter((x) => x !== b));

  const detectarVizinhos = async () => {
    if (!form.cidade || !form.bairro) {
      toast.error("Informe cidade e bairro antes de detectar vizinhos.");
      return;
    }
    setDetectando(true);
    try {
      const res = await detectFn({
        data: {
          cidade: form.cidade,
          bairro: form.bairro,
          estado: form.estado,
          radiusM: 3000,
          limit: 5,
        },
      });
      if (res.ok && res.vizinhos.length > 0) {
        const existentes = new Set(form.bairrosProximos.map((x) => x.toLowerCase()));
        const novos = res.vizinhos.filter((v) => !existentes.has(v.toLowerCase()));
        set("bairrosProximos", [...form.bairrosProximos, ...novos]);
        toast.success(`${novos.length} vizinho(s) adicionado(s).`);
      } else {
        toast.message("Nenhum bairro vizinho encontrado para este endereço.");
      }
    } catch (e) {
      toast.error("Falha ao detectar vizinhos.");
    } finally {
      setDetectando(false);
    }
  };

  const submit = async () => {
    await onRerun({
      keyword: form.keyword,
      cidade: form.cidade,
      estado: form.estado,
      bairro: form.bairro,
      bairrosProximos: form.bairrosProximos,
      expandirBairrosProximos: form.expandirBairrosProximos,
      tipo: form.tipo,
      finalidade: form.finalidade,
      quartosMin: Number(form.quartosMin),
      quartosMax: Number(form.quartosMax),
      areaMin: Number(form.areaMin),
      areaMax: Number(form.areaMax),
      priceMin: Number(form.priceMin),
      priceMax: Number(form.priceMax),
      autoExpand: form.autoExpand,
      edificio: form.edificio.trim() || undefined,
      priorizarEdificio: form.priorizarEdificio,
      maxPages: Number(form.maxPages),
      radiusKm: Number(form.radiusKm),
      filtrarAncoras: form.filtrarAncoras,
      top10Baratos: form.top10Baratos,
      fieldModes: form.fieldModes,
    });
  };

  return (
    <Card className="border-border/60 p-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Critérios da busca
            </div>
            {study.criteriosAplicados?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {study.criteriosAplicados.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[11px] font-normal">
                    {c}
                  </Badge>
                ))}
              </div>
            ) : null}
            {study.funilBusca?.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {study.funilBusca.map((f, i) => (
                  <span key={f.etapa} className="flex items-center gap-2">
                    <span>
                      <span className="font-semibold text-foreground">{f.total}</span> {f.etapa.toLowerCase()}
                    </span>
                    {i < (study.funilBusca?.length ?? 0) - 1 && <span className="opacity-50">→</span>}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {study.revisao ? (
              <Badge variant="outline" className="text-[10px]">Revisão {study.revisao}</Badge>
            ) : null}
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {open ? "Fechar" : "Ajustar critérios"}
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="mt-6 space-y-5 border-t border-border/60 pt-6">
          {warning ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>{warning}</span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Keyword (texto da busca)">
              <Input value={form.keyword} onChange={(e) => set("keyword", e.target.value)} />
            </Field>
            <Field label="Tipo de imóvel">
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Finalidade">
              <Select value={form.finalidade} onValueChange={(v) => set("finalidade", v as "Venda" | "Aluguel")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </Field>
              <Field label="Estado">
                <Input value={form.estado} maxLength={2} onChange={(e) => set("estado", e.target.value.toUpperCase())} />
              </Field>
            </div>
            <Field label="Bairro principal">
              <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </Field>
            <Field label="Bairros próximos">
              <div className="flex gap-2">
                <Input
                  value={bairroInput}
                  onChange={(e) => setBairroInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBairro(); } }}
                  placeholder="Adicionar bairro"
                />
                <Button type="button" variant="outline" size="sm" onClick={addBairro}>+</Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={detectarVizinhos}
                  disabled={detectando}
                  title="Detectar bairros vizinhos automaticamente (~3 km)"
                >
                  {detectando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Auto"}
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Use "Auto" para detectar vizinhos num raio de 3 km — ou deixe a lista vazia com a expansão ligada para detectarmos no próximo recálculo.
              </p>
              {form.bairrosProximos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.bairrosProximos.map((b) => (
                    <Badge key={b} variant="secondary" className="cursor-pointer text-[11px]" onClick={() => removeBairro(b)}>
                      {b} ×
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                <span className="text-[11px] text-muted-foreground">
                  Detectar vizinhos automaticamente no recálculo (quando a lista estiver vazia)
                </span>
                <Switch
                  checked={!!form.expandirBairrosProximos}
                  onCheckedChange={(v) => set("expandirBairrosProximos", v)}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <RangeField label="Quartos" min={form.quartosMin} max={form.quartosMax}
              onMin={(v) => set("quartosMin", v)} onMax={(v) => set("quartosMax", v)} />
            <RangeField label="Área útil (m²)" min={form.areaMin} max={form.areaMax}
              onMin={(v) => set("areaMin", v)} onMax={(v) => set("areaMax", v)} step={5} />
            <RangeField label="Preço (R$)" min={form.priceMin} max={form.priceMax}
              onMin={(v) => set("priceMin", v)} onMax={(v) => set("priceMax", v)} step={10000} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">Expandir critérios automaticamente</div>
              <div className="text-xs text-muted-foreground">Se a busca estrita retornar menos de 4 imóveis, amplia em camadas (quartos ±1, cidade inteira, faixa ±30%).</div>
            </div>
            <Switch checked={form.autoExpand} onCheckedChange={(v) => set("autoExpand", v)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">Páginas por busca</div>
              <div className="text-xs text-muted-foreground">Quantas páginas da GeckoAPI consultar por etapa (mais páginas = mais cobertura, mais créditos).</div>
            </div>
            <Select value={String(form.maxPages)} onValueChange={(v) => set("maxPages", Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div>
              <div className="text-sm font-medium">Raio de busca</div>
              <div className="text-xs text-muted-foreground">Distância máxima a partir do endereço geocodificado. Aplicado no upstream e também localmente nos imóveis com coordenadas.</div>
            </div>
            <Select value={String(form.radiusKm)} onValueChange={(v) => set("radiusKm", Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 km</SelectItem>
                <SelectItem value="2">2 km</SelectItem>
                <SelectItem value="3">3 km</SelectItem>
                <SelectItem value="5">5 km</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" /> Mesmo condomínio / edifício
            </div>
            <Field label="Nome do edifício ou condomínio">
              <Input
                value={form.edificio}
                onChange={(e) => set("edificio", e.target.value)}
                placeholder="Ex.: Edifício Solar das Palmeiras"
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Priorizar imóveis do mesmo prédio</div>
                <div className="text-xs text-muted-foreground">Quando ativo, busca primeiro pelo nome do edifício e só amplia se faltar comparável.</div>
              </div>
              <Switch
                checked={form.priorizarEdificio}
                onCheckedChange={(v) => set("priorizarEdificio", v)}
                disabled={!form.edificio.trim()}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-primary/20 pt-3">
              <div>
                <div className="text-sm font-medium">Aplicar critérios de quartos/área no mesmo prédio</div>
                <div className="text-xs text-muted-foreground">
                  Quando ativo, descarta unidades do prédio/endereço com tipologia diferente (ex.: 1 dorm/45 m² quando o imóvel base é 3 dorm/140 m²). Desligue para ver todas as unidades do condomínio.
                </div>
              </div>
              <Switch
                checked={form.filtrarAncoras}
                onCheckedChange={(v) => set("filtrarAncoras", v)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Campos extras (preferências)</div>
                <div className="text-xs text-muted-foreground">
                  Escolha como cada campo extra influencia a busca.
                  <span className="ml-1"><strong>Ignorar</strong>: só no relatório. <strong>Preferência</strong>: pesa na similaridade. <strong>Preferir</strong>: prioriza quem tem, mas inclui quem não tem. <strong>Obrigatório</strong>: elimina quem não bate.</span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set("fieldModes", { ...DEFAULT_FIELD_MODES })}
              >
                Padrão
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {FIELD_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
                  <span className="text-sm">{FIELD_LABELS[k]}</span>
                  <Select
                    value={form.fieldModes[k]}
                    onValueChange={(v) => set("fieldModes", { ...form.fieldModes, [k]: v as FieldMode })}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">Ignorar</SelectItem>
                      <SelectItem value="soft">Preferência</SelectItem>
                      <SelectItem value="prefer">Preferir</SelectItem>
                      <SelectItem value="hard">Obrigatório</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={loading} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Restaurar
            </Button>
            <Button size="sm" onClick={submit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Reexecutando..." : "Reexecutar busca"}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 text-xs">{label}</Label>
      {children}
    </div>
  );
}

function RangeField({
  label, min, max, onMin, onMax, step = 1,
}: { label: string; min: number; max: number; onMin: (v: number) => void; onMax: (v: number) => void; step?: number }) {
  return (
    <div>
      <Label className="mb-1.5 text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" value={min} step={step} onChange={(e) => onMin(Number(e.target.value))} />
        <span className="text-xs text-muted-foreground">a</span>
        <Input type="number" value={max} step={step} onChange={(e) => onMax(Number(e.target.value))} />
      </div>
    </div>
  );
}