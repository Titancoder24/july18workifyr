"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Phone,
  Mail,
  Building2,
  User,
  MoreHorizontal,
  ArrowRightLeft,
  ChevronDown,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { formatDate, relativeTime, initials } from "@/lib/format";
import { createLead, updateLead, moveLeadStatus, convertToDeal, createFollowUp } from "./actions";

export type LeadStatus = "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
export type LeadSource = "website" | "referral" | "linkedin" | "cold_call" | "advertisement" | "trade_show" | "other";

export type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  source: LeadSource;
  status: LeadStatus;
  owner_id: string | null;
  owner_full_name: string | null;
  notes: string | null;
  converted_at: string | null;
  created_at: string;
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STATUS_ACCENT: Record<LeadStatus, string> = {
  new: "var(--color-cat-slate)",
  contacted: "var(--color-cat-blue)",
  qualified: "var(--color-cat-indigo)",
  proposal_sent: "var(--color-cat-violet)",
  negotiation: "var(--color-cat-amber)",
  won: "var(--color-viridian-500)",
  lost: "var(--color-cat-rose)",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  linkedin: "LinkedIn",
  cold_call: "Cold Call",
  advertisement: "Advertisement",
  trade_show: "Trade Show",
  other: "Other",
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

function sourceChipStyle(source: LeadSource): React.CSSProperties {
  switch (source) {
    case "referral":
      return { background: "var(--color-success-bg)", color: "var(--color-success)", borderColor: "transparent" };
    case "website":
      return { background: "var(--color-viridian-100)", color: "var(--color-viridian-700)", borderColor: "var(--color-viridian-200)" };
    case "linkedin":
      return { background: "rgba(58,120,181,0.10)", color: "var(--color-cat-blue)", borderColor: "rgba(58,120,181,0.20)" };
    case "cold_call":
      return { background: "var(--color-warning-bg)", color: "var(--color-warning)", borderColor: "transparent" };
    case "advertisement":
      return { background: "var(--color-info-bg)", color: "var(--color-info)", borderColor: "transparent" };
    case "trade_show":
      return { background: "rgba(138,90,181,0.10)", color: "var(--color-cat-violet)", borderColor: "rgba(138,90,181,0.20)" };
    default:
      return { background: "var(--color-surface-muted)", color: "var(--color-ink-secondary)", borderColor: "var(--color-border)" };
  }
}

function statusChipStyle(status: LeadStatus): React.CSSProperties {
  if (status === "won") {
    return { background: "var(--color-viridian-500)", color: "white", borderColor: "transparent" };
  }
  if (status === "lost") {
    return { background: "var(--color-surface-muted)", color: "var(--color-ink-tertiary)", borderColor: "var(--color-border)" };
  }
  const accent = STATUS_ACCENT[status];
  return {
    background: "var(--color-surface)",
    color: accent,
    borderColor: "var(--color-border)",
  };
}

type Profile = { id: string; full_name: string | null };
type ViewMode = "kanban" | "table";
type SortKey = "name" | "email" | "company" | "source" | "status" | "owner" | "created";
type SortDir = "asc" | "desc";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_name: "",
  source: "other" as LeadSource,
  status: "new" as LeadStatus,
  owner_id: "",
  notes: "",
};

