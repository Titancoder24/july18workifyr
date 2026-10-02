"use client";

import Link from "next/link";
import { Check, ContactRound, MailOpen, Send } from "lucide-react";

const steps = [
  {
    id: "contacts",
    number: "01",
    label: "Contacts",
    detail: "Build the audience",
    href: "/outreach/contacts",
    icon: ContactRound,
  },
  {
    id: "outreach",
    number: "02",
    label: "Outreach",
    detail: "Write, review, and schedule",
    href: "/outreach",
    icon: Send,
  },
  {
    id: "inbox",
    number: "03",
    label: "Outreach inbox",
    detail: "Monitor and reply",
    href: "/outreach/inbox",
    icon: MailOpen,
  },
] as const;

export function OutreachWorkflowNav({ active }: { active: (typeof steps)[number]["id"] }) {
  const activeIndex = steps.findIndex((step) => step.id === active);
  return (
    <nav aria-label="Outreach workflow" className="card mb-5 overflow-hidden">
      <div className="grid md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const current = step.id === active;
          const complete = index < activeIndex;
          return (
            <Link
              key={step.id}
              href={step.href}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors"
              style={{
                background: current ? "var(--color-viridian-50)" : "transparent",
                borderRight: index < steps.length - 1 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: current
                    ? "var(--color-viridian-500)"
                    : complete
                      ? "var(--color-viridian-100)"
                      : "var(--color-surface-2)",
                  color: current ? "white" : complete ? "var(--color-viridian-700)" : "var(--color-ink-tertiary)",
                }}
              >
                {complete ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[10.5px] font-semibold tracking-wide" style={{ color: "var(--color-ink-tertiary)" }}>
                  {step.number}
                </span>
                <span className="block truncate text-[13px] font-semibold">{step.label}</span>
                <span className="block truncate text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                  {step.detail}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
