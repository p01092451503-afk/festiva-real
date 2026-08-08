import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, Plus, Pencil, Trash2, Eye, UserPlus, Download, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PROVIDERS: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", custom: "직접 URL" };


const emptyForm = {
  id: "",
  title: "",
  description: "",
  thumbnail_url: "",
  video_url: "",
  video_provider: "youtube",
  duration_seconds: 60,
  category: "",
  tags: "",
  is_published: false,
  display_order: 0,
};

/** 마이크로러닝(숏폼) 콘텐츠 관리 */
const AdminMicroLearning = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContentId, setAssignContentId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [progressContentId, setProgressContentId] = useState("all");

  const { data: contents = [] } = useQuery({
    queryKey: ["micro-contents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("micro_contents").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: views = [] } = useQuery({
    queryKey: ["micro-views"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("micro_content_views")
        .select("content_id, user_id, is_completed, liked, watched_seconds, updated_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["micro-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("micro_content_assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["micro-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });


  const statMap = useMemo(() => {
    const m = new Map<string, { views: number; completed: number; likes: number }>();
    views.forEach((v: any) => {
      const cur = m.get(v.content_id) || { views: 0, completed: 0, likes: 0 };
      cur.views += 1;
      if (v.is_completed) cur.completed += 1;
      if (v.liked) cur.likes += 1;
      m.set(v.content_id, cur);
    });
    return m;
  }, [views]);

  const filtered = useMemo(
    () =>
      contents.filter((c: any) =>
        keyword ? `${c.title} ${c.category || ""}`.toLowerCase().includes(keyword.toLowerCase()) : true,
      ),
    [contents, keyword],
  );

  const save = async () => {
    if (!form.title.trim()) return toast.error("제목을 입력하세요");
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      thumbnail_url: form.thumbnail_url || null,
      video_url: form.video_url || null,
      video_provider: form.video_provider,
      duration_seconds: Number(form.duration_seconds) || 0,
      category: form.category || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      is_published: form.is_published,
      display_order: Number(form.display_order) || 0,
    };
    const { error } = form.id
      ? await supabase.from("micro_contents").update(payload).eq("id", form.id)
      : await supabase.from("micro_contents").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setOpen(false);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["micro-contents"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("micro_contents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    qc.invalidateQueries({ queryKey: ["micro-contents"] });
  };

  const togglePublish = async (c: any) => {
    const { error } = await supabase.from("micro_contents").update({ is_published: !c.is_published }).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["micro-contents"] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" /> 마이크로러닝
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            1~3분 숏폼 학습 콘텐츠를 등록하고 시청 현황을 확인합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <Input
            placeholder="제목·카테고리 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" className="gap-1.5" onClick={() => { setForm(emptyForm); setOpen(true); }}>
            <Plus className="h-4 w-4" /> 숏폼 등록
          </Button>
        </div>

        <div className="rounded-xl border divide-y">
          {filtered.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">등록된 숏폼 콘텐츠가 없습니다.</p>
          )}
          {filtered.map((c: any) => {
            const st = statMap.get(c.id) || { views: 0, completed: 0, likes: 0 };
            return (
              <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.title}</span>
                    <Badge variant={c.is_published ? "default" : "secondary"} className="whitespace-nowrap">
                      {c.is_published ? "공개" : "비공개"}
                    </Badge>
                    {c.category && <Badge variant="outline" className="whitespace-nowrap">{c.category}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round((c.duration_seconds || 0) / 60)}분 · {PROVIDERS[c.video_provider] || c.video_provider}
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {st.views}
                    </span>
                    {" · 완주 "}
                    {st.completed}
                    {" · 좋아요 "}
                    {st.likes}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={c.is_published} onCheckedChange={() => togglePublish(c)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setForm({
                        id: c.id,
                        title: c.title,
                        description: c.description || "",
                        thumbnail_url: c.thumbnail_url || "",
                        video_url: c.video_url || "",
                        video_provider: c.video_provider || "youtube",
                        duration_seconds: c.duration_seconds || 0,
                        category: c.category || "",
                        tags: (c.tags || []).join(", "),
                        is_published: c.is_published,
                        display_order: c.display_order,
                      });
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "숏폼 수정" : "숏폼 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>제목</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>설명</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>영상 제공처</Label>
                <Select value={form.video_provider} onValueChange={(v) => setForm({ ...form, video_provider: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDERS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>재생 시간(초)</Label>
                <Input type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>영상 주소</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} className="mt-1" placeholder="https://..." />
            </div>
            <div>
              <Label>썸네일 주소</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>카테고리</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>태그 (쉼표 구분)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>공개</Label>
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminMicroLearning;
