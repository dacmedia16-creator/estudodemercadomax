import type { MockProperty } from "./mock-properties";
import type { GeckoItem } from "./gecko-types";

const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartamento: "APARTMENT",
  apto: "APARTMENT",
  cobertura: "PENTHOUSE",
  casa: "HOME",
  sobrado: "HOME",
  "casa de condomínio": "CONDOMINIUM",
  "casa de condominio": "CONDOMINIUM",
  studio: "STUDIO",
  kitnet: "KITNET",
  terreno: "ALLOTMENT_LAND",
  comercial: "BUSINESS",
  sala: "COMMERCIAL_BUILDING",
};

export function mapTipoToPropertyType(tipo: string): string | undefined {
  return PROPERTY_TYPE_MAP[tipo.trim().toLowerCase()];
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function firstNumber(v: number | number[] | undefined): number | null {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "number") return v[0];
  return null;
}

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

/**
 * Converts a Gecko item to a local MockProperty.
 * Returns null when essential fields (price, quartos or areaUtil) cannot be determined.
 * Does NOT fall back to user-supplied values — that would mask mismatches.
 */
export function geckoItemToProperty(item: GeckoItem): MockProperty | null {
  const preco = item.prices?.mainValue ?? 0;
  if (!preco) return null;

  const desc = item.description ?? "";

  const quartosRaw =
    firstNumber(item.bedrooms) ??
    extractNumber(desc, [/(\d+)\s*quartos?/i, /(\d+)\s*dorm/i]);
  const areaUtilRaw =
    firstNumber(item.usableAreas) ??
    firstNumber(item.totalAreas) ??
    extractNumber(desc, [/(\d+(?:[.,]\d+)?)\s*m[²2]/i]);

  // Keep the item even without quartos/area on the PLP — the local filter
  // and the "same building" layer can still use it. Flag as incomplete so
  // strict filters can skip it.
  const incomplete = quartosRaw === null || areaUtilRaw === null || (areaUtilRaw ?? 0) <= 0;
  const quartos = quartosRaw ?? 0;
  const areaUtil = areaUtilRaw && areaUtilRaw > 0 ? areaUtilRaw : 0;

  const suites =
    firstNumber(item.suites) ??
    extractNumber(desc, [/(\d+)\s*su[íi]tes?/i]) ??
    0;
  const banheiros =
    firstNumber(item.bathrooms) ??
    extractNumber(desc, [/(\d+)\s*banheiros?/i, /(\d+)\s*wc/i]) ??
    Math.max(1, quartos - 1 || 1);
  const vagas =
    firstNumber(item.parkingSpaces) ??
    extractNumber(desc, [/(\d+)\s*vagas?/i, /(\d+)\s*garagens?/i]) ??
    0;

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
    incomplete,
  };
}