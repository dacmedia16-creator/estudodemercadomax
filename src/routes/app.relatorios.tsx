import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Download, FilePlus2, FileText, Link as LinkIcon, Presentation, Search } from "lucide-react";
import { studyStore } from "@/lib/study-store";
import { formatBRL } from "@/lib/study-engine";
import type { StudyResult } from "@/lib/study-types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/relatorios")({
  component: RelatoriosPage,
});

type StatusFilter = "todos" | "Acima da média" | "Dentro da média" | "Abaixo da média";

function RelatoriosPage() {
  const [list, setList] = useState<StudyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try { setList(await studyStore.all()); }
      catch (err) { toast.error(`Não foi possível carregar os estudos: ${(err as Error).message}`); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((s) => {
      if (status !== "todos" && s.status !== status) return false;
      if (!needle) return true;
      return (
        s.input.bairro.toLowerCase().includes(needle) ||
        s.input.cidade.toLowerCase().includes(needle) ||
        s.input.tipo.toLowerCase().includes(needle)
      );
    });
  }, [list, q, status]);

  const exportar = (id: string, modo: "onepager" | "slides") => {
    navigate({ to: "/app/relatorio/$id", params: { id }, search: { auto: modo } as never });
  };

  const copiarLink = (id: string) => {
    const url = `${window.location.origin}/app/relatorio/${id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Central</div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-muted-foreground">Abra, exporte e compartilhe seus estudos.</p>
        </div>
        <Link to="/app/novo-estudo"><Button className="gap-2"><FilePlus2 className="h-4 w-4" /> Novo estudo</Button></Link>
      </div>

      <Card className="mt-6 border-border/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por bairro, cidade ou tipo" className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="Dentro da média">Dentro da média</SelectItem>
              <SelectItem value="Acima da média">Acima da média</SelectItem>
              <SelectItem value="Abaixo da média">Abaixo da média</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">{filtered.length} de {list.length}</div>
        </div>
      </Card>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.length === 0 ? (
        <Card className="mt-6 flex flex-col items-center border-dashed border-border/60 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Nenhum relatório ainda</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Gere seu primeiro estudo para vê-lo aqui com atalhos de exportação.
          </p>
          <Link to="/app/novo-estudo" className="mt-6"><Button className="gap-2">Criar estudo <ArrowRight className="h-4 w-4" /></Button></Link>
        </Card>
      ) : (
        <Card className="mt-6 border-border/60 p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preço médio</TableHead>
                  <TableHead className="text-right">Comparáveis</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const statusColor =
                    s.status === "Acima da média" ? "bg-warning/15 text-warning-foreground border-warning/30"
                    : s.status === "Abaixo da média" ? "bg-success/15 text-success border-success/30"
                    : "bg-primary/10 text-primary border-primary/30";
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{s.input.bairro}</TableCell>
                      <TableCell className="text-muted-foreground">{s.input.cidade}</TableCell>
                      <TableCell className="text-muted-foreground">{s.input.tipo}</TableCell>
                      <TableCell>
                        <Badge className={`border ${statusColor} text-[10px]`}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatBRL(s.precoMedio)}</TableCell>
                      <TableCell className="text-right">{s.comparaveis.length}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Link to="/app/relatorio/$id" params={{ id: s.id }}>
                            <Button size="sm" variant="default" className="gap-1">Abrir <ArrowRight className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Button size="sm" variant="outline" className="gap-1" title="Exportar PDF A4" onClick={() => exportar(s.id, "onepager")}>
                            <Download className="h-3.5 w-3.5" /> PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" title="Exportar slide ACM" onClick={() => exportar(s.id, "slides")}>
                            <Presentation className="h-3.5 w-3.5" /> ACM
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" title="Copiar link" onClick={() => copiarLink(s.id)}>
                            <LinkIcon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhum relatório encontrado para esse filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}