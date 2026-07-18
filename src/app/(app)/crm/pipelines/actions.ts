"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const FollowUpInput = z.object({
  entity_type: z.enum(["deal", "lead", "contact", "task"]),
  entity_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().optional(),
  due_at: z.string(),
});

export async function createFollowUp(input: z.infer<typeof FollowUpInput>) {
  const parsed = FollowUpInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("follow_ups").insert({
    org_id: ctx.orgId,
    user_id: ctx.profile.id,
    entity_type: parsed.data.entity_type,
    entity_id: parsed.data.entity_id,
    title: parsed.data.title,
    notes: parsed.data.notes || null,
    due_at: parsed.data.due_at,
    created_by: ctx.profile.id,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const MoveInput = z.object({
  deal_id: z.string().uuid(),
  to_stage_id: z.string().uuid(),
});

export async function moveDealToStage(input: z.infer<typeof MoveInput>) {
  const parsed = MoveInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const { data: prior } = await ctx.supabase
    .from("deals")
    .select("id, stage_id, status, value, currency")
    .eq("id", parsed.data.deal_id)
    .maybeSingle();
  if (!prior) return { ok: false as const, error: "Deal not found" };

  const { data: nextStage } = await ctx.supabase
    .from("pipeline_stages")
    .select("id, name, is_won, is_lost")
    .eq("id", parsed.data.to_stage_id)
    .maybeSingle();
  if (!nextStage) return { ok: false as const, error: "Stage not found" };

  const update: Record<string, unknown> = {
    stage_id: parsed.data.to_stage_id,
    stage_entered_at: new Date().toISOString(),
  };
  if (nextStage.is_won) {
    update.status = "won";
    update.closed_at = new Date().toISOString();
  } else if (nextStage.is_lost) {
    update.status = "lost";
    update.closed_at = new Date().toISOString();
  } else {
    update.status = "open";
    update.closed_at = null;
  }

  const { error } = await ctx.supabase
    .from("deals")
    .update(update)
    .eq("id", parsed.data.deal_id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "deal",
    entityId: parsed.data.deal_id,
    action: "stage_move",
    diff: { from_stage: prior.stage_id, to_stage: parsed.data.to_stage_id, status: update.status },
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const DealInput = z.object({
  pipeline_id: z.string().uuid("Invalid pipeline"),
  stage_id: z.string().uuid("Please select a stage"),
  title: z.string().trim().min(1, "Title is required").max(200),
  value: z.coerce.number().min(0).default(0),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  expected_close_date: z.string().optional().or(z.literal("")),
});

export async function createDeal(input: z.infer<typeof DealInput>) {
  const parsed = DealInput.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Validation failed";
    return { ok: false as const, error: msg, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const ctx = await getContext();
  const row: Record<string, unknown> = {
    org_id: ctx.orgId,
    pipeline_id: parsed.data.pipeline_id,
    stage_id: parsed.data.stage_id,
    title: parsed.data.title,
    value: parsed.data.value,
    currency: ctx.organization?.currency ?? "INR",
    contact_id: parsed.data.contact_id || null,
    company_id: parsed.data.company_id || null,
    expected_close_date: parsed.data.expected_close_date || null,
    owner_id: ctx.profile.id,
    created_by: ctx.profile.id,
    status: "open",
    stage_entered_at: new Date().toISOString(),
  };
  const { data, error } = await ctx.supabase
    .from("deals")
    .insert(row as never)
    .select(`
      id, title, value, currency, stage_id, status,
      expected_close_date, stage_entered_at, created_at,
      tags, contact_id, company_id, owner_id,
      owner:profiles!deals_owner_id_fkey(full_name),
      contact:contacts(first_name, last_name),
      company:companies!deals_company_id_fkey(name)
    `)
    .single();

  if (error) {
    console.error("[createDeal] insert error:", error);
    return { ok: false as const, error: `${error.message}${error.details ? " — " + error.details : ""}${error.hint ? " (" + error.hint + ")" : ""}` };
  }

  const inserted = data as { id: string } & Record<string, unknown>;

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "deal",
    entityId: inserted.id,
    action: "create",
    diff: row,
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const, data: inserted };
}

const UpdateDealInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  value: z.coerce.number().min(0).optional(),
  contact_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  stage_id: z.string().uuid().optional(),
});

export async function updateDeal(input: z.infer<typeof UpdateDealInput>) {
  const parsed = UpdateDealInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Validation failed" };

  const ctx = await getContext();
  const { id, ...fields } = parsed.data;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }

  if (update.status === "won" || update.status === "lost") {
    update.closed_at = new Date().toISOString();
  }
  if (update.status === "open") {
    update.closed_at = null;
  }
  if (update.stage_id) {
    update.stage_entered_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) return { ok: true as const };

  const { error } = await ctx.supabase.from("deals").update(update).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "deal",
    entityId: id,
    action: "update",
    diff: update,
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const CreatePipelineInput = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function createPipeline(input: z.infer<typeof CreatePipelineInput>) {
  const parsed = CreatePipelineInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Name is required" };

  const ctx = await getContext();

  const { data: existing } = await ctx.supabase
    .from("pipelines")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("archived", false)
    .limit(1);

  const isFirst = !existing || existing.length === 0;

  const { data, error } = await ctx.supabase
    .from("pipelines")
    .insert({
      org_id: ctx.orgId,
      name: parsed.data.name,
      is_default: isFirst,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  const defaultStages = [
    { name: "New", probability: 10, position: 0, is_won: false, is_lost: false },
    { name: "Qualified", probability: 30, position: 1, is_won: false, is_lost: false },
    { name: "Proposal", probability: 60, position: 2, is_won: false, is_lost: false },
    { name: "Negotiation", probability: 80, position: 3, is_won: false, is_lost: false },
    { name: "Won", probability: 100, position: 4, is_won: true, is_lost: false },
    { name: "Lost", probability: 0, position: 5, is_won: false, is_lost: true },
  ];

  await ctx.supabase.from("pipeline_stages").insert(
    defaultStages.map((s) => ({
      org_id: ctx.orgId,
      pipeline_id: data.id as string,
      ...s,
    })),
  );

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline",
    entityId: data.id as string,
    action: "create",
    diff: { name: parsed.data.name },
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const, data: { id: data.id as string } };
}

const UpdatePipelineInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  is_default: z.boolean().optional(),
});

export async function updatePipeline(input: z.infer<typeof UpdatePipelineInput>) {
  const parsed = UpdatePipelineInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Validation failed" };

  const ctx = await getContext();
  const { id, ...fields } = parsed.data;

  if (fields.is_default) {
    await ctx.supabase
      .from("pipelines")
      .update({ is_default: false })
      .eq("org_id", ctx.orgId);
  }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }

  if (Object.keys(update).length === 0) return { ok: true as const };

  const { error } = await ctx.supabase.from("pipelines").update(update).eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline",
    entityId: id,
    action: "update",
    diff: update,
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const ArchivePipelineInput = z.object({
  id: z.string().uuid(),
});

export async function archivePipeline(input: z.infer<typeof ArchivePipelineInput>) {
  const parsed = ArchivePipelineInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const { data: pipeline } = await ctx.supabase
    .from("pipelines")
    .select("id, is_default")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!pipeline) return { ok: false as const, error: "Pipeline not found" };
  if (pipeline.is_default) return { ok: false as const, error: "Cannot archive the default pipeline" };

  const { error } = await ctx.supabase
    .from("pipelines")
    .update({ archived: true })
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline",
    entityId: parsed.data.id,
    action: "archive",
    diff: {},
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const CreateStageInput = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  probability: z.coerce.number().min(0).max(100).default(0),
  position: z.coerce.number().min(0),
});

