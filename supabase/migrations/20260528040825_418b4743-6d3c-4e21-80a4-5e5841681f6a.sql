
CREATE TABLE public.oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_domain TEXT NOT NULL DEFAULT 'default',
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  grant_types TEXT[] NOT NULL DEFAULT ARRAY['client_credentials'],
  scopes TEXT[] NOT NULL DEFAULT ARRAY['member:read'],
  redirect_uris TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oauth_clients_tenant ON public.oauth_clients(tenant_domain);
CREATE INDEX idx_oauth_clients_client_id ON public.oauth_clients(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_clients TO authenticated;
GRANT ALL ON public.oauth_clients TO service_role;
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage oauth_clients" ON public.oauth_clients FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE,
  tenant_domain TEXT NOT NULL DEFAULT 'default',
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scopes TEXT[] NOT NULL,
  grant_type TEXT NOT NULL,
  member_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oauth_tokens_access ON public.oauth_tokens(access_token);
CREATE INDEX idx_oauth_tokens_refresh ON public.oauth_tokens(refresh_token);
CREATE INDEX idx_oauth_tokens_client ON public.oauth_tokens(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_tokens TO authenticated;
GRANT ALL ON public.oauth_tokens TO service_role;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage oauth_tokens" ON public.oauth_tokens FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.oauth_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  tenant_domain TEXT NOT NULL DEFAULT 'default',
  member_code TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT,
  code_challenge_method TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_oauth_codes_code ON public.oauth_auth_codes(code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_auth_codes TO authenticated;
GRANT ALL ON public.oauth_auth_codes TO service_role;
ALTER TABLE public.oauth_auth_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage oauth_auth_codes" ON public.oauth_auth_codes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.oauth_tenant_keys (
  tenant_domain TEXT PRIMARY KEY,
  jwt_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_tenant_keys TO authenticated;
GRANT ALL ON public.oauth_tenant_keys TO service_role;
ALTER TABLE public.oauth_tenant_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage oauth_tenant_keys" ON public.oauth_tenant_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.oauth_tenant_keys (tenant_domain, jwt_secret)
VALUES ('default', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (tenant_domain) DO NOTHING;

CREATE TRIGGER trg_oauth_clients_updated
BEFORE UPDATE ON public.oauth_clients
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
