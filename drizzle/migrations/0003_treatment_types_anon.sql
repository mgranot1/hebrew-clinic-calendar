-- Login is temporarily disabled (see src/routes/_authenticated/route.tsx), so the
-- app talks to the DB as `anon`. The other tables (supabase/setup-public.sql) already
-- allow anon; treatment_types only allowed `authenticated`, so inserts were rejected.
-- When login is restored, revert this to `TO authenticated` only.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_types TO anon, authenticated;
GRANT ALL ON public.treatment_types TO service_role;
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff all treatment types" ON public.treatment_types;
DROP POLICY IF EXISTS "public all treatment types" ON public.treatment_types;
CREATE POLICY "public all treatment types" ON public.treatment_types
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
