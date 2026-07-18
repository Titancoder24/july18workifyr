import { ListChecks } from "lucide-react";
import { getContext } from "@/lib/server/context";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { TaskRow } from "./task-row";
import { TaskCreate } from "./task-create";

export const dynamic = "force-dynamic";

type TaskRowData = {
  id: string;
  title: string;
  due_at: string | null;
  priority: string;
  status: string;
  contact: { id: string; first_name: string | null; last_name: string | null } | { id: string; first_name: string | null; last_name: string | null }[] | null;
  deal: { id: string; title: string } | { id: string; title: string }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  return !v ? null : Array.isArray(v) ? v[0] ?? null : v;
}

export default async function TasksPage() {
  const ctx = await getContext();

  const [tasksRes, contactsRes] = await Promise.all([
    ctx.supabase
      .from("tasks")
      .select(`
        id, title, due_at, priority, status,
        contact:contacts(id, first_name, last_name),
        deal:deals(id, title)
      `)
      .eq("assignee_id", ctx.profile.id)
      .neq("status", "done")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(200),
    ctx.supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true })
      .limit(500),
  ]);

  const all = (tasksRes.data ?? []) as TaskRowData[];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdue = all.filter((t) => t.due_at && new Date(t.due_at) < todayStart);
  const today = all.filter(
    (t) => t.due_at && new Date(t.due_at) >= todayStart && new Date(t.due_at) < todayEnd,
  );
  const upcoming = all.filter(
    (t) => !t.due_at || new Date(t.due_at) >= todayEnd,
  );

  const flat = (t: TaskRowData) => ({
    id: t.id,
    title: t.title,
    due_at: t.due_at,
    priority: t.priority,
    contact: flatten(t.contact),
    deal: flatten(t.deal),
  });

  return (
    <PageContainer>
      <PageHeader
        title="My tasks"
        description={`${all.length} open`}
        actions={<TaskCreate contacts={contactsRes.data ?? []} />}
      />

      {all.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <ListChecks className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">Inbox zero.</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            Nothing on your plate. Capture a follow-up to come back to.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <Group title="Overdue"  emphasis="strong"   tasks={overdue.map(flat)} />
          <Group title="Today"    emphasis="viridian" tasks={today.map(flat)} />
          <Group title="Upcoming" emphasis="neutral"  tasks={upcoming.map(flat)} />
        </div>
      )}
    </PageContainer>
  );
}

function Group({
  title,
  emphasis,
  tasks,
}: {
  title: string;
  emphasis: "strong" | "viridian" | "neutral";
  tasks: Parameters<typeof TaskRow>[0]["task"][];
}) {
  if (tasks.length === 0) return null;
  // Status reads through label weight + ink shade — never hue.
  const accent =
    emphasis === "strong"
      ? { color: "var(--color-ink)", fontWeight: 600 as const }
      : emphasis === "viridian"
      ? { color: "var(--color-viridian-700)" }
      : { color: "var(--color-ink-tertiary)" };
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-[12px] font-medium uppercase tracking-wider" style={accent}>
          {title}
        </h2>
        <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
          {tasks.length}
        </span>
      </div>
      <ul className="card overflow-hidden">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </section>
  );
}
