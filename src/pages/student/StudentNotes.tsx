import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { NotebookPen, Search, ChevronRight, BookOpen } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useCourseI18n, useContentI18n } from "@/hooks/useI18nMaps";

type NoteRow = {
  id: string;
  note: string;
  updated_at: string;
  content_id: string;
  course_contents: {
    id: string;
    title: string;
    course_id: string;
    courses: { id: string; title: string } | null;
  } | null;
};

const StudentNotes = () => {
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const [search, setSearch] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["my-lesson-notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_notes")
        .select(
          "id, note, updated_at, content_id, course_contents:content_id(id, title, course_id, courses:course_id(id, title))",
        )
        .eq("user_id", user!.id)
        .neq("note", "")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NoteRow[];
    },
    enabled: !!user?.id,
  });

  const { tCourseTitle } = useCourseI18n(notes.map((n) => n.course_contents?.course_id));
  const { tContentTitle } = useContentI18n(notes.map((n) => n.content_id));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const title = (
        tContentTitle({ id: n.content_id, title: n.course_contents?.title }) || ""
      ).toLowerCase();
      const courseTitle = (
        tCourseTitle({
          id: n.course_contents?.course_id,
          title: n.course_contents?.courses?.title,
        }) || ""
      ).toLowerCase();
      return (
        n.note.toLowerCase().includes(q) ||
        title.includes(q) ||
        courseTitle.includes(q)
      );
    });
  }, [notes, search, tContentTitle, tCourseTitle]);

  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language?.startsWith("en") ? "en-US" : "ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <header>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2">
            <NotebookPen className="h-6 w-6" aria-hidden="true" />
            {t("studentNotes.title", "내 학습 메모")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "studentNotes.subtitle",
              "차시별로 작성한 학습 메모를 한 곳에서 모아 볼 수 있어요. 메모를 클릭하면 해당 차시로 이동합니다.",
            )}
          </p>
        </header>

        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("studentNotes.searchPlaceholder", "강의·차시·메모 내용 검색")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <NotebookPen
              className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {search
                ? t("studentNotes.emptySearch", "검색 결과가 없습니다.")
                : t(
                    "studentNotes.empty",
                    "아직 작성한 학습 메모가 없습니다. 강의 학습 화면 하단에서 메모를 남겨보세요.",
                  )}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {filtered.map((n) => {
              const lessonTitle =
                tContentTitle({ id: n.content_id, title: n.course_contents?.title }) || "-";
              const courseTitle =
                tCourseTitle({
                  id: n.course_contents?.course_id,
                  title: n.course_contents?.courses?.title,
                }) || "-";
              const courseId = n.course_contents?.course_id;
              const href =
                courseId && n.content_id
                  ? `/student/courses/${courseId}/content/${n.content_id}`
                  : "#";
              return (
                <li key={n.id}>
                  <Link
                    to={href}
                    className="group block rounded-xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{courseTitle}</span>
                        </div>
                        <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-1">
                          {lessonTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 leading-relaxed">
                          {n.note}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {dateFmt(n.updated_at)}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StudentNotes;
