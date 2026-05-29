-- ──────────────────────────────────────────────────────────────
-- Add EN translation columns to categories so the catalog,
-- track panel, and course cards can localise category names.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text;

-- ──────────────────────────────────────────────────────────────
-- Helper RPC: list rows that still need EN for tracks/categories.
-- We expose two simple filter modes: 'en_missing' or 'all'.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_simple_i18n_missing(
  p_kind text,
  p_filter text DEFAULT 'en_missing'
)
RETURNS TABLE(item_id uuid, ko_name text, ko_description text, en_name text, en_description text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_kind = 'track' THEN
    RETURN QUERY
      SELECT t.id, t.name, t.description, t.name_en, t.description_en
      FROM public.learning_tracks t
      WHERE p_filter = 'all'
         OR (coalesce(nullif(btrim(t.name_en), ''), '') = ''
             OR (t.description IS NOT NULL AND coalesce(nullif(btrim(t.description_en), ''), '') = ''));
  ELSIF p_kind = 'category' THEN
    RETURN QUERY
      SELECT c.id, c.name, c.description, c.name_en, c.description_en
      FROM public.categories c
      WHERE p_filter = 'all'
         OR (coalesce(nullif(btrim(c.name_en), ''), '') = ''
             OR (c.description IS NOT NULL AND coalesce(nullif(btrim(c.description_en), ''), '') = ''));
  ELSIF p_kind = 'track_step' THEN
    RETURN QUERY
      SELECT s.id, s.name, NULL::text, s.name_en, NULL::text
      FROM public.track_steps s
      WHERE p_filter = 'all'
         OR coalesce(nullif(btrim(s.name_en), ''), '') = '';
  ELSE
    RAISE EXCEPTION 'unknown kind: %', p_kind;
  END IF;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Apply EN translations directly back to the source tables.
-- Used by the bulk-translate edge function for tracks/categories.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_simple_i18n(
  p_kind text,
  p_item_id uuid,
  p_name_en text,
  p_description_en text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_kind = 'track' THEN
    UPDATE public.learning_tracks
       SET name_en = COALESCE(NULLIF(btrim(p_name_en), ''), name_en),
           description_en = COALESCE(NULLIF(btrim(p_description_en), ''), description_en)
     WHERE id = p_item_id;
  ELSIF p_kind = 'category' THEN
    UPDATE public.categories
       SET name_en = COALESCE(NULLIF(btrim(p_name_en), ''), name_en),
           description_en = COALESCE(NULLIF(btrim(p_description_en), ''), description_en)
     WHERE id = p_item_id;
  ELSIF p_kind = 'track_step' THEN
    UPDATE public.track_steps
       SET name_en = COALESCE(NULLIF(btrim(p_name_en), ''), name_en)
     WHERE id = p_item_id;
  ELSE
    RAISE EXCEPTION 'unknown kind: %', p_kind;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_simple_i18n_missing(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_simple_i18n(text, uuid, text, text) TO authenticated;