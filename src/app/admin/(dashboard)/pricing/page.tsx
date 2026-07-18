import { createClient } from "@supabase/supabase-js";
import { createPricingPlan, updatePricingPlan, deletePricingPlan } from "../actions";
import { DollarSign, Plus, Search } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function PricingCMS() {
  const { data: plans } = await supabaseAdmin
    .from("pricing_plans")
    .select("*")
    .order("price", { ascending: true });

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Pricing Engine</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage subscription tiers, features, and payment links.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Create Plan Panel */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
              <Plus className="size-4 text-gray-500" />
              <h2 className="text-[13px] font-semibold text-gray-900">Create New Tier</h2>
            </div>
            <form action={createPricingPlan} className="p-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Plan Name</label>
                <input 
                  name="name" type="text" required placeholder="e.g. Enterprise"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Price ($)</label>
                  <input 
                    name="price" type="number" step="0.01" required placeholder="49.00"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Interval</label>
                  <input 
                    name="interval" type="text" required defaultValue="month"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Payment Link</label>
                <input 
                  name="payment_link" type="url" placeholder="https://buy.stripe.com/..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Features (One per line)</label>
                <textarea 
                  name="features" rows={4} required placeholder="Unlimited Users..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] resize-y"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-[#1C2434] text-white rounded text-[13px] font-medium hover:bg-[#2A3447] transition-colors shadow-sm">
                Deploy Tier
              </button>
            </form>
          </div>
        </div>

        {/* Existing Plans Editor */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
            
            {/* Table Toolbar */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-gray-900">Active Subscriptions</h2>
            </div>

            <div className="divide-y divide-gray-200 bg-gray-50/30">
              {plans?.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-gray-500">
                  No pricing plans active.
                </div>
              ) : (
                plans?.map((plan) => (
                  <form key={plan.id} action={updatePricingPlan} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 relative group bg-white">
                    <input type="hidden" name="id" value={plan.id} />
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Plan Configuration</label>
                        <div className="flex gap-2">
                          <input 
                            name="name" type="text" required defaultValue={plan.name}
                            className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[13px] font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-[13px] font-medium text-gray-500">$</span>
                            <input 
                              name="price" type="number" step="0.01" required defaultValue={plan.price}
                              className="w-16 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[13px] font-semibold text-gray-900 focus:bg-white focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                            />
                            <span className="text-[13px] font-medium text-gray-400">/</span>
                            <input 
                              name="interval" type="text" required defaultValue={plan.interval}
                              className="w-16 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[13px] font-medium text-gray-600 focus:bg-white focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Payment Link</label>
                        <input 
                          name="payment_link" type="url" defaultValue={plan.payment_link || ""} placeholder="https://buy.stripe.com/..."
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[13px] focus:bg-white focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4 flex flex-col">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Feature List</label>
                        <textarea 
                          name="features" rows={4} required defaultValue={(plan.features as string[])?.join("\n")}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[12px] focus:bg-white focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] resize-y"
                        />
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2">
                        <button formAction={async () => {
                          "use server";
                          await deletePricingPlan(plan.id);
                        }} className="px-3 py-1.5 text-[12px] font-medium text-red-600 border border-transparent hover:bg-red-50 hover:border-red-100 rounded transition-colors">
                          Delete
                        </button>
                        <button type="submit" className="px-3 py-1.5 bg-white border border-gray-200 text-gray-900 rounded text-[12px] font-medium hover:bg-gray-50 transition-colors shadow-sm">
                          Save Changes
                        </button>
                      </div>
                    </div>

                  </form>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
