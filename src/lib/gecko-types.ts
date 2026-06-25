export interface GeckoItem {
  position?: number;
  id?: string;
  url?: string;
  business?: string;
  listingType?: string;
  propertyType?: string;
  unitType?: string;
  bedrooms?: number | number[];
  bathrooms?: number | number[];
  parkingSpaces?: number | number[];
  suites?: number | number[];
  usableAreas?: number | number[];
  totalAreas?: number | number[];
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

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface GeckoCallResult<T> {
  ok: boolean;
  status: number;
  errorCode?: string;
  errorMessage?: string;
  notFound?: boolean;
  data?: T | null;
}