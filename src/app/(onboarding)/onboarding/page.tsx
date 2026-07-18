/**
 * Onboarding placeholder. The signup flow already creates the org via the
 * SECURITY DEFINER RPC; this route exists for users who land here without an
 * org_id (e.g. invitation flows that completed auth but not org assignment).
 */
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}>
      <div className="card p-7 max-w-[420px] w-full">
        <h1 className="display text-[28px] leading-none">Almost there.</h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--color-ink-secondary)" }}>
          Your account isn't attached to a workspace yet. If you were invited, follow the link in your email.
          Otherwise, create a fresh workspace.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-[13px] font-medium"
            style={{ background: "var(--color-viridian-500)", color: "white" }}
          >
            Create workspace
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-[13px]"
            style={{ color: "var(--color-ink-secondary)" }}
          >
            Use a different account
          </Link>
        </div>
      </div>
    </div>
  );
}
