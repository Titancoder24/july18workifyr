import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const sizes = { sm: 24, md: 28, lg: 36, xl: 48 } as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const px = sizes[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        width={px}
        height={px}
        className={cn("rounded-full object-cover", className)}
        style={{ width: px, height: px, border: "1px solid var(--color-border)" }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium",
        size === "sm" && "text-[10px]",
        size === "md" && "text-[11px]",
        size === "lg" && "text-[13px]",
        size === "xl" && "text-[16px]",
        className,
      )}
      style={{
        width: px,
        height: px,
        background: "var(--color-viridian-100)",
        color: "var(--color-viridian-700)",
        border: "1px solid var(--color-border)",
      }}
      aria-label={name ?? ""}
      title={name ?? ""}
    >
      {initials(name)}
    </span>
  );
}
