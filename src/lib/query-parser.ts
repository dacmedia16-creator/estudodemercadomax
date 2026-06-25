import type { StudyInput } from "./study-types";

export interface ParsedQuery {
  partial: Partial<StudyInput>;
  missing: string[];
  blockers: string[];
  confidence: "high" | "medium" | "low";
}

const TIPO_MAP: Array<[RegExp, string]> = [
  [/\b(apto|aptos?|apartamentos?)\b/i, "Apartamento"],
  [/\bcoberturas?\b/i, "Cobertura"],
  [/\bstudios?\b/i, "Studio"],
  [/\b(kit|kitnets?|quitinetes?)\b/i, "Kitnet"],
  [/\bsobrados?\b/i, "Sobrado"],
  [/\bcasas?\b/i, "Casa"],
  [/\bsalas?\s*(comercial|comerciais)?\b/i, "Sala"],
  [/\bterrenos?\b/i, "Terreno"],
];

const DIFERENCIAIS_MAP: Array<[RegExp, string]> = [
  [/\bpiscinas?\b/i, "Piscina"],
  [/\bacademia\b/i, "Academia"],
  [/\bchurrasqueira\b/i, "Churrasqueira"],
  [/\bvaranda\s*gourmet\b/i, "Varanda gourmet"],
  [/\b(sacadas?|varandas?)\b/i, "Sacada"],
  [/\bmobiliad[oa]\b/i, "Mobiliado"],
  [/\breformad[oa]\b/i, "Reformado"],
  [/\bnov[oa]\b/i, "Novo"],
  [/\b(pet|aceita\s*pet|pets?\s*permitidos?)\b/i, "Aceita pet"],
  [/\bportaria\s*24h?\b/i, "Portaria 24h"],
  [/\belevador(es)?\b/i, "Elevador"],
  [/\bvista\s*livre\b/i, "Vista livre"],
];

const NUM_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6,
};

function parseNumberWord(s: string): number | null {
  const n = Number(s);
  if (!isNaN(n)) return n;
  return NUM_WORDS[s.toLowerCase()] ?? null;
}

/** Converts strings like "700k", "1.2mi", "1,2 milhões", "R$ 700.000", "700 mil" to a number. */
function parsePrice(raw: string): number | null {
  const s = raw.toLowerCase().replace(/r\$|\s/g, "");
  // 1.2mi / 1,2mi / 1mi
  let m = s.match(/^([\d.,]+)(mi|milhão|milhões|milhoes|m)$/);
  if (m) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!isNaN(n)) return Math.round(n * 1_000_000);
  }
  // 700k / 700mil
  m = s.match(/^([\d.,]+)(k|mil)$/);
  if (m) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!isNaN(n)) return Math.round(n * 1_000);
  }
  // 700.000 / 1.200.000 / 700000
  const digits = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(digits);
  if (!isNaN(n) && n >= 1000) return Math.round(n);
  return null;
}

const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);

const UF_BY_NAME: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amapá":"AP","amazonas":"AM","bahia":"BA",
  "ceara":"CE","ceará":"CE","distrito federal":"DF","espirito santo":"ES","espírito santo":"ES",
  "goias":"GO","goiás":"GO","maranhao":"MA","maranhão":"MA","mato grosso":"MT",
  "mato grosso do sul":"MS","minas gerais":"MG","para":"PA","pará":"PA","paraiba":"PB","paraíba":"PB",
  "parana":"PR","paraná":"PR","pernambuco":"PE","piaui":"PI","piauí":"PI","rio de janeiro":"RJ",
  "rio grande do norte":"RN","rio grande do sul":"RS","rondonia":"RO","rondônia":"RO","roraima":"RR",
  "santa catarina":"SC","sao paulo":"SP","são paulo":"SP","sergipe":"SE","tocantins":"TO",
};

