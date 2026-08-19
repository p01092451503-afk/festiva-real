CREATE TABLE public.cert_issue_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid,
  course_title text not null,
  recipient_name text not null,
  completion_hours text,
  delivery_method text not null default 'pdf_post',
  recipient_email text not null,
  postcode text,
  address1 text,
  address2 text,
  shipping_fee integer not null default 0,
  status text not null default 'pending',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cert_issue_requests TO authenticated;
GRANT ALL ON public.cert_issue_requests TO service_role;

ALTER TABLE public.cert_issue_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cert requests" ON public.cert_issue_requests
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users create own cert requests" ON public.cert_issue_requests
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update cert requests" ON public.cert_issue_requests
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete cert requests" ON public.cert_issue_requests
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.touch_cert_issue_requests()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER cert_issue_requests_updated_at BEFORE UPDATE ON public.cert_issue_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_cert_issue_requests();

CREATE INDEX cert_issue_requests_user_idx ON public.cert_issue_requests(user_id, created_at DESC);