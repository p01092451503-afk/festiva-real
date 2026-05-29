import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Pencil, Trash2, BarChart3, Download, Copy } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QType = "rating" | "single" | "multi" | "text" | "nps";
interface Question { id: string; type: QType; text: string; required: boolean; options?: string[]; }

const TARGET_LABEL: Record<string, string> = { program: "프로그램", project: "산학프로젝트", general: "전체" };
const PHASE_LABEL: Record<string, string> = { pre: "사전", post: "사후", general: "상시" };

function newQuestion(): Question { return { id: crypto.randomUUID(), type: "rating", text: "", required: true, options: [] }; }

export default function AdminOpsSurveysRoot() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<"program" | "project" | "general">("program");
  const [targetId, setTargetId] = useState<string>("");
  const [phase, setPhase] = useState<"pre" | "post" | "general">("post");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resultsFor, setResultsFor] = useState<any>(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["ops-surveys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ops_surveys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["ops-surveys-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ops_survey_responses").select("survey_id");
      if (error) throw error;
      const m: Record<string, number> = {};
      (data || []).forEach((r: any) => { m[r.survey_id] = (m[r.survey_id] || 0) + 1; });
      return m;
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["ops-programs-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ops_programs").select("id, title").order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["ia-projects-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ia_projects").select("id, title").order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const reset = () => {
    setEditing(null); setTitle(""); setDescription("");
    setTargetType("program"); setTargetId(""); setPhase("post");
    setIsAnonymous(false); setIsActive(true); setQuestions([newQuestion()]);
  };

  const openCreate = () => { reset(); setOpen(true); };
  const openEdit = (s: any) => {
    setEditing(s); setTitle(s.title); setDescription(s.description || "");
    setTargetType(s.target_type); setTargetId(s.target_id || ""); setPhase(s.phase);
    setIsAnonymous(!!s.is_anonymous); setIsActive(!!s.is_active);
    setQuestions(Array.isArray(s.questions) && s.questions.length ? s.questions : [newQuestion()]);
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력하세요");
      if (targetType !== "general" && !targetId) throw new Error("대상을 선택하세요");
      if (!questions.length) throw new Error("문항을 1개 이상 추가하세요");
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        target_type: targetType,
        target_id: targetType === "general" ? null : targetId,
        phase, is_anonymous: isAnonymous, is_active: isActive,
        questions: questions as any,
      };
      if (editing) {
        const { error } = await supabase.from("ops_surveys").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ops_surveys").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "수정되었습니다" : "생성되었습니다" });
      qc.invalidateQueries({ queryKey: ["ops-surveys"] });
      setOpen(false); reset();
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ops_surveys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "삭제되었습니다" });
      qc.invalidateQueries({ queryKey: ["ops-surveys"] });
    },
  });

  const updateQ = (id: string, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
              <ClipboardList className="h-6 w-6" /> 만족도 조사
            </h1>
            <p className="text-muted-foreground mt-1">프로그램/프로젝트 종료 시 만족도를 수집하고 결과를 확인합니다.</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> 설문 추가</Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">불러오는 중...</p>
        ) : surveys.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">등록된 설문이 없습니다.</CardContent></Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제목</TableHead>
                  <TableHead className="whitespace-nowrap">대상 / 단계</TableHead>
                  <TableHead className="whitespace-nowrap">응답</TableHead>
                  <TableHead className="whitespace-nowrap">상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surveys.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.title}</div>
                      {s.description && <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <Badge variant="outline">{TARGET_LABEL[s.target_type]}</Badge>
                      <Badge variant="secondary" className="ml-1">{PHASE_LABEL[s.phase]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{counts[s.id] || 0}</TableCell>
                    <TableCell>
                      {s.is_active ? <Badge>활성</Badge> : <Badge variant="outline">비활성</Badge>}
                      {s.is_anonymous && <Badge variant="outline" className="ml-1">익명</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setResultsFor(s)}><BarChart3 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm(`"${s.title}" 설문을 삭제할까요?`)) deleteMutation.mutate(s.id);
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Editor */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "설문 수정" : "새 설문"}</DialogTitle>
            <DialogDescription>5점 척도·객관식·주관식·NPS 문항을 자유롭게 구성하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>제목</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="sm:col-span-2">
                <Label>설명</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>대상</Label>
                <Select value={targetType} onValueChange={(v: any) => { setTargetType(v); setTargetId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="program">프로그램</SelectItem>
                    <SelectItem value="project">산학프로젝트</SelectItem>
                    <SelectItem value="general">전체 공통</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>단계</Label>
                <Select value={phase} onValueChange={(v: any) => setPhase(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre">사전</SelectItem>
                    <SelectItem value="post">사후</SelectItem>
                    <SelectItem value="general">상시</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType === "program" && (
                <div className="sm:col-span-2">
                  <Label>프로그램 선택</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="프로그램을 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {programs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {targetType === "project" && (
                <div className="sm:col-span-2">
                  <Label>프로젝트 선택</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger><SelectValue placeholder="프로젝트를 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                <Label>익명 응답</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>활성</Label>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">문항</h3>
                <Button size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
                  <Plus className="h-4 w-4 mr-1" /> 문항 추가
                </Button>
              </div>
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <Card key={q.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-2">Q{idx + 1}</Badge>
                        <Input
                          placeholder="문항 내용"
                          value={q.text}
                          onChange={(e) => updateQ(q.id, { text: e.target.value })}
                          className="flex-1"
                        />
                        <Select value={q.type} onValueChange={(v: any) => updateQ(q.id, { type: v, options: v === "single" || v === "multi" ? (q.options?.length ? q.options : [""]) : [] })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rating">5점 척도</SelectItem>
                            <SelectItem value="single">단일선택</SelectItem>
                            <SelectItem value="multi">복수선택</SelectItem>
                            <SelectItem value="text">주관식</SelectItem>
                            <SelectItem value="nps">NPS (0-10)</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1 mt-2">
                          <Switch checked={q.required} onCheckedChange={(v) => updateQ(q.id, { required: v })} />
                          <span className="text-xs text-muted-foreground">필수</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {(q.type === "single" || q.type === "multi") && (
                        <div className="pl-12 space-y-1">
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} className="flex gap-2">
                              <Input
                                placeholder={`선택지 ${oi + 1}`}
                                value={opt}
                                onChange={(e) => updateQ(q.id, { options: (q.options || []).map((x, i) => i === oi ? e.target.value : x) })}
                              />
                              <Button size="sm" variant="ghost" onClick={() => updateQ(q.id, { options: (q.options || []).filter((_, i) => i !== oi) })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button size="sm" variant="outline" onClick={() => updateQ(q.id, { options: [...(q.options || []), ""] })}>
                            <Plus className="h-4 w-4 mr-1" /> 선택지 추가
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resultsFor && <ResultsDialog survey={resultsFor} onClose={() => setResultsFor(null)} />}
    </DashboardLayout>
  );
}

function ResultsDialog({ survey, onClose }: { survey: any; onClose: () => void }) {
  const { data: responses = [] } = useQuery({
    queryKey: ["ops-survey-responses", survey.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ops_survey_responses").select("*").eq("survey_id", survey.id);
      if (error) throw error;
      return data || [];
    },
  });

  const questions: Question[] = Array.isArray(survey.questions) ? survey.questions : [];

  const stats = questions.map((q) => {
    const answers = responses.map((r: any) => r.answers?.[q.id]).filter((a) => a !== undefined && a !== null && a !== "");
    if (q.type === "rating" || q.type === "nps") {
      const nums = answers.map(Number).filter((n) => !isNaN(n));
      const avg = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length) : 0;
      return { q, avg, count: nums.length, distribution: nums };
    }
    if (q.type === "single" || q.type === "multi") {
      const counts: Record<string, number> = {};
      answers.forEach((a) => {
        const arr = Array.isArray(a) ? a : [a];
        arr.forEach((v: any) => { counts[v] = (counts[v] || 0) + 1; });
      });
      return { q, counts, count: answers.length };
    }
    return { q, texts: answers as string[], count: answers.length };
  });

  const exportCSV = () => {
    const headers = ["응답일시", "응답자ID", ...questions.map((q, i) => `Q${i + 1}. ${q.text}`)];
    const rows = responses.map((r: any) => [
      new Date(r.created_at).toLocaleString("ko-KR"),
      survey.is_anonymous ? "(익명)" : (r.respondent_id || ""),
      ...questions.map((q) => {
        const a = r.answers?.[q.id];
        if (a === undefined || a === null) return "";
        return Array.isArray(a) ? a.join("; ") : String(a);
      }),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `survey_${survey.id}_responses.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{survey.title} — 결과</DialogTitle>
          <DialogDescription>총 {responses.length}건 응답</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!responses.length}>
              <Download className="h-4 w-4 mr-1" /> CSV 내보내기
            </Button>
          </div>
          {stats.map((s: any, i) => (
            <Card key={s.q.id}>
              <CardContent className="p-4 space-y-2">
                <div className="font-medium text-sm">Q{i + 1}. {s.q.text} <Badge variant="outline" className="ml-1">{s.q.type}</Badge></div>
                {(s.q.type === "rating" || s.q.type === "nps") && (
                  <div className="text-sm">
                    <div>평균: <strong>{s.avg.toFixed(2)}</strong> / {s.q.type === "nps" ? 10 : 5} (응답 {s.count}건)</div>
                  </div>
                )}
                {(s.q.type === "single" || s.q.type === "multi") && (
                  <div className="space-y-1">
                    {Object.entries(s.counts as Record<string, number>).map(([opt, c]) => (
                      <div key={opt} className="flex justify-between text-sm">
                        <span>{opt}</span>
                        <span className="text-muted-foreground">{c} ({s.count ? ((c as number) / s.count * 100).toFixed(0) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.q.type === "text" && (
                  <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                    {(s.texts as string[]).map((t, ti) => (
                      <div key={ti} className="p-2 bg-muted rounded text-xs">{t}</div>
                    ))}
                    {!s.texts.length && <div className="text-muted-foreground text-xs">응답 없음</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}