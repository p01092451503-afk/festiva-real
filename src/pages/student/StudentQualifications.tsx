import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CalendarDays, MapPin, FileBadge, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

const SESSION_STATUS: Record<string, string> = {
  scheduled: "접수예정",
  open: "접수중",
  closed: "접수마감",
  done: "시험종료",
  result: "결과발표",
};

const APP_STATUS: Record<string, string> = {
  applied: "접수완료",
  confirmed: "응시확정",
  absent: "결시",
  passed: "합격",
  failed: "불합격",
};

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "-");
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("ko-KR") : "-");

/** 학습자 자격검정 — 자격 안내 · 회차 접수 · 응시내역 · 자격증 · 취득후기 */
export default function StudentQualifications() {
  const { user, profile } = useUser() as any;
  const qc = useQueryClient();
  const [applying, setApplying] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<any | null>(null);
  const [reviewForm, setReviewForm] = useState({ title: "", content: "", rating: 5 });

  const { data: quals = [] } = useQuery({
    queryKey: ["student-qualifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qualifications").select("*").eq("is_active", true).order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["student-exam-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_sessions").select("*").order("exam_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["student-exam-venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_venues").select("*");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["student-exam-applications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_applications").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["student-qual-certs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qualification_certificates").select("*").eq("user_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: myReviews = [] } = useQuery({
    queryKey: ["student-qual-reviews", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qualification_reviews").select("*").eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const qualMap = useMemo(() => new Map(quals.map((q) => [q.id, q])), [quals]);
  const venueMap = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);
  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const appliedSessionIds = useMemo(() => new Set(apps.map((a) => a.session_id)), [apps]);
  const reviewedQualIds = useMemo(() => new Set(myReviews.map((r) => r.qualification_id)), [myReviews]);

  const openSessions = useMemo(
    () => sessions.filter((s) => ["scheduled", "open"].includes(s.status)),
    [sessions],
  );

  const apply = async (session: any) => {
    if (!user?.id) return;
    if (session.status !== "open") return toast.error("현재 접수 기간이 아닙니다");
    setApplying(session.id);
    const { error } = await supabase.from("exam_applications").insert({
      session_id: session.id,
      user_id: user.id,
      applicant_name: profile?.full_name || profile?.name || user.email || "응시자",
      status: "applied",
    });
    setApplying(null);
    if (error) return toast.error(error.message);
    toast.success("접수가 완료되었습니다");
    qc.invalidateQueries({ queryKey: ["student-exam-applications", user.id] });
  };

  const submitReview = async () => {
    if (!user?.id || !reviewFor) return;
    if (!reviewForm.title.trim() || !reviewForm.content.trim()) return toast.error("제목과 내용을 입력해 주세요");
    const { error } = await supabase.from("qualification_reviews").insert({
      qualification_id: reviewFor.qualification_id,
      user_id: user.id,
      title: reviewForm.title,
      content: reviewForm.content,
      rating: reviewForm.rating,
    });
    if (error) return toast.error(error.message);
    toast.success("후기가 등록되었습니다. 관리자 승인 후 공개됩니다");
    setReviewFor(null);
    setReviewForm({ title: "", content: "", rating: 5 });
    qc.invalidateQueries({ queryKey: ["student-qual-reviews", user.id] });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" /> 자격검정
          </h1>
          <p className="text-muted-foreground mt-1">자격 안내와 시험 접수, 응시 결과와 자격증을 한 곳에서 확인하세요.</p>
        </div>

        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions">시험 접수</TabsTrigger>
            <TabsTrigger value="apps">내 응시내역</TabsTrigger>
            <TabsTrigger value="certs">내 자격증</TabsTrigger>
            <TabsTrigger value="quals">자격 안내</TabsTrigger>
          </TabsList>

          {/* 시험 접수 */}
          <TabsContent value="sessions" className="mt-4 space-y-3">
            {openSessions.length === 0 && (
              <p className="text-sm text-muted-foreground py-10 text-center">접수 가능한 회차가 없습니다.</p>
            )}
            {openSessions.map((s) => {
              const q = qualMap.get(s.qualification_id);
              const v = venueMap.get(s.venue_id);
              const already = appliedSessionIds.has(s.id);
              return (
                <div key={s.id} className="border-b-2 border-border/80 py-4 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={s.status === "open" ? "default" : "secondary"} className="whitespace-nowrap">
                        {SESSION_STATUS[s.status] || s.status}
                      </Badge>
                      <span className="font-medium truncate">
                        {q?.name || "자격"} {s.round_no}회차 {s.title ? `· ${s.title}` : ""}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> 시험일 {fmt(s.exam_at)}</span>
                      <span>접수 {fmtDate(s.apply_start_at)} ~ {fmtDate(s.apply_end_at)}</span>
                      {v && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {v.name}</span>}
                      {q?.fee ? <span>응시료 {Number(q.fee).toLocaleString()}원</span> : null}
                    </div>
                  </div>
                  <Button size="sm" disabled={already || s.status !== "open" || applying === s.id} onClick={() => apply(s)}>
                    {applying === s.id && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    {already ? "접수완료" : "접수하기"}
                  </Button>
                </div>
              );
            })}
          </TabsContent>

          {/* 내 응시내역 */}
          <TabsContent value="apps" className="mt-4 space-y-3">
            {apps.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">응시내역이 없습니다.</p>}
            {apps.map((a) => {
              const s = sessionMap.get(a.session_id);
              const q = s ? qualMap.get(s.qualification_id) : null;
              const canReview = a.status === "passed" && q && !reviewedQualIds.has(q.id);
              return (
                <div key={a.id} className="border-b-2 border-border/80 py-4 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={a.status === "passed" ? "default" : a.status === "failed" ? "destructive" : "secondary"}
                        className="whitespace-nowrap"
                      >
                        {APP_STATUS[a.status] || a.status}
                      </Badge>
                      <span className="font-medium truncate">
                        {q?.name || "자격"} {s ? `${s.round_no}회차` : ""}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>시험일 {fmt(s?.exam_at ?? null)}</span>
                      {a.seat_no && <span>좌석 {a.seat_no}</span>}
                      {a.score != null && <span>점수 {a.score}점</span>}
                      <span>접수일 {fmtDate(a.created_at)}</span>
                    </div>
                  </div>
                  {canReview && (
                    <Button size="sm" variant="outline" onClick={() => setReviewFor({ qualification_id: q!.id, name: q!.name })}>
                      <Star className="h-4 w-4 mr-1" /> 취득후기 작성
                    </Button>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* 내 자격증 */}
          <TabsContent value="certs" className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {certs.length === 0 && (
              <p className="text-sm text-muted-foreground py-10 text-center sm:col-span-2">발급된 자격증이 없습니다.</p>
            )}
            {certs.map((c) => {
              const q = qualMap.get(c.qualification_id);
              return (
                <Card key={c.id} className={c.is_revoked ? "opacity-60" : ""}>
                  <CardContent className="p-5 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileBadge className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium truncate">{q?.name || "자격증"}</span>
                      {c.is_revoked && <Badge variant="destructive" className="whitespace-nowrap">취소됨</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>자격증 번호 {c.cert_number}</p>
                      <p>성명 {c.recipient_name}</p>
                      <p>발급일 {fmtDate(c.issued_at)}</p>
                      {c.expires_at && <p>유효기간 {fmtDate(c.expires_at)}까지</p>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* 자격 안내 */}
          <TabsContent value="quals" className="mt-4 space-y-3">
            {quals.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">등록된 자격이 없습니다.</p>}
            {quals.map((q) => (
              <div key={q.id} className="border-b-2 border-border/80 py-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{q.name}</span>
                  {q.grade && <Badge variant="secondary" className="whitespace-nowrap">{q.grade}</Badge>}
                  {q.code && <span className="text-xs text-muted-foreground">{q.code}</span>}
                </div>
                {q.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{q.description}</p>}
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {q.issuing_body && <span>발급기관 {q.issuing_body}</span>}
                  {q.fee ? <span>응시료 {Number(q.fee).toLocaleString()}원</span> : null}
                  {q.validity_months ? <span>유효기간 {q.validity_months}개월</span> : null}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{reviewFor?.name} 취득후기</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>제목</Label><Input value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} /></div>
            <div><Label>내용</Label><Textarea rows={6} value={reviewForm.content} onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })} /></div>
            <div>
              <Label>평점</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: n })} aria-label={`${n}점`}>
                    <Star className={`h-6 w-6 ${n <= reviewForm.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={submitReview}>등록</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
