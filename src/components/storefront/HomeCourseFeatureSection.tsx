import { Link } from "react-router-dom";
import { ArrowRight, FileText, MonitorPlay, ShieldCheck, ClipboardCheck } from "lucide-react";

/** 급수별 과정 특징 카드용 정적 스펙 (썸네일 대신 커리큘럼 요약을 노출) */
const LEVEL_SPECS = [
  {
    level: "2급",
    keyword: "축제 기획 입문",
    match: "2급",
    summary: "축제의 개념과 기획 절차를 익히고 기본 기획서를 직접 완성하는 입문 과정입니다.",
    points: [
      "축제 산업 이해 · 기획 프로세스 9차시",
      "기획서 · 예산안 기본 서식 작성 실습",
      "온라인 100% 수강 후 자격 검정 응시",
    ],
  },
  {
    level: "1급",
    keyword: "운영·안전 실무",
    match: "1급",
    summary: "현장 운영계획과 안전관리계획, 평가보고서까지 실무 문서 전 과정을 다루는 심화 과정입니다.",
    points: [
      "운영·안전·평가 심화 9차시",
      "안전관리계획서 · 평가보고서 작성 실습",
      "2급 취득자 또는 관련 실무 경력자 대상",
    ],
  },
];

const STEPS = [
  { step: "STEP 01", title: "축제 기획 기초", icon: FileText, desc: "개념·유형·기획 프로세스 이해" },
  { step: "STEP 02", title: "실무 문서 작성", icon: ClipboardCheck, desc: "기획서·예산안 직접 작성" },
  { step: "STEP 03", title: "운영 · 안전 실무", icon: MonitorPlay, desc: "운영계획·안전관리계획 심화" },
  { step: "STEP 04", title: "자격 검정 · 발급", icon: ShieldCheck, desc: "검정 응시 후 자격증 발급" },
];

type CourseLite = { id: string; title: string; price: number | null; sale_price: number | null };

/** 강의 썸네일 대신 급수별 과정 특징·커리큘럼을 소개하는 홈 섹션 */
const HomeCourseFeatureSection = ({ courses = [] }: { courses?: CourseLite[] }) => {
  const findCourse = (match: string) => courses.find((c) => c.title?.includes(match));

  return (
    <section className="bg-background text-foreground">
      {/* 제목 + STEP 카드를 하나의 옅은 그라데이션 밴드 안에 배치 */}
      <div className="bg-gradient-to-b from-brand-blue-light/50 via-brand-blue-light/25 to-background">
        <div className="max-w-6xl mx-auto px-4 pt-20 pb-14 sm:pt-24 sm:pb-16">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-sm font-semibold text-brand-orange">Curriculum</span>
            <h2 className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.5] text-foreground">
              체계적인 4단계 학습 시스템
              <br />
              기획부터 자격 발급까지 완성하는 커리큘럼
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-3 lg:items-stretch">
            {STEPS.map(({ step, title, icon: Icon, desc }, idx) => (
              <div key={step} className="relative flex items-stretch">
                <div className="flex-1 rounded-2xl bg-background p-7 text-center shadow-[0_10px_30px_-18px_hsl(var(--navy)/0.35)]">
                  <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">{step}</p>
                  <p className="mt-3 text-lg font-bold text-foreground">{title}</p>
                  <span className="mt-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-blue-light/70">
                    <Icon className="w-7 h-7 text-navy" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-navy"
                    aria-hidden="true"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 급수별 과정 카드 */}
      <div className="max-w-6xl mx-auto px-4 pb-20 sm:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {LEVEL_SPECS.map((spec) => {
            const course = findCourse(spec.match);
            const price = course?.sale_price ?? course?.price ?? null;
            return (
              <article
                key={spec.level}
                className="rounded-3xl bg-background p-8 flex flex-col shadow-[0_18px_50px_-30px_hsl(var(--navy)/0.4)] ring-1 ring-border/60"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center rounded-full bg-navy px-4 py-1.5 text-sm font-bold text-primary-foreground">
                    {spec.level}
                  </span>
                  <span className="text-base font-semibold text-brand-blue">{spec.keyword}</span>
                </div>
                <h3 className="mt-5 text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                  축제운영전문가 {spec.level}
                </h3>
                <p className="mt-3 text-base text-muted-foreground leading-relaxed">{spec.summary}</p>

                <ul className="mt-6 space-y-3 border-t border-border/70 pt-6">
                  {spec.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-base text-foreground/85 leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">교재 포함 수강료</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {price !== null ? `${price.toLocaleString()}원` : "문의"}
                    </p>
                  </div>
                  <Link
                    to={course ? `/store/courses/${course.id}` : "/store/courses"}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-6 py-3 text-base font-semibold leading-normal text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    과정 보기
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HomeCourseFeatureSection;
