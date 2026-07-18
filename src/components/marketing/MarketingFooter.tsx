import Link from "next/link";
import React from "react";

export default function MarketingFooter() {
  return (
    <footer className="bg-[var(--color-surface)] dark:bg-[var(--color-on-background)] border-t border-[var(--color-outline-variant)]/20 w-full transition-all duration-300 ease-out">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[var(--spacing-gutter)] py-[var(--spacing-section-gap)] px-[var(--spacing-margin-mobile)] md:px-[var(--spacing-margin-desktop)] max-w-[1280px] mx-auto">
        
        <div className="flex flex-col gap-[var(--spacing-stack-md)]">
          <span className="font-[family-name:var(--font-headline-sm)] text-[length:var(--text-headline-sm)] leading-[var(--text-headline-sm--line-height)] font-bold text-[var(--color-primary)] dark:text-[var(--color-primary-fixed)]">
            Workifyr
          </span>
          <p className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] leading-[var(--text-body-md--line-height)] text-[var(--color-secondary)]">
            © 2026 Workifyr. All rights reserved. Unified by Design.
          </p>
        </div>

        <div className="flex flex-col gap-[var(--spacing-stack-sm)]">
          <h4 className="font-[family-name:var(--font-label-md)] text-[length:var(--text-label-md)] tracking-[var(--text-label-md--letter-spacing)] text-[var(--color-on-surface)] font-bold uppercase mb-2">
            Product
          </h4>
          <Link href="/features" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            Features
          </Link>
          <Link href="/pricing" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            Pricing
          </Link>
        </div>

        <div className="flex flex-col gap-[var(--spacing-stack-sm)]">
          <h4 className="font-[family-name:var(--font-label-md)] text-[length:var(--text-label-md)] tracking-[var(--text-label-md--letter-spacing)] text-[var(--color-on-surface)] font-bold uppercase mb-2">
            Company
          </h4>
          <Link href="/about" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            About Us
          </Link>
          <Link href="/docs" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            Docs
          </Link>
        </div>

        <div className="flex flex-col gap-[var(--spacing-stack-sm)]">
          <h4 className="font-[family-name:var(--font-label-md)] text-[length:var(--text-label-md)] tracking-[var(--text-label-md--letter-spacing)] text-[var(--color-on-surface)] font-bold uppercase mb-2">
            Legal
          </h4>
          <Link href="/legal/privacy-policy" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            Privacy Policy
          </Link>
          <Link href="/legal/terms-of-service" className="font-[family-name:var(--font-body-md)] text-[length:var(--text-body-md)] text-[var(--color-secondary)] dark:text-[var(--color-on-secondary-fixed-variant)] hover:text-[var(--color-primary)] transition-colors hover:underline decoration-[var(--color-primary)] underline-offset-4">
            Terms of Service
          </Link>
        </div>

      </div>
    </footer>
  );
}
