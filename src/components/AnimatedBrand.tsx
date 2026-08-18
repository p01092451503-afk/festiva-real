import { memo } from "react";

interface AnimatedBrandProps {
  /** Optional plain-text override. When omitted the festcert wordmark is rendered. */
  text?: string;
  className?: string;
}

/**
 * festcert wordmark — "fest" in navy, "cert" in brand orange.
 * Site name: 축제운영전문가 자격증 교육원
 */
const AnimatedBrand = memo(({ text, className = "" }: AnimatedBrandProps) => {
  if (text) {
    return (
      <span
        aria-label={text}
        className={`inline-flex font-bold tracking-tight text-sidebar-foreground ${className}`}
      >
        {text}
      </span>
    );
  }

  return (
    <span
      aria-label="festcert"
      className={`inline-flex font-bold tracking-tight ${className}`}
    >
      <span className="text-navy">fest</span>
      <span className="text-brand-orange">cert</span>
    </span>
  );
});

AnimatedBrand.displayName = "AnimatedBrand";
export default AnimatedBrand;
