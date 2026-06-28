
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_id uuid NULL,
  portal text NOT NULL,
  endpoint text NOT NULL,
  target_host text NULL,
  status int NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.api_usage TO authenticated;
GRANT ALL ON public.api_usage TO service_role;

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode registrar o próprio uso.
CREATE POLICY "Users insert own api usage"
  ON public.api_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Somente administradores leem.
CREATE POLICY "Admins view api usage"
  ON public.api_usage
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX api_usage_created_at_idx ON public.api_usage (created_at DESC);
CREATE INDEX api_usage_user_created_idx ON public.api_usage (user_id, created_at DESC);
CREATE INDEX api_usage_study_idx ON public.api_usage (study_id);
