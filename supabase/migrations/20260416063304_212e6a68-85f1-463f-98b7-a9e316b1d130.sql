
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS card_company text,
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_owner_type text,
  ADD COLUMN IF NOT EXISTS card_installment_months integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_is_interest_free boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_approve_no text,
  ADD COLUMN IF NOT EXISTS easy_pay_provider text,
  ADD COLUMN IF NOT EXISTS easy_pay_discount_amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS mobile_carrier text,
  ADD COLUMN IF NOT EXISTS toss_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS vat integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_paid_at ON public.orders(status, paid_at);
