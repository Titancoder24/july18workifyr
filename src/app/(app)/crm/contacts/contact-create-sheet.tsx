"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { createContact } from "./actions";

export function ContactCreateSheet({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    position: "",
    company_id: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setForm({ first_name: "", last_name: "", email: "", phone: "", position: "", company_id: "", notes: "" });
    setErrors({});
  }

  async function onSave() {
    setBusy(true);
    const res = await createContact(form);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`${form.first_name} added.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New contact
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => { if (!busy) { if (!v) reset(); setOpen(v); } }}
        title="New contact"
        description="Add someone to your CRM. You can attach them to a company and start logging activity."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={onSave} loading={busy}>Save contact</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required error={errors.first_name?.[0]}>
              <Input
                value={form.first_name}
                autoFocus
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="Priya"
              />
            </Field>
            <Field label="Last name" error={errors.last_name?.[0]}>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Sharma"
              />
            </Field>
          </div>
          <Field label="Email" error={errors.email?.[0]}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="priya@mercedes.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </Field>
            <Field label="Position">
              <Input
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="Head of Operations"
              />
            </Field>
          </div>
          <Field label="Company">
            <select
              value={form.company_id}
              onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
              style={{
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
              }}
            >
              <option value="">— No company —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anything worth remembering about this contact."
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
