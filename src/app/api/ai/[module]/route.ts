import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { openrouter, pickModel } from "@/lib/ai/client";
import { crmSystemPrompt, hrmSystemPrompt, type AssistantContext } from "@/lib/ai/contexts";
import { crmTools, runCrmTool } from "@/lib/ai/tools/crm-tools";
import { hrmTools, runHrmTool } from "@/lib/ai/tools/hrm-tools";
import { checkRateLimit, flagInjection, scrubOutput } from "@/lib/ai/guardrails";
import { createClient } from "@/lib/supabase/server";
import type OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool"]),
    content: z.string().or(z.record(z.string(), z.unknown())),
    tool_call_id: z.string().optional(),
  })).min(1),
  focus: z.object({
    kind: z.enum(["contact", "deal", "employee", "pipeline"]),
    id: z.string(),
    label: z.string(),
  }).optional(),
});

/** Rough USD cost per 1k tokens. Tracks Gemma 4 31B Instruct via OpenRouter. */
const COST_PER_1K = { input: 0.0001, output: 0.0003 } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ module: string }> }) {
  const { module } = await ctx.params;
  if (module !== "crm" && module !== "hrm") {
    return NextResponse.json({ error: "unknown module" }, { status: 404 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, org_id, organizations(name, currency, timezone)")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) return NextResponse.json({ error: "no organization" }, { status: 403 });

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("roles!inner(key)")
    .eq("user_id", user.id);
  const userRoles = (roleRows ?? []).map((r: { roles: { key: string } | { key: string }[] }) => {
    const roles = Array.isArray(r.roles) ? r.roles[0] : r.roles;
    return roles?.key;
  }).filter(Boolean) as string[];

  // Per-user rate limit.
  const rl = checkRateLimit(profile.org_id, user.id);
  if (!rl.ok) return NextResponse.json({ error: rl.reason }, { status: 429 });

  // Prompt-injection scan.
  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  if (lastUser && typeof lastUser.content === "string") {
    const flag = flagInjection(lastUser.content);
    if (flag.flagged) {
      return NextResponse.json(
        { error: "prompt_injection_detected", reason: flag.reason },
        { status: 400 },
      );
    }
  }

  const orgRaw = (profile as { organizations?: unknown }).organizations;
  const orgRow = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { name?: string; currency?: string; timezone?: string } | null;
  const assistantContext: AssistantContext = {
    orgName: orgRow?.name ?? "Workifyr",
    userName: profile.full_name ?? user.email ?? "Member",
    userRoles,
    currency: orgRow?.currency ?? "INR",
    timezone: orgRow?.timezone ?? "Asia/Kolkata",
    focus: parsed.data.focus,
  };

  const system = module === "crm" ? crmSystemPrompt(assistantContext) : hrmSystemPrompt(assistantContext);
  const tools = module === "crm" ? crmTools : hrmTools;
  const runTool = module === "crm" ? runCrmTool : runHrmTool;

  // Resolve / create the persisted conversation.
  let conversationId = parsed.data.conversationId ?? null;
  if (!conversationId) {
    const lastUserText = lastUser && typeof lastUser.content === "string" ? lastUser.content : "New conversation";
    const title = lastUserText.slice(0, 80);
    const { data: created } = await supabase
      .from("ai_conversations")
      .insert({
        org_id: profile.org_id,
        user_id: user.id,
        module,
        title,
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = (created?.id as string) ?? null;
  }

  // Persist the latest user message (only insert what's new — the client always
  // posts the full transcript, so we look at the tail).
  if (conversationId && lastUser && typeof lastUser.content === "string") {
    await supabase.from("ai_messages").insert({
      org_id: profile.org_id,
      conversation_id: conversationId,
      role: "user",
      content: { text: lastUser.content },
    });
    await supabase
      .from("ai_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Surface the conversation id to the client so it can thread subsequent calls.
      if (conversationId) send("conversation", { id: conversationId });

      let totalIn = 0;
      let totalOut = 0;
      let finalAssistantText = "";
      const persistedToolEvents: Array<{ id: string; name: string; args: string; result: unknown }> = [];

      try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: system },
          ...parsed.data.messages.map((m) => {
            const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            if (m.role === "tool" && m.tool_call_id) {
              return { role: "tool" as const, tool_call_id: m.tool_call_id, content };
            }
            return { role: m.role as "user" | "assistant" | "system", content };
          }),
        ];

        const model = pickModel();

        for (let i = 0; i < 6; i++) {
          const completion = await openrouter.chat.completions.create({
            model,
            messages,
            tools,
            tool_choice: "auto",
            stream: true,
            stream_options: { include_usage: true },
          });

          let assistantText = "";
          const toolCalls: Record<number, { id: string; name: string; args: string }> = {};

          for await (const chunk of completion) {
            const delta = chunk.choices?.[0]?.delta;
            const usage = chunk.usage;
            if (usage) {
              totalIn += usage.prompt_tokens ?? 0;
              totalOut += usage.completion_tokens ?? 0;
            }
            if (!delta) continue;
            if (typeof delta.content === "string" && delta.content.length > 0) {
              assistantText += delta.content;
              send("token", { text: delta.content });
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const cur = toolCalls[idx] ?? { id: "", name: "", args: "" };
                if (tc.id) cur.id = tc.id;
                if (tc.function?.name) cur.name = tc.function.name;
                if (tc.function?.arguments) cur.args += tc.function.arguments;
                toolCalls[idx] = cur;
              }
            }
          }

          const calls = Object.values(toolCalls).filter((c) => c.name);
          if (calls.length === 0) {
            finalAssistantText = scrubOutput(assistantText);
            send("done", { text: finalAssistantText });
            break;
          }

          messages.push({
            role: "assistant",
            content: assistantText || null,
            tool_calls: calls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.args || "{}" },
            })),
          });

          for (const c of calls) {
            send("tool_call", { id: c.id, name: c.name, args: c.args });
            let result: unknown;
            try {
              const parsedArgs = JSON.parse(c.args || "{}");
              result = await runTool(supabase, c.name, parsedArgs);
            } catch (err) {
              result = { error: err instanceof Error ? err.message : "tool_failed" };
            }
            send("tool_result", { id: c.id, result });
            persistedToolEvents.push({ id: c.id, name: c.name, args: c.args, result });
            messages.push({
              role: "tool",
              tool_call_id: c.id,
              content: JSON.stringify(result),
            });
          }
        }

        // Persist the assistant turn + usage. Best-effort, never fails the stream.
        if (conversationId) {
          await supabase.from("ai_messages").insert({
            org_id: profile.org_id,
            conversation_id: conversationId,
            role: "assistant",
            content: { text: finalAssistantText, tool_events: persistedToolEvents },
            model,
            tokens_in: totalIn,
            tokens_out: totalOut,
          });

          if (totalIn || totalOut) {
            const cost = (totalIn / 1000) * COST_PER_1K.input + (totalOut / 1000) * COST_PER_1K.output;
            await supabase.from("ai_usage").insert({
              org_id: profile.org_id,
              user_id: user.id,
              conversation_id: conversationId,
              module,
              model,
              tokens_in: totalIn,
              tokens_out: totalOut,
              cost_usd: cost,
            });
          }

          await supabase.from("audit_log").insert({
            org_id: profile.org_id,
            actor_id: user.id,
            entity: `ai.${module}`,
            entity_id: null,
            action: "tool_call",
            meta: {
              conversation_id: conversationId,
              tool_events: persistedToolEvents.map((e) => ({ name: e.name })),
              tokens_in: totalIn,
              tokens_out: totalOut,
            },
          });
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "ai_failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
