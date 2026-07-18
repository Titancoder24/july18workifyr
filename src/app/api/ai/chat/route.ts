import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_PER_1K = { input: 0.0001, output: 0.0003 } as const;

type SvcClient = ReturnType<typeof createServiceClient>;

async function buildCrmContext(svc: SvcClient, orgId: string) {
  const [
    leadsRes,
    dealsRes,
    contactsRes,
    companiesRes,
    invoicesRes,
    quotationsRes,
    tasksRes,
    pipelinesRes,
  ] = await Promise.all([
    svc.from("leads").select("status").eq("org_id", orgId),
    svc.from("deals").select("status, value").eq("org_id", orgId),
    svc.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    svc.from("companies").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    svc.from("invoices").select("status, total").eq("org_id", orgId),
    svc.from("quotations").select("status").eq("org_id", orgId),
    svc.from("tasks").select("status").eq("org_id", orgId),
    svc.from("pipelines").select("id, name, pipeline_stages(name, position)").eq("org_id", orgId),
  ]);

  const leads = (leadsRes.data ?? []) as { status: string }[];
  const leadsByStatus: Record<string, number> = {};
  for (const l of leads) {
    leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1;
  }

  const deals = (dealsRes.data ?? []) as { status: string; value: number | string | null }[];
  const dealsByStatus: Record<string, number> = {};
  let totalDealValue = 0;
  for (const d of deals) {
    dealsByStatus[d.status] = (dealsByStatus[d.status] || 0) + 1;
    totalDealValue += Number(d.value) || 0;
  }
  const avgDealValue = deals.length > 0 ? totalDealValue / deals.length : 0;

  const invoices = (invoicesRes.data ?? []) as { status: string; total: number | string | null }[];
  const invoicesByStatus: Record<string, number> = {};
  let totalRevenue = 0;
  for (const inv of invoices) {
    invoicesByStatus[inv.status] = (invoicesByStatus[inv.status] || 0) + 1;
    if (inv.status === "paid") totalRevenue += Number(inv.total) || 0;
  }

  const quotations = (quotationsRes.data ?? []) as { status: string }[];
  const quotationsByStatus: Record<string, number> = {};
  for (const q of quotations) {
    quotationsByStatus[q.status] = (quotationsByStatus[q.status] || 0) + 1;
  }

  const tasks = (tasksRes.data ?? []) as { status: string }[];
  const tasksByStatus: Record<string, number> = {};
  for (const t of tasks) {
    tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
  }

  const rawPipelines = (pipelinesRes.data ?? []) as {
    name: string;
    pipeline_stages: { name: string; position: number }[] | null;
  }[];
  const pipelines = rawPipelines.map((p) => ({
    name: p.name,
    stages: (p.pipeline_stages ?? [])
      .sort((a, b) => a.position - b.position)
      .map((s) => s.name),
  }));

  const lines: string[] = [];
  lines.push("## CRM Data Summary");
  lines.push(`- Leads (${leads.length} total): ${JSON.stringify(leadsByStatus)}`);
  lines.push(`- Deals (${deals.length} total): ${JSON.stringify(dealsByStatus)}, total value: ${totalDealValue.toFixed(2)}, avg value: ${avgDealValue.toFixed(2)}`);
  lines.push(`- Contacts: ${contactsRes.count ?? 0}`);
  lines.push(`- Companies: ${companiesRes.count ?? 0}`);
  lines.push(`- Invoices (${invoices.length} total): ${JSON.stringify(invoicesByStatus)}, paid revenue: ${totalRevenue.toFixed(2)}`);
  lines.push(`- Quotations (${quotations.length} total): ${JSON.stringify(quotationsByStatus)}`);
  lines.push(`- Tasks (${tasks.length} total): ${JSON.stringify(tasksByStatus)}`);
  if (pipelines.length > 0) {
    lines.push("- Pipelines:");
    for (const p of pipelines) {
      lines.push(`  - ${p.name}: ${p.stages.join(" -> ")}`);
    }
  }
  return lines.join("\n");
}

