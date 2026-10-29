-- Each treatment type gets a calendar color, picked from the app's theme palette (see TYPE_COLORS in src/lib/clinic.ts).
ALTER TABLE public.treatment_types
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'chart-1'
  CHECK (color IN ('chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'status-completed'));

-- Give existing types distinct starting colors (by display order).
WITH ranked AS (
  SELECT id, (row_number() OVER (ORDER BY sort_order, name) - 1) % 6 AS i
  FROM public.treatment_types
)
UPDATE public.treatment_types t
SET color = (ARRAY['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'status-completed'])[ranked.i + 1]
FROM ranked
WHERE t.id = ranked.id;
