import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  query: z.string().min(3),
});

export interface GeocodeResult {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  displayName?: string;
  error?: string;
}

/**
 * Geocode a free-form address via Nominatim (OpenStreetMap).
 * Free, no API key, but rate-limited to ~1 req/s and requires a User-Agent.
 */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }): Promise<GeocodeResult> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", data.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": "RadarImobiliarioPro/1.0 (contato@radarimobiliariopro.app)",
          "Accept-Language": "pt-BR",
        },
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const json = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!Array.isArray(json) || json.length === 0) return { ok: false, error: "NOT_FOUND" };
      const hit = json[0];
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!isFinite(lat) || !isFinite(lon)) return { ok: false, error: "INVALID_COORDS" };
      return { ok: true, latitude: lat, longitude: lon, displayName: hit.display_name };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });