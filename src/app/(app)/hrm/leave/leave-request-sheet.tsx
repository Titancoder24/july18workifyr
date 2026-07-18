"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { submitLeaveRequest } from "./actions";

export function LeaveRequestSheet({
  policies,
}: {
  policies: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    policy_id: policies[0]?.id ?? "",
    starts_on: "",
    ends_on: "",
    reason: "",
  });

  async function onSave() {
    if (!form.policy_id || !form.starts_on || !form.ends_on) {
      toast.error("Please fill all required fields");
      return;
    }
    setBusy(true);
    const res = await submitLeaveRequest(form);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Leave request submitted.");
    setForm({ policy_id: policies[0]?.id ?? "", starts_on: "", ends_on: "", reason: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        Apply for leave
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        title="Apply for leave"
        description="Submit a leave request. Your manager or HR will review it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={onSave} loading={busy}>Submit</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Leave type" required>
            <select
              value={form.policy_id}
              onChange={(e) => setForm((f) => ({ ...f, policy_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
              style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required>
              <Input
                type="date"
                value={form.starts_on}
                onChange={(e) => setForm((f) => ({ ...f, starts_on: e.target.value }))}
              />
            </Field>
            <Field label="To" required>
              <Input
                type="date"
                value={form.ends_on}
                onChange={(e) => setForm((f) => ({ ...f, ends_on: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea
              rows={3}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Optional. Helps your manager decide quickly."
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
