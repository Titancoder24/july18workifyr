"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Download,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Palette,
  FileText,
  ClipboardList,
  StickyNote,
  LayoutTemplate,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

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

type LineItemDraft = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_rate: number;
  line_total: number;
};

interface QuotationData {
  id: string | null;
  number: string;
  contact_id: string;
  company_id: string;
  issue_date: string;
  valid_until: string;
  status: QuotationStatus;
  notes: string;
  terms: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  currency: string;
}

interface OrgInfo {
  name: string;
  logo_url: string | null;
  currency: string;
}

interface ContactInfo {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface CompanyInfo {
  name: string;
}

interface EditorTemplateProps {
  quotation: QuotationData;
  lines: LineItemDraft[];
  organization: OrgInfo | null;
  contact: ContactInfo | null;
  company: CompanyInfo | null;
  theme: { primaryColor: string; accentColor: string; fontFamily: string };
}

type TemplateName =
  | "modern" | "classic" | "bold" | "compact" | "elegant"
  | "simple" | "corporate" | "startup" | "freelancer" | "consulting"
  | "retail" | "creative" | "legal" | "medical" | "tech";

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

function emptyLine(): LineItemDraft {
  return {
    id: generateTempId(),
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 0,
    discount_rate: 0,
    line_total: 0,
  };
}

function contactDisplayName(c: ContactInfo | Contact | null | undefined): string {
  if (!c) return "—";
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
}

function statusLabel(s: QuotationStatus): string {
  const map: Record<QuotationStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
  };
  return map[s] ?? s;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Template registry                                                  */
/* ------------------------------------------------------------------ */

interface TemplateInfo {
  key: TemplateName;
  label: string;
  defaultPrimary: string;
  defaultAccent: string;
  thumbColor: string;
}

const TEMPLATES: TemplateInfo[] = [
  { key: "modern",     label: "Modern",      defaultPrimary: "#10b981", defaultAccent: "#059669", thumbColor: "#10b981" },
  { key: "classic",    label: "Classic",      defaultPrimary: "#1e40af", defaultAccent: "#1e3a8a", thumbColor: "#1e40af" },
  { key: "bold",       label: "Bold",         defaultPrimary: "#111827", defaultAccent: "#374151", thumbColor: "#111827" },
  { key: "compact",    label: "Compact",      defaultPrimary: "#6366f1", defaultAccent: "#4f46e5", thumbColor: "#6366f1" },
  { key: "elegant",    label: "Elegant",      defaultPrimary: "#8b5cf6", defaultAccent: "#7c3aed", thumbColor: "#8b5cf6" },
  { key: "simple",     label: "Simple",       defaultPrimary: "#64748b", defaultAccent: "#475569", thumbColor: "#64748b" },
  { key: "corporate",  label: "Corporate",    defaultPrimary: "#0f172a", defaultAccent: "#1e293b", thumbColor: "#0f172a" },
  { key: "startup",    label: "Startup",      defaultPrimary: "#7c3aed", defaultAccent: "#6d28d9", thumbColor: "#7c3aed" },
  { key: "freelancer", label: "Freelancer",   defaultPrimary: "#e67e22", defaultAccent: "#d35400", thumbColor: "#e67e22" },
  { key: "consulting", label: "Consulting",   defaultPrimary: "#0ea5e9", defaultAccent: "#0284c7", thumbColor: "#0ea5e9" },
  { key: "retail",     label: "Retail",       defaultPrimary: "#374151", defaultAccent: "#1f2937", thumbColor: "#374151" },
  { key: "creative",   label: "Creative",     defaultPrimary: "#f43f5e", defaultAccent: "#e11d48", thumbColor: "#f43f5e" },
  { key: "legal",      label: "Legal",        defaultPrimary: "#1e3a5f", defaultAccent: "#1a2e4a", thumbColor: "#1e3a5f" },
  { key: "medical",    label: "Medical",      defaultPrimary: "#16a34a", defaultAccent: "#15803d", thumbColor: "#16a34a" },
  { key: "tech",       label: "Tech",         defaultPrimary: "#22d3ee", defaultAccent: "#06b6d4", thumbColor: "#22d3ee" },
];

/* ------------------------------------------------------------------ */
/*  Theme presets                                                      */
/* ------------------------------------------------------------------ */

interface ThemePreset {
  name: string;
  primaryColor: string;
  accentColor: string;
  swatch: string;
}

const THEME_PRESETS: ThemePreset[] = [
  { name: "Viridian",    primaryColor: "#10b981", accentColor: "#059669", swatch: "#10b981" },
  { name: "Ocean Blue",  primaryColor: "#3b82f6", accentColor: "#2563eb", swatch: "#3b82f6" },
  { name: "Sunset",      primaryColor: "#f59e0b", accentColor: "#d97706", swatch: "#f59e0b" },
  { name: "Midnight",    primaryColor: "#1e293b", accentColor: "#0f172a", swatch: "#1e293b" },
  { name: "Rose",        primaryColor: "#f43f5e", accentColor: "#e11d48", swatch: "#f43f5e" },
  { name: "Amber",       primaryColor: "#f97316", accentColor: "#ea580c", swatch: "#f97316" },
  { name: "Slate",       primaryColor: "#64748b", accentColor: "#475569", swatch: "#64748b" },
  { name: "Purple",      primaryColor: "#8b5cf6", accentColor: "#7c3aed", swatch: "#8b5cf6" },
];

/* ------------------------------------------------------------------ */
/*  15 Template Components                                             */
/* ------------------------------------------------------------------ */

function TplModern({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  const bgLight = hexToRgba(p, 0.08);
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1e293b", fontSize: 13, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 40, marginBottom: 12, objectFit: "contain" }} />}
          <div style={{ fontSize: 20, fontWeight: 600 }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: p }}>QUOTATION</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{q.number} <span style={{ padding: "2px 8px", background: bgLight, borderRadius: 4, fontSize: 11, color: p }}>{statusLabel(q.status)}</span></div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Issue: {formatDate(q.issue_date)}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Valid: {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <div style={{ height: 2, background: p, borderRadius: 1, marginBottom: 24 }} />
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 8 }}>Bill To</div>
        <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
        {contact?.email && <div style={{ color: "#64748b" }}>{contact.email}</div>}
        {contact?.phone && <div style={{ color: "#64748b" }}>{contact.phone}</div>}
        {company && <div style={{ color: "#64748b", marginTop: 4 }}>{company.name}</div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: `2px solid ${hexToRgba(p, 0.3)}` }}>
            {["#", "Description", "Qty", "Price", "Tax", "Disc", "Total"].map((h, i) => (
              <th key={h} style={{ padding: "10px 12px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#94a3b8" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: i < lines.length - 1 ? "1px solid #e2e8f0" : "none" }}>
              <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{i + 1}</td>
              <td style={{ padding: "10px 12px" }}>{l.description || "—"}</td>
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
        <div style={{ width: 280, background: bgLight, borderRadius: 8, padding: 16, border: `1px solid ${hexToRgba(p, 0.15)}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Subtotal</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Tax</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: "#64748b" }}><span>Discount</span><span style={{ color: "#1e293b" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: hexToRgba(p, 0.2), margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: p }}><span style={{ fontSize: 14, color: "#1e293b" }}>Grand Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 24 }}>
          {q.notes && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 6 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#64748b" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 6 }}>Terms & Conditions</div><div style={{ whiteSpace: "pre-wrap", color: "#64748b" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: `1px solid ${hexToRgba(p, 0.15)}`, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

function TplClassic({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1a1a1a", fontSize: 13, lineHeight: 1.6, padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 32, borderBottom: `3px double ${p}`, paddingBottom: 20 }}>
        {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 48, marginBottom: 8, objectFit: "contain", margin: "0 auto 8px" }} />}
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: p }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 18, fontStyle: "italic", color: "#666", marginTop: 8 }}>Quotation</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 4 }}>Bill To</div>
          <div style={{ fontWeight: 700 }}>{contactDisplayName(contact)}</div>
          {contact?.email && <div style={{ color: "#555" }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#555" }}>{contact.phone}</div>}
          {company && <div style={{ fontStyle: "italic", color: "#555" }}>{company.name}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 4 }}><strong>No:</strong> {q.number}</div>
          <div style={{ marginBottom: 4 }}><strong>Status:</strong> {statusLabel(q.status)}</div>
          <div style={{ marginBottom: 4 }}><strong>Date:</strong> {formatDate(q.issue_date)}</div>
          <div><strong>Valid Until:</strong> {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, border: "1px solid #ccc" }}>
        <thead>
          <tr style={{ background: hexToRgba(p, 0.06) }}>
            {["#", "Description", "Qty", "Unit Price", "Tax %", "Disc %", "Amount"].map((h, i) => (
              <th key={h} style={{ padding: "8px 10px", borderBottom: `2px solid ${p}`, textAlign: i < 2 ? "left" : "right", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 10px" }}>{i + 1}</td>
              <td style={{ padding: "8px 10px" }}>{l.description || "—"}</td>
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
        <div style={{ width: 260, borderTop: `2px solid ${p}`, paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Subtotal:</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Tax:</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Discount:</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: p }}><span style={{ color: "#1a1a1a" }}>Total:</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #ccc", paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><strong>Notes:</strong><div style={{ whiteSpace: "pre-wrap", color: "#555", marginTop: 4, fontStyle: "italic" }}>{q.notes}</div></div>}
          {q.terms && <div><strong>Terms & Conditions:</strong><div style={{ whiteSpace: "pre-wrap", color: "#555", marginTop: 4 }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#999", borderTop: `3px double ${p}`, paddingTop: 12 }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

function TplBold({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#111", fontSize: 14, padding: 40 }}>
      <div style={{ background: p, color: "#fff", padding: "24px 32px", marginBottom: 32, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>QUOTATION</div>
          <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>{q.number}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{statusLabel(q.status).toUpperCase()}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, gap: 24 }}>
        <div style={{ flex: 1, background: "#f8f8f8", padding: 20, borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 8 }}>Client</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{contactDisplayName(contact)}</div>
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
          <tr style={{ borderBottom: `3px solid ${p}` }}>
            {["#", "Description", "Qty", "Price", "Tax", "Disc", "Total"].map((h, i) => (
              <th key={h} style={{ padding: "12px 10px", textAlign: i < 2 ? "left" : "right", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
              <td style={{ padding: "12px 10px", fontWeight: 700, color: "#999" }}>{i + 1}</td>
              <td style={{ padding: "12px 10px", fontWeight: 500 }}>{l.description || "—"}</td>
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
        <div style={{ width: 300, background: p, color: "#fff", borderRadius: 8, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, opacity: 0.7 }}><span>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.2)", margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 900 }}><span style={{ fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: `3px solid ${p}`, paddingTop: 20 }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12, marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap", color: "#666" }}>{q.terms}</div></div>}
        </div>
      )}
      <div style={{ marginTop: 32, textAlign: "center", fontSize: 11, color: "#999" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

function TplCompact({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 11, lineHeight: 1.4, padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${p}` }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: p }}>{org?.name ?? "Your Company"}</div>
          <div style={{ color: "#888", fontSize: 10 }}>Quotation {q.number} | {statusLabel(q.status)} | {formatDate(q.issue_date)} - {formatDate(q.valid_until)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#888", fontSize: 10 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#888", fontSize: 10 }}>{contact.email}</div>}
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr style={{ background: hexToRgba(p, 0.08) }}>
            {["#", "Description", "Qty", "Price", "Tax", "Disc", "Total"].map((h, i) => (
              <th key={h} style={{ padding: "4px 6px", textAlign: i < 2 ? "left" : "right", fontSize: 10, fontWeight: 700, color: p }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "4px 6px" }}>{i + 1}</td>
              <td style={{ padding: "4px 6px" }}>{l.description || "—"}</td>
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
          <div style={{ height: 1, background: p, margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 13, color: p }}><span style={{ color: "#333" }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ fontSize: 10, borderTop: "1px solid #ddd", paddingTop: 8, color: "#666" }}>
          {q.notes && <div style={{ marginBottom: 4 }}><strong>Notes:</strong> {q.notes}</div>}
          {q.terms && <div><strong>Terms:</strong> {q.terms}</div>}
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 9, color: "#bbb" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

function TplElegant({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'Georgia', serif", color: "#2d2d2d", fontSize: 13, padding: 48 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, paddingBottom: 20, borderBottom: `1px solid ${hexToRgba(p, 0.3)}` }}>
        <div>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 36, marginBottom: 8, objectFit: "contain" }} />}
          <div style={{ fontSize: 18, fontWeight: 600, color: p, letterSpacing: 1 }}>{org?.name ?? "Your Company"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 3, color: p, marginBottom: 4 }}>Quotation</div>
          <div style={{ fontSize: 20, fontWeight: 300, letterSpacing: 1 }}>{q.number}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: p, marginBottom: 8 }}>Prepared For</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#777", marginTop: 2 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: p, marginBottom: 8 }}>Details</div>
          <div style={{ color: "#555" }}>Status: <span style={{ color: p, fontWeight: 600 }}>{statusLabel(q.status)}</span></div>
          <div style={{ color: "#555" }}>{formatDate(q.issue_date)} — {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr>
            {["#", "Description", "Qty", "Rate", "Tax", "Disc", "Amount"].map((h, i) => (
              <th key={h} style={{ padding: "12px 10px", textAlign: i < 2 ? "left" : "right", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: p, borderBottom: `1px solid ${hexToRgba(p, 0.3)}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <td style={{ padding: "12px 10px", color: "#aaa", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{i + 1}</td>
              <td style={{ padding: "12px 10px", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{l.description || "—"}</td>
              <td style={{ padding: "12px 10px", textAlign: "right", color: "#777", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{l.quantity}</td>
              <td style={{ padding: "12px 10px", textAlign: "right", color: "#777", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "12px 10px", textAlign: "right", color: "#777", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{l.tax_rate}%</td>
              <td style={{ padding: "12px 10px", textAlign: "right", color: "#777", borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{l.discount_rate}%</td>
              <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 600, borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#777" }}><span>Subtotal</span><span style={{ color: "#2d2d2d" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#777" }}><span>Tax</span><span style={{ color: "#2d2d2d" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#777" }}><span>Discount</span><span style={{ color: "#2d2d2d" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: p, margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 600, color: p }}><span style={{ color: "#2d2d2d", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: `1px solid ${hexToRgba(p, 0.2)}`, paddingTop: 24, fontSize: 12, color: "#777" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: p, marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: p, marginBottom: 4 }}>Terms & Conditions</div><div style={{ whiteSpace: "pre-wrap" }}>{q.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TplSimple({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 13, padding: 40 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>{org?.name ?? "Your Company"}</div>
        <div style={{ fontSize: 12, color: p, marginTop: 4 }}>Quotation {q.number}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ color: "#999", fontSize: 11, marginBottom: 4 }}>TO</div>
          <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999" }}>{contact.email}</div>}
        </div>
        <div style={{ textAlign: "right", color: "#666" }}>
          <div>{statusLabel(q.status)} | {formatDate(q.issue_date)}</div>
          <div>Valid until {formatDate(q.valid_until)}</div>
        </div>
      </div>
      {lines.map((l, i) => (
        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #eee" }}>
          <div>
            <div style={{ fontWeight: 500 }}>{l.description || "—"}</div>
            <div style={{ color: "#999", fontSize: 11 }}>{l.quantity} x {formatCurrency(l.unit_price, cur)} | Tax {l.tax_rate}% | Disc {l.discount_rate}%</div>
          </div>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{formatCurrency(l.line_total, cur)}</div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24, marginBottom: 32 }}>
        <div style={{ width: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Subtotal</span><span style={{ color: "#333" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Tax</span><span style={{ color: "#333" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#999" }}><span>Discount</span><span style={{ color: "#333" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `2px solid ${p}`, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}><span>Total</span><span style={{ color: p }}>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ paddingTop: 20, color: "#666", fontSize: 12 }}>
          {q.notes && <div style={{ marginBottom: 8 }}><strong>Notes:</strong> {q.notes}</div>}
          {q.terms && <div><strong>Terms:</strong> {q.terms}</div>}
        </div>
      )}
    </div>
  );
}

function TplCorporate({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 13, padding: 0 }}>
      <div style={{ background: p, color: "#fff", padding: "28px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>Professional Quotation</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{q.number}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{statusLabel(q.status)}</div>
        </div>
      </div>
      <div style={{ padding: "24px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, padding: 16, background: "#f9fafb", borderRadius: 6 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#999", marginBottom: 6 }}>Client</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{contactDisplayName(contact)}</div>
            {company && <div style={{ color: "#666" }}>{company.name}</div>}
            {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#999", marginBottom: 6 }}>Dates</div>
            <div>Issued: {formatDate(q.issue_date)}</div>
            <div>Expires: {formatDate(q.valid_until)}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: p, color: "#fff" }}>
              {["#", "Description", "Qty", "Rate", "Tax", "Disc", "Total"].map((h, i) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 12px", color: "#999" }}>{i + 1}</td>
                <td style={{ padding: "10px 12px" }}>{l.description || "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
          <div style={{ width: 280, background: p, color: "#fff", borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, opacity: 0.8 }}><span>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, opacity: 0.8 }}><span>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, opacity: 0.8 }}><span>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.3)", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}><span>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
          </div>
        </div>
        {(q.notes || q.terms) && (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, color: "#666" }}>
            {q.notes && <div style={{ marginBottom: 12 }}><strong>Notes:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.notes}</div></div>}
            {q.terms && <div><strong>Terms:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.terms}</div></div>}
          </div>
        )}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11, color: "#bbb" }}>Generated by {org?.name ?? "WorkFyr CRM"}</div>
      </div>
    </div>
  );
}

function TplStartup({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  const bg = hexToRgba(p, 0.06);
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1e1e1e", fontSize: 13, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: p, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>{(org?.name ?? "W")[0]}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{org?.name ?? "Your Company"}</div>
            <div style={{ fontSize: 11, color: "#999" }}>Quotation</div>
          </div>
        </div>
        <div style={{ background: p, color: "#fff", padding: "6px 16px", borderRadius: 20, fontWeight: 600, fontSize: 12 }}>{q.number}</div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <div style={{ flex: 1, background: bg, padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Client</div>
          <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#777", fontSize: 12 }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
        </div>
        <div style={{ flex: 1, background: bg, padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Info</div>
          <div>{formatDate(q.issue_date)} — {formatDate(q.valid_until)}</div>
          <div style={{ marginTop: 4 }}><span style={{ background: hexToRgba(p, 0.15), color: p, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{statusLabel(q.status)}</span></div>
        </div>
      </div>
      <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${hexToRgba(p, 0.15)}`, marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: bg }}>
              {["#", "Description", "Qty", "Price", "Tax", "Disc", "Total"].map((h, i) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: i < 2 ? "left" : "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 12px", color: "#bbb" }}>{i + 1}</td>
                <td style={{ padding: "10px 12px" }}>{l.description || "—"}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 260, background: bg, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#777" }}><span>Subtotal</span><span style={{ color: "#1e1e1e" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#777" }}><span>Tax</span><span style={{ color: "#1e1e1e" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#777" }}><span>Discount</span><span style={{ color: "#1e1e1e" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: hexToRgba(p, 0.2), margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: p }}><span style={{ color: "#1e1e1e", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ background: bg, borderRadius: 12, padding: 16, fontSize: 12, color: "#666" }}>
          {q.notes && <div style={{ marginBottom: 8 }}><strong style={{ color: p }}>Notes:</strong> {q.notes}</div>}
          {q.terms && <div><strong style={{ color: p }}>Terms:</strong> {q.terms}</div>}
        </div>
      )}
    </div>
  );
}

