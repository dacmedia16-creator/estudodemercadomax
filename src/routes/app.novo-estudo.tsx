import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, MapPin, Home, Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateStudy } from "@/lib/study-engine";
import { studyStore } from "@/lib/study-store";
import type { StudyInput } from "@/lib/study-types";

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
  { nome: "Viva Real", ativo: false },
  { nome: "OLX", ativo: false },
  { nome: "Imovelweb", ativo: false },
  { nome: "Chaves na Mão", ativo: false },
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
  const [data, setData] = useState<Partial<StudyInput>>({
    finalidade: "Venda",
    tipo: "Apartamento",
    cidade: "Curitiba",
    estado: "PR",
    bairro: "Água Verde",
    bairrosProximos: ["Batel", "Portão", "Vila Izabel"],
    areaUtil: 110,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 2,
    condominio: 850,
    iptu: 220,
    valorPretendido: 780000,
    diferenciais: ["Piscina", "Churrasqueira", "Sacada"],
    portais: ["Zap Imóveis"],
  });

  const update = <K extends keyof StudyInput>(k: K, v: StudyInput[K]) => setData((d) => ({ ...d, [k]: v }));

  const toggleDif = (d: string) => {
    const cur = data.diferenciais ?? [];
    update("diferenciais", cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  };

  const togglePortal = (p: string) => {
    const cur = data.portais ?? [];
    update("portais", cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);
  };

  const handleSubmit = () => {
    const input = data as StudyInput;
    sessionStorage.setItem("rip:pending", JSON.stringify(input));
    navigate({ to: "/app/carregando" });
    // Generate after a delay handled in loading screen
    setTimeout(() => {
      const result = generateStudy(input);
      studyStore.save(result);
      sessionStorage.setItem("rip:lastId", result.id);
    }, 100);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Novo estudo</div>
      <h1 className="text-3xl font-bold tracking-tight">Vamos analisar seu imóvel</h1>
      <p className="mt-2 text-muted-foreground">Preencha em 4 etapas. Você pode revisar antes de gerar.</p>

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
            <Field label="Bairros próximos (separados por vírgula)">
              <Input
                value={(data.bairrosProximos ?? []).join(", ")}
                onChange={(e) => update("bairrosProximos", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            </Field>
            <Field label="Endereço aproximado (opcional)" className="md:col-span-2">
              <Input value={data.endereco ?? ""} onChange={(e) => update("endereco", e.target.value)} placeholder="Ex: Rua Brasílio Itiberê, 1500" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Área útil (m²)"><NumberInput v={data.areaUtil} onV={(v) => update("areaUtil", v)} /></Field>
            <Field label="Área total (m²)"><NumberInput v={data.areaTotal ?? 0} onV={(v) => update("areaTotal", v)} /></Field>
            <Field label="Ano de construção"><NumberInput v={data.anoConstrucao ?? 0} onV={(v) => update("anoConstrucao", v)} /></Field>
            <Field label="Quartos"><NumberInput v={data.quartos} onV={(v) => update("quartos", v)} /></Field>
            <Field label="Suítes"><NumberInput v={data.suites} onV={(v) => update("suites", v)} /></Field>
            <Field label="Banheiros"><NumberInput v={data.banheiros} onV={(v) => update("banheiros", v)} /></Field>
            <Field label="Vagas"><NumberInput v={data.vagas} onV={(v) => update("vagas", v)} /></Field>
            <Field label="Andar"><NumberInput v={data.andar ?? 0} onV={(v) => update("andar", v)} /></Field>
            <div />
            <Field label="Condomínio (R$)"><NumberInput v={data.condominio} onV={(v) => update("condominio", v)} /></Field>
            <Field label="IPTU (R$)"><NumberInput v={data.iptu} onV={(v) => update("iptu", v)} /></Field>
            <Field label="Valor pretendido (R$)"><NumberInput v={data.valorPretendido} onV={(v) => update("valorPretendido", v)} /></Field>
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
            <Label className="mb-3 block text-sm font-medium">Portais para busca</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {PORTAIS.map((p) => {
                const active = data.portais?.includes(p.nome);
                return (
                  <button
                    key={p.nome}
                    type="button"
                    disabled={!p.ativo}
                    onClick={() => togglePortal(p.nome)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40",
                      !p.ativo && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-semibold">{p.nome}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <span className={cn("text-xs", p.ativo ? "text-primary" : "text-muted-foreground")}>
                      {p.ativo ? "Disponível" : "Em breve"}
                    </span>
                  </button>
                );
              })}
            </div>
            <Card className="mt-6 border-warning/30 bg-warning/5 p-4 text-sm">
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

function NumberInput({ v, onV }: { v?: number; onV: (n: number) => void }) {
  return <Input type="number" value={v ?? ""} onChange={(e) => onV(Number(e.target.value))} />;
}