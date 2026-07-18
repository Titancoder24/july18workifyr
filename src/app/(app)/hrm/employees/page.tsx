"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  UserMinus,
  Clock,
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Briefcase,
  ChevronDown,
  X,
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

type Department = { id: string; name: string; parent_id: string | null };
type Designation = { id: string; title: string; level: string | null };

type Employee = {
  id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  personal_email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  blood_group: string | null;
  joined_on: string | null;
  exited_on: string | null;
  employment_type: string;
  status: string;
  department_id: string | null;
  designation_id: string | null;
  manager_id: string | null;
  work_location: string | null;
  address: Record<string, string> | null;
  emergency_contact: Record<string, string> | null;
  bank_details: Record<string, string> | null;
  pan_number: string | null;
  tax_id: string | null;
  avatar_url: string | null;
  department: { name: string } | { name: string }[] | null;
  designation: { title: string } | { title: string }[] | null;
  manager: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null;
};

type FormData = {
  first_name: string;
  last_name: string;
  employee_code: string;
  email: string;
  phone: string;
  department_id: string;
  designation_id: string;
  manager_id: string;
  employment_type: string;
  status: string;
  joined_on: string;
  date_of_birth: string;
  gender: string;
  marital_status: string;
  blood_group: string;
  personal_email: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: string;
  bank_name: string;
  account_number: string;
  ifsc: string;
  pan_number: string;
  tax_id: string;
  emergency_name: string;
  emergency_relationship: string;
  emergency_phone: string;
};

const emptyForm: FormData = {
  first_name: "",
  last_name: "",
  employee_code: "",
  email: "",
  phone: "",
  department_id: "",
  designation_id: "",
  manager_id: "",
  employment_type: "full_time",
  status: "active",
  joined_on: "",
  date_of_birth: "",
  gender: "",
  marital_status: "",
  blood_group: "",
  personal_email: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  address_country: "",
  bank_name: "",
  account_number: "",
  ifsc: "",
  pan_number: "",
  tax_id: "",
  emergency_name: "",
  emergency_relationship: "",
  emergency_phone: "",
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const employmentTypeLabels: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};

