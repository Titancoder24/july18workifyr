"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const supabase = createClient();

      // 1. Create the auth user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { org_name: orgName, full_name: fullName } },
      });
      if (signUpError) {
        toast.error(signUpError.message);
        return;
      }

      // 2. Sign in immediately to get a session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        toast.error(signInError.message);
        return;
      }

      // 3. Create the org, profile, roles, pipeline via RPC
      const { error: rpcError } = await supabase.rpc("signup_create_org", {
        p_org_name: orgName,
        p_full_name: fullName,
      });
      if (rpcError) {
        toast.error(rpcError.message);
        return;
      }

      toast.success(`Welcome to Workifyr, ${fullName.split(" ")[0]}.`);
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-7">
      <h1 className="text-[20px] font-semibold tracking-tight">Create your workspace</h1>
      <p className="text-[13px] mt-1" style={{ color: "var(--color-ink-secondary)" }}>
        One account for your CRM, your HRM, and the AI that ties them together.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <Field label="Organization name">
          <input required autoFocus value={orgName} onChange={(e) => setOrgName(e.target.value)} className="input" />
        </Field>
        <Field label="Your name">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
        </Field>
        <Field label="Work email">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </Field>
        <Field label="Password" hint={<span className="text-[11px]" style={{ color: "var(--color-ink-tertiary)" }}>min 8 characters</span>}>
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </Field>

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </form>

      <div className="mt-5 text-[13px] text-center" style={{ color: "var(--color-ink-secondary)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--color-viridian-700)" }} className="font-medium">
          Sign in
        </Link>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          height: 38px;
          padding: 0 12px;
          border-radius: 8px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          font-size: 13px;
          color: var(--color-ink);
          outline: none;
        }
        .input:focus { border-color: var(--color-viridian-500); }
        .btn-primary {
          height: 38px;
          border-radius: 8px;
          background: var(--color-viridian-500);
          color: white;
          font-size: 13px;
          font-weight: 500;
          border: 0;
          cursor: pointer;
          transition: background 120ms;
        }
        .btn-primary:hover:not(:disabled) { background: var(--color-viridian-700); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-ink-secondary)" }}>{label}</span>
        {hint}
      </div>
      {children}
    </label>
  );
}
