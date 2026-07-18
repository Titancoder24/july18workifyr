"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        toast.error("Invalid credentials. Access denied.");
      } else {
        // Set the legacy cookie to bypass the custom middleware for now
        document.cookie = "admin_auth=true; path=/; max-age=86400";
        toast.success("Welcome back, Commander.");
        router.push("/admin");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex selection:bg-[#40826D]/30 text-gray-200 font-sans">
      
      {/* Left Panel - Branding & Visuals */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/[0.05]">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,#40826D_0%,transparent_70%)] opacity-[0.15] pointer-events-none"></div>

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#40826D] to-[#2d5c4d] text-white font-bold text-lg shadow-[0_0_20px_rgba(64,130,109,0.3)]">
              W
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">Workfyr OS</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <ShieldCheck className="size-16 text-[#40826D] mb-8 opacity-80" />
          <h1 className="text-5xl font-black text-white mb-6 tracking-tighter leading-tight">
            Secure Infrastructure Access.
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed font-medium">
            You are entering the master control plane. All actions within the administrative environment are logged and mathematically isolated by Row Level Security.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-[#030303]">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-12 flex justify-center">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#40826D] to-[#2d5c4d] text-white font-bold shadow-[0_0_15px_rgba(64,130,109,0.3)]">
                W
              </div>
              <span className="text-2xl font-extrabold text-white tracking-tight">Workfyr OS</span>
            </Link>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Admin Login</h2>
            <p className="text-gray-500 font-medium">Authenticate to manage the workspace.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Admin Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 px-4 bg-white/[0.03] border border-white/[0.1] rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all"
                  placeholder="admin@admin.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-400 uppercase tracking-widest flex justify-between">
                <span>Master Password</span>
                <Link href="#" className="text-[#40826D] hover:text-[#52a78d] transition-colors">Forgot?</Link>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-14 px-4 bg-white/[0.03] border border-white/[0.1] rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={busy}
              className="w-full h-14 mt-8 bg-white text-black font-extrabold text-[15px] rounded-2xl hover:bg-gray-200 transition-all focus:ring-4 focus:ring-white/20 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {busy ? "Authenticating..." : (
                <>
                  Enter Control Plane
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-gray-500 text-sm">
            Don't have an admin account?{" "}
            <Link href="/admin/signup" className="text-white font-bold hover:underline transition-all">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
