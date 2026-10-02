"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Shield,
  Trash2,
  Pencil,
  Check,
  Minus,
  Loader2,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type ModuleCategory = { label: string; modules: { key: string; label: string }[] };

const MODULE_CATEGORIES: ModuleCategory[] = [
  {
    label: "CRM",
    modules: [
      { key: "dashboard", label: "Dashboard" },
      { key: "contacts", label: "Contacts" },
      { key: "companies", label: "Companies" },
      { key: "leads", label: "Leads" },
      { key: "pipelines", label: "Pipelines" },
      { key: "tasks", label: "Tasks" },
      { key: "meetings", label: "Meetings" },
      { key: "quotations", label: "Quotations" },
      { key: "invoices", label: "Invoices" },
      { key: "reports", label: "Reports" },
    ],
  },
  {
    label: "Outreach",
    modules: [
      { key: "outreach_contacts", label: "Contacts" },
      { key: "outreach", label: "Outreach" },
      { key: "outreach_inbox", label: "Outreach inbox" },
    ],
  },
  {
    label: "HRM",
    modules: [
      { key: "employees", label: "Employees" },
      { key: "attendance", label: "Attendance" },
      { key: "leave", label: "Leave" },
      { key: "payroll", label: "Payroll" },
      { key: "performance", label: "Performance" },
      { key: "announcements", label: "Announcements" },
    ],
  },
  {
    label: "Admin",
    modules: [
      { key: "team", label: "Team" },
      { key: "permissions", label: "Permissions" },
      { key: "settings", label: "Settings" },
      { key: "ai_usage", label: "AI Usage" },
      { key: "audit_log", label: "Audit Log" },
    ],
  },
];

const ALL_MODULES = MODULE_CATEGORIES.flatMap((c) => c.modules);
const PERM_KEYS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
const PERM_LABELS: Record<string, string> = {
  can_view: "View",
  can_create: "Create",
  can_edit: "Edit",
  can_delete: "Delete",
};

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
};

