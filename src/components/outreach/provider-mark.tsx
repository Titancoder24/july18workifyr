export function ProviderMark({ provider }: { provider: "gmail" | "outlook" }) {
  const label = provider === "gmail" ? "Gmail" : "Outlook";
  return (
    <span
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold"
      style={{
        background: "var(--color-surface)",
        color: "var(--color-ink)",
        border: "1px solid var(--color-border)",
      }}
    >
      {provider === "gmail" ? "G" : "O"}
    </span>
  );
}
