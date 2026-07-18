"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Mail,
  Shield,
  MoreHorizontal,
  Send,
  Trash2,
  Copy,
  UserMinus,
  UserPlus,
  KeyRound,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRBAC } from "@/lib/rbac";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, relativeTime } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Role = { id: string; key: string; name: string; is_system: boolean };

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  roles: { id: string; key: string; name: string }[];
};

type Invitation = {
  id: string;
  email: string;
  role_keys: string[];
  token: string;
  invited_by: string | null;
  invited_by_name: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeamPage() {
  const [tab, setTab] = useState<"members" | "invitations">("members");
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Sheets
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRolesOpen, setEditRolesOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleKeys, setInviteRoleKeys] = useState<string[]>(["employee"]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  // Create User sheet
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserName, setCreateUserName] = useState("");
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [createUserConfirm, setCreateUserConfirm] = useState("");
  const [createUserRoleKeys, setCreateUserRoleKeys] = useState<string[]>(["employee"]);
  const [createUserBusy, setCreateUserBusy] = useState(false);

  // Reset Password sheet
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwMember, setResetPwMember] = useState<Member | null>(null);
  const [resetPwNew, setResetPwNew] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");
  const [resetPwBusy, setResetPwBusy] = useState(false);

  // RBAC
  const { isAdmin } = useRBAC();

  // Menu state
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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

    setCurrentUserId(user.id);
    setOrgId(profile.org_id);

    // Fetch roles
    const { data: rolesData } = await supabase
      .from("roles")
      .select("id, key, name, is_system")
      .eq("org_id", profile.org_id)
      .order("name") as { data: Role[] | null };
    setRoles(rolesData ?? []);

    // Fetch members: profiles + user_roles
    type ProfileRow = { id: string; full_name: string | null; email: string | null; avatar_url: string | null; phone: string | null; created_at: string };
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, phone, created_at")
      .eq("org_id", profile.org_id)
      .order("full_name") as { data: ProfileRow[] | null };

    type UserRoleRow = { user_id: string; role_id: string };
    const { data: userRolesData } = await supabase
      .from("user_roles")
      .select("user_id, role_id")
      .eq("org_id", profile.org_id) as { data: UserRoleRow[] | null };

    const rolesMap = new Map((rolesData ?? []).map((r) => [r.id, r]));
    const memberList: Member[] = (profilesData ?? []).map((p) => {
      const memberRoles = (userRolesData ?? [])
        .filter((ur) => ur.user_id === p.id)
        .map((ur) => {
          const r = rolesMap.get(ur.role_id);
          return r ? { id: r.id, key: r.key, name: r.name } : null;
        })
        .filter(Boolean) as { id: string; key: string; name: string }[];
      return { ...p, roles: memberRoles };
    });
    setMembers(memberList);

    // Fetch invitations
    type InvRow = { id: string; email: string; role_keys: string[] | null; token: string; invited_by: string | null; accepted_at: string | null; expires_at: string; created_at: string };
    const { data: invData } = await supabase
      .from("invitations")
      .select("id, email, role_keys, token, invited_by, accepted_at, expires_at, created_at")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false }) as { data: InvRow[] | null };

    // Resolve invited_by names
    const inviterIds = [...new Set((invData ?? []).map((i) => i.invited_by).filter(Boolean))] as string[];
    let inviterMap = new Map<string, string>();
    if (inviterIds.length > 0) {
      const { data: inviters } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", inviterIds) as { data: { id: string; full_name: string | null }[] | null };
      inviterMap = new Map((inviters ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
    }

    setInvitations(
      (invData ?? []).map((i) => ({
        ...i,
        role_keys: i.role_keys ?? ["employee"],
        invited_by_name: i.invited_by ? inviterMap.get(i.invited_by) ?? null : null,
      })),
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close menus on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMenu]);

  /* ---- actions ---- */
  async function handleInvite() {
    if (!inviteEmail.trim() || !orgId) return;
    setInviteBusy(true);
    const supabase = createClient();
    const token = crypto.randomUUID();
    const { error } = await (supabase.from("invitations") as any).insert({
      org_id: orgId,
      email: inviteEmail.trim().toLowerCase(),
      role_keys: inviteRoleKeys.length > 0 ? inviteRoleKeys : ["employee"],
      token,
      invited_by: currentUserId,
    });
    setInviteBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
    setInviteRoleKeys(["employee"]);
    setInviteOpen(false);
    fetchData();
  }

  async function handleResend(inv: Invitation) {
    const supabase = createClient();
    const { error } = await (supabase.from("invitations") as any)
      .update({ expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation to ${inv.email} renewed for 14 days`);
    fetchData();
  }

  async function handleCancelInvite(inv: Invitation) {
    if (!confirm(`Cancel invitation to ${inv.email}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("invitations").delete().eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation cancelled");
    fetchData();
  }

  function openEditRoles(member: Member) {
    setEditingMember(member);
    setSelectedRoleIds(member.roles.map((r) => r.id));
    setEditRolesOpen(true);
  }

  async function handleSaveRoles() {
    if (!editingMember || !orgId) return;
    setSavingRoles(true);
    const supabase = createClient();

    // Delete existing user_roles for this user
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", editingMember.id)
      .eq("org_id", orgId);

    // Insert new roles
    if (selectedRoleIds.length > 0) {
      const { error } = await (supabase.from("user_roles") as any).insert(
        selectedRoleIds.map((roleId) => ({
          user_id: editingMember.id,
          role_id: roleId,
          org_id: orgId,
          granted_by: currentUserId,
        })),
      );
      if (error) {
        toast.error(error.message);
        setSavingRoles(false);
        return;
      }
    }

    toast.success(`Roles updated for ${editingMember.full_name ?? editingMember.email}`);
    setSavingRoles(false);
    setEditRolesOpen(false);
    fetchData();
  }

  async function handleRemoveMember(member: Member) {
    if (member.id === currentUserId) {
      toast.error("You cannot remove yourself from the organization");
      return;
    }
    if (!confirm(`Remove ${member.full_name ?? member.email} from the organization?`)) return;
    const supabase = createClient();

    // Remove user_roles
    await supabase.from("user_roles").delete().eq("user_id", member.id).eq("org_id", orgId!);
    // Set org_id to null on profile
    await (supabase.from("profiles") as any).update({ org_id: null }).eq("id", member.id);

    toast.success(`${member.full_name ?? member.email} removed`);
    fetchData();
  }

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/auth/callback?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  }

  /* ---- create user ---- */
  async function handleCreateUser() {
    if (!createUserName.trim() || !createUserEmail.trim()) return;
    if (createUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (createUserPassword !== createUserConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    setCreateUserBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createUserEmail.trim().toLowerCase(),
          password: createUserPassword,
          full_name: createUserName.trim(),
          role_keys: createUserRoleKeys.length > 0 ? createUserRoleKeys : ["employee"],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create user");
        setCreateUserBusy(false);
        return;
      }
      toast.success(`User "${data.full_name ?? createUserName}" created (${createUserEmail})`);
      setCreateUserOpen(false);
      setCreateUserName("");
      setCreateUserEmail("");
      setCreateUserPassword("");
      setCreateUserConfirm("");
      setCreateUserRoleKeys(["employee"]);
      fetchData();
    } catch (err: any) {
      toast.error(err.message ?? "Network error");
    } finally {
      setCreateUserBusy(false);
    }
  }

  /* ---- reset password ---- */
  function openResetPassword(member: Member) {
    setResetPwMember(member);
    setResetPwNew("");
    setResetPwConfirm("");
    setResetPwOpen(true);
  }

  async function handleResetPassword() {
    if (!resetPwMember) return;
    if (resetPwNew.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (resetPwNew !== resetPwConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    setResetPwBusy(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: resetPwMember.id,
          new_password: resetPwNew,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to reset password");
        setResetPwBusy(false);
        return;
      }
      toast.success(`Password reset for ${resetPwMember.full_name ?? resetPwMember.email}`);
      setResetPwOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Network error");
    } finally {
      setResetPwBusy(false);
    }
  }

  function getInvitationStatus(inv: Invitation): { label: string; tone: "viridian" | "outline" | "neutral" } {
    if (inv.accepted_at) return { label: "Accepted", tone: "viridian" };
    if (new Date(inv.expires_at) < new Date()) return { label: "Expired", tone: "neutral" };
    return { label: "Pending", tone: "outline" };
  }

  /* ---- role stats ---- */
  const roleStats = roles.map((r) => ({
    ...r,
    count: members.filter((m) => m.roles.some((mr) => mr.id === r.id)).length,
  }));

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
        title="Team"
        description={`${members.length} member${members.length === 1 ? "" : "s"}`}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                iconLeft={<UserPlus className="size-3.5" />}
                onClick={() => setCreateUserOpen(true)}
              >
                Create User
              </Button>
              <Button
                variant="primary"
                iconLeft={<Plus className="size-3.5" />}
                onClick={() => setInviteOpen(true)}
              >
                Invite member
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Non-admin notice */}
      {!isAdmin && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5 text-[13px]"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: "var(--color-ink-secondary)",
          }}
        >
          <AlertTriangle className="size-4 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
          You do not have admin access. Some actions like creating users, inviting members, and resetting passwords are restricted to admins.
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div
          className="px-4 py-3 rounded-xl flex-1 min-w-[140px]"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--color-ink-tertiary)" }}>
            Total members
          </div>
          <div className="text-[20px] font-semibold">{members.length}</div>
        </div>
        {roleStats.slice(0, 4).map((r) => (
          <div
            key={r.id}
            className="px-4 py-3 rounded-xl flex-1 min-w-[140px]"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--color-ink-tertiary)" }}>
              {r.name}
            </div>
            <div className="text-[20px] font-semibold">{r.count}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        {(["members", "invitations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[13px] font-medium transition-colors relative"
            style={{
              color: tab === t ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
            }}
          >
            {t === "members" ? "Members" : "Invitations"}
            {t === "invitations" && invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) >= new Date()).length > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold"
                style={{ background: "var(--color-viridian-500)", color: "white" }}
              >
                {invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) >= new Date()).length}
              </span>
            )}
            {tab === t && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                style={{ background: "var(--color-viridian-500)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <div className="card overflow-hidden">
          {members.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Th>Member</Th>
                  <Th>Email</Th>
                  <Th>Roles</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-[var(--color-surface-hover)] transition-colors"
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={m.full_name} src={m.avatar_url} size="md" />
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {m.full_name ?? "Unnamed"}
                            {m.id === currentUserId && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td muted>{m.email ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.length > 0 ? (
                          m.roles.map((r) => (
                            <Badge key={r.id} tone={r.key === "owner" ? "viridian" : r.key === "admin" ? "solid" : "outline"}>
                              {r.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
                            No roles
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td muted>{formatDate(m.created_at)}</Td>
                    <Td>
                      <Badge tone="viridian" dot>Active</Badge>
                    </Td>
                    <Td align="right">
                      <div className="relative inline-flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === m.id ? null : m.id);
                          }}
                          className="size-7 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)] transition-colors"
                        >
                          <MoreHorizontal className="size-4" style={{ color: "var(--color-ink-tertiary)" }} />
                        </button>
                        {openMenu === m.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg shadow-lg"
                            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                openEditRoles(m);
                              }}
                              className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-muted)] transition-colors"
                            >
                              <Shield className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                              Edit roles
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  openResetPassword(m);
                                }}
                                className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-muted)] transition-colors"
                              >
                                <KeyRound className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                                Reset password
                              </button>
                            )}
                            {m.id !== currentUserId && (
                              <button
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleRemoveMember(m);
                                }}
                                className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-muted)] transition-colors"
                                style={{ color: "var(--color-ink)" }}
                              >
                                <UserMinus className="size-3.5" />
                                Remove from org
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title="No team members" description="Invite your first team member to get started." />
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {tab === "invitations" && (
        <div className="card overflow-hidden">
          {invitations.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Th>Email</Th>
                  <Th>Roles</Th>
                  <Th>Invited by</Th>
                  <Th>Sent</Th>
                  <Th>Expires</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const status = getInvitationStatus(inv);
                  const isExpired = !inv.accepted_at && new Date(inv.expires_at) < new Date();
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-[var(--color-surface-hover)] transition-colors"
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        opacity: isExpired ? 0.5 : 1,
                      }}
                    >
                      <Td>
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
                          <span className="font-medium">{inv.email}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {inv.role_keys.map((rk) => (
                            <Badge key={rk} tone="outline">
                              {rk}
                            </Badge>
                          ))}
                        </div>
                      </Td>
                      <Td muted>{inv.invited_by_name ?? "—"}</Td>
                      <Td muted>{relativeTime(inv.created_at)}</Td>
                      <Td muted>{formatDate(inv.expires_at)}</Td>
                      <Td>
                        <Badge tone={status.tone} dot>{status.label}</Badge>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center gap-1 justify-end">
                          {!inv.accepted_at && (
                            <>
                              <button
                                onClick={() => copyInviteLink(inv.token)}
                                title="Copy invite link"
                                className="size-7 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)] transition-colors"
                              >
                                <Copy className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                              </button>
                              <button
                                onClick={() => handleResend(inv)}
                                title="Resend (renew expiry)"
                                className="size-7 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)] transition-colors"
                              >
                                <Send className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                              </button>
                              <button
                                onClick={() => handleCancelInvite(inv)}
                                title="Cancel invitation"
                                className="size-7 inline-flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-muted)] transition-colors"
                              >
                                <Trash2 className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                              </button>
                            </>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState icon={<Mail className="size-5" />} title="No invitations" description="Invite team members and their invitations will appear here." />
          )}
        </div>
      )}

      {/* Invite Sheet */}
      <Sheet
        open={inviteOpen}
        onOpenChange={(v) => {
          if (!inviteBusy) {
            setInviteOpen(v);
            if (!v) {
              setInviteEmail("");
              setInviteRoleKeys(["employee"]);
            }
          }
        }}
        title="Invite team member"
        description="Send an invitation to join your organization. They will receive a link to sign up."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviteBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInvite} loading={inviteBusy} disabled={!inviteEmail.trim()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email address" required>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              autoFocus
            />
          </Field>
          <Field label="Roles" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Select one or more</span>}>
            <div className="space-y-2 mt-1">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <input
                    type="checkbox"
                    checked={inviteRoleKeys.includes(r.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setInviteRoleKeys((prev) => [...prev, r.key]);
                      } else {
                        setInviteRoleKeys((prev) => prev.filter((k) => k !== r.key));
                      }
                    }}
                    className="accent-[var(--color-viridian-500)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{r.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {r.key}
                      {r.is_system && " · System role"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Sheet>

      {/* Edit Roles Sheet */}
      <Sheet
        open={editRolesOpen}
        onOpenChange={(v) => {
          if (!savingRoles) {
            setEditRolesOpen(v);
          }
        }}
        title="Edit roles"
        description={editingMember ? `Update roles for ${editingMember.full_name ?? editingMember.email}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditRolesOpen(false)} disabled={savingRoles}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRoles} loading={savingRoles}>
              Save roles
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {roles.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]"
              style={{ border: "1px solid var(--color-border)" }}
            >
              <input
                type="checkbox"
                checked={selectedRoleIds.includes(r.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRoleIds((prev) => [...prev, r.id]);
                  } else {
                    setSelectedRoleIds((prev) => prev.filter((id) => id !== r.id));
                  }
                }}
                className="accent-[var(--color-viridian-500)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">{r.name}</span>
                  {r.is_system && <Badge tone="neutral">System</Badge>}
                </div>
                <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                  {r.key}
                </div>
              </div>
            </label>
          ))}
        </div>
      </Sheet>

      {/* Create User Sheet */}
      <Sheet
        open={createUserOpen}
        onOpenChange={(v) => {
          if (!createUserBusy) {
            setCreateUserOpen(v);
            if (!v) {
              setCreateUserName("");
              setCreateUserEmail("");
              setCreateUserPassword("");
              setCreateUserConfirm("");
              setCreateUserRoleKeys(["employee"]);
            }
          }
        }}
        title="Create user"
        description="Create a new user account directly. They will be added to your organization immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateUserOpen(false)} disabled={createUserBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateUser}
              loading={createUserBusy}
              disabled={
                !createUserName.trim() ||
                !createUserEmail.trim() ||
                createUserPassword.length < 6 ||
                createUserPassword !== createUserConfirm
              }
            >
              Create user
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full Name" required>
            <Input
              type="text"
              value={createUserName}
              onChange={(e) => setCreateUserName(e.target.value)}
              placeholder="John Doe"
              autoFocus
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={createUserEmail}
              onChange={(e) => setCreateUserEmail(e.target.value)}
              placeholder="user@company.com"
            />
          </Field>
          <Field label="Password" required hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Minimum 6 characters</span>}>
            <Input
              type="password"
              value={createUserPassword}
              onChange={(e) => setCreateUserPassword(e.target.value)}
              placeholder="Enter password"
            />
          </Field>
          <Field label="Confirm Password" required>
            <Input
              type="password"
              value={createUserConfirm}
              onChange={(e) => setCreateUserConfirm(e.target.value)}
              placeholder="Confirm password"
            />
            {createUserConfirm.length > 0 && createUserPassword !== createUserConfirm && (
              <p className="text-[11px] mt-1" style={{ color: "var(--color-red-600, #dc2626)" }}>
                Passwords do not match
              </p>
            )}
          </Field>
          <Field label="Roles" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Select one or more</span>}>
            <div className="space-y-2 mt-1">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <input
                    type="checkbox"
                    checked={createUserRoleKeys.includes(r.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCreateUserRoleKeys((prev) => [...prev, r.key]);
                      } else {
                        setCreateUserRoleKeys((prev) => prev.filter((k) => k !== r.key));
                      }
                    }}
                    className="accent-[var(--color-viridian-500)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{r.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      {r.key}
                      {r.is_system && " · System role"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Sheet>

      {/* Reset Password Sheet */}
      <Sheet
        open={resetPwOpen}
        onOpenChange={(v) => {
          if (!resetPwBusy) {
            setResetPwOpen(v);
            if (!v) {
              setResetPwNew("");
              setResetPwConfirm("");
              setResetPwMember(null);
            }
          }
        }}
        title="Reset password"
        description={resetPwMember ? `Set a new password for ${resetPwMember.full_name ?? resetPwMember.email}` : ""}
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetPwOpen(false)} disabled={resetPwBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResetPassword}
              loading={resetPwBusy}
              disabled={resetPwNew.length < 6 || resetPwNew !== resetPwConfirm}
            >
              Reset password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {resetPwMember && (
            <div
              className="px-3 py-3 rounded-lg"
              style={{ background: "var(--color-surface-muted)", border: "1px solid var(--color-border)" }}
            >
              <div className="text-[13px] font-medium">{resetPwMember.full_name ?? "Unnamed"}</div>
              <div className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                {resetPwMember.email ?? "No email"}
              </div>
            </div>
          )}
          <Field label="New Password" required hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>Minimum 6 characters</span>}>
            <Input
              type="password"
              value={resetPwNew}
              onChange={(e) => setResetPwNew(e.target.value)}
              placeholder="Enter new password"
              autoFocus
            />
          </Field>
          <Field label="Confirm New Password" required>
            <Input
              type="password"
              value={resetPwConfirm}
              onChange={(e) => setResetPwConfirm(e.target.value)}
              placeholder="Confirm new password"
            />
            {resetPwConfirm.length > 0 && resetPwNew !== resetPwConfirm && (
              <p className="text-[11px] mt-1" style={{ color: "var(--color-red-600, #dc2626)" }}>
                Passwords do not match
              </p>
            )}
          </Field>
        </div>
      </Sheet>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared mini-components                                            */
/* ------------------------------------------------------------------ */

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

function Td({
  children,
  align,
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)",
      }}
    >
      {children}
    </td>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div
        className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
        style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
      >
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
        {description}
      </p>
    </div>
  );
}
