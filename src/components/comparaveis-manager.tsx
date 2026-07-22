import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RotateCcw, Trash2, Link as LinkIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { StudyResult, ComparableProperty } from "@/lib/study-types";
import { recomputeStudy, computeSimilarity, formatBRL } from "@/lib/study-engine";
import { fetchPropertyByUrl } from "@/lib/study-runner";
import { studyStore } from "@/lib/study-store";

interface Props {
  study: StudyResult;
  onChange: (next: StudyResult) => void;
  originals: ComparableProperty[];
}

export function ComparaveisManager({ study, onChange, originals }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRemove = (index: number) => {
    const next = study.comparaveis.filter((_, i) => i !== index);
    const recalculado = recomputeStudy(study, next);
    onChange(recalculado);
    void persist(recalculado, "Imóvel removido. Recalculado e salvo.");
  };

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (study.comparaveis.some((c) => c.url && c.url === trimmed)) {
      toast.error("Este imóvel já está no estudo.");
      return;
    }
    setLoading(true);
    try {
      const p = await fetchPropertyByUrl(trimmed);
      // Se o id colidir com algum já presente, sufixa para manter unicidade.
      let uniqueId = p.id;
      if (study.comparaveis.some((c) => c.id === uniqueId)) {
        let n = 2;
        while (study.comparaveis.some((c) => c.id === `${p.id}#${n}`)) n++;
        uniqueId = `${p.id}#${n}`;
      }
      const comp: ComparableProperty = {
        ...p,
        id: uniqueId,
        precoM2: p.areaUtil > 0 ? Math.round(p.preco / p.areaUtil) : 0,
        similaridade: computeSimilarity(study.input, p, study.overridesAplicados?.fieldModes),
        origem: "manual",
      };
      const next = [comp, ...study.comparaveis];
      const recalculado = recomputeStudy(study, next);
      onChange(recalculado);
      setUrl("");
      void persist(recalculado, `Imóvel adicionado · ${formatBRL(p.preco)} · salvo.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    const recalculado = recomputeStudy(study, originals);
    onChange(recalculado);
    void persist(recalculado, "Lista original restaurada e salva.");
  };

  const persist = async (next: StudyResult, successMsg: string) => {
    try {
      await studyStore.save(next);
      toast.success(successMsg);
    } catch (err) {
      toast.error(`Recalculado, mas não foi possível salvar: ${(err as Error).message}`);
    }
  };

  const manuais = study.comparaveis.filter((c) => c.origem === "manual").length;
  const removidos = originals.filter((o) => !study.comparaveis.some((c) => c.id === o.id)).length;
  const alterado = manuais > 0 || removidos > 0;

  return (
    <Card className="border-border/60 p-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ajustar comparáveis
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Remova imóveis que não fazem sentido ou cole o link de um anúncio (Zap, Chaves na Mão, OLX) para incluir manualmente. O estudo recalcula automaticamente.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Badge variant="secondary">{study.comparaveis.length} no estudo</Badge>
            {manuais > 0 && <Badge className="bg-primary text-primary-foreground">+{manuais} manual</Badge>}
            {removidos > 0 && <Badge variant="outline" className="border-destructive/40 text-destructive">−{removidos} removido(s)</Badge>}
          </div>
        </div>
        {alterado && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleRestore}>
            <RotateCcw className="h-4 w-4" /> Restaurar originais
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-stretch gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            placeholder="https://www.zapimoveis.com.br/imovel/..."
            disabled={loading}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAdd} disabled={loading || !url.trim()} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {loading ? "Buscando..." : "Adicionar imóvel"}
        </Button>
      </div>

      {study.comparaveis.length > 0 && (
        <div className="mt-5 max-h-72 overflow-y-auto rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {study.comparaveis.map((c, index) => (
              <li key={`${c.id}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Badge variant="secondary" className="shrink-0 text-[10px]">{c.portal}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{c.titulo}</span>
                    {c.origem === "manual" && (
                      <Badge className="shrink-0 bg-primary text-primary-foreground text-[9px]">Manual</Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.bairro} · {c.areaUtil}m² · {c.quartos} qtos · <span className="font-semibold text-foreground">{formatBRL(c.preco)}</span>
                  </div>
                </div>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-primary" title="Abrir anúncio">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(index)}
                  title="Remover do estudo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}