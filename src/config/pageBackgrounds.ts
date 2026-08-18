import type { PatternConfig } from "@/components/PagePattern";

/**
 * 페이지별 배경·패턴 설정.
 * 여기 값만 바꾸면 해당 페이지 배너/배경 디자인이 즉시 바뀝니다.
 *
 * gradient: tailwind 배경 클래스
 * pattern: "dots" | "grid" | "diagonal" | "wave" | "plain"
 * glow: "none" | "top-right" | "bottom-left"
 */
export const PAGE_BACKGROUNDS = {
  about: {
    gradient: "bg-gradient-to-br from-brand-blue-light via-background to-background",
    pattern: "wave",
    glow: "top-right",
    glowToken: "brand-blue",
  },
  support: {
    // 교육원 소개와 유사한 톤이지만, 형이상학적인 궤도(orbit) 패턴으로 차별화
    gradient: "bg-gradient-to-bl from-brand-blue-light via-background to-background",
    pattern: "orbit",
    glow: "top-right",
    glowToken: "brand-blue",
  },

  courses: {
    gradient: "bg-gradient-to-b from-brand-blue-light/50 to-background",
    pattern: "dots",
    patternOpacity: 0.6,
    patternSize: 18,
    glow: "none",
  },
  verify: {
    gradient: "bg-gradient-to-b from-brand-blue-light via-background to-background",
    pattern: "grid",
    patternOpacity: 0.5,
    patternSize: 40,
    glow: "none",
  },
} satisfies Record<string, PatternConfig>;

export type PageBackgroundKey = keyof typeof PAGE_BACKGROUNDS;

export const pageBg = (key: PageBackgroundKey): PatternConfig => PAGE_BACKGROUNDS[key];