async function buildHrmContext(svc: SvcClient, orgId: string) {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [
    employeesRes,
    attendanceRes,
    pendingLeaveRes,
    approvedLeaveRes,
    payrollRes,
    perfCyclesRes,
    announcementsRes,
  ] = await Promise.all([
    svc.from("employees").select("id, department_id").eq("org_id", orgId),
    svc.from("attendance").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("date", today),
    svc.from("leave_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    svc.from("leave_requests").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "approved").gte("created_at", monthStart),
    svc.from("payroll_runs").select("id, status, period_start, period_end").eq("org_id", orgId).order("created_at", { ascending: false }).limit(1),
    svc.from("performance_cycles").select("id, name, status").eq("org_id", orgId).eq("status", "active"),
    svc.from("announcements").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", monthStart),
  ]);

  const employees = (employeesRes.data ?? []) as { id: string; department_id: string | null }[];
  const byDept: Record<string, number> = {};
  for (const e of employees) {
    const key = e.department_id ?? "unassigned";
    byDept[key] = (byDept[key] || 0) + 1;
  }

  const payrollRows = (payrollRes.data ?? []) as { id: string; status: string; period_start: string; period_end: string }[];
  const latestPayroll = payrollRows[0] ?? null;
  const activeCycles = (perfCyclesRes.data ?? []) as { id: string; name: string; status: string }[];

  const lines: string[] = [];
  lines.push("## HRM Data Summary");
  lines.push(`- Employees: ${employees.length} total, by department: ${JSON.stringify(byDept)}`);
  lines.push(`- Today's attendance: ${attendanceRes.count ?? 0}`);
  lines.push(`- Leave requests: ${pendingLeaveRes.count ?? 0} pending, ${approvedLeaveRes.count ?? 0} approved this month`);
  if (latestPayroll) {
    lines.push(`- Latest payroll run: status=${latestPayroll.status}, period=${latestPayroll.period_start} to ${latestPayroll.period_end}`);
  } else {
    lines.push("- Payroll: no runs found");
  }
  lines.push(`- Active performance cycles: ${activeCycles.length}${activeCycles.length > 0 ? " (" + activeCycles.map((c) => c.name).join(", ") + ")" : ""}`);
  lines.push(`- Announcements this month: ${announcementsRes.count ?? 0}`);
  return lines.join("\n");
}

function buildSystemPrompt(
  module: "crm" | "hrm",
  userName: string,
  userRole: string,
  dataSummary: string,
): string {
  const today = new Date().toISOString().split("T")[0];
  const moduleFocus =
    module === "crm"
      ? "Focus on sales performance, lead conversion, pipeline health, revenue trends, deal velocity, and customer relationship management. Provide actionable insights to help close more deals and grow revenue."
      : "Focus on workforce management, attendance patterns, leave utilization, payroll accuracy, employee performance, and team productivity. Provide actionable insights to help manage and grow the team.";

  return [
    "You are Workifyr AI, a business intelligence assistant for the Workifyr CRM+HRM platform.",
    `Today's date: ${today}.`,
    `User: ${userName} (role: ${userRole}).`,
    "",
    dataSummary,
    "",
    "Instructions:",
    "- Answer questions about the data above, generate insights, and suggest improvements.",
    "- Format responses using markdown: use headers, bullet lists, and tables when presenting data.",
    "- Be concise but thorough. If asked about data not available, say so.",
    `- ${moduleFocus}`,
    "- Do not fabricate numbers. Only reference data provided in the summary.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "AI service is not configured" },
        { status: 500 },
      );
    }

    const body = await req.json();
    const message: string = body.message;
    const module: "crm" | "hrm" = body.module;
    let conversationId: string | null = body.conversation_id ?? null;

    if (!message || !module || (module !== "crm" && module !== "hrm")) {
      return NextResponse.json(
        { error: "message and module (crm|hrm) are required" },
        { status: 400 },
      );
    }

    const svc = createServiceClient();

    const { data: profile } = await svc
      .from("profiles")
      .select("id, full_name, org_id")
      .eq("id", user.id)
      .single();

    const profileRow = profile as { id: string; full_name: string | null; org_id: string | null } | null;

    if (!profileRow?.org_id) {
      return NextResponse.json({ error: "no organization" }, { status: 403 });
    }

    const orgId = profileRow.org_id;
    const userName = profileRow.full_name ?? user.email ?? "User";

    const { data: roleRows } = await svc
      .from("user_roles")
      .select("roles!inner(key)")
      .eq("user_id", user.id);
    const roles = (roleRows ?? [])
      .map((r: { roles: { key: string } | { key: string }[] }) => {
        const inner = Array.isArray(r.roles) ? r.roles[0] : r.roles;
        return inner?.key;
      })
      .filter(Boolean) as string[];
    const userRole = roles.includes("owner") ? "owner" : roles.includes("admin") ? "admin" : roles[0] ?? "member";

    const dataSummary =
      module === "crm"
        ? await buildCrmContext(svc, orgId)
        : await buildHrmContext(svc, orgId);

    const systemPrompt = buildSystemPrompt(module, userName, userRole, dataSummary);

    if (!conversationId) {
      const title = message.slice(0, 50);
      const { data: created } = await svc
        .from("ai_conversations")
        .insert({
          org_id: orgId,
          user_id: user.id,
          module,
          title,
          last_message_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .select("id")
        .single();
      conversationId = (created as { id: string } | null)?.id ?? null;
    }

    let historyMessages: { role: string; content: string }[] = [];
    if (conversationId) {
      const { data: history } = await svc
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20);

      const rows = (history ?? []) as { role: string; content: unknown }[];
      historyMessages = rows.map((m) => ({
        role: m.role,
        content:
          typeof m.content === "object" && m.content !== null
            ? (m.content as { text?: string }).text ?? JSON.stringify(m.content)
            : String(m.content),
      }));
    }

    if (conversationId) {
      await svc.from("ai_messages").insert({
        org_id: orgId,
        conversation_id: conversationId,
        role: "user",
        content: { text: message },
      } as Record<string, unknown>);
    }

    const savedConversationId = conversationId;

    const openrouterPayload = {
      model: `${process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it"}`,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
      stream: true,
      max_tokens: 2048,
    };

    const openrouterResponse = await fetch(
      `${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_APP_URL || "",
          "X-Title": process.env.OPENROUTER_APP_NAME || "",
        },
        body: JSON.stringify(openrouterPayload),
      },
    );

    if (!openrouterResponse.ok) {
      const errText = await openrouterResponse.text();
      return NextResponse.json(
        { error: "OpenRouter API error", details: errText },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          if (savedConversationId) {
            send({ type: "conversation_id", value: savedConversationId });
          }

          let fullResponse = "";
          let tokensIn = 0;
          let tokensOut = 0;

          const reader = openrouterResponse.body?.getReader();
          if (!reader) {
            send({ type: "error", value: "No response stream from AI provider" });
            controller.close();
            return;
          }

          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const payload = trimmed.slice(6);
              if (payload === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  fullResponse += delta.content;
                  send({ type: "chunk", value: delta.content });
                }
                if (parsed.usage) {
                  tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
                  tokensOut = parsed.usage.completion_tokens ?? tokensOut;
                }
              } catch {
                // skip malformed chunks
              }
            }
          }

          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  fullResponse += delta.content;
                  send({ type: "chunk", value: delta.content });
                }
                if (parsed.usage) {
                  tokensIn = parsed.usage.prompt_tokens ?? tokensIn;
                  tokensOut = parsed.usage.completion_tokens ?? tokensOut;
                }
              } catch {
                // skip
              }
            }
          }

          send({ type: "done", tokens_in: tokensIn, tokens_out: tokensOut });

          if (savedConversationId) {
            const model = `${process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it"}`;

            await svc.from("ai_messages").insert({
              org_id: orgId,
              conversation_id: savedConversationId,
              role: "assistant",
              content: { text: fullResponse },
              model,
              tokens_in: tokensIn,
              tokens_out: tokensOut,
            } as Record<string, unknown>);

            await svc
              .from("ai_conversations")
              .update({ last_message_at: new Date().toISOString() } as Record<string, unknown>)
              .eq("id", savedConversationId);

            if (tokensIn || tokensOut) {
              const cost =
                (tokensIn / 1000) * COST_PER_1K.input +
                (tokensOut / 1000) * COST_PER_1K.output;
              await svc.from("ai_usage").insert({
                org_id: orgId,
                user_id: user.id,
                conversation_id: savedConversationId,
                module,
                model,
                tokens_in: tokensIn,
                tokens_out: tokensOut,
                cost_usd: cost,
              } as Record<string, unknown>);
            }
          }
        } catch (err) {
          send({
            type: "error",
            value: err instanceof Error ? err.message : "An unexpected error occurred",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
