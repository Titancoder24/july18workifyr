"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader, PageContainer } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Plus,
  DollarSign,
  Play,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Banknote,
} from "lucide-react";

/* ============================================================================
   Types
   ========================================================================= */

interface PayrollRun {
  id: string;
  org_id: string;
  period_year: number;
  period_month: number;
  status: string;
  total_gross: number | null;
  total_net: number | null;
  total_deductions: number | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

interface SalarySlip {
  id: string;
  org_id: string;
  payroll_run_id: string | null;
  employee_id: string;
  period_year: number;
  period_month: number;
  working_days: number | null;
  paid_days: number | null;
  loss_of_pay_days: number | null;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  gross: number | null;
  total_deductions: number | null;
  net: number | null;
  ytd: Record<string, unknown> | null;
  pdf_path: string | null;
  created_at: string;
}

interface SalaryStructure {
  id: string;
  org_id: string;
  employee_id: string;
  effective_from: string | null;
  effective_to: string | null;
  ctc_annual: number | null;
  components: SalaryComponent[];
  notes: string | null;
  created_at: string;
}

interface SalaryComponent {
  name: string;
  type: "earning" | "deduction";
  amount: number;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  employee_code: string | null;
  status: string;
}

type TabKey = "runs" | "structures" | "slips";
type Supa = ReturnType<typeof createClient>;

// Helper to bypass strict table-name typing for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (sb: Supa, table: string): any => (sb as any).from(table);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/* ============================================================================
   Main Page
   ========================================================================= */

export default function PayrollPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("runs");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Data
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Sheets
  const [newRunOpen, setNewRunOpen] = useState(false);
  const [newStructureOpen, setNewStructureOpen] = useState(false);
  const [viewRunSlips, setViewRunSlips] = useState<PayrollRun | null>(null);
  const [runSlips, setRunSlips] = useState<SalarySlip[]>([]);
  const [viewSlip, setViewSlip] = useState<SalarySlip | null>(null);
  const [editSlip, setEditSlip] = useState<SalarySlip | null>(null);
  const [editStructure, setEditStructure] = useState<SalaryStructure | null>(null);

  // Filters for slips
  const [slipFilterYear, setSlipFilterYear] = useState(new Date().getFullYear());
  const [slipFilterMonth, setSlipFilterMonth] = useState(0); // 0 = all
  const [slipFilterEmployee, setSlipFilterEmployee] = useState("");

