import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ query: z.string().min(3).max(500) });

const SYSTEM = `Você extrai parâmetros de busca de imóveis a partir de uma descrição em português.
Retorne APENAS os campos que conseguir identificar com confiança. Não invente valores.
Tipos válidos: Apartamento, Casa, Cobertura, Sobrado, Studio, Kitnet, Sala, Terreno.
Finalidade: "Venda" ou "Aluguel". Estado: UF de 2 letras maiúsculas.`;

export const parseQueryAi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "AI Gateway não configurado" };

    try {
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const { generateText, Output } = await import("ai");

      const gateway = createLovableAiGatewayProvider(key);
      const { experimental_output: output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt: data.query,
        experimental_output: Output.object({
          schema: z.object({
            finalidade: z.enum(["Venda", "Aluguel"]).nullable(),
            tipo: z.string().nullable(),
            cidade: z.string().nullable(),
            estado: z.string().nullable(),
            bairro: z.string().nullable(),
            edificio: z.string().nullable(),
            quartos: z.number().int().nullable(),
            suites: z.number().int().nullable(),
            banheiros: z.number().int().nullable(),
            vagas: z.number().int().nullable(),
            areaUtil: z.number().nullable(),
            valorPretendido: z.number().nullable(),
            diferenciais: z.array(z.string()).nullable(),
          }),
        }),
      });

      return { ok: true as const, data: output };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });