import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers to look up translated titles/descriptions for the active language.
 *
 * The app currently supports KO (default) and EN. When the active language is
 * Korean we always return the source value from the base table. When EN is
 * active we look up the matching row in the *_i18n table and fall back to the
 * source value if no translation exists yet.
 *
 * Each hook intentionally keeps its query enabled flag tight so that pages
 * that don't need a particular i18n table never trigger a network request.
 */

/**
 * Statuses that are considered "safe to expose to learners".
 * Per operator decision (편의 우선): ai_generated and sync_required translations
 * are exposed immediately so that learners see EN content as soon as the AI fills
 * it in (or as soon as a previously translated row exists, even if the KO source
 * has since changed). Only `draft` still falls back to KO.
 */
const APPROVED_STATUSES = [
  "ai_generated",
  "reviewed",
  "published",
  "human_reviewed",
  "sync_required",
] as const;

export const useActiveLanguage = () => {
  const { i18n } = useTranslation();
  const isEn = !!i18n.language?.toLowerCase().startsWith("en");
  return { isEn, lang: isEn ? "en" : "ko" } as const;
};

/**
 * Inline-EN localiser for rows whose English text is stored on the same
 * row (e.g. categories.name_en, learning_tracks.name_en, departments.name_en).
 *
 * Usage:
 *   const localizeName = useInlineEnName();
 *   localizeName(category) // → category.name_en when EN active, otherwise category.name
 */
export const useInlineEnName = () => {
  const { isEn } = useActiveLanguage();
  return <T extends { name?: string | null; name_en?: string | null }>(row: T | null | undefined): string => {
    if (!row) return "";
    if (isEn && row.name_en && row.name_en.trim()) return row.name_en;
    return row.name ?? "";
  };
};

/**
 * Same idea for the description field.
 */
export const useInlineEnDescription = () => {
  const { isEn } = useActiveLanguage();
  return <T extends { description?: string | null; description_en?: string | null }>(row: T | null | undefined): string => {
    if (!row) return "";
    if (isEn && row.description_en && row.description_en.trim()) return row.description_en;
    return row.description ?? "";
  };
};

const dedupe = (ids: (string | null | undefined)[]) =>
  Array.from(new Set(ids.filter((v): v is string => !!v))).sort();

type Row = {
  title: string | null;
  description?: string | null;
  content?: string | null;
};

const pickField = (row: Row | undefined, field: "title" | "description" | "content") => {
  if (!row) return undefined;
  return (row as any)[field] as string | null | undefined;
};

export const useCourseI18n = (courseIds: (string | null | undefined)[]) => {
  const { isEn } = useActiveLanguage();
  const ids = dedupe(courseIds);
  const { data = [] } = useQuery({
    queryKey: ["i18n-map-course", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("course_i18n")
        .select("course_id, title, description, translation_status")
        .eq("language_code", "en")
        .in("translation_status", APPROVED_STATUSES as unknown as string[])
        .in("course_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: isEn && ids.length > 0,
    staleTime: 60_000,
  });
  const map = new Map<string, { title: string | null; description: string | null }>(
    (data || []).map((r: any) => [r.course_id, { title: r.title, description: r.description }]),
  );
  const tCourseTitle = <T extends { id?: string | null; title?: string | null }>(c: T | null | undefined) => {
    if (!c) return "";
    if (!isEn || !c.id) return c.title ?? "";
    return map.get(c.id)?.title || c.title || "";
  };
  const tCourseDescription = <T extends { id?: string | null; description?: string | null }>(c: T | null | undefined) => {
    if (!c) return "";
    if (!isEn || !c.id) return c.description ?? "";
    return map.get(c.id)?.description || c.description || "";
  };
  return { isEn, map, tCourseTitle, tCourseDescription };
};

export const useContentI18n = (contentIds: (string | null | undefined)[]) => {
  const { isEn } = useActiveLanguage();
  const ids = dedupe(contentIds);
  const { data = [] } = useQuery({
    queryKey: ["i18n-map-content", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("course_content_i18n")
        .select("content_id, title, description, translation_status")
        .eq("language_code", "en")
        .in("translation_status", APPROVED_STATUSES as unknown as string[])
        .in("content_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: isEn && ids.length > 0,
    staleTime: 60_000,
  });
  const map = new Map<string, { title: string | null; description: string | null }>(
    (data || []).map((r: any) => [r.content_id, { title: r.title, description: r.description }]),
  );
  const tContentTitle = <T extends { id?: string | null; title?: string | null }>(c: T | null | undefined) => {
    if (!c) return "";
    if (!isEn || !c.id) return c.title ?? "";
    return map.get(c.id)?.title || c.title || "";
  };
  return { isEn, map, tContentTitle };
};

export const useAssessmentI18n = (assessmentIds: (string | null | undefined)[]) => {
  const { isEn } = useActiveLanguage();
  const ids = dedupe(assessmentIds);
  const { data = [] } = useQuery({
    queryKey: ["i18n-map-assessment", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_i18n")
        .select("assessment_id, title, description, translation_status")
        .eq("language_code", "en")
        .in("translation_status", APPROVED_STATUSES as unknown as string[])
        .in("assessment_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: isEn && ids.length > 0,
    staleTime: 60_000,
  });
  const map = new Map<string, { title: string | null; description: string | null }>(
    (data || []).map((r: any) => [r.assessment_id, { title: r.title, description: r.description }]),
  );
  const tAssessmentTitle = <T extends { id?: string | null; title?: string | null }>(a: T | null | undefined) => {
    if (!a) return "";
    if (!isEn || !a.id) return a.title ?? "";
    return map.get(a.id)?.title || a.title || "";
  };
  const tAssessmentDescription = <T extends { id?: string | null; description?: string | null }>(a: T | null | undefined) => {
    if (!a) return "";
    if (!isEn || !a.id) return a.description ?? "";
    return map.get(a.id)?.description || a.description || "";
  };
  return { isEn, map, tAssessmentTitle, tAssessmentDescription };
};

export const useAssessmentQuestionI18n = (questionIds: (string | null | undefined)[]) => {
  const { isEn } = useActiveLanguage();
  const ids = dedupe(questionIds);
  const { data = [] } = useQuery({
    queryKey: ["i18n-map-question", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("assessment_question_i18n")
        .select("question_id, question_text, options, hint, explanation, translation_status")
        .eq("language_code", "en")
        .in("translation_status", APPROVED_STATUSES as unknown as string[])
        .in("question_id", ids);
      if (error) throw error;
      return data || [];
    },
    enabled: isEn && ids.length > 0,
    staleTime: 60_000,
  });
  const map = new Map<
    string,
    { question_text: string | null; options: any; hint: string | null; explanation: string | null }
  >(
    (data || []).map((r: any) => [
      r.question_id,
      { question_text: r.question_text, options: r.options, hint: r.hint, explanation: r.explanation },
    ]),
  );
  const tQuestionText = (q: { id?: string | null; question_text?: string | null } | null | undefined) => {
    if (!q) return "";
    if (!isEn || !q.id) return q.question_text ?? "";
    return map.get(q.id)?.question_text || q.question_text || "";
  };
  const tQuestionOptions = (q: { id?: string | null; options?: any } | null | undefined): any => {
    if (!q) return null;
    if (!isEn || !q.id) return q.options;
    const en = map.get(q.id)?.options;
    return en ?? q.options;
  };
  const tQuestionHint = (q: { id?: string | null; hint?: string | null } | null | undefined) => {
    if (!q) return "";
    if (!isEn || !q.id) return q.hint ?? "";
    return map.get(q.id)?.hint || q.hint || "";
  };
  const tQuestionExplanation = (q: { id?: string | null; explanation?: string | null } | null | undefined) => {
    if (!q) return "";
    if (!isEn || !q.id) return q.explanation ?? "";
    return map.get(q.id)?.explanation || q.explanation || "";
  };
  return { isEn, map, tQuestionText, tQuestionOptions, tQuestionHint, tQuestionExplanation };
};
