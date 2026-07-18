import { createClient } from "@supabase/supabase-js";
import { createBlogPost, deleteBlogPost } from "../actions";
import { FileText, Plus, Search, Filter, MoreHorizontal } from "lucide-react";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function CMSDashboard() {
  const { data: posts } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Content Management</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Manage SEO-optimized blog posts for your public site.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Create Post Panel */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-gray-200 rounded shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
              <Plus className="size-4 text-gray-500" />
              <h2 className="text-[13px] font-semibold text-gray-900">Publish New Post</h2>
            </div>
            <form action={createBlogPost} className="p-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Post Title</label>
                <input 
                  name="title" type="text" required placeholder="e.g. Workfyr 2.0 Released"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">Markdown Content</label>
                <textarea 
                  name="content" required rows={12} placeholder="Write your markdown here..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-[13px] font-mono focus:outline-none focus:border-[#40826D] focus:ring-1 focus:ring-[#40826D] resize-y"
                />
              </div>
              <button type="submit" className="w-full py-2 bg-[#1C2434] text-white rounded text-[13px] font-medium hover:bg-[#2A3447] transition-colors shadow-sm">
                Publish Immediately
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
                <input type="text" placeholder="Search posts..." className="pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[12px] focus:outline-none focus:border-[#40826D] w-64" />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-[12px] font-medium rounded hover:bg-gray-50 transition-colors">
                <Filter className="size-3.5" /> Filter
              </button>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-6">Title & Slug</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-2 text-right">Date</div>
              <div className="col-span-1 text-right"></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-100">
              {posts?.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-gray-500">
                  No blog posts found.
                </div>
              ) : (
                posts?.map((post) => (
                  <div key={post.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors">
                    <div className="col-span-6 pr-4">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">{post.title}</div>
                      <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5">/{post.slug}</div>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                        <span className="size-1.5 rounded-full bg-emerald-500"></span> Live
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-[12px] text-gray-500">
                      {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="col-span-1 text-right flex justify-end">
                      <form action={async () => {
                        "use server";
                        await deleteBlogPost(post.id);
                      }}>
                        <button type="submit" className="text-[12px] font-medium text-red-600 hover:text-red-800 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Table Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-[12px] text-gray-500">
              <span>Showing {posts?.length || 0} results</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
