import { BadgeCheck, Users, FileSpreadsheet } from "lucide-react";

const REASONS = [
  {
    icon: BadgeCheck,
    title: "축제 전문 자격 교육 기관",
    lines: [
      "축제운영전문가 2급·1급 자격 과정을 운영하는",
      "축제 분야 특화 교육원입니다.",
      "수료 후 자격증 발급과 진위 확인까지 지원합니다.",
    ],
  },
  {
    icon: FileSpreadsheet,
    title: "현장 문서 그대로 실습",
    lines: [
      "기획서·예산안·운영계획서·안전관리계획서 등",
      "실제 축제 현장에서 쓰이는 문서 서식으로 학습합니다.",
      "수강 중 작성한 문서를 바로 업무에 활용할 수 있습니다.",
    ],
  },
  {
    icon: Users,
    title: "현직 축제 실무자 강의",
    lines: [
      "지역축제 기획·운영을 담당한 실무자가",
      "인파 관리, 안전, 평가 노하우를 직접 전달합니다.",
      "문의는 평일 09:00~18:00, 24시간 내 답변합니다.",
    ],
  },
];

/** 기관 특징(선택 이유) 홈 섹션 */
const HomeWhySection = () => (
  <section className="bg-background">
    <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
      <div className="relative">
        <span
          className="hidden sm:block absolute -top-10 left-40 w-52 h-52 rounded-full bg-brand-blue-light/60 -z-0"
          aria-hidden="true"
        />
        <div className="relative">
          <span className="text-sm font-semibold text-brand-orange">Why festcert</span>
          <h2 className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.5] text-foreground">
            실무로 증명하는 축제 교육
            <br />
            festcert를 선택하는 세 가지 이유
          </h2>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {REASONS.map(({ icon: Icon, title, lines }) => (
          <div
            key={title}
            className="rounded-3xl bg-background p-8 shadow-[0_18px_50px_-32px_hsl(var(--navy)/0.4)] ring-1 ring-border/60"
          >
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-blue-light/70">
              <Icon className="w-7 h-7 text-navy" aria-hidden="true" />
            </span>
            <h3 className="mt-6 text-lg sm:text-xl font-bold text-foreground leading-snug">{title}</h3>
            <div className="mt-3 space-y-1">
              {lines.map((l) => (
                <p key={l} className="text-base text-muted-foreground leading-relaxed">
                  {l}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HomeWhySection;
