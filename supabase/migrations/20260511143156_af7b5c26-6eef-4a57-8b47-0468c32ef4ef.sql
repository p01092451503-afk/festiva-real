
-- Table for AI-based English correction history
CREATE TABLE public.english_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  diffs JSONB,                -- [{type:'add'|'remove'|'equal', text:'...'}]
  issues JSONB,               -- [{type:'grammar'|'spelling'|'vocabulary'|'style'|'punctuation', original, suggestion, explanation_ko}]
  alternatives JSONB,         -- [{text, note_ko}]
  cefr_level TEXT,            -- A1..C2
  overall_feedback_ko TEXT,
  tone TEXT NOT NULL DEFAULT 'neutral', -- neutral|formal|casual|business|academic
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_english_corrections_user_created
  ON public.english_corrections (user_id, created_at DESC);

ALTER TABLE public.english_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own corrections"
  ON public.english_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own corrections"
  ON public.english_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own corrections"
  ON public.english_corrections FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all corrections"
  ON public.english_corrections FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
