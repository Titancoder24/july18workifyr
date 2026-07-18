import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { notFound } from "next/navigation";
import remarkGfm from "remark-gfm";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function LegalPage({ params }: { params: { slug: string } }) {
  // Await params as required by Next.js 15+ dynamic route APIs
  const { slug } = await params;

  // Fetch the page from the documentation_pages table (which acts as our CMS)
  const { data: page } = await supabase
    .from("documentation_pages")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!page) {
    // Graceful fallback for Legal pages if the admin hasn't created them yet.
    return (
      <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
        <MarketingNavbar />
        <main className="pt-40 pb-32 min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 capitalize">{slug.replace(/-/g, ' ')}</h1>
          <p className="text-gray-500 text-lg">This page is currently being updated. Please check back later or contact support.</p>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
      <MarketingNavbar />
      
      <main className="pt-40 pb-32">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-16 border-b border-gray-200 pb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter mb-4 text-gray-900">
              {page.title}
            </h1>
            <div className="flex items-center gap-4 text-sm font-medium text-gray-500 uppercase tracking-widest">
              <span>{page.category}</span>
              <span>•</span>
              <span>Last updated: {new Date(page.updated_at || page.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <article className="prose prose-gray max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-[#40826D] hover:prose-a:text-[#2d5c4d] prose-h2:border-b prose-h2:border-gray-100 prose-h2:pb-4 prose-h2:mt-16 first:prose-h2:mt-0 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-img:rounded-2xl">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {page.content}
            </ReactMarkdown>
          </article>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
