import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, Pencil, Trash2, CheckCircle2, XCircle, FileBadge } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const SESSION_STATUS: Record<string, string> = {
  scheduled: "접수예정",
  open: "접수중",
  closed: "접수마감",
  done: "시험종료",
  result: "결과발표",
};

const APP_STATUS: Record<string, string> = {
  applied: "접수",
  confirmed: "응시확정",
  absent: "결시",
  passed: "합격",
  failed: "불합격",
};

const emptyQual = { id: "", name: "", code: "", grade: "", description: "", issuing_body: "", fee: 0, validity_months: 0, is_active: true };
const emptyVenue = { id: "", name: "", address: "", region: "", capacity: 0, contact: "", is_active: true };
const emptySession = {
  id: "", qualification_id: "", venue_id: "", round_no: 1, title: "",
  apply_start_at: "", apply_end_at: "", exam_at: "", result_at: "",
  capacity: 0, pass_score: 60, status: "scheduled",
};

const toLocalInput = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const iso = (v: string) => (v ? new Date(v).toISOString() : null);

/** 자격검정 관리 — 자격개설 · 회차 · 고사장 · 응시/취득 · 자격증 발급 · 취득후기 */
const AdminQualifications = () => {
  const qc = useQueryClient();
  const [qualForm, setQualForm] = useState(emptyQual);
  const [venueForm, setVenueForm] = useState(emptyVenue);
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [qualOpen, setQualOpen] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("all");

  const { data: quals = [] } = useQuery({
    queryKey: ["qualifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qualifications").select("*").order("display_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["exam-venues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_venues").select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["exam-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_sessions").select("*").order("exam_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["exam-applications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["qual-certs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qualification_certificates").select("*").order("issued_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["qual-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qualification_reviews").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const qualMap = useMemo(() => new Map(quals.map((q) => [q.id, q])), [quals]);
  const venueMap = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);
  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const filteredApps = useMemo(
    () => (sessionFilter === "all" ? apps : apps.filter((a) => a.session_id === sessionFilter)),
    [apps, sessionFilter],
  );

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: [k] });

  const saveQual = async () => {
    if (!qualForm.name.trim()) return toast.error("자격명을 입력하세요");
    const payload = {
      name: qualForm.name.trim(),
      code: qualForm.code || null,
      grade: qualForm.grade || null,
      description: qualForm.description || null,
      issuing_body: qualForm.issuing_body || null,
      fee: Number(qualForm.fee) || 0,
      validity_months: Number(qualForm.validity_months) || null,
      is_active: qualForm.is_active,
    };
    const { error } = qualForm.id
      ? await supabase.from("qualifications").update(payload).eq("id", qualForm.id)
      : await supabase.from("qualifications").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setQualOpen(false); setQualForm(emptyQual); invalidate("qualifications");
  };

  const saveVenue = async () => {
    if (!venueForm.name.trim()) return toast.error("고사장명을 입력하세요");
    const payload = {
      name: venueForm.name.trim(), address: venueForm.address || null, region: venueForm.region || null,
      capacity: Number(venueForm.capacity) || 0, contact: venueForm.contact || null, is_active: venueForm.is_active,
    };
    const { error } = venueForm.id
      ? await supabase.from("exam_venues").update(payload).eq("id", venueForm.id)
      : await supabase.from("exam_venues").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setVenueOpen(false); setVenueForm(emptyVenue); invalidate("exam-venues");
  };

  const saveSession = async () => {
    if (!sessionForm.qualification_id) return toast.error("자격을 선택하세요");
    if (!sessionForm.title.trim()) return toast.error("회차명을 입력하세요");
    const payload = {
      qualification_id: sessionForm.qualification_id,
      venue_id: sessionForm.venue_id || null,
      round_no: Number(sessionForm.round_no) || 1,
      title: sessionForm.title.trim(),
      apply_start_at: iso(sessionForm.apply_start_at),
      apply_end_at: iso(sessionForm.apply_end_at),
      exam_at: iso(sessionForm.exam_at),
      result_at: iso(sessionForm.result_at),
      capacity: Number(sessionForm.capacity) || 0,
      pass_score: Number(sessionForm.pass_score) || 60,
      status: sessionForm.status,
    };
    const { error } = sessionForm.id
      ? await supabase.from("exam_sessions").update(payload).eq("id", sessionForm.id)
      : await supabase.from("exam_sessions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("저장되었습니다");
    setSessionOpen(false); setSessionForm(emptySession); invalidate("exam-sessions");
  };

  const remove = async (table: "qualifications" | "exam_venues" | "exam_sessions" | "qualification_reviews", id: string, key: string) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    invalidate(key);
  };

  const gradeApp = async (app: any, score: number) => {
    const session = sessionMap.get(app.session_id);
    const passed = score >= (session?.pass_score ?? 60);
    const { error } = await supabase
      .from("exam_applications")
      .update({ score, is_passed: passed, status: passed ? "passed" : "failed" })
      .eq("id", app.id);
    if (error) return toast.error(error.message);
    invalidate("exam-applications");
  };

  const issueCert = async (app: any) => {
    const session = sessionMap.get(app.session_id);
    if (!session) return toast.error("회차 정보를 찾을 수 없습니다");
    const qual = qualMap.get(session.qualification_id);
    const certNumber = `Q-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expires = qual?.validity_months
      ? new Date(Date.now() + qual.validity_months * 30 * 24 * 3600 * 1000).toISOString()
      : null;
    const { error } = await supabase.from("qualification_certificates").insert({
      application_id: app.id,
      qualification_id: session.qualification_id,
      user_id: app.user_id,
      cert_number: certNumber,
      recipient_name: app.applicant_name,
      expires_at: expires,
    });
    if (error) return toast.error(error.message);
    toast.success(`자격증이 발급되었습니다 (${certNumber})`);
    invalidate("qual-certs");
  };

  const toggleRevoke = async (c: any) => {
    await supabase.from("qualification_certificates").update({ is_revoked: !c.is_revoked }).eq("id", c.id);
    invalidate("qual-certs");
  };

  const toggleReview = async (r: any) => {
    await supabase.from("qualification_reviews").update({ is_published: !r.is_published }).eq("id", r.id);
    invalidate("qual-reviews");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" /> 자격검정 관리
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            자격 개설부터 검정 회차·고사장 운영, 응시·합격 처리, 자격증 발급과 취득후기까지 관리합니다.
          </p>
        </div>

        <Tabs defaultValue="quals">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="quals">자격 개설</TabsTrigger>
            <TabsTrigger value="sessions">검정 회차</TabsTrigger>
            <TabsTrigger value="venues">고사장</TabsTrigger>
            <TabsTrigger value="apps">응시·취득</TabsTrigger>
            <TabsTrigger value="certs">자격증 발급</TabsTrigger>
            <TabsTrigger value="reviews">취득후기</TabsTrigger>
          </TabsList>

          {/* 자격 */}
          <TabsContent value="quals" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setQualForm(emptyQual); setQualOpen(true); }}>
                <Plus className="h-4 w-4" /> 자격 개설
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {quals.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">개설된 자격이 없습니다.</p>}
              {quals.map((q) => (
                <div key={q.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{q.name}</span>
                      {q.grade && <Badge variant="outline" className="whitespace-nowrap">{q.grade}</Badge>}
                      <Badge variant={q.is_active ? "default" : "secondary"} className="whitespace-nowrap">
                        {q.is_active ? "운영중" : "중지"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.code && `${q.code} · `}
                      응시료 {(q.fee || 0).toLocaleString()}원
                      {q.validity_months ? ` · 유효기간 ${q.validity_months}개월` : " · 유효기간 없음"}
                      {q.issuing_body && ` · ${q.issuing_body}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setQualForm({
                        id: q.id, name: q.name, code: q.code || "", grade: q.grade || "",
                        description: q.description || "", issuing_body: q.issuing_body || "",
                        fee: q.fee || 0, validity_months: q.validity_months || 0, is_active: q.is_active,
                      });
                      setQualOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("qualifications", q.id, "qualifications")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 회차 */}
          <TabsContent value="sessions" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setSessionForm(emptySession); setSessionOpen(true); }}>
                <Plus className="h-4 w-4" /> 회차 등록
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {sessions.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 회차가 없습니다.</p>}
              {sessions.map((s) => {
                const applied = apps.filter((a) => a.session_id === s.id).length;
                return (
                  <div key={s.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{s.title}</span>
                        <Badge variant="outline" className="whitespace-nowrap">{s.round_no}회차</Badge>
                        <Badge className="whitespace-nowrap">{SESSION_STATUS[s.status] || s.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {qualMap.get(s.qualification_id)?.name || "-"}
                        {s.venue_id && ` · ${venueMap.get(s.venue_id)?.name || "-"}`}
                        {s.exam_at && ` · 시험 ${new Date(s.exam_at).toLocaleString("ko-KR")}`}
                        {` · 접수 ${applied}${s.capacity ? `/${s.capacity}` : ""}명 · 합격기준 ${s.pass_score}점`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select value={s.status} onValueChange={async (v) => {
                        await supabase.from("exam_sessions").update({ status: v }).eq("id", s.id);
                        invalidate("exam-sessions");
                      }}>
                        <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(SESSION_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setSessionForm({
                          id: s.id, qualification_id: s.qualification_id, venue_id: s.venue_id || "",
                          round_no: s.round_no, title: s.title,
                          apply_start_at: toLocalInput(s.apply_start_at), apply_end_at: toLocalInput(s.apply_end_at),
                          exam_at: toLocalInput(s.exam_at), result_at: toLocalInput(s.result_at),
                          capacity: s.capacity, pass_score: s.pass_score, status: s.status,
                        });
                        setSessionOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove("exam_sessions", s.id, "exam-sessions")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* 고사장 */}
          <TabsContent value="venues" className="space-y-4 pt-4">
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" onClick={() => { setVenueForm(emptyVenue); setVenueOpen(true); }}>
                <Plus className="h-4 w-4" /> 고사장 등록
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              {venues.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 고사장이 없습니다.</p>}
              {venues.map((v) => (
                <div key={v.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{v.name}</span>
                      {v.region && <Badge variant="outline" className="whitespace-nowrap">{v.region}</Badge>}
                      <Badge variant={v.is_active ? "default" : "secondary"} className="whitespace-nowrap">
                        {v.is_active ? "사용" : "미사용"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {v.address || "주소 미등록"} · 정원 {v.capacity}명{v.contact && ` · ${v.contact}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setVenueForm({
                        id: v.id, name: v.name, address: v.address || "", region: v.region || "",
                        capacity: v.capacity, contact: v.contact || "", is_active: v.is_active,
                      });
                      setVenueOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove("exam_venues", v.id, "exam-venues")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 응시·취득 */}
          <TabsContent value="apps" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-64"><SelectValue placeholder="회차 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 회차</SelectItem>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                총 {filteredApps.length}명 · 합격 {filteredApps.filter((a) => a.is_passed).length}명
              </span>
            </div>
            <div className="rounded-xl border divide-y">
              {filteredApps.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">응시 접수 내역이 없습니다.</p>}
              {filteredApps.map((a) => (
                <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{a.applicant_name || "응시자"}</span>
                      <Badge variant={a.is_passed ? "default" : "secondary"} className="whitespace-nowrap">
                        {APP_STATUS[a.status] || a.status}
                      </Badge>
                      {a.paid && <Badge variant="outline" className="whitespace-nowrap">결제완료</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sessionMap.get(a.session_id)?.title || "-"}
                      {a.seat_no && ` · 좌석 ${a.seat_no}`}
                      {a.score != null && ` · ${a.score}점`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      className="w-20 h-9"
                      placeholder="점수"
                      defaultValue={a.score ?? ""}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value !== "" && v !== a.score) gradeApp(a, v);
                      }}
                    />
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => gradeApp(a, a.score ?? sessionMap.get(a.session_id)?.pass_score ?? 60)}>
                      <CheckCircle2 className="h-4 w-4" /> 합격처리
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={async () => {
                      await supabase.from("exam_applications").update({ status: "absent", is_passed: false }).eq("id", a.id);
                      invalidate("exam-applications");
                    }}>
                      <XCircle className="h-4 w-4" /> 결시
                    </Button>
                    <Button size="sm" className="gap-1" disabled={!a.is_passed} onClick={() => issueCert(a)}>
                      <FileBadge className="h-4 w-4" /> 자격증 발급
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 자격증 */}
          <TabsContent value="certs" className="space-y-4 pt-4">
            <div className="rounded-xl border divide-y">
              {certs.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">발급된 자격증이 없습니다.</p>}
              {certs.map((c) => (
                <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.recipient_name || "취득자"}</span>
                      <Badge variant="outline" className="whitespace-nowrap">{c.cert_number}</Badge>
                      {c.is_revoked && <Badge variant="destructive" className="whitespace-nowrap">취소됨</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {qualMap.get(c.qualification_id)?.name || "-"} · 발급 {new Date(c.issued_at).toLocaleDateString("ko-KR")}
                      {c.expires_at && ` · 만료 ${new Date(c.expires_at).toLocaleDateString("ko-KR")}`}
                    </p>
                  </div>
                  <Button size="sm" variant={c.is_revoked ? "outline" : "ghost"} onClick={() => toggleRevoke(c)}>
                    {c.is_revoked ? "발급 복원" : "발급 취소"}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* 후기 */}
          <TabsContent value="reviews" className="space-y-4 pt-4">
            <div className="rounded-xl border divide-y">
              {reviews.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">등록된 취득후기가 없습니다.</p>}
              {reviews.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{r.title}</span>
                      <Badge variant="outline" className="whitespace-nowrap">별점 {r.rating}</Badge>
                      <Badge variant={r.is_published ? "default" : "secondary"} className="whitespace-nowrap">
                        {r.is_published ? "노출" : "대기"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {qualMap.get(r.qualification_id)?.name || "-"} · {r.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={r.is_published} onCheckedChange={() => toggleReview(r)} />
                    <Button variant="ghost" size="icon" onClick={() => remove("qualification_reviews", r.id, "qual-reviews")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 자격 다이얼로그 */}
      <Dialog open={qualOpen} onOpenChange={setQualOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{qualForm.id ? "자격 수정" : "자격 개설"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>자격명</Label><Input value={qualForm.name} onChange={(e) => setQualForm({ ...qualForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>자격코드</Label><Input value={qualForm.code} onChange={(e) => setQualForm({ ...qualForm, code: e.target.value })} /></div>
              <div><Label>등급</Label><Input placeholder="1급 / 2급" value={qualForm.grade} onChange={(e) => setQualForm({ ...qualForm, grade: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>응시료(원)</Label><Input type="number" value={qualForm.fee} onChange={(e) => setQualForm({ ...qualForm, fee: Number(e.target.value) })} /></div>
              <div><Label>유효기간(개월)</Label><Input type="number" value={qualForm.validity_months} onChange={(e) => setQualForm({ ...qualForm, validity_months: Number(e.target.value) })} /></div>
            </div>
            <div><Label>발급기관</Label><Input value={qualForm.issuing_body} onChange={(e) => setQualForm({ ...qualForm, issuing_body: e.target.value })} /></div>
            <div><Label>소개</Label><Textarea rows={3} value={qualForm.description} onChange={(e) => setQualForm({ ...qualForm, description: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={qualForm.is_active} onCheckedChange={(v) => setQualForm({ ...qualForm, is_active: v })} />
              <span className="text-sm">운영중</span>
            </div>
          </div>
          <DialogFooter><Button onClick={saveQual}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 고사장 다이얼로그 */}
      <Dialog open={venueOpen} onOpenChange={setVenueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{venueForm.id ? "고사장 수정" : "고사장 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>고사장명</Label><Input value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} /></div>
            <div><Label>주소</Label><Input value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>지역</Label><Input placeholder="서울" value={venueForm.region} onChange={(e) => setVenueForm({ ...venueForm, region: e.target.value })} /></div>
              <div><Label>수용 인원</Label><Input type="number" value={venueForm.capacity} onChange={(e) => setVenueForm({ ...venueForm, capacity: Number(e.target.value) })} /></div>
            </div>
            <div><Label>연락처</Label><Input value={venueForm.contact} onChange={(e) => setVenueForm({ ...venueForm, contact: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={venueForm.is_active} onCheckedChange={(v) => setVenueForm({ ...venueForm, is_active: v })} />
              <span className="text-sm">사용</span>
            </div>
          </div>
          <DialogFooter><Button onClick={saveVenue}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 회차 다이얼로그 */}
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{sessionForm.id ? "회차 수정" : "회차 등록"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>자격</Label>
                <Select value={sessionForm.qualification_id} onValueChange={(v) => setSessionForm({ ...sessionForm, qualification_id: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{quals.map((q) => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>고사장</Label>
                <Select value={sessionForm.venue_id} onValueChange={(v) => setSessionForm({ ...sessionForm, venue_id: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>회차</Label><Input type="number" value={sessionForm.round_no} onChange={(e) => setSessionForm({ ...sessionForm, round_no: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>회차명</Label><Input value={sessionForm.title} onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>접수 시작</Label><Input type="datetime-local" value={sessionForm.apply_start_at} onChange={(e) => setSessionForm({ ...sessionForm, apply_start_at: e.target.value })} /></div>
              <div><Label>접수 마감</Label><Input type="datetime-local" value={sessionForm.apply_end_at} onChange={(e) => setSessionForm({ ...sessionForm, apply_end_at: e.target.value })} /></div>
              <div><Label>시험 일시</Label><Input type="datetime-local" value={sessionForm.exam_at} onChange={(e) => setSessionForm({ ...sessionForm, exam_at: e.target.value })} /></div>
              <div><Label>발표 일시</Label><Input type="datetime-local" value={sessionForm.result_at} onChange={(e) => setSessionForm({ ...sessionForm, result_at: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>정원</Label><Input type="number" value={sessionForm.capacity} onChange={(e) => setSessionForm({ ...sessionForm, capacity: Number(e.target.value) })} /></div>
              <div><Label>합격 기준점</Label><Input type="number" value={sessionForm.pass_score} onChange={(e) => setSessionForm({ ...sessionForm, pass_score: Number(e.target.value) })} /></div>
              <div>
                <Label>상태</Label>
                <Select value={sessionForm.status} onValueChange={(v) => setSessionForm({ ...sessionForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(SESSION_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveSession}>저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminQualifications;
