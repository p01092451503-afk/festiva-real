import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, GraduationCap, FileCheck2, HelpCircle, ArrowRight } from "lucide-react";
import StorefrontHeader from "@/components/StorefrontHeader";
import SiteFooter from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * 교육원 소개 (/about)
 * 고객사 IA에 맞춘 정적 소개 페이지. 탭은 `?tab=` 쿼리로 딥링크된다.
 * (본문 카피는 확정 원고 반영 전까지의 기본값 — /admin/site-settings 원고와 별개)
 */
const TABS = [
  { value: "intro", label: "교육원 소개", icon: Building2 },
  { value: "system", label: "자격 제도", icon: GraduationCap },
  { value: "certificate", label: "발급 안내", icon: FileCheck2 },
  { value: "faq", label: "FAQ", icon: HelpCircle },
] as const;

const HIGHLIGHTS = [
  { title: "공인 교육기관", text: "평생교육법 제37조에 따라 교육청에 신고된 언론기관부설 평생교육시설입니다." },
  { title: "축제 전문 과정", text: "지자체·공공기관 실무자, 기획자, 취업 희망자를 위한 실무 중심 자격증 과정을 제공합니다." },
  { title: "2급·1급 자격증", text: "기초(2급)부터 심화(1급)까지 체계적인 2단계 온라인 자격증 과정을 운영합니다." },
];

const RECOMMENDED = [
  "지자체·공공기관 축제 담당 실무자",
  "문화재단·관광재단 실무자",
  "축제·행사 기획사 종사자",
  "축제 분야 취업·창업 희망자",
];

const HISTORY = [
  { year: "2026", text: "축제운영전문가 2급·1급 온라인 자격증 과정 개설 및 동시 오픈" },
  { year: "2026", text: "크리에이티브쉐이크 부설 평생교육원 온라인 원격과정 변경신고 승인" },
  { year: "2025", text: "사단법인 마이스교육학회 설립" },
  { year: "2024", text: "크리에이티브쉐이크㈜ 부설 평생교육원 설치 신고" },
];

const ORGS = [
  { name: "크리에이티브쉐이크㈜", lines: ["언론기관부설 평생교육시설 설치·운영", "LMS 플랫폼 개발·운영", "서울특별시 종로구 소재"] },
  { name: "사단법인 마이스교육학회", lines: ["교육과정 개발 및 콘텐츠 저작권 보유", "자격증 심사·발급 권한", "위탁운영 계약 체결"] },
];

const LEVELS = [
  {
    level: "2급",
    badge: "기초",
    summary: "아이디어를 현실로 만드는 축제 실무의 모든 것 — 축제 기획·운영 실무 전문가",
    target: "지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자",
    facts: [
      { label: "총 시수", value: "27시간 (9강)" },
      { label: "수강 기간", value: "9주 과정" },
      { label: "수료 조건", value: "6주 이상 이수 + 시험 60점" },
      { label: "자격증", value: "PDF + 실물 수료증" },
    ],
    price: "195,000원 (강의 150,000 + 교재 45,000)",
    href: "/store/courses?level=2",
  },
  {
    level: "1급",
    badge: "심화",
    summary: "메가 트렌드를 리드하는 축제 운영의 모든 것 — 축제 운영·평가·관리 전문가",
    target: "관련 분야 현장 경력 3년 이상 (2급 수료 또는 경력 1년↑ 권장), 경력증명서 제출 필수",
    facts: [
      { label: "총 시수", value: "27시간 (9강)" },
      { label: "수강 기간", value: "9주 과정" },
      { label: "수료 조건", value: "6주 이상 이수 + 시험 60점 + 경력증명서" },
      { label: "권장 선수", value: "2급 수료 또는 경력 1년↑" },
    ],
    price: "195,000원 (강의 150,000 + 교재 45,000)",
    href: "/store/courses?level=1",
  },
];

const STEPS = [
  { step: "01", title: "수강 신청·결제", text: "개강일은 매월 1일입니다. 급수별 과정을 선택해 수강 신청·결제를 완료합니다. 1급은 경력증명서를 함께 제출해야 합니다." },
  { step: "02", title: "온라인 학습", text: "1차시는 5분 안내 + 25분 강의 + 15분 시험으로 총 45분입니다. 1과목 3강, 총 9강으로 구성되며 배속 재생·구간 반복이 모두 허용됩니다." },
  { step: "03", title: "주간 테스트", text: "9주 이내에 강의·시험 6주치 이상을 완료하고 시험 60점 이상을 획득해야 수료로 인정됩니다. 재응시 횟수 제한은 없습니다." },
  { step: "04", title: "자격증 발급", text: "수료생 전원에게 PDF와 실물 자격증이 발급됩니다. PDF는 이메일로 3~5영업일 내 발송(재발급 무료), 실물은 배송비 3,000원으로 3~5영업일 내 배송됩니다." },
];

const ISSUE_NOTES = [
  "자격증에 기재된 성명은 발급 후 변경이 불가합니다.",
  "PDF는 이메일로 먼저 발송되며, 실물은 순차 배송됩니다.",
  "허위 정보 기재 시 자격증이 취소될 수 있습니다.",
];

