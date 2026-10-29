-- Fix for RLS error on treatment_types.
--
-- In migration 0001 the table was created and RLS was enabled, but the
-- "staff all treatment types" policy did not get applied. With RLS on and no
-- policy, every write is blocked (that is the "new row violates row-level
-- security policy" error) and every read returns zero rows -- which is why the
-- table looked empty AND why adding a type from the app failed.
--
-- This script is idempotent: safe to run more than once.

-- 1. Make sure RLS is on and the access policy exists.
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff all treatment types" ON public.treatment_types;
CREATE POLICY "staff all treatment types" ON public.treatment_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Make sure the authenticated role can reach the table at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_types TO authenticated;
GRANT ALL ON public.treatment_types TO service_role;

-- 3. Backfill the two seeded types from the prices that already exist,
--    so the list is in sync with pricing_rules.
INSERT INTO public.treatment_types (name, sort_order)
SELECT DISTINCT treatment_type,
       CASE treatment_type WHEN 'שעווה' THEN 0 ELSE 1 END
FROM public.pricing_rules
ON CONFLICT (name) DO NOTHING;
