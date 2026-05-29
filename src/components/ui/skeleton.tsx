import { cn } from "@/lib/utils";

/**
 * Skeleton with shimmer (left-to-right gradient sweep).
 * Uses a moving gradient background — purely CSS, no JS, GPU-friendly.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted animate-shimmer bg-no-repeat",
        "bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--muted-foreground)/0.08)_50%,hsl(var(--muted))_100%)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
