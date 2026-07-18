import { createClient } from "@supabase/supabase-js";
import { uploadAsset } from "../actions";
import { Upload, ImageIcon } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AssetsDashboard() {
  const { data: assets } = await supabaseAdmin
    .from("landing_page_assets")
    .select("*")
    .order("section", { ascending: true });

  const getAssetUrl = (section: string) => {
    return assets?.find(a => a.section === section)?.image_url || "";
  };

  const sections = [
    { id: "crm", title: "CRM Dashboard Mockup", desc: "Main mockup used in the Sales pipeline section." },
    { id: "hrm", title: "HRM Dashboard Mockup", desc: "Mockup displaying the HR interface." },
    { id: "payroll", title: "Payroll Engine Mockup", desc: "Mockup for the salary generator." }
  ];

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Landing Page Assets</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage and override static imagery used across the public website.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        
        {/* Table Header */}
        <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-4">Asset ID</div>
          <div className="col-span-3">Current File</div>
          <div className="col-span-5 text-right">Action</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-100">
          {sections.map((sec) => (
            <div key={sec.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors">
              <div className="col-span-4 pr-4">
                <div className="text-[13px] font-semibold text-gray-900 truncate flex items-center gap-2">
                  <ImageIcon className="size-3.5 text-gray-400" /> {sec.title}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{sec.desc}</div>
              </div>
              
              <div className="col-span-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                    {getAssetUrl(sec.id) ? (
                      <img src={getAssetUrl(sec.id)} alt={sec.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-medium text-gray-400 uppercase">None</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="col-span-5 flex justify-end">
                <form action={uploadAsset} className="flex items-center gap-2">
                  <input type="hidden" name="section" value={sec.id} />
                  <input 
                    name="file" type="file" accept="image/*" required 
                    className="block w-48 text-[11px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                  />
                  <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-900 rounded text-[12px] font-medium hover:bg-gray-50 transition-colors shadow-sm">
                    <Upload className="size-3" /> Upload
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}
