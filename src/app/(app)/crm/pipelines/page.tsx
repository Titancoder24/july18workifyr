import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { PipelineKanban, type Deal, type Stage, type Pipeline } from "./kanban";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ pipeline?: string }>;

export default async function PipelinesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await getContext();
  const { pipeline: pipelineParam } = await searchParams;

  const { data: pipelines } = await ctx.supabase
    .from("pipelines")
    .select("id, name, is_default")
    .eq("archived", false)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  const activePipeline = pipelineParam
    ? pipelines?.find((p) => p.id === pipelineParam) ?? pipelines?.[0]
    : pipelines?.[0];

  if (!activePipeline) {
    return (
      <PageContainer>
        <PageHeader title="Pipelines" />
        <div className="card p-10 text-center text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
          No pipelines configured. Create one to get started.
        </div>
      </PageContainer>
    );
  }

  const [stagesRes, dealsRes, contactsRes, profilesRes, companiesRes] = await Promise.all([
    ctx.supabase
      .from("pipeline_stages")
      .select("id, name, probability, position, is_won, is_lost, stale_after_days")
      .eq("pipeline_id", activePipeline.id)
      .order("position", { ascending: true }),
    ctx.supabase
      .from("deals")
      .select(`
        id, title, value, currency, stage_id, status,
        expected_close_date, stage_entered_at, created_at,
        tags, contact_id, company_id, owner_id,
        owner:profiles!deals_owner_id_fkey(full_name),
        contact:contacts(first_name, last_name),
        company:companies!deals_company_id_fkey(name)
      `)
      .eq("pipeline_id", activePipeline.id)
      .neq("status", "lost")
      .order("created_at", { ascending: false })
      .limit(500),
    ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true })
      .limit(500),
    ctx.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("org_id", ctx.orgId)
      .order("full_name", { ascending: true })
      .limit(200),
    ctx.supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(500),
  ]);

  const flatten = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? v[0] ?? null : v;

  const deals: Deal[] = (dealsRes.data ?? []).map((d: {
    id: string; title: string; value: number | string; currency: string; stage_id: string; status: string;
    expected_close_date: string | null; stage_entered_at: string | null; created_at: string | null;
    tags: string[] | null; contact_id: string | null; company_id: string | null; owner_id: string | null;
    owner: { full_name: string | null } | { full_name: string | null }[] | null;
    contact: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
    company: { name: string | null } | { name: string | null }[] | null;
  }) => {
    const owner = flatten(d.owner);
    const contact = flatten(d.contact);
    const company = flatten(d.company);
    return {
      id: d.id,
      title: d.title,
      value: d.value,
      currency: d.currency,
      stage_id: d.stage_id,
      status: d.status,
      owner_full_name: owner?.full_name ?? null,
      contact_name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || null : null,
      expected_close_date: d.expected_close_date,
      company_name: company?.name ?? null,
      stage_entered_at: d.stage_entered_at,
      created_at: d.created_at,
      tags: d.tags,
      notes: null,
      contact_id: d.contact_id,
      company_id: d.company_id,
      owner_id: d.owner_id,
    };
  });

  const pipelineList: Pipeline[] = (pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    is_default: p.is_default,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Pipelines"
        description={`${activePipeline.name} · ${deals.length} open`}
      />

      <PipelineKanban
        pipelineId={activePipeline.id}
        activePipelineId={activePipeline.id}
        stages={(stagesRes.data ?? []) as Stage[]}
        initialDeals={deals}
        contacts={contactsRes.data ?? []}
        pipelines={pipelineList}
        profiles={(profilesRes.data ?? []).map((p: { id: string; full_name: string | null }) => ({
          id: p.id,
          full_name: p.full_name,
        }))}
        companies={(companiesRes.data ?? []).map((c: { id: string; name: string | null }) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </PageContainer>
  );
}
