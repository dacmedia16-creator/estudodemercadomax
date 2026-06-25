import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, FolderOpen, ArrowRight, Copy as CopyIcon, Trash2 } from "lucide-react";
import { studyStore } from "@/lib/study-store";
import { generateStudy, formatBRL } from "@/lib/study-engine";
import type { StudyResult } from "@/lib/study-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/estudos")({
  component: EstudosSalvos,
});

function EstudosSalvos() {
  const [list, setList] = useState<StudyResult[]>([]);
  useEffect(() => setList(studyStore.all()), []);
  const refresh = () => setList(studyStore.all());

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Histórico</div>
          <h1 className="text-3xl font-bold tracking-tight">Estudos salvos</h1>
          <p className="mt-1 text-muted-foreground">{list.length} estudo(s) no seu histórico</p>
        </div>
        <Link to="/app/novo-estudo"><Button className="gap-2"><FilePlus2 className="h-4 w-4" /> Novo estudo</Button></Link>
      </div>

      {list.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center justify-center border-dashed border-border/60 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Nenhum estudo ainda</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie seu primeiro estudo e ele aparecerá aqui, pronto para reabrir, duplicar ou exportar.
          </p>
          <Link to="/app/novo-estudo" className="mt-6"><Button className="gap-2">Criar estudo <ArrowRight className="h-4 w-4" /></Button></Link>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const statusColor =
              s.status === "Acima da média" ? "bg-warning/15 text-warning-foreground border-warning/30"
              : s.status === "Abaixo da média" ? "bg-success/15 text-success border-success/30"
              : "bg-primary/10 text-primary border-primary/30";
            return (
              <Card key={s.id} className="flex flex-col border-border/60 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{s.input.cidade} · {s.input.finalidade}</div>
                    <h3 className="mt-1 font-semibold leading-tight">{s.input.tipo} · {s.input.bairro}</h3>
                  </div>
                  <Badge className={`border ${statusColor} text-[10px]`}>{s.status}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Cell label="Valor analisado" value={formatBRL(s.input.valorPretendido)} />
                  <Cell label="Preço médio" value={formatBRL(s.precoMedio)} />
                  <Cell label="Comparáveis" value={String(s.comparaveis.length)} />
                  <Cell label="Data" value={new Date(s.createdAt).toLocaleDateString("pt-BR")} />
                </div>
                <div className="mt-5 flex gap-2 border-t border-border pt-4">
                  <Link to="/app/relatorio/$id" params={{ id: s.id }} className="flex-1">
                    <Button variant="default" size="sm" className="w-full gap-1">Abrir <ArrowRight className="h-3.5 w-3.5" /></Button>
                  </Link>
                  <Button variant="outline" size="icon" onClick={() => {
                    const dup = generateStudy(s.input);
                    studyStore.save(dup);
                    refresh();
                    toast.success("Estudo duplicado!");
                  }}><CopyIcon className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => { studyStore.remove(s.id); refresh(); toast.success("Removido"); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}