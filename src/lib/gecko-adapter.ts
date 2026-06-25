import type { MockProperty } from "./mock-properties";
import type { GeckoItem } from "./gecko-types";

function extractNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1].replace(",", "."));
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

export function geckoItemToProperty(item: GeckoItem, fallbackAreaUtil: number, fallbackQuartos: number): MockProperty | null {
  const preco = item.prices?.mainValue ?? 0;
  if (!preco) return null;

  const desc = item.description ?? "";
  const quartos = extractNumber(desc, [/(\d+)\s*quartos?/i, /(\d+)\s*dorm/i]) ?? fallbackQuartos;
  const suites = extractNumber(desc, [/(\d+)\s*su[íi]tes?/i]) ?? (quartos > 0 ? 1 : 0);
  const banheiros = extractNumber(desc, [/(\d+)\s*banheiros?/i, /(\d+)\s*wc/i]) ?? Math.max(1, quartos - 1);
  const vagas = extractNumber(desc, [/(\d+)\s*vagas?/i, /(\d+)\s*garagens?/i]) ?? 1;
  const areaUtil = extractNumber(desc, [/(\d+(?:[.,]\d+)?)\s*m[²2]/i]) ?? fallbackAreaUtil;

  return {
    id: item.id ?? crypto.randomUUID(),
    portal: "Zap Imóveis",
    titulo: desc.slice(0, 80) || `Imóvel em ${item.address?.neighborhood ?? ""}`,
    url: item.url ?? "",
    bairro: item.address?.neighborhood ?? "—",
    cidade: item.address?.city ?? "—",
    estado: item.address?.state ?? "—",
    preco,
    condominio: 0,
    iptu: 0,
    areaUtil,
    quartos,
    suites,
    banheiros,
    vagas,
    descricao: desc,
    anunciante: item.advertiser?.name ?? "—",
    diferenciais: item.amenities ?? [],
    imagem: item.images?.[0]?.url?.replace("{action}", "fit-in").replace("{width}", "800").replace("{height}", "600") ?? "",
    dataColeta: new Date().toISOString().slice(0, 10),
  };
}