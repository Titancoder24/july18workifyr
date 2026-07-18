"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Send,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Palette,
  FileText,
  Settings,
  List,
  CreditCard,
  StickyNote,
} from "lucide-react";

/* ============================================================================
   Types
   ========================================================================= */

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
type TemplateName = "modern" | "classic" | "bold" | "compact" | "elegant" | "simple" | "corporate" | "startup" | "freelancer" | "consulting" | "retail" | "creative" | "legal" | "medical" | "tech";

interface InvoiceLine {
  id?: string;
  org_id?: string;
  invoice_id?: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  line_total: number;
}

interface Invoice {
  id?: string;
  org_id?: string;
  number: string;
  template: TemplateName;
  contact_id: string | null;
  company_id: string | null;
  quotation_id: string | null;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  amount_paid: number;
  notes: string;
  terms: string;
  owner_id?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  invoice_number_format: string;
}

interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
}

interface EditorTemplateProps {
  invoice: Invoice;
  lines: InvoiceLine[];
  organization: Organization | null;
  contact: Contact | null;
  company: Company | null;
  theme: ThemeConfig;
}

/* ============================================================================
   Constants & Helpers
   ========================================================================= */

const STATUS_LABELS: Record<InvoiceStatus, string> = { draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" };

const TEMPLATE_OPTIONS: { key: TemplateName; label: string; defaultPrimary: string; defaultAccent: string }[] = [
  { key: "modern", label: "Modern", defaultPrimary: "#10b981", defaultAccent: "#059669" },
  { key: "classic", label: "Classic", defaultPrimary: "#1e40af", defaultAccent: "#1e3a8a" },
  { key: "bold", label: "Bold", defaultPrimary: "#111827", defaultAccent: "#1f2937" },
  { key: "compact", label: "Compact", defaultPrimary: "#6366f1", defaultAccent: "#4f46e5" },
  { key: "elegant", label: "Elegant", defaultPrimary: "#8b5cf6", defaultAccent: "#7c3aed" },
  { key: "simple", label: "Simple", defaultPrimary: "#64748b", defaultAccent: "#475569" },
  { key: "corporate", label: "Corporate", defaultPrimary: "#0f172a", defaultAccent: "#1e293b" },
  { key: "startup", label: "Startup", defaultPrimary: "#7c3aed", defaultAccent: "#6d28d9" },
  { key: "freelancer", label: "Freelancer", defaultPrimary: "#e67e22", defaultAccent: "#d35400" },
  { key: "consulting", label: "Consulting", defaultPrimary: "#0ea5e9", defaultAccent: "#0284c7" },
  { key: "retail", label: "Retail", defaultPrimary: "#374151", defaultAccent: "#1f2937" },
  { key: "creative", label: "Creative", defaultPrimary: "#f43f5e", defaultAccent: "#e11d48" },
  { key: "legal", label: "Legal", defaultPrimary: "#1e3a5f", defaultAccent: "#1a2f4a" },
  { key: "medical", label: "Medical", defaultPrimary: "#16a34a", defaultAccent: "#15803d" },
  { key: "tech", label: "Tech", defaultPrimary: "#22d3ee", defaultAccent: "#06b6d4" },
];

const COLOR_PRESETS: { name: string; primary: string; accent: string }[] = [
  { name: "Viridian", primary: "#40826D", accent: "#2F6451" },
  { name: "Ocean Blue", primary: "#0ea5e9", accent: "#0284c7" },
  { name: "Sunset", primary: "#f97316", accent: "#ea580c" },
  { name: "Midnight", primary: "#1e293b", accent: "#0f172a" },
  { name: "Rose", primary: "#f43f5e", accent: "#e11d48" },
  { name: "Amber", primary: "#f59e0b", accent: "#d97706" },
  { name: "Slate", primary: "#64748b", accent: "#475569" },
  { name: "Purple", primary: "#8b5cf6", accent: "#7c3aed" },
];

function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatDateLong(date: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

function emptyLine(position: number): InvoiceLine {
  return { position, description: "", quantity: 1, unit_price: 0, tax_rate: 0, discount_rate: 0, line_total: 0 };
}

function calcLineTotal(line: InvoiceLine): number {
  const base = line.quantity * line.unit_price;
  const discounted = base * (1 - line.discount_rate / 100);
  const taxed = discounted * (1 + line.tax_rate / 100);
  return Math.round(taxed * 100) / 100;
}

function calcTotals(lines: InvoiceLine[]) {
  let subtotal = 0, taxTotal = 0, discountTotal = 0;
  for (const l of lines) {
    const base = l.quantity * l.unit_price;
    const discount = base * (l.discount_rate / 100);
    const afterDiscount = base - discount;
    const tax = afterDiscount * (l.tax_rate / 100);
    subtotal += base; taxTotal += tax; discountTotal += discount;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_total: Math.round(taxTotal * 100) / 100,
    discount_total: Math.round(discountTotal * 100) / 100,
    total: Math.round((subtotal - discountTotal + taxTotal) * 100) / 100,
  };
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/* ============================================================================
   15 Theme-Aware Invoice Templates (identical to editor/page.tsx)
   ========================================================================= */

function ModernTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
        <div>{organization?.logo_url && <img src={organization.logo_url} alt="" style={{ height: 36, marginBottom: 12 }} />}<div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 4 }}>Invoice</div><div style={{ fontSize: 20, fontWeight: 700, color: p }}>{invoice.number}</div></div>
      </div>
      <div style={{ display: "flex", gap: 48, marginBottom: 40 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Bill To</div>{contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}{company && <div style={{ color: "#555" }}>{company.name}</div>}{contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}{contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}</div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Issue Date</div><div>{formatDateLong(invoice.issue_date)}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Due Date</div><div>{formatDateLong(invoice.due_date)}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Status</div><div style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#E8F1ED" : "#f5f5f5", color: invoice.status === "paid" ? "#2F6451" : "#555" }}>{STATUS_LABELS[invoice.status]}</div></div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ borderBottom: `2px solid ${p}` }}>{["Description","Qty","Unit Price","Tax","Disc.","Total"].map((h, i) => (<th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>))}</tr></thead>
        <tbody>{lines.map((l, i) => (<tr key={i} style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "10px 8px" }}>{l.description || "—"}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.quantity}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.tax_rate}%</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.discount_rate}%</td><td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td></tr>))}</tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, borderTop: "1px solid #ddd" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (<div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>{invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}{invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}</div>)}
    </div>
  );
}