function TplFreelancer({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#333", fontSize: 13, padding: 40 }}>
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: p, letterSpacing: -1 }}>{org?.name ?? "Your Name"}</div>
        <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>Freelance Professional</div>
        <div style={{ width: 60, height: 4, background: p, borderRadius: 2, marginTop: 12 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Prepared For</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#999", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Quote Details</div>
          <div style={{ fontWeight: 600 }}>{q.number}</div>
          <div style={{ color: "#666" }}>Issued: {formatDate(q.issue_date)}</div>
          <div style={{ color: "#666" }}>Valid: {formatDate(q.valid_until)}</div>
          <div style={{ marginTop: 4, padding: "2px 10px", background: hexToRgba(p, 0.1), color: p, borderRadius: 4, display: "inline-block", fontSize: 11, fontWeight: 600 }}>{statusLabel(q.status)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${p}` }}>
            {["Service", "Hours/Qty", "Rate", "Tax", "Disc", "Amount"].map((h, i) => (
              <th key={h} style={{ padding: "10px 8px", textAlign: i === 0 ? "left" : "right", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: p }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "12px 8px", fontWeight: 500 }}>{l.description || "—"}</td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "12px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#999" }}>{l.tax_rate}%</td>
              <td style={{ padding: "12px 8px", textAlign: "right", color: "#999" }}>{l.discount_rate}%</td>
              <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <div style={{ width: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#666" }}><span>Subtotal</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#666" }}><span>Tax</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#666" }}><span>Discount</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 3, background: p, margin: "8px 0", borderRadius: 2 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, color: p }}><span style={{ color: "#333", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ paddingTop: 20, borderTop: `1px solid ${hexToRgba(p, 0.2)}`, color: "#666" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><div style={{ fontWeight: 700, color: p, fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ whiteSpace: "pre-wrap" }}>{q.notes}</div></div>}
          {q.terms && <div><div style={{ fontWeight: 700, color: p, fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>Terms</div><div style={{ whiteSpace: "pre-wrap" }}>{q.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TplConsulting({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1e293b", fontSize: 13, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          {org?.logo_url && <img src={org.logo_url} alt={org.name} style={{ height: 36, marginBottom: 8 }} />}
          <div style={{ fontSize: 18, fontWeight: 700, color: p }}>{org?.name ?? "Your Company"}</div>
          <div style={{ fontSize: 11, color: "#999" }}>Consulting Services</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{q.number}</div>
          <div style={{ color: "#64748b", marginTop: 4 }}>{statusLabel(q.status)}</div>
        </div>
      </div>
      <div style={{ height: 2, background: `linear-gradient(to right, ${p}, transparent)`, marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Client</div>
          <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Project Info</div>
          <div>Issued: {formatDate(q.issue_date)}</div>
          <div>Valid Until: {formatDate(q.valid_until)}</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ background: p, color: "#fff" }}>
            {["#", "Service Description", "Hrs/Qty", "Rate", "Tax", "Disc", "Amount"].map((h, i) => (
              <th key={h} style={{ padding: "10px 10px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ padding: "10px", color: "#94a3b8" }}>{i + 1}</td>
              <td style={{ padding: "10px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 280, border: `2px solid ${p}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#64748b" }}><span>Subtotal</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#64748b" }}><span>Tax</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#64748b" }}><span>Discount</span><span style={{ color: "#1e293b" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: p }}><span style={{ color: "#1e293b", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, color: "#64748b" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><strong style={{ color: p }}>Notes:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.notes}</div></div>}
          {q.terms && <div><strong style={{ color: p }}>Terms:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TplRetail({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'Courier New', monospace", color: "#333", fontSize: 12, padding: 32 }}>
      <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 16, borderBottom: `2px dashed ${p}` }}>
        <div style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>{org?.name ?? "Your Store"}</div>
        <div style={{ color: "#999", marginTop: 4 }}>QUOTATION</div>
        <div style={{ marginTop: 8, fontWeight: 700 }}>{q.number}</div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div>Customer: <strong>{contactDisplayName(contact)}</strong></div>
        {company && <div>Company: {company.name}</div>}
        {contact?.email && <div>Email: {contact.email}</div>}
        <div>Date: {formatDate(q.issue_date)} | Valid: {formatDate(q.valid_until)}</div>
        <div>Status: {statusLabel(q.status)}</div>
      </div>
      <div style={{ borderTop: `1px dashed ${p}`, borderBottom: `1px dashed ${p}`, padding: "8px 0", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", fontWeight: 700, fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>
          <span>Item</span><span style={{ textAlign: "right" }}>Qty</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "right" }}>Total</span>
        </div>
        {lines.map((l, i) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "4px 0", borderTop: i > 0 ? "1px dotted #ddd" : "none" }}>
            <span>{l.description || "—"}</span>
            <span style={{ textAlign: "right" }}>{l.quantity}</span>
            <span style={{ textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</span>
            <span style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right", marginBottom: 20 }}>
        <div>Subtotal: {formatCurrency(q.subtotal, cur)}</div>
        <div>Tax: {formatCurrency(q.tax_total, cur)}</div>
        <div>Discount: -{formatCurrency(q.discount_total, cur)}</div>
        <div style={{ borderTop: `2px solid ${p}`, marginTop: 8, paddingTop: 8, fontSize: 16, fontWeight: 800 }}>TOTAL: {formatCurrency(q.total, cur)}</div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: `1px dashed ${p}`, paddingTop: 12, fontSize: 11, color: "#666" }}>
          {q.notes && <div>Notes: {q.notes}</div>}
          {q.terms && <div style={{ marginTop: 4 }}>Terms: {q.terms}</div>}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#bbb" }}>Thank you for your business!</div>
    </div>
  );
}

function TplCreative({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1e1e1e", fontSize: 13, padding: 0 }}>
      <div style={{ display: "flex", minHeight: 120 }}>
        <div style={{ width: 8, background: p }} />
        <div style={{ flex: 1, padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 3, color: p, fontWeight: 700, marginBottom: 4 }}>Quotation</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>{q.number}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{org?.name ?? "Studio"}</div>
            <div style={{ fontSize: 11, color: "#999" }}>Creative Agency</div>
          </div>
        </div>
      </div>
      <div style={{ padding: "0 40px 40px" }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 28 }}>
          <div style={{ flex: 1, padding: 16, borderLeft: `3px solid ${p}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Client</div>
            <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
            {company && <div style={{ color: "#777" }}>{company.name}</div>}
            {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          </div>
          <div style={{ flex: 1, padding: 16, borderLeft: `3px solid ${hexToRgba(p, 0.3)}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Details</div>
            <div>{formatDate(q.issue_date)} — {formatDate(q.valid_until)}</div>
            <div style={{ marginTop: 4 }}><span style={{ background: p, color: "#fff", padding: "2px 10px", borderRadius: 2, fontSize: 11, fontWeight: 600 }}>{statusLabel(q.status)}</span></div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${p}` }}>
              {["#", "Description", "Qty", "Rate", "Tax", "Disc", "Total"].map((h, i) => (
                <th key={h} style={{ padding: "10px 8px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 700, color: p }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px 8px", color: p, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: "10px 8px" }}>{l.description || "—"}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>{l.quantity}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#999" }}>{l.tax_rate}%</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#999" }}>{l.discount_rate}%</td>
                <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
          <div style={{ width: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#999" }}><span>Subtotal</span><span style={{ color: "#1e1e1e" }}>{formatCurrency(q.subtotal, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#999" }}><span>Tax</span><span style={{ color: "#1e1e1e" }}>{formatCurrency(q.tax_total, cur)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#999" }}><span>Discount</span><span style={{ color: "#1e1e1e" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
            <div style={{ height: 3, background: p, margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 800, color: p }}><span style={{ color: "#1e1e1e", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
          </div>
        </div>
        {(q.notes || q.terms) && (
          <div style={{ borderTop: `1px solid ${hexToRgba(p, 0.2)}`, paddingTop: 20, color: "#777" }}>
            {q.notes && <div style={{ marginBottom: 12 }}><strong style={{ color: p }}>Notes:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.notes}</div></div>}
            {q.terms && <div><strong style={{ color: p }}>Terms:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.terms}</div></div>}
          </div>
        )}
      </div>
    </div>
  );
}

function TplLegal({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'Times New Roman', serif", color: "#1a1a1a", fontSize: 12, lineHeight: 1.5, padding: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: p }}>{org?.name ?? "Law Firm"}</div>
        <div style={{ height: 2, background: p, margin: "12px auto", width: 100 }} />
        <div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 4, color: "#666" }}>Fee Quotation</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24, padding: "12px 16px", background: "#f5f5f0", border: `1px solid ${hexToRgba(p, 0.2)}` }}>
        <div>
          <div style={{ fontWeight: 700 }}>Re: {contactDisplayName(contact)}</div>
          {company && <div>{company.name}</div>}
          {contact?.email && <div style={{ color: "#666" }}>{contact.email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Reference: <strong>{q.number}</strong></div>
          <div>Date: {formatDate(q.issue_date)}</div>
          <div>Valid: {formatDate(q.valid_until)}</div>
          <div>Status: <strong>{statusLabel(q.status)}</strong></div>
        </div>
      </div>
      <div style={{ marginBottom: 16, fontSize: 12 }}>We are pleased to present the following fee estimate for your consideration:</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, border: `1px solid ${hexToRgba(p, 0.3)}` }}>
        <thead>
          <tr style={{ background: hexToRgba(p, 0.08) }}>
            {["No.", "Description of Services", "Units", "Rate", "Tax %", "Disc %", "Fee"].map((h, i) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 700, borderBottom: `2px solid ${p}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 10px" }}>{i + 1}.</td>
              <td style={{ padding: "8px 10px" }}>{l.description || "—"}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ width: 260, border: `1px solid ${hexToRgba(p, 0.3)}`, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Subtotal:</span><span>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Tax:</span><span>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Discount:</span><span>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}><span>Total Fee:</span><span style={{ color: p }}>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {q.notes && <div style={{ marginBottom: 16, padding: 12, background: "#f5f5f0", border: `1px solid ${hexToRgba(p, 0.15)}` }}><strong>Notes:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4, color: "#555" }}>{q.notes}</div></div>}
      {q.terms && <div style={{ marginBottom: 16 }}><strong>Terms & Conditions:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4, color: "#555" }}>{q.terms}</div></div>}
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#999", borderTop: `1px solid ${hexToRgba(p, 0.2)}`, paddingTop: 12 }}>This quotation is confidential and intended solely for the addressee. | {org?.name ?? "WorkFyr CRM"}</div>
    </div>
  );
}

