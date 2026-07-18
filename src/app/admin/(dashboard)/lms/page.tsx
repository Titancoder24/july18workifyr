import { createClient } from "@supabase/supabase-js";
import { addLmsVideo, deleteLmsVideo } from "../actions";
import { MonitorPlay, Plus, Search, Filter } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function LMSDashboard() {
  const { data: videos } = await supabaseAdmin
    .from("lms_videos")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Learning Management</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Import and organize YouTube training videos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Import Video Panel */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
              <Plus className="size-4 text-gray-500" />
              <h2 className="text-[13px] font-semibold text-gray-900">Import Video</h2>
            </div>
            <form action={addLmsVideo} className="p-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Video Title</label>
                <input 
                  name="title" type="text" required placeholder="e.g. Sales Training V1"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">YouTube URL</label>
                <input 
                  name="youtubeUrl" type="url" required placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Context / Description</label>
                <textarea 
                  name="description" rows={3} placeholder="Optional context..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] resize-y"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-[#1C2434] text-white rounded text-[13px] font-medium hover:bg-[#2A3447] transition-colors shadow-sm">
                Add to Library
              </button>
            </form>
          </div>
        </div>

        {/* Data Table */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
            
            {/* Table Toolbar */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="relative">
                <Search className="size-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Search videos..." className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[12px] focus:outline-none focus:border-[#40826D] w-64" />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-[12px] font-medium rounded hover:bg-gray-50 transition-colors">
                <Filter className="size-3.5" /> Filter
              </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-7">Title & Source</div>
              <div className="col-span-4">Video ID</div>
              <div className="col-span-1 text-right"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {videos?.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-gray-500">
                  No videos in library.
                </div>
              ) : (
                videos?.map((video) => (
                  <div key={video.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors">
                    <div className="col-span-7 pr-4">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">{video.title}</div>
                      <div className="text-[11px] text-gray-500 truncate mt-0.5">{video.description || "No description provided."}</div>
                    </div>
                    <div className="col-span-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[11px] font-mono border border-gray-200">
                        {video.youtube_id}
                      </span>
                    </div>
                    <div className="col-span-1 text-right flex justify-end">
                      <form action={async () => {
                        "use server";
                        await deleteLmsVideo(video.id);
                      }}>
                        <button type="submit" className="text-[12px] font-medium text-red-600 hover:text-red-800 hover:underline">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Table Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-[12px] text-gray-500">
              <span>Total Videos: {videos?.length || 0}</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
