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
function parsePrice(v: unknown): number {
  if (typeof v === "number" && isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    // "R$ 5.990.000" / "5990000" / "R$ 1.250,00"
    const cleaned = v.replace(/[R$\s.]/g, "").replace(",", ".");
    const n = Number(cleaned);
    if (isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function geckoItemToProperty(item: GeckoItem, portal: string = "Zap Imóveis"): MockProperty | null {
  const anyItem = item as unknown as Record<string, any>;
  const desc: string = item.description ?? anyItem.title ?? anyItem.name ?? "";

  // Price — tolerant across portals (Zap nests under prices.mainValue;
  // Chaves na Mão often returns price/priceValue/sale.price as number or BR string).
  const preco =
    parsePrice(item.prices?.mainValue) ||
    parsePrice(anyItem.price) ||
    parsePrice(anyItem.priceValue) ||
    parsePrice(anyItem.salePrice) ||
    parsePrice(anyItem.rentPrice) ||
    parsePrice(anyItem.prices?.[0]?.value) ||
    parsePrice(anyItem.sale?.price) ||
    parsePrice(anyItem.rent?.price) ||
    extractNumber(desc, [/R\$\s*([\d.,]+)/i]) ||
    0;
  if (!preco) return null;

  const quartosRaw =
    firstNumber(item.bedrooms) ??
    firstNumber(anyItem.rooms) ??
    firstNumber(anyItem.dormitories) ??
    extractNumber(desc, [/(\d+)\s*quartos?/i, /(\d+)\s*dorm/i]);
  const areaUtilRaw =
    firstNumber(item.usableAreas) ??
    firstNumber(item.totalAreas) ??
    firstNumber(anyItem.area) ??
    firstNumber(anyItem.privateArea) ??
    firstNumber(anyItem.usableArea) ??
    extractNumber(desc, [/(\d+(?:[.,]\d+)?)\s*m[²2]/i]);

  // Keep the item even without quartos/area on the PLP — the local filter
  // and the "same building" layer can still use it. Flag as incomplete so
  // strict filters can skip it.
  const incomplete = quartosRaw === null || areaUtilRaw === null || (areaUtilRaw ?? 0) <= 0;
  const quartos = quartosRaw ?? 0;
  const areaUtil = areaUtilRaw && areaUtilRaw > 0 ? areaUtilRaw : 0;

  const suites =
    firstNumber(item.suites) ??
    firstNumber(anyItem.suite) ??
    extractNumber(desc, [/(\d+)\s*su[íi]tes?/i]) ??
    0;
  const banheiros =
    firstNumber(item.bathrooms) ??
    firstNumber(anyItem.bathroom) ??
    extractNumber(desc, [/(\d+)\s*banheiros?/i, /(\d+)\s*wc/i]) ??
    Math.max(1, quartos - 1 || 1);
  const vagas =
    firstNumber(item.parkingSpaces) ??
    firstNumber(anyItem.garage) ??
    firstNumber(anyItem.parking) ??
    extractNumber(desc, [/(\d+)\s*vagas?/i, /(\d+)\s*garagens?/i]) ??
    0;

  const bairro: string =
    item.address?.neighborhood ?? anyItem.neighborhood ?? anyItem.bairro ?? "—";
  const cidade: string =
    item.address?.city ?? anyItem.city ?? anyItem.cidade ?? "—";
  const estado: string =
    item.address?.state ?? anyItem.state ?? anyItem.uf ?? anyItem.estado ?? "—";

  const rawImage: string =
    item.images?.[0]?.url ??
    anyItem.image ??
    anyItem.thumbnail ??
    anyItem.cover ??
    (Array.isArray(anyItem.photos) ? anyItem.photos[0]?.url ?? anyItem.photos[0] : "") ??
    "";
  const imagem =
    typeof rawImage === "string"
      ? rawImage.replace("{action}", "fit-in").replace("{width}", "800").replace("{height}", "600")
      : "";

  const url: string = item.url ?? anyItem.link ?? anyItem.permalink ?? "";
  const id: string = (item.id ?? anyItem.listingId ?? anyItem.code ?? url) || crypto.randomUUID();

  return {
    id,
    portal,
    titulo: (desc || `Imóvel em ${bairro}`).slice(0, 80),
    url,
    bairro,
    cidade,
    estado,
    preco,
    condominio: 0,
    iptu: 0,
    areaUtil,
    quartos,
    suites,
    banheiros,
    vagas,
    descricao: desc,
    anunciante: item.advertiser?.name ?? anyItem.advertiser ?? anyItem.agency ?? "—",
    diferenciais: item.amenities ?? anyItem.features ?? [],
    imagem,
    dataColeta: new Date().toISOString().slice(0, 10),
    incomplete,
  };
}