import Link from "next/link";
import { Search } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";
import { ContactCreateSheet } from "./contact-create-sheet";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string }>;

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  last_activity_at: string | null;
  company: { id: string; name: string } | { id: string; name: string }[] | null;
  owner: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  const ctx = await getContext();

  let qry = ctx.supabase
    .from("contacts")
    .select(`
      id, first_name, last_name, email, phone, position, last_activity_at,
      company:companies(id, name),
      owner:profiles!contacts_owner_id_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    qry = qry.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: contacts } = (await qry) as { data: ContactRow[] | null };
  const { data: companies } = await ctx.supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description={`${contacts?.length ?? 0} contact${(contacts?.length ?? 0) === 1 ? "" : "s"} · ${ctx.organization?.name}`}
        actions={<ContactCreateSheet companies={companies ?? []} />}
      />

      <form className="mb-4" action="/crm/contacts">
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-lg max-w-md"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or email…"
            className="bg-transparent flex-1 text-[13px] outline-none"
          />
          {q && (
            <Link href="/crm/contacts" className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="card overflow-hidden">
        {contacts && contacts.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Company</Th>
                <Th>Position</Th>
                <Th>Owner</Th>
                <Th align="right">Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
                const company = flatten(c.company);
                const owner = flatten(c.owner);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-[var(--color-surface-hover)] transition-colors"
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <Td>
                      <Link href={`/crm/contacts/${c.id}`} className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={fullName} size="md" />
                        <span className="font-medium truncate">{fullName}</span>
                      </Link>
                    </Td>
                    <Td muted>{c.email ?? "—"}</Td>
                    <Td>
                      {company ? (
                        <Link href={`/crm/companies/${company.id}`} className="hover:underline">
                          {company.name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--color-ink-tertiary)" }}>—</span>
                      )}
                    </Td>
                    <Td muted>{c.position ?? "—"}</Td>
                    <Td>
                      {owner ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={owner.full_name} size="sm" />
                          <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                            {owner.full_name ?? "—"}
                          </span>
                        </span>
                      ) : (
                        <Badge tone="neutral">Unassigned</Badge>
                      )}
                    </Td>
                    <Td align="right" muted>
                      {c.last_activity_at ? relativeTime(c.last_activity_at) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyContacts hasFilter={Boolean(q)} />
        )}
      </div>
    </PageContainer>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
      style={{ color: "var(--color-ink-tertiary)", textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)",
      }}
    >
      {children}
    </td>
  );
}

function EmptyContacts({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="px-6 py-16 text-center">
      <div
        className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
        style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
      >
        <Search className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">
        {hasFilter ? "No contacts match that search" : "No contacts yet"}
      </h3>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
        {hasFilter
          ? "Try a different name or email substring, or clear the filter."
          : "Add your first contact and the assistant will start helping you keep track of follow-ups."}
      </p>
    </div>
  );
}
