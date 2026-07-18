"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CalendarClock, ExternalLink, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { completeFollowUp, uncompleteFollowUp } from "./actions";

export type FollowUp = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  entity_type: "lead" | "deal" | "contact" | "task" | string;
  entity_id: string | null;
  created_at: string;
};

type Filter = "today" | "week" | "overdue" | "all" | "completed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
];

function entityLink(t: string, id: string | null): string | null {
  if (!id) return null;
  switch (t) {
    case "lead": return `/crm/leads`;
    case "deal": return `/crm/pipelines`;
    case "contact": return `/crm/contacts/${id}`;
    case "task": return `/crm/tasks`;
    default: return null;
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function FollowUpsList({ initial }: { initial: FollowUp[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("today");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const filtered = initial.filter((f) => {
      const due = f.due_at ? new Date(f.due_at) : null;
      switch (filter) {
        case "today":
          return !f.completed_at && due && due >= today && due < tomorrow;
        case "week":
          return !f.completed_at && due && due >= today && due < weekEnd;
        case "overdue":
          return !f.completed_at && due && due < today;
        case "completed":
          return !!f.completed_at;
        case "all":
        default:
          return true;
      }
    });

    const byKey = new Map<string, { label: string; sortKey: number; items: FollowUp[] }>();
    for (const f of filtered) {
      const due = f.due_at ? new Date(f.due_at) : null;
      let label: string;
      let sortKey: number;
      if (!due) {
        label = "No due date";
        sortKey = Number.MAX_SAFE_INTEGER;
      } else {
        const d = startOfDay(due);
        if (d < today) {
          label = "Overdue";
          sortKey = -1;
        } else if (d.getTime() === today.getTime()) {
          label = "Today";
          sortKey = 0;
        } else if (d.getTime() === tomorrow.getTime()) {
          label = "Tomorrow";
          sortKey = 1;
        } else {
          label = formatDate(d, { weekday: "long", month: "short", day: "numeric" });
          sortKey = d.getTime();
        }
      }
      const existing = byKey.get(label);
      if (existing) existing.items.push(f);
      else byKey.set(label, { label, sortKey, items: [f] });
    }

    return Array.from(byKey.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [initial, filter]);

  function handleComplete(id: string, currentlyCompleted: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = currentlyCompleted ? await uncompleteFollowUp(id) : await completeFollowUp(id);
      setBusyId(null);
      if (!res.ok) {
        toast.error(res.error ?? "Could not update follow-up");
      } else {
        toast.success(currentlyCompleted ? "Reopened" : "Marked complete");
        router.refresh();
      }
    });
  }

  const counts = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    let todayN = 0, weekN = 0, overdueN = 0, completedN = 0;
    for (const f of initial) {
      const due = f.due_at ? new Date(f.due_at) : null;
      if (f.completed_at) { completedN++; continue; }
      if (due && due < today) overdueN++;
      if (due && due >= today && due < tomorrow) todayN++;
      if (due && due >= today && due < weekEnd) weekN++;
    }
    return { today: todayN, week: weekN, overdue: overdueN, completed: completedN, all: initial.length };
  }, [initial]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "today" ? counts.today :
            f.key === "week" ? counts.week :
            f.key === "overdue" ? counts.overdue :
            f.key === "completed" ? counts.completed :
            counts.all;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 12,
                fontWeight: 550,
                padding: "5px 11px",
                borderRadius: 999,
                border: "1px solid",
                borderColor: active ? "transparent" : "var(--color-border)",
                background: active ? "var(--color-viridian-100)" : "var(--color-surface)",
                color: active ? "var(--color-viridian-700)" : "var(--color-ink-secondary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{f.label}</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: active ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <Inbox className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">Nothing here.</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            No follow-ups in this view.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map((g) => (
            <section key={g.label}>
              <div className="flex items-baseline gap-2 mb-2">
                <h2
                  className="text-[12px] font-medium uppercase tracking-wider"
                  style={{
                    color:
                      g.label === "Overdue"
                        ? "var(--color-ink)"
                        : g.label === "Today"
                        ? "var(--color-viridian-700)"
                        : "var(--color-ink-tertiary)",
                    fontWeight: g.label === "Overdue" ? 600 : 500,
                  }}
                >
                  {g.label}
                </h2>
                <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                  {g.items.length}
                </span>
              </div>
              <ul className="card overflow-hidden">
                {g.items.map((f, idx) => {
                  const isLast = idx === g.items.length - 1;
                  const link = entityLink(f.entity_type, f.entity_id);
                  const completed = !!f.completed_at;
                  return (
                    <li
                      key={f.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors"
                      style={{ borderBottom: isLast ? "none" : "1px solid var(--color-border)" }}
                    >
                      <button
                        type="button"
                        onClick={() => handleComplete(f.id, completed)}
                        aria-label={completed ? "Reopen" : "Mark complete"}
                        disabled={pending && busyId === f.id}
                        className="mt-0.5 size-5 rounded-md border inline-flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: completed ? "var(--color-viridian-500)" : "var(--color-border-strong)",
                          background: completed ? "var(--color-viridian-500)" : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <Check
                          className="size-3 transition-opacity"
                          style={{ color: "white", opacity: completed ? 1 : 0 }}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-[13px] font-medium"
                          style={{
                            textDecoration: completed ? "line-through" : "none",
                            color: completed ? "var(--color-ink-tertiary)" : "var(--color-ink)",
                          }}
                        >
                          {f.title}
                        </div>
                        {f.notes && (
                          <div
                            className="mt-1 text-[12px]"
                            style={{ color: "var(--color-ink-tertiary)", lineHeight: 1.4 }}
                          >
                            {f.notes}
                          </div>
                        )}
                        <div
                          className="mt-1 flex items-center gap-2 text-[12px] flex-wrap"
                          style={{ color: "var(--color-ink-tertiary)" }}
                        >
                          {f.due_at && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <CalendarClock size={11} />
                              {formatDate(f.due_at, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          <Badge tone="neutral">{f.entity_type}</Badge>
                          {link && (
                            <Link
                              href={link as never}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                color: "var(--color-viridian-700)",
                                textDecoration: "none",
                                fontWeight: 550,
                              }}
                            >
                              Open
                              <ExternalLink size={10} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
