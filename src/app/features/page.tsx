import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Briefcase, CreditCard, Users, LayoutDashboard, DatabaseZap, Search } from "lucide-react";

export default function FeaturesPage() {
  const features = [
    {
      title: "CRM Pipelines",
      description: "Visual, drag-and-drop Kanban boards for your deals. Instantly see your revenue funnel and block out the noise.",
      icon: <LayoutDashboard className="size-6 text-[var(--color-primary)]" />
    },
    {
      title: "Invoicing Engine",
      description: "Generate professional PDFs, track pending payments, and never let a closed won deal slip through the billing cracks.",
      icon: <CreditCard className="size-6 text-[var(--color-primary)]" />
    },
    {
      title: "Employee Directory",
      description: "A centralized, secure database of every team member. Manage emergency contacts, roles, and departmental org charts.",
      icon: <Users className="size-6 text-[var(--color-primary)]" />
    },
    {
      title: "Attendance & Leaves",
      description: "Self-service portal for employees to request time off. Managers can approve or reject with a single click.",
      icon: <Briefcase className="size-6 text-[var(--color-primary)]" />
    },
    {
      title: "Automated Payroll",
      description: "Generate monthly salary slips dynamically based on base pay, deductions, and attendance records.",
      icon: <DatabaseZap className="size-6 text-[var(--color-primary)]" />
    },
    {
      title: "Omni Search",
      description: "Hit Cmd+K from anywhere in the application to instantly pull up a contact, a deal, or navigate to a specific settings page.",
      icon: <Search className="size-6 text-[var(--color-primary)]" />
    }
  ];

  return (
    <div className="bg-[var(--color-background)] text-[var(--color-on-background)] font-[family-name:var(--font-body-md)] min-h-screen flex flex-col">
      <MarketingNavbar />
      
      <main className="flex-1 pt-32 pb-[var(--spacing-section-gap)] px-[var(--spacing-margin-mobile)] md:px-[var(--spacing-margin-desktop)] max-w-[1280px] mx-auto w-full">
        
        {/* Header */}
        <section className="text-center flex flex-col items-center gap-[var(--spacing-stack-md)] mb-20">
          <h1 className="font-[family-name:var(--font-display-xl)] text-[length:var(--text-headline-lg-mobile)] md:text-[length:var(--text-display-xl)] leading-[var(--text-display-xl--line-height)] tracking-[var(--text-display-xl--letter-spacing)] font-extrabold text-[var(--color-on-background)]">
            Everything you need. <br /> <span className="text-[var(--color-primary)]">Nothing you don't.</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[length:var(--text-body-lg)] text-[var(--color-secondary)] max-w-2xl mt-4">
            A meticulously curated set of features designed to run your entire operation, without the bloat of legacy software.
          </p>
        </section>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-gutter)]">
          {features.map((f, i) => (
            <div key={i} className="glass-card p-8 rounded-2xl flex flex-col gap-4 relative overflow-hidden group">
              <div className="ai-glow opacity-0 group-hover:opacity-10 transition-opacity"></div>
              <div className="size-12 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="font-[family-name:var(--font-headline-sm)] text-[length:var(--text-headline-sm)] font-bold text-[var(--color-on-background)] mt-2">
                {f.title}
              </h3>
              <p className="text-[var(--color-secondary)] leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>

      </main>

      <MarketingFooter />
    </div>
  );
}
