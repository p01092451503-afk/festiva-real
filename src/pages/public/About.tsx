import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2, GraduationCap, FileCheck2, HelpCircle, ArrowRight,
  ShieldCheck, Sparkles, Layers, Check, CalendarClock, Users2,
  BookOpen, ListChecks, Mail, Truck, Award, AlertTriangle, UserRound, Quote,
} from "lucide-react";

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
  { title: "공인 교육기관", text: "평생교육법 제37조에 따라 교육청에 신고된 언론기관부설 평생교육시설입니다.", icon: ShieldCheck },
  { title: "축제 전문 과정", text: "지자체·공공기관 실무자, 기획자, 취업 희망자를 위한 실무 중심 자격증 과정을 제공합니다.", icon: Sparkles },
  { title: "2급·1급 자격증", text: "기초(2급)부터 심화(1급)까지 체계적인 2단계 온라인 자격증 과정을 운영합니다.", icon: Layers },
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

const COMPLETION_CONDITIONS = [
  { label: "강의 이수", value: "6주 이상 이수", note: "필수", icon: ListChecks },
  { label: "시험", value: "60점 이상", note: "합격", icon: GraduationCap },
  { label: "수강 기간", value: "9주", note: "기간 내", icon: CalendarClock },
  { label: "수료 후", value: "PDF + 실물 수료증", note: "발급", icon: Award },
];

const ISSUE_METHODS = [
  {
    title: "PDF 온라인 발급",
    fee: "무료",
    icon: Mail,
    lines: ["수신 이메일로 발송", "3~5영업일 이내", "재발급 무료 (횟수 제한 없음)"],
  },
  {
    title: "실물 우편 수령",
    fee: "유료",
    icon: Truck,
    lines: ["배송비 3,000원", "3~5영업일 배송", "자격증 + 봉투 구성"],
  },
];