export function LeadsKanban({
  initialLeads,
  profiles,
}: {
  initialLeads: Lead[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<LeadStatus | null>(null);
  const [, startTransition] = useTransition();

  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "">("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ leadId: string; x: number; y: number } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpForm, setFollowUpForm] = useState({ title: "", notes: "", due_date: "", due_time: "09:00" });
  const [followUpBusy, setFollowUpBusy] = useState(false);

  const filtered = useMemo(() => {
    let result = leads;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.company_name ?? "").toLowerCase().includes(q),
      );
    }
    if (sourceFilter) result = result.filter((l) => l.source === sourceFilter);
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    if (ownerFilter) result = result.filter((l) => l.owner_id === ownerFilter);
    return result;
  }, [leads, search, sourceFilter, statusFilter, ownerFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "company":
          cmp = (a.company_name ?? "").localeCompare(b.company_name ?? "");
          break;
        case "source":
          cmp = a.source.localeCompare(b.source);
          break;
        case "status":
          cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case "owner":
          cmp = (a.owner_full_name ?? "").localeCompare(b.owner_full_name ?? "");
          break;
        case "created":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => l.status === "qualified" || l.status === "proposal_sent" || l.status === "negotiation").length;
    const won = leads.filter((l) => l.status === "won").length;
    const closed = leads.filter((l) => l.status === "won" || l.status === "lost").length;
    const conversion = closed > 0 ? Math.round((won / closed) * 100) : 0;
    return { total, qualified, won, conversion };
  }, [leads]);

  function openCreate(status: LeadStatus = "new") {
    setEditingLead(null);
    setForm({ ...emptyForm, status });
    setSheetOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setForm({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone ?? "",
      company_name: lead.company_name ?? "",
      source: lead.source,
      status: lead.status,
      owner_id: lead.owner_id ?? "",
      notes: lead.notes ?? "",
    });
    setSheetOpen(true);
  }

  function openFollowUp(lead: Lead) {
    setFollowUpLead(lead);
    setFollowUpForm({
      title: `Follow up with ${lead.first_name} ${lead.last_name}`.trim(),
      notes: "",
      due_date: "",
      due_time: "09:00",
    });
    setFollowUpOpen(true);
  }

  async function saveFollowUp() {
    if (!followUpLead) return;
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
      entity_type: "lead",
      entity_id: followUpLead.id,
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
    setFollowUpLead(null);
    router.refresh();
  }

  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragEnd() {
    setDragId(null);
    setOverStatus(null);
  }

  async function onDrop(toStatus: LeadStatus) {
    if (!dragId) return;
    const prior = leads.find((l) => l.id === dragId);
    if (!prior || prior.status === toStatus) return;
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, status: toStatus } : l)));
    startTransition(async () => {
      const res = await moveLeadStatus({ lead_id: dragId, to_status: toStatus });
      if (!res.ok) {
        toast.error(res.error);
        setLeads((prev) => prev.map((l) => (l.id === dragId ? prior : l)));
      } else {
        if (toStatus === "won") toast.success("Lead marked as won.");
        else if (toStatus === "lost") toast("Lead moved to Lost.");
      }
      router.refresh();
    });
  }

  async function onSave() {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast.error("First name, last name, and email are required.");
      return;
    }
    setBusy(true);
    if (editingLead) {
      const res = await updateLead({ lead_id: editingLead.id, ...form });
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead updated.");
    } else {
      const res = await createLead(form);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lead created.");
    }
    setForm(emptyForm);
    setEditingLead(null);
    setSheetOpen(false);
    router.refresh();
  }

  async function onConvert(leadId: string) {
    const res = await convertToDeal({ lead_id: leadId });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Lead converted.");
    setContextMenu(null);
    router.refresh();
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    return (
      <th
        className="text-left text-[11px] font-semibold px-3 py-2 cursor-pointer select-none"
        style={{ color: "var(--color-ink-tertiary)", borderBottom: "1px solid var(--color-border)" }}
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortKey === col && (
            <ChevronDown
              className="size-3"
              style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined, transition: "transform 120ms" }}
            />
          )}
        </span>
      </th>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Leads", value: String(stats.total) },
          { label: "Qualified", value: String(stats.qualified) },
          { label: "Won", value: String(stats.won), accent: true },
          { label: "Conversion", value: `${stats.conversion}%` },
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
              className="text-[10.5px] font-semibold uppercase tracking-wider"
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
            placeholder="Search leads, emails, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              {p.full_name ?? "Unnamed"}
            </option>
          ))}
        </Select>
        <Select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as LeadSource | "")}
          className="w-40 h-8"
        >
          <option value="">All sources</option>
          {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </Select>
        {view === "table" && (
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
            className="w-40 h-8"
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("kanban")}
            className="size-8 inline-flex items-center justify-center rounded-lg"
            style={{
              background: view === "kanban" ? "var(--color-viridian-50)" : "transparent",
              color: view === "kanban" ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
              border: view === "kanban" ? "1px solid var(--color-viridian-200)" : "1px solid transparent",
            }}
            aria-label="Kanban view"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className="size-8 inline-flex items-center justify-center rounded-lg"
            style={{
              background: view === "table" ? "var(--color-viridian-50)" : "transparent",
              color: view === "table" ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
              border: view === "table" ? "1px solid var(--color-viridian-200)" : "1px solid transparent",
            }}
            aria-label="Table view"
          >
            <List className="size-4" />
          </button>
          <div className="w-px h-5 mx-1" style={{ background: "var(--color-border)" }} />
          <Button variant="primary" size="sm" iconLeft={<Plus className="size-3.5" />} onClick={() => openCreate()}>
            Add lead
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {STATUS_ORDER.map((status) => {
              const colLeads = filtered.filter((l) => l.status === status);
              const accent = STATUS_ACCENT[status];
              const isOver = overStatus === status;
              const isLostCol = status === "lost";
              const isWonCol = status === "won";

              return (
                <div
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverStatus(status);
                  }}
                  onDragLeave={() => setOverStatus((s) => (s === status ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(status);
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
                          {STATUS_LABELS[status]}
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
                          {colLeads.length}
                        </span>
                      </div>
                      <div
                        className="mt-0.5"
                        style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}
                      >
                        {colLeads.length === 1 ? "1 lead" : `${colLeads.length} leads`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(status)}
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
                      aria-label="Add lead"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 flex-1">
                    {colLeads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => onDragStart(lead.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => openEdit(lead)}
                        className="cursor-grab active:cursor-grabbing"
                        style={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          padding: "10px 12px",
                          opacity: dragId === lead.id ? 0.85 : 1,
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
                            className="truncate min-w-0"
                            style={{ fontSize: 12.5, fontWeight: 550, color: "var(--color-ink)" }}
                          >
                            {lead.first_name} {lead.last_name}
                          </div>
                          <span
                            className="inline-flex items-center shrink-0"
                            style={{
                              ...sourceChipStyle(lead.source),
                              fontSize: 10,
                              fontWeight: 550,
                              padding: "1px 6px",
                              borderRadius: 999,
                              border: "1px solid",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {SOURCE_LABELS[lead.source]}
                          </span>
                        </div>
                        {lead.company_name && (
                          <div
                            className="truncate mt-0.5"
                            style={{ fontSize: 11.5, color: "var(--color-ink-tertiary)" }}
                          >
                            {lead.company_name}
                          </div>
                        )}
                        <div
                          className="truncate mt-0.5"
                          style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}
                        >
                          {lead.email}
                        </div>

                        <div
                          className="flex items-center justify-between mt-2 pt-2"
                          style={{ borderTop: "1px solid var(--color-border)" }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span style={{ fontSize: 11, color: "var(--color-ink-tertiary)" }}>
                              {relativeTime(lead.created_at)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFollowUp(lead);
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
                          </div>
                          <CategoryAvatar name={lead.owner_full_name} size={24} />
                        </div>
                      </div>
                    ))}
                    {colLeads.length === 0 && (
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
                        {isOver ? "Drop here" : "No leads"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <SortHeader label="Name" col="name" />
                  <SortHeader label="Email" col="email" />
                  <th
                    className="text-left text-[11px] font-semibold px-3 py-2"
                    style={{ color: "var(--color-ink-tertiary)", borderBottom: "1px solid var(--color-border)" }}
                  >
                    Phone
                  </th>
                  <SortHeader label="Company" col="company" />
                  <SortHeader label="Source" col="source" />
                  <SortHeader label="Status" col="status" />
                  <SortHeader label="Owner" col="owner" />
                  <SortHeader label="Created" col="created" />
                  <th
                    className="text-left text-[11px] font-semibold px-3 py-2 w-10"
                    style={{ color: "var(--color-ink-tertiary)", borderBottom: "1px solid var(--color-border)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead) => (
                  <tr
                    key={lead.id}
                    className="cursor-pointer hover:bg-[var(--color-surface-hover)]"
                    onClick={() => openEdit(lead)}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CategoryAvatar name={`${lead.first_name} ${lead.last_name}`} size={24} />
                        <span className="text-[13px] font-medium truncate">
                          {lead.first_name} {lead.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] truncate flex items-center gap-1" style={{ color: "var(--color-ink-secondary)" }}>
                        <Mail className="size-3 shrink-0" />
                        {lead.email}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] truncate flex items-center gap-1" style={{ color: "var(--color-ink-secondary)" }}>
                        {lead.phone ? (
                          <>
                            <Phone className="size-3 shrink-0" />
                            {lead.phone}
                          </>
                        ) : (
                          <span style={{ color: "var(--color-ink-tertiary)" }}>—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px] truncate flex items-center gap-1" style={{ color: "var(--color-ink-secondary)" }}>
                        {lead.company_name ? (
                          <>
                            <Building2 className="size-3 shrink-0" />
                            {lead.company_name}
                          </>
                        ) : (
                          <span style={{ color: "var(--color-ink-tertiary)" }}>—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex items-center"
                        style={{
                          ...sourceChipStyle(lead.source),
                          fontSize: 11,
                          fontWeight: 550,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid",
                        }}
                      >
                        {SOURCE_LABELS[lead.source]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md inline-block"
                        style={{
                          ...statusChipStyle(lead.status),
                          border: "1px solid",
                        }}
                      >
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {lead.owner_full_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>
                        {relativeTime(lead.created_at)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu({ leadId: lead.id, x: e.clientX, y: e.clientY });
                        }}
                        className="size-6 inline-flex items-center justify-center rounded-md hover:bg-[var(--color-surface-hover)]"
                      >
                        <MoreHorizontal className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
                      </button>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-[13px]" style={{ color: "var(--color-ink-tertiary)" }}>
                      No leads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 rounded-xl py-1 min-w-[180px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-hover)]"
              onClick={() => {
                const lead = leads.find((l) => l.id === contextMenu.leadId);
                if (lead) openEdit(lead);
                setContextMenu(null);
              }}
            >
              <User className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
              Edit lead
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-hover)]"
              onClick={() => {
                const lead = leads.find((l) => l.id === contextMenu.leadId);
                if (lead) openFollowUp(lead);
                setContextMenu(null);
              }}
            >
              <CalendarClock className="size-3.5" style={{ color: "var(--color-ink-tertiary)" }} />
              Set follow-up
            </button>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 hover:bg-[var(--color-surface-hover)]"
              style={{ color: "var(--color-viridian-700)" }}
              onClick={() => onConvert(contextMenu.leadId)}
            >
              <ArrowRightLeft className="size-3.5" />
              Convert to deal
            </button>
          </div>
        </>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => !busy && setSheetOpen(v)}
        title={editingLead ? "Edit lead" : "New lead"}
        description={editingLead ? `${editingLead.first_name} ${editingLead.last_name}` : "Add a new lead to your pipeline."}
        footer={
          <>
            <div className="flex-1 flex items-center gap-2">
              {editingLead && (
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<CalendarClock className="size-3.5" />}
                  onClick={() => {
                    const lead = editingLead;
                    setSheetOpen(false);
                    setTimeout(() => openFollowUp(lead), 100);
                  }}
                >
                  Set follow-up
                </Button>
              )}
              {editingLead && editingLead.status === "won" && !editingLead.converted_at && (
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<ArrowRightLeft className="size-3.5" />}
                  onClick={() => {
                    onConvert(editingLead.id);
                    setSheetOpen(false);
                  }}
                >
                  Convert to deal
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onSave} loading={busy}>
              {editingLead ? "Save changes" : "Create lead"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <Input
                autoFocus
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="John"
              />
            </Field>
            <Field label="Last name" required>
              <Input
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Doe"
              />
            </Field>
          </div>
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="john@example.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
              />
            </Field>
            <Field label="Company">
              <Input
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="Mercedes-Benz"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as LeadSource }))}>
                {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Owner">
            <Select value={form.owner_id} onChange={(e) => setForm((f) => ({ ...f, owner_id: e.target.value }))}>
              <option value="">— Unassigned —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? "—"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes about this lead..."
            />
          </Field>
          {editingLead?.converted_at && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] flex items-center gap-2"
              style={{
                background: "var(--color-viridian-50)",
                border: "1px solid var(--color-viridian-200)",
                color: "var(--color-viridian-700)",
              }}
            >
              <ArrowRightLeft className="size-3.5" />
              Converted on {formatDate(editingLead.converted_at)}
            </div>
          )}
        </div>
      </Sheet>

      <Sheet
        open={followUpOpen}
        onOpenChange={(v) => !followUpBusy && setFollowUpOpen(v)}
        title="Set follow-up"
        description={followUpLead ? `${followUpLead.first_name} ${followUpLead.last_name}` : undefined}
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
              placeholder="Follow up with..."
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
    </>
  );
}
