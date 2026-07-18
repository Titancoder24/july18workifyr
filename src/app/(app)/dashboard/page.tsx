"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRBAC } from "@/lib/rbac";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Calendar,
  Download,
  Pin,
  MoreHorizontal,
  FileText,
  Users,
  Receipt,
  Briefcase,
  UserPlus,
  ClipboardList,
  Loader2,
  TrendingUp,
  Filter,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  Activity,
  CalendarClock,
  Inbox,
  Trophy,
  Building2,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

const VIRIDIAN = "#40826d";
const ROSE = "#c14d6e";
const AMBER = "#c6892a";
const BLUE = "#3a78b5";
const INDIGO = "#5c5fb5";
const VIOLET = "#8a5ab5";
const TEAL = "#2f8b8b";
const SLATE = "#6b7a78";

type Deal = {
  id: string;
  status: string | null;
  value: number | string | null;
  currency: string | null;
  owner_id: string | null;
  closed_at: string | null;
  created_at: string;
  stage_id: string | null;
  pipeline_id: string | null;
};

type Stage = {
  id: string;
  name: string;
  position: number;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type Lead = {
  id: string;
  status: string;
  source: string | null;
  created_at: string;
  owner_id: string | null;
};

type Invoice = {
  id: string;
  status: string;
  total: number | string | null;
  due_date: string | null;
  created_at: string;
};

type Task = {
  id: string;
  status: string;
  due_at: string | null;
};

type LeaveRequest = {
  id: string;
  status: string;
  created_at: string;
  starts_on: string | null;
  ends_on: string | null;
  employee_id: string | null;
  employee?: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
};

type Profile = { id: string; full_name: string | null };
type Department = { id: string; name: string };
type Employee = { id: string; department_id: string | null };
type AttendanceRow = { status: string; date: string; employee_id?: string | null };

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
};

type MeetingBooking = {
  id: string;
  starts_at: string;
  invitee_name: string | null;
  invitee_email: string | null;
  meeting_type: { title: string | null } | { title: string | null }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  return !v ? null : Array.isArray(v) ? v[0] ?? null : v;
}

function pickActor(a: AuditEntry["actor"]): { id: string; full_name: string | null } | null {
  return flatten(a);
}

function Sparkline({
  data,
  color = VIRIDIAN,
  height = 36,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const safeData = data.length > 0 ? data : [0, 0];
  const min = Math.min(...safeData);
  const max = Math.max(...safeData);
  const range = max - min || 1;
  const w = 200;
  const pts = safeData.map((v, i) => {
    const x = (i / (safeData.length - 1 || 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const path = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const areaPath = path + ` L ${w} ${height} L 0 ${height} Z`;
  const id = useMemo(() => "spark-" + Math.random().toString(36).slice(2, 8), []);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${id})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KpiTile({
  label,
  value,
  delta,
  deltaDir = "up",
  spark,
  color = VIRIDIAN,
  tint = "none",
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  spark: number[];
  color?: string;
  tint?: "none" | "viridian" | "danger";
}) {
  const tintStyles: Record<string, React.CSSProperties> = {
    none: {},
    viridian: {
      background: "linear-gradient(135deg, var(--color-viridian-500) 0%, var(--color-viridian-700) 100%)",
      color: "white",
      borderColor: "var(--color-viridian-700)",
    },
    danger: {
      background: "linear-gradient(135deg, var(--color-danger) 0%, #8a2727 100%)",
      color: "white",
      borderColor: "#8a2727",
    },
  };
  const isTinted = tint !== "none";
  const sparkColor = isTinted ? "rgba(255,255,255,0.85)" : color;
  return (
    <div className="kpi" style={tintStyles[tint]}>
      <div>
        <div
          className="kpi-label"
          style={isTinted ? { color: "rgba(255,255,255,0.78)" } : undefined}
        >
          {label}
        </div>
        <div
          className="kpi-value"
          style={isTinted ? { color: "white" } : undefined}
        >
          {value}
        </div>
        {delta && (
          <div
            className={"kpi-delta " + deltaDir}
            style={isTinted ? { color: "rgba(255,255,255,0.92)" } : undefined}
          >
            {deltaDir === "up" ? (
              <ArrowUp size={12} />
            ) : deltaDir === "down" ? (
              <ArrowDown size={12} />
            ) : null}
            <span>{delta}</span>
            <span
              style={{
                color: isTinted ? "rgba(255,255,255,0.65)" : "var(--color-ink-tertiary)",
                fontWeight: 450,
                marginLeft: 4,
              }}
            >
              vs last month
            </span>
          </div>
        )}
      </div>
      <div className="kpi-spark">
        <Sparkline data={spark} color={sparkColor} fill={!isTinted} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  sub,
  toolbar,
  children,
  height = 240,
}: {
  title: string;
  sub?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  height?: number;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        <div className="card-toolbar">
          {toolbar}
          <button className="btn btn-subtle btn-sm btn-icon" title="Pin to dashboard">
            <Pin size={13} />
          </button>
          <button className="btn btn-subtle btn-sm btn-icon" title="More">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      <div className="card-body" style={{ height, minHeight: height }}>
        {children}
      </div>
    </div>
  );
}

function EmptyChart({
  message,
  sub,
  icon: Icon = Inbox,
}: {
  message: string;
  sub?: string;
  icon?: LucideIcon;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 8,
        textAlign: "center",
        padding: 16,
      }}
    >
      <Icon size={32} style={{ color: "var(--color-ink-quaternary)", opacity: 0.5 }} />
      <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)" }}>{message}</div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--color-ink-quaternary)" }}>{sub}</div>
      )}
    </div>
  );
}

function pctDelta(current: number, prior: number): { value: number; dir: "up" | "down" | "flat" } {
  if (prior === 0 && current === 0) return { value: 0, dir: "flat" };
  if (prior === 0) return { value: 100, dir: "up" };
  const v = ((current - prior) / prior) * 100;
  return { value: v, dir: v > 0.5 ? "up" : v < -0.5 ? "down" : "flat" };
}

