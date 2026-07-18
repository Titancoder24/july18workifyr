"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Clock,
  Video,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  CalendarDays,
  User,
  Mail,
  Phone,
  FileText,
} from "lucide-react";

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
  org_id: string;
  owner_id: string;
};

/* -------------------------------------------------------------------------- */
/*  Date/time helpers                                                         */
/* -------------------------------------------------------------------------- */

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDayLabel(date: Date): string {
  const today = new Date();
  if (isSameDay(date, today)) return "Today";
  const tomorrow = addDays(today, 1);
  if (isSameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${minute.toString().padStart(2, "0")} ${period}`;
}

/** Generate 30-min interval time slots between 9am and 6pm, respecting duration + buffer */
function generateTimeSlots(
  date: Date,
  durationMinutes: number,
  bufferMinutes: number
): { hour: number; minute: number; label: string }[] {
  const slots: { hour: number; minute: number; label: string }[] = [];
  const startHour = 9; // 9 AM
  const endHour = 18; // 6 PM
  const now = new Date();
  const isToday = isSameDay(date, now);

  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      // Ensure the meeting (duration + buffer) fits before end of day
      const slotEnd = h * 60 + m + durationMinutes + bufferMinutes;
      if (slotEnd > endHour * 60) continue;

      // Skip past times for today
      if (isToday) {
        const slotTime = new Date(date);
        slotTime.setHours(h, m, 0, 0);
        if (slotTime <= now) continue;
      }

      slots.push({ hour: h, minute: m, label: formatTime(h, m) });
    }
  }
  return slots;
}

/** Build available days: next 14 calendar days, skip weekends */
function getAvailableDays(): Date[] {
  const days: Date[] = [];
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 30 && days.length < 14; i++) {
    const day = i === 0 ? cursor : addDays(cursor, i);
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(day);
    }
  }
  return days;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [meetingType, setMeetingType] = useState<MeetingType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking flow state
  const [step, setStep] = useState<"select" | "form" | "confirmed">("select");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    hour: number;
    minute: number;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date navigation
  const availableDays = useMemo(() => getAvailableDays(), []);
  const [weekOffset, setWeekOffset] = useState(0);
  const visibleDays = availableDays.slice(weekOffset * 5, weekOffset * 5 + 5);
  const canPrev = weekOffset > 0;
  const canNext = (weekOffset + 1) * 5 < availableDays.length;

  /* ---- Fetch meeting type ------------------------------------------------ */

  useEffect(() => {
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("meeting_types")
        .select(
          "id, slug, title, description, duration_minutes, buffer_minutes, active, org_id, owner_id"
        )
        .eq("slug", slug)
        .eq("active", true)
        .single();

      if (fetchError || !data) {
        setNotFound(true);
      } else {
        setMeetingType(data as MeetingType);
      }
      setLoading(false);
    }
    load();
  }, [slug, supabase]);

  /* ---- Time slots for selected date ------------------------------------- */

  const timeSlots = useMemo(() => {
    if (!selectedDate || !meetingType) return [];
    return generateTimeSlots(
      selectedDate,
      meetingType.duration_minutes,
      meetingType.buffer_minutes
    );
  }, [selectedDate, meetingType]);

  /* ---- Submit booking --------------------------------------------------- */

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!selectedDate || !selectedSlot || !meetingType) return;

    setSubmitting(true);
    setError(null);

    const startsAt = new Date(selectedDate);
    startsAt.setHours(selectedSlot.hour, selectedSlot.minute, 0, 0);

    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + meetingType.duration_minutes);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_type_id: meetingType.id,
          invitee_name: form.name.trim(),
          invitee_email: form.email.trim(),
          invitee_phone: form.phone.trim() || "",
          notes: form.notes.trim() || "",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setStep("confirmed");
    } catch {
      setError("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  }

  /* ---- Loading state ---------------------------------------------------- */

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24">
          <Loader2
            className="size-6 animate-spin"
            style={{ color: "var(--color-viridian-500)" }}
          />
        </div>
      </PageShell>
    );
  }

  /* ---- Not found state -------------------------------------------------- */

  if (notFound || !meetingType) {
    return (
      <PageShell>
        <div className="text-center py-24">
          <div
            className="size-12 rounded-2xl inline-flex items-center justify-center mb-4"
            style={{
              background: "var(--color-surface-muted)",
              color: "var(--color-ink-tertiary)",
            }}
          >
            <Video className="size-6" />
          </div>
          <h1
            className="text-[20px] font-semibold tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            Meeting not found
          </h1>
          <p
            className="mt-2 text-[14px] max-w-sm mx-auto"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            This meeting link may have been deactivated or doesn&apos;t exist.
            Please check with the person who shared it.
          </p>
        </div>
      </PageShell>
    );
  }

  /* ---- Confirmed state -------------------------------------------------- */

  if (step === "confirmed") {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div
            className="size-14 rounded-2xl inline-flex items-center justify-center mb-5"
            style={{
              background: "var(--color-viridian-100)",
              color: "var(--color-viridian-700)",
            }}
          >
            <Check className="size-7" />
          </div>
          <h1
            className="text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            You&apos;re booked!
          </h1>
          <p
            className="mt-2 text-[14px] max-w-md mx-auto"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            A confirmation for <strong>{meetingType.title}</strong> on{" "}
            <strong>
              {selectedDate?.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </strong>{" "}
            at{" "}
            <strong>
              {selectedSlot
                ? formatTime(selectedSlot.hour, selectedSlot.minute)
                : ""}
            </strong>{" "}
            has been scheduled.
          </p>
          <div
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px]"
            style={{
              background: "var(--color-surface-muted)",
              color: "var(--color-ink-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Clock className="size-3.5" />
            {meetingType.duration_minutes} minutes
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---- Booking form step ------------------------------------------------ */

  if (step === "form") {
    return (
      <PageShell>
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setStep("select")}
            className="inline-flex items-center gap-1 text-[13px] font-medium mb-4"
            style={{ color: "var(--color-viridian-700)" }}
          >
            <ChevronLeft className="size-3.5" />
            Back
          </button>
          <MeetingHeader meetingType={meetingType} />
          <div
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px]"
            style={{
              background: "var(--color-viridian-100)",
              color: "var(--color-viridian-700)",
              border: "1px solid var(--color-viridian-200)",
            }}
          >
            <CalendarDays className="size-3.5" />
            {selectedDate?.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            at{" "}
            {selectedSlot
              ? formatTime(selectedSlot.hour, selectedSlot.minute)
              : ""}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4 max-w-md">
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Your name <span style={{ color: "var(--color-viridian-500)" }}>*</span>
            </label>
            <div className="relative">
              <User
                className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
                style={{ color: "var(--color-ink-tertiary)" }}
              />
              <input
                type="text"
                value={form.name}
                autoFocus
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Jane Smith"
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Email address{" "}
              <span style={{ color: "var(--color-viridian-500)" }}>*</span>
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
                style={{ color: "var(--color-ink-tertiary)" }}
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="jane@company.com"
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Phone{" "}
              <span
                className="text-[11px]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                (optional)
              </span>
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5"
                style={{ color: "var(--color-ink-tertiary)" }}
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+91 98765 43210"
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              Additional notes{" "}
              <span
                className="text-[11px]"
                style={{ color: "var(--color-ink-tertiary)" }}
              >
                (optional)
              </span>
            </label>
            <div className="relative">
              <FileText
                className="absolute left-3 top-3 size-3.5"
                style={{ color: "var(--color-ink-tertiary)" }}
              />
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Anything you'd like to discuss..."
                rows={3}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg text-[14px] outline-none transition-colors resize-none"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </div>
          </div>

          {error && (
            <div
              className="text-[13px] px-3 py-2 rounded-lg"
              style={{
                background: "var(--color-surface-muted)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-10 rounded-lg text-[14px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: "var(--color-viridian-500)",
              color: "white",
            }}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Confirm booking"
            )}
          </button>
        </div>
      </PageShell>
    );
  }

  /* ---- Date + time selection step --------------------------------------- */

  return (
    <PageShell>
      <MeetingHeader meetingType={meetingType} />

      {/* Date picker */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-[12px] font-medium uppercase tracking-wider"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            Select a date
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              disabled={!canPrev}
              className="size-7 inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              disabled={!canNext}
              className="size-7 inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {visibleDays.map((day) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  setSelectedSlot(null);
                }}
                className="flex flex-col items-center py-3 rounded-xl transition-all text-center"
                style={{
                  background: isSelected
                    ? "var(--color-viridian-500)"
                    : "var(--color-surface)",
                  color: isSelected ? "white" : "var(--color-ink)",
                  border: isSelected
                    ? "1px solid var(--color-viridian-600)"
                    : "1px solid var(--color-border)",
                }}
              >
                <span
                  className="text-[11px] font-medium uppercase"
                  style={{
                    color: isSelected
                      ? "rgba(255,255,255,0.8)"
                      : "var(--color-ink-tertiary)",
                  }}
                >
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="text-[18px] font-semibold mt-0.5">
                  {day.getDate()}
                </span>
                <span
                  className="text-[11px]"
                  style={{
                    color: isSelected
                      ? "rgba(255,255,255,0.7)"
                      : "var(--color-ink-tertiary)",
                  }}
                >
                  {day.toLocaleDateString("en-US", { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="mt-6">
          <span
            className="text-[12px] font-medium uppercase tracking-wider block mb-3"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            Select a time — {formatDayLabel(selectedDate)}
          </span>

          {timeSlots.length === 0 ? (
            <p
              className="text-[13px] py-6 text-center"
              style={{ color: "var(--color-ink-secondary)" }}
            >
              No available times for this date. Please select another day.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {timeSlots.map((slot) => {
                const isSelected =
                  selectedSlot?.hour === slot.hour &&
                  selectedSlot?.minute === slot.minute;
                return (
                  <button
                    key={`${slot.hour}-${slot.minute}`}
                    onClick={() => setSelectedSlot(slot)}
                    className="h-10 rounded-lg text-[13px] font-medium transition-all"
                    style={{
                      background: isSelected
                        ? "var(--color-viridian-500)"
                        : "var(--color-surface)",
                      color: isSelected ? "white" : "var(--color-ink)",
                      border: isSelected
                        ? "1px solid var(--color-viridian-600)"
                        : "1px solid var(--color-border)",
                    }}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      {selectedSlot && (
        <div className="mt-6">
          <button
            onClick={() => setStep("form")}
            className="w-full h-10 rounded-lg text-[14px] font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              background: "var(--color-viridian-500)",
              color: "white",
            }}
          >
            Continue
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </PageShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* Brand bar */}
      <div className="w-full py-4 px-6 flex items-center justify-center">
        <span
          className="text-[13px] font-medium tracking-tight"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          Powered by{" "}
          <span
            className="font-semibold"
            style={{ color: "var(--color-viridian-700)" }}
          >
            Workifyr
          </span>
        </span>
      </div>

      {/* Content card */}
      <div className="w-full max-w-xl px-4 pb-12">
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function MeetingHeader({ meetingType }: { meetingType: MeetingType }) {
  return (
    <div>
      <div
        className="size-11 rounded-xl inline-flex items-center justify-center mb-4"
        style={{
          background: "var(--color-viridian-100)",
          color: "var(--color-viridian-700)",
          border: "1px solid var(--color-viridian-200)",
        }}
      >
        <Video className="size-5" />
      </div>
      <h1
        className="text-[22px] font-semibold tracking-tight"
        style={{ color: "var(--color-ink)" }}
      >
        {meetingType.title}
      </h1>
      {meetingType.description && (
        <p
          className="mt-1.5 text-[14px]"
          style={{ color: "var(--color-ink-secondary)" }}
        >
          {meetingType.description}
        </p>
      )}
      <div className="flex items-center gap-3 mt-3">
        <span
          className="inline-flex items-center gap-1.5 text-[13px]"
          style={{ color: "var(--color-ink-tertiary)" }}
        >
          <Clock className="size-3.5" />
          {meetingType.duration_minutes} min
        </span>
        {meetingType.buffer_minutes > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[13px]"
            style={{ color: "var(--color-ink-tertiary)" }}
          >
            +{meetingType.buffer_minutes} min buffer
          </span>
        )}
      </div>
    </div>
  );
}
