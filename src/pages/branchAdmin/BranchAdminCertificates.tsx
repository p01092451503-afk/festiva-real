import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Download, Package, Lock, Building2, FileDown, Printer, Layers } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useBranchAdmin } from "@/hooks/useBranchAdmin";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCertificatePDFBlob,
  downloadCertificatePDF,
  downloadBlob,
} from "@/lib/certificateGenerator";
import CompletionRosterPrint, { type RosterRow } from "@/components/admin/CompletionRosterPrint";

const BranchAdminCertificates = () => {
  const qc = useQueryClient();
  const { branches, branchIds, isLoading: loadingBA } = useBranchAdmin();
  const [courseId, setCourseId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [allCoursesBusy, setAllCoursesBusy] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  // 1) 담당 지점에 속한 부서(지점 + 하위 팀) id 목록
  const { data: deptIds = [] } = useQuery({
    queryKey: ["bac-depts", branchIds],
    enabled: branchIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("departments")
        .select("id")
        .or(`id.in.(${branchIds.join(",")}),parent_department_id.in.(${branchIds.join(",")})`);
      return (data ?? []).map((d: any) => d.id as string);
    },
  });

  // 2) 강의 목록 (기본: 법정의무교육 등 필수강의만, 토글 시 전체)
  const { data: courses = [] } = useQuery({
    queryKey: ["bac-courses", showAllCourses],
    queryFn: async () => {
      let q = supabase
        .from("courses")
        .select("id, title, is_mandatory, status")
        .neq("status", "archived")
        .order("title");
      if (!showAllCourses) q = q.eq("is_mandatory", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3) 선택한 강의의 지점 소속 회원 enrollments
  const { data: rows = [], isLoading: loadingRows } = useQuery({
    queryKey: ["bac-rows", courseId, deptIds],
    enabled: !!courseId && deptIds.length > 0,
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id, employee_id, team_name")
        .in("department_id", deptIds);
      const profileMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const userIds = Array.from(profileMap.keys());
      if (userIds.length === 0) return [];

      const [enrollRes, criteriaRes, certRes, deptRes] = await Promise.all([
        supabase
          .from("enrollments")
          .select("user_id, course_id, progress, completed_at")
          .eq("course_id", courseId)
          .in("user_id", userIds),
        supabase.from("completion_criteria").select("*").eq("course_id", courseId).maybeSingle(),
        supabase
          .from("certificates")
          .select("user_id")
          .eq("course_id", courseId)
          .in("user_id", userIds),
        supabase.from("departments").select("id, name").in("id", deptIds),
      ]);

      const criteria: any = criteriaRes.data;
      const minProg = criteria ? Number(criteria.min_progress_pct) : 80;
      const issued = new Set((certRes.data ?? []).map((c: any) => c.user_id));
      const deptMap = new Map((deptRes.data ?? []).map((d: any) => [d.id, d.name]));

      return (enrollRes.data ?? [])
        .map((e: any) => {
          const p: any = profileMap.get(e.user_id);
          const progress = Number(e.progress) || 0;
          const completed = !!e.completed_at || progress >= minProg;
          return {
            user_id: e.user_id,
            name: p?.full_name || "-",
            email: p?.email || "-",
            employee_id: p?.employee_id || "-",
            dept_name: deptMap.get(p?.department_id) || "-",
            progress,
            completed,
            issued: issued.has(e.user_id),
          };
        })
        .sort((a, b) => Number(b.completed) - Number(a.completed) || a.name.localeCompare(b.name));
    },
  });

  const eligible = useMemo(() => rows.filter((r) => r.completed), [rows]);
  const selectableKeys = useMemo(() => eligible.map((r) => r.user_id), [eligible]);
  const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selected.has(k));

  const toggle = (k: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableKeys));

  const currentCourse = courses.find((c: any) => c.id === courseId);

  const buildCertData = (row: typeof rows[number], certNumber: string) => ({
    studentName: row.name,
    studentEmail: row.email,
    courseName: currentCourse?.title || "-",
    issuedDate: new Date().toLocaleDateString("ko-KR"),
    certificateNumber: certNumber,
    titleText: "수료증",
    descText: "위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.",
    issuerName: "교육센터장",
    backgroundImageUrl: null,
    branchName: row.dept_name,
    teamName: null,
  });

  const handleBulkIssue = async () => {
    if (!currentCourse) return;
    const targets = eligible.filter((r) => selected.has(r.user_id));
    if (targets.length === 0) {
      toast.error("발급 대상을 선택하세요");
      return;
    }
    setBulkBusy(true);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let issued = 0;
    let failed = 0;

    for (const r of targets) {
      try {
        const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const blob = await generateCertificatePDFBlob(buildCertData(r, certNumber));
        // 미발급자만 DB insert (기존 발급자는 ZIP에만 포함 → 재다운로드)
        if (!r.issued) {
          const { error } = await supabase.from("certificates").insert({
            user_id: r.user_id,
            course_id: currentCourse.id,
            certificate_number: certNumber,
          });
          if (error) throw error;
        }
        zip.file(`${r.name}_${r.employee_id}_${certNumber}.pdf`, blob);
        issued++;
      } catch (e) {
        console.error("cert fail", r, e);
        failed++;
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const safeTitle = (currentCourse.title || "course").replace(/[\\/:*?"<>|]/g, "_");
    downloadBlob(zipBlob, `${safeTitle}_수료증PDF_${new Date().toISOString().slice(0, 10)}.zip`);
    setBulkBusy(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["bac-rows", courseId, deptIds] });
    toast.success(`${issued}건 발급 완료${failed ? ` · ${failed}건 실패` : ""}`);
  };

  const handleSingleDownload = async (r: typeof rows[number]) => {
    if (!currentCourse) return;
    try {
      const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      if (!r.issued) {
        const { error } = await supabase.from("certificates").insert({
          user_id: r.user_id,
          course_id: currentCourse.id,
          certificate_number: certNumber,
        });
        if (error) throw error;
      }
      await downloadCertificatePDF(buildCertData(r, certNumber), `${r.name}_${certNumber}.pdf`);
      qc.invalidateQueries({ queryKey: ["bac-rows", courseId, deptIds] });
      toast.success("수료증 PDF가 발급되었습니다");
    } catch (e) {
      console.error(e);
      toast.error("발급에 실패했습니다");
    }
  };

  /** 과정별 일괄 다운로드 — 표시되어 있는 모든 강의(필수/전체)의 지점 수료자 수료증 PDF를
   *  강의 폴더로 묶어 ZIP으로 내려준다. */
  const handleAllCoursesBulk = async () => {
    if (courses.length === 0 || deptIds.length === 0) return;
    setAllCoursesBusy(true);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let totalIssued = 0;
    let totalFailed = 0;
    try {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department_id, employee_id")
        .in("department_id", deptIds);
      const profileMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const userIds = Array.from(profileMap.keys());
      const { data: deptRows } = await supabase
        .from("departments")
        .select("id, name")
        .in("id", deptIds);
      const deptMap = new Map((deptRows ?? []).map((d: any) => [d.id, d.name]));

      for (const c of courses) {
        const safeTitle = (c.title || "course").replace(/[\\/:*?"<>|]/g, "_");
        const folder = zip.folder(safeTitle)!;
        const [enrollRes, criteriaRes, certRes] = await Promise.all([
          supabase
            .from("enrollments")
            .select("user_id, progress, completed_at")
            .eq("course_id", c.id)
            .in("user_id", userIds),
          supabase.from("completion_criteria").select("min_progress_pct").eq("course_id", c.id).maybeSingle(),
          supabase.from("certificates").select("user_id").eq("course_id", c.id).in("user_id", userIds),
        ]);
        const minProg = criteriaRes.data ? Number((criteriaRes.data as any).min_progress_pct) : 80;
        const issued = new Set((certRes.data ?? []).map((x: any) => x.user_id));
        const completers = (enrollRes.data ?? []).filter(
          (e: any) => !!e.completed_at || Number(e.progress) >= minProg,
        );
        for (const e of completers) {
          const p: any = profileMap.get(e.user_id);
          if (!p) continue;
          try {
            const certNumber = `CERT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
            const blob = await generateCertificatePDFBlob({
              studentName: p.full_name || "-",
              studentEmail: p.email || "-",
              courseName: c.title,
              issuedDate: new Date().toLocaleDateString("ko-KR"),
              certificateNumber: certNumber,
              titleText: "수료증",
              descText: "위 사람은 본 교육과정을 성실히 이수하였기에 이 증서를 수여합니다.",
              issuerName: "교육센터장",
              backgroundImageUrl: null,
              branchName: deptMap.get(p.department_id) || "-",
              teamName: null,
            });
            if (!issued.has(e.user_id)) {
              await supabase.from("certificates").insert({
                user_id: e.user_id,
                course_id: c.id,
                certificate_number: certNumber,
              });
            }
            folder.file(`${p.full_name}_${p.employee_id || ""}_${certNumber}.pdf`, blob);
            totalIssued++;
          } catch (err) {
            console.error("bulk fail", c.title, p, err);
            totalFailed++;
          }
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `전체수료증_과정별_${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success(`총 ${totalIssued}건 발급 완료${totalFailed ? ` · ${totalFailed}건 실패` : ""}`);
      qc.invalidateQueries({ queryKey: ["bac-rows", courseId, deptIds] });
    } catch (e) {
      console.error(e);
      toast.error("일괄 발급 중 오류가 발생했습니다");
    } finally {
      setAllCoursesBusy(false);
    }
  };

  /** 현재 선택된 강의의 수료자 명단(체크된 사람 우선, 없으면 전체 수료자) */
  const rosterRows: RosterRow[] = useMemo(() => {
    const base = selected.size > 0 ? eligible.filter((r) => selected.has(r.user_id)) : eligible;
    return base.map((r) => ({
      affiliation: r.dept_name,
      employeeId: r.employee_id,
      name: r.name,
    }));
  }, [eligible, selected]);

  if (loadingBA) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-muted-foreground">불러오는 중...</div>
      </DashboardLayout>
    );
  }

  if (branchIds.length === 0) {
    return (
      <DashboardLayout role="branch_admin">
        <div className="p-6 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          담당 지점이 없습니다. 본사 관리자에게 문의해주세요.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="branch_admin">
      <div className="min-w-0 space-y-6 p-4 sm:p-6">
        <header>
          <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
            <Award className="h-6 w-6 text-primary" />
            수료증 일괄 발급
          </h1>
          <p className="text-muted-foreground mt-1">
            법정의무교육 등 필수 과정의 수료증을 담당 지점 소속 인원에게 일괄 발급하고 ZIP으로 다운로드합니다.
          </p>
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> 담당 지점{" "}
            {branches.map((b) => b.name).join(", ")}
          </div>
        </header>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">대상 강의</label>
                <Select
                  value={courseId}
                  onValueChange={(v) => {
                    setCourseId(v);
                    setSelected(new Set());
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="강의를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">강의가 없습니다</div>
                    ) : (
                      courses.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                          {c.is_mandatory ? "  (필수)" : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Checkbox
                  checked={showAllCourses}
                  onCheckedChange={(v) => setShowAllCourses(!!v)}
                />
                필수 외 강의도 표시
              </label>
              <Button
                variant="outline"
                onClick={handleAllCoursesBulk}
                disabled={allCoursesBusy || courses.length === 0}
                className="gap-1.5 whitespace-nowrap"
              >
                <Layers className="h-4 w-4" />
                {allCoursesBusy ? "처리 중..." : "과정별 일괄 다운(PDF)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {courseId && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    disabled={eligible.length === 0}
                  />
                  <span className="text-sm">
                    전체 선택 ({selected.size}/{eligible.length}명 수료자)
                  </span>
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    전체 {rows.length}명
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRosterOpen(true)}
                    disabled={eligible.length === 0}
                    className="gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    수료 명단 PDF·인쇄
                  </Button>
                  <Button onClick={handleBulkIssue} disabled={bulkBusy || selected.size === 0} className="gap-1.5">
                    <FileDown className="h-4 w-4" />
                    {bulkBusy ? "발급 중..." : `선택 ${selected.size}명 PDF 일괄 발급`}
                  </Button>
                </div>
              </div>

              <div className="border-2 border-border/80 rounded-lg overflow-hidden">
                {loadingRows ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">불러오는 중...</div>
                ) : rows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    해당 강의에 수강 중인 지점 소속 회원이 없습니다.
                  </div>
                ) : (
                  rows.map((r) => (
                    <div
                      key={r.user_id}
                      className="flex items-center gap-3 p-3 border-b-2 border-border/80 last:border-b-0 hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={selected.has(r.user_id)}
                        onCheckedChange={() => toggle(r.user_id)}
                        disabled={!r.completed}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.dept_name}</span>
                          {r.employee_id !== "-" && (
                            <span className="text-xs text-muted-foreground">· {r.employee_id}</span>
                          )}
                          {r.issued && (
                            <Badge variant="secondary" className="text-[10px]">
                              발급됨
                            </Badge>
                          )}
                          {r.completed ? (
                            <Badge className="text-[10px]">수료</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              미수료 ({r.progress}%)
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.email}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!r.completed || bulkBusy}
                        onClick={() => handleSingleDownload(r)}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        다운로드
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <CompletionRosterPrint
          open={rosterOpen}
          onOpenChange={setRosterOpen}
          courseTitle={currentCourse?.title || "수료자 명단"}
          rows={rosterRows}
        />
      </div>
    </DashboardLayout>
  );
};

export default BranchAdminCertificates;