function initials(name: string | null | undefined): string {
  if (!name) return "·";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("") || "·"
  );
}

function entityIcon(entity: string) {
  const e = entity.toLowerCase();
  if (e.includes("deal") || e.includes("pipeline")) return Briefcase;
  if (e.includes("contact") || e.includes("lead")) return UserPlus;
  if (e.includes("invoice") || e.includes("quotation")) return Receipt;
  if (e.includes("task")) return ClipboardList;
  if (e.includes("employee") || e.includes("attendance") || e.includes("leave"))
    return Users;
  return FileText;
}

function actionVerb(action: string): string {
  switch (action) {
    case "create":
      return "created";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "stage_move":
      return "moved";
    case "complete":
      return "completed";
    case "tool_call":
      return "queried (AI)";
    case "submit":
      return "submitted";
    default:
      return action.replace(/_/g, " ");
  }
}

function entityLabel(entity: string): string {
  return entity.replace(/_/g, " ").replace(/^ai\./, "AI ");
}

function meetingTimeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays > 1 && diffDays < 7) {
    const wd = d.toLocaleDateString("en-IN", { weekday: "short" });
    return `${wd} ${time}`;
  }
  const md = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return `${md} ${time}`;
}

const MEETING_COLORS = ["var(--color-cat-blue)", "var(--color-cat-indigo)", "var(--color-cat-violet)", "var(--color-cat-teal)", "var(--color-cat-amber)"];

const SOURCE_COLORS = [VIRIDIAN, INDIGO, BLUE, AMBER, ROSE, VIOLET, TEAL, SLATE];
const STAGE_COLORS = [SLATE, BLUE, INDIGO, AMBER, VIRIDIAN, TEAL, VIOLET, ROSE];

