"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Pencil,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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

type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  hours_worked: number | null;
  notes: string | null;
};

type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  weekdays: number[];
  is_default: boolean;
};

type ShiftAssignment = {
  id: string;
  employee_id: string;
  shift_id: string;
  effective_from: string | null;
  effective_to: string | null;
};

type Holiday = {
  id: string;
  date: string;
  name: string;
  description: string | null;
  is_optional: boolean;
};

const ATTENDANCE_STATUSES = ["present", "absent", "half_day", "on_leave", "holiday", "weekend"] as const;

const statusColor: Record<string, string> = {
  present: "var(--color-viridian-500)",
  absent: "#ef4444",
  half_day: "#f59e0b",
  on_leave: "#3b82f6",
  holiday: "#9ca3af",
  weekend: "#d1d5db",
};

const statusTone = (s: string) => {
  if (s === "present") return "viridian" as const;
  if (s === "absent") return "danger" as const;
  if (s === "half_day") return "warning" as const;
  if (s === "on_leave") return "info" as const;
  return "neutral" as const;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function calcHours(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return null;
  return Math.round(((b - a) / 3_600_000) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function AttendancePage() {
  const supabase = useMemo(() => createClient(), []);

  /* ---- core state ---- */
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  /* ---- view state ---- */
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  /* ---- edit attendance sheet ---- */
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: "" as string | null,
    employee_id: "",
    employee_name: "",
    date: "",
    check_in: "",
    check_out: "",
    status: "present",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  /* ---- bulk selection ---- */
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("present");
  const [bulkSaving, setBulkSaving] = useState(false);

  /* ---- shift sheet ---- */
  const [shiftSheetOpen, setShiftSheetOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    name: "",
    start_time: "09:00",
    end_time: "18:00",
    break_minutes: "60",
    weekdays: [1, 2, 3, 4, 5] as number[],
    is_default: false,
  });
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [savingShift, setSavingShift] = useState(false);

  /* ---- holiday sheet ---- */
  const [holidaySheetOpen, setHolidaySheetOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: "",
    name: "",
    description: "",
    is_optional: false,
  });
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [savingHoliday, setSavingHoliday] = useState(false);

  /* ---- fetch ---- */
  const fetchBase = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (!profile) return "";
    const oid = profile.org_id;
    setOrgId(oid);

    const [empRes, shiftRes, saRes, holRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, first_name, last_name, employee_code, status")
        .eq("org_id", oid)
        .in("status", ["active", "on_leave"])
        .order("first_name"),
      supabase.from("shifts").select("*").eq("org_id", oid).order("name"),
      supabase.from("shift_assignments").select("*").eq("org_id", oid),
      supabase.from("holidays").select("*").eq("org_id", oid).order("date"),
    ]);

    setEmployees((empRes.data ?? []) as Employee[]);
    setShifts((shiftRes.data ?? []) as Shift[]);
    setShiftAssignments((saRes.data ?? []) as ShiftAssignment[]);
    setHolidays((holRes.data ?? []) as Holiday[]);
    return oid;
  }, [supabase]);

  const fetchAttendance = useCallback(
    async (oid: string, dateFrom: string, dateTo: string) => {
      const { data } = await supabase
        .from("attendance")
        .select("id, employee_id, date, check_in, check_out, status, hours_worked, notes")
        .eq("org_id", oid)
        .gte("date", dateFrom)
        .lte("date", dateTo);
      setAttendance((data ?? []) as AttendanceRow[]);
    },
    [supabase],
  );

  useEffect(() => {
    (async () => {
      const oid = await fetchBase();
      if (!oid) { setLoading(false); return; }
      if (view === "daily") {
        await fetchAttendance(oid, selectedDate, selectedDate);
      } else {
        const from = `${selectedYear}-${pad2(selectedMonth + 1)}-01`;
        const to = `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(daysInMonth(selectedYear, selectedMonth))}`;
        await fetchAttendance(oid, from, to);
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Refetch attendance when view/date changes */
  useEffect(() => {
    if (!orgId) return;
    if (view === "daily") {
      fetchAttendance(orgId, selectedDate, selectedDate);
    } else {
      const from = `${selectedYear}-${pad2(selectedMonth + 1)}-01`;
      const to = `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(daysInMonth(selectedYear, selectedMonth))}`;
      fetchAttendance(orgId, from, to);
    }
  }, [orgId, view, selectedDate, selectedMonth, selectedYear, fetchAttendance]);

  /* ---- helpers ---- */
  function getShiftForEmployee(empId: string): Shift | null {
    const sa = shiftAssignments.find(
      (a) =>
        a.employee_id === empId &&
        (!a.effective_from || a.effective_from <= selectedDate) &&
        (!a.effective_to || a.effective_to >= selectedDate),
    );
    if (sa) return shifts.find((s) => s.id === sa.shift_id) ?? null;
    return shifts.find((s) => s.is_default) ?? null;
  }

  function getAttendanceForEmployee(empId: string, date?: string): AttendanceRow | null {
    const d = date ?? selectedDate;
    return attendance.find((a) => a.employee_id === empId && a.date === d) ?? null;
  }

  /* ---- edit attendance ---- */
  function openEditAttendance(emp: Employee, existing: AttendanceRow | null) {
    const name = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
    setEditForm({
      id: existing?.id ?? null,
      employee_id: emp.id,
      employee_name: name,
      date: existing?.date ?? selectedDate,
      check_in: existing?.check_in ? existing.check_in.slice(11, 16) : "",
      check_out: existing?.check_out ? existing.check_out.slice(11, 16) : "",
      status: existing?.status ?? "present",
      notes: existing?.notes ?? "",
    });
    setEditSheetOpen(true);
  }

  async function saveAttendance() {
    setSaving(true);
    const dateStr = editForm.date;
    const checkIn = editForm.check_in ? `${dateStr}T${editForm.check_in}:00` : null;
    const checkOut = editForm.check_out ? `${dateStr}T${editForm.check_out}:00` : null;
    const hours = calcHours(checkIn, checkOut);

    const row = {
      org_id: orgId,
      employee_id: editForm.employee_id,
      date: dateStr,
      check_in: checkIn,
      check_out: checkOut,
      status: editForm.status,
      hours_worked: hours,
      notes: editForm.notes.trim() || null,
    };

    let error;
    if (editForm.id) {
      const res = await supabase.from("attendance").update(row).eq("id", editForm.id).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("attendance").insert(row);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Attendance saved");
    setEditSheetOpen(false);
    if (view === "daily") {
      fetchAttendance(orgId, selectedDate, selectedDate);
    } else {
      const from = `${selectedYear}-${pad2(selectedMonth + 1)}-01`;
      const to = `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(daysInMonth(selectedYear, selectedMonth))}`;
      fetchAttendance(orgId, from, to);
    }
  }

  /* ---- bulk actions ---- */
  function toggleBulkSelect(empId: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (bulkSelected.size === employees.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(employees.map((e) => e.id)));
    }
  }

  async function applyBulkStatus() {
    if (bulkSelected.size === 0) {
      toast.error("Select at least one employee");
      return;
    }
    setBulkSaving(true);
    const empIds = Array.from(bulkSelected);
    const existingMap = new Map(
      attendance.filter((a) => a.date === selectedDate).map((a) => [a.employee_id, a]),
    );

    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

    for (const empId of empIds) {
      const existing = existingMap.get(empId);
      const row = {
        org_id: orgId,
        employee_id: empId,
        date: selectedDate,
        status: bulkStatus,
        check_in: null,
        check_out: null,
        hours_worked: null,
        notes: null,
      };
      if (existing) {
        toUpdate.push({ id: existing.id, data: { status: bulkStatus } });
      } else {
        toInsert.push(row);
      }
    }

    let hasError = false;
    if (toInsert.length > 0) {
      const { error } = await supabase.from("attendance").insert(toInsert);
      if (error) { toast.error(error.message); hasError = true; }
    }
    for (const u of toUpdate) {
      const { error } = await supabase.from("attendance").update(u.data).eq("id", u.id).eq("org_id", orgId);
      if (error) { toast.error(error.message); hasError = true; break; }
    }

    setBulkSaving(false);
    if (!hasError) {
      toast.success(`Marked ${empIds.length} employee(s) as ${bulkStatus}`);
      setBulkSelected(new Set());
      fetchAttendance(orgId, selectedDate, selectedDate);
    }
  }

  async function markAllPresent() {
    setBulkSaving(true);
    const existingMap = new Map(
      attendance.filter((a) => a.date === selectedDate).map((a) => [a.employee_id, a]),
    );
    const toInsert: Record<string, unknown>[] = [];

    for (const emp of employees) {
      if (!existingMap.has(emp.id)) {
        toInsert.push({
          org_id: orgId,
          employee_id: emp.id,
          date: selectedDate,
          status: "present",
          check_in: null,
          check_out: null,
          hours_worked: null,
          notes: null,
        });
      }
    }

    if (toInsert.length === 0) {
      toast.info("All employees already have attendance for today");
      setBulkSaving(false);
      return;
    }

    const { error } = await supabase.from("attendance").insert(toInsert);
    setBulkSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked ${toInsert.length} employee(s) as present`);
    fetchAttendance(orgId, selectedDate, selectedDate);
  }

  /* ---- shift CRUD ---- */
  function openCreateShift() {
    setEditingShiftId(null);
    setShiftForm({ name: "", start_time: "09:00", end_time: "18:00", break_minutes: "60", weekdays: [1, 2, 3, 4, 5], is_default: false });
    setShiftSheetOpen(true);
  }

  function openEditShift(s: Shift) {
    setEditingShiftId(s.id);
    setShiftForm({
      name: s.name,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      break_minutes: String(s.break_minutes),
      weekdays: s.weekdays ?? [1, 2, 3, 4, 5],
      is_default: s.is_default,
    });
    setShiftSheetOpen(true);
  }

  async function saveShift() {
    if (!shiftForm.name.trim()) {
      toast.error("Shift name is required");
      return;
    }
    setSavingShift(true);
    const row = {
      org_id: orgId,
      name: shiftForm.name.trim(),
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      break_minutes: parseInt(shiftForm.break_minutes) || 0,
      weekdays: shiftForm.weekdays,
      is_default: shiftForm.is_default,
    };
    let error;
    if (editingShiftId) {
      const res = await supabase.from("shifts").update(row).eq("id", editingShiftId).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("shifts").insert(row);
      error = res.error;
    }
    setSavingShift(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingShiftId ? "Shift updated" : "Shift created");
    setShiftSheetOpen(false);
    const { data } = await supabase.from("shifts").select("*").eq("org_id", orgId).order("name");
    setShifts((data ?? []) as Shift[]);
  }

  async function deleteShift(s: Shift) {
    if (!confirm(`Delete shift "${s.name}"?`)) return;
    const { error } = await supabase.from("shifts").delete().eq("id", s.id).eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Shift deleted");
    const { data } = await supabase.from("shifts").select("*").eq("org_id", orgId).order("name");
    setShifts((data ?? []) as Shift[]);
  }

  /* ---- holiday CRUD ---- */
  function openCreateHoliday() {
    setEditingHolidayId(null);
    setHolidayForm({ date: "", name: "", description: "", is_optional: false });
    setHolidaySheetOpen(true);
  }

  function openEditHoliday(h: Holiday) {
    setEditingHolidayId(h.id);
    setHolidayForm({
      date: h.date,
      name: h.name,
      description: h.description ?? "",
      is_optional: h.is_optional,
    });
    setHolidaySheetOpen(true);
  }

  async function saveHoliday() {
    if (!holidayForm.name.trim() || !holidayForm.date) {
      toast.error("Date and name are required");
      return;
    }
    setSavingHoliday(true);
    const row = {
      org_id: orgId,
      date: holidayForm.date,
      name: holidayForm.name.trim(),
      description: holidayForm.description.trim() || null,
      is_optional: holidayForm.is_optional,
    };
    let error;
    if (editingHolidayId) {
      const res = await supabase.from("holidays").update(row).eq("id", editingHolidayId).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("holidays").insert(row);
      error = res.error;
    }
    setSavingHoliday(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingHolidayId ? "Holiday updated" : "Holiday added");
    setHolidaySheetOpen(false);
    const { data } = await supabase.from("holidays").select("*").eq("org_id", orgId).order("date");
    setHolidays((data ?? []) as Holiday[]);
  }

  async function deleteHoliday(h: Holiday) {
    if (!confirm(`Delete holiday "${h.name}"?`)) return;
    const { error } = await supabase.from("holidays").delete().eq("id", h.id).eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Holiday deleted");
    const { data } = await supabase.from("holidays").select("*").eq("org_id", orgId).order("date");
    setHolidays((data ?? []) as Holiday[]);
  }

  /* ---- monthly view helpers ---- */
  const monthDays = useMemo(() => daysInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const monthDates = useMemo(
    () => Array.from({ length: monthDays }, (_, i) => `${selectedYear}-${pad2(selectedMonth + 1)}-${pad2(i + 1)}`),
    [selectedYear, selectedMonth, monthDays],
  );

  function getMonthSummary(empId: string) {
    const empAttendance = attendance.filter((a) => a.employee_id === empId);
    let present = 0,
      absent = 0,
      leaves = 0,
      totalHours = 0;
    for (const a of empAttendance) {
      if (a.status === "present") present++;
      else if (a.status === "absent") absent++;
      else if (a.status === "on_leave") leaves++;
      if (a.hours_worked) totalHours += a.hours_worked;
    }
    return { present, absent, leaves, totalHours: Math.round(totalHours * 10) / 10 };
  }

  /* ---- navigation ---- */
  function prevDate() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toDateStr(d));
  }
  function nextDate() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(toDateStr(d));
  }
  function prevMonth() {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  }
  function nextMonth() {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /* ---- loading skeleton ---- */
  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Attendance" />
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

  /* ---------------------------------------------------------------- */
  /*  RENDER                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <PageContainer>
      <PageHeader
        title="Attendance"
        description={`${employees.length} active employees`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openCreateShift}>
              <Settings2 className="size-3.5 mr-1.5" />
              Shifts
            </Button>
            <Button variant="secondary" size="sm" onClick={openCreateHoliday}>
              <CalendarPlus className="size-3.5 mr-1.5" />
              Holidays
            </Button>
          </div>
        }
      />

      {/* View Tabs */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ background: "var(--color-surface-muted)" }}
        >
          {(["daily", "monthly"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors capitalize"
              style={{
                background: view === v ? "var(--color-surface)" : "transparent",
                color: view === v ? "var(--color-ink)" : "var(--color-ink-tertiary)",
                boxShadow: view === v ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {v} View
            </button>
          ))}
        </div>

        {view === "daily" ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevDate}>
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="!w-auto"
            />
            <Button variant="ghost" size="sm" onClick={nextDate}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-[13px] font-medium min-w-[140px] text-center">
              {monthNames[selectedMonth]} {selectedYear}
            </span>
            <Button variant="ghost" size="sm" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ============ DAILY VIEW ============ */}
      {view === "daily" && (
        <>
          {/* Bulk Actions */}
          <div
            className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bulkSelected.size === employees.length && employees.length > 0}
                onChange={toggleSelectAll}
                className="size-3.5 rounded"
              />
              <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                {bulkSelected.size > 0 ? `${bulkSelected.size} selected` : "Select all"}
              </span>
            </div>
            {bulkSelected.size > 0 && (
              <>
                <Select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="!w-auto min-w-[120px]"
                >
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </Select>
                <Button variant="primary" size="sm" onClick={applyBulkStatus} loading={bulkSaving}>
                  Apply
                </Button>
              </>
            )}
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={markAllPresent} loading={bulkSaving}>
              <CheckCircle2 className="size-3.5 mr-1.5" />
              Mark All Present
            </Button>
          </div>

          {/* Daily Table */}
          <div className="card overflow-hidden">
            {employees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th className="px-4 py-2.5 text-left w-8">
                        <span className="sr-only">Select</span>
                      </th>
                      {["Employee", "Shift", "Check In", "Check Out", "Hours", "Status", "Notes", "Actions"].map((h) => (
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
                    {employees.map((emp) => {
                      const att = getAttendanceForEmployee(emp.id);
                      const shift = getShiftForEmployee(emp.id);
                      const name = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-[var(--color-surface-hover)] transition-colors"
                          style={{ borderBottom: "1px solid var(--color-border)" }}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={bulkSelected.has(emp.id)}
                              onChange={() => toggleBulkSelect(emp.id)}
                              className="size-3.5 rounded"
                            />
                          </td>
                          <td className="px-4 py-3 text-[13px]">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name} size="sm" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                {emp.employee_code && (
                                  <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                                    {emp.employee_code}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--color-ink-secondary)" }}>
                            {shift ? `${shift.name} (${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)})` : "—"}
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                            {att?.check_in ? new Date(att.check_in).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                            {att?.check_out ? new Date(att.check_out).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                            {att?.hours_worked != null ? `${att.hours_worked}h` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {att ? (
                              <Badge tone={statusTone(att.status)}>
                                {att.status.replace("_", " ")}
                              </Badge>
                            ) : (
                              <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                                Not marked
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[12px] max-w-[120px] truncate" style={{ color: "var(--color-ink-tertiary)" }}>
                            {att?.notes ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" onClick={() => openEditAttendance(emp, att)}>
                              <Pencil className="size-3.5" />
                            </Button>
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
                  <Users className="size-5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">No active employees</h3>
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                  Add employees first, then you can track their attendance.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============ MONTHLY VIEW ============ */}
      {view === "monthly" && (
        <div className="card overflow-hidden">
          {employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <th
                      className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider sticky left-0"
                      style={{ color: "var(--color-ink-tertiary)", background: "var(--color-surface)", minWidth: 160 }}
                    >
                      Employee
                    </th>
                    {monthDates.map((d, i) => {
                      const dayOfWeek = new Date(d).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      return (
                        <th
                          key={d}
                          className="px-0.5 py-2.5 text-center text-[10px] font-medium"
                          style={{
                            color: isWeekend ? "var(--color-ink-tertiary)" : "var(--color-ink-secondary)",
                            minWidth: 28,
                          }}
                        >
                          <div>{i + 1}</div>
                          <div className="text-[9px]" style={{ color: "var(--color-ink-tertiary)" }}>
                            {WEEKDAY_NAMES[dayOfWeek]}
                          </div>
                        </th>
                      );
                    })}
                    {["P", "A", "L", "Hrs"].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-2.5 text-center text-[10px] font-medium uppercase"
                        style={{ color: "var(--color-ink-tertiary)", minWidth: 36 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const name = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
                    const summary = getMonthSummary(emp.id);
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <td
                          className="px-3 py-2 text-[12px] sticky left-0"
                          style={{ background: "var(--color-surface)" }}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={name} size="sm" />
                            <span className="font-medium truncate max-w-[100px]">{name}</span>
                          </div>
                        </td>
                        {monthDates.map((d) => {
                          const att = attendance.find((a) => a.employee_id === emp.id && a.date === d);
                          const holiday = holidays.find((h) => h.date === d);
                          const dayOfWeek = new Date(d).getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const displayStatus = att?.status ?? (holiday ? "holiday" : isWeekend ? "weekend" : null);
                          return (
                            <td key={d} className="px-0.5 py-2 text-center">
                              {displayStatus ? (
                                <span
                                  className="inline-block size-3 rounded-full"
                                  style={{ background: statusColor[displayStatus] ?? "#d1d5db" }}
                                  title={`${d}: ${displayStatus}`}
                                />
                              ) : (
                                <span
                                  className="inline-block size-3 rounded-full"
                                  style={{ background: "var(--color-border)" }}
                                  title={`${d}: not marked`}
                                />
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center text-[12px] font-medium" style={{ color: "var(--color-viridian-700)" }}>
                          {summary.present}
                        </td>
                        <td className="px-2 py-2 text-center text-[12px] font-medium" style={{ color: "#ef4444" }}>
                          {summary.absent}
                        </td>
                        <td className="px-2 py-2 text-center text-[12px] font-medium" style={{ color: "#3b82f6" }}>
                          {summary.leaves}
                        </td>
                        <td className="px-2 py-2 text-center text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                          {summary.totalHours}
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
              <h3 className="text-[15px] font-semibold tracking-tight">No data yet</h3>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                Add employees and start tracking attendance to see the monthly grid.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Monthly legend */}
      {view === "monthly" && employees.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 px-1">
          {Object.entries(statusColor).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
              <span className="text-[11px] capitalize" style={{ color: "var(--color-ink-tertiary)" }}>
                {status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ============ EDIT ATTENDANCE SHEET ============ */}
      <Sheet
        open={editSheetOpen}
        onOpenChange={(v) => !saving && setEditSheetOpen(v)}
        title={editForm.id ? "Edit Attendance" : "Mark Attendance"}
        description={editForm.employee_name}
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveAttendance} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Employee">
            <Input value={editForm.employee_name} disabled />
          </Field>
          <Field label="Date">
            <Input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check in">
              <Input
                type="time"
                value={editForm.check_in}
                onChange={(e) => setEditForm((f) => ({ ...f, check_in: e.target.value }))}
              />
            </Field>
            <Field label="Check out">
              <Input
                type="time"
                value={editForm.check_out}
                onChange={(e) => setEditForm((f) => ({ ...f, check_out: e.target.value }))}
              />
            </Field>
          </div>
          {editForm.check_in && editForm.check_out && (
            <div className="text-[12px] px-1" style={{ color: "var(--color-ink-secondary)" }}>
              Calculated hours:{" "}
              <strong>
                {calcHours(
                  `${editForm.date}T${editForm.check_in}:00`,
                  `${editForm.date}T${editForm.check_out}:00`,
                )?.toFixed(2) ?? "—"}
                h
              </strong>
            </div>
          )}
          <Field label="Status">
            <Select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
            >
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes..."
            />
          </Field>
        </div>
      </Sheet>

      {/* ============ SHIFT SHEET ============ */}
      <Sheet
        open={shiftSheetOpen}
        onOpenChange={(v) => !savingShift && setShiftSheetOpen(v)}
        title="Shifts"
        description="Manage work shifts for your organization."
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShiftSheetOpen(false)} disabled={savingShift}>
              Close
            </Button>
            <Button variant="primary" onClick={saveShift} loading={savingShift}>
              {editingShiftId ? "Update" : "Add"} Shift
            </Button>
          </>
        }
      >
        <div className="space-y-3 mb-5">
          <Field label="Shift name" required>
            <Input
              autoFocus
              value={shiftForm.name}
              onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Morning Shift"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <Input
                type="time"
                value={shiftForm.start_time}
                onChange={(e) => setShiftForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </Field>
            <Field label="End time">
              <Input
                type="time"
                value={shiftForm.end_time}
                onChange={(e) => setShiftForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Break (minutes)">
            <Input
              type="number"
              value={shiftForm.break_minutes}
              onChange={(e) => setShiftForm((f) => ({ ...f, break_minutes: e.target.value }))}
            />
          </Field>
          <Field label="Weekdays">
            <div className="flex gap-1.5 mt-1">
              {WEEKDAY_NAMES.map((name, i) => {
                const active = shiftForm.weekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setShiftForm((f) => ({
                        ...f,
                        weekdays: active ? f.weekdays.filter((d) => d !== i) : [...f.weekdays, i],
                      }))
                    }
                    className="size-8 rounded-lg text-[11px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--color-viridian-500)" : "var(--color-surface-muted)",
                      color: active ? "white" : "var(--color-ink-secondary)",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={shiftForm.is_default}
              onChange={(e) => setShiftForm((f) => ({ ...f, is_default: e.target.checked }))}
              className="size-3.5 rounded"
            />
            <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              Default shift (auto-assigned)
            </span>
          </label>
          {editingShiftId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingShiftId(null);
                setShiftForm({ name: "", start_time: "09:00", end_time: "18:00", break_minutes: "60", weekdays: [1, 2, 3, 4, 5], is_default: false });
              }}
            >
              Clear form (add new instead)
            </Button>
          )}
        </div>

        <div
          className="text-[12px] font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          Existing Shifts ({shifts.length})
        </div>
        {shifts.length > 0 ? (
          <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", borderColor: "var(--color-border)" }}>
            {shifts.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">
                    {s.name}
                    {s.is_default && (
                      <Badge tone="viridian" className="ml-2">default</Badge>
                    )}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                    {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)} | {s.break_minutes}min break |{" "}
                    {(s.weekdays ?? []).map((d) => WEEKDAY_NAMES[d]).join(", ")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditShift(s)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteShift(s)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--color-ink-tertiary)" }}>
            No shifts defined yet. Add one above.
          </p>
        )}
      </Sheet>

      {/* ============ HOLIDAY SHEET ============ */}
      <Sheet
        open={holidaySheetOpen}
        onOpenChange={(v) => !savingHoliday && setHolidaySheetOpen(v)}
        title="Holidays"
        description="Manage organization-wide holidays."
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setHolidaySheetOpen(false)} disabled={savingHoliday}>
              Close
            </Button>
            <Button variant="primary" onClick={saveHoliday} loading={savingHoliday}>
              {editingHolidayId ? "Update" : "Add"} Holiday
            </Button>
          </>
        }
      >
        <div className="space-y-3 mb-5">
          <Field label="Date" required>
            <Input
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="Holiday name" required>
            <Input
              value={holidayForm.name}
              onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Diwali"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={holidayForm.description}
              onChange={(e) => setHolidayForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description..."
            />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={holidayForm.is_optional}
              onChange={(e) => setHolidayForm((f) => ({ ...f, is_optional: e.target.checked }))}
              className="size-3.5 rounded"
            />
            <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
              Optional holiday (employees can choose to work)
            </span>
          </label>
          {editingHolidayId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingHolidayId(null);
                setHolidayForm({ date: "", name: "", description: "", is_optional: false });
              }}
            >
              Clear form (add new instead)
            </Button>
          )}
        </div>

        <div
          className="text-[12px] font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          Holidays ({holidays.length})
        </div>
        {holidays.length > 0 ? (
          <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", borderColor: "var(--color-border)" }}>
            {holidays.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">
                    {h.name}
                    {h.is_optional && (
                      <Badge tone="neutral" className="ml-2">optional</Badge>
                    )}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                    {h.date}
                    {h.description ? ` — ${h.description}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditHoliday(h)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteHoliday(h)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--color-ink-tertiary)" }}>
            No holidays defined yet. Add one above.
          </p>
        )}
      </Sheet>
    </PageContainer>
  );
}
