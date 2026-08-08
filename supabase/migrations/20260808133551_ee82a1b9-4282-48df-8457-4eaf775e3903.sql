
ALTER TABLE public.instructor_settlements
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS order_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrollment_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount integer NOT NULL DEFAULT 0;
