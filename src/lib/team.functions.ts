import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertGestorOrAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return "admin" as const;
  const { data: isGestor, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "gestor" });
  if (error) throw new Error(error.message);
  if (!isGestor) throw new Error("Acesso restrito a gestores.");
  return "gestor" as const;
}

export const gestorListTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGestorOrAdmin(context.supabase, context.userId);
    const { data: members, error } = await context.supabase
      .from("team_members")
      .select("user_id, created_at")
      .eq("manager_id", context.userId);
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m: any) => m.user_id as string);

    const emailById = new Map<string, string>();
    const studyCountById = new Map<string, number>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));

      const { data: studies } = await context.supabase
        .from("studies")
        .select("user_id")
        .in("user_id", ids);
      (studies ?? []).forEach((s: any) => {
        studyCountById.set(s.user_id, (studyCountById.get(s.user_id) ?? 0) + 1);
      });
    }

    return {
      members: (members ?? []).map((m: any) => ({
        userId: m.user_id as string,
        email: emailById.get(m.user_id) ?? "(usuário removido)",
        createdAt: m.created_at as string,
        studyCount: studyCountById.get(m.user_id) ?? 0,
      })),
    };
  });

export const gestorCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string }) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertGestorOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("Falha ao criar usuário.");
    const { error: linkErr } = await supabaseAdmin
      .from("team_members")
      .insert({ manager_id: context.userId, user_id: created.user.id });
    if (linkErr) throw new Error(linkErr.message);
    return { id: created.user.id, email: created.user.email };
  });

export const gestorRemoveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; deleteAccount: boolean }) =>
    z.object({ userId: z.string().uuid(), deleteAccount: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertGestorOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("manager_id", context.userId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!link) throw new Error("Este usuário não pertence à sua equipe.");
    const { error: delErr } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("manager_id", context.userId)
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.deleteAccount) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const gestorListTeamStudies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertGestorOrAdmin(context.supabase, context.userId);
    const { data: members } = await context.supabase
      .from("team_members")
      .select("user_id")
      .eq("manager_id", context.userId);
    const ids = (members ?? []).map((m: any) => m.user_id as string);
    if (!ids.length) return { studies: [] };
    const { data, error } = await context.supabase
      .from("studies")
      .select("id,user_id,status,cidade,bairro,created_at,updated_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map<string, string>();
    (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));

    return {
      studies: (data ?? []).map((r: any) => ({
        id: r.id as string,
        userId: r.user_id as string,
        email: emailById.get(r.user_id) ?? "(removido)",
        status: r.status as string | null,
        cidade: r.cidade as string | null,
        bairro: r.bairro as string | null,
        createdAt: r.created_at as string,
      })),
    };
  });

export const getMyTeamRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r: any) => r.role as string) };
  });