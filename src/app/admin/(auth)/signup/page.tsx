"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminSignup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: name,
          }
        }
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Signup successful. You can now log in.");
        router.push("/admin/login");
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
            Request Control Access.
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed font-medium">
            Join the administrative team to monitor system telemetry, manage user access, and oversee the global database. All new accounts require approval.
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
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Admin Signup</h2>
            <p className="text-gray-500 font-medium">Create your administrative credentials.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-14 px-4 bg-white/[0.03] border border-white/[0.1] rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Admin Email</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 px-4 bg-white/[0.03] border border-white/[0.1] rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all"
                  placeholder="admin@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Master Password</label>
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
              className="w-full h-14 mt-8 bg-[#40826D] text-white font-extrabold text-[15px] rounded-2xl hover:bg-[#346b5a] transition-all focus:ring-4 focus:ring-[#40826D]/30 disabled:opacity-50 flex items-center justify-center gap-2 group shadow-lg shadow-[#40826D]/20"
            >
              {busy ? "Processing..." : (
                <>
                  Request Access
                  <UserPlus className="size-4 group-hover:scale-110 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-gray-500 text-sm">
            Already have access?{" "}
            <Link href="/admin/login" className="text-white font-bold hover:underline transition-all">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
