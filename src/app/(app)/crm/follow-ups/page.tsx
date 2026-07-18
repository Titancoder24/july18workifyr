import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { FollowUpsList, type FollowUp } from "./follow-ups-list";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const ctx = await getContext();

  const { data } = await ctx.supabase
    .from("follow_ups")
    .select("id, title, notes, due_at, reminder_at, completed_at, entity_type, entity_id, created_at")
    .eq("user_id", ctx.profile.id)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(500);

  const items = (data ?? []) as FollowUp[];
  const open = items.filter((i) => !i.completed_at).length;

  return (
    <PageContainer>
      <PageHeader
        title="Follow-ups"
        description={`${open} open follow-up${open !== 1 ? "s" : ""}`}
      />
      <FollowUpsList initial={items} />
    </PageContainer>
  );
}
