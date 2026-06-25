export interface GeckoItem {
  position?: number;
  id?: string;
  url?: string;
  business?: string;
  listingType?: string;
  description?: string;
  address?: {
    city?: string;
    state?: string;
    neighborhood?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  prices?: { mainValue?: number; period?: string };
  stamps?: string[];
  amenities?: string[];
  advertiser?: { id?: string; name?: string };
  images?: { url?: string }[];
  childrenCount?: number;
}

export interface GeckoPlpData {
  source?: string;
  type?: string;
  url?: string;
  city?: string;
  state?: string;
  businessType?: string;
  totalResults?: number;
  page?: number;
  nextPage?: number | null;
  items?: GeckoItem[];
}

export interface GeckoResponse<T> {
  requestId?: string;
  executionId?: string;
  notFound?: boolean;
  data: T | null;
}

export type GeckoPlpResponse = GeckoResponse<GeckoPlpData>;
export type GeckoPdpResponse = GeckoResponse<Record<string, unknown>>;

export interface GeckoCallResult<T> {
  ok: boolean;
  status: number;
  errorCode?: string;
  errorMessage?: string;
  notFound?: boolean;
  data?: T | null;
  raw?: unknown;
}