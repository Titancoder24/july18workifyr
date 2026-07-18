"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Search,
  Eye,
  Send,
  Save,
  X,
  Copy,
  Download,
  Building2,
  Calendar,
  PenSquare,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

type Quotation = {
  id: string;
  org_id: string;
  number: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  issue_date: string | null;
  valid_until: string | null;
  status: QuotationStatus;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

type QuotationLine = {
  id: string;
  org_id: string;
  quotation_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  line_total: number;
};

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
};

type Company = {
  id: string;
  name: string;
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
};

type QuotationWithRelations = Quotation & {
  contact?: Contact | null;
  company?: Company | null;
};

type LineItemDraft = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  line_total: number;
  _isNew?: boolean;
};

type EditorForm = {
  id: string | null;
  number: string;
  contact_id: string;
  company_id: string;
  issue_date: string;
  valid_until: string;
  status: QuotationStatus;
  notes: string;
  terms: string;
  lines: LineItemDraft[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const supabase = createClient();

function calcLineTotal(qty: number, price: number, tax: number, discount: number): number {
  return qty * price * (1 + tax / 100) * (1 - discount / 100);
}

function formatCurrency(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function generateTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const statusConfig: Record<QuotationStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "chip chip-outline" },
  sent:     { label: "Sent",     className: "chip" },
  accepted: { label: "Accepted", className: "chip chip-viridian" },
  rejected: { label: "Rejected", className: "chip chip-strong" },
  expired:  { label: "Expired",  className: "chip" },
};

function StatusChip({ status }: { status: QuotationStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.draft;
  return <span className={cfg.className}>{cfg.label}</span>;
}

function emptyLine(): LineItemDraft {
  return {
    id: generateTempId(),
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    discount_rate: 0,
    line_total: 0,
    _isNew: true,
  };
}

function defaultForm(): EditorForm {
  const today = todayISO();
  return {
    id: null,
    number: "",
    contact_id: "",
    company_id: "",
    issue_date: today,
    valid_until: addDays(today, 30),
    status: "draft",
    notes: "",
    terms: "Payment due within 30 days",
    lines: [emptyLine()],
  };
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */

export default function QuotationsPage() {
  /* -- Data state -------------------------------------------------- */
  const [quotations, setQuotations] = useState<QuotationWithRelations[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  /* -- Editor state ------------------------------------------------ */
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<EditorForm>(defaultForm());
  const [saving, setSaving] = useState(false);

  /* -- Preview state ----------------------------------------------- */
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<QuotationWithRelations | null>(null);
  const [previewLines, setPreviewLines] = useState<QuotationLine[]>([]);

  const currency = org?.currency ?? "INR";

  /* -- Derived totals ---------------------------------------------- */
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    for (const line of form.lines) {
      const base = line.quantity * line.unit_price;
      const tax = base * (line.tax_rate / 100);
      const discount = (base + tax) * (line.discount_rate / 100);
      subtotal += base;
      taxTotal += tax;
      discountTotal += discount;
    }
    return {
      subtotal,
      taxTotal,
      discountTotal,
      grandTotal: subtotal + taxTotal - discountTotal,
    };
  }, [form.lines]);

  /* -- Bootstrap --------------------------------------------------- */
  const fetchQuotations = useCallback(async (oid: string) => {
    const { data, error } = await supabase
      .from("quotations")
      .select("*, contact:contacts(id, first_name, last_name, email, phone, company_id), company:companies(id, name)")
      .eq("org_id", oid)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("Failed to fetch quotations:", error);
      return;
    }
    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
      const company = Array.isArray(row.company) ? row.company[0] : row.company;
      return { ...row, contact, company } as QuotationWithRelations;
    });
    setQuotations(rows);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id, organizations(id, name, logo_url, currency)")
        .eq("id", user.id)
        .single() as { data: Record<string, unknown> | null };

      if (!profile?.org_id) return;
      const oid = profile.org_id as string;
      setOrgId(oid);

      const orgRaw = (profile as Record<string, unknown>).organizations;
      const orgData = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as Organization | null;
      setOrg(orgData);

      // Fetch contacts, companies, quotations in parallel
      const [contactsRes, companiesRes] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, email, phone, company_id").eq("org_id", oid).order("first_name").limit(1000),
        supabase.from("companies").select("id, name").eq("org_id", oid).order("name").limit(1000),
      ]);

      setContacts((contactsRes.data as Contact[]) ?? []);
      setCompanies((companiesRes.data as Company[]) ?? []);

      await fetchQuotations(oid);
      setLoading(false);
    })();
  }, [fetchQuotations]);

  /* -- Generate quotation number ----------------------------------- */
  async function generateNumber(): Promise<string> {
    if (!orgId) return "QUO-0001";
    const { count } = await supabase
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    const next = (count ?? 0) + 1;
    return `QUO-${String(next).padStart(4, "0")}`;
  }

  /* -- Open editor for new ----------------------------------------- */
  async function openNew() {
    const number = await generateNumber();
    setForm({ ...defaultForm(), number });
    setEditorOpen(true);
  }

  /* -- Open editor for existing ------------------------------------ */
  async function openEdit(q: QuotationWithRelations) {
    // Fetch line items
    const { data: lines } = await supabase
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", q.id)
      .order("position", { ascending: true });

    const lineDrafts: LineItemDraft[] = (lines ?? []).map((l: Record<string, unknown>) => ({
      id: l.id as string,
      description: (l.description as string) ?? "",
      quantity: (l.quantity as number) ?? 1,
      unit_price: (l.unit_price as number) ?? 0,
      tax_rate: (l.tax_rate as number) ?? 0,
      discount_rate: (l.discount_rate as number) ?? 0,
      line_total: (l.line_total as number) ?? 0,
      _isNew: false,
    }));

    setForm({
      id: q.id,
      number: q.number,
      contact_id: q.contact_id ?? "",
      company_id: q.company_id ?? "",
      issue_date: q.issue_date ?? todayISO(),
      valid_until: q.valid_until ?? addDays(todayISO(), 30),
      status: q.status,
      notes: q.notes ?? "",
      terms: q.terms ?? "Payment due within 30 days",
      lines: lineDrafts.length > 0 ? lineDrafts : [emptyLine()],
    });
    setEditorOpen(true);
  }

  /* -- Open preview ------------------------------------------------ */
  async function openPreview(q: QuotationWithRelations) {
    const { data: lines } = await supabase
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", q.id)
      .order("position", { ascending: true });

    setPreviewQuotation(q);
    setPreviewLines((lines ?? []) as QuotationLine[]);
    setPreviewOpen(true);
  }

  /* -- Line item management ---------------------------------------- */
  function updateLine(index: number, field: keyof LineItemDraft, value: string | number) {
    setForm((prev) => {
      const newLines = [...prev.lines];
      const line = { ...newLines[index], [field]: value };
      line.line_total = calcLineTotal(line.quantity, line.unit_price, line.tax_rate, line.discount_rate);
      newLines[index] = line;
      return { ...prev, lines: newLines };
    });
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  }

  function removeLine(index: number) {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });
  }

  /* -- Save -------------------------------------------------------- */
  async function saveQuotation(markAsSent = false) {
    if (!orgId || !userId) {
      toast.error("Unable to determine organization. Please refresh.");
      return;
    }
    if (form.lines.every((l) => !l.description.trim())) {
      toast.error("Please add at least one line item with a description.");
      return;
    }

    setSaving(true);
    const status: QuotationStatus = markAsSent ? "sent" : form.status === "sent" ? "sent" : "draft";

    const payload = {
      org_id: orgId,
      number: form.number,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      issue_date: form.issue_date || null,
      valid_until: form.valid_until || null,
      status,
      currency,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      discount_total: totals.discountTotal,
      total: totals.grandTotal,
      notes: form.notes || null,
      terms: form.terms || null,
      owner_id: userId,
      updated_at: new Date().toISOString(),
    };

    let quotationId = form.id;

    if (form.id) {
      // Update
      const { error } = await (supabase.from("quotations") as any).update(payload).eq("id", form.id);
      if (error) {
        toast.error("Failed to update quotation: " + error.message);
        setSaving(false);
        return;
      }
      // Delete existing lines and re-insert
      await (supabase.from("quotation_lines") as any).delete().eq("quotation_id", form.id);
    } else {
      // Insert
      const { data, error } = await (supabase.from("quotations") as any)
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create quotation: " + (error?.message ?? "Unknown error"));
        setSaving(false);
        return;
      }
      quotationId = (data as { id: string }).id;
    }

    // Insert line items
    const linePayloads = form.lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({
        org_id: orgId,
        quotation_id: quotationId,
        position: i + 1,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        discount_rate: l.discount_rate,
        line_total: calcLineTotal(l.quantity, l.unit_price, l.tax_rate, l.discount_rate),
      }));

    if (linePayloads.length > 0) {
      const { error: lineErr } = await (supabase.from("quotation_lines") as any).insert(linePayloads);
      if (lineErr) {
        toast.error("Quotation saved but line items failed: " + lineErr.message);
        setSaving(false);
        return;
      }
    }

    toast.success(form.id ? "Quotation updated." : "Quotation created.");
    setEditorOpen(false);
    setSaving(false);
    await fetchQuotations(orgId);
  }

  /* -- Duplicate --------------------------------------------------- */
  async function duplicateQuotation(q: QuotationWithRelations) {
    if (!orgId) return;
    const number = await generateNumber();
    const { data: lines } = await supabase
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", q.id)
      .order("position", { ascending: true });

    const lineDrafts: LineItemDraft[] = (lines ?? []).map((l: Record<string, unknown>) => ({
      id: generateTempId(),
      description: (l.description as string) ?? "",
      quantity: (l.quantity as number) ?? 1,
      unit_price: (l.unit_price as number) ?? 0,
      tax_rate: (l.tax_rate as number) ?? 0,
      discount_rate: (l.discount_rate as number) ?? 0,
      line_total: (l.line_total as number) ?? 0,
      _isNew: true,
    }));

    setForm({
      id: null,
      number,
      contact_id: q.contact_id ?? "",
      company_id: q.company_id ?? "",
      issue_date: todayISO(),
      valid_until: addDays(todayISO(), 30),
      status: "draft",
      notes: q.notes ?? "",
      terms: q.terms ?? "Payment due within 30 days",
      lines: lineDrafts.length > 0 ? lineDrafts : [emptyLine()],
    });
    setEditorOpen(true);
  }

  /* -- Filter quotations ------------------------------------------- */
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return quotations;
    const q = searchQuery.toLowerCase();
    return quotations.filter((quo) => {
      const contactName = quo.contact
        ? `${quo.contact.first_name ?? ""} ${quo.contact.last_name ?? ""}`.toLowerCase()
        : "";
      const companyName = quo.company?.name?.toLowerCase() ?? "";
      return (
        quo.number.toLowerCase().includes(q) ||
        contactName.includes(q) ||
        companyName.includes(q) ||
        quo.status.includes(q)
      );
    });
  }, [quotations, searchQuery]);

  /* -- Contact/company name helpers -------------------------------- */
  function contactName(c: Contact | null | undefined): string {
    if (!c) return "—";
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
  }

  function companyName(c: Company | null | undefined): string {
    return c?.name ?? "—";
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Quotations" />
        <div className="flex items-center justify-center py-20">
          <div
            className="size-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-viridian-500)" }}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Quotations"
        description={`${quotations.length} quotation${quotations.length === 1 ? "" : "s"} · ${org?.name ?? ""}`}
        actions={
          <>
            <Link href="/crm/quotations/editor">
              <Button variant="secondary" iconLeft={<PenSquare className="size-3.5" />}>
                New in Editor
              </Button>
            </Link>
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openNew}>
              New quotation
            </Button>
          </>
        }
      />

      {/* Search */}
      <div className="mb-4">
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-lg max-w-md"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by number, contact, or company…"
            className="bg-transparent flex-1 text-[13px] outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quotations table */}
      <div className="card overflow-hidden">
        {filtered.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>Number</Th>
                <Th>Contact / Company</Th>
                <Th>Issue Date</Th>
                <Th>Valid Until</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                  onClick={() => openEdit(q)}
                >
                  <Td>
                    <span className="font-medium" style={{ color: "var(--color-viridian-700)" }}>
                      {q.number}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium">{contactName(q.contact)}</span>
                      {q.company && (
                        <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                          {q.company.name}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td muted>{formatDate(q.issue_date)}</Td>
                  <Td muted>{formatDate(q.valid_until)}</Td>
                  <Td>
                    <StatusChip status={q.status} />
                  </Td>
                  <Td align="right">
                    <span className="font-semibold">{formatCurrency(q.total, q.currency)}</span>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/crm/quotations/editor/${q.id}`}
                        className="size-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
                        title="Open in Editor"
                      >
                        <PenSquare className="size-3.5" style={{ color: "var(--color-viridian-500)" }} />
                      </Link>
                      <button
                        onClick={() => openPreview(q)}
                        className="size-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
                        title="Preview"
                      >
                        <Eye className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                      <button
                        onClick={() => duplicateQuotation(q)}
                        className="size-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState hasFilter={Boolean(searchQuery.trim())} onNew={openNew} />
        )}
      </div>

      {/* Editor Sheet */}
      <Sheet
        open={editorOpen}
        onOpenChange={(v) => !saving && setEditorOpen(v)}
        title={form.id ? `Edit ${form.number}` : "New Quotation"}
        description={form.id ? "Update this quotation and its line items." : "Create a new quotation with line items."}
        width={640}
        footer={
          <div className="flex items-center gap-2 w-full">
            {form.id && (
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Eye className="size-3.5" />}
                onClick={() => {
                  const q = quotations.find((q) => q.id === form.id);
                  if (q) {
                    setEditorOpen(false);
                    openPreview(q);
                  }
                }}
              >
                Preview
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              iconLeft={<Save className="size-3.5" />}
              onClick={() => saveQuotation(false)}
              loading={saving}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              iconLeft={<Send className="size-3.5" />}
              onClick={() => saveQuotation(true)}
              loading={saving}
            >
              Mark as sent
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Header info */}
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
            >
              <FileText className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">{form.number}</span>
                <StatusChip status={form.status} />
              </div>
              <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                {form.id ? "Editing existing quotation" : "New quotation"}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-border)" }} />

          {/* Client section */}
          <div>
            <div
              className="text-[11px] font-medium uppercase tracking-wider mb-3"
              style={{ color: "var(--color-ink-tertiary)" }}
            >
              Client details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact">
                <Select
                  value={form.contact_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => {
                      const updated = { ...f, contact_id: val };
                      // Auto-fill company if contact has one
                      if (val) {
                        const c = contacts.find((c) => c.id === val);
                        if (c?.company_id && !f.company_id) {
                          updated.company_id = c.company_id;
                        }
                      }
                      return updated;
                    });
                  }}
                >
                  <option value="">Select contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Company">
                <Select
                  value={form.company_id}
                  onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
                >
                  <option value="">Select company…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue Date">
              <Input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
              />
            </Field>
            <Field label="Valid Until">
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
              />
            </Field>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-border)" }} />

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                Line items
              </div>
              <Button variant="ghost" size="sm" iconLeft={<Plus className="size-3" />} onClick={addLine}>
                Add item
              </Button>
            </div>

            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {/* Line items header */}
              <div
                className="grid gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wider"
                style={{
                  gridTemplateColumns: "1fr 60px 90px 60px 60px 90px 32px",
                  color: "var(--color-ink-tertiary)",
                  background: "var(--color-surface-muted)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit Price</span>
                <span className="text-right">Tax %</span>
                <span className="text-right">Disc %</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {/* Line item rows */}
              {form.lines.map((line, i) => (
                <div
                  key={line.id}
                  className="grid gap-2 px-3 py-2 items-center"
                  style={{
                    gridTemplateColumns: "1fr 60px 90px 60px 60px 90px 32px",
                    borderBottom: i < form.lines.length - 1 ? "1px solid var(--color-border)" : "none",
                    background: "var(--color-surface)",
                  }}
                >
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Item description"
                    className="bg-transparent text-[13px] outline-none w-full min-w-0"
                    style={{ color: "var(--color-ink)" }}
                  />
                  <input
                    type="number"
                    value={line.quantity || ""}
                    onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-[13px] outline-none text-right w-full"
                    style={{ color: "var(--color-ink)" }}
                    min={0}
                    step={1}
                  />
                  <input
                    type="number"
                    value={line.unit_price || ""}
                    onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-[13px] outline-none text-right w-full"
                    style={{ color: "var(--color-ink)" }}
                    min={0}
                    step={0.01}
                  />
                  <input
                    type="number"
                    value={line.tax_rate || ""}
                    onChange={(e) => updateLine(i, "tax_rate", parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-[13px] outline-none text-right w-full"
                    style={{ color: "var(--color-ink)" }}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <input
                    type="number"
                    value={line.discount_rate || ""}
                    onChange={(e) => updateLine(i, "discount_rate", parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-[13px] outline-none text-right w-full"
                    style={{ color: "var(--color-ink)" }}
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <span
                    className="text-[13px] font-medium text-right tabular-nums"
                    style={{ color: "var(--color-ink)" }}
                  >
                    {formatCurrency(
                      calcLineTotal(line.quantity, line.unit_price, line.tax_rate, line.discount_rate),
                      currency
                    )}
                  </span>
                  <button
                    onClick={() => removeLine(i)}
                    className="size-6 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
                    disabled={form.lines.length <= 1}
                    style={{ opacity: form.lines.length <= 1 ? 0.3 : 1 }}
                    title="Remove line"
                  >
                    <Trash2 className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary totals */}
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}
          >
            <div className="space-y-2">
              <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
              <SummaryRow label="Tax Total" value={formatCurrency(totals.taxTotal, currency)} />
              <SummaryRow label="Discount Total" value={`- ${formatCurrency(totals.discountTotal, currency)}`} />
              <div style={{ height: 1, background: "var(--color-border)", margin: "8px 0" }} />
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                  Grand Total
                </span>
                <span
                  className="text-[16px] font-semibold tabular-nums"
                  style={{ color: "var(--color-viridian-700)" }}
                >
                  {formatCurrency(totals.grandTotal, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--color-border)" }} />

          {/* Notes & Terms */}
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Additional notes for the client..."
              rows={3}
            />
          </Field>
          <Field label="Terms & Conditions">
            <Textarea
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              placeholder="Payment terms..."
              rows={3}
            />
          </Field>
        </div>
      </Sheet>

      {/* Preview Modal */}
      {previewOpen && previewQuotation && (
        <PreviewModal
          quotation={previewQuotation}
          lines={previewLines}
          contacts={contacts}
          companies={companies}
          org={org}
          currency={currency}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
      style={{ color: "var(--color-ink-tertiary)", textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)",
      }}
    >
      {children}
    </td>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--color-ink)" }}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ hasFilter, onNew }: { hasFilter: boolean; onNew: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <div
        className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
        style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
      >
        <FileText className="size-5" />
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">
        {hasFilter ? "No quotations match that search" : "No quotations yet"}
      </h3>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
        {hasFilter
          ? "Try a different search term or clear the filter."
          : "Create your first quotation to send professional proposals to your clients."}
      </p>
      {!hasFilter && (
        <div className="mt-4">
          <Button variant="primary" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={onNew}>
            New quotation
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template types & registry                                          */
/* ------------------------------------------------------------------ */

type TemplateName =
  | "modern" | "classic" | "bold" | "compact" | "elegant"
  | "simple" | "corporate" | "startup" | "freelancer" | "consulting"
  | "retail" | "creative" | "legal" | "medical" | "tech";

interface QuotationTemplateProps {
  quotation: Quotation;
  lines: QuotationLine[];
  organization: { name: string; logo_url: string | null; currency: string } | null;
  contact: { first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  company: { name: string } | null;
}

const TEMPLATE_META: { key: TemplateName; label: string; desc: string }[] = [
  { key: "modern",     label: "Modern",      desc: "Clean minimal, viridian accent" },
  { key: "classic",    label: "Classic",      desc: "Traditional serif, formal" },
  { key: "bold",       label: "Bold",         desc: "Large numbers, strong headers" },
  { key: "compact",    label: "Compact",      desc: "Dense, fits more items" },
  { key: "elegant",    label: "Elegant",      desc: "Thin borders, refined spacing" },
  { key: "simple",     label: "Simple",       desc: "Ultra-minimal, no borders" },
  { key: "corporate",  label: "Corporate",    desc: "Dark header, professional" },
  { key: "startup",    label: "Startup",      desc: "Colorful, rounded, modern" },
  { key: "freelancer", label: "Freelancer",   desc: "Personal branding, large name" },
  { key: "consulting", label: "Consulting",   desc: "Rate-focused, time-tracking" },
  { key: "retail",     label: "Retail",       desc: "Product / receipt style" },
  { key: "creative",   label: "Creative",     desc: "Asymmetric, design-agency feel" },
  { key: "legal",      label: "Legal",        desc: "Dense formal, numbered items" },
  { key: "medical",    label: "Medical",      desc: "Clean clinical, provider look" },
  { key: "tech",       label: "Tech",         desc: "Monospace, dark-mode feel" },
];

/* -- Shared helpers for templates ------------------------------------ */

function tplContactName(c: QuotationTemplateProps["contact"]): string {
  if (!c) return "—";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
}

function tplStatusLabel(s: QuotationStatus): string {
  return statusConfig[s]?.label ?? s;
}

/* ------------------------------------------------------------------ */
/*  1. Modern template (original preview style)                        */
/* ------------------------------------------------------------------ */

function TplModern({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1e293b", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />}
          <div style={{ fontSize: 20, fontWeight: 600 }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#166534" }}>QUOTATION</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{q.number} <span style={{ padding: "2px 8px", background: "#f0fdf4", borderRadius: 4, fontSize: 11, color: "#166534" }}>{tplStatusLabel(q.status)}</span></div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Issue: {formatDate(q.issue_date)}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Valid: {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <div style={{ height: 2, background: "#22c55e", borderRadius: 1, marginBottom: 24 }} />
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 8 }}>Bill To</div>
        <div style={{ fontWeight: 600 }}>{tplContactName(contact)}</div>
        {contact?.email && <div style={{ color: "#64748b" }}>{contact.email}</div>}
        {contact?.phone && <div style={{ color: "#64748b" }}>{contact.phone}</div>}
        {company && <div style={{ color: "#64748b", marginTop: 4 }}>{company.name}</div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Description</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Price</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Tax</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Disc</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: i < lines.length - 1 ? "1px solid #e2e8f0" : "none" }}>
              <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{l.position}</td>
              <td style={{ padding: "10px 12px" }}>{l.description}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{l.quantity}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "#64748b" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <div style={{ width: 280, background: "#f8fafc", borderRadius: 8, padding: 16, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Subtotal</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Tax</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Discount</span><span style={{ color: "#1e293b" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "#e2e8f0", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: "#166534" }}><span style={{ fontSize: 14, color: "#1e293b" }}>Grand Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 24 }}>
          {q.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 6 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#64748b" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 6 }}>Terms & Conditions</div><div style={{ whiteSpace: "pre-wrap", color: "#64748b" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Classic template                                                */
/* ------------------------------------------------------------------ */

function TplClassic({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ textAlign: "center", marginBottom: 32, borderBottom: "3px double #4a4a4a", paddingBottom: 20 }}>
        {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 48, marginBottom: 8, objectFit: "contain" }} />}
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 18, fontStyle: "italic", color: "#666", marginTop: 8 }}>Quotation</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 4 }}>Bill To</div>
          <div style={{ fontWeight: 700 }}>{tplContactName(contact)}</div>
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}
          {company && <div style={{ fontStyle: "italic", color: "#555" }}>{company.name}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 4 }}><strong>No:</strong> {q.number}</div>
          <div style={{ marginBottom: 4 }}><strong>Status:</strong> {tplStatusLabel(q.status)}</div>
          <div style={{ marginBottom: 4 }}><strong>Date:</strong> {formatDate(q.issue_date)}</div>
          <div><strong>Valid Until:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, border: "1px solid #ccc" }}>
        <thead>
          <tr style={{ background: "#f5f5f0" }}>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>#</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>Description</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "right", fontSize: 11, textTransform: "uppercase" }}>Qty</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "right", fontSize: 11, textTransform: "uppercase" }}>Unit Price</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "right", fontSize: 11, textTransform: "uppercase" }}>Tax %</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "right", fontSize: 11, textTransform: "uppercase" }}>Disc %</th>
            <th style={{ padding: "8px 10px", borderBottom: "2px solid #999", textAlign: "right", fontSize: 11, textTransform: "uppercase" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 10px" }}>{l.position}</td>
              <td style={{ padding: "8px 10px" }}>{l.description}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 260, borderTop: "2px solid #999", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Subtotal:</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Tax:</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Discount:</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: "#999", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}><span>Total:</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #ccc", paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><strong>Notes:</strong><div style={{ whiteSpace: "pre-wrap", color: "#555", marginTop: 4, fontStyle: "italic" }}>{q.notes}</div></div>}
          {q.terms && <div><strong>Terms & Conditions:</strong><div style={{ whiteSpace: "pre-wrap", color: "#555", marginTop: 4 }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#999", borderTop: "3px double #4a4a4a", paddingTop: 12 }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Bold template                                                   */
/* ------------------------------------------------------------------ */

function TplBold({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: "#111", fontSize: 14 }}>
      <div style={{ background: "#111", color: "#fff", padding: "24px 32px", marginBottom: 32, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>QUOTATION</div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>{q.number}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{tplStatusLabel(q.status).toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, gap: 24 }}>
        <div style={{ flex: 1, background: "#f8f8f8", padding: 20, borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>Client</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{tplContactName(contact)}</div>
          {contact?.email && <div style={{ color: "#666", marginTop: 4 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#666" }}>{contact.phone}</div>}
          {company && <div style={{ fontWeight: 600, marginTop: 4 }}>{company.name}</div>}
        </div>
        <div style={{ flex: 1, background: "#f8f8f8", padding: 20, borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>Details</div>
          <div><strong>Issue:</strong> {formatDate(q.issue_date)}</div>
          <div><strong>Valid Until:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "3px solid #111" }}>
            <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>#</th>
            <th style={{ padding: "12px 10px", textAlign: "left", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Description</th>
            <th style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Qty</th>
            <th style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Price</th>
            <th style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Tax</th>
            <th style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Disc</th>
            <th style={{ padding: "12px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
              <td style={{ padding: "12px 10px", fontWeight: 700, color: "#999" }}>{l.position}</td>
              <td style={{ padding: "12px 10px", fontWeight: 500 }}>{l.description}</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "12px 10px", textAlign: "right", fontSize: 16, fontWeight: 800 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 300, background: "#111", color: "#fff", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "#444", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 900 }}><span style={{ fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "3px solid #111", paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#999" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Compact template                                                */
/* ------------------------------------------------------------------ */

function TplCompact({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#333", fontSize: 11, lineHeight: 1.4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #ddd" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ color: "#888", fontSize: 10 }}>Quotation {q.number} | {tplStatusLabel(q.status)} | {formatDate(q.issue_date)} - {formatDate(q.valid_until)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#888", fontSize: 10 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#888", fontSize: 10 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#888", fontSize: 10 }}>{contact.phone}</div>}
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: "4px 6px", textAlign: "left", fontSize: 10, fontWeight: 700 }}>#</th>
            <th style={{ padding: "4px 6px", textAlign: "left", fontSize: 10, fontWeight: 700 }}>Description</th>
            <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Qty</th>
            <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Price</th>
            <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Tax</th>
            <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Disc</th>
            <th style={{ padding: "4px 6px", textAlign: "right", fontSize: 10, fontWeight: 700 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "4px 6px" }}>{l.position}</td>
              <td style={{ padding: "4px 6px" }}>{l.description}</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{ width: 220, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "#ccc", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13 }}><span>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ fontSize: 10, borderTop: "1px solid #ddd", paddingTop: 8, color: "#666" }}>
          {q.notes && <div style={{ marginBottom: 4 }}><strong>Notes:</strong> {q.notes}</div>}
          {q.terms && <div><strong>Terms:</strong> {q.terms}</div>}
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: "#aaa" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  5. Elegant template                                                */
/* ------------------------------------------------------------------ */

function TplElegant({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Crimson Text', Georgia, serif", color: "#2d2d2d", fontSize: 14, lineHeight: 1.7 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 44, marginBottom: 12, objectFit: "contain" }} />}
        <div style={{ fontSize: 12, letterSpacing: 4, textTransform: "uppercase", color: "#999", marginBottom: 4 }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 28, fontWeight: 400, letterSpacing: 6, textTransform: "uppercase", color: "#8b6914" }}>Quotation</div>
        <div style={{ width: 60, height: 1, background: "#8b6914", margin: "12px auto 0" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", marginBottom: 6 }}>Prepared For</div>
          <div style={{ fontSize: 16 }}>{tplContactName(contact)}</div>
          {contact?.email && <div style={{ color: "#888", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#888", fontSize: 12 }}>{contact.phone}</div>}
          {company && <div style={{ color: "#888", fontSize: 12, fontStyle: "italic" }}>{company.name}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          <div style={{ marginBottom: 4, color: "#888" }}>Ref: <span style={{ color: "#2d2d2d" }}>{q.number}</span></div>
          <div style={{ marginBottom: 4, color: "#888" }}>Status: <span style={{ color: "#8b6914" }}>{tplStatusLabel(q.status)}</span></div>
          <div style={{ marginBottom: 4, color: "#888" }}>Issued: {formatDate(q.issue_date)}</div>
          <div style={{ color: "#888" }}>Expires: {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
        <thead>
          <tr style={{ borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "10px 8px", textAlign: "left", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>#</th>
            <th style={{ padding: "10px 8px", textAlign: "left", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Item</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Qty</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Rate</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Tax</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Disc</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", fontWeight: 400 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 8px", color: "#bbb" }}>{l.position}</td>
              <td style={{ padding: "10px 8px" }}>{l.description}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", color: "#888" }}>{l.quantity}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", color: "#888" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", color: "#888" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right", color: "#888" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Subtotal</span><span style={{ color: "#2d2d2d" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Tax</span><span style={{ color: "#2d2d2d" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Discount</span><span style={{ color: "#2d2d2d" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ width: 60, height: 1, background: "#8b6914", margin: "12px 0 12px auto" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, color: "#8b6914" }}><span style={{ fontSize: 13, color: "#2d2d2d" }}>Total Due</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: 24, fontSize: 12 }}>
          {q.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", marginBottom: 6 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#888", fontStyle: "italic" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#bbb", marginBottom: 6 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#888" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "#ccc", letterSpacing: 1 }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  6. Simple template                                                 */
/* ------------------------------------------------------------------ */

function TplSimple({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, sans-serif", color: "#333", fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 300, color: "#111" }}>Quotation</div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{q.number} | {tplStatusLabel(q.status)} | {formatDate(q.issue_date)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>From</div>
          <div style={{ fontWeight: 600 }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>To</div>
          <div style={{ fontWeight: 600 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#999" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#999", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Valid Until</div>
          <div>{formatDate(q.valid_until)}</div>
        </div>
      </div>
      {lines.map((l) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
          <div>
            <div style={{ fontWeight: 500 }}>{l.description}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{l.quantity} x {formatCurrency(l.unit_price, cur)}{l.tax_rate > 0 ? ` + ${l.tax_rate}% tax` : ""}{l.discount_rate > 0 ? ` - ${l.discount_rate}% disc` : ""}</div>
          </div>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatCurrency(l.line_total, cur)}</div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, marginBottom: 32 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          {q.tax_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>}
          {q.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontSize: 18, fontWeight: 300, borderTop: "1px solid #eee", marginTop: 8 }}><span>Total</span><span style={{ fontWeight: 600 }}>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ fontSize: 12, color: "#999", marginBottom: 24 }}>
          {q.notes && <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 500, color: "#666" }}>Notes:</span> {q.notes}</div>}
          {q.terms && <div><span style={{ fontWeight: 500, color: "#666" }}>Terms:</span> {q.terms}</div>}
        </div>
      )}
      <div style={{ marginTop: 32, fontSize: 10, color: "#ccc", textAlign: "center" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  7. Corporate template                                              */
/* ------------------------------------------------------------------ */

function TplCorporate({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", color: "#333", fontSize: 13 }}>
      <div style={{ background: "#1e3a5f", color: "#fff", padding: "28px 32px", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 36, marginBottom: 8, objectFit: "contain", filter: "brightness(10)" }} />}
          <div style={{ fontSize: 20, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Quotation</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{q.number}</div>
        </div>
      </div>
      <div style={{ background: "#f0f4f8", padding: "16px 32px", display: "flex", justifyContent: "space-between", marginBottom: 28, borderBottom: "2px solid #1e3a5f" }}>
        <div style={{ fontSize: 12 }}><strong>Status:</strong> {tplStatusLabel(q.status)} | <strong>Date:</strong> {formatDate(q.issue_date)} | <strong>Valid:</strong> {formatDate(q.valid_until)}</div>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div style={{ display: "flex", gap: 32, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#1e3a5f", marginBottom: 6, letterSpacing: 1 }}>Bill To</div>
            <div style={{ fontWeight: 600 }}>{tplContactName(contact)}</div>
            {company && <div>{company.name}</div>}
            {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
            {contact?.phone && <div style={{ color: "#666" }}>{contact.phone}</div>}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#1e3a5f", color: "#fff" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>Description</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Qty</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Price</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Tax %</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Disc %</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#f0f4f8", borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px" }}>{l.position}</td>
                <td style={{ padding: "10px 12px" }}>{l.description}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
          <div style={{ width: 280, background: "#f0f4f8", padding: 16, borderRadius: 4, border: "1px solid #d0d8e4" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
            <div style={{ height: 2, background: "#1e3a5f", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#1e3a5f" }}><span>Grand Total</span><span>{formatCurrency(q.total, cur)}</span></div>
          </div>
        </div>
        {(q.notes || q.terms) && (
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, fontSize: 12 }}>
            {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
            {q.terms && <div><div style={{ fontWeight: 700, color: "#1e3a5f", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Terms & Conditions</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
          </div>
        )}
      </div>
      <div style={{ marginTop: 32, padding: "12px 32px", background: "#1e3a5f", color: "#fff", textAlign: "center", fontSize: 10, opacity: 0.8 }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  8. Startup template                                                */
/* ------------------------------------------------------------------ */

function TplStartup({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#333", fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", padding: "28px 32px", borderRadius: 12, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Quotation {q.number}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{tplStatusLabel(q.status)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#f8f7ff", padding: 20, borderRadius: 10, border: "1px solid #e8e5ff" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2", marginBottom: 8, letterSpacing: 1 }}>Client</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#666", fontSize: 12 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#999", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div style={{ background: "#f8f7ff", padding: 20, borderRadius: 10, border: "1px solid #e8e5ff" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2", marginBottom: 8, letterSpacing: 1 }}>Dates</div>
          <div><strong>Issued:</strong> {formatDate(q.issue_date)}</div>
          <div><strong>Valid Until:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Description</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Price</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Tax</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Disc</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#764ba2" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ background: "#f8f7ff", borderRadius: 8 }}>
              <td style={{ padding: "10px 12px", borderRadius: "8px 0 0 8px" }}>{l.position}</td>
              <td style={{ padding: "10px 12px" }}>{l.description}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, borderRadius: "0 8px 8px 0" }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 280, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, opacity: 0.8 }}><span>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, opacity: 0.8 }}><span>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, opacity: 0.8 }}><span>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.3)", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800 }}><span style={{ fontSize: 13 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ background: "#f8f7ff", borderRadius: 10, padding: 20, border: "1px solid #e8e5ff" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, color: "#764ba2", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, color: "#764ba2", fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#bbb" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  9. Freelancer template                                             */
/* ------------------------------------------------------------------ */

function TplFreelancer({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#333", fontSize: 13 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1 }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 14, color: "#e74c3c", fontWeight: 600, marginTop: 8 }}>QUOTATION</div>
        <div style={{ height: 4, width: 48, background: "#e74c3c", borderRadius: 2, marginTop: 8 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #eee" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#bbb", marginBottom: 6 }}>Prepared For</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#888" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#888", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#888", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ background: "#fef2f2", color: "#e74c3c", padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "inline-block", marginBottom: 8 }}>{tplStatusLabel(q.status)}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{q.number}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{formatDate(q.issue_date)} - {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e74c3c" }}>
            <th style={{ padding: "10px 8px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Service</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Qty</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Rate</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Tax</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Disc</th>
            <th style={{ padding: "10px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "12px 8px", fontWeight: 500 }}>{l.description}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#888" }}>{l.quantity}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#888" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#888" }}>{l.tax_rate}%</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#888" }}>{l.discount_rate}%</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#888" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#888" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#888" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: "#e74c3c", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, color: "#e74c3c" }}><span style={{ fontSize: 14, color: "#333" }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #eee", paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#888" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#888" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "#ccc" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  10. Consulting template                                            */
/* ------------------------------------------------------------------ */

function TplConsulting({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#333", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 20, borderBottom: "3px solid #0ea5e9" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, color: "#0ea5e9", fontWeight: 600, marginTop: 2 }}>Professional Services Quote</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#888" }}>Quote #{q.number}</div>
          <div style={{ fontSize: 12, color: "#888" }}>{tplStatusLabel(q.status)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, borderLeft: "3px solid #0ea5e9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#0ea5e9", marginBottom: 4 }}>Client</div>
          <div style={{ fontWeight: 600 }}>{tplContactName(contact)}</div>
          {company && <div style={{ fontSize: 12, color: "#888" }}>{company.name}</div>}
          {contact?.email && <div style={{ fontSize: 11, color: "#888" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ fontSize: 11, color: "#888" }}>{contact.phone}</div>}
        </div>
        <div style={{ padding: 16, background: "#f0f9ff", borderRadius: 6, borderLeft: "3px solid #0ea5e9" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#0ea5e9", marginBottom: 4 }}>Issue Date</div>
          <div style={{ fontWeight: 600 }}>{formatDate(q.issue_date)}</div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#0ea5e9", marginBottom: 4, marginTop: 8 }}>Valid Until</div>
          <div style={{ fontWeight: 600 }}>{formatDate(q.valid_until)}</div>
        </div>
        <div style={{ padding: 16, background: "#0ea5e9", borderRadius: 6, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", opacity: 0.8 }}>Total Estimate</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{formatCurrency(q.total, cur)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#f0f9ff", borderBottom: "2px solid #0ea5e9" }}>
            <th style={{ padding: "10px 10px", textAlign: "left", fontSize: 11, fontWeight: 700 }}>Service / Deliverable</th>
            <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Hours/Qty</th>
            <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Rate</th>
            <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Tax %</th>
            <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Disc %</th>
            <th style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "10px 10px", fontWeight: 500 }}>{l.description}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#888" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: "#0ea5e9", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#0ea5e9" }}><span style={{ color: "#333" }}>Grand Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ background: "#f0f9ff", borderRadius: 6, padding: 16, borderLeft: "3px solid #0ea5e9" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 11, color: "#0ea5e9", marginBottom: 4 }}>Scope Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, fontSize: 11, color: "#0ea5e9", marginBottom: 4 }}>Engagement Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "#ccc" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  11. Retail template                                                */
/* ------------------------------------------------------------------ */

function TplRetail({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Courier New', monospace", color: "#333", fontSize: 12, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
      <div style={{ textAlign: "center", paddingBottom: 16, marginBottom: 16, borderBottom: "2px dashed #ccc" }}>
        {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 36, marginBottom: 8, objectFit: "contain" }} />}
        <div style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase" }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 10, color: "#888" }}>QUOTATION RECEIPT</div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{q.number} | {tplStatusLabel(q.status)}</div>
      </div>
      <div style={{ marginBottom: 12, fontSize: 11, color: "#666" }}>
        <div>Date: {formatDate(q.issue_date)}</div>
        <div>Valid: {formatDate(q.valid_until)}</div>
        <div>Customer: {tplContactName(contact)}</div>
        {company && <div>Company: {company.name}</div>}
        {contact?.email && <div>Email: {contact.email}</div>}
        {contact?.phone && <div>Phone: {contact.phone}</div>}
      </div>
      <div style={{ borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "8px 0", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
          <span style={{ flex: 2 }}>Item</span><span style={{ width: 40, textAlign: "right" }}>Qty</span><span style={{ width: 70, textAlign: "right" }}>Price</span><span style={{ width: 80, textAlign: "right" }}>Total</span>
        </div>
        {lines.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dotted #eee" }}>
            <span style={{ flex: 2 }}>{l.description}{l.tax_rate > 0 ? ` +${l.tax_rate}%T` : ""}{l.discount_rate > 0 ? ` -${l.discount_rate}%D` : ""}</span>
            <span style={{ width: 40, textAlign: "right" }}>{l.quantity}</span>
            <span style={{ width: 70, textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</span>
            <span style={{ width: 80, textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right", marginBottom: 16, fontSize: 11 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, color: "#888" }}><span>Subtotal:</span><span style={{ width: 80, textAlign: "right", color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, color: "#888" }}><span>Tax:</span><span style={{ width: 80, textAlign: "right", color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, color: "#888" }}><span>Discount:</span><span style={{ width: 80, textAlign: "right", color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
        <div style={{ borderTop: "2px dashed #333", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "flex-end", gap: 24, fontSize: 16, fontWeight: 700 }}><span>TOTAL:</span><span style={{ width: 80, textAlign: "right" }}>{formatCurrency(q.total, cur)}</span></div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px dashed #ccc", paddingTop: 12, fontSize: 10, color: "#888" }}>
          {q.notes && <div style={{ marginBottom: 8 }}>{q.notes}</div>}
          {q.terms && <div style={{ fontStyle: "italic" }}>{q.terms}</div>}
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#ccc", borderTop: "2px dashed #ccc", paddingTop: 12 }}>Thank you! | {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  12. Creative template                                              */
/* ------------------------------------------------------------------ */

function TplCreative({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#333", fontSize: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 0, marginBottom: 32 }}>
        <div style={{ background: "#ff6b35", color: "#fff", padding: "32px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", opacity: 0.7 }}>Quote</div>
          <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>{q.number.replace("QUO-", "#")}</div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>{tplStatusLabel(q.status)}</div>
        </div>
        <div style={{ background: "#fef6f0", padding: "32px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#ff6b35" }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Issued {formatDate(q.issue_date)} | Valid until {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 28, paddingLeft: 20, borderLeft: "4px solid #ff6b35" }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#ff6b35", letterSpacing: 1, marginBottom: 4 }}>Client</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{tplContactName(contact)}</div>
        {company && <div style={{ color: "#888" }}>{company.name}</div>}
        {contact?.email && <div style={{ color: "#888", fontSize: 12 }}>{contact.email}</div>}
        {contact?.phone && <div style={{ color: "#888", fontSize: 12 }}>{contact.phone}</div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#ff6b35", color: "#fff" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>Deliverable</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Rate</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Tax</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Disc</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#fef6f0" }}>
              <td style={{ padding: "10px 12px", color: "#ff6b35", fontWeight: 700 }}>{l.position}</td>
              <td style={{ padding: "10px 12px" }}>{l.description}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#888" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#888" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#888" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 3, background: "#ff6b35", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 900, color: "#ff6b35" }}><span style={{ fontSize: 14, color: "#333" }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #eee", paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, color: "#ff6b35", fontSize: 11, marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#888" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, color: "#ff6b35", fontSize: 11, marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#888" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "#ccc" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  13. Legal template                                                 */
/* ------------------------------------------------------------------ */

function TplLegal({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", color: "#222", fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{org?.name ?? "Your Company"}</div>
        <div style={{ height: 1, background: "#222", margin: "12px 0" }} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>QUOTATION / ESTIMATE</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Document No. {q.number} | Status: {tplStatusLabel(q.status)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 12 }}>
        <div>
          <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>PREPARED FOR:</div>
          <div>{tplContactName(contact)}</div>
          {company && <div>{company.name}</div>}
          {contact?.email && <div>{contact.email}</div>}
          {contact?.phone && <div>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div><strong>Date of Issue:</strong> {formatDate(q.issue_date)}</div>
          <div><strong>Expiration Date:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 8, fontSize: 12 }}>SCHEDULE OF ITEMS:</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, border: "1px solid #222" }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "center", fontSize: 11 }}>Item No.</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "left", fontSize: 11 }}>Description of Services/Goods</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "center", fontSize: 11 }}>Quantity</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "right", fontSize: 11 }}>Unit Price</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "center", fontSize: 11 }}>Tax Rate</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", borderRight: "1px solid #ccc", textAlign: "center", fontSize: 11 }}>Discount</th>
            <th style={{ padding: "6px 8px", borderBottom: "2px solid #222", textAlign: "right", fontSize: 11 }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #ccc" }}>{l.position}.</td>
              <td style={{ padding: "6px 8px", borderRight: "1px solid #ccc" }}>{l.description}</td>
              <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #ccc" }}>{l.quantity}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #ccc" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #ccc" }}>{l.tax_rate}%</td>
              <td style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #ccc" }}>{l.discount_rate}%</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ width: 280, border: "1px solid #222" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid #ccc" }}><span>Subtotal:</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid #ccc" }}><span>Applicable Tax:</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1px solid #ccc" }}><span>Less Discount:</span><span>({formatCurrency(q.discount_total, cur)})</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", fontWeight: 700, background: "#f5f5f5", fontSize: 14 }}><span>TOTAL AMOUNT DUE:</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {q.notes && <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>NOTES:</div><div style={{ whiteSpace: "pre-wrap", color: "#444" }}>{q.notes}</div></div>}
      {q.terms && <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>TERMS AND CONDITIONS:</div><div style={{ whiteSpace: "pre-wrap", color: "#444" }}>{q.terms}</div></div>}
      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between" }}>
        <div style={{ width: 200, borderTop: "1px solid #222", paddingTop: 4, textAlign: "center", fontSize: 11 }}>Authorized Signature</div>
        <div style={{ width: 200, borderTop: "1px solid #222", paddingTop: 4, textAlign: "center", fontSize: 11 }}>Date</div>
      </div>
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#aaa" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  14. Medical template                                               */
/* ------------------------------------------------------------------ */

function TplMedical({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'Segoe UI', 'Roboto', sans-serif", color: "#333", fontSize: 13, lineHeight: 1.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 20, marginBottom: 20, borderBottom: "3px solid #059669" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#059669" }}>+</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>{org?.name ?? "Your Company"}</div>
            <div style={{ fontSize: 11, color: "#888" }}>Healthcare Quotation</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#888" }}>Ref: {q.number}</div>
          <div style={{ background: "#ecfdf5", color: "#059669", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, display: "inline-block" }}>{tplStatusLabel(q.status)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#059669", marginBottom: 6, letterSpacing: 1 }}>Patient / Client</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#666", fontSize: 12 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#888", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#888", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div style={{ background: "#f0fdf4", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#059669", marginBottom: 6, letterSpacing: 1 }}>Quotation Details</div>
          <div style={{ fontSize: 12 }}><strong>Date:</strong> {formatDate(q.issue_date)}</div>
          <div style={{ fontSize: 12 }}><strong>Valid Until:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#059669", color: "#fff" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600 }}>Service / Item</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Qty</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Rate</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Tax</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Disc</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#f0fdf4", borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "8px 12px" }}>{l.position}</td>
              <td style={{ padding: "8px 12px" }}>{l.description}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 260, background: "#f0fdf4", borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#666" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#666" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#666" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: "#059669", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#059669" }}><span style={{ color: "#333" }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 16 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, color: "#059669", fontSize: 11, marginBottom: 4 }}>Clinical Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, color: "#059669", fontSize: 11, marginBottom: 4 }}>Terms & Conditions</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 10, color: "#bbb" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  15. Tech template                                                  */
/* ------------------------------------------------------------------ */

function TplTech({ quotation: q, lines, organization: org, contact, company }: QuotationTemplateProps) {
  const cur = org?.currency ?? "INR";
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", color: "#e2e8f0", fontSize: 12, background: "#0f172a", padding: 32, borderRadius: 8, lineHeight: 1.6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #334155" }}>
        <div>
          <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 4 }}>{"// organization"}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 4 }}>{"// quotation"}</div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{q.number}</div>
          <div style={{ color: "#fbbf24", fontSize: 11 }}>[{tplStatusLabel(q.status).toUpperCase()}]</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#1e293b", padding: 16, borderRadius: 6, border: "1px solid #334155" }}>
          <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 6 }}>{"// client_info"}</div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{tplContactName(contact)}</div>
          {company && <div style={{ color: "#94a3b8" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#94a3b8", fontSize: 11 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#94a3b8", fontSize: 11 }}>{contact.phone}</div>}
        </div>
        <div style={{ background: "#1e293b", padding: 16, borderRadius: 6, border: "1px solid #334155" }}>
          <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 6 }}>{"// metadata"}</div>
          <div><span style={{ color: "#94a3b8" }}>issued:</span> <span style={{ color: "#a5f3fc" }}>{formatDate(q.issue_date)}</span></div>
          <div><span style={{ color: "#94a3b8" }}>expires:</span> <span style={{ color: "#a5f3fc" }}>{formatDate(q.valid_until)}</span></div>
        </div>
      </div>
      <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 8 }}>{"// line_items[]"}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #334155" }}>
            <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 10, color: "#94a3b8" }}>idx</th>
            <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 10, color: "#94a3b8" }}>description</th>
            <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: "#94a3b8" }}>qty</th>
            <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: "#94a3b8" }}>unit_price</th>
            <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: "#94a3b8" }}>tax_pct</th>
            <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: "#94a3b8" }}>disc_pct</th>
            <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 10, color: "#94a3b8" }}>total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #1e293b" }}>
              <td style={{ padding: "8px 8px", color: "#475569" }}>{l.position}</td>
              <td style={{ padding: "8px 8px", color: "#e2e8f0" }}>{l.description}</td>
              <td style={{ padding: "8px 8px", textAlign: "right", color: "#a5f3fc" }}>{l.quantity}</td>
              <td style={{ padding: "8px 8px", textAlign: "right", color: "#a5f3fc" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "8px 8px", textAlign: "right", color: "#fbbf24" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px 8px", textAlign: "right", color: "#fbbf24" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px 8px", textAlign: "right", color: "#22d3ee", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ width: 280, background: "#1e293b", borderRadius: 6, padding: 16, border: "1px solid #334155" }}>
          <div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 8 }}>{"// totals"}</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#94a3b8" }}><span>subtotal:</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#94a3b8" }}><span>tax:</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#94a3b8" }}><span>discount:</span><span style={{ color: "#e2e8f0" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "#334155", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}><span style={{ color: "#94a3b8" }}>grand_total:</span><span style={{ color: "#22d3ee" }}>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #334155", paddingTop: 16 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 4 }}>{"// notes"}</div><div style={{ whiteSpace: "pre-wrap", color: "#94a3b8" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ color: "#22d3ee", fontSize: 10, marginBottom: 4 }}>{"// terms"}</div><div style={{ whiteSpace: "pre-wrap", color: "#94a3b8" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#475569" }}>{"/* Generated by "}{org?.name ?? "WorkFyr CRM"}{" */"}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template registry                                                  */
/* ------------------------------------------------------------------ */

const TEMPLATE_COMPONENTS: Record<TemplateName, React.ComponentType<QuotationTemplateProps>> = {
  modern: TplModern,
  classic: TplClassic,
  bold: TplBold,
  compact: TplCompact,
  elegant: TplElegant,
  simple: TplSimple,
  corporate: TplCorporate,
  startup: TplStartup,
  freelancer: TplFreelancer,
  consulting: TplConsulting,
  retail: TplRetail,
  creative: TplCreative,
  legal: TplLegal,
  medical: TplMedical,
  tech: TplTech,
};

/* ------------------------------------------------------------------ */
/*  Preview Modal (with template selector)                             */
/* ------------------------------------------------------------------ */

function PreviewModal({
  quotation,
  lines,
  contacts,
  companies,
  org,
  currency,
  onClose,
}: {
  quotation: QuotationWithRelations;
  lines: QuotationLine[];
  contacts: Contact[];
  companies: Company[];
  org: Organization | null;
  currency: string;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>("modern");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const contact = quotation.contact ?? contacts.find((c) => c.id === quotation.contact_id) ?? null;
  const company = quotation.company ?? companies.find((c) => c.id === quotation.company_id) ?? null;

  const TemplateComponent = TEMPLATE_COMPONENTS[selectedTemplate];

  const templateProps: QuotationTemplateProps = {
    quotation,
    lines,
    organization: org ? { name: org.name, logo_url: org.logo_url, currency: org.currency } : null,
    contact: contact ? { first_name: contact.first_name, last_name: contact.last_name, email: contact.email, phone: contact.phone } : null,
    company: company ? { name: company.name } : null,
  };

  function handlePrint() {
    window.print();
  }

  const currentMeta = TEMPLATE_META.find((t) => t.key === selectedTemplate)!;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
        style={{ background: "rgba(15,23,42,0.5)" }}
        onClick={onClose}
      >
        {/* Modal container */}
        <div
          className="relative my-8 mx-4 w-full max-w-[800px] rounded-xl shadow-2xl"
          style={{ background: "var(--color-canvas)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-6 py-3 rounded-t-xl"
            style={{ background: "var(--color-surface-muted)", borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-3">
              <FileText className="size-4" style={{ color: "var(--color-viridian-700)" }} />
              <span className="text-[13px] font-semibold">Quotation Preview</span>
              {/* Template selector trigger */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setSelectorOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-secondary)", background: "var(--color-surface)" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--color-viridian-500)", display: "inline-block" }} />
                  {currentMeta.label}
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2, transform: selectorOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {/* Dropdown panel */}
                {selectorOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      width: 320,
                      maxHeight: 400,
                      overflowY: "auto",
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                      zIndex: 100,
                      padding: 6,
                    }}
                  >
                    <div style={{ padding: "6px 8px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--color-ink-tertiary)" }}>
                      Choose Template
                    </div>
                    {TEMPLATE_META.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => { setSelectedTemplate(t.key); setSelectorOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                        style={{
                          background: selectedTemplate === t.key ? "var(--color-viridian-50, #f0fdf4)" : "transparent",
                          border: selectedTemplate === t.key ? "1px solid var(--color-viridian-200, #bbf7d0)" : "1px solid transparent",
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: selectedTemplate === t.key ? "var(--color-viridian-500)" : "var(--color-surface-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: selectedTemplate === t.key ? "#fff" : "var(--color-ink-tertiary)",
                            flexShrink: 0,
                          }}
                        >
                          {t.label.charAt(0)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="text-[12px] font-semibold" style={{ color: "var(--color-ink)" }}>{t.label}</div>
                          <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>{t.desc}</div>
                        </div>
                        {selectedTemplate === t.key && (
                          <svg width="14" height="14" viewBox="0 0 14 14" style={{ color: "var(--color-viridian-600)", flexShrink: 0 }}>
                            <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" iconLeft={<Download className="size-3.5" />} onClick={handlePrint}>
                Print / PDF
              </Button>
              <button
                onClick={onClose}
                className="size-7 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <X className="size-4" style={{ color: "var(--color-ink-tertiary)" }} />
              </button>
            </div>
          </div>

          {/* Document body — rendered by selected template */}
          <div className="p-8 print:p-0" id="quotation-preview">
            <TemplateComponent {...templateProps} />
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#quotation-preview) { display: none !important; }
          .fixed { display: none !important; }
          #quotation-preview { position: static !important; }
        }
      `}</style>
    </>
  );
}