function TplMedical({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: theme.fontFamily, color: "#1e293b", fontSize: 13, padding: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 20, borderBottom: `3px solid ${p}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: p, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>+</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{org?.name ?? "Medical Practice"}</div>
            <div style={{ fontSize: 11, color: "#999" }}>Healthcare Provider</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: p }}>Quotation</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{q.number}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28, padding: 16, background: hexToRgba(p, 0.04), borderRadius: 8, border: `1px solid ${hexToRgba(p, 0.1)}` }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Patient / Client</div>
          <div style={{ fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#666" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#999", fontSize: 12 }}>{contact.email}</div>}
          {contact?.phone && <div style={{ color: "#999", fontSize: 12 }}>{contact.phone}</div>}
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: p, marginBottom: 6 }}>Quote Info</div>
          <div>Date: {formatDate(q.issue_date)}</div>
          <div>Valid Until: {formatDate(q.valid_until)}</div>
          <div style={{ marginTop: 4 }}><span style={{ background: hexToRgba(p, 0.1), color: p, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{statusLabel(q.status)}</span></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: p, color: "#fff" }}>
            {["#", "Service / Procedure", "Qty", "Rate", "Tax", "Disc", "Amount"].map((h, i) => (
              <th key={h} style={{ padding: "10px 10px", textAlign: i < 2 ? "left" : "right", fontSize: 11, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#fff" : hexToRgba(p, 0.02) }}>
              <td style={{ padding: "10px", color: "#94a3b8" }}>{i + 1}</td>
              <td style={{ padding: "10px" }}>{l.description || "—"}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.quantity}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.tax_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{l.discount_rate}%</td>
              <td style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 280, background: hexToRgba(p, 0.04), borderRadius: 8, padding: 16, border: `1px solid ${hexToRgba(p, 0.1)}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>Subtotal</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>Tax</span><span style={{ color: "#1e293b" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>Discount</span><span style={{ color: "#1e293b" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 2, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: p }}><span style={{ color: "#1e293b", fontSize: 14 }}>Total</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: `1px solid ${hexToRgba(p, 0.15)}`, paddingTop: 20, color: "#64748b" }}>
          {q.notes && <div style={{ marginBottom: 12 }}><strong style={{ color: p }}>Notes:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.notes}</div></div>}
          {q.terms && <div><strong style={{ color: p }}>Terms:</strong><div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{q.terms}</div></div>}
        </div>
      )}
    </div>
  );
}