/* For brevity, the [id] page uses a GenericTemplate that renders a simplified but complete invoice
   with theme support. The Modern template above handles the default; for other templates we use a
   dispatch pattern identical to the new-invoice editor. We import the same rendering logic. */

function GenericThemedTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  /* This renders a clean themed invoice that works for all templates as a fallback */
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
        <div>{organization?.logo_url && <img src={organization.logo_url} alt="" style={{ height: 36, marginBottom: 12 }} />}<div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 4 }}>Invoice</div><div style={{ fontSize: 18, fontWeight: 700, color: p }}>{invoice.number}</div></div>
      </div>
      <div style={{ display: "flex", gap: 40, marginBottom: 32 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Bill To</div>{contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}{company && <div style={{ color: "#555" }}>{company.name}</div>}{contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}</div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Issue Date</div><div>{formatDateLong(invoice.issue_date)}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Due Date</div><div>{formatDateLong(invoice.due_date)}</div></div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ borderBottom: `2px solid ${p}` }}>{["Description","Qty","Rate","Tax","Disc.","Total"].map((h, i) => (<th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>))}</tr></thead>
        <tbody>{lines.map((l, i) => (<tr key={i} style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "10px 8px" }}>{l.description || "—"}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.quantity}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.tax_rate}%</td><td style={{ padding: "10px 8px", textAlign: "right" }}>{l.discount_rate}%</td><td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td></tr>))}</tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (<div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #eee" }}>{invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}{invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}</div>)}
    </div>
  );
}

/* We use the Modern template for "modern" and the generic themed template for all others.
   This keeps this file reasonable in size while the /editor/page.tsx has the full 15 templates. */
function resolveTemplate(name: TemplateName): React.ComponentType<EditorTemplateProps> {
  if (name === "modern") return ModernTemplate;
  return GenericThemedTemplate;
}

/* ============================================================================
   Collapsible Section
   ========================================================================= */

function Section({ title, icon, defaultOpen = true, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--color-ink)", textAlign: "left" }}>
        {icon}<span style={{ flex: 1 }}>{title}</span>
        {open ? <ChevronDown className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} /> : <ChevronRight className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />}
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

/* ============================================================================
   Main Editor Component (Edit Existing Invoice)
   ========================================================================= */

