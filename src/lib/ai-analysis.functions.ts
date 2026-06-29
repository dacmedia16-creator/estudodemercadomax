import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const comparavelSchema = z.object({
  titulo: z.string().optional().default(""),
  bairro: z.string().optional().default(""),
  areaUtil: z.number().optional().default(0),
  quartos: z.number().optional().default(0),
  preco: z.number(),
  precoM2: z.number().optional().default(0),
  similaridade: z.number().optional().default(0),
  portal: z.string().optional().default(""),
});

const inputSchema = z.object({
  imovel: z.object({
    tipo: z.string(),
    finalidade: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    estado: z.string(),
    areaUtil: z.number(),
    quartos: z.number(),
    suites: z.number(),
    vagas: z.number(),
    condominio: z.number(),
    iptu: z.number(),
    valorPretendido: z.number(),
    diferenciais: z.array(z.string()).default([]),
    edificio: z.string().optional(),
  }),
  mercado: z.object({
    precoMedio: z.number(),
    precoM2Medio: z.number(),
    menorPreco: z.number(),
    maiorPreco: z.number(),
    p10: z.number().optional(),
    p25: z.number().optional(),
    median: z.number().optional(),
    p75: z.number().optional(),
    p90: z.number().optional(),
    valorPiso: z.number().optional(),
    valorSugerido: z.number().optional(),
  }),
  comparaveis: z.array(comparavelSchema).max(15),
});

const SYSTEM = `Você é um especialista em precificação de imóveis no Brasil, atuando como
consultor para corretores. Sua missão é traduzir os números de uma ACM (Análise
Comparativa de Mercado) em uma recomendação prática, justificada e segura para
o corretor levar ao proprietário.

Regras críticas:
- NUNCA sugira um valor de venda muito acima do menor preço observado: a
  faixa ideal deve respeitar o "piso competitivo" e ficar próxima do P25/mediana.
- Sempre considere risco de "encalhe" quando o pretendido estiver muito acima
  da mediana.
- Justifique cada faixa com 1–2 frases curtas, em português brasileiro, tom
  profissional, sem jargão.
- Não invente dados que não estão no payload.
- NUNCA descreva o imóvel como "bem posicionado", "bem precificado", "no preço
  certo", "preço justo" ou frases equivalentes — mesmo quando o pretendido
  estiver dentro da média. Sempre traga a leitura para velocidade de venda,
  competitividade frente à concorrência e risco de tempo no portal.
- NUNCA sugira aumentar o valor pretendido, nem mesmo quando ele estiver
  abaixo da mediana. Se estiver abaixo, reforce que essa é a posição
  competitiva ideal para acelerar a venda — jamais convide a "subir o preço",
  "reajustar para cima" ou "aproveitar margem".
- Não use a palavra "diferenciais" como argumento para sustentar ou justificar
  o preço atual. Diferenciais entram apenas como apoio à decisão de venda
  rápida (ex.: ajudam a justificar ficar no topo da faixa competitiva, não a
  romper para cima dela).
- O tom precisa proteger o corretor de qualquer brecha que dê ao proprietário
  argumento para manter ou subir o valor pretendido.
- Sempre que sugerir um ajuste de preço, **ancore a recomendação no
  `faixaRecomendada.ideal`** (o "valor ideal" do estudo). Nunca diga
  "ajuste para o valor sugerido (ACM)" — diga "ajuste para o valor ideal de
  mercado (R$ X)", repetindo explicitamente o número de `faixaRecomendada.ideal`
  no `discursoProprietario` e em pelo menos um dos `argumentosChave`.

CENÁRIO DE USO:
O corretor frequentemente precisa convencer o proprietário a ajustar o valor
pretendido para baixo. Proprietários ficam emocionalmente resistentes. Você
precisa entregar um discurso PRONTO, em tom acolhedor e profissional, que o
corretor possa ler ou enviar diretamente ao dono — sem culpar o proprietário,
sempre ancorando em fatos de mercado (mediana, piso, nº de concorrentes
anunciados, faixa praticada, tempo médio de venda).

FORMATO DE SAÍDA — OBRIGATÓRIO:
Responda APENAS com um único objeto JSON válido (sem markdown, sem \`\`\`, sem
comentários). Estrutura exata:
{
  "resumo": "string (2-3 frases)",
  "faixaRecomendada": {
    "entrada": número em R$,
    "ideal": número em R$,
    "teto": número em R$
  },
  "posicionamento": "string (1-2 frases)",
  "riscos": ["string", ...] (até 5),
  "recomendacoes": ["string", ...] (até 5),
  "discursoProprietario": "string (4-6 frases, tom acolhedor, em 1ª pessoa do plural ('observamos', 'sugerimos'), pronto para o corretor ler ao dono — começar reconhecendo o valor do imóvel, depois trazer os dados de mercado, fechar com um caminho claro)",
  "argumentosChave": ["string", ...] (3 a 5 bullets curtos, cada um com 1 fato concreto do mercado — ex.: 'X imóveis semelhantes anunciados entre R$ A e R$ B', 'mediana do bairro em R$/m² Y', 'piso competitivo em R$ Z')
}`;

