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
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roleRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const adminIds = new Set(
      (roleRows ?? []).filter((r: { role: string }) => r.role === "admin").map((r: { user_id: string }) => r.user_id),
    );

    return {
      users: data.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: adminIds.has(u.id),
        isSuperAdmin: (u.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL,
      })),
    };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; isAdmin: boolean }) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
      isAdmin: z.boolean(),
    }).parse(input),
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