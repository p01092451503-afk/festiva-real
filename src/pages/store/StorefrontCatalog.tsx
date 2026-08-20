import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  Receipt,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StorefrontHeader from "@/components/StorefrontHeader";
import SiteFooter from "@/components/SiteFooter";
import PageTitleHeader from "@/components/storefront/PageTitleHeader";

import Level1QualificationDialog from "@/components/storefront/Level1QualificationDialog";
import { supabase } from "@/integrations/supabase/client";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCourseIds";

type LevelKey = "2급" | "1급";

interface LevelGuide {
  level: LevelKey;
  badge: string;
  title: string;
  subtitle: string;
  target: string;
  facts: { label: string; value: string }[];
  highlights: { icon: typeof Award; text: string }[];
  warning?: string[];
  subjects: { title: string; meta: string; lessons: { no: string; title: string; desc: string }[] }[];
  fees: { label: string; value: string }[];
  feeNote: string;
  instructors: { name: string; field: string }[];
  book: { title: string; price: string; tagline: string; desc: string; toc: string[] };
}

const GUIDES: LevelGuide[] = [
  {
    level: "2급",
    badge: "기초",
    title: "축제운영전문가 2급",
    subtitle: "아이디어를 현실로 만드는 축제 실무의 모든 것 — 축제 기획·운영 실무 전문가",
    target: "지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자",
    facts: [
      { label: "총 시수", value: "27시간 (9강)" },
      { label: "수강 기간", value: "9주 과정" },
      { label: "수료 조건", value: "6주 이상 이수 + 시험 60점" },
      { label: "자격증", value: "PDF + 실물 수료증" },
    ],
    highlights: [
      { icon: ListChecks, text: "6주 이상 이수 필수" },
      { icon: GraduationCap, text: "시험 60점 이상 합격" },
      { icon: FileText, text: "과목별 실무 산출물 완성" },
      { icon: Award, text: "수료 후 PDF + 실물 수료증" },
    ],
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
        meta: "3강 · 산출물: 운영계획서 + 체크리스트",
        lessons: [
          { no: "7강", title: "운영조직·역할분장 및 현장 체크리스트", desc: "파트별 역할 정의, 현장 운영 표준 체크리스트 작성" },
          { no: "8강", title: "안전관리 기초 및 동선·혼잡 관리", desc: "안전 매뉴얼 기초, 관람객 동선 설계, 혼잡 시나리오 대응" },
          { no: "9강", title: "운영계획서 작성 실습", desc: "종합 운영계획서 완성, 현장 배치도 작성, 비상 대응 매뉴얼" },
        ],
      },
    ],
    fees: [
      { label: "강의 수강료", value: "150,000원" },
      { label: "교재 + 예상문제집", value: "45,000원" },
    ],
    feeNote: "면세 교육 서비스 · 부가세 없음",
    instructors: [
      { name: "유정숙 교수", field: "축제 기획·운영 실무" },
      { name: "이병관 교수", field: "축제 홍보 및 마케팅" },
      { name: "조용석 교수", field: "축제 운영 및 관리" },
    ],
    book: {
      title: "[교재] 축제 기획·운영 실무 전문가 (2급)",
      price: "45,000원",
      tagline: "\"기획부터 현장 운영까지, 축제의 기본기를 마스터하다!\"",
      desc: "지자체·공공기관 축제 담당자, 문화재단 실무자, 그리고 축제 기획자를 꿈꾸는 입문자를 위한 축제 실무 지침서. 현업에 즉시 적용 가능한 표준 문서 체계와 실전 노하우를 한 권에 압축했습니다.",
      toc: [
        "PART 1 — 과목 1: 축제 콘셉트 기획",
        "PART 2 — 과목 2: 축제 홍보 및 마케팅",
        "PART 3 — 과목 3: 축제 운영 및 관리",
        "단원 평가 — 적중 예상문제 (OX 및 객관식 20문항)",
      ],
    },
  },
  {
    level: "1급",
    badge: "심화",
    title: "축제운영전문가 1급",
    subtitle: "메가 트렌드를 리드하는 축제 운영의 모든 것 — 축제 운영·평가·관리 전문가",
    target: "관련 분야 현장 경력 3년 이상 (2급 수료 또는 경력 1년↑ 권장), 경력증명서 제출 필수",
    facts: [
      { label: "총 시수", value: "27시간 (9강)" },
      { label: "수강 기간", value: "9주 과정" },
      { label: "수료 조건", value: "6주 이상 이수 + 시험 60점 + 경력증명서" },
      { label: "권장 선수", value: "2급 수료 또는 경력 1년↑" },
    ],
    highlights: [
      { icon: ListChecks, text: "6주 이상 이수 필수" },
      { icon: GraduationCap, text: "시험 60점 이상 합격" },
      { icon: ClipboardList, text: "경력증명서 제출" },
      { icon: Award, text: "수료 후 PDF + 실물 수료증" },
    ],
    warning: [
      "자격 미달 시 1급 자격증이 취소됩니다",
      "1급 지원 시 경력증명서를 반드시 제출해야 합니다",
      "수강 자격: 관련 분야 현장 경력 3년 이상",
    ],
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
    fees: [
      { label: "강의 수강료", value: "150,000원" },
      { label: "교재 + 예상문제집", value: "45,000원" },
    ],
    feeNote: "면세 교육 서비스 · 부가세 없음",
    instructors: [
      { name: "이현우", field: "축제 실전 기획" },
      { name: "최형선", field: "통합 마케팅 및 홍보" },
      { name: "윤지현", field: "축제 관리 및 평가" },
    ],
    book: {
      title: "[교재] 축제 운영·평가·관리 전문가 (1급)",
      price: "45,000원",
      tagline: "\"메가 트렌드를 리드하는 축제 운영의 모든 것을 한 권에!\"",
      desc: "축제 운영·평가·관리 전문가(1급) 과정 공식 채택 교재. 환경 분석, 통합 마케팅, 안전 관리, 성과 측정까지 메가 트렌드를 리드하는 실무 전략을 총망라했습니다.",
      toc: [
        "PART 1 — 과목 1: 축제 실전 기획",
        "PART 2 — 과목 2: 통합 마케팅 및 홍보",
        "PART 3 — 과목 3: 축제 관리 및 평가",
        "단원 평가 — 적중 예상문제 (OX 및 객관식 20문항)",
      ],
    },
  },
];