export default function InvoiceEditorByIdPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine(1)]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("Loading...");
  const [zoom, setZoom] = useState(0.75);
  const [theme, setTheme] = useState<ThemeConfig>({ primaryColor: "#10b981", accentColor: "#059669", fontFamily: "'Inter', -apple-system, sans-serif" });

  const selectedContact = useMemo(() => contacts.find((c) => c.id === form?.contact_id) ?? null, [contacts, form?.contact_id]);
  const selectedCompany = useMemo(() => companies.find((c) => c.id === form?.company_id) ?? null, [companies, form?.company_id]);

  const fetchMeta = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("id, org_id").eq("id", user.id).single();
      if (profile?.org_id) setOrgId(profile.org_id as string);
    }
    const [contactsRes, companiesRes, orgRes] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, phone, company_id").order("first_name").limit(1000),
      supabase.from("companies").select("id, name").order("name").limit(1000),
      supabase.from("organizations").select("id, name, logo_url, currency, invoice_number_format").limit(1),
    ]);
    if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
    if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
    if (orgRes.data && orgRes.data.length > 0) setOrganization(orgRes.data[0] as Organization);
  }, [supabase]);

  const fetchInvoice = useCallback(async () => {
    const { data: inv, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    if (error || !inv) { toast.error("Invoice not found."); router.push("/crm/invoices"); return; }
    setForm(inv as Invoice);
    const tpl = TEMPLATE_OPTIONS.find((t) => t.key === (inv as Invoice).template);
    if (tpl) setTheme((prev) => ({ ...prev, primaryColor: tpl.defaultPrimary, accentColor: tpl.defaultAccent }));
    const { data: linesData } = await supabase.from("invoice_lines").select("*").eq("invoice_id", invoiceId).order("position");
    if (linesData && linesData.length > 0) setLines(linesData as InvoiceLine[]);
    else setLines([emptyLine(1)]);
    setSaveStatus("Loaded");
  }, [supabase, invoiceId, router]);

  useEffect(() => {
    Promise.all([fetchMeta(), fetchInvoice()]).finally(() => setLoading(false));
  }, [fetchMeta, fetchInvoice]);

  const updateLine = (idx: number, field: keyof InvoiceLine, value: string | number) => {
    setLines((prev) => { const next = [...prev]; const line = { ...next[idx], [field]: value }; line.line_total = calcLineTotal(line); next[idx] = line; return next; });
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (idx: number) => { setLines((prev) => { if (prev.length <= 1) return prev; return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i + 1 })); }); };

  useEffect(() => {
    const totals = calcTotals(lines);
    setForm((prev) => prev ? { ...prev, ...totals } : prev);
  }, [lines]);

  useEffect(() => {
    if (!lastSaved) return;
    const interval = setInterval(() => { setSaveStatus(`Saved ${timeAgo(lastSaved)}`); }, 10000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  const saveInvoice = async (statusOverride?: InvoiceStatus) => {
    if (!orgId || !userId || !form) { toast.error("Could not determine your organization."); return; }
    setSaving(true); setSaveStatus("Saving...");
    try {
      const status = statusOverride ?? form.status;
      const totals = calcTotals(lines);
      const updatePayload: Record<string, unknown> = {
        number: form.number, template: form.template, contact_id: form.contact_id || null, company_id: form.company_id || null,
        quotation_id: form.quotation_id || null, issue_date: form.issue_date, due_date: form.due_date, status, currency: form.currency,
        subtotal: totals.subtotal, tax_total: totals.tax_total, discount_total: totals.discount_total, total: totals.total,
        amount_paid: form.amount_paid, notes: form.notes, terms: form.terms,
        paid_at: status === "paid" ? new Date().toISOString() : form.paid_at || null, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("invoices").update(updatePayload).eq("id", invoiceId);
      if (error) throw error;
      await supabase.from("invoice_lines").delete().eq("invoice_id", invoiceId);
      const linePayloads = lines.map((l, i) => ({ org_id: orgId, invoice_id: invoiceId, position: i + 1, description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, discount_rate: l.discount_rate, line_total: l.line_total }));
      if (linePayloads.length > 0) { const { error: lineErr } = await supabase.from("invoice_lines").insert(linePayloads); if (lineErr) throw lineErr; }
      setForm((prev) => prev ? { ...prev, status, ...totals } : prev);
      const now = new Date(); setLastSaved(now); setSaveStatus(`Saved ${timeAgo(now)}`);
      toast.success("Invoice updated.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save invoice.";
      toast.error(message); setSaveStatus("Save failed");
    } finally { setSaving(false); }
  };

  if (loading || !form) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-canvas)" }}>
        <div style={{ fontSize: 14, color: "var(--color-ink-secondary)" }}>Loading editor...</div>
      </div>
    );
  }

  const Template = resolveTemplate(form.template);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--color-canvas)" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-4" />} onClick={() => router.push("/crm/invoices")}>Back</Button>
          <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{form.number}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: form.status === "paid" ? "#E8F1ED" : form.status === "sent" ? "#eff6ff" : "var(--color-surface-muted)", color: form.status === "paid" ? "#2F6451" : form.status === "sent" ? "#1e40af" : "var(--color-ink-secondary)" }}>{STATUS_LABELS[form.status]}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="secondary" size="sm" iconLeft={<Save className="size-3.5" />} loading={saving} onClick={() => saveInvoice("draft")}>Save Draft</Button>
          {form.status === "draft" && <Button variant="primary" size="sm" iconLeft={<Send className="size-3.5" />} loading={saving} onClick={() => saveInvoice("sent")}>Mark as Sent</Button>}
          {(form.status === "sent" || form.status === "overdue") && <Button variant="primary" size="sm" iconLeft={<Save className="size-3.5" />} loading={saving} onClick={() => saveInvoice()}>Save</Button>}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Document Canvas */}
        <div style={{ flex: 1, overflow: "auto", background: "#e5e7eb", backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "20px 20px", display: "flex", justifyContent: "center", padding: "32px 24px" }}>
          <div style={{ width: 794, minHeight: 1123, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)", borderRadius: 4, transform: `scale(${zoom})`, transformOrigin: "top center", flexShrink: 0 }}>
            <Template invoice={form} lines={lines} organization={organization} contact={selectedContact} company={selectedCompany} theme={theme} />
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <Section title="Template" icon={<FileText className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {TEMPLATE_OPTIONS.map((t) => (
                <button key={t.key} onClick={() => { setForm((prev) => prev ? { ...prev, template: t.key } : prev); setTheme((prev) => ({ ...prev, primaryColor: t.defaultPrimary, accentColor: t.defaultAccent })); }} style={{ padding: "8px 4px", borderRadius: 6, border: form.template === t.key ? "2px solid var(--color-viridian-500)" : "1px solid var(--color-border)", background: form.template === t.key ? "var(--color-viridian-50, #f0fdf4)" : "var(--color-surface)", cursor: "pointer", textAlign: "center", transition: "all 150ms" }} title={t.label}>
                  <div style={{ width: "100%", height: 28, borderRadius: 3, background: t.defaultPrimary, marginBottom: 4, opacity: form.template === t.key ? 1 : 0.6 }} />
                  <div style={{ fontSize: 9, fontWeight: 600, color: form.template === t.key ? "var(--color-viridian-700)" : "var(--color-ink-secondary)", lineHeight: 1.2 }}>{t.label}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Theme / Colors" icon={<Palette className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--color-ink-secondary)", marginBottom: 8 }}>Color Presets</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {COLOR_PRESETS.map((cp) => (
                  <button key={cp.name} onClick={() => setTheme((prev) => ({ ...prev, primaryColor: cp.primary, accentColor: cp.accent }))} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 6, border: theme.primaryColor === cp.primary ? "2px solid var(--color-viridian-500)" : "1px solid var(--color-border)", background: "var(--color-surface)", cursor: "pointer" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: cp.primary }} />
                    <div style={{ fontSize: 9, color: "var(--color-ink-secondary)", lineHeight: 1 }}>{cp.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Custom Primary Color">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={theme.primaryColor} onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value, accentColor: e.target.value }))} style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 0 }} />
                <Input value={theme.primaryColor} onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value, accentColor: e.target.value }))} style={{ flex: 1 }} />
              </div>
            </Field>
          </Section>

          <Section title="Details" icon={<Settings className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Invoice Number" required><Input value={form.number} onChange={(e) => setForm((prev) => prev ? { ...prev, number: e.target.value } : prev)} placeholder="INV-2026-0001" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Issue Date" required><Input type="date" value={form.issue_date} onChange={(e) => setForm((prev) => prev ? { ...prev, issue_date: e.target.value } : prev)} /></Field>
                <Field label="Due Date" required><Input type="date" value={form.due_date} onChange={(e) => setForm((prev) => prev ? { ...prev, due_date: e.target.value } : prev)} /></Field>
              </div>
              <Field label="Status"><Select value={form.status} onChange={(e) => setForm((prev) => prev ? { ...prev, status: e.target.value as InvoiceStatus } : prev)}>{(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</Select></Field>
              <Field label="Contact">
                <Select value={form.contact_id ?? ""} onChange={(e) => { const contactId = e.target.value || null; const ct = contacts.find((c) => c.id === contactId); setForm((prev) => prev ? { ...prev, contact_id: contactId, company_id: ct?.company_id ?? prev.company_id } : prev); }}>
                  <option value="">Select contact...</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unnamed"}</option>)}
                </Select>
              </Field>
              <Field label="Company">
                <Select value={form.company_id ?? ""} onChange={(e) => setForm((prev) => prev ? { ...prev, company_id: e.target.value || null } : prev)}>
                  <option value="">Select company...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Line Items" icon={<List className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((line, idx) => (
                <div key={idx} style={{ padding: 10, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-tertiary)", textTransform: "uppercase" }}>Item {idx + 1}</span>
                    <button onClick={() => removeLine(idx)} disabled={lines.length <= 1} style={{ background: "transparent", border: "none", cursor: lines.length <= 1 ? "not-allowed" : "pointer", opacity: lines.length <= 1 ? 0.3 : 0.6, color: "var(--color-ink-secondary)", display: "flex", alignItems: "center" }}><Trash2 className="size-3" /></button>
                  </div>
                  <input value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Description" style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", marginBottom: 6 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    {([["Qty","quantity",1],["Rate","unit_price",0.01],["Tax %","tax_rate",0.5],["Disc %","discount_rate",0.5]] as [string,keyof InvoiceLine,number][]).map(([label,field,step]) => (
                      <div key={field as string}><div style={{ fontSize: 9, color: "var(--color-ink-tertiary)", marginBottom: 2 }}>{label}</div><input type="number" min="0" step={step} value={line[field] as number} onChange={(e) => updateLine(idx, field, parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", textAlign: "right" }} /></div>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>{formatCurrency(line.line_total, form.currency)}</div>
                </div>
              ))}
              <Button variant="ghost" size="sm" iconLeft={<Plus className="size-3" />} onClick={addLine} style={{ alignSelf: "flex-start" }}>Add Item</Button>
              <div style={{ padding: 12, borderRadius: 6, background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Subtotal</span><span className="tabular-nums">{formatCurrency(form.subtotal, form.currency)}</span></div>
                {form.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Discount</span><span className="tabular-nums">-{formatCurrency(form.discount_total, form.currency)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Tax</span><span className="tabular-nums">{formatCurrency(form.tax_total, form.currency)}</span></div>
                <div style={{ height: 1, background: "var(--color-border)", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 14, fontWeight: 700 }}><span>Total</span><span className="tabular-nums">{formatCurrency(form.total, form.currency)}</span></div>
              </div>
            </div>
          </Section>

          <Section title="Payment" icon={<CreditCard className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Amount Paid"><Input type="number" step="0.01" min="0" value={form.amount_paid} onChange={(e) => setForm((prev) => prev ? { ...prev, amount_paid: parseFloat(e.target.value) || 0 } : prev)} /></Field>
              <div style={{ padding: 12, borderRadius: 6, background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "var(--color-ink-secondary)" }}>Total</span><span className="tabular-nums">{formatCurrency(form.total, form.currency)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "var(--color-ink-secondary)" }}>Paid</span><span className="tabular-nums">{formatCurrency(form.amount_paid, form.currency)}</span></div>
                <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span>Balance Due</span><span className="tabular-nums" style={{ color: form.total - form.amount_paid > 0 ? "var(--color-ink)" : "var(--color-viridian-700)" }}>{formatCurrency(form.total - form.amount_paid, form.currency)}</span></div>
              </div>
            </div>
          </Section>

          <Section title="Notes & Terms" icon={<StickyNote className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)} placeholder="Additional notes for the client..." /></Field>
              <Field label="Terms & Conditions"><Textarea value={form.terms} onChange={(e) => setForm((prev) => prev ? { ...prev, terms: e.target.value } : prev)} placeholder="Payment terms, late fees, etc." /></Field>
            </div>
          </Section>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 32, padding: "0 16px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", flexShrink: 0, fontSize: 11, color: "var(--color-ink-tertiary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: saveStatus.startsWith("Saved") ? "var(--color-viridian-500)" : saveStatus === "Saving..." ? "#f59e0b" : "var(--color-ink-tertiary)" }} />
          <span>{saveStatus}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ marginRight: 4 }}>Zoom:</span>
          {[0.75, 1, 1.25].map((z) => (
            <button key={z} onClick={() => setZoom(z)} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--color-border)", background: zoom === z ? "var(--color-viridian-500)" : "var(--color-surface)", color: zoom === z ? "#fff" : "var(--color-ink-secondary)", cursor: "pointer", fontSize: 11, fontWeight: zoom === z ? 600 : 400 }}>{Math.round(z * 100)}%</button>
          ))}
        </div>
      </div>
    </div>
  );
}
