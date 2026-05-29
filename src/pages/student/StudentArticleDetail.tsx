import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Newspaper, ArrowLeft, Calendar, Eye } from "lucide-react";

interface ArticleDetail {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  thumbnail_url: string | null;
  tags: string[];
  category_id: string | null;
  published_at: string | null;
  publish_at: string | null;
  view_count: number;
  language_code: string;
}

export default function StudentArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");

  const { data: article, isLoading } = useQuery({
    queryKey: ["article-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ArticleDetail | null;
    },
  });

  // Increment view count once on load
  useEffect(() => {
    if (!article?.id) return;
    supabase
      .from("articles" as any)
      .update({ view_count: (article.view_count || 0) + 1 })
      .eq("id", article.id)
      .then(() => {});
  }, [article?.id]);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(isEn ? "en-US" : "ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

  return (
    <DashboardLayout role="student">
      <div className="space-y-6 min-w-0 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/articles")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {isEn ? "Back to articles" : "아티클 목록"}
        </Button>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{isEn ? "Loading…" : "불러오는 중…"}</div>
        ) : !article ? (
          <div className="border-2 border-border/80 rounded-md py-20 text-center">
            <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {isEn ? "Article not found." : "기사를 찾을 수 없습니다."}
            </p>
          </div>
        ) : (
          <article className="space-y-6">
            {article.thumbnail_url && (
              <div className="aspect-[16/9] rounded-md overflow-hidden bg-muted border-2 border-border/80">
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <header className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                {article.title}
              </h1>
              {article.summary && (
                <p className="text-base text-muted-foreground">{article.summary}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="h-3.5 w-3.5" />
                  {fmt(article.published_at || article.publish_at)}
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Eye className="h-3.5 w-3.5" />
                  {article.view_count}
                </span>
                {(article.tags || []).map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            </header>
            <div className="border-t-2 border-border/80 pt-6">
              <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-foreground prose-a:underline">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body || ""}</ReactMarkdown>
              </div>
            </div>
          </article>
        )}
      </div>
    </DashboardLayout>
  );
}