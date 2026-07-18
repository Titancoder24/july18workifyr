"use client";

import { useEffect, useState } from "react";
import MarketingNavbar from "@/components/marketing/MarketingNavbar";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { MessageSquare, ArrowUp, Send } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CommunityPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function fetchPosts() {
    setLoading(true);
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPosts(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function handleCreatePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await supabase.from("community_posts").insert({
      author_name: formData.get("name") as string,
      author_email: formData.get("email") as string,
      title: formData.get("title") as string,
      content: formData.get("content") as string,
    });
    
    setShowModal(false);
    fetchPosts();
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#40826D]/30 text-gray-900">
      <MarketingNavbar />
      
      <main className="pt-40 pb-32">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2">Community Forum</h1>
              <p className="text-gray-500">Ask questions, share tips, and connect with other users.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[#40826D] text-white font-bold rounded-xl shadow-lg hover:bg-[#346b5a] transition-all">
              <MessageSquare className="size-4" /> New Post
            </button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-20 text-gray-400 font-medium">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20 bg-white border border-gray-200 rounded-3xl shadow-sm">
                <MessageSquare className="size-12 text-gray-200 mx-auto mb-4" />
                <h3 className="text-gray-900 font-bold mb-1">No posts yet</h3>
                <p className="text-gray-500">Be the first to start a discussion.</p>
              </div>
            ) : (
              posts.map((post) => (
                <Link key={post.id} href={`/community/${post.id}`} className="block bg-white p-6 rounded-2xl border border-gray-200 hover:border-[#40826D]/50 hover:shadow-md transition-all group">
                  <div className="flex items-start gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <button className="p-2 text-gray-400 group-hover:text-[#40826D] hover:bg-gray-50 rounded-lg transition-colors">
                        <ArrowUp className="size-5" />
                      </button>
                      <span className="font-bold text-gray-700">{post.upvotes}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
                      <p className="text-gray-600 line-clamp-2 mb-4 leading-relaxed">{post.content}</p>
                      <div className="flex items-center gap-3 text-[13px] text-gray-500 font-medium">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-gray-700">Posted by {post.author_name}</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>

      {/* CREATE POST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Create a Post</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-900">✕</button>
            </div>
            <form onSubmit={handleCreatePost} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input name="name" required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[14px]" placeholder="Your Name" />
                <input name="email" required type="email" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[14px]" placeholder="Email" />
              </div>
              <input name="title" required type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[14px] font-medium" placeholder="Post Title" />
              <textarea name="content" required rows={5} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-[#40826D] transition-all bg-gray-50 focus:bg-white text-[14px] resize-none" placeholder="What's on your mind?"></textarea>
              <button type="submit" className="w-full py-4 bg-[#40826D] text-white font-bold rounded-xl shadow-md hover:bg-[#346b5a] transition-all flex items-center justify-center gap-2">
                <Send className="size-4" /> Post to Community
              </button>
            </form>
          </div>
        </div>
      )}

      <MarketingFooter />
    </div>
  );
}
