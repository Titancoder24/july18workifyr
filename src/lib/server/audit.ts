import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append an audit log row. Best-effort — never fails the parent mutation,
 * because RLS already guarantees the parent ran with proper authorization.
 */
export async function audit(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    actorId: string;
    entity: string;
    entityId?: string | null;
    action: string;
    diff?: unknown;
    meta?: unknown;
  },
) {
  try {
    await supabase.from("audit_log").insert({
      org_id: args.orgId,
      actor_id: args.actorId,
      entity: args.entity,
      entity_id: args.entityId ?? null,
      action: args.action,
      diff: args.diff ?? null,
      meta: args.meta ?? null,
    });
  } catch {
    // Swallow — never let audit failures cascade.
  }
}
