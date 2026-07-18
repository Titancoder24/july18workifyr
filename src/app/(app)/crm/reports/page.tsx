"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  viridian500: "#16a34a",
  viridian400: "#22c55e",
  viridian300: "#4ade80",
  viridian200: "#86efac",
  viridian100: "#dcfce7",
  viridian700: "#15803d",
  ink: "#0f172a",
  inkSecondary: "#475569",
  inkTertiary: "#94a3b8",
  border: "#e2e8f0",
  surface: "#ffffff",
  surfaceMuted: "#f8fafc",
  canvas: "#f1f5f9",
};

const PIE_SOURCE_COLORS = [
  COLORS.viridian700,
  COLORS.viridian500,
  COLORS.viridian400,
  COLORS.viridian300,
  COLORS.viridian200,
  COLORS.inkSecondary,
  COLORS.inkTertiary,
];

type Period = "this_month" | "last_3_months" | "last_6_months" | "this_year" | "all_time";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
];

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "this_month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "last_3_months": {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return d;
    }
    case "last_6_months": {
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return d;
    }
    case "this_year":
      return new Date(now.getFullYear(), 0, 1);
    case "all_time":
      return null;
  }
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function generateMonthKeys(start: Date | null, end: Date): string[] {
  const keys: string[] = [];
  const s = start ?? new Date(2020, 0, 1);
  const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function filterByDate<T extends { created_at?: string | null }>(items: T[], periodStart: Date | null): T[] {
  if (!periodStart) return items;
  return items.filter((item) => {
    if (!item.created_at) return false;
    return new Date(item.created_at) >= periodStart;
  });
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "var(--shadow-pop)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 500 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function ChartCard({ title, subtitle, children, height }: { title: string; subtitle?: string; children: React.ReactNode; height?: number }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--color-ink-tertiary)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ width: "100%", height: height ?? 300 }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between min-h-[110px]" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: 12, color: "var(--color-ink-secondary)", fontWeight: 500 }}>{label}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.2 }}>{value}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--color-ink-tertiary)", marginTop: 4 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function NoData() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-ink-tertiary)", fontSize: 13 }}>
      No data available
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("this_year");
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Not authenticated");
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
        if (!profile?.org_id) {
          toast.error("No organization found");
          setLoading(false);
          return;
        }
        const orgId = profile.org_id;

        const [leadsRes, dealsRes, stagesRes, pipelinesRes, contactsRes, companiesRes, invoicesRes, quotationsRes, tasksRes, profilesRes] = await Promise.all([
          supabase.from("leads").select("id, status, source, created_at, owner_id").eq("org_id", orgId).limit(5000),
          supabase.from("deals").select("id, title, value, currency, status, stage_id, pipeline_id, owner_id, created_at, closed_at, expected_close_date").eq("org_id", orgId).limit(5000),
          supabase.from("pipeline_stages").select("id, name, pipeline_id, position, is_won, is_lost, probability").limit(500),
          supabase.from("pipelines").select("id, name").eq("org_id", orgId).limit(100),
          supabase.from("contacts").select("id, created_at").eq("org_id", orgId).limit(5000),
          supabase.from("companies").select("id, created_at").eq("org_id", orgId).limit(5000),
          supabase.from("invoices").select("id, status, total, created_at, due_date").eq("org_id", orgId).limit(5000),
          supabase.from("quotations").select("id, status, total, created_at").eq("org_id", orgId).limit(5000),
          supabase.from("tasks").select("id, status, created_at").eq("org_id", orgId).limit(5000),
          supabase.from("profiles").select("id, full_name").eq("org_id", orgId).limit(500),
        ]);

        setLeads(leadsRes.data ?? []);
        setDeals(dealsRes.data ?? []);
        setStages(stagesRes.data ?? []);
        setPipelines(pipelinesRes.data ?? []);
        setContacts(contactsRes.data ?? []);
        setCompanies(companiesRes.data ?? []);
        setInvoices(invoicesRes.data ?? []);
        setQuotations(quotationsRes.data ?? []);
        setTasks(tasksRes.data ?? []);
        setProfiles(profilesRes.data ?? []);
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => now.toISOString().slice(0, 10), [now]);

  const filteredLeads = useMemo(() => filterByDate(leads, periodStart), [leads, periodStart]);
  const filteredDeals = useMemo(() => filterByDate(deals, periodStart), [deals, periodStart]);
  const filteredContacts = useMemo(() => filterByDate(contacts, periodStart), [contacts, periodStart]);
  const filteredCompanies = useMemo(() => filterByDate(companies, periodStart), [companies, periodStart]);
  const filteredInvoices = useMemo(() => filterByDate(invoices, periodStart), [invoices, periodStart]);
  const filteredQuotations = useMemo(() => filterByDate(quotations, periodStart), [quotations, periodStart]);
  const filteredTasks = useMemo(() => filterByDate(tasks, periodStart), [tasks, periodStart]);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p: any) => {
      m[p.id] = p.full_name || "Unknown";
    });
    return m;
  }, [profiles]);

  const allMonths = useMemo(() => generateMonthKeys(periodStart, now), [periodStart, now]);

  const totalRevenue = useMemo(() => filteredInvoices.filter((inv: any) => inv.status === "paid").reduce((s: number, inv: any) => s + (Number(inv.total) || 0), 0), [filteredInvoices]);

  const openDeals = useMemo(() => filteredDeals.filter((d: any) => d.status === "open"), [filteredDeals]);
  const openDealsValue = useMemo(() => openDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0), [openDeals]);

  const wonDeals = useMemo(() => filteredDeals.filter((d: any) => d.status === "won"), [filteredDeals]);
  const closedDeals = useMemo(() => filteredDeals.filter((d: any) => d.status === "won" || d.status === "lost"), [filteredDeals]);
  const winRate = useMemo(() => (closedDeals.length > 0 ? ((wonDeals.length / closedDeals.length) * 100).toFixed(1) : "0"), [wonDeals, closedDeals]);

  const overdueInvoices = useMemo(
    () => filteredInvoices.filter((inv: any) => inv.status !== "paid" && inv.status !== "cancelled" && inv.due_date && inv.due_date < today),
    [filteredInvoices, today]
  );

  const revenueOverTime = useMemo(() => {
    const paidInvoices = filteredInvoices.filter((inv: any) => inv.status === "paid" && inv.created_at);
    const grouped: Record<string, number> = {};
    paidInvoices.forEach((inv: any) => {
      const mk = monthKey(inv.created_at);
      grouped[mk] = (grouped[mk] || 0) + (Number(inv.total) || 0);
    });
    return allMonths.map((mk) => ({ month: monthLabel(mk), revenue: grouped[mk] || 0 }));
  }, [filteredInvoices, allMonths]);

  const LEAD_FUNNEL_STAGES = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won"];
  const LEAD_FUNNEL_LABELS: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    proposal_sent: "Proposal Sent",
    negotiation: "Negotiation",
    won: "Won",
  };

  const leadFunnel = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    LEAD_FUNNEL_STAGES.forEach((s) => (statusCounts[s] = 0));
    filteredLeads.forEach((l: any) => {
      const st = (l.status || "new").toLowerCase();
      if (statusCounts[st] !== undefined) statusCounts[st]++;
    });
    let cumulative = 0;
    LEAD_FUNNEL_STAGES.forEach((s) => (cumulative += statusCounts[s]));
    const result: { stage: string; label: string; count: number; cumulative: number; rate: string }[] = [];
    let running = cumulative;
    for (let i = 0; i < LEAD_FUNNEL_STAGES.length; i++) {
      const s = LEAD_FUNNEL_STAGES[i];
      const count = statusCounts[s];
      const prevRunning = i === 0 ? cumulative : result[i - 1].cumulative;
      result.push({
        stage: s,
        label: LEAD_FUNNEL_LABELS[s],
        count,
        cumulative: running,
        rate: prevRunning > 0 ? ((running / prevRunning) * 100).toFixed(0) : "0",
      });
      running -= count;
    }
    return result;
  }, [filteredLeads]);

  const pipelineStageData = useMemo(() => {
    const pipelineIds = new Set(pipelines.map((p: any) => p.id));
    const orgStages = stages.filter((s: any) => pipelineIds.has(s.pipeline_id));
    orgStages.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const stageValueMap: Record<string, { value: number; count: number }> = {};
    filteredDeals.forEach((d: any) => {
      if (!d.stage_id) return;
      if (!stageValueMap[d.stage_id]) stageValueMap[d.stage_id] = { value: 0, count: 0 };
      stageValueMap[d.stage_id].value += Number(d.value) || 0;
      stageValueMap[d.stage_id].count += 1;
    });
    return orgStages.map((s: any) => ({
      name: s.name,
      value: stageValueMap[s.id]?.value ?? 0,
      count: stageValueMap[s.id]?.count ?? 0,
    }));
  }, [stages, pipelines, filteredDeals]);

  const leadSourceData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredLeads.forEach((l: any) => {
      const src = l.source || "other";
      grouped[src] = (grouped[src] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredLeads]);

  const dealStatusData = useMemo(() => {
    const grouped: Record<string, number> = { open: 0, won: 0, lost: 0 };
    filteredDeals.forEach((d: any) => {
      const st = d.status || "open";
      if (grouped[st] !== undefined) grouped[st]++;
      else grouped["open"]++;
    });
    return [
      { name: "Open", value: grouped.open, color: COLORS.surfaceMuted },
      { name: "Won", value: grouped.won, color: COLORS.viridian500 },
      { name: "Lost", value: grouped.lost, color: COLORS.inkTertiary },
    ].filter((d) => d.value > 0);
  }, [filteredDeals]);

  const dealWinLossMonthly = useMemo(() => {
    const wonByMonth: Record<string, number> = {};
    const lostByMonth: Record<string, number> = {};
    filteredDeals.forEach((d: any) => {
      if (d.status !== "won" && d.status !== "lost") return;
      const dateField = d.closed_at || d.created_at;
      if (!dateField) return;
      const mk = monthKey(dateField);
      if (d.status === "won") wonByMonth[mk] = (wonByMonth[mk] || 0) + 1;
      else lostByMonth[mk] = (lostByMonth[mk] || 0) + 1;
    });
    return allMonths.map((mk) => ({
      month: monthLabel(mk),
      won: wonByMonth[mk] || 0,
      lost: lostByMonth[mk] || 0,
    }));
  }, [filteredDeals, allMonths]);

  const invoiceStatusData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredInvoices.forEach((inv: any) => {
      const st = inv.status || "draft";
      grouped[st] = (grouped[st] || 0) + 1;
    });
    const labelColors: Record<string, string> = {
      draft: COLORS.inkTertiary,
      sent: COLORS.viridian200,
      paid: COLORS.viridian500,
      overdue: "#ef4444",
      cancelled: COLORS.border,
    };
    return Object.entries(grouped).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: labelColors[name] || COLORS.inkSecondary,
    }));
  }, [filteredInvoices]);

  const invoiceTotal = useMemo(() => invoiceStatusData.reduce((s, d) => s + d.value, 0), [invoiceStatusData]);

  const topPerformers = useMemo(() => {
    const ownerValues: Record<string, number> = {};
    deals
      .filter((d: any) => d.status === "won")
      .forEach((d: any) => {
        if (!d.owner_id) return;
        ownerValues[d.owner_id] = (ownerValues[d.owner_id] || 0) + (Number(d.value) || 0);
      });
    return Object.entries(ownerValues)
      .map(([id, value]) => ({ name: profileMap[id] || "Unknown", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [deals, profileMap]);

  const quotationConversion = useMemo(() => {
    const totalByMonth: Record<string, number> = {};
    const acceptedByMonth: Record<string, number> = {};
    filteredQuotations.forEach((q: any) => {
      if (!q.created_at) return;
      const mk = monthKey(q.created_at);
      totalByMonth[mk] = (totalByMonth[mk] || 0) + 1;
      if (q.status === "accepted") acceptedByMonth[mk] = (acceptedByMonth[mk] || 0) + 1;
    });
    return allMonths.map((mk) => {
      const total = totalByMonth[mk] || 0;
      const accepted = acceptedByMonth[mk] || 0;
      return {
        month: monthLabel(mk),
        rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      };
    });
  }, [filteredQuotations, allMonths]);

  const taskCompletion = useMemo(() => {
    const doneByMonth: Record<string, number> = {};
    const progressByMonth: Record<string, number> = {};
    const openByMonth: Record<string, number> = {};
    filteredTasks.forEach((t: any) => {
      if (!t.created_at) return;
      const mk = monthKey(t.created_at);
      const st = (t.status || "open").toLowerCase();
      if (st === "done" || st === "completed") doneByMonth[mk] = (doneByMonth[mk] || 0) + 1;
      else if (st === "in_progress") progressByMonth[mk] = (progressByMonth[mk] || 0) + 1;
      else openByMonth[mk] = (openByMonth[mk] || 0) + 1;
    });
    return allMonths.map((mk) => ({
      month: monthLabel(mk),
      done: doneByMonth[mk] || 0,
      in_progress: progressByMonth[mk] || 0,
      open: openByMonth[mk] || 0,
    }));
  }, [filteredTasks, allMonths]);

  const contactsCompaniesGrowth = useMemo(() => {
    const contactsByMonth: Record<string, number> = {};
    const companiesByMonth: Record<string, number> = {};
    contacts.forEach((c: any) => {
      if (!c.created_at) return;
      const mk = monthKey(c.created_at);
      contactsByMonth[mk] = (contactsByMonth[mk] || 0) + 1;
    });
    companies.forEach((c: any) => {
      if (!c.created_at) return;
      const mk = monthKey(c.created_at);
      companiesByMonth[mk] = (companiesByMonth[mk] || 0) + 1;
    });
    let cumulContacts = 0;
    let cumulCompanies = 0;
    return allMonths.map((mk) => {
      cumulContacts += contactsByMonth[mk] || 0;
      cumulCompanies += companiesByMonth[mk] || 0;
      return { month: monthLabel(mk), contacts: cumulContacts, companies: cumulCompanies };
    });
  }, [contacts, companies, allMonths]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Reports & Analytics" description="CRM performance insights" />
        <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: `3px solid ${COLORS.border}`,
              borderTopColor: COLORS.viridian500,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Reports & Analytics"
        description="CRM performance insights"
        actions={
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className="px-3 py-1.5 rounded-md transition-colors"
                style={{
                  fontSize: 12,
                  fontWeight: period === opt.value ? 600 : 400,
                  background: period === opt.value ? "var(--color-surface)" : "transparent",
                  color: period === opt.value ? "var(--color-ink)" : "var(--color-ink-secondary)",
                  boxShadow: period === opt.value ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} subtitle={`From ${filteredInvoices.filter((i: any) => i.status === "paid").length} paid invoices`} />
        <StatCard label="Open Deals" value={String(openDeals.length)} subtitle={formatCurrency(openDealsValue) + " total value"} />
        <StatCard label="Won Deals" value={String(wonDeals.length)} subtitle={`${winRate}% win rate`} />
        <StatCard label="New Leads" value={String(filteredLeads.length)} subtitle="In selected period" />
        <StatCard label="New Contacts" value={String(filteredContacts.length)} subtitle="In selected period" />
        <StatCard label="Overdue Invoices" value={String(overdueInvoices.length)} subtitle={overdueInvoices.length > 0 ? "Requires attention" : "All clear"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Revenue Over Time" subtitle="Paid invoice revenue by month">
          {revenueOverTime.some((d) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueOverTime}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.viridian500} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.viridian500} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke={COLORS.viridian500} strokeWidth={2} fill="url(#revenueGradient)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Lead Funnel" subtitle="Conversion through stages" height={400}>
          {filteredLeads.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", justifyContent: "center", padding: "0 8px" }}>
              {leadFunnel.map((stage, i) => {
                const maxCount = leadFunnel[0]?.cumulative || 1;
                const widthPct = Math.max(20, (stage.cumulative / maxCount) * 100);
                const opacity = 1 - i * 0.12;
                return (
                  <div key={stage.stage} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 90, flexShrink: 0, fontSize: 12, fontWeight: 500, color: "var(--color-ink-secondary)", textAlign: "right" }}>
                      {stage.label}
                    </div>
                    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                      <div
                        style={{
                          width: `${widthPct}%`,
                          background: COLORS.viridian500,
                          opacity,
                          borderRadius: 6,
                          padding: "10px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          minHeight: 40,
                          transition: "width 0.3s ease",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{stage.cumulative}</span>
                        {i > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{stage.rate}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Pipeline Stage Breakdown" subtitle="Total deal value by stage">
          {pipelineStageData.length > 0 && pipelineStageData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineStageData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Deal Value" radius={[4, 4, 0, 0]}>
                  {pipelineStageData.map((_, i) => (
                    <Cell key={i} fill={COLORS.viridian500} fillOpacity={1 - i * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Lead Sources" subtitle="Distribution by source">
          {leadSourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2} strokeWidth={0}>
                  {leadSourceData.map((_, i) => (
                    <Cell key={i} fill={PIE_SOURCE_COLORS[i % PIE_SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Deal Status Breakdown" subtitle="Open, won, and lost deals">
          {dealStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dealStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2} strokeWidth={0}>
                  {dealStatusData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Monthly Wins vs Losses" subtitle="Deal outcomes by month">
          {dealWinLossMonthly.some((d) => d.won > 0 || d.lost > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dealWinLossMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="won" name="Won" fill={COLORS.viridian500} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill={COLORS.inkTertiary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Invoice Status" subtitle="Distribution across statuses">
          {invoiceStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={invoiceStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2} strokeWidth={0}>
                  {invoiceStatusData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: COLORS.ink }}>
                  {invoiceTotal}
                </text>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Top Sales Performers" subtitle="By total won deal value (top 10)">
          {topPerformers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformers} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSecondary }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Won Value" fill={COLORS.viridian500} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Quotation Conversion Rate" subtitle="Accepted / total quotations per month">
          {quotationConversion.some((d) => d.rate > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={quotationConversion}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="rate" stroke={COLORS.viridian500} strokeWidth={2} dot={{ fill: COLORS.viridian500, r: 3 }} name="Conversion %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Task Completion" subtitle="Tasks by status per month">
          {taskCompletion.some((d) => d.done > 0 || d.in_progress > 0 || d.open > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={taskCompletion}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="done" name="Done" fill={COLORS.viridian500} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="in_progress" name="In Progress" fill={COLORS.viridian200} stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="open" name="Open" fill={COLORS.inkTertiary} stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>

        <ChartCard title="Contacts & Companies Growth" subtitle="Cumulative growth over time">
          {contactsCompaniesGrowth.some((d) => d.contacts > 0 || d.companies > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={contactsCompaniesGrowth}>
                <defs>
                  <linearGradient id="contactsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.viridian500} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.viridian500} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="companiesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.viridian200} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.viridian200} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkTertiary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  formatter={(value: string) => <span style={{ fontSize: 11, color: COLORS.inkSecondary }}>{value}</span>}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Area type="monotone" dataKey="contacts" stroke={COLORS.viridian500} strokeWidth={2} fill="url(#contactsGrad)" name="Contacts" />
                <Area type="monotone" dataKey="companies" stroke={COLORS.viridian200} strokeWidth={2} fill="url(#companiesGrad)" name="Companies" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <NoData />
          )}
        </ChartCard>
      </div>
    </PageContainer>
  );
}
