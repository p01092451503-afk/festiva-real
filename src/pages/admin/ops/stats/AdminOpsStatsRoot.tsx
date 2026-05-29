import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Calendar, Briefcase, FolderCheck, Download } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#1f2937", "#6b7280", "#9ca3af", "#d1d5db", "#4b5563"];

type KpiProps = { icon: any; label: string; value: number | string; sub?: string };
function Kpi({ icon: Icon, label, value, sub }: KpiProps) {
  return (
    <div className="stat-card !p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className="text-2xl sm:text-3xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\r\n");
}

export default function AdminOpsStatsRoot() {
  const { data: beneficiaries = [] } = useQuery({
    queryKey: ["stats-beneficiaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiary_students")
        .select("id, status, dept_name, grade, gender, is_vulnerable, program_name, cohort");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["stats-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, title, status, capacity");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["stats-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_applications")
        .select("id, program_id, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["stats-ia-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ia_projects")
        .select("id, status, progress");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: evidence = [] } = useQuery({
    queryKey: ["stats-evidence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_submissions")
        .select("id, status, category_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  // KPIs
  const totalBeneficiaries = beneficiaries.length;
  const activeBeneficiaries = beneficiaries.filter((b: any) => b.status === "active").length;
  const openPrograms = programs.filter((p: any) => p.status === "open").length;
  const totalApplications = applications.length;
  const approvedApps = applications.filter((a: any) => a.status === "approved").length;
  const evidenceApproved = evidence.filter((e: any) => e.status === "approved").length;
  const evidenceRate = evidence.length ? Math.round((evidenceApproved / evidence.length) * 100) : 0;

  // Chart: program status distribution
  const programStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    programs.forEach((p: any) => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [programs]);

  // Chart: applications by status
  const appStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach((a: any) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [applications]);

  // Chart: beneficiary by department (top 8)
  const beneByDept = useMemo(() => {
    const counts: Record<string, number> = {};
    beneficiaries.forEach((b: any) => {
      const k = b.dept_name || "미지정";
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [beneficiaries]);

  // Chart: evidence status
  const evidenceStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    evidence.forEach((e: any) => { counts[e.status] = (counts[e.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [evidence]);

  const handleExportCsv = () => {
    const rows: (string | number)[][] = [
      ["지표", "값"],
      ["총 수혜학생", totalBeneficiaries],
      ["활성 수혜학생", activeBeneficiaries],
      ["모집중 프로그램", openPrograms],
      ["전체 프로그램", programs.length],
      ["누적 신청", totalApplications],
      ["승인된 신청", approvedApps],
      ["산학프로젝트", projects.length],
      ["증빙 제출", evidence.length],
      ["증빙 승인", evidenceApproved],
      ["증빙 승인률(%)", evidenceRate],
      [],
      ["■ 프로그램 상태별", "건수"],
      ...programStatusData.map((d) => [d.name, d.value]),
      [],
      ["■ 신청 상태별", "건수"],
      ...appStatusData.map((d) => [d.name, d.value]),
      [],
      ["■ 학과별 수혜학생", "건수"],
      ...beneByDept.map((d) => [d.name, d.value]),
      [],
      ["■ 증빙 상태별", "건수"],
      ...evidenceStatusData.map((d) => [d.name, d.value]),
    ];
    const csv = "\ufeff" + toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ops-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <BarChart3 className="h-6 w-6 text-foreground mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">산학프로젝트 통계</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                수혜학생·프로그램·산학·증빙 핵심 지표를 한 화면에서 확인합니다.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1.5" />CSV 내보내기
          </Button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Users} label="수혜학생" value={totalBeneficiaries} sub={`활성 ${activeBeneficiaries}명`} />
          <Kpi icon={Calendar} label="프로그램" value={programs.length} sub={`모집중 ${openPrograms}개`} />
          <Kpi icon={Briefcase} label="산학프로젝트" value={projects.length} sub={`평균 진척률 ${
            projects.length ? Math.round(projects.reduce((s: number, p: any) => s + (p.progress ?? 0), 0) / projects.length) : 0
          }%`} />
          <Kpi icon={FolderCheck} label="증빙 승인률" value={`${evidenceRate}%`} sub={`${evidenceApproved} / ${evidence.length}건`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="stat-card !p-5">
            <div className="text-sm font-medium mb-3">프로그램 상태별</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={programStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {programStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card !p-5">
            <div className="text-sm font-medium mb-3">신청 상태별 (누적 {totalApplications}건)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1f2937" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card !p-5">
            <div className="text-sm font-medium mb-3">학과별 수혜학생 (상위 8)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={beneByDept} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#374151" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="stat-card !p-5">
            <div className="text-sm font-medium mb-3">증빙 상태별</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={evidenceStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {evidenceStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}