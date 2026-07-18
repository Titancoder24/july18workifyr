import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  entity: string;
  entity_id: string | null;
  action: string;
  diff: unknown;
  meta: unknown;
  created_at: string;
  actor: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  return !v ? null : Array.isArray(v) ? v[0] ?? null : v;
}

export default async function AuditPage() {
  const ctx = await getContext();
  if (!ctx.hasAnyRole(["owner", "admin"])) redirect("/dashboard");

  const { data } = await ctx.supabase
    .from("audit_log")
    .select(`
      id, entity, entity_id, action, diff, meta, created_at,
      actor:profiles(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];

  return (
    <PageContainer>
      <PageHeader
        title="Audit log"
        description="Every mutation across the workspace, including AI tool calls."
      />

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {rows.map((r) => {
              const actor = flatten(r.actor);
              const tone =
                r.action === "create" ? "viridian" :
                r.action === "delete" || r.action === "reject" ? "danger" :
                r.action === "approve" ? "success" :
                r.action.startsWith("tool") ? "info" : "neutral";
              return (
                <li key={r.id} className="px-4 py-3 flex items-start gap-3">
                  <Avatar name={actor?.full_name ?? "System"} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">
                        {actor?.full_name ?? "System"}
                      </span>
                      <Badge tone={tone as "viridian" | "danger" | "success" | "info" | "neutral"}>
                        {r.action.replace("_", " ")}
                      </Badge>
                      <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {r.entity}
                        {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {relativeTime(r.created_at)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <ScrollText className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">Quiet so far</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            As your team starts working, every change shows up here.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
