import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, CheckCircle2, XCircle, Download, Building2, CalendarRange,
} from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const MS_STATUS: Record<string, { label: string; variant: any }> = {
  pending: { label: "대기", variant: "outline" },
  in_progress: { label: "진행", variant: "default" },
  done: { label: "완료", variant: "secondary" },
  overdue: { label: "지연", variant: "destructive" },
};

const DV_STATUS: Record<string, { label: string; variant: any }> = {
  submitted: { label: "제출", variant: "outline" },
  approved: { label: "승인", variant: "default" },
  rejected: { label: "반려", variant: "destructive" },
};

export default function AdminOpsProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  // dialogs
  const [memberOpen, setMemberOpen] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("student");

  const [msOpen, setMsOpen] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDue, setMsDue] = useState("");
  const [msDesc, setMsDesc] = useState("");

  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data: project } = useQuery({
    queryKey: ["admin_ia_project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("ia_projects").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["admin_ia_members", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_project_members").select("*").eq("project_id", id!).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["admin_ia_milestones", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_project_milestones").select("*").eq("project_id", id!).order("order_index").order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deliverables = [] } = useQuery({
    queryKey: ["admin_ia_deliverables", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_project_deliverables").select("*").eq("project_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- mutations ----------
  const addMember = useMutation({
    mutationFn: async () => {
      if (!memberName.trim()) throw new Error("이름을 입력해주세요");
      const { error } = await supabase.from("ia_project_members").insert({
        project_id: id!,
        member_name: memberName.trim(),
        member_email: memberEmail.trim() || null,
        role: memberRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "참여자가 추가되었습니다" });
      qc.invalidateQueries({ queryKey: ["admin_ia_members", id] });
      setMemberOpen(false);
      setMemberName(""); setMemberEmail(""); setMemberRole("student");
    },
    onError: (e: any) => toast({ title: "추가 실패", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("ia_project_members").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_ia_members", id] }),
  });

  const addMilestone = useMutation({
    mutationFn: async () => {
      if (!msTitle.trim()) throw new Error("마일스톤 제목을 입력해주세요");
      const { error } = await supabase.from("ia_project_milestones").insert({
        project_id: id!,
        title: msTitle.trim(),
        description: msDesc || null,
        due_date: msDue || null,
        order_index: milestones.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "마일스톤이 추가되었습니다" });
      qc.invalidateQueries({ queryKey: ["admin_ia_milestones", id] });
      setMsOpen(false); setMsTitle(""); setMsDesc(""); setMsDue("");
    },
    onError: (e: any) => toast({ title: "추가 실패", description: e.message, variant: "destructive" }),
  });

  const updateMsStatus = useMutation({
    mutationFn: async ({ mid, status }: { mid: string; status: string }) => {
      const { error } = await supabase
        .from("ia_project_milestones")
        .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
        .eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_ia_milestones", id] }),
  });

  const removeMs = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("ia_project_milestones").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_ia_milestones", id] }),
  });

  const reviewDeliv = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      if (!reviewTarget) return;
      const { error } = await supabase
        .from("ia_project_deliverables")
        .update({ status, review_note: reviewNote || null, reviewed_at: new Date().toISOString() })
        .eq("id", reviewTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "검토 결과가 저장되었습니다" });
      qc.invalidateQueries({ queryKey: ["admin_ia_deliverables", id] });
      setReviewTarget(null); setReviewNote("");
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("ia-deliverables").createSignedUrl(path, 60);
    if (error) return toast({ title: "다운로드 실패", description: error.message, variant: "destructive" });
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = name; a.click();
  };

  if (!project) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ops-projects")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> 프로젝트 목록
        </Button>

        <header className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">{project.title}</h1>
              <p className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                {project.partner_company && (
                  <span className="inline-flex items-center gap-1"><Building2 className="w-4 h-4" />{project.partner_company}</span>
                )}
                {(project.starts_at || project.ends_at) && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarRange className="w-4 h-4" />
                    {project.starts_at ?? "?"} ~ {project.ends_at ?? "?"}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right space-y-1 min-w-40">
              <Badge variant="outline">{project.status}</Badge>
              <div className="flex items-center gap-2">
                <Progress value={project.progress ?? 0} className="h-1.5" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{project.progress ?? 0}%</span>
              </div>
            </div>
          </div>
          {project.description && (
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{project.description}</p>
          )}
        </header>

        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">참여자 ({members.length})</TabsTrigger>
            <TabsTrigger value="milestones">마일스톤 ({milestones.length})</TabsTrigger>
            <TabsTrigger value="deliverables">산출물 ({deliverables.length})</TabsTrigger>
          </TabsList>

          {/* 참여자 */}
          <TabsContent value="members" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMemberOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> 참여자 추가
              </Button>
            </div>
            <div className="border-2 border-border/80 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>참여일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">참여자가 없습니다.</TableCell></TableRow>
                  ) : members.map((m: any) => (
                    <TableRow key={m.id} className="border-b-2 border-border/80">
                      <TableCell className="font-medium">{m.member_name}</TableCell>
                      <TableCell>{m.member_email || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                      <TableCell>{m.joined_at ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 마일스톤 */}
          <TabsContent value="milestones" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setMsOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> 마일스톤 추가
              </Button>
            </div>
            <div className="border-2 border-border/80 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>마감</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {milestones.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">마일스톤이 없습니다.</TableCell></TableRow>
                  ) : milestones.map((m: any) => (
                    <TableRow key={m.id} className="border-b-2 border-border/80">
                      <TableCell>
                        <div className="font-medium">{m.title}</div>
                        {m.description && <div className="text-xs text-muted-foreground">{m.description}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{m.due_date ?? "-"}</TableCell>
                      <TableCell>
                        <Select value={m.status} onValueChange={(v) => updateMsStatus.mutate({ mid: m.id, status: v })}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(MS_STATUS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => removeMs.mutate(m.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* 산출물 */}
          <TabsContent value="deliverables" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              산출물은 학생/멘토가 학생 페이지에서 직접 업로드합니다. 관리자는 검토 결과를 기록할 수 있습니다.
            </p>
            <div className="border-2 border-border/80 rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>제목</TableHead>
                    <TableHead>제출자</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliverables.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">제출된 산출물이 없습니다.</TableCell></TableRow>
                  ) : deliverables.map((d: any) => (
                    <TableRow key={d.id} className="border-b-2 border-border/80">
                      <TableCell>
                        <div className="font-medium">{d.title}</div>
                        {d.file_name && <div className="text-xs text-muted-foreground">{d.file_name}</div>}
                      </TableCell>
                      <TableCell>{d.submitted_by_name || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={DV_STATUS[d.status]?.variant ?? "outline"}>
                          {DV_STATUS[d.status]?.label ?? d.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {d.file_url && (
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(d.file_url, d.file_name || "deliverable")}>
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { setReviewTarget(d); setReviewNote(d.review_note || ""); }}>
                            검토
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 참여자 추가 */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>참여자 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>이름 <span className="text-destructive">*</span></Label>
              <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>이메일</Label>
              <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>역할</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">학생</SelectItem>
                  <SelectItem value="mentor">멘토</SelectItem>
                  <SelectItem value="manager">담당자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberOpen(false)}>취소</Button>
            <Button onClick={() => addMember.mutate()} disabled={addMember.isPending}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 마일스톤 추가 */}
      <Dialog open={msOpen} onOpenChange={setMsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>마일스톤 추가</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>제목 <span className="text-destructive">*</span></Label>
              <Input value={msTitle} onChange={(e) => setMsTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>마감일</Label>
              <Input type="date" value={msDue} onChange={(e) => setMsDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>설명</Label>
              <Textarea rows={3} value={msDesc} onChange={(e) => setMsDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsOpen(false)}>취소</Button>
            <Button onClick={() => addMilestone.mutate()} disabled={addMilestone.isPending}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 산출물 검토 */}
      <Dialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>산출물 검토 - {reviewTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>검토 의견</Label>
              <Textarea rows={4} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewTarget(null)}>닫기</Button>
            <Button variant="destructive" onClick={() => reviewDeliv.mutate({ status: "rejected" })} disabled={reviewDeliv.isPending}>
              <XCircle className="w-4 h-4 mr-1" /> 반려
            </Button>
            <Button onClick={() => reviewDeliv.mutate({ status: "approved" })} disabled={reviewDeliv.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> 승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}