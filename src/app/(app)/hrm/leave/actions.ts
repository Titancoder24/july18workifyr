"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

const RequestInput = z.object({
  policy_id: z.string().uuid(),
  starts_on: z.string().min(10),
  ends_on: z.string().min(10),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function submitLeaveRequest(input: z.infer<typeof RequestInput>) {
  const parsed = RequestInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed" };
  }
  if (new Date(parsed.data.ends_on) < new Date(parsed.data.starts_on)) {
    return { ok: false as const, error: "End date must be on or after start date" };
  }

  const ctx = await getContext();

  const { data: employee } = await ctx.supabase
    .from("employees")
    .select("id")
    .eq("user_id", ctx.profile.id)
    .maybeSingle();
  if (!employee) {
    return { ok: false as const, error: "Your user is not linked to an employee record yet. Ask HR to add you." };
  }

  const days = daysBetweenInclusive(parsed.data.starts_on, parsed.data.ends_on);
  const row = {
    org_id: ctx.orgId,
    employee_id: employee.id,
    policy_id: parsed.data.policy_id,
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    days,
    reason: parsed.data.reason || null,
    status: "pending",
  };
  const { data, error } = await ctx.supabase
    .from("leave_requests")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "leave_request",
    entityId: data.id as string,
    action: "submit",
    diff: row,
  });

  revalidatePath("/hrm/leave");
  return { ok: true as const, data: { id: data.id as string } };
}

const DecideInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function decideLeaveRequest(input: z.infer<typeof DecideInput>) {
  const parsed = DecideInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Validation failed" };

  const ctx = await getContext();
  if (!ctx.hasAnyRole(["owner", "admin", "hr", "manager"])) {
    return { ok: false as const, error: "Only Manager / HR / Admin / Owner can decide leave" };
  }

  const update = {
    status: parsed.data.decision,
    approver_id: ctx.profile.id,
    decided_at: new Date().toISOString(),
    decision_note: parsed.data.note || null,
  };
  const { error } = await ctx.supabase
    .from("leave_requests")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("status", "pending");
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "leave_request",
    entityId: parsed.data.id,
    action: parsed.data.decision === "approved" ? "approve" : "reject",
    diff: update,
  });

  revalidatePath("/hrm/leave");
  return { ok: true as const };
}
