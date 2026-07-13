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

/**
 * Mapeamento dos rótulos de "Diferenciais" da UI para os códigos de
 * amenities aceitos pelo Zap PLP. Rótulos sem código nativo
 * (Vista livre, Próximo a escolas/metrô, Reformado, Novo) ficam apenas
 * no scoring local — retornamos undefined para esses.
 */
const ZAP_AMENITY_MAP: Record<string, string> = {
  piscina: "POOL",
  academia: "GYM",
  churrasqueira: "BARBECUE_GRILL",
  sacada: "BALCONY",
  "varanda gourmet": "GOURMET_BALCONY",
  mobiliado: "FURNISHED",
  "aceita pet": "PETS_ALLOWED",
  "portaria 24h": "CONCIERGE_24H",
  elevador: "ELEVATOR",
};

/** Diferenciais "estruturais" — únicos elegíveis para filtro Hard local. */
export const STRUCTURAL_DIFERENCIAIS = new Set<string>([
  "piscina", "academia", "churrasqueira", "sacada", "varanda gourmet",
  "mobiliado", "portaria 24h", "elevador", "aceita pet",
]);

export function isStructuralDiferencial(label: string): boolean {
  return STRUCTURAL_DIFERENCIAIS.has(normalizeText(label));
}

export function mapDiferenciaisToZapAmenities(labels: string[]): string[] {
  const out = new Set<string>();
  for (const l of labels) {
    const code = ZAP_AMENITY_MAP[normalizeText(l)];
    if (code) out.add(code);
  }
  return Array.from(out);
}

/**
 * Tipo families — usadas para descartar comparáveis incompatíveis (ex.: "Casa
 * de condomínio" entrando num estudo de "Apartamento"). Cada família tem
 * tokens positivos (qualquer um basta para classificar) e tokens negativos
 * (qualquer um desclassifica a partir de outra família).
 */
const TIPO_FAMILIES: Record<string, { pos: string[]; neg: string[] }> = {
  apartamento: {
    pos: ["apartamento", "apto", "cobertura", "flat", "studio", "kitnet", "loft", "duplex", "garden"],
    neg: ["casa ", "casa,", "casa.", "casa-", "sobrado", "chacara", "sitio", "terreno", "galpao", "sala comercial", "loja"],
  },
  casa: {
    pos: ["casa", "sobrado", "casa terrea", "casa de condominio"],
    neg: ["apartamento", "apto ", "cobertura", "studio", "kitnet", "flat ", "sala comercial", "galpao", "terreno"],
  },
  terreno: { pos: ["terreno", "lote", "area"], neg: ["apartamento", "casa", "sala", "galpao"] },
  comercial: { pos: ["sala comercial", "loja", "galpao", "comercial", "ponto"], neg: ["apartamento", "casa", "terreno"] },
};

function familyOfTipo(tipo: string): keyof typeof TIPO_FAMILIES | null {
  const t = normalizeText(tipo);
  if (!t) return null;
  if (["apartamento", "apto", "cobertura", "flat", "studio", "kitnet", "loft"].includes(t)) return "apartamento";
  if (["casa", "sobrado", "casa de condominio"].includes(t)) return "casa";
  if (["terreno", "lote"].includes(t)) return "terreno";
  if (["comercial", "sala", "sala comercial", "loja", "galpao"].includes(t)) return "comercial";
  return null;
}

/**
 * Retorna true se o imóvel pertence à mesma família de tipo do desejado.
 * Quando não conseguimos classificar com confiança (anúncio sem palavras-chave),
 * mantemos (`true`) para não derrubar resultados legítimos do mesmo prédio.
 */
