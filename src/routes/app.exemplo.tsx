import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { generateStudy } from "@/lib/study-engine";
import { studyStore } from "@/lib/study-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/exemplo")({
  component: ExamplePage,
});

function ExamplePage() {
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = generateStudy({
        finalidade: "Venda", tipo: "Apartamento", cidade: "Curitiba", estado: "PR",
        bairro: "Água Verde", bairrosProximos: ["Batel", "Portão", "Vila Izabel"],
        areaUtil: 110, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
        condominio: 850, iptu: 220, valorPretendido: 820000,
        diferenciais: ["Piscina", "Academia", "Churrasqueira", "Varanda gourmet"],
        portais: ["Zap Imóveis"],
      });
      try {
        await studyStore.save(result);
        navigate({ to: "/app/relatorio/$id", params: { id: result.id }, replace: true });
      } catch (err) {
        toast.error(`Não foi possível criar o exemplo: ${(err as Error).message}`);
      }
    })();
  }, [navigate]);
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Gerando estudo de exemplo…</p>
    </div>
  );
}