import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Film, Layers, PlayCircle, Plus, Pencil, Trash2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const PROVIDERS = [
  { value: "bunny", label: "Bunny Stream" },
  { value: "kollus", label: "콜러스 (DRM)" },
  { value: "youtube", label: "YouTube" },
  { value: "vimeo", label: "Vimeo" },
  { value: "cdn", label: "CDN / 외부링크" },
];

const CONTENT_TYPES = [
  { value: "video", label: "동영상" },
  { value: "kollus", label: "콜러스" },
  { value: "external", label: "외부링크" },
  { value: "youtube", label: "유튜브" },
  { value: "zoom", label: "줌(실시간)" },
  { value: "document", label: "문서/교안" },
];

const emptyVideo = {
  id: "",
  title: "",
  category: "",
  provider: "bunny",
  video_key: "",
  video_url: "",
  duration_seconds: 0,
  resolution: "",
  drm_enabled: false,
  encoding_status: "ready",
  is_active: true,
  memo: "",
};

const emptyGroup = { id: "", name: "", description: "", order_index: 0, is_active: true };

const emptyLecture = {
  id: "",
  title: "",
  description: "",
  group_id: "" as string,
  video_id: "" as string,
  content_type: "video",
  content_url: "",
  play_time_seconds: 0,
  credit_time_seconds: 0,
  handout_url: "",
  handout_name: "",
  ai_chat_enabled: false,
  admin_memo: "",
  is_active: true,
  status: "draft",
};

const secToMin = (s: number) => Math.round((s || 0) / 60);

