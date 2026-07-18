import Link from "next/link";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Check } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="bg-[var(--color-background)] text-[var(--color-on-background)] font-[family-name:var(--font-body-md)] min-h-screen flex flex-col">
      <MarketingNavbar />
      
      <main className="flex-1 pt-32 pb-[var(--spacing-section-gap)] px-[var(--spacing-margin-mobile)] md:px-[var(--spacing-margin-desktop)] max-w-[1280px] mx-auto w-full">
        
        {/* Header */}
        <section className="text-center flex flex-col items-center gap-[var(--spacing-stack-md)] mb-20">
          <h1 className="font-[family-name:var(--font-display-xl)] text-[length:var(--text-headline-lg-mobile)] md:text-[length:var(--text-display-xl)] leading-[var(--text-display-xl--line-height)] tracking-[var(--text-display-xl--letter-spacing)] font-extrabold text-[var(--color-on-background)]">
            Simple, <span className="text-[var(--color-primary)]">transparent pricing.</span>
          </h1>
          <p className="font-[family-name:var(--font-body-lg)] text-[length:var(--text-body-lg)] text-[var(--color-secondary)] max-w-2xl mt-4">
            No hidden fees. No complex tiers. Just one unified platform to run your business.
          </p>
        </section>

        {/* Pricing Card */}
        <div className="max-w-4xl mx-auto glass-card rounded-[2rem] p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row gap-12 border border-[var(--color-primary-container)]/30">
          <div className="ai-glow"></div>
          
          <div className="flex-1 z-10 flex flex-col justify-center">
            <h2 className="font-[family-name:var(--font-headline-lg)] text-[length:var(--text-headline-md)] font-bold mb-2">Pro Workspace</h2>
            <p className="text-[var(--color-secondary)] mb-8">Everything you need to scale your organization.</p>
            
            <div className="flex items-baseline gap-2 mb-8">
              <span className="font-[family-name:var(--font-display-xl)] text-6xl font-extrabold text-[var(--color-primary)]">$49</span>
              <span className="text-[var(--color-secondary)] font-[family-name:var(--font-label-md)] uppercase tracking-wider">/ user / month</span>
            </div>

            <Link href="/login" className="bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] px-8 py-4 rounded-xl font-[family-name:var(--font-label-md)] text-[length:var(--text-label-md)] tracking-[var(--text-label-md--letter-spacing)] text-center shadow-sm hover:opacity-90 transition-opacity w-full">
              Deploy Workspace
            </Link>
          </div>

          <div className="flex-1 z-10 bg-[var(--color-surface-container)]/50 rounded-2xl p-8 border border-[var(--color-outline-variant)]/50">
            <h3 className="font-bold mb-6 text-[length:var(--text-body-lg)]">What's included</h3>
            <ul className="space-y-4">
              {['Unlimited CRM Pipelines', 'Unlimited Deals & Contacts', 'Full HRM Directory', 'Payroll & Invoicing Engine', 'Row Level Security', 'Priority Support'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-[var(--color-secondary)]">
                  <div className="size-5 rounded-full bg-[var(--color-primary-container)]/20 flex items-center justify-center">
                    <Check className="size-3 text-[var(--color-primary)]" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

      </main>

      <MarketingFooter />
    </div>
  );
}
