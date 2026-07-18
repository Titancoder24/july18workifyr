"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type Permission = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export type RBACContext = {
  userId: string | null;
  orgId: string | null;
  fullName: string | null;
  email: string | null;
  roles: string[];
  permissions: Permission[];
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  hasRole: (roleKey: string) => boolean;
  canView: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<RBACContext>({
  userId: null,
  orgId: null,
  fullName: null,
  email: null,
  roles: [],
  permissions: [],
  loading: true,
  isOwner: false,
  isAdmin: false,
  hasRole: () => false,
  canView: () => false,
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  refresh: async () => {},
});

export function useRBAC() {
  return useContext(Ctx);
}

export function RBACProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    userId: string | null;
    orgId: string | null;
    fullName: string | null;
    email: string | null;
    roles: string[];
    permissions: Permission[];
    loading: boolean;
  }>({
    userId: null,
    orgId: null,
    fullName: null,
    email: null,
    roles: [],
    permissions: [],
    loading: true,
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, org_id, full_name, email")
      .eq("id", user.id)
      .single() as { data: { id: string; org_id: string; full_name: string | null; email: string | null } | null };

    if (!profile?.org_id) {
      setState((s) => ({ ...s, userId: user.id, loading: false }));
      return;
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", user.id)
      .eq("org_id", profile.org_id) as { data: { role_id: string }[] | null };

    const roleIds = (userRoles ?? []).map((r) => r.role_id);

    let roleKeys: string[] = [];
    if (roleIds.length > 0) {
      const { data: roles } = await supabase
        .from("roles")
        .select("key")
        .eq("org_id", profile.org_id)
        .in("id", roleIds) as { data: { key: string }[] | null };
      roleKeys = (roles ?? []).map((r) => r.key);
    }

    let perms: Permission[] = [];
    if (roleIds.length > 0) {
      const { data: rp } = await supabase
        .from("role_permissions")
        .select("module, can_view, can_create, can_edit, can_delete")
        .eq("org_id", profile.org_id)
        .in("role_id", roleIds) as { data: Permission[] | null };
      perms = rp ?? [];
    }

    setState({
      userId: user.id,
      orgId: profile.org_id,
      fullName: profile.full_name,
      email: profile.email ?? user.email ?? null,
      roles: roleKeys,
      permissions: perms,
      loading: false,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const isOwner = state.roles.includes("owner");
  const isAdmin = state.roles.includes("admin") || isOwner;

  const hasRole = useCallback((key: string) => state.roles.includes(key), [state.roles]);

  const canView = useCallback((mod: string) => {
    if (isOwner || isAdmin) return true;
    return state.permissions.some((p) => p.module === mod && p.can_view);
  }, [state.permissions, isOwner, isAdmin]);

  const canCreate = useCallback((mod: string) => {
    if (isOwner || isAdmin) return true;
    return state.permissions.some((p) => p.module === mod && p.can_create);
  }, [state.permissions, isOwner, isAdmin]);

  const canEdit = useCallback((mod: string) => {
    if (isOwner || isAdmin) return true;
    return state.permissions.some((p) => p.module === mod && p.can_edit);
  }, [state.permissions, isOwner, isAdmin]);

  const canDelete = useCallback((mod: string) => {
    if (isOwner || isAdmin) return true;
    return state.permissions.some((p) => p.module === mod && p.can_delete);
  }, [state.permissions, isOwner, isAdmin]);

  return (
    <Ctx.Provider value={{
      ...state,
      isOwner,
      isAdmin,
      hasRole,
      canView,
      canCreate,
      canEdit,
      canDelete,
      refresh: load,
    }}>
      {children}
    </Ctx.Provider>
  );
}
