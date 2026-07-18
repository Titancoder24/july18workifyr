"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarDays,
  Plus,
  Search,
  Check,
  X,
  Pencil,
  Trash2,
  FileText,
  BarChart3,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Employee = {
  id: string;
  first_name: string;
  last_name: string | null;
  employee_code: string | null;
  status: string;
};

type LeavePolicy = {
  id: string;
  code: string;
  name: string;
  annual_quota: number;
  carry_forward_max: number | null;
  accrual: string;
  paid: boolean;
  requires_approval: boolean;
  active: boolean;
};

type LeaveRequest = {
  id: string;
  employee_id: string;
  policy_id: string;
  starts_on: string;
  ends_on: string;
  days: number;
  reason: string | null;
  status: string;
  approver_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  employee: { first_name: string; last_name: string | null; employee_code: string | null } | { first_name: string; last_name: string | null; employee_code: string | null }[] | null;
  policy: { code: string; name: string } | { code: string; name: string }[] | null;
};

type LeaveBalance = {
  id: string;
  employee_id: string;
  policy_id: string;
  year: number;
  opening: number;
  accrued: number;
  used: number;
  carried_forward: number;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

const statusTone = (s: string) => {
  if (s === "approved") return "viridian" as const;
  if (s === "rejected") return "danger" as const;
  if (s === "pending") return "warning" as const;
  if (s === "cancelled") return "neutral" as const;
  return "neutral" as const;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function LeavePage() {
  const supabase = useMemo(() => createClient(), []);

  /* ---- state ---- */
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  /* ---- tabs ---- */
  const [tab, setTab] = useState<"requests" | "balances" | "policies">("requests");

  /* ---- request filters ---- */
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  /* ---- new request sheet ---- */
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    employee_id: "",
    policy_id: "",
    starts_on: "",
    ends_on: "",
    reason: "",
  });
  const [savingRequest, setSavingRequest] = useState(false);

  /* ---- reject dialog ---- */
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);

  /* ---- balances ---- */
  const [balanceYear, setBalanceYear] = useState(new Date().getFullYear());
  const [editBalanceId, setEditBalanceId] = useState<string | null>(null);
  const [editBalanceForm, setEditBalanceForm] = useState({ opening: "", accrued: "" });
  const [savingBalance, setSavingBalance] = useState(false);

  /* ---- policy sheet ---- */
  const [policySheetOpen, setPolicySheetOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState({
    code: "",
    name: "",
    annual_quota: "",
    carry_forward_max: "",
    accrual: "yearly",
    paid: true,
    requires_approval: true,
    active: true,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  /* ---- fetch ---- */
  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (!profile) return;
    const oid = profile.org_id;
    setOrgId(oid);
    setCurrentUserId(profile.id);

    const [empRes, polRes, reqRes, balRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code, status")
        .eq("org_id", oid)
        .in("status", ["active", "on_leave"])
        .order("first_name"),
      supabase
        .from("leave_policies")
        .select("*")
        .eq("org_id", oid)
        .order("code"),
      supabase
        .from("leave_requests")
        .select(`
          id, employee_id, policy_id, starts_on, ends_on, days, reason,
          status, approver_id, decided_at, decision_note, created_at,
          employee:employees(first_name, last_name, employee_code),
          policy:leave_policies(code, name)
        `)
        .eq("org_id", oid)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("leave_balances")
        .select("*")
        .eq("org_id", oid),
    ]);

    setEmployees((empRes.data ?? []) as Employee[]);
    setPolicies((polRes.data ?? []) as LeavePolicy[]);
    setRequests((reqRes.data ?? []) as LeaveRequest[]);
    setBalances((balRes.data ?? []) as LeaveBalance[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchRequests = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("leave_requests")
      .select(`
        id, employee_id, policy_id, starts_on, ends_on, days, reason,
        status, approver_id, decided_at, decision_note, created_at,
        employee:employees(first_name, last_name, employee_code),
        policy:leave_policies(code, name)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRequests((data ?? []) as LeaveRequest[]);
  }, [supabase, orgId]);

  const fetchBalances = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("org_id", orgId);
    setBalances((data ?? []) as LeaveBalance[]);
  }, [supabase, orgId]);

  const fetchPolicies = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("leave_policies")
      .select("*")
      .eq("org_id", orgId)
      .order("code");
    setPolicies((data ?? []) as LeavePolicy[]);
  }, [supabase, orgId]);

  /* ---- filtered requests ---- */
  const filteredRequests = useMemo(() => {
    let list = requests;
    if (filterStatus) list = list.filter((r) => r.status === filterStatus);
    if (filterEmployee) list = list.filter((r) => r.employee_id === filterEmployee);
    if (filterDateFrom) list = list.filter((r) => r.starts_on >= filterDateFrom);
    if (filterDateTo) list = list.filter((r) => r.ends_on <= filterDateTo);
    return list;
  }, [requests, filterStatus, filterEmployee, filterDateFrom, filterDateTo]);

  /* ---- auto-calc days ---- */
  const calcDays = useMemo(() => {
    if (requestForm.starts_on && requestForm.ends_on) {
      return daysBetween(requestForm.starts_on, requestForm.ends_on);
    }
    return 0;
  }, [requestForm.starts_on, requestForm.ends_on]);

  /* ---- request actions ---- */
  function openNewRequest() {
    setRequestForm({
      employee_id: employees[0]?.id ?? "",
      policy_id: policies.filter((p) => p.active)[0]?.id ?? "",
      starts_on: "",
      ends_on: "",
      reason: "",
    });
    setRequestSheetOpen(true);
  }

  async function saveRequest() {
    if (!requestForm.employee_id || !requestForm.policy_id || !requestForm.starts_on || !requestForm.ends_on) {
      toast.error("Please fill all required fields");
      return;
    }
    if (new Date(requestForm.ends_on) < new Date(requestForm.starts_on)) {
      toast.error("End date must be on or after start date");
      return;
    }
    setSavingRequest(true);
    const days = daysBetween(requestForm.starts_on, requestForm.ends_on);
    const { error } = await supabase.from("leave_requests").insert({
      org_id: orgId,
      employee_id: requestForm.employee_id,
      policy_id: requestForm.policy_id,
      starts_on: requestForm.starts_on,
      ends_on: requestForm.ends_on,
      days,
      reason: requestForm.reason.trim() || null,
      status: "pending",
    });
    setSavingRequest(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave request submitted");
    setRequestSheetOpen(false);
    fetchRequests();
  }

  async function approveRequest(id: string) {
    setDecidingId(id);
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approver_id: currentUserId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .eq("status", "pending");
    setDecidingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave approved");
    fetchRequests();
  }

  function startReject(id: string) {
    setRejectingId(id);
    setRejectNote("");
  }

  async function confirmReject() {
    if (!rejectingId) return;
    setDecidingId(rejectingId);
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approver_id: currentUserId,
        decided_at: new Date().toISOString(),
        decision_note: rejectNote.trim() || null,
      })
      .eq("id", rejectingId)
      .eq("org_id", orgId)
      .eq("status", "pending");
    setDecidingId(null);
    setRejectingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Leave rejected");
    fetchRequests();
  }

  /* ---- balance actions ---- */
  const yearBalances = useMemo(
    () => balances.filter((b) => b.year === balanceYear),
    [balances, balanceYear],
  );

  const activePolicies = useMemo(() => policies.filter((p) => p.active), [policies]);

  function getBalance(empId: string, policyId: string): LeaveBalance | null {
    return yearBalances.find((b) => b.employee_id === empId && b.policy_id === policyId) ?? null;
  }

  function startEditBalance(bal: LeaveBalance) {
    setEditBalanceId(bal.id);
    setEditBalanceForm({
      opening: String(bal.opening),
      accrued: String(bal.accrued),
    });
  }

  async function saveBalance() {
    if (!editBalanceId) return;
    setSavingBalance(true);
    const { error } = await supabase
      .from("leave_balances")
      .update({
        opening: parseFloat(editBalanceForm.opening) || 0,
        accrued: parseFloat(editBalanceForm.accrued) || 0,
      })
      .eq("id", editBalanceId)
      .eq("org_id", orgId);
    setSavingBalance(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Balance updated");
    setEditBalanceId(null);
    fetchBalances();
  }

  /* ---- policy actions ---- */
  function openCreatePolicy() {
    setEditingPolicyId(null);
    setPolicyForm({
      code: "",
      name: "",
      annual_quota: "",
      carry_forward_max: "",
      accrual: "yearly",
      paid: true,
      requires_approval: true,
      active: true,
    });
    setPolicySheetOpen(true);
  }

  function openEditPolicy(p: LeavePolicy) {
    setEditingPolicyId(p.id);
    setPolicyForm({
      code: p.code,
      name: p.name,
      annual_quota: String(p.annual_quota),
      carry_forward_max: p.carry_forward_max != null ? String(p.carry_forward_max) : "",
      accrual: p.accrual,
      paid: p.paid,
      requires_approval: p.requires_approval,
      active: p.active,
    });
    setPolicySheetOpen(true);
  }

  async function savePolicy() {
    if (!policyForm.code.trim() || !policyForm.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    setSavingPolicy(true);
    const row = {
      org_id: orgId,
      code: policyForm.code.trim().toUpperCase(),
      name: policyForm.name.trim(),
      annual_quota: parseFloat(policyForm.annual_quota) || 0,
      carry_forward_max: policyForm.carry_forward_max ? parseFloat(policyForm.carry_forward_max) : null,
      accrual: policyForm.accrual,
      paid: policyForm.paid,
      requires_approval: policyForm.requires_approval,
      active: policyForm.active,
    };
    let error;
    if (editingPolicyId) {
      const res = await supabase.from("leave_policies").update(row).eq("id", editingPolicyId).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("leave_policies").insert(row);
      error = res.error;
    }
    setSavingPolicy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingPolicyId ? "Policy updated" : "Policy created");
    setPolicySheetOpen(false);
    fetchPolicies();
  }

  async function deletePolicy(p: LeavePolicy) {
    if (!confirm(`Delete leave policy "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("leave_policies").delete().eq("id", p.id).eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Policy deleted");
    fetchPolicies();
  }

  /* ---- loading ---- */
  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Leave Management" />
        <div className="card overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="px-4 py-4 flex gap-3 animate-pulse"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="size-7 rounded-full" style={{ background: "var(--color-surface-muted)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded" style={{ background: "var(--color-surface-muted)" }} />
                <div className="h-3 w-48 rounded" style={{ background: "var(--color-surface-muted)" }} />
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  /* ---- pending count ---- */
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <PageContainer>
      <PageHeader
        title="Leave Management"
        description={`${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`}
        actions={
          <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openNewRequest}>
            New Request
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ background: "var(--color-surface-muted)" }}
        >
          {([
            { key: "requests" as const, label: "Requests", icon: FileText },
            { key: "balances" as const, label: "Balances", icon: BarChart3 },
            { key: "policies" as const, label: "Policies", icon: Settings2 },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors"
              style={{
                background: tab === t.key ? "var(--color-surface)" : "transparent",
                color: tab === t.key ? "var(--color-ink)" : "var(--color-ink-tertiary)",
                boxShadow: tab === t.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {t.key === "requests" && pendingCount > 0 && (
                <span
                  className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--color-viridian-500)", color: "white" }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ============ REQUESTS TAB ============ */}
      {tab === "requests" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="!w-auto min-w-[130px]"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="!w-auto min-w-[160px]"
            >
              <option value="">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name ?? ""}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="!w-auto"
              placeholder="From"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="!w-auto"
              placeholder="To"
            />
            {(filterStatus || filterEmployee || filterDateFrom || filterDateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus("");
                  setFilterEmployee("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {/* Request Table */}
          <div className="card overflow-hidden">
            {filteredRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {["Employee", "Leave Type", "Period", "Days", "Reason", "Status", "Requested", "Actions"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider whitespace-nowrap"
                          style={{ color: "var(--color-ink-tertiary)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => {
                      const emp = flatten(req.employee);
                      const pol = flatten(req.policy);
                      const name = emp ? `${emp.first_name} ${emp.last_name ?? ""}`.trim() : "—";
                      const isDeciding = decidingId === req.id;
                      return (
                        <tr
                          key={req.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                          style={{ borderBottom: "1px solid var(--color-border)" }}
                        >
                          <td className="px-4 py-3 text-[13px]">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name} size="sm" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                {emp?.employee_code && (
                                  <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                                    {emp.employee_code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                            {pol?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--color-ink-secondary)" }}>
                            {formatDate(req.starts_on)} → {formatDate(req.ends_on)}
                          </td>
                          <td className="px-4 py-3 text-[13px] text-center">{req.days}</td>
                          <td className="px-4 py-3 text-[12px] max-w-[150px] truncate" style={{ color: "var(--color-ink-tertiary)" }}>
                            {req.reason ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "var(--color-ink-tertiary)" }}>
                            {formatDate(req.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            {req.status === "pending" && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => approveRequest(req.id)}
                                  loading={isDeciding && decidingId === req.id}
                                  iconLeft={<Check className="size-3" />}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startReject(req.id)}
                                  iconLeft={<X className="size-3" />}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                            {req.decision_note && req.status === "rejected" && (
                              <span
                                className="text-[11px]"
                                style={{ color: "var(--color-ink-tertiary)" }}
                                title={req.decision_note}
                              >
                                Note: {req.decision_note.slice(0, 30)}...
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <div
                  className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
                  style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
                >
                  <CalendarDays className="size-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  {requests.length === 0 ? "No leave requests yet" : "No requests match your filters"}
                </h3>
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {requests.length === 0
                    ? "Submit your first leave request using the button above."
                    : "Try adjusting your filter criteria."}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ BALANCES TAB ============ */}
      {tab === "balances" && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Select
              value={String(balanceYear)}
              onChange={(e) => setBalanceYear(parseInt(e.target.value))}
              className="!w-auto"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div className="card overflow-hidden">
            {employees.length > 0 && activePolicies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th
                        className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider sticky left-0"
                        style={{ color: "var(--color-ink-tertiary)", background: "var(--color-surface)", minWidth: 180 }}
                      >
                        Employee
                      </th>
                      {activePolicies.map((p) => (
                        <th
                          key={p.id}
                          className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider"
                          style={{ color: "var(--color-ink-tertiary)", minWidth: 200 }}
                          colSpan={1}
                        >
                          <div>{p.name}</div>
                          <div className="text-[9px] font-normal normal-case mt-0.5" style={{ color: "var(--color-ink-tertiary)" }}>
                            Open | Accr | Used | Bal
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const name = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                          style={{ borderBottom: "1px solid var(--color-border)" }}
                        >
                          <td
                            className="px-4 py-3 text-[13px] sticky left-0"
                            style={{ background: "var(--color-surface)" }}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar name={name} size="sm" />
                              <span className="font-medium truncate">{name}</span>
                            </div>
                          </td>
                          {activePolicies.map((pol) => {
                            const bal = getBalance(emp.id, pol.id);
                            const isEditing = editBalanceId === bal?.id;
                            if (!bal) {
                              return (
                                <td key={pol.id} className="px-3 py-3 text-center text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                                  —
                                </td>
                              );
                            }
                            const balance = bal.opening + bal.accrued - bal.used + bal.carried_forward;
                            return (
                              <td key={pol.id} className="px-3 py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      value={editBalanceForm.opening}
                                      onChange={(e) => setEditBalanceForm((f) => ({ ...f, opening: e.target.value }))}
                                      className="w-12 h-6 px-1 text-[11px] text-center rounded"
                                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                                    />
                                    <input
                                      type="number"
                                      value={editBalanceForm.accrued}
                                      onChange={(e) => setEditBalanceForm((f) => ({ ...f, accrued: e.target.value }))}
                                      className="w-12 h-6 px-1 text-[11px] text-center rounded"
                                      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                                    />
                                    <Button variant="primary" size="sm" onClick={saveBalance} loading={savingBalance}>
                                      <Check className="size-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setEditBalanceId(null)}>
                                      <X className="size-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div
                                    className="text-[12px] text-center cursor-pointer hover:underline"
                                    onClick={() => startEditBalance(bal)}
                                    title="Click to edit"
                                  >
                                    <span style={{ color: "var(--color-ink-secondary)" }}>
                                      {bal.opening} | {bal.accrued} | {bal.used} |{" "}
                                    </span>
                                    <span className="font-semibold" style={{ color: balance > 0 ? "var(--color-viridian-700)" : "var(--color-ink)" }}>
                                      {balance}
                                    </span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <div
                  className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
                  style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
                >
                  <BarChart3 className="size-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">No balance data</h3>
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {employees.length === 0
                    ? "Add employees first to track leave balances."
                    : "Create leave policies first, then balances will be tracked here."}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ POLICIES TAB ============ */}
      {tab === "policies" && (
        <>
          <div className="flex justify-end mb-4">
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openCreatePolicy}>
              Add Policy
            </Button>
          </div>
          <div className="card overflow-hidden">
            {policies.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {["Code", "Name", "Annual Quota", "Carry Forward Max", "Accrual", "Paid", "Approval", "Status", "Actions"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider whitespace-nowrap"
                          style={{ color: "var(--color-ink-tertiary)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((pol) => (
                      <tr
                        key={pol.id}
                        className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <td className="px-4 py-3 text-[13px] font-medium">{pol.code}</td>
                        <td className="px-4 py-3 text-[13px]">{pol.name}</td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                          {pol.annual_quota} days
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                          {pol.carry_forward_max != null ? `${pol.carry_forward_max} days` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[13px] capitalize" style={{ color: "var(--color-ink-secondary)" }}>
                          {pol.accrual}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={pol.paid ? "viridian" : "neutral"}>
                            {pol.paid ? "Paid" : "Unpaid"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={pol.requires_approval ? "warning" : "neutral"}>
                            {pol.requires_approval ? "Required" : "Auto"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={pol.active ? "viridian" : "neutral"}>
                            {pol.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditPolicy(pol)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deletePolicy(pol)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-16 text-center">
                <div
                  className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
                  style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
                >
                  <Settings2 className="size-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">No leave policies</h3>
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                  Create your first leave policy to start managing employee leave.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ NEW REQUEST SHEET ============ */}
      <Sheet
        open={requestSheetOpen}
        onOpenChange={(v) => !savingRequest && setRequestSheetOpen(v)}
        title="New Leave Request"
        description="Submit a leave request on behalf of an employee."
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequestSheetOpen(false)} disabled={savingRequest}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveRequest} loading={savingRequest}>
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Employee" required>
            <Select
              value={requestForm.employee_id}
              onChange={(e) => setRequestForm((f) => ({ ...f, employee_id: e.target.value }))}
            >
              <option value="">-- Select --</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name ?? ""} {e.employee_code ? `(${e.employee_code})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Leave type" required>
            <Select
              value={requestForm.policy_id}
              onChange={(e) => setRequestForm((f) => ({ ...f, policy_id: e.target.value }))}
            >
              <option value="">-- Select --</option>
              {policies
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required>
              <Input
                type="date"
                value={requestForm.starts_on}
                onChange={(e) => setRequestForm((f) => ({ ...f, starts_on: e.target.value }))}
              />
            </Field>
            <Field label="To" required>
              <Input
                type="date"
                value={requestForm.ends_on}
                onChange={(e) => setRequestForm((f) => ({ ...f, ends_on: e.target.value }))}
              />
            </Field>
          </div>
          {calcDays > 0 && (
            <div
              className="text-[12px] px-1 font-medium"
              style={{ color: "var(--color-viridian-700)" }}
            >
              {calcDays} day{calcDays === 1 ? "" : "s"}
            </div>
          )}
          <Field label="Reason">
            <Textarea
              value={requestForm.reason}
              onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Optional. Helps the approver decide quickly."
            />
          </Field>
        </div>
      </Sheet>

      {/* ============ POLICY SHEET ============ */}
      <Sheet
        open={policySheetOpen}
        onOpenChange={(v) => !savingPolicy && setPolicySheetOpen(v)}
        title={editingPolicyId ? "Edit Leave Policy" : "New Leave Policy"}
        description="Configure leave policy rules for your organization."
        width={480}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPolicySheetOpen(false)} disabled={savingPolicy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={savePolicy} loading={savingPolicy}>
              {editingPolicyId ? "Update" : "Create"} Policy
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code" required>
              <Input
                autoFocus
                value={policyForm.code}
                onChange={(e) => setPolicyForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. CL, SL, EL"
              />
            </Field>
            <Field label="Name" required>
              <Input
                value={policyForm.name}
                onChange={(e) => setPolicyForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Casual Leave"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual quota (days)">
              <Input
                type="number"
                value={policyForm.annual_quota}
                onChange={(e) => setPolicyForm((f) => ({ ...f, annual_quota: e.target.value }))}
                placeholder="12"
              />
            </Field>
            <Field label="Carry forward max">
              <Input
                type="number"
                value={policyForm.carry_forward_max}
                onChange={(e) => setPolicyForm((f) => ({ ...f, carry_forward_max: e.target.value }))}
                placeholder="Leave blank for none"
              />
            </Field>
          </div>
          <Field label="Accrual">
            <Select
              value={policyForm.accrual}
              onChange={(e) => setPolicyForm((f) => ({ ...f, accrual: e.target.value }))}
            >
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </Select>
          </Field>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policyForm.paid}
                onChange={(e) => setPolicyForm((f) => ({ ...f, paid: e.target.checked }))}
                className="size-3.5 rounded"
              />
              <span className="text-[13px]">Paid leave</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policyForm.requires_approval}
                onChange={(e) => setPolicyForm((f) => ({ ...f, requires_approval: e.target.checked }))}
                className="size-3.5 rounded"
              />
              <span className="text-[13px]">Requires approval</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policyForm.active}
                onChange={(e) => setPolicyForm((f) => ({ ...f, active: e.target.checked }))}
                className="size-3.5 rounded"
              />
              <span className="text-[13px]">Active</span>
            </label>
          </div>
        </div>
      </Sheet>

      {/* ============ REJECT DIALOG ============ */}
      {rejectingId && (
        <>
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(15,23,42,0.32)" }}
            onClick={() => setRejectingId(null)}
          />
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-pop)" }}
          >
            <h3 className="text-[15px] font-semibold tracking-tight mb-1">Reject Leave Request</h3>
            <p className="text-[12px] mb-4" style={{ color: "var(--color-ink-secondary)" }}>
              Provide a reason for rejection (optional but recommended).
            </p>
            <Textarea
              autoFocus
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmReject}
                loading={decidingId === rejectingId}
              >
                Reject
              </Button>
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
