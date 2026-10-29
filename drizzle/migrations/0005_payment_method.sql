-- Payment method (cash / bank transfer) for paid appointments and for income entries.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('cash', 'transfer'));
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('cash', 'transfer'));

-- Revenue trigger now copies the payment method onto the income row.
CREATE OR REPLACE FUNCTION public.sync_appointment_revenue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    INSERT INTO public.transactions(kind, amount, description, txn_date, appointment_id, payment_method)
    VALUES ('income', NEW.price, 'תשלום עבור טיפול - ' || NEW.client_name, NEW.appt_date, NEW.id, NEW.payment_method)
    ON CONFLICT (appointment_id) DO UPDATE
      SET amount = EXCLUDED.amount, payment_method = EXCLUDED.payment_method;
  ELSE
    DELETE FROM public.transactions WHERE appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS appointments_revenue ON public.appointments;
CREATE TRIGGER appointments_revenue AFTER INSERT OR UPDATE OF status, price, payment_method ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_revenue();