const CURRICULUM = [
  {
    level: "2급",
    subjects: [
      {
        title: "과목 1 — 축제 콘셉트 기획",
        meta: "3강 · 산출물: 기본 기획서",
        lessons: [
          { no: "1강", title: "지역자원·타깃 분석 기반 콘셉트 도출", desc: "로컬 리소스 발굴, 빅데이터 기반 타깃 세그멘테이션, 킬러 콘텐츠 설계" },
          { no: "2강", title: "프로그램·예산·공간 기초 설계", desc: "적정 예산 산정, 공간 배치 기초, 일정 로드맵 수립" },
          { no: "3강", title: "기본 기획서 작성 실습", desc: "표준 문서 체계, 축제 정체성 확립과 네이밍 전략, 기획서 구조화" },
        ],
      },
      {
        title: "과목 2 — 축제 홍보 및 마케팅",
        meta: "3강 · 산출물: 홍보 실행계획서",
        lessons: [
          { no: "4강", title: "홍보 목표·KPI 설정 및 채널 전략", desc: "축제 브랜딩, 홍보 KPI 정의, SNS 플랫폼별 콘텐츠 전략" },
          { no: "5강", title: "콘텐츠 캘린더 수립", desc: "사전·현장·사후 홍보 일정표, 게시물 유형 및 제작 일정 관리" },
          { no: "6강", title: "홍보 실행계획서 작성 실습", desc: "실제 제출 가능한 홍보 실행계획서 완성, 예산 배분 및 일정 매핑" },
        ],
      },
      {
        title: "과목 3 — 축제 운영 및 관리",
        meta: "3강 · 산출물: 운영계획서+체크리스트",
        lessons: [
          { no: "7강", title: "운영조직·역할분장 및 현장 체크리스트", desc: "파트별 역할 정의, 현장 운영 표준 체크리스트 작성" },
          { no: "8강", title: "안전관리 기초 및 동선·혼잡 관리", desc: "안전 매뉴얼 기초, 관람객 동선 설계, 혼잡 시나리오 대응" },
          { no: "9강", title: "운영계획서 작성 실습", desc: "종합 운영계획서 완성, 현장 배치도 작성, 비상 대응 매뉴얼" },
        ],
      },
    ],
    book: {
      title: "[교재] 축제 기획·운영 실무 전문가 (2급)",
      price: "45,000원",
      tagline: "\"기획부터 현장 운영까지, 축제의 기본기를 마스터하다!\"",
      desc: "지자체·공공기관 축제 담당자, 문화재단 실무자, 그리고 축제 기획자를 꿈꾸는 입문자를 위한 축제 실무 지침서. 현업에 즉시 적용 가능한 표준 문서 체계와 실전 노하우를 한 권에 압축했습니다.",
      toc: [
        "PART 1 — 과목 1: 축제 콘셉트 기획 (제1장 지역자원 및 타깃 분석 / 제2장 차별화된 콘셉트 도출 / 제3장 기본 기획서 작성)",
        "PART 2 — 과목 2: 축제 홍보 및 마케팅",
        "PART 3 — 과목 3: 축제 운영 및 관리",
        "단원 평가 — 적중 예상문제 (OX 및 객관식 20문항)",
      ],
    },
  },
  {
    level: "1급",
    subjects: [
      {
        title: "과목 1 — 축제 실전 기획",
        meta: "3강 · 산출물: 종합 기획서",
        lessons: [
          { no: "1강", title: "환경분석·타깃 전략 수립", desc: "SWOT·PEST 분석, 경쟁 축제 벤치마킹, 전략적 타깃 세분화" },
          { no: "2강", title: "차별화 콘셉트·예산·일정·안전 시나리오 통합", desc: "브랜드 포지셔닝, 통합 예산 배분, 리스크 시나리오 설계" },
          { no: "3강", title: "종합 기획서 작성 실습", desc: "관계기관 제출용 종합 기획서 완성, 발표 자료 구성" },
        ],
      },
      {
        title: "과목 2 — 통합 마케팅 및 홍보",
        meta: "3강 · 산출물: 통합 마케팅 플랜",
        lessons: [
          { no: "4강", title: "브랜드 포지셔닝 및 고객여정 기반 채널 전략", desc: "축제 브랜드 아이덴티티 설계, 터치포인트별 채널 믹스 전략" },
          { no: "5강", title: "KPI·예산 배분 및 성과 측정 체계", desc: "마케팅 ROI 산정, 채널별 예산 배분, 실시간 성과 모니터링" },
          { no: "6강", title: "통합 마케팅 플랜 작성 실습", desc: "KPI 포함 통합 마케팅 플랜 완성, 예산표·일정표 통합 작성" },
        ],
      },
      {
        title: "과목 3 — 축제 관리 및 평가",
        meta: "3강 · 산출물: 운영·평가 보고서",
        lessons: [
          { no: "7강", title: "운영조직 표준화 및 안전·보험·인허가", desc: "조직 표준 매뉴얼 작성, 행사 보험·인허가 실무, 안전관리 계획 수립" },
          { no: "8강", title: "정산·증빙 관리 및 성과지표 설계", desc: "예산 정산 체계, 증빙 관리 프로세스, KPI 기반 성과 측정 체계 구축" },
          { no: "9강", title: "운영·평가 보고서 작성 실습", desc: "관계기관 제출용 사후 보고서 완성, 개선안 도출 및 차기 기획 연계" },
        ],
      },
    ],
    book: {
      title: "[교재] 축제 운영·평가·관리 전문가 (1급)",
      price: "45,000원",
      tagline: "\"메가 트렌드를 리드하는 축제 운영의 모든 것을 한 권에!\"",
      desc: "축제 운영·평가·관리 전문가(1급) 과정 공식 채택 교재. 환경 분석, 통합 마케팅, 안전 관리, 성과 측정까지 메가 트렌드를 리드하는 실무 전략을 총망라했습니다.",
      toc: [
        "PART 1 — 과목 1: 축제 실전 기획 (SWOT·PEST 분석 / 통합 예산·일정·안전 시나리오 / 종합 기획서 작성)",
        "PART 2 — 과목 2: 통합 마케팅 및 홍보",
        "PART 3 — 과목 3: 축제 관리 및 평가",
        "단원 평가 — 적중 예상문제 (OX 및 객관식 20문항)",
      ],
    },
  },
];

