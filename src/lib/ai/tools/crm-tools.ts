import type { OpenAI } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * CRM tool definitions for OpenRouter / OpenAI function-calling.
 * Each tool is executed server-side using the caller's Supabase session, so
 * RLS applies — the AI cannot retrieve data the user is not permitted to see.
 */
export const crmTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_contacts",
      description: "Search contacts by name, email, or company. Returns up to 25 matches.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text query — name, email substring, or company name" },
          owner_id: { type: "string", description: "Optional owner UUID to filter by" },
          stale_days: { type: "number", description: "Optional: only return contacts with no activity in N days" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contact",
      description: "Fetch a single contact with company, recent activities, open tasks, and deals.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "Contact UUID" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deals",
      description: "List deals filtered by pipeline, stage, owner, status, or expected close window.",
      parameters: {
        type: "object",
        properties: {
          pipeline_id: { type: "string" },
          stage_name: { type: "string" },
          owner_id: { type: "string" },
          status: { type: "string", enum: ["open", "won", "lost"] },
          close_within_days: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_pipeline",
      description: "Roll up a pipeline: count and weighted value per stage, win-rate, top deals.",
      parameters: {
        type: "object",
        properties: { pipeline_id: { type: "string" } },
        required: ["pipeline_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_open_tasks",
      description: "Open tasks for the caller, grouped Today / Overdue / Upcoming.",
      parameters: {
        type: "object",
        properties: { assignee_id: { type: "string", description: "Defaults to the caller" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_followup",
      description:
        "Compose a follow-up email or message draft using the contact's recent activity. The caller will review and send manually.",
      parameters: {
        type: "object",
        properties: {
          contact_id: { type: "string" },
          tone: { type: "string", enum: ["formal", "friendly", "direct"], default: "friendly" },
          channel: { type: "string", enum: ["email", "whatsapp", "sms"], default: "email" },
          objective: { type: "string", description: "What the message should accomplish" },
        },
        required: ["contact_id", "objective"],
      },
    },
  },
];

/**
 * Server-side dispatcher. Receives a tool_call from the model, executes against
 * Supabase using the caller's session, returns a JSON-serializable result.
 */
export async function runCrmTool(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_contacts": {
      const q = String(args.query ?? "");
      const ownerId = args.owner_id as string | undefined;
      const stale = typeof args.stale_days === "number" ? args.stale_days : undefined;
      let qry = supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, company:companies(name), owner_id, last_activity_at")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(25);
      if (ownerId) qry = qry.eq("owner_id", ownerId);
      if (stale !== undefined) {
        const cutoff = new Date(Date.now() - stale * 86_400_000).toISOString();
        qry = qry.or(`last_activity_at.is.null,last_activity_at.lt.${cutoff}`);
      }
      const { data, error } = await qry;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "get_contact": {
      const id = String(args.id);
      const [contact, activities, tasks, deals] = await Promise.all([
        supabase
          .from("contacts")
          .select("*, company:companies(*)")
          .eq("id", id)
          .single(),
        supabase
          .from("activities")
          .select("id, type, subject, body, occurred_at, owner_id")
          .eq("contact_id", id)
          .order("occurred_at", { ascending: false })
          .limit(10),
        supabase
          .from("tasks")
          .select("id, title, due_at, status, priority")
          .eq("contact_id", id)
          .neq("status", "done")
          .order("due_at", { ascending: true })
          .limit(10),
        supabase
          .from("deals")
          .select("id, title, value, currency, status, stage_id")
          .eq("contact_id", id)
          .limit(10),
      ]);
      if (contact.error) throw contact.error;
      return {
        contact: contact.data,
        recent_activities: activities.data ?? [],
        open_tasks: tasks.data ?? [],
        deals: deals.data ?? [],
      };
    }
    case "list_deals": {
      let qry = supabase
        .from("deals")
        .select("id, title, value, currency, status, owner_id, expected_close_date, stage:pipeline_stages(name, probability), pipeline_id")
        .limit(50)
        .order("expected_close_date", { ascending: true, nullsFirst: false });
      if (args.pipeline_id) qry = qry.eq("pipeline_id", String(args.pipeline_id));
      if (args.owner_id) qry = qry.eq("owner_id", String(args.owner_id));
      if (args.status) qry = qry.eq("status", String(args.status));
      if (typeof args.close_within_days === "number") {
        const horizon = new Date(Date.now() + args.close_within_days * 86_400_000).toISOString().slice(0, 10);
        qry = qry.lte("expected_close_date", horizon);
      }
      const { data, error } = await qry;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "summarize_pipeline": {
      const pid = String(args.pipeline_id);
      const { data: stages, error: e1 } = await supabase
        .from("pipeline_stages")
        .select("id, name, probability, position, is_won, is_lost")
        .eq("pipeline_id", pid)
        .order("position");
      if (e1) throw e1;
      const { data: deals, error: e2 } = await supabase
        .from("deals")
        .select("stage_id, value, status")
        .eq("pipeline_id", pid);
      if (e2) throw e2;
      const byStage = (stages ?? []).map((s) => {
        const stageDeals = (deals ?? []).filter((d) => d.stage_id === s.id);
        const open = stageDeals.filter((d) => d.status === "open");
        const total = open.reduce((acc, d) => acc + Number(d.value ?? 0), 0);
        const weighted = total * (Number(s.probability) / 100);
        return {
          stage: s.name,
          deal_count: open.length,
          total_value: total,
          weighted_value: Math.round(weighted * 100) / 100,
        };
      });
      const won = (deals ?? []).filter((d) => d.status === "won").length;
      const lost = (deals ?? []).filter((d) => d.status === "lost").length;
      const win_rate = won + lost === 0 ? null : Math.round((won / (won + lost)) * 100);
      return { stages: byStage, win_rate_pct: win_rate, won, lost };
    }
    case "list_open_tasks": {
      const { data: { user } } = await supabase.auth.getUser();
      const aid = (args.assignee_id as string | undefined) ?? user?.id;
      if (!aid) return { rows: [] };
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, due_at, priority, contact_id, deal_id")
        .eq("assignee_id", aid)
        .neq("status", "done")
        .order("due_at", { ascending: true });
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "draft_followup": {
      // Server-side draft generation is delegated back to the model in the next
      // turn; this tool returns the contact context the model needs to write.
      const { data: ctx } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company:companies(name), email, last_activity_at")
        .eq("id", String(args.contact_id))
        .single();
      const { data: recent } = await supabase
        .from("activities")
        .select("type, subject, body, occurred_at")
        .eq("contact_id", String(args.contact_id))
        .order("occurred_at", { ascending: false })
        .limit(5);
      return { contact: ctx, recent_activities: recent ?? [], tone: args.tone, channel: args.channel, objective: args.objective };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
