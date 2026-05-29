
CREATE TABLE public.ops_cert_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cert_type TEXT NOT NULL DEFAULT 'completion',
  title TEXT NOT NULL DEFAULT '수 료 증',
  subtitle_en TEXT NOT NULL DEFAULT 'Certificate of Completion',
  body_template TEXT NOT NULL DEFAULT '위 사람은 {{program_title}}을(를) 성실히 이수하였기에 이 증서를 수여합니다.',
  issuer_name TEXT,
  issuer_title TEXT,
  accent_color TEXT NOT NULL DEFAULT '#3182F6',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_cert_templates TO authenticated;
GRANT ALL ON public.ops_cert_templates TO service_role;

ALTER TABLE public.ops_cert_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cert templates"
ON public.ops_cert_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated can read templates"
ON public.ops_cert_templates FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER trg_ops_cert_templates_updated
BEFORE UPDATE ON public.ops_cert_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TABLE public.ops_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.ops_cert_templates(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  source_title TEXT NOT NULL,
  recipient_user_id UUID,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_branch TEXT,
  recipient_team TEXT,
  verification_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID,
  cert_number TEXT,
  notes TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ops_cert_recipient ON public.ops_certificates(recipient_user_id);
CREATE INDEX idx_ops_cert_source ON public.ops_certificates(source_type, source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_certificates TO authenticated;
GRANT ALL ON public.ops_certificates TO service_role;

ALTER TABLE public.ops_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage certificates"
ON public.ops_certificates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Recipients can view own certificates"
ON public.ops_certificates FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.verify_ops_certificate(_code TEXT)
RETURNS TABLE (
  recipient_name TEXT,
  source_title TEXT,
  source_type TEXT,
  issued_at TIMESTAMPTZ,
  cert_number TEXT,
  is_revoked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recipient_name, source_title, source_type, issued_at, cert_number,
         (revoked_at IS NOT NULL) AS is_revoked
  FROM public.ops_certificates
  WHERE verification_code = _code
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_ops_certificate(TEXT) TO anon, authenticated;