type PermRow = {
  id: string;
  role_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Sheets
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ key: "", name: "", description: "" });
  const [roleBusy, setRoleBusy] = useState(false);

  // Collapsed categories
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  /* ---- data fetch ---- */
  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single() as { data: { id: string; org_id: string } | null };
    if (!profile) return;

    setOrgId(profile.org_id);

    // Fetch roles
    type RoleRow = { id: string; key: string; name: string; description: string | null; is_system: boolean };
    const { data: rolesData } = await supabase
      .from("roles")
      .select("id, key, name, description, is_system")
      .eq("org_id", profile.org_id)
      .order("is_system", { ascending: false })
      .order("name") as { data: RoleRow[] | null };

    // Count members per role
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("org_id", profile.org_id) as { data: { role_id: string }[] | null };

    const countMap = new Map<string, number>();
    (userRolesData ?? []).forEach((ur) => {
      countMap.set(ur.role_id, (countMap.get(ur.role_id) ?? 0) + 1);
    });

    const rolesWithCount: Role[] = (rolesData ?? []).map((r) => ({
      ...r,
      description: r.description ?? null,
      member_count: countMap.get(r.id) ?? 0,
    }));
    setRoles(rolesWithCount);

    // Select first role if none selected
    if (!selectedRoleId && rolesWithCount.length > 0) {
      setSelectedRoleId(rolesWithCount[0].id);
    }

    // Fetch permissions
    const { data: permsData } = await supabase
      .from("role_permissions")
      .select("id, role_id, module, can_view, can_create, can_edit, can_delete")
      .eq("org_id", profile.org_id) as { data: PermRow[] | null };

    setPermissions(permsData ?? []);
    setLoading(false);
  }, [selectedRoleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- helpers ---- */
  function getPermission(roleId: string, module: string): PermRow | undefined {
    return permissions.find((p) => p.role_id === roleId && p.module === module);
  }

  function isPermEnabled(roleId: string, module: string, key: (typeof PERM_KEYS)[number]): boolean {
    const p = getPermission(roleId, module);
    return p ? (p[key] as boolean) : false;
  }

  async function togglePermission(roleId: string, module: string, key: (typeof PERM_KEYS)[number]) {
    if (!orgId) return;
    const supabase = createClient();
    const existing = getPermission(roleId, module);
    const newVal = existing ? !existing[key] : true;

    // Optimistic update
    if (existing) {
      setPermissions((prev) =>
        prev.map((p) => (p.id === existing.id ? { ...p, [key]: newVal } : p)),
      );

      const { error } = await (supabase.from("role_permissions") as any)
        .update({ [key]: newVal })
        .eq("id", existing.id);

      if (error) {
        toast.error(error.message);
        // Revert
        setPermissions((prev) =>
          prev.map((p) => (p.id === existing.id ? { ...p, [key]: !newVal } : p)),
        );
      }
    } else {
      // Insert new row
      const newRow: Omit<PermRow, "id"> & { org_id: string } = {
        org_id: orgId,
        role_id: roleId,
        module,
        can_view: key === "can_view" ? true : false,
        can_create: key === "can_create" ? true : false,
        can_edit: key === "can_edit" ? true : false,
        can_delete: key === "can_delete" ? true : false,
      };

      const { data, error } = await (supabase.from("role_permissions") as any)
        .insert(newRow)
        .select("id, role_id, module, can_view, can_create, can_edit, can_delete")
        .single() as { data: PermRow | null; error: any };

      if (error) {
        toast.error(error.message);
      } else if (data) {
        setPermissions((prev) => [...prev, data]);
      }
    }
  }

  /* ---- role CRUD ---- */
  function openNewRole() {
    setEditingRole(null);
    setRoleForm({ key: "", name: "", description: "" });
    setRoleSheetOpen(true);
  }

  function openEditRole(role: Role) {
    setEditingRole(role);
    setRoleForm({ key: role.key, name: role.name, description: role.description ?? "" });
    setRoleSheetOpen(true);
  }

  async function handleSaveRole() {
    if (!orgId || !roleForm.key.trim() || !roleForm.name.trim()) {
      toast.error("Key and name are required");
      return;
    }
    setRoleBusy(true);
    const supabase = createClient();

    if (editingRole) {
      const { error } = await (supabase.from("roles") as any)
        .update({
          key: roleForm.key.trim().toLowerCase().replace(/\s+/g, "_"),
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
        })
        .eq("id", editingRole.id);

      if (error) {
        toast.error(error.message);
        setRoleBusy(false);
        return;
      }
      toast.success("Role updated");
    } else {
      const { error } = await (supabase.from("roles") as any).insert({
        org_id: orgId,
        key: roleForm.key.trim().toLowerCase().replace(/\s+/g, "_"),
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
      });

      if (error) {
        toast.error(error.message);
        setRoleBusy(false);
        return;
      }
      toast.success("Role created");
    }

    setRoleBusy(false);
    setRoleSheetOpen(false);
    fetchData();
  }

  async function handleDeleteRole(role: Role) {
    if (role.is_system) {
      toast.error("System roles cannot be deleted");
      return;
    }
    if (!confirm(`Delete role "${role.name}"? This will remove it from all users.`)) return;

    const supabase = createClient();

    // Delete permissions
    await supabase.from("role_permissions").delete().eq("role_id", role.id).eq("org_id", orgId!);
    // Delete user_roles
    await supabase.from("user_roles").delete().eq("role_id", role.id).eq("org_id", orgId!);
    // Delete role
    const { error } = await supabase.from("roles").delete().eq("id", role.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Role "${role.name}" deleted`);
    if (selectedRoleId === role.id) setSelectedRoleId(null);
    fetchData();
  }

  function toggleCategory(cat: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

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
      <PageHeader
        title="Permissions"
        description="Manage roles and configure what each role can access"
        actions={
          <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={openNewRole}>
            New role
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ---- Roles sidebar ---- */}
        <div>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div
              className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider"
              style={{ color: "var(--color-ink-tertiary)", borderBottom: "1px solid var(--color-border)" }}
            >
              Roles
            </div>
            {roles.length > 0 ? (
              <div>
                {roles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className="px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]"
                    style={{
                      borderBottom: "1px solid var(--color-border)",
                      background: selectedRoleId === role.id ? "var(--color-surface-muted)" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium truncate">{role.name}</span>
                          {role.is_system && (
                            <Lock className="size-3 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--color-ink-tertiary)" }}>
                          {role.key} · {role.member_count} member{role.member_count === 1 ? "" : "s"}
                        </div>
                        {role.description && (
                          <div className="text-[11px] mt-0.5 line-clamp-1" style={{ color: "var(--color-ink-tertiary)" }}>
                            {role.description}
                          </div>
                        )}
                      </div>
                      {!role.is_system && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditRole(role);
                            }}
                            className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-canvas)] transition-colors"
                            title="Edit role"
                          >
                            <Pencil className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRole(role);
                            }}
                            className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-canvas)] transition-colors"
                            title="Delete role"
                          >
                            <Trash2 className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
                No roles configured
              </div>
            )}
          </div>
        </div>

        {/* ---- Permission Matrix ---- */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          {selectedRole ? (
            <>
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-4" style={{ color: "var(--color-viridian-500)" }} />
                    <span className="text-[14px] font-semibold">{selectedRole.name}</span>
                    {selectedRole.is_system && <Badge tone="neutral">System</Badge>}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--color-ink-tertiary)" }}>
                    {selectedRole.description ?? `Permissions for the ${selectedRole.name} role`}
                  </div>
                </div>
                <div className="flex gap-1">
                  {PERM_KEYS.map((k) => (
                    <span
                      key={k}
                      className="w-[60px] text-center text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: "var(--color-ink-tertiary)" }}
                    >
                      {PERM_LABELS[k]}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                {MODULE_CATEGORIES.map((cat) => {
                  const isCollapsed = collapsedCats.has(cat.label);
                  return (
                    <div key={cat.label}>
                      {/* Category header */}
                      <button
                        onClick={() => toggleCategory(cat.label)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-[var(--color-surface-muted)] transition-colors"
                        style={{ background: "var(--color-canvas)", borderBottom: "1px solid var(--color-border)" }}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                        ) : (
                          <ChevronDown className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                        )}
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-ink-secondary)" }}>
                          {cat.label}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--color-ink-tertiary)" }}>
                          ({cat.modules.length})
                        </span>
                      </button>

                      {!isCollapsed &&
                        cat.modules.map((mod) => (
                          <div
                            key={mod.key}
                            className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--color-surface-muted)] transition-colors"
                            style={{ borderBottom: "1px solid var(--color-border)" }}
                          >
                            <span className="text-[13px]" style={{ color: "var(--color-ink)" }}>
                              {mod.label}
                            </span>
                            <div className="flex gap-1">
                              {PERM_KEYS.map((k) => {
                                const enabled = isPermEnabled(selectedRole.id, mod.key, k);
                                return (
                                  <button
                                    key={k}
                                    onClick={() => togglePermission(selectedRole.id, mod.key, k)}
                                    className="w-[60px] h-7 inline-flex items-center justify-center rounded transition-colors"
                                    style={{
                                      background: enabled ? "var(--color-viridian-100)" : "transparent",
                                      color: enabled ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
                                    }}
                                    title={`${PERM_LABELS[k]} ${mod.label}`}
                                  >
                                    {enabled ? (
                                      <Check className="size-3.5" />
                                    ) : (
                                      <Minus className="size-3.5" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <div
                className="size-10 rounded-xl inline-flex items-center justify-center mb-3 mx-auto"
                style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
              >
                <Shield className="size-5" />
              </div>
              <h3 className="text-[15px] font-semibold tracking-tight">Select a role</h3>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
                Choose a role from the left to view and edit its permissions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- Role Sheet ---- */}
      <Sheet
        open={roleSheetOpen}
        onOpenChange={(v) => {
          if (!roleBusy) setRoleSheetOpen(v);
        }}
        title={editingRole ? "Edit role" : "New role"}
        description={editingRole ? `Editing "${editingRole.name}"` : "Create a custom role for your team"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleSheetOpen(false)} disabled={roleBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRole}
              loading={roleBusy}
              disabled={!roleForm.key.trim() || !roleForm.name.trim()}
            >
              {editingRole ? "Update role" : "Create role"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Key" required hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Lowercase, no spaces</span>}>
            <Input
              value={roleForm.key}
              onChange={(e) => setRoleForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
              placeholder="sales_lead"
              autoFocus
            />
          </Field>
          <Field label="Name" required>
            <Input
              value={roleForm.name}
              onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sales Lead"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={roleForm.description}
              onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe what this role is for..."
            />
          </Field>
        </div>
      </Sheet>
    </PageContainer>
  );
}
