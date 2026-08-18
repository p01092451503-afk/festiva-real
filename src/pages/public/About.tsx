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

const HISTORY = [
  { year: "설립", text: "축제·이벤트 산업 현장 전문가 양성을 목표로 축제운영전문가 자격증 교육원을 설립했습니다." },
  { year: "교육 과정", text: "축제 기획·운영·안전관리·현장 실무를 아우르는 2급/1급 단계별 커리큘럼을 운영합니다." },
  { year: "자격 검정", text: "온라인 이론 학습과 평가, 실무 과제 심사를 통해 자격을 검정하고 자격증을 발급합니다." },
];

const LEVELS = [
  {
    level: "2급",
    badge: "입문·기본 과정",
    target: "축제·이벤트 분야 입문자, 관련 학과 재학생, 지역 축제 참여 실무자",
    subjects: ["축제의 이해와 유형", "축제 기획 기초", "현장 운영 실무", "안전·위기관리 기본"],
    exam: "온라인 이론 평가(객관식) + 수료 기준 진도 충족",
    href: "/store/courses?level=2",
  },
  {
    level: "1급",
    badge: "심화·전문 과정",
    target: "2급 취득자 및 축제 기획·운영 실무 경력자",
    subjects: ["축제 기획 심화", "예산·계약·행정 실무", "홍보·마케팅 전략", "안전관리 계획 수립"],
    exam: "온라인 이론 평가 + 기획서 과제 심사",
    href: "/store/courses?level=1",
  },
];

const STEPS = [
  { step: "01", title: "과정 수강 신청", text: "강의 안내에서 급수별 과정을 선택해 수강 신청·결제를 완료합니다." },
  { step: "02", title: "온라인 학습", text: "나의 강의실에서 차시별 강의를 수강합니다. 수료 기준 진도를 충족해야 평가에 응시할 수 있습니다." },
  { step: "03", title: "평가·과제 응시", text: "이론 평가와 과제를 제출하면 심사 결과가 학습운영·문의에 안내됩니다." },
  { step: "04", title: "자격증 발급", text: "합격 시 자격증이 발급되며, PDF 다운로드와 검증 링크를 제공합니다. 실물 발급은 별도 신청 시 배송됩니다." },
];

const FAQS = [
  { q: "2급을 건너뛰고 1급부터 수강할 수 있나요?", a: "1급은 심화 과정으로, 2급 취득자 또는 동등한 실무 경력자를 대상으로 합니다. 자격 여부가 불확실한 경우 학습운영·문의로 문의해 주세요." },
  { q: "수료 기준은 어떻게 되나요?", a: "각 과정에 설정된 진도율과 평가 기준을 모두 충족해야 수료로 인정됩니다. 과정 상세 페이지에서 기준을 확인할 수 있습니다." },
  { q: "자격증은 어디에서 확인·다운로드하나요?", a: "로그인 후 자격증 신청 및 발급 메뉴의 발급 내역에서 PDF 다운로드와 검증 페이지 링크를 이용할 수 있습니다." },
  { q: "실물 자격증도 받을 수 있나요?", a: "실물 자격증은 별도 신청 후 배송됩니다. 배송 현황 조회 기능은 준비 중이며, 문의는 1:1 문의 게시판을 이용해 주세요." },
  { q: "수강 취소·환불은 가능한가요?", a: "환불은 교육원 환불 규정에 따라 진행됩니다. 결제 내역에서 환불을 신청하거나 1:1 문의로 요청해 주세요." },
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
