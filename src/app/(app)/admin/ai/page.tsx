import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Usage = {
  id: number;
  module: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number | string;
  request_at: string;
  user: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  return !v ? null : Array.isArray(v) ? v[0] ?? null : v;
}

export default async function AIUsagePage() {
  const ctx = await getContext();
  if (!ctx.hasAnyRole(["owner", "admin"])) redirect("/dashboard");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [recentRes, monthRes] = await Promise.all([
    ctx.supabase
      .from("ai_usage")
      .select(`
        id, module, model, tokens_in, tokens_out, cost_usd, request_at,
        user:profiles(id, full_name)
      `)
      .order("request_at", { ascending: false })
      .limit(50),
    ctx.supabase
      .from("ai_usage")
      .select("module, tokens_in, tokens_out, cost_usd, user_id")
      .gte("request_at", monthStart.toISOString()),
  ]);

  const recent = (recentRes.data ?? []) as Usage[];
  const monthRows = (monthRes.data ?? []) as Array<{
    module: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number | string;
    user_id: string;
  }>;

  const totalIn = monthRows.reduce((acc, r) => acc + Number(r.tokens_in ?? 0), 0);
  const totalOut = monthRows.reduce((acc, r) => acc + Number(r.tokens_out ?? 0), 0);
  const totalCost = monthRows.reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0);
  const requests = monthRows.length;

  const byUser = new Map<string, number>();
  for (const r of monthRows) {
    const k = String(r.user_id);
    byUser.set(k, (byUser.get(k) ?? 0) + Number(r.cost_usd ?? 0));
  }
  const topUsers = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <PageContainer>
      <PageHeader
        title="AI usage"
        description="Token consumption, cost, and per-user breakdown for the current month."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label="Requests this month" value={String(requests)} />
        <Tile label="Input tokens" value={totalIn.toLocaleString("en-IN")} />
        <Tile label="Output tokens" value={totalOut.toLocaleString("en-IN")} />
        <Tile label="Cost (est)" value={formatCurrency(totalCost, "USD")} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-4">
          <h3 className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-ink-tertiary)" }}>
            Top users this month
          </h3>
          {topUsers.length > 0 ? (
            <ul className="space-y-2">
              {topUsers.map(([userId, cost]) => {
                const user = recent.find((r) => {
                  const u = flatten(r.user);
                  return u?.id === userId;
                });
                const name = flatten(user?.user)?.full_name ?? "Member";
                return (
                  <li key={userId} className="flex items-center gap-2.5">
                    <Avatar name={name} size="sm" />
                    <span className="text-[13px] flex-1 truncate">{name}</span>
                    <span className="text-[12px]" style={{ color: "var(--color-viridian-700)" }}>
                      {formatCurrency(cost, "USD")}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
              No AI activity yet this month.
            </p>
          )}
        </section>

        <section className="card p-4">
          <h3 className="text-[12px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--color-ink-tertiary)" }}>
            Recent requests
          </h3>
          {recent.length > 0 ? (
            <ul className="space-y-2 max-h-[300px] overflow-y-auto">
              {recent.slice(0, 20).map((r) => {
                const u = flatten(r.user);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <Sparkles className="size-3" style={{ color: "var(--color-viridian-500)" }} />
                      <span className="truncate">{u?.full_name ?? "Member"}</span>
                      <span style={{ color: "var(--color-ink-tertiary)" }}>· {r.module}</span>
                    </span>
                    <span className="shrink-0" style={{ color: "var(--color-ink-tertiary)" }}>
                      {(r.tokens_in + r.tokens_out).toLocaleString("en-IN")} · {relativeTime(r.request_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
              No recent AI requests.
            </p>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>{label}</div>
      <div className="mt-2 text-[22px] font-semibold tracking-tight">{value}</div>
    </div>
  );
}
