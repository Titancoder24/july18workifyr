"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/server/context";

export async function completeFollowUp(id: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("follow_ups")
    .update({ completed_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crm/follow-ups");
  return { ok: true as const };
}

export async function uncompleteFollowUp(id: string) {
  const ctx = await getContext();
  const { error } = await ctx.supabase
    .from("follow_ups")
    .update({ completed_at: null } as never)
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/crm/follow-ups");
  return { ok: true as const };
}
