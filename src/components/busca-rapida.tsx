import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Loader2, Check, Pencil, AlertTriangle } from "lucide-react";
import { parseQueryLocal, mergeWithDefaults } from "@/lib/query-parser";
import { parseQueryAi } from "@/lib/query-parser.functions";
import type { StudyInput } from "@/lib/study-types";

const EXEMPLOS = [
  "Apartamento 3 quartos 2 vagas Água Verde Curitiba até 700 mil com piscina",
  "Casa 4 suítes Santa Felicidade Curitiba até 1.5mi com piscina e churrasqueira",
  "Apto 2 quartos Batel aluguel mobiliado até 3500",
  "Cobertura 3 suítes Ecoville 200m² com vista livre",
  "Studio mobiliado Centro Curitiba aluguel até 2000",
];

interface Props {
  onEditar?: (input: StudyInput) => void;
}

export function BuscaRapida({ onEditar }: Props) {
  const navigate = useNavigate();
  const parseAi = useServerFn(parseQueryAi);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<StudyInput | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);

  const analisar = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAiUsed(false);
    try {
      const local = parseQueryLocal(text);
      let merged = local.partial;
      let miss = local.missing;

      // Fallback IA quando faltam campos essenciais
      if (local.confidence !== "high") {
        const aiRes = await parseAi({ data: { query: text } });
        if (aiRes.ok && aiRes.data) {
          setAiUsed(true);
          const ai = aiRes.data;
          merged = {
            ...merged,
            finalidade: ai.finalidade ?? merged.finalidade,
            tipo: ai.tipo ?? merged.tipo,
            cidade: ai.cidade ?? merged.cidade,
            estado: ai.estado ?? merged.estado,
            bairro: ai.bairro ?? merged.bairro,
            edificio: ai.edificio ?? merged.edificio,
            quartos: ai.quartos ?? merged.quartos,
            suites: ai.suites ?? merged.suites,
            banheiros: ai.banheiros ?? merged.banheiros,
            vagas: ai.vagas ?? merged.vagas,
            areaUtil: ai.areaUtil ?? merged.areaUtil,
            valorPretendido: ai.valorPretendido ?? merged.valorPretendido,
            diferenciais: ai.diferenciais && ai.diferenciais.length ? ai.diferenciais : merged.diferenciais,
          };
          miss = [];
          if (!merged.tipo) miss.push("tipo");
          if (!merged.cidade) miss.push("cidade");
          if (!merged.bairro) miss.push("bairro");
        }
      }

      const built = mergeWithDefaults(merged);
      // Busca livre: guarda a frase original como keyword pra usar quando faltar cidade/bairro
      built.keywordLivre = text.trim();
      setPreview(built);
      setMissing(miss);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmar = () => {
    if (!preview) return;
    sessionStorage.setItem("rip:pending", JSON.stringify(preview));
    navigate({ to: "/app/carregando" });
  };

  const editar = () => {
    if (!preview) return;
    if (onEditar) onEditar(preview);
    else {
      sessionStorage.setItem("rip:prefill", JSON.stringify(preview));
      navigate({ to: "/app/novo-estudo" });
    }
  };

  const updatePreview = <K extends keyof StudyInput>(k: K, v: StudyInput[K]) => {
    setPreview((p) => (p ? { ...p, [k]: v } : p));
    setMissing((m) => m.filter((f) => f !== String(k)));
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6 md:p-8 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Busca inteligente
      </div>
      <h2 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">
        Descreva o imóvel em uma frase
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tipo, bairro, cidade, quartos, faixa de preço, diferenciais — nós entendemos.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); analisar(query); }}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Apartamento 3 quartos Água Verde Curitiba até 700 mil"
            className="h-12 pl-10 text-base"
            autoFocus
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || query.trim().length < 3} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Analisando..." : "Analisar"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setQuery(ex); analisar(ex); }}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Entendi assim:</div>
            {aiUsed && <Badge variant="secondary" className="text-[10px]">IA</Badge>}
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Finalidade" value={preview.finalidade} />
            <Info label="Tipo" value={preview.tipo} />
            <Editable
              label="Cidade"
              value={preview.cidade}
              placeholder="ex: Curitiba"
              onChange={(v) => updatePreview("cidade", v)}
            />
            <Editable
              label="Bairro"
              value={preview.bairro}
              placeholder="ex: Água Verde"
              onChange={(v) => updatePreview("bairro", v)}
            />
            <Info label="Quartos" value={String(preview.quartos)} />
            <Info label="Área útil" value={`${preview.areaUtil} m²`} />
            <Info label="Valor pretendido" value={`R$ ${preview.valorPretendido.toLocaleString("pt-BR")}`} />
            {preview.edificio && <Info label="Edifício" value={preview.edificio} />}
          </div>
          {preview.diferenciais.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.diferenciais.map((d) => (
                <Badge key={d} variant="secondary" className="text-[11px] font-normal">{d}</Badge>
              ))}
            </div>
          )}

          {missing.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-2.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Busca livre — sem {missing.join(", ")} usaremos sua frase como palavra-chave. Edite acima para refinar.
              </span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={editar} className="gap-2">
              <Pencil className="h-4 w-4" /> Ajustar campos
            </Button>
            <Button size="sm" onClick={confirmar} className="gap-2">
              <Check className="h-4 w-4" /> Confirmar e analisar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Info({ label, value, miss }: { label: string; value: string; miss?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${miss ? "text-warning" : ""}`}>{value}</span>
    </div>
  );
}

function Editable({
  label, value, placeholder, onChange, required,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const empty = !value;
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-1 ${empty && required ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-muted/30"}`}>
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 flex-1 border-0 bg-transparent p-0 text-right text-sm font-medium shadow-none focus-visible:ring-0"
      />
    </div>
  );
}