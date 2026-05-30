import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, Plus, Calendar, Users, Trash2, Play, AlertCircle, BookOpen, Search, IdCard } from "lucide-react";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useUserRole } from "@/hooks/useUserRole";
import { formatKoreaDateTime, formatKoreaTime, koreaDateTimeLocalToDbTimestamp, koreaDateTimeLocalToTime } from "@/lib/koreaDateTime";
import { toast } from "sonner";


type SessionType = "consultation" | "lecture" | "study";

interface SessionRow {
  id: string;
  title: string;
  description: string | null;
  session_type: SessionType;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  daily_room_url: string | null;
  recording_enabled: boolean;
  max_participants: number;
  host_user_id: string;
}

const TYPE_LABEL: Record<SessionType, string> = {
  consultation: "1:1 상담",
  lecture: "실시간 강의",
  study: "스터디룸",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예약됨",
  live: "진행 중",
  completed: "종료",
  cancelled: "취소",
};

const VideoSessionsManage = ({ role = "admin" }: { role?: "admin" | "teacher" }) => {
  const { profile } = useUser();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [participantQuery, setParticipantQuery] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<{ id: string; name: string; email: string }[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    session_type: "lecture" as SessionType,
    scheduled_start: "",
    scheduled_end: "",
    max_participants: 50,
    recording_enabled: false,
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["video-sessions-manage", profile?.user_id, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("video_sessions")
        .select("*")
        .order("scheduled_start", { ascending: false });
      if (!isAdmin && profile?.user_id) q = q.eq("host_user_id", profile.user_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    enabled: !!profile?.user_id,
  });

  const { data: searchUsers = [] } = useQuery({
    queryKey: ["video-participant-search", participantQuery],
    queryFn: async () => {
      if (!participantQuery || participantQuery.length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .or(`full_name.ilike.%${participantQuery}%,email.ilike.%${participantQuery}%`)
        .limit(10);
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm({
      title: "", description: "", session_type: "lecture",
      scheduled_start: "", scheduled_end: "",
      max_participants: 50, recording_enabled: false,
    });
    setSelectedParticipants([]);
    setParticipantQuery("");
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!form.title || !form.scheduled_start || !form.scheduled_end) {
      toast.error("제목과 시작/종료 시간을 입력해 주세요.");
      return;
    }
    if (koreaDateTimeLocalToTime(form.scheduled_end) <= koreaDateTimeLocalToTime(form.scheduled_start)) {
      toast.error("종료 시간이 시작 시간보다 이후여야 합니다.");
      return;
    }
    setSubmitting(true);
    try {
      const startTimestamp = koreaDateTimeLocalToDbTimestamp(form.scheduled_start);
      const endTimestamp = koreaDateTimeLocalToDbTimestamp(form.scheduled_end);
      const { data: created, error } = await supabase
        .from("video_sessions")
        .insert({
          title: form.title,
          description: form.description || null,
          session_type: form.session_type,
          host_user_id: profile!.user_id,
          scheduled_start: startTimestamp,
          scheduled_end: endTimestamp,
          max_participants: form.max_participants,
          recording_enabled: form.recording_enabled,
        })
        .select()
        .single();
      if (error || !created) {
        toast.error("생성 실패: " + (error?.message ?? "unknown"));
        return;
      }

      if (selectedParticipants.length) {
        try {
          await supabase.from("video_session_participants").insert(
            selectedParticipants.map((p) => ({
              session_id: created.id,
              user_id: p.id,
              role: "participant",
            })),
          );
        } catch (e) {
          console.error("participant insert failed", e);
        }
      }

      // Daily room creation is best-effort — don't block dialog close on it.
      toast.success("세션이 생성되었습니다.");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["video-sessions-manage"] });
      qc.invalidateQueries({ queryKey: ["my-video-sessions"] });

      try {
        const { error: roomErr } = await supabase.functions.invoke("daily-create-room", {
          body: { sessionId: created.id },
        });
        if (roomErr) {
          console.error("daily-create-room error", roomErr);
          toast.error("화상 룸은 입장 시 자동 생성됩니다.");
        }
      } catch (e) {
        console.error("daily-create-room invoke threw", e);
      }
    } catch (e) {
      console.error("create session failed", e);
      toast.error("생성 실패: " + ((e as Error)?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm("세션을 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("video_sessions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("삭제되었습니다.");
      qc.invalidateQueries({ queryKey: ["video-sessions-manage"] });
      qc.invalidateQueries({ queryKey: ["my-video-sessions"] });
    }
  };

  return (
    <DashboardLayout role={role}>
      <div className="px-6 py-8 min-w-0">
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <Video className="h-6 w-6" /> 화상 세션 관리
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              실시간 상담·강의·스터디 세션을 예약하고 관리합니다.
            </p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />새 세션</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>새 화상 세션 만들기</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>제목 *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>설명</Label>
                  <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>유형</Label>
                    <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v as SessionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultation">1:1 상담</SelectItem>
                        <SelectItem value="lecture">실시간 강의</SelectItem>
                        <SelectItem value="study">스터디룸</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>최대 참여자</Label>
                    <Input type="number" min={2} max={200} value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>시작 시간 *</Label>
                    <DateTimePicker value={form.scheduled_start} onChange={(v) => setForm({ ...form, scheduled_start: v })} placeholder="시작 일시 선택" />
                  </div>
                  <div>
                    <Label>종료 시간 *</Label>
                    <DateTimePicker value={form.scheduled_end} onChange={(v) => setForm({ ...form, scheduled_end: v })} placeholder="종료 일시 선택" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.recording_enabled} onCheckedChange={(v) => setForm({ ...form, recording_enabled: v })} />
                  <Label>세션 녹화 활성화</Label>
                </div>
                <div>
                  <Label>참여자 초대 (이름/이메일 검색)</Label>
                  <Input placeholder="2자 이상 입력" value={participantQuery} onChange={(e) => setParticipantQuery(e.target.value)} />
                  {searchUsers.length > 0 && (
                    <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                      {searchUsers.map((u) => (
                        <button
                          key={u.user_id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          onClick={() => {
                            if (selectedParticipants.find((p) => p.id === u.user_id)) return;
                            setSelectedParticipants([...selectedParticipants, { id: u.user_id, name: u.full_name ?? "-", email: u.email ?? "" }]);
                            setParticipantQuery("");
                          }}
                        >
                          {u.full_name} <span className="text-muted-foreground">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedParticipants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedParticipants.map((p) => (
                        <Badge key={p.id} variant="secondary" className="cursor-pointer" onClick={() => setSelectedParticipants(selectedParticipants.filter((x) => x.id !== p.id))}>
                          {p.name} ✕
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
                <Button onClick={handleCreate} disabled={submitting}>{submitting ? "생성 중..." : "생성"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">불러오는 중…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border/80 rounded-lg">
            등록된 세션이 없습니다. 새 세션을 만들어 보세요.
          </div>
        ) : (
          <div className="space-y-0">
            {sessions.map((s) => (
              <div key={s.id} className="py-4 border-b-2 border-border/80 flex items-start justify-between gap-4 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{s.title}</h3>
                    <Badge variant="outline" className="whitespace-nowrap">{TYPE_LABEL[s.session_type]}</Badge>
                    {(() => {
                      const ended = new Date(s.scheduled_end).getTime() < now;
                      const effective = ended && s.status !== "cancelled" ? "completed" : s.status;
                      return (
                        <Badge variant={effective === "live" ? "default" : "secondary"} className="whitespace-nowrap">
                          {STATUS_LABEL[effective]}
                        </Badge>
                      );
                    })()}
                    {s.recording_enabled && <Badge variant="outline" className="whitespace-nowrap">녹화</Badge>}
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatKoreaDateTime(s.scheduled_start)} ~ {formatKoreaTime(s.scheduled_end)}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />최대 {s.max_participants}명</span>
                  </div>
                  {new Date(s.scheduled_end).getTime() < now && (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        세션이 종료되었습니다. 사유: 예정 종료 시간 경과 · 종료 시각 {formatKoreaDateTime(s.scheduled_end)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const endMs = new Date(s.scheduled_end).getTime();
                    const ended = endMs < now;
                    const remain = Math.max(0, endMs - now);
                    const hh = Math.floor(remain / 3_600_000);
                    const mm = Math.floor((remain % 3_600_000) / 60_000);
                    const ss = Math.floor((remain % 60_000) / 1000);
                    const countdown = hh > 0
                      ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
                      : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
                    return ended ? (
                      <Button size="sm" variant="secondary" disabled>
                        세션 종료
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => navigate(`/video-room/${s.id}`)}>
                        <Play className="h-4 w-4 mr-1" />입장
                        <span className="ml-2 text-xs opacity-80 tabular-nums">{countdown}</span>
                      </Button>
                    );
                  })()}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VideoSessionsManage;