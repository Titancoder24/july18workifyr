import { createClient } from "@supabase/supabase-js";
import { Bell, CheckCircle, Mail } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminTicketsPage() {
  const { data: tickets } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Help Center Tickets</h1>
          <p className="text-[14px] text-gray-500 mt-1 font-medium">Resolve user support requests.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets && tickets.length > 0 ? (
          tickets.map((ticket) => (
            <div key={ticket.id} className={`card p-5 border-l-4 ${ticket.status === 'Open' ? 'border-l-amber-400' : 'border-l-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <span className={`chip ${ticket.status === 'Open' ? 'chip-warning' : 'chip-default'}`}>
                  {ticket.status}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2 truncate">{ticket.subject}</h3>
              <p className="text-[13px] text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                {ticket.message}
              </p>
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500">
                  <Mail className="size-4" />
                  <span className="text-[12px] font-medium truncate w-32" title={ticket.customer_email}>{ticket.customer_email}</span>
                </div>
                {ticket.status === 'Open' && (
                  <button className="text-[12px] font-bold text-[#40826D] hover:text-[#2d5c4d] flex items-center gap-1 transition-colors">
                    <CheckCircle className="size-3.5" /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center p-12 bg-white border border-gray-200 rounded-3xl shadow-sm">
            <Bell className="size-8 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 font-bold mb-1">Inbox Zero</h3>
            <p className="text-gray-500 text-[13px]">No support tickets in the queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}
