"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Right-edge slide-in side sheet. Used for create/edit forms across the app —
 * the side sheet keeps the underlying list visible while you work, which is
 * more comfortable than a modal overlay for repetitive data entry.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = 480,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 z-30 transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        style={{ background: "rgba(15,23,42,0.32)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          width: `min(100vw, ${width}px)`,
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <div
          className="px-5 py-4 flex items-start justify-between gap-3 border-b shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--color-ink-secondary)" }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-lg shrink-0 hover:bg-[var(--color-surface-hover)]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div
            className="px-5 py-3 border-t shrink-0 flex items-center justify-end gap-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
