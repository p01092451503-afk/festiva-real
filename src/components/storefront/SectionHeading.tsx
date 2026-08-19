interface SectionHeadingProps {
  /** 헤드라인 위에 붙는 짧은 영문 라벨 (홈 섹션과 동일 톤) */
  label: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  as?: "h2" | "h3";
}

/**
 * 메인 페이지 섹션과 동일한 제목 톤(주황 라벨 + 큰 헤드라인 + 설명)을
 * 서브 페이지에서 재사용하기 위한 공통 컴포넌트.
 */
const SectionHeading = ({
  label,
  title,
  description,
  align = "left",
  as: Tag = "h2",
}: SectionHeadingProps) => (
  <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-3xl"}>
    <span className="text-sm font-semibold text-brand-orange">{label}</span>
    <Tag className="mt-4 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.4] text-foreground">
      {title}
    </Tag>
    {description && (
      <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{description}</p>
    )}
  </div>
);

export default SectionHeading;