/** Top BR cities for quick local detection (compact list). */
const CITY_TO_UF: Record<string, string> = {
  "são paulo":"SP","sao paulo":"SP","rio de janeiro":"RJ","brasília":"DF","brasilia":"DF",
  "salvador":"BA","fortaleza":"CE","belo horizonte":"MG","manaus":"AM","curitiba":"PR",
  "recife":"PE","porto alegre":"RS","goiânia":"GO","goiania":"GO","belém":"PA","belem":"PA",
  "guarulhos":"SP","campinas":"SP","são luís":"MA","sao luis":"MA","maceió":"AL","maceio":"AL",
  "duque de caxias":"RJ","natal":"RN","teresina":"PI","campo grande":"MS","nova iguaçu":"RJ",
  "são bernardo do campo":"SP","sao bernardo do campo":"SP","joão pessoa":"PB","joao pessoa":"PB",
  "santo andré":"SP","santo andre":"SP","osasco":"SP","jaboatão dos guararapes":"PE",
  "são josé dos campos":"SP","sao jose dos campos":"SP","ribeirão preto":"SP","ribeirao preto":"SP",
  "uberlândia":"MG","uberlandia":"MG","contagem":"MG","sorocaba":"SP","aracaju":"SE",
  "feira de santana":"BA","cuiabá":"MT","cuiaba":"MT","joinville":"SC","aparecida de goiânia":"GO",
  "londrina":"PR","juiz de fora":"MG","ananindeua":"PA","niterói":"RJ","niteroi":"RJ",
  "porto velho":"RO","serra":"ES","caxias do sul":"RS","macapá":"AP","macapa":"AP",
  "florianópolis":"SC","florianopolis":"SC","mauá":"SP","maua":"SP","são josé do rio preto":"SP",
  "sao jose do rio preto":"SP","mogi das cruzes":"SP","santos":"SP","betim":"MG","diadema":"SP",
  "campina grande":"PB","jundiaí":"SP","jundiai":"SP","carapicuíba":"SP","piracicaba":"SP",
  "olinda":"PE","cariacica":"ES","bauru":"SP","montes claros":"MG","blumenau":"SC",
  "vitória":"ES","vitoria":"ES","vila velha":"ES","caucaia":"CE","canoas":"RS","franca":"SP",
  "pelotas":"RS","ponta grossa":"PR","maringá":"PR","maringa":"PR","anápolis":"GO","anapolis":"GO",
  "petrolina":"PE","viamão":"RS","viamao":"RS","gravataí":"RS","gravatai":"RS",
  "santa maria":"RS","cascavel":"PR","foz do iguaçu":"PR","foz do iguacu":"PR",
  "são josé":"SC","sao jose":"SC","caruaru":"PE","taubaté":"SP","taubate":"SP",
  "praia grande":"SP","limeira":"SP","suzano":"SP","são vicente":"SP","sao vicente":"SP",
  "barueri":"SP","embu das artes":"SP","palmas":"TO","governador valadares":"MG",
  "volta redonda":"RJ","ipatinga":"MG","santarém":"PA","santarem":"PA","mossoró":"RN",
  "mossoro":"RN","petrópolis":"RJ","petropolis":"RJ","americana":"SP","colombo":"PR",
  "alvorada":"RS","arapiraca":"AL","rio branco":"AC","boa vista":"RR",
  "criciúma":"SC","criciuma":"SC","itajaí":"SC","itajai":"SC","chapecó":"SC","chapeco":"SC",
};

