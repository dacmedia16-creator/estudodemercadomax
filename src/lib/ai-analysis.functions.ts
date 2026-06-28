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
- Não invente dados que não estão no payload.`;

export const analisarMercadoIa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "AI Gateway não configurado." };

    try {
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const { generateText, Output } = await import("ai");
      const gateway = createLovableAiGatewayProvider(key);

      const prompt = `Imóvel analisado:
${JSON.stringify(data.imovel, null, 2)}

Indicadores de mercado:
${JSON.stringify(data.mercado, null, 2)}

Top comparáveis (até 15):
${JSON.stringify(data.comparaveis, null, 2)}

Gere a análise estruturada respeitando o piso de mercado.`;

      const { experimental_output: out } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt,
        experimental_output: Output.object({
          schema: z.object({
            resumo: z.string().describe("Diagnóstico em 2–3 frases."),
            faixaRecomendada: z.object({
              entrada: z.number().describe("Preço de entrada agressivo (vende rápido)"),
              ideal: z.number().describe("Preço ideal equilibrado"),
              teto: z.number().describe("Preço máximo para publicar (com margem de negociação)"),
            }),
            posicionamento: z.string().describe("1–2 frases comparando com os mais baratos e os mais caros."),
            riscos: z.array(z.string()).max(5),
            recomendacoes: z.array(z.string()).max(5).describe("Ações concretas para o corretor"),
          }),
        }),
      });

      return {
        ok: true as const,
        data: { ...out, geradoEm: new Date().toISOString() },
      };
    } catch (e) {
      const msg = (e as Error).message || "Falha na análise";
      const m = /status\s+(\d{3})/i.exec(msg);
      const status = m ? Number(m[1]) : undefined;
      if (status === 402) return { ok: false as const, error: "Créditos de IA esgotados. Adicione créditos no workspace." };
      if (status === 429) return { ok: false as const, error: "Limite de requisições da IA atingido. Tente novamente em instantes." };
      return { ok: false as const, error: msg };
    }
  });