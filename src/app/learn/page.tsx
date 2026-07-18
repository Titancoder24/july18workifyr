import { createClient } from "@supabase/supabase-js";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { PlayCircle, GraduationCap } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function LearnPage() {
  const { data: videos } = await supabase
    .from("lms_videos")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
      <MarketingNavbar />
      
      <main className="pt-40 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <GraduationCap className="size-16 text-[#40826D] mx-auto mb-6" />
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter mb-6 text-gray-900">Workfyr Academy</h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">Master the best CRM and HR software out there. Explore our library of video tutorials and courses.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {videos && videos.length > 0 ? (
              videos.map((video) => (
                <div key={video.id} className="bg-white rounded-3xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#40826D]/50 transition-all group">
                  <div className="aspect-video bg-gray-900 relative flex items-center justify-center overflow-hidden">
                    {/* Assuming video.url is a youtube embed URL or similar. If it's a direct mp4, you'd use a <video> tag. */}
                    {video.url ? (
                      <iframe 
                        src={video.url} 
                        className="w-full h-full absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen 
                      />
                    ) : (
                      <div className="text-center text-gray-500 flex flex-col items-center">
                        <PlayCircle className="size-12 mb-2 opacity-50 group-hover:scale-110 transition-transform" />
                        <span className="text-[13px] font-bold tracking-widest uppercase">Video</span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-[11px] font-bold uppercase tracking-widest rounded-full mb-4">
                      {video.module}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{video.title}</h3>
                    <p className="text-gray-500 text-[14px] leading-relaxed line-clamp-2">
                      {video.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-white border border-gray-200 rounded-3xl shadow-sm">
                <PlayCircle className="size-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-gray-900 font-bold mb-1">No Videos Yet</h3>
                <p className="text-gray-500 text-[14px]">The academy is currently being updated. Check back soon!</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
