
-- 1) teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage teams select" ON public.teams
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers view own team" ON public.teams
  FOR SELECT TO authenticated
  USING (auth.uid() = manager_id);
CREATE POLICY "Admins insert teams" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update teams" ON public.teams
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete teams" ON public.teams
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) team_members: add team_id
ALTER TABLE public.team_members
  ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 3) Backfill: create one team per existing manager, then populate team_id
INSERT INTO public.teams (name, manager_id, created_by)
SELECT DISTINCT
  'Equipe ' || COALESCE((SELECT email FROM auth.users WHERE id = tm.manager_id), 'sem nome'),
  tm.manager_id,
  tm.manager_id
FROM public.team_members tm
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.manager_id = tm.manager_id);

UPDATE public.team_members tm
SET team_id = t.id
FROM public.teams t
WHERE t.manager_id = tm.manager_id AND tm.team_id IS NULL;

-- Enforce not null and uniqueness going forward
ALTER TABLE public.team_members
  ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id);

-- 4) team_members write policies
CREATE POLICY "Admins insert team members" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete team members" ON public.team_members
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers remove own team members" ON public.team_members
  FOR DELETE TO authenticated
  USING (auth.uid() = manager_id);
