"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search, Bell, Sparkles, Plus, ChevronRight, ChevronDown,
} from "lucide-react";
import { initials } from "@/lib/format";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  crm: "CRM",
  hrm: "HRM",
  admin: "Admin",
  contacts: "Contacts",
  companies: "Companies",
  leads: "Leads",
  pipelines: "Pipelines",
  tasks: "Tasks",
  meetings: "Meetings",
  quotations: "Quotations",
  invoices: "Invoices",
  reports: "Reports",
  ai: "AI Assistant",
  employees: "Employees",
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
  performance: "Performance",
  announcements: "Announcements",
  team: "Team",
  permissions: "Permissions",
  audit: "Audit Log",
  settings: "Settings",
};

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function buildCrumbs(pathname: string | null): string[] {
  if (!pathname) return ["Workspace"];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Workspace"];
  if (segments[0] === "dashboard") return ["Workspace", "Dashboard"];
  return segments.map(labelFor);
}

export function Topbar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header
      style={{
        height: 52,
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-canvas)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-ink-tertiary)",
        }}
      >
        {crumbs.map((c, i) => {
          const isLeaf = i === crumbs.length - 1;
          return (
            <span key={`${c}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {i > 0 && (
                <ChevronRight
                  size={12}
                  style={{ color: "var(--color-ink-quaternary)" }}
                />
              )}
              <span
                style={{
                  color: isLeaf ? "var(--color-ink)" : "var(--color-ink-tertiary)",
                  fontWeight: isLeaf ? 550 : 500,
                }}
              >
                {c}
              </span>
            </span>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: 280,
          height: 32,
          padding: "0 10px",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          borderRadius: 8,
          color: "var(--color-ink-tertiary)",
          fontSize: 12.5,
          cursor: "pointer",
        }}
      >
        <Search size={13} />
        <span>Search or run command…</span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            padding: "1px 5px",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </button>

      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 28,
          padding: "0 10px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 550,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          color: "var(--color-ink)",
          letterSpacing: "-0.005em",
          whiteSpace: "nowrap",
        }}
      >
        <Plus size={13} />
        <span>Create</span>
        <ChevronDown size={11} style={{ marginLeft: 2, color: "var(--color-ink-tertiary)" }} />
      </button>

      <ThemeToggle />

      <NotificationsBell />

      <Link
        href="/crm/ai"
        aria-label="Open AI assistant"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 28,
          padding: "0 10px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 550,
          background: "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))",
          color: "white",
          border: "1px solid var(--color-viridian-700)",
          boxShadow: "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.18)",
          letterSpacing: "-0.005em",
          whiteSpace: "nowrap",
        }}
      >
        <Sparkles size={13} />
        <span>Assistant</span>
      </Link>

      <div
        aria-label={userName}
        title={userName}
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: "linear-gradient(135deg, #c97a4d, #a35a35)",
          display: "grid",
          placeItems: "center",
          color: "white",
          fontWeight: 600,
          fontSize: 11,
          cursor: "pointer",
          position: "relative",
        }}
      >
        {initials(userName)}
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--color-success)",
            border: "2px solid var(--color-canvas)",
          }}
        />
      </div>
    </header>
  );
}
