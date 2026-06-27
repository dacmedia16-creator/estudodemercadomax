import type { MockProperty } from "./mock-properties";

export interface StudyInput {
  finalidade: "Venda" | "Aluguel";
  tipo: string;
  cidade: string;
  estado: string;
  bairro: string;
  bairrosProximos: string[];
  endereco?: string;
  numero?: string;
  complemento?: string;
  edificio?: string;
  areaUtil: number;
  areaTotal?: number;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  andar?: number;
  condominio: number;
  iptu: number;
  valorPretendido: number;
  anoConstrucao?: number;
  diferenciais: string[];
  outrosDiferenciais?: string;
  portais: string[];
}

export interface ComparableProperty extends MockProperty {
  precoM2: number;
  similaridade: number;
  mesmoCondominio?: boolean;
  mesmoEndereco?: boolean;
  /** "busca" (default) ou "manual" quando adicionado por URL pelo usuário. */
  origem?: "busca" | "manual";
}

export interface StudyResult {
  id: string;
  createdAt: string;
  input: StudyInput;
  comparaveis: ComparableProperty[];
  precoMedio: number;
  precoM2Medio: number;
  menorPreco: number;
  maiorPreco: number;
  faixaMin: number;
  faixaMax: number;
  precoM2Pretendido: number;
  status: "Abaixo da média" | "Dentro da média" | "Acima da média";
  diagnostico: string;
  pontosFortes: string[];
  pontosAtencao: string[];
  tituloSugerido: string;
  descricaoSugerida: string;
  argumentoProprietario: string;
  criteriosAplicados?: string[];
  funilBusca?: { etapa: string; total: number }[];
  overridesAplicados?: SearchOverrides;
  revisao?: number;
  /** Ajustes ACM (Análise Comparativa de Mercado) — editáveis no relatório. */
  acm?: AcmAdjustments;
}

export interface AcmAdjustments {
  /** Fatores percentuais (100 = neutro, range típico 80–120). */
  localizacao: number;
  conservacao: number;
  idade: number;
  padrao: number;
  /** Custo de reforma estimado por m² em R$. */
  reformaPorM2: number;
  /** Margem de negociação aplicada ao valor de publicação (%). */
  margemPublicacaoPct: number;
}

export const DEFAULT_ACM: AcmAdjustments = {
  localizacao: 100,
  conservacao: 100,
  idade: 100,
  padrao: 100,
  reformaPorM2: 0,
  margemPublicacaoPct: 5,
};

export interface SearchOverrides {
  keyword?: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  bairrosProximos?: string[];
  tipo?: string;
  finalidade?: "Venda" | "Aluguel";
  quartosMin?: number;
  quartosMax?: number;
  areaMin?: number;
  areaMax?: number;
  priceMin?: number;
  priceMax?: number;
  autoExpand?: boolean;
  edificio?: string;
  priorizarEdificio?: boolean;
  maxPages?: number;
  /** Search radius in km around the geocoded address (1–5). Default 2 when geo is available. */
  radiusKm?: number;
  /**
   * Per-field mode for the "extra" property attributes (suites, vagas, etc.).
   * - "ignore": campo só aparece no relatório, não afeta busca nem similaridade.
   * - "soft":   pesa na similaridade mas não elimina nada.
   * - "hard":   imóveis que não batem são removidos do resultado final.
   * Quando ausente, cada campo cai no default histórico (soft para suites/vagas/diferenciais, ignore para o resto).
   */
  fieldModes?: Partial<Record<FieldKey, FieldMode>>;
}

export type FieldMode = "ignore" | "soft" | "hard";
export type FieldKey =
  | "suites"
  | "banheiros"
  | "vagas"
  | "andar"
  | "anoConstrucao"
  | "condominio"
  | "iptu"
  | "diferenciais";

export const FIELD_KEYS: FieldKey[] = [
  "suites", "banheiros", "vagas", "andar", "anoConstrucao", "condominio", "iptu", "diferenciais",
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  suites: "Suítes",
  banheiros: "Banheiros",
  vagas: "Vagas",
  andar: "Andar",
  anoConstrucao: "Ano de construção",
  condominio: "Condomínio (R$)",
  iptu: "IPTU (R$)",
  diferenciais: "Diferenciais",
};

/** Default mode quando o usuário não escolheu nada — preserva o comportamento atual. */
export const DEFAULT_FIELD_MODES: Record<FieldKey, FieldMode> = {
  suites: "soft",
  banheiros: "ignore",
  vagas: "soft",
  andar: "ignore",
  anoConstrucao: "ignore",
  condominio: "ignore",
  iptu: "ignore",
  diferenciais: "soft",
};