import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Languages, Loader2, RefreshCw, AlertTriangle, CheckCircle2, FileWarning, Sparkles, Download, Upload, BookText, Eye, Send, Wand2 } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import I18nPreviewDialog from "@/components/admin/I18nPreviewDialog";

type ContentType = "course" | "content" | "assessment" | "announcement" | "board";
type Filter = "en_missing" | "sync_required" | "all";

interface DashboardStat {
  content_type: ContentType;
  total: number;
  ko_only: number;
  en_missing: number;
  sync_required: number;
  reviewed: number;
}

interface MissingItem {
  item_id: string;
  ko_title: string | null;
  ko_content: string | null;
  en_title: string | null;
  status: string;
  updated_at: string | null;
}

const TYPE_LABEL: Record<ContentType, string> = {
  course: "강의",
  content: "차시",
  assessment: "평가",
  announcement: "공지",
  board: "게시판",
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "초안", variant: "outline" },
  ai_generated: { label: "AI 번역", variant: "secondary" },
  reviewed: { label: "검수 완료", variant: "default" },
  published: { label: "게시됨", variant: "default" },
  sync_required: { label: "동기화 필요", variant: "destructive" },
};


const AdminI18nDashboard = () => {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<ContentType>("course");
  const [filter, setFilter] = useState<Filter>("en_missing");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Stats
  const { data: stats = [], isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["i18n-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_i18n_dashboard_stats");
      if (error) throw error;
      return (data ?? []) as DashboardStat[];
    },
    staleTime: 30 * 1000,
  });

  // List
  const { data: items = [], isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["i18n-missing", activeType, filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_i18n_missing_items", {
        p_content_type: activeType,
        p_filter: filter,
      });
      if (error) throw error;
      return (data ?? []) as MissingItem[];
    },
    staleTime: 30 * 1000,
  });

  // Drift detection
  const driftMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("detect_i18n_drift");
      if (error) throw error;
      return data as Record<string, number>;
    },
    onSuccess: (data) => {
      const total = Object.values(data ?? {}).reduce((s, v) => s + (v || 0), 0);
      toast({
        title: "변경 감지 완료",
        description: total > 0 ? `${total}건의 동기화 필요 항목을 발견했습니다.` : "모든 콘텐츠가 동기화 상태입니다.",
      });
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
    },
    onError: () => toast({ title: "감지 실패", variant: "destructive" }),
  });

  // Bulk translate
  const translateMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("translate-batch", {
        body: { content_type: activeType, item_ids: ids },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { translated?: number; failed?: number }) => {
      toast({
        title: "일괄 번역 완료",
        description: `${data?.translated ?? 0}건 번역 / ${data?.failed ?? 0}건 실패`,
      });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
    },
    onError: () => toast({ title: "번역 실패", variant: "destructive" }),
  });

  // Backfill: translate ALL EN-missing items across every content type.
  const backfillMutation = useMutation({
    mutationFn: async () => {
      const types: ContentType[] = ["course", "content", "assessment", "announcement", "board"];
      let totalTranslated = 0;
      let totalFailed = 0;
      for (const type of types) {
        // Collect both EN-missing AND sync_required (stale) items so the
        // "전체 자동 번역" button truly clears the dashboard backlog.
        const idSet = new Set<string>();
        for (const filter of ["en_missing", "sync_required"] as const) {
          const { data: missing, error: e1 } = await supabase.rpc("get_i18n_missing_items", {
            p_content_type: type,
            p_filter: filter,
          });
          if (e1) throw e1;
          for (const r of ((missing ?? []) as Array<{ item_id: string }>)) {
            if (r.item_id) idSet.add(r.item_id);
          }
        }
        const ids = Array.from(idSet);
        if (ids.length === 0) continue;
        // Process in chunks of 20 to keep edge function responsive
        for (let i = 0; i < ids.length; i += 20) {
          const slice = ids.slice(i, i + 20);
          const { data, error } = await supabase.functions.invoke("translate-batch", {
            body: { content_type: type, item_ids: slice },
          });
          if (error) { totalFailed += slice.length; continue; }
          totalTranslated += (data?.translated ?? 0);
          totalFailed += (data?.failed ?? 0);
        }
      }

      // ── Inline-EN kinds: tracks, track steps, categories ─────────
      // These store the translation directly on the source row
      // (no i18n table). They are reached via dedicated RPCs.
      const inlineKinds = ["track", "track_step", "category"] as const;
      for (const kind of inlineKinds) {
        const { data: missing, error } = await supabase.rpc("get_simple_i18n_missing", {
          p_kind: kind,
          p_filter: "en_missing",
        });
        if (error) continue;
        const ids = ((missing ?? []) as Array<{ item_id: string }>).map((r) => r.item_id);
        if (ids.length === 0) continue;
        for (let i = 0; i < ids.length; i += 20) {
          const slice = ids.slice(i, i + 20);
          const { data, error: invErr } = await supabase.functions.invoke("translate-batch", {
            body: { content_type: kind, item_ids: slice },
          });
          if (invErr) { totalFailed += slice.length; continue; }
          totalTranslated += (data?.translated ?? 0);
          totalFailed += (data?.failed ?? 0);
        }
      }

      return { translated: totalTranslated, failed: totalFailed };
    },
    onSuccess: (r) => {
      toast({ title: "전체 자동 번역 완료", description: `${r.translated}건 번역 / ${r.failed}건 실패` });
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
    },
    onError: (e: Error) => toast({ title: "백필 실패", description: e.message, variant: "destructive" }),
  });

  // ── Bulk status change (review / publish) ─────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ ids, to }: { ids: string[]; to: string }) => {
      const { data, error } = await supabase.rpc("set_i18n_status", {
        p_content_type: activeType,
        p_item_ids: ids,
        p_to_status: to,
        p_note: "bulk update from dashboard",
      });
      if (error) throw error;
      return data as { updated: number };
    },
    onSuccess: (d, vars) => {
      const label = vars.to === "reviewed" ? "검수 완료" : vars.to === "published" ? "게시" : vars.to;
      toast({ title: `${label} 처리 완료`, description: `${d?.updated ?? 0}건 업데이트` });
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
    },
    onError: (e: Error) => toast({ title: "상태 변경 실패", description: e.message, variant: "destructive" }),
  });

  // ── CSV Export ────────────────────────────────────────────────
  const csvEscape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const exportCsv = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_i18n_rows", { p_content_type: activeType });
      if (error) throw error;
      return (data ?? []) as Array<{
        item_id: string; ko_title: string | null; ko_body: string | null;
        en_title: string | null; en_body: string | null; status: string; updated_at: string | null;
      }>;
    },
    onSuccess: (rows) => {
      const header = ["item_id", "ko_title", "ko_body", "en_title", "en_body", "status"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push([r.item_id, r.ko_title ?? "", r.ko_body ?? "", r.en_title ?? "", r.en_body ?? "", r.status].map(csvEscape).join(","));
      }
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `i18n_${activeType}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV 내보내기 완료", description: `${rows.length}건` });
    },
    onError: () => toast({ title: "내보내기 실패", variant: "destructive" }),
  });

  // ── CSV Import ────────────────────────────────────────────────
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQuotes = false;
    const t = text.replace(/^\uFEFF/, "");
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (inQuotes) {
        if (c === '"' && t[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") { cur.push(field); field = ""; }
        else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
        else if (c === "\r") { /* ignore */ }
        else field += c;
      }
    }
    if (field.length || cur.length) { cur.push(field); rows.push(cur); }
    return rows.filter((r) => r.some((v) => v.trim() !== ""));
  };

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) throw new Error("CSV에 데이터가 없습니다.");
      const header = grid[0].map((h) => h.trim());
      const idIdx = header.indexOf("item_id");
      const titleIdx = header.indexOf("en_title");
      const bodyIdx = header.indexOf("en_body");
      if (idIdx < 0 || (titleIdx < 0 && bodyIdx < 0)) throw new Error("item_id 및 en_title/en_body 열이 필요합니다.");
      const payload = grid.slice(1).map((r) => ({
        item_id: r[idIdx],
        en_title: titleIdx >= 0 ? r[titleIdx] ?? "" : "",
        en_body: bodyIdx >= 0 ? r[bodyIdx] ?? "" : "",
      })).filter((r) => r.item_id);
      const { data, error } = await supabase.rpc("import_i18n_rows", {
        p_content_type: activeType,
        p_rows: payload as unknown as never,
      });
      if (error) throw error;
      return data as { updated: number; skipped: number };
    },
    onSuccess: (d) => {
      toast({ title: "CSV 가져오기 완료", description: `${d?.updated ?? 0}건 반영 / ${d?.skipped ?? 0}건 건너뜀` });
      qc.invalidateQueries({ queryKey: ["i18n-dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["i18n-missing"] });
    },
    onError: (e: Error) => toast({ title: "가져오기 실패", description: e.message, variant: "destructive" }),
  });

  const allChecked = items.length > 0 && items.every((it) => selectedIds.has(it.item_id));
  const toggleAll = () => {
    if (allChecked) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((it) => it.item_id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const totalSync = stats.reduce((s, x) => s + Number(x.sync_required || 0), 0);
  const totalMissing = stats.reduce((s, x) => s + Number(x.en_missing || 0), 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex items-start gap-3">
            <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background shrink-0">
              <Languages className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                다국어 관리
              </h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                한국어/영어 콘텐츠 번역 상태를 한눈에 확인하고 일괄 번역 및 동기화를 관리합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv.mutate(f);
                e.currentTarget.value = "";
              }}
            />
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <Link to="/admin/translation-glossary">
                <BookText className="h-4 w-4" />
                표기 가이드
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv.mutate()}
              disabled={exportCsv.isPending}
              className="gap-1.5 rounded-full"
            >
              {exportCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CSV 내보내기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importCsv.isPending}
              className="gap-1.5 rounded-full"
            >
              {importCsv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              CSV 가져오기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => driftMutation.mutate()}
              disabled={driftMutation.isPending}
              className="gap-1.5 rounded-full"
            >
              {driftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              변경 감지 실행
            </Button>
            <Button
              size="sm"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
              className="gap-1.5 rounded-full shadow-sm"
              title="EN이 비어있는 모든 콘텐츠를 한 번에 자동 번역합니다."
            >
              {backfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              전체 자동 번역
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetchStats()} className="gap-1.5 rounded-full" aria-label="새로고침">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Summary banner */}
        {(totalSync > 0 || totalMissing > 0) && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-foreground" />
            <div className="flex items-center gap-4 pl-6 pr-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.06] shrink-0">
                <AlertTriangle className="h-5 w-5 text-foreground" aria-hidden="true" />
              </div>
              <div className="text-sm flex-1 min-w-0">
                <p className="font-semibold text-foreground">관리자 액션이 필요합니다</p>
                <p className="text-muted-foreground mt-0.5">
                  영문 누락 <span className="font-semibold text-foreground tabular-nums">{totalMissing}</span>건,
                  {" "}동기화 필요 <span className="font-semibold text-foreground tabular-nums">{totalSync}</span>건
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(["course", "content", "assessment", "announcement", "board"] as ContentType[]).map((type) => {
            const s = stats.find((x) => x.content_type === type);
            const isActive = activeType === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setActiveType(type);
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "group text-left rounded-2xl border p-5 transition-all duration-200",
                  "hover:border-foreground/30 hover:shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.08)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-foreground bg-card shadow-[0_4px_20px_-8px_hsl(var(--foreground)/0.18)]"
                    : "border-border bg-card",
                )}
                aria-pressed={isActive}
              >
                {/* Type label + total */}
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-[13px] font-semibold tracking-tight text-foreground">
                    {TYPE_LABEL[type]}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    전체 {s?.total ?? 0}
                  </span>
                </div>
                {/* Hero metric: EN missing */}
                <div className="mb-4">
                  <div className={cn(
                    "text-3xl font-semibold tabular-nums tracking-tight leading-none",
                    (s?.en_missing ?? 0) > 0 ? "text-destructive" : "text-foreground/30",
                  )}>
                    {s?.en_missing ?? 0}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                    <FileWarning className="h-3 w-3" aria-hidden="true" />
                    EN 누락
                  </div>
                </div>
                {/* Sub metrics */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60">
                  <div className="space-y-0.5">
                    <div className={cn(
                      "text-sm font-semibold tabular-nums",
                      (s?.sync_required ?? 0) > 0 ? "text-foreground" : "text-muted-foreground/60",
                    )}>
                      {s?.sync_required ?? 0}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
                      동기화
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {s?.reviewed ?? 0}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                      검수
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* List */}
        <Card className="rounded-2xl border-border shadow-[0_2px_20px_-12px_hsl(var(--foreground)/0.1)] overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-3 flex-wrap border-b border-border/60 bg-muted/20 py-4">
            <div className="min-w-0">
              <CardTitle className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
                {TYPE_LABEL[activeType]} 상세 목록
                {items.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {items.length}건
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                필요한 항목을 선택하여 한 번에 자동 번역하세요.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList className="h-9 bg-background border border-border">
                  <TabsTrigger value="en_missing" className="text-xs px-3">EN 누락</TabsTrigger>
                  <TabsTrigger value="sync_required" className="text-xs px-3">동기화 필요</TabsTrigger>
                  <TabsTrigger value="all" className="text-xs px-3">전체</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="h-6 w-px bg-border mx-1 hidden sm:block" aria-hidden="true" />
              <Button
                size="sm"
                disabled={selectedIds.size === 0 || translateMutation.isPending}
                onClick={() => translateMutation.mutate(Array.from(selectedIds))}
                className="gap-1.5 rounded-full"
              >
                {translateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                선택 항목 일괄 번역 ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={selectedIds.size === 0 || statusMutation.isPending}
                onClick={() => statusMutation.mutate({ ids: Array.from(selectedIds), to: "reviewed" })}
                className="gap-1.5 rounded-full"
              >
                {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                일괄 검수 완료
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0 || statusMutation.isPending}
                onClick={() => statusMutation.mutate({ ids: Array.from(selectedIds), to: "published" })}
                className="gap-1.5 rounded-full"
              >
                <Send className="h-4 w-4" />
                일괄 게시
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {itemsLoading ? (
              <div className="py-20 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                불러오는 중...
              </div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground">해당 조건의 항목이 없습니다.</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10 border-b border-border/60">
                    <TableHead className="w-12 pl-6">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="전체 선택" />
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">한국어 제목</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">영어 제목</TableHead>
                    <TableHead className="w-32 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">상태</TableHead>
                    <TableHead className="w-32 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">최근 수정</TableHead>
                    <TableHead className="w-24 pr-6 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const meta = STATUS_LABEL[it.status] ?? STATUS_LABEL.draft;
                    return (
                      <TableRow key={it.item_id} className="group transition-colors hover:bg-muted/20 border-b border-border/40 last:border-b-0">
                        <TableCell className="pl-6">
                          <Checkbox
                            checked={selectedIds.has(it.item_id)}
                            onCheckedChange={() => toggleOne(it.item_id)}
                            aria-label={`${it.ko_title ?? ""} 선택`}
                          />
                        </TableCell>
                        <TableCell className="font-medium max-w-md truncate text-[13px] text-foreground py-3.5">
                          {it.ko_title || <span className="text-muted-foreground italic">(제목 없음)</span>}
                        </TableCell>
                        <TableCell className="max-w-md truncate text-[13px] py-3.5">
                          {it.en_title ? (
                            <span className="text-muted-foreground">{it.en_title}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-destructive/80 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-destructive/70" />
                              누락
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={meta.variant} className="text-[10px] font-medium px-2 py-0.5 rounded-md">
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums py-3.5">
                          {it.updated_at ? new Date(it.updated_at).toLocaleDateString("ko-KR") : "-"}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-3.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8 rounded-full opacity-70 group-hover:opacity-100 transition-opacity"
                            onClick={() => { setPreviewId(it.item_id); setPreviewOpen(true); }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            검수
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <I18nPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        contentType={activeType}
        itemId={previewId}
      />
    </DashboardLayout>
  );
};

export default AdminI18nDashboard;