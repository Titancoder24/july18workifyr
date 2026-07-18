import { createClient } from "@supabase/supabase-js";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import CommentForm from "./CommentForm"; // we will create a client component for the form

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function CommunityPostPage({ params }: { params: { id: string } }) {
  const { id } = await params;

  const { data: post } = await supabaseAdmin
    .from("community_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) {
    return <div className="text-center py-40">Post not found.</div>;
  }

  const { data: comments } = await supabaseAdmin
    .from("community_comments")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
      <MarketingNavbar />
      
      <main className="pt-32 pb-32">
        <div className="max-w-3xl mx-auto px-6">
          <Link href="/community" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-medium">
            <ArrowLeft className="size-4" /> Back to Community
          </Link>

          <div className="bg-white p-8 sm:p-12 rounded-[2rem] shadow-sm border border-gray-200 mb-8">
            <div className="flex items-center gap-3 text-[13px] text-gray-500 font-medium mb-4">
              <span className="bg-gray-100 px-3 py-1.5 rounded-lg text-gray-700">Posted by {post.author_name}</span>
              <span>{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-6 text-gray-900">{post.title}</h1>
            <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">{post.content}</p>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <MessageCircle className="size-5 text-gray-400" /> 
              {comments?.length || 0} Comments
            </h3>
            <div className="space-y-4">
              {comments?.map((comment) => (
                <div key={comment.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-bold text-gray-900">{comment.author_name}</span>
                    <span className="text-[12px] text-gray-400 font-medium">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Add a Comment</h3>
            <CommentForm postId={post.id} />
          </div>

        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
