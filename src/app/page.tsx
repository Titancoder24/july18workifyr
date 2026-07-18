"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, Search, Check, ChevronRight, ChevronDown } from "lucide-react";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init?: () => void };
  }
}

function useUnicornStudio() {
  useEffect(() => {
    if (window.UnicornStudio) {
      // Script already loaded (e.g. client-side navigation back to this page);
      // re-init so newly mounted [data-us-project] divs get picked up.
      window.UnicornStudio.init?.();
      return;
    }
    window.UnicornStudio = { isInitialized: false };
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.33/dist/unicornStudio.umd.js";
    script.onload = () => {
      if (!window.UnicornStudio!.isInitialized) {
        window.UnicornStudio!.init?.();
        window.UnicornStudio!.isInitialized = true;
      }
    };
    (document.head || document.body).appendChild(script);
  }, []);
}

const borderGradientCard = {
  position: "relative" as const,
  "--border-gradient": "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0))",
  "--border-radius-before": "8px",
} as React.CSSProperties;

const featureItems = [
  "Visual Kanban Pipelines",
  "Lead Generation & Routing",
  "Global B2B Database",
  "Automated PDF Invoicing",
  "Centralized Workforce Directory",
  "Org Charts & Departments",
  "Self-Serve Attendance & Leave",
  "One-Click Payroll Engine",
  "Learning Management System",
  "Community & Ticketing",
  "Omni Search Command",
  "PostgreSQL Row Level Security",
];

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/about", label: "About Us" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useUnicornStudio();

  return (
    <div className="min-h-screen bg-[#05070d] font-sans text-white antialiased">
      <style>{`
        [style*="--border-gradient"]::before {
          content: "";
          position: absolute;
          inset: 0;
          padding: 1px;
          border-radius: var(--border-radius-before, inherit);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          background: var(--border-gradient);
          pointer-events: none;
        }
      `}</style>

      <main className="w-full max-w-7xl mx-auto min-h-screen overflow-x-clip bg-[#05070d] border-x border-white/15">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden w-full mx-auto min-h-[850px] lg:min-h-screen bg-[#030610] sm:px-6 lg:px-8 pb-12 lg:pb-32 border-b border-white/15">
          {/* Unicorn Studio beam background (gradient fallback while it loads) */}
          <div
            data-us-project="1bY8o6HVTI1oxJxuCJEG"
            data-us-vars="accentColor:#10b981,beamColor:#10b981,glowColor:#34d399,foreground:#34d399,color1:#10b981,color2:#34d399,color3:#6ee7b7,color4:#a7f3d0,primary:#10b981,secondary:#34d399"
            className="absolute inset-0 w-full h-full z-0"
            style={{
              backgroundColor: "#030610",
              backgroundImage:
                "radial-gradient(ellipse 70% 20% at 50% 55%, rgba(255,255,255,0.15) 0%, rgba(16,185,129,0.1) 40%, transparent 100%), radial-gradient(ellipse 15% 60% at 50% 50%, rgba(16,185,129,0.1) 0%, transparent 100%)",
            }}
          />
          <div className="absolute inset-0 w-full h-full z-[1] pointer-events-none mix-blend-color bg-[radial-gradient(ellipse_80%_60%_at_50%_55%,rgba(16,185,129,0.6)_0%,rgba(16,185,129,0.15)_60%,transparent_100%)]" />
          <div className="absolute inset-0 w-full h-full z-[1] pointer-events-none mix-blend-screen bg-[radial-gradient(ellipse_50%_40%_at_50%_55%,rgba(52,211,153,0.15)_0%,transparent_100%)]" />
          <div className="pointer-events-none absolute left-0 bottom-0 z-[1] h-[500px] w-full bg-gradient-to-b from-transparent to-[#030610]/35" />

          <div className="relative z-20 mx-auto max-w-7xl">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-[100] w-full border-b border-white/15 bg-[#02050d]/80 backdrop-blur-md px-4 sm:px-6 lg:px-8">
              <div className="flex w-full h-[76px] max-w-7xl mx-auto max-sm:px-0 px-8 items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    className="md:hidden inline-flex items-center justify-center rounded-md p-1.5 -ml-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Open mobile menu"
                    onClick={() => setMobileMenuOpen(true)}
                  >
                    <Menu className="h-6 w-6" strokeWidth={1.5} />
                  </button>
                  <Link href="/" className="group flex items-center">
                    <span className="text-xl font-bold tracking-tight text-white">Workifyr</span>
                  </Link>
                </div>

                <nav className="hidden items-center gap-1 md:flex">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full px-4 py-1.5 text-xs font-light text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="hidden md:flex items-center gap-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-normal text-white transition-all duration-300 hover:bg-white/10"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-emerald-200/70 bg-slate-950/90 px-5 py-2.5 text-xs font-normal text-white shadow-[0_0_18px_rgba(52,211,153,0.42),0_0_38px_rgba(16,185,129,0.28),inset_0_0_14px_rgba(52,211,153,0.18)] transition-all duration-300 hover:scale-[1.02]"
                  >
                    Sign Up
                  </Link>
                </div>

                <div className="flex md:hidden items-center gap-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-normal text-white transition-all hover:bg-white/10"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </header>

            {/* Hero content */}
            <div className="flex flex-col sm:pt-40 text-center max-w-5xl mx-auto pt-32 items-center px-4 sm:px-6">
              <h1 className="max-w-4xl text-4xl font-normal leading-[1.1] sm:leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
                The ultimate CRM and HRM platform for modern teams
              </h1>
              <p className="leading-8 text-lg font-normal text-white max-w-2xl mt-6">
                Unify your Sales Pipeline, Human Resources, and Payroll into a single, highly-engineered
                architecture built to scale your business.
              </p>

              <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-[28px] border border-emerald-200/80 bg-slate-950/90 px-10 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(52,211,153,0.65),0_0_70px_rgba(16,185,129,0.45),inset_0_0_22px_rgba(52,211,153,0.22)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_42px_rgba(52,211,153,0.85),0_0_90px_rgba(16,185,129,0.65),inset_0_0_28px_rgba(52,211,153,0.28)]"
                >
                  Sign Up Free
                </Link>
                <Link
                  href="/login"
                  className="group relative inline-flex items-center justify-center overflow-hidden rounded-[28px] border border-white/20 bg-white/5 px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white/10"
                >
                  <span className="relative z-10 text-white">Sign In</span>
                </Link>
              </div>
            </div>

            {/* Dashboard mock */}
            <div className="flex min-h-[520px] flex-col sm:px-6 lg:flex-row lg:px-8 lg:mb-0 w-full z-30 mt-40 sm:mt-48 lg:mt-56 xl:mt-64 mb-24 px-4 relative">
              <div className="overflow-hidden bg-[#050914] w-full max-w-7xl border-emerald-500/20 border rounded-xl mx-auto p-1.5 relative">
                <div
                  className="flex min-h-[520px] overflow-hidden bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg"
                  style={borderGradientCard}
                >
                  {/* Sidebar */}
                  <aside className="hidden w-[210px] shrink-0 flex-col justify-between border-r border-white/10 bg-[#06111f]/60 p-4 lg:flex">
                    <div>
                      <div className="mb-7">
                        <p className="text-sm font-semibold tracking-[-0.04em] text-white">WORKIFYR</p>
                        <p className="text-[10px] text-white/35">Workspace</p>
                      </div>

                      <div>
                        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
                          Main
                        </p>
                        <nav className="space-y-1">
                          <span className="group flex items-center gap-2.5 text-xs font-medium text-white border-white/10 border rounded-xl py-2.5 px-3 relative bg-white/[0.04]">
                            <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-emerald-400" />
                            Overview
                          </span>
                          {["CRM Pipelines", "Employees", "Attendance", "Payroll"].map((item) => (
                            <span
                              key={item}
                              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white"
                            >
                              {item}
                            </span>
                          ))}
                        </nav>
                      </div>

                      <div className="mt-6">
                        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">
                          Workspace
                        </p>
                        <nav className="space-y-1">
                          {["Invoices", "Docs", "Support", "Settings"].map((item) => (
                            <span
                              key={item}
                              className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white"
                            >
                              {item}
                            </span>
                          ))}
                        </nav>
                      </div>
                    </div>

                    <div
                      className="flex transition hover:bg-white/[0.04] text-left bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 w-full rounded-xl mt-4 p-2 gap-2.5 items-center"
                      style={{ ...borderGradientCard, "--border-radius-before": "12px" } as React.CSSProperties}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-white/80">Workifyr Prod</p>
                        <p className="truncate text-[10px] text-white/35">System Admin</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/35" strokeWidth={2} />
                    </div>
                  </aside>

                  {/* Main content */}
                  <div className="flex-1 overflow-hidden bg-[#07101c] p-4 lg:p-5">
                    <header className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <h2 className="text-xl font-medium tracking-[-0.03em] text-white">Workifyr Workspace</h2>
                        <p className="mt-1 text-xs text-white/45">
                          Monitor sales, people, payroll, invoices, and operations from one secure workspace.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden h-9 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs text-white/40 sm:flex sm:w-60">
                          Search contacts, deals, employees...
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-white/10 hover:bg-white/[0.035]">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-white/10 text-xs font-semibold text-emerald-300">
                            OC
                          </div>
                          <div className="hidden leading-tight sm:block">
                            <p className="text-xs font-normal text-white">Olivia Carter</p>
                            <p className="text-[11px] text-white/45">Account settings</p>
                          </div>
                          <ChevronDown className="hidden h-3.5 w-3.5 text-white/35 sm:block" strokeWidth={2} />
                        </div>
                      </div>
                    </header>

                    {/* Top stat cards */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: "Open Deals", value: "$128K", sub: "Pipeline Value" },
                        { label: "Payroll Ready", value: "42", sub: "Employees" },
                        { label: "Pending Invoices", value: "$24,560", sub: "To be collected" },
                        { label: "Leave Requests", value: "8", sub: "Pending approval" },
                      ].map((card) => (
                        <div
                          key={card.label}
                          className="bg-white/[0.03] bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg px-3 py-3"
                          style={borderGradientCard}
                        >
                          <p className="text-xs text-white/55">{card.label}</p>
                          <div className="mt-2 flex items-end gap-2">
                            <span className="text-xl font-normal text-white">{card.value}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/40">{card.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Middle analytics */}
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-6 mt-3">
                      <div className="xl:col-span-3 bg-white/[0.02] bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg p-5 border border-white/10">
                        <h2 className="text-sm font-medium text-white mb-5">Pipeline Stages</h2>
                        <div className="space-y-4">
                          {[
                            { stage: "Lead", deals: "45 Deals", width: "80%", color: "bg-emerald-400" },
                            { stage: "Qualified", deals: "28 Deals", width: "50%", color: "bg-emerald-300" },
                            { stage: "Negotiation", deals: "12 Deals", width: "25%", color: "bg-emerald-500" },
                            { stage: "Closed Won", deals: "8 Deals", width: "15%", color: "bg-emerald-600" },
                          ].map((row) => (
                            <div key={row.stage} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/70">{row.stage}</span>
                                <span className="text-xs font-medium text-white">{row.deals}</span>
                              </div>
                              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                <div className={`${row.color} h-full rounded-full`} style={{ width: row.width }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="xl:col-span-3 bg-white/[0.02] bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg p-5 border border-white/10">
                        <h2 className="text-sm font-medium text-white mb-5">Payroll Progress</h2>
                        <div className="space-y-4">
                          {[
                            "Ready for monthly salary run",
                            "Attendance synced",
                            "Deductions calculated",
                          ].map((item) => (
                            <div key={item} className="flex items-center gap-3">
                              <div className="h-5 w-5 rounded-full bg-emerald-400/20 border border-emerald-400/50 flex items-center justify-center">
                                <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} />
                              </div>
                              <span className="text-sm text-white/80">{item}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-3">
                            <div className="h-5 w-5 rounded-full bg-amber-400/20 border border-amber-400/50 flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            </div>
                            <span className="text-sm text-white/80">Salary slips pending</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom cards */}
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-5 mt-3">
                      <div className="xl:col-span-3 bg-white/[0.02] bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg p-5 border border-white/10">
                        <h2 className="text-sm font-medium text-white mb-5">Team Directory</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { dept: "Eng", members: "18 Members" },
                            { dept: "Sales", members: "12 Members" },
                            { dept: "HR", members: "4 Members" },
                            { dept: "Ops", members: "8 Members" },
                          ].map((d) => (
                            <div
                              key={d.dept}
                              className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center hover:bg-white/[0.06] transition-colors"
                            >
                              <p className="text-sm font-medium text-white">{d.dept}</p>
                              <p className="text-[11px] text-white/50 mt-1">{d.members}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="xl:col-span-2 bg-white/[0.02] bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 rounded-lg p-5 border border-white/10 flex flex-col justify-center items-center text-center">
                        <h2 className="text-sm font-medium text-white mb-4 w-full text-left">Cmd+K Omni Search</h2>
                        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-inner">
                          <Search className="h-4 w-4 text-white/40" strokeWidth={2} />
                          <span className="text-xs text-white/40">Search contacts, deals, employees, invoices...</span>
                          <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">⌘K</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 h-16 w-full overflow-hidden border-t border-white/10 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08), transparent 55%), repeating-linear-gradient(to right, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 1px, transparent 1px, transparent 16px)",
            }}
          />
        </section>

        {/* ============================= FRICTION + FEATURES ============================= */}
        <section className="overflow-hidden sm:px-6 lg:px-8 lg:pb-32 lg:pt-12 text-white bg-[#030711] border-white/15 border-b pt-16 px-8 pb-20 relative">
          <div className="relative mx-auto max-w-6xl">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between border-white/10 border-b pb-10">
              <div className="max-w-xl">
                <div className="inline-flex uppercase text-xs font-normal text-emerald-300/90 tracking-[0.24em] gap-3 items-center">
                  The Friction
                </div>
                <h2 className="mt-6 text-4xl font-normal leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                  You are paying for 10 different tools
                  <br className="hidden sm:block" />
                  <span className="bg-clip-text text-transparent bg-gradient-to-br from-emerald-300 to-emerald-500">
                    that don&apos;t talk to each other.
                  </span>
                </h2>
              </div>

              <div className="max-w-md lg:pb-2 text-white/70">
                Managing data across Salesforce, Workday, BambooHR, and standalone Payroll apps creates endless
                silos. It&apos;s expensive, fragile, and slows your team down.
              </div>
            </div>

            <div className="border-t border-emerald-200/10 pt-5 mt-10">
              <div className="mb-12 text-center max-w-2xl mx-auto">
                <h2 className="text-3xl font-medium tracking-tight text-white sm:text-4xl">Unified by Design.</h2>
                <p className="mt-4 text-base text-white/60">
                  We collapsed CRM, HRM, and System Administration into one tightly integrated suite.
                </p>
              </div>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featureItems.map((feature) => (
                  <div
                    key={feature}
                    className="bg-white/[0.01] bg-gradient-to-br from-emerald-500/5 to-emerald-500/0 rounded-xl p-5 border border-white/5 shadow-sm backdrop-blur-sm"
                  >
                    <h3 className="text-sm font-medium text-white">{feature}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 h-16 w-full overflow-hidden border-t border-white/25"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent 55%), repeating-linear-gradient(to right, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 1px, transparent 1px, transparent 16px)",
            }}
          />
        </section>

        {/* ============================= FINAL CTA ============================= */}
        <section className="overflow-hidden sm:px-6 lg:px-8 bg-[#030610] py-32 relative text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-3 text-xs font-normal uppercase tracking-[0.24em] text-emerald-300/90 mb-6">
            <span className="text-emerald-400">//</span>
            <span>Get Started Today</span>
          </div>
          <h2 className="text-5xl font-normal leading-[1.1] tracking-tight text-white sm:text-6xl mb-6">
            Deploy the Workspace.
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-white/60 mb-10 font-light leading-8 px-4">
            Stop paying for 10 different SaaS tools. Unify your entire company on a single, highly-secure
            architecture today.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center relative z-10">
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-[28px] border border-emerald-200/80 bg-slate-950/90 px-10 py-4 text-base font-semibold text-white shadow-[0_0_30px_rgba(52,211,153,0.65),0_0_70px_rgba(16,185,129,0.45),inset_0_0_22px_rgba(52,211,153,0.22)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_42px_rgba(52,211,153,0.85),0_0_90px_rgba(16,185,129,0.65),inset_0_0_28px_rgba(52,211,153,0.28)]"
            >
              Create Your Account
            </Link>
            <Link
              href="/login"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-[28px] border border-white/20 bg-white/5 px-10 py-4 text-base font-semibold text-white transition-all duration-300 hover:bg-white/10"
            >
              <span className="relative z-10 text-white">Sign In</span>
            </Link>
          </div>

          <div
            className="pointer-events-none absolute bottom-0 left-0 h-16 w-full overflow-hidden border-t border-white/25"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.08), transparent 55%), repeating-linear-gradient(to right, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 1px, transparent 1px, transparent 16px)",
            }}
          />
        </section>
      </main>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[200] bg-[#020806]/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 sm:px-6 h-[76px] border-b border-white/10">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-white flex items-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Workifyr
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close mobile menu"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="flex flex-col px-6 py-12 gap-8 items-center text-center overflow-y-auto">
            <Link
              href="/"
              className="text-xl font-medium text-white/90 hover:text-emerald-400 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xl font-medium text-white/90 hover:text-emerald-400 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-4 w-full max-w-xs">
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-emerald-200/70 bg-slate-950/90 px-8 py-3 text-sm font-medium text-white shadow-[0_0_18px_rgba(52,211,153,0.42),0_0_38px_rgba(16,185,129,0.28),inset_0_0_14px_rgba(52,211,153,0.18)] transition-all duration-300 hover:scale-[1.02]"
              >
                Sign Up
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-medium text-white transition-all hover:bg-white/10"
              >
                Sign In
              </Link>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
