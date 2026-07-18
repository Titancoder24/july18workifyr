import { cn } from "@/lib/cn";

/**
 * Brand discipline: viridian is the only chromatic accent. Status (success,
 * danger, warning, info) is communicated through chip *style* — filled, solid,
 * outlined, or muted — never through hue. Old tone names are accepted as
 * aliases so existing call sites keep working without code changes.
 */
type Tone =
  | "neutral"   // gray fill — default
  | "viridian"  // brand fill — used for "won", "active", "approved"
  | "solid"     // black fill, white text — used for "active emphasis"
  | "outline"   // outlined neutral — used for "draft", "pending"
  // legacy aliases — mapped to viridian/neutral/outline below
  | "success" | "warning" | "danger" | "info" | "violet" | "amber";

const aliasMap: Record<Tone, "neutral" | "viridian" | "solid" | "outline"> = {
  neutral:  "neutral",
  viridian: "viridian",
  solid:    "solid",
  outline:  "outline",
  // status-style legacy names map onto the viridian-only system:
  success:  "viridian",   // positive → brand fill
  warning:  "outline",    // attention needed → outlined
  danger:   "solid",      // serious → solid black
  info:     "neutral",    // informational → muted gray
  violet:   "viridian",
  amber:    "outline",
};

const toneClass: Record<"neutral" | "viridian" | "solid" | "outline", string> = {
  neutral:  "chip",
  viridian: "chip chip-viridian",
  solid:    "chip chip-strong",
  outline:  "chip chip-outline",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  const resolved = aliasMap[tone];
  return (
    <span className={cn(toneClass[resolved], className)}>
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: "currentColor", opacity: 0.7 }}
        />
      )}
      {children}
    </span>
  );
}
