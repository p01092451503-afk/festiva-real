import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/**
 * 페이지별 배경/패턴을 한 곳에서 관리하는 재사용 컴포넌트.
 *
 * 사용법(가장 간단):
 *   <PageBanner preset="about" eyebrow="ABOUT" title="교육원 소개" description="..." />
 *
 * 배경만 필요할 때:
 *   <div className="relative"><PagePattern preset="verify" /> ...내용... </div>
 *
 * 새 페이지 배경을 추가/변경하려면 src/config/pageBackgrounds.ts 만 수정하세요.
 */

/** 패턴 종류 (톤은 --brand-blue / --brand-orange 토큰 기반) */
export type PatternKind = "dots" | "grid" | "diagonal" | "wave" | "orbit" | "plain";

export type PatternConfig = {
  /** 섹션 배경 그라디언트 (tailwind 클래스) */
  gradient: string;
  /** 패턴 종류 */
  pattern: PatternKind;
  /** 패턴 불투명도 (0~1) */
  patternOpacity?: number;
  /** 패턴 셀 크기(px) — dots/grid/diagonal 에 적용 */
  patternSize?: number;
  /** 은은한 글로우 위치. none 이면 표시 안 함 */
  glow?: "none" | "top-right" | "bottom-left";
  /** 글로우 색상 토큰 이름 */
  glowToken?: "brand-orange" | "brand-blue";
};

const patternStyle = (config: PatternConfig): CSSProperties | undefined => {
  const size = config.patternSize ?? 18;
  const line = "hsl(var(--brand-blue) / 0.12)";
  switch (config.pattern) {
    case "dots":
      return {
        backgroundImage: `radial-gradient(${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      };
    case "grid":
      return {
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
      };
    case "diagonal":
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${line} 0px, ${line} 2px, transparent 2px, transparent ${size}px)`,
      };
    default:
      return undefined;
  }
};

const glowStyle = (token: PatternConfig["glowToken"] = "brand-orange"): CSSProperties => ({
  background: `radial-gradient(circle, hsl(var(--${token}) / 0.13) 0%, transparent 70%)`,
});

export function PagePattern({ config, className }: { config: PatternConfig; className?: string }) {
  const style = patternStyle(config);
  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)} aria-hidden="true">
      {style && (
        <div className="absolute inset-0" style={{ ...style, opacity: config.patternOpacity ?? 0.5 }} />
      )}

      {config.pattern === "orbit" && (
        <svg
          className="absolute inset-0 w-full h-full text-brand-blue/25"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
        >
          <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55">
            <ellipse cx="1180" cy="120" rx="300" ry="150" />
            <ellipse cx="1180" cy="120" rx="220" ry="110" />
            <ellipse cx="1180" cy="120" rx="140" ry="70" />
            <ellipse cx="1180" cy="120" rx="64" ry="32" />
          </g>
          <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4">
            <path d="M-40 210 C260 120 520 250 820 160 C1060 90 1240 190 1500 120" />
            <path d="M-40 238 C260 150 520 278 820 190 C1060 120 1240 218 1500 150" />
          </g>
          <g fill="currentColor" opacity="0.5">
            <circle cx="1180" cy="120" r="4" />
            <circle cx="1400" cy="120" r="3" />
            <circle cx="1040" cy="70" r="2.5" />
            <circle cx="300" cy="60" r="2.5" />
            <circle cx="520" cy="96" r="2" />
          </g>
        </svg>
      )}

      {config.pattern === "wave" && (
        <svg
          className="absolute bottom-0 left-0 w-full h-24 text-brand-blue/15"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
        >
          <path d="M0 60 C240 120 480 0 720 40 C960 80 1200 20 1440 60 L1440 120 L0 120 Z" fill="currentColor" />
        </svg>
      )}

      {config.glow && config.glow !== "none" && (
        <div
          className={cn(
            "absolute w-72 h-72 rounded-full",
            config.glow === "top-right" ? "-right-24 -top-24" : "-left-16 -bottom-20",
          )}
          style={glowStyle(config.glowToken)}
        />
      )}
    </div>
  );
}

/** 서브페이지 공통 배너 (배경 + 패턴 + 제목 영역) */
export function PageBanner({
  config,
  eyebrow,
  title,
  description,
  as = "h1",
  size = "md",
  containerClassName,
  children,
}: {
  config: PatternConfig;
  eyebrow?: string;
  title: string;
  description?: string;
  as?: "h1" | "h2";
  size?: "sm" | "md" | "lg";
  containerClassName?: string;
  children?: ReactNode;
}) {
  const Heading = as;
  const pad = size === "lg" ? "py-16 sm:py-20" : size === "sm" ? "py-10 sm:py-12" : "py-14 sm:py-16";
  const titleSize =
    size === "lg" ? "text-3xl sm:text-5xl" : size === "sm" ? "text-xl sm:text-3xl" : "text-2xl sm:text-4xl";

  return (
    <section className={cn("relative overflow-hidden border-b border-border", config.gradient)}>
      <PagePattern config={config} />
      <div className={cn("relative max-w-6xl mx-auto px-4 space-y-3 min-w-0", pad, containerClassName)}>
        {eyebrow && (
          <p className="text-sm font-semibold tracking-[0.18em] uppercase text-brand-orange">{eyebrow}</p>
        )}
        <Heading className={cn("font-bold leading-tight text-navy", titleSize)}>{title}</Heading>
        {description && (
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">{description}</p>
        )}
        {children}
      </div>
    </section>
  );
}
