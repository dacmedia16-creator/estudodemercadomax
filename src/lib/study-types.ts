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
  /** True quando todos os campos em modo "prefer" foram atendidos por este imóvel. */
  preferenciaAtendida?: boolean;
  /** True quando o preço foge muito da distribuição (P90×1.3 ou P10×0.7). */
  outlier?: boolean;
  /**
   * Score de confiança 0–100 calculado a partir de completude (área/condomínio/
   * fotos), idade do anúncio (DOM) e se passou no filtro estrito ou foi
   * recuperado por camada ampla. Imóveis com score < 30 são excluídos
   * do cálculo de mediana/média; score < 50 entra com peso 0.5.
   */
  confidenceScore?: number;
  /** Motivos resumidos do score — exibidos como badge no PDF/UI. */
  confidenceFactors?: string[];
  /** Quantos anúncios diferentes apontam para o mesmo imóvel (deduplicação). */
  dedupCount?: number;
  /** Resumo dos anunciantes agrupados (até 3). */
  dedupAnunciantes?: string[];
}

export interface StudyStats {
  /** Distribuição de R$/m² dos comparáveis. */
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  minM2: number;
  maxM2: number;
  /** Preço total mais barato observado (R$). */
  minTotal: number;
  /** Desvio padrão de R$/m² (amostra ponderada por confiança). */
  stdM2?: number;
  /** Tamanho efetivo da amostra (Σ pesos). */
  effectiveN?: number;
  /** Heurística sobre dispersão: 'baixa' | 'media' | 'alta'. */
  dispersao?: "baixa" | "media" | "alta";
}

export interface AiAnalysis {
  resumo: string;
  faixaRecomendada: { entrada: number; ideal: number; teto: number };
  posicionamento: string;
  riscos: string[];
  recomendacoes: string[];
  geradoEm: string;
  /** Texto pronto, empático e profissional para o corretor levar ao proprietário. */
  discursoProprietario?: string;
  /** Bullets curtos com os argumentos de mercado mais fortes. */
  argumentosChave?: string[];
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
  /** Estatísticas (percentis) calculadas a partir dos comparáveis. */
  stats?: StudyStats;
  /** Análise qualitativa opcional gerada por IA. */
  aiAnalysis?: AiAnalysis;
  /** Intervalo de confiança do Valor Ideal (mín/ideal/máx) — usado no PDF. */
  valorIdealRange?: { min: number; ideal: number; max: number; confianca: "alta" | "media" | "baixa" };
  /** Estratégia sugerida automaticamente pelo motor (P25/mediana/P75). */
  estrategiaSugerida?: { estrategia: "agressivo" | "equilibrado" | "premium"; motivo: string };
  /** True quando a IA divergiu > 15% da mediana × área e foi sobrescrita. */
  iaSobrescrita?: boolean;
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
  /**
   * Estratégia de precificação aplicada sobre os percentis dos comparáveis.
   * - "agressivo": parte do P25 (vende rápido, ancorado nos mais baratos)
   * - "equilibrado": parte da mediana (default, robusta a outliers)
   * - "premium": parte do P75 (posicionamento acima do meio)
   */
  estrategia?: "agressivo" | "equilibrado" | "premium";
  /** Quando true, o sugerido nunca passa do piso × (1 + maxAcimaPisoPct/100). */
  respeitarPiso?: boolean;
  /** Distância máxima permitida acima do piso competitivo (%). Default 8. */
  maxAcimaPisoPct?: number;
}

export const DEFAULT_ACM: AcmAdjustments = {
  localizacao: 100,
  conservacao: 100,
  idade: 100,
  padrao: 100,
  reformaPorM2: 0,
  margemPublicacaoPct: 5,
  estrategia: "equilibrado",
  respeitarPiso: true,
  maxAcimaPisoPct: 8,
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
   * Quando true (default), aplica os limites de quartos (±1) e área (±25%)
   * também nas camadas "Mesmo prédio" e "Mesmo endereço" — evita listar
   * tipologias diferentes do mesmo condomínio (ex.: 1 dorm/45 m² quando
   * o imóvel base é 3 dorm/140 m²).
   */
  filtrarAncoras?: boolean;
  /**
   * Per-field mode for the "extra" property attributes (suites, vagas, etc.).
   * - "ignore": campo só aparece no relatório, não afeta busca nem similaridade.
   * - "soft":   pesa na similaridade mas não elimina nada.
   * - "hard":   imóveis que não batem são removidos do resultado final.
   * Quando ausente, cada campo cai no default histórico (soft para suites/vagas/diferenciais, ignore para o resto).
   */
  fieldModes?: Partial<Record<FieldKey, FieldMode>>;
}

/**
 * Modos disponíveis para cada campo extra:
 * - "ignore": campo só aparece no relatório, não afeta busca nem similaridade.
 * - "soft":   pesa normalmente na similaridade, sem eliminar nada.
 * - "prefer": prioriza imóveis que atendem ao critério (peso dobrado + bônus
 *             na similaridade e badge "Match preferido"), mas NÃO elimina
 *             os que não atendem.
 * - "hard":   imóveis que não batem são removidos do resultado final.
 */
export type FieldMode = "ignore" | "soft" | "prefer" | "hard";
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