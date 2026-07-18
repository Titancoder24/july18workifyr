"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { createEmployee } from "./actions";

type Option = { id: string; label: string };

export function EmployeeCreateSheet({
  departments,
  designations,
}: {
  departments: Option[];
  designations: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    employee_code: "",
    joined_on: "",
    employment_type: "full_time" as const,
    department_id: "",
    designation_id: "",
    phone: "",
  });

  async function onSave() {
    setBusy(true);
    const res = await createEmployee(form);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${form.first_name} added.`);
    setForm({ first_name: "", last_name: "", email: "", employee_code: "", joined_on: "", employment_type: "full_time", department_id: "", designation_id: "", phone: "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New employee
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        title="New employee"
        description="Add someone to the workforce. You can invite them to log in later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={onSave} loading={busy}>Save employee</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input
                autoFocus
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Employee code">
              <Input
                value={form.employee_code}
                onChange={(e) => setForm((f) => ({ ...f, employee_code: e.target.value }))}
                placeholder="EMP-001"
              />
            </Field>
            <Field label="Joined on">
              <Input
                type="date"
                value={form.joined_on}
                onChange={(e) => setForm((f) => ({ ...f, joined_on: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <select
                value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
              >
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Designation">
              <select
                value={form.designation_id}
                onChange={(e) => setForm((f) => ({ ...f, designation_id: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
              >
                <option value="">—</option>
                {designations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Employment type">
            <select
              value={form.employment_type}
              onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value as typeof form.employment_type }))}
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
              style={{ background: "var(--color-surface)", color: "var(--color-ink)", border: "1px solid var(--color-border)" }}
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </Field>
        </div>
      </Sheet>
    </>
  );
}
