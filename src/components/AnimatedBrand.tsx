import { memo } from "react";

interface AnimatedBrandProps {
  text?: string;
  className?: string;
}

/**
 * Letter-by-letter fade-in WEBHEADS. brand mark.
 * Matches the italic-bold logo style used in the sidebar.
 */
const AnimatedBrand = memo(({ text = "WEBHEADS.", className = "" }: AnimatedBrandProps) => {
  return (
    <span
      aria-label={text}
      className={`inline-flex italic font-bold tracking-tight text-sidebar-foreground ${className}`}
    >
      {text}
    </span>
  );
});

AnimatedBrand.displayName = "AnimatedBrand";
export default AnimatedBrand;
