import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Newspaper,
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  CalendarClock,
  Send,
  Archive,
  FileText as FileIcon,
} from "lucide-react";

type ArticleStatus = "draft" | "scheduled" | "published" | "archived";

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  status: ArticleStatus;
  publish_at: string | null;
  published_at: string | null;
  category_id: string | null;
  tags: string[];
  language_code: string;
  view_count: number;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
}

const EMPTY_FORM = {
  title: "",
  summary: "",
  body: "",
  status: "draft" as ArticleStatus,
  category_id: "",
  tags: "",
  publish_at: "",
  language_code: "ko",
};

const STATUS_LABEL: Record<ArticleStatus, { ko: string; en: string }> = {
  draft: { ko: "임시저장", en: "Draft" },
  scheduled: { ko: "예약", en: "Scheduled" },
  published: { ko: "발행", en: "Published" },
  archived: { ko: "보관", en: "Archived" },
};

export default function AdminCmsArticles() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith("en");
  const qc = useQueryClient();
  const { user } = useUser();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: categories = [] } = useQuery({
    queryKey: ["cms-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_categories" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as CategoryRow[];
    },
  });

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["cms-articles", statusFilter, categoryFilter],
    queryFn: async () => {
      let q = supabase
        .from("articles" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (categoryFilter !== "all") q = q.eq("category_id", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ArticleRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const s = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(s) ||
        (a.summary || "").toLowerCase().includes(s) ||
        a.tags.some((t) => t.toLowerCase().includes(s)),
    );
  }, [articles, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, language_code: isEn ? "en" : "ko" });
    setDialogOpen(true);
  };

  const openEdit = (a: ArticleRow) => {
    setEditing(a);
    setForm({
      title: a.title,
      summary: a.summary || "",
      body: a.body || "",
      status: a.status,
      category_id: a.category_id || "",
      tags: (a.tags || []).join(", "),
      publish_at: a.publish_at ? a.publish_at.slice(0, 16) : "",
      language_code: a.language_code || "ko",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error(isEn ? "Title is required" : "제목을 입력해 주세요");
      const tags = form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let status: ArticleStatus = form.status;
      let publish_at: string | null = null;
      let published_at: string | null | undefined = undefined;
      if (form.status === "scheduled") {
        if (!form.publish_at) throw new Error(isEn ? "Pick a publish time" : "예약 시각을 선택해 주세요");
        const ts = new Date(form.publish_at);
        if (ts.getTime() <= Date.now()) {
          // past time → publish immediately
          status = "published";
          published_at = new Date().toISOString();
        } else {
          publish_at = ts.toISOString();
        }
      } else if (form.status === "published") {
        published_at = editing?.published_at || new Date().toISOString();
      }

      const payload: any = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body,
        status,
        category_id: form.category_id || null,
        tags,
        publish_at,
        language_code: form.language_code,
      };
      if (published_at !== undefined) payload.published_at = published_at;

      if (editing) {
        const { error } = await supabase
          .from("articles" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.author_id = user?.id;
        const { error } = await supabase.from("articles" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEn ? "Saved" : "저장되었습니다");
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cms-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("articles" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEn ? "Deleted" : "삭제되었습니다");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["cms-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const quickAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "publish" | "archive" | "draft" }) => {
      const payload: any = {};
      if (action === "publish") {
        payload.status = "published";
        payload.published_at = new Date().toISOString();
        payload.publish_at = null;
      } else if (action === "archive") {
        payload.status = "archived";
      } else {
        payload.status = "draft";
        payload.publish_at = null;
      }
      const { error } = await supabase.from("articles" as any).update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isEn ? "Updated" : "상태가 변경되었습니다");
      qc.invalidateQueries({ queryKey: ["cms-articles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(isEn ? "en-US" : "ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const catName = (id: string | null) => {
    if (!id) return "—";
    const c = categories.find((c) => c.id === id);
    if (!c) return "—";
    return isEn ? c.name_en || c.name : c.name;
  };

  const statusBadge = (s: ArticleStatus) => {
    const variants: Record<ArticleStatus, string> = {
      draft: "bg-muted text-muted-foreground",
      scheduled: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
      published: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
      archived: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${variants[s]}`}>
        {STATUS_LABEL[s][isEn ? "en" : "ko"]}
      </span>
    );
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 min-w-0">
        <div className="flex items-start gap-3">
          <Newspaper className="h-7 w-7 text-foreground mt-1" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {isEn ? "CMS · Articles" : "CMS · 아티클 관리"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEn
                ? "Create, schedule and publish articles for learners and AI question generation."
                : "학습자 열람 및 AI 문제 생성용 기사를 작성하고 예약/발행합니다."}
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {isEn ? "New Article" : "새 기사"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? "Search title, summary, tag…" : "제목·요약·태그 검색…"}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isEn ? "All status" : "전체 상태"}</SelectItem>
              <SelectItem value="draft">{STATUS_LABEL.draft[isEn ? "en" : "ko"]}</SelectItem>
              <SelectItem value="scheduled">{STATUS_LABEL.scheduled[isEn ? "en" : "ko"]}</SelectItem>
              <SelectItem value="published">{STATUS_LABEL.published[isEn ? "en" : "ko"]}</SelectItem>
              <SelectItem value="archived">{STATUS_LABEL.archived[isEn ? "en" : "ko"]}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
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

        {/* List */}
        <div className="border-2 border-border/80 rounded-md overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_140px_180px_120px] gap-3 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted/30 border-b-2 border-border/80">
            <div>{isEn ? "Title" : "제목"}</div>
            <div>{isEn ? "Status" : "상태"}</div>
            <div>{isEn ? "Category" : "카테고리"}</div>
            <div>{isEn ? "Publish" : "발행 시각"}</div>
            <div className="text-right">{isEn ? "Actions" : "관리"}</div>
          </div>

          {isLoading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {isEn ? "Loading…" : "불러오는 중…"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <FileIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {isEn ? "No articles yet." : "등록된 기사가 없습니다."}
              </p>
            </div>
          ) : (
            filtered.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_180px_120px] gap-3 px-4 py-4 border-b-2 border-border/80 hover:bg-accent/20 transition-colors items-center"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">{a.title}</div>
                  {a.summary && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{a.summary}</div>
                  )}
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {a.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>{statusBadge(a.status)}</div>
                <div className="text-xs text-muted-foreground truncate">{catName(a.category_id)}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {a.status === "scheduled"
                    ? fmt(a.publish_at)
                    : a.status === "published"
                    ? fmt(a.published_at)
                    : "—"}
                </div>
                <div className="flex items-center gap-1 justify-end flex-wrap">
                  {a.status !== "published" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title={isEn ? "Publish now" : "즉시 발행"}
                      onClick={() => quickAction.mutate({ id: a.id, action: "publish" })}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {a.status !== "archived" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title={isEn ? "Archive" : "보관"}
                      onClick={() => quickAction.mutate({ id: a.id, action: "archive" })}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Editor Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                {editing
                  ? isEn
                    ? "Edit Article"
                    : "기사 수정"
                  : isEn
                  ? "New Article"
                  : "새 기사 작성"}
              </DialogTitle>
              <DialogDescription>
                {isEn
                  ? "Markdown supported in body. Use Scheduled to publish later."
                  : "본문은 Markdown을 지원합니다. 예약 발행 시 시각을 지정하세요."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>{isEn ? "Title" : "제목"} *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={isEn ? "Article title" : "기사 제목"}
                />
              </div>
              <div>
                <Label>{isEn ? "Summary" : "요약"}</Label>
                <Textarea
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder={isEn ? "Short summary shown in lists" : "목록에 노출될 짧은 요약"}
                  className="min-h-[60px]"
                />
              </div>
              <div>
                <Label>{isEn ? "Body (Markdown)" : "본문 (Markdown)"} *</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={
                    isEn
                      ? "## Heading\n\nWrite the article here…"
                      : "## 소제목\n\n기사 본문을 작성하세요…"
                  }
                  className="min-h-[280px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.body.length.toLocaleString()} {isEn ? "chars" : "자"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>{isEn ? "Category" : "카테고리"}</Label>
                  <Select
                    value={form.category_id || "none"}
                    onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isEn ? "Uncategorized" : "미지정"}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {isEn ? c.name_en || c.name : c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isEn ? "Language" : "언어"}</Label>
                  <Select
                    value={form.language_code}
                    onValueChange={(v) => setForm({ ...form, language_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ko">한국어</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isEn ? "Status" : "상태"}</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({ ...form, status: v as ArticleStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{STATUS_LABEL.draft[isEn ? "en" : "ko"]}</SelectItem>
                      <SelectItem value="scheduled">{STATUS_LABEL.scheduled[isEn ? "en" : "ko"]}</SelectItem>
                      <SelectItem value="published">{STATUS_LABEL.published[isEn ? "en" : "ko"]}</SelectItem>
                      <SelectItem value="archived">{STATUS_LABEL.archived[isEn ? "en" : "ko"]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{isEn ? "Tags (comma separated)" : "태그 (쉼표로 구분)"}</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder={isEn ? "ai, education, trends" : "AI, 교육, 트렌드"}
                />
              </div>

              {form.status === "scheduled" && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {isEn ? "Publish at" : "예약 발행 시각"} *
                  </Label>
                  <Input
                    type="datetime-local"
                    value={form.publish_at}
                    onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEn
                      ? "Will be auto-published when this time arrives."
                      : "지정 시각이 되면 자동으로 발행됩니다."}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {isEn ? "Cancel" : "취소"}
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (isEn ? "Saving…" : "저장 중…") : isEn ? "Save" : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isEn ? "Delete article?" : "기사를 삭제할까요?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {isEn
                  ? "This action cannot be undone."
                  : "삭제된 기사는 복구할 수 없습니다."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isEn ? "Cancel" : "취소"}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isEn ? "Delete" : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}