
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  plan TEXT DEFAULT 'basic',
  monthly_traffic_limit_gb NUMERIC DEFAULT 100,
  monthly_storage_limit_gb NUMERIC DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  contact_email TEXT,
  contact_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.traffic_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage tenants"
  ON public.tenants FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins can view own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Super admins can view all traffic"
  ON public.traffic_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));