const AdminContentLibrary = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [videoDialog, setVideoDialog] = useState(false);
  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupForm, setGroupForm] = useState(emptyGroup);
  const [lectureDialog, setLectureDialog] = useState(false);
  const [lectureForm, setLectureForm] = useState(emptyLecture);
  const [refDialog, setRefDialog] = useState<{ open: boolean; type: "lecture" | "video"; id: string; title: string }>({
    open: false, type: "lecture", id: "", title: "",
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["content-videos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_videos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["lecture-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lecture_groups").select("*").order("order_index").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("*, lecture_groups(name), content_videos(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ["course-lectures-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_lectures")
        .select("id, course_id, lecture_id, order_index, courses(title)");
      if (error) throw error;
      return data as any[];
    },
  });

  const lectureUsage = useMemo(() => {
    const map: Record<string, string[]> = {};
    mappings.forEach((m) => {
      const t = m.courses?.title ?? "(삭제된 강의)";
      map[m.lecture_id] = [...(map[m.lecture_id] || []), t];
    });
    return map;
  }, [mappings]);

  const videoUsage = useMemo(() => {
    const map: Record<string, string[]> = {};
    lectures.forEach((l) => {
      if (l.video_id) map[l.video_id] = [...(map[l.video_id] || []), l.title];
    });
    return map;
  }, [lectures]);

  const saveVideo = useMutation({
    mutationFn: async (form: typeof emptyVideo) => {
      const payload = {
        title: form.title,
        category: form.category || null,
        provider: form.provider,
        video_key: form.video_key || null,
        video_url: form.video_url || null,
        duration_seconds: Number(form.duration_seconds) || 0,
        resolution: form.resolution || null,
        drm_enabled: form.drm_enabled,
        encoding_status: form.encoding_status,
        is_active: form.is_active,
        memo: form.memo || null,
      };
      if (form.id) {
        const { error } = await supabase.from("content_videos").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_videos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("영상이 저장되었습니다");
      setVideoDialog(false);
      qc.invalidateQueries({ queryKey: ["content-videos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveGroup = useMutation({
    mutationFn: async (form: typeof emptyGroup) => {
      const payload = {
        name: form.name,
        description: form.description || null,
        order_index: Number(form.order_index) || 0,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("lecture_groups").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lecture_groups").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("강의그룹이 저장되었습니다");
      setGroupDialog(false);
      qc.invalidateQueries({ queryKey: ["lecture-groups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveLecture = useMutation({
    mutationFn: async (form: typeof emptyLecture) => {
      const payload = {
        title: form.title,
        description: form.description || null,
        group_id: form.group_id || null,
        video_id: form.video_id || null,
        content_type: form.content_type,
        content_url: form.content_url || null,
        play_time_seconds: Number(form.play_time_seconds) || 0,
        credit_time_seconds: Number(form.credit_time_seconds) || 0,
        handout_url: form.handout_url || null,
        handout_name: form.handout_name || null,
        ai_chat_enabled: form.ai_chat_enabled,
        admin_memo: form.admin_memo || null,
        is_active: form.is_active,
        status: form.status,
      };
      if (form.id) {
        const { error } = await supabase.from("lectures").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lectures").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("강의가 저장되었습니다");
      setLectureDialog(false);
      qc.invalidateQueries({ queryKey: ["lectures"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ table, id }: { table: "content_videos" | "lecture_groups" | "lectures"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      return table;
    },
    onSuccess: (table) => {
      toast.success("삭제되었습니다");
      qc.invalidateQueries({ queryKey: [table === "content_videos" ? "content-videos" : table === "lectures" ? "lectures" : "lecture-groups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const fVideos = videos.filter((v: any) => !q || v.title?.toLowerCase().includes(q));
  const fLectures = lectures.filter((l: any) => !q || l.title?.toLowerCase().includes(q));
  const fGroups = groups.filter((g: any) => !q || g.name?.toLowerCase().includes(q));

  const exportCsv = (rows: Record<string, any>[], name: string) => {
    if (!rows.length) return toast.error("내보낼 데이터가 없습니다");
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Film className="h-5 w-5" /> 콘텐츠 라이브러리
          </h1>
          <p className="text-muted-foreground mt-1">
            영상 → 강의(차시) → 강의(과정)로 이어지는 3계층 재사용 구조를 관리합니다. 어디에 쓰이는지 역참조로 확인할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="제목 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <Tabs defaultValue="lectures">
          <TabsList>
            <TabsTrigger value="lectures">강의(차시)</TabsTrigger>
            <TabsTrigger value="groups">강의그룹</TabsTrigger>
            <TabsTrigger value="videos">영상</TabsTrigger>
          </TabsList>

          {/* 강의 */}
          <TabsContent value="lectures" className="space-y-4 pt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => exportCsv(fLectures.map((l: any) => ({
                제목: l.title, 그룹: l.lecture_groups?.name ?? "", 타입: l.content_type,
                학습시간분: secToMin(l.play_time_seconds), 인정시간분: secToMin(l.credit_time_seconds),
                사용과정수: (lectureUsage[l.id] || []).length, 상태: l.is_active ? "사용" : "미사용",
              })), "강의목록")}>엑셀 다운로드</Button>
              <Button onClick={() => { setLectureForm(emptyLecture); setLectureDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> 강의 등록
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {fLectures.length === 0 && <p className="p-6 text-sm text-muted-foreground">등록된 강의가 없습니다.</p>}
              {fLectures.map((l: any) => (
                <div key={l.id} className="p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{l.title}</span>
                      <Badge variant="outline" className="whitespace-nowrap">{CONTENT_TYPES.find((c) => c.value === l.content_type)?.label ?? l.content_type}</Badge>
                      {l.lecture_groups?.name && <Badge variant="secondary" className="whitespace-nowrap">{l.lecture_groups.name}</Badge>}
                      {!l.is_active && <Badge variant="destructive" className="whitespace-nowrap">미사용</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      학습 {secToMin(l.play_time_seconds)}분 · 인정 {secToMin(l.credit_time_seconds)}분
                      {l.content_videos?.title ? ` · 영상: ${l.content_videos.title}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="whitespace-nowrap"
                    onClick={() => setRefDialog({ open: true, type: "lecture", id: l.id, title: l.title })}>
                    <Link2 className="h-4 w-4 mr-1" /> 사용과정 {(lectureUsage[l.id] || []).length}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setLectureForm({ ...emptyLecture, ...l, group_id: l.group_id ?? "", video_id: l.video_id ?? "" }); setLectureDialog(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("삭제하시겠습니까?")) remove.mutate({ table: "lectures", id: l.id }); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 강의그룹 */}
          <TabsContent value="groups" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button onClick={() => { setGroupForm(emptyGroup); setGroupDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> 그룹 등록
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {fGroups.length === 0 && <p className="p-6 text-sm text-muted-foreground">등록된 그룹이 없습니다.</p>}
              {fGroups.map((g: any) => (
                <div key={g.id} className="p-4 flex items-center gap-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
                  <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{g.name}</span>
                    <p className="text-sm text-muted-foreground">{g.description || "-"} · 강의 {lectures.filter((l: any) => l.group_id === g.id).length}개</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setGroupForm({ ...emptyGroup, ...g }); setGroupDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("삭제하시겠습니까?")) remove.mutate({ table: "lecture_groups", id: g.id }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 영상 */}
          <TabsContent value="videos" className="space-y-4 pt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => exportCsv(fVideos.map((v: any) => ({
                제목: v.title, 플랫폼: v.provider, 재생시간분: secToMin(v.duration_seconds),
                해상도: v.resolution ?? "", DRM: v.drm_enabled ? "적용" : "미적용",
                사용강의수: (videoUsage[v.id] || []).length,
              })), "영상목록")}>엑셀 다운로드</Button>
              <Button onClick={() => { setVideoForm(emptyVideo); setVideoDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> 영상 등록
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {fVideos.length === 0 && <p className="p-6 text-sm text-muted-foreground">등록된 영상이 없습니다.</p>}
              {fVideos.map((v: any) => (
                <div key={v.id} className="p-4 flex flex-wrap items-center gap-3 border-b-2 border-border/80 last:border-b-0 min-w-0">
                  <PlayCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{v.title}</span>
                      <Badge variant="outline" className="whitespace-nowrap">{PROVIDERS.find((p) => p.value === v.provider)?.label ?? v.provider}</Badge>
                      {v.drm_enabled && <Badge className="whitespace-nowrap">DRM</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {secToMin(v.duration_seconds)}분 · {v.resolution || "해상도 미지정"} · 인코딩 {v.encoding_status}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="whitespace-nowrap"
                    onClick={() => setRefDialog({ open: true, type: "video", id: v.id, title: v.title })}>
                    <Link2 className="h-4 w-4 mr-1" /> 사용강의 {(videoUsage[v.id] || []).length}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setVideoForm({ ...emptyVideo, ...v }); setVideoDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("삭제하시겠습니까?")) remove.mutate({ table: "content_videos", id: v.id }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 영상 다이얼로그 */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{videoForm.id ? "영상 수정" : "영상 등록"}</DialogTitle>
            <DialogDescription>영상 원본을 등록하면 여러 강의에서 재사용할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>제목</Label><Input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} /></div>
            <div><Label>카테고리</Label><Input value={videoForm.category} onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })} /></div>
            <div>
              <Label>플랫폼</Label>
              <Select value={videoForm.provider} onValueChange={(v) => setVideoForm({ ...videoForm, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>영상 키</Label><Input value={videoForm.video_key} onChange={(e) => setVideoForm({ ...videoForm, video_key: e.target.value })} /></div>
            <div><Label>영상 URL</Label><Input value={videoForm.video_url} onChange={(e) => setVideoForm({ ...videoForm, video_url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>재생시간(초)</Label><Input type="number" value={videoForm.duration_seconds} onChange={(e) => setVideoForm({ ...videoForm, duration_seconds: Number(e.target.value) })} /></div>
              <div><Label>해상도</Label><Input placeholder="1920x1080" value={videoForm.resolution} onChange={(e) => setVideoForm({ ...videoForm, resolution: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>DRM 암호화</Label>
              <Switch checked={videoForm.drm_enabled} onCheckedChange={(v) => setVideoForm({ ...videoForm, drm_enabled: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>사용 여부</Label>
              <Switch checked={videoForm.is_active} onCheckedChange={(v) => setVideoForm({ ...videoForm, is_active: v })} />
            </div>
            <div><Label>메모</Label><Textarea value={videoForm.memo} onChange={(e) => setVideoForm({ ...videoForm, memo: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialog(false)}>취소</Button>
            <Button onClick={() => saveVideo.mutate(videoForm)} disabled={!videoForm.title}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 그룹 다이얼로그 */}
      <Dialog open={groupDialog} onOpenChange={setGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{groupForm.id ? "그룹 수정" : "그룹 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>그룹명</Label><Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
            <div><Label>설명</Label><Textarea value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} /></div>
            <div><Label>정렬 순서</Label><Input type="number" value={groupForm.order_index} onChange={(e) => setGroupForm({ ...groupForm, order_index: Number(e.target.value) })} /></div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>사용 여부</Label>
              <Switch checked={groupForm.is_active} onCheckedChange={(v) => setGroupForm({ ...groupForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialog(false)}>취소</Button>
            <Button onClick={() => saveGroup.mutate(groupForm)} disabled={!groupForm.name}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 강의 다이얼로그 */}
      <Dialog open={lectureDialog} onOpenChange={setLectureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{lectureForm.id ? "강의 수정" : "강의 등록"}</DialogTitle>
            <DialogDescription>인정시간은 진도 100% 기준 시간이며, 학습시간보다 1~2분 짧게 설정하는 것을 권장합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>강의명</Label><Input value={lectureForm.title} onChange={(e) => setLectureForm({ ...lectureForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>강의그룹</Label>
                <Select value={lectureForm.group_id || "none"} onValueChange={(v) => setLectureForm({ ...lectureForm, group_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>콘텐츠 타입</Label>
                <Select value={lectureForm.content_type} onValueChange={(v) => setLectureForm({ ...lectureForm, content_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>연결 영상</Label>
              <Select value={lectureForm.video_id || "none"} onValueChange={(v) => setLectureForm({ ...lectureForm, video_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미연결 (URL 직접입력)</SelectItem>
                  {videos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>콘텐츠 주소</Label><Input value={lectureForm.content_url} onChange={(e) => setLectureForm({ ...lectureForm, content_url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>학습시간(초)</Label><Input type="number" value={lectureForm.play_time_seconds} onChange={(e) => setLectureForm({ ...lectureForm, play_time_seconds: Number(e.target.value) })} /></div>
              <div><Label>인정시간(초)</Label><Input type="number" value={lectureForm.credit_time_seconds} onChange={(e) => setLectureForm({ ...lectureForm, credit_time_seconds: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>교안 파일명</Label><Input value={lectureForm.handout_name} onChange={(e) => setLectureForm({ ...lectureForm, handout_name: e.target.value })} /></div>
              <div><Label>교안 URL</Label><Input value={lectureForm.handout_url} onChange={(e) => setLectureForm({ ...lectureForm, handout_url: e.target.value })} /></div>
            </div>
            <div><Label>강의 설명</Label><Textarea value={lectureForm.description} onChange={(e) => setLectureForm({ ...lectureForm, description: e.target.value })} /></div>
            <div><Label>관리자 메모</Label><Textarea value={lectureForm.admin_memo} onChange={(e) => setLectureForm({ ...lectureForm, admin_memo: e.target.value })} /></div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>AI 채팅 사용</Label>
              <Switch checked={lectureForm.ai_chat_enabled} onCheckedChange={(v) => setLectureForm({ ...lectureForm, ai_chat_enabled: v })} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>사용 여부</Label>
              <Switch checked={lectureForm.is_active} onCheckedChange={(v) => setLectureForm({ ...lectureForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLectureDialog(false)}>취소</Button>
            <Button onClick={() => saveLecture.mutate(lectureForm)} disabled={!lectureForm.title}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 역참조 */}
      <Dialog open={refDialog.open} onOpenChange={(o) => setRefDialog({ ...refDialog, open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{refDialog.type === "lecture" ? "사용 과정" : "사용 강의"}</DialogTitle>
            <DialogDescription>{refDialog.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {((refDialog.type === "lecture" ? lectureUsage[refDialog.id] : videoUsage[refDialog.id]) || []).map((name, i) => (
              <div key={i} className="border-b-2 border-border/80 py-2 text-sm">{name}</div>
            ))}
            {!((refDialog.type === "lecture" ? lectureUsage[refDialog.id] : videoUsage[refDialog.id]) || []).length && (
              <p className="text-sm text-muted-foreground">아직 사용되지 않았습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminContentLibrary;
