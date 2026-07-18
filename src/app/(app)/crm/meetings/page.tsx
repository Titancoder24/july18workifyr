"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Video,
  Clock,
  Link as LinkIcon,
  CalendarDays,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type MeetingType = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  active: boolean;
  created_at: string;
};

type Booking = {
  id: string;
  invitee_name: string;
  invitee_email: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  meeting_type: { title: string } | { title: string }[] | null;
};

function flatten<T>(v: T | T[] | null | undefined): T | null {
  return !v ? null : Array.isArray(v) ? v[0] ?? null : v;
}

/* -------------------------------------------------------------------------- */
/*  Slug helper                                                               */
/* -------------------------------------------------------------------------- */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function MeetingsPage() {
  const supabase = createClient();

  const [tab, setTab] = useState<"types" | "bookings" | "calendar">("types");
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [popoverBooking, setPopoverBooking] = useState<string | null>(null);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingType | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    duration_minutes: "30",
    buffer_minutes: "0",
    active: true,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  const appUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      : "";

  /* ---- Data fetching ---------------------------------------------------- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (profile?.org_id) setOrgId(profile.org_id as string);
    }
    const [typesRes, bookingsRes] = await Promise.all([
      supabase
        .from("meeting_types")
        .select("id, slug, title, description, duration_minutes, buffer_minutes, active, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("meeting_bookings")
        .select(
          `id, invitee_name, invitee_email, starts_at, ends_at, status, notes,
           meeting_type:meeting_types(title)`
        )
        .order("starts_at", { ascending: false })
        .limit(200),
    ]);
    setMeetingTypes((typesRes.data as MeetingType[]) ?? []);
    setBookings((bookingsRes.data as Booking[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Form helpers ----------------------------------------------------- */

  function resetForm() {
    setForm({
      title: "",
      slug: "",
      description: "",
      duration_minutes: "30",
      buffer_minutes: "0",
      active: true,
    });
    setSlugTouched(false);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setSheetOpen(true);
  }

  function openEdit(mt: MeetingType) {
    setEditing(mt);
    setForm({
      title: mt.title,
      slug: mt.slug,
      description: mt.description ?? "",
      duration_minutes: String(mt.duration_minutes),
      buffer_minutes: String(mt.buffer_minutes),
      active: mt.active,
    });
    setSlugTouched(true);
    setSheetOpen(true);
  }

  function handleTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: slugTouched ? f.slug : slugify(value),
    }));
  }

  /* ---- CRUD ------------------------------------------------------------- */

  async function onSave() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    setBusy(true);

    if (!orgId || !userId) {
      toast.error("Could not determine your organization.");
      setBusy(false);
      return;
    }
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      duration_minutes: Number(form.duration_minutes),
      buffer_minutes: Number(form.buffer_minutes),
      active: form.active,
      org_id: orgId,
      owner_id: userId,
    };

    if (editing) {
      const { org_id: _o, owner_id: _u, ...updatePayload } = payload;
      const { error } = await supabase
        .from("meeting_types")
        .update(updatePayload)
        .eq("id", editing.id);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Meeting type updated");
    } else {
      const { error } = await supabase
        .from("meeting_types")
        .insert(payload);
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Meeting type created");
    }

    resetForm();
    setSheetOpen(false);
    fetchData();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this meeting type? All associated bookings will remain.")) return;
    const { error } = await supabase.from("meeting_types").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Meeting type deleted");
    fetchData();
  }

  async function toggleActive(mt: MeetingType) {
    const { error } = await supabase
      .from("meeting_types")
      .update({ active: !mt.active })
      .eq("id", mt.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    fetchData();
  }

  async function cancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    const { error } = await supabase
      .from("meeting_bookings")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booking cancelled");
    fetchData();
  }

  function copyLink(slug: string) {
    const url = `${appUrl}/book/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  /* ---- Status badge tone ------------------------------------------------ */

  function statusTone(status: string): "viridian" | "solid" | "neutral" | "outline" {
    switch (status) {
      case "confirmed":
        return "viridian";
      case "cancelled":
        return "solid";
      case "completed":
        return "neutral";
      default:
        return "outline";
    }
  }

  /* ---- Render ----------------------------------------------------------- */

  return (
    <PageContainer>
      <PageHeader
        title="Meetings"
        description="Create shareable meeting types and track bookings"
        actions={
          <Button
            variant="primary"
            iconLeft={<Plus className="size-3.5" />}
            onClick={openCreate}
          >
            New meeting type
          </Button>
        }
      />

      {/* Tabs */}
      <div className="tabs mb-5">
        <button
          className={tab === "types" ? "tab-active" : ""}
          onClick={() => setTab("types")}
        >
          Meeting Types
        </button>
        <button
          className={tab === "bookings" ? "tab-active" : ""}
          onClick={() => setTab("bookings")}
        >
          Bookings
        </button>
        <button
          className={tab === "calendar" ? "tab-active" : ""}
          onClick={() => setTab("calendar")}
        >
          <CalendarDays className="size-3.5 inline-block mr-1 -mt-px" />
          Calendar
        </button>
      </div>

      {/* Meeting Types Tab */}
      {tab === "types" && (
        <>
          {loading ? (
            <LoadingSkeleton />
          ) : meetingTypes.length === 0 ? (
            <EmptyState
              icon={<Video className="size-5" />}
              title="No meeting types yet"
              description="Create your first meeting type to generate a shareable booking link."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {meetingTypes.map((mt) => (
                <div key={mt.id} className="card card-interactive p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold tracking-tight truncate">
                        {mt.title}
                      </h3>
                      {mt.description && (
                        <p
                          className="mt-0.5 text-[12px] line-clamp-2"
                          style={{ color: "var(--color-ink-secondary)" }}
                        >
                          {mt.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleActive(mt)}
                      className="shrink-0"
                      title={mt.active ? "Deactivate" : "Activate"}
                    >
                      <Badge tone={mt.active ? "viridian" : "neutral"} dot>
                        {mt.active ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className="inline-flex items-center gap-1 text-[12px]"
                      style={{ color: "var(--color-ink-secondary)" }}
                    >
                      <Clock className="size-3" />
                      {mt.duration_minutes} min
                    </span>
                    {mt.buffer_minutes > 0 && (
                      <span
                        className="inline-flex items-center gap-1 text-[12px]"
                        style={{ color: "var(--color-ink-tertiary)" }}
                      >
                        +{mt.buffer_minutes} min buffer
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-4 text-[12px] truncate"
                    style={{
                      background: "var(--color-surface-muted)",
                      color: "var(--color-ink-secondary)",
                    }}
                  >
                    <LinkIcon className="size-3 shrink-0" />
                    <span className="truncate">/book/{mt.slug}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<Copy className="size-3" />}
                      onClick={() => copyLink(mt.slug)}
                    >
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Pencil className="size-3" />}
                      onClick={() => openEdit(mt)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconLeft={<Trash2 className="size-3" />}
                      onClick={() => onDelete(mt.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Bookings Tab */}
      {tab === "bookings" && (
        <>
          {loading ? (
            <LoadingSkeleton />
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="No bookings yet"
              description="Bookings will appear here once someone uses your meeting link."
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <Th>Invitee</Th>
                    <Th>Email</Th>
                    <Th>Meeting type</Th>
                    <Th>Date & time</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const mt = flatten(b.meeting_type);
                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-[var(--color-surface-hover)] transition-colors"
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <Td>
                          <span className="font-medium">{b.invitee_name}</span>
                        </Td>
                        <Td muted>{b.invitee_email}</Td>
                        <Td muted>{mt?.title ?? "—"}</Td>
                        <Td muted>
                          {formatDate(b.starts_at, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Td>
                        <Td>
                          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                        </Td>
                        <Td align="right">
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              iconLeft={<XCircle className="size-3" />}
                              onClick={() => cancelBooking(b.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Calendar Tab */}
      {tab === "calendar" && (
        <>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <CalendarView
              bookings={bookings}
              month={calMonth}
              onMonthChange={setCalMonth}
              popoverBooking={popoverBooking}
              onPopoverChange={setPopoverBooking}
              statusTone={statusTone}
            />
          )}
        </>
      )}

      {/* Create / Edit Sheet */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(v) => {
          if (!busy) {
            if (!v) resetForm();
            setSheetOpen(v);
          }
        }}
        title={editing ? "Edit meeting type" : "New meeting type"}
        description={
          editing
            ? "Update the details for this meeting type."
            : "Set up a new meeting type with a shareable booking link."
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setSheetOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={onSave} loading={busy}>
              {editing ? "Save changes" : "Create meeting type"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              value={form.title}
              autoFocus
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="30min Discovery Call"
            />
          </Field>

          <Field
            label="Slug"
            required
            hint={
              <span
                className="text-[11px]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                /book/{form.slug || "..."}
              </span>
            }
          >
            <Input
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              }}
              placeholder="30min-discovery-call"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="A quick intro call to discuss your needs."
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration" required>
              <Select
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_minutes: e.target.value }))
                }
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </Select>
            </Field>

            <Field label="Buffer after">
              <Select
                value={form.buffer_minutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buffer_minutes: e.target.value }))
                }
              >
                <option value="0">No buffer</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={form.active}
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              style={{
                background: form.active
                  ? "var(--color-viridian-500)"
                  : "var(--color-border-strong)",
              }}
            >
              <span
                className="inline-block size-3.5 rounded-full bg-white transition-transform"
                style={{
                  transform: form.active
                    ? "translateX(18px)"
                    : "translateX(3px)",
                }}
              />
            </button>
            <span
              className="text-[12px] font-medium"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              {form.active
                ? "Active — accepting bookings"
                : "Inactive — link disabled"}
            </span>
          </div>
        </div>
      </Sheet>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared sub-components                                                     */
/* -------------------------------------------------------------------------- */

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"
      style={{
        color: "var(--color-ink-tertiary)",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      className="px-4 py-3 text-[13px] align-middle"
      style={{
        textAlign: align ?? "left",
        color: muted ? "var(--color-ink-secondary)" : "var(--color-ink)",
      }}
    >
      {children}
    </td>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card px-6 py-16 text-center">
      <div
        className="size-10 rounded-xl inline-flex items-center justify-center mb-3"
        style={{
          background: "var(--color-viridian-100)",
          color: "var(--color-viridian-700)",
        }}
      >
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <p
        className="mt-1.5 text-[13px] max-w-sm mx-auto"
        style={{ color: "var(--color-ink-secondary)" }}
      >
        {description}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-5 animate-pulse">
          <div
            className="h-4 rounded w-2/3 mb-3"
            style={{ background: "var(--color-surface-muted)" }}
          />
          <div
            className="h-3 rounded w-full mb-2"
            style={{ background: "var(--color-surface-muted)" }}
          />
          <div
            className="h-3 rounded w-1/2 mb-4"
            style={{ background: "var(--color-surface-muted)" }}
          />
          <div
            className="h-8 rounded w-full"
            style={{ background: "var(--color-surface-muted)" }}
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Calendar View                                                              */
/* -------------------------------------------------------------------------- */

function CalendarView({
  bookings,
  month,
  onMonthChange,
  popoverBooking,
  onPopoverChange,
  statusTone,
}: {
  bookings: Booking[];
  month: Date;
  onMonthChange: (d: Date) => void;
  popoverBooking: string | null;
  onPopoverChange: (id: string | null) => void;
  statusTone: (status: string) => "viridian" | "solid" | "neutral" | "outline";
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const year = month.getFullYear();
  const mo = month.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Group bookings by date (YYYY-MM-DD)
  const bookingsByDate: Record<string, Booking[]> = {};
  for (const b of bookings) {
    const d = new Date(b.starts_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  }

  // Build calendar grid: find first Monday on or before the 1st
  const firstDay = new Date(year, mo, 1);
  // getDay(): 0=Sun, 1=Mon ... 6=Sat. We want Monday=0.
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // 0=Mon
  const startDate = new Date(year, mo, 1 - firstDayOfWeek);

  // Last day of month
  const lastDay = new Date(year, mo + 1, 0);
  const lastDayOfWeek = (lastDay.getDay() + 6) % 7;
  const endDate = new Date(year, mo + 1, 0 + (6 - lastDayOfWeek));

  // Build array of dates
  const days: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  function prevMonth() {
    onMonthChange(new Date(year, mo - 1, 1));
  }
  function nextMonth() {
    onMonthChange(new Date(year, mo + 1, 1));
  }
  function goToday() {
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="card overflow-hidden">
      {/* Month header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-[var(--color-surface-muted)] transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" style={{ color: "var(--color-ink-secondary)" }} />
          </button>
          <h2
            className="text-[15px] font-semibold tracking-tight ml-1"
            style={{ color: "var(--color-ink)" }}
          >
            {monthNames[mo]} {year}
          </h2>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1 rounded-md text-[12px] font-medium hover:bg-[var(--color-surface-muted)] transition-colors"
          style={{
            color: "var(--color-viridian-700)",
            border: "1px solid var(--color-border)",
          }}
        >
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {weekdays.map((wd, i) => (
          <div
            key={wd}
            className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-center"
            style={{
              color: "var(--color-ink-tertiary)",
              background: i >= 5 ? "var(--color-surface-muted)" : "transparent",
              borderRight: i < 6 ? "1px solid var(--color-border)" : "none",
            }}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
        }}
      >
        {days.map((day, idx) => {
          const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
          const isCurrentMonth = day.getMonth() === mo;
          const isToday = dayKey === todayStr;
          const colIndex = idx % 7;
          const isWeekend = colIndex >= 5;
          const dayBookings = bookingsByDate[dayKey] || [];

          return (
            <div
              key={dayKey + "-" + idx}
              className="relative"
              style={{
                minHeight: 100,
                borderRight: colIndex < 6 ? "1px solid var(--color-border)" : "none",
                borderBottom: "1px solid var(--color-border)",
                background: isWeekend
                  ? "var(--color-surface-muted)"
                  : "var(--color-surface)",
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
            >
              {/* Day number */}
              <div className="px-2 pt-1.5 pb-1 flex items-start justify-between">
                <span
                  className="text-[12px] font-medium inline-flex items-center justify-center"
                  style={{
                    color: isToday
                      ? "#fff"
                      : isCurrentMonth
                      ? "var(--color-ink)"
                      : "var(--color-ink-tertiary)",
                    background: isToday ? "var(--color-viridian-500)" : "transparent",
                    borderRadius: isToday ? "50%" : undefined,
                    width: isToday ? 22 : undefined,
                    height: isToday ? 22 : undefined,
                  }}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Booking chips */}
              <div className="px-1 pb-1 space-y-0.5">
                {dayBookings.slice(0, 3).map((b) => {
                  const startTime = new Date(b.starts_at);
                  const timeStr = startTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  const isOpen = popoverBooking === b.id;

                  return (
                    <div key={b.id} className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPopoverChange(isOpen ? null : b.id);
                        }}
                        className="chip-viridian w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate block cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          background:
                            b.status === "cancelled"
                              ? "var(--color-surface-muted)"
                              : "var(--color-viridian-100)",
                          color:
                            b.status === "cancelled"
                              ? "var(--color-ink-tertiary)"
                              : "var(--color-viridian-700)",
                          textDecoration:
                            b.status === "cancelled" ? "line-through" : "none",
                        }}
                        title={`${timeStr} ${b.invitee_name}`}
                      >
                        <span className="font-medium">{timeStr}</span>{" "}
                        {b.invitee_name}
                      </button>

                      {/* Popover */}
                      {isOpen && (
                        <BookingPopover
                          booking={b}
                          statusTone={statusTone}
                          onClose={() => onPopoverChange(null)}
                        />
                      )}
                    </div>
                  );
                })}
                {dayBookings.length > 3 && (
                  <div
                    className="text-[10px] px-1.5 font-medium"
                    style={{ color: "var(--color-ink-tertiary)" }}
                  >
                    +{dayBookings.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Booking Popover                                                            */
/* -------------------------------------------------------------------------- */

function BookingPopover({
  booking,
  statusTone,
  onClose,
}: {
  booking: Booking;
  statusTone: (status: string) => "viridian" | "solid" | "neutral" | "outline";
  onClose: () => void;
}) {
  const mt = flatten(booking.meeting_type);
  const startTime = new Date(booking.starts_at);
  const endTime = new Date(booking.ends_at);

  const dateStr = startTime.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeRange = `${startTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} - ${endTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;

  return (
    <>
      {/* Backdrop to close popover */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="absolute z-50 rounded-lg shadow-lg p-3 w-64"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          left: 0,
          top: "100%",
          marginTop: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span
            className="text-[13px] font-semibold truncate"
            style={{ color: "var(--color-ink)" }}
          >
            {booking.invitee_name}
          </span>
          <Badge tone={statusTone(booking.status)}>{booking.status}</Badge>
        </div>

        <div className="space-y-1.5">
          <div
            className="text-[12px]"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            {booking.invitee_email}
          </div>

          {mt?.title && (
            <div
              className="text-[12px]"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              <span className="font-medium" style={{ color: "var(--color-ink)" }}>
                Type:
              </span>{" "}
              {mt.title}
            </div>
          )}

          <div
            className="text-[12px]"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            <span className="font-medium" style={{ color: "var(--color-ink)" }}>
              When:
            </span>{" "}
            {dateStr}, {timeRange}
          </div>

          {booking.notes && (
            <div
              className="text-[11px] mt-1 p-2 rounded"
              style={{
                background: "var(--color-surface-muted)",
                color: "var(--color-ink-secondary)",
              }}
            >
              {booking.notes}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