export async function createStage(input: z.infer<typeof CreateStageInput>) {
  const parsed = CreateStageInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Validation failed" };

  const ctx = await getContext();

  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .insert({
      org_id: ctx.orgId,
      pipeline_id: parsed.data.pipeline_id,
      name: parsed.data.name,
      probability: parsed.data.probability,
      position: parsed.data.position,
      is_won: false,
      is_lost: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline_stage",
    entityId: data.id as string,
    action: "create",
    diff: { name: parsed.data.name, pipeline_id: parsed.data.pipeline_id },
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const, data: { id: data.id as string } };
}

const UpdateStageInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
});

export async function updateStage(input: z.infer<typeof UpdateStageInput>) {
  const parsed = UpdateStageInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Validation failed" };

  const ctx = await getContext();
  const { id, ...fields } = parsed.data;

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) update[k] = v;
  }

  if (fields.is_won) {
    update.is_lost = false;
    update.probability = 100;
  }
  if (fields.is_lost) {
    update.is_won = false;
    update.probability = 0;
  }

  if (Object.keys(update).length === 0) return { ok: true as const };

  const { error } = await ctx.supabase
    .from("pipeline_stages")
    .update(update)
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline_stage",
    entityId: id,
    action: "update",
    diff: update,
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const DeleteStageInput = z.object({
  id: z.string().uuid(),
});

export async function deleteStage(input: z.infer<typeof DeleteStageInput>) {
  const parsed = DeleteStageInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const { count } = await ctx.supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", parsed.data.id);

  if (count && count > 0) {
    return { ok: false as const, error: `Cannot delete stage with ${count} deal${count > 1 ? "s" : ""}. Move or delete them first.` };
  }

  const { error } = await ctx.supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline_stage",
    entityId: parsed.data.id,
    action: "delete",
    diff: {},
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}

const ReorderStagesInput = z.object({
  pipeline_id: z.string().uuid(),
  stage_ids: z.array(z.string().uuid()).min(1),
});

export async function reorderStages(input: z.infer<typeof ReorderStagesInput>) {
  const parsed = ReorderStagesInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const updates = parsed.data.stage_ids.map((id, idx) =>
    ctx.supabase.from("pipeline_stages").update({ position: idx }).eq("id", id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false as const, error: failed.error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "pipeline",
    entityId: parsed.data.pipeline_id,
    action: "reorder_stages",
    diff: { stage_ids: parsed.data.stage_ids },
  });

  revalidatePath("/crm/pipelines");
  return { ok: true as const };
}