const statusTone = (s: string) => {
  if (s === "active") return "viridian" as const;
  if (s === "on_leave") return "warning" as const;
  if (s === "exited") return "neutral" as const;
  return "neutral" as const;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function EmployeesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  /* ---- state ---- */
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [orgId, setOrgId] = useState<string>("");

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [formTab, setFormTab] = useState<"basic" | "personal" | "bank" | "emergency">("basic");
  const [saving, setSaving] = useState(false);

  const [deptSheetOpen, setDeptSheetOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", parent_id: "" });
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [savingDept, setSavingDept] = useState(false);

  const [desigSheetOpen, setDesigSheetOpen] = useState(false);
  const [desigForm, setDesigForm] = useState({ title: "", level: "" });
  const [editingDesigId, setEditingDesigId] = useState<string | null>(null);
  const [savingDesig, setSavingDesig] = useState(false);

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

    const [empRes, deptRes, desigRes] = await Promise.all([
      supabase
        .from("employees")
        .select(`
          id, employee_code, first_name, last_name, email, personal_email, phone,
          date_of_birth, gender, marital_status, blood_group,
          joined_on, exited_on, employment_type, status,
          department_id, designation_id, manager_id, work_location,
          address, emergency_contact, bank_details, pan_number, tax_id, avatar_url,
          department:departments(name),
          designation:designations(title),
          manager:employees!employees_manager_id_fkey(first_name, last_name)
        `)
        .eq("org_id", oid)
        .order("first_name", { ascending: true })
        .limit(500),
      supabase
        .from("departments")
        .select("id, name, parent_id")
        .eq("org_id", oid)
        .order("name"),
      supabase
        .from("designations")
        .select("id, title, level")
        .eq("org_id", oid)
        .order("title"),
    ]);

    setEmployees((empRes.data ?? []) as Employee[]);
    setDepartments((deptRes.data ?? []) as Department[]);
    setDesignations((desigRes.data ?? []) as Designation[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- derived stats ---- */
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === "active").length;
    const onLeave = employees.filter((e) => e.status === "on_leave").length;
    const exited = employees.filter((e) => e.status === "exited").length;
    return { total, active, onLeave, exited };
  }, [employees]);

  /* ---- filtered ---- */
  const filtered = useMemo(() => {
    let list = employees;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => {
        const name = `${e.first_name} ${e.last_name ?? ""}`.toLowerCase();
        return (
          name.includes(q) ||
          (e.email ?? "").toLowerCase().includes(q) ||
          (e.employee_code ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (filterDept) list = list.filter((e) => e.department_id === filterDept);
    if (filterStatus) list = list.filter((e) => e.status === filterStatus);
    if (filterType) list = list.filter((e) => e.employment_type === filterType);
    return list;
  }, [employees, search, filterDept, filterStatus, filterType]);

  /* ---- form helpers ---- */
  const setField = (key: keyof FormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormTab("basic");
    setSheetOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id);
    const addr = emp.address ?? {};
    const bank = emp.bank_details ?? {};
    const ec = emp.emergency_contact ?? {};
    setForm({
      first_name: emp.first_name,
      last_name: emp.last_name ?? "",
      employee_code: emp.employee_code ?? "",
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      department_id: emp.department_id ?? "",
      designation_id: emp.designation_id ?? "",
      manager_id: emp.manager_id ?? "",
      employment_type: emp.employment_type,
      status: emp.status,
      joined_on: emp.joined_on ?? "",
      date_of_birth: emp.date_of_birth ?? "",
      gender: emp.gender ?? "",
      marital_status: emp.marital_status ?? "",
      blood_group: emp.blood_group ?? "",
      personal_email: emp.personal_email ?? "",
      address_street: addr.street ?? "",
      address_city: addr.city ?? "",
      address_state: addr.state ?? "",
      address_zip: addr.zip ?? "",
      address_country: addr.country ?? "",
      bank_name: bank.bank_name ?? "",
      account_number: bank.account_number ?? "",
      ifsc: bank.ifsc ?? "",
      pan_number: emp.pan_number ?? "",
      tax_id: emp.tax_id ?? "",
      emergency_name: ec.name ?? "",
      emergency_relationship: ec.relationship ?? "",
      emergency_phone: ec.phone ?? "",
    });
    setFormTab("basic");
    setSheetOpen(true);
  }

  async function saveEmployee() {
    if (!form.first_name.trim()) {
      toast.error("First name is required");
      return;
    }
    setSaving(true);
    const row: Record<string, unknown> = {
      org_id: orgId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      employee_code: form.employee_code.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department_id: form.department_id || null,
      designation_id: form.designation_id || null,
      manager_id: form.manager_id || null,
      employment_type: form.employment_type,
      status: form.status,
      joined_on: form.joined_on || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      marital_status: form.marital_status || null,
      blood_group: form.blood_group || null,
      personal_email: form.personal_email.trim() || null,
      pan_number: form.pan_number.trim() || null,
      tax_id: form.tax_id.trim() || null,
      address:
        form.address_street || form.address_city
          ? {
              street: form.address_street,
              city: form.address_city,
              state: form.address_state,
              zip: form.address_zip,
              country: form.address_country,
            }
          : null,
      bank_details:
        form.bank_name || form.account_number
          ? {
              bank_name: form.bank_name,
              account_number: form.account_number,
              ifsc: form.ifsc,
            }
          : null,
      emergency_contact:
        form.emergency_name || form.emergency_phone
          ? {
              name: form.emergency_name,
              relationship: form.emergency_relationship,
              phone: form.emergency_phone,
            }
          : null,
    };

    let error;
    if (editingId) {
      const res = await supabase
        .from("employees")
        .update(row)
        .eq("id", editingId)
        .eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("employees").insert(row);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Employee updated" : "Employee added");
    setSheetOpen(false);
    fetchData();
  }

  async function softDelete(emp: Employee) {
    const name = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
    if (!confirm(`Mark "${name}" as exited? This is a soft delete.`)) return;
    const { error } = await supabase
      .from("employees")
      .update({ status: "exited", exited_on: new Date().toISOString().slice(0, 10) })
      .eq("id", emp.id)
      .eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${name} marked as exited`);
    fetchData();
  }

  /* ---- dept CRUD ---- */
  function openCreateDept() {
    setEditingDeptId(null);
    setDeptForm({ name: "", parent_id: "" });
    setDeptSheetOpen(true);
  }
  function openEditDept(d: Department) {
    setEditingDeptId(d.id);
    setDeptForm({ name: d.name, parent_id: d.parent_id ?? "" });
    setDeptSheetOpen(true);
  }
  async function saveDept() {
    if (!deptForm.name.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSavingDept(true);
    const row = {
      org_id: orgId,
      name: deptForm.name.trim(),
      parent_id: deptForm.parent_id || null,
    };
    let error;
    if (editingDeptId) {
      const res = await supabase.from("departments").update(row).eq("id", editingDeptId).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("departments").insert(row);
      error = res.error;
    }
    setSavingDept(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingDeptId ? "Department updated" : "Department created");
    setDeptSheetOpen(false);
    fetchData();
  }
  async function deleteDept(d: Department) {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", d.id).eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Department deleted");
    fetchData();
  }

  /* ---- designation CRUD ---- */
  function openCreateDesig() {
    setEditingDesigId(null);
    setDesigForm({ title: "", level: "" });
    setDesigSheetOpen(true);
  }
  function openEditDesig(d: Designation) {
    setEditingDesigId(d.id);
    setDesigForm({ title: d.title, level: d.level ?? "" });
    setDesigSheetOpen(true);
  }
  async function saveDesig() {
    if (!desigForm.title.trim()) {
      toast.error("Designation title is required");
      return;
    }
    setSavingDesig(true);
    const row = {
      org_id: orgId,
      title: desigForm.title.trim(),
      level: desigForm.level.trim() || null,
    };
    let error;
    if (editingDesigId) {
      const res = await supabase.from("designations").update(row).eq("id", editingDesigId).eq("org_id", orgId);
      error = res.error;
    } else {
      const res = await supabase.from("designations").insert(row);
      error = res.error;
    }
    setSavingDesig(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingDesigId ? "Designation updated" : "Designation created");
    setDesigSheetOpen(false);
    fetchData();
  }
  async function deleteDesig(d: Designation) {
    if (!confirm(`Delete designation "${d.title}"?`)) return;
    const { error } = await supabase.from("designations").delete().eq("id", d.id).eq("org_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Designation deleted");
    fetchData();
  }

  /* ---- skeletons ---- */
  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Employees" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="h-4 w-16 rounded" style={{ background: "var(--color-surface-muted)" }} />
              <div className="h-7 w-12 rounded mt-2" style={{ background: "var(--color-surface-muted)" }} />
            </div>
          ))}
        </div>
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

  /* ---- render ---- */
  const formTabs = [
    { key: "basic" as const, label: "Basic" },
    { key: "personal" as const, label: "Personal" },
    { key: "bank" as const, label: "Bank & Tax" },
    { key: "emergency" as const, label: "Emergency" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Employees"
        description={`${stats.total} on the roster`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeptSheetOpen(true)}>
              <Building2 className="size-3.5 mr-1.5" />
              Departments
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDesigSheetOpen(true)}>
              <Briefcase className="size-3.5 mr-1.5" />
              Designations
            </Button>
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openCreate}>
              Add Employee
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "var(--color-ink)" },
          { label: "Active", value: stats.active, icon: UserCheck, color: "var(--color-viridian-700)" },
          { label: "On Leave", value: stats.onLeave, icon: Clock, color: "var(--color-ink-secondary)" },
          { label: "Exited", value: stats.exited, icon: UserMinus, color: "var(--color-ink-tertiary)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>
                {s.label}
              </span>
              <s.icon className="size-4" style={{ color: s.color }} />
            </div>
            <div className="text-[22px] font-semibold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 h-9 rounded-lg flex-1 min-w-[200px] max-w-md"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Search className="size-3.5 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or code..."
            className="bg-transparent flex-1 text-[13px] outline-none"
            style={{ color: "var(--color-ink)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
            </button>
          )}
        </div>
        <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="!w-auto min-w-[140px]">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="!w-auto min-w-[120px]">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="exited">Exited</option>
        </Select>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="!w-auto min-w-[130px]">
          <option value="">All Types</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </Select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Employee", "Department", "Designation", "Email", "Phone", "Status", "Joined", "Actions"].map((h) => (
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
                {filtered.map((emp) => {
                  const fullName = `${emp.first_name} ${emp.last_name ?? ""}`.trim();
                  const dept = flatten(emp.department);
                  const desig = flatten(emp.designation);
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[var(--color-surface-hover)] transition-colors"
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      <td className="px-4 py-3 text-[13px]">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={fullName} src={emp.avatar_url} size="md" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{fullName}</div>
                            {emp.employee_code && (
                              <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                                {emp.employee_code}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {dept?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {desig?.title ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {emp.email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--color-ink-secondary)" }}>
                        {emp.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(emp.status)}>
                          {emp.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[13px] whitespace-nowrap" style={{ color: "var(--color-ink-secondary)" }}>
                        {emp.joined_on ? formatDate(emp.joined_on) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          {emp.status !== "exited" && (
                            <Button variant="ghost" size="sm" onClick={() => softDelete(emp)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
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
            <h3 className="text-[15px] font-semibold tracking-tight">
              {employees.length === 0 ? "No employees yet" : "No employees match your filters"}
            </h3>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
              {employees.length === 0
                ? "Add your first employee to start building your team directory."
                : "Try adjusting your search or filter criteria."}
            </p>
          </div>
        )}
      </div>

      {/* Employee Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => !saving && setSheetOpen(v)}
        title={editingId ? "Edit Employee" : "Add Employee"}
        description={editingId ? "Update employee information." : "Add a new employee to your organization."}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveEmployee} loading={saving}>
              {editingId ? "Update" : "Save"}
            </Button>
          </>
        }
      >
        {/* Tabs */}
        <div
          className="flex gap-1 mb-5 p-1 rounded-lg"
          style={{ background: "var(--color-surface-muted)" }}
        >
          {formTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFormTab(t.key)}
              className="flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors"
              style={{
                background: formTab === t.key ? "var(--color-surface)" : "transparent",
                color: formTab === t.key ? "var(--color-ink)" : "var(--color-ink-tertiary)",
                boxShadow: formTab === t.key ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {formTab === "basic" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" required>
                  <Input
                    autoFocus
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                  />
                </Field>
                <Field label="Last name">
                  <Input value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employee code">
                  <Input
                    value={form.employee_code}
                    onChange={(e) => setField("employee_code", e.target.value)}
                    placeholder="EMP-001"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <Select value={form.department_id} onChange={(e) => setField("department_id", e.target.value)}>
                    <option value="">-- Select --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation">
                  <Select value={form.designation_id} onChange={(e) => setField("designation_id", e.target.value)}>
                    <option value="">-- Select --</option>
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>{d.title}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Manager">
                <Select value={form.manager_id} onChange={(e) => setField("manager_id", e.target.value)}>
                  <option value="">-- None --</option>
                  {employees
                    .filter((e) => e.id !== editingId && e.status === "active")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.first_name} {e.last_name ?? ""}
                      </option>
                    ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employment type">
                  <Select value={form.employment_type} onChange={(e) => setField("employment_type", e.target.value)}>
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="exited">Exited</option>
                  </Select>
                </Field>
              </div>
              <Field label="Joined on">
                <Input
                  type="date"
                  value={form.joined_on}
                  onChange={(e) => setField("joined_on", e.target.value)}
                />
              </Field>
            </>
          )}

          {formTab === "personal" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                  />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
                    <option value="">-- Select --</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marital status">
                  <Select value={form.marital_status} onChange={(e) => setField("marital_status", e.target.value)}>
                    <option value="">-- Select --</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </Select>
                </Field>
                <Field label="Blood group">
                  <Select value={form.blood_group} onChange={(e) => setField("blood_group", e.target.value)}>
                    <option value="">-- Select --</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Personal email">
                <Input
                  type="email"
                  value={form.personal_email}
                  onChange={(e) => setField("personal_email", e.target.value)}
                />
              </Field>
              <div
                className="text-[12px] font-medium uppercase tracking-wider pt-3"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                Address
              </div>
              <Field label="Street">
                <Input value={form.address_street} onChange={(e) => setField("address_street", e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <Input value={form.address_city} onChange={(e) => setField("address_city", e.target.value)} />
                </Field>
                <Field label="State">
                  <Input value={form.address_state} onChange={(e) => setField("address_state", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ZIP / Postal code">
                  <Input value={form.address_zip} onChange={(e) => setField("address_zip", e.target.value)} />
                </Field>
                <Field label="Country">
                  <Input value={form.address_country} onChange={(e) => setField("address_country", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {formTab === "bank" && (
            <>
              <Field label="Bank name">
                <Input value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} />
              </Field>
              <Field label="Account number">
                <Input value={form.account_number} onChange={(e) => setField("account_number", e.target.value)} />
              </Field>
              <Field label="IFSC code">
                <Input value={form.ifsc} onChange={(e) => setField("ifsc", e.target.value)} />
              </Field>
              <div
                className="text-[12px] font-medium uppercase tracking-wider pt-3"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                Tax Information
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="PAN number">
                  <Input value={form.pan_number} onChange={(e) => setField("pan_number", e.target.value)} />
                </Field>
                <Field label="Tax ID">
                  <Input value={form.tax_id} onChange={(e) => setField("tax_id", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {formTab === "emergency" && (
            <>
              <Field label="Contact name">
                <Input value={form.emergency_name} onChange={(e) => setField("emergency_name", e.target.value)} />
              </Field>
              <Field label="Relationship">
                <Select
                  value={form.emergency_relationship}
                  onChange={(e) => setField("emergency_relationship", e.target.value)}
                >
                  <option value="">-- Select --</option>
                  {["Parent", "Spouse", "Sibling", "Child", "Friend", "Other"].map((r) => (
                    <option key={r} value={r.toLowerCase()}>{r}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone">
                <Input value={form.emergency_phone} onChange={(e) => setField("emergency_phone", e.target.value)} />
              </Field>
            </>
          )}
        </div>
      </Sheet>

      {/* Department Sheet */}
      <Sheet
        open={deptSheetOpen}
        onOpenChange={(v) => !savingDept && setDeptSheetOpen(v)}
        title="Departments"
        description="Manage organizational departments."
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeptSheetOpen(false)} disabled={savingDept}>
              Close
            </Button>
            <Button variant="primary" onClick={saveDept} loading={savingDept}>
              {editingDeptId ? "Update" : "Add"} Department
            </Button>
          </>
        }
      >
        <div className="space-y-3 mb-5">
          <Field label="Department name" required>
            <Input
              autoFocus
              value={deptForm.name}
              onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Engineering"
            />
          </Field>
          <Field label="Parent department">
            <Select
              value={deptForm.parent_id}
              onChange={(e) => setDeptForm((f) => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">-- None (top-level) --</option>
              {departments
                .filter((d) => d.id !== editingDeptId)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </Select>
          </Field>
          {editingDeptId && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingDeptId(null); setDeptForm({ name: "", parent_id: "" }); }}>
              Clear form (add new instead)
            </Button>
          )}
        </div>
        <div
          className="text-[12px] font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          Existing Departments ({departments.length})
        </div>
        {departments.length > 0 ? (
          <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", borderColor: "var(--color-border)" }}>
            {departments.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">{d.name}</div>
                  {d.parent_id && (
                    <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      under {departments.find((p) => p.id === d.parent_id)?.name ?? "..."}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDept(d)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteDept(d)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--color-ink-tertiary)" }}>
            No departments yet. Add one above.
          </p>
        )}
      </Sheet>

      {/* Designation Sheet */}
      <Sheet
        open={desigSheetOpen}
        onOpenChange={(v) => !savingDesig && setDesigSheetOpen(v)}
        title="Designations"
        description="Manage job titles and designations."
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDesigSheetOpen(false)} disabled={savingDesig}>
              Close
            </Button>
            <Button variant="primary" onClick={saveDesig} loading={savingDesig}>
              {editingDesigId ? "Update" : "Add"} Designation
            </Button>
          </>
        }
      >
        <div className="space-y-3 mb-5">
          <Field label="Title" required>
            <Input
              autoFocus
              value={desigForm.title}
              onChange={(e) => setDesigForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Senior Engineer"
            />
          </Field>
          <Field label="Level">
            <Input
              value={desigForm.level}
              onChange={(e) => setDesigForm((f) => ({ ...f, level: e.target.value }))}
              placeholder="e.g. L5, Senior, Manager"
            />
          </Field>
          {editingDesigId && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingDesigId(null); setDesigForm({ title: "", level: "" }); }}>
              Clear form (add new instead)
            </Button>
          )}
        </div>
        <div
          className="text-[12px] font-medium uppercase tracking-wider mb-2"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          Existing Designations ({designations.length})
        </div>
        {designations.length > 0 ? (
          <div className="divide-y" style={{ borderTop: "1px solid var(--color-border)", borderColor: "var(--color-border)" }}>
            {designations.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-medium">{d.title}</div>
                  {d.level && (
                    <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      Level: {d.level}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEditDesig(d)}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteDesig(d)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] py-4 text-center" style={{ color: "var(--color-ink-tertiary)" }}>
            No designations yet. Add one above.
          </p>
        )}
      </Sheet>
    </PageContainer>
  );
}
