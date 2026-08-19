import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2, GraduationCap, FileCheck2, HelpCircle, ArrowRight,
  ShieldCheck, Sparkles, Layers, Check, CalendarClock, Users2,
  BookOpen, ListChecks, Mail, Truck, Award, AlertTriangle, UserRound, Quote,
} from "lucide-react";

import StorefrontHeader from "@/components/StorefrontHeader";
import { PageBanner } from "@/components/PagePattern";
import { pageBg } from "@/config/pageBackgrounds";
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
  {
    name: "크리에이티브쉐이크㈜",
    lines: ["언론기관부설 평생교육시설 설치·운영", "LMS 플랫폼 개발·운영", "서울특별시 종로구 소재"],
    detail: {
      title: "크리에이티브쉐이크 부설 평생교육원",
      subtitle: "언론기관부설 평생교육시설 · LMS 기반 원격 교육 운영",
      paragraphs: [
        "크리에이티브쉐이크 부설 평생교육원은 「평생교육법」 제37조에 따라 관할 교육청에 신고된 언론기관부설 평생교육시설로, 크리에이티브쉐이크㈜가 설치·운영하고 있습니다. 오프라인 중심으로 운영해 온 기존 교육 기반 위에 인터넷·LMS 기반의 원격 교육과정을 추가로 개설하여, 학습자의 시간과 장소에 구애받지 않는 교육 접근성을 제공하고 있습니다.",
        "본 교육원은 사단법인 마이스교육학회와 공동으로 과정을 운영합니다. 크리에이티브쉐이크㈜가 시설 설치와 LMS 플랫폼 운영을 담당한다면, 마이스교육학회는 교육과정 개발과 콘텐츠 저작권, 자격증 심사·발급 권한을 보유하고 있어 두 기관의 협력을 통해 신뢰도 높은 자격증 과정을 제공합니다.",
        "핵심 과정은 축제운영전문가 자격증 과정으로, 기초 단계인 2급과 심화 단계인 1급으로 나뉘어 있습니다. 각 과정은 축제 콘셉트 기획, 홍보 및 마케팅, 운영 및 관리 등 실무에 바로 적용할 수 있는 3개 과목으로 구성되며, 과목마다 기획서·홍보 실행계획서·운영계획서와 같은 실제 산출물을 완성하는 방식으로 학습이 진행됩니다. 강의는 짧은 안내와 핵심 강의, 확인 시험으로 이루어진 압축적인 구성으로 제공되어 바쁜 실무자도 부담 없이 학습을 이어갈 수 있습니다.",
        "지자체와 공공기관의 축제 담당 실무자, 문화재단·관광재단 종사자, 축제·행사 기획사 관계자는 물론 관련 분야로의 취업이나 창업을 준비하는 분들까지 폭넓게 함께할 수 있도록 과정을 설계했습니다. 학습자는 온라인으로 신청과 결제를 마치면 곧바로 학습을 시작할 수 있으며, 진도 관리부터 시험 응시, 수료증 및 자격증 발급까지 전 과정이 LMS 안에서 체계적으로 이루어집니다.",
        "크리에이티브쉐이크 부설 평생교육원은 앞으로도 축제·행사 분야의 실무 역량을 갖춘 전문 인력을 양성하며, 지역 축제 산업의 발전에 기여해 나가겠습니다.",
      ],
    },
  },
  {
    name: "사단법인 마이스교육학회",
    lines: ["교육과정 개발 및 콘텐츠 저작권 보유", "자격증 심사·발급 권한", "위탁운영 계약 체결"],
    detail: {
      title: "마이스홍보교육학회",
      subtitle: "MICE 산업 학술연구 · 청년 취업 지원 공익 활동",
      paragraphs: [
        "마이스홍보교육학회는 마이스(MICE) 산업의 발전과 관련된 제반 학술연구를 수행하며, 마이스 홍보교육과 관련된 청년 취업 문제 해결을 위한 사회 공익 활동을 이어가고 있습니다.",
        "학회는 크게 다섯 가지 사업을 중심으로 활동을 전개합니다. 먼저 전국 축제 가운데 가족, 지인들과 함께 즐겁고 행복한 시간을 보내며 아름다운 추억을 남길 수 있는 우수 축제를 발굴하여 '대한민국 10대 지역축제(K-FESTIVAL)'로 선정, 소개하는 사업을 추진합니다.",
        "또한 전국 각지에서 열리는 마이스 행사·전시·축제 가운데 체계적인 진행과 높은 관심을 받으며 전국민의 참여가 활발했던 지방자치단체와 개인을 선정하여 시상하는 '마이스 그랑프리 시상식'을 개최합니다.",
        "교육 부문에서는 국내 유일의 마이스 온라인 교육을 실시하고 있습니다. 대학생과 취업 준비생, 그리고 마이스 산업 재직자를 대상으로 디지털 역량 강화를 위한 전문 교육을 기획·운영하며, 연 1회 무료 교육을 제공함으로써 마이스 산업 인재 양성에 기여하고 있습니다.",
        "아울러 마이스 산업의 발전을 위해 마이스 협회 및 이벤트 협회, 전국 지자체 마이스 협회, 정부 부처 및 관련 기관과의 협약을 통해 협력 네트워크를 확대해 나가고 있습니다.",
        "마지막으로 학회와 회원들의 활동, 각종 세미나 및 축제 심사평가 내용, 국내외 마이스 이벤트 행사 등을 담은 학회지와 회보를 정기적으로 발간하여 학회 활동의 성과를 널리 공유하고 있습니다.",
      ],
    },
  },
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
      <PageBanner
        config={pageBg("about")}
        size="lg"
        eyebrow="ABOUT festcert"
        title="축제운영전문가 자격증 교육원"
        description="축제·이벤트 현장에서 바로 통하는 기획·운영·안전관리 역량을 단계별로 학습하고, 자격 검정을 통해 전문성을 증명합니다."
      />



      {/* Tabs */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 min-w-0">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="flex-wrap h-auto p-1.5 gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 text-base px-5 py-2.5">
                <t.icon className="w-5 h-5" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 교육원 소개 */}
          <TabsContent value="intro" className="mt-10 space-y-14">
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">크리에이티브쉐이크 부설 평생교육원</h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                언론기관부설 평생교육시설 · 교육청 신고 완료 · 사단법인 마이스교육학회 공동운영
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {HIGHLIGHTS.map((h) => (
                <Card key={h.title} className="border-border/70 hover:shadow-md transition-shadow">
                  <CardContent className="p-7 space-y-4">
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue-light text-navy">
                      <h.icon className="w-6 h-6" aria-hidden="true" />
                    </span>
                    <h3 className="text-xl font-bold text-navy">{h.title}</h3>
                    <p className="text-base text-muted-foreground leading-relaxed">{h.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Users2 className="w-6 h-6 text-brand-orange" aria-hidden="true" /> 이런 분들께 추천합니다
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RECOMMENDED.map((r) => (
                  <div key={r} className="flex items-start gap-3 bg-brand-blue-light rounded-xl px-5 py-4 text-base min-w-0">
                    <Check className="w-5 h-5 mt-0.5 text-brand-orange shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{r}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold">학회 연혁</h3>
              <p className="text-base text-muted-foreground">사단법인 마이스교육학회 설립 및 운영 이력</p>
              <ol className="relative pl-6 sm:pl-8 border-l-2 border-brand-blue-light space-y-7">
                {HISTORY.map((h) => (
                  <li key={`${h.year}-${h.text}`} className="relative min-w-0">
                    <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-brand-orange ring-4 ring-background" aria-hidden="true" />
                    <div className="text-lg font-bold text-navy">{h.year}</div>
                    <p className="text-base text-muted-foreground leading-relaxed mt-1">{h.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold">운영 기관</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {ORGS.map((o) => (
                  <Card key={o.name} className="border-border/70">
                    <CardContent className="p-7 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-navy/5 text-navy">
                          <Building2 className="w-5 h-5" aria-hidden="true" />
                        </span>
                        <p className="text-xl font-bold text-navy min-w-0">{o.name}</p>
                      </div>
                      <ul className="text-base text-muted-foreground leading-relaxed space-y-2">
                        {o.lines.map((l) => (
                          <li key={l} className="flex items-start gap-2">
                            <Check className="w-4 h-4 mt-1.5 text-brand-blue shrink-0" aria-hidden="true" />
                            <span className="min-w-0">{l}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <Card className="bg-brand-blue-light border-navy/10">
              <CardContent className="p-7 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-xl font-bold text-navy">어떤 과정부터 시작해야 할지 모르겠다면?</p>
                  <p className="text-base text-muted-foreground mt-2">급수별 과정 구성과 수강 대상을 확인해 보세요.</p>
                </div>
                <Button asChild size="lg" className="whitespace-nowrap text-base">
                  <Link to="/store/courses">강의 안내 보기 <ArrowRight className="w-5 h-5 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 자격 제도 */}
          <TabsContent value="system" className="mt-10 space-y-14">
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">자격 제도</h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                개강일은 매월 1일입니다. 5분 안내 + 25분 강의 + 15분 시험 = 총 45분, 1과목 3강, 총 9강으로 구성됩니다.
                자격은 2급(기초)과 1급(심화)으로 나뉩니다.
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {LEVELS.map((l) => (
                <Card key={l.level} className="border-border/70 overflow-hidden">
                  <div className="h-1.5 bg-navy" aria-hidden="true" />
                  <CardContent className="p-7 space-y-5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue-light text-navy">
                        <GraduationCap className="w-6 h-6" aria-hidden="true" />
                      </span>
                      <h3 className="text-2xl font-bold text-navy">축제운영전문가 {l.level}</h3>
                      <Badge variant="secondary" className="whitespace-nowrap text-sm">{l.badge}</Badge>
                    </div>
                    <p className="text-base text-muted-foreground leading-relaxed">{l.summary}</p>
                    <div className="rounded-xl bg-muted/50 p-5 space-y-2">
                      <p className="text-base font-semibold">수강 대상</p>
                      <p className="text-base text-muted-foreground leading-relaxed">{l.target}</p>
                    </div>
                    <dl className="divide-y divide-border/80 border-y border-border/80">
                      {l.facts.map((f) => (
                        <div key={f.label} className="flex items-start justify-between gap-4 py-3 text-base">
                          <dt className="text-muted-foreground whitespace-nowrap">{f.label}</dt>
                          <dd className="font-semibold text-right min-w-0">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-xl font-bold text-navy">{l.price}</p>
                    <Button asChild size="lg" variant="outline" className="w-full text-base">
                      <Link to={l.href}>{l.level} 과정 보기</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 1급 수강 전 필수 확인 */}
            <Card className="border-brand-orange/50 bg-brand-orange/5">
              <CardContent className="p-7 flex flex-col sm:flex-row gap-5">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-orange/15 text-brand-orange shrink-0">
                  <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                </span>
                <div className="space-y-3 min-w-0">
                  <h3 className="text-xl font-bold text-brand-orange">1급 수강 전 필수 확인</h3>
                  <ul className="text-base text-muted-foreground leading-relaxed space-y-2">
                    <li className="flex gap-2"><Check className="w-4 h-4 mt-1.5 text-brand-orange shrink-0" aria-hidden="true" /><span>수강 자격: 관련 분야 현장 경력 3년 이상</span></li>
                    <li className="flex gap-2"><Check className="w-4 h-4 mt-1.5 text-brand-orange shrink-0" aria-hidden="true" /><span>1급 지원 시 <strong className="text-foreground">경력증명서</strong>를 반드시 제출해야 합니다.</span></li>
                    <li className="flex gap-2"><Check className="w-4 h-4 mt-1.5 text-brand-orange shrink-0" aria-hidden="true" /><span>자격 미달 시 1급 자격증이 취소됩니다.</span></li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 커리큘럼 */}
            {CURRICULUM.map((c) => (
              <section key={c.level} className="space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <ListChecks className="w-6 h-6 text-brand-orange" aria-hidden="true" />
                  축제운영전문가 {c.level} 커리큘럼
                </h3>
                <div className="space-y-5">
                  {c.subjects.map((s) => (
                    <Card key={s.title} className="border-border/70">
                      <CardContent className="p-7 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="text-xl font-bold text-navy min-w-0">{s.title}</p>
                          <span className="text-sm text-muted-foreground bg-brand-blue-light rounded-full px-4 py-1.5 whitespace-nowrap">{s.meta}</span>
                        </div>
                        <div className="divide-y divide-border/80 border-t border-border/80">
                          {s.lessons.map((l) => (
                            <div key={l.no} className="grid grid-cols-1 sm:grid-cols-[72px_1fr] gap-1 sm:gap-5 py-4">
                              <span className="inline-flex items-center justify-center h-8 w-14 rounded-lg bg-brand-orange/10 text-base font-bold text-brand-orange">{l.no}</span>
                              <div className="min-w-0">
                                <p className="text-lg font-semibold">{l.title}</p>
                                <p className="text-base text-muted-foreground leading-relaxed mt-1.5">{l.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-border/70 bg-muted/30">
                  <CardContent className="p-7 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-xl font-bold flex items-center gap-2 min-w-0">
                        <BookOpen className="w-6 h-6 text-navy shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{c.book.title}</span>
                      </p>
                      <span className="text-xl font-bold text-navy whitespace-nowrap">{c.book.price}</span>
                    </div>
                    <p className="text-lg font-semibold text-brand-orange flex gap-2">
                      <Quote className="w-5 h-5 mt-1 shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{c.book.tagline}</span>
                    </p>
                    <p className="text-base text-muted-foreground leading-relaxed">{c.book.desc}</p>
                    <div className="space-y-3 rounded-xl bg-background p-5">
                      <p className="text-base font-semibold">목차 구성</p>
                      <ul className="text-base text-muted-foreground leading-relaxed space-y-2">
                        {c.book.toc.map((t) => (
                          <li key={t} className="flex gap-2">
                            <Check className="w-4 h-4 mt-1.5 text-brand-blue shrink-0" aria-hidden="true" />
                            <span className="min-w-0">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </section>
            ))}

            {/* 강사 소개 */}
            <section className="space-y-5">
              <h3 className="text-2xl font-bold">강사 소개</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {INSTRUCTORS.map((i) => (
                  <Card key={i.name} className="border-border/70 hover:shadow-md transition-shadow">
                    <CardContent className="p-7 space-y-3">
                      <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-blue-light text-navy">
                        <UserRound className="w-7 h-7" aria-hidden="true" />
                      </span>
                      <p className="text-xl font-bold text-navy">{i.name}</p>
                      <Badge variant="secondary" className="whitespace-nowrap text-sm">{i.field}</Badge>
                      <ul className="text-base text-muted-foreground leading-relaxed space-y-2 pt-1">
                        {i.lines.map((l) => (
                          <li key={l} className="flex gap-2">
                            <Check className="w-4 h-4 mt-1.5 text-brand-blue shrink-0" aria-hidden="true" />
                            <span className="min-w-0">{l}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </TabsContent>

          {/* 발급 안내 */}
          <TabsContent value="certificate" className="mt-10 space-y-14">
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">자격증 발급 안내</h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                수료 조건 충족 후 신청 가능합니다. PDF + 실물 자격증이 함께 발급됩니다.
              </p>
            </section>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold">수료 조건 안내</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {COMPLETION_CONDITIONS.map((c) => (
                  <Card key={c.label} className="border-border/70 text-center">
                    <CardContent className="p-7 space-y-3">
                      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue-light text-navy mx-auto">
                        <c.icon className="w-6 h-6" aria-hidden="true" />
                      </span>
                      <p className="text-base text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-bold text-navy">{c.value}</p>
                      <Badge variant="secondary" className="whitespace-nowrap text-sm">{c.note}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold">발급 방법 — PDF + 실물 동시 발급</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ISSUE_METHODS.map((m) => (
                  <Card key={m.title} className="border-border/70">
                    <CardContent className="p-7 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-blue-light text-navy shrink-0">
                            <m.icon className="w-6 h-6" aria-hidden="true" />
                          </span>
                          <p className="text-xl font-bold text-navy min-w-0">{m.title}</p>
                        </div>
                        <Badge variant="secondary" className="whitespace-nowrap text-sm">{m.fee}</Badge>
                      </div>
                      <ul className="text-base text-muted-foreground leading-relaxed space-y-2">
                        {m.lines.map((l) => (
                          <li key={l} className="flex gap-2">
                            <Check className="w-4 h-4 mt-1.5 text-brand-blue shrink-0" aria-hidden="true" />
                            <span className="min-w-0">{l}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-5">
              <h3 className="text-2xl font-bold">수강부터 발급까지</h3>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {STEPS.map((s) => (
                  <li key={s.step}>
                    <Card className="h-full border-border/70 overflow-hidden">
                      <div className="h-1.5 bg-brand-orange" aria-hidden="true" />
                      <CardContent className="p-7 space-y-3">
                        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-orange/10 text-lg font-bold text-brand-orange">{s.step}</span>
                        <h4 className="text-xl font-bold text-navy">{s.title}</h4>
                        <p className="text-base text-muted-foreground leading-relaxed">{s.text}</p>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>

            <Card className="border-border/70 bg-muted/30">
              <CardContent className="p-7 flex flex-col sm:flex-row gap-5">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-navy/5 text-navy shrink-0">
                  <FileCheck2 className="w-6 h-6" aria-hidden="true" />
                </span>
                <div className="space-y-3 min-w-0">
                  <h3 className="text-xl font-bold">발급 전 확인 사항</h3>
                  <ul className="text-base text-muted-foreground leading-relaxed space-y-2">
                    {ISSUE_NOTES.map((n) => (
                      <li key={n} className="flex gap-2">
                        <Check className="w-4 h-4 mt-1.5 text-brand-blue shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-brand-blue-light border-navy/10">
              <CardContent className="p-7 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-xl font-bold text-navy">이미 수료하셨나요?</p>
                  <p className="text-base text-muted-foreground mt-2">로그인 후 발급 내역에서 자격증을 다운로드할 수 있습니다.</p>
                </div>
                <Button asChild size="lg" className="whitespace-nowrap text-base">
                  <Link to="/student/certificates">자격증 신청 및 발급 <ArrowRight className="w-5 h-5 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="mt-10 space-y-8">
            <section className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy">자주 묻는 질문</h2>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                찾는 답이 없다면 학습운영·문의의 1:1 문의 게시판으로 남겨 주세요.
              </p>
            </section>

            <Accordion type="single" collapsible className="space-y-4">
              {FAQS.map((f, i) => (
                <AccordionItem
                  key={f.q}
                  value={`faq-${i}`}
                  className="border border-border/70 rounded-xl px-6 bg-card data-[state=open]:bg-brand-blue-light/40"
                >
                  <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline py-5">
                    <span className="flex items-start gap-3 min-w-0">
                      <HelpCircle className="w-5 h-5 mt-1 text-brand-orange shrink-0" aria-hidden="true" />
                      <span className="min-w-0">{f.q}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground leading-relaxed pl-8 pb-5">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <Button asChild size="lg" variant="outline" className="text-base">
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

