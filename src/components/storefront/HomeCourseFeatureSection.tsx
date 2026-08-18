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

const FEATURES = [
  { icon: MonitorPlay, label: "온라인 100% 수강", desc: "PC·모바일 어디서나 수강" },
  { icon: FileText, label: "실무 문서 중심", desc: "기획서·운영계획서 직접 작성" },
  { icon: ClipboardCheck, label: "자격 검정 연계", desc: "수강 후 검정 응시·자격 발급" },
  { icon: ShieldCheck, label: "발급 이력 관리", desc: "온라인 자격 진위 확인 지원" },
];

type CourseLite = { id: string; title: string; price: number | null; sale_price: number | null };

/** 강의 썸네일 대신 급수별 과정 특징·커리큘럼을 소개하는 홈 섹션 */
const HomeCourseFeatureSection = ({ courses = [] }: { courses?: CourseLite[] }) => {
  const findCourse = (match: string) => courses.find((c) => c.title?.includes(match));

  return (
    <section className="relative overflow-hidden border-y border-border/80 bg-violet-50 text-foreground">

      <div className="relative max-w-6xl mx-auto px-4 py-16">

        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold tracking-[0.2em] text-brand-orange">CURRICULUM</span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight">
            축제 기획부터 평가까지, 단계별 실무 과정
          </h2>
          <p className="mt-3 text-base sm:text-lg text-primary-foreground/75 leading-relaxed">
            2급에서 기획의 기본기를, 1급에서 운영·안전·평가 실무를 완성합니다.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {LEVEL_SPECS.map((spec) => {
            const course = findCourse(spec.match);
            const price = course?.sale_price ?? course?.price ?? null;
            return (
              <article
                key={spec.level}
                className="rounded-2xl bg-background text-foreground border border-border p-7 flex flex-col"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center rounded-lg bg-navy px-3 py-1.5 text-base font-bold text-primary-foreground">
                    {spec.level}
                  </span>
                  <span className="text-base font-semibold text-brand-blue">{spec.keyword}</span>
                </div>
                <h3 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight">
                  축제운영전문가 {spec.level}
                </h3>
                <p className="mt-2 text-base text-muted-foreground leading-relaxed">{spec.summary}</p>

                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {spec.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-base text-foreground/85 leading-relaxed">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-5 border-t border-border flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">교재 포함 수강료</p>
                    <p className="text-2xl font-bold tracking-tight">
                      {price !== null ? `${price.toLocaleString()}원` : "문의"}
                    </p>
                  </div>
                  <Link
                    to={course ? `/store/courses/${course.id}` : "/store/courses"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-5 py-3 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    과정 보기
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 backdrop-blur-sm p-5 shadow-sm">
              <Icon className="w-5 h-5 text-brand-orange" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold">{label}</p>
              <p className="mt-1 text-sm text-primary-foreground/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomeCourseFeatureSection;
