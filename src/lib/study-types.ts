import type { MockProperty } from "./mock-properties";

export interface StudyInput {
  finalidade: "Venda" | "Aluguel";
  tipo: string;
  cidade: string;
  estado: string;
  bairro: string;
  bairrosProximos: string[];
  endereco?: string;
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
}