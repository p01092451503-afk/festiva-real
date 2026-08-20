import { Link } from "react-router-dom";
import { ChevronRight, Layers, PlayCircle, BookOpen } from "lucide-react";
import heroPhoto from "@/assets/hero-festival-people.jpg.asset.json";

const HeroBanner = () => {
  return (
    <section className="relative w-full bg-background">
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-14 sm:py-16 md:py-20">
        {/* headline row */}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-start md:gap-12">
          <h2 className="text-3xl font-bold leading-[1.8] tracking-tight text-navy-dark sm:text-4xl md:text-[2.7rem]">
            축제 기획부터 평가까지,
            <br />
            <span className="align-middle">실무로 증명하는 축제운영전문가</span>
          </h2>

          <div className="md:pt-3">
            <p className="text-base leading-relaxed text-navy/70">
              지자체·공공기관 실무자, 행사 기획자, 축제 분야 취업 희망자를 위한
              대한민국 유일의 온라인 축제전문가 자격증 과정입니다.
              2급·1급 단계별 9차시 강의와 교재로 실무 문서 작성까지 완성합니다.
            </p>
            <Link
              to="/store/courses"
              className="mt-6 inline-flex items-center gap-2 border-b-2 border-navy pb-1 text-sm font-semibold tracking-[0.18em] text-navy transition hover:border-brand-orange hover:text-brand-orange"
            >
              VIEW MORE
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* wide rounded visual */}
        <div className="mt-10 overflow-hidden rounded-[2rem] bg-muted sm:mt-12">
          <img
            src={heroPhoto.url}
            alt="축제 현장에서 운영 회의를 하는 축제운영 실무자들"
            className="h-[240px] w-full object-cover sm:h-[340px] md:h-[420px]"
            width={1600}
            height={768}
            fetchPriority="high"
            decoding="async"
          />
        </div>

        {/* actions + facts */}
        <div className="mt-10 flex flex-col gap-8 border-t border-navy/10 pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/store/courses"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-navy px-7 py-3 text-base font-semibold leading-normal text-white transition hover:bg-navy-dark"
            >
              강의 안내 보기
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/student/certificates"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-navy/20 px-7 py-3 text-base font-semibold leading-normal text-navy transition hover:bg-navy/5"
            >
              자격증 신청 및 발급
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/about?tab=system"
              className="inline-flex items-center justify-center rounded-full px-5 py-3 text-base font-medium leading-normal text-navy/70 transition hover:text-navy"
            >
              자격 제도 안내
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {[
              { Icon: Layers, strong: "2급·1급", label: "단계별 과정" },
              { Icon: PlayCircle, strong: "9차시", label: "온라인 강의" },
              { Icon: BookOpen, strong: "교재 포함", label: "195,000원" },
            ].map(({ Icon, strong, label }) => (
              <div key={strong} className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 shrink-0 text-navy/50" strokeWidth={1.5} />
                <span className="text-base text-navy/70">
                  <strong className="font-bold text-navy-dark">{strong}</strong> {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;

