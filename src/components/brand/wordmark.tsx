import { cn } from "@/lib/cn";

/**
 * The Workifyr wordmark.
 *  - `display` variant uses Instrument Serif italic for marketing surfaces.
 *  - `app` variant uses Inter Semibold for the in-app sidebar.
 *  - Always rendered in viridian — never another color.
 */
export function Wordmark({
  variant = "app",
  className,
}: {
  variant?: "display" | "app";
  className?: string;
}) {
  if (variant === "display") {
    return (
      <span
        className={cn("display text-[28px] leading-none", className)}
        style={{ color: "var(--color-viridian-500)" }}
      >
        Workify<span style={{ fontStyle: "italic" }}>r</span>
      </span>
    );
  }
  return (
    <span
      className={cn("font-semibold tracking-tight text-[18px] inline-flex items-center gap-1.5", className)}
      style={{ color: "var(--color-viridian-500)" }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: "var(--color-viridian-500)" }} />
      Workifyr
    </span>
  );
}