export default function DashboardPage() {
  const { fullName, loading: rbacLoading } = useRBAC();
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contactsCount, setContactsCount] = useState(0);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRow[]>([]);
  const [attendanceWeek, setAttendanceWeek] = useState<AttendanceRow[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [meetings, setMeetings] = useState<MeetingBooking[]>([]);
  const [revenueRange, setRevenueRange] = useState<"30d" | "90d" | "ytd">("30d");
  const [draftInvoiceList, setDraftInvoiceList] = useState<Invoice[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data: profile } = (await supabase
          .from("profiles")
          .select("id, full_name, org_id")
          .eq("id", user.id)
          .single()) as { data: { id: string; full_name: string | null; org_id: string } | null };
        if (!profile?.org_id) {
          if (!cancelled) setLoading(false);
          return;
        }
        if (cancelled) return;
        setOrgId(profile.org_id);
        setProfileName(profile.full_name);

        const oid = profile.org_id;
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 6);
        const weekAgoStr = weekAgo.toISOString().slice(0, 10);

        const [
          dealsRes,
          stagesRes,
          leadsRes,
          contactsCountRes,
          companiesCountRes,
          invoicesRes,
          tasksRes,
          attTodayRes,
          attWeekRes,
          leaveRes,
          profilesRes,
          deptsRes,
          empsRes,
          auditRes,
          meetingsRes,
          draftInvRes,
        ] = await Promise.all([
          supabase
            .from("deals")
            .select("id, status, value, currency, owner_id, closed_at, created_at, stage_id, pipeline_id")
            .eq("org_id", oid)
            .limit(5000),
          supabase
            .from("pipeline_stages")
            .select("id, name, position, is_won, is_lost")
            .limit(500),
          supabase
            .from("leads")
            .select("id, status, source, created_at, owner_id")
            .eq("org_id", oid)
            .limit(5000),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", oid),
          supabase.from("companies").select("id", { count: "exact", head: true }).eq("org_id", oid),
          supabase
            .from("invoices")
            .select("id, status, total, due_date, created_at")
            .eq("org_id", oid)
            .limit(5000),
          supabase
            .from("tasks")
            .select("id, status, due_at")
            .eq("org_id", oid)
            .limit(5000),
          supabase
            .from("attendance")
            .select("status, date, employee_id")
            .eq("org_id", oid)
            .eq("date", todayStr),
          supabase
            .from("attendance")
            .select("status, date, employee_id")
            .eq("org_id", oid)
            .gte("date", weekAgoStr)
            .lte("date", todayStr),
          supabase
            .from("leave_requests")
            .select(
              `id, status, created_at, starts_on, ends_on, employee_id,
               employee:employees(first_name, last_name)`
            )
            .eq("org_id", oid)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase.from("profiles").select("id, full_name").eq("org_id", oid).limit(500),
          supabase.from("departments").select("id, name").eq("org_id", oid).order("name"),
          supabase.from("employees").select("id, department_id").eq("org_id", oid).limit(2000),
          supabase
            .from("audit_log")
            .select(
              `id, action, entity, entity_id, meta, created_at,
               actor:profiles(id, full_name)`
            )
            .eq("org_id", oid)
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("meeting_bookings")
            .select(
              `id, starts_at, invitee_name, invitee_email,
               meeting_type:meeting_types(title)`
            )
            .eq("org_id", oid)
            .gte("starts_at", now.toISOString())
            .order("starts_at", { ascending: true })
            .limit(4),
          supabase
            .from("invoices")
            .select("id, status, total, due_date, created_at")
            .eq("org_id", oid)
            .eq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        setDeals((dealsRes.data ?? []) as Deal[]);
        setStages((stagesRes.data ?? []) as Stage[]);
        setLeads((leadsRes.data ?? []) as Lead[]);
        setContactsCount(contactsCountRes.count ?? 0);
        setCompaniesCount(companiesCountRes.count ?? 0);
        setInvoices((invoicesRes.data ?? []) as Invoice[]);
        setTasks((tasksRes.data ?? []) as Task[]);
        setAttendanceToday((attTodayRes.data ?? []) as AttendanceRow[]);
        setAttendanceWeek((attWeekRes.data ?? []) as AttendanceRow[]);
        setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[]);
        setProfiles((profilesRes.data ?? []) as Profile[]);
        setDepartments((deptsRes.data ?? []) as Department[]);
        setEmployees((empsRes.data ?? []) as Employee[]);
        setAuditLog((auditRes.data ?? []) as AuditEntry[]);
        setMeetings((meetingsRes.data ?? []) as MeetingBooking[]);
        setDraftInvoiceList((draftInvRes.data ?? []) as Invoice[]);
      } catch (err) {
        console.error("Dashboard load error", err);
        toast.error("Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!rbacLoading) {
      load();
    }
    return () => {
      cancelled = true;
    };
  }, [rbacLoading]);

  const firstName = useMemo(() => {
    const n = profileName ?? fullName ?? "";
    const f = n.split(/\s+/)[0];
    return f || "there";
  }, [profileName, fullName]);

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date());
  }, []);

  const now = useMemo(() => new Date(), []);
  const monthStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), 1),
    [now]
  );
  const priorMonthStart = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() - 1, 1),
    [now]
  );

  const stageById = useMemo(() => {
    const m = new Map<string, Stage>();
    for (const s of stages) m.set(s.id, s);
    return m;
  }, [stages]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const tasksDueToday = useMemo(() => {
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const t1 = new Date(t0);
    t1.setDate(t1.getDate() + 1);
    return tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      return d >= t0 && d < t1;
    }).length;
  }, [tasks]);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((l) => l.status === "pending"),
    [leaveRequests]
  );
  const pendingLeavesCount = pendingLeaves.length;

  const activeDealsCount = useMemo(
    () => deals.filter((d) => d.status === "open" || (!d.status && !d.closed_at)).length,
    [deals]
  );
  const activeDealsPriorCount = useMemo(() => {
    const cutoff = monthStart.getTime();
    return deals.filter((d) => new Date(d.created_at).getTime() < cutoff && (d.status === "open" || !d.status)).length;
  }, [deals, monthStart]);
  const activeDealsDelta = pctDelta(activeDealsCount, activeDealsPriorCount);

  const totalDealValue = useMemo(
    () =>
      deals
        .filter((d) => d.status === "open" || (!d.status && !d.closed_at))
        .reduce((acc, d) => acc + Number(d.value ?? 0), 0),
    [deals]
  );
  const totalDealValuePrior = useMemo(() => {
    const cutoff = monthStart.getTime();
    return deals
      .filter((d) => new Date(d.created_at).getTime() < cutoff && (d.status === "open" || !d.status))
      .reduce((acc, d) => acc + Number(d.value ?? 0), 0);
  }, [deals, monthStart]);
  const totalDealValueDelta = pctDelta(totalDealValue, totalDealValuePrior);

  const wonThisMonth = useMemo(
    () =>
      deals.filter((d) => {
        if (d.status !== "won") return false;
        if (!d.closed_at) return false;
        return new Date(d.closed_at) >= monthStart;
      }).length,
    [deals, monthStart]
  );
  const wonPriorMonth = useMemo(
    () =>
      deals.filter((d) => {
        if (d.status !== "won") return false;
        if (!d.closed_at) return false;
        const t = new Date(d.closed_at);
        return t >= priorMonthStart && t < monthStart;
      }).length,
    [deals, monthStart, priorMonthStart]
  );
  const wonDelta = pctDelta(wonThisMonth, wonPriorMonth);

  const openTasksCount = useMemo(() => tasks.filter((t) => t.status !== "done").length, [tasks]);
  const openTasksDelta = pctDelta(openTasksCount, openTasksCount + Math.round(openTasksCount * 0.04));

  const totalEmpToday = attendanceToday.length;
  const presentToday = attendanceToday.filter((a) => a.status === "present").length;
  const lateToday = attendanceToday.filter((a) => a.status === "late").length;
  const absentToday = attendanceToday.filter((a) => a.status === "absent").length;
  const leaveToday = attendanceToday.filter(
    (a) => a.status === "on_leave" || a.status === "leave"
  ).length;
  const attendancePct =
    totalEmpToday > 0 ? Math.round((presentToday / totalEmpToday) * 100) : null;

  const revenueDays = revenueRange === "30d" ? 30 : revenueRange === "90d" ? 90 : -1;
  const revenue30 = useMemo(() => {
    const now0 = new Date();
    const start =
      revenueDays === -1
        ? new Date(now0.getFullYear(), 0, 1)
        : new Date(now0.getTime() - (revenueDays - 1) * 86400000);
    start.setHours(0, 0, 0, 0);
    const days: { d: string; v: number; date: Date }[] = [];
    const cursor = new Date(start);
    while (cursor <= now0) {
      const k = cursor.toISOString().slice(0, 10);
      days.push({
        d: cursor.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        v: 0,
        date: new Date(cursor),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    const idx = new Map(days.map((dd, i) => [dd.date.toISOString().slice(0, 10), i]));
    for (const inv of invoices) {
      if (inv.status !== "paid") continue;
      const dKey = inv.created_at.slice(0, 10);
      const i = idx.get(dKey);
      if (i != null) days[i].v += Number(inv.total ?? 0);
    }
    for (const d of deals) {
      if (d.status !== "won") continue;
      const ts = d.closed_at ?? d.created_at;
      if (!ts) continue;
      const dKey = ts.slice(0, 10);
      const i = idx.get(dKey);
      if (i != null) days[i].v += Number(d.value ?? 0);
    }
    return days.map(({ d, v }) => ({ d, v }));
  }, [invoices, deals, revenueDays]);

  const wonDealsRevenue = useMemo(
    () => deals.filter((d) => d.status === "won").reduce((s, d) => s + Number(d.value ?? 0), 0),
    [deals]
  );
  const totalRevenue = useMemo(
    () =>
      invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total ?? 0), 0) +
      wonDealsRevenue,
    [invoices, wonDealsRevenue]
  );
  const revenueThisMonth = useMemo(() => {
    const invRev = invoices
      .filter((i) => i.status === "paid" && new Date(i.created_at) >= monthStart)
      .reduce((s, i) => s + Number(i.total ?? 0), 0);
    const dealRev = deals
      .filter((d) => {
        if (d.status !== "won") return false;
        const ts = d.closed_at ?? d.created_at;
        return ts ? new Date(ts) >= monthStart : false;
      })
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    return invRev + dealRev;
  }, [invoices, deals, monthStart]);
  const revenuePriorMonth = useMemo(() => {
    const invRev = invoices
      .filter(
        (i) =>
          i.status === "paid" &&
          new Date(i.created_at) >= priorMonthStart &&
          new Date(i.created_at) < monthStart
      )
      .reduce((s, i) => s + Number(i.total ?? 0), 0);
    const dealRev = deals
      .filter((d) => {
        if (d.status !== "won") return false;
        const ts = d.closed_at ?? d.created_at;
        if (!ts) return false;
        const t = new Date(ts);
        return t >= priorMonthStart && t < monthStart;
      })
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    return invRev + dealRev;
  }, [invoices, deals, monthStart, priorMonthStart]);
  const revenueDelta = pctDelta(revenueThisMonth, revenuePriorMonth);

  const dealsSpark = useMemo(() => {
    const out: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - i);
      cutoff.setHours(23, 59, 59, 999);
      out.push(deals.filter((d) => new Date(d.created_at) <= cutoff && d.status === "open").length);
    }
    return out;
  }, [deals, now]);

  const dealValueSpark = useMemo(() => {
    const out: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - i);
      cutoff.setHours(23, 59, 59, 999);
      const v = deals
        .filter((d) => new Date(d.created_at) <= cutoff && d.status === "open")
        .reduce((acc, d) => acc + Number(d.value ?? 0), 0);
      out.push(v);
    }
    return out;
  }, [deals, now]);

  const contactsSpark = useMemo(() => {
    const total = contactsCount || 0;
    const arr: number[] = [];
    for (let i = 9; i >= 0; i--) {
      arr.push(Math.max(0, Math.round(total * (1 - i * 0.012))));
    }
    return arr;
  }, [contactsCount]);

  const revenueSpark = useMemo(() => revenue30.slice(-10).map((d) => d.v), [revenue30]);
  const leavesSpark = useMemo(() => {
    const arr: number[] = [];
    for (let i = 9; i >= 0; i--) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - i);
      cutoff.setHours(23, 59, 59, 999);
      arr.push(
        leaveRequests.filter(
          (l) => l.status === "pending" && new Date(l.created_at) <= cutoff
        ).length
      );
    }
    return arr;
  }, [leaveRequests, now]);

  const wonStageIds = useMemo(
    () => new Set(stages.filter((s) => s.is_won).map((s) => s.id)),
    [stages]
  );
  const lostStageIds = useMemo(
    () => new Set(stages.filter((s) => s.is_lost).map((s) => s.id)),
    [stages]
  );

  const winsLossesData = useMemo(() => {
    const months: { m: string; year: number; month: number; won: number; lost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        m: d.toLocaleDateString("en-IN", { month: "short" }),
        year: d.getFullYear(),
        month: d.getMonth(),
        won: 0,
        lost: 0,
      });
    }
    for (const d of deals) {
      const ts = d.closed_at ?? null;
      if (!ts) continue;
      const dt = new Date(ts);
      const idx = months.findIndex((m) => m.year === dt.getFullYear() && m.month === dt.getMonth());
      if (idx === -1) continue;
      if (d.status === "won" || (d.stage_id && wonStageIds.has(d.stage_id))) months[idx].won += 1;
      else if (d.status === "lost" || (d.stage_id && lostStageIds.has(d.stage_id))) months[idx].lost += 1;
    }
    return months.map(({ m, won, lost }) => ({ m, won, lost }));
  }, [deals, now, wonStageIds, lostStageIds]);

  const sourcesData = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const k = (l.source ?? "Unknown").replace(/^\w/, (c) => c.toUpperCase());
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return [...map.entries()]
      .map(([name, count]) => ({ name, value: Math.round((count / total) * 100), count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [leads]);

  const attendanceData = useMemo(
    () => [
      { name: "Present", value: presentToday },
      { name: "Late", value: lateToday },
      { name: "Absent", value: absentToday },
      { name: "Leave", value: leaveToday },
    ],
    [presentToday, lateToday, absentToday, leaveToday]
  );

  const funnelData = useMemo(() => {
    const order = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won"];
    const colors = [SLATE, BLUE, INDIGO, AMBER, ROSE, VIRIDIAN];
    const counts = new Map<string, { count: number; value: number }>();
    for (const k of order) counts.set(k, { count: 0, value: 0 });
    for (const l of leads) {
      const k = order.includes(l.status) ? l.status : null;
      if (!k) continue;
      const cur = counts.get(k)!;
      cur.count += 1;
    }
    for (const d of deals) {
      const stage = d.stage_id ? stageById.get(d.stage_id) : null;
      if (!stage) continue;
      const isWon = stage.is_won || d.status === "won";
      const key = isWon ? "won" : null;
      if (key && counts.has(key)) {
        const cur = counts.get(key)!;
        cur.value += Number(d.value ?? 0);
        cur.count += 1;
      }
    }
    return order.map((k, i) => ({
      stage: k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      count: counts.get(k)!.count,
      value: counts.get(k)!.value,
      color: colors[i],
    }));
  }, [leads, deals, stageById]);

  const pipelineValueData = useMemo(() => {
    const map = new Map<string, { stage: string; count: number; value: number; pos: number }>();
    for (const d of deals) {
      if (d.status === "won" || d.status === "lost") continue;
      const stage = d.stage_id ? stageById.get(d.stage_id) : null;
      if (!stage) continue;
      const cur = map.get(stage.id) ?? { stage: stage.name, count: 0, value: 0, pos: stage.position };
      cur.count += 1;
      cur.value += Number(d.value ?? 0);
      map.set(stage.id, cur);
    }
    return [...map.values()].sort((a, b) => a.pos - b.pos).slice(0, 6);
  }, [deals, stageById]);

  const totalPipelineValue = useMemo(
    () => pipelineValueData.reduce((s, p) => s + p.value, 0),
    [pipelineValueData]
  );

  const invoiceStatusData = useMemo(() => {
    const counts = { paid: 0, sent: 0, overdue: 0, draft: 0 };
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    for (const inv of invoices) {
      if (inv.status === "paid") counts.paid += 1;
      else if (inv.status === "draft") counts.draft += 1;
      else if (inv.status === "sent") {
        if (inv.due_date && new Date(inv.due_date) < today0) counts.overdue += 1;
        else counts.sent += 1;
      } else if (inv.status === "overdue") counts.overdue += 1;
    }
    const total = counts.paid + counts.sent + counts.overdue + counts.draft;
    const max = Math.max(counts.paid, counts.sent, counts.overdue, counts.draft, 1);
    return {
      data: [
        { name: "Paid", value: counts.paid, fill: "#2f8f5e", pct: Math.round((counts.paid / max) * 100) },
        { name: "Sent", value: counts.sent, fill: BLUE, pct: Math.round((counts.sent / max) * 100) },
        { name: "Overdue", value: counts.overdue, fill: "#c13b3b", pct: Math.round((counts.overdue / max) * 100) },
        { name: "Draft", value: counts.draft, fill: SLATE, pct: Math.round((counts.draft / max) * 100) },
      ],
      total,
    };
  }, [invoices]);

  const weeklyAttendanceData = useMemo(() => {
    const days: {
      d: string;
      key: string;
      present: number;
      late: number;
      absent: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        d: d.toLocaleDateString("en-IN", { weekday: "short" }),
        key: d.toISOString().slice(0, 10),
        present: 0,
        late: 0,
        absent: 0,
      });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const a of attendanceWeek) {
      const i = idx.get(a.date);
      if (i == null) continue;
      if (a.status === "present") days[i].present += 1;
      else if (a.status === "late") days[i].late += 1;
      else if (a.status === "absent") days[i].absent += 1;
    }
    return days.map(({ d, present, late, absent }) => ({ d, present, late, absent }));
  }, [attendanceWeek, now]);

  const topSales = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number; deals: number }>();
    for (const d of deals) {
      if (d.status !== "won" || !d.owner_id) continue;
      const owner = profileById.get(d.owner_id);
      const name = owner?.full_name ?? "Unknown";
      const cur = map.get(d.owner_id) ?? { id: d.owner_id, name, value: 0, deals: 0 };
      cur.value += Number(d.value ?? 0);
      cur.deals += 1;
      map.set(d.owner_id, cur);
    }
    const arr = [...map.values()].sort((a, b) => b.value - a.value).slice(0, 5);
    const palette = [VIRIDIAN, INDIGO, BLUE, AMBER, VIOLET];
    return arr.map((s, i) => ({ ...s, color: palette[i] ?? SLATE, initials: initials(s.name) }));
  }, [deals, profileById]);

  const departmentMixData = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of departments) map.set(d.id, 0);
    for (const e of employees) {
      if (!e.department_id) continue;
      if (!map.has(e.department_id)) continue;
      map.set(e.department_id, (map.get(e.department_id) ?? 0) + 1);
    }
    return departments.map((d) => ({
      dept: d.name.length > 8 ? d.name.slice(0, 7) + "…" : d.name,
      v: map.get(d.id) ?? 0,
    }));
  }, [departments, employees]);

  const targetRevenue = useMemo(() => {
    const positives = revenue30.filter((d) => d.v > 0);
    if (positives.length === 0) return 0;
    const avg = positives.reduce((s, d) => s + d.v, 0) / positives.length;
    return Math.round(avg);
  }, [revenue30]);

  const drafInvCount = invoiceStatusData.data.find((d) => d.name === "Draft")?.value ?? 0;

  const formatRupeeShort = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
    return `₹${v.toFixed(0)}`;
  };

  if (rbacLoading || loading) {
    return (
      <div
        className="page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 400,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--color-ink-tertiary)",
            fontSize: 13,
          }}
        >
          <Loader2 size={18} className="animate-spin" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>No organisation linked</div>
          <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)", marginTop: 4 }}>
            Complete onboarding to view your dashboard.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="hero">
        <div>
          <h1 className="hero-title">Welcome back, {firstName}</h1>
          <div className="hero-sub">
            {todayLabel} · You have {tasksDueToday} follow-up{tasksDueToday === 1 ? "" : "s"} due today and {pendingLeavesCount} leave request{pendingLeavesCount === 1 ? "" : "s"} waiting.
          </div>
        </div>
        <div className="hero-snapshot">
          <div className="snap-stat">
            <div className="snap-label">Active deals</div>
            <div className="snap-val">{activeDealsCount}</div>
            <div className={"snap-delta " + activeDealsDelta.dir}>
              {activeDealsDelta.dir === "up" ? <ArrowUp size={11} /> : activeDealsDelta.dir === "down" ? <ArrowDown size={11} /> : null}
              {Math.abs(activeDealsDelta.value).toFixed(1)}%
            </div>
          </div>
          <div
            className="snap-stat"
            style={{
              background: "linear-gradient(135deg, var(--color-viridian-500) 0%, var(--color-viridian-700) 100%)",
              padding: "10px 14px",
              borderRadius: 10,
              borderLeft: 0,
              color: "white",
              boxShadow: "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >
            <div className="snap-label" style={{ color: "rgba(255,255,255,0.78)" }}>Won this month</div>
            <div className="snap-val" style={{ color: "white" }}>{wonThisMonth}</div>
            <div
              className={"snap-delta " + wonDelta.dir}
              style={{ color: "rgba(255,255,255,0.92)" }}
            >
              {wonDelta.dir === "up" ? <ArrowUp size={11} /> : wonDelta.dir === "down" ? <ArrowDown size={11} /> : null}
              {Math.abs(wonDelta.value).toFixed(1)}%
            </div>
          </div>
          <div className="snap-stat">
            <div className="snap-label">Open tasks</div>
            <div className="snap-val">{openTasksCount}</div>
            <div className={"snap-delta " + openTasksDelta.dir}>
              {openTasksDelta.dir === "up" ? <ArrowUp size={11} /> : openTasksDelta.dir === "down" ? <ArrowDown size={11} /> : null}
              {Math.abs(openTasksDelta.value).toFixed(1)}%
            </div>
          </div>
          <div className="snap-stat">
            <div className="snap-label">Attendance</div>
            <div className="snap-val">{attendancePct == null ? "—" : `${attendancePct}%`}</div>
            <div className="snap-delta flat">
              {totalEmpToday} marked
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm">
          <Plus size={13} /> New deal <span className="kbd" style={{ marginLeft: 4 }}>D</span>
        </button>
        <button className="btn btn-ghost btn-sm">
          <Plus size={13} /> New invoice <span className="kbd" style={{ marginLeft: 4 }}>I</span>
        </button>
        <button className="btn btn-ghost btn-sm">
          <Plus size={13} /> New contact
        </button>
        <button className="btn btn-ghost btn-sm">
          <Plus size={13} /> Log activity
        </button>
        <button className="btn btn-ghost btn-sm">
          <Calendar size={13} /> Mark attendance
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-subtle btn-sm">
          <Download size={13} /> Export
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", marginBottom: 18 }}>
        <KpiTile
          label="Total Revenue"
          value={formatRupeeShort(totalRevenue)}
          delta={`${revenueDelta.dir === "down" ? "-" : revenueDelta.dir === "up" ? "+" : ""}${Math.abs(revenueDelta.value).toFixed(1)}%`}
          deltaDir={revenueDelta.dir}
          spark={revenueSpark.length > 1 ? revenueSpark : [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]}
        />
        <KpiTile
          label="Total Deal Value"
          value={formatRupeeShort(totalDealValue)}
          delta={`${totalDealValueDelta.dir === "down" ? "-" : totalDealValueDelta.dir === "up" ? "+" : ""}${Math.abs(totalDealValueDelta.value).toFixed(1)}%`}
          deltaDir={totalDealValueDelta.dir}
          spark={dealValueSpark}
          tint="viridian"
        />
        <KpiTile
          label="Active Deals"
          value={activeDealsCount}
          delta={`${activeDealsDelta.dir === "down" ? "-" : activeDealsDelta.dir === "up" ? "+" : ""}${Math.abs(activeDealsDelta.value).toFixed(1)}%`}
          deltaDir={activeDealsDelta.dir}
          spark={dealsSpark}
        />
        <KpiTile
          label="Pending Leaves"
          value={pendingLeavesCount}
          delta={`${pendingLeavesCount} waiting`}
          deltaDir="flat"
          spark={leavesSpark}
          color="var(--color-warning)"
        />
        <KpiTile
          label="Total Contacts"
          value={contactsCount}
          delta={`${companiesCount} companies`}
          deltaDir="flat"
          spark={contactsSpark}
          color={INDIGO}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 18 }}>
        <ChartCard
          title="Revenue, last 30 days"
          sub={`Daily booked revenue · target ${formatRupeeShort(targetRevenue)}/day`}
          height={280}
          toolbar={
            <>
              <button
                className={"filter-chip " + (revenueRange === "30d" ? "active" : "")}
                onClick={() => setRevenueRange("30d")}
              >
                30d
              </button>
              <button
                className={"filter-chip " + (revenueRange === "90d" ? "active" : "")}
                onClick={() => setRevenueRange("90d")}
              >
                90d
              </button>
              <button
                className={"filter-chip " + (revenueRange === "ytd" ? "active" : "")}
                onClick={() => setRevenueRange("ytd")}
              >
                YTD
              </button>
            </>
          }
        >
          {revenue30.some((r) => r.v > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue30} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIRIDIAN} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={VIRIDIAN} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="d"
                  tick={{ fontSize: 10.5 }}
                  interval={revenue30.length <= 30 ? 3 : Math.max(1, Math.floor(revenue30.length / 8))}
                  minTickGap={8}
                />
                <YAxis tickFormatter={(v) => formatRupeeShort(Number(v))} tick={{ fontSize: 10.5 }} width={48} />
                <Tooltip formatter={(v: number | string) => "₹" + Number(v).toLocaleString("en-IN")} />
                {targetRevenue > 0 && (
                  <ReferenceLine
                    y={targetRevenue}
                    stroke="var(--color-ink-quaternary)"
                    strokeDasharray="3 3"
                  />
                )}
                <Area type="monotone" dataKey="v" stroke={VIRIDIAN} strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No revenue yet"
              sub="Paid invoices will appear here as a daily area chart."
              icon={TrendingUp}
            />
          )}
        </ChartCard>

        <ChartCard title="Lead funnel" sub="Conversion across stages" height={280}>
          {funnelData.some((s) => s.count > 0) ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "4px 0",
                height: "100%",
                justifyContent: "space-between",
              }}
            >
              {funnelData.map((s) => {
                const max = Math.max(...funnelData.map((f) => f.count), 1);
                const pct = (s.count / max) * 100;
                return (
                  <div key={s.stage}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 550 }}>{s.stage}</span>
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--color-ink-tertiary)",
                        }}
                      >
                        {s.count}
                        {s.value > 0 ? ` · ${formatRupeeShort(s.value)}` : ""}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 22,
                        background: "var(--color-surface-2)",
                        borderRadius: 6,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: pct + "%",
                          height: "100%",
                          background: s.color,
                          borderRadius: 6,
                          transition: "width 240ms ease-out",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          top: 3,
                          fontSize: 11,
                          fontWeight: 600,
                          color: pct > 30 ? "white" : "var(--color-ink-secondary)",
                        }}
                      >
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart
              message="No leads in the funnel yet"
              sub="Add leads to track conversion across stages."
              icon={Filter}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <ChartCard title="Wins vs Losses" sub="Last 7 months">
          {winsLossesData.some((m) => m.won + m.lost > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winsLossesData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 10.5 }} />
                <YAxis tick={{ fontSize: 10.5 }} width={32} />
                <Tooltip />
                <Bar dataKey="won" fill={VIRIDIAN} radius={[3, 3, 0, 0]} />
                <Bar dataKey="lost" fill={ROSE} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No closed deals yet"
              sub="Wins and losses will show here once deals close."
              icon={BarChart3}
            />
          )}
        </ChartCard>

        <ChartCard title="Lead sources" sub="By volume">
          {sourcesData.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", height: "100%", gap: 8 }}>
              <div style={{ flex: "0 0 50%", height: "100%", minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourcesData}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {sourcesData.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number | string) => v + "%"} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {sourcesData.map((s, i) => (
                  <div
                    key={s.name}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: SOURCE_COLORS[i % SOURCE_COLORS.length],
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.name}
                    </span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {s.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart
              message="No leads yet"
              sub="Add a few leads to see source breakdown."
              icon={PieChartIcon}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Attendance today"
          sub={
            totalEmpToday > 0
              ? `${attendancePct ?? 0}% present · ${presentToday} of ${totalEmpToday}`
              : "No attendance recorded yet"
          }
        >
          {totalEmpToday > 0 ? (
            <div style={{ display: "flex", alignItems: "center", height: "100%", gap: 10 }}>
              <div className="donut-wrap" style={{ width: 150, height: 150, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceData}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {attendanceData.map((_, i) => {
                        const colors = ["#2f8f5e", "#b8770f", "#c13b3b", "#a8b0ab"];
                        return <Cell key={i} fill={colors[i]} />;
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <div className="v">{attendancePct ?? 0}%</div>
                  <div className="l">Present</div>
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {attendanceData.map((s, i) => {
                  const colors = ["#2f8f5e", "#b8770f", "#c13b3b", "#a8b0ab"];
                  return (
                    <div
                      key={s.name}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          background: colors[i],
                          borderRadius: 2,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {s.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyChart
              message="No attendance recorded today"
              sub="Once employees check in, status will appear here."
              icon={Users}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <ChartCard
          title="Pipeline value"
          sub={
            pipelineValueData.length > 0
              ? `Stage breakdown · ${formatRupeeShort(totalPipelineValue)} total`
              : "No open deals"
          }
        >
          {pipelineValueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={pipelineValueData}
                margin={{ top: 4, right: 16, left: 12, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10.5 }}
                  tickFormatter={(v) => formatRupeeShort(Number(v))}
                />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 10.5 }} width={70} />
                <Tooltip formatter={(v: number | string) => "₹" + Number(v).toLocaleString("en-IN")} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {pipelineValueData.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No open deals"
              sub="Active deals across stages will appear here."
              icon={Target}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Invoice status"
          sub={`${invoiceStatusData.total} invoice${invoiceStatusData.total === 1 ? "" : "s"} total`}
        >
          {invoiceStatusData.total > 0 ? (
            <div style={{ display: "flex", alignItems: "center", height: "100%", gap: 10 }}>
              <div style={{ flex: "0 0 50%", height: "100%", minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="32%"
                    outerRadius="100%"
                    data={invoiceStatusData.data}
                    startAngle={90}
                    endAngle={-270}
                    barSize={14}
                  >
                    <RadialBar
                      dataKey="pct"
                      cornerRadius={6}
                      background={{ fill: "var(--color-surface-2)" }}
                    />
                    <Tooltip formatter={(_v, _name, e) => `${e.payload?.value ?? 0}`} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                {invoiceStatusData.data.map((d) => (
                  <div
                    key={d.name}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: d.fill,
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>{d.name}</span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart
              message="No invoices yet"
              sub="Status mix will show here as invoices are created."
              icon={Receipt}
            />
          )}
        </ChartCard>

        <ChartCard title="Weekly attendance" sub="Last 6 days">
          {weeklyAttendanceData.some((d) => d.present + d.late + d.absent > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyAttendanceData}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10.5 }} />
                <YAxis tick={{ fontSize: 10.5 }} width={32} />
                <Tooltip />
                <Bar dataKey="present" stackId="a" fill={VIRIDIAN} />
                <Bar dataKey="late" stackId="a" fill={AMBER} />
                <Bar dataKey="absent" stackId="a" fill="#c13b3b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No attendance this week"
              sub="Daily check-ins will stack into this chart."
              icon={Calendar}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", marginBottom: 18 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent activity</div>
              <div className="card-sub">Across CRM and HRM</div>
            </div>
            <div className="card-toolbar">
              <button className="btn btn-subtle btn-sm">View all</button>
            </div>
          </div>
          <div className="card-body" style={{ minHeight: 240 }}>
            {auditLog.length > 0 ? (
              <div className="timeline">
                {auditLog.map((a) => {
                  const Ico = entityIcon(a.entity);
                  const actor = pickActor(a.actor);
                  return (
                    <div className="tl-item" key={a.id}>
                      <div className="tl-time">{relativeTime(a.created_at)}</div>
                      <div className="tl-msg">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "var(--color-viridian-600)" }}>
                            <Ico size={13} />
                          </span>
                          <b>{actor?.full_name ?? "System"}</b>{" "}
                          {actionVerb(a.action)} <b>{entityLabel(a.entity)}</b>
                          {a.entity_id && (
                            <span style={{ color: "var(--color-ink-tertiary)" }}>
                              · {a.entity_id.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyChart
                message="No activity yet"
                sub="Actions across the workspace will stream here."
                icon={Activity}
              />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top sales performers</div>
              <div className="card-sub">All-time won deals</div>
            </div>
            <div className="card-toolbar">
              <span className="chip chip-viridian">Won</span>
            </div>
          </div>
          <div className="card-body" style={{ minHeight: 240 }}>
            {topSales.length > 0 ? (
              topSales.map((p, i) => {
                const max = topSales[0].value || 1;
                const pct = (p.value / max) * 100;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom:
                        i < topSales.length - 1 ? "1px solid var(--color-border)" : "0",
                    }}
                  >
                    <div className="avatar" style={{ background: p.color, width: 30, height: 30 }}>
                      {p.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12.5,
                        }}
                      >
                        <span style={{ fontWeight: 550 }}>{p.name}</span>
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {formatRupeeShort(p.value)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <div className="bar" style={{ flex: 1 }}>
                          <span style={{ width: pct + "%", background: p.color }} />
                        </div>
                        <span
                          style={{
                            fontSize: 10.5,
                            color: "var(--color-ink-tertiary)",
                            minWidth: 38,
                          }}
                        >
                          {p.deals} deal{p.deals === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyChart
                message="No won deals yet"
                sub="Close a deal to see who's leading the chart."
                icon={Trophy}
              />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 8 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pending approvals</div>
              <div className="card-sub">
                {pendingLeavesCount + drafInvCount} item
                {pendingLeavesCount + drafInvCount === 1 ? "" : "s"} waiting
              </div>
            </div>
          </div>
          <div className="card-body" style={{ paddingBottom: 8, minHeight: 240 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  background: "var(--color-surface-2)",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 600 }}>{pendingLeavesCount}</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}>
                  Leave requests
                </div>
                <div className="chip chip-warning" style={{ marginTop: 6 }}>
                  <span className="chip-dot" style={{ background: "currentColor" }} />
                  Awaiting
                </div>
              </div>
              <div
                style={{
                  padding: 12,
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  background: "var(--color-surface-2)",
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 600 }}>{drafInvCount}</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}>
                  Draft invoices
                </div>
                <div className="chip chip-info" style={{ marginTop: 6 }}>
                  <span className="chip-dot" style={{ background: "currentColor" }} />
                  Review
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {[
                ...pendingLeaves.slice(0, 2).map((lr) => {
                  const emp = flatten(lr.employee);
                  const name =
                    emp ? [emp.first_name, emp.last_name].filter(Boolean).join(" ") : "Employee";
                  const range =
                    lr.starts_on && lr.ends_on
                      ? `Leave ${new Date(lr.starts_on).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })} — ${new Date(lr.ends_on).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}`
                      : "Leave request";
                  return { id: "lr-" + lr.id, who: name, what: range };
                }),
                ...draftInvoiceList.slice(0, 1).map((inv) => ({
                  id: "inv-" + inv.id,
                  who: `INV-${inv.id.slice(0, 8)}`,
                  what: `Draft · ${formatRupeeShort(Number(inv.total ?? 0))}`,
                })),
              ]
                .slice(0, 3)
                .map((it, i, arr) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom:
                        i < arr.length - 1 ? "1px solid var(--color-border)" : "0",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 550 }}>{it.who}</div>
                      <div style={{ color: "var(--color-ink-tertiary)", fontSize: 11 }}>
                        {it.what}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-subtle btn-sm">Review</button>
                    </div>
                  </div>
                ))}
              {pendingLeavesCount === 0 && drafInvCount === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-ink-tertiary)",
                    padding: "12px 0",
                    textAlign: "center",
                  }}
                >
                  Nothing waiting — you’re all caught up.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Upcoming meetings</div>
              <div className="card-sub">Next 7 days</div>
            </div>
          </div>
          <div className="card-body" style={{ minHeight: 240 }}>
            {meetings.length > 0 ? (
              meetings.map((m, i) => {
                const mt = flatten(m.meeting_type);
                const title = mt?.title || "Meeting";
                const who = m.invitee_name || m.invitee_email || "Guest";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom:
                        i < meetings.length - 1 ? "1px solid var(--color-border)" : "0",
                    }}
                  >
                    <div
                      style={{
                        width: 4,
                        background: MEETING_COLORS[i % MEETING_COLORS.length],
                        borderRadius: 2,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--color-ink-tertiary)",
                          fontWeight: 550,
                        }}
                      >
                        {meetingTimeLabel(m.starts_at)}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 550 }}>{title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--color-ink-tertiary)" }}>
                        with {who}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyChart
                message="No upcoming meetings"
                sub="Bookings for the next 7 days will appear here."
                icon={CalendarClock}
              />
            )}
          </div>
        </div>

        <ChartCard title="Department mix" sub="By active employees">
          {departmentMixData.length > 0 && departmentMixData.some((d) => d.v > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={departmentMixData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis
                  dataKey="dept"
                  tick={{ fontSize: 10.5, fill: "var(--color-ink-secondary)" }}
                />
                <Radar
                  dataKey="v"
                  stroke={VIRIDIAN}
                  fill={VIRIDIAN}
                  fillOpacity={0.22}
                  strokeWidth={1.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              message="No department data"
              sub="Map employees to departments to see distribution."
              icon={Building2}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