const outputSchema = z.object({
  resumo: z.string().min(1),
  faixaRecomendada: z.object({
    entrada: z.number(),
    ideal: z.number(),
    teto: z.number(),
  }),
  posicionamento: z.string().min(1),
  riscos: z.array(z.string()).default([]),
  recomendacoes: z.array(z.string()).default([]),
  discursoProprietario: z.string().min(1),
  argumentosChave: z.array(z.string()).default([]),
});

function extractJson(text: string): unknown | null {
  if (!text) return null;
  // Tenta direto
  try { return JSON.parse(text); } catch { /* segue */ }
  // Remove cercas markdown
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* segue */ }
  }
  // Extrai primeiro objeto {...} balanceado
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = text.slice(start, i + 1);
        try { return JSON.parse(slice); } catch { return null; }
      }
    }
  }
  return null;
}

export const analisarMercadoIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "AI Gateway não configurado." };

    try {
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const { generateText } = await import("ai");
      const gateway = createLovableAiGatewayProvider(key);

      const prompt = `Imóvel analisado:
${JSON.stringify(data.imovel, null, 2)}

Indicadores de mercado:
${JSON.stringify(data.mercado, null, 2)}

Top comparáveis (até 15):
${JSON.stringify(data.comparaveis, null, 2)}

Diferença entre pretendido e ideal de mercado: ${(() => {
  const p = data.imovel.valorPretendido;
  const ideal = (data.mercado.median && data.imovel.areaUtil)
    ? data.mercado.median * data.imovel.areaUtil
    : (data.mercado.valorSugerido ?? data.mercado.precoMedio);
  if (!p || !ideal) return "n/d";
  const diff = ((p - ideal) / ideal) * 100;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)}% (pretendido vs valor ideal ≈ R$ ${Math.round(ideal).toLocaleString("pt-BR")})`;
})()}

Gere a análise estruturada respeitando o piso de mercado. Sempre cite o
valor ideal (faixaRecomendada.ideal) explicitamente no discursoProprietario
como referência do ajuste. Calibre o tom: se o pretendido está muito acima
do teto, seja firme mas empático; se está alinhado, reforce a estratégia.
Responda SOMENTE com o JSON pedido.`;

      const result = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt,
      });

      const raw = (result.text ?? "").trim();
      console.log("[ai-analysis] raw length:", raw.length, "preview:", raw.slice(0, 200));
      const parsed = extractJson(raw);
      if (!parsed) {
        // Fallback: usar percentis do mercado se a IA falhou em estruturar
        const m = data.mercado;
        const base = m.median ?? m.precoMedio;
        const n = data.comparaveis.length;
        const fmt = (v: number) =>
          v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
        const fallback = {
          resumo: raw.slice(0, 600) || "A IA não retornou uma análise estruturada. Faixa competitiva calculada a partir dos percentis do mercado.",
          faixaRecomendada: {
            entrada: Math.round(m.p25 ?? base * 0.95),
            ideal: Math.round(base),
            teto: Math.round(m.p75 ?? base * 1.05),
          },
          posicionamento: "Faixa derivada da distribuição de preços dos comparáveis (P25 / mediana / P75) — orientada para velocidade de venda, não para teto de preço.",
          riscos: ["Análise qualitativa indisponível — revise manualmente."],
          recomendacoes: ["Tente gerar a análise novamente em instantes."],
          discursoProprietario:
            `Analisamos ${n} imóveis semelhantes ao seu em ${data.imovel.bairro}, ` +
            `${data.imovel.cidade}. A faixa praticada hoje vai de ${fmt(m.menorPreco)} a ${fmt(m.maiorPreco)}, ` +
            `com a mediana em ${fmt(base)}. Para garantir visitas qualificadas já nas primeiras semanas e ` +
            `evitar que o anúncio "esfrie" no portal, sugerimos posicionar entre ${fmt(Math.round(m.p25 ?? base * 0.95))} ` +
            `e ${fmt(Math.round(m.p75 ?? base * 1.05))}. Esse patamar nos coloca competitivos frente aos outros ` +
            `anúncios ativos hoje e tende a encurtar o tempo de venda.`,
          argumentosChave: [
            `${n} imóveis semelhantes analisados nos portais`,
            `Faixa praticada: ${fmt(m.menorPreco)} a ${fmt(m.maiorPreco)}`,
            `Mediana do mercado: ${fmt(base)}`,
            m.valorPiso ? `Piso competitivo identificado em ${fmt(m.valorPiso)}` : `R$/m² médio: ${fmt(m.precoM2Medio)}`,
          ],
        };
        const safe = outputSchema.parse(fallback);
        return { ok: true as const, data: { ...safe, geradoEm: new Date().toISOString() } };
      }

      const validated = outputSchema.safeParse(parsed);
      if (!validated.success) {
        console.error("[ai-analysis] schema invalid:", validated.error.issues);
        return { ok: false as const, error: "A IA respondeu em formato inesperado. Tente novamente." };
      }

      return {
        ok: true as const,
        data: { ...validated.data, geradoEm: new Date().toISOString() },
      };
    } catch (e) {
      const msg = (e as Error).message || "Falha na análise";
      console.error("[ai-analysis] error:", msg);
      const m = /status\s+(\d{3})/i.exec(msg);
      const status = m ? Number(m[1]) : undefined;
      if (status === 402) return { ok: false as const, error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 429) return { ok: false as const, error: "Limite de requisições da IA atingido. Tente novamente em instantes." };
      return { ok: false as const, error: msg };
    }
  });