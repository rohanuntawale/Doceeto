import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "ghost" | "outline" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-terracotta text-on-accent hover:bg-terracotta-700 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]",
  danger:
    "bg-terracotta text-on-accent hover:bg-terracotta-700 animate-pulse-ring",
  outline:
    "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface)]",
  ghost: "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]",
  subtle: "bg-[var(--surface)] text-[var(--text)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
