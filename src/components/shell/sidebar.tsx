"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home, Users, Building2, Flame, GitBranch, CheckSquare,
  Calendar, FileText, Receipt, BarChart3, Sparkles,
  UserCheck, Clock, Plane, Wallet, Star, Megaphone,
  Settings, Shield, Activity, Eye,
  ChevronDown, ChevronRight, Search,
  PanelLeftClose, PanelLeft, Palette,
} from "lucide-react";
import { useRBAC } from "@/lib/rbac";
import { initials as toInitials } from "@/lib/format";
import { useTheme } from "@/lib/theme";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  module?: string;
  count?: number;
};
type NavSection = { title: string; items: NavItem[]; adminOnly?: boolean };

const NAV: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home, module: "dashboard" },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/crm/contacts",   label: "Contacts",     icon: Users,      module: "contacts",   count: 8 },
      { href: "/crm/companies",  label: "Companies",    icon: Building2,  module: "companies",  count: 6 },
      { href: "/crm/leads",      label: "Leads",        icon: Flame,      module: "leads",      count: 12 },
      { href: "/crm/pipelines",  label: "Pipelines",    icon: GitBranch,  module: "pipelines" },
      { href: "/crm/tasks",      label: "Tasks",        icon: CheckSquare, module: "tasks",     count: 4 },
      { href: "/crm/meetings",   label: "Meetings",     icon: Calendar,   module: "meetings" },
      { href: "/crm/quotations", label: "Quotations",   icon: FileText,   module: "quotations" },
      { href: "/crm/invoices",   label: "Invoices",     icon: Receipt,    module: "invoices" },
      { href: "/crm/reports",    label: "Reports",      icon: BarChart3,  module: "reports" },
      { href: "/crm/ai",         label: "AI Assistant", icon: Sparkles,   module: "ai" },
    ],
  },
  {
    title: "HRM",
    items: [
      { href: "/hrm/employees",     label: "Employees",     icon: UserCheck, module: "employees" },
      { href: "/hrm/attendance",    label: "Attendance",    icon: Clock,     module: "attendance" },
      { href: "/hrm/leave",         label: "Leave",         icon: Plane,     module: "leave",     count: 2 },
      { href: "/hrm/payroll",       label: "Payroll",       icon: Wallet,    module: "payroll" },
      { href: "/hrm/performance",   label: "Performance",   icon: Star,      module: "performance" },
      { href: "/hrm/announcements", label: "Announcements", icon: Megaphone, module: "announcements" },
      { href: "/hrm/ai",            label: "AI Assistant",  icon: Sparkles,  module: "ai" },
    ],
  },
  {
    title: "Admin",
    adminOnly: true,
    items: [
      { href: "/admin/team",        label: "Team",        icon: Users,    module: "team" },
      { href: "/admin/permissions", label: "Permissions", icon: Shield,   module: "permissions" },
      { href: "/admin/ai",          label: "AI Usage",    icon: Activity, module: "ai_usage" },
      { href: "/admin/audit",       label: "Audit Log",   icon: Eye,      module: "audit_log" },
      { href: "/admin/settings",    label: "Settings",    icon: Settings, module: "settings" },
    ],
  },
];

