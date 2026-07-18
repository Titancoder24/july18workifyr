"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const Input = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  employee_code: z.string().trim().max(40).optional().or(z.literal("")),
  joined_on: z.string().optional().or(z.literal("")),
  employment_type: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  department_id: z.string().uuid().optional().or(z.literal("")),
  designation_id: z.string().uuid().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function createEmployee(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const ctx = await getContext();
  if (!ctx.hasAnyRole(["owner", "admin", "hr"])) {
    return { ok: false as const, error: "Only HR / Admin / Owner can add employees" };
  }

  const row = {
    org_id: ctx.orgId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name || null,
    email: parsed.data.email || null,
    employee_code: parsed.data.employee_code || null,
    joined_on: parsed.data.joined_on || null,
    employment_type: parsed.data.employment_type,
    department_id: parsed.data.department_id || null,
    designation_id: parsed.data.designation_id || null,
    phone: parsed.data.phone || null,
    status: "active",
  };

  const { data, error } = await ctx.supabase.from("employees").insert(row).select("id").single();
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "employee",
    entityId: data.id as string,
    action: "create",
    diff: row,
  });

  revalidatePath("/hrm/employees");
  return { ok: true as const, data: { id: data.id as string } };
}
