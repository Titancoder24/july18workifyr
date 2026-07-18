"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, FileText, MonitorPlay, LogOut, Search, Bell, Users, ChevronDown, PanelLeftClose, PanelLeft, Palette } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarStyle, setSidebarStyle] = useState<"brand" | "plain">("plain");
  const branded = sidebarStyle === "brand";

  const NAV = [
    {
      title: "Core Modules",
      items: [
        { href: "/admin", label: "System Telemetry", icon: LayoutDashboard },
        { href: "/admin/users", label: "Identity & Access", icon: Users },
      ]
    },
    {
      title: "Content Management",
      items: [
        { href: "/admin/cms", label: "Blog Posts", icon: FileText },
        { href: "/admin/lms", label: "LMS Videos", icon: MonitorPlay },
      ]
    },
    {
      title: "Engagement",
      items: [
        { href: "/admin/community", label: "Community Forum", icon: Users },
        { href: "/admin/tickets", label: "Support Tickets", icon: Bell },
      ]
    }
  ];

  async function handleLogout() {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    document.cookie = "admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/admin/login");
  }

  // Same variables as user-side sidebar
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

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--color-canvas)" }}>
      {/* Sidebar */}
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
              }}
            >
              W
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1, color: sbInk }}>
              Workifyr Admin
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 4, color: sbInkTertiary }}
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            style={{
              width: 40, height: 38, margin: "0 auto", display: "grid", placeItems: "center",
              borderRadius: 8, border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
              background: sbSurface, color: sbInkSecondary,
            }}
          >
            <PanelLeft size={16} />
          </button>
        )}

        <nav style={{ flex: 1, overflowY: "auto", paddingRight: 2, marginTop: 4 }}>
          {NAV.map((section) => (
            <div key={section.title} style={{ marginBottom: 14 }}>
              {!collapsed ? (
                <div style={{ padding: "6px 10px 4px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: sbInkTertiary }}>
                  {section.title}
                </div>
              ) : (
                <div style={{ width: 24, height: 1, margin: "6px auto", background: branded ? "rgba(255,255,255,0.10)" : "var(--color-border)" }} />
              )}
              {section.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: collapsed ? 0 : 9,
                      height: 30, padding: collapsed ? "0" : "0 10px", borderRadius: 6,
                      fontSize: 13, fontWeight: active ? 550 : 450, cursor: "pointer",
                      transition: "background 100ms ease-out", position: "relative",
                      margin: "1px 0", justifyContent: collapsed ? "center" : "flex-start",
                      background: active ? sbActiveBg : "transparent", color: active ? sbActiveInk : sbInkSecondary,
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
                      <span aria-hidden style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, background: sbAccent, borderRadius: 2 }} />
                    )}
                    <Icon size={16} style={{ flex: "0 0 16px", color: active ? sbActiveIcon : sbInkTertiary }} />
                    {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <button
            onClick={() => setSidebarStyle(branded ? "plain" : "brand")}
            title={branded ? "Switch to plain sidebar" : "Switch to brand sidebar"}
            style={{
              display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px",
              border: `1px solid ${branded ? "rgba(255,255,255,0.14)" : "var(--color-border)"}`,
              background: sbSurface, borderRadius: 8, fontSize: 12, fontWeight: 500,
              color: sbInkSecondary, cursor: "pointer", width: "100%", marginTop: 4,
            }}
          >
            <Palette size={13} style={{ color: sbInkTertiary }} />
            <span style={{ flex: 1, textAlign: "left" }}>{branded ? "Plain sidebar" : "Brand sidebar"}</span>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: branded ? "white" : "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))", border: branded ? "1px solid rgba(255,255,255,0.3)" : "none" }} />
          </button>
        )}

        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: collapsed ? 0 : 9,
            height: 30, padding: collapsed ? "0" : "0 10px", borderRadius: 6,
            fontSize: 13, fontWeight: 500, cursor: "pointer", marginTop: 6,
            justifyContent: collapsed ? "center" : "flex-start",
            background: "transparent", color: sbInkSecondary, border: "none", width: "100%"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = sbSurfaceHover;
            e.currentTarget.style.color = sbInk;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = sbInkSecondary;
          }}
        >
          <LogOut size={16} style={{ flex: "0 0 16px", color: sbInkTertiary }} />
          {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>Sign Out</span>}
        </button>
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Navbar mimicking AppNavbar */}
        <header style={{ height: 48, background: "var(--color-canvas)", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-ink-secondary)", fontWeight: 500 }}>
            <span>Admin Control</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-ink-quaternary)" }} />
              <input 
                type="text" 
                placeholder="Search..." 
                style={{ height: 28, width: 200, paddingLeft: 30, paddingRight: 12, fontSize: 12.5, borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink)" }}
              />
            </div>
            <button style={{ background: "none", border: "none", color: "var(--color-ink-tertiary)", cursor: "pointer" }}>
              <Bell size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-ink)" }}>workifyr@gmail.com</div>
              <div style={{ width: 24, height: 24, borderRadius: 999, background: "linear-gradient(135deg, var(--color-viridian-500), var(--color-viridian-700))", color: "white", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600 }}>A</div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", background: "var(--color-surface-2)", padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
