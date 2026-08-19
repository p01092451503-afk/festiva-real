import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, FileText, Mail, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

type EnrollmentRow = {
  id: string;
  course_id: string;
  progress: number | null;
  status: string;
  completed_at: string | null;
  expires_at: string | null;
  courses: { id: string; title: string; difficulty_level: string | null } | null;
};

const SHIPPING_FEE = 3000;

/**
 * 자격증 발급 신청 패널.
 * 수료 조건(진도율/기간)을 확인해 신청 가능 여부를 표시하고,
 * PDF + 실물 동시 발급 신청서를 접수한다.
 */
export default function CertificateApplyPanel() {
  const { user, profile } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [withPost, setWithPost] = useState(true);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["cert_apply_enrollments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, course_id, progress, status, completed_at, expires_at, courses(id, title, difficulty_level)")
        .eq("user_id", user!.id)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EnrollmentRow[];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["cert_issue_requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cert_issue_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedId && enrollments.length > 0) setSelectedId(enrollments[0].id);
  }, [enrollments, selectedId]);

  useEffect(() => {
    if (!email && user?.email) setEmail(user.email);
  }, [user?.email, email]);

  const active = useMemo(
    () => enrollments.find((e) => e.id === selectedId) ?? null,
    [enrollments, selectedId],
  );

  const levelLabel = active?.courses?.title?.includes("1급")
    ? "1급 과정"
    : active?.courses?.title?.includes("2급")
      ? "2급 과정"
      : "과정";
  const progress = Math.round(active?.progress ?? 0);
  const progressOk = progress >= 80;
  const daysLeft = active?.expires_at
    ? Math.ceil((new Date(active.expires_at).getTime() - Date.now()) / 86_400_000)
    : null;
  const periodOk = daysLeft === null || daysLeft >= 0;
  const alreadyRequested = requests.some((r: any) => r.course_id === active?.course_id);
  const canApply = !!active && progressOk && periodOk && !alreadyRequested;

  const submit = useMutation({
    mutationFn: async () => {
      if (!active || !user) throw new Error("신청 가능한 과정이 없습니다.");
      if (!email.trim()) throw new Error("수신 이메일을 입력해 주세요.");
      if (withPost && (!postcode.trim() || !address1.trim())) {
        throw new Error("실물 수령을 위해 우편번호와 기본 주소를 입력해 주세요.");
      }
      const { error } = await supabase.from("cert_issue_requests").insert({
        user_id: user.id,
        course_id: active.course_id,
        course_title: active.courses?.title ?? "축제운영전문가 과정",
        recipient_name: profile?.full_name ?? user.email ?? "-",
        completion_hours: "27시간 (3과목 × 9시간)",
        delivery_method: withPost ? "pdf_post" : "pdf_only",
        recipient_email: email.trim(),
        postcode: withPost ? postcode.trim() : null,
        address1: withPost ? address1.trim() : null,
        address2: withPost ? address2.trim() : null,
        shipping_fee: withPost ? SHIPPING_FEE : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "발급 신청이 접수되었습니다", description: "심사 후 이메일로 안내드립니다." });
      qc.invalidateQueries({ queryKey: ["cert_issue_requests", user?.id] });
      setPostcode(""); setAddress1(""); setAddress2("");
    },
    onError: (e: any) => toast({ title: "신청 실패", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;

  if (enrollments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <p className="font-medium">수강 중인 과정이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            자격증 발급은 수강 과정의 수료 조건을 충족한 후 신청할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* 헤더 */}
      <div className="space-y-2">
        <Badge className="bg-navy text-white hover:bg-navy">{levelLabel}</Badge>
        <h2 className="text-xl sm:text-2xl font-bold text-navy">자격증 발급 신청</h2>
        <p className="text-sm text-muted-foreground">
          수료 조건 충족 후 신청 가능합니다. PDF + 실물 자격증이 함께 발급됩니다.
        </p>
      </div>

      {/* 조건 요약 */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Stat label="수강 과정" value={levelLabel} />
          <Stat label="진도율" value={`${progress}%`} tag={progressOk ? "충족" : "미충족"} ok={progressOk} />
          <Stat
            label="수강 기간"
            value={daysLeft === null ? "제한 없음" : `D${daysLeft >= 0 ? "-" : "+"}${Math.abs(daysLeft)}`}
            tag={periodOk ? "기간 내" : "만료"}
            ok={periodOk}
          />
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">신청 자격</p>
            <p className={`text-sm font-semibold ${canApply ? "text-emerald-600" : "text-muted-foreground"}`}>
              {alreadyRequested ? "신청 완료" : canApply ? "✓ 신청 가능" : "조건 미충족"}
            </p>
          </div>
        </div>
      </div>

      {/* 과정 선택 */}
      {enrollments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {enrollments.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelectedId(e.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                e.id === selectedId
                  ? "border-navy bg-navy text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              {e.courses?.title ?? "과정"}
            </button>
          ))}
        </div>
      )}

      {/* 발급 정보 확인 */}
      <section className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-5 py-3.5 text-base font-bold text-navy">발급 정보 확인</h3>
        <div className="space-y-4 p-5">
          <Row label="성명" hint="회원정보에 등록된 이름으로 발급됩니다.">
            <Input value={profile?.full_name ?? ""} readOnly className="bg-muted/50" />
          </Row>
          <Row label="과정명">
            <Input value={active?.courses?.title ?? ""} readOnly className="bg-muted/50" />
          </Row>
          <Row label="이수 시수">
            <Input value="27시간 (3과목 × 9시간)" readOnly className="bg-muted/50" />
          </Row>
        </div>
      </section>

      {/* 발급 방법 */}
      <section className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-5 py-3.5 text-base font-bold text-navy">
          발급 방법 — PDF {withPost ? "+ 실물 동시 발급" : "온라인 발급"}
        </h3>
        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-navy/15 bg-brand-blue-light/60 p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-navy" />
                <span className="font-semibold text-navy">PDF 온라인 발급</span>
                <Badge className="bg-navy text-white hover:bg-navy">무료</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>수신 이메일로 발송</li>
                <li>3~5영업일 이내</li>
                <li>재발급 무료 (횟수 제한 없음)</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setWithPost((v) => !v)}
              className={`rounded-md border p-4 text-left transition ${
                withPost ? "border-brand-orange/50 bg-brand-orange/5" : "border-border bg-muted/30 opacity-70"
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand-orange" />
                <span className="font-semibold text-navy">실물 우편 수령</span>
                <Badge className="bg-brand-orange text-white hover:bg-brand-orange">유료</Badge>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>배송비 {SHIPPING_FEE.toLocaleString()}원</li>
                <li>3~5영업일 배송</li>
                <li>자격증 + 봉투 구성</li>
              </ul>
              <p className="mt-2 text-xs font-medium text-brand-orange">
                {withPost ? "선택됨 · 클릭하면 제외" : "클릭하면 함께 신청"}
              </p>
            </button>
          </div>

          <Row label="수신 이메일*">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hong@email.com"
            />
          </Row>

          {withPost && (
            <Row label="우편 주소*">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="우편번호"
                    className="max-w-[160px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      window.open("https://www.epost.go.kr/search/zipcode/areacdSearchZip.jsp", "_blank", "noopener")
                    }
                  >
                    주소 검색
                  </Button>
                </div>
                <Input value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="기본 주소" />
                <Input value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="상세 주소" />
              </div>
            </Row>
          )}
        </div>
      </section>

      {/* 확인 사항 */}
      <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" /> 발급 전 확인 사항
        </div>
        <ul className="space-y-1.5 text-sm text-amber-900/90">
          {[
            "자격증에 기재된 성명은 발급 후 변경이 불가합니다.",
            "PDF는 이메일로 먼저 발송되며, 실물은 순차 배송됩니다.",
            "허위 정보 기재 시 자격증이 취소될 수 있습니다.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => { setPostcode(""); setAddress1(""); setAddress2(""); }}>
          취소
        </Button>
        <Button
          className="bg-navy hover:bg-navy-dark"
          disabled={!canApply || submit.isPending}
          onClick={() => submit.mutate()}
        >
          <Mail className="mr-2 h-4 w-4" />
          {alreadyRequested ? "이미 신청됨" : submit.isPending ? "접수 중…" : "발급 신청하기"}
        </Button>
      </div>

      {/* 신청 내역 */}
      {requests.length > 0 && (
        <section className="rounded-lg border border-border bg-card">
          <h3 className="border-b border-border px-5 py-3.5 text-base font-bold text-navy">신청 내역 조회</h3>
          <ul className="divide-y divide-border">
            {requests.map((r: any) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.course_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")} ·{" "}
                    {r.delivery_method === "pdf_post" ? "PDF + 실물" : "PDF 발급"} · {r.recipient_email}
                  </p>
                </div>
                <Badge variant={r.status === "issued" ? "default" : "secondary"}>
                  {r.status === "issued" ? "발급 완료" : r.status === "rejected" ? "반려" : "심사 중"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tag, ok }: { label: string; value: string; tag?: string; ok?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-navy">{value}</p>
      {tag && (
        <span
          className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
            ok ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}
        >
          {tag}
        </span>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[110px_1fr] sm:items-start sm:gap-4">
      <Label className="pt-2.5 text-sm text-muted-foreground">{label}</Label>
      <div className="min-w-0 space-y-1">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
