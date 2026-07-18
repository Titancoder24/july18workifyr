"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleTask } from "./actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    due_at: string | null;
    priority: string;
    contact: { id: string; first_name: string | null; last_name: string | null } | null;
    deal: { id: string; title: string } | null;
  };
}) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  function onCheck() {
    if (done) return;
    setDone(true);
    startTransition(async () => {
      const res = await toggleTask(task.id, true);
      if (!res.ok) setDone(false);
      router.refresh();
    });
  }

  const tone =
    task.priority === "urgent" ? "solid"
    : task.priority === "high" ? "viridian"
    : task.priority === "low" ? "outline"
    : "neutral";

  return (
    <li
      className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <button
        type="button"
        onClick={onCheck}
        aria-label="Mark complete"
        className="mt-0.5 size-5 rounded-md border inline-flex items-center justify-center shrink-0 transition-all"
        style={{
          borderColor: done ? "var(--color-viridian-500)" : "var(--color-border-strong)",
          background: done ? "var(--color-viridian-500)" : "transparent",
        }}
      >
        <Check
          className="size-3 transition-opacity"
          style={{ color: "white", opacity: done ? 1 : 0 }}
        />
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-medium"
          style={{
            textDecoration: done ? "line-through" : "none",
            color: done ? "var(--color-ink-tertiary)" : "var(--color-ink)",
          }}
        >
          {task.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
          {task.due_at && <span>Due {formatDate(task.due_at)}</span>}
          {task.contact && (
            <span>· {`${task.contact.first_name ?? ""} ${task.contact.last_name ?? ""}`.trim()}</span>
          )}
          {task.deal && <span>· {task.deal.title}</span>}
        </div>
      </div>
      <Badge tone={tone}>{task.priority}</Badge>
    </li>
  );
}
