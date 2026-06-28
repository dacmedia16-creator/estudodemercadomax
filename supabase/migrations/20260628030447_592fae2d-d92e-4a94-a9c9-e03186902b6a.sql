
CREATE TABLE public.studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  bairro TEXT GENERATED ALWAYS AS (payload->'input'->>'bairro') STORED,
  cidade TEXT GENERATED ALWAYS AS (payload->'input'->>'cidade') STORED,
  status TEXT GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX studies_user_id_created_at_idx ON public.studies (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studies TO authenticated;
GRANT ALL ON public.studies TO service_role;

ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own studies" ON public.studies FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own studies" ON public.studies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own studies" ON public.studies FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own studies" ON public.studies FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_studies_updated_at
BEFORE UPDATE ON public.studies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
