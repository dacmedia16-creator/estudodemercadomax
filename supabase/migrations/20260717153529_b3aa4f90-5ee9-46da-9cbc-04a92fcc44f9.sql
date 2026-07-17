
-- 1) Add 'gestor' to app_role enum (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'gestor'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'gestor';
  END IF;
END$$;

-- 2) team_members table: manager_id -> user_id (one manager per user)
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Managers see their members; admins see all; members see their own row
DROP POLICY IF EXISTS "Managers view team" ON public.team_members;
CREATE POLICY "Managers view team" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    auth.uid() = manager_id
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 3) has_manager helper to check "user belongs to this manager"
CREATE OR REPLACE FUNCTION public.is_team_manager(_manager uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE manager_id = _manager AND user_id = _user
  )
$$;

-- 4) Studies RLS: gestor can view/delete studies of their team members
DROP POLICY IF EXISTS "Managers can view team studies" ON public.studies;
CREATE POLICY "Managers can view team studies" ON public.studies
  FOR SELECT TO authenticated
  USING (public.is_team_manager(auth.uid(), user_id));

DROP POLICY IF EXISTS "Managers can delete team studies" ON public.studies;
CREATE POLICY "Managers can delete team studies" ON public.studies
  FOR DELETE TO authenticated
  USING (public.is_team_manager(auth.uid(), user_id));
