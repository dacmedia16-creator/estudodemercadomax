import { supabase } from "@/integrations/supabase/client";
import type { StudyResult, ComparableProperty } from "./study-types";

// Persistence is backed by the `public.studies` table on Supabase, with
// Row-Level Security restricting every row to its owning user (auth.uid()).
// The browser client uses the publishable key + the user session, so RLS
// transparently scopes reads and writes to the signed-in user.

type Row = {
  id: string;
  user_id: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

function ensureUniqueIds(list: ComparableProperty[] | undefined): ComparableProperty[] | undefined {
  if (!Array.isArray(list)) return list;
  const seen = new Map<string, number>();
  return list.map((c) => {
    const base = c.id ?? "";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? c : { ...c, id: `${base}#${n + 1}` };
  });
}

function toResult(row: Row): StudyResult {
  // Keep the canonical id in sync with the row id (defensive).
  const payload = row.payload as StudyResult;
  const comparaveis = ensureUniqueIds(payload.comparaveis) ?? payload.comparaveis;
  const comparaveisOriginais = ensureUniqueIds(payload.comparaveisOriginais);
  return {
    ...payload,
    id: row.id,
    createdAt: payload.createdAt ?? row.created_at,
    comparaveis,
    ...(comparaveisOriginais ? { comparaveisOriginais } : {}),
  };
}

export const studyStore = {
  async all(): Promise<StudyResult[]> {
    const { data, error } = await supabase
      .from("studies")
      .select("id,user_id,payload,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => toResult(r as unknown as Row));
  },

  async get(id: string): Promise<StudyResult | undefined> {
    const { data, error } = await supabase
      .from("studies")
      .select("id,user_id,payload,created_at,updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toResult(data as unknown as Row) : undefined;
  },

  /**
   * Insert when the row doesn't exist yet, otherwise update the payload.
   * `user_id` is set from the current session — RLS rejects mismatches.
   */
  async save(s: StudyResult): Promise<StudyResult> {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) throw new Error("Sessão expirada. Entre novamente.");

    // Try update first (preserves created_at); insert when no row matched.
    const payloadJson = s as unknown as never;
    const { data: updated, error: updErr } = await supabase
      .from("studies")
      .update({ payload: payloadJson })
      .eq("id", s.id)
      .select("id,user_id,payload,created_at,updated_at")
      .maybeSingle();
    if (updErr) throw updErr;
    if (updated) return toResult(updated as unknown as Row);

    const { data: inserted, error: insErr } = await supabase
      .from("studies")
      .insert({ id: s.id, user_id: userId, payload: payloadJson })
      .select("id,user_id,payload,created_at,updated_at")
      .single();
    if (insErr) throw insErr;
    return toResult(inserted as unknown as Row);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("studies").delete().eq("id", id);
    if (error) throw error;
  },
};