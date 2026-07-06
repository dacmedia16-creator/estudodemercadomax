import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, MapPin, Home, Sparkles, Globe, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyInput } from "@/lib/study-types";
import type { FieldKey, FieldMode } from "@/lib/study-types";
import { DEFAULT_FIELD_MODES } from "@/lib/study-types";

export const Route = createFileRoute("/app/novo-estudo")({
  component: NovoEstudo,
});

const TIPOS = ["Apartamento", "Casa", "Terreno", "Comercial", "Cobertura", "Studio"];
const DIFERENCIAIS = [
  "Piscina", "Academia", "Churrasqueira", "Sacada", "Varanda gourmet",
  "Mobiliado", "Reformado", "Novo", "Aceita pet", "Portaria 24h",
  "Elevador", "Vista livre", "Próximo ao metrô", "Próximo a escolas", "Próximo a comércio",
];
const PORTAIS = [
  { nome: "Zap Imóveis", ativo: true },
  { nome: "Chaves na Mão", ativo: true },
  { nome: "Viva Real", ativo: false },
  { nome: "OLX", ativo: true },
  { nome: "Imovelweb", ativo: false },
];

const STEPS = [
  { n: 1, label: "Dados básicos", icon: MapPin },
  { n: 2, label: "Características", icon: Home },
  { n: 3, label: "Diferenciais", icon: Sparkles },
  { n: 4, label: "Portais", icon: Globe },
];

