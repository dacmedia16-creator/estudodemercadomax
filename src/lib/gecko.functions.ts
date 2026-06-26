import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { GeckoCallResult, GeckoPlpData, JsonValue } from "./gecko-types";

const ENDPOINT = "https://api.geckoapi.com.br/v1/extract";

const TARGETS = ["zapimoveis.com.br", "chavesnamao.com.br", "olx.com.br"] as const;
type Target = (typeof TARGETS)[number];

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
  target: z.enum(TARGETS).optional().default("zapimoveis.com.br"),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  businessType: z.enum(["sale", "rent"]),
  keyword: z.string().optional(),
  propertyType: z.string().optional(),
  // Chaves na Mão–specific (harmless when target=zap and field absent).
  neighborhood: z.string().optional(),
  propertyTypes: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  directOwner: z.boolean().optional(),
  condominium: z.boolean().optional(),
  includeLaunches: z.boolean().optional(),
  sort: z.string().optional(),
  // OLX-only PLP fields.
  region: z.string().optional(),
  categoryPath: z.string().optional(),
  bedrooms: z.array(z.number().int()).optional(),
  bathrooms: z.array(z.number().int()).optional(),
  parkingSpots: z.array(z.number().int()).optional(),
  priceMin: z.number().int().optional(),
  priceMax: z.number().int().optional(),
  areaMin: z.number().int().optional(),
  areaMax: z.number().int().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radius: z.number().optional(),
  page: z.number().int().min(1).default(1),
});

export const geckoPlp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => plpInput.parse(d))
  .handler(async ({ data }) => {
    const {
      city, state, keyword, target, propertyType,
      neighborhood, propertyTypes, amenities, directOwner, condominium, includeLaunches, sort,
      region, categoryPath,
      bedrooms, bathrooms, parkingSpots, priceMin, priceMax, areaMin, areaMax,
      latitude, longitude, radius, ...rest
    } = data;
    const hasCity = !!city && city.trim().length > 0;
    const hasState = !!state && state.trim().length === 2;
    const hasKeyword = !!keyword && keyword.trim().length > 0;
    if (target === "olx.com.br") {
      // OLX PLP requires `state` (UF 2 letras) when no URL is provided.
      if (!hasState) {
        return { ok: false as const, status: 0, errorCode: "MISSING_QUERY", errorMessage: "OLX exige UF (state) na busca PLP." };
      }
    } else if (!hasCity && !hasKeyword) {
      return { ok: false as const, status: 0, errorCode: "MISSING_QUERY", errorMessage: "Informe ao menos uma cidade ou palavra-chave para buscar." };
    }
    // OLX uses a completely different parameter vocabulary — handle it
    // separately to avoid sending fields the upstream rejects.
    if (target === "olx.com.br") {
      const olxBody: Record<string, unknown> = {
        target,
        type: "plp",
        state,
        page: rest.page,
        businessType: rest.businessType,
      };
      if (hasCity) olxBody.city = city;
      if (hasKeyword) olxBody.keyword = keyword;
      if (region && region.trim()) olxBody.region = region;
      if (categoryPath && categoryPath.trim()) olxBody.categoryPath = categoryPath;
      if (typeof priceMin === "number" && priceMin >= 0) olxBody.priceMin = priceMin;
      if (typeof priceMax === "number" && priceMax >= 0) olxBody.priceMax = priceMax;
      if (sort) olxBody.sort = sort;
      Object.keys(olxBody).forEach((k) => olxBody[k] === undefined && delete olxBody[k]);
      return callGecko<GeckoPlpData>(olxBody);
    }
    const body: Record<string, unknown> = {
      target,
      type: "plp",
      ...rest,
    };
    if (hasCity) body.city = city;
    if (hasState) body.state = state;
    // Chaves PLP does NOT accept `keyword` — only Zap does.
    if (hasKeyword && target === "zapimoveis.com.br") body.keyword = keyword;
    // propertyType uses Zap's vocabulary (APARTMENT/HOME/…); only send it
    // when targeting Zap to avoid over-filtering on Chaves na Mão.
    if (propertyType && target === "zapimoveis.com.br") body.propertyType = propertyType;
    // Chaves-only fields.
    if (target === "chavesnamao.com.br") {
      if (neighborhood && neighborhood.trim().length > 0) body.neighborhood = neighborhood;
      if (propertyTypes && propertyTypes.length) body.propertyTypes = propertyTypes;
      if (amenities && amenities.length) body.amenities = amenities;
      if (typeof directOwner === "boolean") body.directOwner = directOwner;
      if (typeof condominium === "boolean") body.condominium = condominium;
      if (typeof includeLaunches === "boolean") body.includeLaunches = includeLaunches;
      if (sort) body.sort = sort;
    }
    // Native PLP filters — supported by Zap (and harmless when ignored by Chaves).
    if (bedrooms && bedrooms.length) body.bedrooms = bedrooms;
    if (bathrooms && bathrooms.length) body.bathrooms = bathrooms;
    if (parkingSpots && parkingSpots.length) body.parkingSpots = parkingSpots;
    if (typeof priceMin === "number" && priceMin >= 0) body.priceMin = priceMin;
    if (typeof priceMax === "number" && priceMax >= 0) body.priceMax = priceMax;
    if (typeof areaMin === "number" && areaMin >= 0) body.areaMin = areaMin;
    if (typeof areaMax === "number" && areaMax >= 0) body.areaMax = areaMax;
    if (typeof latitude === "number" && typeof longitude === "number") {
      body.latitude = latitude;
      body.longitude = longitude;
      if (typeof radius === "number" && radius > 0) body.radius = radius;
    }
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
    return callGecko<GeckoPlpData>(body);
  });

