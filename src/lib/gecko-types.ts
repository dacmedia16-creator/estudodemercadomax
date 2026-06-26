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
    street?: string;
    zipCode?: string;
  };
  prices?: {
    mainValue?: number;
    price?: number;
    period?: string;
    monthlyCondoFee?: number;
    iptu?: number;
    rentalPeriod?: string;
    rentalWarranties?: string[];
  };
  stamps?: string[];
  amenities?: string[];
  mainAmenities?: string[];
  infoTags?: string[];
  publicationType?: string;
  virtualTourUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  advertiser?: {
    id?: string;
    name?: string;
    mainPhone?: string;
    phoneNumbers?: string[];
    whatsAppNumber?: string | null;
    creci?: string;
    rating?: { score?: number | null; totalRatings?: number | null } | null;
    logoUrl?: string | null;
  };
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