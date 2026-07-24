import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "dacmedia16@gmail.com";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`Falha ao validar permissões: ${error.message}`);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r: { role: string }) => r.role) };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allUsers: Array<{
      id: string;
      email?: string;
      created_at: string;
      last_sign_in_at?: string | null;
      app_metadata?: Record<string, unknown>;
    }> = [];
    const perPage = 1000;
    for (let page = 1; ; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
    }

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const adminIds = new Set(
      (roleRows ?? [])
        .filter((r: { role: string }) => r.role === "admin")
        .map((r: { user_id: string }) => r.user_id),
    );

    return {
      users: allUsers.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: adminIds.has(u.id),
        isSuperAdmin: (u.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL,
        // Ausência da flag = ativo (contas criadas antes desse recurso, ou
        // criadas por admin/gestor, continuam liberadas sem gesto extra).
        isActive: u.app_metadata?.active !== false,
      })),
    };
  });

// Marca a própria conta (recém-criada no cadastro público) como pendente de
// ativação. app_metadata não é editável pelo usuário via client — só aqui,
// com service role — então isso não pode ser burlado pelo próprio usuário.
export const selfMarkPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (getErr) throw new Error(getErr.message);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { ...(existing.user?.app_metadata ?? {}), active: false },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (getErr) throw new Error(getErr.message);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      app_metadata: { ...(existing.user?.app_metadata ?? {}), active: data.active },
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; isAdmin: boolean }) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(72),
        isAdmin: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    if (data.isAdmin && created.user) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" });
      if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);
    }
    return { id: created.user?.id, email: created.user?.email };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("Você não pode excluir a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if ((target?.user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) {
      throw new Error("O super administrador não pode ser excluído.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isAdmin: boolean }) =>
    z.object({ id: z.string().uuid(), isAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.id, role: "admin" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.id);
      if ((target?.user?.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL) {
        throw new Error("O super administrador não pode perder o papel de admin.");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.id)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminListAllStudies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("studies")
      .select("id,user_id,status,cidade,bairro,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const emailById = new Map<string, string>();
    (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));

    return {
      studies: rows.map((r: any) => ({
        id: r.id as string,
        userId: r.user_id as string,
        email: emailById.get(r.user_id) ?? "(usuário removido)",
        status: (r.status as string) ?? null,
        cidade: (r.cidade as string) ?? null,
        bairro: (r.bairro as string) ?? null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      })),
    };
  });

export const adminDeleteStudy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("studies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { month?: string } = {}) =>
    z
      .object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const now = new Date();
    const monthStr =
      data.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const { data: rows, error } = await context.supabase
      .from("api_usage")
      .select("user_id, study_id, portal, endpoint, created_at")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (error) throw new Error(error.message);
    const usage = (rows ?? []) as Array<{
      user_id: string;
      study_id: string | null;
      portal: string;
      endpoint: string;
      created_at: string;
    }>;

    const totalCalls = usage.length;

    const userIds = Array.from(new Set(usage.map((r) => r.user_id)));
    const studyIds = Array.from(
      new Set(usage.map((r) => r.study_id).filter((x): x is string => !!x)),
    );

    // Email + study metadata via service role (read-only).
    const emailById = new Map<string, string>();
    const studyMeta = new Map<string, { cidade: string | null; bairro: string | null }>();
    if (userIds.length || studyIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (userIds.length) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));
      }
      if (studyIds.length) {
        const { data: studyRows } = await supabaseAdmin
          .from("studies")
          .select("id,cidade,bairro")
          .in("id", studyIds);
        (studyRows ?? []).forEach((s: any) =>
          studyMeta.set(s.id, { cidade: s.cidade ?? null, bairro: s.bairro ?? null }),
        );
      }
    }

    const byUserMap = new Map<string, number>();
    const byPortalMap = new Map<string, number>();
    const byEndpointMap = new Map<string, number>();
    const byStudyMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    for (const r of usage) {
      byUserMap.set(r.user_id, (byUserMap.get(r.user_id) ?? 0) + 1);
      byPortalMap.set(r.portal, (byPortalMap.get(r.portal) ?? 0) + 1);
      byEndpointMap.set(r.endpoint, (byEndpointMap.get(r.endpoint) ?? 0) + 1);
      if (r.study_id) byStudyMap.set(r.study_id, (byStudyMap.get(r.study_id) ?? 0) + 1);
      const day = r.created_at.slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    }

    const byUser = Array.from(byUserMap.entries())
      .map(([userId, calls]) => ({ userId, email: emailById.get(userId) ?? "(removido)", calls }))
      .sort((a, b) => b.calls - a.calls);
    const byPortal = Array.from(byPortalMap.entries())
      .map(([portal, calls]) => ({ portal, calls }))
      .sort((a, b) => b.calls - a.calls);
    const byEndpoint = Array.from(byEndpointMap.entries())
      .map(([endpoint, calls]) => ({ endpoint, calls }))
      .sort((a, b) => b.calls - a.calls);
    const topStudies = Array.from(byStudyMap.entries())
      .map(([studyId, calls]) => ({
        studyId,
        calls,
        cidade: studyMeta.get(studyId)?.cidade ?? null,
        bairro: studyMeta.get(studyId)?.bairro ?? null,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
    const dailySeries = Array.from(byDayMap.entries())
      .map(([day, calls]) => ({ day, calls }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return {
      month: monthStr,
      totalCalls,
      uniqueStudies: studyIds.length,
      byUser,
      byPortal,
      byEndpoint,
      topStudies,
      dailySeries,
    };
  });
