import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, PlayCircle, CheckCircle2, Clock, Heart, CalendarClock } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

type MicroContent = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  video_provider: string | null;
  duration_seconds: number | null;
  category: string | null;
  tags: string[] | null;
  view_count: number | null;
};

type ViewRow = {
  content_id: string;
  watched_seconds: number | null;
  is_completed: boolean | null;
  liked: boolean | null;
};

type AssignmentRow = { content_id: string; due_at: string | null };

function toEmbedUrl(url: string | null, provider: string | null): string | null {
  if (!url) return null;
  const p = (provider || "").toLowerCase();
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (p === "youtube" || yt) {
    const id = yt?.[1];
    return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : url;
  }
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (p === "vimeo" || vm) {
    const id = vm?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }
  return url;
}

function isDirectVideo(url: string | null) {
  return !!url && /\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url);
}

const fmt = (s: number | null | undefined) => {
  const t = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export default function StudentMicroLearning() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [active, setActive] = useState<MicroContent | null>(null);

  const { data: contents = [], isLoading } = useQuery({
    queryKey: ["micro_contents_published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("micro_contents")
        .select("id,title,description,thumbnail_url,video_url,video_provider,duration_seconds,category,tags,view_count")
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MicroContent[];
    },
  });

  const { data: views = [] } = useQuery({
    queryKey: ["micro_views", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("micro_content_views")
        .select("content_id,watched_seconds,is_completed,liked")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as ViewRow[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["micro_assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("micro_content_assignments")
        .select("content_id,due_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as AssignmentRow[];
    },
  });

  const viewMap = useMemo(() => new Map(views.map((v) => [v.content_id, v])), [views]);
  const assignMap = useMemo(() => new Map(assignments.map((a) => [a.content_id, a])), [assignments]);

  const assigned = contents.filter((c) => assignMap.has(c.id));
  const completedCount = contents.filter((c) => viewMap.get(c.id)?.is_completed).length;
  const assignedDone = assigned.filter((c) => viewMap.get(c.id)?.is_completed).length;

  const categories = useMemo(
    () => Array.from(new Set(contents.map((c) => c.category).filter(Boolean) as string[])),
    [contents]
  );
  const [cat, setCat] = useState<string>("all");
  const filtered = cat === "all" ? contents : contents.filter((c) => c.category === cat);

  const saveProgress = async (content: MicroContent, watched: number, completed: boolean) => {
    if (!user?.id) return;
    const { error } = await supabase.from("micro_content_views").upsert(
      {
        content_id: content.id,
        user_id: user.id,
        watched_seconds: Math.floor(watched),
        is_completed: completed || viewMap.get(content.id)?.is_completed || false,
        liked: viewMap.get(content.id)?.liked ?? false,
      },
      { onConflict: "content_id,user_id" }
    );
    if (error) return;
    qc.invalidateQueries({ queryKey: ["micro_views", user.id] });
  };

  const toggleLike = async (content: MicroContent) => {
    if (!user?.id) return;
    const cur = viewMap.get(content.id);
    const { error } = await supabase.from("micro_content_views").upsert(
      {
        content_id: content.id,
        user_id: user.id,
        watched_seconds: cur?.watched_seconds ?? 0,
        is_completed: cur?.is_completed ?? false,
        liked: !(cur?.liked ?? false),
      },
      { onConflict: "content_id,user_id" }
    );
    if (error) {
      toast({ title: "저장 실패", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["micro_views", user.id] });
  };

  const CardItem = ({ c }: { c: MicroContent }) => {
    const v = viewMap.get(c.id);
    const a = assignMap.get(c.id);
    const pct = c.duration_seconds
      ? Math.min(100, Math.round(((v?.watched_seconds || 0) / c.duration_seconds) * 100))
      : v?.is_completed
      ? 100
      : 0;
    return (
      <Card className="overflow-hidden">
        <button type="button" onClick={() => setActive(c)} className="block w-full text-left">
          <div className="aspect-[16/10] bg-muted flex items-center justify-center overflow-hidden">
            {c.thumbnail_url ? (
              <img src={c.thumbnail_url} alt={`${c.title} 썸네일`} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <PlayCircle className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
        </button>
        <CardContent className="space-y-4 pt-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {c.category && <Badge variant="secondary" className="whitespace-nowrap">{c.category}</Badge>}
            {a && <Badge className="whitespace-nowrap">배정</Badge>}
            {v?.is_completed && (
              <Badge variant="outline" className="whitespace-nowrap gap-1">
                <CheckCircle2 className="w-3 h-3" /> 완료
              </Badge>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium truncate">{c.title}</h3>
            {c.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</p>}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(c.duration_seconds)}</span>
            {a?.due_at && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {new Date(a.due_at).toLocaleDateString("ko-KR")}까지
              </span>
            )}
          </div>
          <div className="space-y-1">
            <Progress value={pct} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{pct}% 시청</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => setActive(c)}>
              {v?.is_completed ? "다시 보기" : pct > 0 ? "이어 보기" : "학습 시작"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleLike(c)} aria-label="좋아요">
              <Heart className={`w-4 h-4 ${v?.liked ? "fill-current" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">마이크로러닝</h1>
          </div>
          <p className="text-muted-foreground mt-1">짧은 영상으로 빠르게 학습하세요. 시청 진도는 자동 저장됩니다.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">전체 콘텐츠</p><p className="text-2xl font-semibold">{contents.length}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">완료</p><p className="text-2xl font-semibold">{completedCount}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">배정 학습</p><p className="text-2xl font-semibold">{assignedDone}/{assigned.length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue={assigned.length ? "assigned" : "all"}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="assigned">배정된 학습 ({assigned.length})</TabsTrigger>
            <TabsTrigger value="all">전체 ({contents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="mt-4">
            {assigned.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">배정된 마이크로러닝이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assigned.map((c) => <CardItem key={c.id} c={c} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-4 space-y-4">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={cat === "all" ? "default" : "outline"} onClick={() => setCat("all")}>전체</Button>
                {categories.map((k) => (
                  <Button key={k} size="sm" variant={cat === k ? "default" : "outline"} onClick={() => setCat(k)}>{k}</Button>
                ))}
              </div>
            )}
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-10 text-center">불러오는 중...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">콘텐츠가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((c) => <CardItem key={c.id} c={c} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <MicroPlayerDialog
        content={active}
        initialSeconds={active ? viewMap.get(active.id)?.watched_seconds ?? 0 : 0}
        completed={active ? !!viewMap.get(active.id)?.is_completed : false}
        onClose={() => setActive(null)}
        onProgress={saveProgress}
      />
    </DashboardLayout>
  );
}

function MicroPlayerDialog({
  content,
  initialSeconds,
  completed,
  onClose,
  onProgress,
}: {
  content: MicroContent | null;
  initialSeconds: number;
  completed: boolean;
  onClose: () => void;
  onProgress: (c: MicroContent, watched: number, completed: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [seconds, setSeconds] = useState(initialSeconds);
  const secondsRef = useRef(initialSeconds);
  const doneRef = useRef(completed);

  useEffect(() => {
    setSeconds(initialSeconds);
    secondsRef.current = initialSeconds;
    doneRef.current = completed;
  }, [content?.id, initialSeconds, completed]);

  // Tick-based tracking for embeds (iframe cannot report time)
  useEffect(() => {
    if (!content) return;
    const direct = isDirectVideo(content.video_url);
    const total = content.duration_seconds || 0;
    const timer = window.setInterval(() => {
      if (!direct) {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
      }
      const s = secondsRef.current;
      const reached = total > 0 ? s >= total * 0.8 : s >= 60;
      if (reached && !doneRef.current) {
        doneRef.current = true;
        onProgress(content, s, true);
      } else if (s % 10 === 0) {
        onProgress(content, s, doneRef.current);
      }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      onProgress(content, secondsRef.current, doneRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content?.id]);

  if (!content) return null;
  const direct = isDirectVideo(content.video_url);
  const embed = toEmbedUrl(content.video_url, content.video_provider);
  const total = content.duration_seconds || 0;
  const pct = total ? Math.min(100, Math.round((seconds / total) * 100)) : doneRef.current ? 100 : 0;

  return (
    <Dialog open={!!content} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{content.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 min-w-0">
          <div className="aspect-video bg-black rounded-md overflow-hidden">
            {direct ? (
              <video
                ref={videoRef}
                src={content.video_url!}
                controls
                autoPlay
                className="w-full h-full"
                onLoadedMetadata={() => {
                  if (videoRef.current && initialSeconds > 0) videoRef.current.currentTime = initialSeconds;
                }}
                onTimeUpdate={() => {
                  const t = Math.floor(videoRef.current?.currentTime || 0);
                  secondsRef.current = t;
                  setSeconds(t);
                }}
                onEnded={() => onProgress(content, secondsRef.current, true)}
              />
            ) : embed ? (
              <iframe
                src={embed}
                title={content.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                재생할 영상이 없습니다.
              </div>
            )}
          </div>
          {content.description && <p className="text-sm text-muted-foreground">{content.description}</p>}
          <div className="space-y-1">
            <Progress value={pct} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmt(seconds)} {total ? `/ ${fmt(total)}` : ""}</span>
              <span>{doneRef.current ? "학습 완료" : `${pct}% 시청 (80% 이상 시 완료)`}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
