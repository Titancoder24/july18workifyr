import type { OpenAI } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export const hrmTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_employees",
      description: "Search employees by name, employee code, department, or email.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          department_id: { type: "string" },
          status: { type: "string", enum: ["active", "on_leave", "exited", "suspended"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employee",
      description: "Fetch an employee profile with department, designation, manager, and current salary structure summary.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "attendance_summary",
      description: "Attendance breakdown for an employee or a department over a date range.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          department_id: { type: "string" },
          from: { type: "string", description: "ISO date YYYY-MM-DD" },
          to: { type: "string", description: "ISO date YYYY-MM-DD" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leave_balance",
      description: "Current leave balances for an employee across all policies.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          year: { type: "number", description: "Defaults to current year" },
        },
        required: ["employee_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_leaves",
      description: "Pending leave requests, optionally filtered by approver or department.",
      parameters: {
        type: "object",
        properties: {
          approver_id: { type: "string" },
          department_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_salary_slip",
      description: "Fetch a salary slip for explanation. Returns earnings, deductions, gross, net.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          year: { type: "number" },
          month: { type: "number" },
        },
        required: ["employee_id", "year", "month"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_leave_decision",
      description:
        "Compose a leave approval or rejection note. Returns text for the human to paste; does not actually approve.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          decision: { type: "string", enum: ["approve", "reject"] },
          reason: { type: "string" },
        },
        required: ["request_id", "decision"],
      },
    },
  },
];

export async function runHrmTool(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_employees": {
      const q = String(args.query ?? "");
      let qry = supabase
        .from("employees")
        .select("id, employee_code, first_name, last_name, email, status, department:departments(name), designation:designations(title)")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,employee_code.ilike.%${q}%`)
        .limit(25);
      if (args.department_id) qry = qry.eq("department_id", String(args.department_id));
      if (args.status) qry = qry.eq("status", String(args.status));
      const { data, error } = await qry;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "get_employee": {
      const id = String(args.id);
      const [emp, structure] = await Promise.all([
        supabase
          .from("employees")
          .select("*, department:departments(name), designation:designations(title), manager:employees!employees_manager_id_fkey(id, first_name, last_name)")
          .eq("id", id)
          .single(),
        supabase
          .from("salary_structures")
          .select("ctc_annual, components, effective_from")
          .eq("employee_id", id)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (emp.error) throw emp.error;
      return { employee: emp.data, current_structure: structure.data };
    }
    case "attendance_summary": {
      const from = String(args.from);
      const to = String(args.to);
      let qry = supabase
        .from("attendance")
        .select("employee_id, date, status, hours_worked")
        .gte("date", from)
        .lte("date", to);
      if (args.employee_id) qry = qry.eq("employee_id", String(args.employee_id));
      const { data, error } = await qry;
      if (error) throw error;
      const summary: Record<string, { present: number; absent: number; leave: number; weekoff: number; half_day: number; hours: number }> = {};
      for (const row of data ?? []) {
        const eid = String(row.employee_id);
        if (!summary[eid]) summary[eid] = { present: 0, absent: 0, leave: 0, weekoff: 0, half_day: 0, hours: 0 };
        const bucket = summary[eid];
        if (row.status === "present") bucket.present++;
        else if (row.status === "absent") bucket.absent++;
        else if (row.status === "leave") bucket.leave++;
        else if (row.status === "weekoff") bucket.weekoff++;
        else if (row.status === "half_day") bucket.half_day++;
        bucket.hours += Number(row.hours_worked ?? 0);
      }
      return { from, to, by_employee: summary };
    }
    case "leave_balance": {
      const eid = String(args.employee_id);
      const year = (args.year as number | undefined) ?? new Date().getFullYear();
      const { data, error } = await supabase
        .from("leave_balances")
        .select("policy:leave_policies(code, name, annual_quota), opening, accrued, used, carried_forward, year")
        .eq("employee_id", eid)
        .eq("year", year);
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "list_pending_leaves": {
      let qry = supabase
        .from("leave_requests")
        .select("id, employee:employees(id, first_name, last_name, department_id), policy:leave_policies(code, name), starts_on, ends_on, days, reason, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (args.approver_id) qry = qry.eq("approver_id", String(args.approver_id));
      const { data, error } = await qry;
      if (error) throw error;
      return { rows: data ?? [] };
    }
    case "get_salary_slip": {
      const { data, error } = await supabase
        .from("salary_slips")
        .select("*")
        .eq("employee_id", String(args.employee_id))
        .eq("period_year", Number(args.year))
        .eq("period_month", Number(args.month))
        .maybeSingle();
      if (error) throw error;
      return { slip: data };
    }
    case "draft_leave_decision": {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, status, starts_on, ends_on, days, reason, employee:employees(first_name, last_name), policy:leave_policies(name)")
        .eq("id", String(args.request_id))
        .single();
      if (error) throw error;
      return { request: data, decision: args.decision, reason: args.reason };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
