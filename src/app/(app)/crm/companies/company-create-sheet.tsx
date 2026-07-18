"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { createCompany } from "./actions";

export function CompanyCreateSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "",
    size_band: "",
    website: "",
    phone: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function reset() {
    setForm({ name: "", domain: "", industry: "", size_band: "", website: "", phone: "", notes: "" });
    setErrors({});
  }

  async function onSave() {
    setBusy(true);
    const res = await createCompany(form);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast.error(res.error);
      return;
    }
    toast.success(`${form.name} added.`);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New company
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => { if (!busy) { if (!v) reset(); setOpen(v); } }}
        title="New company"
        description="Add an organization you sell to or work with."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={onSave} loading={busy}>Save company</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Company name" required error={errors.name?.[0]}>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Audi Motors"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain">
              <Input
                value={form.domain}
                onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                placeholder="audi.com"
              />
            </Field>
            <Field label="Industry">
              <Input
                value={form.industry}
                onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                placeholder="Manufacturing"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size">
              <select
                value={form.size_band}
                onChange={(e) => setForm((f) => ({ ...f, size_band: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <option value="">—</option>
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="201-1000">201–1,000</option>
                <option value="1000+">1,000+</option>
              </select>
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 22 1234 5678"
              />
            </Field>
          </div>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://audi.com"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
