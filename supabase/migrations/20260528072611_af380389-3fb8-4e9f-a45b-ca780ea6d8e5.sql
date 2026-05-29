
CREATE TABLE public.lesson_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  student_answer TEXT NOT NULL,
  reference_text TEXT,
  corrected_text TEXT NOT NULL,
  score INTEGER,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_feedback TEXT,
  input_mode TEXT NOT NULL DEFAULT 'text',
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_corrections_user_content ON public.lesson_corrections(user_id, content_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_corrections TO authenticated;
GRANT ALL ON public.lesson_corrections TO service_role;

ALTER TABLE public.lesson_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own corrections"
ON public.lesson_corrections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own corrections"
ON public.lesson_corrections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own corrections"
ON public.lesson_corrections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all corrections"
ON public.lesson_corrections FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
