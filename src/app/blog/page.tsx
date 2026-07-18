import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function BlogIndex() {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans">
      <MarketingNavbar />
      <main className="flex-1 max-w-4xl mx-auto py-32 px-6 w-full">
        <h1 className="text-[56px] font-extrabold tracking-tighter mb-4">Workifyr Blog</h1>
        <p className="text-xl text-gray-500 mb-16">Insights, updates, and thoughts on building modern business software.</p>
        
        <div className="space-y-12">
          {posts?.length === 0 ? (
            <p className="text-gray-500 italic">No posts published yet. Check back soon!</p>
          ) : (
            posts?.map((post) => (
              <article key={post.id} className="group border-b border-gray-200 pb-12">
                <p className="text-[#40826D] font-mono text-sm font-semibold tracking-wider uppercase mb-4">
                  {new Date(post.created_at).toLocaleDateString()}
                </p>
                <h2 className="text-3xl font-bold text-gray-900 mb-4 group-hover:text-[#40826D] transition-colors">{post.title}</h2>
                <div className="prose prose-gray text-gray-600 line-clamp-3 leading-relaxed">
                  {post.content}
                </div>
              </article>
            ))
          )}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
