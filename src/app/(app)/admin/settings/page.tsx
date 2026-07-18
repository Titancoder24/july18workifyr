"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Building2,
  Globe,
  FileText,
  Sparkles,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CURRENCIES = [
  { code: "INR", label: "INR - Indian Rupee" },
  { code: "USD", label: "USD - US Dollar" },
  { code: "EUR", label: "EUR - Euro" },
  { code: "GBP", label: "GBP - British Pound" },
  { code: "AED", label: "AED - UAE Dirham" },
  { code: "SGD", label: "SGD - Singapore Dollar" },
  { code: "AUD", label: "AUD - Australian Dollar" },
  { code: "CAD", label: "CAD - Canadian Dollar" },
  { code: "JPY", label: "JPY - Japanese Yen" },
  { code: "CNY", label: "CNY - Chinese Yuan" },
];

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const DAY_LABELS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OrgData = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  currency: string;
  timezone: string;
  fiscal_year_start_month: number;
  working_days: number[];
  invoice_number_format: string | null;
  ai_model: string | null;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Org data split into sections
  const [profile, setProfile] = useState({ name: "", slug: "", logo_url: "", brand_color: "#40826D" });
  const [regional, setRegional] = useState({ currency: "INR", timezone: "Asia/Kolkata", fiscal_year_start_month: 4, working_days: [1, 2, 3, 4, 5] as number[] });
  const [invoice, setInvoice] = useState({ invoice_number_format: "" });
  const [ai, setAi] = useState({ ai_model: "" });

  // Section saving states
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRegional, setSavingRegional] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  /* ---- data fetch ---- */
  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single() as { data: { id: string; org_id: string } | null };
    if (!profileData) return;

    setOrgId(profileData.org_id);

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, slug, logo_url, brand_color, currency, timezone, fiscal_year_start_month, working_days, invoice_number_format, ai_model")
      .eq("id", profileData.org_id)
      .single() as { data: OrgData | null };

    if (org) {
      setProfile({
        name: org.name ?? "",
        slug: org.slug ?? "",
        logo_url: org.logo_url ?? "",
        brand_color: org.brand_color ?? "#40826D",
      });
      setRegional({
        currency: org.currency ?? "INR",
        timezone: org.timezone ?? "Asia/Kolkata",
        fiscal_year_start_month: org.fiscal_year_start_month ?? 4,
        working_days: org.working_days ?? [1, 2, 3, 4, 5],
      });
      setInvoice({
        invoice_number_format: org.invoice_number_format ?? "",
      });
      setAi({
        ai_model: org.ai_model ?? "",
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- save handlers ---- */
  async function saveSection(section: string, data: Record<string, unknown>, setLoading: (v: boolean) => void) {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase.from("organizations") as any).update(data).eq("id", orgId);
    setLoading(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    toast.success(`${section} updated successfully`);
  }

  function handleSaveProfile() {
    saveSection("Organization profile", {
      name: profile.name,
      slug: profile.slug,
      logo_url: profile.logo_url || null,
      brand_color: profile.brand_color,
    }, setSavingProfile);
  }

  function handleSaveRegional() {
    saveSection("Regional settings", {
      currency: regional.currency,
      timezone: regional.timezone,
      fiscal_year_start_month: regional.fiscal_year_start_month,
      working_days: regional.working_days,
    }, setSavingRegional);
  }

  function handleSaveInvoice() {
    saveSection("Invoice settings", {
      invoice_number_format: invoice.invoice_number_format || null,
    }, setSavingInvoice);
  }

  function handleSaveAi() {
    saveSection("AI configuration", {
      ai_model: ai.ai_model || null,
    }, setSavingAi);
  }

  function toggleWorkingDay(day: number) {
    setRegional((prev) => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d) => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  }

  /* ---- invoice preview ---- */
  function getInvoicePreview(): string {
    if (!invoice.invoice_number_format) return "INV-2026-0001";
    const year = new Date().getFullYear().toString();
    let preview = invoice.invoice_number_format;
    preview = preview.replace("{YYYY}", year);
    preview = preview.replace("{YY}", year.slice(-2));
    preview = preview.replace("{MM}", String(new Date().getMonth() + 1).padStart(2, "0"));
    preview = preview.replace("{####}", "0001");
    preview = preview.replace("{###}", "001");
    preview = preview.replace("{##}", "01");
    return preview;
  }

  /* ---- render ---- */
  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin" style={{ color: "var(--color-ink-tertiary)" }} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Configure your organization" />

      <div className="space-y-5 max-w-[720px]">
        {/* ---- Organization Profile ---- */}
        <SettingsCard
          icon={<Building2 className="size-4" />}
          title="Organization Profile"
          description="Basic information about your organization"
          footer={
            <Button variant="primary" iconLeft={<Save className="size-3.5" />} onClick={handleSaveProfile} loading={savingProfile}>
              Save changes
            </Button>
          }
        >
          <div className="space-y-3">
            <Field label="Organization name" required>
              <Input
                value={profile.name}
                onChange={(e) => setProfile((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mercedes-Benz"
              />
            </Field>
            <Field label="Slug" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Used in URLs</span>}>
              <Input
                value={profile.slug}
                onChange={(e) =>
                  setProfile((f) => ({
                    ...f,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  }))
                }
                placeholder="mercedes-benz"
              />
            </Field>
            <Field label="Logo URL">
              <Input
                value={profile.logo_url}
                onChange={(e) => setProfile((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
            </Field>
            <Field label="Brand color">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={profile.brand_color}
                  onChange={(e) => setProfile((f) => ({ ...f, brand_color: e.target.value }))}
                  className="h-9 w-12 rounded-lg cursor-pointer border-0"
                  style={{ background: "var(--color-surface)" }}
                />
                <Input
                  value={profile.brand_color}
                  onChange={(e) => setProfile((f) => ({ ...f, brand_color: e.target.value }))}
                  placeholder="#40826D"
                  className="flex-1"
                />
                <div
                  className="size-9 rounded-lg shrink-0"
                  style={{ background: profile.brand_color, border: "1px solid var(--color-border)" }}
                />
              </div>
            </Field>
          </div>
        </SettingsCard>

        {/* ---- Regional Settings ---- */}
        <SettingsCard
          icon={<Globe className="size-4" />}
          title="Regional Settings"
          description="Currency, timezone, and work schedule"
          footer={
            <Button variant="primary" iconLeft={<Save className="size-3.5" />} onClick={handleSaveRegional} loading={savingRegional}>
              Save changes
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <Select
                  value={regional.currency}
                  onChange={(e) => setRegional((f) => ({ ...f, currency: e.target.value }))}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Timezone">
                <Select
                  value={regional.timezone}
                  onChange={(e) => setRegional((f) => ({ ...f, timezone: e.target.value }))}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Fiscal year start month">
              <Select
                value={regional.fiscal_year_start_month}
                onChange={(e) => setRegional((f) => ({ ...f, fiscal_year_start_month: Number(e.target.value) }))}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Working days">
              <div className="flex gap-1.5 mt-1">
                {DAY_LABELS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleWorkingDay(d.value)}
                    className="flex-1 h-9 rounded-lg text-[12px] font-medium transition-colors"
                    style={{
                      background: regional.working_days.includes(d.value)
                        ? "var(--color-viridian-500)"
                        : "var(--color-surface)",
                      color: regional.working_days.includes(d.value)
                        ? "white"
                        : "var(--color-ink-secondary)",
                      border: regional.working_days.includes(d.value)
                        ? "1px solid var(--color-viridian-500)"
                        : "1px solid var(--color-border)",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SettingsCard>

        {/* ---- Invoice Settings ---- */}
        <SettingsCard
          icon={<FileText className="size-4" />}
          title="Invoice Settings"
          description="Configure your invoice numbering format"
          footer={
            <Button variant="primary" iconLeft={<Save className="size-3.5" />} onClick={handleSaveInvoice} loading={savingInvoice}>
              Save changes
            </Button>
          }
        >
          <div className="space-y-3">
            <Field
              label="Invoice number format"
              hint={
                <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                  Tokens: {"{YYYY}"}, {"{YY}"}, {"{MM}"}, {"{####}"}
                </span>
              }
            >
              <Input
                value={invoice.invoice_number_format}
                onChange={(e) => setInvoice({ invoice_number_format: e.target.value })}
                placeholder="INV-{YYYY}-{####}"
              />
            </Field>
            <div
              className="px-3 py-2.5 rounded-lg text-[13px]"
              style={{ background: "var(--color-canvas)", border: "1px solid var(--color-border)" }}
            >
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-ink-tertiary)" }}>
                Preview:{" "}
              </span>
              <span className="font-medium" style={{ color: "var(--color-viridian-700)" }}>
                {getInvoicePreview()}
              </span>
            </div>
          </div>
        </SettingsCard>

        {/* ---- AI Configuration ---- */}
        <SettingsCard
          icon={<Sparkles className="size-4" />}
          title="AI Configuration"
          description="Configure the AI model used across your organization"
          footer={
            <Button variant="primary" iconLeft={<Save className="size-3.5" />} onClick={handleSaveAi} loading={savingAi}>
              Save changes
            </Button>
          }
        >
          <Field label="AI Model" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Model identifier</span>}>
            <Input
              value={ai.ai_model}
              onChange={(e) => setAi({ ai_model: e.target.value })}
              placeholder="claude-sonnet-4-20250514"
            />
          </Field>
        </SettingsCard>

        {/* ---- Danger Zone ---- */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "2px solid var(--color-ink)",
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4" style={{ color: "var(--color-ink)" }} />
              <h3 className="text-[15px] font-semibold tracking-tight">Danger Zone</h3>
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              Irreversible and destructive actions
            </p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-medium">Delete this organization</div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--color-ink-secondary)" }}>
                  Once you delete an organization, there is no going back. All data will be permanently removed.
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete organization
              </Button>
            </div>

            {showDeleteConfirm && (
              <div
                className="mt-4 p-4 rounded-lg"
                style={{ background: "var(--color-canvas)", border: "1px solid var(--color-border)" }}
              >
                <p className="text-[13px] font-medium mb-2">
                  To confirm, type{" "}
                  <span className="font-mono font-semibold" style={{ color: "var(--color-ink)" }}>
                    {profile.name || "delete"}
                  </span>{" "}
                  below:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={profile.name || "delete"}
                />
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deleteConfirmText !== (profile.name || "delete")}
                    onClick={() => {
                      toast.error("Organization deletion is disabled in this environment");
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    I understand, delete this organization
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings card                                                      */
/* ------------------------------------------------------------------ */

function SettingsCard({
  icon,
  title,
  description,
  children,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-viridian-500)" }}>{icon}</span>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
          {description}
        </p>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div
          className="px-5 py-3 flex justify-end"
          style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-canvas)" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
