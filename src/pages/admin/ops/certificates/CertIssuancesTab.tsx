import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Trash2, ShieldCheck, Copy } from "lucide-react";
import { downloadCertificatePDF } from "@/lib/certificateGenerator";

type Cert = {
  id: string;
  source_type: string;
  source_title: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_branch: string | null;
  recipient_team: string | null;
  verification_code: string;
  cert_number: string | null;
  issued_at: string;
  revoked_at: string | null;
};

export default function CertIssuancesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["ops_certificates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_certificates").select("*").order("issued_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Cert[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter((c) => {
      if (sourceFilter !== "all" && c.source_type !== sourceFilter) return false;
      if (!q) return true;
      return [c.recipient_name, c.recipient_email, c.source_title, c.verification_code, c.cert_number]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [certs, search, sourceFilter]);

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const reason = prompt("폐기 사유를 입력하세요") || "관리자 폐기";
      const { error } = await supabase.from("ops_certificates")
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "폐기되었습니다" }); qc.invalidateQueries({ queryKey: ["ops_certificates"] }); },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const download = async (c: Cert) => {
    try {
      await downloadCertificatePDF({
        studentName: c.recipient_name,
        studentEmail: c.recipient_email || "-",
        courseName: c.source_title,
        issuedDate: new Date(c.issued_at).toLocaleDateString("ko-KR"),
        certificateNumber: c.cert_number || c.verification_code,
        titleText: c.source_type === "program" ? "참가확인서" : "수 료 증",
        descText: "",
        issuerName: "사업단",
        branchName: c.recipient_branch,
        teamName: c.recipient_team,
        language: "ko",
      }, `${c.recipient_name}_${c.source_title}.pdf`);
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    }
  };

  const copyVerifyUrl = (code: string) => {
    const url = `${window.location.origin}/verify/cert/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: "검증 URL이 복사되었습니다", description: url });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="이름·이메일·과정명·인증코드 검색" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 출처</SelectItem>
            <SelectItem value="program">프로그램</SelectItem>
            <SelectItem value="project">산학프로젝트</SelectItem>
            <SelectItem value="manual">수동</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>수령자</TableHead>
                <TableHead>출처</TableHead>
                <TableHead>과정/프로그램</TableHead>
                <TableHead>발급일</TableHead>
                <TableHead>인증코드</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">발급된 인증서가 없습니다.</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.recipient_name}</div>
                    {c.recipient_email && <div className="text-xs text-muted-foreground">{c.recipient_email}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {c.source_type === "program" ? "프로그램" : c.source_type === "project" ? "프로젝트" : "수동"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{c.source_title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.issued_at).toLocaleDateString("ko-KR")}</TableCell>
                  <TableCell className="font-mono text-xs">{c.verification_code}</TableCell>
                  <TableCell>
                    {c.revoked_at ? <Badge variant="destructive">폐기</Badge> : <Badge variant="default">유효</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" title="검증 URL 복사" onClick={() => copyVerifyUrl(c.verification_code)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="PDF 다운로드" onClick={() => download(c)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      {!c.revoked_at && (
                        <Button size="sm" variant="ghost" title="폐기" onClick={() => revoke.mutate(c.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" />
        검증 URL은 <code>/verify/cert/[코드]</code> 형식이며 로그인 없이 누구나 진위를 확인할 수 있습니다.
      </p>
    </div>
  );
}