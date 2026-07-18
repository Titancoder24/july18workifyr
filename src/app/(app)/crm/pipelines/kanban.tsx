"use client";

import { useState, useTransition, useMemo, useCallback, useEffect } from "react";
import {
  Plus,
  Search,
  MoreHorizontal,
  Calendar,
  Trophy,
  XCircle,
  ArrowRight,
  Pencil,
  Settings2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Star,
  Archive,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, relativeTime, initials } from "@/lib/format";
import {
  createDeal,
  moveDealToStage,
  updateDeal,
  createPipeline,
  updatePipeline,
  archivePipeline,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  createFollowUp,
} from "./actions";

export type Stage = {
  id: string;
  name: string;
  probability: number | string;
  position?: number;
  is_won: boolean;
  is_lost: boolean;
  stale_after_days?: number | null;
};

export type Deal = {
  id: string;
  title: string;
  value: number | string;
  currency: string;
  stage_id: string;
  status: string;
  owner_full_name: string | null;
  contact_name: string | null;
  expected_close_date?: string | null;
  company_name?: string | null;
  stage_entered_at?: string | null;
  created_at?: string | null;
  closed_at?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  owner_id?: string | null;
};

export type Pipeline = {
  id: string;
  name: string;
  is_default: boolean;
};

export type Profile = {
  id: string;
  full_name: string | null;
};

export type Company = {
  id: string;
  name: string | null;
};

const AVATAR_PALETTE = [
  "var(--color-cat-slate)",
  "var(--color-cat-blue)",
  "var(--color-cat-indigo)",
  "var(--color-cat-violet)",
  "var(--color-cat-amber)",
  "var(--color-cat-orange)",
  "var(--color-cat-rose)",
  "var(--color-cat-teal)",
  "var(--color-cat-green)",
  "var(--color-cat-lime)",
];

const COL_PALETTE = [
  "var(--color-cat-slate)",
  "var(--color-cat-blue)",
  "var(--color-cat-indigo)",
  "var(--color-cat-violet)",
  "var(--color-cat-amber)",
  "var(--color-cat-orange)",
  "var(--color-cat-teal)",
  "var(--color-cat-lime)",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarColor(name: string | null | undefined): string {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length];
}

function CategoryAvatar({ name, size = 24 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarColor(name),
        color: "white",
        fontSize: size <= 24 ? 10 : 11,
        letterSpacing: "-0.01em",
      }}
      aria-label={name ?? ""}
      title={name ?? ""}
    >
      {initials(name)}
    </span>
  );
}

function stageAccent(stage: Stage, idx: number): string {
  if (stage.is_won) return "var(--color-viridian-500)";
  if (stage.is_lost) return "var(--color-cat-rose)";
  return COL_PALETTE[idx % COL_PALETTE.length];
}

function daysBetween(from: string | null | undefined, to: Date = new Date()): number {
  if (!from) return 0;
  const start = new Date(from).getTime();
  return Math.max(0, Math.floor((to.getTime() - start) / (1000 * 60 * 60 * 24)));
}