const BAIRROS_POR_CIDADE: Record<string, string[]> = {
  "curitiba": ["Água Verde","Batel","Centro","Cabral","Bigorrilho","Mercês","Champagnat","Ecoville","Portão","Vila Izabel","Rebouças","Cristo Rei","Juvevê","Alto da Glória","Alto da Rua XV","Santa Felicidade","Bacacheri","Boa Vista","Hugo Lange","Jardim Social","São Francisco","Tarumã","Capão Raso","Pinheirinho","Boqueirão","Hauer","Tingui","Novo Mundo","Xaxim","Jardim Botânico","Prado Velho","Bom Retiro","Seminário","Campo Comprido","Mossunguê","Cajuru","Uberaba","Fazendinha","Cidade Industrial"],
  "são paulo": ["Vila Mariana","Moema","Itaim Bibi","Pinheiros","Vila Olímpia","Brooklin","Jardins","Jardim Paulista","Jardim Europa","Jardim América","Higienópolis","Perdizes","Pompeia","Lapa","Vila Madalena","Sumaré","Bela Vista","Consolação","República","Liberdade","Centro","Aclimação","Paraíso","Vila Nova Conceição","Campo Belo","Santo Amaro","Morumbi","Vila Andrade","Butantã","Tatuapé","Mooca","Ipiranga","Saúde","Vila Prudente","Anália Franco","Vila Romana","Barra Funda","Santana","Vila Leopoldina","Alto de Pinheiros"],
  "rio de janeiro": ["Copacabana","Ipanema","Leblon","Botafogo","Flamengo","Laranjeiras","Catete","Glória","Tijuca","Vila Isabel","Andaraí","Grajaú","Maracanã","Barra da Tijuca","Recreio dos Bandeirantes","Jacarepaguá","Freguesia","Taquara","Lagoa","Gávea","Jardim Botânico","Humaitá","Urca","Centro","Santa Teresa","São Cristóvão","Méier","Cachambi","Penha","Vila da Penha","Campo Grande","Bangu","Realengo"],
  "belo horizonte": ["Savassi","Funcionários","Lourdes","Centro","Santo Agostinho","Carmo","Sion","Mangabeiras","Belvedere","Vila da Serra","Anchieta","Cruzeiro","Serra","Santa Lúcia","Buritis","Estoril","Pampulha","Castelo","Cidade Nova","Floresta","Santa Efigênia","Padre Eustáquio","Sagrada Família","Prado","Gutierrez","Caiçaras"],
  "porto alegre": ["Moinhos de Vento","Bela Vista","Petrópolis","Mont Serrat","Auxiliadora","Higienópolis","Boa Vista","Floresta","Independência","Centro","Cidade Baixa","Bom Fim","Rio Branco","Menino Deus","Tristeza","Cristal","Cavalhada","Ipanema","Jardim Botânico","Partenon","Santa Cecília","Três Figueiras","Chácara das Pedras"],
  "florianópolis": ["Centro","Trindade","Córrego Grande","Itacorubi","Santa Mônica","Pantanal","Carvoeira","Agronômica","Beira Mar Norte","Jurerê","Jurerê Internacional","Canasvieiras","Ingleses","Cachoeira do Bom Jesus","Lagoa da Conceição","Campeche","Rio Tavares","Coqueiros","Estreito","Capoeiras","Itaguaçu","João Paulo","Saco Grande","Cacupé","Santo Antônio de Lisboa"],
  "salvador": ["Barra","Ondina","Rio Vermelho","Pituba","Itaigara","Caminho das Árvores","Horto Florestal","Graça","Vitória","Canela","Federação","Brotas","Costa Azul","Imbuí","Patamares","Stella Maris","Piatã","Itapuã","Pelourinho","Campo Grande"],
  "brasília": ["Asa Sul","Asa Norte","Lago Sul","Lago Norte","Sudoeste","Noroeste","Octogonal","Cruzeiro","Águas Claras","Taguatinga","Guará","Park Sul","Park Way","Vicente Pires","Jardim Botânico"],
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Parses a free-form Portuguese real estate query into a partial StudyInput. */
export function parseQueryLocal(input: string): ParsedQuery {
  const text = input.trim();
  const lower = " " + text.toLowerCase() + " ";
  const partial: Partial<StudyInput> = {
    bairrosProximos: [],
    diferenciais: [],
    portais: ["Zap Imóveis"],
  };

  // Finalidade
  if (/\b(aluguel|alugar|locação|locacao|alugando|para alugar)\b/i.test(text)) {
    partial.finalidade = "Aluguel";
  } else if (/\b(venda|comprar|à venda|a venda|vender)\b/i.test(text)) {
    partial.finalidade = "Venda";
  } else {
    partial.finalidade = "Venda";
  }

  // Tipo
  for (const [re, tipo] of TIPO_MAP) {
    if (re.test(text)) { partial.tipo = tipo; break; }
  }

  // Quartos
  const qMatch = text.match(/(\d+|um|uma|dois|duas|três|tres|quatro|cinco|seis)\s*(?:q|qtos?|quartos?|dorm(?:itórios?|itorios?)?|dormi?)\b/i);
  if (qMatch) {
    const n = parseNumberWord(qMatch[1]);
    if (n) partial.quartos = n;
  }
  // Suítes
  const sMatch = text.match(/(\d+|um|uma|dois|duas|três|tres|quatro|cinco)\s*su[íi]tes?\b/i);
  if (sMatch) { const n = parseNumberWord(sMatch[1]); if (n) partial.suites = n; }
  // Vagas
  const vMatch = text.match(/(\d+|um|uma|dois|duas|três|tres|quatro|cinco)\s*(?:vagas?|garagens?)\b/i);
  if (vMatch) { const n = parseNumberWord(vMatch[1]); if (n) partial.vagas = n; }
  // Banheiros
  const bMatch = text.match(/(\d+|um|uma|dois|duas|três|tres|quatro)\s*banheiros?\b/i);
  if (bMatch) { const n = parseNumberWord(bMatch[1]); if (n) partial.banheiros = n; }

  // Área
  const aMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros?(?:\s*quadrados?)?)\b/i);
  if (aMatch) {
    const n = parseFloat(aMatch[1].replace(",", "."));
    if (!isNaN(n)) partial.areaUtil = Math.round(n);
  }

  // Preço — múltiplos padrões
  const priceTokens = /[\d.,]+\s*(?:k|mil|mi|m|milhão|milhões|milhoes)?/gi;
  // "entre X e Y" / "de X a Y"
  const rangeMatch = text.match(/(?:entre|de)\s+(r?\$?\s?[\d.,]+\s*(?:k|mil|mi|m|milhão|milhões|milhoes)?)\s+(?:e|a|até)\s+(r?\$?\s?[\d.,]+\s*(?:k|mil|mi|m|milhão|milhões|milhoes)?)/i);
  if (rangeMatch) {
    const a = parsePrice(rangeMatch[1]);
    const b = parsePrice(rangeMatch[2]);
    if (a && b) partial.valorPretendido = Math.round((a + b) / 2);
  } else {
    const ateMatch = text.match(/(?:até|max(?:imo|imo)?|no\s*m[áa]ximo)\s+(r?\$?\s?[\d.,]+\s*(?:k|mil|mi|m|milhão|milhões|milhoes)?)/i);
    if (ateMatch) {
      const p = parsePrice(ateMatch[1]);
      if (p) partial.valorPretendido = p;
    } else {
      const porMatch = text.match(/(?:por|valor|preço|preco)\s+(r?\$?\s?[\d.,]+\s*(?:k|mil|mi|m|milhão|milhões|milhoes)?)/i);
      if (porMatch) {
        const p = parsePrice(porMatch[1]);
        if (p) partial.valorPretendido = p;
      } else {
        // standalone "700k", "1.2mi", "R$ 700.000"
        const matches = text.match(priceTokens) ?? [];
        for (const t of matches) {
          const p = parsePrice(t);
          if (p && p >= 50_000) { partial.valorPretendido = p; break; }
        }
      }
    }
  }

  // Estado (UF)
  const ufMatch = text.match(/\b([A-Z]{2})\b/);
  if (ufMatch && UFS.has(ufMatch[1])) partial.estado = ufMatch[1];

  // Cidade — buscar por nome conhecido (com e sem acento)
  const lowerNoAcc = stripAccents(lower);
  let cityKey: string | null = null;
  for (const [city, uf] of Object.entries(CITY_TO_UF)) {
    const needle = stripAccents(city);
    if (lowerNoAcc.includes(` ${needle} `) || lowerNoAcc.includes(` ${needle},`)) {
      partial.cidade = city.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
      if (!partial.estado) partial.estado = uf;
      cityKey = city;
      break;
    }
  }

  // Estado por nome
  if (!partial.estado) {
    for (const [name, uf] of Object.entries(UF_BY_NAME)) {
      if (lowerNoAcc.includes(` ${stripAccents(name)} `)) { partial.estado = uf; break; }
    }
  }

  // Bairro — heurística "bairro X" ou "em X" ou "no/na X"
  const bairroMatch = text.match(/\bbairro\s+([A-ZÀ-Ú][\wÀ-ú\s]{2,30}?)(?=[,.\n]|$|\s+(?:em|na|no|com|por|até|de|aluguel|venda))/i);
  if (bairroMatch) {
    partial.bairro = bairroMatch[1].trim();
  }
  if (!partial.bairro && cityKey && BAIRROS_POR_CIDADE[cityKey]) {
    const textNoAcc = stripAccents(text.toLowerCase());
    let best: string | null = null;
    let bestLen = 0;
    for (const b of BAIRROS_POR_CIDADE[cityKey]) {
      const needle = stripAccents(b.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?:^|[^a-z0-9])${needle}(?:[^a-z0-9]|$)`);
      if (re.test(textNoAcc) && needle.length > bestLen) {
        best = b;
        bestLen = needle.length;
      }
    }
    if (best) partial.bairro = best;
  }
  if (!partial.bairro && partial.cidade) {
    // "<Palavras Capitalizadas> <Cidade>"
    const cityWords = partial.cidade.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    const re = new RegExp(`([A-ZÀ-Ú][\\wÀ-ú]+(?:\\s+(?:da|de|do|das|dos)\\s+[A-ZÀ-Ú][\\wÀ-ú]+|\\s+[A-ZÀ-Ú][\\wÀ-ú]+){0,2})\\s+${cityWords}\\b`);
    const m = text.match(re);
    if (m) {
      const cand = m[1].trim();
      const banned = ["apartamento","apartamentos","casa","casas","cobertura","studio","kitnet","sobrado","sala","terreno"];
      if (!banned.includes(cand.toLowerCase()) && cand.length > 2) partial.bairro = cand;
    }
  }
  if (!partial.bairro) {
    const noMatch = text.match(/\b(?:no|na|em)\s+([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+){0,2})\b/);
    if (noMatch && partial.cidade && !stripAccents(noMatch[1].toLowerCase()).includes(stripAccents(partial.cidade.toLowerCase()))) {
      partial.bairro = noMatch[1].trim();
    }
  }

  // Diferenciais
  const difs: string[] = [];
  for (const [re, label] of DIFERENCIAIS_MAP) {
    if (re.test(text)) difs.push(label);
  }
  partial.diferenciais = difs;

  // Edifício / condomínio — "no edifício X" / "condomínio X"
  const edMatch = text.match(/\b(?:edif[íi]cio|cond(?:om[íi]nio)?|residencial)\s+([A-ZÀ-Ú][\wÀ-ú\s]{2,40}?)(?=[,.\n]|$|\s+(?:em|na|no|com|por|até))/i);
  if (edMatch) partial.edificio = edMatch[1].trim();

  const missing: string[] = [];
  if (!partial.tipo) missing.push("tipo");
  if (!partial.cidade) missing.push("cidade");
  if (!partial.bairro) missing.push("bairro");
  if (!partial.quartos && !partial.areaUtil && !partial.valorPretendido) missing.push("características");

  const blockers: string[] = [];
  if (!partial.cidade) blockers.push("cidade");

  const confidence: ParsedQuery["confidence"] =
    missing.length === 0 ? "high" : missing.length <= 1 ? "medium" : "low";

  return { partial, missing, blockers, confidence };
}

/** Merges parsed result into a complete StudyInput, filling sensible defaults. */
export function mergeWithDefaults(parsed: Partial<StudyInput>): StudyInput {
  return {
    finalidade: parsed.finalidade ?? "Venda",
    tipo: parsed.tipo ?? "Apartamento",
    cidade: parsed.cidade ?? "",
    estado: parsed.estado ?? "",
    bairro: parsed.bairro ?? "",
    bairrosProximos: parsed.bairrosProximos ?? [],
    endereco: parsed.endereco,
    numero: parsed.numero,
    complemento: parsed.complemento,
    edificio: parsed.edificio,
    areaUtil: parsed.areaUtil ?? 80,
    areaTotal: parsed.areaTotal,
    quartos: parsed.quartos ?? 2,
    suites: parsed.suites ?? 0,
    banheiros: parsed.banheiros ?? Math.max(1, parsed.quartos ?? 2 - 1),
    vagas: parsed.vagas ?? 1,
    andar: parsed.andar,
    condominio: parsed.condominio ?? 0,
    iptu: parsed.iptu ?? 0,
    valorPretendido: parsed.valorPretendido ?? 500_000,
    anoConstrucao: parsed.anoConstrucao,
    diferenciais: parsed.diferenciais ?? [],
    outrosDiferenciais: parsed.outrosDiferenciais,
    portais: parsed.portais ?? ["Zap Imóveis"],
  };
}