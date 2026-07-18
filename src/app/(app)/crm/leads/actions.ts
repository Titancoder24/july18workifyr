"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const LeadStatus = z.enum(["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"]);
const LeadSource = z.enum(["website", "referral", "linkedin", "cold_call", "advertisement", "trade_show", "other"]);

const CreateLeadInput = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  company_name: z.string().trim().max(200).optional().or(z.literal("")),
  source: LeadSource.default("other"),
  status: LeadStatus.default("new"),
  owner_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createLead(input: z.infer<typeof CreateLeadInput>) {
  const parsed = CreateLeadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const ctx = await getContext();
  const row = {
    org_id: ctx.orgId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    company_name: parsed.data.company_name || null,
    source: parsed.data.source,
    status: parsed.data.status,
    owner_id: parsed.data.owner_id || ctx.profile.id,
    notes: parsed.data.notes || null,
  };
  const { data, error } = await ctx.supabase.from("leads").insert(row).select("id").single();
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "lead",
    entityId: data.id as string,
    action: "create",
    diff: row,
  });

  revalidatePath("/crm/leads");
  return { ok: true as const, data: { id: data.id as string } };
}

const UpdateLeadInput = z.object({
  lead_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  company_name: z.string().trim().max(200).optional().or(z.literal("")),
  source: LeadSource,
  status: LeadStatus,
  owner_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function updateLead(input: z.infer<typeof UpdateLeadInput>) {
  const parsed = UpdateLeadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const ctx = await getContext();
  const { lead_id, ...fields } = parsed.data;

  const update = {
    first_name: fields.first_name,
    last_name: fields.last_name,
    email: fields.email,
    phone: fields.phone || null,
    company_name: fields.company_name || null,
    source: fields.source,
    status: fields.status,
    owner_id: fields.owner_id || null,
    notes: fields.notes || null,
  };

  const { error } = await ctx.supabase.from("leads").update(update).eq("id", lead_id);
  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "lead",
    entityId: lead_id,
    action: "update",
    diff: update,
  });

  revalidatePath("/crm/leads");
  return { ok: true as const };
}

const MoveLeadInput = z.object({
  lead_id: z.string().uuid(),
  to_status: LeadStatus,
});

export async function moveLeadStatus(input: z.infer<typeof MoveLeadInput>) {
  const parsed = MoveLeadInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const { data: prior } = await ctx.supabase
    .from("leads")
    .select("id, status")
    .eq("id", parsed.data.lead_id)
    .maybeSingle();
  if (!prior) return { ok: false as const, error: "Lead not found" };

  const { error } = await ctx.supabase
    .from("leads")
    .update({ status: parsed.data.to_status })
    .eq("id", parsed.data.lead_id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "lead",
    entityId: parsed.data.lead_id,
    action: "status_move",
    diff: { from_status: prior.status, to_status: parsed.data.to_status },
  });

  revalidatePath("/crm/leads");
  return { ok: true as const };
}

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
  revalidatePath("/crm/leads");
  return { ok: true as const };
}

const ConvertInput = z.object({
  lead_id: z.string().uuid(),
});

export async function convertToDeal(input: z.infer<typeof ConvertInput>) {
  const parsed = ConvertInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };

  const ctx = await getContext();

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("id, first_name, last_name, company_name, status, converted_at")
    .eq("id", parsed.data.lead_id)
    .maybeSingle();
  if (!lead) return { ok: false as const, error: "Lead not found" };
  if (lead.converted_at) return { ok: false as const, error: "Lead already converted" };

  const { error } = await ctx.supabase
    .from("leads")
    .update({
      status: "won",
      converted_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.lead_id);

  if (error) return { ok: false as const, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "lead",
    entityId: parsed.data.lead_id,
    action: "convert",
    diff: { converted_at: new Date().toISOString() },
  });

  revalidatePath("/crm/leads");
  return { ok: true as const };
}
