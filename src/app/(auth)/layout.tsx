import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Sparkles, Users, BadgeIndianRupee, Workflow } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen grid lg:grid-cols-[1fr_minmax(440px,520px)]"
      style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}
    >
      {/* Left panel — viridian product showcase */}
      <aside
        className="hidden lg:flex flex-col justify-between px-12 py-10 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, var(--color-viridian-700) 0%, var(--color-viridian-900) 100%)",
          color: "white",
        }}
      >
        {/* Decorative dot grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-white/90" />
            <span className="text-[18px] font-semibold tracking-tight">Workifyr</span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="display text-[44px] leading-[1.05] tracking-tight">
            One workspace.
            <br />
            <span className="opacity-80">CRM, HR, and the AI</span>
            <br />
            that runs them.
          </h2>
          <p className="mt-5 text-[14px] opacity-75">
            Built for the founder who tracks deals on a spreadsheet and salaries on an Excel template. Workifyr replaces both with one system of record — and an assistant that can answer any question about any record.
          </p>

          <ul className="mt-8 space-y-2.5">
            {[
              { icon: <Workflow className="size-3.5" />, text: "Drag-drop pipeline with weighted forecast" },
              { icon: <Users className="size-3.5" />, text: "Contacts, companies, deals — one model" },
              { icon: <BadgeIndianRupee className="size-3.5" />, text: "Payroll engine with branded slips" },
              { icon: <Sparkles className="size-3.5" />, text: "Two AI assistants, permission-aware" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-2.5 text-[13px] opacity-90">
                <span
                  className="size-6 rounded-md inline-flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}
                >
                  {f.icon}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[12px] opacity-60">
          Work, verified, faster.
        </div>
      </aside>

      {/* Right panel — auth form */}
      <main className="flex flex-col">
        <header
          className="h-14 flex lg:hidden items-center px-6 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Wordmark variant="display" />
        </header>
        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <footer
          className="py-5 px-6 text-center text-[12px] border-t"
          style={{ color: "var(--color-ink-tertiary)", borderColor: "var(--color-border)" }}
        >
          © Workifyr · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
