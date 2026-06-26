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

/**
 * Chaves na Mão uses lowercase aliases for propertyTypes:
 * apartment, house, penthouse, land, commercial_room, loft, flat, farm.
 */
const CHAVES_TYPE_MAP: Record<string, string> = {
  apartamento: "apartment",
  apto: "apartment",
  cobertura: "penthouse",
  casa: "house",
  sobrado: "house",
  "casa de condomínio": "house",
  "casa de condominio": "house",
  studio: "flat",
  kitnet: "flat",
  loft: "loft",
  terreno: "land",
  comercial: "commercial_room",
  sala: "commercial_room",
};

export function mapTipoToChavesAlias(tipo: string): string | undefined {
  return CHAVES_TYPE_MAP[tipo.trim().toLowerCase()];
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

  // ---- Dispatch to Chaves na Mão parser when shape matches ----
  // Chaves payloads expose `counts.bedrooms.count`, `prices.rawPrice`, `area.useful`.
  const looksLikeChaves =
    portal === "Chaves na Mão" ||
    (anyItem.counts && anyItem.counts.bedrooms && typeof anyItem.counts.bedrooms === "object") ||
    typeof anyItem.prices?.rawPrice === "number";
  if (looksLikeChaves) {
    return chavesItemToProperty(anyItem, portal);
  }

  const desc: string = item.description ?? anyItem.title ?? anyItem.name ?? "";

  // Price — tolerant across portals (Zap nests under prices.mainValue;
  // Chaves na Mão often returns price/priceValue/sale.price as number or BR string).
  const preco =
    parsePrice(item.prices?.mainValue) ||
    parsePrice(item.prices?.price) ||
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

  // ---- Enrichment fields (mostly populated by PDP) ----
  const condominio =
    (typeof item.prices?.monthlyCondoFee === "number" ? item.prices.monthlyCondoFee : 0) ||
    parsePrice(anyItem.condoFee) ||
    parsePrice(anyItem.condominium) ||
    0;
  const iptu =
    (typeof item.prices?.iptu === "number" ? item.prices.iptu : 0) ||
    parsePrice(anyItem.iptu) ||
    0;

  const latitude =
    typeof item.address?.latitude === "number" ? item.address.latitude : undefined;
  const longitude =
    typeof item.address?.longitude === "number" ? item.address.longitude : undefined;

  const createdAtStr = item.createdAt ?? anyItem.createdAt ?? "";
  let diasMercado: number | undefined;
  if (createdAtStr) {
    const t = Date.parse(createdAtStr);
    if (!isNaN(t)) diasMercado = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  const adv = item.advertiser ?? {};
  const advertiserPhone = adv.mainPhone || adv.phoneNumbers?.[0] || undefined;
  const advertiserWhatsapp = adv.whatsAppNumber || undefined;
  const advertiserCreci = adv.creci || undefined;
  const advertiserRating =
    typeof adv.rating?.score === "number" ? adv.rating.score : undefined;

  const mainAmenities = Array.isArray(item.mainAmenities) ? item.mainAmenities : undefined;
  const infoTags = Array.isArray(item.infoTags) ? item.infoTags : undefined;
  const agregadoCount = typeof item.childrenCount === "number" && item.childrenCount > 0 ? item.childrenCount : undefined;

  return {
    id,
    portal,
    titulo: (item.title || desc || `Imóvel em ${bairro}`).slice(0, 80),
    url,
    bairro,
    cidade,
    estado,
    preco,
    condominio,
    iptu,
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
    latitude,
    longitude,
    diasMercado,
    publicationType: item.publicationType,
    mainAmenities,
    infoTags,
    advertiserPhone: advertiserPhone || undefined,
    advertiserWhatsapp: advertiserWhatsapp || undefined,
    advertiserCreci,
    advertiserRating,
    virtualTourUrl: item.virtualTourUrl,
    agregadoCount,
  };
}

/** Parser for Chaves na Mão PLP/PDP item shape — see docs/chavesnamao-com-br-plp. */
function chavesItemToProperty(item: Record<string, any>, portal: string): MockProperty | null {
  const desc: string = item.description ?? item.title ?? item.metaDescription ?? "";

  const preco =
    (typeof item.prices?.rawPrice === "number" ? item.prices.rawPrice : 0) ||
    (typeof item.prices?.maxPrice === "number" ? item.prices.maxPrice : 0) ||
    parsePrice(item.prices?.main) ||
    0;
  if (!preco) return null;

  const areaUtilRaw =
    (typeof item.area?.useful === "number" && item.area.useful > 0 ? item.area.useful : 0) ||
    (typeof item.area?.total === "number" && item.area.total > 0 ? item.area.total : 0) ||
    extractNumber(desc, [/(\d+(?:[.,]\d+)?)\s*m[²2]/i]);

  const quartosRaw =
    (typeof item.counts?.bedrooms?.count === "number" ? item.counts.bedrooms.count : null) ??
    extractNumber(desc, [/(\d+)\s*quartos?/i, /(\d+)\s*dorm/i]);

  const incomplete = quartosRaw === null || !areaUtilRaw || areaUtilRaw <= 0;
  const quartos = quartosRaw ?? 0;
  const areaUtil = areaUtilRaw && areaUtilRaw > 0 ? areaUtilRaw : 0;

  const banheiros =
    (typeof item.counts?.bathrooms?.count === "number" ? item.counts.bathrooms.count : null) ??
    extractNumber(desc, [/(\d+)\s*banheiros?/i]) ??
    Math.max(1, quartos - 1 || 1);
  const suites =
    (typeof item.counts?.suites?.count === "number" ? item.counts.suites.count : 0) ?? 0;
  const vagas =
    (typeof item.counts?.garages?.count === "number" ? item.counts.garages.count : null) ??
    extractNumber(desc, [/(\d+)\s*vagas?/i]) ??
    0;

  const bairro: string = item.address?.neighborhood ?? "—";
  const cidade: string = item.address?.city ?? "—";
  const estado: string = item.address?.state ?? "—";
  const latitude =
    typeof item.address?.latitude === "number" ? item.address.latitude : undefined;
  const longitude =
    typeof item.address?.longitude === "number" ? item.address.longitude : undefined;

  const imagem: string =
    (typeof item.featuredImage === "string" ? item.featuredImage : "") ||
    (Array.isArray(item.images) && typeof item.images[0] === "string" ? item.images[0] : "") ||
    (Array.isArray(item.images) && item.images[0]?.url) ||
    "";

  const url: string = item.url ?? "";
  const id: string = (item.id ?? item.listingId ?? url) || crypto.randomUUID();

  const condominio =
    typeof item.prices?.condominiumFee === "number" ? item.prices.condominiumFee : 0;
  const iptu = typeof item.prices?.iptuValue === "number" ? item.prices.iptuValue : 0;

  // updatedAt is the closest proxy to DOM for Chaves (no createdAt exposed).
  const updatedAt = item.updatedAt ?? "";
  let diasMercado: number | undefined;
  if (updatedAt) {
    const t = Date.parse(updatedAt);
    if (!isNaN(t)) diasMercado = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  const adv = item.advertiser ?? {};
  const phones = adv.phones ?? {};
  const rawPhone: string | undefined =
    phones.cellphone || phones.commercial || phones.landline || undefined;
  const advertiserPhone = rawPhone;
  // Derive WhatsApp link from a cell number (DDD+9 digits) when public.
  let advertiserWhatsapp: string | undefined;
  if (rawPhone && phones.public !== false) {
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      advertiserWhatsapp = digits.startsWith("55") ? digits : `55${digits}`;
    }
  }
  const advertiserCreci = adv.creci || undefined;
  const advertiserRating =
    typeof item.gmb?.rating === "number" ? item.gmb.rating : undefined;

  const diferenciais: string[] = [
    ...(Array.isArray(item.privativeAmenities) ? item.privativeAmenities : []),
    ...(Array.isArray(item.commonAmenities) ? item.commonAmenities : []),
  ];

  const titulo: string = (item.title || desc || `Imóvel em ${bairro}`).slice(0, 80);

  return {
    id: String(id),
    portal,
    titulo,
    url,
    bairro,
    cidade,
    estado,
    preco,
    condominio,
    iptu,
    areaUtil,
    quartos,
    suites,
    banheiros,
    vagas,
    descricao: desc,
    anunciante: adv.name ?? "—",
    diferenciais,
    imagem,
    dataColeta: new Date().toISOString().slice(0, 10),
    incomplete,
    latitude,
    longitude,
    diasMercado,
    publicationType: item.highlighted ? "PREMIUM" : undefined,
    mainAmenities: diferenciais.length ? diferenciais.slice(0, 5) : undefined,
    infoTags: undefined,
    advertiserPhone,
    advertiserWhatsapp,
    advertiserCreci,
    advertiserRating,
    virtualTourUrl: item.media?.tour360 || undefined,
    agregadoCount: undefined,
  };
}

/**
 * Merge enrichment fields from a PDP payload into an existing property.
 * The PDP response shape is `{ source, type, data: {...real fields...} }`
 * (one level deeper than PLP items).
 */
export function enrichWithPdp(p: MockProperty, pdpData: unknown): MockProperty {
  if (!pdpData || typeof pdpData !== "object") return p;
  const outer = pdpData as Record<string, any>;
  // pdp.data shape: { source, type, parser, data: { ...item-shaped... } }
  const inner = (outer.data && typeof outer.data === "object" ? outer.data : outer) as Record<string, any>;
  const enriched = geckoItemToProperty(inner as GeckoItem, p.portal);
  if (!enriched) return p;
  // Keep original id/url/title/imagem if PDP didn't bring them — prefer PDP values when present.
  return {
    ...p,
    condominio: enriched.condominio || p.condominio,
    iptu: enriched.iptu || p.iptu,
    latitude: enriched.latitude ?? p.latitude,
    longitude: enriched.longitude ?? p.longitude,
    diasMercado: enriched.diasMercado ?? p.diasMercado,
    publicationType: enriched.publicationType ?? p.publicationType,
    mainAmenities: enriched.mainAmenities ?? p.mainAmenities,
    infoTags: enriched.infoTags ?? p.infoTags,
    advertiserPhone: enriched.advertiserPhone ?? p.advertiserPhone,
    advertiserWhatsapp: enriched.advertiserWhatsapp ?? p.advertiserWhatsapp,
    advertiserCreci: enriched.advertiserCreci ?? p.advertiserCreci,
    advertiserRating: enriched.advertiserRating ?? p.advertiserRating,
    virtualTourUrl: enriched.virtualTourUrl ?? p.virtualTourUrl,
    diferenciais: enriched.diferenciais.length ? enriched.diferenciais : p.diferenciais,
    anunciante: p.anunciante !== "—" ? p.anunciante : enriched.anunciante,
    areaUtil: p.areaUtil || enriched.areaUtil,
    quartos: p.quartos || enriched.quartos,
    banheiros: p.banheiros || enriched.banheiros,
    vagas: p.vagas || enriched.vagas,
    suites: p.suites || enriched.suites,
    descricao: p.descricao || enriched.descricao,
  };
}