  /* ------ Bootstrap ------ */
  const bootstrap = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await from(supabase, "profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (!profile) return;
    setOrgId(profile.org_id);
    setProfileId(profile.id);

    const oid = profile.org_id;
    const [runsRes, structRes, slipsRes, empRes] = await Promise.all([
      from(supabase, "payroll_runs").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
      from(supabase, "salary_structures").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
      from(supabase, "salary_slips").select("*").eq("org_id", oid).order("created_at", { ascending: false }).limit(500),
      from(supabase, "employees").select("id, first_name, last_name, email, employee_code, status").eq("org_id", oid).eq("status", "active").order("first_name"),
    ]);

    setRuns((runsRes.data ?? []) as PayrollRun[]);
    setStructures((structRes.data ?? []) as SalaryStructure[]);
    setSlips((slipsRes.data ?? []) as SalarySlip[]);
    setEmployees((empRes.data ?? []) as Employee[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  /* ------ Helpers ------ */
  const empName = (id: string) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name ?? ""}`.trim() : "Unknown";
  };

  const statusTone = (s: string) => {
    switch (s) {
      case "completed": return "viridian";
      case "draft": return "outline";
      case "processing": return "warning";
      case "cancelled": return "solid";
      default: return "neutral";
    }
  };

  /* ------ Filtered slips ------ */
  const filteredSlips = slips.filter((s) => {
    if (s.period_year !== slipFilterYear) return false;
    if (slipFilterMonth > 0 && s.period_month !== slipFilterMonth) return false;
    if (slipFilterEmployee && s.employee_id !== slipFilterEmployee) return false;
    return true;
  });

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
      <PageHeader
        title="Payroll"
        description="Manage payroll runs, salary structures, and pay slips"
        actions={
          tab === "runs" ? (
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setNewRunOpen(true)}>
              New Run
            </Button>
          ) : tab === "structures" ? (
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => { setEditStructure(null); setNewStructureOpen(true); }}>
              Add Structure
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-muted)" }}>
        {(["runs", "structures", "slips"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize"
            style={{
              background: tab === t ? "var(--color-surface)" : "transparent",
              color: tab === t ? "var(--color-ink)" : "var(--color-ink-tertiary)",
              boxShadow: tab === t ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {t === "runs" ? "Runs" : t === "structures" ? "Salary Structures" : "Slips"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "runs" && (
        <RunsTab
          runs={runs}
          empName={empName}
          statusTone={statusTone}
          onViewSlips={async (run) => {
            setViewRunSlips(run);
            const { data } = await from(supabase, "salary_slips")
              .select("*")
              .eq("org_id", orgId!)
              .eq("payroll_run_id", run.id)
              .order("created_at", { ascending: false });
            setRunSlips((data ?? []) as SalarySlip[]);
          }}
          onProcess={async (run) => {
            const { data: runSlipsData } = await from(supabase, "salary_slips")
              .select("gross, total_deductions, net")
              .eq("org_id", orgId!)
              .eq("payroll_run_id", run.id);

            const items = (runSlipsData ?? []) as { gross: number; total_deductions: number; net: number }[];
            const totalGross = items.reduce((s, r) => s + (Number(r.gross) || 0), 0);
            const totalDed = items.reduce((s, r) => s + (Number(r.total_deductions) || 0), 0);
            const totalNet = items.reduce((s, r) => s + (Number(r.net) || 0), 0);

            const { error } = await from(supabase, "payroll_runs")
              .update({
                status: "completed",
                total_gross: totalGross,
                total_deductions: totalDed,
                total_net: totalNet,
                processed_by: profileId,
                processed_at: new Date().toISOString(),
              })
              .eq("id", run.id)
              .eq("org_id", orgId!);

            if (error) { toast.error(error.message); return; }
            toast.success("Payroll run processed successfully");
            bootstrap();
          }}
          onCancel={async (run) => {
            const { error } = await from(supabase, "payroll_runs")
              .update({ status: "cancelled" })
              .eq("id", run.id)
              .eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Payroll run cancelled");
            bootstrap();
          }}
        />
      )}

      {tab === "structures" && (
        <StructuresTab
          structures={structures}
          empName={empName}
          onEdit={(s) => { setEditStructure(s); setNewStructureOpen(true); }}
          onDelete={async (s) => {
            const { error } = await from(supabase, "salary_structures").delete().eq("id", s.id).eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Salary structure deleted");
            bootstrap();
          }}
        />
      )}

      {tab === "slips" && (
        <SlipsTab
          slips={filteredSlips}
          employees={employees}
          empName={empName}
          filterYear={slipFilterYear}
          filterMonth={slipFilterMonth}
          filterEmployee={slipFilterEmployee}
          onFilterYear={setSlipFilterYear}
          onFilterMonth={setSlipFilterMonth}
          onFilterEmployee={setSlipFilterEmployee}
          onView={(s) => setViewSlip(s)}
          onEdit={(s) => setEditSlip(s)}
        />
      )}

      {/* New Run Sheet */}
      <NewRunSheet
        open={newRunOpen}
        onOpenChange={setNewRunOpen}
        orgId={orgId!}
        profileId={profileId!}
        employees={employees}
        structures={structures}
        supabase={supabase}
        onDone={bootstrap}
      />

      {/* New / Edit Structure Sheet */}
      <StructureSheet
        open={newStructureOpen}
        onOpenChange={setNewStructureOpen}
        orgId={orgId!}
        employees={employees}
        supabase={supabase}
        existing={editStructure}
        onDone={bootstrap}
      />

      {/* View Run Slips Sheet */}
      {viewRunSlips && (
        <Sheet
          open={!!viewRunSlips}
          onOpenChange={() => setViewRunSlips(null)}
          title={`Slips for ${MONTHS[(viewRunSlips.period_month - 1)]} ${viewRunSlips.period_year}`}
          width={640}
        >
          {runSlips.length === 0 ? (
            <p className="text-[13px] py-4" style={{ color: "var(--color-ink-tertiary)" }}>
              No salary slips found for this run.
            </p>
          ) : (
            <div className="space-y-2">
              {runSlips.map((s) => (
                <div
                  key={s.id}
                  className="p-3 rounded-lg"
                  style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium">{empName(s.employee_id)}</span>
                    <span className="text-[13px] font-medium" style={{ color: "var(--color-viridian-700)" }}>
                      {formatCurrency(s.net)}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                    <span>Gross: {formatCurrency(s.gross)}</span>
                    <span>Deductions: {formatCurrency(s.total_deductions)}</span>
                    <span>Days: {s.paid_days ?? "—"}/{s.working_days ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}

      {/* View Slip Detail Sheet */}
      {viewSlip && (
        <SlipDetailSheet
          slip={viewSlip}
          empName={empName(viewSlip.employee_id)}
          open={!!viewSlip}
          onOpenChange={() => setViewSlip(null)}
        />
      )}

      {/* Edit Slip Sheet */}
      {editSlip && (
        <EditSlipSheet
          slip={editSlip}
          empName={empName(editSlip.employee_id)}
          open={!!editSlip}
          onOpenChange={() => setEditSlip(null)}
          orgId={orgId!}
          supabase={supabase}
          onDone={bootstrap}
        />
      )}
    </PageContainer>
  );
}

/* ============================================================================
   Runs Tab
   ========================================================================= */

function RunsTab({
  runs,
  empName,
  statusTone,
  onViewSlips,
  onProcess,
  onCancel,
}: {
  runs: PayrollRun[];
  empName: (id: string) => string;
  statusTone: (s: string) => string;
  onViewSlips: (run: PayrollRun) => void;
  onProcess: (run: PayrollRun) => void;
  onCancel: (run: PayrollRun) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <div
          className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
          style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
        >
          <Banknote className="size-5" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">No payroll runs yet</h3>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
          Create your first payroll run to generate salary slips for your employees.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Th>Period</Th>
            <Th>Status</Th>
            <Th align="right">Total Gross</Th>
            <Th align="right">Total Net</Th>
            <Th>Processed At</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-[var(--color-surface-hover)] transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <Td>
                <span className="font-medium">{MONTHS[run.period_month - 1]} {run.period_year}</span>
              </Td>
              <Td>
                <Badge tone={statusTone(run.status) as any}>{run.status}</Badge>
              </Td>
              <Td align="right" muted>{run.total_gross ? formatCurrency(run.total_gross) : "—"}</Td>
              <Td align="right" muted>{run.total_net ? formatCurrency(run.total_net) : "—"}</Td>
              <Td muted>{run.processed_at ? formatDate(run.processed_at) : "—"}</Td>
              <Td align="right">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" iconLeft={<Eye className="size-3.5" />} onClick={() => onViewSlips(run)}>
                    Slips
                  </Button>
                  {run.status === "draft" && (
                    <>
                      <Button size="sm" variant="primary" iconLeft={<Play className="size-3" />} onClick={() => onProcess(run)}>
                        Process
                      </Button>
                      <Button size="sm" variant="ghost" iconLeft={<XCircle className="size-3.5" />} onClick={() => onCancel(run)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================
   Structures Tab
   ========================================================================= */

function StructuresTab({
  structures,
  empName,
  onEdit,
  onDelete,
}: {
  structures: SalaryStructure[];
  empName: (id: string) => string;
  onEdit: (s: SalaryStructure) => void;
  onDelete: (s: SalaryStructure) => void;
}) {
  if (structures.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <div
          className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
          style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
        >
          <DollarSign className="size-5" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">No salary structures</h3>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
          Define salary structures for your employees to enable automatic payroll generation.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
            <Th>Employee</Th>
            <Th align="right">CTC Annual</Th>
            <Th>Effective From</Th>
            <Th>Effective To</Th>
            <Th align="right">Components</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {structures.map((s) => (
            <tr key={s.id} className="hover:bg-[var(--color-surface-hover)] transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <Td><span className="font-medium">{empName(s.employee_id)}</span></Td>
              <Td align="right" muted>{formatCurrency(s.ctc_annual)}</Td>
              <Td muted>{s.effective_from ? formatDate(s.effective_from) : "—"}</Td>
              <Td muted>{s.effective_to ? formatDate(s.effective_to) : "—"}</Td>
              <Td align="right" muted>{(s.components ?? []).length}</Td>
              <Td align="right">
                <div className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" iconLeft={<Pencil className="size-3" />} onClick={() => onEdit(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" iconLeft={<Trash2 className="size-3" />} onClick={() => onDelete(s)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================================
   Slips Tab
   ========================================================================= */

function SlipsTab({
  slips,
  employees,
  empName,
  filterYear,
  filterMonth,
  filterEmployee,
  onFilterYear,
  onFilterMonth,
  onFilterEmployee,
  onView,
  onEdit,
}: {
  slips: SalarySlip[];
  employees: Employee[];
  empName: (id: string) => string;
  filterYear: number;
  filterMonth: number;
  filterEmployee: string;
  onFilterYear: (y: number) => void;
  onFilterMonth: (m: number) => void;
  onFilterEmployee: (e: string) => void;
  onView: (s: SalarySlip) => void;
  onEdit: (s: SalarySlip) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterYear} onChange={(e) => onFilterYear(Number(e.target.value))} className="w-32">
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select value={filterMonth} onChange={(e) => onFilterMonth(Number(e.target.value))} className="w-40">
          <option value={0}>All months</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </Select>
        <Select value={filterEmployee} onChange={(e) => onFilterEmployee(e.target.value)} className="w-52">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""}</option>
          ))}
        </Select>
      </div>

      {slips.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <Banknote className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">No salary slips found</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            Adjust your filters or create a payroll run to generate slips.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>Employee</Th>
                <Th>Period</Th>
                <Th align="right">Working Days</Th>
                <Th align="right">Paid Days</Th>
                <Th align="right">Gross</Th>
                <Th align="right">Deductions</Th>
                <Th align="right">Net</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--color-surface-hover)] transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Td><span className="font-medium">{empName(s.employee_id)}</span></Td>
                  <Td muted>{MONTHS[s.period_month - 1]} {s.period_year}</Td>
                  <Td align="right" muted>{s.working_days ?? "—"}</Td>
                  <Td align="right" muted>{s.paid_days ?? "—"}</Td>
                  <Td align="right" muted>{formatCurrency(s.gross)}</Td>
                  <Td align="right" muted>{formatCurrency(s.total_deductions)}</Td>
                  <Td align="right">
                    <span className="font-medium" style={{ color: "var(--color-viridian-700)" }}>
                      {formatCurrency(s.net)}
                    </span>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" iconLeft={<Eye className="size-3.5" />} onClick={() => onView(s)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" iconLeft={<Pencil className="size-3" />} onClick={() => onEdit(s)}>
                        Edit
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ============================================================================
   New Run Sheet
   ========================================================================= */

function NewRunSheet({
  open,
  onOpenChange,
  orgId,
  profileId,
  employees,
  structures,
  supabase,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  profileId: string;
  employees: Employee[];
  structures: SalaryStructure[];
  supabase: Supa;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  async function onCreate() {
    setBusy(true);

    // Create the payroll run
    const { data: run, error: runErr } = await from(supabase, "payroll_runs")
      .insert({
        org_id: orgId,
        period_year: year,
        period_month: month,
        status: "draft",
      })
      .select()
      .single();

    if (runErr || !run) {
      toast.error(runErr?.message ?? "Failed to create payroll run");
      setBusy(false);
      return;
    }

    // Generate salary slips for all active employees with salary structures
    const slipsToInsert: Record<string, unknown>[] = [];

    for (const emp of employees) {
      const structure = structures.find(
        (s) =>
          s.employee_id === emp.id &&
          (!s.effective_to || new Date(s.effective_to) >= new Date())
      );

      const earnings = structure
        ? (structure.components ?? []).filter((c) => c.type === "earning")
        : [];
      const deductions = structure
        ? (structure.components ?? []).filter((c) => c.type === "deduction")
        : [];

      const gross = earnings.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const totalDed = deductions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const net = gross - totalDed;

      slipsToInsert.push({
        org_id: orgId,
        payroll_run_id: run.id,
        employee_id: emp.id,
        period_year: year,
        period_month: month,
        working_days: 30,
        paid_days: 30,
        loss_of_pay_days: 0,
        earnings: earnings.map((c) => ({ name: c.name, amount: c.amount })),
        deductions: deductions.map((c) => ({ name: c.name, amount: c.amount })),
        gross,
        total_deductions: totalDed,
        net,
      });
    }

    if (slipsToInsert.length > 0) {
      const { error: slipErr } = await from(supabase, "salary_slips").insert(slipsToInsert);
      if (slipErr) {
        toast.error("Run created but failed to generate slips: " + slipErr.message);
        setBusy(false);
        onDone();
        onOpenChange(false);
        return;
      }
    }

    toast.success(`Payroll run created with ${slipsToInsert.length} slip(s)`);
    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title="New Payroll Run"
      description="Create a draft payroll run. Salary slips will be auto-generated for all active employees with salary structures."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onCreate} loading={busy}>Create Run</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Year" required>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </Field>
        <Field label="Month" required>
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </Select>
        </Field>
        <div className="p-3 rounded-lg text-[12px]" style={{ background: "var(--color-surface-muted)", color: "var(--color-ink-secondary)" }}>
          <strong>{employees.length}</strong> active employee(s) will have salary slips generated based on their salary structures.
        </div>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Structure Sheet (New / Edit)
   ========================================================================= */

function StructureSheet({
  open,
  onOpenChange,
  orgId,
  employees,
  supabase,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  employees: Employee[];
  supabase: Supa;
  existing: SalaryStructure | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState(existing?.employee_id ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(existing?.effective_from ?? "");
  const [effectiveTo, setEffectiveTo] = useState(existing?.effective_to ?? "");
  const [ctcAnnual, setCtcAnnual] = useState(String(existing?.ctc_annual ?? ""));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [components, setComponents] = useState<SalaryComponent[]>(
    existing?.components ?? [{ name: "Basic Salary", type: "earning", amount: 0 }]
  );

  useEffect(() => {
    if (open) {
      setEmployeeId(existing?.employee_id ?? "");
      setEffectiveFrom(existing?.effective_from ?? "");
      setEffectiveTo(existing?.effective_to ?? "");
      setCtcAnnual(String(existing?.ctc_annual ?? ""));
      setNotes(existing?.notes ?? "");
      setComponents(existing?.components ?? [{ name: "Basic Salary", type: "earning", amount: 0 }]);
    }
  }, [open, existing]);

  const addComponent = () => {
    setComponents([...components, { name: "", type: "earning", amount: 0 }]);
  };

  const removeComponent = (i: number) => {
    setComponents(components.filter((_, idx) => idx !== i));
  };

  const updateComponent = (i: number, field: string, value: string | number) => {
    setComponents(components.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  async function onSave() {
    if (!employeeId) { toast.error("Please select an employee"); return; }
    setBusy(true);

    const payload = {
      org_id: orgId,
      employee_id: employeeId,
      effective_from: effectiveFrom || null,
      effective_to: effectiveTo || null,
      ctc_annual: ctcAnnual ? Number(ctcAnnual) : null,
      components,
      notes: notes || null,
    };

    if (existing) {
      const { error } = await from(supabase, "salary_structures")
        .update(payload)
        .eq("id", existing.id)
        .eq("org_id", orgId);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Salary structure updated");
    } else {
      const { error } = await from(supabase, "salary_structures").insert(payload);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Salary structure created");
    }

    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={existing ? "Edit Salary Structure" : "Add Salary Structure"}
      description="Define the salary components for an employee."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSave} loading={busy}>{existing ? "Update" : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Employee" required>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""} {e.employee_code ? `(${e.employee_code})` : ""}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective From">
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
          <Field label="Effective To">
            <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </Field>
        </div>

        <Field label="CTC Annual">
          <Input type="number" value={ctcAnnual} onChange={(e) => setCtcAnnual(e.target.value)} placeholder="e.g. 600000" />
        </Field>

        {/* Components Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>Components</span>
            <Button size="sm" variant="ghost" iconLeft={<Plus className="size-3" />} onClick={addComponent}>Add</Button>
          </div>
          <div className="space-y-2">
            {components.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Component name"
                  value={c.name}
                  onChange={(e) => updateComponent(i, "name", e.target.value)}
                />
                <Select value={c.type} onChange={(e) => updateComponent(i, "type", e.target.value)} className="w-28">
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </Select>
                <Input
                  type="number"
                  className="w-28"
                  placeholder="Amount"
                  value={c.amount || ""}
                  onChange={(e) => updateComponent(i, "amount", Number(e.target.value))}
                />
                <button
                  onClick={() => removeComponent(i)}
                  className="size-8 inline-flex items-center justify-center rounded-lg shrink-0 hover:bg-[var(--color-surface-hover)]"
                  style={{ color: "var(--color-ink-tertiary)" }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." />
        </Field>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Slip Detail Sheet
   ========================================================================= */

function SlipDetailSheet({
  slip,
  empName,
  open,
  onOpenChange,
}: {
  slip: SalarySlip;
  empName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const earnings = slip.earnings ?? [];
  const deductions = slip.deductions ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Pay Slip - ${empName}`} description={`${MONTHS[slip.period_month - 1]} ${slip.period_year}`} width={520}>
      <div className="space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <SumCard label="Gross" value={formatCurrency(slip.gross)} />
          <SumCard label="Deductions" value={formatCurrency(slip.total_deductions)} />
          <SumCard label="Net Pay" value={formatCurrency(slip.net)} highlight />
        </div>

        <div className="grid grid-cols-3 gap-3 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
          <div>Working Days: <strong>{slip.working_days ?? "—"}</strong></div>
          <div>Paid Days: <strong>{slip.paid_days ?? "—"}</strong></div>
          <div>LOP Days: <strong>{slip.loss_of_pay_days ?? "0"}</strong></div>
        </div>

        {/* Earnings */}
        <div>
          <h4 className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-viridian-700)" }}>Earnings</h4>
          {earnings.length > 0 ? (
            <div className="space-y-1">
              {earnings.map((e, i) => (
                <div key={i} className="flex justify-between text-[13px] py-1" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span>{e.name}</span>
                  <span className="font-medium">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>No earnings defined</p>
          )}
        </div>

        {/* Deductions */}
        <div>
          <h4 className="text-[12px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-ink-secondary)" }}>Deductions</h4>
          {deductions.length > 0 ? (
            <div className="space-y-1">
              {deductions.map((d, i) => (
                <div key={i} className="flex justify-between text-[13px] py-1" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span>{d.name}</span>
                  <span className="font-medium">{formatCurrency(d.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>No deductions defined</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Edit Slip Sheet
   ========================================================================= */

function EditSlipSheet({
  slip,
  empName,
  open,
  onOpenChange,
  orgId,
  supabase,
  onDone,
}: {
  slip: SalarySlip;
  empName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  supabase: Supa;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [workingDays, setWorkingDays] = useState(String(slip.working_days ?? 30));
  const [paidDays, setPaidDays] = useState(String(slip.paid_days ?? 30));
  const [lopDays, setLopDays] = useState(String(slip.loss_of_pay_days ?? 0));
  const [earnings, setEarnings] = useState<{ name: string; amount: number }[]>(slip.earnings ?? []);
  const [deductions, setDeductions] = useState<{ name: string; amount: number }[]>(slip.deductions ?? []);

  const gross = earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalDed = deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const net = gross - totalDed;

  async function onSave() {
    setBusy(true);
    const { error } = await from(supabase, "salary_slips")
      .update({
        working_days: Number(workingDays),
        paid_days: Number(paidDays),
        loss_of_pay_days: Number(lopDays),
        earnings,
        deductions,
        gross,
        total_deductions: totalDed,
        net,
      })
      .eq("id", slip.id)
      .eq("org_id", orgId);

    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Salary slip updated");
    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={`Edit Slip - ${empName}`}
      description={`${MONTHS[slip.period_month - 1]} ${slip.period_year}`}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSave} loading={busy}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Working Days">
            <Input type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} />
          </Field>
          <Field label="Paid Days">
            <Input type="number" value={paidDays} onChange={(e) => setPaidDays(e.target.value)} />
          </Field>
          <Field label="LOP Days">
            <Input type="number" value={lopDays} onChange={(e) => setLopDays(e.target.value)} />
          </Field>
        </div>

        {/* Earnings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--color-viridian-700)" }}>Earnings</span>
            <Button size="sm" variant="ghost" iconLeft={<Plus className="size-3" />} onClick={() => setEarnings([...earnings, { name: "", amount: 0 }])}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {earnings.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Component"
                  value={e.name}
                  onChange={(ev) => setEarnings(earnings.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))}
                />
                <Input
                  type="number"
                  className="w-28"
                  value={e.amount || ""}
                  onChange={(ev) => setEarnings(earnings.map((x, j) => j === i ? { ...x, amount: Number(ev.target.value) } : x))}
                />
                <button
                  onClick={() => setEarnings(earnings.filter((_, j) => j !== i))}
                  className="size-8 inline-flex items-center justify-center rounded-lg shrink-0 hover:bg-[var(--color-surface-hover)]"
                  style={{ color: "var(--color-ink-tertiary)" }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Deductions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>Deductions</span>
            <Button size="sm" variant="ghost" iconLeft={<Plus className="size-3" />} onClick={() => setDeductions([...deductions, { name: "", amount: 0 }])}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {deductions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Component"
                  value={d.name}
                  onChange={(ev) => setDeductions(deductions.map((x, j) => j === i ? { ...x, name: ev.target.value } : x))}
                />
                <Input
                  type="number"
                  className="w-28"
                  value={d.amount || ""}
                  onChange={(ev) => setDeductions(deductions.map((x, j) => j === i ? { ...x, amount: Number(ev.target.value) } : x))}
                />
                <button
                  onClick={() => setDeductions(deductions.filter((_, j) => j !== i))}
                  className="size-8 inline-flex items-center justify-center rounded-lg shrink-0 hover:bg-[var(--color-surface-hover)]"
                  style={{ color: "var(--color-ink-tertiary)" }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Calculated Totals */}
        <div className="p-3 rounded-lg" style={{ background: "var(--color-surface-muted)" }}>
          <div className="grid grid-cols-3 gap-3 text-[13px]">
            <div>Gross: <strong>{formatCurrency(gross)}</strong></div>
            <div>Deductions: <strong>{formatCurrency(totalDed)}</strong></div>
            <div>Net: <strong style={{ color: "var(--color-viridian-700)" }}>{formatCurrency(net)}</strong></div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Reusable Bits
   ========================================================================= */

function SumCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-3 rounded-lg text-center" style={{ background: "var(--color-surface-muted)" }}>
      <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--color-ink-tertiary)" }}>{label}</div>
      <div className="text-[15px] font-semibold" style={{ color: highlight ? "var(--color-viridian-700)" : "var(--color-ink)" }}>{value}</div>
    </div>
  );
}

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

function Td({ children, align, muted }: { children: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{ textAlign: align ?? "left", color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)" }}
    >
      {children}
    </td>
  );
}
