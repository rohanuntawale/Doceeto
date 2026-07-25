import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Monochrome frosted glass card (adapted from the 21st.dev glass-card pattern).
 * A translucent panel with a top sheen, hairline highlight and soft depth —
 * used for hero / feature panels across the dashboards. Regular content cards
 * use the lighter `.fh-card`.
 */
const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("glass-card overflow-hidden rounded-3xl", className)}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
});
GlassCard.displayName = "GlassCard";

export { GlassCard };