const INSTRUCTORS = [
  { name: "이병관 교수", field: "광고·PR 전문", lines: ["한국외대 미디어커뮤니케이션학부", "광고 및 PR 분야 다수 자문", "공공기관 홍보 전략 기획"] },
  { name: "유정숙 교수", field: "축제 기획·운영 실무", lines: ["축제 기획·운영 실무 전문가", "지역 문화콘텐츠 전략 자문", "지자체 축제 컨설팅 다수"] },
  { name: "조용석 교수", field: "MICE·마케팅", lines: ["MICE·축제 마케팅 전문가", "공공기관 자문위원 경력", "관광재단 기획 자문"] },
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
              <h2 className="text-xl font-semibold">크리에이티브쉐이크 부설 평생교육원</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                언론기관부설 평생교육시설 · 교육청 신고 완료 · 사단법인 마이스교육학회 공동운영
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {HIGHLIGHTS.map((h) => (
                <Card key={h.title}>
                  <CardContent className="p-6 space-y-2">
                    <h3 className="font-semibold text-navy">{h.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{h.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold">이런 분들께 추천합니다</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RECOMMENDED.map((r) => (
                  <div key={r} className="bg-brand-blue-light rounded-md px-4 py-3 text-sm min-w-0">✓ {r}</div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">학회 연혁</h3>
              <p className="text-sm text-muted-foreground">사단법인 마이스교육학회 설립 및 운영 이력</p>
              <div className="border-t-2 border-border/80">
                {HISTORY.map((h) => (
                  <div key={`${h.year}-${h.text}`} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-6 py-4 border-b-2 border-border/80">
                    <div className="font-semibold text-navy">{h.year}</div>
                    <p className="text-muted-foreground leading-relaxed min-w-0">{h.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">운영 기관</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ORGS.map((o) => (
                  <Card key={o.name}>
                    <CardContent className="p-6 space-y-2">
                      <p className="font-semibold text-navy">{o.name}</p>
                      <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                        {o.lines.map((l) => <p key={l}>{l}</p>)}
                      </div>
                    </CardContent>
                  </Card>
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
                개강일은 매월 1일입니다. 5분 안내 + 25분 강의 + 15분 시험 = 총 45분, 1과목 3강, 총 9강으로 구성됩니다.
                자격은 2급(기초)과 1급(심화)으로 나뉩니다.
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
                    <p className="text-sm text-muted-foreground leading-relaxed">{l.summary}</p>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">수강 대상</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{l.target}</p>
                    </div>
                    <div className="border-t-2 border-border/80">
                      {l.facts.map((f) => (
                        <div key={f.label} className="flex items-start justify-between gap-4 py-2 border-b-2 border-border/80 text-sm">
                          <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
                          <span className="font-medium text-right min-w-0">{f.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="font-semibold text-navy">{l.price}</p>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={l.href}>{l.level} 과정 보기</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 1급 수강 전 필수 확인 */}
            <Card className="border-brand-orange/60 bg-brand-orange/5">
              <CardContent className="p-6 space-y-2">
                <h3 className="font-semibold text-brand-orange">1급 수강 전 필수 확인</h3>
                <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
                  <li>수강 자격: 관련 분야 현장 경력 3년 이상</li>
                  <li>1급 지원 시 <strong className="text-foreground">경력증명서</strong>를 반드시 제출해야 합니다.</li>
                  <li>자격 미달 시 1급 자격증이 취소됩니다.</li>
                </ul>
              </CardContent>
            </Card>

            {/* 커리큘럼 */}
            {CURRICULUM.map((c) => (
              <section key={c.level} className="space-y-4">
                <h3 className="font-semibold">축제운영전문가 {c.level} 커리큘럼</h3>
                <div className="space-y-4">
                  {c.subjects.map((s) => (
                    <Card key={s.title}>
                      <CardContent className="p-6 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="font-semibold text-navy min-w-0">{s.title}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{s.meta}</span>
                        </div>
                        <div className="border-t-2 border-border/80">
                          {s.lessons.map((l) => (
                            <div key={l.no} className="grid grid-cols-1 sm:grid-cols-[60px_1fr] gap-1 sm:gap-4 py-3 border-b-2 border-border/80">
                              <span className="text-sm font-semibold text-brand-orange">{l.no}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{l.title}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{l.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                      <p className="font-semibold min-w-0">{c.book.title}</p>
                      <span className="font-semibold text-navy whitespace-nowrap">{c.book.price}</span>
                    </div>
                    <p className="text-sm font-medium text-brand-orange">{c.book.tagline}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.book.desc}</p>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">목차 구성</p>
                      <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
                        {c.book.toc.map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>
            ))}

            {/* 강사 소개 */}
            <section className="space-y-4">
              <h3 className="font-semibold">강사 소개</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {INSTRUCTORS.map((i) => (
                  <Card key={i.name}>
                    <CardContent className="p-6 space-y-2">
                      <p className="font-semibold text-navy">{i.name}</p>
                      <Badge variant="secondary" className="whitespace-nowrap">{i.field}</Badge>
                      <div className="text-sm text-muted-foreground leading-relaxed space-y-1 pt-1">
                        {i.lines.map((l) => <p key={l}>{l}</p>)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </TabsContent>


          {/* 발급 안내 */}
          <TabsContent value="certificate" className="mt-8 space-y-6">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">자격증 발급 안내</h2>
              <p className="text-muted-foreground leading-relaxed max-w-3xl">
                수료 조건 충족 후 신청 가능합니다. PDF + 실물 자격증이 함께 발급됩니다.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">수료 조건 안내</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {COMPLETION_CONDITIONS.map((c) => (
                  <Card key={c.label}>
                    <CardContent className="p-6 space-y-1">
                      <p className="text-sm text-muted-foreground">{c.label}</p>
                      <p className="font-semibold text-navy">{c.value}</p>
                      <Badge variant="secondary" className="whitespace-nowrap">{c.note}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-semibold">발급 방법 — PDF + 실물 동시 발급</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ISSUE_METHODS.map((m) => (
                  <Card key={m.title}>
                    <CardContent className="p-6 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-navy min-w-0">{m.title}</p>
                        <Badge variant="secondary" className="whitespace-nowrap">{m.fee}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                        {m.lines.map((l) => <p key={l}>{l}</p>)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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

            <Card>
              <CardContent className="p-6 space-y-2">
                <h3 className="font-semibold">발급 전 확인 사항</h3>
                <ul className="text-sm text-muted-foreground leading-relaxed list-disc pl-5 space-y-1">
                  {ISSUE_NOTES.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </CardContent>
            </Card>



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
