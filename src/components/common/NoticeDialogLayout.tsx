import { ReactNode } from "react";

interface NoticeDialogLayoutProps {
  title?: string | null;
  meta?: ReactNode;
  badge?: ReactNode;
  content?: string | null;
  children?: ReactNode;
}

/**
 * 공지사항·게시판 상세 팝업 공통 레이아웃
 * 상단 네이비 헤더 + 넉넉한 본문 여백의 시원한 구성
 */
export const NoticeDialogLayout = ({ title, meta, badge, content, children }: NoticeDialogLayoutProps) => {
  return (
    <div className="-m-6">
      <div className="relative overflow-hidden bg-primary px-7 pt-8 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-primary-foreground/10"
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
        >
          <path d="M0 40 C80 10 160 60 240 32 C300 12 360 44 400 24 V60 H0 Z" fill="currentColor" />
        </svg>
        <div className="relative space-y-3">
          {badge}
          <h2 className="text-xl font-semibold leading-snug text-primary-foreground sm:text-2xl sm:leading-snug">
            {title}
          </h2>
          {meta && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/75 sm:text-sm">
              {meta}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 px-7 py-8 sm:px-10 sm:py-10">
        {content && (
          <div className="whitespace-pre-wrap text-[15px] leading-[1.9] text-foreground sm:text-base sm:leading-[2]">
            {content}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
