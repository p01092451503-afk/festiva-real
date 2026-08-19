import { useQuery } from "@tanstack/react-query";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { Award, Download, ShieldCheck, Truck } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
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

type Shipment = {
  id: string;
  course_title: string;
  recipient_name: string;
  postcode: string | null;
  address1: string | null;
  address2: string | null;
  shipping_fee: number;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const SHIP_STATUS: Record<string, string> = {
  pending: "접수 대기",
  approved: "승인 완료",
  issued: "발급 완료",
  shipped: "배송 중",
  delivered: "배송 완료",
  rejected: "반려",
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

  const { data: shipments = [], isLoading: shipLoading } = useQuery({
    queryKey: ["my_cert_shipments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cert_issue_requests").select("*")
        .eq("user_id", user!.id)
        .eq("delivery_method", "post")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Shipment[];
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
    <DashboardLayout contentClassName="flex-1 min-w-0 p-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-brand-blue-light text-navy">
              <Award className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-navy">자격증 신청 및 발급</h1>
          </div>
          <p className="text-base text-muted-foreground pl-11.5">
            수료한 과정의 자격증을 신청하고, 발급 내역과 배송 현황을 확인할 수 있습니다.
          </p>
        </div>

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

          {/* 실물 자격증 배송 추적 */}
          <TabsContent value="shipping" className="mt-6">
            {shipLoading ? (
              <p className="text-sm text-muted-foreground">불러오는 중…</p>
            ) : shipments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center space-y-2">
                  <Truck className="w-6 h-6 mx-auto text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium">배송 내역이 없습니다</p>
                  <p className="text-sm text-muted-foreground">
                    실물(우편) 발급을 신청하면 이곳에서 배송 상태를 확인할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {shipments.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{s.course_title}</div>
                          <div className="text-xs text-muted-foreground">
                            신청일 {new Date(s.created_at).toLocaleDateString("ko-KR")} · 배송비 {s.shipping_fee.toLocaleString()}원
                          </div>
                        </div>
                        <Badge variant={s.status === "delivered" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                          {SHIP_STATUS[s.status] ?? s.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>수령인 {s.recipient_name}</p>
                        {s.postcode && <p>({s.postcode}) {s.address1} {s.address2 ?? ""}</p>}
                        {s.admin_note && (
                          <p className="flex items-center gap-1.5 text-foreground">
                            <Truck className="w-4 h-4 text-primary" aria-hidden="true" />
                            {s.admin_note}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>

    </DashboardLayout>
  );
}