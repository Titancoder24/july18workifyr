"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

const sizeStyles: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12px] gap-1.5",
  md: "h-8 px-3 text-[13px] gap-1.5",
  lg: "h-10 px-4 text-[14px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, iconLeft, iconRight, className, children, disabled, ...rest },
  ref,
) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap";
  const styles: Record<Variant, React.CSSProperties> = {
    primary: { background: "var(--color-viridian-500)", color: "white" },
    secondary: {
      background: "var(--color-surface)",
      color: "var(--color-ink)",
      border: "1px solid var(--color-border)",
    },
    outline: {
      background: "transparent",
      color: "var(--color-ink-secondary)",
      border: "1px solid var(--color-border)",
    },
    ghost: { background: "transparent", color: "var(--color-ink-secondary)" },
    // Destructive actions use a solid black fill — no red. Severity reads through copy + icon.
    danger: { background: "var(--color-ink)", color: "white" },
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, sizeStyles[size], className)}
      style={styles[variant]}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});
