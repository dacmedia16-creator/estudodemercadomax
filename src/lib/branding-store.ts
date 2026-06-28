/**
 * Configurações de marca usadas no relatório ACM (logo, nome, cores).
 * Persistidas em localStorage por navegador/usuário.
 */
export interface BrandingSettings {
  /** dataURL (image/png ou jpeg) ou URL pública. */
  logoUrl?: string;
  brandName: string;
  /** Cor primária — usada em faixas e bordas da página ACM. */
  brandColor: string;
  /** Cor secundária — usada no logo placeholder / destaque do título. */
  accentColor: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: undefined,
  brandName: "Estudo de Mercado Pro",
  brandColor: "#003DA5",
  accentColor: "#DC1C2E",
};

const KEY = "radar.branding.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export const brandingStore = {
  get(): BrandingSettings {
    if (!isBrowser()) return DEFAULT_BRANDING;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULT_BRANDING;
      const parsed = JSON.parse(raw) as Partial<BrandingSettings>;
      return { ...DEFAULT_BRANDING, ...parsed };
    } catch {
      return DEFAULT_BRANDING;
    }
  },
  set(b: BrandingSettings) {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(b));
    } catch {}
  },
  reset() {
    if (!isBrowser()) return;
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};