const pdpInput = z.object({
  url: z.string().url(),
  target: z.enum(TARGETS).optional().default("zapimoveis.com.br"),
});

export const geckoPdp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => pdpInput.parse(d))
  .handler(async ({ data }) => {
    return callGecko<JsonValue>({
      target: data.target,
      type: "pdp",
      url: data.url,
    });
  });

const testInput = z.object({
  url: z.string().url(),
  token: z.string().optional(),
  target: z.enum(TARGETS).optional().default("zapimoveis.com.br"),
});

export const geckoTest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => testInput.parse(d))
  .handler(async ({ data }) => {
    return callGecko<JsonValue>(
      { target: data.target, type: "pdp", url: data.url },
      data.token,
    );
  });

export const geckoStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: !!process.env.GECKOAPI_TOKEN,
  endpoint: ENDPOINT,
}));

const plpTestInput = z.object({
  target: z.enum(TARGETS),
  city: z.string().optional().default(""),
  keyword: z.string().optional().default(""),
  state: z.string().optional().default(""),
  businessType: z.enum(["sale", "rent"]).optional().default("sale"),
  token: z.string().optional(),
});

export const geckoTestPlp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => plpTestInput.parse(d))
  .handler(async ({ data }) => {
    const body: Record<string, unknown> = {
      target: data.target,
      type: "plp",
      businessType: data.businessType,
      page: 1,
    };
    if (data.city) body.city = data.city;
    if (data.keyword) body.keyword = data.keyword;
    if (data.state && data.state.length === 2) body.state = data.state;
    if (data.target === "olx.com.br" && !body.state) {
      return { ok: false as const, status: 0, errorCode: "MISSING_QUERY", errorMessage: "OLX exige state (UF 2 letras)." };
    }
    if (data.target !== "olx.com.br" && !data.city && !data.keyword) {
      return { ok: false as const, status: 0, errorCode: "MISSING_QUERY", errorMessage: "Informe city ou keyword." };
    }
    return callGecko<JsonValue>(body, data.token);
  });