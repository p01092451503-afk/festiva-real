import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";

/** 홈페이지 하단: 과정 선택 안내 CTA 배너 */
const HomeCourseGuideCta = () => (
  <section className="bg-slate-50 border-y border-border/60">
    <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-2xl bg-white border border-border p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="hidden sm:inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-blue-light shrink-0">
            <Compass className="w-6 h-6 text-navy" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              어떤 과정부터 시작해야 할지 모르겠다면?
            </h2>
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              급수별 과정 구성과 수강 대상을 확인해 보세요.
            </p>
          </div>
        </div>
        <Link
          to="/store/courses"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-6 py-3 text-sm sm:text-base font-semibold text-white transition-opacity hover:opacity-90 shrink-0"
        >
          강의 안내 보기
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  </section>
);

export default HomeCourseGuideCta;
