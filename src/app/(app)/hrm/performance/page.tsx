"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Field, Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader, PageContainer } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import {
  Plus,
  Star,
  Target,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Play,
  CheckCircle2,
  Loader2,
} from "lucide-react";

/* ============================================================================
   Types
   ========================================================================= */

interface PerformanceCycle {
  id: string;
  org_id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  created_at: string;
}

interface Review {
  id: string;
  org_id: string;
  cycle_id: string;
  employee_id: string;
  reviewer_id: string | null;
  type: string;
  rating: number | null;
  feedback: string | null;
  responses: Record<string, unknown> | null;
  submitted_at: string | null;
  created_at: string;
}

interface Goal {
  id: string;
  org_id: string;
  cycle_id: string | null;
  employee_id: string;
  title: string;
  description: string | null;
  weight: number | null;
  target: string | null;
  progress: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  employee_code: string | null;
  status: string;
}

type TabKey = "cycles" | "goals";
type Supa = ReturnType<typeof createClient>;

// Helper to bypass strict table-name typing for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const from = (sb: Supa, table: string): any => (sb as any).from(table);

/* ============================================================================
   Main Page
   ========================================================================= */

export default function PerformancePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("cycles");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Data
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Sheets
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [addReviewOpen, setAddReviewOpen] = useState<string | null>(null);
  const [submitReviewSheet, setSubmitReviewSheet] = useState<Review | null>(null);
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);

  // Expanded cycles
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());

  // Goal filters
  const [goalFilterEmployee, setGoalFilterEmployee] = useState("");
  const [goalFilterCycle, setGoalFilterCycle] = useState("");
  const [goalFilterStatus, setGoalFilterStatus] = useState("");

  /* ------ Bootstrap ------ */
  const bootstrap = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await from(supabase, "profiles")
      .select("id, org_id")
      .eq("id", user.id)
      .single();
    if (!profile) return;
    setOrgId(profile.org_id);
    setProfileId(profile.id);

    const oid = profile.org_id;
    const [cyclesRes, reviewsRes, goalsRes, empRes] = await Promise.all([
      from(supabase, "performance_cycles").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
      from(supabase, "reviews").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
      from(supabase, "goals").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
      from(supabase, "employees").select("id, first_name, last_name, email, employee_code, status").eq("org_id", oid).eq("status", "active").order("first_name"),
    ]);

    setCycles((cyclesRes.data ?? []) as PerformanceCycle[]);
    setReviews((reviewsRes.data ?? []) as Review[]);
    setGoals((goalsRes.data ?? []) as Goal[]);
    setEmployees((empRes.data ?? []) as Employee[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  /* ------ Helpers ------ */
  const empName = (id: string) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name ?? ""}`.trim() : "Unknown";
  };

  const statusTone = (s: string): "viridian" | "outline" | "solid" | "neutral" => {
    switch (s) {
      case "active": case "completed": return "viridian";
      case "draft": return "outline";
      case "cancelled": return "solid";
      default: return "neutral";
    }
  };

  const toggleCycle = (id: string) => {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const cycleReviews = (cycleId: string) => reviews.filter((r) => r.cycle_id === cycleId);

  const filteredGoals = goals.filter((g) => {
    if (goalFilterEmployee && g.employee_id !== goalFilterEmployee) return false;
    if (goalFilterCycle && g.cycle_id !== goalFilterCycle) return false;
    if (goalFilterStatus && g.status !== goalFilterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin" style={{ color: "var(--color-ink-tertiary)" }} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Performance"
        description="Review cycles, ratings, and goal tracking"
        actions={
          tab === "cycles" ? (
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => setNewCycleOpen(true)}>
              New Cycle
            </Button>
          ) : (
            <Button variant="primary" iconLeft={<Plus className="size-3.5" />} onClick={() => { setEditGoal(null); setNewGoalOpen(true); }}>
              Add Goal
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: "var(--color-surface-muted)" }}>
        {(["cycles", "goals"] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors capitalize"
            style={{
              background: tab === t ? "var(--color-surface)" : "transparent",
              color: tab === t ? "var(--color-ink)" : "var(--color-ink-tertiary)",
              boxShadow: tab === t ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {t === "cycles" ? "Cycles" : "Goals"}
          </button>
        ))}
      </div>

      {/* Cycles Tab */}
      {tab === "cycles" && (
        <CyclesTab
          cycles={cycles}
          reviews={reviews}
          employees={employees}
          empName={empName}
          statusTone={statusTone}
          expandedCycles={expandedCycles}
          toggleCycle={toggleCycle}
          cycleReviews={cycleReviews}
          onActivate={async (cycle) => {
            const { error } = await from(supabase, "performance_cycles")
              .update({ status: "active" })
              .eq("id", cycle.id)
              .eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Cycle activated");
            bootstrap();
          }}
          onComplete={async (cycle) => {
            const { error } = await from(supabase, "performance_cycles")
              .update({ status: "completed" })
              .eq("id", cycle.id)
              .eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Cycle completed");
            bootstrap();
          }}
          onAddReview={(cycleId) => setAddReviewOpen(cycleId)}
          onSubmitReview={(review) => setSubmitReviewSheet(review)}
          onDeleteReview={async (review) => {
            const { error } = await from(supabase, "reviews").delete().eq("id", review.id).eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Review deleted");
            bootstrap();
          }}
        />
      )}

      {/* Goals Tab */}
      {tab === "goals" && (
        <GoalsTab
          goals={filteredGoals}
          employees={employees}
          cycles={cycles}
          empName={empName}
          filterEmployee={goalFilterEmployee}
          filterCycle={goalFilterCycle}
          filterStatus={goalFilterStatus}
          onFilterEmployee={setGoalFilterEmployee}
          onFilterCycle={setGoalFilterCycle}
          onFilterStatus={setGoalFilterStatus}
          onEdit={(g) => { setEditGoal(g); setNewGoalOpen(true); }}
          onDelete={async (g) => {
            const { error } = await from(supabase, "goals").delete().eq("id", g.id).eq("org_id", orgId!);
            if (error) { toast.error(error.message); return; }
            toast.success("Goal deleted");
            bootstrap();
          }}
        />
      )}

      {/* New Cycle Sheet */}
      <NewCycleSheet
        open={newCycleOpen}
        onOpenChange={setNewCycleOpen}
        orgId={orgId!}
        supabase={supabase}
        onDone={bootstrap}
      />

      {/* Add Review Sheet */}
      {addReviewOpen && (
        <AddReviewSheet
          open={!!addReviewOpen}
          onOpenChange={() => setAddReviewOpen(null)}
          orgId={orgId!}
          cycleId={addReviewOpen}
          employees={employees}
          supabase={supabase}
          onDone={bootstrap}
        />
      )}

      {/* Submit Review Sheet */}
      {submitReviewSheet && (
        <SubmitReviewSheet
          open={!!submitReviewSheet}
          onOpenChange={() => setSubmitReviewSheet(null)}
          review={submitReviewSheet}
          empName={empName(submitReviewSheet.employee_id)}
          orgId={orgId!}
          supabase={supabase}
          onDone={bootstrap}
        />
      )}

      {/* New / Edit Goal Sheet */}
      <GoalSheet
        open={newGoalOpen}
        onOpenChange={setNewGoalOpen}
        orgId={orgId!}
        employees={employees}
        cycles={cycles}
        supabase={supabase}
        existing={editGoal}
        onDone={bootstrap}
      />
    </PageContainer>
  );
}

/* ============================================================================
   Cycles Tab
   ========================================================================= */

function CyclesTab({
  cycles,
  reviews,
  employees,
  empName,
  statusTone,
  expandedCycles,
  toggleCycle,
  cycleReviews,
  onActivate,
  onComplete,
  onAddReview,
  onSubmitReview,
  onDeleteReview,
}: {
  cycles: PerformanceCycle[];
  reviews: Review[];
  employees: Employee[];
  empName: (id: string) => string;
  statusTone: (s: string) => "viridian" | "outline" | "solid" | "neutral";
  expandedCycles: Set<string>;
  toggleCycle: (id: string) => void;
  cycleReviews: (cycleId: string) => Review[];
  onActivate: (c: PerformanceCycle) => void;
  onComplete: (c: PerformanceCycle) => void;
  onAddReview: (cycleId: string) => void;
  onSubmitReview: (review: Review) => void;
  onDeleteReview: (review: Review) => void;
}) {
  if (cycles.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <div
          className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
          style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
        >
          <Star className="size-5" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">No performance cycles</h3>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
          Create your first review cycle to start tracking employee performance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cycles.map((cycle) => {
        const expanded = expandedCycles.has(cycle.id);
        const cReviews = cycleReviews(cycle.id);
        const submitted = cReviews.filter((r) => r.submitted_at).length;

        return (
          <div key={cycle.id} className="card overflow-hidden">
            {/* Cycle Header */}
            <div
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              onClick={() => toggleCycle(cycle.id)}
              style={{ borderBottom: expanded ? "1px solid var(--color-border)" : "none" }}
            >
              {expanded ? (
                <ChevronDown className="size-4 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
              ) : (
                <ChevronRight className="size-4 shrink-0" style={{ color: "var(--color-ink-tertiary)" }} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium">{cycle.name}</span>
                  <Badge tone={statusTone(cycle.status)}>{cycle.status}</Badge>
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--color-ink-secondary)" }}>
                  {cycle.starts_on && cycle.ends_on
                    ? `${formatDate(cycle.starts_on)} - ${formatDate(cycle.ends_on)}`
                    : "Dates not set"}
                  {" "} · {cReviews.length} review(s), {submitted} submitted
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {cycle.status === "draft" && (
                  <Button size="sm" variant="primary" iconLeft={<Play className="size-3" />} onClick={() => onActivate(cycle)}>
                    Activate
                  </Button>
                )}
                {cycle.status === "active" && (
                  <Button size="sm" variant="secondary" iconLeft={<CheckCircle2 className="size-3" />} onClick={() => onComplete(cycle)}>
                    Complete
                  </Button>
                )}
                <Button size="sm" variant="ghost" iconLeft={<Plus className="size-3" />} onClick={() => onAddReview(cycle.id)}>
                  Review
                </Button>
              </div>
            </div>

            {/* Expanded Reviews */}
            {expanded && (
              <div>
                {cReviews.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      No reviews added to this cycle yet.
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <Th>Employee</Th>
                        <Th>Reviewer</Th>
                        <Th>Type</Th>
                        <Th>Rating</Th>
                        <Th>Status</Th>
                        <Th>Submitted</Th>
                        <Th align="right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {cReviews.map((review) => (
                        <tr key={review.id} className="hover:bg-[var(--color-surface-hover)] transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
                          <Td><span className="font-medium">{empName(review.employee_id)}</span></Td>
                          <Td muted>{review.reviewer_id ? empName(review.reviewer_id) : "—"}</Td>
                          <Td>
                            <Badge tone="neutral">{review.type}</Badge>
                          </Td>
                          <Td>
                            {review.rating ? (
                              <StarRating value={review.rating} />
                            ) : (
                              <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>Not rated</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={review.submitted_at ? "viridian" : "outline"}>
                              {review.submitted_at ? "submitted" : "pending"}
                            </Badge>
                          </Td>
                          <Td muted>{review.submitted_at ? formatDate(review.submitted_at) : "—"}</Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1">
                              {!review.submitted_at && (
                                <Button size="sm" variant="primary" onClick={() => onSubmitReview(review)}>
                                  Submit
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" iconLeft={<Trash2 className="size-3" />} onClick={() => onDeleteReview(review)} />
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   Goals Tab
   ========================================================================= */

function GoalsTab({
  goals,
  employees,
  cycles,
  empName,
  filterEmployee,
  filterCycle,
  filterStatus,
  onFilterEmployee,
  onFilterCycle,
  onFilterStatus,
  onEdit,
  onDelete,
}: {
  goals: Goal[];
  employees: Employee[];
  cycles: PerformanceCycle[];
  empName: (id: string) => string;
  filterEmployee: string;
  filterCycle: string;
  filterStatus: string;
  onFilterEmployee: (v: string) => void;
  onFilterCycle: (v: string) => void;
  onFilterStatus: (v: string) => void;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
}) {
  const goalStatusTone = (s: string): "viridian" | "outline" | "neutral" => {
    switch (s) {
      case "completed": return "viridian";
      case "in_progress": return "outline";
      case "not_started": return "neutral";
      default: return "neutral";
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterEmployee} onChange={(e) => onFilterEmployee(e.target.value)} className="w-52">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""}</option>
          ))}
        </Select>
        <Select value={filterCycle} onChange={(e) => onFilterCycle(e.target.value)} className="w-44">
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={filterStatus} onChange={(e) => onFilterStatus(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      {goals.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div
            className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
            style={{ background: "var(--color-viridian-100)", color: "var(--color-viridian-700)" }}
          >
            <Target className="size-5" />
          </div>
          <h3 className="text-[15px] font-semibold tracking-tight">No goals found</h3>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
            Add goals for employees to track their progress and performance.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <Th>Employee</Th>
                <Th>Goal</Th>
                <Th align="right">Weight</Th>
                <Th>Target</Th>
                <Th>Progress</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id} className="hover:bg-[var(--color-surface-hover)] transition-colors" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Td><span className="font-medium">{empName(g.employee_id)}</span></Td>
                  <Td>
                    <div className="min-w-0">
                      <div className="font-medium text-[13px]">{g.title}</div>
                      {g.description && (
                        <div className="text-[11px] truncate max-w-[200px]" style={{ color: "var(--color-ink-tertiary)" }}>
                          {g.description}
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td align="right" muted>{g.weight != null ? `${g.weight}%` : "—"}</Td>
                  <Td muted>{g.target ?? "—"}</Td>
                  <Td>
                    <ProgressBar value={g.progress} />
                  </Td>
                  <Td>
                    <Badge tone={goalStatusTone(g.status)}>
                      {g.status.replace(/_/g, " ")}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" iconLeft={<Pencil className="size-3" />} onClick={() => onEdit(g)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" iconLeft={<Trash2 className="size-3" />} onClick={() => onDelete(g)} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ============================================================================
   New Cycle Sheet
   ========================================================================= */

function NewCycleSheet({
  open,
  onOpenChange,
  orgId,
  supabase,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  supabase: Supa;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  async function onCreate() {
    if (!name.trim()) { toast.error("Please enter a cycle name"); return; }
    setBusy(true);

    const { error } = await from(supabase, "performance_cycles").insert({
      org_id: orgId,
      name: name.trim(),
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      status: "draft",
    });

    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Performance cycle created");
    setName(""); setStartsOn(""); setEndsOn("");
    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title="New Performance Cycle"
      description="Create a review cycle to collect feedback and ratings."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onCreate} loading={busy}>Create Cycle</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cycle Name" required>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q1 2026 Review"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts On">
            <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label="Ends On">
            <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Add Review Sheet
   ========================================================================= */

function AddReviewSheet({
  open,
  onOpenChange,
  orgId,
  cycleId,
  employees,
  supabase,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  cycleId: string;
  employees: Employee[];
  supabase: Supa;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [type, setType] = useState("manager");

  async function onAdd() {
    if (!employeeId) { toast.error("Please select an employee"); return; }
    setBusy(true);

    const { error } = await from(supabase, "reviews").insert({
      org_id: orgId,
      cycle_id: cycleId,
      employee_id: employeeId,
      reviewer_id: reviewerId || null,
      type,
    });

    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Review added");
    setEmployeeId(""); setReviewerId(""); setType("manager");
    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title="Add Review"
      description="Assign a review for an employee in this cycle."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onAdd} loading={busy}>Add Review</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Employee" required>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reviewer">
          <Select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">Select reviewer...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""}</option>
            ))}
          </Select>
        </Field>
        <Field label="Review Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="manager">Manager</option>
            <option value="self">Self</option>
            <option value="peer">Peer</option>
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Submit Review Sheet
   ========================================================================= */

function SubmitReviewSheet({
  open,
  onOpenChange,
  review,
  empName,
  orgId,
  supabase,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  review: Review;
  empName: string;
  orgId: string;
  supabase: Supa;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(review.rating ?? 0);
  const [feedback, setFeedback] = useState(review.feedback ?? "");

  async function onSubmit() {
    if (rating < 1 || rating > 5) { toast.error("Please select a rating between 1-5"); return; }
    setBusy(true);

    const { error } = await from(supabase, "reviews")
      .update({
        rating,
        feedback: feedback || null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", review.id)
      .eq("org_id", orgId);

    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Review submitted");
    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={`Review for ${empName}`}
      description={`${review.type} review`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={busy}>Submit Review</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Rating" required>
          <div className="flex gap-1 py-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setRating(v)}
                className="p-1 rounded transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <Star
                  className="size-6"
                  fill={v <= rating ? "var(--color-viridian-500)" : "none"}
                  stroke={v <= rating ? "var(--color-viridian-500)" : "var(--color-ink-tertiary)"}
                />
              </button>
            ))}
          </div>
          <span className="text-[12px]" style={{ color: "var(--color-ink-tertiary)" }}>
            {rating > 0 ? `${rating} of 5` : "Click a star to rate"}
          </span>
        </Field>
        <Field label="Feedback">
          <Textarea
            rows={5}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Write your review feedback here..."
          />
        </Field>
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Goal Sheet (New / Edit)
   ========================================================================= */

function GoalSheet({
  open,
  onOpenChange,
  orgId,
  employees,
  cycles,
  supabase,
  existing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  employees: Employee[];
  cycles: PerformanceCycle[];
  supabase: Supa;
  existing: Goal | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState(existing?.employee_id ?? "");
  const [cycleId, setCycleId] = useState(existing?.cycle_id ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [weight, setWeight] = useState(String(existing?.weight ?? ""));
  const [target, setTarget] = useState(existing?.target ?? "");
  const [progress, setProgress] = useState(existing?.progress ?? 0);
  const [status, setStatus] = useState(existing?.status ?? "not_started");

  useEffect(() => {
    if (open) {
      setEmployeeId(existing?.employee_id ?? "");
      setCycleId(existing?.cycle_id ?? "");
      setTitle(existing?.title ?? "");
      setDescription(existing?.description ?? "");
      setWeight(String(existing?.weight ?? ""));
      setTarget(existing?.target ?? "");
      setProgress(existing?.progress ?? 0);
      setStatus(existing?.status ?? "not_started");
    }
  }, [open, existing]);

  async function onSave() {
    if (!employeeId) { toast.error("Please select an employee"); return; }
    if (!title.trim()) { toast.error("Please enter a goal title"); return; }
    setBusy(true);

    const payload = {
      org_id: orgId,
      employee_id: employeeId,
      cycle_id: cycleId || null,
      title: title.trim(),
      description: description || null,
      weight: weight ? Number(weight) : null,
      target: target || null,
      progress,
      status,
    };

    if (existing) {
      const { error } = await from(supabase, "goals").update(payload).eq("id", existing.id).eq("org_id", orgId);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Goal updated");
    } else {
      const { error } = await from(supabase, "goals").insert(payload);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Goal created");
    }

    setBusy(false);
    onOpenChange(false);
    onDone();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => !busy && onOpenChange(v)}
      title={existing ? "Edit Goal" : "Add Goal"}
      description="Set measurable objectives for employees."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={onSave} loading={busy}>{existing ? "Update" : "Save"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Employee" required>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name ?? ""}</option>
            ))}
          </Select>
        </Field>

        <Field label="Cycle">
          <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value="">No cycle (standalone)</option>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Goal Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Close 10 deals this quarter" />
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the goal in detail..."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight (%)">
            <Input type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 30" />
          </Field>
          <Field label="Target">
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 10 deals" />
          </Field>
        </div>

        {existing && (
          <>
            <Field label={`Progress: ${progress}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: "var(--color-viridian-500)" }}
              />
            </Field>

            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ============================================================================
   Reusable Components
   ========================================================================= */

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className="size-3.5"
          fill={v <= value ? "var(--color-viridian-500)" : "none"}
          stroke={v <= value ? "var(--color-viridian-500)" : "var(--color-ink-tertiary)"}
        />
      ))}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--color-surface-muted)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${clamped}%`,
            background: "var(--color-viridian-500)",
            opacity: clamped === 100 ? 1 : 0.7,
          }}
        />
      </div>
      <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--color-ink-secondary)" }}>
        {clamped}%
      </span>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
      style={{ color: "var(--color-ink-tertiary)", textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({ children, align, muted }: { children: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{ textAlign: align ?? "left", color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)" }}
    >
      {children}
    </td>
  );
}
