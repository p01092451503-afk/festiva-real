CREATE TABLE public.content_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL UNIQUE REFERENCES public.course_contents(id) ON DELETE CASCADE,
  summary text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'metadata',
  language text NOT NULL DEFAULT 'ko',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewers of content can read its summary"
ON public.content_summaries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.course_contents cc
    WHERE cc.id = content_summaries.content_id
      AND (
        EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = auth.uid() AND e.course_id = cc.course_id)
        OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cc.course_id AND c.instructor_id = auth.uid())
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'super_admin'::app_role)
      )
  )
);

CREATE POLICY "Admins manage summaries"
ON public.content_summaries FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_content_summaries_updated_at
BEFORE UPDATE ON public.content_summaries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();