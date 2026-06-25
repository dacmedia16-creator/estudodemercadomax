import { createFileRoute, redirect } from "@tanstack/react-router";
import { generateStudy } from "@/lib/study-engine";
import { studyStore } from "@/lib/study-store";

export const Route = createFileRoute("/app/exemplo")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const result = generateStudy({
      finalidade: "Venda", tipo: "Apartamento", cidade: "Curitiba", estado: "PR",
      bairro: "Água Verde", bairrosProximos: ["Batel", "Portão", "Vila Izabel"],
      areaUtil: 110, quartos: 3, suites: 1, banheiros: 2, vagas: 2,
      condominio: 850, iptu: 220, valorPretendido: 820000,
      diferenciais: ["Piscina", "Academia", "Churrasqueira", "Varanda gourmet"],
      portais: ["Zap Imóveis"],
    });
    studyStore.save(result);
    throw redirect({ to: "/app/relatorio/$id", params: { id: result.id } });
  },
});