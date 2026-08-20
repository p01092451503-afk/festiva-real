interface PageTitleHeaderProps {
  title: string;
  description?: string;
}

/** 상단 배너 대신 사용하는 미니멀 페이지 타이틀 (좌측 네이비 바 + 부제) */
const PageTitleHeader = ({ title, description }: PageTitleHeaderProps) => (
  <div className="border-b border-border/60 bg-background">
    <div className="max-w-6xl mx-auto px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
      <div className="flex items-center gap-3">
        <span className="h-8 sm:h-9 w-[4px] rounded-full bg-navy" aria-hidden="true" />
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">{title}</h1>
      </div>
      {description && (
        <p className="mt-3 text-sm sm:text-base text-muted-foreground">{description}</p>
      )}
    </div>
  </div>
);

export default PageTitleHeader;
