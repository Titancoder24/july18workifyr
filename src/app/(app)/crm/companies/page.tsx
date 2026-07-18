import Link from "next/link";
import { Building2 } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { CompanyCreateSheet } from "./company-create-sheet";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size_band: string | null;
  contact_count: { count: number }[];
};

export default async function CompaniesPage() {
  const ctx = await getContext();
  const { data: companies } = await ctx.supabase
    .from("companies")
    .select("id, name, domain, industry, size_band, contact_count:contacts(count)")
    .order("name", { ascending: true })
    .limit(500);

  return (
    <PageContainer>
      <PageHeader
        title="Companies"
        description={`${companies?.length ?? 0} organization${(companies?.length ?? 0) === 1 ? "" : "s"}`}
        actions={<CompanyCreateSheet />}
      />

      <div className="card overflow-hidden">
        {companies && companies.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>Company</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>Industry</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>Size</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {(companies as Row[]).map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td className="px-4 py-3 text-[13px]">
                    <Link href={`/crm/companies/${c.id}`} className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="md" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        {c.domain && (
                          <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                            {c.domain}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                    {c.industry ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                    {c.size_band ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[13px]">
                    {c.contact_count?.[0]?.count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-16 text-center">
            <div
              className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
              style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
            >
              <Building2 className="size-5" />
            </div>
            <h3 className="text-[15px] font-semibold tracking-tight">No companies yet</h3>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
              Add the organizations you sell to. Contacts and deals attach to them.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
