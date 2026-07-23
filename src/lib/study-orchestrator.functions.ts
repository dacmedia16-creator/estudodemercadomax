import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runStudy } from "@/lib/study-runner";
import type { StudyInput, SearchOverrides, StudyResult } from "@/lib/study-types";

// input/overrides shape is large and already validated field-by-field inside
// runStudy/generateStudy — only check the envelope here.
const inputSchema = z.object({
  input: z.record(z.string(), z.unknown()),
  overrides: z.record(z.string(), z.unknown()).optional(),
  studyId: z.string().optional(),
});

type Row = { id: string; user_id: string; payload: unknown; created_at: string; updated_at: string };

/**
 * Runs the full "novo estudo" pipeline (busca GeckoAPI em camadas, ACM,
 * análise por IA) and salva o resultado — tudo no servidor, numa única
 * chamada. O client só manda o input e espera o estudo pronto.
 */
export const gerarEstudoCompleto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const input = data.input as unknown as StudyInput;
    const overrides = (data.overrides ?? {}) as SearchOverrides;

    const { result, warning, fellBack } = await runStudy(input, overrides, undefined, data.studyId);
    if (data.studyId) result.id = data.studyId;

    // Mesma lógica de studyStore.save(), rodando com o client autenticado
    // por request (RLS continua valendo — nada de service role aqui).
    const payloadJson = result as unknown as never;
    const { data: updated, error: updErr } = await context.supabase
      .from("studies")
      .update({ payload: payloadJson })
      .eq("id", result.id)
      .select("id,user_id,payload,created_at,updated_at")
      .maybeSingle();
    if (updErr) throw updErr;

    let row = updated as Row | null;
    if (!row) {
      const { data: inserted, error: insErr } = await context.supabase
        .from("studies")
        .insert({ id: result.id, user_id: context.userId, payload: payloadJson })
        .select("id,user_id,payload,created_at,updated_at")
        .single();
      if (insErr) throw insErr;
      row = inserted as Row;
    }

    const payload = row.payload as StudyResult;
    const saved: StudyResult = {
      ...payload,
      id: row.id,
      createdAt: payload.createdAt ?? row.created_at,
    };

    return { result: saved, warning, fellBack };
  });
