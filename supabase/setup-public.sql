-- ============================================================================
-- הקמת מסד הנתונים של מערכת הקליניקה בפרויקט Supabase חדש ועצמאי.
--
-- גרסה זו פותחת גישה לכל מי שיש לו את הקישור, ללא הרשמה והתחברות:
-- ההרשאות וה-RLS ניתנים גם ל-anon (משתמש אנונימי), לא רק ל-authenticated.
--
-- הוראות: העתיקו את כל הקובץ ל-SQL Editor ב-Supabase והריצו (Run).
-- ============================================================================

-- כל ה-roles הרלוונטיים: anon = גולש ללא התחברות, authenticated = משתמש מחובר.

-- ---------------------------------------------------------------- clients
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  debt numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all clients" ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------- pricing_rules
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_type text NOT NULL CHECK (treatment_type IN ('waxing','electrolysis')),
  duration_minutes int NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 60),
  price numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE (treatment_type, duration_minutes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO anon, authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all pricing" ON public.pricing_rules FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------- working_hours
CREATE TABLE public.working_hours (
  day_of_week int PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO anon, authenticated;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all hours" ON public.working_hours FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------- breaks
CREATE TABLE public.breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.breaks TO anon, authenticated;
GRANT ALL ON public.breaks TO service_role;
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all breaks" ON public.breaks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------- appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appt_date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 60),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  treatment_type text NOT NULL CHECK (treatment_type IN ('waxing','electrolysis')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','paid','cancelled')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_date_idx ON public.appointments(appt_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all appts" ON public.appointments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------- transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  description text,
  txn_date date NOT NULL DEFAULT current_date,
  appointment_id uuid UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all txns" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- סימון תור כ"שולם" רושם הכנסה; ביטול התשלום מוחק אותה.
CREATE OR REPLACE FUNCTION public.sync_appointment_revenue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    INSERT INTO public.transactions(kind, amount, description, txn_date, appointment_id)
    VALUES ('income', NEW.price, 'תשלום עבור טיפול - ' || NEW.client_name, NEW.appt_date, NEW.id)
    ON CONFLICT (appointment_id) DO UPDATE SET amount = EXCLUDED.amount;
  ELSE
    DELETE FROM public.transactions WHERE appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER appointments_revenue AFTER INSERT OR UPDATE OF status, price ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_revenue();

-- נתוני ברירת מחדל (שעות פעילות, הפסקות, מחירון)
INSERT INTO public.working_hours(day_of_week, is_open, start_time, end_time) VALUES
 (0,true,'09:00','19:00'),(1,true,'09:00','19:00'),(2,true,'09:00','19:00'),
 (3,true,'09:00','19:00'),(4,true,'09:00','19:00'),(5,true,'08:30','13:00'),(6,false,'09:00','13:00');
INSERT INTO public.breaks(day_of_week, start_time, end_time)
SELECT d, '13:00', '13:30' FROM generate_series(0,4) d;
INSERT INTO public.pricing_rules(treatment_type, duration_minutes, price) VALUES ('waxing',15,80);
INSERT INTO public.pricing_rules(treatment_type, duration_minutes, price)
SELECT 'electrolysis', m, m * 6 FROM generate_series(5,60,5) m;
