"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const TaskInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  due_at: z.string().optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  deal_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createTask(input: z.infer<typeof TaskInput>) {
  const parsed = TaskInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const ctx = await getContext();
  const row = {
    org_id: ctx.orgId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    due_at: parsed.data.due_at ? new Date(parsed.data.due_at).toISOString() : null,
    priority: parsed.data.priority,
    assignee_id: ctx.profile.id,
    contact_id: parsed.data.contact_id || null,
    deal_id: parsed.data.deal_id || null,
    created_by: ctx.profile.id,
  };
  const { data, error } = await ctx.supabase.from("tasks").insert(row).select("id").single();
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "task",
    entityId: data.id as string,
    action: "create",
    diff: row,
  });

  revalidatePath("/crm/tasks");
  return { ok: true as const, data: { id: data.id as string } };
}

export async function toggleTask(id: string, done: boolean) {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      status: done ? "done" : "open",
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "task",
    entityId: id,
    action: done ? "complete" : "reopen",
  });

  revalidatePath("/crm/tasks");
  return { ok: true as const };
}