export function isSameTipoFamily(
  p: { titulo?: string; descricao?: string },
  tipoDesejado: string,
): boolean {
  const fam = familyOfTipo(tipoDesejado);
  if (!fam) return true;
  const hay = normalizeText(`${p.titulo ?? ""} ${p.descricao ?? ""}`);
  if (!hay) return true;
  const me = TIPO_FAMILIES[fam];
  // Token positivo da família desejada → aceita.
  const hasPos = me.pos.some((tok) => hay.includes(tok));
  if (hasPos) {
    // Mesmo com pos, se o título começa com "Casa" e família é apartamento, derruba.
    // (cobre "Casa de condomínio à venda...")
    if (fam === "apartamento" && /^casa\b/.test(hay)) return false;
    return true;
  }
  // Sem token positivo: rejeita se houver token de OUTRA família claramente.
  for (const [otherFam, def] of Object.entries(TIPO_FAMILIES)) {
    if (otherFam === fam) continue;
    if (def.pos.some((tok) => hay.includes(tok))) return false;
  }
  // Ambíguo — preserva.
  return true;
}

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Identifica o portal a partir da URL colada pelo usuário. */
export function detectPortalFromUrl(url: string): { target: "zapimoveis.com.br" | "chavesnamao.com.br" | "olx.com.br" | "vivareal.com.br"; portal: "Zap Imóveis" | "Chaves na Mão" | "OLX" | "Viva Real" } | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("zapimoveis.com.br")) return { target: "zapimoveis.com.br", portal: "Zap Imóveis" };
    if (host.includes("chavesnamao.com.br")) return { target: "chavesnamao.com.br", portal: "Chaves na Mão" };
    if (host.includes("olx.com.br")) return { target: "olx.com.br", portal: "OLX" };
    if (host.includes("vivareal.com.br")) return { target: "vivareal.com.br", portal: "Viva Real" };
    return null;
  } catch {
    return null;
  }
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

/**
 * Detecta a finalidade (Venda × Aluguel) a partir do payload bruto.
 * Olha campos estruturados primeiro (Zap pricingInfos, Chaves businessType,
 * OLX category/listingType) e cai para heurística de URL.
 */
function detectFinalidade(raw: Record<string, any>): "Venda" | "Aluguel" | undefined {
  // Zap: listing.pricingInfos[].businessType: "SALE" | "RENTAL"
  const pricing = raw?.pricingInfos ?? raw?.listing?.pricingInfos;
  if (Array.isArray(pricing) && pricing.length) {
    const bts = pricing
      .map((p) => String(p?.businessType ?? "").toUpperCase())
      .filter(Boolean);
    if (bts.includes("SALE")) return "Venda";
    if (bts.includes("RENTAL")) return "Aluguel";
  }
  // Generic businessType / transactionType / listingType
  const bt = String(
    raw?.businessType ?? raw?.transactionType ?? raw?.listingType ?? raw?.adType ?? "",
  ).toUpperCase();
  if (/SALE|VENDA|VENDER|SELL/.test(bt)) return "Venda";
  if (/RENT|ALUGUEL|LOCAC|ALUGAR/.test(bt)) return "Aluguel";
  // OLX category/subcategory IDs
  const catName = String(
    raw?.category?.name ?? raw?.subcategory?.name ?? raw?.category ?? "",
  ).toLowerCase();
  if (/aluguel|locac/.test(catName)) return "Aluguel";
  if (/venda/.test(catName)) return "Venda";
  // URL heuristic — last resort
  const url = String(raw?.url ?? raw?.link ?? raw?.permalink ?? "").toLowerCase();
  if (/\/(aluguel|locacao|locação|rent)\b/.test(url)) return "Aluguel";
  if (/\/(venda|sale|comprar)\b/.test(url)) return "Venda";
  // Rent-shaped price field present without sale price
  if ((raw?.rentPrice || raw?.rent?.price) && !(raw?.salePrice || raw?.sale?.price || raw?.price)) {
    return "Aluguel";
  }
  return undefined;
}

export function geckoItemToProperty(item: GeckoItem, portal: string = "Zap Imóveis"): MockProperty | null {
  const anyItem = item as unknown as Record<string, any>;

  // ---- Dispatch to OLX parser ----
  // OLX PLP items have a flat shape with `location.ddd`, `listedAtEpoch`,
  // `properties[]` and a numeric `price`.
  const looksLikeOlx =
    portal === "OLX" ||
    (typeof anyItem.listedAtEpoch === "number" &&
      anyItem.location && typeof anyItem.location.ddd === "string");
  if (looksLikeOlx) {
    return olxItemToProperty(anyItem, portal === "OLX" ? portal : "OLX");
  }

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
    parsePrice(anyItem.prices?.[0]?.value) ||
    parsePrice(anyItem.sale?.price) ||
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
  const imagens = collectZapImages(item, anyItem);

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
    imagens,
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
    finalidade: detectFinalidade(anyItem),
  };
}

/** Parser for Chaves na Mão PLP/PDP item shape — see docs/chavesnamao-com-br-plp. */
function chavesItemToProperty(item: Record<string, any>, portal: string): MockProperty | null {
  // Per Chaves PLP doc: skip inactive and launch items locally — reinforces
  // the server-side `includeLaunches: false` and protects against stale cards.
  if (item.active === false) return null;
  if (item.isLaunch === true) return null;
  if (typeof item.status === "string" && item.status.toUpperCase() === "INACTIVE") return null;
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
  const imagens = collectChavesImages(item);

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
    imagens,
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
    finalidade: detectFinalidade(item),
  };
}

/**
 * Parser for OLX PLP/PDP items.
 * - PLP shape (flat):   { id, url, title, price, location:{city,state,neighborhood,ddd},
 *                         images:[{url,webpUrl}], properties:[{name,label,value}], listedAt, ... }
 * - PDP shape (nested): outer.data.data = { listingId, url, title, description, price,
 *                         location:{...,zipCode,region}, attributes:[{name,label,value}], images:[{url}], ... }
 * `enrichWithPdp` calls us with `outer.data` already unwrapped; if we still
 * see a `data` sub-object we drill one more level.
 */
function olxItemToProperty(itemRaw: Record<string, any>, portal: string): MockProperty | null {
  // PDP envelope: outer.data may itself contain { data: { ...real... } }.
  const item: Record<string, any> =
    itemRaw && typeof itemRaw.data === "object" && (itemRaw.data.listingId || itemRaw.data.title || itemRaw.data.price)
      ? itemRaw.data
      : itemRaw;

  const desc: string = item.description ?? item.title ?? "";
  const titulo: string = (item.title || desc || "Imóvel").slice(0, 80);

  const preco =
    (typeof item.price === "number" && item.price > 0 ? item.price : 0) ||
    parsePrice(item.priceDisplay) ||
    parsePrice(item.priceValue) ||
    extractNumber(desc, [/R\$\s*([\d.,]+)/i]) ||
    0;
  if (!preco) return null;

  // OLX exposes structured attrs in `properties[]` (PLP) or `attributes[]` (PDP).
  const attrs: Array<{ name?: string; label?: string; value?: string }> = [
    ...(Array.isArray(item.properties) ? item.properties : []),
    ...(Array.isArray(item.attributes) ? item.attributes : []),
  ];
  const attrByName = new Map<string, string>();
  for (const a of attrs) {
    if (a && typeof a.name === "string" && typeof a.value === "string") {
      attrByName.set(a.name.toLowerCase(), a.value);
    }
  }
  const attrNum = (...names: string[]): number | null => {
    for (const n of names) {
      const v = attrByName.get(n.toLowerCase());
      if (v) {
        const num = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
        if (isFinite(num) && num > 0) return num;
      }
    }
    return null;
  };

  // Only use the long description as fallback haystack — the title alone
  // often echoes the search query (e.g. "...250m²") and would poison every row.
  const longDesc = typeof desc === "string" && desc.length > titulo.length + 10 ? desc : "";
  const hay = longDesc;
  const quartosRaw =
    attrNum("rooms", "real_estate_rooms", "imovel_quartos") ??
    (hay ? extractNumber(hay, [/(\d+)\s*quartos?/i, /(\d+)\s*dorm/i]) : null);
  const areaUtilRaw =
    attrNum(
      "real_estate_useful_area", "area_util", "useful_area",
      "real_estate_total_area", "size", "square_meters", "total_area_useful",
    ) ??
    (hay ? extractNumber(hay, [/(\d+(?:[.,]\d+)?)\s*m[²2]\b/i]) : null);

  const incomplete = quartosRaw === null || !areaUtilRaw || areaUtilRaw <= 0;
  const quartos = quartosRaw ?? 0;
  const areaUtil = areaUtilRaw && areaUtilRaw > 0 ? areaUtilRaw : 0;

  const banheiros =
    attrNum("bathrooms", "real_estate_bathrooms") ??
    extractNumber(hay, [/(\d+)\s*banheiros?/i]) ??
    Math.max(1, quartos - 1 || 1);
  const suites = attrNum("suites", "real_estate_suites") ?? 0;
  const vagas =
    attrNum("garage_spaces", "real_estate_garage_spaces", "parking_spaces") ??
    extractNumber(hay, [/(\d+)\s*vagas?/i, /(\d+)\s*garagens?/i]) ??
    0;
  const condominio = attrNum("condominium_fee", "real_estate_condominium_fee") ?? 0;
  const iptu = attrNum("iptu", "real_estate_iptu") ?? 0;

  const bairro: string = item.location?.neighborhood ?? "—";
  const cidade: string = item.location?.city ?? "—";
  const estado: string = item.location?.state ?? "—";

  const rawImage =
    (Array.isArray(item.images) && (item.images[0]?.webpUrl || item.images[0]?.url)) || "";
  const imagem = typeof rawImage === "string" ? rawImage : "";
  const imagens = collectOlxImages(item);

  const url: string = item.url ?? "";
  const id: string = String(item.id ?? item.listingId ?? item.adId ?? url) || crypto.randomUUID();

  const listedAt = item.listedAt ?? "";
  let diasMercado: number | undefined;
  if (listedAt) {
    const t = Date.parse(listedAt);
    if (!isNaN(t)) diasMercado = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }

  // OLX hides seller name (LGPD hash) — show role only.
  const anunciante =
    item.professionalAd === true || item.seller?.isProfessional === true
      ? "Profissional"
      : "Particular";

  return {
    id,
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
    descricao: typeof desc === "string" ? desc : "",
    anunciante,
    diferenciais: [],
    imagem,
    imagens,
    dataColeta: new Date().toISOString().slice(0, 10),
    incomplete,
    latitude: undefined,
    longitude: undefined,
    diasMercado,
    publicationType: item.featured ? "PREMIUM" : undefined,
    mainAmenities: undefined,
    infoTags: undefined,
    advertiserPhone: undefined,
    advertiserWhatsapp: undefined,
    advertiserCreci: undefined,
    advertiserRating: undefined,
    virtualTourUrl: undefined,
    agregadoCount: undefined,
    finalidade: detectFinalidade(item),
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
    imagens: enriched.imagens && enriched.imagens.length ? enriched.imagens : p.imagens,
    anunciante: p.anunciante !== "—" ? p.anunciante : enriched.anunciante,
    areaUtil: p.areaUtil || enriched.areaUtil,
    quartos: p.quartos || enriched.quartos,
    banheiros: p.banheiros || enriched.banheiros,
    vagas: p.vagas || enriched.vagas,
    suites: p.suites || enriched.suites,
    descricao: p.descricao || enriched.descricao,
  };
}

