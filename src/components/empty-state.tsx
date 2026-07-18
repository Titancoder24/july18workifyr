import { Sparkles } from "lucide-react";

export function ComingSoon({
  title,
  body,
  module = "crm",
}: {
  title: string;
  body?: string;
  module?: "crm" | "hrm" | "admin";
}) {
  return (
    <div className="px-6 lg:px-8 py-12 max-w-[1080px] mx-auto">
      <div className="card p-10 text-center">
        <div className="icon-tile size-11 mx-auto mb-4">
          <Sparkles className="size-5" />
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] max-w-md mx-auto" style={{ color: "var(--color-ink-secondary)" }}>
          {body ??
            "This screen is wired into the schema. UI lands in a follow-up — open the Assistant in the meantime; it can already answer questions about your data."}
        </p>
        <p className="mt-3 chip mx-auto inline-flex">{module.toUpperCase()}</p>
      </div>
    </div>
  );
}
