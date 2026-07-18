import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { LeadsKanban, type Lead, type LeadStatus, type LeadSource } from "./kanban";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const ctx = await getContext();

  const [leadsRes, profilesRes] = await Promise.all([
    ctx.supabase
      .from("leads")
      .select(`
        id, first_name, last_name, email, phone, company_name,
        source, status, owner_id, notes, converted_at, created_at,
        owner:profiles!leads_owner_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(500),
    ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true })
      .limit(200),
  ]);

  const flatten = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? v[0] ?? null : v;

  const leads: Lead[] = (leadsRes.data ?? []).map((d: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    company_name: string | null;
    source: string;
    status: string;
    owner_id: string | null;
    notes: string | null;
    converted_at: string | null;
    created_at: string;
    owner: { full_name: string | null } | { full_name: string | null }[] | null;
  }) => {
    const owner = flatten(d.owner);
    return {
      id: d.id,
      first_name: d.first_name,
      last_name: d.last_name,
      email: d.email,
      phone: d.phone,
      company_name: d.company_name,
      source: d.source as LeadSource,
      status: d.status as LeadStatus,
      owner_id: d.owner_id,
      owner_full_name: owner?.full_name ?? null,
      notes: d.notes,
      converted_at: d.converted_at,
      created_at: d.created_at,
    };
  });

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description={`${leads.length} lead${leads.length !== 1 ? "s" : ""} in pipeline`}
      />
      <LeadsKanban
        initialLeads={leads}
        profiles={(profilesRes.data ?? []) as { id: string; full_name: string | null }[]}
      />
    </PageContainer>
  );
}
