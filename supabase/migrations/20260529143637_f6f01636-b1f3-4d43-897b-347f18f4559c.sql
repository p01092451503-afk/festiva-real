
CREATE TYPE public.correction_status AS ENUM ('pending', 'in_progress', 'completed', 'returned');

CREATE TABLE public.correction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  course_id UUID NULL,
  topic TEXT NOT NULL,
  note TEXT NULL,
  status public.correction_status NOT NULL DEFAULT 'pending',
  assigned_teacher_id UUID NULL,
  score INTEGER NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  summary TEXT NULL,
  next_recommendation TEXT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_correction_requests_student ON public.correction_requests(student_id);
CREATE INDEX idx_correction_requests_teacher ON public.correction_requests(assigned_teacher_id);
CREATE INDEX idx_correction_requests_status ON public.correction_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_requests TO authenticated;
GRANT ALL ON public.correction_requests TO service_role;
ALTER TABLE public.correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students view own correction requests"
ON public.correction_requests FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "students create own correction requests"
ON public.correction_requests FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

CREATE POLICY "teachers view correction queue"
ON public.correction_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (assigned_teacher_id IS NULL OR assigned_teacher_id = auth.uid())
);

CREATE POLICY "teachers update assigned correction"
ON public.correction_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND (assigned_teacher_id IS NULL OR assigned_teacher_id = auth.uid())
)
WITH CHECK (public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "admins manage all correction requests"
ON public.correction_requests FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE TABLE public.correction_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.correction_requests(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  original_path TEXT NOT NULL,
  annotated_path TEXT NULL,
  width INTEGER NULL,
  height INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, page_no)
);
CREATE INDEX idx_correction_pages_request ON public.correction_pages(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_pages TO authenticated;
GRANT ALL ON public.correction_pages TO service_role;
ALTER TABLE public.correction_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pages follow parent request visibility"
ON public.correction_pages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id = correction_pages.request_id
      AND (
        r.student_id = auth.uid()
        OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND (r.assigned_teacher_id IS NULL OR r.assigned_teacher_id = auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE POLICY "student or admin/teacher can insert pages"
ON public.correction_pages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id = correction_pages.request_id
      AND (
        r.student_id = auth.uid()
        OR public.has_role(auth.uid(), 'teacher'::public.app_role)
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE POLICY "teacher or admin can update pages"
ON public.correction_pages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id = correction_pages.request_id
      AND (
        (public.has_role(auth.uid(), 'teacher'::public.app_role) AND (r.assigned_teacher_id IS NULL OR r.assigned_teacher_id = auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE POLICY "owner/teacher/admin can delete pages"
ON public.correction_pages FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id = correction_pages.request_id
      AND (
        (r.student_id = auth.uid() AND r.status = 'pending')
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE TABLE public.correction_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.correction_pages(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.correction_requests(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  snapshot JSONB NULL,
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_correction_annotations_page ON public.correction_annotations(page_id);
CREATE INDEX idx_correction_annotations_request ON public.correction_annotations(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.correction_annotations TO authenticated;
GRANT ALL ON public.correction_annotations TO service_role;
ALTER TABLE public.correction_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annotations follow parent visibility"
ON public.correction_annotations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id = correction_annotations.request_id
      AND (
        r.student_id = auth.uid()
        OR (public.has_role(auth.uid(), 'teacher'::public.app_role) AND (r.assigned_teacher_id IS NULL OR r.assigned_teacher_id = auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      )
  )
);

CREATE POLICY "teachers/admins write annotations"
ON public.correction_annotations FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

CREATE POLICY "authors update their annotations"
ON public.correction_annotations FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE POLICY "authors delete their annotations"
ON public.correction_annotations FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
);

CREATE TRIGGER trg_correction_requests_updated_at
BEFORE UPDATE ON public.correction_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_correction_pages_updated_at
BEFORE UPDATE ON public.correction_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_correction_annotations_updated_at
BEFORE UPDATE ON public.correction_annotations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('corrections', 'corrections', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "students access their correction files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'corrections'
  AND EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.student_id = auth.uid()
  )
);

CREATE POLICY "students upload to own correction folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'corrections'
  AND EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.student_id = auth.uid()
  )
);

CREATE POLICY "students delete own correction files when pending"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'corrections'
  AND EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND r.student_id = auth.uid()
      AND r.status = 'pending'
  )
);

CREATE POLICY "teachers access assigned correction files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'corrections'
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND (r.assigned_teacher_id IS NULL OR r.assigned_teacher_id = auth.uid())
  )
);

CREATE POLICY "teachers upload annotated files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'corrections'
  AND public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.correction_requests r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND (r.assigned_teacher_id IS NULL OR r.assigned_teacher_id = auth.uid())
  )
);

CREATE POLICY "admins full access correction files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'corrections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'corrections'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);
