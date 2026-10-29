-- Make treatment types and their durations manager-defined.
--
-- Before: treatment_type was limited to 'waxing'/'electrolysis' by a CHECK,
-- and durations were capped at 60 minutes. Now the manager defines her own
-- treatment types (stored in treatment_types) and any durations/prices she
-- likes (stored in pricing_rules, as today). Appointments keep storing the
-- treatment type as text copied at booking time, so historical appointments
-- keep the name they were booked with even if a type is later renamed/removed.
--
-- NOTE: existing data is demo-only and is wiped below.

-- 1. New table: the list of treatment types the manager maintains.
CREATE TABLE public.treatment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,          -- Hebrew label shown everywhere (e.g. 'שעווה')
  sort_order int NOT NULL DEFAULT 0,  -- display order in menus
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_types TO authenticated;
GRANT ALL ON public.treatment_types TO service_role;
ALTER TABLE public.treatment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff all treatment types" ON public.treatment_types
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Wipe demo data so the new, unconstrained rules start clean.
--    (appointments cascade-delete their transactions via the existing FK.)
DELETE FROM public.appointments;
DELETE FROM public.pricing_rules;

-- 3. Drop the hardcoded-type CHECK and the 60-minute cap on pricing_rules.
ALTER TABLE public.pricing_rules
  DROP CONSTRAINT IF EXISTS pricing_rules_treatment_type_check;
ALTER TABLE public.pricing_rules
  DROP CONSTRAINT IF EXISTS pricing_rules_duration_minutes_check;
ALTER TABLE public.pricing_rules
  ADD CONSTRAINT pricing_rules_duration_minutes_check
  CHECK (duration_minutes > 0);

-- 4. Same relaxation on appointments.
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_treatment_type_check;
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_duration_minutes_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_minutes_check
  CHECK (duration_minutes > 0);

-- 5. Seed the two original types so the app opens with a sensible default.
--    The manager can rename, remove, or add to these freely.
INSERT INTO public.treatment_types (name, sort_order) VALUES
  ('שעווה', 0),
  ('אפילציה (חשמלית)', 1);

-- Optional starter pricing for the seeded types (safe to delete/edit in the UI).
INSERT INTO public.pricing_rules (treatment_type, duration_minutes, price) VALUES
  ('שעווה', 15, 80);
INSERT INTO public.pricing_rules (treatment_type, duration_minutes, price)
SELECT 'אפילציה (חשמלית)', m, m * 6 FROM generate_series(5, 60, 5) m;
