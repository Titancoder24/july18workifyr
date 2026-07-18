import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Building2, Globe2, Users2 } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="bg-[var(--color-background)] text-[var(--color-on-background)] font-[family-name:var(--font-body-md)] min-h-screen flex flex-col">
      <MarketingNavbar />
      
      <main className="flex-1 pt-32 pb-[var(--spacing-section-gap)] px-[var(--spacing-margin-mobile)] md:px-[var(--spacing-margin-desktop)] max-w-[1280px] mx-auto w-full">
        
        {/* Header */}
        <section className="text-center flex flex-col items-center gap-[var(--spacing-stack-md)] mb-24">
          <span className="font-[family-name:var(--font-label-md)] text-[length:var(--text-label-md)] tracking-[var(--text-label-md--letter-spacing)] text-[var(--color-primary)] bg-[var(--color-primary-container)]/20 px-3 py-1 rounded-full w-max">
            Our Mission
          </span>
          <h1 className="font-[family-name:var(--font-display-xl)] text-[length:var(--text-headline-lg-mobile)] md:text-[length:var(--text-display-xl)] leading-[var(--text-display-xl--line-height)] tracking-[var(--text-display-xl--letter-spacing)] font-extrabold text-[var(--color-on-background)]">
            We build software for <span className="text-[var(--color-primary)]">serious businesses.</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[length:var(--text-body-lg)] text-[var(--color-secondary)] max-w-3xl mt-4">
            The era of duct-taping disjointed SaaS tools is over. We believe in unified data, rigorous engineering, and interfaces that get out of your way.
          </p>
        </section>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--spacing-gutter)]">
          <div className="glass-card p-8 rounded-2xl flex flex-col gap-6 relative overflow-hidden group">
            <div className="ai-glow opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="size-14 rounded-xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-primary)]">
              <Building2 className="size-6" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline-sm)] text-[length:var(--text-headline-sm)] font-bold mb-3">Enterprise Grade</h3>
              <p className="text-[var(--color-secondary)] leading-relaxed">
                We don't build toys. Workifyr is built on top of robust PostgreSQL Row Level Security, ensuring your data is locked down at the database kernel level.
              </p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-2xl flex flex-col gap-6 relative overflow-hidden group">
            <div className="ai-glow opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="size-14 rounded-xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-primary)]">
              <Globe2 className="size-6" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline-sm)] text-[length:var(--text-headline-sm)] font-bold mb-3">Global By Default</h3>
              <p className="text-[var(--color-secondary)] leading-relaxed">
                Deployed on the edge. No matter where your team is located, Workifyr responds in milliseconds, utilizing the absolute latest in React Server Components.
              </p>
            </div>
          </div>

          <div className="glass-card p-8 rounded-2xl flex flex-col gap-6 relative overflow-hidden group">
            <div className="ai-glow opacity-0 group-hover:opacity-10 transition-opacity"></div>
            <div className="size-14 rounded-xl bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] flex items-center justify-center text-[var(--color-primary)]">
              <Users2 className="size-6" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-headline-sm)] text-[length:var(--text-headline-sm)] font-bold mb-3">Customer Obsessed</h3>
              <p className="text-[var(--color-secondary)] leading-relaxed">
                We measure our success by your operational efficiency. If Workifyr doesn't save you at least 20 hours a week in administrative overhead, we have failed.
              </p>
            </div>
          </div>
        </div>

      </main>

      <MarketingFooter />
    </div>
  );
}
