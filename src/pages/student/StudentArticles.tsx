import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Newspaper, Search, Eye, Calendar } from "lucide-react";

interface ArticleListItem {
  id: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  tags: string[];
  published_at: string | null;
  publish_at: string | null;
  view_count: number;
}

interface CategoryRow {
  id: string;
  name: string;
  name_en: string | null;
}

export default function StudentArticles() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Debounce search (useEffect로 처리해야 타이머가 정상 해제됨)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: categories = [] } = useQuery({
    queryKey: ["public-article-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_categories" as any)
        .select("id,name,name_en")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as CategoryRow[];
    },
  });

  // Use full-text search RPC when search is present, otherwise direct list
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["public-articles", debounced, categoryFilter],
    queryFn: async () => {
      if (debounced) {
        const { data, error } = await supabase.rpc("search_articles" as any, {
          p_query: debounced,
          p_category_id: categoryFilter === "all" ? null : categoryFilter,
          p_tag: null,
          p_limit: 60,
          p_offset: 0,
        });
        if (error) throw error;
        return (data || []) as unknown as ArticleListItem[];
      }
      let q = supabase
        .from("articles" as any)
        .select("id,title,summary,thumbnail_url,category_id,tags,published_at,publish_at,view_count")
        .eq("status", "published")
        .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
        .order("published_at", { ascending: false })
        .limit(60);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ArticleListItem[];
    },
  });

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(isEn ? "en-US" : "ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

  const catName = (id: string | null) => {
    if (!id) return "";
    const c = categories.find((c) => c.id === id);
    if (!c) return "";
    return isEn ? c.name_en || c.name : c.name;
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start gap-3">
          <Newspaper className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "Articles" : "아티클"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Latest curated articles for your learning."
                : "학습에 도움이 되는 최신 큐레이션 기사를 확인하세요."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? "Search articles…" : "기사 검색…"}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All categories" : "전체 카테고리"}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {isEn ? c.name_en || c.name : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            {isEn ? "Loading…" : "불러오는 중…"}
          </div>
        ) : articles.length === 0 ? (
          <div className="border-2 border-border/80 rounded-md py-20 text-center">
            <Newspaper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {isEn ? "No articles available." : "표시할 기사가 없습니다."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/articles/${a.id}`}
                className="group block border-2 border-border/80 rounded-md overflow-hidden hover:border-foreground/40 transition-colors bg-background"
              >
                {a.thumbnail_url ? (
                  <div className="aspect-[16/10] bg-muted overflow-hidden">
                    <img
                      src={a.thumbnail_url}
                      alt={a.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/10] bg-muted/40 flex items-center justify-center">
                    <Newspaper className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2">
                    {a.category_id && (
                      <span className="px-1.5 py-0.5 rounded bg-accent text-accent-foreground whitespace-nowrap">
                        {catName(a.category_id)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="h-3 w-3" />
                      {fmt(a.published_at || a.publish_at)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground line-clamp-2 leading-snug">
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex flex-wrap gap-1">
                      {(a.tags || []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                      <Eye className="h-3 w-3" />
                      {a.view_count}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}