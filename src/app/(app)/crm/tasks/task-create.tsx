"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { createTask } from "./actions";

export function TaskCreate({
  contacts,
}: {
  contacts: { id: string; first_name: string | null; last_name: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_at: "",
    priority: "normal" as const,
    contact_id: "",
    deal_id: "",
  });

  async function onSave() {
    setBusy(true);
    const res = await createTask(form);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Task added.");
    setForm({ title: "", description: "", due_at: "", priority: "normal", contact_id: "", deal_id: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New task
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        title="New task"
        description="Capture something you want to follow up on."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={onSave} loading={busy}>Save task</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Send proposal to Audi"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due">
              <Input
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
              />
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))}
                className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Related contact">
            <select
              value={form.contact_id}
              onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
              style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
            >
              <option value="">— Optional —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