export function Sidebar({
  workspaceName = "Workifyr",
  workspaceBrand = "W",
  userName = "User",
  userRole = "Member",
}: {
  workspaceName?: string;
  workspaceBrand?: string;
  userName?: string;
  userRole?: string;
} = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { canView, isAdmin, isOwner, loading } = useRBAC();
  const { sidebarStyle, toggleSidebarStyle } = useTheme();
  const branded = sidebarStyle === "brand";

  const visibleNav = NAV.map((section) => {
    if (section.adminOnly && !isAdmin && !isOwner) return null;
    const visibleItems = section.items.filter((item) => {
      if (!item.module) return true;
      if (item.module === "dashboard") return true;
      if (isAdmin || isOwner) return true;
      return canView(item.module);
    });
    if (visibleItems.length === 0) return null;
    return { ...section, items: visibleItems };
  }).filter(Boolean) as NavSection[];

  const sbBg = branded ? "var(--color-viridian-700)" : "var(--color-canvas)";
  const sbBorder = branded ? "var(--color-viridian-800)" : "var(--color-border)";
  const sbInk = branded ? "rgba(255,255,255,0.95)" : "var(--color-ink)";
  const sbInkSecondary = branded ? "rgba(255,255,255,0.78)" : "var(--color-ink-secondary)";
  const sbInkTertiary = branded ? "rgba(255,255,255,0.55)" : "var(--color-ink-tertiary)";
  const sbSurface = branded ? "rgba(255,255,255,0.08)" : "var(--color-surface)";
  const sbSurfaceHover = branded ? "rgba(255,255,255,0.10)" : "var(--color-surface-hover)";
  const sbActiveBg = branded ? "rgba(255,255,255,0.14)" : "var(--color-viridian-50)";
  const sbActiveInk = branded ? "white" : "var(--color-viridian-700)";
  const sbActiveIcon = branded ? "white" : "var(--color-viridian-600)";
  const sbAccent = branded ? "white" : "var(--color-viridian-500)";
  const sbCountBg = branded ? "rgba(255,255,255,0.16)" : "var(--color-surface-2)";
  const sbCountBgActive = branded ? "rgba(255,255,255,0.22)" : "var(--color-viridian-100)";
  const sbCountInk = branded ? "rgba(255,255,255,0.85)" : "var(--color-ink-tertiary)";
  const sbCountInkActive = branded ? "white" : "var(--color-viridian-700)";

  return (
    <aside
      className="hidden lg:flex shrink-0 flex-col transition-all duration-200"
      style={{
        width: collapsed ? 64 : 248,
        background: sbBg,
        borderRight: `1px solid ${sbBorder}`,
        height: "100vh",
        position: "sticky",
        top: 0,
        padding: collapsed ? "12px 8px" : "12px 10px",
        gap: 6,
      }}
    >
      {!collapsed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 8,
            border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
            background: sbSurface,
            height: 38,
            cursor: "pointer",
            transition: "background 100ms ease-out",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: branded
                ? "white"
                : "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))",
              color: branded ? "var(--color-viridian-700)" : "white",
              fontWeight: 700,
              fontSize: 11,
              display: "grid",
              placeItems: "center",
              letterSpacing: "-0.02em",
            }}
          >
            {workspaceBrand}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              flex: 1,
              letterSpacing: "-0.01em",
              color: sbInk,
            }}
          >
            {workspaceName}
          </div>
          <ChevronDown size={14} style={{ color: sbInkTertiary }} />
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              width: 22,
              height: 22,
              display: "grid",
              placeItems: "center",
              borderRadius: 4,
              color: sbInkTertiary,
            }}
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{
            width: 40,
            height: 38,
            margin: "0 auto",
            display: "grid",
            placeItems: "center",
            borderRadius: 8,
            border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
            background: sbSurface,
            color: sbInkSecondary,
          }}
        >
          <PanelLeft size={16} />
        </button>
      )}

      {!collapsed && (
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            padding: "0 10px",
            border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
            background: sbSurface,
            borderRadius: 8,
            fontSize: 12.5,
            color: sbInkTertiary,
            cursor: "pointer",
            width: "100%",
            marginBottom: 6,
          }}
        >
          <Search size={14} />
          <span>Search or jump to…</span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              padding: "1px 5px",
              background: branded ? "rgba(0,0,0,0.18)" : "var(--color-surface-2)",
              border: `1px solid ${branded ? "rgba(255,255,255,0.10)" : "var(--color-border)"}`,
              borderRadius: 4,
              color: sbInkTertiary,
            }}
          >
            ⌘K
          </span>
        </button>
      )}

      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: 2,
          marginTop: 4,
        }}
      >
        {loading ? (
          <div className="px-3 py-8 flex justify-center">
            <div
              className="size-5 border-2 rounded-full animate-spin"
              style={{
                borderColor: "var(--color-border)",
                borderTopColor: "var(--color-viridian-500)",
              }}
            />
          </div>
        ) : (
          visibleNav.map((section) => (
            <div key={section.title} style={{ marginBottom: 14 }}>
              {!collapsed ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px 4px",
                    fontSize: 10.5,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: sbInkTertiary,
                  }}
                >
                  <span>{section.title}</span>
                </div>
              ) : (
                <div
                  style={{
                    width: 24,
                    height: 1,
                    margin: "6px auto",
                    background: branded ? "rgba(255,255,255,0.10)" : "var(--color-border)",
                  }}
                />
              )}
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className="nav-link-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: collapsed ? 0 : 9,
                      height: 30,
                      padding: collapsed ? "0" : "0 10px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: active ? 550 : 450,
                      cursor: "pointer",
                      transition: "background 100ms ease-out",
                      position: "relative",
                      margin: "1px 0",
                      justifyContent: collapsed ? "center" : "flex-start",
                      background: active ? sbActiveBg : "transparent",
                      color: active ? sbActiveInk : sbInkSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = sbSurfaceHover;
                        e.currentTarget.style.color = sbInk;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = sbInkSecondary;
                      }
                    }}
                  >
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 2,
                          background: sbAccent,
                          borderRadius: 2,
                        }}
                      />
                    )}
                    <Icon
                      size={16}
                      style={{
                        flex: "0 0 16px",
                        color: active ? sbActiveIcon : sbInkTertiary,
                      }}
                    />
                    {!collapsed && (
                      <>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.count != null && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: active ? sbCountInkActive : sbCountInk,
                              background: active ? sbCountBgActive : sbCountBg,
                              padding: "1px 6px",
                              borderRadius: 999,
                              minWidth: 18,
                              textAlign: "center",
                            }}
                          >
                            {item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </nav>

      {!collapsed && (
        <button
          onClick={toggleSidebarStyle}
          title={branded ? "Switch to plain sidebar" : "Switch to brand sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 30,
            padding: "0 10px",
            border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
            background: sbSurface,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            color: sbInkSecondary,
            cursor: "pointer",
            width: "100%",
            marginTop: 4,
          }}
        >
          <Palette size={13} style={{ color: sbInkTertiary }} />
          <span style={{ flex: 1, textAlign: "left" }}>
            {branded ? "Plain sidebar" : "Brand sidebar"}
          </span>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: branded
                ? "white"
                : "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))",
              border: branded ? "1px solid rgba(255,255,255,0.3)" : "none",
            }}
          />
        </button>
      )}

      {!collapsed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "6px 8px",
            borderRadius: 8,
            border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
            background: sbSurface,
            marginTop: 6,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "linear-gradient(135deg, #c97a4d, #a35a35)",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {toInitials(userName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 550,
                lineHeight: 1.1,
                color: sbInk,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </div>
            <div style={{ fontSize: 10.5, color: sbInkTertiary }}>
              {userRole}
            </div>
          </div>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--color-success)",
              boxShadow: branded ? "0 0 0 2px rgba(255,255,255,0.18)" : "0 0 0 2px var(--color-success-bg)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            placeItems: "center",
            marginTop: 6,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "linear-gradient(135deg, #c97a4d, #a35a35)",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 600,
              fontSize: 11,
              position: "relative",
            }}
          >
            {toInitials(userName)}
            <span
              style={{
                position: "absolute",
                bottom: -1,
                right: -1,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-success)",
                border: "2px solid var(--color-canvas)",
              }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
