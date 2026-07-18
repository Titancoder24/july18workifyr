"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Download,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
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

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateLong(date: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function dueDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

function emptyLine(position: number): InvoiceLine {
  return {
    position,
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    discount_rate: 0,
    line_total: 0,
  };
}

function calcLineTotal(line: InvoiceLine): number {
  const base = line.quantity * line.unit_price;
  const discounted = base * (1 - line.discount_rate / 100);
  const taxed = discounted * (1 + line.tax_rate / 100);
  return Math.round(taxed * 100) / 100;
}

function calcTotals(lines: InvoiceLine[]) {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;
  for (const l of lines) {
    const base = l.quantity * l.unit_price;
    const discount = base * (l.discount_rate / 100);
    const afterDiscount = base - discount;
    const tax = afterDiscount * (l.tax_rate / 100);
    subtotal += base;
    taxTotal += tax;
    discountTotal += discount;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_total: Math.round(taxTotal * 100) / 100,
    discount_total: Math.round(discountTotal * 100) / 100,
    total: Math.round((subtotal - discountTotal + taxTotal) * 100) / 100,
  };
}

async function generateInvoiceNumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("invoices")
    .select("number")
    .like("number", `${prefix}%`)
    .order("number", { ascending: false })
    .limit(1);
  let next = 1;
  if (data && data.length > 0) {
    const last = (data[0] as { number: string }).number;
    const num = parseInt(last.replace(prefix, ""), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function blankInvoice(): Invoice {
  return {
    number: "",
    template: "modern",
    contact_id: null,
    company_id: null,
    quotation_id: null,
    issue_date: todayStr(),
    due_date: dueDateStr(),
    status: "draft",
    currency: "INR",
    subtotal: 0,
    tax_total: 0,
    discount_total: 0,
    total: 0,
    amount_paid: 0,
    notes: "",
    terms: "Payment due within 30 days of invoice date.",
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
   15 Theme-Aware Invoice Templates
   ========================================================================= */

function ModernTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
        <div>
          {organization?.logo_url && <img src={organization.logo_url} alt="" style={{ height: 36, marginBottom: 12 }} />}
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 4 }}>Invoice</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: p }}>{invoice.number}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 48, marginBottom: 40 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Bill To</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Issue Date</div>
          <div>{formatDateLong(invoice.issue_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Due Date</div>
          <div>{formatDateLong(invoice.due_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Status</div>
          <div style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#E8F1ED" : invoice.status === "overdue" ? "#fef3f2" : "#f5f5f5", color: invoice.status === "paid" ? "#2F6451" : invoice.status === "overdue" ? "#b42318" : "#555" }}>{STATUS_LABELS[invoice.status]}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${p}` }}>
            {["Description","Qty","Unit Price","Tax","Disc.","Total"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 8px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, borderTop: "1px solid #ddd" }}><span>Balance Due</span><span style={{ color: invoice.total - invoice.amount_paid > 0 ? "#b42318" : p }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
          {invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function ClassicTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#2c2c2c", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 24, borderBottom: `2px double ${p}` }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: p }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 16, fontStyle: "italic", marginTop: 8, color: "#666", letterSpacing: 3, textTransform: "uppercase" }}>Invoice</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoice To:</div>
          {contactName && <div style={{ fontWeight: 600, fontSize: 14 }}>{contactName}</div>}
          {company && <div>{company.name}</div>}
          {contact?.email && <div>{contact.email}</div>}
          {contact?.phone && <div>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 8 }}><span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoice No: </span><span>{invoice.number}</span></div>
          <div style={{ marginBottom: 4 }}><span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Date: </span><span>{formatDateLong(invoice.issue_date)}</span></div>
          <div><span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Due: </span><span>{formatDateLong(invoice.due_date)}</span></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr>
          {["Description","Qty","Rate","Tax","Discount","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : i === 1 ? "center" : "right", padding: "10px 6px", borderTop: `2px solid ${p}`, borderBottom: `1px solid ${p}`, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd" }}>{l.description || "—"}</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "center" }}>{l.quantity}</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px 6px", borderBottom: "1px solid #ddd", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Subtotal:</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Discount:</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Tax:</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 15, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total:</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Paid:</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #999", fontSize: 14 }}><span>Balance Due:</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `2px double ${p}` }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Notes</div><div style={{ fontStyle: "italic", color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Terms & Conditions</div><div style={{ fontStyle: "italic", color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function BoldTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#111", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      <div style={{ background: p, color: "#fff", margin: -40, marginBottom: 0, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, opacity: 0.6, marginBottom: 4 }}>Invoice</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{invoice.number}</div>
        </div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Your Company"}</div></div>
      </div>
      <div style={{ background: "#f8f8f8", margin: "0 -40px", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#999", marginBottom: 2 }}>Amount Due</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#999", marginBottom: 2 }}>Due Date</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{formatDateLong(invoice.due_date)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 40, marginBottom: 32 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#999", marginBottom: 6 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 700, fontSize: 15 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#999", marginBottom: 6 }}>Issued</div>
          <div style={{ fontWeight: 600 }}>{formatDateLong(invoice.issue_date)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ background: p, color: "#fff" }}>
          {["Item","Qty","Price","Tax","Disc.","Total"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
              <td style={{ padding: "10px", fontWeight: 500 }}>{l.description || "—"}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Subtotal</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Discount</span><span style={{ fontWeight: 600 }}>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Tax</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 20, fontWeight: 800, borderTop: `3px solid ${p}`, marginTop: 4 }}><span>Total</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Amount Paid</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: `2px solid ${p}` }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `3px solid ${p}` }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function CompactTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#222", fontSize: 11, lineHeight: 1.5, padding: 32, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${p}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: p }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>INVOICE {invoice.number}</div>
          <div style={{ color: "#777", fontSize: 10, marginTop: 2 }}>Issued: {formatDateLong(invoice.issue_date)} | Due: {formatDateLong(invoice.due_date)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 16, display: "flex", gap: 32 }}>
        <div><span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999" }}>Bill To: </span><span style={{ fontWeight: 600 }}>{contactName || "—"}</span>{company && <span style={{ color: "#555" }}> / {company.name}</span>}{contact?.email && <span style={{ color: "#777" }}> — {contact.email}</span>}</div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 11 }}>
        <thead><tr style={{ background: "#f5f5f5" }}>
          {["Description","Qty","Rate","Tax%","Disc%","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : i === 1 ? "center" : "right", padding: "6px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: p, borderBottom: `1px solid ${p}` }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "5px 6px" }}>{l.description || "—"}</td>
              <td style={{ padding: "5px 4px", textAlign: "center" }}>{l.quantity}</td>
              <td style={{ padding: "5px 4px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "5px 4px", textAlign: "right" }}>{l.tax_rate}</td>
              <td style={{ padding: "5px 4px", textAlign: "right" }}>{l.discount_rate}</td>
              <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 240, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, fontSize: 13, borderTop: `2px solid ${p}`, marginTop: 2 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, fontSize: 12, borderTop: "1px solid #bbb" }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #ddd", fontSize: 10, color: "#555" }}>
          {invoice.notes && <div style={{ marginBottom: 8 }}><strong>Notes:</strong> {invoice.notes}</div>}
          {invoice.terms && <div><strong>Terms:</strong> {invoice.terms}</div>}
        </div>
      )}
    </div>
  );
}

function ElegantTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 4, color: "#999", marginBottom: 8 }}>Invoice</div>
        <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: 2 }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ width: 40, height: 1, background: p, margin: "16px auto" }} />
        <div style={{ fontSize: 14, fontWeight: 300, letterSpacing: 1, color: "#666" }}>{invoice.number}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 8 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 500 }}>{contactName}</div>}
          {company && <div style={{ color: "#666", fontWeight: 300 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666", fontWeight: 300 }}>{contact.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 8 }}><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 4 }}>Issue Date</div><div style={{ fontWeight: 300 }}>{formatDateLong(invoice.issue_date)}</div></div>
          <div><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 4 }}>Due Date</div><div style={{ fontWeight: 300 }}>{formatDateLong(invoice.due_date)}</div></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 36 }}>
        <thead><tr>
          {["Description","Qty","Rate","Tax","Disc.","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", fontWeight: 400 }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 300 }}>{l.quantity}</td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 300 }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 300 }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 300 }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 8px", borderBottom: "1px solid #f0f0f0", textAlign: "right", fontWeight: 500 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ width: "100%", height: 1, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 16, fontWeight: 500, letterSpacing: 0.5 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 500, fontSize: 14, borderTop: "1px solid #e0e0e0" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48 }}>
          <div style={{ width: 40, height: 1, background: p, marginBottom: 20 }} />
          {invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 6 }}>Notes</div><div style={{ color: "#666", fontWeight: 300, whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 6 }}>Terms & Conditions</div><div style={{ color: "#666", fontWeight: 300, whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function SimpleTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 13, color: p }}>Invoice {invoice.number}</div>
      </div>
      <div style={{ display: "flex", gap: 60, marginBottom: 36 }}>
        <div><div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Bill to</div>{contactName && <div style={{ fontWeight: 500 }}>{contactName}</div>}{company && <div style={{ color: "#666" }}>{company.name}</div>}{contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}</div>
        <div><div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Issued</div><div>{formatDateLong(invoice.issue_date)}</div></div>
        <div><div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Due</div><div>{formatDateLong(invoice.due_date)}</div></div>
      </div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", padding: "8px 0", marginBottom: 4 }}>
          <div style={{ flex: 1, fontSize: 11, color: "#999" }}>Description</div>
          <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "#999" }}>Qty</div>
          <div style={{ width: 90, textAlign: "right", fontSize: 11, color: "#999" }}>Rate</div>
          <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "#999" }}>Tax</div>
          <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "#999" }}>Disc.</div>
          <div style={{ width: 100, textAlign: "right", fontSize: 11, color: "#999" }}>Amount</div>
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", padding: "8px 0" }}>
            <div style={{ flex: 1 }}>{l.description || "—"}</div>
            <div style={{ width: 50, textAlign: "right" }}>{l.quantity}</div>
            <div style={{ width: 90, textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</div>
            <div style={{ width: 50, textAlign: "right" }}>{l.tax_rate}%</div>
            <div style={{ width: 50, textAlign: "right" }}>{l.discount_rate}%</div>
            <div style={{ width: 100, textAlign: "right", fontWeight: 500 }}>{formatCurrency(l.line_total, invoice.currency)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, fontWeight: 600, fontSize: 15 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600, fontSize: 14 }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40 }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function CorporateTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a2e", fontSize: 13, lineHeight: 1.6, minHeight: 800 }}>
      <div style={{ background: p, color: "#fff", padding: "36px 44px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {organization?.logo_url && <img src={organization.logo_url} alt="" style={{ height: 40, borderRadius: 4 }} />}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{organization?.name ?? "Your Company"}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2, textTransform: "uppercase", letterSpacing: 2 }}>Invoice</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{invoice.number}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{formatDateLong(invoice.issue_date)}</div>
        </div>
      </div>
      <div style={{ padding: "32px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 6, borderBottom: `2px solid ${p}`, paddingBottom: 4, display: "inline-block" }}>Bill To</div>
            {contactName && <div style={{ fontWeight: 600, marginTop: 8 }}>{contactName}</div>}
            {company && <div style={{ color: "#555" }}>{company.name}</div>}
            {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Due Date: </span><span style={{ fontWeight: 600 }}>{formatDateLong(invoice.due_date)}</span></div>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#e6f4ea" : "#f0f2f5", color: invoice.status === "paid" ? "#1a7f37" : p }}>{STATUS_LABELS[invoice.status]}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead><tr style={{ background: p, color: "#fff" }}>
            {["Description","Qty","Rate","Tax","Disc.","Amount"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#f8f9fb" : "#fff" }}>
                <td style={{ padding: "10px 12px" }}>{l.description || "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
            {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
            {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #ccc" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
          </div>
        </div>
        {(invoice.notes || invoice.terms) && (
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
            {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
            {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function StartupTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  const a = theme.accentColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#2d2d3f", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      <div style={{ background: `linear-gradient(135deg, ${p} 0%, ${a} 100%)`, borderRadius: 16, color: "#fff", padding: "32px 36px", marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Invoice {invoice.number}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Amount Due</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
        <div style={{ flex: 1, background: `${p}11`, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: `${p}11`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Issued</div>
            <div style={{ fontWeight: 500 }}>{formatDateLong(invoice.issue_date)}</div>
          </div>
          <div style={{ background: `${p}11`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Due</div>
            <div style={{ fontWeight: 500 }}>{formatDateLong(invoice.due_date)}</div>
          </div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", marginBottom: 28 }}>
        <thead><tr>
          {["Description","Qty","Price","Tax","Disc.","Total"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ background: "#f9fafb", borderRadius: 8 }}>
              <td style={{ padding: "10px 14px", borderRadius: "8px 0 0 8px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 14px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, borderRadius: "0 8px 8px 0" }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280, background: `${p}11`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 6 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: `1px solid ${p}44` }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 36, padding: "20px 24px", background: "#f9fafb", borderRadius: 12 }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function FreelancerTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 48, minHeight: 800 }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1 }}>{organization?.name ?? "Your Name"}</div>
        <div style={{ width: 60, height: 4, background: p, marginTop: 12, marginBottom: 12, borderRadius: 2 }} />
        <div style={{ fontSize: 13, color: "#888", fontWeight: 400 }}>Invoice {invoice.number} &middot; {formatDateLong(invoice.issue_date)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 8 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 600, fontSize: 15 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 8 }}>Payment Due</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{formatDateLong(invoice.due_date)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ borderBottom: `3px solid ${p}` }}>
          {["Service / Item","Qty","Rate","Tax","Disc.","Total"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 8px", fontWeight: 500 }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: `3px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
          {invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function ConsultingTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 44, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottom: `3px solid ${p}` }}>
        <div><div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Your Company"}</div><div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Consulting Services</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p }}>Invoice</div><div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{invoice.number}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Client</div>{contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}{company && <div style={{ color: "#555" }}>{company.name}</div>}{contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}</div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Period</div><div>{formatDateLong(invoice.issue_date)}</div><div style={{ color: "#888", fontSize: 11 }}>to {formatDateLong(invoice.due_date)}</div></div>
        <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 6 }}>Status</div><div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${p}18`, color: p }}>{STATUS_LABELS[invoice.status]}</div></div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ background: `${p}12` }}>
          {["Service Description","Hours/Qty","Rate/Hr","Tax","Disc.","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: p, borderBottom: `2px solid ${p}` }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "10px 10px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 500 }}>{l.quantity}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300, background: `${p}0a`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 6 }}><span>Total Due</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: `1px solid ${p}44` }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function RetailTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", color: "#1a1a1a", fontSize: 12, lineHeight: 1.5, padding: "32px 48px", minHeight: 800, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `2px dashed ${p}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{organization?.name ?? "Store Name"}</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>TAX INVOICE / RECEIPT</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{invoice.number}</div>
      </div>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px dashed ${p}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Date:</span><span>{formatDateLong(invoice.issue_date)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Due:</span><span>{formatDateLong(invoice.due_date)}</span></div>
        {contactName && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span>Customer:</span><span>{contactName}</span></div>}
        {company && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Company:</span><span>{company.name}</span></div>}
      </div>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px dashed ${p}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${p}` }}>
          <span style={{ flex: 1 }}>ITEM</span><span style={{ width: 40, textAlign: "right" }}>QTY</span><span style={{ width: 80, textAlign: "right" }}>PRICE</span><span style={{ width: 80, textAlign: "right" }}>TOTAL</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description || "—"}</span>
            <span style={{ width: 40, textAlign: "right" }}>{l.quantity}</span><span style={{ width: 80, textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</span><span style={{ width: 80, textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `2px dashed ${p}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>SUBTOTAL</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
        {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>DISCOUNT</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>TAX</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 16, borderTop: `1px solid ${p}`, marginTop: 4 }}><span>TOTAL</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
        {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>PAID</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: `1px dashed ${p}` }}><span>BALANCE DUE</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
        {invoice.notes && <div style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{invoice.notes}</div>}
        {invoice.terms && <div style={{ whiteSpace: "pre-wrap", fontSize: 10 }}>{invoice.terms}</div>}
        <div style={{ marginTop: 16, letterSpacing: 1 }}>*** THANK YOU ***</div>
      </div>
    </div>
  );
}

function CreativeTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  const a = theme.accentColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, minHeight: 800 }}>
      <div style={{ display: "flex", minHeight: 140 }}>
        <div style={{ width: 8, background: `linear-gradient(180deg, ${p}, ${a})`, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 3, color: p, marginBottom: 8 }}>Invoice</div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{organization?.name ?? "Studio Name"}</div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 32, fontWeight: 800, color: p, letterSpacing: -1 }}>{invoice.number}</div><div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{formatDateLong(invoice.issue_date)}</div></div>
        </div>
      </div>
      <div style={{ padding: "24px 48px 40px 48px" }}>
        <div style={{ display: "flex", gap: 60, marginBottom: 36 }}>
          <div style={{ flex: 2 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 6 }}>Client</div>{contactName && <div style={{ fontWeight: 600, fontSize: 15 }}>{contactName}</div>}{company && <div style={{ color: "#666" }}>{company.name}</div>}{contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}</div>
          <div style={{ flex: 1, textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 6 }}>Due</div><div style={{ fontSize: 16, fontWeight: 700 }}>{formatDateLong(invoice.due_date)}</div></div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead><tr>
            {["Deliverable","Qty","Rate","Tax","Disc.","Amount"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, borderBottom: `2px solid ${p}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 10px", fontWeight: 500 }}>{l.description || "—"}</td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
            {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
            {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: `1px solid ${p}44` }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
          </div>
        </div>
        {(invoice.notes || invoice.terms) && (
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
            {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
            {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function LegalTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1a1a1a", fontSize: 12, lineHeight: 1.8, padding: 48, minHeight: 800 }}>
      <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 16, borderBottom: `3px double ${p}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: 3, color: p }}>{organization?.name ?? "Law Firm Name"}</div>
        <div style={{ fontSize: 14, fontStyle: "italic", marginTop: 8, color: "#444" }}>Statement of Account / Invoice</div>
      </div>
      <div style={{ marginBottom: 24, fontSize: 12 }}>
        <p style={{ marginBottom: 8 }}><strong>1. Invoice Reference:</strong> {invoice.number}</p>
        <p style={{ marginBottom: 8 }}><strong>2. Date of Issue:</strong> {formatDateLong(invoice.issue_date)}</p>
        <p style={{ marginBottom: 8 }}><strong>3. Payment Due Date:</strong> {formatDateLong(invoice.due_date)}</p>
        <p style={{ marginBottom: 8 }}><strong>4. Status:</strong> {STATUS_LABELS[invoice.status]}</p>
        <p style={{ marginBottom: 4 }}><strong>5. Client Details:</strong></p>
        <div style={{ paddingLeft: 24, marginBottom: 8 }}>{contactName && <div>{contactName}</div>}{company && <div>{company.name}</div>}{contact?.email && <div>{contact.email}</div>}</div>
      </div>
      <p style={{ marginBottom: 8, fontWeight: 700 }}>6. Schedule of Services Rendered:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, border: `1px solid ${p}` }}>
        <thead><tr style={{ background: "#f5f5f0" }}>
          {["Description of Services","Qty","Rate","Tax %","Disc %","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: `2px solid ${p}`, borderRight: i < 5 ? "1px solid #ccc" : "none" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", borderRight: "1px solid #ddd" }}>{l.description || "—"}</td>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", borderRight: "1px solid #ddd", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", borderRight: "1px solid #ddd", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", borderRight: "1px solid #ddd", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", borderRight: "1px solid #ddd", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "7px 8px", borderBottom: "1px solid #ddd", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Subtotal:</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Less Discount:</span><span>({formatCurrency(invoice.discount_total, invoice.currency)})</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Applicable Tax:</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 14, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total Due:</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Less Payments Received:</span><span>({formatCurrency(invoice.amount_paid, invoice.currency)})</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #999" }}><span>Outstanding Balance:</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 36, paddingTop: 16, borderTop: `3px double ${p}` }}>
          {invoice.notes && <p style={{ marginBottom: 8 }}><strong>7. Additional Notes:</strong> <span style={{ fontStyle: "italic" }}>{invoice.notes}</span></p>}
          {invoice.terms && <p><strong>{invoice.notes ? "8" : "7"}. Terms and Conditions:</strong> <span style={{ fontStyle: "italic" }}>{invoice.terms}</span></p>}
        </div>
      )}
    </div>
  );
}

function MedicalTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 44, minHeight: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottom: `2px solid ${p}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: p, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700 }}>+</div>
          <div><div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Medical Practice"}</div><div style={{ fontSize: 11, color: "#888" }}>Healthcare Services Invoice</div></div>
        </div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p }}>Invoice No.</div><div style={{ fontSize: 18, fontWeight: 700 }}>{invoice.number}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div style={{ background: `${p}0f`, borderRadius: 8, padding: "16px 20px", border: `1px solid ${p}33` }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 8 }}>Patient / Client</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555", fontSize: 12 }}>{contact.email}</div>}
        </div>
        <div style={{ background: `${p}0f`, borderRadius: 8, padding: "16px 20px", border: `1px solid ${p}33` }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 8 }}>Invoice Details</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#666" }}>Issue Date:</span><span style={{ fontWeight: 500 }}>{formatDateLong(invoice.issue_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#666" }}>Due Date:</span><span style={{ fontWeight: 500 }}>{formatDateLong(invoice.due_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Status:</span><span style={{ fontWeight: 600, color: invoice.status === "paid" ? p : "#1a1a1a" }}>{STATUS_LABELS[invoice.status]}</span></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ background: `${p}12` }}>
          {["Service / Procedure","Qty","Rate","Tax","Disc.","Amount"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: p, borderBottom: `2px solid ${p}` }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "10px 10px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 4 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: `1px solid ${p}44` }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TechTemplate({ invoice, lines, organization, contact, company, theme }: EditorTemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace", color: "#e2e8f0", fontSize: 12, lineHeight: 1.6, padding: 40, minHeight: 800, background: "#0f172a" }}>
      <div style={{ marginBottom: 32, padding: "20px 24px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><span style={{ color: p }}>$ </span><span style={{ color: "#a5f3fc", fontWeight: 700 }}>{organization?.name ?? "DevCo"}</span><span style={{ color: "#64748b" }}> // invoice</span></div>
          <div style={{ color: p, fontWeight: 700, fontSize: 14 }}>{invoice.number}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        <div style={{ padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 8 }}>// client</div>
          {contactName && <div style={{ color: "#f1f5f9", fontWeight: 500 }}>{contactName}</div>}
          {company && <div style={{ color: "#94a3b8" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#94a3b8" }}>{contact.email}</div>}
        </div>
        <div style={{ padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: p, marginBottom: 8 }}>// details</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#64748b" }}>issued:</span><span style={{ color: "#f1f5f9" }}>{formatDateLong(invoice.issue_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#64748b" }}>due:</span><span style={{ color: "#f1f5f9" }}>{formatDateLong(invoice.due_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748b" }}>status:</span><span style={{ color: invoice.status === "paid" ? "#4ade80" : invoice.status === "overdue" ? "#f87171" : "#fbbf24", fontWeight: 600 }}>{invoice.status}</span></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead><tr style={{ borderBottom: `2px solid ${p}` }}>
          {["description","qty","rate","tax","disc","total"].map((h, i) => (
            <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
              <td style={{ padding: "10px 10px", color: "#e2e8f0" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", color: "#94a3b8" }}>{l.quantity}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", color: "#94a3b8" }}>{formatCurrency(l.unit_price, invoice.currency)}</td>
              <td style={{ padding: "10px 10px", textAlign: "right", color: "#94a3b8" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right", color: "#94a3b8" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px 10px", textAlign: "right", color: "#f1f5f9", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300, padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>subtotal</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>discount</span><span style={{ color: "#fb923c" }}>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>tax</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${p}`, marginTop: 6 }}><span style={{ color: p }}>total</span><span style={{ color: p }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (<><div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>paid</span><span style={{ color: "#4ade80" }}>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div><div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #334155" }}><span style={{ color: "#fbbf24" }}>balance</span><span style={{ color: "#fbbf24" }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div></>)}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 32, padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>// notes</div><div style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, marginBottom: 4 }}>// terms</div><div style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

const TEMPLATE_COMPONENTS: Record<TemplateName, React.ComponentType<EditorTemplateProps>> = {
  modern: ModernTemplate,
  classic: ClassicTemplate,
  bold: BoldTemplate,
  compact: CompactTemplate,
  elegant: ElegantTemplate,
  simple: SimpleTemplate,
  corporate: CorporateTemplate,
  startup: StartupTemplate,
  freelancer: FreelancerTemplate,
  consulting: ConsultingTemplate,
  retail: RetailTemplate,
  creative: CreativeTemplate,
  legal: LegalTemplate,
  medical: MedicalTemplate,
  tech: TechTemplate,
};

/* ============================================================================
   Collapsible Section
   ========================================================================= */

function Section({ title, icon, defaultOpen = true, children }: { title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-ink)",
          textAlign: "left",
        }}
      >
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {open ? <ChevronDown className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} /> : <ChevronRight className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />}
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

/* ============================================================================
   Main Editor Component
   ========================================================================= */

export default function InvoiceEditorPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  /* ---- State ---- */
  const [form, setForm] = useState<Invoice>(blankInvoice());
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine(1)]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("Unsaved");
  const [zoom, setZoom] = useState(0.75);

  /* Theme state */
  const [theme, setTheme] = useState<ThemeConfig>({
    primaryColor: "#10b981",
    accentColor: "#059669",
    fontFamily: "'Inter', -apple-system, sans-serif",
  });

  /* ---- Computed ---- */
  const selectedContact = useMemo(() => contacts.find((c) => c.id === form.contact_id) ?? null, [contacts, form.contact_id]);
  const selectedCompany = useMemo(() => companies.find((c) => c.id === form.company_id) ?? null, [companies, form.company_id]);

  /* ---- Fetch data ---- */
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

  useEffect(() => {
    async function init() {
      await fetchMeta();
      const number = await generateInvoiceNumber(supabase);
      setForm((prev) => ({ ...prev, number }));
      setLoading(false);
    }
    init();
  }, [fetchMeta, supabase]);

  /* ---- Line item helpers ---- */
  const updateLine = (idx: number, field: keyof InvoiceLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      line.line_total = calcLineTotal(line);
      next[idx] = line;
      return next;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (idx: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i + 1 }));
    });
  };

  /* Recalculate totals */
  useEffect(() => {
    const totals = calcTotals(lines);
    setForm((prev) => ({ ...prev, ...totals }));
  }, [lines]);

  /* Update save status timer */
  useEffect(() => {
    if (!lastSaved) return;
    const interval = setInterval(() => {
      setSaveStatus(`Saved ${timeAgo(lastSaved)}`);
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  /* Update theme when template changes */
  useEffect(() => {
    const tpl = TEMPLATE_OPTIONS.find((t) => t.key === form.template);
    if (tpl) {
      setTheme((prev) => ({
        ...prev,
        primaryColor: tpl.defaultPrimary,
        accentColor: tpl.defaultAccent,
      }));
    }
  }, [form.template]);

  /* ---- Save ---- */
  const saveInvoice = async (statusOverride?: InvoiceStatus) => {
    if (!orgId || !userId) { toast.error("Could not determine your organization."); return; }
    setSaving(true);
    setSaveStatus("Saving...");
    try {
      const status = statusOverride ?? form.status;
      const totals = calcTotals(lines);
      const payload: Record<string, unknown> = {
        number: form.number,
        template: form.template,
        contact_id: form.contact_id || null,
        company_id: form.company_id || null,
        quotation_id: form.quotation_id || null,
        issue_date: form.issue_date,
        due_date: form.due_date,
        status,
        currency: form.currency,
        subtotal: totals.subtotal,
        tax_total: totals.tax_total,
        discount_total: totals.discount_total,
        total: totals.total,
        amount_paid: form.amount_paid,
        notes: form.notes,
        terms: form.terms,
        paid_at: status === "paid" ? new Date().toISOString() : form.paid_at || null,
        updated_at: new Date().toISOString(),
        org_id: orgId,
        owner_id: userId,
      };

      if (editingId) {
        const { org_id: _o, owner_id: _u, ...updatePayload } = payload;
        const { error } = await supabase.from("invoices").update(updatePayload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("invoice_lines").delete().eq("invoice_id", editingId);
        const linePayloads = lines.map((l, i) => ({
          org_id: orgId,
          invoice_id: editingId,
          position: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount_rate: l.discount_rate,
          line_total: l.line_total,
        }));
        if (linePayloads.length > 0) {
          const { error: lineErr } = await supabase.from("invoice_lines").insert(linePayloads);
          if (lineErr) throw lineErr;
        }
        toast.success("Invoice updated.");
      } else {
        const { data, error } = await supabase.from("invoices").insert(payload).select("id").single();
        if (error) throw error;
        const invoiceId = (data as { id: string }).id;
        setEditingId(invoiceId);
        const linePayloads = lines.map((l, i) => ({
          org_id: orgId,
          invoice_id: invoiceId,
          position: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          discount_rate: l.discount_rate,
          line_total: l.line_total,
        }));
        if (linePayloads.length > 0) {
          const { error: lineErr } = await supabase.from("invoice_lines").insert(linePayloads);
          if (lineErr) throw lineErr;
        }
        toast.success("Invoice created.");
        router.replace(`/crm/invoices/editor/${invoiceId}`);
      }
      setForm((prev) => ({ ...prev, status: statusOverride ?? prev.status, ...totals }));
      const now = new Date();
      setLastSaved(now);
      setSaveStatus(`Saved ${timeAgo(now)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save invoice.";
      toast.error(message);
      setSaveStatus("Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ---- Template Renderer ---- */
  const Template = TEMPLATE_COMPONENTS[form.template] ?? ModernTemplate;

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-canvas)" }}>
        <div style={{ fontSize: 14, color: "var(--color-ink-secondary)" }}>Loading editor...</div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", background: "var(--color-canvas)" }}>
      {/* ---- Top Bar ---- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        padding: "0 16px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" size="sm" iconLeft={<ArrowLeft className="size-4" />} onClick={() => router.push("/crm/invoices")}>
            Back
          </Button>
          <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{form.number || "New Invoice"}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              background: form.status === "paid" ? "#E8F1ED" : form.status === "sent" ? "#eff6ff" : "var(--color-surface-muted)",
              color: form.status === "paid" ? "#2F6451" : form.status === "sent" ? "#1e40af" : "var(--color-ink-secondary)",
            }}>{STATUS_LABELS[form.status]}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Save className="size-3.5" />}
            loading={saving}
            onClick={() => saveInvoice("draft")}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Download className="size-3.5" />}
            onClick={() => window.print()}
          >
            Download
          </Button>
          {(form.status === "sent" || form.status === "overdue") && (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Save className="size-3.5" />}
              loading={saving}
              onClick={() => saveInvoice()}
            >
              Save
            </Button>
          )}
        </div>
      </div>

      {/* ---- Main Content ---- */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ---- Document Canvas ---- */}
        <div style={{
          flex: 1,
          overflow: "auto",
          background: "#e5e7eb",
          backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          display: "flex",
          justifyContent: "center",
          padding: "32px 24px",
        }}>
          <div data-print-area style={{
            width: 794,
            minHeight: 1123,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)",
            borderRadius: 4,
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            flexShrink: 0,
          }}>
            <Template
              invoice={form}
              lines={lines}
              organization={organization}
              contact={selectedContact}
              company={selectedCompany}
              theme={theme}
            />
          </div>
        </div>

        {/* ---- Right Panel ---- */}
        <div style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Template Section */}
          <Section title="Template" icon={<FileText className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setForm((prev) => ({ ...prev, template: t.key }))}
                  style={{
                    padding: "8px 4px",
                    borderRadius: 6,
                    border: form.template === t.key ? "2px solid var(--color-viridian-500)" : "1px solid var(--color-border)",
                    background: form.template === t.key ? "var(--color-viridian-50, #f0fdf4)" : "var(--color-surface)",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 150ms",
                  }}
                  title={t.label}
                >
                  <div style={{
                    width: "100%",
                    height: 28,
                    borderRadius: 3,
                    background: t.defaultPrimary,
                    marginBottom: 4,
                    opacity: form.template === t.key ? 1 : 0.6,
                  }} />
                  <div style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: form.template === t.key ? "var(--color-viridian-700)" : "var(--color-ink-secondary)",
                    lineHeight: 1.2,
                  }}>{t.label}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* Theme Section */}
          <Section title="Theme / Colors" icon={<Palette className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--color-ink-secondary)", marginBottom: 8 }}>Color Presets</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {COLOR_PRESETS.map((cp) => (
                  <button
                    key={cp.name}
                    onClick={() => setTheme((prev) => ({ ...prev, primaryColor: cp.primary, accentColor: cp.accent }))}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: "8px 4px",
                      borderRadius: 6,
                      border: theme.primaryColor === cp.primary ? "2px solid var(--color-viridian-500)" : "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: cp.primary }} />
                    <div style={{ fontSize: 9, color: "var(--color-ink-secondary)", lineHeight: 1 }}>{cp.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <Field label="Custom Primary Color">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value, accentColor: e.target.value }))}
                  style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", padding: 0 }}
                />
                <Input
                  value={theme.primaryColor}
                  onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value, accentColor: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </Field>
          </Section>

          {/* Details Section */}
          <Section title="Details" icon={<Settings className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Invoice Number" required>
                <Input value={form.number} onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))} placeholder="INV-2026-0001" />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="Issue Date" required>
                  <Input type="date" value={form.issue_date} onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))} />
                </Field>
                <Field label="Due Date" required>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))} />
                </Field>
              </div>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as InvoiceStatus }))}>
                  {(Object.keys(STATUS_LABELS) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </Select>
              </Field>
              <Field label="Contact">
                <Select
                  value={form.contact_id ?? ""}
                  onChange={(e) => {
                    const contactId = e.target.value || null;
                    const contact = contacts.find((c) => c.id === contactId);
                    setForm((prev) => ({ ...prev, contact_id: contactId, company_id: contact?.company_id ?? prev.company_id }));
                  }}
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unnamed"}</option>)}
                </Select>
              </Field>
              <Field label="Company">
                <Select value={form.company_id ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, company_id: e.target.value || null }))}>
                  <option value="">Select company...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
          </Section>

          {/* Line Items Section */}
          <Section title="Line Items" icon={<List className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((line, idx) => (
                <div key={idx} style={{ padding: 10, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-muted)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-tertiary)", textTransform: "uppercase" }}>Item {idx + 1}</span>
                    <button
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 1}
                      style={{ background: "transparent", border: "none", cursor: lines.length <= 1 ? "not-allowed" : "pointer", opacity: lines.length <= 1 ? 0.3 : 0.6, color: "var(--color-ink-secondary)", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    placeholder="Description"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", marginBottom: 6 }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--color-ink-tertiary)", marginBottom: 2 }}>Qty</div>
                      <input type="number" min="0" step="1" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--color-ink-tertiary)", marginBottom: 2 }}>Rate</div>
                      <input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--color-ink-tertiary)", marginBottom: 2 }}>Tax %</div>
                      <input type="number" min="0" max="100" step="0.5" value={line.tax_rate} onChange={(e) => updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", textAlign: "right" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--color-ink-tertiary)", marginBottom: 2 }}>Disc %</div>
                      <input type="number" min="0" max="100" step="0.5" value={line.discount_rate} onChange={(e) => updateLine(idx, "discount_rate", parseFloat(e.target.value) || 0)} style={{ width: "100%", padding: "4px 6px", fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 4, outline: "none", color: "var(--color-ink)", textAlign: "right" }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 6, textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>
                    {formatCurrency(line.line_total, form.currency)}
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" iconLeft={<Plus className="size-3" />} onClick={addLine} style={{ alignSelf: "flex-start" }}>
                Add Item
              </Button>
              {/* Totals */}
              <div style={{ padding: 12, borderRadius: 6, background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Subtotal</span><span className="tabular-nums">{formatCurrency(form.subtotal, form.currency)}</span></div>
                {form.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Discount</span><span className="tabular-nums">-{formatCurrency(form.discount_total, form.currency)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12 }}><span style={{ color: "var(--color-ink-secondary)" }}>Tax</span><span className="tabular-nums">{formatCurrency(form.tax_total, form.currency)}</span></div>
                <div style={{ height: 1, background: "var(--color-border)", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 14, fontWeight: 700 }}><span>Total</span><span className="tabular-nums">{formatCurrency(form.total, form.currency)}</span></div>
              </div>
            </div>
          </Section>

          {/* Payment Section */}
          <Section title="Payment" icon={<CreditCard className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Amount Paid">
                <Input type="number" step="0.01" min="0" value={form.amount_paid} onChange={(e) => setForm((prev) => ({ ...prev, amount_paid: parseFloat(e.target.value) || 0 }))} />
              </Field>
              <div style={{ padding: 12, borderRadius: 6, background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "var(--color-ink-secondary)" }}>Total</span><span className="tabular-nums">{formatCurrency(form.total, form.currency)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ color: "var(--color-ink-secondary)" }}>Paid</span><span className="tabular-nums">{formatCurrency(form.amount_paid, form.currency)}</span></div>
                <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                  <span>Balance Due</span>
                  <span className="tabular-nums" style={{ color: form.total - form.amount_paid > 0 ? "var(--color-ink)" : "var(--color-viridian-700)" }}>
                    {formatCurrency(form.total - form.amount_paid, form.currency)}
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* Notes & Terms Section */}
          <Section title="Notes & Terms" icon={<StickyNote className="size-3.5" style={{ color: "var(--color-ink-secondary)" }} />} defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Notes">
                <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes for the client..." />
              </Field>
              <Field label="Terms & Conditions">
                <Textarea value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} placeholder="Payment terms, late fees, etc." />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {/* ---- Status Bar ---- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 32,
        padding: "0 16px",
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        flexShrink: 0,
        fontSize: 11,
        color: "var(--color-ink-tertiary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: saveStatus.startsWith("Saved") ? "var(--color-viridian-500)" : saveStatus === "Saving..." ? "#f59e0b" : "var(--color-ink-tertiary)",
          }} />
          <span>{saveStatus}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ marginRight: 4 }}>Zoom:</span>
          {[0.75, 1, 1.25].map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              style={{
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--color-border)",
                background: zoom === z ? "var(--color-viridian-500)" : "var(--color-surface)",
                color: zoom === z ? "#fff" : "var(--color-ink-secondary)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: zoom === z ? 600 : 400,
              }}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          [data-print-area], [data-print-area] * { visibility: visible !important; }
          [data-print-area] {
            position: fixed !important;
            left: 0 !important; top: 0 !important;
            width: 100vw !important; height: auto !important;
            transform: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