const FAQS = [
  { q: "영상을 빠르게 돌려봐도 출석으로 인정되나요?", a: "네, 인정됩니다. 배속 재생(0.5배~2.0배)과 구간 반복 모두 허용되며, 영상 종료 지점까지 재생 완료 시 자동으로 출석 처리됩니다." },
  { q: "테스트에 몇 번이나 응시할 수 있나요?", a: "횟수 제한이 없습니다. 60점 이상 합격할 때까지 즉시 재응시가 가능합니다." },
  { q: "수강 기간 안에 완료하지 못하면 어떻게 되나요?", a: "수강 기간은 9주입니다. 9주 이내에 강의·시험 6주치 이상을 완료해야 수료 처리됩니다." },
  { q: "환불은 어떻게 신청하나요?", a: "결제 후 7일 이내, 진도율 0%이면 전액 환불됩니다. 진도율 50% 미만이면 50% 환불됩니다." },
];


const About = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab") ?? "intro";
  const tab = TABS.some((t) => t.value === raw) ? raw : "intro";

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === "intro") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    document.title = "교육원 소개 | festcert 축제운영전문가 자격증 교육원";
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StorefrontHeader />

      {/* Hero */}
      <section className="bg-navy text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 space-y-3">
          <p className="text-sm font-semibold text-brand-orange">ABOUT festcert</p>
          <h1 className="text-2xl sm:text-3xl font-bold">축제운영전문가 자격증 교육원</h1>
          <p className="text-primary-foreground/80 max-w-2xl leading-relaxed">
            축제·이벤트 현장에서 바로 통하는 기획·운영·안전관리 역량을 단계별로 학습하고, 자격 검정을 통해 전문성을 증명합니다.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 min-w-0">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                <t.icon className="w-4 h-4" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 교육원 소개 */}
          <TabsContent value="intro" className="mt-8 space-y-8">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">교육원 소개</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                festcert 축제운영전문가 자격증 교육원은 지역 축제와 이벤트 산업의 현장 실무 인력을 양성하기 위해 설립되었습니다.
                기획서 작성부터 예산·행정, 현장 운영, 안전관리까지 실제 업무 흐름에 맞춘 온라인 과정을 제공합니다.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">교육원 연혁·운영 방향</h3>
              <div className="border-t-2 border-border/80">
                {HISTORY.map((h) => (
                  <div key={h.year} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-6 py-4 border-b-2 border-border/80">
                    <div className="font-semibold text-navy">{h.year}</div>
                    <p className="text-muted-foreground leading-relaxed min-w-0">{h.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <Card className="bg-brand-blue-light border-border">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">어떤 과정부터 시작해야 할지 모르겠다면?</p>
                  <p className="text-sm text-muted-foreground mt-1">급수별 과정 구성과 수강 대상을 확인해 보세요.</p>
                </div>
                <Button asChild className="whitespace-nowrap">
                  <Link to="/store/courses">강의 안내 보기 <ArrowRight className="w-4 h-4 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 자격 제도 */}
          <TabsContent value="system" className="mt-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">자격 제도</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                축제운영전문가 자격은 2급(입문·기본)과 1급(심화·전문)으로 구성됩니다. 급수별 학습 범위와 검정 방식이 다릅니다.
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {LEVELS.map((l) => (
                <Card key={l.level}>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-navy">축제운영전문가 {l.level}</h3>
                      <Badge variant="secondary" className="whitespace-nowrap">{l.badge}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">수강 대상</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{l.target}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">주요 학습 내용</p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                        {l.subjects.map((s) => <li key={s}>{s}</li>)}
                      </ul>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">검정 방식</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{l.exam}</p>
                    </div>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={l.href}>{l.level} 과정 보기</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 발급 안내 */}
          <TabsContent value="certificate" className="mt-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">자격증 발급 안내</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                수강 신청부터 자격증 발급까지의 절차입니다. 발급된 자격증은 검증 코드로 진위를 확인할 수 있습니다.
              </p>
            </section>

            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STEPS.map((s) => (
                <li key={s.step}>
                  <Card className="h-full">
                    <CardContent className="p-6 space-y-2">
                      <span className="text-sm font-bold text-brand-orange">{s.step}</span>
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>

            <Card className="bg-brand-blue-light border-border">
              <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">이미 수료하셨나요?</p>
                  <p className="text-sm text-muted-foreground mt-1">로그인 후 발급 내역에서 자격증을 다운로드할 수 있습니다.</p>
                </div>
                <Button asChild className="whitespace-nowrap">
                  <Link to="/student/certificates">자격증 신청 및 발급 <ArrowRight className="w-4 h-4 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="mt-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">자주 묻는 질문</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                찾는 답이 없다면 학습운영·문의의 1:1 문의 게시판으로 남겨 주세요.
              </p>
            </section>

            <Accordion type="single" collapsible className="border-t-2 border-border/80">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`} className="border-b-2 border-border/80">
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <Button asChild variant="outline">
              <Link to="/student/board">1:1 문의 게시판으로 이동</Link>
            </Button>
          </TabsContent>
        </Tabs>
      </main>

      <SiteFooter />
    </div>
  );
};

export default About;
