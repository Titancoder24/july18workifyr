"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-7" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }

      // Handle users who signed up but whose org creation failed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .single();

        if (!profile?.org_id) {
          const meta = user.user_metadata;
          if (meta?.org_name && meta?.full_name) {
            const { error: rpcError } = await supabase.rpc("signup_create_org", {
              p_org_name: meta.org_name,
              p_full_name: meta.full_name,
            });
            if (rpcError) {
              toast.error(rpcError.message);
              return;
            }
          } else {
            router.replace("/signup");
            return;
          }
        }
      }

      if (email === "admin@workifyr.com" && next === "/dashboard") {
        router.replace("/admin");
      } else {
        router.replace(next);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-7">
      <h1 className="text-[20px] font-semibold tracking-tight">Welcome back</h1>
      <p className="text-[13px] mt-1" style={{ color: "var(--color-ink-secondary)" }}>
        Sign in to your Workifyr workspace.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <Field label="Email">
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Password" hint={
          <Link href="/forgot-password" className="text-[12px]" style={{ color: "var(--color-viridian-700)" }}>
            Forgot?
          </Link>
        }>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-5 text-[13px] text-center" style={{ color: "var(--color-ink-secondary)" }}>
        New to Workifyr?{" "}
        <Link href="/signup" style={{ color: "var(--color-viridian-700)" }} className="font-medium">
          Create an account
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
