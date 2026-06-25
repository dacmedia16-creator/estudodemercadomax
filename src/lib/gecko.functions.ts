import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GeckoCallResult, GeckoPlpData, JsonValue } from "./gecko-types";

const ENDPOINT = "https://api.geckoapi.com.br/v1/extract";

async function callGecko<T>(body: Record<string, unknown>, tokenOverride?: string): Promise<GeckoCallResult<T>> {
  const token = tokenOverride || process.env.GECKOAPI_TOKEN;
  if (!token) {
    return { ok: false, status: 0, errorCode: "NO_TOKEN", errorMessage: "Token GeckoAPI não configurado" };
  }

  const doFetch = async () =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let res: Response;
  try {
    res = await doFetch();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await doFetch();
    }
  } catch (e) {
    return { ok: false, status: 0, errorCode: "NETWORK_ERROR", errorMessage: (e as Error).message };
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      errorCode: json?.errorCode || `HTTP_${res.status}`,
      errorMessage: json?.message || json?.error || `Erro HTTP ${res.status}`,
    };
  }

  return {
    ok: true,
    status: res.status,
    notFound: !!json?.notFound,
    data: (json?.data ?? null) as T | null,
  };
}

const plpInput = z.object({
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  businessType: z.enum(["sale", "rent"]),
  keyword: z.string().optional(),
  propertyType: z.string().optional(),
  bedrooms: z.array(z.number().int()).optional(),
  bathrooms: z.array(z.number().int()).optional(),
  parkingSpots: z.array(z.number().int()).optional(),
  priceMin: z.number().int().optional(),
  priceMax: z.number().int().optional(),
  areaMin: z.number().int().optional(),
  areaMax: z.number().int().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  page: z.number().int().min(1).default(1),
});

export const geckoPlp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => plpInput.parse(d))
  .handler(async ({ data }) => {
    const { city, state, keyword, ...rest } = data;
    const hasCity = !!city && city.trim().length > 0;
    const hasState = !!state && state.trim().length === 2;
    const hasKeyword = !!keyword && keyword.trim().length > 0;
    if (!hasCity && !hasKeyword) {
      return { ok: false as const, status: 0, errorCode: "MISSING_QUERY", errorMessage: "Informe ao menos uma cidade ou palavra-chave para buscar." };
    }
    const body: Record<string, unknown> = {
      target: "zapimoveis.com.br",
      type: "plp",
      ...rest,
    };
    if (hasCity) body.city = city;
    if (hasState) body.state = state;
    if (hasKeyword) body.keyword = keyword;
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    return callGecko<GeckoPlpData>(body);
  });

const pdpInput = z.object({ url: z.string().url() });

export const geckoPdp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pdpInput.parse(d))
  .handler(async ({ data }) => {
    return callGecko<JsonValue>({
      target: "zapimoveis.com.br",
      type: "pdp",
      url: data.url,
    });
  });

const testInput = z.object({ url: z.string().url(), token: z.string().optional() });

export const geckoTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => testInput.parse(d))
  .handler(async ({ data }) => {
    return callGecko<JsonValue>(
      { target: "zapimoveis.com.br", type: "pdp", url: data.url },
      data.token,
    );
  });

export const geckoStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: !!process.env.GECKOAPI_TOKEN,
  endpoint: ENDPOINT,
}));