// -----------------------------------------------------------------------------
// Image collectors: extract up to N unique photo URLs per portal payload.
// Mantém ordem original (capa primeiro) e descarta vazios/duplicados.
// -----------------------------------------------------------------------------
const MAX_IMGS = 10;
function dedupNonEmpty(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const u = raw
      .replace("{action}", "fit-in")
      .replace("{width}", "800")
      .replace("{height}", "600")
      .trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= MAX_IMGS) break;
  }
  return out;
}
function collectZapImages(item: GeckoItem, anyItem: Record<string, any>): string[] {
  const arr: Array<string | undefined> = [];
  if (Array.isArray(item.images)) for (const im of item.images) arr.push(im?.url);
  if (Array.isArray(anyItem.photos)) for (const im of anyItem.photos) arr.push(typeof im === "string" ? im : im?.url);
  if (typeof anyItem.image === "string") arr.push(anyItem.image);
  if (typeof anyItem.cover === "string") arr.push(anyItem.cover);
  return dedupNonEmpty(arr);
}
function collectChavesImages(item: Record<string, any>): string[] {
  const arr: Array<string | undefined> = [];
  if (typeof item.featuredImage === "string") arr.push(item.featuredImage);
  if (Array.isArray(item.images)) {
    for (const im of item.images) arr.push(typeof im === "string" ? im : im?.url);
  }
  if (Array.isArray(item.gallery)) {
    for (const im of item.gallery) arr.push(typeof im === "string" ? im : im?.url);
  }
  return dedupNonEmpty(arr);
}
function collectOlxImages(item: Record<string, any>): string[] {
  const arr: Array<string | undefined> = [];
  if (Array.isArray(item.images)) {
    for (const im of item.images) arr.push(im?.webpUrl || im?.url);
  }
  return dedupNonEmpty(arr);
}