function NovoEstudo() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [cep, setCep] = useState("");
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "ok" | "notfound" | "error">("idle");
  const [radiusKm] = useState<number>(5);
  const [fieldModes] = useState<Record<FieldKey, FieldMode>>({ ...DEFAULT_FIELD_MODES });
  const [expandirBairros, setExpandirBairros] = useState(false);
  const [bairroInput, setBairroInput] = useState("");
  const [data, setData] = useState<Partial<StudyInput>>({
    finalidade: "Venda",
    tipo: "Apartamento",
    cidade: "Curitiba",
    estado: "PR",
    bairro: "Água Verde",
    bairrosProximos: [],
    areaUtil: 110,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 2,
    condominio: 850,
    iptu: 220,
    valorPretendido: 780000,
    diferenciais: ["Piscina", "Churrasqueira", "Sacada"],
    portais: PORTAIS.filter((p) => p.ativo).map((p) => p.nome),
  });

  // Seed Chaves na Mão a partir do flag global (default ligado).
  // Aceita "1"/"true" (on) e "0"/"false" (off) para compatibilidade.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem("portal.chavesnamao");
    const enabled = v === null ? true : v === "1" || v === "true";
    setData((d) => {
      const cur = d.portais ?? [];
      const has = cur.includes("Chaves na Mão");
      if (enabled && !has) return { ...d, portais: [...cur, "Chaves na Mão"] };
      if (!enabled && has) return { ...d, portais: cur.filter((x) => x !== "Chaves na Mão") };
      return d;
    });
  }, []);

  // Hidrata do prefill (vindo da busca rápida "Ajustar campos")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("rip:prefill");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<StudyInput>;
        setData((d) => ({ ...d, ...parsed }));
      } catch { /* ignore */ }
      sessionStorage.removeItem("rip:prefill");
    }
  }, []);

  const update = <K extends keyof StudyInput>(k: K, v: StudyInput[K]) => setData((d) => ({ ...d, [k]: v }));

  const toggleDif = (d: string) => {
    const cur = data.diferenciais ?? [];
    update("diferenciais", cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  };

  const togglePortal = (p: string) => {
    const cur = data.portais ?? [];
    const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
    update("portais", next);
    if (p === "Chaves na Mão" && typeof window !== "undefined") {
      localStorage.setItem("portal.chavesnamao", next.includes(p) ? "1" : "0");
    }
  };

  const addBairroProximo = () => {
    const v = bairroInput.trim();
    if (!v) return;
    const cur = data.bairrosProximos ?? [];
    if (cur.map((x) => x.toLowerCase()).includes(v.toLowerCase())) {
      setBairroInput("");
      return;
    }
    update("bairrosProximos", [...cur, v]);
    setBairroInput("");
  };

  const removeBairroProximo = (b: string) => {
    const cur = data.bairrosProximos ?? [];
    update("bairrosProximos", cur.filter((x) => x !== b));
  };

  const formatCep = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const lookupCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const json = await res.json();
      if (json?.erro) {
        setCepStatus("notfound");
        return;
      }
      setData((d) => ({
        ...d,
        bairro: json.bairro || d.bairro,
        cidade: json.localidade || d.cidade,
        estado: json.uf || d.estado,
        endereco: json.logradouro ? json.logradouro : d.endereco,
      }));
      setCepStatus("ok");
    } catch {
      setCepStatus("error");
    }
  };

  const handleSubmit = () => {
    const input: StudyInput = {
      finalidade: data.finalidade ?? "Venda",
      tipo: data.tipo ?? "Apartamento",
      cidade: data.cidade ?? "",
      estado: data.estado ?? "",
      bairro: data.bairro ?? "",
      bairrosProximos: expandirBairros ? data.bairrosProximos ?? [] : [],
      expandirBairrosProximos: expandirBairros,
      endereco: data.endereco,
      numero: data.numero,
      complemento: data.complemento,
      edificio: data.edificio,
      areaUtil: data.areaUtil ?? 0,
      areaTotal: data.areaTotal,
      quartos: data.quartos ?? 0,
      suites: data.suites ?? 0,
      banheiros: data.banheiros ?? 0,
      vagas: data.vagas ?? 0,
      andar: data.andar,
      condominio: data.condominio ?? 0,
      iptu: data.iptu ?? 0,
      valorPretendido: data.valorPretendido ?? 0,
      anoConstrucao: data.anoConstrucao,
      diferenciais: data.diferenciais ?? [],
      outrosDiferenciais: data.outrosDiferenciais,
      portais: data.portais ?? [],
    };
    sessionStorage.setItem("rip:pending", JSON.stringify(input));
    sessionStorage.setItem("rip:pending-radius", String(radiusKm));
    sessionStorage.setItem("rip:pending-fieldmodes", JSON.stringify(fieldModes));
    navigate({ to: "/app/carregando" });
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Novo estudo</div>
      <h1 className="text-3xl font-bold tracking-tight">Vamos analisar seu imóvel</h1>
      <p className="mt-2 text-muted-foreground">Preencha o formulário detalhado para gerar o estudo.</p>

      {/* Stepper */}
      <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => setStep(s.n)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                step === s.n
                  ? "border-primary bg-primary text-primary-foreground"
                  : step > s.n
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {step > s.n ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              <span className="whitespace-nowrap">{s.n}. {s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={cn("h-px flex-1", step > s.n ? "bg-primary/40" : "bg-border")} />}
          </div>
        ))}
      </div>

      <Card className="mt-6 border-border/60 p-6 md:p-8 shadow-[var(--shadow-card)]">
        {step === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="CEP (preenche bairro, cidade e estado)" className="md:col-span-2">
              <div className="relative">
                <Input
                  value={cep}
                  onChange={(e) => {
                    const f = formatCep(e.target.value);
                    setCep(f);
                    setCepStatus("idle");
                    if (f.replace(/\D/g, "").length === 8) lookupCep(f);
                  }}
                  onBlur={() => lookupCep(cep)}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  className="pr-10"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {cepStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   cepStatus === "ok" ? <Check className="h-4 w-4 text-primary" /> :
                   <Search className="h-4 w-4" />}
                </div>
              </div>
              {cepStatus === "notfound" && (
                <p className="text-xs text-warning">CEP não encontrado — preencha manualmente.</p>
              )}
              {cepStatus === "error" && (
                <p className="text-xs text-warning">Não foi possível consultar o CEP agora.</p>
              )}
            </Field>
            <Field label="Finalidade">
              <Select value={data.finalidade} onValueChange={(v) => update("finalidade", v as StudyInput["finalidade"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda">Venda</SelectItem>
                  <SelectItem value="Aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo do imóvel">
              <Select value={data.tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Cidade"><Input value={data.cidade} onChange={(e) => update("cidade", e.target.value)} /></Field>
            <Field label="Estado"><Input value={data.estado} onChange={(e) => update("estado", e.target.value)} maxLength={2} /></Field>
            <Field label="Bairro principal"><Input value={data.bairro} onChange={(e) => update("bairro", e.target.value)} /></Field>
            <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Buscar também em bairros próximos</div>
                  <div className="text-xs text-muted-foreground">
                    Útil quando o bairro é pequeno ou muito específico e a busca tende a zerar.
                    Deixe a lista vazia para detectarmos os bairros vizinhos automaticamente (até 5, num raio de 3&nbsp;km).
                    Cada bairro vira uma consulta extra (consome créditos).
                  </div>
                </div>
                <Switch checked={expandirBairros} onCheckedChange={setExpandirBairros} />
              </div>
              {expandirBairros && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={bairroInput}
                      onChange={(e) => setBairroInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addBairroProximo(); } }}
                      placeholder="Ex.: Batel, Bigorrilho — Enter para adicionar"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addBairroProximo}>Adicionar</Button>
                  </div>
                  {(data.bairrosProximos ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(data.bairrosProximos ?? []).map((b) => (
                        <Badge
                          key={b}
                          variant="secondary"
                          className="cursor-pointer text-[11px]"
                          onClick={() => removeBairroProximo(b)}
                        >
                          {b} ×
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Nenhum bairro adicionado ainda.</p>
                  )}
                </div>
              )}
            </div>
            <Field label="Endereço aproximado (opcional)" className="md:col-span-2">
              <Input value={data.endereco ?? ""} onChange={(e) => update("endereco", e.target.value)} placeholder="Ex: Rua Brasílio Itiberê, 1500" />
            </Field>
            <Field label="Número">
              <Input value={data.numero ?? ""} onChange={(e) => update("numero", e.target.value)} placeholder="Ex: 1500" />
            </Field>
            <Field label="Complemento (apto, bloco, sala)">
              <Input value={data.complemento ?? ""} onChange={(e) => update("complemento", e.target.value)} placeholder="Ex: Apto 502, Bloco B" />
            </Field>
            <Field label="Edifício / Condomínio (opcional)" className="md:col-span-2">
              <Input value={data.edificio ?? ""} onChange={(e) => update("edificio", e.target.value)} placeholder="Ex: Edifício Solar das Palmeiras" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Área útil (m²)"><NumberInput v={data.areaUtil} onV={(v) => update("areaUtil", v ?? 0)} /></Field>
            <Field label="Área total (m²)"><NumberInput v={data.areaTotal} onV={(v) => update("areaTotal", v)} /></Field>
            <Field label="Ano de construção"><NumberInput v={data.anoConstrucao} onV={(v) => update("anoConstrucao", v)} /></Field>
            <Field label="Quartos"><NumberInput v={data.quartos} onV={(v) => update("quartos", v ?? 0)} /></Field>
            <Field label="Suítes"><NumberInput v={data.suites} onV={(v) => update("suites", v ?? 0)} /></Field>
            <Field label="Banheiros"><NumberInput v={data.banheiros} onV={(v) => update("banheiros", v ?? 0)} /></Field>
            <Field label="Vagas"><NumberInput v={data.vagas} onV={(v) => update("vagas", v ?? 0)} /></Field>
            <Field label="Andar"><NumberInput v={data.andar} onV={(v) => update("andar", v)} /></Field>
            <div />
            <Field label="Condomínio (R$)"><NumberInput v={data.condominio} onV={(v) => update("condominio", v ?? 0)} /></Field>
            <Field label="IPTU (R$)"><NumberInput v={data.iptu} onV={(v) => update("iptu", v ?? 0)} /></Field>
            <Field label="Valor pretendido (R$)"><NumberInput v={data.valorPretendido} onV={(v) => update("valorPretendido", v ?? 0)} /></Field>
          </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <Label className="mb-3 block text-sm font-medium">Diferenciais do imóvel</Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {DIFERENCIAIS.map((d) => {
                const active = data.diferenciais?.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDif(d)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                      active
                        ? "border-primary bg-primary/10 font-medium text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Checkbox checked={active} className="pointer-events-none" />
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="mt-6">
              <Label className="mb-2 block text-sm font-medium">Outros diferenciais do imóvel</Label>
              <Textarea
                rows={3}
                value={data.outrosDiferenciais ?? ""}
                onChange={(e) => update("outrosDiferenciais", e.target.value)}
                placeholder="Ex: vista para o parque, hidromassagem, escritório integrado..."
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <Card className="border-warning/30 bg-warning/5 p-4 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Pronto para gerar?</span> Vamos buscar imóveis comparáveis e montar seu relatório completo em segundos.
              </p>
            </Card>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="gap-2">
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} size="lg" className="gap-2">
              Gerar estudo de mercado <Sparkles className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ v, onV }: { v?: number; onV: (n: number | undefined) => void }) {
  const isEditingRef = useRef(false);
  const [text, setText] = useState<string>(v === undefined || v === null ? "" : String(v));
  useEffect(() => {
    if (isEditingRef.current) return;
    setText(v === undefined || v === null ? "" : String(v));
  }, [v]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => { isEditingRef.current = true; }}
      onBlur={() => { isEditingRef.current = false; }}
      onChange={(e) => {
        isEditingRef.current = true;
        const raw = e.target.value;
        // aceita dígitos, vírgula, ponto e sinal
        if (raw !== "" && !/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === "-" || raw === "." || raw === ",") {
          onV(undefined);
          return;
        }
        const n = Number(raw.replace(",", "."));
        if (Number.isFinite(n)) onV(n);
      }}
    />
  );
}