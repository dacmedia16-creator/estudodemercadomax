import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

async function assertGestorOrAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return "admin" as const;
  const { data: isGestor, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "gestor" });
  if (error) throw new Error(error.message);
  if (!isGestor) throw new Error("Acesso restrito a gestores.");
  return "gestor" as const;
}

// ============ ADMIN: TEAMS CRUD ============

export const adminListTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, manager_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const teamIds = (teams ?? []).map((t: any) => t.id as string);
    const managerIds = Array.from(new Set((teams ?? []).map((t: any) => t.manager_id as string)));

    const { data: members } = teamIds.length
      ? await supabaseAdmin.from("team_members").select("team_id, user_id").in("team_id", teamIds)
      : { data: [] as any[] };
    const memberCount = new Map<string, number>();
    const memberIdsByTeam = new Map<string, string[]>();
    (members ?? []).forEach((m: any) => {
      memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);
      const arr = memberIdsByTeam.get(m.team_id) ?? [];
      arr.push(m.user_id);
      memberIdsByTeam.set(m.team_id, arr);
    });

    const allUserIds = new Set<string>(managerIds);
    (members ?? []).forEach((m: any) => allUserIds.add(m.user_id));

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map<string, string>();
    (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));

    // study counts
    const studyCountByTeam = new Map<string, number>();
    for (const [teamId, uids] of memberIdsByTeam.entries()) {
      if (!uids.length) continue;
      const { count } = await supabaseAdmin
        .from("studies")
        .select("id", { count: "exact", head: true })
        .in("user_id", uids);
      studyCountByTeam.set(teamId, count ?? 0);
    }

    return {
      teams: (teams ?? []).map((t: any) => ({
        id: t.id as string,
        name: t.name as string,
        managerId: t.manager_id as string,
        managerEmail: emailById.get(t.manager_id) ?? "(removido)",
        memberCount: memberCount.get(t.id) ?? 0,
        studyCount: studyCountByTeam.get(t.id) ?? 0,
        createdAt: t.created_at as string,
      })),
    };
  });

export const adminGetTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team, error } = await supabaseAdmin
      .from("teams").select("id, name, manager_id, created_at").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!team) throw new Error("Equipe não encontrada.");
    const { data: members } = await supabaseAdmin
      .from("team_members").select("user_id, created_at").eq("team_id", data.id);
    const uids = [(team as any).manager_id as string, ...((members ?? []).map((m: any) => m.user_id as string))];
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map<string, string>();
    (usersData?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));
    void uids;
    return {
      id: (team as any).id as string,
      name: (team as any).name as string,
      managerId: (team as any).manager_id as string,
      managerEmail: emailById.get((team as any).manager_id) ?? "(removido)",
      members: (members ?? []).map((m: any) => ({
        userId: m.user_id as string,
        email: emailById.get(m.user_id) ?? "(removido)",
        createdAt: m.created_at as string,
      })),
    };
  });

export const adminCreateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; managerId?: string; managerEmail?: string; managerPassword?: string }) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      managerId: z.string().uuid().optional(),
      managerEmail: z.string().email().max(255).optional(),
      managerPassword: z.string().min(8).max(72).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let managerId = data.managerId;
    if (!managerId) {
      if (!data.managerEmail) throw new Error("Selecione um gestor ou informe um e-mail.");
      const email = data.managerEmail.trim().toLowerCase();
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      managerId = (usersData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email)?.id;
      if (!managerId) {
        if (!data.managerPassword) throw new Error("Informe uma senha para criar o novo gestor.");
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email, password: data.managerPassword, email_confirm: true,
        });
        if (error) throw new Error(error.message);
        if (!created.user) throw new Error("Falha ao criar gestor.");
        managerId = created.user.id;
      }
    }

    // ensure gestor role
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles").insert({ user_id: managerId, role: "gestor" as any });
    if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);

    const { data: team, error: teamErr } = await supabaseAdmin
      .from("teams")
      .insert({ name: data.name.trim(), manager_id: managerId, created_by: context.userId })
      .select("id").single();
    if (teamErr) throw new Error(teamErr.message);
    return { id: (team as any).id as string };
  });

export const adminListAvailableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = (usersData?.users ?? []).filter((u) => !!u.email);
    const ids = users.map((u) => u.id);
    const { data: roles } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as any[] };
    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    return {
      users: users.map((u) => {
        const rs = rolesByUser.get(u.id) ?? [];
        const role = rs.includes("admin") ? "admin" : rs.includes("gestor") ? "gestor" : "user";
        return { id: u.id, email: u.email ?? "", role };
      }).sort((a, b) => a.email.localeCompare(b.email)),
    };
  });

export const adminUpdateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(80) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("teams").update({ name: data.name.trim() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("teams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddMemberToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; email: string; password: string }) =>
    z.object({
      teamId: z.string().uuid(),
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team, error: teamErr } = await supabaseAdmin
      .from("teams").select("id, manager_id").eq("id", data.teamId).maybeSingle();
    if (teamErr) throw new Error(teamErr.message);
    if (!team) throw new Error("Equipe não encontrada.");

    // find or create user
    const email = data.email.trim().toLowerCase();
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let userId = (usersData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email)?.id;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email, password: data.password, email_confirm: true,
      });
      if (error) throw new Error(error.message);
      if (!created.user) throw new Error("Falha ao criar corretor.");
      userId = created.user.id;
    }

    const { error: linkErr } = await supabaseAdmin.from("team_members").insert({
      team_id: (team as any).id as string,
      manager_id: (team as any).manager_id as string,
      user_id: userId,
    });
    if (linkErr) throw new Error(linkErr.message);
    return { userId };
  });

export const adminRemoveMemberFromTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; userId: string; deleteAccount: boolean }) =>
    z.object({
      teamId: z.string().uuid(), userId: z.string().uuid(), deleteAccount: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("team_members").delete().eq("team_id", data.teamId).eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    if (data.deleteAccount) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============ GESTOR: READ + REMOVE MEMBER ============

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

export const gestorAddMember = createServerFn({ method: "POST" })
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

    const { data: teams, error: teamErr } = await supabaseAdmin
      .from("teams").select("id").eq("manager_id", context.userId).limit(1);
    if (teamErr) throw new Error(teamErr.message);
    const team = (teams ?? [])[0] as { id: string } | undefined;
    if (!team) throw new Error("Você ainda não gerencia nenhuma equipe.");

    // find or create user
    const email = data.email.trim().toLowerCase();
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let userId = (usersData?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email)?.id;
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email, password: data.password, email_confirm: true,
      });
      if (error) throw new Error(error.message);
      if (!created.user) throw new Error("Falha ao criar corretor.");
      userId = created.user.id;
    }

    const { error: linkErr } = await supabaseAdmin.from("team_members").insert({
      team_id: team.id,
      manager_id: context.userId,
      user_id: userId,
    });
    if (linkErr) throw new Error(linkErr.message);
    return { userId };
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
