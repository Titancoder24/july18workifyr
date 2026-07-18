"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/server/context";
import { audit } from "@/lib/server/audit";

const ContactInput = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  position: z.string().trim().max(80).optional().or(z.literal("")),
  company_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof ContactInput>;

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createContact(input: ContactInput): Promise<ActionResult<{ id: string }>> {
  const parsed = ContactInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const ctx = await getContext();
  const row = {
    org_id: ctx.orgId,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    position: parsed.data.position || null,
    company_id: parsed.data.company_id || null,
    notes: parsed.data.notes || null,
    owner_id: ctx.profile.id,
    created_by: ctx.profile.id,
  };

  const { data, error } = await ctx.supabase.from("contacts").insert(row).select("id").single();
  if (error) return { ok: false, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "contact",
    entityId: data.id as string,
    action: "create",
    diff: row,
  });

  revalidatePath("/crm/contacts");
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const ctx = await getContext();
  const { error } = await ctx.supabase.from("contacts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await audit(ctx.supabase, {
    orgId: ctx.orgId,
    actorId: ctx.profile.id,
    entity: "contact",
    entityId: id,
    action: "delete",
  });

  revalidatePath("/crm/contacts");
  return { ok: true };
}
