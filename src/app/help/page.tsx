"use client";

import { useState } from "react";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { Send, CheckCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HelpCenterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    
    await supabase.from("support_tickets").insert({
      customer_name: formData.get("name") as string,
      customer_email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    });
    
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
      <MarketingNavbar />
      
      <main className="pt-40 pb-32">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-4">Help Center</h1>
            <p className="text-xl text-gray-500">Submit a ticket and our support team will get back to you shortly.</p>
          </div>

          <div className="bg-white p-8 sm:p-12 rounded-[2rem] shadow-xl border border-gray-200">
            {submitted ? (
              <div className="text-center py-12">
                <div className="size-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="size-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Ticket Submitted</h3>
                <p className="text-gray-500">We have received your request and will respond via email.</p>
                <button onClick={() => setSubmitted(false)} className="mt-8 text-[#40826D] font-bold hover:underline">Submit another ticket</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Name</label>
                    <input name="name" required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all bg-gray-50 focus:bg-white" placeholder="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Email</label>
                    <input name="email" required type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all bg-gray-50 focus:bg-white" placeholder="john@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Subject</label>
                  <input name="subject" required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all bg-gray-50 focus:bg-white" placeholder="How can we help?" />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Message</label>
                  <textarea name="message" required rows={6} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] transition-all bg-gray-50 focus:bg-white resize-none" placeholder="Describe your issue..."></textarea>
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-[#40826D] text-white font-bold rounded-xl shadow-lg hover:bg-[#346b5a] hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? "Submitting..." : <><Send className="size-5" /> Submit Ticket</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
