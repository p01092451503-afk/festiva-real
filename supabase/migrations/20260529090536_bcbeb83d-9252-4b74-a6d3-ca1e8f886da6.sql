
-- 0) feature_modules에 closed_lms 항목 추가
INSERT INTO public.feature_modules (module_key, label_ko, label_en, description, enabled, sort_order)
VALUES (
  'closed_lms',
  '폐쇄형 LMS',
  'Closed LMS',
  '고객사 전용 운영 모드: 수강자 일괄 초대/SMS 안내/1회용 로그인. 활성화 시 결제·스토어 기능이 자동으로 숨겨집니다.',
  false,
  5
)
ON CONFLICT (module_key) DO NOTHING;

-- 1) course_invitations
CREATE TABLE IF NOT EXISTS public.course_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name text NOT NULL,
  phone text NOT NULL,
  email text,
  affiliation text,
  course_id uuid,
  branch_id uuid,
  delivery_method text NOT NULL CHECK (delivery_method IN ('magic_link','credentials','both')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','consumed','expired','revoked')),
  user_id uuid,
  temp_password text,
  message_body text,
  error_message text,
  sent_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_invitations TO authenticated;
GRANT ALL ON public.course_invitations TO service_role;

ALTER TABLE public.course_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course_invitations"
ON public.course_invitations
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_course_invitations_course ON public.course_invitations(course_id);
CREATE INDEX IF NOT EXISTS idx_course_invitations_status ON public.course_invitations(status);
CREATE INDEX IF NOT EXISTS idx_course_invitations_phone ON public.course_invitations(phone);

CREATE TRIGGER trg_course_invitations_updated_at
BEFORE UPDATE ON public.course_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) one_time_login_tokens
CREATE TABLE IF NOT EXISTS public.one_time_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  invitation_id uuid REFERENCES public.course_invitations(id) ON DELETE CASCADE,
  course_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 토큰 테이블은 anon GRANT 없음 — Edge Function(service_role)만 검증
GRANT SELECT, INSERT, UPDATE, DELETE ON public.one_time_login_tokens TO authenticated;
GRANT ALL ON public.one_time_login_tokens TO service_role;

ALTER TABLE public.one_time_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage one_time_login_tokens"
ON public.one_time_login_tokens
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_otl_token ON public.one_time_login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_otl_expires ON public.one_time_login_tokens(expires_at);

-- 3) sms_logs
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES public.course_invitations(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'aligo',
  to_phone text NOT NULL,
  message text NOT NULL,
  request_payload jsonb,
  response jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','mock')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sms_logs"
ON public.sms_logs
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'branch_admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_invitation ON public.sms_logs(invitation_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);

-- 4) sms_templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  label text NOT NULL,
  body_template text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sms_templates"
ON public.sms_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage sms_templates"
ON public.sms_templates
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE TRIGGER trg_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 기본 템플릿 시드
INSERT INTO public.sms_templates (template_key, label, body_template, description) VALUES
  ('invite_magic_link', '강의 안내 — 1회용 로그인 링크',
   E'[WEBHEADS LMS]\n{이름}님, {강의명} 수강 안내입니다.\n아래 링크를 클릭하면 자동 로그인됩니다.\n{링크}\n(유효기간: {만료일}까지)',
   '1회용 매직링크 발송용. 치환: {이름} {강의명} {링크} {만료일}'),
  ('invite_credentials', '강의 안내 — 아이디/비밀번호',
   E'[WEBHEADS LMS]\n{이름}님, {강의명} 수강 안내입니다.\n로그인 ID: {아이디}\n임시 비밀번호: {비번}\n사이트: {사이트}',
   'ID/임시비번 발송용. 치환: {이름} {강의명} {아이디} {비번} {사이트}'),
  ('invite_both', '강의 안내 — 링크 + 계정',
   E'[WEBHEADS LMS]\n{이름}님, {강의명} 수강 안내입니다.\n[1] 자동 로그인 링크: {링크}\n[2] ID/PW: {아이디} / {비번}\n(링크 유효기간: {만료일}까지)',
   '둘 다 발송용.'),
  ('reminder', '수강 리마인드',
   E'[WEBHEADS LMS]\n{이름}님, {강의명}의 수강 기한이 {남은일수}일 남았습니다.\n{링크}',
   '미수료자 리마인드.')
ON CONFLICT (template_key) DO NOTHING;
