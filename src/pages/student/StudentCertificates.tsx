import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { Award, Download, ShieldCheck, Truck } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { PageBanner } from "@/components/PagePattern";
import { pageBg } from "@/config/pageBackgrounds";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useFeatureModules } from "@/hooks/useFeatureModules";
import { supabase } from "@/integrations/supabase/client";
import { downloadCertificatePDF } from "@/lib/certificateGenerator";
import CertificateApplyPanel from "@/components/student/CertificateApplyPanel";



type Cert = {
  id: string;
  source_type: string;
  source_title: string;
  recipient_name: string;
  recipient_email: string | null;
  verification_code: string;
  cert_number: string | null;
  issued_at: string;
  revoked_at: string | null;
};

export default function StudentCertificates() {
  const { user } = useUser();
  const { toast } = useToast();
  const { isEnabled, isLoading: modulesLoading } = useFeatureModules();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = rawTab === "shipping" || rawTab === "issued" ? rawTab : "apply";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "apply") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };


  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["my_certificates", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ops_certificates").select("*")
        .eq("recipient_user_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cert[];
    },
  });

  if (!modulesLoading && !isEnabled("certificates_ops")) return <Navigate to="/" replace />;

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
        language: "ko",
      }, `${c.recipient_name}_${c.source_title}.pdf`);
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 min-w-0">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-xl sm:text-2xl font-semibold">자격증 신청 및 발급</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            발급된 자격증·수료증을 다운로드하고 검증 링크를 공유할 수 있습니다. 발급 절차와 수료 조건은{" "}
            <Link to="/about?tab=certificate" className="underline underline-offset-2">
              교육원 소개 &gt; 발급 안내
            </Link>
            에서 확인하세요.
          </p>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList>
            <TabsTrigger value="apply">발급 신청</TabsTrigger>
            <TabsTrigger value="issued">발급 내역</TabsTrigger>
            <TabsTrigger value="shipping">배송 현황</TabsTrigger>
          </TabsList>

          <TabsContent value="apply" className="mt-6">
            <CertificateApplyPanel />
          </TabsContent>

          <TabsContent value="issued" className="mt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : certs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">발급된 인증서가 없습니다.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {certs.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.source_title}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.source_type === "program" ? "프로그램" : c.source_type === "project" ? "산학프로젝트" : "수동 발급"} ·
                            {" "}{new Date(c.issued_at).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                        {c.revoked_at
                          ? <Badge variant="destructive">폐기</Badge>
                          : <Badge variant="default"><ShieldCheck className="w-3 h-3 mr-1" />유효</Badge>}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">CODE: {c.verification_code}</div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={!!c.revoked_at} onClick={() => download(c)}>
                          <Download className="w-3 h-3 mr-1" /> PDF 다운로드
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`/verify/cert/${c.verification_code}`} target="_blank" rel="noreferrer">
                            검증 페이지
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 실물 자격증 배송 추적 — UI 스텁(추후 배송 데이터 연동) */}
          <TabsContent value="shipping" className="mt-6">
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Truck className="w-6 h-6 mx-auto text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">배송 현황 준비 중입니다</p>
                <p className="text-sm text-muted-foreground">
                  실물 자격증 배송 조회 기능은 준비 중입니다. 배송 관련 문의는 학습운영·문의 &gt; 1:1 문의를 이용해 주세요.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </DashboardLayout>
  );
}