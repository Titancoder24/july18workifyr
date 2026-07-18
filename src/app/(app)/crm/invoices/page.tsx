"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader, PageContainer } from "@/components/ui/page-header";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  Trash2,
  Eye,
  Send,
  Save,
  CreditCard,
  Copy,
  Printer,
  X,
  PenLine,
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

interface Quotation {
  id: string;
  number: string;
  contact_id: string | null;
  company_id: string | null;
  status: string;
  total: number;
  notes: string | null;
  terms: string | null;
}

interface QuotationLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  line_total: number;
}

/* ============================================================================
   Constants & Helpers
   ========================================================================= */

const TEMPLATE_OPTIONS: { key: TemplateName; label: string; desc: string }[] = [
  { key: "modern", label: "Modern", desc: "Clean, minimal, viridian accent" },
  { key: "classic", label: "Classic", desc: "Traditional, serif, formal" },
  { key: "bold", label: "Bold", desc: "Large numbers, strong headers" },
  { key: "compact", label: "Compact", desc: "Dense, fits more items" },
  { key: "elegant", label: "Elegant", desc: "Thin borders, refined" },
  { key: "simple", label: "Simple", desc: "Ultra-minimal, no borders" },
  { key: "corporate", label: "Corporate", desc: "Dark navy header, formal" },
  { key: "startup", label: "Startup", desc: "Colorful, rounded, playful" },
  { key: "freelancer", label: "Freelancer", desc: "Personal branding focused" },
  { key: "consulting", label: "Consulting", desc: "Hourly rate, time-tracking" },
  { key: "retail", label: "Retail", desc: "Receipt-style, product list" },
  { key: "creative", label: "Creative", desc: "Asymmetric, agency feel" },
  { key: "legal", label: "Legal", desc: "Dense, formal, numbered" },
  { key: "medical", label: "Medical", desc: "Clean clinical, provider info" },
  { key: "tech", label: "Tech", desc: "Monospace, dark, developer" },
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
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

/* ============================================================================
   Invoice Templates
   ========================================================================= */

interface TemplateProps {
  invoice: Invoice;
  lines: InvoiceLine[];
  organization: Organization | null;
  contact: Contact | null;
  company: Company | null;
}

function ModernTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
        <div>
          {organization?.logo_url && <img src={organization.logo_url} alt="" style={{ height: 36, marginBottom: 12 }} />}
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#40826D", marginBottom: 4 }}>Invoice</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#40826D" }}>{invoice.number}</div>
        </div>
      </div>

      {/* Meta row */}
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
          <div style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: invoice.status === "paid" ? "#E8F1ED" : invoice.status === "overdue" ? "#fef3f2" : "#f5f5f5",
            color: invoice.status === "paid" ? "#2F6451" : invoice.status === "overdue" ? "#b42318" : "#555",
          }}>{STATUS_LABELS[invoice.status]}</div>
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #40826D" }}>
            <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Description</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Unit Price</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#40826D" }}>Total</th>
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

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
            <span style={{ color: "#666" }}>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          {invoice.discount_total > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "#666" }}>Discount</span>
              <span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
            <span style={{ color: "#666" }}>Tax</span>
            <span>{formatCurrency(invoice.tax_total, invoice.currency)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #40826D", marginTop: 4 }}>
            <span>Total</span>
            <span style={{ color: "#40826D" }}>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: "#666" }}>Paid</span>
                <span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, borderTop: "1px solid #ddd" }}>
                <span>Balance Due</span>
                <span style={{ color: invoice.total - invoice.amount_paid > 0 ? "#b42318" : "#40826D" }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes / Terms */}
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
          {invoice.notes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Notes</div>
              <div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div>
            </div>
          )}
          {invoice.terms && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 4 }}>Terms & Conditions</div>
              <div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClassicTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#2c2c2c", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40, paddingBottom: 24, borderBottom: "2px double #333" }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 16, fontStyle: "italic", marginTop: 8, color: "#666", letterSpacing: 3, textTransform: "uppercase" }}>Invoice</div>
      </div>

      {/* Invoice info */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoice To:</div>
          {contactName && <div style={{ fontWeight: 600, fontSize: 14 }}>{contactName}</div>}
          {company && <div>{company.name}</div>}
          {contact?.email && <div>{contact.email}</div>}
          {contact?.phone && <div>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Invoice No: </span>
            <span>{invoice.number}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Date: </span>
            <span>{formatDateLong(invoice.issue_date)}</span>
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Due: </span>
            <span>{formatDateLong(invoice.due_date)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Description</th>
            <th style={{ textAlign: "center", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Rate</th>
            <th style={{ textAlign: "right", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Discount</th>
            <th style={{ textAlign: "right", padding: "10px 6px", borderTop: "2px solid #333", borderBottom: "1px solid #999", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Amount</th>
          </tr>
        </thead>
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

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Subtotal:</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Discount:</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Tax:</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 15, borderTop: "2px solid #333", marginTop: 4 }}><span>Total:</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span>Paid:</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #999", fontSize: 14 }}><span>Balance Due:</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "2px double #333" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Notes</div><div style={{ fontStyle: "italic", color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Terms & Conditions</div><div style={{ fontStyle: "italic", color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function BoldTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#111", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      {/* Header */}
      <div style={{ background: "#111", color: "#fff", margin: -40, marginBottom: 0, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, opacity: 0.6, marginBottom: 4 }}>Invoice</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{invoice.number}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Your Company"}</div>
        </div>
      </div>

      {/* Total banner */}
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

      {/* Client info */}
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

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ background: "#111", color: "#fff" }}>
            <th style={{ textAlign: "left", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Item</th>
            <th style={{ textAlign: "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Price</th>
            <th style={{ textAlign: "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Tax</th>
            <th style={{ textAlign: "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "12px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Total</th>
          </tr>
        </thead>
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

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Subtotal</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Discount</span><span style={{ fontWeight: 600 }}>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Tax</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 20, fontWeight: 800, borderTop: "3px solid #111", marginTop: 4 }}><span>Total</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: "#666" }}>Amount Paid</span><span style={{ fontWeight: 600 }}>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: "2px solid #111" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "3px solid #111" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function CompactTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#222", fontSize: 11, lineHeight: 1.5, padding: 32, minHeight: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #ddd" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{organization?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>INVOICE {invoice.number}</div>
          <div style={{ color: "#777", fontSize: 10, marginTop: 2 }}>Issued: {formatDate(invoice.issue_date)} | Due: {formatDate(invoice.due_date)}</div>
        </div>
      </div>

      {/* Client */}
      <div style={{ marginBottom: 16, display: "flex", gap: 32 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#999" }}>Bill To: </span>
          <span style={{ fontWeight: 600 }}>{contactName || "—"}</span>
          {company && <span style={{ color: "#555" }}> / {company.name}</span>}
          {contact?.email && <span style={{ color: "#777" }}> — {contact.email}</span>}
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign: "left", padding: "6px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd" }}>Description</th>
            <th style={{ textAlign: "center", padding: "6px 4px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd", width: 40 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd", width: 80 }}>Rate</th>
            <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd", width: 44 }}>Tax%</th>
            <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd", width: 44 }}>Disc%</th>
            <th style={{ textAlign: "right", padding: "6px 6px", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#555", borderBottom: "1px solid #ddd", width: 90 }}>Amount</th>
          </tr>
        </thead>
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

      {/* Totals — compact style, single row */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 240, fontSize: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, fontSize: 13, borderTop: "2px solid #222", marginTop: 2 }}><span>Total</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#777" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, fontSize: 12, borderTop: "1px solid #bbb" }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
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

function ElegantTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#333", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: 4, color: "#999", marginBottom: 8 }}>Invoice</div>
        <div style={{ fontSize: 22, fontWeight: 300, letterSpacing: 2 }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ width: 40, height: 1, background: "#40826D", margin: "16px auto" }} />
        <div style={{ fontSize: 14, fontWeight: 300, letterSpacing: 1, color: "#666" }}>{invoice.number}</div>
      </div>

      {/* Info */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 8 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 500 }}>{contactName}</div>}
          {company && <div style={{ color: "#666", fontWeight: 300 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666", fontWeight: 300 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#666", fontWeight: 300 }}>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 4 }}>Issue Date</div>
            <div style={{ fontWeight: 300 }}>{formatDateLong(invoice.issue_date)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 4 }}>Due Date</div>
            <div style={{ fontWeight: 300 }}>{formatDateLong(invoice.due_date)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 36 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Description</th>
            <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Rate</th>
            <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "12px 8px", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", borderBottom: "1px solid #e0e0e0" }}>Amount</th>
          </tr>
        </thead>
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

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ width: "100%", height: 1, background: "#40826D", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 16, fontWeight: 500, letterSpacing: 0.5 }}><span>Total</span><span style={{ color: "#40826D" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 300 }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 500, fontSize: 14, borderTop: "1px solid #e0e0e0" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>

      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48 }}>
          <div style={{ width: 40, height: 1, background: "#40826D", marginBottom: 20 }} />
          {invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 6 }}>Notes</div><div style={{ color: "#666", fontWeight: 300, whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: 2, color: "#aaa", marginBottom: 6 }}>Terms & Conditions</div><div style={{ color: "#666", fontWeight: 300, whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function SimpleTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#333", fontSize: 13, lineHeight: 1.7, padding: 48, minHeight: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{organization?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 13, color: "#888" }}>Invoice {invoice.number}</div>
      </div>

      {/* Info */}
      <div style={{ display: "flex", gap: 60, marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Bill to</div>
          {contactName && <div style={{ fontWeight: 500 }}>{contactName}</div>}
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Issued</div>
          <div>{formatDateLong(invoice.issue_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Due</div>
          <div>{formatDateLong(invoice.due_date)}</div>
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom: 32 }}>
        {/* Header row */}
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

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", marginTop: 4, fontWeight: 600, fontSize: 15 }}><span>Total</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 600, fontSize: 14 }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
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

function CorporateTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a2e", fontSize: 13, lineHeight: 1.6, minHeight: 800 }}>
      {/* Navy header */}
      <div style={{ background: "#0f1b3d", color: "#fff", padding: "36px 44px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
      {/* Body */}
      <div style={{ padding: "32px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#0f1b3d", marginBottom: 6, borderBottom: "2px solid #0f1b3d", paddingBottom: 4, display: "inline-block" }}>Bill To</div>
            {contactName && <div style={{ fontWeight: 600, marginTop: 8 }}>{contactName}</div>}
            {company && <div style={{ color: "#555" }}>{company.name}</div>}
            {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
            {contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Due Date: </span><span style={{ fontWeight: 600 }}>{formatDateLong(invoice.due_date)}</span></div>
            <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#e6f4ea" : invoice.status === "overdue" ? "#fef3f2" : "#f0f2f5", color: invoice.status === "paid" ? "#1a7f37" : invoice.status === "overdue" ? "#b42318" : "#0f1b3d" }}>{STATUS_LABELS[invoice.status]}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr style={{ background: "#0f1b3d", color: "#fff" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Description</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Qty</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Rate</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Tax</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Disc.</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Amount</th>
            </tr>
          </thead>
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
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #0f1b3d", marginTop: 4 }}><span>Total</span><span style={{ color: "#0f1b3d" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
            {invoice.amount_paid > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #ccc" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
              </>
            )}
          </div>
        </div>
        {(invoice.notes || invoice.terms) && (
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
            {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0f1b3d", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
            {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0f1b3d", marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function StartupTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#2d2d3f", fontSize: 13, lineHeight: 1.6, padding: 40, minHeight: 800 }}>
      {/* Colorful header */}
      <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: 16, color: "#fff", padding: "32px 36px", marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{organization?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Invoice {invoice.number}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "12px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 10, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>Amount Due</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</div>
        </div>
      </div>
      {/* Client + dates */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32 }}>
        <div style={{ flex: 1, background: "#f5f3ff", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", marginBottom: 6 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#666" }}>{contact.phone}</div>}
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", marginBottom: 6 }}>Issued</div>
            <div style={{ fontWeight: 500 }}>{formatDateLong(invoice.issue_date)}</div>
          </div>
          <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", marginBottom: 6 }}>Due</div>
            <div style={{ fontWeight: 500 }}>{formatDateLong(invoice.due_date)}</div>
          </div>
        </div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", marginBottom: 28 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Description</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Price</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed" }}>Total</th>
          </tr>
        </thead>
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
        <div style={{ width: 280, background: "#f5f3ff", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #7c3aed", marginTop: 6 }}><span>Total</span><span style={{ color: "#7c3aed" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #d4b9ff" }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 36, padding: "20px 24px", background: "#f9fafb", borderRadius: 12 }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function FreelancerTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 48, minHeight: 800 }}>
      {/* Large personal branding area */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1 }}>{organization?.name ?? "Your Name"}</div>
        <div style={{ width: 60, height: 4, background: "#e67e22", marginTop: 12, marginBottom: 12, borderRadius: 2 }} />
        <div style={{ fontSize: 13, color: "#888", fontWeight: 400 }}>Invoice {invoice.number} &middot; {formatDateLong(invoice.issue_date)}</div>
      </div>
      {/* Two-column layout */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#e67e22", marginBottom: 8 }}>Billed To</div>
          {contactName && <div style={{ fontWeight: 600, fontSize: 15 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#e67e22", marginBottom: 8 }}>Payment Due</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{formatDateLong(invoice.due_date)}</div>
          <div style={{ marginTop: 8, display: "inline-block", padding: "3px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#e8f5e9" : "#fff3e0", color: invoice.status === "paid" ? "#2e7d32" : "#e65100" }}>{STATUS_LABELS[invoice.status]}</div>
        </div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: "3px solid #e67e22" }}>
            <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Service / Item</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Rate</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22" }}>Total</th>
          </tr>
        </thead>
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
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: "3px solid #e67e22", marginTop: 4 }}><span>Total</span><span style={{ color: "#e67e22" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #eee" }}>
          {invoice.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#e67e22", marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function ConsultingTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 44, minHeight: 800 }}>
      {/* Header with accent bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottom: "3px solid #0ea5e9" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Consulting Services</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#0ea5e9" }}>Invoice</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{invoice.number}</div>
        </div>
      </div>
      {/* Project / Client info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0ea5e9", marginBottom: 6 }}>Client</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0ea5e9", marginBottom: 6 }}>Period</div>
          <div>{formatDateLong(invoice.issue_date)}</div>
          <div style={{ color: "#888", fontSize: 11 }}>to {formatDateLong(invoice.due_date)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0ea5e9", marginBottom: 6 }}>Status</div>
          <div style={{ display: "inline-block", padding: "3px 12px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#e0f7fa" : "#f0f9ff", color: invoice.status === "paid" ? "#0277bd" : "#0369a1" }}>{STATUS_LABELS[invoice.status]}</div>
        </div>
      </div>
      {/* Time / Services table with hours-focused header */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ background: "#f0f9ff" }}>
            <th style={{ textAlign: "left", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Service Description</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Hours/Qty</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Rate/Hr</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#0ea5e9", borderBottom: "2px solid #0ea5e9" }}>Amount</th>
          </tr>
        </thead>
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
      {/* Summary block */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300, background: "#f0f9ff", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #0ea5e9", marginTop: 6 }}><span>Total Due</span><span style={{ color: "#0ea5e9" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #bae6fd" }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0ea5e9", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#0ea5e9", marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function RetailTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Courier New', Courier, monospace", color: "#1a1a1a", fontSize: 12, lineHeight: 1.5, padding: "32px 48px", minHeight: 800, maxWidth: 480, margin: "0 auto" }}>
      {/* Receipt header */}
      <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 16, borderBottom: "2px dashed #333" }}>
        <div style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{organization?.name ?? "Store Name"}</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>TAX INVOICE / RECEIPT</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{invoice.number}</div>
      </div>
      {/* Date + Client */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px dashed #999" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Date:</span><span>{formatDateLong(invoice.issue_date)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Due:</span><span>{formatDateLong(invoice.due_date)}</span></div>
        {contactName && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span>Customer:</span><span>{contactName}</span></div>}
        {company && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Company:</span><span>{company.name}</span></div>}
        {contact?.email && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}><span>Email:</span><span>{contact.email}</span></div>}
      </div>
      {/* Items */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px dashed #999" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #ccc" }}>
          <span style={{ flex: 1 }}>ITEM</span>
          <span style={{ width: 40, textAlign: "right" }}>QTY</span>
          <span style={{ width: 80, textAlign: "right" }}>PRICE</span>
          <span style={{ width: 80, textAlign: "right" }}>TOTAL</span>
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description || "—"}</span>
            <span style={{ width: 40, textAlign: "right" }}>{l.quantity}</span>
            <span style={{ width: 80, textAlign: "right" }}>{formatCurrency(l.unit_price, invoice.currency)}</span>
            <span style={{ width: 80, textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, invoice.currency)}</span>
          </div>
        ))}
      </div>
      {/* Totals */}
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "2px dashed #333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>SUBTOTAL</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
        {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>DISCOUNT</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>TAX</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 16, borderTop: "1px solid #333", marginTop: 4 }}><span>TOTAL</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
        {invoice.amount_paid > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>PAID</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px dashed #999" }}><span>BALANCE DUE</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
          </>
        )}
      </div>
      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
        {invoice.notes && <div style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>{invoice.notes}</div>}
        {invoice.terms && <div style={{ whiteSpace: "pre-wrap", fontSize: 10 }}>{invoice.terms}</div>}
        <div style={{ marginTop: 16, letterSpacing: 1 }}>*** THANK YOU ***</div>
      </div>
    </div>
  );
}

function CreativeTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, minHeight: 800 }}>
      {/* Asymmetric header with left accent bar */}
      <div style={{ display: "flex", minHeight: 140 }}>
        <div style={{ width: 8, background: "linear-gradient(180deg, #f43f5e, #ec4899, #a855f7)", flexShrink: 0 }} />
        <div style={{ flex: 1, padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 3, color: "#f43f5e", marginBottom: 8 }}>Invoice</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{organization?.name ?? "Studio Name"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#f43f5e", letterSpacing: -1 }}>{invoice.number}</div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{formatDateLong(invoice.issue_date)}</div>
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: "24px 48px 40px 48px" }}>
        {/* Client + Due in asymmetric layout */}
        <div style={{ display: "flex", gap: 60, marginBottom: 36 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#f43f5e", marginBottom: 6 }}>Client</div>
            {contactName && <div style={{ fontWeight: 600, fontSize: 15 }}>{contactName}</div>}
            {company && <div style={{ color: "#666" }}>{company.name}</div>}
            {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
            {contact?.phone && <div style={{ color: "#666" }}>{contact.phone}</div>}
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#f43f5e", marginBottom: 6 }}>Due</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{formatDateLong(invoice.due_date)}</div>
            <div style={{ marginTop: 6, display: "inline-block", padding: "3px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: invoice.status === "paid" ? "#fce7f3" : "#fff1f2", color: invoice.status === "paid" ? "#be185d" : "#e11d48" }}>{STATUS_LABELS[invoice.status]}</div>
          </div>
        </div>
        {/* Table with left accent */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Deliverable</th>
              <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Rate</th>
              <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Tax</th>
              <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Disc.</th>
              <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", borderBottom: "2px solid #f43f5e" }}>Amount</th>
            </tr>
          </thead>
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
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: "2px solid #f43f5e", marginTop: 4 }}><span>Total</span><span style={{ color: "#f43f5e" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
            {invoice.amount_paid > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#888" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #fda4af" }}><span>Balance</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
              </>
            )}
          </div>
        </div>
        {(invoice.notes || invoice.terms) && (
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
            {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
            {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#f43f5e", marginBottom: 4 }}>Terms</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function LegalTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1a1a1a", fontSize: 12, lineHeight: 1.8, padding: 48, minHeight: 800 }}>
      {/* Formal header */}
      <div style={{ textAlign: "center", marginBottom: 32, paddingBottom: 16, borderBottom: "3px double #1a1a1a" }}>
        <div style={{ fontSize: 18, fontWeight: 700, textTransform: "uppercase", letterSpacing: 3 }}>{organization?.name ?? "Law Firm Name"}</div>
        <div style={{ fontSize: 14, fontStyle: "italic", marginTop: 8, color: "#444" }}>Statement of Account / Invoice</div>
      </div>
      {/* Numbered paragraphs style */}
      <div style={{ marginBottom: 24, fontSize: 12 }}>
        <p style={{ marginBottom: 8 }}><strong>1. Invoice Reference:</strong> {invoice.number}</p>
        <p style={{ marginBottom: 8 }}><strong>2. Date of Issue:</strong> {formatDateLong(invoice.issue_date)}</p>
        <p style={{ marginBottom: 8 }}><strong>3. Payment Due Date:</strong> {formatDateLong(invoice.due_date)}</p>
        <p style={{ marginBottom: 8 }}><strong>4. Status:</strong> {STATUS_LABELS[invoice.status]}</p>
        <p style={{ marginBottom: 4 }}><strong>5. Client Details:</strong></p>
        <div style={{ paddingLeft: 24, marginBottom: 8 }}>
          {contactName && <div>{contactName}</div>}
          {company && <div>{company.name}</div>}
          {contact?.email && <div>{contact.email}</div>}
          {contact?.phone && <div>{contact.phone}</div>}
        </div>
      </div>
      {/* Table */}
      <p style={{ marginBottom: 8, fontWeight: 700 }}>6. Schedule of Services Rendered:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, border: "1px solid #333" }}>
        <thead>
          <tr style={{ background: "#f5f5f0" }}>
            <th style={{ textAlign: "left", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", borderRight: "1px solid #ccc" }}>Description of Services</th>
            <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", borderRight: "1px solid #ccc", width: 50 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", borderRight: "1px solid #ccc", width: 80 }}>Rate</th>
            <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", borderRight: "1px solid #ccc", width: 50 }}>Tax %</th>
            <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", borderRight: "1px solid #ccc", width: 50 }}>Disc %</th>
            <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, borderBottom: "2px solid #333", width: 90 }}>Amount</th>
          </tr>
        </thead>
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
      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Subtotal:</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Less Discount:</span><span>({formatCurrency(invoice.discount_total, invoice.currency)})</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Applicable Tax:</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 14, borderTop: "2px solid #1a1a1a", marginTop: 4 }}><span>Total Due:</span><span>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span>Less Payments Received:</span><span>({formatCurrency(invoice.amount_paid, invoice.currency)})</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #999" }}><span>Outstanding Balance:</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 36, paddingTop: 16, borderTop: "3px double #1a1a1a" }}>
          {invoice.notes && <p style={{ marginBottom: 8 }}><strong>7. Additional Notes:</strong> <span style={{ fontStyle: "italic" }}>{invoice.notes}</span></p>}
          {invoice.terms && <p><strong>{invoice.notes ? "8" : "7"}. Terms and Conditions:</strong> <span style={{ fontStyle: "italic" }}>{invoice.terms}</span></p>}
        </div>
      )}
    </div>
  );
}

function MedicalTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 44, minHeight: 800 }}>
      {/* Clean clinical header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 20, borderBottom: "2px solid #16a34a" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#16a34a", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700 }}>+</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{organization?.name ?? "Medical Practice"}</div>
              <div style={{ fontSize: 11, color: "#888" }}>Healthcare Services Invoice</div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#16a34a" }}>Invoice No.</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{invoice.number}</div>
        </div>
      </div>
      {/* Patient / Provider fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "16px 20px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#16a34a", marginBottom: 8 }}>Patient / Client</div>
          {contactName && <div style={{ fontWeight: 600 }}>{contactName}</div>}
          {company && <div style={{ color: "#555" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#555", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#555", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "16px 20px", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#16a34a", marginBottom: 8 }}>Invoice Details</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#666" }}>Issue Date:</span><span style={{ fontWeight: 500 }}>{formatDateLong(invoice.issue_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#666" }}>Due Date:</span><span style={{ fontWeight: 500 }}>{formatDateLong(invoice.due_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#666" }}>Status:</span><span style={{ fontWeight: 600, color: invoice.status === "paid" ? "#16a34a" : "#1a1a1a" }}>{STATUS_LABELS[invoice.status]}</span></div>
        </div>
      </div>
      {/* Services table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ background: "#f0fdf4" }}>
            <th style={{ textAlign: "left", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Service / Procedure</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Rate</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Tax</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Disc.</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "#16a34a", borderBottom: "2px solid #16a34a" }}>Amount</th>
          </tr>
        </thead>
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
      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Subtotal</span><span>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Discount</span><span>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Tax</span><span>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #16a34a", marginTop: 4 }}><span>Total</span><span style={{ color: "#16a34a" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span style={{ color: "#666" }}>Paid</span><span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, borderTop: "1px solid #bbf7d0" }}><span>Balance Due</span><span>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #e5e7eb" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#16a34a", marginBottom: 4 }}>Notes</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#16a34a", marginBottom: 4 }}>Terms & Conditions</div><div style={{ color: "#555", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TechTemplate({ invoice, lines, organization, contact, company }: TemplateProps) {
  const contactName = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace", color: "#e2e8f0", fontSize: 12, lineHeight: 1.6, padding: 40, minHeight: 800, background: "#0f172a" }}>
      {/* Header with terminal-style */}
      <div style={{ marginBottom: 32, padding: "20px 24px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: "#22d3ee" }}>$ </span>
            <span style={{ color: "#a5f3fc", fontWeight: 700 }}>{organization?.name ?? "DevCo"}</span>
            <span style={{ color: "#64748b" }}> // invoice</span>
          </div>
          <div style={{ color: "#22d3ee", fontWeight: 700, fontSize: 14 }}>{invoice.number}</div>
        </div>
      </div>
      {/* Meta block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
        <div style={{ padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#22d3ee", marginBottom: 8 }}>// client</div>
          {contactName && <div style={{ color: "#f1f5f9", fontWeight: 500 }}>{contactName}</div>}
          {company && <div style={{ color: "#94a3b8" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#94a3b8" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#94a3b8" }}>{contact.phone}</div>}
        </div>
        <div style={{ padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: "#22d3ee", marginBottom: 8 }}>// details</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#64748b" }}>issued:</span><span style={{ color: "#f1f5f9" }}>{formatDateLong(invoice.issue_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: "#64748b" }}>due:</span><span style={{ color: "#f1f5f9" }}>{formatDateLong(invoice.due_date)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#64748b" }}>status:</span><span style={{ color: invoice.status === "paid" ? "#4ade80" : invoice.status === "overdue" ? "#f87171" : "#fbbf24", fontWeight: 600 }}>{invoice.status}</span></div>
        </div>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #22d3ee" }}>
            <th style={{ textAlign: "left", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>description</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>qty</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>rate</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>tax</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>disc</th>
            <th style={{ textAlign: "right", padding: "10px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee" }}>total</th>
          </tr>
        </thead>
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
      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 300, padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>subtotal</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount_total > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>discount</span><span style={{ color: "#fb923c" }}>-{formatCurrency(invoice.discount_total, invoice.currency)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>tax</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(invoice.tax_total, invoice.currency)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 16, fontWeight: 700, borderTop: "2px solid #22d3ee", marginTop: 6 }}><span style={{ color: "#22d3ee" }}>total</span><span style={{ color: "#22d3ee" }}>{formatCurrency(invoice.total, invoice.currency)}</span></div>
          {invoice.amount_paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ color: "#64748b" }}>paid</span><span style={{ color: "#4ade80" }}>{formatCurrency(invoice.amount_paid, invoice.currency)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontWeight: 700, borderTop: "1px solid #334155" }}><span style={{ color: "#fbbf24" }}>balance</span><span style={{ color: "#fbbf24" }}>{formatCurrency(invoice.total - invoice.amount_paid, invoice.currency)}</span></div>
            </>
          )}
        </div>
      </div>
      {(invoice.notes || invoice.terms) && (
        <div style={{ marginTop: 32, padding: "16px 20px", background: "#1e293b", borderRadius: 8, border: "1px solid #334155" }}>
          {invoice.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee", marginBottom: 4 }}>// notes</div><div style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{invoice.notes}</div></div>}
          {invoice.terms && <div><div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#22d3ee", marginBottom: 4 }}>// terms</div><div style={{ color: "#94a3b8", whiteSpace: "pre-wrap" }}>{invoice.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

const TEMPLATE_COMPONENTS: Record<TemplateName, React.ComponentType<TemplateProps>> = {
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
   Invoice Preview Modal
   ========================================================================= */

function InvoicePreview({
  invoice,
  lines,
  organization,
  contact,
  company,
  onClose,
}: TemplateProps & { onClose: () => void }) {
  const Template = TEMPLATE_COMPONENTS[invoice.template] ?? ModernTemplate;
  const previewRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)" }}
        onClick={onClose}
      />
      <div style={{
        position: "relative",
        width: "min(90vw, 860px)",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderRadius: 12,
        boxShadow: "var(--shadow-xl)",
        overflow: "hidden",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eye className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Invoice Preview — {TEMPLATE_OPTIONS.find(t => t.key === invoice.template)?.label} Template</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Printer className="size-3.5" />}
              onClick={() => {
                const printWindow = window.open("", "_blank");
                if (printWindow && previewRef.current) {
                  printWindow.document.write(`<!DOCTYPE html><html><head><title>${invoice.number}</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"><style>@media print { body { margin: 0; } }</style></head><body>${previewRef.current.innerHTML}</body></html>`);
                  printWindow.document.close();
                  printWindow.focus();
                  printWindow.print();
                }
              }}
            >
              Print
            </Button>
            <button
              onClick={onClose}
              className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)]"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#e5e7eb" }}>
          <div ref={previewRef} style={{ maxWidth: 794, margin: "0 auto", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)", borderRadius: 4 }}>
            <Template invoice={invoice} lines={lines} organization={organization} contact={contact} company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Quotation Picker Modal
   ========================================================================= */

function QuotationPickerModal({
  quotations,
  onSelect,
  onClose,
}: {
  quotations: Quotation[];
  onSelect: (q: Quotation) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
      <div style={{
        position: "relative",
        width: "min(90vw, 520px)",
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderRadius: 12,
        boxShadow: "var(--shadow-xl)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Create Invoice from Quotation</h3>
            <button onClick={onClose} className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)]" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-ink-secondary)", marginTop: 4 }}>Select a quotation to convert into an invoice.</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {quotations.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--color-ink-tertiary)", fontSize: 13 }}>No quotations found.</div>
          ) : (
            quotations.map((q) => (
              <button
                key={q.id}
                onClick={() => onSelect(q)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  transition: "background 150ms",
                }}
                className="hover:bg-[var(--color-surface-hover)]"
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{q.number}</div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-secondary)", marginTop: 2 }}>Status: {q.status}</div>
                </div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(q.total)}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Record Payment Modal
   ========================================================================= */

function RecordPaymentModal({
  invoice,
  onRecord,
  onClose,
}: {
  invoice: Invoice;
  onRecord: (amount: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.total - invoice.amount_paid));
  const balance = invoice.total - invoice.amount_paid;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} onClick={onClose} />
      <div style={{
        position: "relative",
        width: "min(90vw, 400px)",
        background: "var(--color-surface)",
        borderRadius: 12,
        boxShadow: "var(--shadow-xl)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Record Payment</h3>
            <button onClick={onClose} className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)]" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: "var(--color-surface-muted)", fontSize: 12, color: "var(--color-ink-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Invoice Total</span>
              <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>Already Paid</span>
              <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--color-ink)", paddingTop: 4, borderTop: "1px solid var(--color-border)" }}>
              <span>Balance Due</span>
              <span>{formatCurrency(balance, invoice.currency)}</span>
            </div>
          </div>
          <Field label="Payment Amount" required>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              iconLeft={<CreditCard className="size-3.5" />}
              onClick={() => {
                const val = parseFloat(amount);
                if (isNaN(val) || val <= 0) {
                  toast.error("Enter a valid payment amount.");
                  return;
                }
                if (val > balance + 0.01) {
                  toast.error("Payment exceeds balance due.");
                  return;
                }
                onRecord(val);
              }}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Main Page Component
   ========================================================================= */

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  /* ---- Data state ---- */
  const [invoices, setInvoices] = useState<(Invoice & { id: string })[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /* ---- UI state ---- */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Invoice>(blankInvoice());
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine(1)]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showQuotationPicker, setShowQuotationPicker] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  /* ---- Fetch data ---- */
  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setInvoices(data as (Invoice & { id: string })[]);
  }, [supabase]);

  const fetchMeta = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (profile?.org_id) setOrgId(profile.org_id as string);
    }
    const [contactsRes, companiesRes, orgRes, quotationsRes] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, phone, company_id").order("first_name").limit(1000),
      supabase.from("companies").select("id, name").order("name").limit(1000),
      supabase.from("organizations").select("id, name, logo_url, currency, invoice_number_format").limit(1),
      supabase.from("quotations").select("id, number, contact_id, company_id, status, total, notes, terms").order("created_at", { ascending: false }).limit(500),
    ]);
    if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
    if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
    if (orgRes.data && orgRes.data.length > 0) setOrganization(orgRes.data[0] as Organization);
    if (quotationsRes.data) setQuotations(quotationsRes.data as Quotation[]);
  }, [supabase]);

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchMeta()]).finally(() => setLoading(false));
  }, [fetchInvoices, fetchMeta]);

  /* ---- Computed values ---- */
  const selectedContact = useMemo(() => contacts.find((c) => c.id === form.contact_id) ?? null, [contacts, form.contact_id]);
  const selectedCompany = useMemo(() => companies.find((c) => c.id === form.company_id) ?? null, [companies, form.company_id]);

  /* ---- Line items helpers ---- */
  const updateLine = (idx: number, field: keyof InvoiceLine, value: string | number) => {
    setLines((prev) => {
      const next = [...prev];
      const line = { ...next[idx], [field]: value };
      line.line_total = calcLineTotal(line);
      next[idx] = line;
      return next;
    });
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(prev.length + 1)]);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i + 1 }));
    });
  };

  /* Recalculate invoice totals when lines change */
  useEffect(() => {
    const totals = calcTotals(lines);
    setForm((prev) => ({ ...prev, ...totals }));
  }, [lines]);

  /* ---- Open new invoice ---- */
  const openNew = async () => {
    const number = await generateInvoiceNumber(supabase);
    setEditingId(null);
    setForm({ ...blankInvoice(), number, currency: organization?.currency ?? "INR" });
    setLines([emptyLine(1)]);
    setSheetOpen(true);
  };

  /* ---- Open existing invoice ---- */
  const openEdit = async (inv: Invoice & { id: string }) => {
    setEditingId(inv.id);
    setForm({ ...inv });
    // Fetch lines
    const { data: linesData } = await supabase
      .from("invoice_lines")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("position");
    if (linesData && linesData.length > 0) {
      setLines(linesData as InvoiceLine[]);
    } else {
      setLines([emptyLine(1)]);
    }
    setSheetOpen(true);
  };

  /* ---- Create from quotation ---- */
  const createFromQuotation = async (quotation: Quotation) => {
    setShowQuotationPicker(false);
    const number = await generateInvoiceNumber(supabase);
    // Fetch quotation lines
    const { data: qLines } = await supabase
      .from("quotation_lines")
      .select("*")
      .eq("quotation_id", quotation.id)
      .order("position");
    const invoiceLines: InvoiceLine[] = qLines && qLines.length > 0
      ? (qLines as QuotationLine[]).map((ql, i) => ({
          position: i + 1,
          description: ql.description,
          quantity: ql.quantity,
          unit_price: ql.unit_price,
          tax_rate: ql.tax_rate,
          discount_rate: ql.discount_rate,
          line_total: ql.line_total,
        }))
      : [emptyLine(1)];

    setEditingId(null);
    setForm({
      ...blankInvoice(),
      number,
      contact_id: quotation.contact_id,
      company_id: quotation.company_id,
      quotation_id: quotation.id,
      notes: quotation.notes ?? "",
      terms: quotation.terms ?? "Payment due within 30 days of invoice date.",
      currency: organization?.currency ?? "INR",
    });
    setLines(invoiceLines);
    setSheetOpen(true);
  };

  /* ---- Save invoice ---- */
  const saveInvoice = async (statusOverride?: InvoiceStatus) => {
    if (!orgId || !userId) { toast.error("Could not determine your organization."); return; }
    setSaving(true);
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
        // Update lines: delete old, insert new
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
      }
      setForm((prev) => ({ ...prev, status, ...totals }));
      await fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save invoice.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Record payment ---- */
  const handleRecordPayment = async (amount: number) => {
    if (!editingId) {
      toast.error("Save the invoice first.");
      return;
    }
    const newPaid = form.amount_paid + amount;
    const totals = calcTotals(lines);
    const isPaidInFull = newPaid >= totals.total - 0.01;
    try {
      const { error } = await supabase
        .from("invoices")
        .update({
          amount_paid: newPaid,
          status: isPaidInFull ? "paid" : form.status,
          paid_at: isPaidInFull ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (error) throw error;
      setForm((prev) => ({
        ...prev,
        amount_paid: newPaid,
        status: isPaidInFull ? "paid" : prev.status,
      }));
      setShowPaymentModal(false);
      toast.success(isPaidInFull ? "Invoice marked as paid!" : "Payment recorded.");
      await fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record payment.";
      toast.error(message);
    }
  };

  /* ---- Status chip style ---- */
  function statusChipClass(status: InvoiceStatus): string {
    if (status === "paid") return "chip chip-viridian";
    if (status === "draft") return "chip";
    if (status === "sent") return "chip chip-outline";
    return "chip chip-strong";
  }

  /* ---- Contact display helper ---- */
  const contactName = (contactId: string | null) => {
    if (!contactId) return "—";
    const c = contacts.find((ct) => ct.id === contactId);
    if (!c) return "—";
    return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
  };

  const companyName = (companyId: string | null) => {
    if (!companyId) return "";
    const c = companies.find((co) => co.id === companyId);
    return c?.name ?? "";
  };

  /* ============================================================================
     Render
     ========================================================================= */

  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}${organization ? ` · ${organization.name}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              iconLeft={<Copy className="size-3.5" />}
              onClick={() => setShowQuotationPicker(true)}
            >
              Create from quotation
            </Button>
            <Button
              variant="secondary"
              iconLeft={<PenLine className="size-3.5" />}
              onClick={() => router.push("/crm/invoices/editor")}
            >
              Full Editor
            </Button>
            <Button
              variant="primary"
              iconLeft={<Plus className="size-3.5" />}
              onClick={openNew}
            >
              New invoice
            </Button>
          </div>
        }
      />

      {/* ---- Invoice Table ---- */}
      <div className="card overflow-hidden">
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--color-ink-tertiary)", fontSize: 13 }}>Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div
              className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
              style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
            >
              <FileText className="size-5" />
            </div>
            <h3 className="text-[15px] font-semibold tracking-tight">No invoices yet</h3>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
              Create your first invoice to start tracking payments and revenue.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Th>Number</Th>
                  <Th>Client</Th>
                  <Th>Issue Date</Th>
                  <Th>Due Date</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">{" "}</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const balance = inv.total - inv.amount_paid;
                  const client = contactName(inv.contact_id);
                  const comp = companyName(inv.company_id);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openEdit(inv)}
                      className="hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      <Td>
                        <span style={{ fontWeight: 600 }}>{inv.number}</span>
                      </Td>
                      <Td>
                        <div>
                          <div style={{ fontWeight: 500 }}>{client}</div>
                          {comp && <div style={{ fontSize: 11, color: "var(--color-ink-tertiary)", marginTop: 1 }}>{comp}</div>}
                        </div>
                      </Td>
                      <Td muted>{formatDate(inv.issue_date)}</Td>
                      <Td muted>{formatDate(inv.due_date)}</Td>
                      <Td>
                        <span className={statusChipClass(inv.status)}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="tabular-nums font-medium">{formatCurrency(inv.total, inv.currency)}</span>
                      </Td>
                      <Td align="right" muted>
                        <span className="tabular-nums">{formatCurrency(inv.amount_paid, inv.currency)}</span>
                      </Td>
                      <Td align="right">
                        <span className="tabular-nums font-medium" style={{ color: balance > 0 ? "var(--color-ink)" : "var(--color-viridian-700)" }}>
                          {formatCurrency(balance, inv.currency)}
                        </span>
                      </Td>
                      <Td align="right">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={<PenLine className="size-3" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/crm/invoices/editor/${inv.id}`);
                          }}
                        >
                          Editor
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Quotation Picker Modal ---- */}
      {showQuotationPicker && (
        <QuotationPickerModal
          quotations={quotations}
          onSelect={createFromQuotation}
          onClose={() => setShowQuotationPicker(false)}
        />
      )}

      {/* ---- Invoice Editor Sheet ---- */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) {
            setEditingId(null);
            setShowPreview(false);
          }
        }}
        title={editingId ? `Edit Invoice ${form.number}` : "New Invoice"}
        description={editingId ? "Update invoice details and line items." : "Create a new invoice with line items and choose a template."}
        width={640}
        footer={
          <div style={{ display: "flex", gap: 8, width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Eye className="size-3.5" />}
                onClick={() => setShowPreview(true)}
              >
                Preview
              </Button>
              {editingId && form.status !== "paid" && form.status !== "cancelled" && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<CreditCard className="size-3.5" />}
                  onClick={() => setShowPaymentModal(true)}
                >
                  Record Payment
                </Button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Save className="size-3.5" />}
                loading={saving}
                onClick={() => saveInvoice("draft")}
              >
                Save Draft
              </Button>
              {form.status === "draft" && (
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={<Send className="size-3.5" />}
                  loading={saving}
                  onClick={() => saveInvoice("sent")}
                >
                  Mark as Sent
                </Button>
              )}
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
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* ---- Template Selector ---- */}
          <div>
            <div className="text-[12px] font-medium mb-2" style={{ color: "var(--color-ink-secondary)" }}>Template</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {TEMPLATE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setForm((prev) => ({ ...prev, template: t.key }))}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: form.template === t.key
                      ? "2px solid var(--color-viridian-500)"
                      : "1px solid var(--color-border)",
                    background: form.template === t.key
                      ? "var(--color-viridian-50)"
                      : "var(--color-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms",
                  }}
                  className="hover:border-[var(--color-border-strong)]"
                >
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: form.template === t.key ? "var(--color-viridian-700)" : "var(--color-ink)",
                  }}>{t.label}</div>
                  <div style={{
                    fontSize: 10,
                    marginTop: 2,
                    color: form.template === t.key ? "var(--color-viridian-600)" : "var(--color-ink-tertiary)",
                  }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ---- Invoice Number ---- */}
          <Field label="Invoice Number" required>
            <Input
              value={form.number}
              onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
              placeholder="INV-2026-0001"
            />
          </Field>

          {/* ---- Client Selection ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Contact">
              <Select
                value={form.contact_id ?? ""}
                onChange={(e) => {
                  const contactId = e.target.value || null;
                  const contact = contacts.find((c) => c.id === contactId);
                  setForm((prev) => ({
                    ...prev,
                    contact_id: contactId,
                    company_id: contact?.company_id ?? prev.company_id,
                  }));
                }}
              >
                <option value="">Select contact...</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Unnamed"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Company">
              <Select
                value={form.company_id ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, company_id: e.target.value || null }))}
              >
                <option value="">Select company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* ---- Dates ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Issue Date" required>
              <Input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
              />
            </Field>
            <Field label="Due Date" required>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              />
            </Field>
          </div>

          {/* ---- Line Items ---- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>Line Items</span>
              <Button variant="ghost" size="sm" iconLeft={<Plus className="size-3" />} onClick={addLine}>
                Add Item
              </Button>
            </div>
            <div className="card-inset" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--color-surface-muted)" }}>
                      <th style={{ textAlign: "left", padding: "8px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", minWidth: 160 }}>Description</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", width: 56 }}>Qty</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", width: 88 }}>Unit Price</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", width: 56 }}>Tax %</th>
                      <th style={{ textAlign: "right", padding: "8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", width: 56 }}>Disc %</th>
                      <th style={{ textAlign: "right", padding: "8px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-ink-tertiary)", width: 88 }}>Total</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "4px 4px" }}>
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(idx, "description", e.target.value)}
                            placeholder="Item description"
                            style={{
                              width: "100%",
                              padding: "6px 4px",
                              fontSize: 12,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              color: "var(--color-ink)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 2px" }}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                            style={{
                              width: "100%",
                              padding: "6px 2px",
                              fontSize: 12,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              color: "var(--color-ink)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 2px" }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                            style={{
                              width: "100%",
                              padding: "6px 2px",
                              fontSize: 12,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              color: "var(--color-ink)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 2px" }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.tax_rate}
                            onChange={(e) => updateLine(idx, "tax_rate", parseFloat(e.target.value) || 0)}
                            style={{
                              width: "100%",
                              padding: "6px 2px",
                              fontSize: 12,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              color: "var(--color-ink)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "4px 2px" }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.discount_rate}
                            onChange={(e) => updateLine(idx, "discount_rate", parseFloat(e.target.value) || 0)}
                            style={{
                              width: "100%",
                              padding: "6px 2px",
                              fontSize: 12,
                              background: "transparent",
                              border: "none",
                              outline: "none",
                              textAlign: "right",
                              color: "var(--color-ink)",
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 12, color: "var(--color-ink)" }}>
                          {formatCurrency(line.line_total, form.currency)}
                        </td>
                        <td style={{ padding: "4px" }}>
                          <button
                            onClick={() => removeLine(idx)}
                            disabled={lines.length <= 1}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              border: "none",
                              background: "transparent",
                              cursor: lines.length <= 1 ? "not-allowed" : "pointer",
                              opacity: lines.length <= 1 ? 0.3 : 0.5,
                              color: "var(--color-ink-secondary)",
                            }}
                            className="hover:opacity-100"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ---- Summary ---- */}
          <div style={{
            padding: 16,
            borderRadius: 8,
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-border)",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <SummaryRow label="Subtotal" value={formatCurrency(form.subtotal, form.currency)} />
              {form.discount_total > 0 && (
                <SummaryRow label="Discount" value={`-${formatCurrency(form.discount_total, form.currency)}`} />
              )}
              <SummaryRow label="Tax" value={formatCurrency(form.tax_total, form.currency)} />
              <div style={{ height: 1, background: "var(--color-border)", margin: "4px 0" }} />
              <SummaryRow label="Total" value={formatCurrency(form.total, form.currency)} bold />
              {form.amount_paid > 0 && (
                <>
                  <SummaryRow label="Paid" value={formatCurrency(form.amount_paid, form.currency)} />
                  <div style={{ height: 1, background: "var(--color-border)", margin: "2px 0" }} />
                  <SummaryRow
                    label="Balance Due"
                    value={formatCurrency(form.total - form.amount_paid, form.currency)}
                    bold
                    accent={form.total - form.amount_paid > 0}
                  />
                </>
              )}
            </div>
          </div>

          {/* ---- Payment Tracking ---- */}
          {editingId && (
            <Field label="Amount Paid" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Auto-updated when payments are recorded</span>}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount_paid}
                onChange={(e) => setForm((prev) => ({ ...prev, amount_paid: parseFloat(e.target.value) || 0 }))}
              />
            </Field>
          )}

          {/* ---- Notes & Terms ---- */}
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes for the client..."
            />
          </Field>
          <Field label="Terms & Conditions">
            <Textarea
              value={form.terms}
              onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))}
              placeholder="Payment terms, late fees, etc."
            />
          </Field>
        </div>
      </Sheet>

      {/* ---- Invoice Preview ---- */}
      {showPreview && (
        <InvoicePreview
          invoice={form}
          lines={lines}
          organization={organization}
          contact={selectedContact}
          company={selectedCompany}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ---- Record Payment Modal ---- */}
      {showPaymentModal && editingId && (
        <RecordPaymentModal
          invoice={form}
          onRecord={handleRecordPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </PageContainer>
  );
}

/* ============================================================================
   Shared Table Cell Components
   ========================================================================= */

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

function SummaryRow({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: bold ? 14 : 12,
      fontWeight: bold ? 600 : 400,
    }}>
      <span style={{ color: "var(--color-ink-secondary)" }}>{label}</span>
      <span
        className="tabular-nums"
        style={{ color: accent ? "var(--color-viridian-700)" : "var(--color-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}
