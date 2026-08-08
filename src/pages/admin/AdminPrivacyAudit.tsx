import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "슈퍼관리자",
  admin: "관리자",
  branch_admin: "중간관리자",
  teacher: "강사",
  student: "학습자",
  unknown: "권한없음",
};

const ACTION_LABEL: Record<string, string> = {
  view: "조회",
  export: "내보내기",
  update: "수정",
  delete: "삭제",
};

const ROLE_ORDER = ["super_admin", "admin", "branch_admin", "teacher", "student", "unknown"];

const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "-");

type LogRow = {
  id: string;
  actor_id: string;
  target_user_id: string;
  action: string;
  context: string | null;
  created_at: string;
  actorName: string;
  actorEmail: string;
  actorRoles: string[];
  targetName: string;
  targetEmail: string;
};

/** 개인정보 감사: 권한별 조회 이력 검색·필터링 및 엑셀 내보내기 */
const AdminPrivacyAudit = () => {
  const monthAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [role, setRole] = useState("all");
  const [action, setAction] = useState("all");
  const [keyword, setKeyword] = useState("");

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["privacy-audit", from, to],
    queryFn: async (): Promise<LogRow[]> => {
      const { data: logs, error } = await supabase
        .from("privacy_access_logs")
        .select("*")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;

      const ids = Array.from(
        new Set((logs || []).flatMap((l) => [l.actor_id, l.target_user_id]).filter(Boolean)),
      );
      if (ids.length === 0) return [];

      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);

      const pMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const rMap = new Map<string, string[]>();
      (roles || []).forEach((r) => {
        rMap.set(r.user_id, [...(rMap.get(r.user_id) || []), r.role as string]);
      });

      return (logs || []).map((l) => {
        const a = pMap.get(l.actor_id);
        const t = pMap.get(l.target_user_id);
        return {
          ...l,
          actorName: a?.full_name || "(알 수 없음)",
          actorEmail: a?.email || "-",
          actorRoles: rMap.get(l.actor_id) || ["unknown"],
          targetName: t?.full_name || "(알 수 없음)",
          targetEmail: t?.email || "-",
        } as LogRow;
      });
    },
  });

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "all" && !r.actorRoles.includes(role)) return false;
      if (action !== "all" && r.action !== action) return false;
      if (kw) {
        const hay = [r.actorName, r.actorEmail, r.targetName, r.targetEmail, r.context || ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [rows, role, action, keyword]);

  const roleStats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const primary = ROLE_ORDER.find((x) => r.actorRoles.includes(x)) || "unknown";
      map.set(primary, (map.get(primary) || 0) + 1);
    });
    return ROLE_ORDER.filter((k) => map.get(k)).map((k) => ({ role: k, count: map.get(k) || 0 }));
  }, [filtered]);

  const exportExcel = () => {
    if (filtered.length === 0) {
      toast.error("내보낼 이력이 없습니다.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(
      filtered.map((r) => ({
        일시: fmtDT(r.created_at),
        조회자: r.actorName,
        조회자이메일: r.actorEmail,
        조회자권한: r.actorRoles.map((x) => ROLE_LABEL[x] || x).join(", "),
        대상회원: r.targetName,
        대상이메일: r.targetEmail,
        행위: ACTION_LABEL[r.action] || r.action,
        경로: r.context || "-",
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "개인정보조회이력");
    XLSX.writeFile(wb, `개인정보_조회이력_${from}_${to}.xlsx`);
    toast.success("엑셀 파일을 내려받았습니다.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
              <ShieldCheck className="h-6 w-6" />
              개인정보 감사
            </h1>
            <p className="mt-1 text-muted-foreground">
              개인정보 조회 로그를 권한·행위·기간별로 검색하고 엑셀로 내보낼 수 있습니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              새로고침
            </Button>
            <Button onClick={exportExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              엑셀 내보내기
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-5">
          <div>
            <Label>시작일</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>종료일</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label>조회자 권한</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 권한</SelectItem>
                {ROLE_ORDER.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>행위</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(ACTION_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>검색어</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="이름·이메일·경로"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">총 {filtered.length.toLocaleString()}건</Badge>
          {roleStats.map((s) => (
            <Badge key={s.role} variant="outline">
              {ROLE_LABEL[s.role]} {s.count.toLocaleString()}건
            </Badge>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3 font-medium">일시</th>
                <th className="p-3 font-medium">조회자</th>
                <th className="p-3 font-medium">권한</th>
                <th className="p-3 font-medium">대상 회원</th>
                <th className="p-3 font-medium">행위</th>
                <th className="p-3 font-medium">경로</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {isFetching ? "불러오는 중..." : "조건에 맞는 조회 이력이 없습니다."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b-2 border-border/80 last:border-0">
                    <td className="whitespace-nowrap p-3">{fmtDT(r.created_at)}</td>
                    <td className="p-3">
                      <div className="font-medium">{r.actorName}</div>
                      <div className="text-xs text-muted-foreground">{r.actorEmail}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {r.actorRoles.map((x) => (
                          <Badge key={x} variant="outline" className="whitespace-nowrap">
                            {ROLE_LABEL[x] || x}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.targetName}</div>
                      <div className="text-xs text-muted-foreground">{r.targetEmail}</div>
                    </td>
                    <td className="whitespace-nowrap p-3">{ACTION_LABEL[r.action] || r.action}</td>
                    <td className="p-3 text-muted-foreground">{r.context || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminPrivacyAudit;