export function PipelineKanban({
  pipelineId,
  stages,
  initialDeals,
  contacts,
  pipelines = [],
  profiles = [],
  companies = [],
  activePipelineId,
}: {
  pipelineId: string;
  stages: Stage[];
  initialDeals: Deal[];
  contacts: { id: string; first_name: string | null; last_name: string | null }[];
  pipelines?: Pipeline[];
  profiles?: Profile[];
  companies?: Company[];
  activePipelineId?: string;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  useEffect(() => { setDeals(initialDeals); }, [initialDeals]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [newOpen, setNewOpen] = useState(false);
  const [newStageId, setNewStageId] = useState<string>(stages[0]?.id ?? "");
  const [newForm, setNewForm] = useState({ title: "", value: "", contact_id: "", company_id: "", expected_close_date: "" });
  const [busy, setBusy] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | string[] | null>>({});
  const [savingDetail, setSavingDetail] = useState(false);

  const [quickMenuId, setQuickMenuId] = useState<string | null>(null);
  const [moveStageOpen, setMoveStageOpen] = useState<string | null>(null);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [editingPipelineName, setEditingPipelineName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageProbability, setNewStageProbability] = useState("50");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageProbability, setEditingStageProbability] = useState("");

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpDeal, setFollowUpDeal] = useState<Deal | null>(null);
  const [followUpForm, setFollowUpForm] = useState({ title: "", notes: "", due_date: "", due_time: "09:00" });
  const [followUpBusy, setFollowUpBusy] = useState(false);

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.contact_name && d.contact_name.toLowerCase().includes(q)) ||
          (d.company_name && d.company_name.toLowerCase().includes(q)),
      );
    }
    if (ownerFilter) {
      result = result.filter((d) => d.owner_id === ownerFilter);
    }
    if (stageFilter) {
      result = result.filter((d) => d.stage_id === stageFilter);
    }
    return result;
  }, [deals, searchQuery, ownerFilter, stageFilter]);

  const stats = useMemo(() => {
    const total = filteredDeals.length;
    const totalValue = filteredDeals.reduce((acc, d) => acc + Number(d.value ?? 0), 0);
    const currency = filteredDeals[0]?.currency ?? "INR";
    const avgDealSize = total > 0 ? totalValue / total : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const wonStage = stages.find((s) => s.is_won);
    const lostStage = stages.find((s) => s.is_lost);

    const wonThisMonth = deals.filter((d) => {
      if (d.stage_id !== wonStage?.id && d.status !== "won") return false;
      const ts = d.closed_at || d.stage_entered_at;
      if (!ts) return false;
      return new Date(ts).getTime() >= monthStart.getTime();
    });
    const wonThisMonthValue = wonThisMonth.reduce((acc, d) => acc + Number(d.value ?? 0), 0);

    const closedDeals = deals.filter((d) => d.stage_id === wonStage?.id || d.stage_id === lostStage?.id);
    const wonClosed = closedDeals.filter((d) => d.stage_id === wonStage?.id).length;
    const winRate = closedDeals.length > 0 ? Math.round((wonClosed / closedDeals.length) * 100) : 0;

    return { total, totalValue, avgDealSize, currency, wonThisMonthValue, wonThisMonthCount: wonThisMonth.length, winRate };
  }, [filteredDeals, deals, stages]);

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverStage(null);
  }

  async function onDrop(stageId: string) {
    if (!dragId) return;
    const prior = deals.find((d) => d.id === dragId);
    if (!prior || prior.stage_id === stageId) return;
    setDeals((prev) => prev.map((d) => (d.id === dragId ? { ...d, stage_id: stageId } : d)));
    startTransition(async () => {
      const res = await moveDealToStage({ deal_id: dragId, to_stage_id: stageId });
      if (!res.ok) {
        toast.error(res.error);
        setDeals((prev) => prev.map((d) => (d.id === dragId ? prior : d)));
      } else {
        const stage = stages.find((s) => s.id === stageId);
        if (stage?.is_won) toast.success("Deal won.");
        else if (stage?.is_lost) toast("Deal moved to Lost.");
      }
      router.refresh();
    });
  }

  async function onCreateDeal() {
    if (!newForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    if (!newStageId) {
      toast.error("Please select a stage");
      setBusy(false);
      return;
    }
    const res = await createDeal({
      pipeline_id: pipelineId,
      stage_id: newStageId,
      title: newForm.title.trim(),
      value: Number(newForm.value || 0),
      contact_id: newForm.contact_id || "",
      company_id: newForm.company_id || "",
      expected_close_date: newForm.expected_close_date || "",
    });
    setBusy(false);
    if (!res.ok) {
      console.error("createDeal failed", res);
      toast.error(res.error || "Failed to save deal");
      return;
    }

    const inserted = res.data as Record<string, unknown> | undefined;
    if (inserted && inserted.id) {
      const owner = inserted.owner as { full_name: string | null } | { full_name: string | null }[] | null;
      const contact = inserted.contact as { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null;
      const company = inserted.company as { name: string | null } | { name: string | null }[] | null;
      const flat = <T,>(v: T | T[] | null | undefined): T | null =>
        !v ? null : Array.isArray(v) ? v[0] ?? null : v;
      const o = flat(owner);
      const c = flat(contact);
      const co = flat(company);
      const newDeal: Deal = {
        id: inserted.id as string,
        title: inserted.title as string,
        value: inserted.value as number | string,
        currency: (inserted.currency as string) ?? "INR",
        stage_id: inserted.stage_id as string,
        status: (inserted.status as string) ?? "open",
        owner_full_name: o?.full_name ?? null,
        contact_name: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || null : null,
        expected_close_date: (inserted.expected_close_date as string) ?? null,
        company_name: co?.name ?? null,
        stage_entered_at: (inserted.stage_entered_at as string) ?? null,
        created_at: (inserted.created_at as string) ?? null,
        tags: (inserted.tags as string[]) ?? null,
        notes: (inserted.notes as string) ?? null,
        contact_id: (inserted.contact_id as string) ?? null,
        company_id: (inserted.company_id as string) ?? null,
        owner_id: (inserted.owner_id as string) ?? null,
      };
      setDeals((prev) => [newDeal, ...prev]);
    }

    toast.success("Deal saved");
    setNewForm({ title: "", value: "", contact_id: "", company_id: "", expected_close_date: "" });
    setNewOpen(false);
    router.refresh();
  }

  function openDealDetail(deal: Deal) {
    setDetailDeal(deal);
    setEditMode(false);
    setEditForm({});
    setDetailOpen(true);
  }

  function openFollowUp(deal: Deal) {
    setFollowUpDeal(deal);
    setFollowUpForm({
      title: `Follow up on ${deal.title}`.trim(),
      notes: "",
      due_date: "",
      due_time: "09:00",
    });
    setFollowUpOpen(true);
  }

  async function saveFollowUp() {
    if (!followUpDeal) return;
    if (!followUpForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!followUpForm.due_date) {
      toast.error("Due date is required.");
      return;
    }
    const dueAt = new Date(`${followUpForm.due_date}T${followUpForm.due_time || "09:00"}:00`).toISOString();
    setFollowUpBusy(true);
    const res = await createFollowUp({
      entity_type: "deal",
      entity_id: followUpDeal.id,
      title: followUpForm.title.trim(),
      notes: followUpForm.notes || undefined,
      due_at: dueAt,
    });
    setFollowUpBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Follow-up scheduled.");
    setFollowUpOpen(false);
    setFollowUpDeal(null);
    router.refresh();
  }

  function startEdit() {
    if (!detailDeal) return;
    setEditMode(true);
    setEditForm({
      title: detailDeal.title,
      value: String(detailDeal.value ?? ""),
      contact_id: detailDeal.contact_id ?? "",
      company_id: detailDeal.company_id ?? "",
      owner_id: detailDeal.owner_id ?? "",
      stage_id: detailDeal.stage_id,
      expected_close_date: detailDeal.expected_close_date ?? "",
      tags: detailDeal.tags?.join(", ") ?? "",
      notes: detailDeal.notes ?? "",
    });
  }

  async function saveDetail() {
    if (!detailDeal) return;
    setSavingDetail(true);
    const res = await updateDeal({
      id: detailDeal.id,
      title: editForm.title as string || undefined,
      value: editForm.value ? Number(editForm.value) : undefined,
      contact_id: (editForm.contact_id as string) || null,
      company_id: (editForm.company_id as string) || null,
      owner_id: (editForm.owner_id as string) || null,
      stage_id: (editForm.stage_id as string) || undefined,
      expected_close_date: (editForm.expected_close_date as string) || null,
      tags: (editForm.tags as string) ? (editForm.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      notes: (editForm.notes as string) || null,
    });
    setSavingDetail(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Deal updated.");
    setEditMode(false);
    setDetailOpen(false);
    router.refresh();
  }

  async function markDealStatus(dealId: string, status: "won" | "lost") {
    const wonStage = stages.find((s) => s.is_won);
    const lostStage = stages.find((s) => s.is_lost);
    const targetStage = status === "won" ? wonStage : lostStage;

    const res = await updateDeal({
      id: dealId,
      status,
      stage_id: targetStage?.id,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(status === "won" ? "Deal marked as Won!" : "Deal marked as Lost.");
    setDetailOpen(false);
    setQuickMenuId(null);
    router.refresh();
  }

  async function quickMoveToStage(dealId: string, stageId: string) {
    const res = await moveDealToStage({ deal_id: dealId, to_stage_id: stageId });
    if (!res.ok) {
      toast.error(res.error);
    } else {
      toast.success("Deal moved.");
    }
    setMoveStageOpen(null);
    setQuickMenuId(null);
    router.refresh();
  }

  async function handleCreatePipeline() {
    if (!newPipelineName.trim()) return;
    setManageBusy(true);
    const res = await createPipeline({ name: newPipelineName });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pipeline created.");
    setNewPipelineName("");
    router.refresh();
  }

  async function handleUpdatePipeline(id: string, name: string) {
    setManageBusy(true);
    const res = await updatePipeline({ id, name });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pipeline updated.");
    setEditingPipelineId(null);
    router.refresh();
  }

  async function handleSetDefault(id: string) {
    setManageBusy(true);
    const res = await updatePipeline({ id, is_default: true });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Default pipeline updated.");
    router.refresh();
  }

  async function handleArchivePipeline(id: string) {
    setManageBusy(true);
    const res = await archivePipeline({ id });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pipeline archived.");
    router.refresh();
  }

  async function handleCreateStage() {
    if (!newStageName.trim()) return;
    setManageBusy(true);
    const res = await createStage({
      pipeline_id: pipelineId,
      name: newStageName,
      probability: Number(newStageProbability || 0),
      position: stages.length,
    });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Stage added.");
    setNewStageName("");
    setNewStageProbability("50");
    router.refresh();
  }

  async function handleUpdateStage(id: string) {
    setManageBusy(true);
    const res = await updateStage({
      id,
      name: editingStageName || undefined,
      probability: editingStageProbability ? Number(editingStageProbability) : undefined,
    });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Stage updated.");
    setEditingStageId(null);
    router.refresh();
  }

  async function handleDeleteStage(id: string) {
    setManageBusy(true);
    const res = await deleteStage({ id });
    setManageBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Stage deleted.");
    router.refresh();
  }

  const handleReorder = useCallback(
    async (stageId: string, direction: "up" | "down") => {
      const idx = stages.findIndex((s) => s.id === stageId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= stages.length) return;
      const ids = stages.map((s) => s.id);
      [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
      const res = await reorderStages({ pipeline_id: pipelineId, stage_ids: ids });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    },
    [stages, pipelineId, router],
  );

  function isDealStale(deal: Deal, stage: Stage): boolean {
    if (!deal.stage_entered_at || !stage.stale_after_days) return false;
    const entered = new Date(deal.stage_entered_at);
    const dInStage = (Date.now() - entered.getTime()) / (1000 * 60 * 60 * 24);
    return dInStage > stage.stale_after_days;
  }

  return (
    <>
      {pipelines.length > 1 && (
        <div
          className="flex items-center gap-0 mb-4 overflow-x-auto border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          {pipelines.map((p) => {
            const isActive = p.id === (activePipelineId || pipelineId);
            const pipelineDealCount = isActive ? deals.length : 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/crm/pipelines?pipeline=${p.id}`)}
                className="px-4 py-2.5 text-[13px] font-medium whitespace-nowrap relative transition-colors"
                style={{
                  color: isActive ? "var(--color-viridian-700)" : "var(--color-ink-secondary)",
                  background: "transparent",
                }}
              >
                {p.name}
                {isActive && pipelineDealCount > 0 && (
                  <span
                    className="ml-1.5 text-[11px] tabular-nums"
                    style={{ color: "var(--color-ink-tertiary)" }}
                  >
                    ({pipelineDealCount})
                  </span>
                )}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ background: "var(--color-viridian-500)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Pipeline Value", value: formatCurrency(stats.totalValue, stats.currency) },
          { label: "Won This Month", value: formatCurrency(stats.wonThisMonthValue, stats.currency), accent: stats.wonThisMonthCount > 0 },
          { label: "Win Rate", value: `${stats.winRate}%` },
          { label: "Avg Deal Size", value: formatCurrency(stats.avgDealSize, stats.currency) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-4 py-3"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              className="text-[10.5px] font-semibold uppercase"
              style={{ color: "var(--color-ink-tertiary)", letterSpacing: "0.06em" }}
            >
              {s.label}
            </div>
            <div
              className="text-[22px] font-semibold tabular-nums mt-1"
              style={{
                color: s.accent ? "var(--color-viridian-700)" : "var(--color-ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5"
            style={{ color: "var(--color-ink-tertiary)" }}
          />
          <Input
            placeholder="Search deals, contacts, companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        <Select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="w-44 h-8"
        >
          <option value="">All owners</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || "Unnamed"}
            </option>
          ))}
        </Select>
        <Select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="w-44 h-8"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Settings2 className="size-3.5" />}
          onClick={() => setManageOpen(true)}
        >
          Manage
        </Button>
        <Button
          variant="primary"
          size="sm"
          iconLeft={<Plus className="size-3.5" />}
          onClick={() => {
            setNewStageId(stages[0]?.id ?? "");
            setNewOpen(true);
          }}
        >
          Add Deal
        </Button>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {stages.map((stage, idx) => {
            const stageDeals = filteredDeals.filter((d) => d.stage_id === stage.id);
            const total = stageDeals.reduce((acc, d) => acc + Number(d.value ?? 0), 0);
            const accent = stageAccent(stage, idx);
            const isOver = overStage === stage.id;
            const isLostCol = stage.is_lost;
            const isWonCol = stage.is_won;

            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(stage.id);
                }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(stage.id);
                }}
                className="shrink-0 flex flex-col"
                style={{
                  width: 296,
                  background: isLostCol
                    ? "var(--color-danger-bg)"
                    : isWonCol
                    ? "var(--color-viridian-50)"
                    : "var(--color-surface-2)",
                  borderRadius: 12,
                  borderTop: `2px solid ${accent}`,
                  border: isLostCol
                    ? "1px solid rgba(193,59,59,0.25)"
                    : isWonCol
                    ? "1px solid var(--color-viridian-200)"
                    : undefined,
                  borderTopWidth: 2,
                  borderTopColor: accent,
                  padding: 10,
                  minHeight: 400,
                  gap: 8,
                  transition: "box-shadow 120ms",
                  boxShadow: isOver ? "0 0 0 2px var(--color-viridian-300) inset" : undefined,
                }}
              >
                <div className="flex items-center gap-2 px-1 pt-0.5 pb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold"
                        style={{ fontSize: 12.5, color: "var(--color-ink)", letterSpacing: "-0.005em" }}
                      >
                        {stage.name}
                      </span>
                      <span
                        className="font-semibold tabular-nums"
                        style={{
                          background: "rgba(0,0,0,0.04)",
                          color: "var(--color-ink-secondary)",
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 999,
                        }}
                      >
                        {stageDeals.length}
                      </span>
                    </div>
                    <div
                      className="mt-0.5"
                      style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}
                    >
                      {formatCurrency(total, stageDeals[0]?.currency ?? "INR")} total
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewStageId(stage.id);
                      setNewOpen(true);
                    }}
                    className="inline-flex items-center justify-center rounded-md"
                    style={{
                      width: 24,
                      height: 24,
                      color: "var(--color-ink-tertiary)",
                      transition: "background 120ms, color 120ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                      e.currentTarget.style.color = "var(--color-ink)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--color-ink-tertiary)";
                    }}
                    aria-label="Add deal"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  {stageDeals.map((d) => {
                    const stale = isDealStale(d, stage);
                    const tags = (d.tags ?? []).filter(Boolean);
                    const visibleTags = tags.slice(0, 2);
                    const extraTags = tags.length - visibleTags.length;
                    const daysInStage = d.stage_entered_at ? daysBetween(d.stage_entered_at) : null;

                    return (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={() => onDragStart(d.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => openDealDetail(d)}
                        className="cursor-grab active:cursor-grabbing relative"
                        style={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          padding: "10px 12px",
                          opacity: dragId === d.id ? 0.85 : 1,
                          boxShadow: "var(--shadow-xs)",
                          transition: "box-shadow 120ms, border-color 120ms",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = "var(--shadow-md)";
                          e.currentTarget.style.borderColor = "var(--color-border-strong)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "var(--shadow-xs)";
                          e.currentTarget.style.borderColor = "var(--color-border)";
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="truncate min-w-0 flex-1"
                            style={{ fontSize: 12.5, fontWeight: 550, color: "var(--color-ink)", letterSpacing: "-0.005em" }}
                          >
                            {d.title}
                          </div>
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickMenuId(quickMenuId === d.id ? null : d.id);
                              }}
                              className="size-5 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                              aria-label="More"
                            >
                              <MoreHorizontal className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                            </button>
                            {quickMenuId === d.id && (
                              <QuickMenu
                                deal={d}
                                stages={stages}
                                moveStageOpen={moveStageOpen}
                                onEdit={() => {
                                  setQuickMenuId(null);
                                  openDealDetail(d);
                                  setTimeout(() => startEdit(), 100);
                                }}
                                onMoveToggle={() => setMoveStageOpen(moveStageOpen === d.id ? null : d.id)}
                                onMoveToStage={(stageId) => quickMoveToStage(d.id, stageId)}
                                onMarkWon={() => markDealStatus(d.id, "won")}
                                onMarkLost={() => markDealStatus(d.id, "lost")}
                                onFollowUp={() => {
                                  setQuickMenuId(null);
                                  openFollowUp(d);
                                }}
                                onClose={() => {
                                  setQuickMenuId(null);
                                  setMoveStageOpen(null);
                                }}
                              />
                            )}
                          </div>
                        </div>

                        {(d.company_name || d.contact_name) && (
                          <div
                            className="truncate mt-0.5"
                            style={{ fontSize: 11.5, color: "var(--color-ink-tertiary)" }}
                          >
                            {d.company_name || d.contact_name}
                          </div>
                        )}

                        <div
                          className="mt-1.5 tabular-nums"
                          style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", letterSpacing: "-0.01em" }}
                        >
                          {formatCurrency(d.value, d.currency)}
                        </div>

                        {(visibleTags.length > 0 || extraTags > 0) && (
                          <div className="flex items-center gap-1 flex-wrap mt-2">
                            {visibleTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center"
                                style={{
                                  background: "var(--color-surface-muted)",
                                  color: "var(--color-ink-secondary)",
                                  border: "1px solid var(--color-border)",
                                  fontSize: 10.5,
                                  fontWeight: 500,
                                  padding: "1px 7px",
                                  borderRadius: 999,
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                            {extraTags > 0 && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: "var(--color-ink-tertiary)",
                                }}
                              >
                                +{extraTags} more
                              </span>
                            )}
                          </div>
                        )}

                        <div
                          className="flex items-center justify-between mt-2 pt-2"
                          style={{ borderTop: "1px solid var(--color-border)" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {d.expected_close_date ? (
                              <span
                                className="inline-flex items-center gap-1"
                                style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}
                              >
                                <Calendar className="size-3 shrink-0" />
                                {formatDate(d.expected_close_date, { month: "short", day: "numeric" })}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openFollowUp(d);
                                }}
                                className="inline-flex items-center gap-1 rounded-md"
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 550,
                                  color: "var(--color-viridian-700)",
                                  padding: "2px 6px",
                                  border: "1px solid var(--color-viridian-200)",
                                  background: "var(--color-viridian-50)",
                                }}
                              >
                                <CalendarClock className="size-3" />
                                Follow-up
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {daysInStage !== null && stage.stale_after_days && (
                              <span
                                className="inline-flex items-center"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 550,
                                  padding: "1px 6px",
                                  borderRadius: 999,
                                  background: stale ? "var(--color-warning-bg)" : "var(--color-surface-muted)",
                                  color: stale ? "var(--color-warning)" : "var(--color-ink-tertiary)",
                                }}
                                title={d.stage_entered_at ? `In stage since ${formatDate(d.stage_entered_at)}` : undefined}
                              >
                                {daysInStage}d
                              </span>
                            )}
                            <CategoryAvatar name={d.owner_full_name} size={24} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stageDeals.length === 0 && (
                    <div
                      className="flex items-center justify-center text-center"
                      style={{
                        fontSize: 11.5,
                        color: "var(--color-ink-tertiary)",
                        border: `1px dashed ${isOver ? "var(--color-viridian-400)" : "var(--color-border-2)"}`,
                        borderRadius: 8,
                        padding: "20px 12px",
                        background: isOver ? "var(--color-viridian-50)" : "transparent",
                        transition: "all 120ms",
                        minHeight: 80,
                      }}
                    >
                      {isOver ? "Drop here" : "No deals"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet
        open={newOpen}
        onOpenChange={(v) => !busy && setNewOpen(v)}
        title="New deal"
        description="Add a deal to your pipeline."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onCreateDeal} loading={busy}>
              Save deal
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              autoFocus
              value={newForm.title}
              onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Audi — Q3 retainer"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value">
              <Input
                type="number"
                value={newForm.value}
                onChange={(e) => setNewForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="0"
              />
            </Field>
            <Field label="Expected close">
              <Input
                type="date"
                value={newForm.expected_close_date}
                onChange={(e) => setNewForm((f) => ({ ...f, expected_close_date: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Stage">
            <Select value={newStageId} onChange={(e) => setNewStageId(e.target.value)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact">
            <Select
              value={newForm.contact_id}
              onChange={(e) => setNewForm((f) => ({ ...f, contact_id: e.target.value }))}
            >
              <option value="">— No contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Company">
            <Select
              value={newForm.company_id}
              onChange={(e) => setNewForm((f) => ({ ...f, company_id: e.target.value }))}
            >
              <option value="">— No company —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "—"}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={detailOpen}
        onOpenChange={(v) => {
          if (!savingDetail) {
            setDetailOpen(v);
            if (!v) setEditMode(false);
          }
        }}
        title={detailDeal?.title ?? "Deal"}
        description={detailDeal?.contact_name ?? undefined}
        width={520}
        footer={
          editMode ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setEditMode(false)}
                disabled={savingDetail}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={saveDetail} loading={savingDetail}>
                Save
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Trophy className="size-3" />}
                onClick={() => detailDeal && markDealStatus(detailDeal.id, "won")}
              >
                Won
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<XCircle className="size-3" />}
                onClick={() => detailDeal && markDealStatus(detailDeal.id, "lost")}
              >
                Lost
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<CalendarClock className="size-3" />}
                onClick={() => {
                  if (!detailDeal) return;
                  const d = detailDeal;
                  setDetailOpen(false);
                  setTimeout(() => openFollowUp(d), 100);
                }}
              >
                Follow-up
              </Button>
              <div className="flex-1" />
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Pencil className="size-3" />}
                onClick={startEdit}
              >
                Edit
              </Button>
            </div>
          )
        }
      >
        {detailDeal && !editMode && (
          <div className="space-y-4">
            <DetailRow label="Value">
              <span className="text-[14px] font-semibold tabular-nums">
                {formatCurrency(detailDeal.value, detailDeal.currency)}
              </span>
            </DetailRow>
            <DetailRow label="Stage">
              <Badge tone="viridian">
                {stages.find((s) => s.id === detailDeal.stage_id)?.name ?? "—"}
              </Badge>
            </DetailRow>
            <DetailRow label="Status">
              <Badge tone={detailDeal.status === "won" ? "viridian" : detailDeal.status === "lost" ? "neutral" : "outline"}>
                {detailDeal.status}
              </Badge>
            </DetailRow>
            {detailDeal.contact_name && (
              <DetailRow label="Contact">{detailDeal.contact_name}</DetailRow>
            )}
            {detailDeal.company_name && (
              <DetailRow label="Company">{detailDeal.company_name}</DetailRow>
            )}
            {detailDeal.owner_full_name && (
              <DetailRow label="Owner">
                <div className="flex items-center gap-2">
                  <Avatar name={detailDeal.owner_full_name} size="sm" />
                  <span>{detailDeal.owner_full_name}</span>
                </div>
              </DetailRow>
            )}
            {detailDeal.expected_close_date && (
              <DetailRow label="Expected Close">
                {formatDate(detailDeal.expected_close_date)}
              </DetailRow>
            )}
            {detailDeal.stage_entered_at && (
              <DetailRow label="Time in Stage">
                {relativeTime(detailDeal.stage_entered_at)}
              </DetailRow>
            )}
            {detailDeal.tags && detailDeal.tags.length > 0 && (
              <DetailRow label="Tags">
                <div className="flex flex-wrap gap-1">
                  {detailDeal.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </DetailRow>
            )}
            {detailDeal.notes && (
              <DetailRow label="Notes">
                <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--color-ink-secondary)" }}>
                  {detailDeal.notes}
                </p>
              </DetailRow>
            )}
            {detailDeal.created_at && (
              <DetailRow label="Created">
                {formatDate(detailDeal.created_at)}
              </DetailRow>
            )}
          </div>
        )}
        {detailDeal && editMode && (
          <div className="space-y-3">
            <Field label="Title" required>
              <Input
                value={(editForm.title as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <Field label="Value">
              <Input
                type="number"
                value={(editForm.value as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
              />
            </Field>
            <Field label="Stage">
              <Select
                value={(editForm.stage_id as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, stage_id: e.target.value }))}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contact">
              <Select
                value={(editForm.contact_id as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, contact_id: e.target.value }))}
              >
                <option value="">— No contact —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Company">
              <Select
                value={(editForm.company_id as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, company_id: e.target.value }))}
              >
                <option value="">— No company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "—"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner">
              <Select
                value={(editForm.owner_id as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, owner_id: e.target.value }))}
              >
                <option value="">— Unassigned —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || "Unnamed"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Expected Close">
              <Input
                type="date"
                value={(editForm.expected_close_date as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, expected_close_date: e.target.value }))}
              />
            </Field>
            <Field label="Tags">
              <Input
                value={(editForm.tags as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="Comma-separated tags"
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={(editForm.notes as string) ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet
        open={followUpOpen}
        onOpenChange={(v) => !followUpBusy && setFollowUpOpen(v)}
        title="Set follow-up"
        description={followUpDeal?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFollowUpOpen(false)} disabled={followUpBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveFollowUp} loading={followUpBusy}>
              Save follow-up
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              autoFocus
              value={followUpForm.title}
              onChange={(e) => setFollowUpForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Follow up on..."
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={followUpForm.notes}
              onChange={(e) => setFollowUpForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="What's the goal of this follow-up?"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date" required>
              <Input
                type="date"
                value={followUpForm.due_date}
                onChange={(e) => setFollowUpForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </Field>
            <Field label="Due time">
              <Input
                type="time"
                value={followUpForm.due_time}
                onChange={(e) => setFollowUpForm((f) => ({ ...f, due_time: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={manageOpen}
        onOpenChange={(v) => !manageBusy && setManageOpen(v)}
        title="Manage Pipelines"
        description="Create, edit, and configure your pipelines and stages."
        width={560}
      >
        <div className="space-y-6">
          <div>
            <div
              className="text-[12px] font-semibold mb-2"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Pipelines
            </div>
            <div className="space-y-2">
              {pipelines.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--color-surface-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {editingPipelineId === p.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingPipelineName}
                        onChange={(e) => setEditingPipelineName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdatePipeline(p.id, editingPipelineName);
                          if (e.key === "Escape") setEditingPipelineId(null);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdatePipeline(p.id, editingPipelineName)}
                        loading={manageBusy}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingPipelineId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[13px] font-medium flex-1">{p.name}</span>
                      {p.is_default && (
                        <Badge tone="viridian" className="text-[10px]">
                          Default
                        </Badge>
                      )}
                      {!p.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(p.id)}
                          className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                          title="Set as default"
                        >
                          <Star className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPipelineId(p.id);
                          setEditingPipelineName(p.name);
                        }}
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                        title="Edit pipeline"
                      >
                        <Pencil className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                      {!p.is_default && (
                        <button
                          type="button"
                          onClick={() => handleArchivePipeline(p.id)}
                          className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                          title="Archive pipeline"
                        >
                          <Archive className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Input
                placeholder="New pipeline name"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePipeline();
                }}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreatePipeline}
                loading={manageBusy}
                disabled={!newPipelineName.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <div
            className="border-t pt-4"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div
              className="text-[12px] font-semibold mb-2"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Stages for current pipeline
            </div>
            <div className="space-y-1.5">
              {stages.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--color-surface-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {editingStageId === s.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateStage(s.id);
                          if (e.key === "Escape") setEditingStageId(null);
                        }}
                      />
                      <Input
                        type="number"
                        value={editingStageProbability}
                        onChange={(e) => setEditingStageProbability(e.target.value)}
                        className="w-16"
                        min={0}
                        max={100}
                        placeholder="%"
                      />
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdateStage(s.id)}
                        loading={manageBusy}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingStageId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleReorder(s.id, "up")}
                          disabled={idx === 0}
                          className="size-4 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
                        >
                          <ChevronUp className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorder(s.id, "down")}
                          disabled={idx === stages.length - 1}
                          className="size-4 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)] disabled:opacity-30"
                        >
                          <ChevronDown className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                        </button>
                      </div>
                      <span className="text-[13px] font-medium flex-1">{s.name}</span>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: "var(--color-ink-tertiary)" }}
                      >
                        {Number(s.probability)}%
                      </span>
                      {s.is_won && (
                        <Badge tone="viridian" className="text-[10px]">
                          Won
                        </Badge>
                      )}
                      {s.is_lost && (
                        <Badge tone="neutral" className="text-[10px]">
                          Lost
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStageId(s.id);
                          setEditingStageName(s.name);
                          setEditingStageProbability(String(s.probability));
                        }}
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                        title="Edit stage"
                      >
                        <Pencil className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStage(s.id)}
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-[var(--color-surface-hover)]"
                        title="Delete stage"
                      >
                        <Trash2 className="size-3" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Input
                placeholder="Stage name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateStage();
                }}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="%"
                value={newStageProbability}
                onChange={(e) => setNewStageProbability(e.target.value)}
                className="w-16"
                min={0}
                max={100}
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateStage}
                loading={manageBusy}
                disabled={!newStageName.trim()}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 py-2 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <span
        className="text-[12px] font-medium w-28 shrink-0 pt-0.5"
        style={{ color: "var(--color-ink-tertiary)" }}
      >
        {label}
      </span>
      <div className="text-[13px] min-w-0 flex-1">{children}</div>
    </div>
  );
}

function QuickMenu({
  deal,
  stages,
  moveStageOpen,
  onEdit,
  onMoveToggle,
  onMoveToStage,
  onMarkWon,
  onMarkLost,
  onFollowUp,
  onClose,
}: {
  deal: Deal;
  stages: Stage[];
  moveStageOpen: string | null;
  onEdit: () => void;
  onMoveToggle: () => void;
  onMoveToStage: (stageId: string) => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onFollowUp: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-6 z-50 w-44 rounded-lg py-1"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <MenuButton icon={<Pencil className="size-3" />} onClick={onEdit}>
          Edit
        </MenuButton>
        <MenuButton icon={<CalendarClock className="size-3" />} onClick={onFollowUp}>
          Set follow-up
        </MenuButton>
        <MenuButton icon={<ArrowRight className="size-3" />} onClick={onMoveToggle}>
          Move to Stage
        </MenuButton>
        {moveStageOpen === deal.id && (
          <div
            className="mx-2 my-1 rounded-md py-1"
            style={{ background: "var(--color-surface-muted)" }}
          >
            {stages
              .filter((s) => s.id !== deal.stage_id)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onMoveToStage(s.id)}
                  className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  {s.name}
                </button>
              ))}
          </div>
        )}
        <div
          className="my-1 border-t"
          style={{ borderColor: "var(--color-border)" }}
        />
        <MenuButton icon={<Trophy className="size-3" />} onClick={onMarkWon}>
          Mark as Won
        </MenuButton>
        <MenuButton icon={<XCircle className="size-3" />} onClick={onMarkLost}>
          Mark as Lost
        </MenuButton>
      </div>
    </>
  );
}

function MenuButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors"
      style={{ color: "var(--color-ink-secondary)" }}
    >
      {icon}
      {children}
    </button>
  );
}
