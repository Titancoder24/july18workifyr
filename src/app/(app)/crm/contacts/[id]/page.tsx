import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, Phone, Building2 } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, relativeTime, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ContactDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const ctx = await getContext();

  const { data: contact } = await ctx.supabase
    .from("contacts")
    .select(`
      id, first_name, last_name, email, phone, position, address, notes, created_at, last_activity_at,
      company:companies(id, name, industry),
      owner:profiles!contacts_owner_id_fkey(id, full_name)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  const [activities, deals, tasks, recentList] = await Promise.all([
    ctx.supabase
      .from("activities")
      .select("id, type, subject, body, occurred_at")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(20),
    ctx.supabase
      .from("deals")
      .select("id, title, value, currency, status, stage:pipeline_stages(name)")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("contact_id", id)
      .neq("status", "done")
      .order("due_at", { ascending: true })
      .limit(20),
    ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name, email")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "—";
  const company = flatten(contact.company);
  const owner = flatten(contact.owner);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left rail — keeps list context visible while drilled in. */}
      <aside
        className="hidden lg:flex w-[300px] shrink-0 flex-col border-r"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div
          className="px-4 h-12 flex items-center justify-between border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Link
            href="/crm/contacts"
            className="inline-flex items-center gap-1 text-[12px]"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            <ChevronLeft className="size-3.5" />
            All contacts
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(recentList.data ?? []).map((c: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => {
            const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
            const active = c.id === id;
            return (
              <Link
                key={c.id}
                href={`/crm/contacts/${c.id}`}
                className="flex items-center gap-2.5 px-4 py-2.5 transition-colors"
                style={
                  active
                    ? { background: "var(--color-viridian-100)" }
                    : { borderBottom: "1px solid var(--color-border)" }
                }
              >
                <Avatar name={name} size="sm" />
                <div className="min-w-0">
                  <div
                    className="text-[13px] truncate"
                    style={{ color: active ? "var(--color-viridian-700)" : "var(--color-ink)", fontWeight: active ? 500 : 400 }}
                  >
                    {name}
                  </div>
                  {c.email && (
                    <div className="text-[11px] truncate" style={{ color: "var(--color-ink-tertiary)" }}>
                      {c.email}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Center — the record. */}
      <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8">
        <div className="max-w-[720px]">
          <div className="flex items-start gap-4 mb-6">
            <Avatar name={fullName} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-semibold tracking-tight">{fullName}</h1>
              {contact.position && (
                <div className="text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {contact.position}
                  {company && (
                    <>
                      {" at "}
                      <Link href={`/crm/companies/${company.id}`} className="hover:underline">
                        {company.name}
                      </Link>
                    </>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                {contact.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {contact.email}
                  </span>
                )}
                {contact.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {contact.phone}
                  </span>
                )}
                {company && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-3.5" /> {company.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {contact.notes && (
            <section className="card p-4 mb-5">
              <h3 className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-ink-tertiary)" }}>
                Notes
              </h3>
              <p className="text-[13px] whitespace-pre-wrap">{contact.notes}</p>
            </section>
          )}

          <section className="mb-6">
            <h3 className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-ink-tertiary)" }}>
              Deals · {deals.data?.length ?? 0}
            </h3>
            {deals.data && deals.data.length > 0 ? (
              <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
                {deals.data.map((d: { id: string; title: string; value: number | string; currency: string; status: string; stage: { name: string } | { name: string }[] | null }) => {
                  const stage = flatten(d.stage);
                  return (
                    <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{d.title}</div>
                        <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                          {stage?.name ?? "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[13px]">{formatCurrency(d.value, d.currency)}</span>
                        <Badge tone={d.status === "won" ? "viridian" : d.status === "lost" ? "danger" : "neutral"}>
                          {d.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
                No deals attached yet.
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-ink-tertiary)" }}>
              Activity
            </h3>
            {activities.data && activities.data.length > 0 ? (
              <ul className="space-y-3">
                {activities.data.map((a: { id: string; type: string; subject: string | null; body: string | null; occurred_at: string }) => (
                  <li key={a.id} className="flex gap-3">
                    <span
                      className="size-2 rounded-full mt-2 shrink-0"
                      style={{ background: "var(--color-viridian-500)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] uppercase tracking-wider" style={{ color: "var(--color-viridian-700)" }}>
                          {a.type}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                          {relativeTime(a.occurred_at)}
                        </span>
                      </div>
                      {a.subject && <div className="text-[13px] font-medium">{a.subject}</div>}
                      {a.body && (
                        <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--color-ink-secondary)" }}>
                          {a.body}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
                No activity logged yet.
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Right rail — meta. */}
      <aside
        className="hidden xl:flex w-[320px] shrink-0 flex-col border-l overflow-y-auto"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="p-5 space-y-5">
          <Meta label="Owner">
            {owner ? (
              <div className="flex items-center gap-2">
                <Avatar name={owner.full_name} size="sm" />
                <span className="text-[13px]">{owner.full_name ?? "—"}</span>
              </div>
            ) : (
              <Badge tone="neutral">Unassigned</Badge>
            )}
          </Meta>
          <Meta label="Created">{formatDate(contact.created_at)}</Meta>
          <Meta label="Last activity">
            {contact.last_activity_at ? relativeTime(contact.last_activity_at) : "—"}
          </Meta>
          <Meta label="Open tasks">
            {tasks.data && tasks.data.length > 0 ? (
              <ul className="space-y-1.5">
                {tasks.data.map((t: { id: string; title: string; due_at: string | null }) => (
                  <li key={t.id} className="text-[13px] flex items-center justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span className="text-[11px] shrink-0" style={{ color: "var(--color-ink-tertiary)" }}>
                      {t.due_at ? formatDate(t.due_at) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>None</span>
            )}
          </Meta>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[11px] font-medium uppercase tracking-wider mb-1.5"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        {label}
      </div>
      <div className="text-[13px]">{children}</div>
    </div>
  );
}