function TplTech({ quotation: q, lines, organization: org, contact, company, theme }: EditorTemplateProps) {
  const cur = q.currency || "INR";
  const p = theme.primaryColor;
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e2e8f0", fontSize: 12, background: "#0f172a", padding: 40, borderRadius: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${hexToRgba(p, 0.3)}` }}>
        <div>
          <div style={{ color: p, fontSize: 11, fontWeight: 600 }}>// Organization</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{org?.name ?? "Tech Co"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: p, fontSize: 11 }}>/* Quotation */</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: p }}>{q.number}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{statusLabel(q.status)} | {formatDate(q.issue_date)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
        <div style={{ flex: 1, padding: 16, background: "#1e293b", borderRadius: 6, border: `1px solid ${hexToRgba(p, 0.2)}` }}>
          <div style={{ color: p, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>/* Client */</div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>{contactDisplayName(contact)}</div>
          {company && <div style={{ color: "#94a3b8" }}>{company.name}</div>}
          {contact?.email && <div style={{ color: "#64748b" }}>{contact.email}</div>}
        </div>
        <div style={{ flex: 1, padding: 16, background: "#1e293b", borderRadius: 6, border: `1px solid ${hexToRgba(p, 0.2)}` }}>
          <div style={{ color: p, fontSize: 10, fontWeight: 700, marginBottom: 6 }}>/* Dates */</div>
          <div style={{ color: "#94a3b8" }}>issued: <span style={{ color: "#f1f5f9" }}>{formatDate(q.issue_date)}</span></div>
          <div style={{ color: "#94a3b8" }}>expires: <span style={{ color: "#f1f5f9" }}>{formatDate(q.valid_until)}</span></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${p}` }}>
            {["idx", "description", "qty", "rate", "tax", "disc", "total"].map((h, i) => (
              <th key={h} style={{ padding: "8px 8px", textAlign: i < 2 ? "left" : "right", fontSize: 10, fontWeight: 700, color: p, textTransform: "lowercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} style={{ borderBottom: `1px solid ${hexToRgba(p, 0.1)}` }}>
              <td style={{ padding: "8px", color: "#64748b" }}>[{i}]</td>
              <td style={{ padding: "8px", color: "#e2e8f0" }}>{l.description || "null"}</td>
              <td style={{ padding: "8px", textAlign: "right", color: "#94a3b8" }}>{l.quantity}</td>
              <td style={{ padding: "8px", textAlign: "right", color: "#94a3b8" }}>{formatCurrency(l.unit_price, cur)}</td>
              <td style={{ padding: "8px", textAlign: "right", color: "#64748b" }}>{l.tax_rate}%</td>
              <td style={{ padding: "8px", textAlign: "right", color: "#64748b" }}>{l.discount_rate}%</td>
              <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: p }}>{formatCurrency(l.line_total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 28 }}>
        <div style={{ width: 280, background: "#1e293b", borderRadius: 6, padding: 16, border: `1px solid ${hexToRgba(p, 0.2)}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>subtotal:</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(q.subtotal, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>tax:</span><span style={{ color: "#e2e8f0" }}>{formatCurrency(q.tax_total, cur)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#64748b" }}><span>discount:</span><span style={{ color: "#e2e8f0" }}>-{formatCurrency(q.discount_total, cur)}</span></div>
          <div style={{ height: 1, background: p, margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: p }}><span style={{ color: "#94a3b8", fontSize: 13 }}>total =</span><span>{formatCurrency(q.total, cur)}</span></div>
        </div>
      </div>
      {(q.notes || q.terms) && (
        <div style={{ borderTop: `1px solid ${hexToRgba(p, 0.2)}`, paddingTop: 16, color: "#64748b", fontSize: 11 }}>
          {q.notes && <div style={{ marginBottom: 8 }}><span style={{ color: p }}>// Notes:</span> {q.notes}</div>}
          {q.terms && <div><span style={{ color: p }}>// Terms:</span> {q.terms}</div>}
        </div>
      )}
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#475569" }}>/* Generated by {org?.name ?? "WorkFyr CRM"} */</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Template renderer map                                              */
/* ------------------------------------------------------------------ */

const TEMPLATE_COMPONENTS: Record<TemplateName, React.FC<EditorTemplateProps>> = {
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
/*  Collapsible Section component                                      */
/* ------------------------------------------------------------------ */

function PanelSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-[var(--color-surface-muted)] transition-colors"
      >
        <span style={{ color: "var(--color-ink-tertiary)" }}>{icon}</span>
        <span className="flex-1 text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>{title}</span>
        {open ? <ChevronDown className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} /> : <ChevronRight className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Editor Component                                              */
/* ------------------------------------------------------------------ */

export default function QuotationEditorPage({ editId }: { editId?: string }) {
  const router = useRouter();

  /* -- Core state -------------------------------------------------- */
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  /* -- Form state -------------------------------------------------- */
  const [quotationId, setQuotationId] = useState<string | null>(editId ?? null);
  const [number, setNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState(addDays(todayISO(), 30));
  const [status, setStatus] = useState<QuotationStatus>("draft");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment due within 30 days");
  const [lines, setLines] = useState<LineItemDraft[]>([emptyLine()]);

  /* -- Editor state ------------------------------------------------ */
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>("modern");
  const [theme, setTheme] = useState({ primaryColor: "#10b981", accentColor: "#059669", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" });
  const [zoom, setZoom] = useState(75);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const currency = org?.currency ?? "INR";
  const canvasRef = useRef<HTMLDivElement>(null);

  /* -- Derived totals ---------------------------------------------- */
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    for (const line of lines) {
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
  }, [lines]);

  /* -- Build quotation data for template --------------------------- */
  const quotationData: QuotationData = useMemo(() => ({
    id: quotationId,
    number,
    contact_id: contactId,
    company_id: companyId,
    issue_date: issueDate,
    valid_until: validUntil,
    status,
    notes,
    terms,
    subtotal: totals.subtotal,
    tax_total: totals.taxTotal,
    discount_total: totals.discountTotal,
    total: totals.grandTotal,
    currency,
  }), [quotationId, number, contactId, companyId, issueDate, validUntil, status, notes, terms, totals, currency]);

  const selectedContact = useMemo(() => {
    if (!contactId) return null;
    const c = contacts.find((c) => c.id === contactId);
    if (!c) return null;
    return { first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone };
  }, [contactId, contacts]);

  const selectedCompany = useMemo(() => {
    if (!companyId) return null;
    const c = companies.find((c) => c.id === companyId);
    if (!c) return null;
    return { name: c.name };
  }, [companyId, companies]);

  const orgInfo: OrgInfo | null = useMemo(() => {
    if (!org) return null;
    return { name: org.name, logo_url: org.logo_url, currency: org.currency };
  }, [org]);

  /* -- Last saved display ------------------------------------------ */
  const lastSavedText = useMemo(() => {
    if (saveStatus === "saving") return "Saving...";
    if (!lastSaved) return "";
    const diff = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (diff < 10) return "Saved just now";
    if (diff < 60) return `Saved ${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `Saved ${mins}m ago`;
  }, [lastSaved, saveStatus]);

  // Force re-render of lastSavedText periodically
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  /* -- Bootstrap --------------------------------------------------- */
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

      const [contactsRes, companiesRes] = await Promise.all([
        supabase.from("contacts").select("id, first_name, last_name, email, phone, company_id").eq("org_id", oid).order("first_name").limit(1000),
        supabase.from("companies").select("id, name").eq("org_id", oid).order("name").limit(1000),
      ]);

      setContacts((contactsRes.data as Contact[]) ?? []);
      setCompanies((companiesRes.data as Company[]) ?? []);

      // If editing existing quotation
      if (editId) {
        const { data: q } = await supabase
          .from("quotations")
          .select("*")
          .eq("id", editId)
          .single();

        if (q) {
          const qr = q as Record<string, unknown>;
          setQuotationId(qr.id as string);
          setNumber(qr.number as string);
          setContactId((qr.contact_id as string) ?? "");
          setCompanyId((qr.company_id as string) ?? "");
          setIssueDate((qr.issue_date as string) ?? todayISO());
          setValidUntil((qr.valid_until as string) ?? addDays(todayISO(), 30));
          setStatus((qr.status as QuotationStatus) ?? "draft");
          setNotes((qr.notes as string) ?? "");
          setTerms((qr.terms as string) ?? "Payment due within 30 days");

          // Fetch lines
          const { data: lineRows } = await supabase
            .from("quotation_lines")
            .select("*")
            .eq("quotation_id", editId)
            .order("position", { ascending: true });

          if (lineRows && lineRows.length > 0) {
            setLines(
              (lineRows as Record<string, unknown>[]).map((l) => ({
                id: l.id as string,
                description: (l.description as string) ?? "",
                quantity: (l.quantity as number) ?? 1,
                unit_price: (l.unit_price as number) ?? 0,
                tax_rate: (l.tax_rate as number) ?? 0,
                discount_rate: (l.discount_rate as number) ?? 0,
                line_total: (l.line_total as number) ?? 0,
              }))
            );
          }
        }
      } else {
        // Generate new number
        const { count } = await supabase
          .from("quotations")
          .select("id", { count: "exact", head: true })
          .eq("org_id", oid);
        const next = (count ?? 0) + 1;
        setNumber(`QUO-${String(next).padStart(4, "0")}`);
      }

      setLoading(false);
    })();
  }, [editId]);

  /* -- Line item management ---------------------------------------- */
  function updateLine(index: number, field: keyof LineItemDraft, value: string | number) {
    setLines((prev) => {
      const newLines = [...prev];
      const line = { ...newLines[index], [field]: value };
      line.line_total = calcLineTotal(line.quantity, line.unit_price, line.tax_rate, line.discount_rate);
      newLines[index] = line;
      return newLines;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  /* -- Save -------------------------------------------------------- */
  async function saveQuotation(markAsSent = false) {
    if (!orgId || !userId) {
      toast.error("Unable to determine organization. Please refresh.");
      return;
    }
    if (lines.every((l) => !l.description.trim())) {
      toast.error("Please add at least one line item with a description.");
      return;
    }

    setSaving(true);
    setSaveStatus("saving");
    const finalStatus: QuotationStatus = markAsSent ? "sent" : status === "sent" ? "sent" : status;

    const payload = {
      org_id: orgId,
      number,
      contact_id: contactId || null,
      company_id: companyId || null,
      issue_date: issueDate || null,
      valid_until: validUntil || null,
      status: finalStatus,
      currency,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      discount_total: totals.discountTotal,
      total: totals.grandTotal,
      notes: notes || null,
      terms: terms || null,
      owner_id: userId,
      updated_at: new Date().toISOString(),
    };

    let savedId = quotationId;

    if (quotationId) {
      const { error } = await (supabase.from("quotations") as any).update(payload).eq("id", quotationId);
      if (error) {
        toast.error("Failed to update quotation: " + error.message);
        setSaving(false);
        setSaveStatus("idle");
        return;
      }
      await (supabase.from("quotation_lines") as any).delete().eq("quotation_id", quotationId);
    } else {
      const { data, error } = await (supabase.from("quotations") as any)
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Failed to create quotation: " + (error?.message ?? "Unknown error"));
        setSaving(false);
        setSaveStatus("idle");
        return;
      }
      savedId = (data as { id: string }).id;
      setQuotationId(savedId);
      // Update URL without full navigation
      window.history.replaceState(null, "", `/crm/quotations/editor/${savedId}`);
    }

    // Insert line items
    const linePayloads = lines
      .filter((l) => l.description.trim())
      .map((l, i) => ({
        org_id: orgId,
        quotation_id: savedId,
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
        setSaveStatus("idle");
        return;
      }
    }

    if (markAsSent) {
      setStatus("sent");
    }

    toast.success(quotationId ? "Quotation updated." : "Quotation created.");
    setSaving(false);
    setLastSaved(new Date());
    setSaveStatus("saved");
  }

  /* -- Template selection ------------------------------------------ */
  function selectTemplate(key: TemplateName) {
    setSelectedTemplate(key);
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (tpl) {
      setTheme((prev) => ({ ...prev, primaryColor: tpl.defaultPrimary, accentColor: tpl.defaultAccent }));
    }
  }

  /* -- Render template --------------------------------------------- */
  const TemplateComponent = TEMPLATE_COMPONENTS[selectedTemplate];

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "var(--color-canvas)" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="size-8 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-viridian-500)" }}
          />
          <span className="text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>Loading editor...</span>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main render                                                      */
  /* ---------------------------------------------------------------- */

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "var(--color-canvas)" }}>
      {/* ============ TOP BAR ============ */}
      <div
        className="h-14 shrink-0 flex items-center justify-between px-4 gap-4"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/crm/quotations")}
            className="size-8 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)] transition-colors"
          >
            <ArrowLeft className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="size-4" style={{ color: "var(--color-viridian-500)" }} />
            <span className="text-[15px] font-semibold" style={{ color: "var(--color-ink)" }}>
              {number || "New Quotation"}
            </span>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded"
              style={{ background: hexToRgba(theme.primaryColor, 0.1), color: theme.primaryColor }}
            >
              {statusLabel(status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastSavedText && (
            <span className="text-[12px] mr-2" style={{ color: "var(--color-ink-tertiary)" }}>
              {lastSavedText}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Save className="size-3.5" />}
            onClick={() => saveQuotation(false)}
            loading={saving}
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
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex flex-1 overflow-hidden">
        {/* -------- DOCUMENT CANVAS -------- */}
        <div
          className="flex-1 overflow-auto"
          style={{
            background: "#e5e7eb",
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="flex items-start justify-center p-8" style={{ minHeight: "100%" }}>
            <div
              ref={canvasRef}
              data-print-area
              style={{
                width: 794,
                minHeight: 1123,
                background: "#ffffff",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
                borderRadius: 4,
                overflow: "hidden",
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                marginBottom: zoom < 100 ? -(1123 * (1 - zoom / 100)) : 0,
              }}
            >
              <TemplateComponent
                quotation={quotationData}
                lines={lines}
                organization={orgInfo}
                contact={selectedContact}
                company={selectedCompany}
                theme={theme}
              />
            </div>
          </div>
        </div>

        {/* -------- RIGHT PANEL -------- */}
        <div
          className="w-[340px] shrink-0 flex flex-col overflow-y-auto"
          style={{ background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)" }}
        >
          {/* Template Section */}
          <PanelSection title="Template" icon={<LayoutTemplate className="size-4" />}>
            <div className="grid grid-cols-5 gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  onClick={() => selectTemplate(tpl.key)}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all"
                  style={{
                    border: selectedTemplate === tpl.key ? `2px solid ${tpl.thumbColor}` : "2px solid transparent",
                    background: selectedTemplate === tpl.key ? hexToRgba(tpl.thumbColor, 0.06) : "transparent",
                  }}
                  title={tpl.label}
                >
                  <div
                    className="w-full aspect-[3/4] rounded"
                    style={{
                      background: `linear-gradient(135deg, ${tpl.thumbColor}, ${lighten(tpl.thumbColor, 60)})`,
                      position: "relative",
                    }}
                  >
                    <div style={{ position: "absolute", top: 3, left: 3, right: 3, height: 2, background: "rgba(255,255,255,0.5)", borderRadius: 1 }} />
                    <div style={{ position: "absolute", top: 8, left: 3, width: "40%", height: 1.5, background: "rgba(255,255,255,0.3)", borderRadius: 1 }} />
                    <div style={{ position: "absolute", bottom: 6, left: 3, right: 3, height: 1, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
                    <div style={{ position: "absolute", bottom: 3, left: 3, right: 3, height: 1, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
                  </div>
                  <span className="text-[9px] font-medium truncate w-full text-center" style={{ color: "var(--color-ink-secondary)" }}>{tpl.label}</span>
                </button>
              ))}
            </div>
          </PanelSection>

          {/* Theme Section */}
          <PanelSection title="Theme / Colors" icon={<Palette className="size-4" />} defaultOpen={false}>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-medium mb-2" style={{ color: "var(--color-ink-tertiary)" }}>Presets</div>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setTheme((prev) => ({ ...prev, primaryColor: preset.primaryColor, accentColor: preset.accentColor }))}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all"
                      style={{
                        border: theme.primaryColor === preset.primaryColor ? `2px solid ${preset.swatch}` : "2px solid var(--color-border)",
                        background: theme.primaryColor === preset.primaryColor ? hexToRgba(preset.swatch, 0.06) : "transparent",
                      }}
                    >
                      <div className="w-6 h-6 rounded-full" style={{ background: preset.swatch }} />
                      <span className="text-[9px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium mb-1.5" style={{ color: "var(--color-ink-tertiary)" }}>Custom Primary Color</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.primaryColor}
                    onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border-none"
                    style={{ padding: 0 }}
                  />
                  <input
                    type="text"
                    value={theme.primaryColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        setTheme((prev) => ({ ...prev, primaryColor: v, accentColor: v }));
                      }
                    }}
                    className="flex-1 h-8 px-2 rounded text-[12px] font-mono outline-none"
                    style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                  />
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Details Section */}
          <PanelSection title="Details" icon={<FileText className="size-4" />}>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Quote Number</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg text-[13px] outline-none"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg text-[12px] outline-none"
                    style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Valid Until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg text-[12px] outline-none"
                    style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                  className="w-full h-8 px-2 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Contact</label>
                <select
                  value={contactId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactId(val);
                    if (val) {
                      const c = contacts.find((c) => c.id === val);
                      if (c?.company_id && !companyId) {
                        setCompanyId(c.company_id);
                      }
                    }
                  }}
                  className="w-full h-8 px-2 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {contactDisplayName(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg text-[13px] outline-none appearance-none cursor-pointer"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                >
                  <option value="">Select company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </PanelSection>

          {/* Line Items Section */}
          <PanelSection title="Line Items" icon={<ClipboardList className="size-4" />}>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={line.id}
                  className="rounded-lg p-2.5"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Item description"
                      className="flex-1 bg-transparent text-[13px] outline-none font-medium"
                      style={{ color: "var(--color-ink)" }}
                    />
                    <button
                      onClick={() => removeLine(i)}
                      className="size-5 inline-flex items-center justify-center rounded hover:bg-[var(--color-border)] transition-colors shrink-0 mt-0.5"
                      disabled={lines.length <= 1}
                      style={{ opacity: lines.length <= 1 ? 0.3 : 1 }}
                    >
                      <Trash2 className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <div>
                      <div className="text-[9px] font-medium mb-0.5" style={{ color: "var(--color-ink-tertiary)" }}>Qty</div>
                      <input
                        type="number"
                        value={line.quantity || ""}
                        onChange={(e) => updateLine(i, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-full h-6 px-1.5 rounded text-[12px] text-right outline-none"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                        min={0}
                        step={1}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-medium mb-0.5" style={{ color: "var(--color-ink-tertiary)" }}>Price</div>
                      <input
                        type="number"
                        value={line.unit_price || ""}
                        onChange={(e) => updateLine(i, "unit_price", parseFloat(e.target.value) || 0)}
                        className="w-full h-6 px-1.5 rounded text-[12px] text-right outline-none"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                        min={0}
                        step={0.01}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-medium mb-0.5" style={{ color: "var(--color-ink-tertiary)" }}>Tax %</div>
                      <input
                        type="number"
                        value={line.tax_rate || ""}
                        onChange={(e) => updateLine(i, "tax_rate", parseFloat(e.target.value) || 0)}
                        className="w-full h-6 px-1.5 rounded text-[12px] text-right outline-none"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-medium mb-0.5" style={{ color: "var(--color-ink-tertiary)" }}>Disc %</div>
                      <input
                        type="number"
                        value={line.discount_rate || ""}
                        onChange={(e) => updateLine(i, "discount_rate", parseFloat(e.target.value) || 0)}
                        className="w-full h-6 px-1.5 rounded text-[12px] text-right outline-none"
                        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                    <div>
                      <div className="text-[9px] font-medium mb-0.5" style={{ color: "var(--color-ink-tertiary)" }}>Total</div>
                      <div className="h-6 flex items-center justify-end text-[12px] font-semibold" style={{ color: "var(--color-ink)" }}>
                        {formatCurrency(line.line_total, currency)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addLine}
                className="w-full h-8 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors hover:bg-[var(--color-surface-muted)]"
                style={{ border: "1px dashed var(--color-border)", color: "var(--color-ink-secondary)" }}
              >
                <Plus className="size-3" />
                Add item
              </button>

              {/* Summary */}
              <div
                className="rounded-lg p-3 mt-2"
                style={{ background: hexToRgba(theme.primaryColor, 0.04), border: `1px solid ${hexToRgba(theme.primaryColor, 0.15)}` }}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: "var(--color-ink-secondary)" }}>Subtotal</span>
                    <span style={{ color: "var(--color-ink)" }}>{formatCurrency(totals.subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: "var(--color-ink-secondary)" }}>Tax</span>
                    <span style={{ color: "var(--color-ink)" }}>{formatCurrency(totals.taxTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: "var(--color-ink-secondary)" }}>Discount</span>
                    <span style={{ color: "var(--color-ink)" }}>-{formatCurrency(totals.discountTotal, currency)}</span>
                  </div>
                  <div style={{ height: 1, background: hexToRgba(theme.primaryColor, 0.15), margin: "4px 0" }} />
                  <div className="flex justify-between">
                    <span className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>Total</span>
                    <span className="text-[15px] font-bold" style={{ color: theme.primaryColor }}>{formatCurrency(totals.grandTotal, currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Notes & Terms Section */}
          <PanelSection title="Notes & Terms" icon={<StickyNote className="size-4" />} defaultOpen={false}>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the client..."
                  rows={3}
                  className="w-full px-2.5 py-2 rounded-lg text-[13px] outline-none resize-none"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--color-ink-tertiary)" }}>Terms & Conditions</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Payment terms..."
                  rows={3}
                  className="w-full px-2.5 py-2 rounded-lg text-[13px] outline-none resize-none"
                  style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)", color: "var(--color-ink)" }}
                />
              </div>
            </div>
          </PanelSection>
        </div>
      </div>

      {/* ============ STATUS BAR ============ */}
      <div
        className="h-9 shrink-0 flex items-center justify-between px-4"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          {lastSavedText && (
            <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
              {lastSavedText}
            </span>
          )}
          <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
            Template: {TEMPLATES.find((t) => t.key === selectedTemplate)?.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] mr-2" style={{ color: "var(--color-ink-tertiary)" }}>Zoom:</span>
          {[75, 100, 125].map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className="h-6 px-2 rounded text-[11px] font-medium transition-colors"
              style={{
                background: zoom === z ? "var(--color-viridian-500)" : "transparent",
                color: zoom === z ? "#fff" : "var(--color-ink-tertiary)",
              }}
            >
              {z}%
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
