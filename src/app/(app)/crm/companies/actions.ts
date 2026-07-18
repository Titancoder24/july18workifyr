"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const Input = z.object({
  name: z.string().trim().min(1).max(120),
  domain: z.string().trim().max(120).optional().or(z.literal("")),
  industry: z.string().trim().max(80).optional().or(z.literal("")),
  size_band: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CompanyInput = z.infer<typeof Input>;

export async function createCompany(input: CompanyInput) {
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const ctx = await getContext();
  const row = {
    org_id: ctx.orgId,
    name: parsed.data.name,
    domain: parsed.data.domain || null,
    industry: parsed.data.industry || null,
    size_band: parsed.data.size_band || null,
    website: parsed.data.website || null,
    phone: parsed.data.phone || null,
    notes: parsed.data.notes || null,
    owner_id: ctx.profile.id,
    created_by: ctx.profile.id,
  };
  const { data, error } = await ctx.supabase.from("companies").insert(row).select("id").single();
  if (error) return { ok: false as const, error: error.message };
  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "company",
    entityId: data.id as string,
    action: "create",
    diff: row,
  });
  revalidatePath("/crm/companies");
  return { ok: true as const, data: { id: data.id as string } };
}
