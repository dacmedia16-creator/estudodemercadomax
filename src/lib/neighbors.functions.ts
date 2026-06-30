import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  cidade: z.string().min(1),
  bairro: z.string().min(1),
  estado: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusM: z.number().min(500).max(8000).optional(),
  limit: z.number().min(1).max(10).optional(),
});

export interface NeighborsResult {
  ok: boolean;
  source?: "overpass" | "nominatim";
  vizinhos: string[];
  error?: string;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cache em memória do worker (volátil, basta sobreviver dentro do mesmo estudo).
const cache = new Map<string, { ts: number; data: NeighborsResult }>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6 h

async function geocodeBairro(bairro: string, cidade: string, estado?: string) {
  const q = [bairro, cidade, estado, "Brasil"].filter(Boolean).join(", ");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "EstudoMercadoPro/1.0 (contato@estudomercadopro.app)",
      "Accept-Language": "pt-BR",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(json) || json.length === 0) return null;
  const lat = Number(json[0].lat);
  const lon = Number(json[0].lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return { lat, lng: lon };
}

async function fetchOverpass(lat: number, lng: number, radiusM: number) {
  // Pega place=suburb/neighbourhood/quarter num raio fixo.
  const query = `[out:json][timeout:20];(
    node[place~"^(suburb|neighbourhood|quarter)$"](around:${radiusM},${lat},${lng});
  );out tags center;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }>;
      };
      const items = (json.elements ?? [])
        .map((el) => ({
          nome: el.tags?.name ?? "",
          lat: el.lat ?? 0,
          lon: el.lon ?? 0,
        }))
        .filter((x) => x.nome && x.lat && x.lon);
      if (items.length > 0) return items;
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

/**
 * Descobre bairros vizinhos ao redor do bairro alvo, sem custo de GeckoAPI.
 * Estratégia: geocoda o bairro (Nominatim) se não veio lat/lng → consulta
 * Overpass `place=suburb/neighbourhood/quarter` num raio fixo → exclui o
 * próprio bairro alvo → ordena por distância → devolve top N nomes.
 */
export const descobrirBairrosVizinhos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<NeighborsResult> => {
    const radius = data.radiusM ?? 3000;
    const limit = data.limit ?? 5;
    const key = `${normalize(data.cidade)}|${normalize(data.bairro)}|${radius}|${limit}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    let lat = data.lat;
    let lng = data.lng;
    if (lat == null || lng == null) {
      const geo = await geocodeBairro(data.bairro, data.cidade, data.estado);
      if (!geo) {
        const out: NeighborsResult = { ok: false, vizinhos: [], error: "GEOCODE_FAIL" };
        cache.set(key, { ts: Date.now(), data: out });
        return out;
      }
      lat = geo.lat;
      lng = geo.lng;
    }

    const items = await fetchOverpass(lat!, lng!, radius);
    const alvo = normalize(data.bairro);
    const seen = new Set<string>([alvo]);
    const ranked = items
      .filter((it) => {
        const n = normalize(it.nome);
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .map((it) => ({ nome: it.nome.trim(), dist: haversineKm(lat!, lng!, it.lat, it.lon) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map((x) => x.nome);

    const out: NeighborsResult = {
      ok: ranked.length > 0,
      source: "overpass",
      vizinhos: ranked,
      error: ranked.length === 0 ? "NO_NEIGHBORS" : undefined,
    };
    cache.set(key, { ts: Date.now(), data: out });
    return out;
  });