const StorefrontCatalog = () => {
  const navigate = useNavigate();
  const [level1Open, setLevel1Open] = useState(false);

  useEffect(() => {
    document.title = "강의 안내 | festcert 축제운영전문가 자격증 교육원";
  }, []);

  const { data: rawCourses = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, price, sale_price, sale_status, status")
        .eq("is_b2c", true)
        .eq("status", "published");
      if (error) throw error;
      return data;
    },
  });
  const { data: enrolledIds = new Set<string>() } = useEnrolledCourseIds();

  const courseByLevel = useMemo(() => {
    const map: Partial<Record<LevelKey, string>> = {};
    rawCourses.forEach((c) => {
      if (c.title?.includes("2급")) map["2급"] = c.id;
      if (c.title?.includes("1급")) map["1급"] = c.id;
    });
    return map;
  }, [rawCourses]);

  const goToCourse = (level: LevelKey) => {
    const id = courseByLevel[level];
    if (!id) return;
    if (enrolledIds.has(id)) navigate(`/student/courses/${id}`);
    else navigate(`/store/courses/${id}`);
  };

  const handleApply = (level: LevelKey) => {
    if (level === "1급") setLevel1Open(true);
    else goToCourse("2급");
  };

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      <PageTitleHeader
        title="강의 안내"
        description="2급·1급 단계별 온라인 과정으로 축제 기획·운영·안전관리 실무 문서를 직접 완성합니다."
      />


      <main className="max-w-6xl mx-auto px-4 pt-16 sm:pt-20 pb-24 sm:pb-32 space-y-20">
        {GUIDES.map((g, idx) => {
          const courseId = courseByLevel[g.level];
          const isEnrolled = courseId ? enrolledIds.has(courseId) : false;
          return (
            <section key={g.level} id={`level-${g.level === "2급" ? 2 : 1}`} className="scroll-mt-28">
              {/* 헤더 */}
              <div className="rounded-[2rem] bg-background overflow-hidden ring-1 ring-border/60 shadow-[0_24px_70px_-40px_hsl(var(--navy)/0.45)]">
                <div className="bg-gradient-to-b from-brand-blue-light/70 via-background to-background px-6 sm:px-10 py-14 sm:py-16 text-center">
                  <span className="text-sm font-semibold text-brand-orange">
                    STEP 0{idx + 1} · {g.badge}
                  </span>
                  <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight leading-[1.35] text-foreground">
                    {g.title}
                  </h2>
                  <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                    {g.subtitle}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground/80 leading-relaxed max-w-2xl mx-auto">
                    추천 대상 · {g.target}
                  </p>

                  {/* 신청 CTA */}
                  <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button
                      size="lg"
                      className="bg-brand-orange hover:bg-brand-orange/90 text-white text-base h-12 px-8 rounded-full font-semibold leading-normal"
                      onClick={() => handleApply(g.level)}
                      disabled={!courseId}
                    >
                      {isEnrolled ? "수강중 · 이어보기" : `${g.level} 과정 신청하기`}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      수강료 <strong className="font-semibold text-navy">195,000원</strong>
                      <span className="ml-1.5 text-muted-foreground/70">({g.feeNote})</span>
                    </span>
                  </div>
                </div>


                {/* 핵심 정보 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-border/60 border-b border-border/60">
                  {g.facts.map((f) => (
                    <div key={f.label} className="p-5">
                      <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                      <p className="mt-1.5 text-base font-semibold text-foreground leading-snug">{f.value}</p>
                    </div>
                  ))}
                </div>

                <div className="p-6 sm:p-10 space-y-10">
                  {/* 수료 포인트 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {g.highlights.map((h) => (
                      <div key={h.text} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3.5">
                        <h.icon className="h-5 w-5 text-navy shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium text-foreground leading-snug">{h.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* 필수 확인 경고 */}
                  {g.warning && (
                    <div className="rounded-2xl border-2 border-brand-orange/40 bg-brand-orange/5 p-6">
                      <p className="flex items-center gap-2 font-bold text-brand-orange text-lg">
                        <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {g.level} 수강 전 필수 확인
                      </p>
                      <ul className="mt-3 space-y-2">
                        {g.warning.map((w) => (
                          <li key={w} className="flex gap-2 text-sm text-foreground/80 leading-relaxed">
                            <span className="text-brand-orange">•</span>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 커리큘럼 */}
                  <div>
                    <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      <ListChecks className="h-5 w-5 text-navy" aria-hidden="true" />
                      커리큘럼 · 3과목 9강
                    </h3>
                    <div className="mt-5 space-y-5">
                      {g.subjects.map((s) => (
                        <div key={s.title} className="rounded-2xl ring-1 ring-border/60 overflow-hidden">
                          <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/50 px-5 py-3.5">
                            <p className="font-semibold text-foreground">{s.title}</p>
                            <p className="text-xs text-muted-foreground">{s.meta}</p>
                          </div>
                          <ul className="divide-y divide-border/60">
                            {s.lessons.map((l) => (
                              <li key={l.no} className="flex gap-4 px-5 py-4">
                                <span className="shrink-0 text-sm font-bold text-navy w-9 pt-0.5">{l.no}</span>
                                <div className="min-w-0">
                                  <p className="text-[0.95rem] font-medium text-foreground leading-snug">{l.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{l.desc}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 수강료 + 강사 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl ring-1 ring-border/60 p-6">
                      <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <Receipt className="h-5 w-5 text-navy" aria-hidden="true" />
                        수강료
                      </h3>
                      <ul className="mt-4 space-y-2.5">
                        {g.fees.map((f) => (
                          <li key={f.label} className="flex justify-between text-sm border-b border-border/60 pb-2.5">
                            <span className="text-muted-foreground">{f.label}</span>
                            <span className="font-medium text-foreground">{f.value}</span>
                          </li>
                        ))}
                        <li className="flex items-baseline justify-between pt-1">
                          <span className="font-semibold text-foreground">합계</span>
                          <span className="text-2xl font-bold text-navy">195,000원</span>
                        </li>
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">{g.feeNote}</p>
                      <Button
                        className="mt-5 w-full h-12 rounded-full bg-brand-orange hover:bg-brand-orange/90 text-white text-base font-semibold"
                        onClick={() => handleApply(g.level)}
                        disabled={!courseId}
                      >
                        {isEnrolled ? "수강중 · 이어보기" : `${g.level} 과정 신청하기`}
                      </Button>
                    </div>

                    <div className="rounded-2xl ring-1 ring-border/60 p-6">
                      <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <Users className="h-5 w-5 text-navy" aria-hidden="true" />
                        강사 소개
                      </h3>
                      <ul className="mt-4 space-y-3">
                        {g.instructors.map((i) => (
                          <li key={i.name} className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
                            <GraduationCap className="h-5 w-5 text-navy shrink-0" aria-hidden="true" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{i.name}</p>
                              <p className="text-sm text-muted-foreground">{i.field}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 교재 */}
                  <div className="rounded-2xl bg-muted/40 ring-1 ring-border/60 p-6 sm:p-8">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                      <BookOpen className="h-5 w-5 text-navy" aria-hidden="true" />
                      교재 안내
                    </h3>
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <p className="text-lg font-semibold text-foreground leading-snug">{g.book.title}</p>
                        <p className="mt-2 text-brand-orange font-medium">{g.book.tagline}</p>
                        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{g.book.desc}</p>
                        <p className="mt-4 text-sm">
                          <span className="text-muted-foreground">교재 가격 </span>
                          <strong className="text-foreground">{g.book.price}</strong>
                        </p>
                      </div>
                      <ul className="space-y-2.5">
                        {g.book.toc.map((t) => (
                          <li key={t} className="flex gap-2.5 text-sm text-foreground/80 leading-relaxed">
                            <CheckCircle2 className="h-4 w-4 text-navy shrink-0 mt-0.5" aria-hidden="true" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 하단 CTA */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-brand-blue-light/60 ring-1 ring-navy/10 p-6">
                    <p className="flex items-center gap-2 text-sm text-foreground/80">
                      <CalendarClock className="h-4 w-4 text-navy" aria-hidden="true" />
                      개강일은 매월 1일이며, 신청 즉시 학습을 시작할 수 있습니다.
                    </p>
                    <Button
                      size="lg"
                      className="rounded-full h-12 px-8 bg-navy hover:bg-navy/90 text-white font-semibold"
                      onClick={() => handleApply(g.level)}
                      disabled={!courseId}
                    >
                      {isEnrolled ? "수강중 · 이어보기" : `${g.level} 과정 신청하기`}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </main>

      <SiteFooter />

      <Level1QualificationDialog
        open={level1Open}
        onOpenChange={setLevel1Open}
        onConfirm={() => {
          setLevel1Open(false);
          goToCourse("1급");
        }}
      />
    </div>
  );
};

export default StorefrontCatalog;
